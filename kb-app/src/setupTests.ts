import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// jsdom doesn't implement matchMedia. Provide a default stub so any code
// that reads it (src/lib/theme.ts) doesn't crash in tests that don't care
// about system-theme behavior. Tests that DO care override this per-test.
if (!window.matchMedia) {
  window.matchMedia = ((query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList) as typeof window.matchMedia;
}

// jsdom doesn't implement ResizeObserver. Provide a minimal no-op stub so
// any code that constructs one (src/pages/Map.tsx) doesn't crash in tests
// — the initial synchronous dimension read still runs, so gated rendering
// (`{dimensions && <Component />}`) still resolves in tests, just with
// jsdom's default zero-sized layout rather than a real one.
if (!window.ResizeObserver) {
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof window.ResizeObserver;
}
