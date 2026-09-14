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
  // Compared against the last path seen rather than a "first run" flag: in
  // development React 19's StrictMode runs this effect twice for the same
  // path, and a boolean flag would treat the second run as a navigation and
  // steal focus (with a visible ring) on the very first page load.
  const lastPathRef = useRef(pathname);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    if (lastPathRef.current === pathname) return;
    lastPathRef.current = pathname;
    requestMainFocus();
  }, [pathname]);

  return null;
}
