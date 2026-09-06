import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TopicStatusButton from './TopicStatusButton';
import { useUserDataStore } from '../../store/userDataStore';

function reset() {
  useUserDataStore.setState({ progress: new Map(), favorites: new Set(), recents: [], isLoaded: true });
}

describe('TopicStatusButton', () => {
  beforeEach(reset);

  it('defaults to "new" and describes the current and next state in its accessible name', () => {
    render(<TopicStatusButton topicId="topic-a" />);
    expect(screen.getByRole('button')).toHaveAccessibleName(/חדש/);
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
