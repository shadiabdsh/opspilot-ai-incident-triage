import { describe, expect, it } from 'vitest';
import { createInitialState, gateFor, reducer, type Action, type AppState } from './reducer';
import { REASONS } from './gate';
import type { DecisionAuditEntry } from './types';

function run(state: AppState, ...actions: Action[]): AppState {
  return actions.reduce(reducer, state);
}

const opened = (scenario: 'base' | 'low' | 'stale' = 'base') =>
  run(createInitialState(scenario), { type: 'INCIDENT_OPENED' });

const select = (id: string): Action => ({ type: 'RECOMMENDATION_SELECTED', recommendationId: id });
const submit: Action = { type: 'DECISION_SUBMITTED' };

describe('incident status', () => {
  it('opens into review', () => {
    expect(opened().incidentStatus).toBe('in_review');
  });

  it('rejects decisions before the incident is opened', () => {
    const s = run(
      createInitialState('base'),
      select('rec-verify-chain'),
      { type: 'DECISION_STARTED', action: 'approve' },
    );
    expect(run(s, submit)).toBe(s);
  });
});

describe('base scenario: approve consequential with typed confirmation', () => {
  const start = run(opened(), select('rec-bind-restart'), { type: 'DECISION_STARTED', action: 'approve' });

  it('refuses to submit until the typed text matches', () => {
    const wrong = run(start, { type: 'DECISION_INPUT_CHANGED', input: { typedConfirmation: 'nps' } });
    expect(run(wrong, submit)).toBe(wrong);
  });

  it('records approval, decides the incident and writes one complete audit entry', () => {
    const s = run(start, { type: 'DECISION_INPUT_CHANGED', input: { typedConfirmation: ' NPS-BLDGA-01 ' } }, submit);
    expect(s.recommendations['rec-bind-restart']?.status).toBe('approved');
    expect(s.incidentStatus).toBe('decided');
    expect(s.audit).toHaveLength(1);
    const entry = s.audit[0];
    expect(entry?.kind).toBe('decision');
    if (entry?.kind !== 'decision') return;
    expect(entry.action).toBe('approve');
    expect(entry.actor).toBeTruthy();
    expect(entry.outcome).toContain('CHG-5521');
    expect(entry.analysisSnapshot.id).toBe('analysis-base');
    expect(s.draft).toBeNull();
  });

  it('cancel writes nothing', () => {
    const s = run(start, { type: 'DECISION_CANCELLED' });
    expect(s.audit).toHaveLength(0);
    expect(s.draft).toBeNull();
  });

  it('a recorded decision cannot be changed', () => {
    const decided = run(start, { type: 'DECISION_INPUT_CHANGED', input: { typedConfirmation: 'nps-bldga-01' } }, submit);
    expect(gateFor(decided, 'rec-bind-restart')?.approve).toEqual({ allowed: false, reason: REASONS.alreadyDecided });
    expect(run(decided, { type: 'DECISION_STARTED', action: 'dismiss' })).toBe(decided);
  });
});

describe('modify, dismiss and escalate', () => {
  it('modify records the parameter diff and a flag', () => {
    const s = run(
      opened(),
      select('rec-bind-restart'),
      { type: 'DECISION_STARTED', action: 'modify' },
      { type: 'DECISION_INPUT_CHANGED', input: { modifiedParams: { 'Restart window': '06:30' }, typedConfirmation: 'nps-bldga-01' } },
      submit,
    );
    const entry = s.audit[0];
    expect(s.recommendations['rec-bind-restart']?.status).toBe('modified');
    if (entry?.kind !== 'decision') throw new Error('expected decision');
    expect(entry.originalParams?.['Restart window']).toBe('Now');
    expect(entry.modifiedParams?.['Restart window']).toBe('06:30');
    expect(entry.flags).toContain('modified_from_original');
  });

  it('modify with no changed parameter is refused', () => {
    const s = run(
      opened(),
      select('rec-bind-restart'),
      { type: 'DECISION_STARTED', action: 'modify' },
      { type: 'DECISION_INPUT_CHANGED', input: { typedConfirmation: 'nps-bldga-01' } },
    );
    expect(run(s, submit)).toBe(s);
  });

  it('dismiss requires a reason and leaves the incident in review', () => {
    const started = run(opened(), select('rec-notify-users'), { type: 'DECISION_STARTED', action: 'dismiss' });
    expect(run(started, submit)).toBe(started);
    const s = run(started, { type: 'DECISION_INPUT_CHANGED', input: { reason: 'Already handled' } }, submit);
    expect(s.recommendations['rec-notify-users']?.status).toBe('dismissed');
    expect(s.incidentStatus).toBe('in_review');
  });

  it('escalate requires team and note and escalates the incident', () => {
    const started = run(opened(), select('rec-bind-restart'), { type: 'DECISION_STARTED', action: 'escalate' });
    const teamOnly = run(started, { type: 'DECISION_INPUT_CHANGED', input: { team: 'Identity & Access' } });
    expect(run(teamOnly, submit)).toBe(teamOnly);
    const s = run(teamOnly, { type: 'DECISION_INPUT_CHANGED', input: { note: 'Please bind the renewed cert' } }, submit);
    expect(s.incidentStatus).toBe('escalated');
    // Escalated incidents block further changes, but not dismissals.
    expect(gateFor(s, 'rec-verify-chain')?.approve.reason).toBe(REASONS.incidentEscalated);
    expect(gateFor(s, 'rec-verify-chain')?.dismiss.allowed).toBe(true);
  });
});

