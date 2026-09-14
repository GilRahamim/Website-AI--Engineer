import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { useActiveHeading } from './useActiveHeading';

type Callback = (entries: Partial<IntersectionObserverEntry>[]) => void;
let callbacks: Callback[] = [];
let observed: Element[] = [];
let disconnected = 0;

class FakeObserver {
  constructor(cb: Callback) {
    callbacks.push(cb);
  }
  observe(el: Element) {
    observed.push(el);
  }
  disconnect() {
    disconnected += 1;
  }
  unobserve() {}
  takeRecords() {
    return [];
  }
}

function Harness({ ids }: { ids: string[] }) {
  const active = useActiveHeading(ids);
  return (
    <>
      <p data-testid="active">{active ?? 'none'}</p>
      {ids.map((id) => (
        <h4 key={id} id={id}>
          {id}
        </h4>
      ))}
    </>
  );
}

beforeEach(() => {
  callbacks = [];
  observed = [];
  disconnected = 0;
  vi.stubGlobal('IntersectionObserver', FakeObserver);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useActiveHeading', () => {
  it('starts with the first heading active and observes every heading element', () => {
    render(<Harness ids={['sec-1', 'sec-2']} />);
    expect(screen.getByTestId('active')).toHaveTextContent('sec-1');
    expect(observed.map((el) => el.id)).toEqual(['sec-1', 'sec-2']);
  });

  it('switches to the heading the observer reports as intersecting', () => {
    render(<Harness ids={['sec-1', 'sec-2']} />);
    act(() => {
      callbacks[0]([{ isIntersecting: true, target: document.getElementById('sec-2')! }]);
    });
    expect(screen.getByTestId('active')).toHaveTextContent('sec-2');
  });

  it('returns null with no headings and disconnects on unmount', () => {
    const { unmount } = render(<Harness ids={[]} />);
    expect(screen.getByTestId('active')).toHaveTextContent('none');
    unmount();
    render(<Harness ids={['sec-1']} />).unmount();
    expect(disconnected).toBe(1);
  });

  it('falls back to the first heading when IntersectionObserver is unavailable', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    render(<Harness ids={['sec-1', 'sec-2']} />);
    expect(screen.getByTestId('active')).toHaveTextContent('sec-1');
  });
});
