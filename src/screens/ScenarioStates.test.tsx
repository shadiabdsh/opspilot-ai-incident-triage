/**
 * Phase 5: scenario states. Runs the full app (router, store, timers) so gating, audit and
 * focus are tested exactly as a user meets them. Stale tests use fake timers and advance them
 * explicitly; axe sweeps use real timers because axe schedules its own work.
 */
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AppRoutes, ROUTER_FUTURE } from '../App';
import { REASONS } from '../domain/gate';
import { expectNoAxeViolations } from '../test/axe';

const BIND = 'Bind the renewed certificate to NPS and restart the service';
const VERIFY_NPS = 'Check the NPS event log directly on nps-bldga-01';
const NOTIFY = 'Notify Building A users about the network outage';
const PRIMARY_LOW = 'The expired RADIUS server certificate on nps-bldga-01 may be blocking 802.1X authentication.';
const ALTERNATIVE = 'A fault in the Building A access network may have disconnected the workstations.';

const renderIncident = () => render(<MemoryRouter future={ROUTER_FUTURE} initialEntries={['/incidents/INC-2041']}><AppRoutes /></MemoryRouter>);
const bar = () => screen.getByRole('region', { name: /Deciding on/ });
const barButton = (name: string) => within(bar()).getByRole('button', { name });
const facts = () => screen.getByRole('region', { name: 'Observed facts' });
const ai = () => screen.getByRole('region', { name: /AI assistance/ });
const auditTab = () => screen.getByRole('tab', { name: /^Audit( · \d+ decisions?)?$/ });
const announcer = () => screen.getByTestId('analysis-announcer');

async function switchTo(user: ReturnType<typeof userEvent.setup>, label: string) {
  await user.click(screen.getByRole('button', { name: label }));
}

// ── Low confidence ─────────────────────────────────────────────────────────

describe('Low confidence: analysis and facts', () => {
  it('shows two Low hypotheses, the alternative labelled as such, and the Unknown with its reason', async () => {
    const user = userEvent.setup();
    renderIncident();
    await switchTo(user, 'Low confidence');

    const primary = screen.getByRole('article', { name: PRIMARY_LOW });
    const alternative = screen.getByRole('article', { name: ALTERNATIVE });
    expect(within(primary).getByText('Primary hypothesis')).toBeInTheDocument();
    expect(within(alternative).getByText('Alternative hypothesis')).toBeInTheDocument();
    expect(within(primary).getByRole('group', { name: 'Confidence: Low' })).toBeInTheDocument();
    expect(within(alternative).getByRole('group', { name: 'Confidence: Low' })).toBeInTheDocument();
    expect(within(ai()).queryByRole('group', { name: 'Confidence: High' })).not.toBeInTheDocument();
    // Confidence reason is visible text, never a percentage.
    expect(within(primary).getByText(/without NPS logs the link to the failures is timing only/)).toBeVisible();
    expect(ai().textContent).not.toMatch(/\d+\s?%/);
    // Unknown, stated explicitly with its reason.
    expect(within(primary).getByText('Unknown: the AI could not determine this')).toBeInTheDocument();
    expect(within(primary).getByText('Whether the workstations are failing authentication')).toBeVisible();
    expect(within(primary).getByText(/Reason: The NPS event log could not be retrieved/)).toBeVisible();
    // Alternative: supported by shared location, countered by the healthy switch.
    await user.click(within(alternative).getByRole('button', { name: /Counter-evidence \(2\)/ }));
    expect(within(alternative).getByText(/Interface summary: 48\/48 ports up/)).toBeVisible();
  });

  it('shows the missing NPS log as a factual availability notice in Observed facts, and excludes its events', async () => {
    const user = userEvent.setup();
    renderIncident();
    await switchTo(user, 'Low confidence');
    expect(within(facts()).getByRole('heading', { name: 'Source availability' })).toBeInTheDocument();
    expect(within(facts()).getByText('NPS event log:').closest('li')).toHaveTextContent('NPS event log: not retrieved.');
    expect(within(facts()).getByText(/could not be read, not because none occurred/)).toBeInTheDocument();
    expect(within(facts()).queryByText(/EAP-TLS handshake/)).not.toBeInTheDocument();
    // The facts header names only the sources that were read.
    expect(within(facts()).getByText(/Raw records from the sources that could be read/)).not.toHaveTextContent('NPS');
  });

  it('Base keeps its facts unchanged: no availability notice and the original source line', () => {
    renderIncident();
    expect(within(facts()).queryByRole('heading', { name: 'Source availability' })).not.toBeInTheDocument();
    expect(within(facts()).getByText('Raw records from monitoring, the NPS log, certificate inventory and switch telemetry.')).toBeInTheDocument();
  });
});

