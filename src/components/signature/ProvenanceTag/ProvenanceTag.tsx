/**
 * ProvenanceTag marks how OpsPilot knows something: Observed, Inferred or Unknown.
 *
 * Meaning is carried three ways so it survives without colour or icons:
 * the word itself, the border style (solid / dashed / dotted), and the accessible name.
 * An Inferred tag can be a toggle that exposes the evidence behind the statement.
 */
import type { Provenance } from '../../../domain/types';
import { EyeIcon, QuestionIcon, SparkIcon, ChevronIcon } from '../shared/icons';
import styles from './ProvenanceTag.module.css';

export interface ProvenanceTagProps {
  kind: Provenance;
  /** Observed: where the fact came from, for example "NPS log". */
  source?: string;
  /** Inferred: how many evidence items support the statement. */
  evidenceCount?: number;
  /** Inferred only. When provided, the tag becomes a button that shows or hides evidence. */
  onToggle?: () => void;
  expanded?: boolean;
  /** Id of the evidence region the toggle controls. */
  controlsId?: string;
}

const VISIBLE_LABEL: Record<Provenance, string> = {
  observed: 'Observed',
  inferred: 'Inferred',
  unknown: 'Unknown',
};

const ICON: Record<Provenance, () => JSX.Element> = {
  observed: EyeIcon,
  inferred: SparkIcon,
  unknown: QuestionIcon,
};

/** The full meaning, read by screen readers. Contains the visible words (WCAG 2.5.3). */
export function provenanceAccessibleName(kind: Provenance, source?: string, evidenceCount?: number): string {
  if (kind === 'observed') return source ? `Observed fact, source: ${source}` : 'Observed fact';
  if (kind === 'unknown') return 'Unknown: the AI could not determine this';
  const count =
    evidenceCount === undefined ? '' : `, ${evidenceCount} evidence ${evidenceCount === 1 ? 'item' : 'items'}`;
  return `Inferred by AI${count}`;
}

export function ProvenanceTag({ kind, source, evidenceCount, onToggle, expanded = false, controlsId }: ProvenanceTagProps) {
  const Icon = ICON[kind];
  const name = provenanceAccessibleName(kind, source, evidenceCount);
  const interactive = kind === 'inferred' && onToggle !== undefined;

  const visible = (
    <>
      <Icon />
      <span className={styles.label}>{VISIBLE_LABEL[kind]}</span>
      {kind === 'observed' && source && <span className={styles.detail}>{source}</span>}
      {kind === 'inferred' && evidenceCount !== undefined && (
        <span className={styles.detail}>{evidenceCount} evidence</span>
      )}
    </>
  );

  if (interactive) {
    return (
      <button
        type="button"
        className={styles.tag}
        data-kind={kind}
        data-interactive="true"
        aria-label={name}
        aria-expanded={expanded}
        aria-controls={controlsId}
        onClick={onToggle}
      >
        {visible}
        <ChevronIcon open={expanded} />
      </button>
    );
  }

  return (
    <span className={styles.tag} data-kind={kind}>
      <span aria-hidden="true" className={styles.visible}>
        {visible}
      </span>
      <span className="visually-hidden">{name}</span>
    </span>
  );
}
