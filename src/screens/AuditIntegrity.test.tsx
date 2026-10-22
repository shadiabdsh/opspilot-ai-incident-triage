/**
 * Phase 6: audit integrity as rendered. Read-only snapshots carry the same information as the
 * live analysis without any interaction; system events are distinct from decisions in text;
 * the Audit tab label never implies a total it does not count.
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AppRoutes, ROUTER_FUTURE } from '../App';
import { AuditEntry } from '../components/signature/AuditEntry/AuditEntry';
import { createInitialState, reducer, type Action, type AppState } from '../domain/reducer';
import { systemsById } from '../domain/selectors';
import type { DecisionAuditEntry } from '../domain/types';
import { ANALYSIS_LOW } from '../fixtures/analysis.low';
import { expectNoAxeViolations } from '../test/axe';

const run = (s: AppState, ...a: Action[]) => a.reduce(reducer, s);
const BIND = 'Bind the renewed certificate to NPS and restart the service';

function decidedLow(): DecisionAuditEntry {
  const s = run(createInitialState('low'), { type: 'INCIDENT_OPENED' }, { type: 'DECISION_STARTED', action: 'approve' }, { type: 'DECISION_SUBMITTED' });
  const e = s.audit.at(-1);
  if (e?.kind !== 'decision') throw new Error('expected decision');
  return e;
}

function renderEntry(entry: DecisionAuditEntry, eventsById = {}) {
  return render(<AuditEntry entry={entry} eventsById={eventsById} systemsById={systemsById} defaultExpanded />);
}
const snapshotOf = (container: HTMLElement) => container.querySelector('[class*="snapshot"]:not([class*="snapshotMeta"])') as HTMLElement;

describe('Read-only snapshot: same information, no interaction', () => {
  it('contains the live analysis content: summary, hypotheses, evidence, counter-evidence, unknowns, sources, recommendations', () => {
    const entry = decidedLow();
    const { container } = renderEntry(entry);
    const snap = snapshotOf(container);
    for (const s of ANALYSIS_LOW.summary) expect(snap).toHaveTextContent(s.text);
    for (const h of ANALYSIS_LOW.hypotheses) {
      expect(within(snap).getByRole('heading', { level: 4, name: h.cause.text })).toBeInTheDocument();
      expect(snap).toHaveTextContent(h.confidenceReason);
      for (const c of h.counter) expect(snap).toHaveTextContent(c.explanation.text);
      for (const u of h.unknowns) expect(snap).toHaveTextContent(u.text);
    }
    expect(snap).toHaveTextContent('Sources checked: 3 of 4. Not retrieved: NPS event log.');
    // All four recommendations, each with its state at decision time.
    for (const r of ANALYSIS_LOW.recommendations) expect(within(snap).getByRole('heading', { level: 4, name: r.title })).toBeInTheDocument();
    expect(within(snap).getByText('Recommendation decided in this entry')).toBeInTheDocument();
    expect(within(snap).getByText('Other recommendations at the time')).toBeInTheDocument();
    expect(snap).toHaveTextContent('Analysis was current at decision time');
  });

  it('renders evidence from the record itself: no live events needed', () => {
    const { container } = renderEntry(decidedLow(), {}); // empty live lookup
    expect(snapshotOf(container)).toHaveTextContent('Certificate CN=nps-bldga-01.corp.example expired');
    expect(snapshotOf(container)).toHaveTextContent('Interface summary: 48/48 ports up');
  });

  it('has no buttons, radios, inputs, focusable elements or ids inside the snapshot', () => {
    const { container } = renderEntry(decidedLow());
    const snap = snapshotOf(container);
    expect(within(snap).queryAllByRole('button')).toHaveLength(0);
    expect(within(snap).queryAllByRole('radio')).toHaveLength(0);
    expect(snap.querySelectorAll('input, select, textarea, a[href], [tabindex]')).toHaveLength(0);
    expect(snap.querySelectorAll('[id]')).toHaveLength(0);
    // The only control is the entry's own expand/collapse toggle, outside the snapshot.
    expect(screen.getAllByRole('button')).toHaveLength(1);
    const ids = [...document.querySelectorAll('[id]')].map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('says when an analysis was acknowledged out of date and newer events were excluded', () => {
    const s0 = run(createInitialState('stale'), { type: 'INCIDENT_OPENED' });
    const s = run(s0, { type: 'EVENTS_ARRIVED', token: s0.scenarioToken }, { type: 'STALE_ACKNOWLEDGED' }, { type: 'RECOMMENDATION_SELECTED', recommendationId: 'rec-notify-users' }, { type: 'DECISION_STARTED', action: 'approve' }, { type: 'DECISION_SUBMITTED' });
    const e = s.audit.at(-1) as DecisionAuditEntry;
    const { container } = renderEntry(e);
    expect(snapshotOf(container)).toHaveTextContent(
      'based on 19 events. Analysis was out of date, acknowledged by the user at decision time; 3 newer events were present but not included.',
    );
    expect(screen.getByText('Approved on acknowledged out-of-date analysis')).toBeInTheDocument();
  });
});

describe('Audit tab: labels, structure and keyboard', () => {
  const renderIncident = () => render(<MemoryRouter future={ROUTER_FUTURE} initialEntries={['/incidents/INC-2041']}><AppRoutes /></MemoryRouter>);

  it('label says "Audit" with no decisions, even when system events exist, and counts decisions by name', async () => {
    const user = userEvent.setup();
    renderIncident();
    expect(screen.getByRole('tab', { name: 'Audit' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Low confidence' })); // writes a system event
    expect(screen.getByRole('tab', { name: 'Audit' })).toBeInTheDocument();
    const bar = screen.getByRole('region', { name: /Deciding on/ });
    await user.click(within(bar).getByRole('button', { name: 'Approve' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Approve' }));
    expect(screen.getByRole('tab', { name: 'Audit · 1 decision' })).toBeInTheDocument();
  });

  it('distinguishes decisions from events in text, lists newest first, and expands by keyboard', async () => {
    const user = userEvent.setup();
    renderIncident();
    await user.click(screen.getByRole('button', { name: 'Low confidence' }));
    const bar = screen.getByRole('region', { name: /Deciding on/ });
    await user.click(within(bar).getByRole('button', { name: 'Approve' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Approve' }));
    await user.click(screen.getByRole('tab', { name: 'Audit · 1 decision' }));

    const items = within(screen.getByRole('tabpanel')).getAllByRole('listitem').filter((li) => li.parentElement?.tagName === 'OL');
    expect(items[0]).toHaveTextContent('Approved'); // newest first: the decision…
    expect(items[1]).toHaveTextContent('Event'); // …then the scenario change event
    expect(items[1]).toHaveTextContent('Dana (you)');
    expect(items[1]).toHaveTextContent('Scenario changed to Low confidence');
    const article = within(items[0]!).getByRole('article', { name: 'Check the NPS event log directly on nps-bldga-01' });
    expect(article).toHaveTextContent('06:12');
    expect(article).toHaveTextContent('Confirmation Confirmed in a dialog');
    expect(article).toHaveTextContent('Outcome Verification task created (mock).');

    const toggle = within(article).getByRole('button', { name: 'View analysis at decision time' });
    expect(toggle).toHaveAttribute('aria-controls');
    toggle.focus();
    await user.keyboard('{Enter}');
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(toggle).toHaveFocus();
    await user.keyboard(' ');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveFocus();
  });

  it('heading structure: h2 Audit trail, h3 per decision, h4 inside frozen analysis', async () => {
    const user = userEvent.setup();
    renderIncident();
    const bar = screen.getByRole('region', { name: /Deciding on/ });
    await user.click(within(bar).getByRole('button', { name: 'Approve' }));
    await user.type(within(screen.getByRole('dialog')).getByLabelText(/Type nps-bldga-01/), 'nps-bldga-01');
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Approve and create change request' }));
    await user.click(screen.getByRole('tab', { name: 'Audit · 1 decision' }));
    await user.click(screen.getByRole('button', { name: 'View analysis at decision time' }));
    const panel = screen.getByRole('tabpanel');
    expect(within(panel).getByRole('heading', { level: 2, name: 'Audit trail' })).toBeInTheDocument();
    expect(within(panel).getByRole('heading', { level: 3, name: BIND })).toBeInTheDocument();
    expect(within(panel).getAllByRole('heading', { level: 4 }).length).toBeGreaterThan(1);
    expect(within(panel).queryAllByRole('heading', { level: 5 }).every((h) => h.closest('[class*="snapshot"]'))).toBe(true);
  });
});

describe('Audit accessibility (axe)', () => {
  const renderIncident = () => render(<MemoryRouter future={ROUTER_FUTURE} initialEntries={['/incidents/INC-2041?tab=audit']}><AppRoutes /></MemoryRouter>);

  it('empty Audit', async () => {
    const { container } = renderIncident();
    expect(screen.getByText(/No decisions yet/)).toBeInTheDocument();
    await expectNoAxeViolations(container);
  });

  it('one decision, expanded frozen analysis', async () => {
    const user = userEvent.setup();
    const { container } = render(<MemoryRouter future={ROUTER_FUTURE} initialEntries={['/incidents/INC-2041']}><AppRoutes /></MemoryRouter>);
    const bar = screen.getByRole('region', { name: /Deciding on/ });
    await user.click(within(bar).getByRole('button', { name: 'Approve' }));
    await user.type(within(screen.getByRole('dialog')).getByLabelText(/Type nps-bldga-01/), 'nps-bldga-01');
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Approve and create change request' }));
    await user.click(screen.getByRole('tab', { name: 'Audit · 1 decision' }));
    await expectNoAxeViolations(container);
    await user.click(screen.getByRole('button', { name: 'View analysis at decision time' }));
    await expectNoAxeViolations(container);
  }, 20000);

  it('Low-confidence Audit and Stale Audit with system events', async () => {
    const low = renderEntry(decidedLow());
    await expectNoAxeViolations(low.container);
    low.unmount();
    const s0 = run(createInitialState('stale'), { type: 'INCIDENT_OPENED' });
    const s = run(s0, { type: 'EVENTS_ARRIVED', token: s0.scenarioToken }, { type: 'STALE_ACKNOWLEDGED' }, { type: 'ANALYSIS_RERUN_STARTED' }, { type: 'ANALYSIS_RERUN_COMPLETED', token: s0.scenarioToken }, { type: 'RECOMMENDATION_SELECTED', recommendationId: 'rec-notify-users' }, { type: 'DECISION_STARTED', action: 'approve' }, { type: 'DECISION_SUBMITTED' });
    const { container } = render(
      <ol>
        {[...s.audit].reverse().map((e) => (
          <li key={e.id}>
            <AuditEntry entry={e} eventsById={{}} systemsById={systemsById} defaultExpanded />
          </li>
        ))}
      </ol>,
    );
    expect(container).toHaveTextContent('Analysis updated (demo-fixture-v2), now based on 22 events.');
    await expectNoAxeViolations(container);
  }, 20000);
});
