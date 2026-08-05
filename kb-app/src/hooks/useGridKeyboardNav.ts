import { useCallback, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';

export interface GridItemProps {
  tabIndex: number;
  ref: (element: HTMLElement | null) => void;
  onFocus: () => void;
  onKeyDown: (event: ReactKeyboardEvent) => void;
}

export function useGridKeyboardNav(itemIds: string[], onActivate: (id: string) => void) {
  const [focusedId, setFocusedId] = useState<string | null>(itemIds[0] ?? null);
  const elementsRef = useRef(new Map<string, HTMLElement>());

  const focusIndex = useCallback(
    (index: number) => {
      if (itemIds.length === 0) return;
      const clamped = Math.max(0, Math.min(index, itemIds.length - 1));
      const id = itemIds[clamped];
      setFocusedId(id);
      elementsRef.current.get(id)?.focus();
    },
    [itemIds],
  );

  const getItemProps = useCallback(
    (id: string): GridItemProps => ({
      tabIndex: id === (focusedId ?? itemIds[0]) ? 0 : -1,
      ref: (element) => {
        if (element) {
          elementsRef.current.set(id, element);
        } else {
          elementsRef.current.delete(id);
        }
      },
      onFocus: () => setFocusedId(id),
      onKeyDown: (event) => {
        const currentIndex = itemIds.indexOf(id);
        switch (event.key) {
          case 'ArrowRight': // RTL: right = previous
            event.preventDefault();
            focusIndex(currentIndex - 1);
            break;
          case 'ArrowLeft': // RTL: left = next
            event.preventDefault();
            focusIndex(currentIndex + 1);
            break;
          case 'ArrowDown':
            event.preventDefault();
            focusIndex(currentIndex + 1);
            break;
          case 'ArrowUp':
            event.preventDefault();
            focusIndex(currentIndex - 1);
            break;
          case 'Home':
            event.preventDefault();
            focusIndex(0);
            break;
          case 'End':
            event.preventDefault();
            focusIndex(itemIds.length - 1);
            break;
          case 'Enter':
            event.preventDefault();
            onActivate(id);
            break;
          default:
            break;
        }
      },
    }),
    [focusedId, itemIds, focusIndex, onActivate],
  );

  return { focusedId, getItemProps };
}
