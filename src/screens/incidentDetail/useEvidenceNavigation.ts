import { useCallback, useEffect, useRef, useState } from 'react';
import type { OpsEvent } from '../../domain/types';
import { WORKSTATION_IDS } from '../../fixtures/systems';
import { getScrollContainer, getScrollTop, setScrollTop } from '../../state/scrollContainer';
import { eventRowId, useTrace } from '../../state/TraceProvider';

const workstationSet = new Set(WORKSTATION_IDS);

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

export function useEvidenceNavigation(eventsById: Record<string, OpsEvent>) {
  const { setReturnPoint, returnPoint } = useTrace();
  const [groupExpanded, setGroupExpanded] = useState(false);
  const factsRef = useRef<HTMLElement>(null);
  const [factsSticky, setFactsSticky] = useState(false);

  useEffect(() => {
    const facts = factsRef.current;
    const scroller = getScrollContainer();
    if (!facts || !scroller || typeof ResizeObserver === 'undefined') return;

    const measure = () => {
      const header = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-height')) || 0;
      const available = scroller.clientHeight - header - 32;
      setFactsSticky(facts.offsetHeight > 0 && facts.offsetHeight <= available);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(facts);
    observer.observe(scroller);
    return () => observer.disconnect();
  }, []);

  const showSource = useCallback(
    (eventId: string) => {
      const returnFocusTo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setReturnPoint({ eventId, scrollY: getScrollTop(), returnFocusTo });
      const systemId = eventsById[eventId]?.systemId;
      if (systemId && workstationSet.has(systemId)) setGroupExpanded(true);

      requestAnimationFrame(() => {
        const row = document.getElementById(eventRowId(eventId));
        const block = factsSticky ? 'nearest' : 'center';
        row?.scrollIntoView({ block, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
        row?.focus({ preventScroll: true });
      });
    },
    [eventsById, factsSticky, setReturnPoint],
  );

  const backToEvidence = useCallback(() => {
    if (!returnPoint) return;
    setReturnPoint(null);
    setScrollTop(returnPoint.scrollY);
    returnPoint.returnFocusTo?.focus({ preventScroll: true });
  }, [returnPoint, setReturnPoint]);

  useEffect(() => {
    if (!returnPoint) return;

    const onKey = (event: KeyboardEvent) => {
      const row = document.getElementById(eventRowId(returnPoint.eventId));
      if (event.key === 'Escape' && row && row.contains(document.activeElement)) {
        event.preventDefault();
        backToEvidence();
      }
    };

    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [returnPoint, backToEvidence]);

  const toggleGroup = useCallback(() => setGroupExpanded((expanded) => !expanded), []);

  return {
    factsRef,
    factsSticky,
    groupExpanded,
    toggleGroup,
    showSource,
    backToEvidence,
  };
}
