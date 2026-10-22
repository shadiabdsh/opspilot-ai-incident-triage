/**
 * ConfidenceIndicator shows a categorical band (High, Medium, Low) and its reason.
 *
 * Never a percentage: pre-authored or generated numbers imply precision nobody has.
 * The band survives grayscale and colour-blind use because it is carried by the word
 * and by how many of the three segments are filled (3 / 2 / 1). The reason is always
 * visible, never hidden in a tooltip.
 */
import type { Confidence } from '../../../domain/types';
import { CONFIDENCE_LABELS } from '../shared/labels';
import styles from './ConfidenceIndicator.module.css';

export interface ConfidenceIndicatorProps {
  band: Confidence;
  reason: string;
  /** Styling only: 'inline' places the reason beside the band (hypothesis header). */
  layout?: 'stacked' | 'inline';
}

const FILLED: Record<Confidence, number> = { high: 3, medium: 2, low: 1 };

export function ConfidenceIndicator({ band, reason, layout = 'stacked' }: ConfidenceIndicatorProps) {
  const label = CONFIDENCE_LABELS[band];
  return (
    <div className={styles.root} data-band={band} data-layout={layout} role="group" aria-label={`Confidence: ${label}`}>
      <div className={styles.row}>
        <span className={styles.segments} aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <span key={i} className={i < FILLED[band] ? styles.filled : styles.empty} />
          ))}
        </span>
        <span className={styles.word}>
          {label} confidence
        </span>
      </div>
      <p className={styles.reason}>{reason}</p>
    </div>
  );
}
