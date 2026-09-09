import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TopicFavoriteButton from './TopicFavoriteButton';
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

describe('TopicFavoriteButton', () => {
  beforeEach(reset);

  it('renders unfavorited by default with aria-pressed=false', () => {
    render(<TopicFavoriteButton topicId="topic-a" />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false');
  });

  it('defaults to tabindex 0 when no tabIndex prop is given', () => {
    render(<TopicFavoriteButton topicId="topic-a" />);
    expect(screen.getByRole('button')).toHaveAttribute('tabindex', '0');
  });

  it('applies a given tabIndex prop to the button', () => {
    render(<TopicFavoriteButton topicId="topic-a" tabIndex={-1} />);
    expect(screen.getByRole('button')).toHaveAttribute('tabindex', '-1');
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
