import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ModuleChips from './ModuleChips';
import { useUiStore } from '../../store/uiStore';

const modules = { A: 'מודול א', B: 'מודול ב' };

beforeEach(() => {
  useUiStore.setState({ selectedModules: new Set() });
});

describe('ModuleChips', () => {
  it('renders an "all" chip pressed by default plus one chip per module', () => {
    render(<ModuleChips modules={modules} />);
    expect(screen.getByRole('group', { name: 'סינון לפי מודול' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'הכול' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'מודול א' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'מודול ב' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('toggles a module filter in the store and un-presses "all"', async () => {
    const user = userEvent.setup();
    render(<ModuleChips modules={modules} />);
    await user.click(screen.getByRole('button', { name: 'מודול ב' }));
    expect(useUiStore.getState().selectedModules).toEqual(new Set(['B']));
    expect(screen.getByRole('button', { name: 'הכול' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking "all" clears every module filter', async () => {
    const user = userEvent.setup();
    useUiStore.setState({ selectedModules: new Set(['A', 'B']) });
    render(<ModuleChips modules={modules} />);
    await user.click(screen.getByRole('button', { name: 'הכול' }));
    expect(useUiStore.getState().selectedModules.size).toBe(0);
  });
});
