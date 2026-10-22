/**
 * AuditEntry records one decision and the analysis it was made against.
 *
 * The frozen analysis expands in place using read-only versions of the other signature
 * components: same content, no controls, no trace handlers, no ids. System lines (re-run,
 * acknowledgement, scenario change) render as quiet single lines.
 */
import { useId, useState } from 'react';
import { formatTime } from '../../../domain/clock';
import type { AnalysisStatus, AuditEntry as AuditEntryData, ConfirmationUsed, DecisionAuditEntry, OpsEvent, RecommendationStatus, System } from '../../../domain/types';
import { HypothesisCard } from '../HypothesisCard/HypothesisCard';
import { ProvenanceTag } from '../ProvenanceTag/ProvenanceTag';
import { RecommendationCard } from '../RecommendationCard/RecommendationCard';
import { ChevronIcon, WarningIcon } from '../shared/icons';
import { ACTION_PAST } from '../shared/labels';
import styles from './AuditEntry.module.css';

export interface AuditEntryProps {
  entry: AuditEntryData;
  eventsById: Record<string, OpsEvent>;
  systemsById: Record<string, System>;
  defaultExpanded?: boolean;
}

const FLAG_LABELS = {
  acknowledged_stale: 'Approved on acknowledged out-of-date analysis',
  modified_from_original: 'Parameters changed from the AI recommendation',
} as const;

const ANALYSIS_STATUS_LABELS: Record<AnalysisStatus, string> = {
  ready: 'current',
  stale: 'out of date',
  acknowledged: 'out of date, acknowledged by the user',
  analyzing: 'being re-run',
};

function confirmationText(c: ConfirmationUsed, confirmText?: string): string {
  if (c === 'typed_target') return `Typed confirmation of ${confirmText ?? 'the target system'}`;
  if (c === 'single_confirm') return 'Confirmed in a dialog';
  if (c === 'reason') return 'Reason given';
  return 'Team and note given';
}

const STATUS_FOR_ACTION: Record<DecisionAuditEntry['action'], RecommendationStatus> = {
  approve: 'approved',
  modify: 'modified',
  dismiss: 'dismissed',
  escalate: 'escalated',
};

