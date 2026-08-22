import { BadRequestException } from '@nestjs/common';
import { MarketingAiRagService } from './marketing-ai-rag.service';

describe('MarketingAiRagService', () => {
  const config = { mktAiRagEnabled: true };
  const repo = {
    listDocuments: jest.fn(),
    findDocumentByHash: jest.fn(),
    insertDocument: jest.fn(),
    updateDocument: jest.fn(),
    replaceDocumentChunks: jest.fn(),
    searchDocumentChunks: jest.fn(),
    listTopDocumentChunks: jest.fn(),
  };

  let service: MarketingAiRagService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MarketingAiRagService(config as never, repo as never);
  });

  it('rejects upload when rag disabled', async () => {
    const disabled = new MarketingAiRagService({ mktAiRagEnabled: false } as never, repo as never);
    await expect(
      disabled.uploadDocument(
        1,
        { buffer: Buffer.from('x'), size: 1, originalname: 'a.txt', mimetype: 'text/plain' } as never,
        'u@test.vn',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('indexes plain text upload', async () => {
    repo.findDocumentByHash.mockResolvedValue(null);
    repo.insertDocument.mockResolvedValue({
      id: 10,
      lifecycle_id: 1,
      filename: 'brand.txt',
      mime_type: 'text/plain',
      file_size_bytes: 100,
      status: 'indexing',
      chunk_count: 0,
      error_message: null,
      uploaded_by: 'u@test.vn',
      created_at: '',
      updated_at: '',
    });
    repo.replaceDocumentChunks.mockResolvedValue(undefined);
    repo.updateDocument.mockResolvedValue({
      id: 10,
      lifecycle_id: 1,
      filename: 'brand.txt',
      mime_type: 'text/plain',
      file_size_bytes: 100,
      status: 'indexed',
      chunk_count: 1,
      error_message: null,
      uploaded_by: 'u@test.vn',
      created_at: '',
      updated_at: '',
    });

    const text = 'Brand guideline PTT Ads với USP rõ ràng cho thị trường B2B Việt Nam.';
    const out = await service.uploadDocument(
      1,
      {
        buffer: Buffer.from(text, 'utf8'),
        size: text.length,
        originalname: 'brand.txt',
        mimetype: 'text/plain',
      } as never,
      'u@test.vn',
    );

    expect(out.status).toBe('indexed');
    expect(out.chunk_count).toBeGreaterThan(0);
    expect(repo.replaceDocumentChunks).toHaveBeenCalled();
  });

  it('attachCitations maps chunks to sections', () => {
    const cites = service.attachCitations([
      {
        chunk_id: 1,
        document_id: 10,
        chunk_index: 0,
        page_no: 4,
        filename: 'Brand-Guidelines.pdf',
        title: 'Intro',
        body: 'USP text',
        rank: 1,
      },
    ]);
    expect(cites.insights_evidence?.[0].filename).toBe('Brand-Guidelines.pdf');
    expect(cites.insights_evidence?.[0].page_no).toBe(4);
  });

  it('buildForStrategy returns chunks when enabled', async () => {
    repo.listDocuments.mockResolvedValue([
      { id: 1, status: 'indexed', chunk_count: 3 },
    ]);
    repo.searchDocumentChunks.mockResolvedValue([
      {
        chunk_id: 1,
        document_id: 1,
        chunk_index: 0,
        page_no: 2,
        filename: 'Brand.pdf',
        title: 'T',
        body: 'Evidence from brand book',
        rank: 0.9,
      },
    ]);

    const ctx = await service.buildForStrategy(1, {
      brand_name: 'Acme',
      use_rag: true,
      challenges: 'CPL',
    });

    expect(ctx.enabled).toBe(true);
    expect(ctx.chunks.length).toBe(1);
    expect(ctx.promptBlock).toContain('Brand.pdf');
  });
});