describe('low-confidence scenario', () => {
  it('blocks the consequential fix but allows verify', () => {
    const s = opened('low');
    expect(s.selectedRecommendationId).toBe('rec-check-nps-log');
    expect(gateFor(s, 'rec-bind-restart')?.approve).toEqual({ allowed: false, reason: REASONS.lowConfidence });
    const verified = run(s, { type: 'DECISION_STARTED', action: 'approve' }, submit);
    expect(verified.recommendations['rec-check-nps-log']?.status).toBe('approved');
    expect(verified.incidentStatus).toBe('in_review'); // verifying does not decide the incident
  });

  it('cannot start an approval on the blocked card', () => {
    const s = run(opened('low'), select('rec-bind-restart'));
    expect(run(s, { type: 'DECISION_STARTED', action: 'approve' })).toBe(s);
  });
});

describe('stale-analysis scenario', () => {
  const arrived = (s: AppState) => run(s, { type: 'EVENTS_ARRIVED', token: s.scenarioToken });

  it('goes stale when late events arrive, and blocks all approvals', () => {
    const s = arrived(opened('stale'));
    expect(s.analysisStatus).toBe('stale');
    expect(s.events).toHaveLength(opened('stale').events.length + 3);
    expect(gateFor(s, 'rec-bind-restart')?.approve.reason).toBe(REASONS.staleConsequential);
    expect(gateFor(s, 'rec-notify-users')?.approve.reason).toBe(REASONS.staleLowRisk);
    expect(gateFor(s, 'rec-notify-users')?.dismiss.allowed).toBe(true);
  });

  it('acknowledge reopens low-risk actions only; consequential still needs a re-run', () => {
    const s = run(arrived(opened('stale')), { type: 'STALE_ACKNOWLEDGED' });
    expect(s.analysisStatus).toBe('acknowledged');
    expect(gateFor(s, 'rec-bind-restart')?.approve).toEqual({
      allowed: false,
      reason: REASONS.acknowledgedConsequential,
    });
    const notified = run(s, select('rec-notify-users'), { type: 'DECISION_STARTED', action: 'approve' }, submit);
    const entry = notified.audit.at(-1);
    if (entry?.kind !== 'decision') throw new Error('expected decision');
    expect(entry.flags).toContain('acknowledged_stale');
  });

  it('re-run loads fresh analysis and unlocks the consequential fix', () => {
    const stale = arrived(opened('stale'));
    const analyzing = run(stale, { type: 'ANALYSIS_RERUN_STARTED' });
    expect(analyzing.analysisStatus).toBe('analyzing');
    expect(gateFor(analyzing, 'rec-bind-restart')?.dismiss.reason).toBe(REASONS.analyzing);
    const fresh = run(analyzing, { type: 'ANALYSIS_RERUN_COMPLETED', token: analyzing.scenarioToken });
    expect(fresh.analysisStatus).toBe('ready');
    expect(fresh.analysis.modelVersion).toBe('demo-fixture-v2');
    expect(gateFor(fresh, 'rec-bind-restart')?.approve.allowed).toBe(true);
  });

  it('refuses a submit if the analysis went stale while the dialog was open', () => {
    const started = run(
      opened('stale'),
      select('rec-bind-restart'),
      { type: 'DECISION_STARTED', action: 'approve' },
      { type: 'DECISION_INPUT_CHANGED', input: { typedConfirmation: 'nps-bldga-01' } },
    );
    const nowStale = arrived(started);
    expect(run(nowStale, submit)).toBe(nowStale);
  });

  it('ignores timer callbacks from a previous scenario', () => {
    const s = opened('stale');
    const oldToken = s.scenarioToken;
    const switched = run(s, { type: 'SCENARIO_SET', scenario: 'stale' });
    expect(run(switched, { type: 'EVENTS_ARRIVED', token: oldToken })).toBe(switched);
  });
});

