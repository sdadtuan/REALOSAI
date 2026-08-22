# Hướng dẫn — Mobile (PWA & App)

> **Module:** MOD-MOB  
> **Đối tượng:** Khách hàng portal (chính), AM review nhanh  
> **URL:** https://portal.pttads.vn (PWA) · App native Capacitor

---

## 1. Giới thiệu

Mobile layer bọc **portal PWA** — installable trên iOS/Android, push notification, deep link mở thẳng màn duyệt. Staff ops-web **desktop-first** — mobile chỉ khuyến nghị xem KPI portal.

**Flags:** `NEXT_PUBLIC_PWA_ENABLED=1`, `PTT_MOBILE_NATIVE_PUSH_ENABLED=1`

---

## 2. Cài đặt PWA (khách hàng)

### iOS (Safari)

1. Mở https://portal.pttads.vn — đăng nhập
2. Bấm **Share** → **Add to Home Screen**
3. Icon PTT xuất hiện màn hình chính
4. Mở từ icon — fullscreen như app

### Android (Chrome)

1. Mở portal — đăng nhập
2. Banner **Install app** hoặc menu → **Install**
3. Confirm — app cài từ Chrome

---

## 3. Web Push (trình duyệt)

1. `/settings` → **Notifications**
2. Bật **Push notifications**
3. Browser hỏi permission → **Allow**
4. Nhận thông báo: approval mới, campaign sent, …

**Service worker** cache shell cơ bản — offline chỉ UI shell, data cần mạng.

---

## 4. Native App (Capacitor)

**Package:** `services/mobile-shell/`

1. PTT cung cấp file **.ipa** (iOS) / **.apk** (Android) hoặc TestFlight
2. Cài app → mở → login portal credentials
3. **Native push** (FCM/APNs) — không phụ thuộc browser tab

### Bật native push

Env: `PTT_MOBILE_NATIVE_PUSH_ENABLED=1`  
Khách bật push trong app Settings tương tự portal web.

---

## 5. Deep links

Scheme: `pttads://`

| Link | Mở |
|------|-----|
| `pttads://approve/{id}` | Màn duyệt item `{id}` |
| `pttads://campaign/{id}` | Chi tiết campaign email |
| `pttads://dashboard` | Dashboard |

Push notification tap → deep link tương ứng.

---

## 6. Luồng approver trên mobile

1. Nhận push "Creative chờ duyệt"
2. Tap notification → mở `/creatives` hoặc deep link
3. Preview → **Approve** / **Reject** + comment
4. Xong trong < 2 phút — không cần laptop

**Approver role bắt buộc** — viewer chỉ xem KPI.

---

## 7. AM review KPI mobile

1. Mở PWA dashboard
2. Widget Meta/SEO T-1 — đủ cho check nhanh buổi sáng
3. Thao tác phức tạp (export, filter sâu) → dùng desktop

---

## 8. Bảo mật mobile

- Session JWT giống web — timeout theo policy
- Không lưu MK plain text trên device
- Logout tại Settings khi đổi thiết bị
- Face ID/Touch ID — theo OS (không trong app PTT)

---

## 9. Lỗi thường gặp

| Vấn đề | Xử lý |
|--------|-------|
| Không nhận push | Settings bật; iOS Settings → Notifications → PTT |
| PWA không install | Dùng Safari/Chrome; HTTPS bắt buộc |
| Deep link 404 | Update app/PWA phiên bản mới |
| Native app crash | Reinstall; báo IT version OS |

---

## 10. Tài liệu tham chiếu

- Mobile strategy: [`docs/specs/2026-08-01-rnosai-mobile-strategy-spec.md`](../specs/2026-08-01-rnosai-mobile-strategy-spec.md)
- Portal: [14-client-portal.md](./14-client-portal.md)
