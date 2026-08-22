'use strict';

const { inferServiceTypeFromAppendix } = require('./spc-pricing-parse');

const APPENDIX_A_MARKER = 'Phụ lục A — Bảng tổng hợp nhanh 21 dịch vụ';
const APPENDIX_COLUMNS = 6;

function normalizeServiceType(loaiHinh) {
  const mapped = inferServiceTypeFromAppendix(loaiHinh);
  if (mapped === 'setup_retainer') return 'setup_retainer';
  if (mapped === 'retainer') return 'retainer';
  if (mapped === 'one_time') return 'one_time';
  const lower = String(loaiHinh || '').toLowerCase();
  if (lower.includes('percent') || lower.includes('%')) return 'percent_of_ad_spend';
  return mapped || 'one_time';
}

function parseAppendixAFromParagraphs(paragraphs) {
  const markerIdx = paragraphs.findIndex((p) => p.includes(APPENDIX_A_MARKER));
  if (markerIdx < 0) return {};

  const headerIdx = paragraphs.findIndex(
    (p, i) => i > markerIdx && p === 'Mã' && paragraphs[i + 1] === 'Tên dịch vụ',
  );
  if (headerIdx < 0) return {};

  const byCode = {};
  let i = headerIdx + APPENDIX_COLUMNS;
  while (i + APPENDIX_COLUMNS - 1 < paragraphs.length) {
    const code = paragraphs[i];
    if (!/^DV\d{2}$/.test(code)) break;
    byCode[code] = {
      service_type: normalizeServiceType(paragraphs[i + 3]),
      price_range_vi: paragraphs[i + 4] || '',
      duration_hint_vi: paragraphs[i + 5] || '',
      loai_hinh_vi: paragraphs[i + 3] || '',
    };
    i += APPENDIX_COLUMNS;
  }
  return byCode;
}

function mergeAppendixA(families, paragraphs) {
  const appendix = parseAppendixAFromParagraphs(paragraphs);
  return families.map((family) => {
    const row = appendix[family.dv_code];
    if (!row) return family;
    return {
      ...family,
      service_type: row.service_type,
      price_range_vi: row.price_range_vi,
      duration_hint_vi: row.duration_hint_vi,
      loai_hinh_vi: row.loai_hinh_vi,
    };
  });
}

module.exports = {
  APPENDIX_A_MARKER,
  mergeAppendixA,
  parseAppendixAFromParagraphs,
};
