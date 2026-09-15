import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText } from 'lucide-react';
import { searchIndex, topics } from '../../lib/catalog';
import type { Topic } from '../../types';
import { useUserDataStore } from '../../store/userDataStore';
import { buildActionList, filterResults, type PaletteAction } from '../../lib/commandPalette';
import { getCurrentTheme, setTheme } from '../../lib/theme';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';

const allActions = buildActionList();

const ACTION_ROUTES: Record<string, string> = {
  home: '/',
  flashcards: '/flashcards',
  quiz: '/quiz',
  map: '/map',
  settings: '/settings',
};

/**
 * This component composes `Dialog`/`DialogContent` directly rather than the
 * `CommandDialog` wrapper: the `CommandDialog` scaffolded in
 * `components/ui/command.tsx` only forwards `open`/`onOpenChange`/`modal` to
 * the Radix `Dialog` root (its props type is Radix's own `DialogProps`,
 * which has no `title`/`description`/`shouldFilter`), and it hard-codes the
 * inner `Command` with no passthrough for extra props. So `shouldFilter`
 * would never reach `cmdk`'s `Command`, and there is no accessible
 * title/description rendered. Composing `Command` with `shouldFilter={false}`
 * directly (confirmed against `node_modules/cmdk`'s source: `shouldFilter`
 * is a real prop the root component destructures, and both its sort and
 * filter routines early-return when it's `false`, leaving `filtered.count`
 * as the full unfiltered item count) keeps this app's own `filterResults`
 * ranking in control of what's shown, exactly as intended.
 *
 * Radix's own close-focus restoration (in DialogContentModal) targets
 * `context.triggerRef.current`, but this dialog has no in-tree
 * `DialogTrigger` — it's opened externally via Ctrl/Cmd+K and the
 * `kb-open-palette` window event — so that ref is always null and Radix's
 * default `onCloseAutoFocus` ends up doing nothing, leaving focus stranded
 * (same issue as ShortcutsHelp.tsx / MobileDrawer.tsx in Tasks 5-6). We track
 * whatever had focus when the dialog opened and restore it ourselves via
 * `onCloseAutoFocus`, while still letting Radix own the trap/Escape/backdrop
 * behavior.
 */
export default function CommandPalette() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    function toggle() {
      setOpen((wasOpen) => {
        const next = !wasOpen;
        if (next) setQuery('');
        return next;
      });
    }
    function handleGlobalKeyDown(event: globalThis.KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && (event.key.toLowerCase() === 'k' || event.code === 'KeyK')) {
        event.preventDefault();
        toggle();
      }
    }
    function handleOpenRequest() {
      setOpen((wasOpen) => {
        if (!wasOpen) setQuery('');
        return true;
      });
    }
    window.addEventListener('keydown', handleGlobalKeyDown);
    window.addEventListener('kb-open-palette', handleOpenRequest);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
      window.removeEventListener('kb-open-palette', handleOpenRequest);
    };
  }, []);

  useEffect(() => {
    if (open) {
      previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    }
  }, [open]);

  const notes = useUserDataStore((s) => s.notes);
  const results = useMemo(() => filterResults(query, allActions, topics, searchIndex, notes), [query, notes]);

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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className="overflow-hidden p-0 shadow-lg"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          previousFocusRef.current?.focus();
        }}
      >
        <DialogTitle className="sr-only">חיפוש מהיר</DialogTitle>
        <DialogDescription className="sr-only">חפש נושא או פעולה</DialogDescription>
        <Command shouldFilter={false}>
          <CommandInput placeholder="חפש נושא או פעולה..." value={query} onValueChange={setQuery} />
          <CommandList>
            <CommandEmpty>אין תוצאות</CommandEmpty>
            {results.actions.length > 0 && (
              <CommandGroup heading="פעולות">
                {results.actions.map((action) => (
                  <CommandItem key={action.id} value={action.id} onSelect={() => runAction(action)}>
                    {action.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {results.topics.length > 0 && (
              <CommandGroup heading="נושאים">
                {results.topics.map((topic) => (
                  <CommandItem key={topic.id} value={topic.id} onSelect={() => openTopic(topic)}>
                    <FileText aria-hidden="true" size={16} className="me-2 shrink-0 text-[var(--kb-muted)]" />
                    {topic.title}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
