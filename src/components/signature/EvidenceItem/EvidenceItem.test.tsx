import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { systemsById } from '../../../domain/selectors';
import { ANALYSIS_BASE } from '../../../fixtures/analysis.base';
import { ALL_EVENTS, NPS_EVENTS, PRINTER_ONLINE } from '../../../fixtures/events';
import { TraceProvider, useTrace } from '../../../state/TraceProvider';
import { expectNoAxeViolations } from '../../../test/axe';
import { EvidenceItem } from './EvidenceItem';

const npsFailure = NPS_EVENTS[0]!;

function TraceProbe() {
  const { activeEventId, highlightedSystemId } = useTrace();
  return <p data-testid="probe">{`${activeEventId ?? 'none'}|${highlightedSystemId ?? 'none'}`}</p>;
}

describe('EvidenceItem', () => {
  it('shows stance, time, system id, observed provenance and the raw message', () => {
    render(<ul><EvidenceItem event={npsFailure} system={systemsById['nps-bldga-01']} stance="supporting" /></ul>);
    expect(screen.getByText('Supports')).toBeInTheDocument();
    expect(screen.getByText('06:01:04')).toBeInTheDocument();
    expect(screen.getByText('nps-bldga-01')).toBeInTheDocument();
    expect(screen.getByText('Observed fact, source: NPS log')).toBeInTheDocument();
    expect(screen.getByText(npsFailure.message)).toBeInTheDocument();
  });

  it('labels counter-evidence and shows its inferred explanation', () => {
    const explanation = ANALYSIS_BASE.hypotheses[0]!.counter[0]!.explanation;
    render(<ul><EvidenceItem event={PRINTER_ONLINE} stance="counter" explanation={explanation} /></ul>);
    expect(screen.getByText('Counter-evidence')).toBeInTheDocument();
    expect(screen.getByText('Inferred by AI')).toBeInTheDocument();
    expect(screen.getByText(explanation.text)).toBeInTheDocument();
  });

  it('Show source has a specific name, is described by the message, and works by keyboard', async () => {
    const user = userEvent.setup();
    const onShowSource = vi.fn();
    render(<ul><EvidenceItem event={npsFailure} stance="supporting" onShowSource={onShowSource} /></ul>);
    const button = screen.getByRole('button', { name: 'Show source: 06:01:04, nps-bldga-01' });
    expect(button).toHaveAccessibleDescription(npsFailure.message);
    await user.tab();
    expect(button).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(onShowSource).toHaveBeenCalledWith(npsFailure.id);
  });

  it('drives the trace on hover and on keyboard focus, and clears it on leave and blur', async () => {
    const user = userEvent.setup();
    render(
      <TraceProvider events={ALL_EVENTS}>
        <ul><EvidenceItem event={npsFailure} stance="supporting" onShowSource={() => undefined} /></ul>
        <button type="button">elsewhere</button>
        <TraceProbe />
      </TraceProvider>,
    );
    const probe = screen.getByTestId('probe');
    const item = screen.getByRole('listitem');

    await user.hover(item);
    expect(probe).toHaveTextContent(`${npsFailure.id}|nps-bldga-01`);
    expect(item).toHaveAttribute('data-active');
    await user.unhover(item);
    expect(probe).toHaveTextContent('none|none');

    await user.tab(); // focus Show source
    expect(probe).toHaveTextContent(`${npsFailure.id}|nps-bldga-01`);
    await user.tab(); // focus moves out
    expect(probe).toHaveTextContent('none|none');
  });

  it('shows the off-screen hint', () => {
    render(<ul><EvidenceItem event={npsFailure} stance="supporting" onShowSource={() => undefined} offscreen="below" /></ul>);
    expect(screen.getByText(/Source below/)).toBeInTheDocument();
  });

  it('read-only: no controls, no ids, no trace', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <TraceProvider events={ALL_EVENTS}>
        <ul><EvidenceItem event={npsFailure} stance="supporting" onShowSource={() => undefined} readOnly /></ul>
        <TraceProbe />
      </TraceProvider>,
    );
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(container.querySelector('ul [id]')).toBeNull();
    await user.hover(screen.getByRole('listitem'));
    expect(screen.getByTestId('probe')).toHaveTextContent('none|none');
  });

  it('has no axe violations', async () => {
    const { container } = render(
      <ul>
        <EvidenceItem event={npsFailure} stance="supporting" onShowSource={() => undefined} />
        <EvidenceItem event={PRINTER_ONLINE} stance="counter" explanation={ANALYSIS_BASE.hypotheses[0]!.counter[0]!.explanation} traceActive />
      </ul>,
    );
    await expectNoAxeViolations(container);
  });
});
