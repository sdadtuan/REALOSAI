import { Suspense } from 'react';
import ForbiddenPage from './ForbiddenClient';

export default function Page() {
  return (
    <Suspense
      fallback={
        <main className="login-page">
          <p className="muted">Đang tải…</p>
        </main>
      }
    >
      <ForbiddenPage />
    </Suspense>
  );
}
