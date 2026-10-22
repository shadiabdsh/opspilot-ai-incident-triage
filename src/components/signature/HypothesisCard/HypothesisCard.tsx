/**
 * HypothesisCard: the AI's proposed cause, how confident it is and why, the evidence for
 * and against, and what it could not determine. Counter-evidence and unknowns are
 * never hidden; they can be collapsed but always show their count.
 *
 * readOnly renders the same content fully expanded with no controls, no trace and no ids,
 * for frozen snapshots inside AuditEntry.
 */
import { useId, useState, type ReactNode } from 'react';
import type { DataSourceCheck, Hypothesis, OpsEvent, System } from '../../../domain/types';
import { ConfidenceIndicator } from '../ConfidenceIndicator/ConfidenceIndicator';
import { EvidenceItem } from '../EvidenceItem/EvidenceItem';
import { ProvenanceTag } from '../ProvenanceTag/ProvenanceTag';
import { ChevronIcon } from '../shared/icons';
import { sourcesCheckedLine } from '../shared/labels';
import styles from './HypothesisCard.module.css';

export interface HypothesisCardProps {
  hypothesis: Hypothesis;
  eventsById: Record<string, OpsEvent>;
  systemsById: Record<string, System>;
  dataSources?: DataSourceCheck[];
  onShowSource?: (eventId: string) => void;
  readOnly?: boolean;
  /** Primary cards open expanded; alternatives start collapsed. */
  defaultExpanded?: boolean;
  headingLevel?: 3 | 4;
}

type SectionKey = 'supporting' | 'counter' | 'unknowns';

export function HypothesisCard({
  hypothesis,
  eventsById,
  systemsById,
  dataSources,
  onShowSource,
  readOnly = false,
  defaultExpanded,
  headingLevel = 3,
}: HypothesisCardProps) {
  const startOpen = readOnly || (defaultExpanded ?? hypothesis.rank === 'primary');
  const [open, setOpen] = useState<Record<SectionKey, boolean>>({
    supporting: startOpen,
    counter: startOpen,
    unknowns: startOpen,
  });
  const baseId = useId();
  const id = (part: string) => (readOnly ? undefined : `${baseId}-${part}`);
  const toggle = (key: SectionKey) => setOpen((o) => ({ ...o, [key]: !o[key] }));
  const Heading = headingLevel === 3 ? 'h3' : 'h4';
  const SubHeading = headingLevel === 3 ? 'h4' : 'h5';
  const isPrimary = hypothesis.rank === 'primary';

  const evidence = (eventId: string, stance: 'supporting' | 'counter', explanation?: Hypothesis['counter'][number]['explanation']) => {
    const event = eventsById[eventId];
    if (!event) return null; // fixtures are integrity-tested; this guards render only
    return (
      <EvidenceItem
        key={`${stance}-${eventId}`}
        event={event}
        system={systemsById[event.systemId]}
        stance={stance}
        explanation={explanation}
        onShowSource={onShowSource}
        readOnly={readOnly}
      />
    );
  };

  const section = (key: SectionKey, title: string, count: number, body: ReactNode) => (
    <section className={styles.section} data-section={key}>
      <SubHeading className={styles.sectionHeading}>
        {readOnly ? (
          <span className={styles.sectionLabel}>
            {title} <span className={styles.count}>({count})</span>
          </span>
        ) : (
          <button
            type="button"
            className={styles.sectionToggle}
            aria-expanded={open[key]}
            aria-controls={id(key)}
            onClick={() => toggle(key)}
          >
            <ChevronIcon open={open[key]} />
            {title} <span className={styles.count}>({count})</span>
          </button>
        )}
      </SubHeading>
      <div id={id(key)} hidden={!open[key]}>
        {body}
      </div>
    </section>
  );

  return (
    <article
      className={styles.card}
      data-rank={hypothesis.rank}
      data-readonly={readOnly || undefined}
      aria-labelledby={id('cause')}
    >
      <div className={styles.top}>
        <p className={styles.rank}>{isPrimary ? 'Primary hypothesis' : 'Alternative hypothesis'}</p>
        <ProvenanceTag
          kind="inferred"
          evidenceCount={hypothesis.supporting.length}
          onToggle={readOnly ? undefined : () => toggle('supporting')}
          expanded={open.supporting}
          controlsId={id('supporting')}
        />
        <div className={styles.confidence}>
          <ConfidenceIndicator band={hypothesis.confidence} reason={hypothesis.confidenceReason} layout="inline" />
        </div>
      </div>

      <Heading className={styles.causeText} id={id('cause')}>
        {hypothesis.cause.text}
      </Heading>

      <div className={styles.evidenceGrid}>
        {section(
          'supporting',
          'Supporting evidence',
          hypothesis.supporting.length,
          <ul className={styles.list}>{hypothesis.supporting.map((e) => evidence(e, 'supporting'))}</ul>,
        )}

        {section(
          'counter',
          'Counter-evidence',
          hypothesis.counter.length,
          hypothesis.counter.length ? (
            <ul className={styles.list}>{hypothesis.counter.map((c) => evidence(c.eventId, 'counter', c.explanation))}</ul>
          ) : (
            <p className={styles.none}>None observed.</p>
          ),
        )}
      </div>

      {section(
        'unknowns',
        'Unknowns',
        hypothesis.unknowns.length,
        hypothesis.unknowns.length ? (
          <ul className={styles.unknowns}>
            {hypothesis.unknowns.map((u) => (
              <li key={u.text}>
                <ProvenanceTag kind="unknown" />
                <span className={styles.unknownText}>{u.text}</span>
                <span className={styles.unknownReason}>Reason: {u.unknownReason}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.none}>None for this analysis.</p>
        ),
      )}

      {dataSources && <p className={styles.sources}>{sourcesCheckedLine(dataSources)}</p>}
    </article>
  );
}
