import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useGridKeyboardNav } from './useGridKeyboardNav';

function Harness({ onActivate }: { onActivate: (id: string) => void }) {
  const itemIds = ['a', 'b', 'c'];
  const { getItemProps } = useGridKeyboardNav(itemIds, onActivate);
  return (
    <div>
      {itemIds.map((id) => {
        const props = getItemProps(id);
        return (
          <button key={id} data-testid={id} ref={props.ref} tabIndex={props.tabIndex} onFocus={props.onFocus} onKeyDown={props.onKeyDown}>
            {id}
          </button>
        );
      })}
    </div>
  );
}

describe('useGridKeyboardNav', () => {
  it('only the first item is tabbable initially', () => {
    render(<Harness onActivate={() => {}} />);
    expect(screen.getByTestId('a')).toHaveAttribute('tabindex', '0');
    expect(screen.getByTestId('b')).toHaveAttribute('tabindex', '-1');
    expect(screen.getByTestId('c')).toHaveAttribute('tabindex', '-1');
  });

  it('ArrowLeft moves focus to the next item (RTL: left = forward)', async () => {
    const user = userEvent.setup();
    render(<Harness onActivate={() => {}} />);
    screen.getByTestId('a').focus();
    await user.keyboard('{ArrowLeft}');
    expect(screen.getByTestId('b')).toHaveFocus();
  });

  it('ArrowRight moves focus to the previous item (RTL: right = backward)', async () => {
    const user = userEvent.setup();
    render(<Harness onActivate={() => {}} />);
    screen.getByTestId('b').focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByTestId('a')).toHaveFocus();
  });

  it('does not move past the first or last item', async () => {
    const user = userEvent.setup();
    render(<Harness onActivate={() => {}} />);
    screen.getByTestId('a').focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByTestId('a')).toHaveFocus();

    screen.getByTestId('c').focus();
    await user.keyboard('{ArrowLeft}');
    expect(screen.getByTestId('c')).toHaveFocus();
  });

  it('Home jumps to the first item and End to the last', async () => {
    const user = userEvent.setup();
    render(<Harness onActivate={() => {}} />);
    screen.getByTestId('b').focus();
    await user.keyboard('{End}');
    expect(screen.getByTestId('c')).toHaveFocus();
    await user.keyboard('{Home}');
    expect(screen.getByTestId('a')).toHaveFocus();
  });

  it('Enter calls onActivate with the focused item id', async () => {
    const user = userEvent.setup();
    const onActivate = vi.fn();
    render(<Harness onActivate={onActivate} />);
    screen.getByTestId('b').focus();
    await user.keyboard('{Enter}');
    expect(onActivate).toHaveBeenCalledWith('b');
  });
});

function DynamicHarness({ onActivate }: { onActivate: (id: string) => void }) {
  const [itemIds, setItemIds] = useState(['a', 'b', 'c']);
  const { getItemProps } = useGridKeyboardNav(itemIds, onActivate);
  return (
    <div>
      <button type="button" data-testid="narrow" onClick={() => setItemIds(['b', 'c'])}>
        narrow
      </button>
      {itemIds.map((id) => {
        const props = getItemProps(id);
        return (
          <button key={id} data-testid={id} ref={props.ref} tabIndex={props.tabIndex} onFocus={props.onFocus} onKeyDown={props.onKeyDown}>
            {id}
          </button>
        );
      })}
    </div>
  );
}

describe('useGridKeyboardNav — itemIds changes post-mount', () => {
  it('falls back to the new first item when the focused item is filtered out', async () => {
    const user = userEvent.setup();
    render(<DynamicHarness onActivate={() => {}} />);
    expect(screen.getByTestId('a')).toHaveAttribute('tabindex', '0');

    await user.click(screen.getByTestId('narrow')); // itemIds becomes ['b', 'c']; 'a' is gone

    expect(screen.getByTestId('b')).toHaveAttribute('tabindex', '0');
    expect(screen.getByTestId('c')).toHaveAttribute('tabindex', '-1');
  });
});
