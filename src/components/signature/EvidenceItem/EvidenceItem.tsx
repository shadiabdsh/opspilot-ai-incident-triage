/**
 * EvidenceItem ties an AI inference to one observed event. It is where the trace starts:
 * hovering or keyboard-focusing it highlights the event and its system elsewhere on the
 * page (via TraceProvider), and "Show source" asks the screen to jump to the event.
 *
 * Supporting and counter-evidence differ by label and rule style (solid / dashed), not
 * only by colour. Counter-evidence carries a one-line, Inferred-tagged explanation.
 */
import { useId, type FocusEvent } from 'react';
import { formatTimeWithSeconds } from '../../../domain/clock';
import type { OpsEvent, Statement, System } from '../../../domain/types';
import { useOptionalTrace } from '../../../state/TraceProvider';
import { ProvenanceTag } from '../ProvenanceTag/ProvenanceTag';
import { ArrowRightIcon, SourceIcon } from '../shared/icons';
import { SOURCE_LABELS } from '../shared/labels';
import styles from './EvidenceItem.module.css';

export interface EvidenceItemProps {
  event: OpsEvent;
  system?: System;
  /** Whether the event supports or counters the inference. */
  stance: 'supporting' | 'counter';
  /** Counter-evidence: why this observation does or does not weaken the hypothesis. */
  explanation?: Statement;
  onShowSource?: (eventId: string) => void;
  /** Set by the screen when the source event is outside the viewport. */
  offscreen?: 'above' | 'below';
  /** Inside a frozen audit snapshot: no controls, no trace, no ids. */
  readOnly?: boolean;
  /** Forces the trace highlight (gallery and tests). Otherwise read from TraceProvider. */
  traceActive?: boolean;
}

export function EvidenceItem({
  event,
  system,
  stance,
  explanation,
  onShowSource,
  offscreen,
  readOnly = false,
  traceActive,
}: EvidenceItemProps) {
  const trace = useOptionalTrace();
  const describedById = useId();
  const tracing = !readOnly && trace !== null;
  const active = traceActive ?? (tracing && trace.activeEventId === event.id);
  // An explicit prop wins (gallery); otherwise the trace reports where the source row is.
  const sourceHint = offscreen ?? (active && tracing ? trace.activeSourcePosition : undefined);
  const time = formatTimeWithSeconds(event.timestamp);

  const activate = () => tracing && trace.setActiveEventId(event.id);
  const deactivate = () => {
    if (tracing && trace.activeEventId === event.id) trace.setActiveEventId(null);
  };
  const onBlur = (e: FocusEvent<HTMLLIElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) deactivate();
  };

  return (
    <li
      className={styles.item}
      data-stance={stance}
      data-active={active || undefined}
      onMouseEnter={tracing ? activate : undefined}
      onMouseLeave={tracing ? deactivate : undefined}
      onFocus={tracing ? activate : undefined}
      onBlur={tracing ? onBlur : undefined}
    >
      <span className={styles.sourceIcon} aria-hidden="true">
        <SourceIcon source={event.source} />
      </span>

      <div className={styles.body}>
        <div className={styles.meta}>
          <span className={styles.role}>{stance === 'supporting' ? 'Supports' : 'Counter-evidence'}</span>
          <time className={styles.time} dateTime={event.timestamp}>
            {time}
          </time>
          <span className={styles.system} title={system?.name}>
            {event.systemId}
          </span>
          <ProvenanceTag kind="observed" source={SOURCE_LABELS[event.source]} />
        </div>

        <p className={styles.message} id={readOnly ? undefined : describedById}>
          <samp>{event.message}</samp>
        </p>

        {explanation && (
          <p className={styles.explanation}>
            <ProvenanceTag kind="inferred" />
            <span>{explanation.text}</span>
          </p>
        )}
      </div>

      {!readOnly && onShowSource && (
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.showSource}
            aria-label={`Show source: ${time}, ${event.systemId}`}
            aria-describedby={describedById}
            onClick={() => onShowSource(event.id)}
          >
            Show source
            <ArrowRightIcon />
          </button>
          {sourceHint && (
            <span className={styles.hint}>Source {sourceHint === 'above' ? 'above ↑' : 'below ↓'}</span>
          )}
        </div>
      )}
    </li>
  );
}
