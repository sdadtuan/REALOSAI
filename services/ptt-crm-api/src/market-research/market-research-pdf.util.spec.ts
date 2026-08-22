import { buildResearchReportPdf } from './market-research-pdf.util';

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

describe('buildResearchReportPdf', () => {
  it('returns a %PDF- buffer for a cover section', () => {
    const buffer = buildResearchReportPdf([{ title: 'Cover', lines: ['Client: Acme'] }]);
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('embeds the optional watermark in UTF-16BE hex', () => {
    const watermark = 'CONFIDENTIAL · acme · a@b.c · 2026-08-14';
    const buffer = buildResearchReportPdf([{ title: 'Cover', lines: ['Client: Acme'] }], watermark);
    expect(decodePdfUtf16Be(buffer)).toContain(watermark);
  });

  it('returns %PDF- for empty sections without throwing', () => {
    const buffer = buildResearchReportPdf([]);
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('P29 embeds footerLine on each page when set', () => {
    const footer = 'Cảnh báo: báo cáo có insight hết hạn (valid_to).';
    const sections = [
      { title: 'A', lines: Array.from({ length: 50 }, (_, i) => `line ${i}`) },
      { title: 'B', lines: ['tail'] },
    ];
    const buffer = buildResearchReportPdf(sections, undefined, footer);
    const decoded = decodePdfUtf16Be(buffer);
    const count = decoded.split(footer).length - 1;
    expect(count).toBeGreaterThanOrEqual(2);
  });

  it('P29 no footer when footerLine omitted', () => {
    const buffer = buildResearchReportPdf([{ title: 'Cover', lines: ['x'] }]);
    expect(decodePdfUtf16Be(buffer)).not.toContain('Cảnh báo:');
  });
});