export function AuditEntry({ entry, eventsById, systemsById, defaultExpanded = false }: AuditEntryProps) {
  const baseId = useId();
  const [expanded, setExpanded] = useState(defaultExpanded);

  if (entry.kind === 'system') {
    // System lines are labelled as events in text, so they are distinct from decisions without colour.
    return (
      <div className={styles.system} data-event={entry.event}>
        <time dateTime={entry.at} className={styles.time}>
          {formatTime(entry.at)}
        </time>
        <span className={styles.eventLabel}>Event</span>
        {entry.actor && <span>{entry.actor}</span>}
        <span className={styles.systemMessage}>{entry.message}</span>
      </div>
    );
  }

  const snapshot = entry.analysisSnapshot;
  const decided = snapshot.recommendations.find((r) => r.id === entry.recommendationId);
  const others = snapshot.recommendations.filter((r) => r.id !== entry.recommendationId);
  // Evidence renders from the events frozen with the entry, so later state cannot change it.
  const frozenEvents: Record<string, OpsEvent> = entry.eventsAtDecision?.length
    ? Object.fromEntries(entry.eventsAtDecision.map((e) => [e.id, e]))
    : eventsById;
  const notIncluded = entry.eventsAtDecision ? entry.eventsAtDecision.length - snapshot.basedOnEventIds.length : 0;
  const statusAt = entry.analysisStatusAtDecision;
  const verb = entry.action === 'escalate' && entry.escalatedTo ? `Escalated to ${entry.escalatedTo}` : ACTION_PAST[entry.action];
  const changedKeys = entry.modifiedParams
    ? Object.keys(entry.modifiedParams).filter((k) => entry.modifiedParams?.[k] !== entry.originalParams?.[k])
    : [];

  return (
    <article className={styles.entry} data-action={entry.action} aria-labelledby={`${baseId}-title`}>
      <p className={styles.meta}>
        <time dateTime={entry.at} className={styles.time}>
          {formatTime(entry.at)}
        </time>
        <span>{entry.actor}</span>
        <span className={styles.verb}>{verb}</span>
      </p>
      <h3 className={styles.title} id={`${baseId}-title`}>
        {entry.recommendationTitle}
      </h3>

      {entry.flags.length > 0 && (
        <ul className={styles.flags}>
          {entry.flags.map((f) => (
            <li key={f} className={styles.flag} data-flag={f}>
              {f === 'acknowledged_stale' && <WarningIcon />}
              {FLAG_LABELS[f]}
            </li>
          ))}
        </ul>
      )}

      {entry.reason && (
        <p className={styles.detail}>
          <span className={styles.label}>{entry.action === 'escalate' ? 'Note' : 'Reason'}</span> {entry.reason}
        </p>
      )}

      {changedKeys.length > 0 && (
        <table className={styles.diff}>
          <caption className="visually-hidden">Parameter changes</caption>
          <thead>
            <tr>
              <th scope="col">Parameter</th>
              <th scope="col">Was</th>
              <th scope="col">Now</th>
            </tr>
          </thead>
          <tbody>
            {changedKeys.map((k) => (
              <tr key={k}>
                <th scope="row">{k}</th>
                <td className={styles.was}>{entry.originalParams?.[k]}</td>
                <td className={styles.now}>{entry.modifiedParams?.[k]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {entry.confirmation && (
        <p className={styles.detail}>
          <span className={styles.label}>Confirmation</span> {confirmationText(entry.confirmation, decided?.confirmText)}
        </p>
      )}

      <p className={styles.detail}>
        <span className={styles.label}>Outcome</span> {entry.outcome}
      </p>

      <button
        type="button"
        className={styles.toggle}
        aria-expanded={expanded}
        aria-controls={`${baseId}-snapshot`}
        onClick={() => setExpanded((e) => !e)}
      >
        <ChevronIcon open={expanded} />
        {expanded ? 'Hide' : 'View'} analysis at decision time
      </button>

      <div id={`${baseId}-snapshot`} className={styles.snapshot} hidden={!expanded}>
        {expanded && (
          <>
            <p className={styles.snapshotMeta}>
              Frozen at {formatTime(snapshot.generatedAt)}, {snapshot.modelVersion} (pre-authored), based on{' '}
              {snapshot.basedOnEventIds.length} events
              {statusAt && <>. Analysis was {ANALYSIS_STATUS_LABELS[statusAt]} at decision time</>}
              {notIncluded > 0 && (
                <>
                  ; {notIncluded} newer {notIncluded === 1 ? 'event was' : 'events were'} present but not included
                </>
              )}
              .
            </p>
            <ul className={styles.summary}>
              {snapshot.summary.map((s) => (
                <li key={s.text}>
                  <ProvenanceTag kind={s.provenance} evidenceCount={s.provenance === 'inferred' ? s.evidenceEventIds.length : undefined} />
                  <span>{s.text}</span>
                </li>
              ))}
            </ul>
            {snapshot.hypotheses.map((h) => (
              <HypothesisCard
                key={h.id}
                hypothesis={h}
                eventsById={frozenEvents}
                systemsById={systemsById}
                dataSources={h.rank === 'primary' ? snapshot.dataSources : undefined}
                readOnly
                headingLevel={4}
              />
            ))}
            {decided && (
              <>
                <p className={styles.groupLabel}>Recommendation decided in this entry</p>
                <RecommendationCard
                  recommendation={decided}
                  status={entry.recommendationStatesAtDecision?.[decided.id] ?? STATUS_FOR_ACTION[entry.action]}
                  modifiedParams={entry.action === 'modify' ? entry.modifiedParams : undefined}
                  eventsById={frozenEvents}
                  systemsById={systemsById}
                  readOnly
                  headingLevel={4}
                />
              </>
            )}
            {others.length > 0 && (
              <>
                <p className={styles.groupLabel}>Other recommendations at the time</p>
                {others.map((r) => (
                  <RecommendationCard
                    key={r.id}
                    recommendation={r}
                    status={entry.recommendationStatesAtDecision?.[r.id] ?? 'pending'}
                    eventsById={frozenEvents}
                    systemsById={systemsById}
                    readOnly
                    headingLevel={4}
                  />
                ))}
              </>
            )}
          </>
        )}
      </div>
    </article>
  );
}
