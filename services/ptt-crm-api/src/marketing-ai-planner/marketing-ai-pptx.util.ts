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

function slideXml(title: string, lines: string[]): string {
  const body = [
    `<p:sp><p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr sz="2800" b="1"/><a:t>${xmlEscape(title)}</a:t></a:r></a:p></p:txBody></p:sp>`,
  ];
  let id = 3;
  for (const line of lines.slice(0, 12)) {
    body.push(
      `<p:sp><p:nvSpPr><p:cNvPr id="${id++}" name="Content"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr sz="1600"/><a:t>${xmlEscape(line)}</a:t></a:r></a:p></p:txBody></p:sp>`,
    );
  }
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
       xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
       xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>${body.join('')}</p:spTree></p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sld>`;
}

/** Minimal OOXML PPTX via zip — one slide per export section. */
export async function buildMarketingPlanPptx(sections: MktAiExportSection[]): Promise<Buffer> {
  const slideFiles: Array<{ name: string; xml: string }> = [];
  const rels: string[] = [];
  sections.forEach((section, idx) => {
    const n = idx + 1;
    slideFiles.push({ name: `ppt/slides/slide${n}.xml`, xml: slideXml(section.title, section.lines) });
    rels.push(
      `<Relationship Id="rId${n + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${n}.xml"/>`,
    );
  });

  const sldIds = sections
    .map((_, idx) => `<p:sldId id="${256 + idx}" r:id="rId${idx + 2}"/>`)
    .join('');
  const presentationXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
                xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
                xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>
  <p:sldIdLst>${sldIds}</p:sldIdLst>
  <p:sldSz cx="9144000" cy="6858000"/>
</p:presentation>`;

  const presentationRels = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>
  ${rels.join('\n  ')}
</Relationships>`;

  const slideMasterXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
             xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld>
  <p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>
</p:sldMaster>`;

  const contentTypes = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats.org/presentationml.slideMaster+xml"/>
  ${slideFiles.map((_, i) => `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="application/vnd.openxmlformats.org/presentationml.slide+xml"/>`).join('\n  ')}
</Types>`;

  const rootRels = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>`;

  const archive = archiver('zip', { zlib: { level: 9 } });
  const stream = new PassThrough();
  const chunks: Buffer[] = [];
  stream.on('data', (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve, reject) => {
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    archive.on('error', reject);
  });
  archive.pipe(stream);
  archive.append('[Content_Types].xml', { name: '[Content_Types].xml' });
  archive.append(contentTypes, { name: '[Content_Types].xml' });
  archive.append(rootRels, { name: '_rels/.rels' });
  archive.append(presentationXml, { name: 'ppt/presentation.xml' });
  archive.append(presentationRels, { name: 'ppt/_rels/presentation.xml.rels' });
  archive.append(slideMasterXml, { name: 'ppt/slideMasters/slideMaster1.xml' });
  for (const slide of slideFiles) {
    archive.append(slide.xml, { name: slide.name });
  }
  await archive.finalize();
  return done;
}

export function pickPptxSections(
  all: Array<{ title: string; lines: string[] }>,
  picked: string[],
): Array<{ title: string; lines: string[] }> {
  const titleMap: Record<string, string[]> = {
    brief: ['Brief tóm tắt'],
    strategy: ['Khung chiến lược', 'TMMT — Thị trường mục tiêu'],
    campaign: ['Chiến dịch'],
    content: ['Lịch nội dung (tóm tắt)'],
  };
  const titles = new Set(picked.flatMap((k) => titleMap[k] ?? []));
  const header = all[0];
  const body = all.filter((s, idx) => idx > 0 && titles.has(s.title));
  return header ? [header, ...body] : body;
}

export function filterExportSections(
  sections: Array<{ key: string; title: string; lines: string[] }>,
  picked: Set<string>,
): Array<{ title: string; lines: string[] }> {
  return sections
    .filter((s) => picked.has(s.key))
    .map(({ title, lines }) => ({ title, lines }));
}
