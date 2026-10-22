/**
 * Phase 6: audit integrity at the data level. Every decision must carry a complete, frozen
 * record of what existed when it was made; system lines must record what changed around it;
 * nothing a later state change does may alter history.
 */
import { describe, expect, it } from 'vitest';
import { createInitialState, reducer, type Action, type AppState } from './reducer';
import type { AuditEntry, DecisionAuditEntry, SystemAuditEntry } from './types';

const run = (s: AppState, ...actions: Action[]) => actions.reduce(reducer, s);
const opened = (scenario: 'base' | 'low' | 'stale') => run(createInitialState(scenario), { type: 'INCIDENT_OPENED' });
const select = (id: string): Action => ({ type: 'RECOMMENDATION_SELECTED', recommendationId: id });
const start = (action: 'approve' | 'modify' | 'dismiss' | 'escalate'): Action => ({ type: 'DECISION_STARTED', action });
const input = (i: Record<string, unknown>): Action => ({ type: 'DECISION_INPUT_CHANGED', input: i });
const submit: Action = { type: 'DECISION_SUBMITTED' };
const arrive = (s: AppState): Action => ({ type: 'EVENTS_ARRIVED', token: s.scenarioToken });
const ack: Action = { type: 'STALE_ACKNOWLEDGED' };
const rerun = (s: AppState): Action[] => [{ type: 'ANALYSIS_RERUN_STARTED' }, { type: 'ANALYSIS_RERUN_COMPLETED', token: s.scenarioToken }];

const decisions = (s: AppState) => s.audit.filter((e): e is DecisionAuditEntry => e.kind === 'decision');
const systems = (s: AppState) => s.audit.filter((e): e is SystemAuditEntry => e.kind === 'system');
const last = (s: AppState): DecisionAuditEntry => {
  const d = decisions(s).at(-1);
  if (!d) throw new Error('no decision');
  return d;
};
const typed = input({ typedConfirmation: 'nps-bldga-01' });

// Scripted reference states
const approveBind = () => run(opened('base'), select('rec-bind-restart'), start('approve'), typed, submit);
const modifyBind = () =>
  run(opened('base'), select('rec-bind-restart'), start('modify'), input({ modifiedParams: { 'Restart window': '06:30' }, typedConfirmation: 'nps-bldga-01' }), submit);
const dismissOther = () => run(opened('low'), select('rec-bind-restart'), start('dismiss'), input({ reason: 'Other: Waiting for the NPS log check' }), submit);
const escalateLow = () => run(opened('low'), select('rec-bind-restart'), start('escalate'), input({ team: 'Identity & Access', note: 'Please confirm via NPS logs.' }), submit);
const verifyLow = () => run(opened('low'), start('approve'), submit);

