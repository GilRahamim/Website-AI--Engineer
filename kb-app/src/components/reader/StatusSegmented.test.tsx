import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StatusSegmented from './StatusSegmented';
import { useUserDataStore } from '../../store/userDataStore';

beforeEach(() => {
  useUserDataStore.setState({ progress: new Map(), isLoaded: true });
});

describe('StatusSegmented', () => {
  it('renders a radiogroup with the three learning states, "new" checked by default', () => {
    render(<StatusSegmented topicId="t1" />);
    expect(screen.getByRole('radiogroup', { name: 'מצב למידה' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'חדש' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'בלמידה' })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('radio', { name: 'נשלט' })).toHaveAttribute('aria-checked', 'false');
  });

  it('reflects the stored status', () => {
    useUserDataStore.setState({ progress: new Map([['t1', 'mastered']]) });
    render(<StatusSegmented topicId="t1" />);
    expect(screen.getByRole('radio', { name: 'נשלט' })).toHaveAttribute('aria-checked', 'true');
  });

  it('sets the status directly when an option is clicked', async () => {
    const user = userEvent.setup();
    render(<StatusSegmented topicId="t1" />);
    await user.click(screen.getByRole('radio', { name: 'נשלט' }));
    expect(useUserDataStore.getState().progress.get('t1')).toBe('mastered');
  });
});
