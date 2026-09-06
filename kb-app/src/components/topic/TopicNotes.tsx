import { useEffect, useRef, useState } from 'react';
import { useUserDataStore } from '../../store/userDataStore';

interface TopicNotesProps {
  topicId: string;
}

const SAVE_DEBOUNCE_MS = 500;

export default function TopicNotes({ topicId }: TopicNotesProps) {
  const isLoaded = useUserDataStore((s) => s.isLoaded);
  const storedText = useUserDataStore((s) => s.notes.get(topicId) ?? '');
  const setNote = useUserDataStore((s) => s.setNote);
  const [value, setValue] = useState(storedText);
  const [isDirty, setIsDirty] = useState(false);
  const timeoutRef = useRef<number | null>(null);
  // Tracks the most recent locally-typed text; updated ONLY inside onChange
  // below (an event handler, never during render — react-hooks/refs rejects
  // reading/writing ref.current in the render body). Read by the
  // flush-on-leave effect's cleanup when a topic switch or unmount happens
  // with an unsaved debounce still pending. Deliberately never reset by the
  // resync branches below: render fully completes (including any retry)
  // BEFORE effect cleanups fire on commit, so resetting it there would
  // overwrite the outgoing topic's last edit before the cleanup reads it.
  // Leaving it stale between topics is safe because the cleanup only acts
  // on it when timeoutRef is non-null, which is only true right after
  // onChange set both together for the SAME topic.
  const editedTextRef = useRef(storedText);

  // TopicReader is reused across /topic/:id navigations (no `key` prop in
  // Reader.tsx), so this component is never remounted when the topic
  // changes — resync local state from the new topic's stored note. The
  // store also hydrates asynchronously after mount (App.tsx's loadUserData
  // effect runs post-mount, and the IndexedDB read is itself async), so a
  // component that mounted before hydration finished must also resync once
  // isLoaded flips — otherwise a real saved note stays invisible, and a
  // later blur on the apparently-empty field would silently delete it.
  // Both are handled via React's "adjust state during render" pattern —
  // a useEffect-based version trips react-hooks/set-state-in-effect. Only
  // useState setters are touched here (never a ref), satisfying
  // react-hooks/refs too. Each guard is self-terminating, and the
  // hydration guard never clobbers an in-progress edit (checked via the
  // isDirty STATE, not a ref read — reading state during render is fine).
  const [prevTopicId, setPrevTopicId] = useState(topicId);
  const [hasHydrated, setHasHydrated] = useState(isLoaded);
  if (topicId !== prevTopicId) {
    setPrevTopicId(topicId);
    setValue(storedText);
    setIsDirty(false);
  } else if (!hasHydrated && isLoaded) {
    setHasHydrated(true);
    if (!isDirty) {
      setValue(storedText);
    }
  }

  // Flushes any unsaved, still-pending edit instead of discarding it —
  // both when the topic changes (cleanup runs with the OUTGOING topicId
  // closed over, before the new effect for the new topicId is created)
  // and on true unmount (cleanup runs with whatever topicId was current).
  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
        setNote(topicId, editedTextRef.current);
      }
    };
  }, [topicId, setNote]);

  function scheduleSave(text: string) {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = window.setTimeout(() => {
      timeoutRef.current = null;
      setIsDirty(false);
      setNote(topicId, text);
    }, SAVE_DEBOUNCE_MS);
  }

  function flush(text: string) {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (!isDirty) return;
    setIsDirty(false);
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
          editedTextRef.current = text;
          setIsDirty(true);
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
