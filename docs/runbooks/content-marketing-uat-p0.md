# Runbook — Content Marketing P0 UAT (18 bước)

> **Automated runner:** `bash scripts/run_content_marketing_uat.sh`  
> **Manual checklist:** [`use-cases/actions/11-CMKT-ACTIONS.md`](../use-cases/actions/11-CMKT-ACTIONS.md) § Walkthrough UAT P0  
> **Staging:** `rs.pttads.vn` · slug `tiep-thi-noi-dung`

## Trước khi chạy

1. Caps: Writer (`crm_content.view`, `write`, `generate`), QA (`approve_internal`), Lead (`publish`, `assign`)
2. Env flags: `PTT_CONTENT_MARKETING_ENABLED=1`, `PTT_CONTENT_MARKETING_AI_ENABLED=1`
3. TMMT đã Apply (bước 3) hoặc có idea thủ công

## Automated (M7)

```bash
export STAFF_JWT="<token>"
export LIFECYCLE_ID="<id>"
bash scripts/run_content_marketing_uat.sh
```

Output: `docs/exports/cmkt-uat-p0-*.md`

## Manual 18 bước — ghi PASS/FAIL

| # | Bước | PASS |
|---|------|------|
| 1 | Login cap content | [ ] |
| 2 | Tab Content Board load context | [ ] |
| 3 | Import Planner → ideas > 0 | [ ] |
| 4 | Ideas populated | [ ] |
| 5 | Convert FB social_post | [ ] |
| 6 | Generate draft | [ ] |
| 7 | Generate variants ≥3 | [ ] |
| 8 | Chọn variant + sửa + version | [ ] |
| 9 | Submit review | [ ] |
| 10 | Review queue SLA | [ ] |
| 11 | Approve internal | [ ] |
| 12 | Convert blog | [ ] |
| 13 | Blog generate + approve | [ ] |
| 14 | Calendar schedule 2 items | [ ] |
| 15 | Copy caption FB | [ ] |
| 16 | Mark published | [ ] |
| 17 | SEO bridge (P1 optional) | [ ] |
| 18 | Audit có ai_run rows | [ ] |

## Tiêu chí bổ sung

- [ ] Reject thiếu comment → 400 (automated trong runner)
- [ ] Invalid channel+format blocked UI
- [ ] `smoke_content_marketing_p0.sh` PASS

## PO sign-off

- [ ] Tất cả bước manual PASS
- [ ] Report automated attached
- [ ] Ngày: ___________ · PO: ___________
