import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * BrowserRouter keeps the window's scroll offset across client-side
 * navigations, so opening a topic from the bottom of a long list used to land
 * the reader mid-page. Reset to the top whenever the path changes; hash
 * navigations (table of contents) are left to the browser.
 */
export default function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname]);

  return null;
}
