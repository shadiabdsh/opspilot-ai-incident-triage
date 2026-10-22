import { render, screen } from '@testing-library/react';
import { expectNoAxeViolations } from '../../../test/axe';
import { ConfidenceIndicator } from './ConfidenceIndicator';

describe('ConfidenceIndicator', () => {
  it.each([
    ['high', 'High', 3],
    ['medium', 'Medium', 2],
    ['low', 'Low', 1],
  ] as const)('%s: named group, visible word, %s filled segments', (band, label, filled) => {
    const { container } = render(<ConfidenceIndicator band={band} reason="Because of the evidence." />);
    expect(screen.getByRole('group', { name: `Confidence: ${label}` })).toBeInTheDocument();
    expect(screen.getByText(`${label} confidence`)).toBeVisible();
    // Meaning survives grayscale: the number of filled segments encodes the band.
    expect(container.querySelectorAll('.filled')).toHaveLength(filled);
    expect(container.querySelectorAll('.empty')).toHaveLength(3 - filled);
  });

  it('always shows the reason as visible text, never a percentage', () => {
    const { container } = render(<ConfidenceIndicator band="low" reason="Timing only; NPS logs unavailable." />);
    expect(screen.getByText('Timing only; NPS logs unavailable.')).toBeVisible();
    expect(container.textContent).not.toMatch(/%/);
  });

  it('has no axe violations', async () => {
    const { container } = render(<ConfidenceIndicator band="high" reason="Direct evidence." />);
    await expectNoAxeViolations(container);
  });
});
