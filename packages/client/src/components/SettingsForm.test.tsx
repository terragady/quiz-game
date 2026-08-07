import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DEFAULT_SETTINGS } from '@quiz/shared';
import { SettingsForm } from './SettingsForm.js';

describe('SettingsForm', () => {
  it('updates the number of questions', () => {
    const onChange = vi.fn();
    render(
      <SettingsForm settings={DEFAULT_SETTINGS} onChange={onChange} />,
    );

    fireEvent.change(screen.getByLabelText('Number of questions'), {
      target: { value: '5' },
    });

    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ questionCount: 5 }),
    );
  });

  it('updates the difficulty', async () => {
    const onChange = vi.fn();
    render(
      <SettingsForm settings={DEFAULT_SETTINGS} onChange={onChange} />,
    );

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

    expect(screen.getByLabelText('Seconds on answer reveal')).toBeInTheDocument();
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
});
