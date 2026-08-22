# RNOS-MOB-P2 — Mobile polish cutover (sau M1/M2 ổn định)

> **Phụ thuộc:** M1 (`rs.pttads.vn`) + M2 (`portal.pttads.vn`) đã cutover · `/sw.js` live  
> **Script VPS:** `scripts/mob_p2_polish_staging_cutover.sh` · **SSH:** `scripts/mob_p2_polish_staging_cutover_vps.sh`  
> **Gate:** `scripts/rnos_mob_p2_polish_gate.sh`

---

## Scope P2

| Hạng mục | RNOS | Mô tả |
|----------|------|--------|
| AI bottom sheet | RNOS-41.2 | Tab AI @ mobile → sheet 85vh, giữ tab bar |
| Pull refresh | MOB-UC-002 P2 | Kéo xuống làm mới `/crm/leads` @ ≤768px |
| Swipe approve | M2 P2 | Vuốt creative card → mở duyệt/từ chối |

**Không P2:** M3 Capacitor · MOB-UC-010 deep link (defer M3).

---

## 1. Pre-flight

```bash
cd /path/to/RNOSAI
bash scripts/staging_mob_p2_polish_kickoff.sh   # artifact + typecheck
RUN_E2E=1 bash scripts/rnos_mob_p2_polish_gate.sh   # optional full M1+M2 E2E
```

Trên prod/staging verify M1/M2:

```bash
curl -sf https://rs.pttads.vn/sw.js | grep ptt-ops-pwa-v1
curl -sf https://portal.pttads.vn/sw.js | grep ptt-portal-pwa-v1
```

---

## 2. Cutover từ laptop

```bash
LOCAL_SYNC=1 APPLY=0 ./scripts/mob_p2_polish_staging_cutover_vps.sh
LOCAL_SYNC=1 APPLY=1 ./scripts/mob_p2_polish_staging_cutover_vps.sh
```

Chuỗi đầy đủ (M2 → M1 → P2):

```bash
LOCAL_SYNC=1 APPLY=1 ./scripts/m1_m2_mobile_parallel_cutover_vps.sh
LOCAL_SYNC=1 APPLY=1 ./scripts/mob_p2_polish_staging_cutover_vps.sh
```

---

## 3. Cutover trên VPS

```bash
cd /var/www/ptt
git pull   # hoặc rsync từ laptop
APPLY=0 ./scripts/mob_p2_polish_staging_cutover.sh
APPLY=1 ./scripts/mob_p2_polish_staging_cutover.sh
sudo systemctl restart ptt-ops-web ptt-portal-web   # nếu cần
```

---

## 4. Smoke sau P2

**CSKH (`rs.pttads.vn`):**
1. `/crm/leads` @ mobile — kéo xuống → «Thả để làm mới»
2. Lead detail → tab **AI** → bottom sheet Copilot (không full-page tab)

**Approver (`portal.pttads.vn`):**
1. `/creatives` @ mobile — vuốt trái card → xác nhận duyệt

---

## 5. Rollback

Rebuild bản trước P2 (git checkout) + §7.1 ops guide — không đổi env PWA.

---

## Liên quan

- [`m2-portal-pwa-staging-cutover-checklist.md`](./m2-portal-pwa-staging-cutover-checklist.md)
- [`m1-pwa-prod-cutover-checklist.md`](./m1-pwa-prod-cutover-checklist.md)
- [`2026-08-01-rnosai-mobile-strategy-spec.md`](../specs/2026-08-01-rnosai-mobile-strategy-spec.md) §8.1.5 P2
