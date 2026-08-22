'use client';

import { useEffect } from 'react';

const RELOAD_KEY = 'ptt-chunk-reload';

function isChunkLoadError(reason: unknown): boolean {
  if (reason instanceof Error) {
    return (
      reason.name === 'ChunkLoadError' ||
      /Loading chunk \d+ failed/i.test(reason.message) ||
      /ChunkLoadError/i.test(reason.message)
    );
  }
  if (typeof reason === 'string') {
    return /Loading chunk \d+ failed/i.test(reason) || /ChunkLoadError/i.test(reason);
  }
  return false;
}

/** Reload once after deploy when stale tabs reference removed Next.js chunks. */
export function DeployChunkRecovery() {
  useEffect(() => {
    try {
      sessionStorage.removeItem(RELOAD_KEY);
    } catch {
      /* ignore */
    }

    function maybeReload(reason: unknown) {
      if (!isChunkLoadError(reason)) return;
      try {
        if (sessionStorage.getItem(RELOAD_KEY) === '1') return;
        sessionStorage.setItem(RELOAD_KEY, '1');
      } catch {
        /* ignore */
      }
      window.location.reload();
    }

    function onError(event: ErrorEvent) {
      const msg = event.message ?? '';
      if (/Loading chunk|ChunkLoadError|Failed to fetch dynamically imported module/i.test(msg)) {
        maybeReload(new Error(msg));
      }
    }

    function onRejection(event: PromiseRejectionEvent) {
      maybeReload(event.reason);
    }

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);

  return null;
}