describe('scenario switch', () => {
  it('resets everything and writes one system line', () => {
    const decided = run(opened(), select('rec-notify-users'), { type: 'DECISION_STARTED', action: 'approve' }, submit);
    const s = run(decided, { type: 'SCENARIO_SET', scenario: 'low' });
    expect(s.scenario).toBe('low');
    expect(s.incidentStatus).toBe('open');
    expect(s.audit).toHaveLength(1);
    expect(s.audit[0]?.kind).toBe('system');
    expect(Object.values(s.recommendations).every((r) => r.status === 'pending')).toBe(true);
  });
});

// ── Correction 1: acknowledged_stale is action-specific ────────────────────

describe('acknowledged_stale flag (regression)', () => {
  const acknowledged = () =>
    run(
      opened('stale'),
      { type: 'EVENTS_ARRIVED', token: opened('stale').scenarioToken },
      { type: 'STALE_ACKNOWLEDGED' },
    );

  const lastDecision = (s: AppState): DecisionAuditEntry => {
    const entry = s.audit.at(-1);
    if (entry?.kind !== 'decision') throw new Error('expected a decision entry');
    return entry;
  };

  it('1. acknowledged + low-impact Approve writes the flag', () => {
    const s = run(acknowledged(), select('rec-notify-users'), { type: 'DECISION_STARTED', action: 'approve' }, submit);
    expect(s.recommendations['rec-notify-users']?.status).toBe('approved');
    expect(lastDecision(s).flags).toContain('acknowledged_stale');
  });

  it('2. acknowledged + low-impact Modify writes the flag', () => {
    const s = run(
      acknowledged(),
      select('rec-notify-users'),
      { type: 'DECISION_STARTED', action: 'modify' },
      { type: 'DECISION_INPUT_CHANGED', input: { modifiedParams: { Channel: 'Email only' } } },
      submit,
    );
    expect(s.recommendations['rec-notify-users']?.status).toBe('modified');
    expect(lastDecision(s).flags).toEqual(['acknowledged_stale', 'modified_from_original']);
  });

  it('3. acknowledged + Dismiss does not write the flag', () => {
    const s = run(
      acknowledged(),
      select('rec-notify-users'),
      { type: 'DECISION_STARTED', action: 'dismiss' },
      { type: 'DECISION_INPUT_CHANGED', input: { reason: 'Already announced' } },
      submit,
    );
    expect(s.recommendations['rec-notify-users']?.status).toBe('dismissed');
    expect(lastDecision(s).flags).not.toContain('acknowledged_stale');
  });

  it('4. acknowledged + Escalate does not write the flag', () => {
    const s = run(
      acknowledged(),
      select('rec-bind-restart'),
      { type: 'DECISION_STARTED', action: 'escalate' },
      { type: 'DECISION_INPUT_CHANGED', input: { team: 'Identity & Access', note: 'Please bind the renewed cert' } },
      submit,
    );
    expect(s.recommendations['rec-bind-restart']?.status).toBe('escalated');
    expect(lastDecision(s).flags).not.toContain('acknowledged_stale');
  });

  it('acknowledged analysis still never enables a consequential Approve or Modify', () => {
    const s = run(acknowledged(), select('rec-bind-restart'));
    for (const action of ['approve', 'modify'] as const) {
      expect(gateFor(s, 'rec-bind-restart')?.[action]).toEqual({
        allowed: false,
        reason: REASONS.acknowledgedConsequential,
      });
      expect(run(s, { type: 'DECISION_STARTED', action })).toBe(s);
    }
  });
});

// ── Correction 2: deterministic logical chronology ─────────────────────────

/** Everything the user can see that carries a time: events, analysis, audit entries. */
function newestVisibleFact(s: AppState): string {
  return [s.analysis.generatedAt, ...s.events.map((e) => e.timestamp)].reduce((a, b) => (a >= b ? a : b));
}

