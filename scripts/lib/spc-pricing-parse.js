'use strict';

function parseVndToken(token) {
  const t = String(token).replace(/\./g, '').replace(/,/g, '').trim();
  const m = t.match(/^(\d+(?:\.\d+)?)\s*tr/i);
  if (m) return Math.round(parseFloat(m[1]) * 1_000_000);
  const n = t.match(/^(\d+)/);
  return n ? parseInt(n[1], 10) : 0;
}

function parseVndRange(text) {
  const parts = String(text)
    .split(/–|-/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length >= 2) {
    const useTr = parts.some((p) => /tr/i.test(p));
    const minRaw = parts[0];
    const maxRaw = parts[parts.length - 1];
    const minTok = useTr && !/tr/i.test(minRaw) ? `${minRaw}tr` : minRaw;
    const maxTok = useTr && !/tr/i.test(maxRaw) ? `${maxRaw}tr` : maxRaw;
    return { min_vnd: parseVndToken(minTok), max_vnd: parseVndToken(maxTok) };
  }
  const single = parseVndToken(text);
  return { min_vnd: single, max_vnd: single };
}

function parsePricingText(textVi, serviceType) {
  const raw = String(textVi ?? '').trim();
  if (serviceType === 'one_time') {
    const r = parseVndRange(raw.replace(/[^\dtr–\-\.]/gi, ' '));
    return { type: 'one_time', ...r };
  }
  if (/setup/i.test(raw) && /tháng|thang/i.test(raw)) {
    const setupPart = raw.match(/setup\s*([\d\.\,\-\–tr\s]+)/i)?.[1] ?? '';
    const monthlyPart =
      raw.split('+').find((p) => /tháng|thang/i.test(p)) ??
      raw.match(/(\d[\d\.\,]*\s*-\s*\d[\d\.\,]*).*tháng/i)?.[0] ??
      raw;
    const setup = parseVndRange(setupPart.replace(/[^\dtr–\-]/gi, ' '));
    const monthly = parseVndRange(monthlyPart.replace(/\./g, '').replace(/[^\d–\-]/g, ''));
    return {
      type: 'setup_plus_retainer',
      setup_min_vnd: setup.min_vnd,
      setup_max_vnd: setup.max_vnd,
      monthly_min_vnd: monthly.min_vnd,
      monthly_max_vnd: monthly.max_vnd,
    };
  }
  if (serviceType === 'retainer' || /tháng|thang/i.test(raw)) {
    const r = parseVndRange(raw);
    return { type: 'retainer', monthly_min_vnd: r.min_vnd, monthly_max_vnd: r.max_vnd };
  }
  if (/%/.test(raw) || serviceType === 'percent_of_ad_spend') {
    return { type: 'percent_of_ad_spend', min_fee_vnd: 8_000_000, rate_pct: 0, note_vi: raw };
  }
  const r = parseVndRange(raw);
  return { type: 'one_time', ...r };
}

function inferServiceTypeFromAppendix(loaiHinh) {
  const s = String(loaiHinh ?? '').toLowerCase();
  if (s.includes('setup') && s.includes('retainer')) return 'setup_retainer';
  if (s.includes('retainer')) return 'retainer';
  if (s.includes('one-time') || s.includes('one time')) return 'one_time';
  return 'setup_retainer';
}

module.exports = { parseVndRange, parsePricingText, inferServiceTypeFromAppendix };
