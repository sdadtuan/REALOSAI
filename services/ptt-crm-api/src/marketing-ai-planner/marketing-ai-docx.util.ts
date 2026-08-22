import archiver from 'archiver';
import { PassThrough } from 'stream';
import type { MktAiExportSection } from './marketing-ai-export.types';

function xmlEscape(text: string): string {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function sectionToWordXml(section: MktAiExportSection): string {
  const parts: string[] = [
    `<w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr><w:r><w:t xml:space="preserve">${xmlEscape(section.title)}</w:t></w:r></w:p>`,
  ];
  for (const line of section.lines) {
    parts.push(
      `<w:p><w:r><w:t xml:space="preserve">${xmlEscape(line)}</w:t></w:r></w:p>`,
    );
  }
  parts.push('<w:p/>');
  return parts.join('');
}

/** Minimal OOXML DOCX via zip (editable in Word). */
export async function buildMarketingPlanDocx(sections: MktAiExportSection[]): Promise<Buffer> {
  const bodyXml = sections.map(sectionToWordXml).join('');
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>${bodyXml}<w:sectPr/></w:body>
</w:document>`;

  const contentTypes = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

  const rels = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  const archive = archiver('zip', { zlib: { level: 9 } });
  const stream = new PassThrough();
  const chunks: Buffer[] = [];
  stream.on('data', (chunk: Buffer) => chunks.push(chunk));

  const done = new Promise<Buffer>((resolve, reject) => {
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
    archive.on('error', reject);
  });

  archive.pipe(stream);
  archive.append(contentTypes, { name: '[Content_Types].xml' });
  archive.append(rels, { name: '_rels/.rels' });
  archive.append(documentXml, { name: 'word/document.xml' });
  await archive.finalize();
  return done;
}
