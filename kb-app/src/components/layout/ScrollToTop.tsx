import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { requestMainFocus } from '../../lib/routeFocus';

/**
 * BrowserRouter keeps the window's scroll offset across client-side
 * navigations, so opening a topic from the bottom of a long list used to land
 * the reader mid-page. Reset to the top whenever the path changes; hash
 * navigations (table of contents) are left to the browser. Every change after
 * the first render also asks for focus to move to the new page's <main>
 * (see lib/routeFocus) so keyboard and screen-reader users land somewhere.
 */
export default function ScrollToTop() {
  const { pathname } = useLocation();
  const isFirstRender = useRef(true);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    requestMainFocus();
  }, [pathname]);

  return null;
}
