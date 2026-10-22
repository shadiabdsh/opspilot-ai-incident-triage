import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { gate, REASONS } from '../../../domain/gate';
import { indexById, systemsById } from '../../../domain/selectors';
import type { RecommendationStatus } from '../../../domain/types';
import { ALL_EVENTS } from '../../../fixtures/events';
import { REC_BIND_AND_RESTART, REC_NOTIFY_USERS, REC_VERIFY_CHAIN } from '../../../fixtures/recommendations';
import { expectNoAxeViolations } from '../../../test/axe';
import { RecommendationCard } from './RecommendationCard';

const eventsById = indexById(ALL_EVENTS);
const ready = gate({ tier: 'consequential', recommendationStatus: 'pending', confidence: 'high', analysisStatus: 'ready', incidentStatus: 'in_review' });
const lowBlocked = gate({ tier: 'consequential', recommendationStatus: 'pending', confidence: 'low', analysisStatus: 'ready', incidentStatus: 'in_review' });

function Group() {
  const [selected, setSelected] = useState(REC_BIND_AND_RESTART.id);
  return (
    <fieldset>
      <legend>Recommendations</legend>
      {[REC_BIND_AND_RESTART, REC_VERIFY_CHAIN, REC_NOTIFY_USERS].map((rec) => (
        <RecommendationCard key={rec.id} recommendation={rec} status="pending" gate={ready} selected={selected === rec.id} onSelect={() => setSelected(rec.id)} groupName="recs" eventsById={eventsById} systemsById={systemsById} />
      ))}
    </fieldset>
  );
}

describe('RecommendationCard', () => {
  it('is a radio labelled by its title; clicking selects', async () => {
    const user = userEvent.setup();
    render(<Group />);
    const bind = screen.getByRole('radio', { name: REC_BIND_AND_RESTART.title });
    const verify = screen.getByRole('radio', { name: REC_VERIFY_CHAIN.title });
    expect(bind).toBeChecked();
    await user.click(screen.getByText(REC_VERIFY_CHAIN.title));
    expect(verify).toBeChecked();
    expect(bind).not.toBeChecked();
  });

  it('arrow keys move selection within the group', async () => {
    const user = userEvent.setup();
    render(<Group />);
    screen.getByRole('radio', { name: REC_BIND_AND_RESTART.title }).focus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('radio', { name: REC_VERIFY_CHAIN.title })).toBeChecked();
  });

  it.each([
    [REC_VERIFY_CHAIN, 'Read-only'],
    [REC_NOTIFY_USERS, 'Low impact'],
    [REC_BIND_AND_RESTART, 'Consequential'],
  ])('shows risk tier, reversibility and impact (%#)', (rec, tier) => {
    render(<RecommendationCard recommendation={rec} status="pending" />);
    expect(screen.getByText(tier)).toBeInTheDocument();
    expect(screen.getByText(rec.impact)).toBeInTheDocument();
    expect(screen.getByText(rec.reversible ? 'Yes' : 'No')).toBeInTheDocument();
  });

  it('shows rollback for consequential actions', () => {
    render(<RecommendationCard recommendation={REC_BIND_AND_RESTART} status="pending" />);
    expect(screen.getByText(REC_BIND_AND_RESTART.rollback!)).toBeInTheDocument();
  });

  it.each([
    ['pending', 'Pending'],
    ['approved', 'Approved'],
    ['modified', 'Approved with changes'],
    ['dismissed', 'Dismissed'],
    ['escalated', 'Escalated'],
  ] as Array<[RecommendationStatus, string]>)('status %s is shown as text', (status, label) => {
    render(<RecommendationCard recommendation={REC_NOTIFY_USERS} status={status} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it('modified shows the changed parameter and its original value', () => {
    render(<RecommendationCard recommendation={REC_BIND_AND_RESTART} status="modified" modifiedParams={{ ...REC_BIND_AND_RESTART.params, 'Restart window': '06:30' }} />);
    expect(screen.getByText('06:30')).toBeInTheDocument();
    expect(screen.getByText('(changed from Now)')).toBeInTheDocument();
  });

  it('blocked: visible reason, radio still selectable and described by the reason', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<RecommendationCard recommendation={REC_BIND_AND_RESTART} status="pending" gate={lowBlocked} onSelect={onSelect} groupName="b" />);
    expect(screen.getByText(REASONS.lowConfidence)).toBeVisible();
    const radio = screen.getByRole('radio', { name: REC_BIND_AND_RESTART.title });
    expect(radio).toHaveAccessibleDescription(`Unavailable: ${REASONS.lowConfidence}`);
    await user.click(radio);
    expect(onSelect).toHaveBeenCalled();
  });

  it('interactive: rationale evidence stays collapsed until the inferred tag is activated (regression)', async () => {
    const user = userEvent.setup();
    render(<RecommendationCard recommendation={REC_BIND_AND_RESTART} status="pending" eventsById={eventsById} systemsById={systemsById} />);
    const tag = screen.getByRole('button', { name: 'Inferred by AI, 2 evidence items' });
    expect(screen.getByRole('list', { hidden: true })).not.toBeVisible();
    await user.click(tag);
    expect(screen.getByRole('list')).toBeVisible();
  });

  it('read-only with evidence data: evidence fully expanded, with no toggle, controls or ids', () => {
    const { container } = render(
      <RecommendationCard recommendation={REC_BIND_AND_RESTART} status="approved" eventsById={eventsById} systemsById={systemsById} onShowSource={() => undefined} readOnly headingLevel={4} />,
    );
    expect(screen.getByRole('list')).toBeVisible();
    expect(screen.getByText(/Renewed certificate CN=nps-bldga-01.corp.example issued 2026-10-06/)).toBeVisible();
    expect(screen.getByText('Inferred by AI, 2 evidence items')).toBeInTheDocument(); // static tag, not a toggle
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(container.querySelector('[id]')).toBeNull();
  });

  it('read-only: no radio, no buttons, no ids', () => {
    const { container } = render(<RecommendationCard recommendation={REC_BIND_AND_RESTART} status="approved" onSelect={() => undefined} eventsById={eventsById} readOnly headingLevel={4} />);
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(container.querySelector('[id]')).toBeNull();
  });

  it('has no axe violations (group and blocked card)', async () => {
    const { container } = render(
      <div>
        <Group />
        <fieldset>
          <legend>Blocked</legend>
          <RecommendationCard recommendation={REC_BIND_AND_RESTART} status="pending" gate={lowBlocked} onSelect={() => undefined} groupName="b2" />
        </fieldset>
      </div>,
    );
    await expectNoAxeViolations(container);
  });
});
