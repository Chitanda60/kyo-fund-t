'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import MinePageContent from '@/app/components/pages/MinePageContent';

// Route content for `/mine`. MineTab is mobile-oriented; on desktop we redirect to `/`,
// but ONLY after the viewport is confirmed non-mobile. A bare `!isMobile` check is unsafe
// because matchMedia is unsettled on first client render and would bounce mobile users who
// directly open/refresh `/mine`. Tri-state (undefined | true | false); redirect on === false.
// Breakpoint matches useIsMobile (max-width: 640px).
export default function MinePage() {
  const router = useRouter();
  const [resolvedIsMobile, setResolvedIsMobile] = useState(undefined);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 640px)');
    const update = () => setResolvedIsMobile(media.matches);
    update();
    media.addEventListener('change', update);
    return () => {
      media.removeEventListener('change', update);
    };
  }, []);

  useEffect(() => {
    if (resolvedIsMobile === false) {
      router.replace('/');
    }
  }, [resolvedIsMobile, router]);

  return <MinePageContent />;
}
