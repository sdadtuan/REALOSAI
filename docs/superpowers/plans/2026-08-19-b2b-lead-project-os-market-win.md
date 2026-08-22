# B2B Lead Project OS Market Win Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Đưa B2B Lead Project OS từ P1–P6 (flag OFF, mock CPaaS, poll 15s) lên hệ inside-sales thắng thị trường: SSE+push, gọi thật, speed-to-lead, commission ledger, intelligence closed-loop, inbox Zalo, ads CAPI.

**Architecture:** Sáu trụ + bốn trụ thắng. Tái sử dụng SSE `SlaAlertService`, web-push/FCM portal (đổi sang staff), `B2bCpaasAdapter`. Visibility C bắt buộc trên mọi stream/push. Flag master `PTT_B2B_PROJECT_OS`; flag con `PTT_B2B_SSE`, `PTT_B2B_PUSH`, `PTT_B2B_CPAAS`, `PTT_B2B_ADS_CAPI`.

**Tech Stack:** NestJS `ptt-crm-api`; ops-web Next.js; PostgreSQL; Jest + Playwright; Stringee WebRTC; web-push + FCM; Meta CAPI.

**Spec:** [`docs/superpowers/specs/2026-08-19-b2b-lead-project-os-market-win-design.md`](../specs/2026-08-19-b2b-lead-project-os-market-win-design.md)

## Global Constraints

- Chủ quản = một dòng `crm_operating_company` `code=PTT` — không CRUD đa công ty
- Ngoài scope visibility → **404**, JSON không chứa `full_name` / `phone`
- SSE/push/alert: cùng filter C; ngoài scope = không emit
- CPaaS down → `tel:` fallback; không chặn ingest
- AI gọi chỉ tại mốc cảnh báo nếu NV chưa gọi (Q7=A)
- Flag `PTT_B2B_PROJECT_OS` mặc định tắt cho đến W0 UAT xanh
- Không barge; không SMS NV; không cấu hình kênh trên mobile
- Test: `cd services/ptt-crm-api && npx jest --testPathPattern=<file> --no-coverage`
- W0 chặn bật CPaaS/prod push; W1 chặn W2 CPaaS

---

## File map

| File | Trách nhiệm |
|------|-------------|
| `docs/specs/2026-08-19-postgresql-ddl-b2b-market-win.sql` | DDL: staff push tokens, commission ledger, dnc, routing_ab, ads_capi_log, conversation_threads |
| `services/ptt-crm-api/src/b2b-projects/b2b-staff-active.util.ts` | `isActivePttStaff` từ `crm_staff.active` |
| `services/ptt-crm-api/src/b2b-projects/b2b-lead-scope.service.ts` | Bỏ hardcode `isActivePttStaff: true` |
| `services/ptt-crm-api/src/b2b-projects/b2b-alert-stream.service.ts` | SSE fanout alert mới (pattern `SlaAlertService`) |
| `services/ptt-crm-api/src/b2b-projects/b2b-alerts.controller.ts` | `GET /api/v1/b2b-lead-alerts/stream` |
| `services/ptt-crm-api/src/b2b-projects/b2b-staff-push.sender.ts` | Thay no-op: web-push + FCM |
| `services/ptt-crm-api/src/b2b-projects/b2b-cpaas-stringee.adapter.ts` | `B2bCpaasAdapter` Stringee |
| `services/ops-web/src/components/crm/B2bSoftphone.tsx` | WebRTC widget |
| `services/ops-web/src/app/crm/b2b-unmatched/page.tsx` | GDKD unmatched workbench |
| `services/ops-web/src/app/crm/b2b-speed/page.tsx` | Speed-to-lead p50/p95 |
| `scripts/uat_b2b_project_os.sh` | UAT B2B-01…18 |
| `e2e/b2b-visibility.spec.ts` | Playwright visibility + inbox + Gọi |

Phase map: **W0 = Task 1–2**, **W1 = Task 3–7**, **W2 = Task 8–10**, **W3 = Task 11–13**, **W4 = Task 14–16**, **W5 = Task 17–20**.

---

### Task 1: `isActivePttStaff` thật + UAT script (W0)

