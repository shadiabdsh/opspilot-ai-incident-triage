import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AppRoutes, ROUTER_FUTURE } from '../App';
import { IncidentQueue } from '../components/supporting/IncidentQueue/IncidentQueue';
import { expectNoAxeViolations } from '../test/axe';

const INC = '12 endpoints offline in Building A';
const BIND = 'Bind the renewed certificate to NPS and restart the service';

function renderApp(path = '/') {
  return render(<MemoryRouter future={ROUTER_FUTURE} initialEntries={[path]}><AppRoutes /></MemoryRouter>);
}
const queue = () => screen.getByRole('table', { name: /Open incidents/ });
/** Incident rows only (excludes the header row and the hidden preview row). */
const incidentRows = () => within(queue()).getAllByRole('row').filter((r) => r.querySelector('th[scope=row] a'));
const inc2041Row = () => screen.getByRole('link', { name: INC }).closest('tr')!;

describe('Dashboard: queue', () => {
  it('shows the page header, the queue above site health, and Dashboard as the active nav item', () => {
    renderApp();
    expect(screen.getByRole('heading', { level: 1, name: 'Operations' })).toBeInTheDocument();
    expect(screen.getByText('Updated')).toHaveTextContent('Updated 06:12');
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual(['Incident queue', 'Site health']);
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page');
  });

  it('renders 5 incidents sorted by severity then age, with INC-2041 first', () => {
    renderApp();
    const rows = incidentRows();
    expect(rows).toHaveLength(5);
    expect(within(rows[0]!).getByRole('link')).toHaveTextContent(INC);
    const severities = rows.map((r) => within(r).getByText(/Critical|Major|Minor|Info/).textContent);
    expect(severities).toEqual(['Severity: Critical', 'Severity: Major', 'Severity: Minor', 'Severity: Minor', 'Severity: Info']);
    // Within the two Minor incidents, the older one comes first.
    expect(within(rows[2]!).getByRole('link')).toHaveTextContent('Print queue stalled on floor 2');
  });

  it('each row shows severity, title, site, affected count, opened time and status as text', () => {
    renderApp();
    const row = inc2041Row();
    for (const text of ['Severity: Critical', 'INC-2041', '12 systems', '06:10', '2 min ago', 'Status: Open']) {
      expect(row).toHaveTextContent(text);
    }
    expect(within(row).getAllByText('Building A').length).toBeGreaterThan(0);
  });

  it('the title is the only link in each row (no whole-row click target)', () => {
    renderApp();
    for (const row of incidentRows()) {
      expect(within(row).getAllByRole('link')).toHaveLength(1);
      expect(row).not.toHaveAttribute('onclick');
      expect(row).not.toHaveAttribute('tabindex');
    }
  });

  it('the title link opens Incident Detail', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('link', { name: INC }));
    expect(screen.getByRole('heading', { level: 1, name: INC })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Observed facts' })).toBeInTheDocument();
  });

  it('marks grouping as an AI inference and nothing else AI-related appears', () => {
    renderApp();
    const row = inc2041Row();
    expect(within(row).getByText('Inferred by AI')).toBeInTheDocument();
    expect(within(row).getByText('12 alerts grouped')).toBeInTheDocument();
    expect(screen.queryByText(/confidence/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Recommend/)).not.toBeInTheDocument();
    expect(screen.queryByText(/expired certificate/i)).not.toBeInTheDocument();
  });
});

describe('Dashboard: source alerts', () => {
  it('preview disclosure is a real button with aria-expanded and aria-controls, showing the first 4 alerts', async () => {
    const user = userEvent.setup();
    renderApp();
    const toggle = screen.getByRole('button', { name: 'Preview source alerts' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    const region = document.getElementById(toggle.getAttribute('aria-controls')!)!;
    expect(region).not.toBeVisible();

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(region).toBeVisible();
    expect(within(region).getByText('First 4 of 12 source alerts')).toBeInTheDocument();
    const items = within(region).getAllByRole('listitem');
    expect(items).toHaveLength(4);
    expect(items[0]).toHaveTextContent('ws-a-001');
    expect(items[0]).toHaveTextContent('06:01:12');
    expect(items[0]).toHaveTextContent('Monitoring');
    expect(within(region).queryByText('ws-a-005')).not.toBeInTheDocument();
    expect(toggle).toHaveFocus(); // focus stays on the disclosure

    await user.click(toggle);
    expect(region).not.toBeVisible();
  });

  it('View all opens a named panel with all 12 alerts; Escape closes it and returns focus', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('button', { name: 'Preview source alerts' }));
    const viewAll = screen.getByRole('button', { name: 'View all 12 source alerts' });
    await user.click(viewAll);

    const panel = screen.getByRole('dialog', { name: 'Source alerts for INC-2041' });
    expect(panel).toHaveAccessibleDescription(/12 raw alerts that OpsPilot grouped/);
    const bodyRows = within(panel).getAllByRole('row').slice(1);
    expect(bodyRows).toHaveLength(12);
    expect(bodyRows[11]).toHaveTextContent('ws-a-012');

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(viewAll).toHaveFocus());
  });
});

describe('Dashboard: keyboard', () => {
  it('Tab reaches the INC-2041 title link, then its preview disclosure; Enter operates both', async () => {
    const user = userEvent.setup();
    renderApp();
    const link = screen.getByRole('link', { name: INC });
    const toggle = screen.getByRole('button', { name: 'Preview source alerts' });
    for (let i = 0; i < 20 && document.activeElement !== link; i++) await user.tab();
    expect(link).toHaveFocus();
    await user.tab();
    expect(toggle).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await user.tab();
    expect(screen.getByRole('button', { name: 'View all 12 source alerts' })).toHaveFocus();
  });
});

