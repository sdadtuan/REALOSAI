import { BadRequestException, Injectable } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import {
  buildRagSearchQuery,
  chunkDocumentText,
  extractDocumentText,
  MKT_AI_RAG_ALLOWED_MIMES,
  MKT_AI_RAG_MAX_BYTES,
  normalizeMime,
  sha256Hex,
} from './marketing-ai-rag.util';
import { MarketingAiPlannerRepository } from './marketing-ai-planner.repository';
import type {
  MktAiBrief,
  MktAiCitation,
  MktAiDocumentRow,
  MktAiRagChunkHit,
} from './marketing-ai-planner.types';

export interface MktAiRagContext {
  enabled: boolean;
  query: string;
  chunks: MktAiRagChunkHit[];
  promptBlock: string;
}

const RAG_TOP_K = 5;

@Injectable()
export class MarketingAiRagService {
  constructor(
    private readonly config: AppConfigService,
    private readonly repo: MarketingAiPlannerRepository,
  ) {}

  isFeatureEnabled(): boolean {
    return this.config.mktAiRagEnabled;
  }

  shouldUseRag(brief: MktAiBrief, indexedCount: number): boolean {
    if (!this.isFeatureEnabled() || indexedCount <= 0) return false;
    return brief.use_rag !== false;
  }

  async listDocuments(lifecycleId: number): Promise<MktAiDocumentRow[]> {
    return this.repo.listDocuments(lifecycleId);
  }

  async uploadDocument(
    lifecycleId: number,
    file: Express.Multer.File,
    actorEmail: string,
    tag?: string,
  ): Promise<MktAiDocumentRow> {
    if (!this.isFeatureEnabled()) {
      throw new BadRequestException({ error: 'mkt_ai_rag_disabled' });
    }
    if (!file?.buffer?.length) {
      throw new BadRequestException({ error: 'file_required' });
    }
    if (file.size > MKT_AI_RAG_MAX_BYTES) {
      throw new BadRequestException({ error: 'file_too_large', max_bytes: MKT_AI_RAG_MAX_BYTES });
    }

    const filename = String(file.originalname ?? 'upload.bin').trim() || 'upload.bin';
    const mimeType = normalizeMime(String(file.mimetype ?? ''), filename);
    if (!MKT_AI_RAG_ALLOWED_MIMES.has(mimeType)) {
      throw new BadRequestException({ error: 'unsupported_mime', mime_type: mimeType });
    }

    const hash = sha256Hex(file.buffer);
    const existing = await this.repo.findDocumentByHash(lifecycleId, hash);
    if (existing?.status === 'indexed') return existing;

    const doc = await this.repo.insertDocument({
      lifecycle_id: lifecycleId,
      filename,
      mime_type: mimeType,
      storage_key: `lifecycle/${lifecycleId}/${hash.slice(0, 16)}`,
      file_size_bytes: file.size,
      sha256_hex: hash,
      status: 'indexing',
      uploaded_by: actorEmail,
      metadata_json: tag?.trim() ? { tag: tag.trim() } : {},
    });

    try {
      const text = extractDocumentText(file.buffer, mimeType);
      const chunks = chunkDocumentText(text, { title: filename.replace(/\.[^.]+$/, '') });
      if (!chunks.length) {
        throw new Error('no_chunks_produced');
      }
      await this.repo.replaceDocumentChunks(doc.id, chunks);
      return this.repo.updateDocument(doc.id, {
        status: 'indexed',
        chunk_count: chunks.length,
        error_message: null,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return this.repo.updateDocument(doc.id, {
        status: 'failed',
        chunk_count: 0,
        error_message: message,
      });
    }
  }

  async buildForStrategy(lifecycleId: number, brief: MktAiBrief): Promise<MktAiRagContext> {
    const docs = await this.repo.listDocuments(lifecycleId);
    const indexedCount = docs.filter((d) => d.status === 'indexed' && d.chunk_count > 0).length;
    const enabled = this.shouldUseRag(brief, indexedCount);
    if (!enabled) {
      return { enabled: false, query: '', chunks: [], promptBlock: '' };
    }

    const query = buildRagSearchQuery(brief);
    const chunks = query
      ? await this.repo.searchDocumentChunks(lifecycleId, query, RAG_TOP_K)
      : await this.repo.listTopDocumentChunks(lifecycleId, RAG_TOP_K);

    return {
      enabled: true,
      query,
      chunks,
      promptBlock: this.formatPromptBlock(chunks),
    };
  }

  formatPromptBlock(chunks: MktAiRagChunkHit[]): string {
    if (!chunks.length) return '';
    const lines = chunks.map((c, idx) => {
      const page = c.page_no != null ? ` p.${c.page_no}` : '';
      return `[${idx + 1}] ${c.filename}${page}: ${c.body.slice(0, 700)}`;
    });
    return [
      'Tài liệu thương hiệu (Brand KB) — ưu tiên dẫn chứng từ các đoạn sau:',
      ...lines,
      '',
      'Khi viết insights_evidence và market_context, phải bám sát nguồn trên.',
    ].join('\n');
  }

  attachCitations(
    chunks: MktAiRagChunkHit[],
    sectionKeys: string[] = ['insights_evidence', 'market_context', 'market_message'],
  ): Record<string, MktAiCitation[]> {
    if (!chunks.length) return {};
    const out: Record<string, MktAiCitation[]> = {};
    const primary = chunks[0];
    const cite = (chunk: MktAiRagChunkHit): MktAiCitation => ({
      chunk_id: chunk.chunk_id,
      document_id: chunk.document_id,
      filename: chunk.filename,
      page_no: chunk.page_no,
      excerpt: chunk.body.slice(0, 160),
    });

    out[sectionKeys[0]] = [cite(primary)];
    if (chunks[1] && sectionKeys[1]) {
      out[sectionKeys[1]] = [cite(chunks[1])];
    }
    if (chunks[2] && sectionKeys[2]) {
      out[sectionKeys[2]] = [cite(chunks[2])];
    }
    return out;
  }
}