**Files:**
- Create: `services/ptt-crm-api/src/b2b-projects/b2b-staff-active.util.ts`
- Create: `services/ptt-crm-api/src/b2b-projects/b2b-staff-active.util.spec.ts`
- Modify: `services/ptt-crm-api/src/b2b-projects/b2b-lead-scope.service.ts`
- Create: `scripts/uat_b2b_project_os.sh`
- Create: `docs/runbooks/b2b-project-os-flag-on.md`

**Interfaces:**
- Consumes: `crm_staff.active`, `canSeeB2bLead`
- Produces: `resolveIsActivePttStaff(row: { active: boolean | null }): boolean`

- [ ] **Step 1: Write the failing test**

```ts
import { resolveIsActivePttStaff } from './b2b-staff-active.util';

it('inactive staff is not active PTT', () => {
  expect(resolveIsActivePttStaff({ active: false })).toBe(false);
  expect(resolveIsActivePttStaff({ active: true })).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/ptt-crm-api && npx jest src/b2b-projects/b2b-staff-active.util.spec.ts --no-coverage`

Expected: FAIL cannot find module

- [ ] **Step 3: Implement + wire scope**

`resolveIsActivePttStaff` trả `row.active === true`. Trong `assertLeadVisible`, load `crm_staff.active` theo `staffId` (query nhỏ hoặc join sẵn từ `StaffAuthService.me` nếu đã có). Không hardcode `true`.

`scripts/uat_b2b_project_os.sh`: lần lượt B2B-01 (POST thiếu project → 400), B2B-02 (GET ngoài pool → 404, `grep -v Secret`). Cần `API_URL`, `STAFF_TOKEN`, `OUTSIDER_TOKEN`.

Runbook: thứ tự backfill LEGACY → map kênh → bật flag staging 48h → prod.

- [ ] **Step 4: Run tests**

Run: `cd services/ptt-crm-api && npx jest src/b2b-projects --no-coverage`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add services/ptt-crm-api/src/b2b-projects/b2b-staff-active.util.ts \
  services/ptt-crm-api/src/b2b-projects/b2b-staff-active.util.spec.ts \
  services/ptt-crm-api/src/b2b-projects/b2b-lead-scope.service.ts \
  scripts/uat_b2b_project_os.sh \
  docs/runbooks/b2b-project-os-flag-on.md
git commit -m "$(cat <<'EOF'
fix(b2b): resolve active PTT staff and add UAT runbook

EOF
)"
```

---

### Task 2: Staging flag ON + smoke (W0 gate)

**Files:**
- Modify: `deploy/runtime.env` trên VPS staging only — không commit secret
- Modify: `scripts/smoke_b2b_project_os.sh` — thêm GET 404 outsider nếu `OUTSIDER_TOKEN` set

**Interfaces:**
- Consumes: `PTT_B2B_PROJECT_OS=1` staging
- Produces: log UAT 18 case (pass/skip), không bật prod

- [ ] **Step 1: Extend smoke**

```bash
if [[ -n "${OUTSIDER_TOKEN:-}" && -n "${DENIED_LEAD_ID:-}" ]]; then
  code=$(curl -s -o /tmp/b2b404.json -w '%{http_code}' \
    -H "Authorization: Bearer $OUTSIDER_TOKEN" \
    "$API/api/v1/leads/$DENIED_LEAD_ID")
  test "$code" = "404"
  grep -q not_found /tmp/b2b404.json
  ! grep -E 'full_name|phone' /tmp/b2b404.json
fi
```

- [ ] **Step 2: Run on staging**

Run: `STAFF_TOKEN=… bash scripts/uat_b2b_project_os.sh`

Expected: B2B-01 pass; cases thiếu data = SKIP có lý do, không FAIL im lặng

- [ ] **Step 3: Commit script only**

```bash
git add scripts/smoke_b2b_project_os.sh
git commit -m "$(cat <<'EOF'
test(b2b): extend smoke for outsider 404 leak check

