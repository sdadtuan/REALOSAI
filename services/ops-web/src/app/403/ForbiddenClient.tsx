'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

export default function ForbiddenPage() {
  const searchParams = useSearchParams();
  const from = searchParams.get('from') ?? '';

  return (
    <main className="login-page">
      <div className="card login-card forbidden-card">
        <p className="badge" style={{ marginBottom: '0.75rem' }}>
          403 — Không có quyền
        </p>
        <h1 style={{ margin: '0 0 0.35rem', fontSize: '1.5rem' }}>Bạn chưa được cấp quyền</h1>
        <p className="muted" style={{ marginTop: 0, marginBottom: '1rem' }}>
          Tài khoản đã đăng nhập nhưng thiếu quyền truy cập khu vực này. Liên hệ quản trị viên hoặc
          GDKD để được cấp quyền trên ma trận chức vụ.
        </p>
        {from ? (
          <p className="muted" style={{ fontSize: '0.875rem', marginBottom: '1rem' }}>
            Đường dẫn: <code>{from}</code>
          </p>
        ) : null}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <Link className="btn" href="/">
            Về trang chủ
          </Link>
          <Link href="/login" style={{ textAlign: 'center', fontSize: '0.9rem' }}>
            Đăng nhập tài khoản khác
          </Link>
        </div>
        <p className="muted" style={{ fontSize: '0.8rem', marginTop: '1.25rem', marginBottom: 0 }}>
          Tham chiếu: ma trận phân quyền CSKH / KD / MKT — IT Admin
        </p>
      </div>
    </main>
  );
}
