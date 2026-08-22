# RNOS-M3 Phase 0 — Discovery & ADR (2 tuần)

> **RNOS:** RNOS-M3 · **Horizon:** 10 ngày làm việc (2 tuần lịch) · **Output:** Go/no-go Phase 1 Build  
> **Spec:** [`2026-08-01-rnosai-mobile-strategy-spec.md`](../specs/2026-08-01-rnosai-mobile-strategy-spec.md) §6.4 · **ADR:** [`adr-mob-04-capacitor-before-rn.md`](../specs/adr-mob-04-capacitor-before-rn.md)

---

## 1. Mục tiêu Phase 0

| # | Deliverable | Owner | Artifact |
|---|-------------|-------|----------|
| D1 | **Báo cáo M2 KPI** (iOS vs Android push, approve time, PWA install rate) | **Product** | [`m3-m2-kpi-review-report.md`](../templates/m3-m2-kpi-review-report.md) |
| D2 | **Chốt Option A + Accept ADR-MOB-04** | **Tech lead** | [`adr-mob-04-capacitor-before-rn.md`](../specs/adr-mob-04-capacitor-before-rn.md) |
| D3 | **Store account Apple + Google (org PTT)** | **DevOps / Legal** | [`m3-store-accounts-checklist.md`](../templates/m3-store-accounts-checklist.md) |
| D4 | **Privacy policy + App Store metadata draft** | **Legal + AM** | [`m3-privacy-policy-draft-vi.md`](../templates/m3-privacy-policy-draft-vi.md) · [`m3-app-store-metadata-draft.md`](../templates/m3-app-store-metadata-draft.md) |

**Gate Phase 0:**

```bash
bash scripts/staging_m3_phase0_kickoff.sh
# → .local-dev/rnos-m3-phase0-gate-report.json
# → .local-dev/m3-phase0-signoff.json (template nếu chưa ký)
```

---

## 2. Preconditions (trước Day 1)

| # | Gate cứng §7.7 | OK |
|---|----------------|-----|
| P1 | M2 prod: `/sw.js`, push API, ≥3 approver pilot | ☐ |
| P2 | M2 soak ≥90 ngày, không P1 mobile portal | ☐ |
| P3 | Product có roster pilot AM (email + platform) | ☐ |

Nếu P1/P2 chưa đạt → **defer Phase 0**; vẫn có thể chuẩn bị Legal/DevOps accounts song song.

---

## 3. Lịch 2 tuần (chi tiết)

### Tuần 1 — Discovery & số liệu

| Day | Product | Tech lead | DevOps / Legal | Legal + AM |
|-----|---------|-----------|----------------|------------|
| **D1** | Kickoff Phase 0 · xác nhận cohort pilot | Review trigger T1–T3 §7.7 | Bắt đầu Apple D-U-N-S / giấy tờ org | Chốt entity name + support email |
| **D2** | Chạy `m3_m2_kpi_collect.sh` trên prod/staging PG | Review snapshot JSON | Submit Apple Developer enroll (org) | Review privacy draft v0.1 |
| **D3** | Pilot push test matrix iOS (3 user × 3 tests) | Hỗ trợ debug push nếu fail | Submit Google Play org registration | Metadata description VI draft |
| **D4** | Pilot push test matrix Android | Map `X-PTT-Client` gaps nếu cần | Firebase project skeleton | Metadata EN draft |
| **D5** | Điền §3–§5 báo cáo KPI (push, approve, install) | Draft ADR accept / reject notes | Track Apple approval status | Store checklist W1 sign |

**Tuần 1 exit:** Snapshot JSON + push test raw sheet + store enroll submitted

### Tuần 2 — Quyết định & store readiness

| Day | Product | Tech lead | DevOps / Legal | Legal + AM |
|-----|---------|-----------|----------------|------------|
| **D6** | Qualitative AM feedback §7 | Review KPI vs trigger ≥2/3 | Apple App ID + APNs key (nếu approved) | Privacy Legal review round 2 |
| **D7** | Hoàn thiện Executive summary §1 | **Accept ADR-MOB-04** (sign) | `google-services.json` dev app | Metadata keywords + categories |
| **D8** | Product sign-off báo cáo KPI | Publish `.local-dev/m3-phase0-signoff.json` | Play app record + internal track | Review notes Apple draft |
| **D9** | Trình ban lãnh đao go/no-go Phase 1 | Phase 1 backlog confirm (§7.7 Phase 1) | Secrets vault mapping (FCM/APNs) | Data safety Google draft |
| **D10** | **Gate Phase 0** meeting | Gate script PASS + sign-off | DevOps + Legal checklist ✅ | AM metadata sign-off |

**Tuần 2 exit:** ADR Accepted · 4 deliverables signed · Phase 1 kickoff scheduled

---

## 4. Hướng dẫn từng deliverable

### D1 — Báo cáo M2 KPI (Product)

**Bước:**

1. Export roster pilot từ AM (≥3 approver, ghi iOS/Android).
2. Thu thập số liệu tự động:

```bash
cd RNOSAI
export DATABASE_URL=postgresql://ptt:***@127.0.0.1:5433/rnosaidb   # prod read-only
export KPI_DAYS=30
bash scripts/m3_m2_kpi_collect.sh
```

3. Chạy SQL đầy đủ (optional):

```bash
psql "$DATABASE_URL" -f docs/specs/queries-m3-m2-kpi-review.sql
```

