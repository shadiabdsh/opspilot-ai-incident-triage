/**
 * RecommendationCard presents an AI recommendation as a proposal with stated risk,
 * never as an instruction. Selecting a card loads it into the DecisionBar.
 *
 * Selection uses a native radio input: the screen renders the cards inside a fieldset
 * with a shared `groupName`, which gives radio-group semantics and arrow-key movement
 * without extra code. Blocked cards stay selectable so the reason can be read.
 */
import { useId, useState } from 'react';
import type { GateResult } from '../../../domain/gate';
import type { OpsEvent, Recommendation, RecommendationStatus, System } from '../../../domain/types';
import { Chip } from '../../supporting/Chip/Chip';
import { EvidenceItem } from '../EvidenceItem/EvidenceItem';
import { ProvenanceTag } from '../ProvenanceTag/ProvenanceTag';
import { CheckIcon, ChevronIcon, LockIcon, WarningIcon } from '../shared/icons';
import { STATUS_LABELS, TIER_LABELS } from '../shared/labels';
import styles from './RecommendationCard.module.css';

export interface RecommendationCardProps {
  recommendation: Recommendation;
  status: RecommendationStatus;
  /** gate() result for this card; drives the blocked reason. */
  gate?: GateResult;
  selected?: boolean;
  onSelect?: () => void;
  /** Shared radio name for all cards in one list. */
  groupName?: string;
  /** Parameter values after a Modify decision. */
  modifiedParams?: Record<string, string>;
  eventsById?: Record<string, OpsEvent>;
  systemsById?: Record<string, System>;
  onShowSource?: (eventId: string) => void;
  readOnly?: boolean;
  headingLevel?: 3 | 4;
}

export function RecommendationCard({
  recommendation: rec,
  status,
  gate,
  selected = false,
  onSelect,
  groupName = 'recommendation',
  modifiedParams,
  eventsById,
  systemsById,
  onShowSource,
  readOnly = false,
  headingLevel = 3,
}: RecommendationCardProps) {
  const baseId = useId();
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const id = (part: string) => (readOnly ? undefined : `${baseId}-${part}`);
  const Heading = headingLevel === 3 ? 'h3' : 'h4';

  const blockedReason = status === 'pending' && gate && !gate.approve.allowed ? gate.approve.reason : undefined;
  const decided = status !== 'pending';
  const params = modifiedParams ?? rec.params;
  const paramEntries = Object.entries(params);
  const hasEvidence = Boolean(eventsById) && rec.rationale.evidenceEventIds.length > 0;
  // Interactive cards collapse evidence behind the Inferred tag. Read-only cards (frozen
  // audit snapshots) keep everything the user saw, fully expanded, with no controls.
  // In a selection group, unselected cards are compact until selected or expanded.
  // Standalone and read-only cards always show everything.
  const inGroup = !readOnly && onSelect !== undefined;
  const compact = inGroup && !selected && !detailsOpen;
  const canToggleEvidence = !readOnly && hasEvidence && !compact;
  const evidenceVisible = readOnly ? hasEvidence : evidenceOpen;

  return (
    <article
      className={styles.card}
      data-selected={selected || undefined}
      data-status={status}
      data-tier={rec.riskTier}
      data-compact={compact || undefined}
      data-blocked={blockedReason ? true : undefined}
      data-readonly={readOnly || undefined}
    >
      <div className={styles.header}>
        {!readOnly && onSelect ? (
          <input
            type="radio"
            className={styles.radio}
            id={id('select')}
            name={groupName}
            checked={selected}
            onChange={onSelect}
            aria-describedby={blockedReason ? id('blocked') : undefined}
          />
        ) : null}
        <Heading className={styles.title}>
          {!readOnly && onSelect ? <label htmlFor={id('select')}>{rec.title}</label> : rec.title}
        </Heading>
      </div>

      <div className={styles.chips}>
        <Chip
          tone={rec.riskTier === 'consequential' ? 'caution' : 'neutral'}
          icon={rec.riskTier === 'consequential' ? <WarningIcon /> : undefined}
        >
          {TIER_LABELS[rec.riskTier]}
        </Chip>
        <Chip tone={status === 'approved' || status === 'modified' ? 'success' : decided ? 'muted' : 'neutral'} icon={status === 'approved' || status === 'modified' ? <CheckIcon /> : undefined}>
          {STATUS_LABELS[status]}
        </Chip>
      </div>

      <div className={styles.rationale}>
        <ProvenanceTag
          kind="inferred"
          evidenceCount={rec.rationale.evidenceEventIds.length}
          onToggle={canToggleEvidence ? () => setEvidenceOpen((o) => !o) : undefined}
          expanded={evidenceOpen}
          controlsId={id('evidence')}
        />
        <p className={compact ? styles.oneLine : undefined}>{rec.rationale.text}</p>
      </div>
      <div id={id('details')} className={styles.details} hidden={compact}>
        {hasEvidence && eventsById && (
          <ul className={styles.evidence} id={id('evidence')} hidden={!evidenceVisible}>
            {rec.rationale.evidenceEventIds.map((eventId) => {
              const event = eventsById[eventId];
              return event ? (
                <EvidenceItem
                  key={eventId}
                  event={event}
                  system={systemsById?.[event.systemId]}
                  stance="supporting"
                  onShowSource={onShowSource}
                  readOnly={readOnly}
                />
              ) : null;
            })}
          </ul>
        )}

        <dl className={styles.facts}>
          <div>
            <dt>Impact</dt>
            <dd>{rec.impact}</dd>
          </div>
          <div>
            <dt>Reversible</dt>
            <dd>{rec.reversible ? 'Yes' : 'No'}</dd>
          </div>
          {rec.rollback && (
            <div>
              <dt>Rollback</dt>
              <dd>{rec.rollback}</dd>
            </div>
          )}
          {paramEntries.map(([key, value]) => (
            <div key={key}>
              <dt>{key}</dt>
              <dd>
                {value}
                {modifiedParams && rec.params[key] !== value && <span className={styles.changed}> (changed from {rec.params[key]})</span>}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      {inGroup && !selected && (
        <button
          type="button"
          className={styles.detailsToggle}
          aria-expanded={!compact}
          aria-controls={id('details')}
          aria-label={`${compact ? 'Show' : 'Hide'} details: ${rec.title}`}
          onClick={() => setDetailsOpen((o) => !o)}
        >
          <ChevronIcon open={!compact} />
          {compact ? 'Show details' : 'Hide details'}
        </button>
      )}

      {blockedReason && (
        <p className={styles.blocked} id={id('blocked')}>
          <LockIcon />
          <span>
            <strong>Unavailable:</strong> {blockedReason}
          </span>
        </p>
      )}
    </article>
  );
}