EOF
)"
```

**Gate:** không bắt đầu Task 3 trên prod cho đến khi staging UAT B2B-01…07 xanh.

---

### Task 3: SSE alert stream (W1 / trụ 1)

**Files:**
- Create: `services/ptt-crm-api/src/b2b-projects/b2b-alert-stream.service.ts`
- Create: `services/ptt-crm-api/src/b2b-projects/b2b-alert-stream.util.ts`
- Create: `services/ptt-crm-api/src/b2b-projects/b2b-alert-stream.util.spec.ts`
- Modify: `services/ptt-crm-api/src/b2b-projects/b2b-alerts.controller.ts`
- Modify: `services/ops-web/src/components/crm/B2bHotAlarm.tsx` — EventSource, poll 15s chỉ fallback

**Interfaces:**
- Consumes: `planLeadArrivalAlerts`, `B2bLeadScopeService`
- Produces: `hashB2bAlertInbox(rows): string`; `GET /api/v1/b2b-lead-alerts/stream` `@Sse()`

- [ ] **Step 1: Write the failing test**

```ts
import { hashB2bAlertInbox } from './b2b-alert-stream.util';

it('changes hash when new hot alert arrives', () => {
  const a = hashB2bAlertInbox([{ id: '1', severity: 'hot' }]);
  const b = hashB2bAlertInbox([{ id: '1', severity: 'hot' }, { id: '2', severity: 'hot' }]);
  expect(a).not.toBe(b);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/ptt-crm-api && npx jest src/b2b-projects/b2b-alert-stream.util.spec.ts --no-coverage`

Expected: FAIL cannot find module

- [ ] **Step 3: Implement SSE**

Copy vòng `timer(0, 2000)` từ `sla-alert.service.ts` (2s, không 30s). Query inbox theo `staffId`. Chỉ emit khi hash đổi. Flag `PTT_B2B_SSE=0` → 404 stream, client giữ poll.

`B2bHotAlarm`: `new EventSource('/api/v1/b2b-lead-alerts/stream')` + cookie/token theo pattern CSKH; `onerror` → poll 15s.

- [ ] **Step 4: Run tests**

Run: `cd services/ptt-crm-api && npx jest src/b2b-projects/b2b-alert-stream.util.spec.ts --no-coverage`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(b2b): SSE stream for lead-arrival alerts

EOF
)"
```

---

### Task 4: Staff Web Push + FCM (W1 / trụ 1)

**Files:**
- Create: `docs/specs/2026-08-19-postgresql-ddl-b2b-staff-push.sql` — `crm_b2b_staff_push_subscriptions (staff_id, endpoint, p256dh, auth, fcm_token, created_at)`
- Modify: `services/ptt-crm-api/src/b2b-projects/b2b-staff-push.sender.ts`
- Create: `services/ptt-crm-api/src/b2b-projects/b2b-staff-push.sender.spec.ts`
- Modify: `services/ops-web/src/lib/b2b-hot-alarm.ts` — đăng ký push khi user bật chuông

**Interfaces:**
- Consumes: `web-push` (đã có `portal-push-sender.service.ts`), `fcmServerKey`
- Produces: `B2bStaffPushSender.send({ staffId, title, severity, leadId })` thật; payload `{ url: '/crm/leads/{id}' }`

- [ ] **Step 1: Write the failing test**

```ts
it('does not send when staff has no subscription', async () => {
  const sender = new B2bStaffPushSender(repoEmpty as never, config as never);
  await expect(sender.send({ staffId: 9, title: 'Hot', severity: 'hot', leadId: 1 })).resolves.toEqual({ sent: 0 });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/ptt-crm-api && npx jest src/b2b-projects/b2b-staff-push.sender.spec.ts --no-coverage`

Expected: FAIL (send still void / no return)

- [ ] **Step 3: Implement**

Reuse VAPID keys portal nếu cùng origin ops-web; nếu không, env `PTT_B2B_VAPID_PUBLIC/PRIVATE`. Không gửi nếu `canSeeB2bLead` fail (re-check trước send). Flag `PTT_B2B_PUSH=0` → no-op như v1.

- [ ] **Step 4: Run tests + commit**

```bash
git commit -m "$(cat <<'EOF'
feat(b2b): staff web-push and FCM for hot lead alerts

EOF
)"
```

---

### Task 5: Gọi = resolve alert (W1 / trụ 1 + 6)

**Files:**
- Modify: `services/ptt-crm-api/src/b2b-projects/b2b-alerts.repository.ts`
- Modify: `services/ptt-crm-api/src/leads/leads.controller.ts` — sau `startHumanCall` thành công
- Create: `services/ptt-crm-api/src/b2b-projects/b2b-alert-resolve.util.ts`
- Test: `services/ptt-crm-api/src/b2b-projects/b2b-alert-resolve.util.spec.ts`

**Interfaces:**
- Consumes: `POST /api/v1/leads/:id/calls`
- Produces: `shouldResolveArrivalAlert(kind: 'human' | 'ai'): boolean` → true cho `human`

- [ ] **Step 1: Failing test**

```ts
expect(shouldResolveArrivalAlert('human')).toBe(true);
expect(shouldResolveArrivalAlert('ai')).toBe(false);
```

- [ ] **Step 2–4:** Implement `markAlertsHandled(leadId, staffId, handledAt)`. Gọi từ `B2bCallsService.startHumanCall` sau insert session.

- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(b2b): resolve arrival alerts when staff starts a call

EOF
)"
```

---

### Task 6: Unmatched workbench GDKD (W1 / trụ 5)

**Files:**
- Modify: `services/ptt-crm-api/src/b2b-projects/b2b-projects.repository.ts` — `listUnmatched({ limit, since })`
- Modify: `services/ptt-crm-api/src/b2b-projects/b2b-projects.controller.ts` — `GET /api/v1/b2b-unmatched`
- Create: `services/ops-web/src/app/crm/b2b-unmatched/page.tsx`
- Create: `services/ops-web/src/lib/b2b-unmatched-api.ts`

**Interfaces:**
- Consumes: `crm_b2b_unmatched_ingress`
- Produces: list `{ id, channel, project_slug, external_key, created_at }` + `POST …/map` gắn form/oa vào dự án

- [ ] **Step 1:** Jest repository mock: unmatched row trả 1 dòng, visibility chỉ GDKD (`crm_b2b_projects.manage`).

- [ ] **Step 3:** UI bảng + nút “Gắn dự án”. Không hiện payload thô có PII trên list (chỉ key + channel).

- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(b2b): GDKD unmatched ingress workbench

EOF
)"
```

---

### Task 7: List B2B cột Dự án / AI / SLA / in_call (W1 / trụ 6)

**Files:**
- Modify: `services/ops-web/src/app/crm/b2b/leads/page.tsx`
- Modify: `services/ptt-crm-api/src/leads/leads.types.ts` — expose `assign_strategy`, `assign_confidence` trên `LeadV1` nếu chưa
- Modify: `services/ptt-crm-api/src/leads/lead-v1.mapper.ts`

**Interfaces:**
- Consumes: list `lead_flow_kind=b2b_prospect` + `b2b_list_scope`
- Produces: cột `project_code`, `ai_band`, `sla_state`, `in_call`

- [ ] **Step 1:** Vitest mapper: `in_call` true khi session `ringing|answered`.

- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(b2b): project, score, SLA, in-call columns on B2B list

EOF
)"
```

**W1 gate:** SSE hoặc poll fallback; push optional; unmatched mở được; list có 4 cột.

---

### Task 8: Stringee adapter (W2 / trụ 2)

**Files:**
- Create: `services/ptt-crm-api/src/b2b-projects/b2b-cpaas-stringee.adapter.ts`
- Create: `services/ptt-crm-api/src/b2b-projects/b2b-cpaas-stringee.adapter.spec.ts`
- Modify: `services/ptt-crm-api/src/b2b-projects/b2b-cpaas.adapter.ts` — `createB2bCpaasAdapter('stringee')`
- Modify: `services/ptt-crm-api/src/config/app-config.service.ts` — `b2bCpaas`, `stringeeApiKey` từ env, **không** hard-code secret

**Interfaces:**
- Consumes: `B2bCpaasAdapter.startCall`
- Produces: `providerCallId` Stringee; webhook `POST /api/v1/b2b-calls/webhooks/stringee` → `applyWebhook`

- [ ] **Step 1:**

```ts
it('maps stringee answered to session answered', () => {
  expect(mapStringeeEvent('answered')).toBe('answered');
});
```

- [ ] **Step 3:** HTTP client Stringee timeout 1500ms; lỗi → `B2bCpaasDownError`. Flag `PTT_B2B_CPAAS=stringee` mới dùng; mặc định `mock`.

- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(b2b): Stringee CPaaS adapter behind flag

EOF
)"
```

