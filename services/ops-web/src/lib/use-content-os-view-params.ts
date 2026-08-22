'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { isContentOsSubView, type ContentOsSubView } from '@/lib/content-os-status';

export function useContentOsViewParams(defaultView: ContentOsSubView = 'overview') {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [view, setViewState] = useState<ContentOsSubView>(defaultView);
  const [itemId, setItemIdState] = useState<number | null>(null);

  const replaceParams = useCallback(
    (nextView: ContentOsSubView, nextItemId: number | null) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('tab', 'content-os');
      params.set('view', nextView);
      if (nextItemId != null) {
        params.set('id', String(nextItemId));
      } else {
        params.delete('id');
      }
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  useEffect(() => {
    const rawView = searchParams.get('view');
    const rawId = searchParams.get('id');
    if (isContentOsSubView(rawView)) {
      setViewState(rawView);
    }
    if (rawId != null && rawId !== '') {
      const parsed = Number(rawId);
      setItemIdState(Number.isFinite(parsed) && parsed > 0 ? parsed : null);
    } else {
      setItemIdState(null);
    }
  }, [searchParams]);

  const setView = useCallback(
    (next: ContentOsSubView) => {
      setViewState(next);
      replaceParams(next, itemId);
    },
    [itemId, replaceParams],
  );

  const openItem = useCallback(
    (id: number, nextView?: ContentOsSubView) => {
      const v = nextView ?? view;
      setViewState(v);
      setItemIdState(id);
      replaceParams(v, id);
    },
    [replaceParams, view],
  );

  const closeDrawer = useCallback(() => {
    setItemIdState(null);
    replaceParams(view, null);
  }, [replaceParams, view]);

  return useMemo(
    () => ({ view, itemId, setView, openItem, closeDrawer, setItemId: setItemIdState }),
    [view, itemId, setView, openItem, closeDrawer],
  );
}
