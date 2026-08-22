#!/usr/bin/env python3
import os, sqlite3, subprocess

DSN = os.environ.get("DATABASE_URL", "postgresql://ptt:ptt_dev@127.0.0.1:5433/rnosaidb")
SQLITE = os.environ.get("PTT_SQLITE_PATH", "ptt.db")

SQL = """
INSERT INTO bds_tenants (code, name, mode, status, operated_by_ptt)
VALUES ('PTT-RE-LEGACY', 'PTT RE Legacy', 'hybrid', 'draft', TRUE)
ON CONFLICT (code) DO NOTHING;

UPDATE crm_re_projects p
SET tenant_id = t.id
FROM bds_tenants t
WHERE t.code = 'PTT-RE-LEGACY'
  AND p.tenant_id IS NULL;

SELECT t.id, t.code,
       (SELECT COUNT(*) FROM crm_re_projects x WHERE x.tenant_id = t.id) AS projects
FROM bds_tenants t WHERE t.code = 'PTT-RE-LEGACY';
"""

print(subprocess.check_output(["psql", DSN, "-v", "ON_ERROR_STOP=1", "-c", SQL], text=True))


def sql_literal(value) -> str:
    if value is None:
        return "''"
    return "'" + str(value).replace("'", "''") + "'"


# P0-required batch mirror: SQLite crm_re_projects → PG with legacy tenant_id
tenant_id = subprocess.check_output(
    ["psql", DSN, "-tA", "-c", "SELECT id FROM bds_tenants WHERE code = 'PTT-RE-LEGACY'"],
    text=True,
).strip()

con = sqlite3.connect(SQLITE)
rows = con.execute(
    "SELECT id, code, name, status, developer_name FROM crm_re_projects"
).fetchall()
con.close()

for row_id, code, name, status, developer_name in rows:
    upsert = f"""
INSERT INTO crm_re_projects (id, code, name, status, developer_name, tenant_id, updated_at)
VALUES (
  {int(row_id)},
  {sql_literal(code)},
  {sql_literal(name)},
  {sql_literal(status)},
  {sql_literal(developer_name)},
  {sql_literal(tenant_id)},
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  code = EXCLUDED.code,
  name = EXCLUDED.name,
  status = EXCLUDED.status,
  developer_name = EXCLUDED.developer_name,
  tenant_id = EXCLUDED.tenant_id,
  updated_at = NOW();
"""
    subprocess.check_output(["psql", DSN, "-v", "ON_ERROR_STOP=1", "-c", upsert], text=True)

SELECT = """
SELECT t.id, t.code,
       (SELECT COUNT(*) FROM crm_re_projects x WHERE x.tenant_id = t.id) AS projects
FROM bds_tenants t WHERE t.code = 'PTT-RE-LEGACY';
"""
print(subprocess.check_output(["psql", DSN, "-v", "ON_ERROR_STOP=1", "-c", SELECT], text=True))
