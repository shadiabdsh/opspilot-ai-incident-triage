/**
 * Regression tests: a failed submit moves focus to the first field that is actually
 * invalid, and that field is described by the visible error.
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { gate } from '../../../domain/gate';
import { decisionInputError } from '../../../domain/reducer';
import type { DecisionInput } from '../../../domain/types';
import { REC_NOTIFY_USERS } from '../../../fixtures/recommendations';
import { ReasonDialog } from './ReasonDialog';

const gateResult = gate({ tier: 'low_impact', recommendationStatus: 'pending', confidence: 'high', analysisStatus: 'ready', incidentStatus: 'in_review' });

function Harness({ mode }: { mode: 'dismiss' | 'escalate' }) {
  const [input, setInput] = useState<DecisionInput>({});
  return (
    <ReasonDialog
      mode={mode}
      recommendation={REC_NOTIFY_USERS}
      input={input}
      inputError={decisionInputError(mode, REC_NOTIFY_USERS, gateResult, input)}
      onInput={(partial) => setInput((i) => ({ ...i, ...partial }))}
      onCancel={() => undefined}
      onSubmit={() => undefined}
    />
  );
}

const submitButton = (name: string) => within(screen.getByRole('dialog')).getByRole('button', { name });

describe('ReasonDialog focuses the actual invalid field', () => {
  it('dismiss, no reason selected → first reason option, group described by the error', async () => {
    const user = userEvent.setup();
    render(<Harness mode="dismiss" />);
    await user.click(submitButton('Dismiss recommendation'));
    expect(screen.getByRole('radio', { name: 'Not the cause' })).toHaveFocus();
    expect(screen.getByRole('group', { name: 'Reason' })).toHaveAccessibleDescription('Give a reason for dismissing.');
  });

  it('dismiss, "Other" with empty details → Details textarea', async () => {
    const user = userEvent.setup();
    render(<Harness mode="dismiss" />);
    await user.click(screen.getByRole('radio', { name: 'Other' }));
    await user.click(submitButton('Dismiss recommendation'));
    const details = screen.getByLabelText(/Details/);
    expect(details).toHaveFocus();
    expect(details).toHaveAttribute('aria-invalid', 'true');
    expect(details).toHaveAccessibleDescription('Give a reason for dismissing.');
    // The reason options are no longer the invalid field.
    expect(screen.getByRole('group', { name: 'Reason' })).not.toHaveAttribute('aria-describedby');

    await user.type(details, 'Duplicate of an earlier notice');
    expect(details).not.toHaveAttribute('aria-invalid');
  });

  it('escalate, no team → Team', async () => {
    const user = userEvent.setup();
    render(<Harness mode="escalate" />);
    await user.type(screen.getByLabelText('Note for the receiving team'), 'Please take over.');
    await user.click(submitButton('Escalate'));
    const team = screen.getByLabelText('Team');
    expect(team).toHaveFocus();
    expect(team).toHaveAttribute('aria-invalid', 'true');
    expect(team).toHaveAccessibleDescription('Choose a team to escalate to.');
    expect(screen.getByLabelText('Note for the receiving team')).not.toHaveAttribute('aria-invalid');
  });

  it('escalate, team selected but note empty → Note for the receiving team', async () => {
    const user = userEvent.setup();
    render(<Harness mode="escalate" />);
    await user.selectOptions(screen.getByLabelText('Team'), 'Identity & Access');
    await user.click(submitButton('Escalate'));
    const note = screen.getByLabelText('Note for the receiving team');
    expect(note).toHaveFocus();
    expect(note).toHaveAttribute('aria-invalid', 'true');
    expect(note).toHaveAccessibleDescription('Add a note for the receiving team.');
    expect(screen.getByLabelText('Team')).not.toHaveAttribute('aria-invalid');
  });
});
