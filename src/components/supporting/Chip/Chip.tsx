/** A quiet label chip for tiers and statuses. Generic, so visually restrained. */
import type { ReactNode } from 'react';
import styles from './Chip.module.css';

export type ChipTone = 'neutral' | 'caution' | 'success' | 'muted';

export function Chip({
  tone = 'neutral',
  surface = 'light',
  icon,
  children,
}: {
  tone?: ChipTone;
  /** Styling only: 'dark' for chips on the navy decision surface. */
  surface?: 'light' | 'dark';
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <span className={styles.chip} data-tone={tone} data-surface={surface}>
      {icon}
      {children}
    </span>
  );
}
