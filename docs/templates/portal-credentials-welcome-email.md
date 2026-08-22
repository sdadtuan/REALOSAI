# Email template — Portal credentials welcome

Webhook source: `portal_credentials_welcome`

Env bật gửi:

```bash
PTT_PORTAL_EMAIL_NOTIFY=1
PTT_PORTAL_EMAIL_WEBHOOK_URL=https://your-email-gateway/send
PTT_PORTAL_PUBLIC_URL=https://portal.pttads.vn
```

## Subject

```
[PTT] Thông tin đăng nhập Client Portal — {clientName}
```

## Plain text body

```
Kính gửi Quý khách,

PTT đã tạo tài khoản Client Portal cho {clientName} ({clientCode}).

• URL đăng nhập: https://portal.pttads.vn/login
• Email: {email}
• Mật khẩu tạm: {password}
• Vai trò: {roleLabel}

Lưu ý bảo mật:
- Đổi mật khẩu sau lần đăng nhập đầu tiên tại https://portal.pttads.vn/settings
- Quên mật khẩu: https://portal.pttads.vn/forgot-password

Trân trọng,
PTT Account Team
```

## Webhook JSON payload

```json
{
  "source": "portal_credentials_welcome",
  "to": "owner@glowbeautyspa.vn",
  "subject": "[PTT] Thông tin đăng nhập Client Portal — Glow Beauty Spa",
  "body": "...plain text...",
  "html": "...html version...",
  "client_name": "Glow Beauty Spa",
  "client_code": "GLOW-SPA",
  "role": "approver",
  "login_url": "https://portal.pttads.vn/login"
}
```

## Ops-web flow

1. Agency → Client → tab **Portal users**
2. Nhập email chủ spa, chọn role **Approver** (nếu cần duyệt)
3. Bật **Gửi email thông tin đăng nhập theo template**
4. **Tạo user** — API trả `email_delivery.ok=true` khi webhook thành công

Gửi lại: nút **Gửi email MK** (reset mật khẩu + gửi template).
