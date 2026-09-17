const STORAGE_KEY = 'kb-path-mode';

/**
 * Guided (default) steers the user toward the current path topic without
 * blocking jumps ahead; Free drops the guidance entirely. Hard-locking is
 * frustrating for self-learning, so neither mode ever blocks navigation —
 * see site-build-docs/06-LEARNING-PATH.md.
 */
export type PathMode = 'guided' | 'free';

export function getPathMode(): PathMode {
  return localStorage.getItem(STORAGE_KEY) === 'free' ? 'free' : 'guided';
}

export function setPathMode(mode: PathMode): void {
  localStorage.setItem(STORAGE_KEY, mode);
  window.dispatchEvent(new Event('kb-path-mode-change'));
}
