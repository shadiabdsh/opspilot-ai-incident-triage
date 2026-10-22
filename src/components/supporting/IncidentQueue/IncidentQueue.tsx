/**
 * Incident queue: the Dashboard's primary task. A semantic table, sorted by severity then
 * age. Each incident's title is its only link (no whole-row click targets). The one AI
 * concept on the Dashboard is alert grouping, marked with the Inferred provenance tag and
 * checkable against the raw alerts through a preview disclosure.
 */
import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatTime, formatTimeWithSeconds } from '../../../domain/clock';
import type { Incident, IncidentStatus, OpsEvent } from '../../../domain/types';
import { ProvenanceTag } from '../../signature/ProvenanceTag/ProvenanceTag';
import { ChevronIcon } from '../../signature/shared/icons';
import { SOURCE_LABELS } from '../../signature/shared/labels';
import { SeverityBadge } from '../SeverityBadge/SeverityBadge';
import { SourceAlertsPanel } from '../SourceAlertsPanel/SourceAlertsPanel';
import { StatusPill } from '../StatusPill/StatusPill';
import styles from './IncidentQueue.module.css';

export type QueueIncident = Incident & { status: IncidentStatus; siteName: string };

export interface IncidentQueueProps {
  mode: 'loading' | 'ready';
  incidents: QueueIncident[];
  /** Logical "now", for incident age. */
  now: string;
  /** Raw alerts per grouped incident id. */
  sourceAlerts: Record<string, OpsEvent[]>;
  /** Incident whose row should briefly highlight after a status change. */
  changedIncidentId?: string | null;
  lastChecked: string;
}

const PREVIEW_COUNT = 4;
const COLUMNS = 6;

export function formatAge(fromIso: string, toIso: string): string {
  const minutes = Math.max(0, Math.floor((new Date(toIso).getTime() - new Date(fromIso).getTime()) / 60000));
  if (minutes < 60) return `${minutes} min ago`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min ago` : `${h} h ago`;
}

function Header() {
  return (
    <thead>
      <tr>
        <th scope="col" className={styles.colSeverity}>Severity</th>
        <th scope="col">Incident</th>
        <th scope="col" className={styles.colSite}>Site</th>
        <th scope="col" className={styles.colAffected}>Affected</th>
        <th scope="col" className={styles.colOpened}>Opened</th>
        <th scope="col" className={styles.colStatus}>Status</th>
      </tr>
    </thead>
  );
}

function IncidentRows({ incident, now, alerts, changed }: { incident: QueueIncident; now: string; alerts?: OpsEvent[]; changed: boolean }) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const previewId = useId();
  const grouped = Boolean(incident.groupedAlertCount && alerts?.length);

  return (
    <>
      <tr className={styles.row} data-changed={changed || undefined} data-severity={incident.severity}>
        <td className={styles.colSeverity}>
          <SeverityBadge severity={incident.severity} />
        </td>
        <th scope="row" className={styles.incident}>
          <Link to={`/incidents/${incident.id}`} className={styles.title}>
            {incident.title}
          </Link>
          <div className={styles.subline}>
            <span className={styles.id}>{incident.id}</span>
            {/* At 1024–1279 px the Site column folds into this line. */}
            <span className={styles.siteInline}>{incident.siteName}</span>
            {grouped && (
              <span className={styles.grouping}>
                <ProvenanceTag kind="inferred" />
                <span>{incident.groupedAlertCount} alerts grouped</span>
                <button
                  type="button"
                  className={styles.previewToggle}
                  aria-expanded={previewOpen}
                  aria-controls={previewId}
                  onClick={() => setPreviewOpen((o) => !o)}
                >
                  <ChevronIcon open={previewOpen} />
                  Preview source alerts
                </button>
              </span>
            )}
          </div>
        </th>
        <td className={styles.colSite}>{incident.siteName}</td>
        <td className={styles.colAffected}>
          {incident.affectedCount} {incident.affectedCount === 1 ? 'system' : 'systems'}
        </td>
        <td className={styles.colOpened}>
          <time dateTime={incident.openedAt} className={styles.time}>
            {formatTime(incident.openedAt)}
          </time>
          <span className={styles.age}>{formatAge(incident.openedAt, now)}</span>
        </td>
        <td className={styles.colStatus}>
          <StatusPill status={incident.status} />
        </td>
      </tr>
      {grouped && alerts && (
        <tr className={styles.previewRow} id={previewId} hidden={!previewOpen}>
          <td colSpan={COLUMNS}>
            <div className={styles.preview}>
              <p className={styles.previewLabel}>
                First {PREVIEW_COUNT} of {alerts.length} source alerts
              </p>
              <ul className={styles.alerts}>
                {alerts.slice(0, PREVIEW_COUNT).map((a) => (
                  <li key={a.id}>
                    <span className={styles.mono}>{a.systemId}</span>
                    <time dateTime={a.timestamp} className={styles.mono}>
                      {formatTimeWithSeconds(a.timestamp)}
                    </time>
                    <span className={styles.alertSource}>{SOURCE_LABELS[a.source]}</span>
                  </li>
                ))}
              </ul>
              <SourceAlertsPanel
                incidentId={incident.id}
                alerts={alerts}
                trigger={
                  <button type="button" className={styles.viewAll}>
                    View all {alerts.length} source alerts
                  </button>
                }
              />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export function IncidentQueue({ mode, incidents, now, sourceAlerts, changedIncidentId, lastChecked }: IncidentQueueProps) {
  if (mode === 'ready' && incidents.length === 0) {
    return (
      <div className={styles.empty}>
        <p className={styles.emptyTitle}>No open incidents</p>
        <p className={styles.emptyMeta}>
          Last checked <time dateTime={lastChecked}>{formatTime(lastChecked)}</time>
        </p>
      </div>
    );
  }

  return (
    <table className={styles.table} aria-busy={mode === 'loading' || undefined}>
      <caption className="visually-hidden">Open incidents, most severe first, then oldest first</caption>
      <Header />
      <tbody>
        {mode === 'loading'
          ? Array.from({ length: 5 }, (_, i) => (
              <tr key={i} className={styles.skeletonRow} aria-hidden="true">
                {Array.from({ length: COLUMNS }, (_, c) => (
                  <td key={c} className={c === 2 ? styles.colSite : undefined}>
                    <span className={styles.skeleton} data-col={c} />
                    {c === 1 && <span className={styles.skeleton} data-sub />}
                  </td>
                ))}
              </tr>
            ))
          : incidents.map((incident) => (
              <IncidentRows
                key={incident.id}
                incident={incident}
                now={now}
                alerts={sourceAlerts[incident.id]}
                changed={changedIncidentId === incident.id}
              />
            ))}
      </tbody>
    </table>
  );
}
