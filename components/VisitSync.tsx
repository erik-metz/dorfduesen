'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export function VisitSync() {
  const pathname = usePathname();
  useEffect(() => {
    // Real visits, including cached pages and client-side navigation.
    // The database enforces the cooldown across all browsers.
    void fetch('/api/strava/visit', { method: 'POST' }).catch(() => {});
  }, [pathname]);
  return null;
}
