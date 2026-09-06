import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TopicNotes from './TopicNotes';
import { useUserDataStore } from '../../store/userDataStore';

function reset() {
  useUserDataStore.setState({
    progress: new Map(),
    favorites: new Set(),
    recents: [],
    notes: new Map(),
    isLoaded: true,
  });
}

describe('TopicNotes', () => {
  beforeEach(() => {
    reset();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  it('renders a labeled, empty textarea when there is no existing note', () => {
    render(<TopicNotes topicId="topic-a" />);
    expect(screen.getByLabelText('ההערות שלי')).toHaveValue('');
  });

  it('renders the existing note text as the initial value', () => {
    useUserDataStore.setState({ notes: new Map([['topic-a', 'existing note']]) });
    render(<TopicNotes topicId="topic-a" />);
    expect(screen.getByLabelText('ההערות שלי')).toHaveValue('existing note');
  });

  it('commits to the store only after 500ms of no further typing', async () => {
    const user = userEvent.setup({ delay: null });
    render(<TopicNotes topicId="topic-a" />);
    const textarea = screen.getByLabelText('ההערות שלי');

    await user.type(textarea, 'hi');
    expect(useUserDataStore.getState().notes.get('topic-a')).toBeUndefined();

    // Vitest's `shouldAdvanceTime` fake-timer mode ticks the mock clock
    // forward in real-wall-clock-paced 20ms steps (its `advanceTimeDelta`
    // default), so a 499ms/1ms split leaves no margin against that
    // granularity and false-fails under normal render/keystroke overhead.
    // Widened to 400/100 — same intent (no premature commit, then commit
    // at the debounce boundary), matching the margin already used by the
    // "resets the debounce timer" test below.
    vi.advanceTimersByTime(400);
    expect(useUserDataStore.getState().notes.get('topic-a')).toBeUndefined();

    vi.advanceTimersByTime(100);
    expect(useUserDataStore.getState().notes.get('topic-a')).toBe('hi');
  });

  it('resets the debounce timer on every keystroke (no save mid-typing)', async () => {
    const user = userEvent.setup({ delay: null });
    render(<TopicNotes topicId="topic-a" />);
    const textarea = screen.getByLabelText('ההערות שלי');

    await user.type(textarea, 'a');
    vi.advanceTimersByTime(400);
    await user.type(textarea, 'b');
    vi.advanceTimersByTime(400);
    expect(useUserDataStore.getState().notes.get('topic-a')).toBeUndefined();

    vi.advanceTimersByTime(100);
    expect(useUserDataStore.getState().notes.get('topic-a')).toBe('ab');
  });

  it('flushes immediately on blur instead of waiting for the debounce', async () => {
    const user = userEvent.setup({ delay: null });
    render(
      <>
        <TopicNotes topicId="topic-a" />
        <button type="button">elsewhere</button>
      </>,
    );
    const textarea = screen.getByLabelText('ההערות שלי');

    await user.type(textarea, 'hi');
    await user.click(screen.getByRole('button', { name: 'elsewhere' }));
    expect(useUserDataStore.getState().notes.get('topic-a')).toBe('hi');
  });

  it('clearing the text back to empty removes the note from the store', async () => {
    useUserDataStore.setState({ notes: new Map([['topic-a', 'existing']]) });
    const user = userEvent.setup({ delay: null });
    render(<TopicNotes topicId="topic-a" />);
    const textarea = screen.getByLabelText('ההערות שלי');

    await user.clear(textarea);
    vi.advanceTimersByTime(500);
    expect(useUserDataStore.getState().notes.has('topic-a')).toBe(false);
  });

  it('does not persist after unmount even if a debounce was pending', async () => {
    const user = userEvent.setup({ delay: null });
    const { unmount } = render(<TopicNotes topicId="topic-a" />);
    const textarea = screen.getByLabelText('ההערות שלי');

    await user.type(textarea, 'hi');
    unmount();
    vi.advanceTimersByTime(500);
    expect(useUserDataStore.getState().notes.get('topic-a')).toBeUndefined();
  });

  it('resyncs its value when topicId changes without unmounting', () => {
    useUserDataStore.setState({ notes: new Map([['topic-b', 'note for b']]) });
    const { rerender } = render(<TopicNotes topicId="topic-a" />);
    expect(screen.getByLabelText('ההערות שלי')).toHaveValue('');

    rerender(<TopicNotes topicId="topic-b" />);
    expect(screen.getByLabelText('ההערות שלי')).toHaveValue('note for b');
  });
});
