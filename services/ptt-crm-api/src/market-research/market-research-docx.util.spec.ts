import { inflateRawSync } from 'zlib';
import { buildResearchReportDocx, sectionsFromReportSnapshot } from './market-research-docx.util';
import { buildReportSnapshot } from './market-research-report-snapshot.util';
import { REPORT_PDF_STALE_FOOTER_STAFF } from './report-pdf-stale.util';

function unzipEntry(buf: Buffer, name: string): string {
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i -= 1) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('zip eocd missing');
  const cdOffset = buf.readUInt32LE(eocd + 16);
  const cdSize = buf.readUInt32LE(eocd + 12);
  let offset = cdOffset;
  const cdEnd = cdOffset + cdSize;
  while (offset + 46 <= cdEnd) {
    if (buf.readUInt32LE(offset) !== 0x02014b50) break;
    const method = buf.readUInt16LE(offset + 10);
    const compSize = buf.readUInt32LE(offset + 20);
    const nameLen = buf.readUInt16LE(offset + 28);
    const extraLen = buf.readUInt16LE(offset + 30);
    const commentLen = buf.readUInt16LE(offset + 32);
    const localOffset = buf.readUInt32LE(offset + 42);
    const fileName = buf.subarray(offset + 46, offset + 46 + nameLen).toString('utf8');
    if (fileName === name) {
      const localNameLen = buf.readUInt16LE(localOffset + 26);
      const localExtraLen = buf.readUInt16LE(localOffset + 28);
      const dataStart = localOffset + 30 + localNameLen + localExtraLen;
      const data = buf.subarray(dataStart, dataStart + compSize);
      const raw = method === 0 ? data : inflateRawSync(data);
      return raw.toString('utf8');
    }
    offset += 46 + nameLen + extraLen + commentLen;
  }
  throw new Error(`zip entry missing: ${name}`);
}

describe('buildResearchReportDocx', () => {
  it('unzips word/document.xml containing Evidence', async () => {
    const snapshot = buildReportSnapshot({
      project: {
        client_id: 'acme',
        client_name: 'Acme',
        title: 'Category review sữa uống 2026',
        decision_statement: 'Quyết định có mở SKU premium Q4 hay không.',
      },
      insights: [
        {
          id: 11,
          statement: 'Premium SKU tăng share ở MT HCM',
          recommendation: 'Mở SKU premium',
          evidence_ids: [3],
        },
      ],
      questions: [{ id: 21, question_vi: 'Quy mô thị trường?', sort_order: 1 }],
      evidence: [{ id: 3, locator: 'https://example.com#p3', question_id: 21 }],
      selectedInsightIds: [11],
      version: 1,
    });
    const buffer = await buildResearchReportDocx(sectionsFromReportSnapshot(snapshot));
    const xml = unzipEntry(buffer, 'word/document.xml');
    expect(xml).toContain('Evidence');
    expect(xml).toContain('EV-3');
  });

  it('unzip DOCX TC contains Limitation / Hạn chế', async () => {
    const snapshot = buildReportSnapshot({
      project: {
        client_id: 'acme',
        client_name: 'Acme',
        title: 'Category review sữa uống 2026',
        decision_statement: 'Quyết định có mở SKU premium Q4 hay không.',
      },
      insights: [
        {
          id: 11,
          statement: 'Premium SKU tăng share ở MT HCM',
          recommendation: 'Mở SKU premium',
          evidence_ids: [3],
        },
      ],
      questions: [{ id: 21, question_vi: 'Quy mô thị trường?', sort_order: 1 }],
      evidence: [{ id: 3, locator: 'https://example.com#p3', question_id: 21 }],
      selectedInsightIds: [11],
      version: 1,
      methodology: {
        population: 'Shopper MT HCM 18-45',
        source_plan: 'Desk research + storecheck',
        limitation: 'Không có panel định lượng 2026',
      },
    });
    const buffer = await buildResearchReportDocx(sectionsFromReportSnapshot(snapshot));
    const xml = unzipEntry(buffer, 'word/document.xml');
    expect(xml.includes('Limitation') || xml.includes('Hạn chế')).toBe(true);
    expect(xml).toContain('Không có panel định lượng 2026');
  });

  it('unzip DOCX has Executive (EN) when en present', async () => {
    const snapshot = buildReportSnapshot({
      project: {
        client_id: 'acme',
        client_name: 'Acme',
        title: 'Category review sữa uống 2026',
        decision_statement: 'Quyết định có mở SKU premium Q4 hay không.',
      },
      insights: [
        {
          id: 11,
          statement: 'Premium SKU tăng share ở MT HCM',
          recommendation: 'Mở SKU premium',
          evidence_ids: [3],
        },
      ],
      questions: [{ id: 21, question_vi: 'Quy mô thị trường?', sort_order: 1 }],
      evidence: [{ id: 3, locator: 'https://example.com#p3', question_id: 21 }],
      selectedInsightIds: [11],
      version: 1,
      llmDraft: {
        exec: { vi: 'Mở SKU premium Q4.', en: 'Launch the premium SKU in Q4.' },
      },
    });
    const buffer = await buildResearchReportDocx(sectionsFromReportSnapshot(snapshot));
    const xml = unzipEntry(buffer, 'word/document.xml');
    expect(xml).toContain('Executive (EN)');
    expect(xml).toContain('Launch the premium SKU in Q4.');
  });

  it('P31 embeds footerLine in word/footer1.xml when set', async () => {
    const buffer = await buildResearchReportDocx(
      [{ title: 'Cover', lines: ['x'] }],
      REPORT_PDF_STALE_FOOTER_STAFF,
    );
    const footer = unzipEntry(buffer, 'word/footer1.xml');
    expect(footer).toContain(REPORT_PDF_STALE_FOOTER_STAFF);
    const doc = unzipEntry(buffer, 'word/document.xml');
    expect(doc).toMatch(/footerReference/);
  });

  it('P31 omits footer part when footerLine omitted', async () => {
    const buffer = await buildResearchReportDocx([{ title: 'Cover', lines: ['x'] }]);
    expect(() => unzipEntry(buffer, 'word/footer1.xml')).toThrow(/zip entry missing/);
  });
});