4. Pilot push test iOS/Android (§3.2 template) — **manual**, 3×3 matrix.
5. PWA install rate — đếm từ roster AM (§5 template).
6. Hoàn thiện [`m3-m2-kpi-review-report.md`](../templates/m3-m2-kpi-review-report.md) → lưu `docs/reports/m3-m2-kpi-review-YYYY-MM-DD.md` (Product tạo khi sign-off).

**Tiêu chí hoàn thành:**

- [ ] §1 Executive summary có khuyến nghị rõ
- [ ] iOS vs Android push delivery % có số
- [ ] Median approve time có số (hoặc N/A + lý do)
- [ ] PWA install rate có số
- [ ] Trigger kickoff đánh giá ≥2/3 hoặc ghi executive override
- [ ] Product sign-off + Tech lead sign-off

---

### D2 — ADR-MOB-04 (Tech lead)

**Bước:**

1. Đọc báo cáo D1 + [`adr-mob-04-capacitor-before-rn.md`](../specs/adr-mob-04-capacitor-before-rn.md).
2. Xác nhận Option A vs pivot criteria § Consequences.
3. Ký Acceptance checklist trong ADR.
4. Cập nhật status ADR → **Accepted** + ngày.
5. Ghi sign-off JSON:

```bash
# Sau khi ký — chỉnh .local-dev/m3-phase0-signoff.json
#   "adr_mob_04": "accepted"
#   "tech_lead": "Name", "date": "YYYY-MM-DD"
```

**Tiêu chí hoàn thành:**

- [ ] ADR status = Accepted
- [ ] Không blocker security JWT/WebView (hoặc ticket mitigated)
- [ ] Phase 1 Build owner assigned

---

### D3 — Store accounts (DevOps / Legal)

**Bước:** Làm theo [`m3-store-accounts-checklist.md`](../templates/m3-store-accounts-checklist.md) từng mục A1–G9.

**Tiêu chí Phase 0 (minimum):**

- [ ] Apple Developer org enrolled (paid) **hoặc** ticket pending + ETA ≤4 tuần
- [ ] Google Play org active
- [ ] App IDs `vn.pttads.portal` reserved both stores
- [ ] APNs key + Firebase project created; secrets **không** commit

**Tiêu chí Phase 2 (không block Phase 0 gate nếu Apple pending):**

- [ ] TestFlight internal group ready
- [ ] Play internal testing track ready

---

### D4 — Privacy + metadata (Legal + AM)

**Bước:**

1. Legal review [`m3-privacy-policy-draft-vi.md`](../templates/m3-privacy-policy-draft-vi.md) → bản EN nếu cần App Store.
2. AM hoàn thiện [`m3-app-store-metadata-draft.md`](../templates/m3-app-store-metadata-draft.md).
3. DevOps publish privacy URL (static hoặc route portal — có thể Phase 1 nếu chưa có `/privacy`).
4. AM xác nhận support@pttads.vn hoạt động.

**Tiêu chí hoàn thành Phase 0:**

- [ ] Privacy draft Legal signed (URL có thể staging)
- [ ] Metadata VI + EN approved
- [ ] Review notes + test account plan documented

---

## 5. Go / No-go Phase 1 Build

| Outcome | Điều kiện | Next step |
|---------|-----------|-----------|
| **GO** | ADR accepted · KPI report signed · ≥2/3 trigger · store enroll started | `bash scripts/staging_m3_capacitor_kickoff.sh` (Phase 1) |
| **CONDITIONAL GO** | ADR accepted · Apple pending · Google OK | Phase 1 code parallel; defer TestFlight to Phase 2 |
| **NO-GO** | <2/3 trigger · M2 soak fail | Extend M2 pilot 30 ngày; không build store binary |

---

## 6. Artifacts & paths

| Path | Mô tả |
|------|-------|
| `scripts/m3_m2_kpi_collect.sh` | Auto KPI snapshot |
| `scripts/rnos_m3_phase0_gate.sh` | Gate artifact + sign-off |
| `scripts/staging_m3_phase0_kickoff.sh` | KPI collect + gate |
| `docs/specs/queries-m3-m2-kpi-review.sql` | SQL KPI |
| `docs/specs/adr-mob-04-capacitor-before-rn.md` | ADR |
| `.local-dev/m3-m2-kpi-snapshot.json` | KPI output |
| `.local-dev/m3-phase0-signoff.json` | Sign-off record |
| `.local-dev/rnos-m3-phase0-gate-report.json` | Gate report |

---

## 7. RACI tóm tắt

| Deliverable | R | A | C | I |
|-------------|---|---|---|---|
| D1 KPI report | Product | Product | Tech · AM | DevOps |
| D2 ADR-MOB-04 | Tech lead | Tech lead | Product · DevOps | AM · Legal |
| D3 Store accounts | DevOps | DevOps | Legal | Product · Tech |
| D4 Privacy + metadata | Legal · AM | Legal | Product · DevOps | Tech |

---

## 8. Liên kết

| Doc | Nội dung |
|-----|----------|
| [`rnosai-vps-operations-guide.md`](./rnosai-vps-operations-guide.md) §7.7 | M3 tổng quan · trigger · Phase 1–4 |
| [`m2-portal-pwa-cutover-checklist.md`](./m2-portal-pwa-cutover-checklist.md) | Prerequisite M2 |
| [`services/mobile-shell/README.md`](../../services/mobile-shell/README.md) | Capacitor scaffold |

---

**Phase 0 completion record**

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Product | | | |
| Tech lead | | | |
| DevOps | | | |
| Legal | | | |
| AM | | | |
