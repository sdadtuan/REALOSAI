'use strict';

const { parsePricingText } = require('./spc-pricing-parse');

function formatVnd(n) {
  return `${new Intl.NumberFormat('vi-VN').format(Math.max(0, Math.round(n)))}đ`;
}

function formatPriceText(min, max, suffix = '') {
  if (min === max) return `${formatVnd(min)}${suffix}`;
  return `${formatVnd(min)} – ${formatVnd(max)}${suffix}`;
}

function tierOffer(family, tier = 'TC') {
  return (family.offers ?? []).find((o) => o.tier === tier) ?? family.offers?.[1] ?? family.offers?.[0];
}

function isRetainerPhase(phase) {
  const text = `${phase?.week_label_vi ?? ''} ${phase?.ptt_work_vi ?? ''}`;
  return /retainer|tháng 2\+|month 2\+|\+\s*\(/i.test(text);
}

function componentPriceText(family, phaseIndex, phaseCount) {
  const serviceType = family.service_type || 'one_time';
  const tc = tierOffer(family, 'TC');
  const pricing = parsePricingText(tc?.price_text_vi ?? family.price_range_vi ?? '', serviceType);
  const lastIsRetainer =
    phaseCount > 1 && isRetainerPhase((family.process_phases ?? [])[phaseCount - 1]);

  if (pricing.type === 'setup_plus_retainer') {
    if (lastIsRetainer && phaseIndex === phaseCount - 1) {
      return formatPriceText(pricing.monthly_min_vnd ?? 0, pricing.monthly_max_vnd ?? 0, '/tháng');
    }
    const setupPhases = lastIsRetainer ? phaseCount - 1 : phaseCount;
    const denom = Math.max(1, setupPhases);
    const min = Math.round((pricing.setup_min_vnd ?? pricing.min_vnd ?? 0) / denom);
    const max = Math.round((pricing.setup_max_vnd ?? pricing.max_vnd ?? min) / denom);
    return formatPriceText(min, Math.max(min, max));
  }

  if (pricing.type === 'retainer' || serviceType === 'retainer') {
    return formatPriceText(
      pricing.monthly_min_vnd ?? pricing.min_vnd ?? 0,
      pricing.monthly_max_vnd ?? pricing.max_vnd ?? 0,
      '/tháng',
    );
  }

  if (pricing.type === 'percent_of_ad_spend') {
    return tc?.price_text_vi ?? family.price_range_vi ?? 'Theo % ngân sách';
  }

  const denom = Math.max(1, phaseCount);
  const min = Math.round((pricing.min_vnd ?? 0) / denom);
  const max = Math.round((pricing.max_vnd ?? min) / denom);
  return formatPriceText(min, Math.max(min, max));
}

function phaseComponentName(phase) {
  const deliverable = String(phase?.deliverable_vi ?? '').trim();
  if (deliverable) return deliverable.split('+')[0].trim().slice(0, 120);
  return String(phase?.ptt_work_vi ?? 'Dịch vụ con').trim().slice(0, 120);
}

function componentsFromProcessPhases(family) {
  const dvCode = String(family.dv_code ?? '').trim().toUpperCase();
  const phases = family.process_phases ?? [];
  if (!phases.length) return [];

  return phases.map((phase, index) => ({
    component_code: `${dvCode}-C${String(index + 1).padStart(2, '0')}`,
    name_vi: phaseComponentName(phase),
    description_vi: String(phase.ptt_work_vi ?? '').trim(),
    deliverable_vi: String(phase.deliverable_vi ?? '').trim(),
    price_text_vi: componentPriceText(family, index, phases.length),
    sort_order: Number(phase.sort_order ?? index + 1),
  }));
}

function bundleByTierFromComponents(family, components) {
  const codes = (components ?? []).map((c) => c.component_code).filter(Boolean);
  const n = codes.length;
  if (!n) return {};

  if (n === 1) {
    return { CB: [...codes], TC: [...codes], CS: [...codes] };
  }

  const lastPhase = (family.process_phases ?? [])[n - 1];
  const retainerTail = n > 2 && isRetainerPhase(lastPhase);
  const setupCodes = retainerTail ? codes.slice(0, n - 1) : codes;

  if (retainerTail) {
    return {
      CB: setupCodes.slice(0, Math.max(1, setupCodes.length - 1)),
      TC: [...setupCodes],
      CS: [...codes],
    };
  }

  if (n === 2) {
    return { CB: [codes[0]], TC: [...codes], CS: [...codes] };
  }

  return {
    CB: codes.slice(1, Math.min(3, n)),
    TC: [...codes],
    CS: [...codes],
  };
}

function enrichFamilyComponents(family, { preserveExisting = true } = {}) {
  if (preserveExisting && Array.isArray(family.components) && family.components.length) {
    return family;
  }
  const components = componentsFromProcessPhases(family);
  if (!components.length) return family;
  return {
    ...family,
    components,
    bundle_by_tier: bundleByTierFromComponents(family, components),
  };
}

module.exports = {
  componentsFromProcessPhases,
  bundleByTierFromComponents,
  enrichFamilyComponents,
  componentPriceText,
  isRetainerPhase,
};
