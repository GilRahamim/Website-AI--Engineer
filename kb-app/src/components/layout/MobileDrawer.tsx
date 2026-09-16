import { useEffect, useRef, type ReactNode } from 'react';
import { useUiStore } from '../../store/uiStore';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';

interface MobileDrawerProps {
  title: string;
  children: ReactNode;
}

/**
 * Slide-in panel for the sidebar's content on phones. Open state lives in
 * uiStore so the header's menu button and this panel stay decoupled.
 * Focus trap, Escape-to-close, and backdrop click are all handled by
 * Radix's Dialog primitive underneath Sheet.
 *
 * Radix's own close-focus restoration targets a `Dialog.Trigger` element,
 * but this drawer has no in-tree trigger (it's opened from the header's
 * menu button, decoupled through uiStore) — so `context.triggerRef` is
 * always null and Radix's default would drop focus to <body>. We track
 * whatever had focus when the drawer opened and restore it ourselves via
 * `onCloseAutoFocus`, while still letting Radix own the trap/Escape/backdrop
 * behavior.
 */
export default function MobileDrawer({ title, children }: MobileDrawerProps) {
  const open = useUiStore((s) => s.drawerOpen);
  const setDrawerOpen = useUiStore((s) => s.setDrawerOpen);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (open) {
      previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    }
  }, [open]);

  return (
    <Sheet open={open} onOpenChange={setDrawerOpen}>
      <SheetContent
        side="right"
        className="w-[min(20rem,85vw)] gap-0 overflow-y-auto p-0 pb-[env(safe-area-inset-bottom)] md:hidden"
        overlayClassName="md:hidden"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          previousFocusRef.current?.focus();
        }}
      >
        <SheetHeader className="flex-row items-center justify-between space-y-0 border-b border-[var(--kb-border)] px-4 py-3">
          <SheetTitle className="text-base font-bold text-[var(--kb-text)]">{title}</SheetTitle>
        </SheetHeader>
        <div className="flex-1">{children}</div>
      </SheetContent>
    </Sheet>
  );
}
