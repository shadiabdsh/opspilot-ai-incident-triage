import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { indexById, systemsById } from '../../../domain/selectors';
import { ANALYSIS_BASE } from '../../../fixtures/analysis.base';
import { ANALYSIS_LOW } from '../../../fixtures/analysis.low';
import { ALL_EVENTS } from '../../../fixtures/events';
import { expectNoAxeViolations } from '../../../test/axe';
import { HypothesisCard } from './HypothesisCard';

const eventsById = indexById(ALL_EVENTS);
const base = ANALYSIS_BASE.hypotheses[0]!;
const [lowPrimary, lowAlt] = ANALYSIS_LOW.hypotheses as [typeof base, typeof base];

describe('HypothesisCard', () => {
  it('primary High: named by its cause, shows confidence, evidence expanded', () => {
    render(<HypothesisCard hypothesis={base} eventsById={eventsById} systemsById={systemsById} dataSources={ANALYSIS_BASE.dataSources} onShowSource={() => undefined} />);
    const card = screen.getByRole('article', { name: base.cause.text });
    expect(within(card).getByText('Primary hypothesis')).toBeInTheDocument();
    expect(within(card).getByRole('group', { name: 'Confidence: High' })).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: /Supporting evidence \(4\)/ })).toHaveAttribute('aria-expanded', 'true');
    expect(within(card).getAllByText('Supports')).toHaveLength(4);
    expect(within(card).getAllByText('Counter-evidence', { selector: 'span' })).toHaveLength(2);
    expect(within(card).getByText('None for this analysis.')).toBeVisible();
    expect(within(card).getByText('Sources checked: 4 of 4.')).toBeInTheDocument();
  });

  it('primary Low: shows the Unknown with its reason and the missing source', () => {
    render(<HypothesisCard hypothesis={lowPrimary} eventsById={eventsById} systemsById={systemsById} dataSources={ANALYSIS_LOW.dataSources} />);
    expect(screen.getByRole('group', { name: 'Confidence: Low' })).toBeInTheDocument();
    expect(screen.getByText('Whether the workstations are failing authentication')).toBeVisible();
    expect(screen.getByText('Reason: The NPS event log could not be retrieved for this analysis.')).toBeVisible();
    expect(screen.getByText('Sources checked: 3 of 4. Not retrieved: NPS event log.')).toBeInTheDocument();
  });

  it('alternative: collapsed by default, counts still visible, expands by keyboard', async () => {
    const user = userEvent.setup();
    render(<HypothesisCard hypothesis={lowAlt} eventsById={eventsById} systemsById={systemsById} onShowSource={() => undefined} />);
    expect(screen.getByText('Alternative hypothesis')).toBeInTheDocument();
    const counterToggle = screen.getByRole('button', { name: /Counter-evidence \(2\)/ });
    expect(counterToggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Host reachable (MAB session active)')).not.toBeVisible();

    counterToggle.focus();
    await user.keyboard('{Enter}');
    expect(counterToggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Host reachable (MAB session active)')).toBeVisible();
  });

  it('the inferred tag on the cause toggles the supporting evidence', async () => {
    const user = userEvent.setup();
    render(<HypothesisCard hypothesis={lowAlt} eventsById={eventsById} systemsById={systemsById} />);
    const tag = screen.getByRole('button', { name: 'Inferred by AI, 2 evidence items' });
    const section = screen.getByRole('button', { name: /Supporting evidence/ });
    await user.click(tag);
    expect(tag).toHaveAttribute('aria-expanded', 'true');
    expect(section).toHaveAttribute('aria-expanded', 'true');
    expect(tag.getAttribute('aria-controls')).toBe(section.getAttribute('aria-controls'));
  });

  it('read-only: fully expanded, no controls, no ids', () => {
    const { container } = render(
      <HypothesisCard hypothesis={base} eventsById={eventsById} systemsById={systemsById} dataSources={ANALYSIS_BASE.dataSources} onShowSource={() => undefined} readOnly headingLevel={4} />,
    );
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(container.querySelector('[id]')).toBeNull();
    expect(screen.getAllByText('Supports')).toHaveLength(4);
    expect(screen.getByRole('heading', { level: 4, name: base.cause.text })).toBeInTheDocument();
  });

  it('has no axe violations (primary and alternative)', async () => {
    const { container } = render(
      <div>
        <HypothesisCard hypothesis={lowPrimary} eventsById={eventsById} systemsById={systemsById} dataSources={ANALYSIS_LOW.dataSources} onShowSource={() => undefined} />
        <HypothesisCard hypothesis={lowAlt} eventsById={eventsById} systemsById={systemsById} onShowSource={() => undefined} />
      </div>,
    );
    await expectNoAxeViolations(container);
  });
});
