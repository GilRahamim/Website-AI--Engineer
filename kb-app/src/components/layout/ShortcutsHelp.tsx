import { useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

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
  { keys: 'Ctrl/Cmd + K', description: 'פתיחת חיפוש מהיר ופעולות' },
];

/**
 * Radix's own close-focus restoration (in DialogContentModal) targets a
 * `Dialog.Trigger` element, but this dialog has no in-tree trigger — it's
 * opened externally via the `open`/`onClose` props (e.g. from a global "?"
 * keyboard shortcut) — so `context.triggerRef.current` is always null and
 * Radix's default `onCloseAutoFocus` (which calls `event.preventDefault()`
 * and then `context.triggerRef.current?.focus()`) ends up doing nothing,
 * leaving focus stranded. We track whatever had focus when the dialog opened
 * and restore it ourselves via `onCloseAutoFocus`, while still letting Radix
 * own the trap/Escape/backdrop behavior.
 */
export default function ShortcutsHelp({ open, onClose }: ShortcutsHelpProps) {
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (open) {
      previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        className="max-w-sm"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          previousFocusRef.current?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>קיצורי מקלדת</DialogTitle>
        </DialogHeader>
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
        <Button type="button" variant="outline" className="mt-2 w-full" onClick={onClose}>
          סגור
        </Button>
      </DialogContent>
    </Dialog>
  );
}
