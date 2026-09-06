import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TopicFavoriteButton from './TopicFavoriteButton';
import { useUserDataStore } from '../../store/userDataStore';

function reset() {
  useUserDataStore.setState({ progress: new Map(), favorites: new Set(), recents: [], isLoaded: true });
}

describe('TopicFavoriteButton', () => {
  beforeEach(reset);

  it('renders unfavorited by default with aria-pressed=false', () => {
    render(<TopicFavoriteButton topicId="topic-a" />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false');
  });

  it('toggles favorite state in the store on click, reflected via aria-pressed', async () => {
    const user = userEvent.setup();
    render(<TopicFavoriteButton topicId="topic-a" />);
    const button = screen.getByRole('button');

    await user.click(button);
    expect(useUserDataStore.getState().favorites.has('topic-a')).toBe(true);
    expect(button).toHaveAttribute('aria-pressed', 'true');

    await user.click(button);
    expect(useUserDataStore.getState().favorites.has('topic-a')).toBe(false);
  });

  it('does not let its click reach an ancestor click handler', async () => {
    const user = userEvent.setup();
    const onAncestorClick = vi.fn();
    render(
      <div onClick={onAncestorClick}>
        <TopicFavoriteButton topicId="topic-a" />
      </div>,
    );
    await user.click(screen.getByRole('button'));
    expect(onAncestorClick).not.toHaveBeenCalled();
  });
});
