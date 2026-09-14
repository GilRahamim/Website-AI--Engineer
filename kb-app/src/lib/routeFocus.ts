/**
 * Moves keyboard/screen-reader focus to the new page's main region after a
 * client-side navigation. ScrollToTop flags the navigation (it runs on every
 * pathname change, but the lazily-loaded page may not be mounted yet); the
 * page's usePageTitle hook, which always runs once the page is on screen,
 * consumes the flag. The initial page load is deliberately not flagged.
 */
let pending = false;

export function requestMainFocus(): void {
  pending = true;
}

export function consumeMainFocus(): void {
  if (!pending) return;
  pending = false;
  const main = document.querySelector<HTMLElement>('main');
  if (!main) return;
  if (!main.hasAttribute('tabindex')) main.setAttribute('tabindex', '-1');
  main.focus({ preventScroll: true });
}

/** Test-only reset. */
export function __resetRouteFocusForTests(): void {
  pending = false;
}
