'use strict';

const DV_SECTION_RE = /^3\.\d+\s*—\s*\(?((?:DV)\d{2})\)?:\s*(.+)$/;
const DEPENDS_ON_RE = /\(DV\d{2}\)/g;
const TIER_LABELS = {
  'Cơ bản': 'CB',
  'Tiêu chuẩn': 'TC',
  'Chuyên sâu': 'CS',
};

function findSectionStartIndices(paragraphs) {
  const indices = [];
  for (let i = 0; i < paragraphs.length; i += 1) {
    const match = paragraphs[i].match(DV_SECTION_RE);
    if (!match) continue;
    const next = paragraphs[i + 1] || '';
    if (next.startsWith('Bộ phận phụ trách:')) {
      indices.push(i);
    }
  }
  return indices;
}

function parseDepartmentRole(line) {
  const text = String(line).replace(/^Bộ phận phụ trách:\s*/, '');
  const parts = text.split('·').map((p) => p.trim());
  const department = parts[0] || '';
  let role_vi = '';
  for (const part of parts.slice(1)) {
    const roleMatch = part.match(/^Vai trò:\s*(.+)$/i);
    if (roleMatch) role_vi = roleMatch[1].trim();
  }
  return { department, role_vi };
}

function extractDependsOn(text) {
  const codes = [];
  let match;
  const re = /\(DV\d{2}\)/g;
  while ((match = re.exec(String(text)))) {
    const code = match[0].slice(1, -1);
    if (!codes.includes(code)) codes.push(code);
  }
  return codes;
}

function isProcessHeader(line) {
  return line === 'Thời gian'
    || line === 'Nội dung PTT thực hiện'
    || line === 'Deliverable khách hàng nhận'
    || line === 'Khách hàng cần cung cấp/phê duyệt';
}

function isPricingHeader(line) {
  return line === 'Gói'
    || line === 'Phạm vi công việc'
    || line === 'Giá (VNĐ)'
    || line === 'Thời gian triển khai';
}

function looksLikeWeekLabel(line) {
  return /^Tuần\b/i.test(line)
    || /^Tháng\b/i.test(line)
    || /^Ngày\b/i.test(line)
    || /^Giai đoạn\b/i.test(line)
    || /^\d/.test(line) && /tuần|tháng|ngày|liên tục|vận hành/i.test(line);
}

function parseProcessPhases(slice) {
  const start = slice.findIndex((p) => p === 'Quy trình triển khai theo tuần');
  const end = slice.findIndex((p) => p === 'KPI cam kết theo dõi');
  if (start < 0 || end < 0 || end <= start) return [];

  const body = slice.slice(start + 1, end).filter((p) => !isProcessHeader(p));
  const phases = [];
  for (let i = 0; i < body.length; i += 4) {
    const week_label_vi = body[i];
    const ptt_work_vi = body[i + 1];
    const deliverable_vi = body[i + 2];
    const client_action_vi = body[i + 3];
    if (!week_label_vi || !looksLikeWeekLabel(week_label_vi)) continue;
    phases.push({
      week_label_vi,
      ptt_work_vi: ptt_work_vi || '',
      deliverable_vi: deliverable_vi || '',
      client_action_vi: client_action_vi || '',
      sort_order: phases.length + 1,
    });
  }
  return phases;
}

function parseKpiDefs(slice) {
  const idx = slice.findIndex((p) => p === 'KPI cam kết theo dõi');
  if (idx < 0 || idx + 1 >= slice.length) return [];
  const text = slice[idx + 1];
  if (!text || text === 'Bảng giá 3 gói') return [];
  return text
    .replace(/\(mỗi KPI.*$/i, '')
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);
}

function findPricingTableStart(slice, pricingStart) {
  const goiIdx = slice.findIndex((p, i) => i > pricingStart && p === 'Gói');
  if (goiIdx < 0) return pricingStart + 1;
  // Skip header row: Gói, Phạm vi công việc, Giá (VNĐ), Thời gian triển khai
  return goiIdx + 4;
}

function parseOffers(slice) {
  const start = slice.findIndex((p) => p === 'Bảng giá 3 gói');
  const end = slice.findIndex((p) => p === 'Rủi ro cần lưu ý');
  if (start < 0 || end < 0 || end <= start) return [];

  const tableStart = findPricingTableStart(slice, start);
  const body = slice.slice(tableStart, end);
  const offers = [];
  for (let i = 0; i < body.length; i += 4) {
    const label_vi = body[i];
    const tier = TIER_LABELS[label_vi];
    if (!tier) break;
    offers.push({
      tier,
      label_vi,
      scope_summary_vi: body[i + 1] || '',
      price_text_vi: body[i + 2] || '',
      duration_hint_vi: body[i + 3] || '',
    });
  }
  return offers;
}

function parseRisks(slice) {
  const idx = slice.findIndex((p) => p === 'Rủi ro cần lưu ý');
  if (idx < 0) return [];
  return slice.slice(idx + 1).filter((p) => p && !/^3\.\d+ —/.test(p));
}

function parseFamilySection(slice, headerLine) {
  const headerMatch = headerLine.match(DV_SECTION_RE);
  const dv_code = headerMatch[1];
  const name_vi = headerMatch[2].trim();

  const deptLine = slice.find((p) => p.startsWith('Bộ phận phụ trách:'));
  const { department, role_vi } = deptLine
    ? parseDepartmentRole(deptLine)
    : { department: '', role_vi: '' };

  const descIdx = slice.findIndex((p) => p === 'Mô tả & giá trị mang lại');
  const depIdx = slice.findIndex((p) => p === 'Phụ thuộc đầu vào');
  const description_vi = descIdx >= 0 && descIdx + 1 < slice.length ? slice[descIdx + 1] : '';
  const dependsText = depIdx >= 0 && depIdx + 1 < slice.length ? slice[depIdx + 1] : '';

  const process_phases = parseProcessPhases(slice);
  const kpi_defs = parseKpiDefs(slice);
  const offers = parseOffers(slice);
  const risks_vi = parseRisks(slice);

  return {
    dv_code,
    name_vi,
    department,
    role_vi,
    description_vi,
    depends_on_dv: extractDependsOn(dependsText),
    process_phases,
    kpi_defs,
    offers,
    risks_vi,
  };
}

function parseFamiliesFromParagraphs(paragraphs) {
  const starts = findSectionStartIndices(paragraphs);
  const families = [];
  for (let i = 0; i < starts.length; i += 1) {
    const start = starts[i];
    const end = i + 1 < starts.length ? starts[i + 1] : paragraphs.length;
    families.push(parseFamilySection(paragraphs.slice(start, end), paragraphs[start]));
  }
  return families;
}

module.exports = {
  DV_SECTION_RE,
  TIER_LABELS,
  parseFamiliesFromParagraphs,
  parseFamilySection,
};
