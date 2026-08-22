import archiver from 'archiver';
import { PassThrough } from 'stream';
import type { ResearchReportSnapshot } from './market-research-report-snapshot.util';
import { normalizeReportExec } from './report-exec.util';

export type ResearchDocxSection = {
  title: string;
  lines: string[];
};

function xmlEscape(text: string): string {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function sectionToWordXml(section: ResearchDocxSection): string {
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

function methodologyLines(m: ResearchReportSnapshot['methodology'] | undefined): string[] {
  const population = String(m?.population ?? '');
  const sourcePlan = String(m?.source_plan ?? '');
  const limitation = String(m?.limitation ?? '');
  const lines = [
    `Population / Dân số: ${population}`,
    `Source plan / Kế hoạch nguồn: ${sourcePlan}`,
    `Limitation / Hạn chế: ${limitation}`,
  ];
  if (m?.stub === true && !population.trim() && !sourcePlan.trim() && !limitation.trim()) {
    lines.unshift('P0 CB methodology stub');
  }
  return lines;
}

export function sectionsFromReportSnapshot(snapshot: ResearchReportSnapshot): ResearchDocxSection[] {
  const cover = snapshot.cover;
  const exec = normalizeReportExec(snapshot.exec);
  const findingsByHeading = new Map<string, string[]>();
  for (const finding of snapshot.findings) {
    const heading = finding.heading || 'Findings';
    const lines = findingsByHeading.get(heading) ?? [];
    lines.push(finding.statement || finding.text || '');
    findingsByHeading.set(heading, lines);
  }

  const findingSections: ResearchDocxSection[] =
    findingsByHeading.size === 0
      ? [{ title: 'Findings', lines: ['(none)'] }]
      : [...findingsByHeading.entries()].map(([title, lines]) => ({ title, lines }));

  return [
    {
      title: 'Cover',
      lines: [
        `Client: ${cover.client}`,
        `Title: ${cover.title}`,
        'Confidential',
        `Version: ${cover.version}`,
        `As of: ${cover.as_of}`,
      ],
    },
    {
      title: 'Executive answer',
      lines: [exec.vi || '(none)'],
    },
    ...(exec.en ? [{ title: 'Executive (EN)', lines: [exec.en] }] : []),
    ...findingSections,
    {
      title: 'Recommendations',
      lines:
        snapshot.recs.length > 0
          ? snapshot.recs.map((row) => row.recommendation || row.text || '')
          : ['(none)'],
    },
    {
      title: 'Methodology',
      lines: methodologyLines(snapshot.methodology),
    },
    {
      title: 'Evidence index',
      lines:
        snapshot.evidence_index.length > 0
          ? snapshot.evidence_index.map((row) => `EV-${row.ev_id} → ${row.locator}`)
          : ['(none)'],
    },
  ];
}

/** Minimal OOXML DOCX via zip (editable in Word). Copied from marketing-ai-docx.util. */
export async function buildResearchReportDocx(
  sections: ResearchDocxSection[],
  footerLine?: string,
): Promise<Buffer> {
  const bodyXml = sections.map(sectionToWordXml).join('');
  const sectPr = footerLine
    ? `<w:sectPr><w:footerReference w:type="default" r:id="rIdFtr"/></w:sectPr>`
    : `<w:sectPr/>`;
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>${bodyXml}${sectPr}</w:body>
</w:document>`;

  const footerOverride = footerLine
    ? `<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>`
    : '';
  const contentTypes = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  ${footerOverride}
</Types>`;

  const rels = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  const documentRels = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rIdFtr" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>
</Relationships>`;

  const footerXml = footerLine
    ? `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:p><w:r><w:t xml:space="preserve">${xmlEscape(footerLine)}</w:t></w:r></w:p>
</w:ftr>`
    : '';

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
  if (footerLine) {
    archive.append(documentRels, { name: 'word/_rels/document.xml.rels' });
    archive.append(footerXml, { name: 'word/footer1.xml' });
  }
  await archive.finalize();
  return done;
}
