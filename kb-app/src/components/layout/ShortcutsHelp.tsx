import { useEffect, useRef, type KeyboardEvent } from 'react';

interface ShortcutsHelpProps {
  open: boolean;
  onClose: () => void;
}

const SHORTCUTS: { keys: string; description: string }[] = [
  { keys: '/', description: 'מיקוד בחיפוש' },
  { keys: 'Esc', description: 'ניקוי חיפוש / סגירת חלונית' },
  { keys: '?', description: 'הצגת קיצורי המקלדת האלה' },
  { keys: '↑ ↓ → ←', description: 'ניווט בין כרטיסים' },
  { keys: 'Enter', description: 'פתיחת נושא' },
  { keys: 'Home / End', description: 'מעבר לכרטיס הראשון / האחרון' },
];

export default function ShortcutsHelp({ open, onClose }: ShortcutsHelpProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (open) {
      previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      closeButtonRef.current?.focus();
    } else if (previousFocusRef.current) {
      previousFocusRef.current.focus();
      previousFocusRef.current = null;
    }
  }, [open]);

  if (!open) return null;

  function handleDialogKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    // The dialog currently has a single focusable element (the close button),
    // so trapping Tab is just a matter of keeping focus pinned to it.
    if (event.key === 'Tab') {
      event.preventDefault();
      closeButtonRef.current?.focus();
    }
  }

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-20 grid place-items-center bg-[var(--kb-overlay)] p-4"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-title"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={handleDialogKeyDown}
        className="w-full max-w-sm rounded-xl border border-[var(--kb-border)] bg-[var(--kb-surface)] p-6 shadow-[var(--kb-shadow-lg)]"
      >
        <h2 id="shortcuts-title" className="mb-4 text-lg font-bold text-[var(--kb-text)]">
          קיצורי מקלדת
        </h2>
        <dl className="flex flex-col gap-2">
          {SHORTCUTS.map((shortcut) => (
            <div key={shortcut.keys} className="flex items-center justify-between gap-4">
              <dt>
                <kbd className="rounded border border-[var(--kb-border-strong)] bg-[var(--kb-surface2)] px-2 py-1 font-mono text-sm">
                  {shortcut.keys}
                </kbd>
              </dt>
              <dd className="text-sm text-[var(--kb-text2)]">{shortcut.description}</dd>
            </div>
          ))}
        </dl>
        <button
          ref={closeButtonRef}
          type="button"
          aria-label="סגור"
          onClick={onClose}
          className="mt-6 min-h-11 w-full rounded-md border border-[var(--kb-border)] text-[var(--kb-text)]"
        >
          סגור
        </button>
      </div>
    </div>
  );
}
