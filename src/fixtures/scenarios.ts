import type { AIAnalysis, OpsEvent, ScenarioId } from '../domain/types';
import { ANALYSIS_BASE } from './analysis.base';
import { ANALYSIS_LOW } from './analysis.low';
import { ANALYSIS_STALE_V2 } from './analysis.stale-v2';
import { BASE_EVENTS, LATE_EVENTS, LOW_EVENTS } from './events';

export interface ScenarioDefinition {
  id: ScenarioId;
  label: string;
  description: string;
  /** Events present when the incident opens. */
  initialEvents: OpsEvent[];
  initialAnalysis: AIAnalysis;
  /** Stale scenario only: events that arrive after the analysis, and the re-run result. */
  lateEvents?: OpsEvent[];
  rerunAnalysis?: AIAnalysis;
}

export const LATE_EVENT_DELAY_MS = 3000;
export const RERUN_DURATION_MS = 1500;

export const SCENARIOS: Record<ScenarioId, ScenarioDefinition> = {
  base: {
    id: 'base',
    label: 'Base',
    description: 'High confidence; certificate expiry confirmed; consequential fix available.',
    initialEvents: BASE_EVENTS,
    initialAnalysis: ANALYSIS_BASE,
  },
  low: {
    id: 'low',
    label: 'Low confidence',
    description: 'NPS logs unavailable; competing hypothesis; consequential fix blocked.',
    initialEvents: LOW_EVENTS,
    initialAnalysis: ANALYSIS_LOW,
  },
  stale: {
    id: 'stale',
    label: 'Stale analysis',
    description: 'Three new events arrive after the analysis; re-run required for the fix.',
    initialEvents: BASE_EVENTS,
    initialAnalysis: ANALYSIS_BASE,
    lateEvents: LATE_EVENTS,
    rerunAnalysis: ANALYSIS_STALE_V2,
  },
};

export const SCENARIO_ORDER: ScenarioId[] = ['base', 'low', 'stale'];
