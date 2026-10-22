/**
 * Confirms an Approve or Modify. Restates action, impact and rollback; for consequential
 * actions the user must type the target system's name. Submission stays aria-disabled
 * (focusable, reason announced) until the input is complete.
 */
import * as Dialog from '@radix-ui/react-dialog';
import { useId, useRef, useState } from 'react';
import type { GateResult } from '../../../domain/gate';
import type { DecisionInput, Recommendation } from '../../../domain/types';
import { WarningIcon } from '../../signature/shared/icons';
import { TIER_LABELS } from '../../signature/shared/labels';
import { ActionEditor } from '../ActionEditor/ActionEditor';
import styles from '../Dialog/Dialog.module.css';

export interface ConfirmDialogProps {
  mode: 'approve' | 'modify';
  recommendation: Recommendation;
  gate: GateResult;
  input: DecisionInput;
  inputError: string | null;
  onInput: (input: Partial<DecisionInput>) => void;
  onCancel: () => void;
  onSubmit: () => void;
}

export function ConfirmDialog({ mode, recommendation: rec, gate, input, inputError, onInput, onCancel, onSubmit }: ConfirmDialogProps) {
  const baseId = useId();
  const [attempted, setAttempted] = useState(false);
  const typedRef = useRef<HTMLInputElement>(null);
  const consequential = rec.riskTier === 'consequential';
  const flag = gate[mode].flag;

  const submitLabel =
    mode === 'modify' ? 'Approve with changes' : consequential ? 'Approve and create change request' : 'Approve';

  const handleSubmit = () => {
    if (inputError) {
      setAttempted(true);
      typedRef.current?.focus();
      return;
    }
    onSubmit();
  };

  return (
    <Dialog.Root open onOpenChange={(open) => !open && onCancel()}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={styles.content}>
          <Dialog.Title className={styles.title}>
            {mode === 'modify' ? 'Modify and approve' : 'Approve'}: {rec.title}
          </Dialog.Title>
          <Dialog.Description className={styles.description}>
            {consequential
              ? 'Approval creates a change request (mock). Nothing runs from OpsPilot.'
              : 'Approval creates a task (mock). Nothing runs from OpsPilot.'}
          </Dialog.Description>

          <dl className={styles.facts}>
            <div>
              <dt>Risk</dt>
              <dd>{TIER_LABELS[rec.riskTier]}</dd>
            </div>
            <div>
              <dt>Impact</dt>
              <dd>{rec.impact}</dd>
            </div>
            {rec.rollback && (
              <div>
                <dt>Rollback</dt>
                <dd>{rec.rollback}</dd>
              </div>
            )}
          </dl>

          {gate.warning && (
            <p className={styles.note} role="note">
              <WarningIcon />
              <span>{gate.warning}</span>
            </p>
          )}
          {flag === 'acknowledged_stale' && (
            <p className={styles.note} role="note">
              <WarningIcon />
              <span>This decision will be flagged in the audit trail: made on acknowledged out-of-date analysis.</span>
            </p>
          )}

          {mode === 'modify' && (
            <ActionEditor
              original={rec.params}
              value={input.modifiedParams ?? rec.params}
              onChange={(modifiedParams) => onInput({ modifiedParams })}
            />
          )}

          {gate.requiresTypedConfirm && (
            <div className={styles.field}>
              <label htmlFor={`${baseId}-typed`}>
                Type <code>{rec.confirmText}</code> to confirm
              </label>
              <input
                ref={typedRef}
                id={`${baseId}-typed`}
                className={`${styles.input} ${styles.typed}`}
                autoComplete="off"
                spellCheck={false}
                value={input.typedConfirmation ?? ''}
                aria-invalid={attempted && inputError !== null}
                aria-describedby={`${baseId}-hint`}
                onChange={(e) => onInput({ typedConfirmation: e.target.value })}
              />
            </div>
          )}

          <p id={`${baseId}-hint`} className={styles.hint} data-error={(attempted && inputError) || undefined} aria-live="polite">
            {inputError ?? 'Ready to confirm.'}
          </p>

          <div className={styles.footer}>
            <Dialog.Close asChild>
              <button type="button" className={styles.button}>
                Cancel
              </button>
            </Dialog.Close>
            <button
              type="button"
              className={`${styles.button} ${styles.primary}`}
              aria-disabled={inputError !== null}
              aria-describedby={`${baseId}-hint`}
              onClick={handleSubmit}
            >
              {submitLabel}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
