import { cosineSimilarity, embedPlaybookText } from './playbooks.types';

describe('playbook vector engine', () => {
  it('embedPlaybookText returns normalized vector', () => {
    const v = embedPlaybookText('rescue deal stalled pipeline');
    expect(v.length).toBe(64);
    const norm = Math.sqrt(v.reduce((s, n) => s + n * n, 0));
    expect(norm).toBeCloseTo(1, 5);
  });

  it('similar texts score higher cosine similarity', () => {
    const a = embedPlaybookText('gọi lại khách deal stalled');
    const b = embedPlaybookText('deal stalled gọi lại khách hàng');
    const c = embedPlaybookText('xuất bảng lương payroll');
    expect(cosineSimilarity(a, b)).toBeGreaterThan(cosineSimilarity(a, c));
  });
});
