/**
 * The OpsPilot store: one reducer owns all product state (Implementation Plan, section 5).
 *
 * Rules worth knowing before reading the code:
 * - The reducer is pure and deterministic. Displayed time comes from the logical `clock`
 *   in state (see clock.ts), never from the real clock; timer callbacks carry a token.
 * - Rejected actions return the *same* state object, so nothing changes and tests can
 *   assert `next === prev`.
 * - A decision is applied in one action (DECISION_SUBMITTED): recommendation status,
 *   incident status and the audit entry change together, so they can never disagree.
 * - "Blocked" is never stored. Availability always comes from gate().
 */

import { ACTION_STEP_SECONDS, addSeconds, DEMO_NOW, formatTime, latest, RERUN_STEP_SECONDS } from './clock';
import { gate, type GateResult } from './gate';
import type {
  AIAnalysis,
  AnalysisStatus,
  AuditEntry,
  AuditFlag,
  ConfirmationUsed,
  DecisionAction,
  DecisionAuditEntry,
  DecisionInput,
  IncidentStatus,
  OpsEvent,
  Recommendation,
  RecommendationStatus,
  ScenarioId,
  SystemAuditEvent,
} from './types';
import { SCENARIOS } from '../fixtures/scenarios';
import { SCRIPTED_INCIDENT_ID } from '../fixtures/incidents';

export const DEMO_ACTOR = 'Dana (you)';
const FIRST_CHANGE_REQUEST = 5521;

export interface RecommendationState {
  status: RecommendationStatus;
  modifiedParams?: Record<string, string>;
}

export interface DecisionDraft {
  action: DecisionAction;
  recommendationId: string;
  input: DecisionInput;
}

export interface AppState {
  scenario: ScenarioId;
  /** Increments on every scenario change; timer callbacks carry it so late callbacks are ignored. */
  scenarioToken: number;
  events: OpsEvent[];
  analysis: AIAnalysis;
  analysisStatus: AnalysisStatus;
  incidentStatus: IncidentStatus;
  recommendations: Record<string, RecommendationState>;
  selectedRecommendationId: string | null;
  draft: DecisionDraft | null;
  audit: AuditEntry[];
  lastDecisionId: string | null;
  changeRequestsCreated: number;
  /**
   * Logical demo time: the timestamp of the latest thing on screen (event, analysis or
   * recorded action). The next recorded action is stamped ACTION_STEP_SECONDS after it.
   */
  clock: string;
}

export type Action =
  | { type: 'SCENARIO_SET'; scenario: ScenarioId }
  | { type: 'INCIDENT_OPENED' }
  | { type: 'RECOMMENDATION_SELECTED'; recommendationId: string }
  | { type: 'DECISION_STARTED'; action: DecisionAction }
  | { type: 'DECISION_INPUT_CHANGED'; input: Partial<DecisionInput> }
  | { type: 'DECISION_CANCELLED' }
  | { type: 'DECISION_SUBMITTED' }
  | { type: 'EVENTS_ARRIVED'; token: number }
  | { type: 'ANALYSIS_RERUN_STARTED' }
  | { type: 'ANALYSIS_RERUN_COMPLETED'; token: number }
  | { type: 'STALE_ACKNOWLEDGED' };

// ── Initial state ───────────────────────────────────────────────────────────

function recommendationStatesFor(analysis: AIAnalysis): Record<string, RecommendationState> {
  return Object.fromEntries(analysis.recommendations.map((r) => [r.id, { status: 'pending' }]));
}

export function createInitialState(scenario: ScenarioId = 'base', scenarioToken = 0): AppState {
  const def = SCENARIOS[scenario];
  return {
    scenario,
    scenarioToken,
    events: def.initialEvents,
    analysis: def.initialAnalysis,
    analysisStatus: 'ready',
    incidentStatus: 'open',
    recommendations: recommendationStatesFor(def.initialAnalysis),
    selectedRecommendationId: def.initialAnalysis.recommendations[0]?.id ?? null,
    draft: null,
    audit: [],
    lastDecisionId: null,
    changeRequestsCreated: 0,
    clock: DEMO_NOW,
  };
}

