/** Severity is the only place severity colours appear. Word plus colour, never colour alone. */
import type { Severity } from '../../../domain/types';
import { SEVERITY_LABELS } from '../labels';
import styles from './SeverityBadge.module.css';

export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <span className={styles.badge} data-severity={severity}>
      <span className="visually-hidden">Severity: </span>
      {SEVERITY_LABELS[severity]}
    </span>
  );
}
