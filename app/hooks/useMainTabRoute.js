'use client';

import { useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { MAIN_TAB_ROUTES, getMainTabFromPathname } from '@/app/lib/mainTabRoutes';

// URL-derived main tab. Replaces the former local `mainTab` useState so that
// navigation changes the route instead of component state. usePathname strips the
// configured basePath, so getMainTabFromPathname matches plain '/market' / '/mine'.
export function useMainTabRoute() {
  const pathname = usePathname();
  const router = useRouter();
  const mainTab = getMainTabFromPathname(pathname);

  const setMainTab = useCallback(
    (tabId) => {
      const nextPath = MAIN_TAB_ROUTES[tabId] || MAIN_TAB_ROUTES.home;
      router.push(nextPath);
    },
    [router]
  );

  return { mainTab, setMainTab };
}