/** Timestamp for the next recorded action: strictly after everything already on screen. */
function nextActionTime(state: AppState): string {
  return addSeconds(state.clock, ACTION_STEP_SECONDS);
}

// ── Helpers shared with the UI ──────────────────────────────────────────────

export function findRecommendation(state: AppState, id: string | null): Recommendation | undefined {
  return id ? state.analysis.recommendations.find((r) => r.id === id) : undefined;
}

/** Confidence of the hypothesis a recommendation depends on. */
export function confidenceFor(state: AppState, rec: Recommendation) {
  const hypothesis =
    state.analysis.hypotheses.find((h) => h.id === rec.requiresHypothesisId) ?? state.analysis.hypotheses[0];
  return hypothesis?.confidence ?? 'low';
}

export function gateFor(state: AppState, recommendationId: string): GateResult | undefined {
  const rec = findRecommendation(state, recommendationId);
  if (!rec) return undefined;
  return gate({
    tier: rec.riskTier,
    recommendationStatus: state.recommendations[rec.id]?.status ?? 'pending',
    confidence: confidenceFor(state, rec),
    analysisStatus: state.analysisStatus,
    incidentStatus: state.incidentStatus,
  });
}

/**
 * Input guards for a decision. Returns an error message, or null when the input is complete.
 * Used by the dialogs to enable their submit button and by the reducer before writing.
 */
export function decisionInputError(
  action: DecisionAction,
  rec: Recommendation,
  gateResult: GateResult,
  input: DecisionInput,
): string | null {
  const typedOk =
    !gateResult.requiresTypedConfirm ||
    (input.typedConfirmation ?? '').trim().toLowerCase() === (rec.confirmText ?? '').toLowerCase();

  switch (action) {
    case 'approve':
      return typedOk ? null : `Type ${rec.confirmText} to confirm.`;
    case 'modify': {
      const edited = input.modifiedParams ?? {};
      const changed = Object.entries(edited).some(([k, v]) => rec.params[k] !== v);
      if (!changed) return 'Change at least one parameter, or use Approve instead.';
      return typedOk ? null : `Type ${rec.confirmText} to confirm.`;
    }
    case 'dismiss':
      return (input.reason ?? '').trim() ? null : 'Give a reason for dismissing.';
    case 'escalate':
      if (!(input.team ?? '').trim()) return 'Choose a team to escalate to.';
      return (input.note ?? '').trim() ? null : 'Add a note for the receiving team.';
  }
}

function systemLine(
  state: AppState,
  at: string,
  event: SystemAuditEvent,
  message: string,
  actor?: string,
): AuditEntry {
  return { kind: 'system', id: `audit-${state.audit.length + 1}`, incidentId: SCRIPTED_INCIDENT_ID, at, event, actor, message };
}

/** Deep copy so later state changes can never alter a recorded snapshot. */
function freeze<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function confirmationFor(action: DecisionAction, gateResult: GateResult): ConfirmationUsed {
  if (action === 'dismiss') return 'reason';
  if (action === 'escalate') return 'team_and_note';
  return gateResult.requiresTypedConfirm ? 'typed_target' : 'single_confirm';
}

function outcomeFor(action: DecisionAction, rec: Recommendation, changeRequest: number, team?: string): string {
  if (action === 'dismiss') return 'Dismissed. No action taken.';
  if (action === 'escalate') return `Escalated to ${team}. No action taken here.`;
  if (rec.riskTier === 'consequential') {
    const suffix = action === 'modify' ? ' with modified parameters' : '';
    return `Change request CHG-${changeRequest} created${suffix} (mock). Nothing runs from OpsPilot.`;
  }
  return rec.riskTier === 'read_only' ? 'Verification task created (mock).' : 'Task created (mock).';
}

