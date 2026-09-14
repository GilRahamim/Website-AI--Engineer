import { describe, expect, it } from 'vitest';
import { lockBodyScroll } from './lockBodyScroll';

describe('lockBodyScroll', () => {
  it('marks the body while locked and clears it on release', () => {
    const release = lockBodyScroll();
    expect(document.body.hasAttribute('data-scroll-locked')).toBe(true);
    release();
    expect(document.body.hasAttribute('data-scroll-locked')).toBe(false);
  });

  it('keeps the lock until every overlay has released it', () => {
    const releaseDrawer = lockBodyScroll();
    const releasePalette = lockBodyScroll();
    releaseDrawer();
    expect(document.body.hasAttribute('data-scroll-locked')).toBe(true);
    releasePalette();
    expect(document.body.hasAttribute('data-scroll-locked')).toBe(false);
  });

  it('ignores a second call to the same release function', () => {
    const releaseA = lockBodyScroll();
    const releaseB = lockBodyScroll();
    releaseA();
    releaseA();
    expect(document.body.hasAttribute('data-scroll-locked')).toBe(true);
    releaseB();
    expect(document.body.hasAttribute('data-scroll-locked')).toBe(false);
  });
});
