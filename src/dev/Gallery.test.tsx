import { render, screen } from '@testing-library/react';
import { expectNoAxeViolations } from '../test/axe';
import Gallery from './Gallery';

describe('Gallery', () => {
  it('renders every signature component section without axe violations', async () => {
    const { container } = render(<Gallery />);
    for (const name of ['ProvenanceTag', 'ConfidenceIndicator', 'EvidenceItem', 'HypothesisCard', 'RecommendationCard', 'DecisionBar', 'AuditEntry']) {
      expect(screen.getByRole('heading', { level: 2, name: new RegExp(name) })).toBeInTheDocument();
    }
    const ids = [...container.querySelectorAll('[id]')].map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    // The gallery intentionally shows several DecisionBars for the same recommendation, so
    // their landmarks share a name. Screens render exactly one bar, where this rule applies.
    await expectNoAxeViolations(container, ['landmark-unique']);
  }, 20000);
});
