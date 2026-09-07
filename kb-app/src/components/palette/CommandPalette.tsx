import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import topicsRaw from '../../data/topics.clean.json';
import type { Topic } from '../../types';
import { buildActionList, filterResults, type PaletteAction } from '../../lib/commandPalette';
import { getCurrentTheme, setTheme } from '../../lib/theme';

const topics = topicsRaw as Topic[];
const allActions = buildActionList();

const ACTION_ROUTES: Record<string, string> = {
  home: '/',
  flashcards: '/flashcards',
  quiz: '/quiz',
  map: '/map',
};

type PaletteItem = { kind: 'action'; action: PaletteAction } | { kind: 'topic'; topic: Topic };

export default function CommandPalette() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Global Cmd/Ctrl+K listener, mounted once. Unlike this app's bare `/`/`?`
  // shortcuts, a modifier combo never collides with normal typing, so no
  // "am I typing" guard is needed and the listener applies everywhere,
  // including while a text field is focused. The query/index reset on open
  // happens inside this same event-handler callback (not a bare useEffect
  // body), so it never trips react-hooks/set-state-in-effect.
  useEffect(() => {
    function handleGlobalKeyDown(event: globalThis.KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && (event.key.toLowerCase() === 'k' || event.code === 'KeyK')) {
        event.preventDefault();
        setOpen((wasOpen) => {
          const next = !wasOpen;
          if (next) {
            setQuery('');
            setSelectedIndex(0);
          }
          return next;
        });
      }
    }
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  // Focus management only (ref writes + .focus() calls) — same pattern as
  // ShortcutsHelp.tsx. No setState here: this effect must not be the thing
  // that resets query/selectedIndex, or react-hooks/set-state-in-effect
  // would flag it.
  useEffect(() => {
    if (open) {
      previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      inputRef.current?.focus();
    } else if (previousFocusRef.current) {
      previousFocusRef.current.focus();
      previousFocusRef.current = null;
    }
  }, [open]);

  const results = useMemo(() => filterResults(query, allActions, topics), [query]);
  const combined: PaletteItem[] = [
    ...results.actions.map((action): PaletteItem => ({ kind: 'action', action })),
    ...results.topics.map((topic): PaletteItem => ({ kind: 'topic', topic })),
  ];

  function close() {
    setOpen(false);
  }

  function runAction(action: PaletteAction) {
    if (action.id === 'toggle-theme') {
      setTheme(getCurrentTheme() === 'dark' ? 'light' : 'dark');
    } else {
      const path = ACTION_ROUTES[action.id];
      if (path) navigate(path);
    }
    close();
  }

  function openTopic(topic: Topic) {
    navigate(`/topic/${encodeURIComponent(topic.id)}`);
    close();
  }

  function activateIndex(index: number) {
    const item = combined[index];
    if (!item) return;
    if (item.kind === 'action') runAction(item.action);
    else openTopic(item.topic);
  }

  function handleDialogKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Tab') {
      // Single focusable element (the input) — pin focus to it, same
      // trapping strategy as ShortcutsHelp.tsx.
      event.preventDefault();
      inputRef.current?.focus();
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSelectedIndex((i) => (combined.length === 0 ? 0 : (i + 1) % combined.length));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSelectedIndex((i) => (combined.length === 0 ? 0 : (i - 1 + combined.length) % combined.length));
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      activateIndex(selectedIndex);
    }
  }

  if (!open) return null;

  return (
    <div onClick={close} className="fixed inset-0 z-30 flex justify-center bg-[var(--kb-overlay)] p-4 pt-24">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="command-palette-title"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={handleDialogKeyDown}
        className="h-fit w-full max-w-lg rounded-xl border border-[var(--kb-border)] bg-[var(--kb-surface)] shadow-[var(--kb-shadow-lg)]"
      >
        <h2 id="command-palette-title" className="sr-only">
          חיפוש מהיר
        </h2>
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded="true"
          aria-controls="command-palette-listbox"
          aria-autocomplete="list"
          aria-activedescendant={combined.length > 0 ? `command-palette-option-${selectedIndex}` : undefined}
          aria-label="חיפוש מהיר"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelectedIndex(0);
          }}
          placeholder="חפש נושא או פעולה..."
          className="min-h-11 w-full rounded-t-xl border-b border-[var(--kb-border)] bg-transparent px-4 text-[var(--kb-text)] outline-none"
        />
        <ul id="command-palette-listbox" role="listbox" aria-label="תוצאות" className="max-h-80 overflow-y-auto p-2">
          {combined.length === 0 && <li className="px-3 py-2 text-sm text-[var(--kb-muted)]">אין תוצאות</li>}
          {combined.map((item, index) => {
            const key = item.kind === 'action' ? `action-${item.action.id}` : `topic-${item.topic.id}`;
            const label = item.kind === 'action' ? item.action.label : item.topic.title;
            const isSelected = index === selectedIndex;
            return (
              <li
                key={key}
                id={`command-palette-option-${index}`}
                role="option"
                aria-selected={isSelected}
                onClick={() => activateIndex(index)}
                onMouseEnter={() => setSelectedIndex(index)}
                className={`flex min-h-11 cursor-pointer items-center rounded-md px-3 text-[var(--kb-text)] ${
                  isSelected ? 'bg-[var(--kb-surface2)]' : ''
                }`}
              >
                {item.kind === 'topic' && (
                  <span aria-hidden="true" className="me-2 text-[var(--kb-muted)]">
                    📄
                  </span>
                )}
                {label}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
