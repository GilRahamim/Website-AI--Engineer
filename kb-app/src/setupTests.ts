import '@testing-library/jest-dom/vitest';

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
