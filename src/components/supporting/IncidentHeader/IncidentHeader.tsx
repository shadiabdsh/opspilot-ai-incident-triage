/**
 * Sticky incident header: what is affected and how bad, plus the Overview/Audit tabs.
 * Its measured height is written to --header-height so the trace can keep a focused
 * event row clear of it.
 */
import { useEffect, useRef, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { formatTime } from '../../../domain/clock';
import type { Incident, IncidentStatus } from '../../../domain/types';
import { SeverityBadge } from '../SeverityBadge/SeverityBadge';
import { StatusPill } from '../StatusPill/StatusPill';
import styles from './IncidentHeader.module.css';

export interface IncidentHeaderProps {
  incident: Incident;
  status: IncidentStatus;
  owner: string;
  siteName: string;
  tabs: ReactNode;
}

export function IncidentHeader({ incident, status, owner, siteName, tabs }: IncidentHeaderProps) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    // Only a sticky header covers content; on short viewports it scrolls away (offset 0).
    const write = () => {
      const sticky = getComputedStyle(el).position === 'sticky';
      document.documentElement.style.setProperty('--header-height', `${sticky ? el.offsetHeight : 0}px`);
    };
    write();
    const observer = new ResizeObserver(write);
    observer.observe(el);
    window.addEventListener('resize', write);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', write);
    };
  }, []);

  return (
    <header ref={ref} className={styles.header}>
      <div className={styles.inner}>
        <nav aria-label="Breadcrumb" className={styles.breadcrumb}>
          <ol>
            <li>
              <Link to="/">Operations</Link>
            </li>
            <li aria-current="page">{incident.id}</li>
          </ol>
        </nav>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>{incident.title}</h1>
          <SeverityBadge severity={incident.severity} />
          <StatusPill status={status} />
        </div>
        <dl className={styles.meta}>
          <div>
            <dt>Site</dt>
            <dd>{siteName}</dd>
          </div>
          <div>
            <dt>Opened</dt>
            <dd className={styles.mono}>{formatTime(incident.openedAt)}</dd>
          </div>
          <div>
            <dt>Incident</dt>
            <dd className={styles.mono}>{incident.id}</dd>
          </div>
          <div>
            <dt>Owner</dt>
            <dd>{owner}</dd>
          </div>
        </dl>
        {tabs}
      </div>
    </header>
  );
}
