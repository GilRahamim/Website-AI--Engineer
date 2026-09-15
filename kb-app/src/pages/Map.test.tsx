import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Map from './Map';
import topicsData from '../data/topics.clean.json';
import type { GraphLink, GraphNode } from '../lib/graph';
import { categoryLabels, modules } from '../lib/catalog';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

interface MockForceGraphProps {
  graphData: { nodes: GraphNode[]; links: GraphLink[] };
  onNodeClick?: (node: GraphNode) => void;
  onNodeHover?: (node: GraphNode | null) => void;
}

const capturedGraphData: { nodes: GraphNode[]; links: GraphLink[] }[] = [];

// react-force-graph-2d renders to a real <canvas>, which jsdom doesn't
// meaningfully implement. This test double stands in for it, exposing
// graphData's node/link counts as text, onNodeClick/onNodeHover as
// clickable/hoverable hooks, and every graphData reference it was called
// with (capturedGraphData) — testing this app's integration code, not the
// library's canvas internals.
vi.mock('react-force-graph-2d', () => ({
  default: ({ graphData, onNodeClick, onNodeHover }: MockForceGraphProps) => {
    capturedGraphData.push(graphData);
    return (
      <div>
        <p>{`nodes:${graphData.nodes.length}`}</p>
        <p>{`links:${graphData.links.length}`}</p>
        {graphData.nodes.map((node) => (
          <button
            key={node.id}
            type="button"
            onClick={() => onNodeClick?.(node)}
            onMouseEnter={() => onNodeHover?.(node)}
            onMouseLeave={() => onNodeHover?.(null)}
          >
            {node.title}
          </button>
        ))}
      </div>
    );
  },
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <Map />
    </MemoryRouter>,
  );
}

// jsdom doesn't implement pointer capture or scrollIntoView, and Radix
// Select's trigger/item pointer handlers call both. Stub them so
// userEvent's pointer-event simulation doesn't throw.
Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture ?? (() => false);
Element.prototype.setPointerCapture = Element.prototype.setPointerCapture ?? (() => {});
Element.prototype.releasePointerCapture = Element.prototype.releasePointerCapture ?? (() => {});
Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? (() => {});

// Radix Select's trigger is a button, not a native <select>, so choosing an
// option means clicking the trigger and then clicking the option by its
// visible label — the same pattern Task 9 used for SortMenu.
async function selectComboboxOption(user: ReturnType<typeof userEvent.setup>, comboboxName: string, optionName: string) {
  await user.click(screen.getByRole('combobox', { name: comboboxName }));
  await user.click(await screen.findByRole('option', { name: optionName }));
}

describe('Map', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  it('renders all 160 topics as nodes by default', () => {
    renderPage();
    expect(screen.getByText(`nodes:${topicsData.length}`)).toBeInTheDocument();
  });

  it('narrows the node count when a module filter is chosen', async () => {
    const user = userEvent.setup();
    renderPage();
    const moduleCount = topicsData.filter((t) => t.module === topicsData[0].module).length;

    await selectComboboxOption(user, 'מודול', modules[topicsData[0].module]);
    expect(screen.getByText(`nodes:${moduleCount}`)).toBeInTheDocument();
  });

  it('narrows the node count when a category filter is chosen', async () => {
    const user = userEvent.setup();
    renderPage();
    const categoryCount = topicsData.filter((t) => t.category === topicsData[0].category).length;

    await selectComboboxOption(user, 'קטגוריה', categoryLabels[topicsData[0].category]);
    expect(screen.getByText(`nodes:${categoryCount}`)).toBeInTheDocument();
  });

  it('renders a category legend matching the node colors', () => {
    renderPage();
    const legend = screen.getByRole('list', { name: 'מקרא קטגוריות' });
    const labels = [...new Set(topicsData.map((t) => t.category_label))];
    for (const label of labels) {
      expect(legend).toHaveTextContent(label);
    }
  });

  it('clicking a node navigates to its reader page', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: topicsData[0].title }));
    expect(mockNavigate).toHaveBeenCalledWith(`/topic/${encodeURIComponent(topicsData[0].id)}`);
  });

  it('jumping to a topic via the jump-to-topic select navigates and resets back to the placeholder', async () => {
    const user = userEvent.setup();
    renderPage();
    const jumpSelect = screen.getByRole('combobox', { name: 'קפוץ לנושא' });
    expect(jumpSelect).toHaveTextContent('בחר נושא מהמפה…');

    await user.click(jumpSelect);
    await user.click(await screen.findByRole('option', { name: topicsData[0].title }));

    expect(mockNavigate).toHaveBeenCalledWith(`/topic/${encodeURIComponent(topicsData[0].id)}`);
    // The old native <select value=""> never updated any state on change —
    // it just read the value once and navigated — so the control always
    // showed its placeholder again afterward. The Radix replacement must
    // keep that behavior rather than getting stuck showing the last pick.
    expect(jumpSelect).toHaveTextContent('בחר נושא מהמפה…');
  });

  it('keeps the same graphData reference across a hover interaction (the force layout does not reset)', async () => {
    capturedGraphData.length = 0;
    const user = userEvent.setup();
    renderPage();
    const beforeHover = capturedGraphData.at(-1);

    await user.hover(screen.getByRole('button', { name: topicsData[0].title }));
    await user.unhover(screen.getByRole('button', { name: topicsData[0].title }));
    const afterHover = capturedGraphData.at(-1);

    expect(afterHover).toBe(beforeHover);
  });

  it('resolves category colors from getComputedStyle on mount', () => {
    const getPropertySpy = vi.spyOn(CSSStyleDeclaration.prototype, 'getPropertyValue');
    renderPage();
    expect(getPropertySpy).toHaveBeenCalledWith('--kb-cat-algorithms');
    getPropertySpy.mockRestore();
  });

  it('re-resolves colors when a kb-theme-change event fires', () => {
    renderPage();
    const getPropertySpy = vi.spyOn(CSSStyleDeclaration.prototype, 'getPropertyValue');
    window.dispatchEvent(new Event('kb-theme-change'));
    expect(getPropertySpy).toHaveBeenCalledWith('--kb-cat-algorithms');
    getPropertySpy.mockRestore();
  });
});
