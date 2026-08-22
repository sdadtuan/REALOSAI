#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { extractParagraphsFromDocx } = require('./lib/spc-docx-read');
const { parseFamiliesFromParagraphs } = require('./lib/spc-doc-section-parse');
const { mergeAppendixA } = require('./lib/spc-appendix-merge');

const docx = process.env.SPC_SOURCE_DOCX
  || path.join(process.env.HOME, 'Downloads/Chuan_hoa_Du_lieu_Van_hanh_PTT.docx');
const out = process.argv[2]
  || path.join(__dirname, '../docs/specs/spc-chuan-hoa-bundle.json');

const paras = extractParagraphsFromDocx(docx);
let families = parseFamiliesFromParagraphs(paras);
families = mergeAppendixA(families, paras);

if (families.length !== 21) {
  console.error(`Expected 21 families, got ${families.length}`);
  process.exit(1);
}
for (const f of families) {
  if ((f.offers || []).length !== 3) {
    console.error(`${f.dv_code}: expected 3 offers, got ${(f.offers || []).length}`);
    process.exit(1);
  }
}

const bundle = {
  schema_version: '1.0.0',
  source_doc: path.basename(docx),
  generated_at: new Date().toISOString().slice(0, 10),
  families,
};
fs.writeFileSync(out, `${JSON.stringify(bundle, null, 2)}\n`);
console.log(`Wrote ${out} (${families.length} families)`);
