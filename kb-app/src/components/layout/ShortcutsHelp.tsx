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
  if (!open) return null;

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
