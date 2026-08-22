import type { MktAiExportSection } from './marketing-ai-export.types';

const PAGE_HEIGHT = 792;
const MARGIN_LEFT = 50;
const LINE_HEIGHT = 14;
const LINES_PER_PAGE = 48;

function pdfHexUtf16Be(text: string): string {
  const codes: number[] = [0xfeff];
  for (const ch of text) {
    codes.push(ch.charCodeAt(0));
  }
  const hex = codes.map((c) => c.toString(16).padStart(4, '0')).join('');
  return `<${hex}>`;
}

function wrapLine(text: string, maxLen: number): string[] {
  const t = String(text ?? '').trim();
  if (!t) return [''];
  if (t.length <= maxLen) return [t];
  const out: string[] = [];
  let rest = t;
  while (rest.length > maxLen) {
    let cut = rest.lastIndexOf(' ', maxLen);
    if (cut < maxLen * 0.5) cut = maxLen;
    out.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) out.push(rest);
  return out;
}

function flattenSections(sections: MktAiExportSection[]): string[] {
  const lines: string[] = [];
  for (const section of sections) {
    lines.push(section.title);
    lines.push('');
    for (const line of section.lines) {
      lines.push(...wrapLine(line, 90));
    }
    lines.push('');
  }
  return lines.length ? lines : [' '];
}

function buildPageStream(pageLines: string[]): string {
  let y = PAGE_HEIGHT - 60;
  const ops: string[] = ['BT', '/F1 11 Tf', `${MARGIN_LEFT} ${y} Td`];
  for (let i = 0; i < pageLines.length; i++) {
    if (i > 0) ops.push(`0 ${-LINE_HEIGHT} Td`);
    ops.push(`${pdfHexUtf16Be(pageLines[i] || ' ')} Tj`);
  }
  ops.push('ET');
  return ops.join('\n');
}

/** Build a minimal multi-page PDF with UTF-16BE text (Vietnamese-safe). */
export function buildMarketingPlanPdf(sections: MktAiExportSection[]): Buffer {
  const allLines = flattenSections(sections);
  const pageChunks: string[][] = [];
  for (let i = 0; i < allLines.length; i += LINES_PER_PAGE) {
    pageChunks.push(allLines.slice(i, i + LINES_PER_PAGE));
  }
  if (!pageChunks.length) pageChunks.push([' ']);

  const parts: string[] = ['%PDF-1.4\n'];
  const offsets: number[] = [0];

  const pushObj = (body: string) => {
    offsets.push(Buffer.byteLength(parts.join(''), 'utf8'));
    parts.push(body);
    parts.push('\n');
  };

  pushObj('1 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj');

  const pageIds: number[] = [];
  let nextId = 2;

  for (const chunk of pageChunks) {
    const stream = buildPageStream(chunk);
    const contentId = nextId++;
    pushObj(
      `${contentId} 0 obj<< /Length ${Buffer.byteLength(stream, 'utf8')} >>stream\n${stream}\nendstream\nendobj`,
    );

    const pageId = nextId++;
    pageIds.push(pageId);
    pushObj(
      `${pageId} 0 obj<< /Type /Page /Parent PAGES /MediaBox [0 0 612 ${PAGE_HEIGHT}] /Resources << /Font << /F1 1 0 R >> >> /Contents ${contentId} 0 R >>endobj`,
    );
  }

  const pagesId = nextId++;
  const kids = pageIds.map((id) => `${id} 0 R`).join(' ');
  pushObj(`${pagesId} 0 obj<< /Type /Pages /Kids [ ${kids} ] /Count ${pageIds.length} >>endobj`);

  const catalogId = nextId++;
  pushObj(`${catalogId} 0 obj<< /Type /Catalog /Pages ${pagesId} 0 R >>endobj`);

  const body = parts.join('').replace(/\/Parent PAGES/g, `/Parent ${pagesId} 0 R`);
  const xrefStart = Buffer.byteLength(body, 'utf8');

  let xref = `xref\n0 ${catalogId + 1}\n`;
  xref += '0000000000 65535 f \n';

  const bodyParts = body.split('\n');
  let pos = 0;
  const objOffsets: number[] = [0];
  for (const line of bodyParts) {
    if (/^\d+ 0 obj/.test(line)) {
      objOffsets.push(pos);
    }
    pos += Buffer.byteLength(line + '\n', 'utf8');
  }

  for (let i = 1; i <= catalogId; i++) {
    const off = objOffsets[i] ?? 0;
    xref += `${String(off).padStart(10, '0')} 00000 n \n`;
  }

  const trailer = `trailer<< /Size ${catalogId + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
  return Buffer.from(body + xref + trailer, 'utf8');
}
