/**
 * Gallery states are produced by running the real reducer over scripted actions, so every
 * specimen is a state the product can actually reach (except the Medium-confidence one,
 * which is marked as gallery-only).
 */
import { createInitialState, reducer, type Action, type AppState } from '../domain/reducer';
import { indexById } from '../domain/selectors';
import type { DecisionAuditEntry } from '../domain/types';
import { ALL_EVENTS } from '../fixtures/events';

export const allEventsById = indexById(ALL_EVENTS);

export const run = (state: AppState, ...actions: Action[]) => actions.reduce(reducer, state);
const select = (id: string): Action => ({ type: 'RECOMMENDATION_SELECTED', recommendationId: id });
const submit: Action = { type: 'DECISION_SUBMITTED' };

export const openedState = (scenario: 'base' | 'low' | 'stale') =>
  run(createInitialState(scenario), { type: 'INCIDENT_OPENED' });

export const staleArrived = () => {
  const s = openedState('stale');
  return run(s, { type: 'EVENTS_ARRIVED', token: s.scenarioToken });
};

/** Base state with the hypothesis set to Medium. No demo fixture uses Medium. */
export function mediumConfidenceState(): AppState {
  const s = openedState('base');
  return {
    ...s,
    analysis: {
      ...s.analysis,
      hypotheses: s.analysis.hypotheses.map((h) => ({
        ...h,
        confidence: 'medium' as const,
        confidenceReason: 'Strong correlation, but one link is indirect. (Gallery-only text.)',
      })),
    },
  };
}

export function recordedState(): AppState {
  return run(openedState('base'), select('rec-notify-users'), { type: 'DECISION_STARTED', action: 'approve' }, submit);
}

const lastDecision = (s: AppState): DecisionAuditEntry => {
  const e = s.audit.at(-1);
  if (e?.kind !== 'decision') throw new Error('Gallery script did not produce a decision');
  return e;
};

export function auditExamples() {
  const approved = run(
    openedState('base'),
    select('rec-bind-restart'),
    { type: 'DECISION_STARTED', action: 'approve' },
    { type: 'DECISION_INPUT_CHANGED', input: { typedConfirmation: 'nps-bldga-01' } },
    submit,
  );
  const modified = run(
    openedState('base'),
    select('rec-bind-restart'),
    { type: 'DECISION_STARTED', action: 'modify' },
    { type: 'DECISION_INPUT_CHANGED', input: { modifiedParams: { 'Restart window': '06:30' }, typedConfirmation: 'nps-bldga-01' } },
    submit,
  );
  const dismissed = run(
    openedState('base'),
    select('rec-notify-users'),
    { type: 'DECISION_STARTED', action: 'dismiss' },
    { type: 'DECISION_INPUT_CHANGED', input: { reason: 'Already handled: facilities sent a notice at 06:05' } },
    submit,
  );
  const escalated = run(
    openedState('low'),
    select('rec-bind-restart'),
    { type: 'DECISION_STARTED', action: 'escalate' },
    { type: 'DECISION_INPUT_CHANGED', input: { team: 'Identity & Access', note: 'NPS logs unavailable to us; please confirm and bind the renewed certificate.' } },
    submit,
  );
  const acknowledged = run(
    staleArrived(),
    { type: 'STALE_ACKNOWLEDGED' },
    select('rec-notify-users'),
    { type: 'DECISION_STARTED', action: 'approve' },
    submit,
  );
  return {
    approved: lastDecision(approved),
    modified: lastDecision(modified),
    dismissed: lastDecision(dismissed),
    escalated: lastDecision(escalated),
    acknowledged: lastDecision(acknowledged),
    systemLine: acknowledged.audit.find((e) => e.kind === 'system' && e.message.startsWith('Stale analysis acknowledged'))!,
  };
}
