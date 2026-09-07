import { useEffect, useRef, useState } from 'react';
import { useUiStore } from '../../store/uiStore';

export default function SearchBar() {
  const searchQuery = useUiStore((s) => s.searchQuery);
  const setSearchQuery = useUiStore((s) => s.setSearchQuery);
  const [localValue, setLocalValue] = useState(searchQuery);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setSearchQuery(localValue), 200);
    return () => window.clearTimeout(timeoutId);
  }, [localValue, setSearchQuery]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const isTyping =
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement;
      if (event.key === '/' && !isTyping) {
        event.preventDefault();
        inputRef.current?.focus();
      }
      if (event.key === 'Escape' && document.activeElement === inputRef.current) {
        setLocalValue('');
        setSearchQuery('');
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setSearchQuery]);

  return (
    <label className="flex min-h-11 flex-1 items-center gap-2 rounded-lg border border-[var(--kb-border)] bg-[var(--kb-surface)] px-3">
      <span className="sr-only">חיפוש נושאים</span>
      <span aria-hidden="true">🔍</span>
      <input
        ref={inputRef}
        type="search"
        role="searchbox"
        aria-label="חיפוש נושאים"
        value={localValue}
        onChange={(event) => setLocalValue(event.target.value)}
        placeholder="חפש נושא… (לחץ / למיקוד)"
        className="w-full bg-transparent py-2 text-[var(--kb-text)] outline-none placeholder:text-[var(--kb-muted)]"
      />
    </label>
  );
}
