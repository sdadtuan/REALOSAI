'use client';

import { useEffect, useState } from 'react';

type WinReloginToastProps = {
  message?: string;
  durationMs?: number;
};

export function WinReloginToast({
  message = 'Đã lưu. Yêu cầu NV đăng xuất và đăng nhập lại để áp dụng caps mới.',
  durationMs = 8000,
}: WinReloginToastProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(false), durationMs);
    return () => window.clearTimeout(timer);
  }, [durationMs]);

  if (!visible) return null;

  return (
    <div className="win-relogin-toast" role="status">
      <span>{message}</span>
      <button type="button" className="btn btn-sm btn-secondary" onClick={() => setVisible(false)}>
        Đóng
      </button>
    </div>
  );
}
