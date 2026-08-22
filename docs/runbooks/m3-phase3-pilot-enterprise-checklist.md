# RNOS-M3 Phase 3 — Pilot enterprise (4 tuần)

> **Prerequisite:** Phase 2 sign-off · TestFlight + Play Internal live · FCM/APNs on VPS  
> **Gate:** `bash scripts/staging_m3_phase3_kickoff.sh` · Report: `.local-dev/rnos-m3-phase3-gate-report.json`

---

## Mục tiêu

| Cohort | Kỳ vọng |
|--------|---------|
| **3–5 approver iOS** | Cài từ TestFlight internal |
| **3–5 approver Android** | Cài từ Play Internal Testing |
| **1 khách enterprise** | Có hợp đồng store · creative + email approval thật |
| **AM champion** | Single point of contact · onboard cohort · UAT sign-off |

---

## Timeline 4 tuần

| Tuần | Focus | Deliverable |
|------|-------|-------------|
| **W1** | Onboard cohort | Cohort JSON · invites sent · scenario **1** pass all |
| **W2** | Push native | DDL + FCM verified · scenarios **2–3** |
| **W3** | Email + universal links | AASA + assetlinks prod · scenarios **4–5** |
| **W4** | Force update + KPI | Scenario **6** · KPI snapshot · Phase 3 sign-off |

---

## Pre-flight

| # | Item | Owner | OK |
|---|------|-------|-----|
| 1 | `.local-dev/m3-phase2-signoff.json` GO | DevOps | ☐ |
| 2 | TestFlight build processed · internal group | DevOps | ☐ |
| 3 | Play Internal release promoted | DevOps | ☐ |
| 4 | `portal_native_device_tokens` DDL on prod PG | DevOps | ☐ |
| 5 | VPS: `PTT_MOBILE_NATIVE_PUSH_ENABLED=1` | DevOps | ☐ |
| 6 | VPS: `PTT_FCM_SERVER_KEY` + APNs | DevOps | ☐ |
| 7 | Universal links: TEAMID + SHA256 prod | DevOps | ☐ |
| 8 | Copy cohort → `deploy/m3-pilot-cohort.json` | AM | ☐ |
| 9 | Enterprise contract on file | Legal | ☐ |
| 10 | AM champion assigned | AM lead | ☐ |

```bash
# Validate cohort file
bash scripts/m3_pilot_cohort_validate.sh deploy/m3-pilot-cohort.json

# Phase 3 gate (artifacts + UAT probes)
bash scripts/staging_m3_phase3_kickoff.sh
```

---

## Cohort setup

**Template:** [`deploy/m3-pilot-cohort.example.json`](../../deploy/m3-pilot-cohort.example.json)

1. AM điền `enterprise_client`, `members[]` (UUID portal thật, email TestFlight/Play).
2. DevOps add testers:
   - **TestFlight:** App Store Connect → Internal Testing → add emails
   - **Play:** Internal testing → email list / Google Group
3. AM gửi hướng dẫn cài + login (không public signup).

**Không commit** `deploy/m3-pilot-cohort.json` — thêm vào `.gitignore` nếu chưa có.

---

## UAT M3 v1 — 6 scenarios

> **Checklist:** [`m3-pilot-uat-v1-checklist.md`](../templates/m3-pilot-uat-v1-checklist.md)

| # | Scenario | Script / tool |
|---|----------|---------------|
| 1 | Cài store internal → login approver | Manual · AM walkthrough |
| 2 | Push native creative pending | `bash scripts/m3_pilot_seed_uat_fixtures.sh` + ops submit |
| 3 | Tap push → `/creatives?focus=` | `bash scripts/m3_pilot_uat_probes.sh` (deep link) |
| 4 | Duyệt email campaign | Manual `/email/approvals` |
| 5 | HTTPS email link mở app | Manual + AASA/assetlinks verify |
| 6 | Force update `min_version` | `bash scripts/m3_pilot_uat_probes.sh --force-update` |

### Automated probes

```bash
# Resolver + mobile/config API (no device required)
bash scripts/m3_pilot_uat_probes.sh

# Include force-update simulation headers
bash scripts/m3_pilot_uat_probes.sh --force-update

# Against staging API
M3_API_URL=https://portal-staging.pttads.vn bash scripts/m3_pilot_uat_probes.sh
```

