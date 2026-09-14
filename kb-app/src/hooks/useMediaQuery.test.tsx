import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { useMediaQuery } from './useMediaQuery';

type Listener = (event: { matches: boolean }) => void;
let listeners: Listener[] = [];
let currentMatches = false;

function fakeMatchMedia(query: string) {
  return {
    matches: currentMatches,
    media: query,
    addEventListener: (_: string, cb: Listener) => listeners.push(cb),
    removeEventListener: (_: string, cb: Listener) => {
      listeners = listeners.filter((l) => l !== cb);
    },
  };
}

function Harness() {
  const wide = useMediaQuery('(min-width: 768px)');
  return <p data-testid="out">{wide ? 'wide' : 'narrow'}</p>;
}

beforeEach(() => {
  listeners = [];
  currentMatches = false;
  vi.stubGlobal('matchMedia', fakeMatchMedia);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useMediaQuery', () => {
  it('returns the initial match state synchronously', () => {
    currentMatches = true;
    render(<Harness />);
    expect(screen.getByTestId('out')).toHaveTextContent('wide');
  });

  it('updates when the media query changes and unsubscribes on unmount', () => {
    const { unmount } = render(<Harness />);
    expect(screen.getByTestId('out')).toHaveTextContent('narrow');
    act(() => listeners.forEach((l) => l({ matches: true })));
    expect(screen.getByTestId('out')).toHaveTextContent('wide');
    unmount();
    expect(listeners).toHaveLength(0);
  });
});
