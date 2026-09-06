import { useEffect, useRef, useState } from 'react';
import { useUserDataStore } from '../../store/userDataStore';

interface TopicNotesProps {
  topicId: string;
}

const SAVE_DEBOUNCE_MS = 500;

export default function TopicNotes({ topicId }: TopicNotesProps) {
  const storedText = useUserDataStore((s) => s.notes.get(topicId) ?? '');
  const setNote = useUserDataStore((s) => s.setNote);
  const [value, setValue] = useState(storedText);
  const timeoutRef = useRef<number | null>(null);

  // TopicReader is reused across /topic/:id navigations (no `key` prop in
  // Reader.tsx), so this component is never remounted when the topic
  // changes — resync local state from the new topic's stored note instead
  // of carrying over the previous topic's draft. Adjusting state during
  // render (rather than in an effect) is the pattern React recommends for
  // "reset state when a prop changes" — it avoids an extra render and the
  // react-hooks/set-state-in-effect lint rule, and — importantly — it only
  // fires on topicId change, not on every storedText change, so it never
  // clobbers an in-progress edit the moment the store's optimistic update
  // lands.
  const [prevTopicId, setPrevTopicId] = useState(topicId);
  if (topicId !== prevTopicId) {
    setPrevTopicId(topicId);
    setValue(storedText);
  }

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  function scheduleSave(text: string) {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = window.setTimeout(() => {
      timeoutRef.current = null;
      setNote(topicId, text);
    }, SAVE_DEBOUNCE_MS);
  }

  function flush(text: string) {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setNote(topicId, text);
  }

  return (
    <div className="mt-8 border-t border-[var(--kb-border)] pt-4">
      <label htmlFor={`topic-notes-${topicId}`} className="mb-2 block text-sm font-bold text-[var(--kb-text)]">
        ההערות שלי
      </label>
      <textarea
        id={`topic-notes-${topicId}`}
        value={value}
        onChange={(event) => {
          const text = event.target.value;
          setValue(text);
          scheduleSave(text);
        }}
        onBlur={(event) => flush(event.target.value)}
        placeholder="כתוב כאן הערות אישיות על הנושא…"
        rows={4}
        className="w-full rounded-lg border border-[var(--kb-border)] bg-[var(--kb-surface)] p-3 text-[var(--kb-text)] outline-none placeholder:text-[var(--kb-muted)]"
      />
    </div>
  );
}
