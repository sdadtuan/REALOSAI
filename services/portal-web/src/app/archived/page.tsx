'use client';

import Link from 'next/link';
import { clearSession } from '@/lib/auth';
import { PortalPublicShell } from '@/components/layout';

export default function ArchivedPage() {
  return (
    <PortalPublicShell
      narrow
      badge="Client archived"
      title="Portal đã đóng"
      subtitle="Tài khoản client này đã được offboard — không thể đăng nhập hay làm mới phiên. Liên hệ AM PTT nếu cần hỗ trợ."
      footer={
        <p style={{ margin: 0 }}>
          <Link href="/login">Đăng nhập tài khoản khác</Link>
        </p>
      }
    >
      <button
        type="button"
        className="btn portal-public-shell__cta"
        onClick={() => {
          clearSession();
          window.location.href = '/login';
        }}
      >
        Về trang đăng nhập
      </button>
    </PortalPublicShell>
  );
}
