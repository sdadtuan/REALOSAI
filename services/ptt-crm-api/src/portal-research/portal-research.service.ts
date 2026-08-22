import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
  StreamableFile,
} from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { sectionsFromReportSnapshot } from '../market-research/market-research-docx.util';
import { buildResearchReportPdf } from '../market-research/market-research-pdf.util';
import type { ResearchReportSnapshot } from '../market-research/market-research-report-snapshot.util';
import {
  assertPortalReportReadable,
  buildPortalWatermark,
} from '../market-research/portal-publish.util';
import { normalizeReportExec } from '../market-research/report-exec.util';
import {
  PORTAL_RAG_CORPUS_STATUSES,
  type PortalRagSearchInput,
  type PortalReportsListInput,
  type PortalResearchHealth,
  type PortalResearchReportCard,
  type PortalResearchReportDetail,
  type PortalThemeQuarterAnalyticsPayload,
  type RagSearchResult,
} from '../market-research/market-research.types';
import { fetchOpenAIEmbedding } from '../market-research/openai-embed.util';
import { enrichThemeQuarterRows } from '../market-research/theme-quarter-delta.util';
import {
  embedInsightText,
  parseRagStaleOnlyFlag,
  rankRagHits,
  shouldSkipRagEmbed,
} from '../market-research/research-rag.util';
import { shouldUsePgvectorAnn } from '../market-research/pgvector.util';
import {
  REPORT_PDF_STALE_FOOTER_PORTAL,
  reportSnapshotHasStaleInsights,
} from '../market-research/report-pdf-stale.util';
import { PortalJwtPayload } from '../portal/portal-jwt.util';
import { annotatePortalReportRow, collectReportInsightIds } from './portal-report-stale.util';
import { PortalResearchRepository } from './portal-research.repository';
import type { PortalCjSummary, PortalResearchVersionRecord } from './portal-research.types';

function mapReadableError(err: unknown): never {
  const code = (err as Error & { code?: string }).code;
  if (code === 'not_found') {
    throw new NotFoundException({ error: 'not_found' });
  }
  if (code === 'embargo_active' || code === 'report_expired') {
    throw new ForbiddenException({ error: code });
  }
  throw err;
}

function asOfFromSnapshot(snapshot: Record<string, unknown>): string | null {
  const cover = snapshot.cover;
  if (cover && typeof cover === 'object' && 'as_of' in cover) {
    const asOf = (cover as { as_of?: unknown }).as_of;
    return asOf == null || asOf === '' ? null : String(asOf);
  }
  return null;
}

function portalExec(snapshot: Record<string, unknown>): { vi: string; en: string | null } {
  const exec = normalizeReportExec(snapshot.exec);
  return {
    vi: exec.vi,
    en: exec.en_status === 'approved' ? exec.en : null,
  };
}

function watermarkFor(user: PortalJwtPayload, at: Date): string {
  return buildPortalWatermark({
    clientId: user.client_id,
    email: user.email,
    at,
  });
}

function toCard(
  row: PortalResearchVersionRecord,
  watermark: string,
  hasStaleInsights = false,
): PortalResearchReportCard {
  return {
    version_id: row.id,
    version: row.version,
    as_of: asOfFromSnapshot(row.content_snapshot),
    expires_at: row.expires_at,
    watermark,
    has_stale_insights: hasStaleInsights,
  };
}

@Injectable()
export class PortalResearchService implements OnModuleInit {
  private ragPgvectorReady = false;

