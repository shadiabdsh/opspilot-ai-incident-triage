import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { expectNoAxeViolations } from '../../../test/axe';
import { ProvenanceTag } from './ProvenanceTag';

describe('ProvenanceTag', () => {
  it('names observed facts with their source, without relying on icon or colour', () => {
    render(<ProvenanceTag kind="observed" source="NPS log" />);
    expect(screen.getByText('Observed fact, source: NPS log')).toBeInTheDocument();
  });

  it('names unknowns explicitly', () => {
    render(<ProvenanceTag kind="unknown" />);
    expect(screen.getByText('Unknown: the AI could not determine this')).toBeInTheDocument();
  });

  it('renders a static inferred tag as text, not a control', () => {
    render(<ProvenanceTag kind="inferred" evidenceCount={4} />);
    expect(screen.getByText('Inferred by AI, 4 evidence items')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('never makes observed or unknown tags interactive, even if a toggle is passed', () => {
    render(<ProvenanceTag kind="observed" onToggle={() => undefined} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('inferred toggle exposes evidence and works with mouse and keyboard', async () => {
    const user = userEvent.setup();
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <ProvenanceTag kind="inferred" evidenceCount={3} onToggle={() => setOpen((o) => !o)} expanded={open} controlsId="ev" />
          <div id="ev" hidden={!open}>
            evidence list
          </div>
        </>
      );
    }
    render(<Harness />);
    const toggle = screen.getByRole('button', { name: 'Inferred by AI, 3 evidence items' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveAttribute('aria-controls', 'ev');

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('evidence list')).toBeVisible();

    toggle.focus();
    await user.keyboard('{Enter}');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await user.keyboard(' ');
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });

  it('has no axe violations in any variant', async () => {
    const { container } = render(
      <div>
        <ProvenanceTag kind="observed" source="Cert inventory" />
        <ProvenanceTag kind="inferred" evidenceCount={2} />
        <ProvenanceTag kind="inferred" evidenceCount={2} onToggle={() => undefined} />
        <ProvenanceTag kind="unknown" />
      </div>,
    );
    await expectNoAxeViolations(container);
  });
});
