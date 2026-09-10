import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TopicNotes from './TopicNotes';
import { useUserDataStore } from '../../store/userDataStore';
import { useSyncStore } from '../../store/syncStore';

function reset() {
  useUserDataStore.setState({
    progress: new Map(),
    favorites: new Set(),
    recents: [],
    notes: new Map(),
    isLoaded: true,
  });
  // Statically importing useSyncStore here (rather than leaving it to
  // userDataStore's own per-call `import('./syncStore')`) pre-warms the
  // module in the graph before a debounced/blur/unmount write can trigger
  // that dynamic import, and stubs the resulting scheduleDirtyPush call so
  // it doesn't leave a dangling real timer/network call running past this
  // test's lifetime.
  vi.spyOn(useSyncStore.getState(), 'scheduleDirtyPush').mockImplementation(() => {});
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

  it('does not write to the store on blur when nothing was edited', async () => {
    useUserDataStore.setState({ notes: new Map([['topic-a', 'unchanged']]) });
    const setNoteSpy = vi.spyOn(useUserDataStore.getState(), 'setNote');
    const user = userEvent.setup({ delay: null });
    render(
      <>
        <TopicNotes topicId="topic-a" />
        <button type="button">elsewhere</button>
      </>,
    );

    await user.click(screen.getByLabelText('ההערות שלי'));
    await user.click(screen.getByRole('button', { name: 'elsewhere' }));
    expect(setNoteSpy).not.toHaveBeenCalled();
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

  it('flushes a pending edit on unmount instead of discarding it', async () => {
    const user = userEvent.setup({ delay: null });
    const { unmount } = render(<TopicNotes topicId="topic-a" />);
    const textarea = screen.getByLabelText('ההערות שלי');

    await user.type(textarea, 'hi');
    unmount();
    expect(useUserDataStore.getState().notes.get('topic-a')).toBe('hi');
  });

  it('flushes a pending edit for the outgoing topic when topicId changes without unmounting', async () => {
    const user = userEvent.setup({ delay: null });
    const { rerender } = render(<TopicNotes topicId="topic-a" />);
    const textarea = screen.getByLabelText('ההערות שלי');

    await user.type(textarea, 'hi');
    rerender(<TopicNotes topicId="topic-b" />);
    expect(useUserDataStore.getState().notes.get('topic-a')).toBe('hi');
  });

  it('resyncs its value when topicId changes without unmounting', () => {
    useUserDataStore.setState({ notes: new Map([['topic-b', 'note for b']]) });
    const { rerender } = render(<TopicNotes topicId="topic-a" />);
    expect(screen.getByLabelText('ההערות שלי')).toHaveValue('');

    rerender(<TopicNotes topicId="topic-b" />);
    expect(screen.getByLabelText('ההערות שלי')).toHaveValue('note for b');
  });

  it('resyncs its value once the store finishes loading after this component already mounted', () => {
    useUserDataStore.setState({ notes: new Map(), isLoaded: false });
    render(<TopicNotes topicId="topic-a" />);
    expect(screen.getByLabelText('ההערות שלי')).toHaveValue('');

    act(() => {
      useUserDataStore.setState({ notes: new Map([['topic-a', 'loaded after mount']]), isLoaded: true });
    });
    expect(screen.getByLabelText('ההערות שלי')).toHaveValue('loaded after mount');
  });

  it('does not clobber an in-progress edit if hydration completes while typing', async () => {
    useUserDataStore.setState({ notes: new Map(), isLoaded: false });
    const user = userEvent.setup({ delay: null });
    render(<TopicNotes topicId="topic-a" />);
    const textarea = screen.getByLabelText('ההערות שלי');

    await user.type(textarea, 'typing');
    act(() => {
      useUserDataStore.setState({ notes: new Map([['topic-a', 'stale server text']]), isLoaded: true });
    });
    expect(textarea).toHaveValue('typing');
  });
});
