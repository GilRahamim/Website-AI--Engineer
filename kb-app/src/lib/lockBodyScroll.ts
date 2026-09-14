let lockCount = 0;

/**
 * Pins the document while a modal layer (drawer, command palette, shortcuts
 * dialog) is open, so a touch scroll inside the overlay never scrolls the
 * page behind it. Reference-counted: two overlays open at once release the
 * lock only when the last one closes. Returns the release function, shaped
 * for use as a useEffect cleanup.
 */
export function lockBodyScroll(): () => void {
  lockCount += 1;
  document.body.setAttribute('data-scroll-locked', '');
  let released = false;
  return () => {
    if (released) return;
    released = true;
    lockCount = Math.max(0, lockCount - 1);
    if (lockCount === 0) document.body.removeAttribute('data-scroll-locked');
  };
}
