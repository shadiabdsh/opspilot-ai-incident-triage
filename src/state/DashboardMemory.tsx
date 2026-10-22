/**
 * Remembers which status the Dashboard last showed for the scripted incident, so that on
 * return from Incident Detail it can highlight and announce a change exactly once.
 * UI memory only; product state stays in the reducer.
 */
import { createContext, useContext, useRef, type MutableRefObject, type ReactNode } from 'react';
import type { IncidentStatus } from '../domain/types';
import { useStore } from './StoreProvider';

const DashboardMemoryContext = createContext<MutableRefObject<IncidentStatus> | null>(null);

export function DashboardMemoryProvider({ children }: { children: ReactNode }) {
  const { state } = useStore();
  // Initialised with the status at app start, so a decision made before the first visit to
  // the Dashboard is still treated as a change.
  const lastShown = useRef<IncidentStatus>(state.incidentStatus);
  return <DashboardMemoryContext.Provider value={lastShown}>{children}</DashboardMemoryContext.Provider>;
}

export function useDashboardMemory(): MutableRefObject<IncidentStatus> {
  const value = useContext(DashboardMemoryContext);
  if (!value) throw new Error('useDashboardMemory must be used inside <DashboardMemoryProvider>');
  return value;
}
