/**
 * App shell: a dense navy sidebar and a bright, cool workspace.
 *
 * The workspace is one primary scroll area (#main-scroll) above a reserved dock zone.
 * Screens portal their DecisionBar into the dock, so readable content and keyboard focus
 * never sit behind it. Below 1280 px the sidebar collapses to an icon rail; link text
 * stays available to assistive technology.
 */
import { useState, type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { DEMO_ACTOR } from '../../../domain/reducer';
import { SCRIPTED_INCIDENT_ID } from '../../../fixtures/incidents';
import { DockSlotContext } from '../../../state/DockSlot';
import { SCROLL_CONTAINER_ID } from '../../../state/scrollContainer';
import styles from './AppShell.module.css';

const Icon = ({ d }: { d: string }) => (
  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <path d={d} />
  </svg>
);

const DASHBOARD_ICON = 'M3 3h6v6H3zM11 3h6v4h-6zM11 9h6v8h-6zM3 11h6v6H3z';
const INCIDENTS_ICON = 'M10 2.5 18 16.5H2L10 2.5ZM10 8v3.5M10 14v.01';

/** Compact mark: a node with an orbit, suggesting a pilot watching a system. */
function LogoMark() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="9" fill="none" stroke="var(--sidebar-primary)" strokeWidth="1.6" strokeDasharray="3 2.4" />
      <circle cx="12" cy="12" r="3.4" fill="var(--sidebar-primary)" />
    </svg>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [dockSlot, setDockSlot] = useState<HTMLElement | null>(null);
  const initials = DEMO_ACTOR.split(' ')[0]?.slice(0, 1) ?? 'D';

  return (
    <div className={styles.shell}>
      <a className={styles.skip} href="#main">
        Skip to content
      </a>
      <aside className={styles.sidebar}>
        <NavLink to="/" className={styles.brand} end>
          <LogoMark />
          <span className={styles.brandText}>OpsPilot</span>
        </NavLink>
        <nav aria-label="Primary" className={styles.nav}>
          <NavLink to="/" end className={({ isActive }) => `${styles.navItem} ${isActive ? styles.active : ''}`}>
            <Icon d={DASHBOARD_ICON} />
            <span className={styles.label}>Dashboard</span>
          </NavLink>
          <NavLink to={`/incidents/${SCRIPTED_INCIDENT_ID}`} className={({ isActive }) => `${styles.navItem} ${isActive ? styles.active : ''}`}>
            <Icon d={INCIDENTS_ICON} />
            <span className={styles.label}>Incidents</span>
          </NavLink>
        </nav>
        <div className={styles.user}>
          <span className={styles.avatar} aria-hidden="true">
            {initials}
          </span>
          <span className={styles.label}>{DEMO_ACTOR}</span>
        </div>
      </aside>
      <main id="main" className={styles.workspace} tabIndex={-1}>
        <DockSlotContext.Provider value={dockSlot}>
          <div id={SCROLL_CONTAINER_ID} className={styles.scroller}>
            <div className={styles.content}>{children}</div>
            <footer className={styles.footer}>
              Prototype. AI responses are pre-authored for controlled testing, and no action reaches a real system.
            </footer>
          </div>
          <div ref={setDockSlot} className={styles.dock} />
        </DockSlotContext.Provider>
      </main>
    </div>
  );
}
