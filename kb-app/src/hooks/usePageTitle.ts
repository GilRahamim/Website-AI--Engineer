import { useEffect } from 'react';

const SITE_NAME = 'AI Engineer';

/** Sets document.title to "<page> · AI Engineer" (or just the site name). */
export function usePageTitle(title?: string): void {
  useEffect(() => {
    document.title = title ? `${title} · ${SITE_NAME}` : SITE_NAME;
  }, [title]);
}