describe('Low confidence: gating and decisions', () => {
  it('preselects the read-only Verify action, which needs no typed confirmation', async () => {
    const user = userEvent.setup();
    renderIncident();
    await switchTo(user, 'Low confidence');
    expect(screen.getByRole('radio', { name: VERIFY_NPS })).toBeChecked();
    expect(within(bar()).getByText('Read-only')).toBeInTheDocument();
    await user.click(barButton('Approve'));
    const dialog = screen.getByRole('dialog', { name: `Approve: ${VERIFY_NPS}` });
    expect(within(dialog).queryByLabelText(/Type nps-bldga-01/)).not.toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Approve' })).toHaveAttribute('aria-disabled', 'false');
  });

  it('blocks consequential Approve and Modify with a visible, announced reason, and writes no audit entry', async () => {
    const user = userEvent.setup();
    renderIncident();
    await switchTo(user, 'Low confidence');
    const card = screen.getByRole('radio', { name: BIND }).closest('article')!;
    expect(within(card).getByText(REASONS.lowConfidence)).toBeInTheDocument(); // readable even when not selected
    await user.click(screen.getByRole('radio', { name: BIND }));
    expect(within(card).getByText(REASONS.lowConfidence)).toBeVisible();
    for (const name of ['Approve', 'Modify']) {
      const button = barButton(name);
      expect(button).toHaveAttribute('aria-disabled', 'true');
      expect(button).not.toBeDisabled(); // stays focusable
      expect(button).toHaveAccessibleDescription(`Approve and Modify unavailable: ${REASONS.lowConfidence}`);
      await user.click(button);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    }
    // Keyboard activation is equally inert.
    barButton('Approve').focus();
    await user.keyboard('{Enter}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    // The only audit line is the scenario change; no decision was written.
    expect(auditTab()).toHaveTextContent('Audit');
    await user.click(auditTab());
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
    expect(screen.getByText('Scenario changed to Low confidence')).toBeInTheDocument();
  });

  it('Verify writes a complete audit entry that preserves both hypotheses and the Unknown', async () => {
    const user = userEvent.setup();
    renderIncident();
    await switchTo(user, 'Low confidence');
    await user.click(barButton('Approve'));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Approve' }));
    expect(within(bar()).getByRole('status')).toHaveTextContent('Verification task created (mock)');
    expect(screen.getByText('In review')).toBeInTheDocument(); // verifying does not decide the incident

    await user.click(screen.getByRole('tab', { name: 'Audit · 1 decision' }));
    const entry = screen.getByRole('article', { name: VERIFY_NPS });
    expect(entry).toHaveTextContent('Dana (you)');
    expect(entry).toHaveTextContent('Approved');
    expect(entry).toHaveTextContent('06:12');
    expect(entry).toHaveTextContent('Verification task created (mock)');
    await user.click(within(entry).getByRole('button', { name: 'View analysis at decision time' }));
    expect(within(entry).getByText(/demo-fixture-v1-low/)).toBeInTheDocument();
    expect(within(entry).getByRole('heading', { level: 4, name: PRIMARY_LOW })).toBeInTheDocument();
    expect(within(entry).getByRole('heading', { level: 4, name: ALTERNATIVE })).toBeInTheDocument();
    expect(within(entry).getAllByRole('group', { name: 'Confidence: Low' })).toHaveLength(2);
    expect(within(entry).getByText('Whether the workstations are failing authentication')).toBeInTheDocument();
    expect(within(entry).getByRole('heading', { level: 4, name: VERIFY_NPS })).toBeInTheDocument(); // recommendation state
  });

  it('Dismiss requires a reason ("Other" requires details) and records it', async () => {
    const user = userEvent.setup();
    renderIncident();
    await switchTo(user, 'Low confidence');
    await user.click(screen.getByRole('radio', { name: BIND }));
    await user.click(barButton('Dismiss'));
    const dialog = screen.getByRole('dialog');
    for (const option of ['Not the cause', 'Already handled', 'Other']) {
      expect(within(dialog).getByRole('radio', { name: option })).toBeInTheDocument();
    }
    await user.click(within(dialog).getByRole('radio', { name: 'Other' }));
    const submit = within(dialog).getByRole('button', { name: 'Dismiss recommendation' });
    await user.click(submit);
    expect(within(dialog).getByLabelText(/Details/)).toHaveFocus();
    await user.type(within(dialog).getByLabelText(/Details/), 'Waiting for NPS log check first');
    await user.click(submit);
    await user.click(screen.getByRole('tab', { name: 'Audit · 1 decision' }));
    // The chosen option is kept with the details, so the record shows both.
    expect(screen.getByRole('article', { name: BIND })).toHaveTextContent('Reason Other: Waiting for NPS log check first');
  });

  it('Escalate defaults to Identity & Access, requires a note, and preserves both hypotheses', async () => {
    const user = userEvent.setup();
    renderIncident();
    await switchTo(user, 'Low confidence');
    await user.click(screen.getByRole('radio', { name: BIND }));
    await user.click(barButton('Escalate'));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByLabelText('Team')).toHaveValue('Identity & Access');
    const submit = within(dialog).getByRole('button', { name: 'Escalate' });
    expect(submit).toHaveAccessibleDescription('Add a note for the receiving team.');
    await user.type(within(dialog).getByLabelText('Note for the receiving team'), 'Cannot confirm cause without NPS logs.');
    await user.click(submit);
    expect(screen.getByRole('heading', { level: 1 }).parentElement).toHaveTextContent('Status: Escalated');
    await user.click(screen.getByRole('tab', { name: 'Audit · 1 decision' }));
    const entry = screen.getByRole('article', { name: BIND });
    expect(entry).toHaveTextContent('Escalated to Identity & Access');
    expect(entry).toHaveTextContent('Note Cannot confirm cause without NPS logs.');
    await user.click(within(entry).getByRole('button', { name: 'View analysis at decision time' }));
    expect(within(entry).getByRole('heading', { level: 4, name: PRIMARY_LOW })).toBeInTheDocument();
    expect(within(entry).getByRole('heading', { level: 4, name: ALTERNATIVE })).toBeInTheDocument();
    expect(within(entry).queryByText(/acknowledged out-of-date/)).not.toBeInTheDocument();
  });

  it('recommendation selection works by keyboard, including the blocked card', async () => {
    const user = userEvent.setup();
    renderIncident();
    await switchTo(user, 'Low confidence');
    screen.getByRole('radio', { name: VERIFY_NPS }).focus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('radio', { name: BIND })).toBeChecked();
    expect(screen.getByRole('radio', { name: BIND })).toHaveAccessibleDescription(`Unavailable: ${REASONS.lowConfidence}`);
  });
});

