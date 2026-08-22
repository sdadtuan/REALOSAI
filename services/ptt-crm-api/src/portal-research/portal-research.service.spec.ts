import { ForbiddenException, NotFoundException, StreamableFile, BadRequestException } from '@nestjs/common';
import * as pdfUtil from '../market-research/market-research-pdf.util';
import { REPORT_PDF_STALE_FOOTER_PORTAL } from '../market-research/report-pdf-stale.util';
import { embedInsightText } from '../market-research/research-rag.util';
import { fetchOpenAIEmbedding } from '../market-research/openai-embed.util';
import { PortalResearchRepository } from './portal-research.repository';
import { PortalResearchService } from './portal-research.service';

jest.mock('../market-research/openai-embed.util', () => ({
  fetchOpenAIEmbedding: jest.fn(),
}));

function decodePdfUtf16Be(buffer: Buffer): string {
  const raw = buffer.toString('latin1');
  const chunks: string[] = [];
  const re = /<([0-9a-fA-F]+)>/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(raw))) {
    const hex = match[1];
    let text = '';
    for (let i = 0; i + 3 < hex.length; i += 4) {
      const code = parseInt(hex.slice(i, i + 4), 16);
      if (code === 0xfeff) continue;
      text += String.fromCharCode(code);
    }
    chunks.push(text);
  }
  return chunks.join('\n');
}

async function streamableBuffer(file: StreamableFile): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of file.getStream()) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

const ACME = '550e8400-e29b-41d4-a716-446655440000';
const BETA = '660e8400-e29b-41d4-a716-446655440001';

const acmeUser = {
  sub: '2',
  email: 'acme@test.local',
  client_id: ACME,
  role: 'viewer' as const,
  iat: 1,
  exp: 9999999999,
};

const betaUser = {
  ...acmeUser,
  sub: '3',
  email: 'beta@test.local',
  client_id: BETA,
};

function acmeVersion(overrides: Record<string, unknown> = {}) {
  return {
    id: 42,
    report_id: 7,
    version: 1,
    content_snapshot: {
      cover: {
        client: 'Acme',
        title: 'Secret Acme title',
        confidential: true,
        version: 1,
        as_of: '2026-08-14',
      },
      exec: { vi: 'Tóm tắt', en: 'Summary', en_status: 'approved' },
      findings: [],
      recs: [],
      methodology: { stub: true, population: '', source_plan: '', limitation: '' },
      evidence_index: [],
    },
    generated_by: 'am@ptt',
    content_hash: 'abc',
    embargo_until: null,
    expires_at: null,
    portal_visible: true,
    created_at: '2026-08-14T00:00:00Z',
    client_id: ACME,
    ...overrides,
  };
}

