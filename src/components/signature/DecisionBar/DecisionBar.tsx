/**
 * DecisionBar keeps the human in control. It shows which recommendation is being decided,
 * offers Approve, Modify, Dismiss and Escalate, and opens the matching dialog.
 *
 * Blocked actions are never removed or natively disabled: they use aria-disabled, stay
 * focusable, and point (aria-describedby) to a visible reason. After a decision, a polite
 * live region announces what was recorded.
 */
import { useEffect, useId, useRef } from 'react';
import type { GateResult } from '../../../domain/gate';
import type { DecisionDraft } from '../../../domain/reducer';
import type { DecisionAction, DecisionInput, Recommendation } from '../../../domain/types';
import { formatTime } from '../../../domain/clock';
import { Chip } from '../../supporting/Chip/Chip';
import { ConfirmDialog } from '../../supporting/ConfirmDialog/ConfirmDialog';
import { ReasonDialog } from '../../supporting/ReasonDialog/ReasonDialog';
import { CheckIcon, LockIcon, WarningIcon } from '../shared/icons';
import { ACTION_LABELS, TIER_LABELS } from '../shared/labels';
import styles from './DecisionBar.module.css';

export interface RecordedDecision {
  at: string;
  /** "Approved", "Dismissed"… */
  summary: string;
  outcome: string;
}

export interface DecisionBarProps {
  recommendation: Recommendation | null;
  gate: GateResult | null;
  draft: DecisionDraft | null;
  /** From decisionInputError(); null when the draft is complete. */
  inputError: string | null;
  recorded?: RecordedDecision | null;
  onStart: (action: DecisionAction) => void;
  onInput: (input: Partial<DecisionInput>) => void;
  onCancel: () => void;
  onSubmit: () => void;
  onViewAudit?: () => void;
}

const ACTIONS: DecisionAction[] = ['approve', 'modify', 'dismiss', 'escalate'];

export function DecisionBar({
  recommendation: rec,
  gate,
  draft,
  inputError,
  recorded,
  onStart,
  onInput,
  onCancel,
  onSubmit,
  onViewAudit,
}: DecisionBarProps) {
  const baseId = useId();
  const buttonRefs = useRef<Partial<Record<DecisionAction, HTMLButtonElement | null>>>({});
  const recordedRef = useRef<HTMLParagraphElement>(null);
  const previousDraft = useRef<DecisionDraft | null>(draft);
  const previousRecordedAt = useRef<string | undefined>(recorded?.at);

  // Focus management when a dialog closes (Implementation Plan, section 7):
  // cancelled → back to the button that opened it; recorded → to the confirmation.
  // Runs after the dialog's own focus restoration, so this placement wins.
  useEffect(() => {
    const closed = previousDraft.current && !draft;
    const newlyRecorded = recorded?.at !== undefined && recorded.at !== previousRecordedAt.current;
    if (closed) {
      const action = previousDraft.current!.action;
      const target = newlyRecorded ? recordedRef.current : buttonRefs.current[action];
      const timer = window.setTimeout(() => target?.focus(), 0);
      previousDraft.current = draft;
      previousRecordedAt.current = recorded?.at;
      return () => window.clearTimeout(timer);
    }
    previousDraft.current = draft;
    previousRecordedAt.current = recorded?.at;
  }, [draft, recorded?.at]);

  const changeReasonId = `${baseId}-change-reason`;
  const rejectReasonId = `${baseId}-reject-reason`;
  const titleId = `${baseId}-title`;

  const changeReason = gate && !gate.approve.allowed ? gate.approve.reason : undefined;
  const rejectReason = gate && !gate.dismiss.allowed ? gate.dismiss.reason : undefined;
  const sharedReason = Boolean(changeReason) && changeReason === rejectReason;
  const reasonIdFor = (action: DecisionAction) =>
    action === 'approve' || action === 'modify' || sharedReason
      ? changeReason && changeReasonId
      : rejectReason && rejectReasonId;

  return (
    <section className={styles.bar} aria-labelledby={titleId}>
      <div className={styles.mainRow}>
        <div className={styles.subject}>
          <h2 className={styles.heading} id={titleId}>
            <span className={styles.eyebrowText}>Deciding on</span>{' '}
            <span className={styles.title}>{rec ? rec.title : 'No recommendation selected'}</span>
          </h2>
          {rec && (
            <div className={styles.context}>
              <Chip
                surface="dark"
                tone={rec.riskTier === 'consequential' ? 'caution' : 'neutral'}
                icon={rec.riskTier === 'consequential' ? <WarningIcon /> : undefined}
              >
                {TIER_LABELS[rec.riskTier]}
              </Chip>
              <span className={styles.impact}>{rec.impact}</span>
            </div>
          )}
        </div>

        <div className={styles.actions} role="group" aria-label={rec ? `Decision on: ${rec.title}` : 'Decision'}>
          {ACTIONS.map((action) => {
            const allowed = Boolean(rec && gate?.[action].allowed);
            return (
              <button
                key={action}
                ref={(el) => {
                  buttonRefs.current[action] = el;
                }}
                type="button"
                className={styles.action}
                data-primary={action === 'approve' || undefined}
                aria-disabled={!allowed}
                aria-describedby={allowed ? undefined : reasonIdFor(action) || undefined}
                onClick={() => allowed && onStart(action)}
              >
                {!allowed && <LockIcon />}
                {ACTION_LABELS[action]}
              </button>
            );
          })}
        </div>
      </div>

      <div className={styles.controls}>
        {(changeReason || rejectReason) && (
          <div className={styles.reasons}>
            {changeReason && changeReason === rejectReason ? (
              // One reason blocks everything (already decided, waiting for analysis): say it once.
              <p id={changeReasonId}>
                <strong>All actions unavailable:</strong> {changeReason}
              </p>
            ) : (
              <>
                {changeReason && (
                  <p id={changeReasonId}>
                    <strong>Approve and Modify unavailable:</strong> {changeReason}
                  </p>
                )}
                {rejectReason && (
                  <p id={rejectReasonId}>
                    <strong>Dismiss and Escalate unavailable:</strong> {rejectReason}
                  </p>
                )}
              </>
            )}
          </div>
        )}
        {gate?.warning && !changeReason && (
          <p className={styles.warning}>
            <WarningIcon /> {gate.warning}
          </p>
        )}
      </div>

      <div role="status" aria-live="polite" className={styles.status}>
        {recorded && (
          <p className={styles.recorded} ref={recordedRef} tabIndex={-1}>
            <CheckIcon />
            <span>
              <strong>
                {recorded.summary} at {formatTime(recorded.at)}.
              </strong>{' '}
              {recorded.outcome}{' '}
              {onViewAudit && (
                <button type="button" className={styles.link} onClick={onViewAudit}>
                  View in audit trail
                </button>
              )}
            </span>
          </p>
        )}
      </div>

      {rec && gate && draft && draft.recommendationId === rec.id && (
        <>
          {(draft.action === 'approve' || draft.action === 'modify') && (
            <ConfirmDialog
              mode={draft.action}
              recommendation={rec}
              gate={gate}
              input={draft.input}
              inputError={inputError}
              onInput={onInput}
              onCancel={onCancel}
              onSubmit={onSubmit}
            />
          )}
          {(draft.action === 'dismiss' || draft.action === 'escalate') && (
            <ReasonDialog
              mode={draft.action}
              recommendation={rec}
              input={draft.input}
              inputError={inputError}
              onInput={onInput}
              onCancel={onCancel}
              onSubmit={onSubmit}
            />
          )}
        </>
      )}
    </section>
  );
}
