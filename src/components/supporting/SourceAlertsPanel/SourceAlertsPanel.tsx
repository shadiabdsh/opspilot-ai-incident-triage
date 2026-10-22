/**
 * Full list of the raw alerts the AI grouped into one incident, in a side panel.
 * Read-only: this is for checking the grouping, not for investigating.
 * Radix Dialog provides the focus trap, Escape to close and focus return to the trigger.
 */
import * as Dialog from '@radix-ui/react-dialog';
import type { ReactNode } from 'react';
import { formatTimeWithSeconds } from '../../../domain/clock';
import type { OpsEvent } from '../../../domain/types';
import { SOURCE_LABELS } from '../../signature/shared/labels';
import styles from './SourceAlertsPanel.module.css';

export interface SourceAlertsPanelProps {
  incidentId: string;
  alerts: OpsEvent[];
  /** The button that opens the panel; focus returns to it on close. */
  trigger: ReactNode;
}

export function SourceAlertsPanel({ incidentId, alerts, trigger }: SourceAlertsPanelProps) {
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={styles.panel}>
          <div className={styles.head}>
            <Dialog.Title className={styles.title}>
              Source alerts for <span className={styles.mono}>{incidentId}</span>
            </Dialog.Title>
            <Dialog.Close asChild>
              <button type="button" className={styles.close}>
                Close
              </button>
            </Dialog.Close>
          </div>
          <Dialog.Description className={styles.description}>
            {alerts.length} raw alerts that OpsPilot grouped into this incident, exactly as monitoring reported them.
          </Dialog.Description>
          {/* The list scrolls inside the panel, so it must be reachable and scrollable by
              keyboard (WCAG 2.1.1): a named, focusable region. */}
          {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
          <div className={styles.tableWrap} role="region" aria-label="Source alerts list" tabIndex={0}>
            <table className={styles.table}>
              <caption className="visually-hidden">Source alerts, oldest first</caption>
              <thead>
                <tr>
                  <th scope="col">System</th>
                  <th scope="col">Time</th>
                  <th scope="col">Source</th>
                  <th scope="col">Message</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((a) => (
                  <tr key={a.id}>
                    <th scope="row" className={styles.mono}>
                      {a.systemId}
                    </th>
                    <td className={styles.mono}>
                      <time dateTime={a.timestamp}>{formatTimeWithSeconds(a.timestamp)}</time>
                    </td>
                    <td>{SOURCE_LABELS[a.source]}</td>
                    <td className={styles.message}>
                      <samp>{a.message}</samp>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