describe('1. Every entry type is recorded with its required fields', () => {
  it('decision entries: kind, id, timestamp, actor, action, recommendation, outcome, tier, confirmation', () => {
    const cases: Array<[string, DecisionAuditEntry, string, string]> = [
      ['approve', last(approveBind()), 'consequential', 'typed_target'],
      ['modify', last(modifyBind()), 'consequential', 'typed_target'],
      ['dismiss', last(dismissOther()), 'consequential', 'reason'],
      ['escalate', last(escalateLow()), 'consequential', 'team_and_note'],
      ['approve (verify)', last(verifyLow()), 'read_only', 'single_confirm'],
    ];
    for (const [label, e, tier, confirmation] of cases) {
      expect(e.kind, label).toBe('decision');
      expect(e.id, label).toMatch(/^audit-\d+$/);
      expect(e.at, label).toMatch(/^2026-10-20T\d\d:\d\d:\d\dZ$/);
      expect(e.actor, label).toBe('Dana (you)');
      expect(e.recommendationTitle.length, label).toBeGreaterThan(0);
      expect(e.outcome.length, label).toBeGreaterThan(0);
      expect(e.riskTier, label).toBe(tier);
      expect(e.confirmation, label).toBe(confirmation);
    }
  });

  it('system entries: scenario changed, events arrived, analysis re-run, analysis updated, stale acknowledged', () => {
    const s0 = run(createInitialState('base'), { type: 'SCENARIO_SET', scenario: 'stale' }, { type: 'INCIDENT_OPENED' });
    const s1 = run(s0, arrive(s0), ack, ...rerun(s0));
    const byEvent = Object.fromEntries(systems(s1).map((e) => [e.event, e]));
    expect(Object.keys(byEvent).sort()).toEqual(['analysis_rerun', 'analysis_updated', 'events_arrived', 'scenario_changed', 'stale_acknowledged']);
    // User-initiated events carry the actor; observed ones do not.
    expect(byEvent.scenario_changed?.actor).toBe('Dana (you)');
    expect(byEvent.stale_acknowledged?.actor).toBe('Dana (you)');
    expect(byEvent.analysis_rerun?.actor).toBe('Dana (you)');
    expect(byEvent.events_arrived?.actor).toBeUndefined();
    expect(byEvent.analysis_updated?.actor).toBeUndefined();
    expect(byEvent.analysis_updated?.message).toBe('Analysis updated (demo-fixture-v2), now based on 22 events.');
    for (const e of systems(s1)) {
      expect(e.message.length).toBeGreaterThan(0);
      expect(e.at).toMatch(/^2026-10-20T/);
    }
  });

  it('ordering is stable: sequential ids and strictly increasing timestamps (except the scenario reset line)', () => {
    const s0 = opened('stale');
    const s = run(s0, arrive(s0), ack, select('rec-notify-users'), start('approve'), submit, ...rerun(s0), select('rec-bind-restart'), start('approve'), typed, submit);
    expect(s.audit.map((e) => e.id)).toEqual(s.audit.map((_, i) => `audit-${i + 1}`));
    for (let i = 1; i < s.audit.length; i++) expect(s.audit[i]!.at > s.audit[i - 1]!.at).toBe(true);
  });
});

describe('2. Frozen analysis integrity', () => {
  it('stores a complete copy of the analysis, its status, recommendation states and events at decision time', () => {
    const before = run(opened('base'), select('rec-bind-restart'), start('approve'), typed);
    const after = reducer(before, submit);
    const e = last(after);
    expect(e.analysisSnapshot).toEqual(before.analysis);
    expect(e.analysisSnapshot.modelVersion).toBe('demo-fixture-v1');
    expect(e.analysisSnapshot.generatedAt).toBe('2026-10-20T06:11:00Z');
    expect(e.analysisStatusAtDecision).toBe('ready');
    const h = e.analysisSnapshot.hypotheses[0]!;
    expect(h.confidence).toBe('high');
    expect(h.supporting.length).toBe(4);
    expect(h.counter.length).toBe(2);
    expect(e.analysisSnapshot.summary).toHaveLength(3);
    expect(e.analysisSnapshot.dataSources.every((d) => d.status === 'checked')).toBe(true);
    expect(e.recommendationStatesAtDecision).toEqual({
      'rec-bind-restart': 'approved',
      'rec-verify-chain': 'pending',
      'rec-notify-users': 'pending',
      'rec-expiry-monitoring': 'pending',
    });
    expect(e.eventsAtDecision).toEqual(before.events);
  });

  it('is a deep copy: no object is shared with live state', () => {
    const s = approveBind();
    const e = last(s);
    expect(e.analysisSnapshot).not.toBe(s.analysis);
    expect(e.analysisSnapshot.hypotheses[0]).not.toBe(s.analysis.hypotheses[0]);
    expect(e.analysisSnapshot.recommendations[0]).not.toBe(s.analysis.recommendations[0]);
    expect(e.eventsAtDecision[0]).not.toBe(s.events[0]);
  });

  it('history does not change when live state changes later (re-run, more decisions, scenario reset)', () => {
    const s0 = opened('stale');
    const decided = run(s0, arrive(s0), ack, select('rec-notify-users'), start('approve'), submit);
    const recorded = structuredClone(decided.audit);

    const later = run(decided, ...rerun(s0), select('rec-bind-restart'), start('approve'), typed, submit, select('rec-verify-chain'), start('dismiss'), input({ reason: 'Not the cause' }), submit);
    expect(later.analysis.modelVersion).toBe('demo-fixture-v2'); // live analysis changed…
    expect(later.audit.slice(0, recorded.length)).toEqual(recorded); // …earlier history did not
    // Mutating live state objects cannot reach the record either.
    const liveCopy = structuredClone(later.events);
    later.events.splice(0, later.events.length);
    expect(later.audit.slice(0, recorded.length)).toEqual(recorded);
    later.events.push(...liveCopy);
  });
});

