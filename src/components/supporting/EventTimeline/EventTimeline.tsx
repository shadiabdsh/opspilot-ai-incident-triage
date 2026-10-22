/**
 * Event timeline: raw events exactly as the source systems reported them, oldest first.
 * No AI wording appears here; the only AI-related marker is a count of how many AI
 * statements cite an event (the reverse trace).
 *
 * Every event is shown. Events the AI cites get more emphasis; routine, uncited events are
 * quieter and tighter. At narrow widths long raw messages truncate to one line; a truncated
 * message gets an Expand button, so keyboard users can reveal it too.
 *
 * Each row can receive programmatic focus (tabIndex -1) when "Show source" jumps to it,
 * and then offers "Back to evidence".
 */
import { useEffect, useRef, useState } from 'react';
import { formatTimeWithSeconds } from '../../../domain/clock';
import type { OpsEvent } from '../../../domain/types';
import { eventRowId, useOptionalTrace } from '../../../state/TraceProvider';
import { ChevronIcon, SparkIcon } from '../../signature/shared/icons';
import { SOURCE_LABELS } from '../../signature/shared/labels';
import styles from './EventTimeline.module.css';

export interface EventTimelineProps {
  events: OpsEvent[];
  citedCounts: Record<string, number>;
  newSinceIds?: Set<string>;
  onBackToEvidence: () => void;
}

const sameSet = (a: Set<string>, b: Set<string>) => a.size === b.size && [...a].every((x) => b.has(x));

export function EventTimeline({ events, citedCounts, newSinceIds, onBackToEvidence }: EventTimelineProps) {
  const trace = useOptionalTrace();
  const shownSourceId = trace?.returnPoint?.eventId;
  const listRef = useRef<HTMLOListElement>(null);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [truncated, setTruncated] = useState<Set<string>>(() => new Set());

  // Which messages are visually truncated right now (only happens at narrow widths).
  useEffect(() => {
    const list = listRef.current;
    if (!list || typeof ResizeObserver === 'undefined') return;
    const measure = () => {
      setTruncated((previous) => {
        const next = new Set<string>();
        list.querySelectorAll<HTMLElement>('[data-message-for]').forEach((el) => {
          const id = el.dataset.messageFor!;
          // A revealed message (expanded, traced or focused) is not truncated right now;
          // keep its previous state so its button does not disappear while revealed.
          const row = el.closest('li');
          const revealed = expanded.has(id) || Boolean(row?.matches('[data-active], :focus'));
          if (revealed ? previous.has(id) : el.scrollWidth > el.clientWidth + 1) next.add(id);
        });
        return sameSet(previous, next) ? previous : next;
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    return () => observer.disconnect();
  }, [events, expanded]);

  const toggle = (id: string) =>
    setExpanded((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <ol ref={listRef} className={styles.timeline}>
      {events.map((e) => {
        const cited = citedCounts[e.id] ?? 0;
        const isShownSource = shownSourceId === e.id;
        const active = trace?.activeEventId === e.id || isShownSource;
        const time = formatTimeWithSeconds(e.timestamp);
        const isExpanded = expanded.has(e.id);
        return (
          <li
            key={e.id}
            id={eventRowId(e.id)}
            tabIndex={-1}
            className={styles.row}
            data-active={active || undefined}
            data-severity={e.severity}
            data-cited={cited > 0 || undefined}
            data-expanded={isExpanded || undefined}
          >
            <div className={styles.meta}>
              <time dateTime={e.timestamp} className={styles.time}>
                {time}
              </time>
              <span className={styles.source}>{SOURCE_LABELS[e.source]}</span>
              <span className={styles.system}>{e.systemId}</span>
              {newSinceIds?.has(e.id) && <span className={styles.new}>New since analysis</span>}
              {cited > 0 && (
                <span className={styles.cited}>
                  <SparkIcon />
                  Cited by AI ({cited})
                </span>
              )}
            </div>
            <div className={styles.messageRow}>
              <p className={styles.message}>
                {/* Visually truncated at narrow widths; the full text stays in the DOM for assistive tech. */}
                <samp data-message-for={e.id} title={e.message}>
                  {e.message}
                </samp>
              </p>
              {(truncated.has(e.id) || isExpanded) && (
                <button
                  type="button"
                  className={styles.expand}
                  aria-expanded={isExpanded}
                  aria-label={`${isExpanded ? 'Collapse' : 'Expand'} message: ${time}, ${e.systemId}`}
                  onClick={() => toggle(e.id)}
                >
                  <ChevronIcon open={isExpanded} />
                  {isExpanded ? 'Collapse' : 'Expand'}
                </button>
              )}
            </div>
            {isShownSource && (
              <button type="button" className={styles.back} onClick={onBackToEvidence}>
                Back to evidence
              </button>
            )}
          </li>
        );
      })}
    </ol>
  );
}
