import { useEffect, useState } from 'react';

const MOBILE_BREAKPOINT_QUERY = '(max-width: 767px)';

/**
 * True below the `md` breakpoint (767px). Starts `false` on the server and
 * on first client render (there's no viewport to check yet) and flips
 * after mount if the device is actually narrow — a one-frame flash of the
 * desktop layout on mobile, traded for never mismatching hydration.
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(MOBILE_BREAKPOINT_QUERY);
    setIsMobile(mql.matches);
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return isMobile;
}
