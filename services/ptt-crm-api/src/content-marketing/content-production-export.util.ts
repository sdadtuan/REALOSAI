import type { CmktItemRow } from './content-marketing.types';
import { buildDesignBriefMarkdown } from './content-production.util';

export function designBriefPdfBuffer(item: CmktItemRow): Buffer {
  const title = item.title.slice(0, 80).replace(/[()\\]/g, ' ');
  const lines = buildDesignBriefMarkdown(item)
    .split('\n')
    .slice(0, 12)
    .map((l) => l.replace(/[()\\]/g, ' ').slice(0, 90));
  const bodyText = lines.join(' · ').slice(0, 500);
  const pdf = `%PDF-1.1
1 0 obj<<>>endobj
2 0 obj<</Length ${bodyText.length + 80}>>stream
BT /F1 11 Tf 48 760 Td (${title}) Tj 0 -18 Td (${bodyText}) Tj ET
endstream
endobj
3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Contents 2 0 R>>endobj
4 0 obj<</Type/Catalog/Pages<</Kids[3 0 R]/Count 1>>>>endobj
xref
0 5
0000000000 65535 f 
0000000010 00000 n 
0000000053 00000 n 
0000000200 00000 n 
0000000280 00000 n 
trailer<</Size 5/Root 4 0 R>>
startxref
340
%%EOF`;
  return Buffer.from(pdf, 'utf8');
}

export function designBriefPdfFilename(itemId: number): string {
  return `creative-brief-${itemId}.pdf`;
}
