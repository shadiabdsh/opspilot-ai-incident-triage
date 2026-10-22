/**
 * Selectors derive what screens need from the store. They are plain functions, so the
 * components stay simple and the derivations are testable without rendering.
 */

import type { AppState } from './reducer';
import type { AIAnalysis, Incident, IncidentStatus, OpsEvent, Site, System } from './types';
import { INCIDENTS, SCRIPTED_INCIDENT_ID } from '../fixtures/incidents';
import { SITES } from '../fixtures/sites';
import { SYSTEMS } from '../fixtures/systems';

export const indexById = <T extends { id: string }>(items: T[]): Record<string, T> =>
  Object.fromEntries(items.map((i) => [i.id, i]));

export const systemsById: Record<string, System> = indexById(SYSTEMS);
export const sitesById: Record<string, Site> = indexById(SITES);

export function eventsById(state: AppState): Record<string, OpsEvent> {
  return indexById(state.events);
}

/** Events sorted oldest first, as the timeline shows them. */
export function timelineEvents(state: AppState): OpsEvent[] {
  return [...state.events].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

/** Events the current analysis did not consider (the stale scenario's late events). */
export function newSinceAnalysisIds(state: AppState): Set<string> {
  const considered = new Set(state.analysis.basedOnEventIds);
  return new Set(state.events.filter((e) => !considered.has(e.id)).map((e) => e.id));
}

/** How many AI statements cite each event: drives the "Cited by AI" reverse trace. */
export function citedCounts(analysis: AIAnalysis): Record<string, number> {
  const counts: Record<string, number> = {};
  const add = (ids: string[]) => ids.forEach((id) => (counts[id] = (counts[id] ?? 0) + 1));
  analysis.summary.forEach((s) => add(s.evidenceEventIds));
  analysis.hypotheses.forEach((h) => {
    add(h.cause.evidenceEventIds);
    add(h.supporting);
    add(h.counter.map((c) => c.eventId));
  });
  analysis.recommendations.forEach((r) => add(r.rationale.evidenceEventIds));
  return counts;
}

export interface SiteHealth {
  site: Site;
  offline: number;
  total: number;
}

export function siteHealth(): SiteHealth[] {
  return SITES.map((site) => {
    const systems = SYSTEMS.filter((s) => s.siteId === site.id);
    return { site, offline: systems.filter((s) => s.state === 'offline').length, total: systems.length };
  });
}

/** Incident list with the scripted incident's live status. */
export function incidentQueue(state: AppState): Array<Incident & { status: IncidentStatus }> {
  const severityRank = { critical: 0, major: 1, minor: 2, info: 3 } as const;
  return INCIDENTS.map((i) => ({
    ...i,
    status: i.id === SCRIPTED_INCIDENT_ID ? state.incidentStatus : i.initialStatus,
  })).sort(
    (a, b) => severityRank[a.severity] - severityRank[b.severity] || a.openedAt.localeCompare(b.openedAt),
  );
}

export function sourcesChecked(analysis: AIAnalysis): { checked: number; total: number } {
  const relevant = analysis.dataSources.filter((d) => d.status !== 'not_applicable');
  return { checked: relevant.filter((d) => d.status === 'checked').length, total: relevant.length };
}
