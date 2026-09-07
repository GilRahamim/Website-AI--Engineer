import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Map from './Map';
import topicsData from '../data/topics.clean.json';
import type { GraphLink, GraphNode } from '../lib/graph';

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

// react-force-graph-2d renders to a real <canvas>, which jsdom doesn't
// meaningfully implement. This test double stands in for it, exposing
// graphData's node/link counts as text and onNodeClick/onNodeHover as
// clickable/hoverable hooks — testing this app's integration code, not
// the library's canvas internals.
vi.mock('react-force-graph-2d', () => ({
  default: ({ graphData, onNodeClick, onNodeHover }: MockForceGraphProps) => (
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
  ),
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <Map />
    </MemoryRouter>,
  );
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

    await user.selectOptions(screen.getByLabelText('מודול'), topicsData[0].module);
    expect(screen.getByText(`nodes:${moduleCount}`)).toBeInTheDocument();
  });

  it('narrows the node count when a category filter is chosen', async () => {
    const user = userEvent.setup();
    renderPage();
    const categoryCount = topicsData.filter((t) => t.category === topicsData[0].category).length;

    await user.selectOptions(screen.getByLabelText('קטגוריה'), topicsData[0].category);
    expect(screen.getByText(`nodes:${categoryCount}`)).toBeInTheDocument();
  });

  it('clicking a node navigates to its reader page', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: topicsData[0].title }));
    expect(mockNavigate).toHaveBeenCalledWith(`/topic/${encodeURIComponent(topicsData[0].id)}`);
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
