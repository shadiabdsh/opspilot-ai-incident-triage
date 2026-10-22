/**
 * Data-source availability, shown in Observed facts when a source could not be read.
 * A factual statement about what we do not have, so absence of events is not mistaken
 * for evidence that nothing happened. Renders nothing when every source was read.
 */
import type { DataSourceCheck } from '../../../domain/types';
import { QuestionIcon } from '../../signature/shared/icons';
import styles from './SourceAvailability.module.css';

export function SourceAvailability({ sources }: { sources: DataSourceCheck[] }) {
  const missing = sources.filter((s) => s.status === 'unavailable');
  if (missing.length === 0) return null;
  return (
    <div className={styles.notice}>
      <h3 className={styles.title}>Source availability</h3>
      <ul className={styles.list}>
        {missing.map((s) => (
          <li key={s.source}>
            <QuestionIcon />
            <span>
              <strong>{s.label}:</strong> not retrieved.
            </span>
          </li>
        ))}
      </ul>
      <p className={styles.explain}>
        Events from {missing.length === 1 ? 'this source are' : 'these sources are'} missing from the timeline because
        they could not be read, not because none occurred.
      </p>
    </div>
  );
}