describe('3. Decision-specific data', () => {
  it('Approve: recommendation, action, typed confirmation used, change-request outcome', () => {
    const e = last(approveBind());
    expect(e.action).toBe('approve');
    expect(e.recommendationId).toBe('rec-bind-restart');
    expect(e.confirmation).toBe('typed_target');
    expect(e.outcome).toMatch(/^Change request CHG-5521 created \(mock\)/);
  });

  it('Modify: original and modified parameters, diff, tier, flag', () => {
    const e = last(modifyBind());
    expect(e.originalParams?.['Restart window']).toBe('Now');
    expect(e.modifiedParams?.['Restart window']).toBe('06:30');
    expect(e.modifiedParams?.Certificate).toBe(e.originalParams?.Certificate); // unchanged params kept
    expect(e.riskTier).toBe('consequential');
    expect(e.flags).toEqual(['modified_from_original']);
  });

  it('Dismiss: reason, including the "Other" choice with its details', () => {
    expect(last(dismissOther()).reason).toBe('Other: Waiting for the NPS log check');
    expect(last(dismissOther()).outcome).toBe('Dismissed. No action taken.');
  });

  it('Escalate: destination team and note', () => {
    const e = last(escalateLow());
    expect(e.escalatedTo).toBe('Identity & Access');
    expect(e.reason).toBe('Please confirm via NPS logs.');
  });

  it('Verify: the verification recommendation and its mock task outcome', () => {
    const e = last(verifyLow());
    expect(e.recommendationId).toBe('rec-check-nps-log');
    expect(e.riskTier).toBe('read_only');
    expect(e.outcome).toBe('Verification task created (mock).');
  });
});

describe('4. Flags', () => {
  const ackd = () => {
    const s0 = opened('stale');
    return run(s0, arrive(s0), ack);
  };
  const flagsOf = (s: AppState) => last(s).flags;

  it.each([
    ['acknowledged + low-impact Approve', () => run(ackd(), select('rec-notify-users'), start('approve'), submit), ['acknowledged_stale']],
    ['acknowledged + read-only Approve', () => run(ackd(), select('rec-verify-chain'), start('approve'), submit), ['acknowledged_stale']],
    ['acknowledged + low-impact Modify', () => run(ackd(), select('rec-notify-users'), start('modify'), input({ modifiedParams: { Channel: 'Email only' } }), submit), ['acknowledged_stale', 'modified_from_original']],
    ['acknowledged + Dismiss', () => run(ackd(), select('rec-notify-users'), start('dismiss'), input({ reason: 'Not the cause' }), submit), []],
    ['acknowledged + Escalate', () => run(ackd(), select('rec-bind-restart'), start('escalate'), input({ team: 'Identity & Access', note: 'n' }), submit), []],
    ['stale (not acknowledged) + Dismiss', () => { const s0 = opened('stale'); return run(s0, arrive(s0), select('rec-notify-users'), start('dismiss'), input({ reason: 'Not the cause' }), submit); }, []],
    ['fresh analysis after re-run + Approve', () => { const s0 = opened('stale'); return run(s0, arrive(s0), ack, ...rerun(s0), select('rec-notify-users'), start('approve'), submit); }, []],
    ['base + Approve', () => run(opened('base'), select('rec-notify-users'), start('approve'), submit), []],
    ['base + Modify', modifyBind, ['modified_from_original']],
  ] as Array<[string, () => AppState, string[]]>)('%s → %j', (_, make, expected) => {
    expect(flagsOf(make())).toEqual(expected);
  });
});