---

### Task 9: WebRTC softphone widget (W2 / trụ 2)

**Files:**
- Create: `services/ops-web/src/components/crm/B2bSoftphone.tsx`
- Modify: `services/ops-web/src/components/crm/LeadContactActions.tsx` — ưu tiên widget, `tel:` nếu `cpaas_down`
- Create: `services/ptt-crm-api/src/b2b-projects/b2b-calls.controller.ts` — `POST /api/v1/leads/:id/calls/token` (JWT Stringee ngắn hạn)

**Interfaces:**
- Consumes: `startLeadB2bCall`, access token staff
- Produces: in-browser call; không barge

- [ ] **Step 1:** Vitest: 503 → `tel:` href giữ nguyên (đã có trong `LeadContactActions`).

- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(b2b): in-browser Stringee softphone with tel fallback

EOF
)"
```

---

### Task 10: Speed-to-lead dashboard (W2 / trụ 7 thắng)

**Files:**
- Create: `services/ptt-crm-api/src/b2b-projects/b2b-speed.util.ts`
- Create: `services/ptt-crm-api/src/b2b-projects/b2b-speed.util.spec.ts`
- Modify: `b2b-projects.controller.ts` — `GET /api/v1/b2b-speed?project_id=&days=7`
- Create: `services/ops-web/src/app/crm/b2b-speed/page.tsx`

**Interfaces:**
- Consumes: `created_at`, first `answered` / first human call, `business_hours_json`
- Produces: `{ p50_seconds, p95_seconds, hot_p95_seconds, n, by_staff[] }`

- [ ] **Step 1:**

```ts
it('computes p95 from sorted durations', () => {
  expect(percentile([10, 20, 30, 40, 100], 95)).toBe(100);
});
```

Chỉ đếm trong giờ làm (reuse `b2b-sla.util` hours). Cap `crm_b2b_projects.view`.

- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(b2b): speed-to-lead p50/p95 dashboard

EOF
)"
```

