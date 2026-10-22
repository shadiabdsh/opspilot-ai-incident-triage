/**
 * StoreProvider puts the reducer in React context and owns the two scenario timers
 * (Implementation Plan, section 8):
 *
 * - late-event arrival: 3 s after Incident Detail first opens in the stale scenario
 * - re-run analysis: 1.5 s from "Re-run analysis" to the refreshed analysis
 *
 * Each timer carries the scenario token it was scheduled under; the reducer ignores a
 * callback whose token is out of date, and switching scenario also clears pending timers.
 * Displayed time is logical and lives in the store (see domain/clock.ts). Real elapsed
 * time is used only to trigger these timers, never to stamp anything the user sees.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from 'react';
import { createInitialState, reducer, type Action, type AppState } from '../domain/reducer';
import type { ScenarioId } from '../domain/types';
import { LATE_EVENT_DELAY_MS, RERUN_DURATION_MS, SCENARIOS } from '../fixtures/scenarios';

interface StoreValue {
  state: AppState;
  dispatch: (action: Action) => void;
  /** Resets the incident to the chosen scenario's start and cancels pending timers. */
  setScenario: (scenario: ScenarioId) => void;
  /** Starts the late-event timer once, if the current scenario has late events. */
  requestLateEvents: () => void;
  /** Stale → analyzing now; analyzing → ready with the refreshed fixture after 1.5 s. */
  rerunAnalysis: () => void;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children, initialState }: { children: ReactNode; initialState?: AppState }) {
  const [state, dispatch] = useReducer(reducer, initialState ?? createInitialState('base'));
  const stateRef = useRef(state);
  stateRef.current = state;
  const lateTimer = useRef<number | null>(null);
  const rerunTimer = useRef<number | null>(null);

  const clearTimers = useCallback(() => {
    if (lateTimer.current !== null) window.clearTimeout(lateTimer.current);
    if (rerunTimer.current !== null) window.clearTimeout(rerunTimer.current);
    lateTimer.current = null;
    rerunTimer.current = null;
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const setScenario = useCallback(
    (scenario: ScenarioId) => {
      clearTimers();
      dispatch({ type: 'SCENARIO_SET', scenario });
    },
    [clearTimers],
  );

  const requestLateEvents = useCallback(() => {
    const s = stateRef.current;
    const late = SCENARIOS[s.scenario].lateEvents;
    if (!late || lateTimer.current !== null) return;
    if (s.events.some((e) => e.id === late[0]?.id)) return; // already arrived
    const token = s.scenarioToken;
    lateTimer.current = window.setTimeout(() => {
      lateTimer.current = null;
      dispatch({ type: 'EVENTS_ARRIVED', token });
    }, LATE_EVENT_DELAY_MS);
  }, []);

  const rerunAnalysis = useCallback(() => {
    const s = stateRef.current;
    if (s.analysisStatus !== 'stale' && s.analysisStatus !== 'acknowledged') return;
    dispatch({ type: 'ANALYSIS_RERUN_STARTED' });
    const token = s.scenarioToken;
    if (rerunTimer.current !== null) window.clearTimeout(rerunTimer.current);
    rerunTimer.current = window.setTimeout(() => {
      rerunTimer.current = null;
      dispatch({ type: 'ANALYSIS_RERUN_COMPLETED', token });
    }, RERUN_DURATION_MS);
  }, []);

  const value = useMemo(
    () => ({ state, dispatch, setScenario, requestLateEvents, rerunAnalysis }),
    [state, setScenario, requestLateEvents, rerunAnalysis],
  );
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const value = useContext(StoreContext);
  if (!value) throw new Error('useStore must be used inside <StoreProvider>');
  return value;
}
