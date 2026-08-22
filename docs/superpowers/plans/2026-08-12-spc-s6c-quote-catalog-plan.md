# SPC S6c — Quote catalog components + offer lines

> **Status:** Implemented 2026-08-12

**Goal:** `GET /api/spc/quote-catalog` trả `components[]` theo family; offer `lines[]` link `component_code`; Quote Builder hiển thị breakdown DV01-TC ≥3 dòng.

**Exit criteria:** DV01-TC có ≥3 offer lines với `component_code`; catalog API expose components + linked lines.

## Delivered

| Area | Detail |
|------|--------|
| Import | `syncOfferLinesFromBundle` — tạo `service_offer_line` từ bundle |
| API | `quote-catalog` families[].components + offers[].lines[].component_code |
| API | `resolveQuoteLineFromSku` trả `component_lines[]` |
| FE | Quote Builder step 2/3 — hiển thị dịch vụ con + scope lines |
| Gate | `scripts/spc_s6c_gate.sh` |

## Deploy note

Sau pull, chạy lại `node scripts/seed_spc_components.js DV01` để sync offer lines từ bundle.
