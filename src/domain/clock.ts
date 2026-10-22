/**
 * Demo clock.
 *
 * Every time shown in the UI is fixture time, so the demo reads the same in every
 * session and every test. The real clock is used only for UI timers (for example the
 * 3-second arrival of new events), never for displayed times.
 *
 * All timestamps are stored in UTC and displayed as UTC wall-clock time, so the
 * prototype shows "06:12" regardless of the viewer's time zone.
 */

export const INCIDENT_DAY = '2026-10-20';

/** The moment the prototype opens: two minutes after the incident was grouped. */
export const DEMO_NOW = `${INCIDENT_DAY}T06:12:00Z`;

export function at(time: string): string {
  // at('06:01:04') -> '2026-10-20T06:01:04Z'
  return `${INCIDENT_DAY}T${time.length === 5 ? `${time}:00` : time}Z`;
}

/** 'HH:MM' in UTC. */
export function formatTime(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

/** 'HH:MM:SS' in UTC, for the event timeline. */
export function formatTimeWithSeconds(iso: string): string {
  const d = new Date(iso);
  const ss = String(d.getUTCSeconds()).padStart(2, '0');
  return `${formatTime(iso)}:${ss}`;
}

/** Adds whole seconds to an ISO timestamp. Used to timestamp decisions after DEMO_NOW. */
export function addSeconds(iso: string, seconds: number): string {
  return new Date(new Date(iso).getTime() + seconds * 1000).toISOString().replace('.000Z', 'Z');
}

// ── Logical demo clock ──────────────────────────────────────────────────────
//
// Displayed chronology is logical, not real: the store keeps a `clock` value and every
// recorded user or system action advances it by a fixed step. When new events arrive or
// a re-run produces a newer analysis, the clock first jumps forward to that moment.
// So a decision can never appear earlier than anything already on screen, and the same
// sequence of actions always produces the same timestamps.

/** Logical time between two recorded actions. */
export const ACTION_STEP_SECONDS = 30;

/** Logical time a re-run takes, measured from when it was started. */
export const RERUN_STEP_SECONDS = 30;

/** The later of two or more ISO timestamps. */
export function latest(...isos: string[]): string {
  return isos.reduce((a, b) => (a >= b ? a : b));
}
