/**
 * Site health: quiet context below the queue. Only a site with offline or degraded systems
 * gets semantic emphasis, and its state is always written out in words.
 */
import type { SiteHealth } from '../../../domain/selectors';
import styles from './SystemHealthStrip.module.css';

export function SystemHealthStrip({ sites }: { sites: SiteHealth[] }) {
  return (
    <ul className={styles.list}>
      {sites.map(({ site, offline, total }) => {
        const degraded = offline > 0;
        return (
          <li key={site.id} className={styles.site} data-degraded={degraded || undefined}>
            <span className={styles.name}>{site.name}</span>
            <span className={styles.state}>
              <span className={styles.dot} aria-hidden="true" />
              {degraded ? 'Degraded' : 'No known issues'}
            </span>
            {degraded && (
              <span className={styles.count}>
                {offline} of {total} systems offline
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