**W2 gate:** 1 dự án staging gọi Stringee thành công; dashboard có n>0.

---

### Task 11: Đổi owner tay + chọn split (W3 / trụ 4)

**Files:**
- Create: `services/ptt-crm-api/src/b2b-projects/b2b-manual-reassign.util.ts`
- Test: `b2b-manual-reassign.util.spec.ts`
- Modify: leads write / funnel release — body `{ split: 'keep_first_touch' | 'reset_closer' | 'no_split' }` bắt buộc khi flag ON + B2B

**Interfaces:**
- Consumes: `splitOnSlaHop`, `commission_json`
- Produces: 400 `split_required` nếu thiếu; hop `kind=manual`

- [ ] **Step 1:**

```ts
expect(() => assertManualSplitChoice(undefined)).toThrow(/split_required/);
```

- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(b2b): require commission split choice on manual reassign

EOF
)"
```

---

### Task 12: Commission ledger khi HĐ Active (W3 / trụ 4)

**Files:**
- Create: DDL `crm_b2b_commission_ledger (lead_id, contract_id, first_touch_staff_id, closer_staff_id, first_touch_amt, closer_amt, status, posted_at)`
- Create: `b2b-commission-ledger.service.ts` + `.spec.ts`
- Hook: khi contract status → `Active` (tìm event hiện có ở `agency` / contract module — không invent bảng HĐ mới)

**Interfaces:**
- Consumes: `crm_b2b_lead_commission_split`, doanh thu HĐ
- Produces: 1 ledger row / lead / contract; hop giữa 0

- [ ] **Step 1:** Jest: split 30/70 trên 10_000_000 → 3tr / 7tr; hop giữa không có dòng.

- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(b2b): post commission ledger when contract becomes Active

EOF
)"
```

