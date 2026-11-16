import { DEFAULT_SETTINGS } from '@quiz/shared';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

import { SettingsForm } from './SettingsForm.js';

describe('SettingsForm', () => {
  it('updates the number of questions', () => {
    const onChange = vi.fn();
    render(<SettingsForm settings={DEFAULT_SETTINGS} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText('Number of questions'), {
      target: { value: '5' },
    });

    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ questionCount: 5 }),
    );
  });

  it('updates the difficulty', async () => {
    const onChange = vi.fn();
    render(<SettingsForm settings={DEFAULT_SETTINGS} onChange={onChange} />);

    await userEvent.selectOptions(screen.getByLabelText('Difficulty'), 'hard');

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ difficulty: 'hard' }),
    );
  });

  it('reveals auto-advance timing fields when enabled', () => {
    render(
      <SettingsForm
        settings={{ ...DEFAULT_SETTINGS, autoAdvance: true }}
        onChange={() => {}}
      />,
    );

    expect(
      screen.getByLabelText('Seconds on answer reveal'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Seconds on leaderboard')).toBeInTheDocument();
  });

  it('hides auto-advance timing fields when disabled', () => {
    render(
      <SettingsForm
        settings={{ ...DEFAULT_SETTINGS, autoAdvance: false }}
        onChange={() => {}}
      />,
    );

    expect(screen.queryByLabelText('Seconds on answer reveal')).toBeNull();
    expect(screen.queryByLabelText('Seconds on leaderboard')).toBeNull();
  });

  it('has the game switches on their defaults and lets the host flip them', async () => {
    const onChange = vi.fn();
    render(<SettingsForm settings={DEFAULT_SETTINGS} onChange={onChange} />);

    expect(
      screen.getByLabelText('Show the category before each question'),
    ).toBeChecked();
    expect(screen.getByLabelText('Show who picked which answer')).toBeChecked();
    expect(
      screen.getByLabelText('Include name-that-tune questions'),
    ).toBeChecked();
    const penalty = screen.getByLabelText('Wrong answers cost 250 points');
    expect(penalty).not.toBeChecked();

    await userEvent.click(penalty);
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ wrongAnswerPenalty: true }),
    );
    await userEvent.click(
      screen.getByLabelText('Show who picked which answer'),
    );
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ showVoters: false }),
    );
  });
});
