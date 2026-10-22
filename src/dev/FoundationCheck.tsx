/**
 * Developer page for phase 1: shows that fixtures, reducer and gate() work together,
 * with no product styling. It is replaced by the real screens in later phases.
 */
import { formatTime } from '../domain/clock';
import { gateFor } from '../domain/reducer';
import { SCENARIOS, SCENARIO_ORDER } from '../fixtures/scenarios';
import { useStore } from '../state/StoreProvider';
import styles from './FoundationCheck.module.css';

export function FoundationCheck() {
  const { state, dispatch } = useStore();

  return (
    <main className={styles.page}>
      <h1>OpsPilot: foundation check</h1>
      <p className={styles.lede}>
        Phase 1 of the build. Screens arrive in later phases; this page shows the pre-authored
        scenarios and what <code>gate()</code> allows for each recommendation.
        {import.meta.env.DEV && (
          <>
            {' '}
            <a href="/dev/gallery">Open the signature component gallery</a>.
          </>
        )}
      </p>

      <fieldset className={styles.scenarios}>
        <legend>Demo scenario</legend>
        {SCENARIO_ORDER.map((id) => (
          <label key={id}>
            <input
              type="radio"
              name="scenario"
              checked={state.scenario === id}
              onChange={() => dispatch({ type: 'SCENARIO_SET', scenario: id })}
            />{' '}
            {SCENARIOS[id].label}
          </label>
        ))}
      </fieldset>

      <p>
        Analysis <code>{state.analysis.modelVersion}</code>, status <strong>{state.analysisStatus}</strong>,{' '}
        {state.events.length} events, incident <strong>{state.incidentStatus}</strong>, demo time{' '}
        <strong>{formatTime(state.clock)}</strong>.
      </p>
      {state.scenario === 'stale' && (
        <p>
          <button type="button" onClick={() => dispatch({ type: 'EVENTS_ARRIVED', token: state.scenarioToken })}>
            Trigger new events
          </button>{' '}
          <button type="button" onClick={() => dispatch({ type: 'STALE_ACKNOWLEDGED' })}>
            Acknowledge
          </button>{' '}
          <button
            type="button"
            onClick={() => {
              dispatch({ type: 'ANALYSIS_RERUN_STARTED' });
              dispatch({ type: 'ANALYSIS_RERUN_COMPLETED', token: state.scenarioToken });
            }}
          >
            Re-run analysis
          </button>
        </p>
      )}

      <table className={styles.table}>
        <caption>What gate() allows right now</caption>
        <thead>
          <tr>
            <th scope="col">Recommendation</th>
            <th scope="col">Tier</th>
            <th scope="col">Approve / Modify</th>
            <th scope="col">Dismiss / Escalate</th>
          </tr>
        </thead>
        <tbody>
          {state.analysis.recommendations.map((rec) => {
            const g = gateFor(state, rec.id);
            return (
              <tr key={rec.id}>
                <th scope="row">{rec.title}</th>
                <td>{rec.riskTier.replace('_', ' ')}</td>
                <td>{g?.approve.allowed ? (g.requiresTypedConfirm ? 'Allowed, typed confirm' : 'Allowed') : g?.approve.reason}</td>
                <td>{g?.dismiss.allowed ? 'Allowed' : g?.dismiss.reason}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </main>
  );
}
