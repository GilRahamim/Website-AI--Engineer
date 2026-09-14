import { useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { useUiStore } from '../../store/uiStore';
import { lockBodyScroll } from '../../lib/lockBodyScroll';

interface MobileDrawerProps {
  title: string;
  children: ReactNode;
}

const FOCUSABLE = 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Slide-in panel for the sidebar's content on phones. Open state lives in
 * uiStore so the header's menu button and this panel stay decoupled. Focus
 * moves to the close button on open and back to the opener on close; Tab
 * cycles within the panel; Escape and the backdrop both close it.
 */
export default function MobileDrawer({ title, children }: MobileDrawerProps) {
  const open = useUiStore((s) => s.drawerOpen);
  const setDrawerOpen = useUiStore((s) => s.setDrawerOpen);
  const panelRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    if (!open) return;
    return lockBodyScroll();
  }, [open]);

  if (!open) return null;

  function close() {
    setDrawerOpen(false);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    if (event.key === 'Tab' && panelRef.current) {
      const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  }

  return (
    <div className="fixed inset-0 z-30 md:hidden">
      <div
        data-testid="drawer-backdrop"
        onClick={close}
        className="absolute inset-0 bg-[var(--kb-overlay)]"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onKeyDown={handleKeyDown}
        className="absolute inset-y-0 start-0 flex w-[min(20rem,85vw)] flex-col overflow-y-auto bg-[var(--kb-surface)] pb-[env(safe-area-inset-bottom)] shadow-[var(--kb-shadow-lg)]"
      >
        <div className="flex items-center justify-between border-b border-[var(--kb-border)] px-4 py-3">
          <h2 className="text-base font-bold text-[var(--kb-text)]">{title}</h2>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={close}
            aria-label="סגור"
            className="grid size-11 place-items-center rounded-[10px] bg-[var(--kb-surface2)] text-[var(--kb-text2)]"
          >
            <X aria-hidden="true" size={18} />
          </button>
        </div>
        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}
