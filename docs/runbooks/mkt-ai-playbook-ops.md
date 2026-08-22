# MKT-AI Industry Playbooks — Ops runbook (WS-P4-08)

> **Path:** `services/ptt-crm-api/src/marketing-ai-planner/playbooks/*.json`  
> **Runtime catalog:** `MKT_AI_PLAYBOOK_SLUGS` in `marketing-ai-playbook.util.ts`  
> **Verify:** `./scripts/verify_mkt_ai_playbooks.sh`

---

## 1. Mục tiêu

DevOps thêm/sửa playbook JSON qua PR — không cần admin UI MVP. Mỗi PR playbook phải pass schema gate trước merge.

---

## 2. Playbook PR checklist (P4-08-T2)

Trước khi merge PR có thay đổi `playbooks/*.json`:

- [ ] File đặt tên `{slug}.json` và `slug` trong JSON **khớp** tên file
- [ ] `label_vi`, `service_slugs[]`, `brief_defaults`, `strategy_prompt_hints[]`, `campaign_kpi_templates[]`, `quality_gate` đầy đủ
- [ ] `quality_gate.min_score_launch_qa` trong khoảng 0–100 (staging GA: thường 70)
- [ ] `quality_gate.require_campaign_count` ≥ 1 (GA pack: 2)
- [ ] Nếu thêm slug mới → cập nhật `MKT_AI_PLAYBOOK_SLUGS` trong `marketing-ai-playbook.util.ts`
- [ ] Nếu slug mới thuộc pilot → thêm vào `PTT_MKT_AI_PLANNER_SLUGS` env (staging/prod)
- [ ] Chạy `./scripts/verify_mkt_ai_playbooks.sh` — exit 0
- [ ] Chạy `npm test -- --testPathPattern=marketing-ai-playbook` trong `services/ptt-crm-api`
- [ ] Staging: `bash scripts/run_mkt_ai_p3_uat.sh` (UC-020 playbook apply) hoặc full regression

```bash
./scripts/verify_mkt_ai_playbooks.sh
cd services/ptt-crm-api && npm test -- --testPathPattern=marketing-ai-playbook
```

---

## 3. Schema tham chiếu

| Field | Bắt buộc | Ghi chú |
|-------|----------|---------|
| `slug` | ✓ | = tên file |
| `label_vi` | ✓ | Hiển thị dropdown |
| `service_slugs` | ✓ | ≥1 slug lifecycle |
| `brief_defaults` | ✓ | Partial brief prefill |
| `strategy_prompt_hints` | ✓ | ≥1 string |
| `campaign_kpi_templates` | ✓ | ≥1 string |
| `quality_gate` | ✓ | min_score + require_campaign_count |
| `channel_mix_pct` | ○ | Object số |
| `governance_notes_vi` | ○ | Banner governance |
| `stub_swot_json` | ○ | Stub mode SWOT |

Copy template từ `meta-lead-gen.json`.

---

## 4. Admin read-only API (P4-08-T3)

```http
GET /api/v1/admin/mkt-ai/playbooks
Authorization: Bearer …   # cap ai_admin.view
# hoặc x-ptt-internal-key
```

Response: catalog từ disk + `schema_valid` / `in_runtime_catalog`.

Smoke:

```bash
PTT_CRM_INTERNAL_KEY=... bash scripts/smoke_mkt_ai_playbooks_admin.sh
```

---

## 5. Rollout sau PR

1. Merge → deploy API (`git pull` + `npm run build` + restart `ptt-crm-api`)
2. Không cần DDL
3. Verify staging:

```bash
bash scripts/verify_mkt_ai_playbooks.sh
bash scripts/smoke_mkt_ai_playbooks_admin.sh
```

---

## 6. Liên kết

| Doc | Path |
|-----|------|
| Delivery SOP | [`mkt-ai-planner-delivery-sop.md`](./mkt-ai-planner-delivery-sop.md) |
| GA rollout | [`mkt-ai-planner-ga-rollout.md`](./mkt-ai-planner-ga-rollout.md) |
| P3 UC-020 | [`10-MKTP-ACTIONS.md`](../use-cases/actions/10-MKTP-ACTIONS.md) |

---

*Runbook v1.0 — WS-P4-08 playbook ops.*