  constructor(
    private readonly repo: PortalResearchRepository,
    private readonly config: AppConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      this.ragPgvectorReady = await this.repo.probePgvectorReady();
    } catch {
      this.ragPgvectorReady = false;
    }
  }

  health(): PortalResearchHealth {
    const openaiKey = (process.env.OPENAI_API_KEY ?? process.env.OPENAI_KEY ?? '').trim();
    const embedLive = Boolean(this.config.researchRagOpenaiEmbedEnabled && openaiKey);
    return {
      ok: true,
      enabled: true,
      rag_enabled: Boolean(this.config.researchRagEnabled),
      rag_openai_embed_enabled: embedLive,
      rag_embed_model: embedLive ? 'openai' : 'local',
      rag_pgvector_enabled: Boolean(this.config.researchRagPgvectorEnabled),
      rag_pgvector_ready: this.ragPgvectorReady,
    };
  }

  async searchInsights(
    user: PortalJwtPayload,
    input: PortalRagSearchInput,
  ): Promise<RagSearchResult> {
    if (!this.config.researchRagEnabled) {
      return { hits: [], note: 'rag_disabled' };
    }
    const q = String(input.q ?? '').trim();
    if (!q) {
      throw new BadRequestException({ error: 'rag_query_required' });
    }
    const rawLimit = Number(input.limit);
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(Math.floor(rawLimit), 20) : 10;
    const themeCode = String(input.theme_code ?? '').trim() || undefined;
    const staleOnly = parseRagStaleOnlyFlag(input.stale_only);
    const resolved = await this.resolveQueryVec(q);
    if (!resolved.ok) {
      return { hits: [], note: resolved.note };
    }
    const annVec = resolved.queryVec ?? embedInsightText(q);
    const rows = shouldUsePgvectorAnn(
      this.config.researchRagPgvectorEnabled,
      this.ragPgvectorReady,
      annVec,
    )
      ? await this.repo.listPublishedEmbeddingsByVec(user.client_id, themeCode, annVec, 50)
      : await this.repo.listPublishedEmbeddings(user.client_id, themeCode);
    const scoped = rows.filter((row) => row.client_id === user.client_id);
    return {
      hits: rankRagHits(q, scoped, {
        theme_code: themeCode,
        limit,
        queryVec: annVec,
        corpusStatuses: PORTAL_RAG_CORPUS_STATUSES,
        stale_only: staleOnly,
      }),
    };
  }

  async getThemeQuarterAnalytics(
    user: PortalJwtPayload,
    yearInput?: number,
  ): Promise<PortalThemeQuarterAnalyticsPayload> {
    const year = yearInput ?? new Date().getUTCFullYear();
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      throw new BadRequestException({ error: 'invalid_year' });
    }
    const currentRows = await this.repo.getThemeQuarterAnalytics(user.client_id, year);
    const priorYearRows =
      year > 2000
        ? await this.repo.getThemeQuarterAnalytics(user.client_id, year - 1)
        : [];
    const rows = enrichThemeQuarterRows(currentRows, priorYearRows);
    return {
      ok: true,
      year,
      client_id: user.client_id,
      corpus_statuses: PORTAL_RAG_CORPUS_STATUSES,
      rows,
    };
  }

  async listReports(
    user: PortalJwtPayload,
    input: PortalReportsListInput = {},
  ): Promise<{ items: PortalResearchReportCard[] }> {
    const rows = await this.repo.listPortalVisibleVersions(user.client_id);
    const now = new Date();
    const watermark = watermarkFor(user, now);
    const readable: PortalResearchVersionRecord[] = [];
    for (const row of rows) {
      try {
        assertPortalReportReadable({
          portalVisible: row.portal_visible,
          embargoUntil: row.embargo_until,
          expiresAt: row.expires_at,
          now,
        });
      } catch {
        continue;
      }
      readable.push(row);
    }
    const allIds = new Set<number>();
    for (const row of readable) {
      for (const id of collectReportInsightIds(row.content_snapshot)) {
        allIds.add(id);
      }
    }
    const validToById =
      allIds.size > 0
        ? await this.repo.listPublishedInsightValidTo(user.client_id, [...allIds])
        : new Map<number, string | null>();
    const items = readable.map((row) =>
      toCard(
        row,
        watermark,
        reportSnapshotHasStaleInsights(row.content_snapshot, validToById, now),
      ),
    );
    const staleOnly = parseRagStaleOnlyFlag(input.stale_only);
    return {
      items: staleOnly ? items.filter((item) => item.has_stale_insights) : items,
    };
  }

  async getConjoint(user: PortalJwtPayload): Promise<{ summary: PortalCjSummary | null }> {
    const row = await this.repo.getLatestCjSummaryForClient(user.client_id);
    if (!row) return { summary: null };
    return {
      summary: {
        n: row.n,
        n_choices: row.n_choices,
        attributes: row.attributes,
        recommendation: row.recommendation,
        limitation_note: row.limitation_note,
        statistical_inference: false,
      },
    };
  }

  async getReport(user: PortalJwtPayload, versionId: number): Promise<PortalResearchReportDetail> {
    const { row, now } = await this.loadReadableVersion(user, versionId);
    const snapshot = row.content_snapshot;
    const ids = collectReportInsightIds(snapshot);
    const validToById = await this.repo.listPublishedInsightValidTo(user.client_id, ids);
    const findings = (Array.isArray(snapshot.findings) ? snapshot.findings : []).map((item) =>
      annotatePortalReportRow(item, validToById),
    );
    const recs = (Array.isArray(snapshot.recs) ? snapshot.recs : []).map((item) =>
      annotatePortalReportRow(item, validToById),
    );
    return {
      ...toCard(row, watermarkFor(user, now)),
      exec: portalExec(snapshot),
      findings,
      recs,
      methodology: snapshot.methodology ?? null,
      evidence_index: Array.isArray(snapshot.evidence_index) ? snapshot.evidence_index : [],
    };
  }

  async exportReportPdf(user: PortalJwtPayload, versionId: number): Promise<StreamableFile> {
    const { row, now } = await this.loadReadableVersion(user, versionId);
    const raw = row.content_snapshot as ResearchReportSnapshot;
    const snapshot: ResearchReportSnapshot = {
      ...raw,
      exec: normalizeReportExec(raw.exec),
    };
    const watermark = buildPortalWatermark({ clientId: user.client_id, email: user.email, at: now });
    const ids = collectReportInsightIds(snapshot);
    const validToById = await this.repo.listPublishedInsightValidTo(user.client_id, ids);
    const footer = reportSnapshotHasStaleInsights(snapshot, validToById)
      ? REPORT_PDF_STALE_FOOTER_PORTAL
      : undefined;
    const buffer = buildResearchReportPdf(sectionsFromReportSnapshot(snapshot), watermark, footer);
    return new StreamableFile(buffer, {
      type: 'application/pdf',
      disposition: `attachment; filename="research-v${row.version}.pdf"`,
    });
  }

  private openaiEmbedLive(): boolean {
    const key = (process.env.OPENAI_API_KEY ?? process.env.OPENAI_KEY ?? '').trim();
    return Boolean(this.config.researchRagOpenaiEmbedEnabled && key);
  }

  private async resolveQueryVec(
    q: string,
  ): Promise<
    { ok: true; queryVec?: number[] } | { ok: false; note: 'rag_skipped_pii' | 'rag_embed_failed' }
  > {
    if (!this.openaiEmbedLive()) {
      return { ok: true };
    }
    if (shouldSkipRagEmbed(q)) {
      return { ok: false, note: 'rag_skipped_pii' };
    }
    try {
      const key = (process.env.OPENAI_API_KEY ?? process.env.OPENAI_KEY ?? '').trim();
      const resolved = await fetchOpenAIEmbedding({ text: q, apiKey: key });
      return { ok: true, queryVec: resolved.embedding };
    } catch {
      return { ok: false, note: 'rag_embed_failed' };
    }
  }

  private async loadReadableVersion(
    user: PortalJwtPayload,
    versionId: number,
  ): Promise<{ row: PortalResearchVersionRecord; now: Date }> {
    const row = await this.repo.getPortalReportVersion(versionId);
    if (!row) {
      throw new NotFoundException({ error: 'not_found' });
    }
    if (row.client_id !== user.client_id) {
      throw new ForbiddenException({ error: 'forbidden' });
    }
    const now = new Date();
    try {
      assertPortalReportReadable({
        portalVisible: row.portal_visible,
        embargoUntil: row.embargo_until,
        expiresAt: row.expires_at,
        now,
      });
    } catch (err) {
      mapReadableError(err);
    }
    return { row, now };
  }
}
