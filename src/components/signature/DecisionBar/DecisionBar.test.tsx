import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useReducer } from 'react';
import { REASONS } from '../../../domain/gate';
import { decisionInputError, findRecommendation, gateFor, reducer, type AppState } from '../../../domain/reducer';
import { mediumConfidenceState, openedState, recordedState, run, staleArrived } from '../../../dev/galleryData';
import { expectNoAxeViolations } from '../../../test/axe';
import { ACTION_PAST } from '../shared/labels';
import { DecisionBar } from './DecisionBar';

/** Drives DecisionBar with the real reducer, exactly as a screen will. */
function Harness({ initial }: { initial: AppState }) {
  const [state, dispatch] = useReducer(reducer, initial);
  const rec = findRecommendation(state, state.selectedRecommendationId) ?? null;
  const g = rec ? gateFor(state, rec.id) ?? null : null;
  const draft = state.draft;
  const last = state.audit.find((a) => a.id === state.lastDecisionId);
  return (
    <DecisionBar
      recommendation={rec}
      gate={g}
      draft={draft}
      inputError={draft && rec && g ? decisionInputError(draft.action, rec, g, draft.input) : null}
      recorded={last?.kind === 'decision' ? { at: last.at, summary: ACTION_PAST[last.action], outcome: last.outcome } : null}
      onStart={(action) => dispatch({ type: 'DECISION_STARTED', action })}
      onInput={(input) => dispatch({ type: 'DECISION_INPUT_CHANGED', input })}
      onCancel={() => dispatch({ type: 'DECISION_CANCELLED' })}
      onSubmit={() => dispatch({ type: 'DECISION_SUBMITTED' })}
    />
  );
}

const select = (s: AppState, id: string) => ({ ...s, selectedRecommendationId: id });
const BIND = 'rec-bind-restart';
const BIND_TITLE = 'Bind the renewed certificate to NPS and restart the service';