// ── Stale analysis (fake timers) ──────────────────────────────────────────

describe('Stale analysis: timers, gating, re-run and acknowledge', () => {
  beforeEach(() => {
    // Fake only the timer APIs the app uses. React's scheduler runs on setImmediate under
    // Node; faking that would stop renders from flushing.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    // Testing Library drains pending work with setTimeout(0); it advances fake clocks only when
    // it sees Jest-style timers through a global `jest`. Expose that shim for Vitest.
    (globalThis as unknown as { jest: unknown }).jest = { advanceTimersByTime: (ms: number) => vi.advanceTimersByTime(ms) };
  });
  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    delete (globalThis as unknown as { jest?: unknown }).jest;
  });
  // No user-event delays, so only the app's own timers run on the fake clock.
  const setup = () => userEvent.setup({ delay: null });
  const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));

  it('starts like Base, then after 3 s appends 3 events marked "New since analysis" and goes stale', async () => {
    const user = setup();
    renderIncident();
    await switchTo(user, 'Stale analysis');
    expect(screen.queryByText(/new events since this analysis/)).not.toBeInTheDocument();
    expect(within(ai()).getByRole('group', { name: 'Confidence: High' })).toBeInTheDocument();
    expect(barButton('Approve')).toHaveAttribute('aria-disabled', 'false');

    advance(2999);
    expect(screen.queryByText(/new events since this analysis/)).not.toBeInTheDocument();
    advance(1);
    expect(screen.getByText(/3 new events since this analysis \(06:11\)\./)).toBeInTheDocument();
    expect(screen.getByText('The conclusions below may be out of date.')).toBeInTheDocument();
    expect(within(facts()).getAllByText('New since analysis')).toHaveLength(3);
    expect(announcer()).toHaveTextContent('3 new events arrived. The analysis is out of date, so approvals are paused.');
  });

  it('stale blocks every Approve and Modify; Dismiss and Escalate stay available; blocked attempts write nothing', async () => {
    const user = setup();
    renderIncident();
    await switchTo(user, 'Stale analysis');
    advance(3000);
    expect(barButton('Approve')).toHaveAccessibleDescription(`Approve and Modify unavailable: ${REASONS.staleConsequential}`);
    for (const title of ['Verify the renewed certificate chain before binding', NOTIFY]) {
      await user.click(screen.getByRole('radio', { name: title }));
      expect(barButton('Approve')).toHaveAttribute('aria-disabled', 'true');
      expect(barButton('Modify')).toHaveAttribute('aria-disabled', 'true');
      expect(barButton('Approve')).toHaveAccessibleDescription(`Approve and Modify unavailable: ${REASONS.staleLowRisk}`);
      expect(barButton('Dismiss')).toHaveAttribute('aria-disabled', 'false');
      expect(barButton('Escalate')).toHaveAttribute('aria-disabled', 'false');
      await user.click(barButton('Approve'));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    }
    expect(auditTab()).toHaveTextContent('Audit');
  });

  it('a confirmation dialog open when the analysis goes stale shows why and cannot submit', async () => {
    const user = setup();
    renderIncident();
    await switchTo(user, 'Stale analysis');
    await user.click(barButton('Approve'));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText(/Type nps-bldga-01/), 'nps-bldga-01');
    advance(3000);
    const confirm = within(dialog).getByRole('button', { name: 'Approve and create change request' });
    expect(confirm).toHaveAttribute('aria-disabled', 'true');
    expect(confirm).toHaveAccessibleDescription(REASONS.staleConsequential);
    await user.click(confirm);
    expect(screen.getByRole('dialog')).toBeInTheDocument(); // refused: the dialog stays, with its reason
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(auditTab()).toHaveTextContent('Audit');
  });

  it('Re-run: Stale → Analyzing → Ready with stale-v2; consequential approval returns; audit records the re-run', async () => {
    const user = setup();
    renderIncident();
    await switchTo(user, 'Stale analysis');
    advance(3000);
    const rerun = screen.getByRole('button', { name: 'Re-run analysis' });
    await user.click(rerun);

    expect(screen.getByText('Re-running analysis with the 3 new events…')).toBeInTheDocument();
    expect(ai()).toHaveAttribute('aria-busy', 'true');
    expect(barButton('Dismiss')).toHaveAccessibleDescription(`All actions unavailable: ${REASONS.analyzing}`);
    expect(announcer()).toHaveTextContent('Re-running analysis.');
    // Focus does not fall to the page when the Re-run button is replaced.
    advance(10);
    expect(document.activeElement).not.toBe(document.body);

    advance(1489);
    expect(screen.getByText('Re-running analysis with the 3 new events…')).toBeInTheDocument();
    advance(1);
    expect(screen.queryByText(/new events since this analysis/)).not.toBeInTheDocument();
    expect(screen.getByText('Analysis updated at 06:16.')).toBeInTheDocument();
    expect(ai()).not.toHaveAttribute('aria-busy');
    expect(within(ai()).getByText(/based on 22 events/)).toBeInTheDocument();
    expect(within(ai()).getByRole('group', { name: 'Confidence: High' })).toBeInTheDocument();
    expect(within(facts()).queryByText('New since analysis')).not.toBeInTheDocument();
    expect(announcer()).toHaveTextContent('Analysis updated. It now includes the new events.');
    advance(10);
    expect(document.activeElement).not.toBe(document.body);

    // Consequential approval is available again and is decided on the refreshed analysis.
    await user.click(screen.getByRole('radio', { name: BIND }));
    expect(barButton('Approve')).toHaveAttribute('aria-disabled', 'false');
    await user.click(barButton('Approve'));
    await user.type(within(screen.getByRole('dialog')).getByLabelText(/Type nps-bldga-01/), 'nps-bldga-01');
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Approve and create change request' }));
    await user.click(screen.getByRole('tab', { name: 'Audit · 1 decision' }));
    expect(screen.getByText('Analysis re-run')).toBeInTheDocument();
    expect(screen.getByText('3 new events arrived after the 06:11 analysis. Analysis marked out of date.')).toBeInTheDocument();
    const entry = screen.getByRole('article', { name: BIND });
    await user.click(within(entry).getByRole('button', { name: 'View analysis at decision time' }));
    expect(within(entry).getByText(/Frozen at 06:16, demo-fixture-v2/)).toBeInTheDocument();
    expect(within(entry).queryByText(/acknowledged out-of-date/)).not.toBeInTheDocument();
  });

  it('Acknowledge needs explicit confirmation; Cancel leaves the analysis stale', async () => {
    const user = setup();
    renderIncident();
    await switchTo(user, 'Stale analysis');
    advance(3000);
    const acknowledge = screen.getByRole('button', { name: 'Acknowledge' });
    await user.click(acknowledge);
    const dialog = screen.getByRole('dialog', { name: 'Continue with the 06:11 analysis?' });
    expect(dialog).toHaveAccessibleDescription('You are proceeding with an analysis that does not include the 3 new events.');
    expect(within(dialog).getByText(/Consequential actions stay blocked until you re-run/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    advance(10);
    expect(screen.getByText(/3 new events since this analysis/)).toBeInTheDocument();
    expect(acknowledge).toHaveFocus();
  });

  it('acknowledged enables low-risk actions (flagged) but never consequential Approve or Modify', async () => {
    const user = setup();
    renderIncident();
    await switchTo(user, 'Stale analysis');
    advance(3000);
    await user.click(screen.getByRole('button', { name: 'Acknowledge' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Acknowledge and continue' }));
    advance(10);
    expect(screen.getByText('Continuing with the 06:11 analysis.')).toBeInTheDocument();
    expect(announcer()).toHaveTextContent('Continuing with the out-of-date analysis.');
    expect(document.activeElement).not.toBe(document.body);

    // Consequential stays blocked.
    for (const name of ['Approve', 'Modify']) {
      expect(barButton(name)).toHaveAttribute('aria-disabled', 'true');
      expect(barButton(name)).toHaveAccessibleDescription(`Approve and Modify unavailable: ${REASONS.acknowledgedConsequential}`);
    }
    // Low impact is available and its approval is flagged.
    await user.click(screen.getByRole('radio', { name: NOTIFY }));
    expect(barButton('Approve')).toHaveAttribute('aria-disabled', 'false');
    await user.click(barButton('Approve'));
    expect(within(screen.getByRole('dialog')).getByRole('note')).toHaveTextContent('flagged in the audit trail');
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Approve' }));
    // Dismiss (not flagged) on another card.
    await user.click(screen.getByRole('radio', { name: 'Create a follow-up task: monitor certificate expiry on NPS servers' }));
    await user.click(barButton('Dismiss'));
    await user.click(within(screen.getByRole('dialog')).getByRole('radio', { name: 'Not the cause' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Dismiss recommendation' }));

    await user.click(screen.getByRole('tab', { name: 'Audit · 2 decisions' }));
    const approved = screen.getByRole('article', { name: NOTIFY });
    const dismissed = screen.getByRole('article', { name: 'Create a follow-up task: monitor certificate expiry on NPS servers' });
    expect(within(approved).getByText('Approved on acknowledged out-of-date analysis')).toBeInTheDocument();
    expect(within(dismissed).queryByText('Approved on acknowledged out-of-date analysis')).not.toBeInTheDocument();
    expect(screen.getByText('Stale analysis acknowledged. Consequential actions still require a re-run.')).toBeInTheDocument();
    // The frozen analysis is the one the person acted on: the 06:11 version.
    await user.click(within(approved).getByRole('button', { name: 'View analysis at decision time' }));
    expect(within(approved).getByText(/Frozen at 06:11, demo-fixture-v1 \(pre-authored\), based on 19 events/)).toBeInTheDocument();
  });

  it('events arriving do not move focus (no focus stealing)', async () => {
    const user = setup();
    renderIncident();
    await switchTo(user, 'Stale analysis');
    const radio = screen.getByRole('radio', { name: NOTIFY });
    radio.focus();
    advance(3000);
    expect(radio).toHaveFocus();
  });

  it('switching scenario cancels pending timers; an old callback cannot affect the new scenario', async () => {
    const user = setup();
    renderIncident();
    await switchTo(user, 'Stale analysis');
    advance(1000);
    await switchTo(user, 'Base');
    advance(5000);
    expect(screen.queryByText(/new events since this analysis/)).not.toBeInTheDocument();
    expect(within(facts()).queryByText('New since analysis')).not.toBeInTheDocument();

    // Re-run in one stale scenario, then restart it: the old re-run must not complete into the new one.
    await switchTo(user, 'Stale analysis');
    advance(3000);
    await user.click(screen.getByRole('button', { name: 'Re-run analysis' }));
    await switchTo(user, 'Base');
    await switchTo(user, 'Stale analysis');
    advance(1500); // when the old re-run would have completed
    expect(screen.queryByText(/Analysis updated at/)).not.toBeInTheDocument();
    expect(within(ai()).getByText(/based on 19 events/)).toBeInTheDocument();
    advance(1500); // the new scenario's own late-event timer (3 s from its start)
    expect(within(facts()).getAllByText('New since analysis')).toHaveLength(3); // exactly once
  });

  it('keeps displayed chronology valid across arrival, acknowledge and decision', async () => {
    const user = setup();
    renderIncident();
    await switchTo(user, 'Stale analysis');
    advance(3000);
    await user.click(screen.getByRole('button', { name: 'Acknowledge' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Acknowledge and continue' }));
    await user.click(screen.getByRole('radio', { name: NOTIFY }));
    await user.click(barButton('Approve'));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Approve' }));
    await user.click(screen.getByRole('tab', { name: 'Audit · 1 decision' }));
    const times = [...document.querySelectorAll('[role=tabpanel] time')].map((t) => t.getAttribute('datetime')!);
    const newestToOldest = [...times];
    expect([...newestToOldest].reverse()).toEqual([...times].sort()); // listed newest first, strictly ordered
    expect(times[0]! > '2026-10-20T06:15:10Z').toBe(true); // decision after the newest event
  });
});

// ── Accessibility sweeps (real timers) ────────────────────────────────────

describe('Phase 5 accessibility (axe)', () => {
  it('low confidence: default, blocked card selected, Verify selected, dialogs and audit entry', async () => {
    const user = userEvent.setup();
    const { container } = renderIncident();
    await switchTo(user, 'Low confidence');
    await expectNoAxeViolations(container);
    await user.click(screen.getByRole('radio', { name: BIND }));
    await expectNoAxeViolations(container);
    await user.click(barButton('Dismiss'));
    await expectNoAxeViolations(document.body);
    await user.keyboard('{Escape}');
    await user.click(barButton('Escalate'));
    await expectNoAxeViolations(document.body);
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('radio', { name: VERIFY_NPS }));
    await expectNoAxeViolations(container);
    await user.click(barButton('Approve'));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Approve' }));
    await user.click(screen.getByRole('tab', { name: 'Audit · 1 decision' }));
    await user.click(screen.getByRole('button', { name: 'View analysis at decision time' }));
    await expectNoAxeViolations(container);
  }, 30000);

  it('stale: before events, banner, acknowledge dialog, acknowledged, analyzing, refreshed, audit', async () => {
    const user = userEvent.setup();
    const { container } = renderIncident();
    await switchTo(user, 'Stale analysis');
    await expectNoAxeViolations(container);
    await act(() => new Promise((r) => setTimeout(r, 3100)));
    expect(screen.getByText(/new events since this analysis/)).toBeInTheDocument();
    await expectNoAxeViolations(container);
    await user.click(screen.getByRole('button', { name: 'Acknowledge' }));
    await expectNoAxeViolations(document.body);
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Acknowledge and continue' }));
    await expectNoAxeViolations(container);
    await user.click(screen.getByRole('button', { name: 'Re-run analysis' }));
    expect(screen.getByText('Re-running analysis with the 3 new events…')).toBeInTheDocument();
    await expectNoAxeViolations(container);
    await act(() => new Promise((r) => setTimeout(r, 1600)));
    expect(screen.getByText(/Analysis updated at/)).toBeInTheDocument();
    await expectNoAxeViolations(container);
    await user.click(screen.getByRole('radio', { name: BIND }));
    await user.click(barButton('Approve'));
    await user.type(within(screen.getByRole('dialog')).getByLabelText(/Type nps-bldga-01/), 'nps-bldga-01');
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Approve and create change request' }));
    await user.click(screen.getByRole('tab', { name: 'Audit · 1 decision' }));
    await user.click(screen.getByRole('button', { name: 'View analysis at decision time' }));
    await expectNoAxeViolations(container);
  }, 40000);
});
