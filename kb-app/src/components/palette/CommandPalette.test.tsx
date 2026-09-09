import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import CommandPalette from './CommandPalette';
import topicsData from '../../data/topics.clean.json';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

function renderPalette() {
  return render(
    <MemoryRouter>
      <CommandPalette />
    </MemoryRouter>,
  );
}

describe('CommandPalette', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('is closed by default', () => {
    renderPalette();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens on Ctrl+K from anywhere, including while a text input is focused', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <input aria-label="unrelated field" />
        <CommandPalette />
      </MemoryRouter>,
    );
    await user.click(screen.getByLabelText('unrelated field'));
    await user.keyboard('{Control>}k{/Control}');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('shows all six actions and no topics when opened with an empty query', async () => {
    const user = userEvent.setup();
    renderPalette();
    await user.keyboard('{Control>}k{/Control}');
    expect(screen.getByRole('option', { name: 'כרטיסיות' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'מבחן' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'מפת ידע' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'הגדרות' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'החלף ערכת נושא' })).toBeInTheDocument();
    expect(screen.getAllByRole('option')).toHaveLength(6);
  });

  it('narrows results as the user types', async () => {
    const user = userEvent.setup();
    renderPalette();
    await user.keyboard('{Control>}k{/Control}');
    await user.type(screen.getByRole('combobox'), 'מבחן');
    expect(screen.getByRole('option', { name: 'מבחן' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'כרטיסיות' })).not.toBeInTheDocument();
  });

  it('typing a topic title shows it as a result', async () => {
    const user = userEvent.setup();
    renderPalette();
    await user.keyboard('{Control>}k{/Control}');
    // fireEvent.change (not user.type) — real topic titles can contain
    // characters userEvent's keyboard syntax treats specially (e.g. `{`),
    // so setting the input value directly is the safe way to search by an
    // arbitrary title from the real dataset.
    fireEvent.change(screen.getByRole('combobox'), { target: { value: topicsData[0].title } });
    expect(screen.getByRole('option', { name: topicsData[0].title })).toBeInTheDocument();
  });

  it('ArrowDown + Enter selects the second result and navigates', async () => {
    const user = userEvent.setup();
    renderPalette();
    await user.keyboard('{Control>}k{/Control}');
    // Empty query -> actions in fixed order: home, flashcards, quiz, map, toggle-theme.
    await user.keyboard('{ArrowDown}{Enter}');
    expect(mockNavigate).toHaveBeenCalledWith('/flashcards');
  });

  it('Escape closes the palette and restores focus to the previously focused element', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <button type="button">trigger</button>
        <CommandPalette />
      </MemoryRouter>,
    );
    const trigger = screen.getByRole('button', { name: 'trigger' });
    trigger.focus();
    await user.keyboard('{Control>}k{/Control}');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('selecting a page action navigates and closes the palette', async () => {
    const user = userEvent.setup();
    renderPalette();
    await user.keyboard('{Control>}k{/Control}');
    await user.click(screen.getByRole('option', { name: 'מבחן' }));
    expect(mockNavigate).toHaveBeenCalledWith('/quiz');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('selecting "settings" navigates to /settings and closes the palette', async () => {
    const user = userEvent.setup();
    renderPalette();
    await user.keyboard('{Control>}k{/Control}');
    await user.click(screen.getByRole('option', { name: 'הגדרות' }));
    expect(mockNavigate).toHaveBeenCalledWith('/settings');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('selecting "toggle theme" flips the theme attribute and closes the palette', async () => {
    const user = userEvent.setup();
    renderPalette();
    await user.keyboard('{Control>}k{/Control}');
    await user.click(screen.getByRole('option', { name: 'החלף ערכת נושא' }));
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('selecting a topic navigates to its reader and closes the palette', async () => {
    const user = userEvent.setup();
    renderPalette();
    await user.keyboard('{Control>}k{/Control}');
    fireEvent.change(screen.getByRole('combobox'), { target: { value: topicsData[0].title } });
    await user.click(screen.getByRole('option', { name: topicsData[0].title }));
    expect(mockNavigate).toHaveBeenCalledWith(`/topic/${encodeURIComponent(topicsData[0].id)}`);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
