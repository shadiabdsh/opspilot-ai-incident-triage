/**
 * AI summary: three statements, each tagged with its provenance. An Inferred tag is a
 * button that expands the evidence behind the statement: the first step of the trace.
 */
import { useId, useState } from 'react';
import type { OpsEvent, Statement, System } from '../../../domain/types';
import { EvidenceItem } from '../../signature/EvidenceItem/EvidenceItem';
import { ProvenanceTag } from '../../signature/ProvenanceTag/ProvenanceTag';
import { SOURCE_LABELS } from '../../signature/shared/labels';
import styles from './AISummaryCard.module.css';

export interface AISummaryCardProps {
  summary: Statement[];
  eventsById: Record<string, OpsEvent>;
  systemsById: Record<string, System>;
  onShowSource: (eventId: string) => void;
}

function SummaryStatement({ statement, index, eventsById, systemsById, onShowSource }: { statement: Statement; index: number } & Omit<AISummaryCardProps, 'summary'>) {
  const [open, setOpen] = useState(false);
  const listId = `${useId()}-${index}`;
  const firstEvent = eventsById[statement.evidenceEventIds[0] ?? ''];
  const inferred = statement.provenance === 'inferred';

  return (
    <li className={styles.statement}>
      <ProvenanceTag
        kind={statement.provenance}
        source={statement.provenance === 'observed' && firstEvent ? SOURCE_LABELS[firstEvent.source] : undefined}
        evidenceCount={inferred ? statement.evidenceEventIds.length : undefined}
        onToggle={inferred ? () => setOpen((o) => !o) : undefined}
        expanded={open}
        controlsId={listId}
      />
      <p className={styles.text}>{statement.text}</p>
      {inferred && (
        <ul id={listId} hidden={!open} className={styles.evidence}>
          {statement.evidenceEventIds.map((id) => {
            const e = eventsById[id];
            return e ? <EvidenceItem key={id} event={e} system={systemsById[e.systemId]} stance="supporting" onShowSource={onShowSource} /> : null;
          })}
        </ul>
      )}
    </li>
  );
}

export function AISummaryCard({ summary, ...rest }: AISummaryCardProps) {
  return (
    <section className={styles.card} aria-labelledby="ai-summary-heading">
      <h3 id="ai-summary-heading" className={styles.heading}>
        Summary
      </h3>
      <ul className={styles.list}>
        {summary.map((s, i) => (
          <SummaryStatement key={s.text} statement={s} index={i} {...rest} />
        ))}
      </ul>
    </section>
  );
}