describe('Dashboard: return after a decision', () => {
  async function decideAndReturn(action: 'approve' | 'escalate') {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('link', { name: INC }));
    const bar = screen.getByRole('region', { name: /Deciding on/ });
    if (action === 'approve') {
      await user.click(within(bar).getByRole('button', { name: 'Approve' }));
      const dialog = screen.getByRole('dialog', { name: `Approve: ${BIND}` });
      await user.type(within(dialog).getByLabelText(/Type nps-bldga-01/), 'nps-bldga-01');
      await user.click(within(dialog).getByRole('button', { name: 'Approve and create change request' }));
    } else {
      await user.click(within(bar).getByRole('button', { name: 'Escalate' }));
      const dialog = screen.getByRole('dialog');
      await user.selectOptions(within(dialog).getByLabelText('Team'), 'Identity & Access');
      await user.type(within(dialog).getByLabelText('Note for the receiving team'), 'Please take over.');
      await user.click(within(dialog).getByRole('button', { name: 'Escalate' }));
    }
    await user.click(screen.getByRole('link', { name: 'Dashboard' }));
    return user;
  }

  it('Decided: status updates in place, the row highlights briefly, and a polite live region announces it', async () => {
    await decideAndReturn('approve');
    const row = inc2041Row();
    expect(incidentRows()[0]).toBe(row); // same queue position
    expect(row).toHaveTextContent('Status: Decided');
    expect(row).toHaveAttribute('data-changed');
    const live = screen.getAllByRole('status').find((s) => s.getAttribute('aria-live') === 'polite')!;
    await waitFor(() => expect(live).toHaveTextContent('INC-2041 status changed to Decided.'));
    // The highlight is non-essential: it goes away, the status text stays.
    await waitFor(() => expect(inc2041Row()).not.toHaveAttribute('data-changed'), { timeout: 4000 });
    expect(inc2041Row()).toHaveTextContent('Status: Decided');
  });

  it('Escalated: announced and shown as text', async () => {
    await decideAndReturn('escalate');
    expect(inc2041Row()).toHaveTextContent('Status: Escalated');
    const live = screen.getAllByRole('status').find((s) => s.getAttribute('aria-live') === 'polite')!;
    await waitFor(() => expect(live).toHaveTextContent('INC-2041 status changed to Escalated.'));
  });

  it('announces a change only once: a second visit is silent', async () => {
    const user = await decideAndReturn('approve');
    await user.click(screen.getByRole('link', { name: 'Incidents' }));
    await user.click(screen.getByRole('link', { name: 'Dashboard' }));
    expect(inc2041Row()).not.toHaveAttribute('data-changed');
    await new Promise((r) => setTimeout(r, 300));
    const live = screen.getAllByRole('status').find((s) => s.getAttribute('aria-live') === 'polite')!;
    expect(live).toBeEmptyDOMElement();
  });

  it('opening the incident without deciding does not announce anything', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('link', { name: INC }));
    await user.click(screen.getByRole('link', { name: 'Dashboard' }));
    expect(inc2041Row()).toHaveTextContent('Status: In review');
    expect(inc2041Row()).not.toHaveAttribute('data-changed');
  });
});

describe('Dashboard: loading and empty states', () => {
  const base = { incidents: [], now: '2026-10-20T06:12:00Z', sourceAlerts: {}, lastChecked: '2026-10-20T06:12:00Z' };

  it('loading: busy table with 5 fixed skeleton rows hidden from assistive tech', () => {
    render(<IncidentQueue {...base} mode="loading" />);
    const table = screen.getByRole('table', { name: /Open incidents/ });
    expect(table).toHaveAttribute('aria-busy', 'true');
    const skeletons = table.querySelectorAll('tbody tr[aria-hidden="true"]');
    expect(skeletons).toHaveLength(5);
  });

  it('loading via the development switch announces "Loading incidents"', () => {
    renderApp('/?demo=loading');
    expect(screen.getAllByRole('status').some((s) => s.textContent === 'Loading incidents')).toBe(true);
  });

  it('empty: "No open incidents" with last-checked time', () => {
    renderApp('/?demo=empty');
    expect(screen.getByText('No open incidents')).toBeInTheDocument();
    expect(screen.getByText(/Last checked/)).toHaveTextContent('Last checked 06:12');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});

describe('Dashboard: accessibility', () => {
  it('has no axe violations (default, preview open)', async () => {
    const user = userEvent.setup();
    const { container } = renderApp();
    await expectNoAxeViolations(container);
    await user.click(screen.getByRole('button', { name: 'Preview source alerts' }));
    await expectNoAxeViolations(container);
  }, 20000);

  it('has no axe violations with the full alert panel open', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('button', { name: 'Preview source alerts' }));
    await user.click(screen.getByRole('button', { name: 'View all 12 source alerts' }));
    await expectNoAxeViolations(document.body);
  }, 20000);

  it('has no axe violations in loading and empty states', async () => {
    const loading = renderApp('/?demo=loading');
    await expectNoAxeViolations(loading.container);
    loading.unmount();
    const empty = renderApp('/?demo=empty');
    await expectNoAxeViolations(empty.container);
  }, 20000);
});
