/**
 * Analysis freshness at the top of AI assistance (UX Blueprint, section 4, stale scenario).
 *
 *   stale        prominent but calm: new events since the analysis; Re-run (primary) or Acknowledge
 *   analyzing    the re-run in progress
 *   acknowledged compact persistent notice; consequential actions still need a re-run
 *   refreshed    compact confirmation that the analysis now includes the new events
 *
 * Focus: the banner never takes focus when it first appears. If its own control disappears
 * while focused (Acknowledge confirmed, re-run finished), focus moves to the banner's message
 * instead of being lost to the page body.
 */
import * as Dialog from '@radix-ui/react-dialog';
import { useEffect, useId, useRef, useState } from 'react';
import { formatTime } from '../../../domain/clock';
import { CheckIcon, WarningIcon } from '../../signature/shared/icons';
import dialogStyles from '../Dialog/Dialog.module.css';
import styles from './StaleBanner.module.css';

export type StaleBannerMode = 'stale' | 'analyzing' | 'acknowledged' | 'refreshed';

export interface StaleBannerProps {
  mode: StaleBannerMode;
  newCount: number;
  /** Time of the analysis the banner is about (the out-of-date one, or the refreshed one). */
  analysisTime: string;
  onRerun: () => void;
  onAcknowledge: () => void;
}

export function StaleBanner({ mode, newCount, analysisTime, onRerun, onAcknowledge }: StaleBannerProps) {
  const messageRef = useRef<HTMLDivElement>(null);
  const previousMode = useRef(mode);
  const [ackOpen, setAckOpen] = useState(false);
  const titleId = useId();
  const time = formatTime(analysisTime);
  const events = `${newCount} new ${newCount === 1 ? 'event' : 'events'}`;

  useEffect(() => {
    if (previousMode.current === mode) return;
    previousMode.current = mode;
    // After the dialog's own focus restoration: if focus was lost with a removed control, catch it.
    const t = window.setTimeout(() => {
      const active = document.activeElement;
      if (!active || active === document.body || !active.isConnected) messageRef.current?.focus();
    }, 0);
    return () => window.clearTimeout(t);
  }, [mode]);

  if (mode === 'analyzing') {
    return (
      <div className={styles.banner} data-mode="analyzing" ref={messageRef} tabIndex={-1} role="group" aria-labelledby={titleId}>
        <p id={titleId} className={styles.title}>
          Re-running analysis with the {events}…
        </p>
        <div className={styles.progress} aria-hidden="true">
          <span />
        </div>
        <p className={styles.body}>Decisions are paused until the analysis is ready.</p>
      </div>
    );
  }

  if (mode === 'refreshed') {
    return (
      <div className={styles.compact} data-mode="refreshed" ref={messageRef} tabIndex={-1}>
        <CheckIcon />
        <p>
          <strong>Analysis updated at {time}.</strong> It now includes the {events}.
        </p>
      </div>
    );
  }

  if (mode === 'acknowledged') {
    return (
      <div className={styles.compact} data-mode="acknowledged" ref={messageRef} tabIndex={-1}>
        <WarningIcon />
        <p>
          <strong>Continuing with the {time} analysis.</strong> It does not include the {events}. Consequential actions
          still need a re-run.
        </p>
        <button type="button" className={styles.secondary} onClick={onRerun}>
          Re-run analysis
        </button>
      </div>
    );
  }

  return (
    <div className={styles.banner} data-mode="stale" ref={messageRef} tabIndex={-1} role="group" aria-labelledby={titleId}>
      <div className={styles.text}>
        <p id={titleId} className={styles.title}>
          <WarningIcon /> {events} since this analysis ({time}).
        </p>
        <p className={styles.body}>The conclusions below may be out of date.</p>
      </div>
      <div className={styles.actions}>
        <button type="button" className={styles.primary} onClick={onRerun}>
          Re-run analysis
        </button>
        <Dialog.Root open={ackOpen} onOpenChange={setAckOpen}>
          <Dialog.Trigger asChild>
            <button type="button" className={styles.secondary}>
              Acknowledge
            </button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className={dialogStyles.overlay} />
            <Dialog.Content className={dialogStyles.content}>
              <Dialog.Title className={dialogStyles.title}>Continue with the {time} analysis?</Dialog.Title>
              <Dialog.Description className={dialogStyles.description}>
                You are proceeding with an analysis that does not include the {events}.
              </Dialog.Description>
              <ul className={styles.consequences}>
                <li>Read-only and low-impact actions become available again, and any you approve are flagged in the audit trail.</li>
                <li>Consequential actions stay blocked until you re-run the analysis.</li>
                <li>You can re-run the analysis at any time.</li>
              </ul>
              <div className={dialogStyles.footer}>
                <Dialog.Close asChild>
                  <button type="button" className={dialogStyles.button}>
                    Cancel
                  </button>
                </Dialog.Close>
                <button
                  type="button"
                  className={`${dialogStyles.button} ${dialogStyles.primary}`}
                  onClick={() => {
                    setAckOpen(false);
                    onAcknowledge();
                  }}
                >
                  Acknowledge and continue
                </button>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </div>
    </div>
  );
}
