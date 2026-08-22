# RNOS-M3 Phase 3 — UAT M3 v1 (Pilot enterprise)

> **Owner:** AM champion + DevOps · **Duration:** 4 tuần · **Cohort:** 3–5 iOS + 3–5 Android approver  
> **Prerequisite:** Phase 2 sign-off · TestFlight + Play Internal builds

---

## Enterprise pilot

| Field | Value |
|-------|-------|
| Khách enterprise | _________________________ |
| `client_id` | _________________________ |
| Hợp đồng store | ☐ On file (Legal) |
| AM champion | _________________________ |
| Pilot start | __________ |
| Pilot end | __________ |

---

## UAT M3 v1 — 6 scenarios

| # | Scenario | iOS | Android | Tester | Date | Pass |
|---|----------|-----|---------|--------|------|------|
| **1** | Cài app từ store internal → login approver | ☐ | ☐ | | | ☐ |
| **2** | Nhận push **native** khi creative pending | ☐ | ☐ | | | ☐ |
| **3** | Tap push → `/creatives` hoặc deep link đúng item | ☐ | ☐ | | | ☐ |
| **4** | Duyệt email campaign trong app | ☐ | ☐ | | | ☐ |
| **5** | Link email `https://portal.pttads.vn/...` mở app (universal link) | ☐ | ☐ | | | ☐ |
| **6** | Force update khi `min_version` tăng | ☐ | ☐ | | | ☐ |

**Gate tự động (DevOps):** `bash scripts/m3_pilot_uat_probes.sh` — deep link resolver + force-update API probe.

---

## Scenario steps (chi tiết)

### 1 — Install + login

1. Nhận invite TestFlight / Play Internal opt-in link từ AM.
2. Cài **PTT Portal** (`vn.pttads.portal`).
3. Mở app → WebView `portal.pttads.vn` → login approver enterprise.
4. Dashboard KPI hiển thị · Settings → native push card visible.

**Pass:** Login OK · không crash · `X-PTT-Client: capacitor-portal/1.0` trong access log (optional).

### 2 — Native push (creative pending)

1. AM/ops submit creative pending cho client pilot.
2. Approver đã bật native push (Settings).
3. Nhận notification trên lock screen (không chỉ web push browser).

**Pass:** Notification received ≤ 2 phút · title/body đúng.

### 3 — Tap push → creative focus

1. Tap notification từ scenario 2.
2. App mở `/creatives?focus={id}` · item highlighted.

**Alternate:** `pttads://approve/{uuid}` từ Notes/simctl/adb.

**Pass:** Đúng creative · có thể Approve/Reject.

### 4 — Email campaign approval

1. Navigate **Email approvals** (`/email/approvals`).
2. Mở pending campaign · preview · **Duyệt** hoặc **Từ chối**.

**Pass:** Status cập nhật · audit trail trong portal.

### 5 — Universal link từ email

1. Gửi email test tới approver có link:
   `https://portal.pttads.vn/creatives?focus={id}`  
   hoặc `/email/approvals` (theo campaign).
2. Tap link trên mobile **đã cài app**.

**Pass:** Mở **app** (không Safari standalone) · route đúng.

**iOS:** Associated Domains + `apple-app-site-association` live.  
**Android:** `assetlinks.json` + SHA256 fingerprint prod.

### 6 — Force update

1. DevOps tạm set VPS:
   ```bash
   PTT_MOBILE_MIN_VERSION=9.9.9
   PTT_MOBILE_FORCE_UPDATE=1
   ```
2. Approver mở app (build `0.1.0` < min) → Settings hiện force-update banner · push disabled.
3. Cài build mới từ TestFlight/Play → banner biến mất.

**Probe:** `bash scripts/m3_pilot_uat_probes.sh --force-update`

**Rollback env sau drill.**

---

## KPI pilot (4 tuần)

| KPI | Target | Actual | OK |
|-----|--------|--------|-----|
| Push delivery native iOS | ≥85% | | ☐ |
| Push delivery native Android | ≥85% | | ☐ |
| Median time-to-approve mobile | ≤ M2 PWA −20% | | ☐ |
| Crash-free sessions | ≥99% | | ☐ |
| Deep link success | ≥95% | | ☐ |
| Cohort install rate | ≥80% invited | | ☐ |

Collect: `bash scripts/m3_pilot_kpi_collect.sh`

---

## Sign-off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| AM champion | | | ☐ |
| Enterprise client sponsor | | | ☐ |
| DevOps | | | ☐ |
| Product / Tech lead | | | ☐ |

**Artifact:** `.local-dev/m3-phase3-signoff.json` (template: `docs/templates/m3-phase3-signoff-template.json`)

**GO** → Phase 4 GA (public listing)

---

## Liên kết

| Path | Nội dung |
|------|----------|
| [`m3-phase3-pilot-enterprise-checklist.md`](../runbooks/m3-phase3-pilot-enterprise-checklist.md) | Runbook 4 tuần |
| [`m3-pilot-cohort.example.json`](../../deploy/m3-pilot-cohort.example.json) | Cohort template |
| `scripts/m3_pilot_uat_probes.sh` | Automated probes |
| `scripts/staging_m3_phase3_kickoff.sh` | Phase 3 gate kickoff |
