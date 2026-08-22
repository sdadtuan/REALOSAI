# Portal UI — P0 Audit & quyết định (2026-08)

## Quyết định đã chốt

| # | Chủ đề | Quyết định |
|---|--------|------------|
| 1 | Theme | **A — PTT light** (`#17692f`, nền `#ecefea`, hover `#C7D9C9`) — parity ops-web |
| 2 | Desktop nav | **Sidebar thu gọn** (rail 72px + drawer flyout), topbar cố định |
| 3 | Ưu tiên sau P1 | **P4 Creatives** (trước SEO/Email module polish) |
| 4 | Triển khai | **P0 + P1 ngay** |

## Inventory routes (~20)

| Route | Shell | Inline styles | Mobile | Sóng tiếp |
|-------|:-----:|:-------------:|:------:|-----------|
| `/dashboard` | PortalPageShell | Một phần | Bottom nav | P2 reference ✓ P1 |
| `/meta`, `/google`, `/zalo` | PortalPageShell | Thấp | OK | P3 |
| `/creatives` | PortalPageShell | Trung bình | Swipe | **P4 ưu tiên** |
| `/notifications` | PortalPageShell | Cao | OK | P4 |
| `/settings` | PortalPageShell | Cao | OK | P6 |
| `/seo/*` (4) | PortalPageShell | Cao | OK | P5 |
| `/email/*` (3) | PortalPageShell | Trung bình | OK | P5 |
| `/login`, `/forgot-password`, `/reset-password` | Standalone | Cao | OK | P1 auth shell |
| `/privacy`, `/archived` | Standalone | Thấp | OK | P6 |
| `/` | redirect → login | — | — | — |

## Gap so với ops-web (trước P1)

- Theme dark blue, không PTT green
- Nav ngang inline styles, không sidebar
- Không có `PageToolbar`, `Breadcrumb`, `page-card`
- Mobile bottom nav dark-only

## P1 deliverables

- [x] Design tokens PTT light trong `globals.css`
- [x] `components/layout/` — PortalSidebar, PortalTopBar, PortalPage, PageToolbar, Breadcrumb, PortalAuthShell
- [x] `PortalPageShell` v2 (breadcrumb, title props)
- [x] `/dashboard` reference + auth pages
- [x] `scripts/wave_p1_rebuild_portal_web.sh`

## Sóng còn lại

| Sóng | Phạm vi | Trạng thái |
|------|---------|------------|
| P2 | Dashboard archetype (KPI tiles, hub layout) | **Done (local)** |
| P3 | Meta / Google / Zalo channel layout | **Done (local)** |
| **P4** | **Creatives + Notifications** | **Done (local)** |
| P5 | SEO + Email module shells | **Done (local)** |
| P6 | Settings + public pages + branding hook | **Done (local)** |
| P7 | Mobile/PWA polish (CSS) | **Done (local)** |

## Deploy

```bash
cd /var/www/rnosai && git pull
export NEXT_PUBLIC_PTT_API_URL=https://rs.pttads.vn
./scripts/wave_p1_rebuild_portal_web.sh
sudo systemctl restart ptt-portal-web
```
