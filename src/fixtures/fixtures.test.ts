/**
 * Fixture integrity: enforces the AI behaviour contract on the pre-authored data.
 * If a fixture breaks one of these rules, the build fails (Implementation Plan, section 4).
 */
import { describe, expect, it } from 'vitest';
import type { AIAnalysis, OpsEvent, Statement } from '../domain/types';
import { SCENARIOS } from './scenarios';
import { SYSTEMS } from './systems';

const systemIds = new Set(SYSTEMS.map((s) => s.id));

function allStatements(a: AIAnalysis): Statement[] {
  return [
    ...a.summary,
    ...a.hypotheses.flatMap((h) => [h.cause, ...h.counter.map((c) => c.explanation), ...h.unknowns]),
    ...a.recommendations.map((r) => r.rationale),
  ];
}

function citedIds(a: AIAnalysis): string[] {
  return [
    ...allStatements(a).flatMap((s) => s.evidenceEventIds),
    ...a.hypotheses.flatMap((h) => [...h.supporting, ...h.counter.map((c) => c.eventId)]),
  ];
}

const cases: Array<[string, AIAnalysis, OpsEvent[]]> = [];
for (const def of Object.values(SCENARIOS)) {
  cases.push([`${def.id}: initial`, def.initialAnalysis, def.initialEvents]);
  if (def.rerunAnalysis && def.lateEvents) {
    cases.push([`${def.id}: after re-run`, def.rerunAnalysis, [...def.initialEvents, ...def.lateEvents]]);
  }
}

describe.each(cases)('%s', (_, analysis, events) => {
  const present = new Set(events.map((e) => e.id));

  it('1. every cited id resolves to an event present in the scenario', () => {
    for (const id of citedIds(analysis)) expect(present, `missing event ${id}`).toContain(id);
  });

  it('2. every inferred statement cites evidence; every unknown has a reason', () => {
    for (const s of allStatements(analysis)) {
      if (s.provenance === 'inferred') expect(s.evidenceEventIds.length, s.text).toBeGreaterThan(0);
      if (s.provenance === 'unknown') expect(s.unknownReason, s.text).toBeTruthy();
    }
  });

  it('3. every hypothesis carries a counter-evidence list and a confidence reason', () => {
    for (const h of analysis.hypotheses) {
      expect(Array.isArray(h.counter)).toBe(true);
      expect(h.confidenceReason.length).toBeGreaterThan(0);
    }
  });

  it('4. basedOnEventIds matches exactly the events present when this analysis is shown', () => {
    expect([...analysis.basedOnEventIds].sort()).toEqual([...present].sort());
  });

  it('5. every event refers to a known system', () => {
    for (const e of events) expect(systemIds, e.id).toContain(e.systemId);
  });

  it('6. a consequential recommendation always names its confirmation text', () => {
    for (const r of analysis.recommendations.filter((r) => r.riskTier === 'consequential')) {
      expect(r.confirmText).toBeTruthy();
    }
  });
});