describe('logical demo clock', () => {
  it('starts at 06:12', () => {
    expect(createInitialState('base').clock).toBe('2026-10-20T06:12:00Z');
    expect(opened('stale').clock).toBe('2026-10-20T06:12:00Z');
  });

  it('stamps each recorded action a fixed step after the previous one', () => {
    const s = run(
      opened(),
      select('rec-verify-chain'),
      { type: 'DECISION_STARTED', action: 'approve' },
      submit,
      select('rec-notify-users'),
      { type: 'DECISION_STARTED', action: 'approve' },
      submit,
    );
    expect(s.audit.map((e) => e.at)).toEqual(['2026-10-20T06:12:30Z', '2026-10-20T06:13:00Z']);
  });

  it('after late events arrive, the next action comes after the newest event', () => {
    const arrived = run(opened('stale'), { type: 'EVENTS_ARRIVED', token: opened('stale').scenarioToken });
    expect(arrived.clock).toBe('2026-10-20T06:15:10Z'); // newest late event
    const s = run(arrived, { type: 'STALE_ACKNOWLEDGED' });
    expect(s.audit.at(-1)?.at).toBe('2026-10-20T06:15:40Z');
    expect(s.audit.at(-1)!.at > newestVisibleFact(arrived)).toBe(true);
  });

  it('after a re-run completes, the next action comes after the updated analysis', () => {
    const stale = run(opened('stale'), { type: 'EVENTS_ARRIVED', token: opened('stale').scenarioToken });
    const analyzing = run(stale, { type: 'ANALYSIS_RERUN_STARTED' });
    const fresh = run(analyzing, { type: 'ANALYSIS_RERUN_COMPLETED', token: analyzing.scenarioToken });
    expect(fresh.analysis.generatedAt > analyzing.audit.at(-1)!.at).toBe(true);
    const s = run(fresh, select('rec-notify-users'), { type: 'DECISION_STARTED', action: 'approve' }, submit);
    expect(s.audit.at(-1)!.at > fresh.analysis.generatedAt).toBe(true);
  });

  it('the re-run analysis never predates its own re-run, even after many earlier actions', () => {
    let s = run(opened('stale'), { type: 'EVENTS_ARRIVED', token: opened('stale').scenarioToken }, { type: 'STALE_ACKNOWLEDGED' });
    for (const id of ['rec-verify-chain', 'rec-notify-users', 'rec-expiry-monitoring']) {
      s = run(s, select(id), { type: 'DECISION_STARTED', action: 'approve' }, submit);
    }
    const analyzing = run(s, { type: 'ANALYSIS_RERUN_STARTED' });
    const fresh = run(analyzing, { type: 'ANALYSIS_RERUN_COMPLETED', token: analyzing.scenarioToken });
    expect(fresh.analysis.generatedAt > analyzing.audit.at(-1)!.at).toBe(true);
  });

  it('every recorded action is later than everything on screen when it was recorded, and strictly increasing', () => {
    const steps: Action[] = [
      select('rec-verify-chain'),
      { type: 'DECISION_STARTED', action: 'approve' },
      submit,
      { type: 'EVENTS_ARRIVED', token: 0 },
      { type: 'STALE_ACKNOWLEDGED' },
      select('rec-notify-users'),
      { type: 'DECISION_STARTED', action: 'dismiss' },
      { type: 'DECISION_INPUT_CHANGED', input: { reason: 'Not needed' } },
      submit,
      { type: 'ANALYSIS_RERUN_STARTED' },
      { type: 'ANALYSIS_RERUN_COMPLETED', token: 0 },
      select('rec-bind-restart'),
      { type: 'DECISION_STARTED', action: 'approve' },
      { type: 'DECISION_INPUT_CHANGED', input: { typedConfirmation: 'nps-bldga-01' } },
      submit,
    ];
    let s = opened('stale');
    for (const step of steps) {
      const before = s;
      s = reducer(s, step);
      if (s.audit.length > before.audit.length) {
        const entry = s.audit.at(-1)!;
        expect(entry.at > newestVisibleFact(before)).toBe(true);
        const previous = before.audit.at(-1);
        if (previous) expect(entry.at > previous.at).toBe(true);
      }
    }
    expect(s.recommendations['rec-bind-restart']?.status).toBe('approved');
  });

  it('is deterministic: the same actions always produce the same timestamps', () => {
    const script = (): AppState =>
      run(
        opened('stale'),
        { type: 'EVENTS_ARRIVED', token: 0 },
        { type: 'ANALYSIS_RERUN_STARTED' },
        { type: 'ANALYSIS_RERUN_COMPLETED', token: 0 },
        select('rec-notify-users'),
        { type: 'DECISION_STARTED', action: 'approve' },
        submit,
      );
    const a = script();
    const b = script();
    expect(a.audit.map((e) => e.at)).toEqual(b.audit.map((e) => e.at));
    expect(a.analysis.generatedAt).toBe(b.analysis.generatedAt);
    // Events arrived (stamped at the newest event), re-run, analysis updated, then the decision.
    expect(a.audit.map((e) => e.at)).toEqual([
      '2026-10-20T06:15:10Z',
      '2026-10-20T06:15:40Z',
      '2026-10-20T06:16:10Z',
      '2026-10-20T06:16:40Z',
    ]);
    expect(a.audit[0]?.kind === 'system' && a.audit[0].message).toBe(
      '3 new events arrived after the 06:11 analysis. Analysis marked out of date.',
    );
    expect(a.analysis.generatedAt).toBe('2026-10-20T06:16:10Z');
  });

  it('a scenario switch restarts the clock at 06:12', () => {
    const later = run(opened('stale'), { type: 'EVENTS_ARRIVED', token: 0 }, { type: 'STALE_ACKNOWLEDGED' });
    const s = run(later, { type: 'SCENARIO_SET', scenario: 'base' });
    expect(s.clock).toBe('2026-10-20T06:12:00Z');
    expect(s.audit[0]?.at).toBe('2026-10-20T06:12:00Z');
  });
});