describe('5. Stale chronology answers "what existed when this decision was made?"', () => {
  it('re-run path: analysis → events arrive → stale → re-run → updated → decision on v2', () => {
    const s0 = opened('stale');
    const s = run(s0, arrive(s0), ...rerun(s0), select('rec-bind-restart'), start('approve'), typed, submit);
    const sequence = s.audit.map((e: AuditEntry) => (e.kind === 'system' ? e.event : `decision:${e.action}`));
    expect(sequence).toEqual(['events_arrived', 'analysis_rerun', 'analysis_updated', 'decision:approve']);
    const e = last(s);
    expect(e.analysisSnapshot.modelVersion).toBe('demo-fixture-v2');
    expect(e.analysisStatusAtDecision).toBe('ready');
    expect(e.eventsAtDecision).toHaveLength(22);
    expect(e.analysisSnapshot.basedOnEventIds).toHaveLength(22); // nothing excluded
  });

  it('acknowledge path: events arrive → stale → acknowledged → decision on v1, with excluded events visible', () => {
    const s0 = opened('stale');
    const s = run(s0, arrive(s0), ack, select('rec-notify-users'), start('approve'), submit);
    const sequence = s.audit.map((e) => (e.kind === 'system' ? e.event : `decision:${e.action}`));
    expect(sequence).toEqual(['events_arrived', 'stale_acknowledged', 'decision:approve']);
    const e = last(s);
    expect(e.analysisSnapshot.modelVersion).toBe('demo-fixture-v1');
    expect(e.analysisStatusAtDecision).toBe('acknowledged');
    expect(e.eventsAtDecision).toHaveLength(22);
    expect(e.analysisSnapshot.basedOnEventIds).toHaveLength(19); // 3 present but not included
    expect(e.flags).toEqual(['acknowledged_stale']);
  });
});

describe('6. Low-confidence audit', () => {
  it('preserves the missing source, Unknown, both hypotheses and the Low reason', () => {
    for (const s of [verifyLow(), dismissOther(), escalateLow()]) {
      const snap = last(s).analysisSnapshot;
      expect(snap.dataSources.find((d) => d.source === 'nps_log')?.status).toBe('unavailable');
      expect(snap.hypotheses.map((h) => h.rank)).toEqual(['primary', 'alternative']);
      expect(snap.hypotheses.every((h) => h.confidence === 'low')).toBe(true);
      expect(snap.hypotheses[0]!.unknowns[0]!.unknownReason).toMatch(/NPS event log could not be retrieved/);
      expect(snap.hypotheses[0]!.confidenceReason).toMatch(/without NPS logs/);
      expect(last(s).eventsAtDecision.some((e) => e.source === 'nps_log')).toBe(false);
    }
  });

  it('a blocked consequential action can never be written, even with a forged draft', () => {
    const s = run(opened('low'), select('rec-bind-restart'));
    expect(run(s, start('approve'))).toBe(s); // cannot start
    expect(run(s, start('modify'))).toBe(s);
    const forged: AppState = { ...s, draft: { action: 'approve', recommendationId: 'rec-bind-restart', input: { typedConfirmation: 'nps-bldga-01' } } };
    expect(reducer(forged, submit)).toBe(forged); // gate re-check on submit refuses it
    expect(decisions(forged)).toHaveLength(0);
  });
});
