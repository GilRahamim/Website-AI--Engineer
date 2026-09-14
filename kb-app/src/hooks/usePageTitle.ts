import { useEffect } from 'react';
import { consumeMainFocus } from '../lib/routeFocus';

const SITE_NAME = 'AI Engineer';

/**
 * Sets document.title to "<page> · AI Engineer" (or just the site name) and,
 * after a client-side navigation, moves focus to the page's main region.
 */
export function usePageTitle(title?: string): void {
  useEffect(() => {
    document.title = title ? `${title} · ${SITE_NAME}` : SITE_NAME;
    consumeMainFocus();
  }, [title]);
}
