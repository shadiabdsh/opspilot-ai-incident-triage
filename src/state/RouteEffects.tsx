/**
 * Route-level accessibility for a single-page app:
 *
 * - Page title (WCAG 2.4.2): every route gets a descriptive title, taken from its h1, so the
 *   browser tab, history and assistive technology say where the user is.
 * - Focus on navigation: after a route change (not on first load, not on a tab or search-param
 *   change), focus moves to the new page's h1 so keyboard and screen-reader users land on the
 *   new content instead of the document body.
 */
import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

const APP_NAME = 'OpsPilot';

export function RouteEffects() {
  const { pathname } = useLocation();
  // Compare with the previous path (not a "first render" flag): StrictMode runs effects twice
  // on mount, which would otherwise look like a navigation and steal focus on first load.
  const previousPath = useRef(pathname);

  useEffect(() => {
    const isFirst = previousPath.current === pathname;
    previousPath.current = pathname;
    // After the new route has rendered.
    const frame = window.requestAnimationFrame(() => {
      const h1 = document.querySelector<HTMLHeadingElement>('#main h1, main h1, h1');
      const heading = h1?.textContent?.trim();
      const incident = pathname.match(/^\/incidents\/([^/]+)/)?.[1];
      document.title = heading
        ? `${heading}${incident && heading !== 'Incident not available' ? ` (${incident})` : ''} – ${APP_NAME}`
        : APP_NAME;
      if (!isFirst && h1) {
        h1.setAttribute('tabindex', '-1');
        h1.focus({ preventScroll: true });
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [pathname]);

  return null;
}
