# ops-web deploy — tránh ChunkLoadError / màn trắng

## Triệu chứng

- Console: `ChunkLoadError: Loading chunk … failed` (404 trên `/_next/static/chunks/*.js`)
- React minified error #423
- Trang login load được nhưng CRM/form trắng hoặc crash

## Nguyên nhân gốc (đã xử lý trong repo)

| Vấn đề | Hậu quả |
|--------|---------|
| Nginx phục vụ `/_next/static/` từ disk **riêng** với Node `:3200` | Deploy thiếu bước copy → nginx 404 trong khi app vẫn chạy |
| `rm -rf static` rồi mới `cp` | Cửa sổ vài giây không có file |
| Chỉ `git pull` + `systemctl restart` **không build** | HTML mới, chunk cũ/mất |
| PWA service worker cache chunk cũ | Tab cũ trỏ hash không còn tồn tại |

## Cách deploy đúng (một lệnh chuẩn)

Trên VPS `/var/www/rnosai`:

```bash
cd /var/www/rnosai
git pull origin main
chmod +x scripts/deploy_ops_web.sh

# Bước 1 — user deploy (build + release atomic)
./scripts/deploy_ops_web.sh

# Bước 2 — sudo (restart service + nginx + verify HTTPS)
sudo ./scripts/deploy_ops_web.sh --restart
```

Hoặc một lần (root):

```bash
sudo ./scripts/deploy_ops_web.sh --all
```

Script sẽ:

1. `npm ci` + `npm run build`
2. Copy static **atomic** (không xóa trước khi có bản mới)
3. Publish vào `releases/ops-web-<sha>-<ts>/` và symlink `current/ops-web`
4. Restart `ptt-ops-web` (WorkingDirectory = `current/ops-web`)
5. Nginx **chỉ proxy** sang `:3200` (không còn disk alias)
6. Verify CSS + JS chunk qua localhost và `https://rs.pttads.vn`

## Sau deploy

Hard refresh trình duyệt (Cmd+Shift+R). Tab mở sẵn sẽ tự reload một lần nếu gặp ChunkLoadError (`DeployChunkRecovery`).

## Kiểm tra nhanh

```bash
CSS=$(basename /var/www/rnosai/current/ops-web/.next/static/css/*.css)
CHUNK=$(basename "$(ls /var/www/rnosai/current/ops-web/.next/static/chunks/*.js | head -1)")
curl -sI "https://rs.pttads.vn/_next/static/css/$CSS" | head -1
curl -sI "https://rs.pttads.vn/_next/static/chunks/$CHUNK" | head -1
# Cả hai phải HTTP/2 200
```

## Không làm

- ❌ `git pull` + `sudo systemctl restart ptt-ops-web` **không build**
- ❌ `sudo ./scripts/patch_nginx_rs_static.sh` (deprecated — gây lệch nginx vs Node)
- ❌ Deploy giữa chừng (build xong quên sudo restart)

## Rollback release

```bash
ls -1dt /var/www/rnosai/releases/ops-web-* | head -5
ln -sfn /var/www/rnosai/releases/ops-web-<previous> /var/www/rnosai/current/ops-web
sudo systemctl restart ptt-ops-web
```