const STATUS_AFTER: Record<DecisionAction, RecommendationStatus> = {
  approve: 'approved',
  modify: 'modified',
  dismiss: 'dismissed',
  escalate: 'escalated',
};

function submitDecision(state: AppState): AppState {
  const draft = state.draft;
  if (!draft) return state;
  // Decisions are only reachable from inside an opened incident.
  if (state.incidentStatus === 'open') return state;

  const rec = findRecommendation(state, draft.recommendationId);
  const gateResult = gateFor(state, draft.recommendationId);
  if (!rec || !gateResult) return state;

  // Re-check the gate: the analysis may have gone stale while the dialog was open.
  if (!gateResult[draft.action].allowed) return state;
  if (decisionInputError(draft.action, rec, gateResult, draft.input) !== null) return state;

  const consequentialChange = rec.riskTier === 'consequential' && (draft.action === 'approve' || draft.action === 'modify');
  const changeRequest = FIRST_CHANGE_REQUEST + state.changeRequestsCreated;

  // Flags are action-specific: only Approve and Modify can carry 'acknowledged_stale'.
  const flags: AuditFlag[] = [];
  const actionFlag = gateResult[draft.action].flag;
  if (actionFlag) flags.push(actionFlag);
  if (draft.action === 'modify') flags.push('modified_from_original');
  const at = nextActionTime(state);

  const entry: DecisionAuditEntry = {
    kind: 'decision',
    id: `audit-${state.audit.length + 1}`,
    incidentId: SCRIPTED_INCIDENT_ID,
    at,
    actor: DEMO_ACTOR,
    action: draft.action,
    recommendationId: rec.id,
    recommendationTitle: rec.title,
    reason: draft.action === 'escalate' ? draft.input.note : draft.input.reason,
    escalatedTo: draft.action === 'escalate' ? draft.input.team : undefined,
    originalParams: draft.action === 'modify' ? { ...rec.params } : undefined,
    modifiedParams: draft.action === 'modify' ? { ...rec.params, ...draft.input.modifiedParams } : undefined,
    flags,
    outcome: outcomeFor(draft.action, rec, changeRequest, draft.input.team),
    riskTier: rec.riskTier,
    confirmation: confirmationFor(draft.action, gateResult),
    analysisSnapshot: freeze(state.analysis),
    analysisStatusAtDecision: state.analysisStatus,
    recommendationStatesAtDecision: {
      ...Object.fromEntries(Object.entries(state.recommendations).map(([id, r]) => [id, r.status])),
      [rec.id]: STATUS_AFTER[draft.action],
    },
    eventsAtDecision: freeze(state.events),
  };

  let incidentStatus = state.incidentStatus;
  if (draft.action === 'escalate') incidentStatus = 'escalated';
  else if (consequentialChange && incidentStatus === 'in_review') incidentStatus = 'decided';

  return {
    ...state,
    recommendations: {
      ...state.recommendations,
      [rec.id]: { status: STATUS_AFTER[draft.action], modifiedParams: entry.modifiedParams },
    },
    incidentStatus,
    draft: null,
    audit: [...state.audit, entry],
    lastDecisionId: entry.id,
    changeRequestsCreated: state.changeRequestsCreated + (consequentialChange ? 1 : 0),
    clock: at,
  };
}

