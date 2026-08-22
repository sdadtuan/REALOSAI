# Design: Module 7 L5 Adapter Hardening (hướng A)

**Ngày:** 2026-08-21  
**Document ID:** RNOSAI-M7-L5-ADAPTER-20260821  
**Phiên bản:** 1.0  
**Trạng thái:** Spec neo code — chờ plan / implement  
**Nguồn BA:** `Adapter Spec — Module 7 Sản xuất Video AI (PTT CRM).docx` — *PTT-SA-M7-ADAPTER v1.0* (20/08/2026)  
**Cha:** [`2026-08-20-video-sop-module-7-design.md`](./2026-08-20-video-sop-module-7-design.md) §9 · §18 mục 3  
**Không gồm:** viết lại SOP/gate/UI S1–S10; Social FFmpeg; Kling DIRECT (chưa đọc được docs)

Tài liệu này **nâng tầng L5 tại chỗ** dưới interface đã ship. Không thay BA; Adapter Spec là nguồn vendor. Đây là bản **neo code** (contract, bảng, sprint).

---

## 1. Phạm vi

**Trong:** Capability Registry trên `vd_models`; contract `IProviderAdapter`; envelope canonical; 12 `error_class`; status `submitted` + `expired`; `AssetDeliveryService`; live Leonardo v2 + OpenAI Responses; Runway i2v; Kling **VIA_LEONARDO**; Topaz ảnh + saga video; webhook + poll đúng tần suất; 18 contract test; đối soát cost.

**Ngoài:** JWT Kling DIRECT; PiAPI/fal production (chỉ stub route); NLE; TTS cinematic; đổi SC-01…16 trừ SC-15 hiện `verified_at` / `model_key`.

---

## 2. Quyết định khóa (ADR)

| Mã | Quyết định |
|----|------------|
| **ADR-L5-01** | Hướng A: widen file trong `video-sop/adapters/**`. Không tách package, không viết lại L3. |
| **ADR-L5-02** | Registry = `vd_models` đã có. `code` = `model_key` (vd `video.kling.v3.pro`). Toàn bộ constraint/price/async nằm trong `capability_json`. Không tạo bảng `provider_capability`. |
| **ADR-L5-03** | Factory `selectXxx()` vẫn là cửa L3. Class vendor chỉ implement `IProviderAdapter` + facade cũ (`generate` / `enqueue`) trong S11–S12 để test S2–S10 không gãy. Dispatcher S13+ gọi `submit`/`poll`/`fetchOutputs`. |
| **ADR-L5-04** | Kling MVP `route: VIA_LEONARDO`. Cấm HTTP `api-singapore.klingai.com` cho đến khi spec v1.1 (mục 5.5 Adapter Spec). |
| **ADR-L5-05** | Map `E_*` → snake_case hiện có, **thêm** class mới; không đổi nghĩa `auth`/`transient`/`rate_limit`. |
| **ADR-L5-06** | Secret vẫn env (ADR-R5). Registry không chứa key. |
| **ADR-L5-07** | Draft = `video.runway.gen4_turbo_draft`; final audio = `video.kling.v3.pro`; final ProRes / >15s = `video.runway.gen45` / seedance (S13+). `intent` nằm trong envelope. |

---

## 3. Map lỗi & trạng thái

### 3.1 `error_class` (cột `vd_jobs`)

| Spec | RNOSAI | Retry |
|------|--------|-------|
| `E_AUTH` | `auth` | không |
| `E_VALIDATION` | `validation` | không |
| `E_QUOTA` | `budget` | không |
| `E_RATE_LIMIT` | `rate_limit` | có, tôn trọng `Retry-After` |
| `E_MODERATION` | `moderation` | **không** — escalate Lead |
| `E_INPUT_ASSET` | `input_asset` | không |
| `E_CAPABILITY_UNSUPPORTED` | `capability` | không — **không gọi HTTP** |
| `E_TRANSIENT` | `transient` | có, jitter ≤50% |
| `E_TIMEOUT` | `timeout` | 1 lần |
| `E_NOT_READY` | `not_ready` | poll tiếp, không FAILED |
| `E_INTERNAL_PROVIDER` | `provider` | ≤2 lần |
| — | `unknown` | không |
| — | `stale` (giữ) | job mồ côi PTT |

### 3.2 `vd_jobs.status`

Giữ: `created` `queued` `running` `succeeded` `failed` `cancelled` `stale`.  
Thêm: `submitted` (đã có `provider_task_id`), `expired` (SUCCEEDED nhưng không tải kịp URL — AP-04).

---

## 4. Contract L5

```
IProviderAdapter
  capabilities() -> CapabilitySet          # đọc vd_models, không hardcode
  health() -> HealthStatus
  estimate(req) -> CostEstimate            # max(rate×qty, min_charge)
  submit(req) -> SubmitResult              # provider_task_id, không chờ
  poll(provider_task_id) -> JobState
  parseWebhook(headers, body) -> JobState | null
  cancel(provider_task_id) -> { ok, creditsKept? }
  fetchOutputs(JobState) -> AssetRef[]     # tải về storage PTT
```

Envelope `CanonicalRequest` (snake_case PTT): `job_id`, `project_id`, `shot_id`, `capability`, `provider_code`, `model_key`, `intent` (`DRAFT`\|`FINAL`), `params`, `inputs[]`, `budget`, `callback`, `meta`.

Tham số canonical không hỗ trợ → `capability`, **cấm** bỏ âm thầm (AP-06).

---

## 5. Bảng

`docs/specs/postgresql-ddl-vd-sop-s11.sql`:

- `ALTER vd_jobs` — status + error_class mới; cột `provider_code`, `provider_task_id`, `model_key`, `request_snapshot`.
- `vd_job_provider_ref` — UNIQUE `(provider_code, provider_task_id)` và UNIQUE `job_id`.
- `vd_webhook_events` — UNIQUE `(provider_code, event_id)` cho CT-05.
- Seed 8 `model_key` đúng Adapter Spec §8.2 vào `vd_providers` + `vd_models`.
- Cron logic (S14): cảnh báo `verified_at` > 60 ngày — job Nest, không bắt buộc crontab OS ở S11.

---

## 6. Sprint

| Sprint | Deliverable | AC |
|--------|-------------|-----|
| **S11** | Contract + registry + AssetDelivery + CT-01…08 mock | Factory đọc DB; preflight không HTTP; idempotency; webhook dedupe |
| **S12** | Leonardo v2 + OpenAI Responses + webhook Leonardo | Character guidance; schema `video_script`; 200+[] = `not_ready` |
| **S13** | Runway live + Kling VIA_LEONARDO | Draft turbo / final Kling; `X-Runway-Version`; Content-Type không octet-stream |
| **S14** | Topaz ảnh + saga video + đối soát cost | Resume bước dở; `download_url`\|`url`; lệch ledger ≤2% trên fixture |

Một sprint đỏ thì không mở sprint sau (cùng luật Module 7).

---

## 7. Ngoài spec này

OpenAPI L3 đầy đủ; dashboard Grafana; đo concurrency thật; prompt template ngách; Kling DIRECT.

---

## 8. Changelog

| Ver | Ngày | Nội dung |
|-----|------|----------|
| 1.0 | 2026-08-21 | Hướng A — harden L5 tại chỗ theo PTT-SA-M7-ADAPTER |
