/** Incident status. Neutral except Decided, so status never competes with severity. */
import type { IncidentStatus } from '../../../domain/types';
import { INCIDENT_STATUS_LABELS } from '../labels';
import styles from './StatusPill.module.css';

export function StatusPill({ status }: { status: IncidentStatus }) {
  return (
    <span className={styles.pill} data-status={status}>
      <span className="visually-hidden">Status: </span>
      {INCIDENT_STATUS_LABELS[status]}
    </span>
  );
}
