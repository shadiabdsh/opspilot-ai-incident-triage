/**
 * Prototype-only control for switching demo scenarios. Styled as a dashed "demo" strip so it
 * cannot be mistaken for product UI. Buttons (not a <select>): in some browsers arrowing
 * through a select changes its value immediately, which would reset the incident on every
 * key press. Switching is an explicit activation.
 */
import { useId } from 'react';
import type { ScenarioId } from '../../../domain/types';
import { SCENARIOS, SCENARIO_ORDER } from '../../../fixtures/scenarios';
import styles from './ScenarioSwitcher.module.css';

export interface ScenarioSwitcherProps {
  current: ScenarioId;
  onChange: (scenario: ScenarioId) => void;
}

export function ScenarioSwitcher({ current, onChange }: ScenarioSwitcherProps) {
  const labelId = useId();
  const hintId = useId();
  return (
    <div className={styles.strip} role="group" aria-labelledby={labelId} aria-describedby={hintId}>
      <span className={styles.badge} aria-hidden="true">
        Demo
      </span>
      <span id={labelId} className={styles.label}>
        Demo scenario
      </span>
      <div className={styles.options}>
        {SCENARIO_ORDER.map((id) => (
          <button
            key={id}
            type="button"
            className={styles.option}
            aria-pressed={current === id}
            onClick={() => current !== id && onChange(id)}
          >
            {SCENARIOS[id].label}
          </button>
        ))}
      </div>
      <span id={hintId} className={styles.hint}>
        Prototype control. Switching resets this incident.
      </span>
    </div>
  );
}
