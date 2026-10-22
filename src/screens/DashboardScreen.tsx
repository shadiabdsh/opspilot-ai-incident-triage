/**
 * Operations Dashboard (UX Blueprint, section 1): a calm triage surface whose one job is to
 * make the incident that needs attention obvious and open it. Queue first, site health as
 * context below. The only AI concept here is alert grouping.
 */
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { formatTime } from '../domain/clock';
import { incidentQueue, siteHealth, sitesById } from '../domain/selectors';
import type { IncidentStatus } from '../domain/types';
import { WORKSTATION_OFFLINE_EVENTS } from '../fixtures/events';
import { SCRIPTED_INCIDENT_ID } from '../fixtures/incidents';
import { useDashboardMemory } from '../state/DashboardMemory';
import { useStore } from '../state/StoreProvider';
import { IncidentQueue, type QueueIncident } from '../components/supporting/IncidentQueue/IncidentQueue';
import { INCIDENT_STATUS_LABELS } from '../components/supporting/labels';
import { SystemHealthStrip } from '../components/supporting/SystemHealthStrip/SystemHealthStrip';
import styles from './DashboardScreen.module.css';

const SOURCE_ALERTS = { [SCRIPTED_INCIDENT_ID]: WORKSTATION_OFFLINE_EVENTS };
const ANNOUNCED_STATUSES: IncidentStatus[] = ['decided', 'escalated'];
export const HIGHLIGHT_MS = 2400;
const ANNOUNCE_DELAY_MS = 150;

export function DashboardScreen() {
  const { state } = useStore();
  const memory = useDashboardMemory();
  const [params] = useSearchParams();
  // Development-only switch to review the loading and empty states.
  const demo = import.meta.env.DEV ? params.get('demo') : null;
  const status = state.incidentStatus;

  // Decided during render (not in an effect), so StrictMode's double effects cannot lose it.
  const [change] = useState<IncidentStatus | null>(() =>
    memory.current !== status && ANNOUNCED_STATUSES.includes(status) ? status : null,
  );
  const [highlight, setHighlight] = useState(change !== null);
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    memory.current = status;
  }, [memory, status]);

  useEffect(() => {
    if (!change) return;
    // The live region exists before its text changes, so it is announced reliably.
    const announce = window.setTimeout(
      () => setAnnouncement(`${SCRIPTED_INCIDENT_ID} status changed to ${INCIDENT_STATUS_LABELS[change]}.`),
      ANNOUNCE_DELAY_MS,
    );
    const fade = window.setTimeout(() => setHighlight(false), HIGHLIGHT_MS);
    return () => {
      window.clearTimeout(announce);
      window.clearTimeout(fade);
    };
  }, [change]);

  const incidents: QueueIncident[] = useMemo(
    () =>
      demo === 'empty'
        ? []
        : incidentQueue(state).map((i) => ({ ...i, siteName: sitesById[i.siteId]?.name ?? i.siteId })),
    [state, demo],
  );
  const mode = demo === 'loading' ? 'loading' : 'ready';

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Operations</h1>
        <p className={styles.updated}>
          Updated <time dateTime={state.clock}>{formatTime(state.clock)}</time>
        </p>
      </header>

      <div role="status" aria-live="polite" className="visually-hidden">
        {mode === 'loading' ? 'Loading incidents' : announcement}
      </div>

      <section className={styles.queue} aria-labelledby="queue-heading">
        <div className={styles.sectionHead}>
          <h2 id="queue-heading" className={styles.sectionTitle}>
            Incident queue
          </h2>
          {mode === 'ready' && <span className={styles.count}>{incidents.length} open</span>}
        </div>
        <IncidentQueue
          mode={mode}
          incidents={incidents}
          now={state.clock}
          sourceAlerts={SOURCE_ALERTS}
          changedIncidentId={highlight ? SCRIPTED_INCIDENT_ID : null}
          lastChecked={state.clock}
        />
      </section>

      <section className={styles.health} aria-labelledby="health-heading">
        <h2 id="health-heading" className={styles.sectionTitle}>
          Site health
        </h2>
        <SystemHealthStrip sites={siteHealth()} />
      </section>
    </div>
  );
}
