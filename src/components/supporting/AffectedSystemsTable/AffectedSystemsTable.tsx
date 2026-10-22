/**
 * Affected systems: observed state only. The 12 workstations collapse into one group row.
 * Rows highlight when the trace points at their system; a collapsed group highlights as a whole.
 */
import { useId } from 'react';
import { formatTime } from '../../../domain/clock';
import type { System } from '../../../domain/types';
import { useOptionalTrace } from '../../../state/TraceProvider';
import { ChevronIcon } from '../../signature/shared/icons';
import { SYSTEM_KIND_LABELS, SYSTEM_STATE_LABELS } from '../labels';
import styles from './AffectedSystemsTable.module.css';

export interface AffectedSystemsTableProps {
  /** Systems grouped as one row (the Building A workstations). */
  group: { label: string; systems: System[] };
  /** Related systems listed individually (NPS server, printer, switch). */
  related: System[];
  groupExpanded: boolean;
  onToggleGroup: () => void;
}

function lastSeenRange(systems: System[]): string {
  const times = systems.map((s) => s.lastSeen).sort();
  const first = times[0];
  const last = times.at(-1);
  if (!first || !last) return '';
  return first === last ? formatTime(first) : `${formatTime(first)}–${formatTime(last)}`;
}

export function AffectedSystemsTable({ group, related, groupExpanded, onToggleGroup }: AffectedSystemsTableProps) {
  const groupBodyId = useId();
  const traced = useOptionalTrace()?.highlightedSystemId ?? null;
  const groupHasTraced = traced !== null && group.systems.some((s) => s.id === traced);
  const groupStates = new Set(group.systems.map((s) => s.state));
  const groupState = groupStates.size === 1 ? SYSTEM_STATE_LABELS[group.systems[0]!.state] : 'Mixed';

  const row = (s: System) => (
    <tr key={s.id} data-active={traced === s.id || undefined} data-state={s.state}>
      <th scope="row">
        <span className={styles.id}>{s.id}</span>
      </th>
      <td>{SYSTEM_KIND_LABELS[s.kind]}</td>
      <td className={styles.state}>{SYSTEM_STATE_LABELS[s.state]}</td>
      <td className={styles.time}>{formatTime(s.lastSeen)}</td>
    </tr>
  );

  return (
    <table className={styles.table}>
      <caption className="visually-hidden">Affected and related systems</caption>
      <thead>
        <tr>
          <th scope="col">System</th>
          <th scope="col">Role</th>
          <th scope="col">State</th>
          <th scope="col">Last seen</th>
        </tr>
      </thead>
      <tbody>
        <tr className={styles.groupRow} data-active={(groupHasTraced && !groupExpanded) || undefined} data-state="offline">
          <th scope="row">
            <button
              type="button"
              className={styles.groupToggle}
              aria-expanded={groupExpanded}
              aria-controls={groupBodyId}
              onClick={onToggleGroup}
            >
              <ChevronIcon open={groupExpanded} />
              {group.label} ({group.systems.length})
            </button>
          </th>
          <td>{SYSTEM_KIND_LABELS[group.systems[0]?.kind ?? 'workstation']}s</td>
          <td className={styles.state}>{groupState}</td>
          <td className={styles.time}>{lastSeenRange(group.systems)}</td>
        </tr>
      </tbody>
      <tbody id={groupBodyId} hidden={!groupExpanded} className={styles.groupBody}>
        {group.systems.map(row)}
      </tbody>
      <tbody>{related.map(row)}</tbody>
    </table>
  );
}