---

### Task 13: GDKD command center + Playwright (W3 / trụ 6)

**Files:**
- Create: `services/ops-web/src/app/crm/b2b-gdkd/page.tsx` — unmatched 24h, hop≥2, SLA breach, CPaaS fail
- Create: `e2e/b2b-visibility.spec.ts`
- Modify: `b2b-projects.controller.ts` — `GET /api/v1/b2b-ops-summary`

**Interfaces:**
- Consumes: hops, unmatched, alerts, call_sessions error
- Produces: E2E: outsider GET 404; owner GET 200

- [ ] **Step 1:** Playwright:

```ts
test('outsider lead detail is 404', async ({ request }) => {
  const res = await request.get(`/api/v1/leads/${deniedId}`, { headers: { Authorization: `Bearer ${outsider}` } });
  expect(res.status()).toBe(404);
  expect(JSON.stringify(await res.json())).not.toContain('090');
});
```

- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(b2b): GDKD ops center and visibility Playwright

EOF
)"
```

---

### Task 14: Explainable lead score card (W4 / trụ 3)

**Files:**
- Modify: lead-score path hiện có (`lead-score.engine` / AI score) — trả `top_features[]`
- Modify: `services/ops-web/src/app/crm/leads/[id]/page.tsx` — block “Vì sao Hot”

**Interfaces:**
- Produces: `{ score, band, reasons: { feature, direction, weight }[] }` tối đa 5

- [ ] **Step 1:** Jest: score ≥70 ⇒ band `hot`; reasons không chứa raw phone.

- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(b2b): explainable AI score reasons on lead detail

EOF
)"
```

---

### Task 15: NBA trên lead B2B (W4 / trụ 3)

**Files:**
- Reuse `AiNbaService` / `lead-sla-care.util.ts` `resolveSlaCareNba`
- Create: `b2b-nba.util.ts` — ưu tiên: Gọi (nếu chưa call) → Ghi chú → Hẹn

**Interfaces:**
- Produces: `{ action: 'call' | 'note' | 'meet', label_vi, due_in_seconds }`

- [ ] **Step 1:** Chưa có call + trong cửa sổ SLA warn → `action === 'call'`.

- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(b2b): next-best-action card for first-touch window

EOF
)"
```

---

### Task 16: Routing A/B + win/loss feedback (W4 / trụ 3)

**Files:**
- Create: `crm_b2b_routing_ab (lead_id, bucket, strategy, won)`
- Create: `b2b-routing-ab.util.ts` — 50/50 `ai_analytics` vs force `hybrid` khi confidence 0.70–0.80
- Hook won/lost → update `won`; job weekly report

**Interfaces:**
- Produces: `GET /api/v1/b2b-routing-ab?days=30` `{ ai_win_rate, hybrid_win_rate, n }`

- [ ] **Step 1:** `assignAbBucket(leadId)` ổn định (hash leadId).

- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(b2b): routing A/B and win-rate feedback loop

EOF
)"
```

---

### Task 17: Zalo OA conversation inbox (W5 / trụ 8 thắng)

**Files:**
- Create: `docs/specs/2026-08-19-postgresql-ddl-b2b-conversations.sql` — `crm_b2b_conversation_threads`, `messages`
- Modify: webhook Zalo — persist inbound/outbound, match `oa_id` + user id → lead trong dự án
- Create: `services/ops-web/src/app/crm/b2b-inbox/thread/[leadId]/page.tsx`

**Interfaces:**
- Consumes: visibility C (không leak thread ngoài dự án)
- Produces: list message; gửi OA (nếu token vault có)

- [ ] **Step 1:** Jest: slug mismatch → không gắn thread.

- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(b2b): Zalo OA two-way thread on lead

