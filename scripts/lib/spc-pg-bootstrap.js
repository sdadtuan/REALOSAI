'use strict';
const fs = require('fs');
const path = require('path');

async function ensureSpcSchema(client) {
  const ddlPath = path.join(__dirname, '../../docs/specs/2026-08-12-postgresql-ddl-spc.sql');
  const sql = fs.readFileSync(ddlPath, 'utf8');
  await client.query(sql);
}

module.exports = { ensureSpcSchema };