// ── Reducer ─────────────────────────────────────────────────────────────────

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SCENARIO_SET': {
      // A scenario switch restarts the demo at 06:12; the line is stamped at that moment.
      const fresh = createInitialState(action.scenario, state.scenarioToken + 1);
      const label = SCENARIOS[action.scenario].label;
      return { ...fresh, audit: [systemLine(fresh, fresh.clock, 'scenario_changed', `Scenario changed to ${label}`, DEMO_ACTOR)] };
    }

    case 'INCIDENT_OPENED':
      return state.incidentStatus === 'open' ? { ...state, incidentStatus: 'in_review' } : state;

    case 'RECOMMENDATION_SELECTED': {
      if (!findRecommendation(state, action.recommendationId)) return state;
      // Changing selection discards an unsubmitted draft for a different card.
      return { ...state, selectedRecommendationId: action.recommendationId, draft: null };
    }

    case 'DECISION_STARTED': {
      const id = state.selectedRecommendationId;
      const result = id ? gateFor(state, id) : undefined;
      if (!id || !result || !result[action.action].allowed) return state;
      const rec = findRecommendation(state, id);
      const input: DecisionInput = action.action === 'modify' ? { modifiedParams: { ...rec?.params } } : {};
      return { ...state, draft: { action: action.action, recommendationId: id, input } };
    }

    case 'DECISION_INPUT_CHANGED':
      if (!state.draft) return state;
      return { ...state, draft: { ...state.draft, input: { ...state.draft.input, ...action.input } } };

    case 'DECISION_CANCELLED':
      return state.draft ? { ...state, draft: null } : state;

    case 'DECISION_SUBMITTED':
      return submitDecision(state);

    case 'EVENTS_ARRIVED': {
      const late = SCENARIOS[state.scenario].lateEvents;
      if (action.token !== state.scenarioToken || !late) return state;
      if (state.events.some((e) => e.id === late[0]?.id)) return state; // already arrived
      // New events are now on screen: later actions must come after the newest one.
      const clock = latest(state.clock, ...late.map((e) => e.timestamp));
      const wentStale = state.analysisStatus === 'ready';
      return {
        ...state,
        events: [...state.events, ...late],
        analysisStatus: wentStale ? 'stale' : state.analysisStatus,
        clock,
        // Recorded so the audit shows which analysis was current when later decisions were made.
        audit: [
          ...state.audit,
          systemLine(
            state,
            clock,
            'events_arrived',
            `${late.length} new events arrived after the ${formatTime(state.analysis.generatedAt)} analysis${wentStale ? '. Analysis marked out of date.' : '.'}`,
          ),
        ],
      };
    }

    case 'ANALYSIS_RERUN_STARTED': {
      if (state.analysisStatus !== 'stale' && state.analysisStatus !== 'acknowledged') return state;
      const at = nextActionTime(state);
      return {
        ...state,
        analysisStatus: 'analyzing',
        draft: null,
        audit: [...state.audit, systemLine(state, at, 'analysis_rerun', 'Analysis re-run', DEMO_ACTOR)],
        clock: at,
      };
    }

    case 'ANALYSIS_RERUN_COMPLETED': {
      const next = SCENARIOS[state.scenario].rerunAnalysis;
      if (action.token !== state.scenarioToken || state.analysisStatus !== 'analyzing' || !next) return state;
      // The fresh analysis is stamped no earlier than its fixture time and always after the
      // re-run was started, so it can never predate an action already on screen.
      const generatedAt = latest(next.generatedAt, addSeconds(state.clock, RERUN_STEP_SECONDS));
      // Recorded so the trail shows when the fresh analysis became the basis for decisions.
      const updated = systemLine(
        state,
        generatedAt,
        'analysis_updated',
        `Analysis updated (${next.modelVersion}), now based on ${next.basedOnEventIds.length} events.`,
      );
      return {
        ...state,
        analysis: { ...next, generatedAt },
        analysisStatus: 'ready',
        clock: generatedAt,
        audit: [...state.audit, updated],
      };
    }

    case 'STALE_ACKNOWLEDGED': {
      if (state.analysisStatus !== 'stale') return state;
      const at = nextActionTime(state);
      return {
        ...state,
        analysisStatus: 'acknowledged',
        audit: [
          ...state.audit,
          systemLine(state, at, 'stale_acknowledged', 'Stale analysis acknowledged. Consequential actions still require a re-run.', DEMO_ACTOR),
        ],
        clock: at,
      };
    }
  }
}
