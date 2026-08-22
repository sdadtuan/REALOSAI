import { BadRequestException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AiAuditService } from '../ai-intelligence/ai-audit.service';
import { ChotClosedLoopService } from '../leads/chot-closed-loop.service';
import { PlaybooksRepository } from './playbooks.repository';
import { buildPlaybookRankResponse, type PlaybookRankContext } from './playbook-closed-loop.util';
import {
  CreatePlaybookBody,
  CreatePlaybookChunkBody,
  PlaybookCitation,
  PlaybookDetailResponse,
  PlaybookListResponse,
  PlaybookRagQuery,
  PlaybookRagResponse,
  buildRagAnswer,
  cosineSimilarity,
  embedPlaybookText,
  keywordScore,
} from './playbooks.types';

@Injectable()
export class PlaybooksService {
  constructor(
    private readonly repo: PlaybooksRepository,
    private readonly audit: AiAuditService,
    private readonly closedLoop: ChotClosedLoopService,
  ) {}

  private async assertReady(): Promise<void> {
    if (!(await this.repo.tableReady())) {
      throw new ServiceUnavailableException({
        error: 'schema_not_ready',
        message: 'ai_playbooks tables are not ready — apply revenue-os-ai DDL',
      });
    }
  }

  async list(limit?: number, offset?: number, requestId?: string): Promise<PlaybookListResponse> {
    await this.assertReady();
    await this.repo.ensureSeedData();
    const out = await this.repo.list({
      limit: limit ?? 50,
      offset: offset ?? 0,
    });
    return {
      data: out,
      meta: { request_id: requestId?.trim() || randomUUID() },
      errors: [],
    };
  }

  async getById(id: string, requestId?: string): Promise<PlaybookDetailResponse> {
    await this.assertReady();
    const playbook = await this.repo.findById(id);
    if (!playbook) throw new NotFoundException({ error: 'playbook_not_found' });
    const chunks = await this.repo.listChunks(id);
    return {
      data: { playbook, chunks },
      meta: { request_id: requestId?.trim() || randomUUID() },
      errors: [],
    };
  }

  async create(body: CreatePlaybookBody, actorId?: string | null, requestId?: string): Promise<PlaybookDetailResponse> {
    await this.assertReady();
    if (!body.title?.trim()) {
      throw new BadRequestException({ error: 'title_required' });
    }
    const playbook = await this.repo.insertPlaybook({ ...body, createdBy: actorId ?? null });
    return this.getById(playbook.id, requestId);
  }

  async addChunk(
    playbookId: string,
    body: CreatePlaybookChunkBody,
    requestId?: string,
  ): Promise<PlaybookDetailResponse> {
    await this.assertReady();
    if (!body.chunk_key?.trim() || !body.body?.trim()) {
      throw new BadRequestException({ error: 'chunk_key_and_body_required' });
    }
    await this.repo.insertChunk(playbookId, body);
    return this.getById(playbookId, requestId);
  }

  async listRanked(contextRaw?: string, requestId?: string) {
    await this.assertReady();
    await this.repo.ensureSeedData();
    const context: PlaybookRankContext = contextRaw === 'general' ? 'general' : 'cskh_sla';
    const [chunks, abPayload] = await Promise.all([
      this.repo.listAllChunks(),
      this.closedLoop.getPlaybookAbMetrics(30),
    ]);
    const ranked = buildPlaybookRankResponse({
      context,
      abMetrics: {
        window_days: abPayload.window_days,
        ai_v1: abPayload.ai_v1,
        sop: abPayload.sop,
        unknown: abPayload.unknown,
        narrative: abPayload.narrative,
      },
      chunks: chunks.map((row) => ({
        playbook_id: row.playbook_id,
        playbook_title: row.playbook_title,
        chunk_id: row.id,
        chunk_title: row.title,
        chunk_key: row.chunk_key,
        body: row.body,
      })),
    });
    return {
      data: ranked,
      meta: { request_id: requestId?.trim() || randomUUID() },
      errors: [],
    };
  }

  async ragQuery(input: PlaybookRagQuery, requestId?: string): Promise<PlaybookRagResponse> {
    const started = Date.now();
    const q = String(input.query ?? '').trim();
    if (q.length < 2) {
      throw new BadRequestException({ error: 'query_too_short', message: 'query must be at least 2 characters' });
    }
    await this.assertReady();
    await this.repo.ensureSeedData();
    const limit = Math.min(Math.max(Number(input.limit ?? 5) || 5, 1), 10);
    const queryVec = embedPlaybookText(q);
    const rows = await this.repo.listAllChunks(input.playbook_id?.trim() || undefined);

    const scored = rows
      .map((row) => {
        const emb = row.embedding_json ?? embedPlaybookText(`${row.title} ${row.body}`);
        const vectorScore = cosineSimilarity(queryVec, emb);
        const kw = keywordScore(q, `${row.title} ${row.body}`);
        const score = vectorScore * 0.7 + Math.min(kw, 3) * 0.1;
        return { row, score: kw > 0 ? score + kw * 0.2 : score };
      })
      .filter((item) => item.score > 0.05)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    const citations: PlaybookCitation[] = scored.map(({ row, score }) => ({
      playbook_id: row.playbook_id,
      playbook_title: row.playbook_title,
      chunk_id: row.id,
      chunk_title: row.title,
      excerpt: row.body.slice(0, 220),
      score: Number(score.toFixed(4)),
    }));

    const retrievalEngine = citations.length ? 'vector' : 'keyword';
    const answer = buildRagAnswer(q, citations);

    return {
      data: {
        query: q,
        answer,
        citations,
        retrieval_engine: retrievalEngine,
        stub_mode: true,
      },
      meta: {
        request_id: requestId?.trim() || this.audit.newRequestId(),
        latency_ms: Date.now() - started,
      },
      errors: [],
    };
  }
}
