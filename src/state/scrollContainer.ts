/**
 * The workspace has one primary scroll area (#main-scroll). The DecisionBar lives in a
 * reserved dock below it, so content never scrolls behind the bar. Code that reads or
 * restores scroll position uses this helper rather than `window`.
 */
export const SCROLL_CONTAINER_ID = 'main-scroll';

export function getScrollContainer(): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  const el = document.getElementById(SCROLL_CONTAINER_ID);
  // Below the supported width the page falls back to normal document flow (see AppShell).
  if (el && typeof getComputedStyle === 'function' && getComputedStyle(el).overflowY === 'visible') return null;
  return el;
}

export function getScrollTop(): number {
  return getScrollContainer()?.scrollTop ?? (typeof window !== 'undefined' ? window.scrollY : 0);
}

export function setScrollTop(top: number): void {
  const el = getScrollContainer();
  if (el) el.scrollTop = top;
  else if (typeof window !== 'undefined') window.scrollTo({ top });
}

/** The visible band of the scroll area, below the sticky incident header. */
export function visibleBand(): { top: number; bottom: number } {
  const el = getScrollContainer();
  const header = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-height')) || 0;
  if (!el) return { top: header, bottom: window.innerHeight };
  const rect = el.getBoundingClientRect();
  return { top: rect.top + header, bottom: rect.bottom };
}
