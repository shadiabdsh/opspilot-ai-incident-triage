/**
 * Collects the required reason for Dismiss, or the team and note for Escalate.
 * Neither action changes any system, and neither is blocked by confidence or staleness.
 */
import * as Dialog from '@radix-ui/react-dialog';
import { useId, useRef, useState } from 'react';
import type { DecisionInput, Recommendation } from '../../../domain/types';
import { ESCALATION_TEAMS } from '../../signature/shared/labels';
import styles from '../Dialog/Dialog.module.css';

export interface ReasonDialogProps {
  mode: 'dismiss' | 'escalate';
  recommendation: Recommendation;
  input: DecisionInput;
  inputError: string | null;
  onInput: (input: Partial<DecisionInput>) => void;
  onCancel: () => void;
  onSubmit: () => void;
}

const PRESETS = ['Not the cause', 'Already handled', 'Not needed now', 'Other'] as const;

type InvalidField = 'preset' | 'details' | 'team' | 'note';

export function ReasonDialog({ mode, recommendation: rec, input, inputError, onInput, onCancel, onSubmit }: ReasonDialogProps) {
  const baseId = useId();
  const [attempted, setAttempted] = useState(false);
  const [preset, setPreset] = useState<string>('');
  const [details, setDetails] = useState('');
  const firstPresetRef = useRef<HTMLInputElement>(null);
  const detailsRef = useRef<HTMLTextAreaElement>(null);
  const teamRef = useRef<HTMLSelectElement>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);

  /** The first field that is actually incomplete, in visual order. */
  const firstInvalidField = (): InvalidField | null => {
    if (inputError === null) return null;
    if (mode === 'dismiss') {
      if (!preset) return 'preset';
      if (preset === 'Other' && !details.trim()) return 'details';
      return null;
    }
    if (!(input.team ?? '').trim()) return 'team';
    if (!(input.note ?? '').trim()) return 'note';
    return null;
  };
  // Marked only after a submit attempt, and recomputed live so it clears as the user fixes it.
  const invalidField = attempted ? firstInvalidField() : null;
  const hintId = `${baseId}-hint`;
  /** Props that tie a field to the visible error while it is the invalid one. */
  const errorProps = (field: InvalidField) =>
    invalidField === field ? { 'aria-invalid': true as const, 'aria-describedby': hintId } : {};

  const updateReason = (nextPreset: string, nextDetails: string) => {
    // The chosen option is always part of the recorded reason ("Other: …" included), so the
    // audit shows both what was picked and why. "Other" without details stays empty (invalid).
    const details = nextDetails.trim();
    const reason =
      !nextPreset ? details : nextPreset === 'Other' ? (details ? `Other: ${details}` : '') : details ? `${nextPreset}: ${details}` : nextPreset;
    onInput({ reason });
  };

  const handleSubmit = () => {
    if (inputError) {
      setAttempted(true);
      const refs = { preset: firstPresetRef, details: detailsRef, team: teamRef, note: noteRef };
      const field = firstInvalidField();
      (field ? refs[field].current : firstPresetRef.current ?? teamRef.current)?.focus();
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
            {mode === 'dismiss' ? 'Dismiss' : 'Escalate'}: {rec.title}
          </Dialog.Title>
          <Dialog.Description className={styles.description}>
            {mode === 'dismiss'
              ? 'No action is taken. Your reason is recorded in the audit trail.'
              : 'The receiving team gets this recommendation and the current analysis. No action is taken here.'}
          </Dialog.Description>

          {mode === 'dismiss' ? (
            <>
              <fieldset className={styles.fieldset} aria-describedby={invalidField === 'preset' ? hintId : undefined}>
                <legend className={styles.legend}>Reason</legend>
                {PRESETS.map((p, i) => (
                  <label key={p} className={styles.option}>
                    <input
                      ref={i === 0 ? firstPresetRef : undefined}
                      type="radio"
                      name={`${baseId}-preset`}
                      checked={preset === p}
                      onChange={() => {
                        setPreset(p);
                        updateReason(p, details);
                      }}
                    />
                    {p}
                  </label>
                ))}
              </fieldset>
              <div className={styles.field}>
                <label htmlFor={`${baseId}-details`}>Details {preset === 'Other' ? '(required)' : '(optional)'}</label>
                <textarea
                  ref={detailsRef}
                  id={`${baseId}-details`}
                  className={styles.textarea}
                  value={details}
                  {...errorProps('details')}
                  onChange={(e) => {
                    setDetails(e.target.value);
                    updateReason(preset, e.target.value);
                  }}
                />
              </div>
            </>
          ) : (
            <>
              <div className={styles.field}>
                <label htmlFor={`${baseId}-team`}>Team</label>
                <select
                  ref={teamRef}
                  id={`${baseId}-team`}
                  className={styles.select}
                  value={input.team ?? ''}
                  {...errorProps('team')}
                  onChange={(e) => onInput({ team: e.target.value })}
                >
                  <option value="">Choose a team</option>
                  {ESCALATION_TEAMS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div className={styles.field}>
                <label htmlFor={`${baseId}-note`}>Note for the receiving team</label>
                <textarea
                  ref={noteRef}
                  id={`${baseId}-note`}
                  className={styles.textarea}
                  value={input.note ?? ''}
                  {...errorProps('note')}
                  onChange={(e) => onInput({ note: e.target.value })}
                />
              </div>
            </>
          )}

          <p id={hintId} className={styles.hint} data-error={invalidField ? true : undefined} aria-live="polite">
            {inputError ?? 'Ready to submit.'}
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
              aria-describedby={hintId}
              onClick={handleSubmit}
            >
              {mode === 'dismiss' ? 'Dismiss recommendation' : 'Escalate'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
