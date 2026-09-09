import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TopicStatusButton from './TopicStatusButton';
import { useUserDataStore } from '../../store/userDataStore';
import { useSyncStore } from '../../store/syncStore';

function reset() {
  useUserDataStore.setState({ progress: new Map(), favorites: new Set(), recents: [], isLoaded: true });
  // Statically importing useSyncStore here (rather than leaving it to
  // userDataStore's own per-call `import('./syncStore')`) pre-warms the
  // module in the graph before a click can trigger that dynamic import,
  // and stubs the resulting scheduleDirtyPush call so it doesn't leave a
  // dangling real timer/network call running past this test's lifetime.
  vi.spyOn(useSyncStore.getState(), 'scheduleDirtyPush').mockImplementation(() => {});
}

describe('TopicStatusButton', () => {
  beforeEach(reset);

  it('defaults to "new" and describes the current and next state in its accessible name', () => {
    render(<TopicStatusButton topicId="topic-a" />);
    expect(screen.getByRole('button')).toHaveAccessibleName(/חדש/);
  });

  it('defaults to tabindex 0 when no tabIndex prop is given', () => {
    render(<TopicStatusButton topicId="topic-a" />);
    expect(screen.getByRole('button')).toHaveAttribute('tabindex', '0');
  });

  it('applies a given tabIndex prop to the button', () => {
    render(<TopicStatusButton topicId="topic-a" tabIndex={-1} />);
    expect(screen.getByRole('button')).toHaveAttribute('tabindex', '-1');
  });

  it('cycles the status in the store on each click', async () => {
    const user = userEvent.setup();
    render(<TopicStatusButton topicId="topic-a" />);
    const button = screen.getByRole('button');

    await user.click(button);
    expect(useUserDataStore.getState().progress.get('topic-a')).toBe('learning');
    await user.click(button);
    expect(useUserDataStore.getState().progress.get('topic-a')).toBe('mastered');
    await user.click(button);
    expect(useUserDataStore.getState().progress.get('topic-a')).toBe('new');
  });

  it('does not let its click reach an ancestor click handler', async () => {
    const user = userEvent.setup();
    const onAncestorClick = vi.fn();
    render(
      <div onClick={onAncestorClick}>
        <TopicStatusButton topicId="topic-a" />
      </div>,
    );
    await user.click(screen.getByRole('button'));
    expect(onAncestorClick).not.toHaveBeenCalled();
  });
});
