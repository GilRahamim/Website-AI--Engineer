import { useEffect, type RefObject } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Topic } from '../types';
import { useUserDataStore } from '../store/userDataStore';

interface ReaderShortcutOptions {
  topicId: string;
  prev: Topic | null;
  next: Topic | null;
  notesRef: RefObject<HTMLTextAreaElement | null>;
}

function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}

/**
 * Reader keyboard shortcuts: J/K move to the next/previous topic in the
 * module, F toggles favorite, S cycles the learning status, N focuses the
 * notes field. Bare keys only — anything typed into a field, or pressed with
 * a modifier, is left alone so the shortcuts never collide with typing or
 * browser/OS combos.
 */
export function useReaderShortcuts({ topicId, prev, next, notesRef }: ReaderShortcutOptions): void {
  const navigate = useNavigate();

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.ctrlKey || event.metaKey || event.altKey || isTyping(event.target)) return;
      switch (event.key.toLowerCase()) {
        case 'j':
          if (next) navigate(`/topic/${encodeURIComponent(next.id)}`);
          break;
        case 'k':
          if (prev) navigate(`/topic/${encodeURIComponent(prev.id)}`);
          break;
        case 'f':
          useUserDataStore.getState().toggleFavorite(topicId);
          break;
        case 's':
          useUserDataStore.getState().cycleStatus(topicId);
          break;
        case 'n':
          event.preventDefault();
          notesRef.current?.focus();
          break;
        default:
          return;
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [topicId, prev, next, notesRef, navigate]);
}