describe('DecisionBar', () => {
  it('names the decision group after the selected recommendation and shows its tier', () => {
    render(<Harness initial={openedState('base')} />);
    expect(screen.getByRole('group', { name: `Decision on: ${BIND_TITLE}` })).toBeInTheDocument();
    expect(screen.getByText('Consequential')).toBeInTheDocument();
    for (const name of ['Approve', 'Modify', 'Dismiss', 'Escalate']) {
      expect(screen.getByRole('button', { name })).toHaveAttribute('aria-disabled', 'false');
    }
  });

  it('base: consequential approval needs the typed system name, then records', async () => {
    const user = userEvent.setup();
    render(<Harness initial={openedState('base')} />);
    await user.click(screen.getByRole('button', { name: 'Approve' }));

    const dialog = screen.getByRole('dialog', { name: `Approve: ${BIND_TITLE}` });
    const confirm = within(dialog).getByRole('button', { name: 'Approve and create change request' });
    expect(confirm).toHaveAttribute('aria-disabled', 'true');
    expect(confirm).toHaveAccessibleDescription('Type nps-bldga-01 to confirm.');

    const field = within(dialog).getByLabelText(/Type nps-bldga-01 to confirm/);
    await user.click(confirm); // refused: shows the error and moves focus to the field
    expect(field).toHaveFocus();
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(screen.queryByRole('status')).toBeEmptyDOMElement();

    await user.type(field, 'nps-bldga-01');
    expect(confirm).toHaveAttribute('aria-disabled', 'false');
    await user.click(confirm);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Approved at 06:12.');
    expect(screen.getByRole('status')).toHaveTextContent('CHG-5521');
    // Focus moves to the confirmation so keyboard users land on what changed.
    await waitFor(() => expect(screen.getByText(/CHG-5521/).closest('p')).toHaveFocus());
  });

  it('Escape cancels without recording and returns focus to the trigger', async () => {
    const user = userEvent.setup();
    render(<Harness initial={openedState('base')} />);
    const approve = screen.getByRole('button', { name: 'Approve' });
    await user.click(approve);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(approve).toHaveFocus());
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('low confidence: Approve and Modify stay focusable, announce why, and do nothing', async () => {
    const user = userEvent.setup();
    render(<Harness initial={select(openedState('low'), BIND)} />);
    const approve = screen.getByRole('button', { name: 'Approve' });
    expect(approve).toHaveAttribute('aria-disabled', 'true');
    expect(approve).not.toBeDisabled();
    expect(approve).toHaveAccessibleDescription(`Approve and Modify unavailable: ${REASONS.lowConfidence}`);
    expect(screen.getByRole('button', { name: 'Modify' })).toHaveAccessibleDescription(`Approve and Modify unavailable: ${REASONS.lowConfidence}`);

    await user.tab();
    expect(approve).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dismiss' })).toHaveAttribute('aria-disabled', 'false');
  });

  it('low confidence: dismiss needs a reason, then records', async () => {
    const user = userEvent.setup();
    render(<Harness initial={select(openedState('low'), BIND)} />);
    await user.click(screen.getByRole('button', { name: 'Dismiss' }));
    const dialog = screen.getByRole('dialog', { name: `Dismiss: ${BIND_TITLE}` });
    const submit = within(dialog).getByRole('button', { name: 'Dismiss recommendation' });
    expect(submit).toHaveAttribute('aria-disabled', 'true');
    await user.click(submit);
    expect(within(dialog).getByRole('radio', { name: 'Not the cause' })).toHaveFocus();
    await user.click(within(dialog).getByRole('radio', { name: 'Not the cause' }));
    await user.click(submit);
    expect(screen.getByRole('status')).toHaveTextContent('Dismissed at');
  });

  it('escalate needs a team and a note', async () => {
    const user = userEvent.setup();
    render(<Harness initial={select(openedState('low'), BIND)} />);
    await user.click(screen.getByRole('button', { name: 'Escalate' }));
    const dialog = screen.getByRole('dialog');
    const submit = within(dialog).getByRole('button', { name: 'Escalate' });
    await user.selectOptions(within(dialog).getByLabelText('Team'), 'Identity & Access');
    expect(submit).toHaveAccessibleDescription('Add a note for the receiving team.');
    await user.type(within(dialog).getByLabelText('Note for the receiving team'), 'Please confirm via NPS logs.');
    await user.click(submit);
    expect(screen.getByRole('status')).toHaveTextContent('Escalated at');
  });

  it('stale: Approve and Modify announce that a re-run is required', () => {
    render(<Harness initial={select(staleArrived(), BIND)} />);
    expect(screen.getByRole('button', { name: 'Approve' })).toHaveAccessibleDescription(`Approve and Modify unavailable: ${REASONS.staleConsequential}`);
  });

  it('acknowledged stale: low-risk approval warns that it will be flagged', async () => {
    const user = userEvent.setup();
    const acknowledged = select(run(staleArrived(), { type: 'STALE_ACKNOWLEDGED' }), 'rec-notify-users');
    render(<Harness initial={acknowledged} />);
    await user.click(screen.getByRole('button', { name: 'Approve' }));
    expect(screen.getByRole('note')).toHaveTextContent('flagged in the audit trail');
  });

  it('modify: edit a parameter, see the original, confirm by typing, record', async () => {
    const user = userEvent.setup();
    render(<Harness initial={openedState('base')} />);
    await user.click(screen.getByRole('button', { name: 'Modify' }));
    const dialog = screen.getByRole('dialog', { name: `Modify and approve: ${BIND_TITLE}` });
    const window = within(dialog).getByLabelText('Restart window');
    await user.clear(window);
    await user.type(window, '06:30');
    expect(window).toHaveAccessibleDescription('Was: Now');
    await user.type(within(dialog).getByLabelText(/Type nps-bldga-01/), 'nps-bldga-01');
    await user.click(within(dialog).getByRole('button', { name: 'Approve with changes' }));
    expect(screen.getByRole('status')).toHaveTextContent('Approved with changes at');
  });

  it('medium confidence: shows the warning in the bar and in the dialog', async () => {
    const user = userEvent.setup();
    render(<Harness initial={select(mediumConfidenceState(), BIND)} />);
    expect(screen.getByText(/Confidence is Medium/)).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Approve' }));
    expect(screen.getByRole('note')).toHaveTextContent('Confidence is Medium');
  });

  it('recorded: one shared reason line when every action is blocked', () => {
    render(<Harness initial={recordedState()} />);
    expect(screen.getByRole('status')).toHaveTextContent('Approved at 06:12. Task created (mock).');
    expect(screen.getAllByText(/unavailable:/)).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Escalate' })).toHaveAccessibleDescription(`All actions unavailable: ${REASONS.alreadyDecided}`);
  });

  it('has no axe violations: bar, blocked bar and open dialog', async () => {
    const user = userEvent.setup();
    const { container, unmount } = render(<Harness initial={select(openedState('low'), BIND)} />);
    await expectNoAxeViolations(container);
    unmount();
    render(<Harness initial={openedState('base')} />);
    await user.click(screen.getByRole('button', { name: 'Approve' }));
    await expectNoAxeViolations(document.body);
  });
});
