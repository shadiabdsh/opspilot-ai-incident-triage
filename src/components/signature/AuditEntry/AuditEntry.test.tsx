import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { systemsById } from '../../../domain/selectors';
import { allEventsById, auditExamples } from '../../../dev/galleryData';
import { expectNoAxeViolations } from '../../../test/axe';
import { AuditEntry } from './AuditEntry';

const examples = auditExamples();
const TITLE = 'Bind the renewed certificate to NPS and restart the service';

describe('AuditEntry', () => {
  it('approved: named by the recommendation, with time, actor, action and outcome', () => {
    render(<AuditEntry entry={examples.approved} eventsById={allEventsById} systemsById={systemsById} />);
    const entry = screen.getByRole('article', { name: TITLE });
    expect(within(entry).getByText('06:12')).toBeInTheDocument();
    expect(within(entry).getByText('Dana (you)')).toBeInTheDocument();
    expect(within(entry).getByText('Approved')).toBeInTheDocument();
    expect(within(entry).getByText(/CHG-5521/)).toBeInTheDocument();
  });

  it('frozen analysis expands by keyboard and contains no controls or duplicate ids', async () => {
    const user = userEvent.setup();
    const { container } = render(<AuditEntry entry={examples.approved} eventsById={allEventsById} systemsById={systemsById} />);
    const toggle = screen.getByRole('button', { name: 'View analysis at decision time' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await user.tab();
    await user.keyboard('{Enter}');
    expect(toggle).toHaveAttribute('aria-expanded', 'true');

    const snapshot = container.querySelector(`#${CSS.escape(toggle.getAttribute('aria-controls')!)}`) as HTMLElement;
    expect(snapshot).toBeVisible();
    expect(within(snapshot).getByText(/Frozen at 06:11, demo-fixture-v1 \(pre-authored\)/)).toBeInTheDocument();
    expect(within(snapshot).getByRole('heading', { level: 4, name: /expired RADIUS server certificate/ })).toBeInTheDocument();
    expect(within(snapshot).queryAllByRole('button')).toHaveLength(0);
    expect(within(snapshot).queryAllByRole('radio')).toHaveLength(0);
    expect(within(snapshot).queryAllByRole('textbox')).toHaveLength(0);
    expect(snapshot.querySelectorAll('[id]')).toHaveLength(0);

    const ids = [...document.querySelectorAll('[id]')].map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('frozen recommendation keeps the evidence the user saw, with no controls (regression)', () => {
    render(<AuditEntry entry={examples.approved} eventsById={allEventsById} systemsById={systemsById} defaultExpanded />);
    const heading = screen.getByRole('heading', { level: 4, name: TITLE });
    const frozenRecommendation = heading.closest('article') as HTMLElement;

    // 1. At least one cited event message is present (this one is cited only by the recommendation).
    expect(within(frozenRecommendation).getByText(/Renewed certificate CN=nps-bldga-01.corp.example issued 2026-10-06/)).toBeVisible();
    // 2. No button, no radio, no interactive id.
    expect(within(frozenRecommendation).queryAllByRole('button')).toHaveLength(0);
    expect(within(frozenRecommendation).queryAllByRole('radio')).toHaveLength(0);
    expect(frozenRecommendation.querySelectorAll('[id]')).toHaveLength(0);
  });

  it('modified: was/now diff with column headers and a modified flag', () => {
    render(<AuditEntry entry={examples.modified} eventsById={allEventsById} systemsById={systemsById} />);
    const table = screen.getByRole('table', { name: 'Parameter changes' });
    expect(within(table).getByRole('columnheader', { name: 'Was' })).toBeInTheDocument();
    expect(within(table).getByRole('columnheader', { name: 'Now' })).toBeInTheDocument();
    const row = within(table).getByRole('row', { name: /Restart window/ });
    expect(row).toHaveTextContent('Now');
    expect(row).toHaveTextContent('06:30');
    expect(screen.getByText('Parameters changed from the AI recommendation')).toBeInTheDocument();
  });

  it('dismissed: shows the reason and no stale flag', () => {
    render(<AuditEntry entry={examples.dismissed} eventsById={allEventsById} systemsById={systemsById} />);
    expect(screen.getByText('Dismissed')).toBeInTheDocument();
    expect(screen.getByText(/Already handled: facilities sent a notice/)).toBeInTheDocument();
    expect(screen.queryByText(/acknowledged out-of-date/)).not.toBeInTheDocument();
  });

  it('escalated: shows the team and the note', () => {
    render(<AuditEntry entry={examples.escalated} eventsById={allEventsById} systemsById={systemsById} />);
    expect(screen.getByText('Escalated to Identity & Access')).toBeInTheDocument();
    expect(screen.getByText('Note')).toBeInTheDocument();
    expect(screen.getByText(/please confirm and bind/)).toBeInTheDocument();
  });

  it('acknowledged stale: shows the flag', () => {
    render(<AuditEntry entry={examples.acknowledged} eventsById={allEventsById} systemsById={systemsById} />);
    expect(screen.getByText('Approved on acknowledged out-of-date analysis')).toBeInTheDocument();
  });

  it('system line: a quiet single line with time', () => {
    render(<AuditEntry entry={examples.systemLine} eventsById={allEventsById} systemsById={systemsById} />);
    expect(screen.getByText(/Stale analysis acknowledged/)).toBeInTheDocument();
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
  });

  it('has no axe violations, collapsed and expanded', async () => {
    const { container } = render(
      <div>
        <AuditEntry entry={examples.modified} eventsById={allEventsById} systemsById={systemsById} />
        <AuditEntry entry={examples.approved} eventsById={allEventsById} systemsById={systemsById} defaultExpanded />
      </div>,
    );
    await expectNoAxeViolations(container);
  });
});
