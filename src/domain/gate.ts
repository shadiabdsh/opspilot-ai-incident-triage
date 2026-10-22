/**
 * gate() decides what the user may do with one recommendation.
 *
 * It is the single source of truth for availability (Implementation Plan, section 6).
 * Every button state, disabled reason, dialog guard and reducer check calls it.
 * It is a plain function with no React, so the rules read like the spec and are
 * easy to test exhaustively.
 *
 * AI UX principles it enforces:
 * - Require human confirmation before consequential actions (typed confirmation).
 * - Never act on a guess: Low confidence blocks consequential actions.
 * - Never act on out-of-date analysis: stale analysis blocks Approve and Modify;
 *   acknowledging staleness reopens only low-risk actions. Consequential actions
 *   always need a re-run and fresh analysis.
 * - Rejecting or escalating is always possible (except while analysis is loading),
 *   so the user is never trapped into accepting AI output.
 */

import type {
  AnalysisStatus,
  AuditFlag,
  Confidence,
  DecisionAction,
  IncidentStatus,
  RecommendationStatus,
  RiskTier,
} from './types';

export interface GateInput {
  /** For Modify, the tier of the action after edits are re-classified. */
  tier: RiskTier;
  recommendationStatus: RecommendationStatus;
  confidence: Confidence;
  analysisStatus: AnalysisStatus;
  incidentStatus: IncidentStatus;
}

export interface ActionAvailability {
  allowed: boolean;
  /** Always non-empty when allowed is false. Shown next to the control and announced. */
  reason?: string;
  /**
   * Written to the audit entry if the user goes ahead with *this* action.
   * Only Approve and Modify can carry 'acknowledged_stale': they are the actions that
   * acknowledging stale analysis reopens. Dismiss and Escalate never depend on it.
   */
  flag?: AuditFlag;
}

export interface GateResult {
  approve: ActionAvailability;
  modify: ActionAvailability;
  dismiss: ActionAvailability;
  escalate: ActionAvailability;
  /** True when a consequential Approve or Modify is allowed: the user must type the target. */
  requiresTypedConfirm: boolean;
  /** Extra caution shown in the confirm dialog (Medium confidence). */
  warning?: string;
}

export const REASONS = {
  alreadyDecided: 'Already decided. Decisions are final and recorded in the audit trail.',
  incidentEscalated: 'Incident escalated. The receiving team now owns changes.',
  analyzing: 'Waiting for analysis.',
  staleLowRisk: 'Analysis is out of date. Re-run, or acknowledge to continue with low-risk actions.',
  staleConsequential: 'Analysis is out of date. Re-run required.',
  acknowledgedConsequential: 'Re-run required: consequential actions need fresh analysis.',
  lowConfidence: 'Confidence is Low. Verify the cause first.',
} as const;

export const MEDIUM_CONFIDENCE_WARNING =
  'Confidence is Medium. Check the evidence and unknowns before confirming.';

const allowed: ActionAvailability = { allowed: true };
const blocked = (reason: string): ActionAvailability => ({ allowed: false, reason });

/** Approve and Modify share the same rules (Implementation Plan, section 6). */
function changeAvailability(input: GateInput): ActionAvailability {
  const { tier, recommendationStatus, confidence, analysisStatus, incidentStatus } = input;
  const consequential = tier === 'consequential';

  // Precedence: the first matching reason wins, so the user sees the most actionable one.
  if (recommendationStatus !== 'pending') return blocked(REASONS.alreadyDecided);
  if (incidentStatus === 'escalated') return blocked(REASONS.incidentEscalated);
  if (analysisStatus === 'analyzing') return blocked(REASONS.analyzing);
  if (analysisStatus === 'stale') {
    return blocked(consequential ? REASONS.staleConsequential : REASONS.staleLowRisk);
  }
  if (analysisStatus === 'acknowledged' && consequential) {
    return blocked(REASONS.acknowledgedConsequential);
  }
  if (consequential && confidence === 'low') return blocked(REASONS.lowConfidence);
  // Reaching here with acknowledged status means a low-risk action on analysis the
  // user knowingly accepted as out of date: record that on the audit entry.
  if (analysisStatus === 'acknowledged') return { allowed: true, flag: 'acknowledged_stale' };
  return allowed;
}

/** Dismiss and Escalate never depend on confidence, staleness or tier. */
function rejectAvailability(input: GateInput): ActionAvailability {
  if (input.recommendationStatus !== 'pending') return blocked(REASONS.alreadyDecided);
  if (input.analysisStatus === 'analyzing') return blocked(REASONS.analyzing);
  return allowed;
}

export function gate(input: GateInput): GateResult {
  const change = changeAvailability(input);
  const reject = rejectAvailability(input);
  const consequential = input.tier === 'consequential';

  return {
    approve: change,
    modify: change,
    dismiss: reject,
    escalate: reject,
    requiresTypedConfirm: consequential && change.allowed,
    warning:
      consequential && change.allowed && input.confidence === 'medium'
        ? MEDIUM_CONFIDENCE_WARNING
        : undefined,
  };
}

/** Convenience for reducer checks. */
export function isActionAllowed(result: GateResult, action: DecisionAction): boolean {
  return result[action].allowed;
}
