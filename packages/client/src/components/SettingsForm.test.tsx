import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DEFAULT_SETTINGS, type CategorySummary } from '@quiz/shared';
import { SettingsForm } from './SettingsForm.js';

const categories: CategorySummary[] = [
  { name: 'Science', count: 5 },
  { name: 'Geography', count: 3 },
];

describe('SettingsForm categories', () => {
  it('shows "Any category" when none are selected', () => {
    render(
      <SettingsForm
        settings={{ ...DEFAULT_SETTINGS, categories: [] }}
        categories={categories}
        onChange={() => {}}
      />,
    );
    expect(screen.getByText('Any category')).toBeInTheDocument();
  });

  it('adds a category when its checkbox is checked', async () => {
    const onChange = vi.fn();
    render(
      <SettingsForm
        settings={{ ...DEFAULT_SETTINGS, categories: [] }}
        categories={categories}
        onChange={onChange}
      />,
    );

    await userEvent.click(screen.getByLabelText('Science (5)'));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ categories: ['Science'] }),
    );
  });

  it('removes a category when its checkbox is unchecked', async () => {
    const onChange = vi.fn();
    render(
      <SettingsForm
        settings={{ ...DEFAULT_SETTINGS, categories: ['Science', 'Geography'] }}
        categories={categories}
        onChange={onChange}
      />,
    );

    await userEvent.click(screen.getByLabelText('Science (5)'));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ categories: ['Geography'] }),
    );
  });

  it('reports how many categories are selected', () => {
    render(
      <SettingsForm
        settings={{ ...DEFAULT_SETTINGS, categories: ['Science', 'Geography'] }}
        categories={categories}
        onChange={() => {}}
      />,
    );
    expect(screen.getByText('2 selected')).toBeInTheDocument();
  });
});
