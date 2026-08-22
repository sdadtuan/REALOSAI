# Checklist — Apple + Google Developer (Org PTT)

> **Owner:** DevOps / Legal · **RNOS:** RNOS-M3 Phase 0 · **App:** PTT Portal (`vn.pttads.portal`)  
> **Mục tiêu:** Tài khoản org sẵn sàng trước Phase 2 (TestFlight / Play Internal)

---

## 1. Thông tin pháp nhân (Legal cung cấp)

| Field | Apple | Google Play |
|-------|-------|-------------|
| Legal entity name | Công ty ___ PTT ___ | Giống Apple |
| Mã số thuế / ĐKKD | | |
| Địa chỉ đăng ký | | |
| Website chính thức | `https://pttads.vn` | |
| Email liên hệ công khai | `support@pttads.vn` (draft) | |
| D-U-N-S (Apple bắt buộc org) | ☐ Đã có · ☐ Đang xin | N/A |
| Tài khoản ngân hàng / billing | ☐ | ☐ |

**Legal sign-off documents on file:** ☐ Giấy ĐKKD · ☐ Ủy quyền ký · ☐ Chính sách bảo mật URL

---

## 2. Apple Developer Program (Organization)

| # | Task | Owner | Status | Notes |
|---|------|-------|--------|-------|
| A1 | Xác nhận entity **Organization** (không Individual) | Legal | ☐ | Cần D-U-N-S khớp tên công ty |
| A2 | Enroll [developer.apple.com/programs/enroll](https://developer.apple.com/programs/enroll/) | DevOps | ☐ | $99 USD / năm |
| A3 | Verify domain / email org | DevOps | ☐ | |
| A4 | Accept Program License Agreement | Legal | ☐ | Lưu PDF signed |
| A5 | Tạo App ID `vn.pttads.portal` | DevOps | ☐ | Capabilities: Push Notifications |
| A6 | APNs Auth Key (.p8) | DevOps | ☐ | → VPS `PTT_APNS_KEY_ID`, `PTT_APNS_TEAM_ID` |
| A7 | App Store Connect app record | DevOps | ☐ | Bundle ID khớp Capacitor |
| A8 | TestFlight internal group | DevOps | ☐ | Phase 2 |
| A9 | Export Compliance / encryption questionnaire | Legal | ☐ | Thường “Uses only standard encryption” |

**Apple Team ID:** _______________  
**App Store Connect App ID:** _______________  
**APNs Key ID:** _______________

---

## 3. Google Play Console (Organization)

| # | Task | Owner | Status | Notes |
|---|------|-------|--------|-------|
| G1 | Tạo Play Console org account | DevOps | ☐ | $25 USD một lần |
| G2 | Verify developer identity (org) | Legal | ☐ | Giấy tờ + video nếu yêu cầu |
| G3 | Accept Play Developer Distribution Agreement | Legal | ☐ | |
| G4 | Tạo app `vn.pttads.portal` | DevOps | ☐ | |
| G5 | Firebase project + `google-services.json` | DevOps | ☐ | → FCM `PTT_FCM_SERVER_KEY` |
| G6 | Play App Signing enroll | DevOps | ☐ | Google-managed signing khuyến nghị |
| G7 | Internal testing track | DevOps | ☐ | Phase 2 pilot |
| G8 | Data safety form draft | Legal + AM | ☐ | Link privacy policy |
| G9 | Target audience / content rating | Legal + AM | ☐ | Business app — không trẻ em |

**Firebase project ID:** _______________  
**Play Console app link:** _______________

---

## 4. Secrets & VPS mapping (DevOps — không commit)

| Secret | Env var VPS | Stored in |
|--------|-------------|-----------|
| FCM server key | `PTT_FCM_SERVER_KEY` | `/var/www/ptt/.env` |
| APNs .p8 key path | `PTT_APNS_KEY_PATH` | Secure vault / VPS restricted |
| APNs Key ID | `PTT_APNS_KEY_ID` | `.env` |
| Apple Team ID | `PTT_APNS_TEAM_ID` | `.env` |

---

## 5. RACI

| Activity | DevOps | Legal | AM | Tech lead |
|----------|--------|-------|-----|-----------|
| Enroll accounts | R | C | I | A |
| Contract / entity docs | C | R | I | I |
| App metadata content | C | C | R | I |
| Push credentials | R | I | I | A |

R = Responsible · A = Accountable · C = Consulted · I = Informed

---

## 6. Phase 0 exit criteria (accounts)

| Criterion | OK |
|-----------|-----|
| Apple Developer org **active** (paid + agreement) | ☐ |
| Google Play org **active** | ☐ |
| App IDs created both stores | ☐ |
| APNs key + Firebase project **created** (secrets in vault) | ☐ |
| Legal archived enrollment confirmations | ☐ |

**DevOps sign-off:** ___________________ · **Date:** ___________  
**Legal sign-off:** ___________________ · **Date:** ___________

---

## 7. Timeline mẫu (2 tuần Phase 0)

| Tuần | Apple | Google |
|------|-------|--------|
| W1 D1–D3 | Legal chuẩn bị D-U-N-S + giấy tờ | Play org registration |
| W1 D4–D5 | Submit Apple enroll | Identity verification |
| W2 D1–D3 | Chờ Apple approve (3–7 ngày) | Firebase + app create |
| W2 D4–D5 | App ID + APNs key | Internal track ready |

> **Risk:** Apple org approval có thể **>2 tuần** — bắt đầu W1 Day 1; Phase 1 Build có thể song song nếu accounts pending nhưng **không** vào Phase 2 store prep.
