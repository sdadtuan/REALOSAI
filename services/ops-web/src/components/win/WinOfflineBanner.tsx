'use client';

import { useEffect, useState } from 'react';

export function WinOfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setOffline(!navigator.onLine);

    const onOffline = () => setOffline(true);
    const onOnline = () => setOffline(false);
    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    return () => {
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="win-offline-banner" role="status">
      Không có mạng — danh sách lead có thể là bản đọc từ cache. Mở lại khi có kết nối.
    </div>
  );
}