describe('PortalResearchService', () => {
  const repo = {
    getPortalReportVersion: jest.fn(),
    listPortalVisibleVersions: jest.fn(),
    listPublishedEmbeddings: jest.fn(),
    listPublishedEmbeddingsByVec: jest.fn(),
    getThemeQuarterAnalytics: jest.fn(),
    listPublishedInsightValidTo: jest.fn().mockResolvedValue(new Map()),
    probePgvectorReady: jest.fn().mockResolvedValue(false),
    getLatestCjSummaryForClient: jest.fn(),
  } as unknown as jest.Mocked<PortalResearchRepository>;

  const config = {
    researchRagEnabled: false,
    researchRagOpenaiEmbedEnabled: false,
    researchRagPgvectorEnabled: false,
  };

  function makeService(): PortalResearchService {
    return new PortalResearchService(repo, config as never);
  }

  beforeEach(() => {
    jest.clearAllMocks();
    config.researchRagEnabled = false;
    config.researchRagOpenaiEmbedEnabled = false;
    config.researchRagPgvectorEnabled = false;
    (fetchOpenAIEmbedding as jest.Mock).mockReset();
    repo.listPublishedInsightValidTo.mockResolvedValue(new Map());
  });

  it('M2-1a: cross-tenant GET → 403, JSON.stringify(body) has no title', async () => {
    repo.getPortalReportVersion.mockResolvedValue(acmeVersion());
    const service = makeService();

    try {
      await service.getReport(betaUser, 42);
      throw new Error('expected forbidden');
    } catch (err) {
      expect(err).toBeInstanceOf(ForbiddenException);
      const body = (err as ForbiddenException).getResponse();
      expect(body).toEqual({ error: 'forbidden' });
      expect(JSON.stringify(body)).not.toContain('title');
    }
  });

  it('M2-1b: unpublished same-tenant → 404 not_found', async () => {
    repo.getPortalReportVersion.mockResolvedValue(acmeVersion({ portal_visible: false }));
    const service = makeService();

    try {
      await service.getReport(acmeUser, 42);
      throw new Error('expected not_found');
    } catch (err) {
      expect(err).toBeInstanceOf(NotFoundException);
      expect((err as NotFoundException).getResponse()).toEqual({ error: 'not_found' });
    }
  });

  it('M2-1c: expired → 403 report_expired', async () => {
    repo.getPortalReportVersion.mockResolvedValue(
      acmeVersion({ expires_at: '2020-01-01T00:00:00Z' }),
    );
    const service = makeService();

    try {
      await service.getReport(acmeUser, 42);
      throw new Error('expected report_expired');
    } catch (err) {
      expect(err).toBeInstanceOf(ForbiddenException);
      expect((err as ForbiddenException).getResponse()).toEqual({ error: 'report_expired' });
    }
  });

  it('listReports skips embargo/expired/unpublished; remaining card has watermark and no title', async () => {
    repo.listPortalVisibleVersions.mockResolvedValue([
      acmeVersion({
        id: 10,
        embargo_until: '2099-01-01T00:00:00Z',
      }),
      acmeVersion({
        id: 11,
        expires_at: '2020-01-01T00:00:00Z',
      }),
      acmeVersion({
        id: 12,
        portal_visible: false,
      }),
      acmeVersion({ id: 42 }),
    ]);
    const service = makeService();

    const { items } = await service.listReports(acmeUser);

    expect(items).toHaveLength(1);
    const card = items[0];
    expect(card.version_id).toBe(42);
    expect(card.watermark).toMatch(/^CONFIDENTIAL · /);
    expect(card.watermark).toContain(ACME);
    expect(card.watermark).toContain(acmeUser.email);
    expect(JSON.stringify(card)).not.toContain('title');
    expect(card.has_stale_insights).toBe(false);
  });

  it('P41 listReports sets has_stale_insights true when snapshot has stale insight', async () => {
    repo.listPortalVisibleVersions.mockResolvedValue([
      acmeVersion({
        id: 40,
        content_snapshot: {
          exec: { vi: 'Fresh', en: null, en_status: 'approved' },
          findings: [{ insight_id: 20, statement: 'Still good' }],
          recs: [],
          methodology: {},
          evidence_index: [],
        },
      }),
      acmeVersion({
        id: 41,
        content_snapshot: {
          cover: { title: 'Secret stale title', version: 2, as_of: '2026-08-14' },
          exec: { vi: 'Stale', en: null, en_status: 'approved' },
          findings: [{ insight_id: 11, statement: 'Old claim' }],
          recs: [],
          methodology: {},
          evidence_index: [],
        },
      }),
    ]);
    repo.listPublishedInsightValidTo.mockResolvedValue(
      new Map([
        [11, '2020-01-01'],
        [20, new Date().toISOString().slice(0, 10)],
      ]),
    );
    const { items } = await makeService().listReports(acmeUser);
    expect(items).toHaveLength(2);
    const fresh = items.find((item) => item.version_id === 40);
    const stale = items.find((item) => item.version_id === 41);
    expect(fresh?.has_stale_insights).toBe(false);
    expect(stale?.has_stale_insights).toBe(true);
    expect(repo.listPublishedInsightValidTo).toHaveBeenCalledTimes(1);
    expect(repo.listPublishedInsightValidTo).toHaveBeenCalledWith(ACME, expect.arrayContaining([11, 20]));
    expect(JSON.stringify(items)).not.toContain('title');
    expect(JSON.stringify(items)).not.toContain('Secret stale title');
  });

  it('P41 listReports has_stale_insights false when valid_to missing from map', async () => {
    repo.listPortalVisibleVersions.mockResolvedValue([
      acmeVersion({
        content_snapshot: {
          exec: { vi: 'x', en: null, en_status: 'approved' },
          findings: [{ insight_id: 99, statement: 'foreign' }],
          recs: [],
          methodology: {},
          evidence_index: [],
        },
      }),
    ]);
    repo.listPublishedInsightValidTo.mockResolvedValue(new Map());
    const { items } = await makeService().listReports(acmeUser);
    expect(items).toHaveLength(1);
    expect(items[0].has_stale_insights).toBe(false);
  });

  it('P47 listReports stale_only returns only stale cards', async () => {
    repo.listPortalVisibleVersions.mockResolvedValue([
      acmeVersion({
        id: 40,
        content_snapshot: {
          exec: { vi: 'Fresh', en: null, en_status: 'approved' },
          findings: [{ insight_id: 20, statement: 'Still good' }],
          recs: [],
          methodology: {},
          evidence_index: [],
        },
      }),
      acmeVersion({
        id: 41,
        content_snapshot: {
          exec: { vi: 'Stale', en: null, en_status: 'approved' },
          findings: [{ insight_id: 11, statement: 'Old claim' }],
          recs: [],
          methodology: {},
          evidence_index: [],
        },
      }),
    ]);
    repo.listPublishedInsightValidTo.mockResolvedValue(
      new Map([
        [11, '2020-01-01'],
        [20, new Date().toISOString().slice(0, 10)],
      ]),
    );
    const { items } = await makeService().listReports(acmeUser, { stale_only: '1' });
    expect(items).toHaveLength(1);
    expect(items[0].version_id).toBe(41);
    expect(items[0].has_stale_insights).toBe(true);
  });

  it('P47 listReports without stale_only returns all cards', async () => {
    repo.listPortalVisibleVersions.mockResolvedValue([
      acmeVersion({
        id: 40,
        content_snapshot: {
          exec: { vi: 'Fresh', en: null, en_status: 'approved' },
          findings: [{ insight_id: 20, statement: 'Still good' }],
          recs: [],
          methodology: {},
          evidence_index: [],
        },
      }),
      acmeVersion({
        id: 41,
        content_snapshot: {
          exec: { vi: 'Stale', en: null, en_status: 'approved' },
          findings: [{ insight_id: 11, statement: 'Old claim' }],
          recs: [],
          methodology: {},
          evidence_index: [],
        },
      }),
    ]);
    repo.listPublishedInsightValidTo.mockResolvedValue(
      new Map([
        [11, '2020-01-01'],
        [20, new Date().toISOString().slice(0, 10)],
      ]),
    );
    const { items } = await makeService().listReports(acmeUser, {});
    expect(items).toHaveLength(2);
  });

  it('P47 listReports stale_only empty when none stale', async () => {
    repo.listPortalVisibleVersions.mockResolvedValue([
      acmeVersion({
        id: 40,
        content_snapshot: {
          exec: { vi: 'Fresh', en: null, en_status: 'approved' },
          findings: [{ insight_id: 20, statement: 'Still good' }],
          recs: [],
          methodology: {},
          evidence_index: [],
        },
      }),
    ]);
    repo.listPublishedInsightValidTo.mockResolvedValue(
      new Map([[20, new Date().toISOString().slice(0, 10)]]),
    );
    const { items } = await makeService().listReports(acmeUser, { stale_only: '1' });
    expect(items).toEqual([]);
  });

  it('getReport happy path: watermark, exec.en null when not approved, no project/title', async () => {
    repo.getPortalReportVersion.mockResolvedValue(
      acmeVersion({
        content_snapshot: {
          cover: {
            client: 'Acme',
            title: 'Secret Acme title',
            confidential: true,
            version: 1,
            as_of: '2026-08-14',
          },
          exec: { vi: 'Tóm tắt', en: 'Summary', en_status: 'draft' },
          findings: [],
          recs: [],
          methodology: { stub: true, population: '', source_plan: '', limitation: '' },
          evidence_index: [],
        },
      }),
    );
    const service = makeService();

    const body = await service.getReport(acmeUser, 42);

    expect(body.watermark).toMatch(/^CONFIDENTIAL · /);
    expect(body.watermark).toContain(ACME);
    expect(body.watermark).toContain(acmeUser.email);
    expect(body.exec).toEqual({ vi: 'Tóm tắt', en: null });
    expect(body).not.toHaveProperty('project');
    expect(body).not.toHaveProperty('title');
  });

  it('P24 getReport annotates stale finding from published valid_to', async () => {
    repo.getPortalReportVersion.mockResolvedValue(
      acmeVersion({
        content_snapshot: {
          exec: { vi: 'Tóm tắt', en: null, en_status: 'approved' },
          findings: [{ insight_id: 11, statement: 'Old claim' }],
          recs: [{ insight_id: 11, recommendation: 'Act' }],
          methodology: { stub: true },
          evidence_index: [],
          insight_ids: [11],
        },
      }),
    );
    repo.listPublishedInsightValidTo.mockResolvedValue(new Map([[11, '2020-01-01']]));
    const body = await makeService().getReport(acmeUser, 42);
    expect(body.findings[0]).toMatchObject({ insight_id: 11, is_stale: true, valid_to: '2020-01-01' });
    expect(body.recs[0]).toMatchObject({ insight_id: 11, is_stale: true });
  });

  it('P24 getReport valid_to today or null is not stale', async () => {
    const today = new Date().toISOString().slice(0, 10);
    repo.getPortalReportVersion.mockResolvedValue(
      acmeVersion({
        content_snapshot: {
          exec: { vi: 'x', en: null, en_status: 'approved' },
          findings: [
            { insight_id: 1, statement: 'today' },
            { insight_id: 2, statement: 'null' },
          ],
          recs: [],
          methodology: {},
          evidence_index: [],
        },
      }),
    );
    repo.listPublishedInsightValidTo.mockResolvedValue(
      new Map([
        [1, today],
        [2, null],
      ]),
    );
    const body = await makeService().getReport(acmeUser, 42);
    expect(body.findings[0]).toMatchObject({ is_stale: false, valid_to: today });
    expect(body.findings[1]).toMatchObject({ is_stale: false, valid_to: null });
  });

  it('P24 getReport does not leak other-tenant valid_to', async () => {
    repo.getPortalReportVersion.mockResolvedValue(
      acmeVersion({
        content_snapshot: {
          exec: { vi: 'x', en: null, en_status: 'approved' },
          findings: [{ insight_id: 99, statement: 'foreign' }],
          recs: [],
          methodology: {},
          evidence_index: [],
        },
      }),
    );
    repo.listPublishedInsightValidTo.mockResolvedValue(new Map()); // repo already filtered
    const body = await makeService().getReport(acmeUser, 42);
    expect(body.findings[0]).toMatchObject({ insight_id: 99, is_stale: false, valid_to: null });
    expect(JSON.stringify(body)).not.toMatch(/2020-01-01/);
  });

  it('P32 getReport keeps published_valid_to and live is_stale', async () => {
    repo.getPortalReportVersion.mockResolvedValue(
      acmeVersion({
        content_snapshot: {
          exec: { vi: 'Tóm tắt', en: null, en_status: 'approved' },
          findings: [{ insight_id: 11, statement: 'Old claim', published_valid_to: '2026-12-31' }],
          recs: [],
          methodology: { stub: true },
          evidence_index: [],
          insight_ids: [11],
        },
      }),
    );
    repo.listPublishedInsightValidTo.mockResolvedValue(new Map([[11, '2020-01-01']]));
    const body = await makeService().getReport(acmeUser, 42);
    expect(body.findings[0]).toMatchObject({
      published_valid_to: '2026-12-31',
      valid_to: '2020-01-01',
      is_stale: true,
    });
  });

  it('M2-1a: published + in-window PDF → %PDF- buffer and watermark', async () => {
    repo.getPortalReportVersion.mockResolvedValue(acmeVersion());
    const service = makeService();

    const out = await service.exportReportPdf(acmeUser, 42);
    expect(out).toBeInstanceOf(StreamableFile);
    const headers = out.getHeaders();
    expect(headers.type).toBe('application/pdf');
    expect(headers.disposition).toBe('attachment; filename="research-v1.pdf"');

    const buffer = await streamableBuffer(out);
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
    const decoded = decodePdfUtf16Be(buffer);
    expect(decoded).toContain('CONFIDENTIAL · ');
    expect(decoded).toContain(ACME);
    expect(decoded).toContain(acmeUser.email);
    expect(decoded).toMatch(/CONFIDENTIAL · .+ · .+ · \d{4}-\d{2}-\d{2}/);
  });

  it('P29 exportReportPdf embeds portal stale footer when finding stale', async () => {
    repo.getPortalReportVersion.mockResolvedValue(
      acmeVersion({
        content_snapshot: {
          cover: {
            client: 'Acme',
            title: 'Secret Acme title',
            confidential: true,
            version: 1,
            as_of: '2026-08-14',
          },
          exec: { vi: 'Tóm tắt', en: 'Summary', en_status: 'approved' },
          findings: [{ insight_id: 11, text: 'finding' }],
          recs: [],
          methodology: { stub: true, population: '', source_plan: '', limitation: '' },
          evidence_index: [],
        },
      }),
    );
    repo.listPublishedInsightValidTo.mockResolvedValue(new Map([[11, '2020-01-01']]));
    const spy = jest.spyOn(pdfUtil, 'buildResearchReportPdf');
    const service = makeService();

    await service.exportReportPdf(acmeUser, 42);

    expect(repo.listPublishedInsightValidTo).toHaveBeenCalledWith(ACME, [11]);
    expect(spy).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining('CONFIDENTIAL'),
      REPORT_PDF_STALE_FOOTER_PORTAL,
    );
    spy.mockRestore();
  });

  it('M2-1b: unpublished same-tenant PDF → 404 not_found (no file)', async () => {
    const spy = jest.spyOn(pdfUtil, 'buildResearchReportPdf');
    repo.getPortalReportVersion.mockResolvedValue(acmeVersion({ portal_visible: false }));
    const service = makeService();

    try {
      await service.exportReportPdf(acmeUser, 42);
      throw new Error('expected not_found');
    } catch (err) {
      expect(err).toBeInstanceOf(NotFoundException);
      expect((err as NotFoundException).getResponse()).toEqual({ error: 'not_found' });
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it('M2-1c: other client PDF → 403 forbidden; JSON.stringify(body) has no title', async () => {
    const spy = jest.spyOn(pdfUtil, 'buildResearchReportPdf');
    repo.getPortalReportVersion.mockResolvedValue(acmeVersion());
    const service = makeService();

    try {
      await service.exportReportPdf(betaUser, 42);
      throw new Error('expected forbidden');
    } catch (err) {
      expect(err).toBeInstanceOf(ForbiddenException);
      const body = (err as ForbiddenException).getResponse();
      expect(body).toEqual({ error: 'forbidden' });
      expect(JSON.stringify(body)).not.toContain('title');
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it('M2-1d: expired PDF → 403 report_expired (no file)', async () => {
    const spy = jest.spyOn(pdfUtil, 'buildResearchReportPdf');
    repo.getPortalReportVersion.mockResolvedValue(
      acmeVersion({ expires_at: '2020-01-01T00:00:00Z' }),
    );
    const service = makeService();

    try {
      await service.exportReportPdf(acmeUser, 42);
      throw new Error('expected report_expired');
    } catch (err) {
      expect(err).toBeInstanceOf(ForbiddenException);
      expect((err as ForbiddenException).getResponse()).toEqual({ error: 'report_expired' });
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  describe('P12 portal RAG search', () => {
    it('flag off returns rag_disabled and does not list embeddings', async () => {
      const service = makeService();
      const out = await service.searchInsights(acmeUser, { q: 'giá sữa' });
      expect(out).toEqual({ hits: [], note: 'rag_disabled' });
      expect(repo.listPublishedEmbeddings).not.toHaveBeenCalled();
    });

    it('G4: published hits; approved_client_facing and draft do not', async () => {
      config.researchRagEnabled = true;
      const statement = 'Giá sữa học đường tăng tại Hà Nội';
      const vec = embedInsightText(statement);
      repo.listPublishedEmbeddings.mockResolvedValue([
        {
          insight_id: 20,
          project_id: 9,
          status: 'published',
          statement,
          observation: null,
          embedding: vec,
          theme_codes: [],
          client_id: ACME,
        },
      ]);
      const service = makeService();
      const out = await service.searchInsights(acmeUser, { q: statement });
      expect(out.hits.map((h) => h.insight_id)).toEqual([20]);
    });

    it('P19 searchInsights returns is_stale on hits', async () => {
      config.researchRagEnabled = true;
      const statement = 'Giá sữa học đường tăng tại Hà Nội';
      const vec = embedInsightText(statement);
      repo.listPublishedEmbeddings.mockResolvedValue([
        {
          insight_id: 20,
          project_id: 9,
          status: 'published',
          statement,
          observation: null,
          embedding: vec,
          theme_codes: [],
          client_id: ACME,
          valid_to: '2020-06-01',
        },
      ]);
      const service = makeService();
      const out = await service.searchInsights(acmeUser, { q: statement });
      expect(out.hits).toEqual([]);
    });

    it('P27 searchInsights default excludes stale published hits', async () => {
      config.researchRagEnabled = true;
      const statement = 'Giá sữa học đường tăng tại Hà Nội';
      const vec = embedInsightText(statement);
      repo.listPublishedEmbeddings.mockResolvedValue([
        {
          insight_id: 20,
          project_id: 9,
          status: 'published',
          statement,
          observation: null,
          embedding: vec,
          theme_codes: [],
          client_id: ACME,
          valid_to: '2020-06-01',
        },
        {
          insight_id: 21,
          project_id: 9,
          status: 'published',
          statement: 'Giá ổn định',
          observation: null,
          embedding: vec,
          theme_codes: [],
          client_id: ACME,
          valid_to: null,
        },
      ]);
      const service = makeService();
      const out = await service.searchInsights(acmeUser, { q: statement });
      expect(out.hits.map((h) => h.insight_id)).toEqual([21]);
      expect(out.hits.every((h) => !h.is_stale)).toBe(true);
    });

    it('P25 searchInsights stale_only returns only stale published hits', async () => {
      config.researchRagEnabled = true;
      const statement = 'Giá sữa học đường tăng tại Hà Nội';
      const vec = embedInsightText(statement);
      repo.listPublishedEmbeddings.mockResolvedValue([
        {
          insight_id: 20,
          project_id: 9,
          status: 'published',
          statement,
          observation: null,
          embedding: vec,
          theme_codes: [],
          client_id: ACME,
          valid_to: '2020-06-01',
        },
        {
          insight_id: 21,
          project_id: 9,
          status: 'published',
          statement: 'Giá ổn định',
          observation: null,
          embedding: vec,
          theme_codes: [],
          client_id: ACME,
          valid_to: null,
        },
      ]);
      const service = makeService();
      const out = await service.searchInsights(acmeUser, { q: statement, stale_only: '1' });
      expect(out.hits.map((h) => h.insight_id)).toEqual([20]);
      expect(out.hits.every((h) => h.is_stale)).toBe(true);
    });

    it('P20 searchInsights uses listPublishedEmbeddingsByVec when pgvector flag on', async () => {
      config.researchRagEnabled = true;
      config.researchRagPgvectorEnabled = true;
      repo.probePgvectorReady.mockResolvedValue(true);
      const statement = 'Giá sữa học đường tăng tại Hà Nội';
      const vec = embedInsightText(statement);
      repo.listPublishedEmbeddingsByVec.mockResolvedValue([
        {
          insight_id: 20,
          project_id: 9,
          status: 'published',
          statement,
          observation: null,
          embedding: vec,
          theme_codes: [],
          client_id: ACME,
          valid_to: null,
        },
      ]);
      const service = makeService();
      await service.onModuleInit();
      const out = await service.searchInsights(acmeUser, { q: statement });
      expect(repo.listPublishedEmbeddingsByVec).toHaveBeenCalled();
      expect(repo.listPublishedEmbeddings).not.toHaveBeenCalled();
      expect(out.hits[0].insight_id).toBe(20);
    });

    it('P28 searchInsights falls back to listPublishedEmbeddings when flag on but not ready', async () => {
      config.researchRagEnabled = true;
      config.researchRagPgvectorEnabled = true;
      const statement = 'Giá sữa học đường tăng tại Hà Nội';
      const vec = embedInsightText(statement);
      repo.listPublishedEmbeddings.mockResolvedValue([
        {
          insight_id: 21,
          project_id: 9,
          status: 'published',
          statement,
          observation: null,
          embedding: vec,
          theme_codes: [],
          client_id: ACME,
          valid_to: null,
        },
      ]);
      const service = makeService();
      const out = await service.searchInsights(acmeUser, { q: statement });
      expect(repo.listPublishedEmbeddings).toHaveBeenCalled();
      expect(repo.listPublishedEmbeddingsByVec).not.toHaveBeenCalled();
      expect(out.hits[0].insight_id).toBe(21);
    });

    it('cross-tenant: query uses jwt client only; no statement from other tenant', async () => {
      config.researchRagEnabled = true;
      repo.listPublishedEmbeddings.mockResolvedValue([
        {
          insight_id: 99,
          project_id: 1,
          status: 'published',
          statement: 'Secret other tenant',
          observation: null,
          embedding: embedInsightText('Secret other tenant'),
          theme_codes: [],
          client_id: BETA,
        },
      ]);
      const service = makeService();
      const out = await service.searchInsights(acmeUser, { q: 'giá', client_id: BETA });
      expect(repo.listPublishedEmbeddings).toHaveBeenCalledWith(ACME, undefined);
      expect(out.hits).toEqual([]);
      expect(JSON.stringify(out)).not.toContain('Secret other tenant');
    });

    it('health rag_enabled false by default; no OPENAI_API_KEY leak', () => {
      const service = makeService();
      const payload = service.health();
      expect(payload.rag_enabled).toBe(false);
      expect(payload.rag_openai_embed_enabled).toBe(false);
      expect(payload.rag_embed_model).toBe('local');
      expect(payload.rag_pgvector_enabled).toBe(false);
      expect(payload.rag_pgvector_ready).toBe(false);
      expect(JSON.stringify(payload)).not.toMatch(/OPENAI_API_KEY|sk-/);
    });

    it('P26 health rag_pgvector_ready true after probe on module init', async () => {
      repo.probePgvectorReady.mockResolvedValue(true);
      const service = makeService();
      await service.onModuleInit();
      expect(service.health().rag_pgvector_ready).toBe(true);
      expect(service.health().rag_pgvector_enabled).toBe(false);
    });

    it('PII query + embed live: rag_skipped_pii; fetchOpenAIEmbedding not called', async () => {
      config.researchRagEnabled = true;
      config.researchRagOpenaiEmbedEnabled = true;
      process.env.OPENAI_API_KEY = 'sk-test';
      const service = makeService();
      const out = await service.searchInsights(acmeUser, { q: 'liên hệ a@b.co giá sữa' });
      expect(out).toEqual({ hits: [], note: 'rag_skipped_pii' });
      expect(fetchOpenAIEmbedding).not.toHaveBeenCalled();
      expect(repo.listPublishedEmbeddings).not.toHaveBeenCalled();
      delete process.env.OPENAI_API_KEY;
    });

    it('embed live + transport fail: rag_embed_failed', async () => {
      config.researchRagEnabled = true;
      config.researchRagOpenaiEmbedEnabled = true;
      process.env.OPENAI_API_KEY = 'sk-test';
      (fetchOpenAIEmbedding as jest.Mock).mockRejectedValue(
        Object.assign(new Error('openai_embed_failed'), { code: 'openai_embed_failed' }),
      );
      const service = makeService();
      const out = await service.searchInsights(acmeUser, { q: 'giá sữa học đường' });
      expect(out).toEqual({ hits: [], note: 'rag_embed_failed' });
      expect(repo.listPublishedEmbeddings).not.toHaveBeenCalled();
      delete process.env.OPENAI_API_KEY;
    });
  });

  describe('P15 portal theme quarter analytics', () => {
    it('returns published corpus rows for jwt client_id only', async () => {
      repo.getThemeQuarterAnalytics
        .mockResolvedValueOnce([
          { quarter: 2, theme_code: 'PRICE', label_vi: 'Giá', insight_count: 2 },
        ])
        .mockResolvedValueOnce([]);
      const service = makeService();
      const out = await service.getThemeQuarterAnalytics(acmeUser, 2026);
      expect(out.ok).toBe(true);
      expect(out.year).toBe(2026);
      expect(out.client_id).toBe(ACME);
      expect(out.corpus_statuses).toEqual(['published']);
      expect(out.rows[0]).toMatchObject({
        quarter: 2,
        theme_code: 'PRICE',
        label_vi: 'Giá',
        insight_count: 2,
        prev_qoq_count: 0,
        prev_yoy_count: null,
        delta_qoq_pct: null,
        delta_yoy_pct: null,
      });
      expect(JSON.stringify(out)).not.toContain('title');
      expect(repo.getThemeQuarterAnalytics).toHaveBeenCalledWith(ACME, 2026);
    });

    it('invalid year is 400 invalid_year', async () => {
      const service = makeService();
      await expect(service.getThemeQuarterAnalytics(acmeUser, 1999)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(repo.getThemeQuarterAnalytics).not.toHaveBeenCalled();
    });
  });

  describe('P17 portal theme quarter deltas', () => {
    it('P17 getThemeQuarterAnalytics enriches QoQ and YoY deltas', async () => {
      repo.getThemeQuarterAnalytics
        .mockResolvedValueOnce([
          { quarter: 1, theme_code: 'PRICE', label_vi: 'Giá', insight_count: 2 },
          { quarter: 2, theme_code: 'PRICE', label_vi: 'Giá', insight_count: 4 },
        ])
        .mockResolvedValueOnce([
          { quarter: 2, theme_code: 'PRICE', label_vi: 'Giá', insight_count: 2 },
        ]);
      const service = makeService();
      const out = await service.getThemeQuarterAnalytics(acmeUser, 2026);
      expect(out.corpus_statuses).toEqual(['published']);
      expect(out.rows[1]).toMatchObject({
        quarter: 2,
        insight_count: 4,
        prev_qoq_count: 2,
        delta_qoq_pct: 100,
        prev_yoy_count: 2,
        delta_yoy_pct: 100,
      });
      expect(out.rows[0]).toMatchObject({
        quarter: 1,
        prev_qoq_count: null,
        delta_qoq_pct: null,
      });
      expect(JSON.stringify(out)).not.toContain('title');
      expect(repo.getThemeQuarterAnalytics).toHaveBeenCalledWith(ACME, 2026);
      expect(repo.getThemeQuarterAnalytics).toHaveBeenCalledWith(ACME, 2025);
    });
  });

  describe('P35 portal conjoint lite', () => {
    const cjRow = {
      n: 8,
      n_choices: 8,
      attributes: [
        { name: 'price', levels: [{ label: '99k', count: 2, share_pct: 25 }], top_level: '99k' },
      ],
      recommendation: { levels: [{ attribute: 'price', level: '99k', share_pct: 25 }] },
      limitation_note: 'Conjoint lite trên mẫu convenience',
      statistical_inference: false as const,
    };

    it('P35 getConjoint returns mapped summary without created_by or title', async () => {
      repo.getLatestCjSummaryForClient.mockResolvedValue(cjRow);
      const service = makeService();
      const out = await service.getConjoint(acmeUser);
      expect(out.summary).toMatchObject({ n: 8, n_choices: 8, statistical_inference: false });
      expect(JSON.stringify(out)).not.toContain('created_by');
      expect(JSON.stringify(out)).not.toContain('title');
      expect(JSON.stringify(out)).not.toMatch(/\bMOE\b|95\s*%\s*confidence/i);
      expect(repo.getLatestCjSummaryForClient).toHaveBeenCalledWith(ACME);
    });

    it('P35 getConjoint returns null summary when no row', async () => {
      repo.getLatestCjSummaryForClient.mockResolvedValue(null);
      const service = makeService();
      const out = await service.getConjoint(acmeUser);
      expect(out).toEqual({ summary: null });
    });

    it('P35 getConjoint binds jwt client_id only', async () => {
      repo.getLatestCjSummaryForClient.mockResolvedValue(null);
      const service = makeService();
      await service.getConjoint(betaUser);
      expect(repo.getLatestCjSummaryForClient).toHaveBeenCalledWith(BETA);
      expect(repo.getLatestCjSummaryForClient).not.toHaveBeenCalledWith(ACME);
    });
  });
});