Report: `.local-dev/m3-pilot-uat-probes-report.json`

### Seed UAT fixtures (creative pending)

```bash
# Requires PORTAL JWT or internal key + client_id
export M3_PILOT_CLIENT_ID=...
export PTT_CRM_INTERNAL_KEY=...
bash scripts/m3_pilot_seed_uat_fixtures.sh
```

---

## Push native drill (W2)

1. Approver: Settings → bật **Native push** → device token registered.
2. Verify DB: `SELECT * FROM portal_native_device_tokens WHERE portal_user_id = '...';`
3. Test push: Settings → **Gửi test native push** hoặc:
   ```bash
   # With approver JWT
   curl -X POST "$API/api/v1/mobile/push/test" -H "Authorization: Bearer $JWT"
   ```
4. Submit creative pending → confirm notification + `creative_id` in FCM payload.

---

## Universal links drill (W3)

**iOS verify:**

```bash
curl -s https://portal.pttads.vn/.well-known/apple-app-site-association | python3 -m json.tool
# TEAMID must match signing team · paths include /creatives*
```

**Android verify:**

```bash
curl -s https://portal.pttads.vn/.well-known/assetlinks.json
```

**Manual:** Email approver link `https://portal.pttads.vn/creatives?focus={uuid}` → tap on device → app opens.

---

## Force update drill (W4)

1. **Staging first:**
   ```bash
   PTT_MOBILE_MIN_VERSION=9.9.9 PTT_MOBILE_FORCE_UPDATE=1
   ```
2. Open app Settings → banner force update · push disabled.
3. Bump TestFlight/Play build to `9.9.9` (or lower min back to `1.0.0` after test).

**Probe:**

```bash
bash scripts/m3_pilot_uat_probes.sh --force-update
# Expect force_update: true for X-PTT-App-Version: 0.0.1
```

---

## KPI collection

```bash
# Prod PG (read-only) — pilot window
DATABASE_URL=postgresql://... KPI_DAYS=28 bash scripts/m3_pilot_kpi_collect.sh
```

Output: `.local-dev/m3-pilot-kpi-snapshot.json` · `.local-dev/m3-pilot-kpi-snapshot.md`

| KPI | Pilot target |
|-----|--------------|
| Push delivery native iOS | ≥85% |
| Push delivery native Android | ≥85% |
| Median time-to-approve mobile | ≤ M2 PWA −20% |
| Crash-free sessions | ≥99% |
| Deep link success | ≥95% |

---

## Sign-off Phase 3

```bash
cp docs/templates/m3-phase3-signoff-template.json .local-dev/m3-phase3-signoff.json
# Fill uat_m3_v1 + kpi + decision: "go"
```

| Criterion | Required |
|-----------|----------|
| All 6 UAT scenarios pass (both platforms or documented waiver) | Yes |
| KPI snapshot collected | Yes |
| No P0 crash / auth blocker open | Yes |
| AM + enterprise sponsor sign | Yes |

**GO** → Phase 4 GA (public listing · monitor · force-update policy)

---

## Rollback / pause

| Trigger | Action |
|---------|--------|
| Push delivery <50% week 2 | Debug FCM/APNs · pause cohort expand |
| Universal links fail >20% | Fix AASA/assetlinks · defer scenario 5 sign-off |
| Enterprise escalates blocker | AM champion triage · hotfix TestFlight |

---

## CI

Workflow: `.github/workflows/rnos-m3-phase3-pilot.yml` — gate artifacts + UAT probe unit tests.

---

## Liên kết

| Path | Nội dung |
|------|----------|
| [`m3-phase2-store-prep-checklist.md`](./m3-phase2-store-prep-checklist.md) | Prerequisite Phase 2 |
| [`m3-pilot-uat-v1-checklist.md`](../templates/m3-pilot-uat-v1-checklist.md) | UAT sign-off |
| [`m3-phase3-signoff-template.json`](../templates/m3-phase3-signoff-template.json) | Sign-off JSON |
| §7.7 [`rnosai-vps-operations-guide.md`](./rnosai-vps-operations-guide.md) | VPS ops M3 |

---

| Version | Date | Notes |
|---------|------|-------|
| 1.0 | 2026-08-01 | Phase 3 pilot enterprise runbook |
