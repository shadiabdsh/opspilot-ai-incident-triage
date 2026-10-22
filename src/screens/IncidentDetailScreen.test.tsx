import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AppRoutes, ROUTER_FUTURE } from '../App';
import { ANALYSIS_BASE } from '../fixtures/analysis.base';
import { expectNoAxeViolations } from '../test/axe';

const BIND = 'Bind the renewed certificate to NPS and restart the service';

function renderIncident(path = '/incidents/INC-2041') {
  return render(<MemoryRouter future={ROUTER_FUTURE} initialEntries={[path]}><AppRoutes /></MemoryRouter>);
}

const factsRegion = () => screen.getByRole('region', { name: 'Observed facts' });
const aiRegion = () => screen.getByRole('region', { name: /AI assistance/ });
/** The DecisionBar lives in the reserved dock, outside the scroll area. */
const decisionBar = () => screen.getByRole('region', { name: /Deciding on/ });

describe('Incident Detail: structure', () => {
  it('opens the incident into review and shows the header', () => {
    renderIncident();
    expect(screen.getByRole('heading', { level: 1, name: '12 endpoints offline in Building A' })).toBeInTheDocument();
    expect(screen.getByText('In review')).toBeInTheDocument();
    expect(screen.getByText('Critical')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true');
  });

  it('keeps observed facts and AI output in separate landmark regions', () => {
    renderIncident();
    const facts = factsRegion();
    const ai = aiRegion();
    // Facts: systems and raw events.
    expect(within(facts).getByRole('table', { name: 'Affected and related systems' })).toBeInTheDocument();
    expect(within(facts).getByText(/EAP-TLS handshake failures: 12 distinct clients/)).toBeInTheDocument();
    // No AI prose or AI provenance tags in the facts region.
    for (const s of ANALYSIS_BASE.summary) expect(within(facts).queryByText(s.text)).not.toBeInTheDocument();
    expect(within(facts).queryByText(/Inferred by AI/)).not.toBeInTheDocument();
    expect(within(facts).queryByText(ANALYSIS_BASE.hypotheses[0]!.cause.text)).not.toBeInTheDocument();
    // AI: summary, hypothesis, confidence, recommendations, decision.
    expect(within(ai).getByText(ANALYSIS_BASE.summary[2]!.text)).toBeInTheDocument();
    expect(within(ai).getByRole('article', { name: ANALYSIS_BASE.hypotheses[0]!.cause.text })).toBeInTheDocument();
    expect(within(ai).getByRole('group', { name: 'Confidence: High' })).toBeInTheDocument();
    expect(within(ai).getAllByText('Counter-evidence', { selector: 'span' }).length).toBeGreaterThan(0);
    expect(within(decisionBar()).getByRole('group', { name: `Decision on: ${BIND}` })).toBeInTheDocument();
  });

  it('preselects the consequential recommendation', () => {
    renderIncident();
    expect(screen.getByRole('radio', { name: BIND })).toBeChecked();
    expect(within(decisionBar()).getByRole('heading', { name: new RegExp(`Deciding on ${BIND}`) })).toBeInTheDocument();
  });
});

describe('Incident Detail: reserved decision dock and density', () => {
  it('renders the DecisionBar in the reserved dock, outside the scroll area', () => {
    renderIncident();
    const scroller = document.getElementById('main-scroll')!;
    expect(scroller).toBeInTheDocument();
    expect(scroller).not.toContainElement(decisionBar());
    expect(document.getElementById('main')).toContainElement(decisionBar());
  });

  it('removes the dock on the Audit tab', async () => {
    const user = userEvent.setup();
    renderIncident();
    await user.click(screen.getByRole('tab', { name: 'Audit' }));
    expect(screen.queryByRole('region', { name: /Deciding on/ })).not.toBeInTheDocument();
  });

  it('unselected recommendations are compact until selected or expanded; nothing is removed', async () => {
    const user = userEvent.setup();
    renderIncident();
    const verifyTitle = 'Verify the renewed certificate chain before binding';
    const card = screen.getByRole('radio', { name: verifyTitle }).closest('article')!;
    // Compact: title, tier, status and rationale visible; details present but hidden.
    expect(within(card).getByText('Read-only')).toBeVisible();
    expect(within(card).getByText('Pending')).toBeVisible();
    expect(within(card).getByText('None. Reads certificate details only.')).not.toBeVisible();
    const toggle = within(card).getByRole('button', { name: `Show details: ${verifyTitle}` });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await user.click(toggle);
    expect(within(card).getByText('None. Reads certificate details only.')).toBeVisible();
    await user.click(within(card).getByRole('button', { name: `Hide details: ${verifyTitle}` }));
    expect(within(card).getByText('None. Reads certificate details only.')).not.toBeVisible();

    // Selecting shows everything and needs no toggle.
    await user.click(screen.getByRole('radio', { name: verifyTitle }));
    expect(within(card).getByText('None. Reads certificate details only.')).toBeVisible();
    expect(within(card).queryByRole('button', { name: /details/ })).not.toBeInTheDocument();
    // The previously selected consequential card is now compact.
    const bindCard = screen.getByRole('radio', { name: BIND }).closest('article')!;
    expect(within(bindCard).getByText(/Rebind the previous certificate binding/)).not.toBeVisible();
  });

  it('keeps every event in the timeline and marks the ones the AI cites', () => {
    renderIncident();
    const rows = within(factsRegion()).getAllByRole('listitem').filter((li) => li.id.startsWith('event-row-'));
    expect(rows).toHaveLength(19);
    expect(rows.filter((r) => r.hasAttribute('data-cited')).length).toBeGreaterThan(0);
    expect(rows.filter((r) => !r.hasAttribute('data-cited')).length).toBeGreaterThan(0);
  });
});

describe('Incident Detail: trace', () => {
  it('hover and focus highlight the source event row and the system row', async () => {
    const user = userEvent.setup();
    renderIncident();
    const hypothesis = screen.getByRole('article', { name: ANALYSIS_BASE.hypotheses[0]!.cause.text });
    const showSource = within(hypothesis).getByRole('button', { name: 'Show source: 06:08:50, nps-bldga-01' });
    const evidenceItem = showSource.closest('li')!;

    await user.hover(evidenceItem);
    expect(document.getElementById('event-row-ev-nps-failures-12')).toHaveAttribute('data-active');
    const systemRow = within(factsRegion()).getByRole('rowheader', { name: 'nps-bldga-01' }).closest('tr')!;
    expect(systemRow).toHaveAttribute('data-active');
    await user.unhover(evidenceItem);
    expect(document.getElementById('event-row-ev-nps-failures-12')).not.toHaveAttribute('data-active');

    act(() => showSource.focus()); // keyboard focus traces too
    expect(document.getElementById('event-row-ev-nps-failures-12')).toHaveAttribute('data-active');
  });

  it('Show source moves focus to the event; Back to evidence returns it to the evidence item', async () => {
    const user = userEvent.setup();
    renderIncident();
    const hypothesis = screen.getByRole('article', { name: ANALYSIS_BASE.hypotheses[0]!.cause.text });
    const showSource = within(hypothesis).getByRole('button', { name: 'Show source: 06:08:50, nps-bldga-01' });
    await user.click(showSource);

    const row = document.getElementById('event-row-ev-nps-failures-12')!;
    await waitFor(() => expect(row).toHaveFocus());
    expect(row).toHaveAttribute('data-active');
    const back = within(row).getByRole('button', { name: 'Back to evidence' });
    await user.click(back);
    expect(showSource).toHaveFocus();
    expect(within(row).queryByRole('button', { name: 'Back to evidence' })).not.toBeInTheDocument();
  });

  it('Escape in the shown source row also returns to the evidence item', async () => {
    const user = userEvent.setup();
    renderIncident();
    const hypothesis = screen.getByRole('article', { name: ANALYSIS_BASE.hypotheses[0]!.cause.text });
    const showSource = within(hypothesis).getByRole('button', { name: 'Show source: 06:00:00, nps-bldga-01' });
    await user.click(showSource);
    await waitFor(() => expect(document.getElementById('event-row-ev-cert-expired')).toHaveFocus());
    await user.keyboard('{Escape}');
    expect(showSource).toHaveFocus();
  });

  it('Show source for a workstation event expands the systems group so the system row is visible', async () => {
    const user = userEvent.setup();
    renderIncident();
    const group = within(factsRegion()).getByRole('button', { name: /Building A workstations \(12\)/ });
    expect(group).toHaveAttribute('aria-expanded', 'false');
    const hypothesis = screen.getByRole('article', { name: ANALYSIS_BASE.hypotheses[0]!.cause.text });
    await user.click(within(hypothesis).getByRole('button', { name: 'Show source: 06:01:12, ws-a-001' }));
    expect(group).toHaveAttribute('aria-expanded', 'true');
    expect(within(factsRegion()).getByRole('rowheader', { name: 'ws-a-001' }).closest('tr')).toHaveAttribute('data-active');
  });

  it('the AI summary inferred tag expands its evidence (first step of the trace)', async () => {
    const user = userEvent.setup();
    renderIncident();
    const tag = within(aiRegion()).getAllByRole('button', { name: 'Inferred by AI, 2 evidence items' })[0]!;
    expect(tag).toHaveAttribute('aria-expanded', 'false');
    await user.click(tag);
    expect(tag).toHaveAttribute('aria-expanded', 'true');
    expect(document.getElementById(tag.getAttribute('aria-controls')!)).toBeVisible();
  });
});

describe('Incident Detail: base decision flow', () => {
  it('typed approval records the decision, updates status and adds an audit entry', async () => {
    const user = userEvent.setup();
    renderIncident();
    expect(screen.getByRole('tab', { name: 'Audit' })).toBeInTheDocument();

    await user.click(within(decisionBar()).getByRole('button', { name: 'Approve' }));
    const dialog = screen.getByRole('dialog', { name: `Approve: ${BIND}` });
    const confirm = within(dialog).getByRole('button', { name: 'Approve and create change request' });
    expect(confirm).toHaveAttribute('aria-disabled', 'true');
    await user.type(within(dialog).getByLabelText(/Type nps-bldga-01 to confirm/), 'nps-bldga-01');
    await user.click(confirm);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText('Decided')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Approved at 06:12.');
    expect(screen.getByRole('status')).toHaveTextContent('CHG-5521');
    // Approved card status, gate now blocks further decisions on it.
    expect(within(decisionBar()).getByRole('button', { name: 'Approve' })).toHaveAttribute('aria-disabled', 'true');

    // Audit tab receives the entry.
    const auditTab = screen.getByRole('tab', { name: 'Audit · 1 decision' });
    await user.click(auditTab);
    const entry = screen.getByRole('article', { name: BIND });
    expect(within(entry).getByText('Approved')).toBeInTheDocument();
    expect(within(entry).getByText(/CHG-5521 created/)).toBeInTheDocument();
  });

  it('"View in audit trail" opens the Audit tab', async () => {
    const user = userEvent.setup();
    renderIncident();
    await user.click(screen.getByRole('radio', { name: 'Verify the renewed certificate chain before binding' }));
    await user.click(within(decisionBar()).getByRole('button', { name: 'Approve' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Approve' }));
    await user.click(screen.getByRole('button', { name: 'View in audit trail' }));
    expect(screen.getByRole('tab', { name: 'Audit · 1 decision' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('In review')).toBeInTheDocument(); // read-only approval does not decide the incident
  });

  it('the Audit tab has an empty state and supports deep links', () => {
    renderIncident('/incidents/INC-2041?tab=audit');
    expect(screen.getByRole('tab', { name: 'Audit' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('No decisions yet. Decisions on this incident will appear here.')).toBeInTheDocument();
  });
});

describe('Incident Detail: accessibility', () => {
  it('has no axe violations on the overview', async () => {
    const { container } = renderIncident();
    await expectNoAxeViolations(container);
  }, 20000);

  it('tabs follow the ARIA tabs pattern (arrow keys)', async () => {
    const user = userEvent.setup();
    renderIncident();
    screen.getByRole('tab', { name: 'Overview' }).focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Audit' })).toHaveFocus();
  });
});
