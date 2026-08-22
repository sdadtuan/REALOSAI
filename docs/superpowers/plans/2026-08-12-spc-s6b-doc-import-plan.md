# SPC S6b — Import doc PTT components + Admin tree

> **Status:** Implemented 2026-08-12

**Goal:** Mở rộng `spc-chuan-hoa-bundle.json` với `components[]` + `bundle_by_tier`; import vào PG; Admin xem tree DV01.

**Exit criteria:** DV01 doc có ≥4 components; tree API + import API PASS; Admin tab Tree doc hiển thị L0.5 → SKU bundle.

## Delivered

| Area | Detail |
|------|--------|
| Doc | `docs/specs/spc-chuan-hoa-bundle.json` — DV01 `components[]`, `bundle_by_tier` |
| Import lib | `scripts/lib/spc-component-import.js` |
| Seed | `scripts/seed_spc_components.js` — đọc từ doc bundle |
| API | `GET /api/v1/admin/spc/families/:dvCode/tree` |
| API | `POST /api/v1/admin/spc/import/doc-bundle?dv_code=` |
| Admin UI | Tab **Tree doc** on `/admin/services/families/DV01` |
| Gate | `scripts/spc_s6b_gate.sh` |

## Next (S6c–S6e)

- **S6c:** quote-catalog `components[]` + offer lines `component_code`
- **S6d:** publish workflow + bundle vs sum audit
- **S6e:** rollout 21 DV components in doc bundle ✅ (`2026-08-12-spc-s6e-full-catalog-plan.md`)
