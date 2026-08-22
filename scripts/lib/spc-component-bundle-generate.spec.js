'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  componentsFromProcessPhases,
  bundleByTierFromComponents,
  enrichFamilyComponents,
} = require('./spc-component-bundle-generate');

const dv02 = {
  dv_code: 'DV02',
  service_type: 'setup_retainer',
  process_phases: [
    { week_label_vi: 'Tuần 1-2', ptt_work_vi: 'Setup content', deliverable_vi: 'Kế hoạch content', sort_order: 1 },
    { week_label_vi: 'Tuần 3-4', ptt_work_vi: 'Batch đầu', deliverable_vi: 'Nội dung đăng', sort_order: 2 },
    { week_label_vi: 'Tháng 2+ (retainer)', ptt_work_vi: 'Vận hành', deliverable_vi: 'Báo cáo tháng', sort_order: 3 },
  ],
  offers: [{ tier: 'TC', price_text_vi: 'Setup 6-10tr + 16.000.000-22.000.000đ/tháng' }],
};

test('derives components from process phases', () => {
  const components = componentsFromProcessPhases(dv02);
  assert.equal(components.length, 3);
  assert.equal(components[0].component_code, 'DV02-C01');
  assert.equal(components[0].name_vi, 'Kế hoạch content');
});

test('excludes retainer from CB bundle tier', () => {
  const components = componentsFromProcessPhases(dv02);
  const bundle = bundleByTierFromComponents(dv02, components);
  assert.deepEqual(bundle.CB, ['DV02-C01']);
  assert.deepEqual(bundle.TC, ['DV02-C01', 'DV02-C02']);
  assert.deepEqual(bundle.CS, ['DV02-C01', 'DV02-C02', 'DV02-C03']);
});

test('preserves existing components when enriching', () => {
  const existing = {
    dv_code: 'DV01',
    components: [{ component_code: 'DV01-C01', name_vi: 'Keep' }],
    bundle_by_tier: { CB: ['DV01-C01'] },
  };
  const out = enrichFamilyComponents(existing);
  assert.equal(out.components[0].name_vi, 'Keep');
});