EOF
)"
```

---

### Task 18: Project manager role (W5 / trụ 9 thắng)

**Files:**
- Modify: `crm_b2b_project_staff` — cột `role: 'sales' | 'project_manager'`
- Modify: `b2b-visibility.util.ts` — PM thấy mọi lead **trong dự án đó**, không phải Director toàn hệ
- Test: `b2b-visibility.util.spec.ts` — PM thấy teammate; sales không

**Interfaces:**
- Consumes: `B2bProjectMembership.role`
- Produces: `canSeeB2bLead` true nếu `role === 'project_manager'` && cùng `projectId`

- [ ] **Step 1:**

```ts
it('project manager sees teammate on same project only', () => {
  const pm = { ...memberOn, /* memberships include role */ };
  expect(canSeeB2bLead(pm, { flowKind: 'b2b_prospect', ownerId: 99, projectId: 'p1' }, [{ projectId: 'p1', assignEnabled: true, role: 'project_manager' }])).toBe(true);
  expect(canSeeB2bLead(pm, { flowKind: 'b2b_prospect', ownerId: 99, projectId: 'p2' }, [{ projectId: 'p1', assignEnabled: true, role: 'project_manager' }])).toBe(false);
});
```

Cập nhật `B2bProjectMembership` thêm `role?: 'sales' | 'project_manager'`. Sales giữ rule cũ.

- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(b2b): in-project manager visibility role

EOF
)"
```

---

### Task 19: Ads CAPI closed-loop (W5 / trụ 10 thắng)

**Files:**
- Create: `b2b-ads-capi.service.ts` + `.spec.ts`
- DDL: `crm_b2b_ads_capi_log`
- Hook: lead won + `campaign_id` → Meta CAPI `Purchase` / Google Enhanced; flag `PTT_B2B_ADS_CAPI=0`

**Interfaces:**
- Produces: hash PII (phone SHA256); không gửi tên thô nếu policy cấm
- Timeout 2s; fail → log, không rollback won

- [ ] **Step 1:** Jest: không gọi HTTP khi flag off; khi on, body có `hashed_phone`.

- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(b2b): opt-in Meta/Google conversion upload on won

EOF
)"
```

---

### Task 20: DNC + PDPA call consent (W5 / trụ 6)

**Files:**
- Create: `crm_b2b_dnc (phone_norm, reason, created_at)`
- Create: `b2b-dnc.util.ts` + `.spec.ts`
- Modify: `B2bCallsService` + AI call — từ chối nếu DNC hoặc ngoài giờ
- Softphone: checkbox “KH đồng ý ghi âm” trước connect (luật VN)

**Interfaces:**
- Produces: 403 `dnc_blocked`; AI `shouldStartAiCall` false nếu DNC

- [ ] **Step 1:**

```ts
expect(isDncBlocked('0900000000', ['0900000000'])).toBe(true);
```

- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(b2b): DNC list and call-consent gate

EOF
)"
```

---

## Spec coverage (self-review)

| Spec trụ | Task |
|----------|------|
| 1 Realtime SSE + push | 3, 4, 5 |
| 2 CPaaS Stringee + widget | 8, 9 |
| 3 Intelligence | 14, 15, 16 |
| 4 Commission | 11, 12 |
| 5 Omnichannel unmatched (+ ads) | 6, 19 |
| 6 Quality / active staff / E2E / DNC | 1, 2, 7, 13, 20 |
| 7 Speed-to-lead | 10 |
| 8 Zalo inbox | 17 |
| 9 Project manager | 18 |
| 10 Ads CAPI | 19 |
| W0 flag/UAT | 1, 2 |

Không placeholder: mỗi task có file, test, commit message. Vendor secret chỉ qua env.

---

## Thứ tự ship / rollback

1. W0 staging ON → nếu đỏ, giữ prod OFF  
2. W1 prod ON + SSE/push — rollback: `PTT_B2B_SSE=0` `PTT_B2B_PUSH=0` (poll 15s cũ)  
3. W2 CPaaS một dự án — rollback: `PTT_B2B_CPAAS=mock`  
4. W3–W5 feature-flag từng trụ  

Deploy: `scripts/deploy_b2b_lead_project_os_w{N}_vps.sh` (tạo khi bắt đầu sóng, copy P6 + `NODE_OPTIONS=2048`).
