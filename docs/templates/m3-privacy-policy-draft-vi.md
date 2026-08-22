# Chính sách quyền riêng tư — PTT Portal (Mobile App) — BẢN NHÁP

> **Owner:** Legal + AM · **Status:** Draft v0.1 — Phase 0 M3 · **Ngày:** 2026-08-01  
> **URL publish (target):** `https://portal.pttads.vn/privacy` hoặc `https://pttads.vn/privacy/portal-app`  
> **App:** PTT Portal · **Bundle:** `vn.pttads.portal` · **Platform:** iOS, Android (Capacitor WebView)

---

**Lưu ý Legal:** Đây là bản nháp kỹ thuật cho store listing. Legal phải rà soát tuân thủ NĐ 13/2023/NĐ-CP (VN) và chính sách Apple/Google trước publish.

---

## 1. Giới thiệu

Công ty **[Tên pháp nhân PTT — điền Legal]** (“PTT”, “chúng tôi”) vận hành ứng dụng **PTT Portal** dành cho khách hàng doanh nghiệp (client approver/viewer) xem hiệu suất chiến dịch, duyệt creative và email marketing.

Chính sách này mô tả dữ liệu chúng tôi thu thập, mục đích sử dụng và quyền của bạn.

**Liên hệ:** privacy@pttads.vn · **[Địa chỉ công ty]**

---

## 2. Dữ liệu thu thập

| Loại dữ liệu | Ví dụ | Nguồn |
|--------------|-------|-------|
| Tài khoản | Email đăng nhập, vai trò (approver/viewer) | Bạn / AM PTT cấp |
| Thiết bị | Push notification token (FCM/APNs), platform iOS/Android | App khi bạn bật thông báo |
| Kỹ thuật | IP, user-agent, app version, crash logs | Tự động khi dùng app |
| Nghiệp vụ | Quyết định duyệt creative/email, timestamp | Hành động trong app |
| **Không** thu | Danh bạ điện thoại, vị trí GPS liên tục, nội dung tin nhắn cá nhân | — |

Ứng dụng load nội dung từ `https://portal.pttads.vn` trong WebView bảo mật HTTPS.

---

## 3. Mục đích sử dụng

- Xác thực và duy trì phiên đăng nhập
- Gửi thông báo “cần duyệt” creative / email campaign
- Hiển thị dashboard hiệu suất theo hợp đồng agency
- Cải thiện độ ổn định (crash analytics) và hỗ trợ kỹ thuật
- Tuân thủ nghĩa vụ pháp lý và audit nội bộ

Chúng tôi **không** bán dữ liệu cá nhân cho bên thứ ba.

---

## 4. Chia sẻ dữ liệu

| Bên nhận | Mục đích |
|----------|----------|
| Firebase Cloud Messaging / Apple Push Notification service | Gửi push notification |
| [Sentry / monitoring — nếu dùng] | Crash reporting |
| Nhà cung cấp hạ tầng (VPS, cloud) | Hosting theo hợp đồng DPA |

Dữ liệu campaign thuộc tenant client — phân tách theo `client_id` trên hệ thống PTT.

---

## 5. Lưu trữ & bảo mật

- Dữ liệu lưu tại **[region VPS — VD: Việt Nam / Singapore — Legal xác nhận]**
- Mã hóa truyền tải TLS 1.2+
- JWT phiên đăng nhập có thời hạn; logout khi mất thiết bị — liên hệ AM
- Push payload **không** chứa PII đầy đủ (theo spec nội bộ §11.3 mobile strategy)

---

## 6. Thời gian lưu

| Dữ liệu | Thời gian |
|---------|-----------|
| Log audit duyệt | Theo hợp đồng client (thường 12–24 tháng) |
| Push device token | Đến khi bạn tắt push hoặc gỡ app |
| Crash logs | 90 ngày (điều chỉnh theo tool) |

---

## 7. Quyền của bạn

Theo quy định hiện hành, bạn có thể:

- Yêu cầu truy cập / chỉnh sửa thông tin tài khoản qua AM PTT
- Tắt push notification trong Settings app hoặc OS
- Yêu cầu xóa device token (Settings → Tắt native push)
- Khiếu nại qua privacy@pttads.vn

---

## 8. Trẻ em

PTT Portal dành cho người dùng doanh nghiệp **≥18 tuổi** được cấp tài khoản bởi tổ chức khách hàng. Không hướng tới trẻ em.

---

## 9. Thay đổi chính sách

Chúng tôi có thể cập nhật chính sách; phiên bản mới đăng tại URL trên với ngày hiệu lực.

---

## 10. Checklist publish (Phase 0)

| # | Task | Owner | OK |
|---|------|-------|-----|
| 1 | Legal review bản tiếng Việt | Legal | ☐ |
| 2 | Bản tiếng Anh (App Store) | Legal | ☐ |
| 3 | Publish URL live HTTPS | DevOps | ☐ |
| 4 | Link trong App Store Connect + Play Console | AM | ☐ |
| 5 | Link trong app Settings (footer) | Tech (Phase 1) | ☐ |

**Legal sign-off:** ___________________ · **Date:** ___________

---

## Phụ lục — Privacy URL cho store

```
Privacy Policy URL: https://portal.pttads.vn/privacy
Support URL: https://pttads.vn/support
Marketing URL: https://pttads.vn
```

*(DevOps tạo route `/privacy` trên portal-web hoặc static page — backlog Phase 1 nếu chưa có)*
