/**
 * TraceProvider holds the UI state for the AI inference → evidence → source trace
 * (UX Blueprint, section 2; Implementation Plan, section 7).
 *
 * - Hovering or focusing an EvidenceItem sets the active event; the timeline row and the
 *   system row read it and highlight themselves. Nothing scrolls on hover.
 * - If the active event's row is off-screen, `activeSourcePosition` says where, so the
 *   EvidenceItem can show "Source above" or "Source below".
 * - "Show source" stores a return point (scroll position and the element to refocus) so
 *   "Back to evidence" can restore both.
 */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { OpsEvent } from '../domain/types';
import { visibleBand } from './scrollContainer';

/** DOM id of an event's timeline row. Shared by the timeline and the trace. */
export const eventRowId = (eventId: string) => `event-row-${eventId}`;

export interface ReturnPoint {
  eventId: string;
  scrollY: number;
  /** The control that started "Show source"; focus returns here. */
  returnFocusTo: HTMLElement | null;
}

export type SourcePosition = 'above' | 'below';

interface TraceValue {
  /** The evidence item being hovered or focused: identified by its event id. */
  activeEventId: string | null;
  setActiveEventId: (id: string | null) => void;
  /** Where the active event's row is, when it is outside the visible area. */
  activeSourcePosition: SourcePosition | undefined;
  /** Set while a source is shown, so "Back to evidence" can restore position and focus. */
  returnPoint: ReturnPoint | null;
  setReturnPoint: (point: ReturnPoint | null) => void;
  /** Derived: which system row to highlight. */
  highlightedSystemId: string | null;
}

const TraceContext = createContext<TraceValue | null>(null);

/** Where an event row sits relative to the visible band of the scroll area. */
export function sourcePositionOf(eventId: string): SourcePosition | undefined {
  if (typeof document === 'undefined') return undefined;
  const row = document.getElementById(eventRowId(eventId));
  if (!row) return undefined;
  const rect = row.getBoundingClientRect();
  if (rect.height === 0) return undefined; // not laid out (tests, hidden)
  const band = visibleBand();
  if (rect.bottom < band.top) return 'above';
  if (rect.top > band.bottom) return 'below';
  return undefined;
}

export function TraceProvider({ children, events }: { children: ReactNode; events: OpsEvent[] }) {
  const [activeEventId, setActive] = useState<string | null>(null);
  const [activeSourcePosition, setActiveSourcePosition] = useState<SourcePosition | undefined>(undefined);
  const [returnPoint, setReturnPoint] = useState<ReturnPoint | null>(null);

  const setActiveEventId = useCallback((id: string | null) => {
    setActive(id);
    setActiveSourcePosition(id ? sourcePositionOf(id) : undefined);
  }, []);

  const value = useMemo(() => {
    // While a source is shown, its event stays traced even after focus leaves the evidence item.
    const tracedId = activeEventId ?? returnPoint?.eventId ?? null;
    const event = tracedId ? events.find((e) => e.id === tracedId) : undefined;
    return {
      activeEventId,
      setActiveEventId,
      activeSourcePosition,
      returnPoint,
      setReturnPoint,
      highlightedSystemId: event?.systemId ?? null,
    };
  }, [activeEventId, setActiveEventId, activeSourcePosition, returnPoint, events]);

  return <TraceContext.Provider value={value}>{children}</TraceContext.Provider>;
}

/** For components that work with or without a trace (gallery, read-only snapshots). */
export function useOptionalTrace(): TraceValue | null {
  return useContext(TraceContext);
}

export function useTrace(): TraceValue {
  const value = useContext(TraceContext);
  if (!value) throw new Error('useTrace must be used inside <TraceProvider>');
  return value;
}
