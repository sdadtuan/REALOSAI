import {
  buildRagSearchQuery,
  chunkDocumentText,
  extractDocumentText,
  normalizeMime,
} from './marketing-ai-rag.util';

describe('marketing-ai-rag.util', () => {
  it('normalizeMime maps extensions', () => {
    expect(normalizeMime('', 'Brand-Guidelines.pdf')).toBe('application/pdf');
    expect(normalizeMime('', 'notes.txt')).toBe('text/plain');
  });

  it('chunkDocumentText splits long text', () => {
    const text = 'Đoạn brand guideline. '.repeat(120);
    const chunks = chunkDocumentText(text, { chunkSize: 200, overlap: 20, title: 'Brand' });
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].page_no).toBe(1);
    expect(chunks[0].body.length).toBeGreaterThan(40);
  });

  it('extractDocumentText reads plain text', () => {
    const buf = Buffer.from('Thương hiệu PTT Ads — USP rõ ràng.', 'utf8');
    expect(extractDocumentText(buf, 'text/plain')).toContain('PTT Ads');
  });

  it('buildRagSearchQuery joins brief fields', () => {
    const q = buildRagSearchQuery({
      brand_name: 'Acme',
      industry: 'SaaS',
      challenges: 'CPL cao',
    });
    expect(q).toContain('Acme');
    expect(q).toContain('CPL cao');
  });
});
