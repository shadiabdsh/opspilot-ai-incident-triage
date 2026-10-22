/** Every decision and system line on this incident, newest first. */
import type { AuditEntry as AuditEntryData, OpsEvent, System } from '../domain/types';
import { AuditEntry } from '../components/signature/AuditEntry/AuditEntry';
import styles from './AuditTab.module.css';

export interface AuditTabProps {
  entries: AuditEntryData[];
  eventsById: Record<string, OpsEvent>;
  systemsById: Record<string, System>;
}

export function AuditTab({ entries, eventsById, systemsById }: AuditTabProps) {
  const newestFirst = [...entries].reverse();
  return (
    <div className={styles.wrap}>
      <h2 className={styles.heading}>Audit trail</h2>
      <p className={styles.lede}>
        Newest first and append-only. Decisions are listed with the analysis they were made against; events
        record what changed around them.
      </p>
      {newestFirst.length === 0 ? (
        <p className={styles.empty}>No decisions yet. Decisions on this incident will appear here.</p>
      ) : (
        <ol className={styles.list}>
          {newestFirst.map((entry) => (
            <li key={entry.id}>
              <AuditEntry entry={entry} eventsById={eventsById} systemsById={systemsById} />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
