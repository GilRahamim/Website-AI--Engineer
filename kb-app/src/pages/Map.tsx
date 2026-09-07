import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ForceGraph2D, { type LinkObject, type NodeObject } from 'react-force-graph-2d';
import topicsRaw from '../data/topics.clean.json';
import modulesRaw from '../data/modules.json';
import type { Category, ModulesMap, Topic } from '../types';
import { buildGraphData, type GraphLink, type GraphNode } from '../lib/graph';
import Header from '../components/layout/Header';

const topics = topicsRaw as Topic[];
const modules = modulesRaw as ModulesMap;
const categoryLabels: Record<string, string> = Object.fromEntries(
  topics.map((t) => [t.category, t.category_label]),
);

const CATEGORY_TOKEN_VARS: Record<Category, string> = {
  algorithms: '--kb-cat-algorithms',
  concepts: '--kb-cat-concepts',
  metrics: '--kb-cat-metrics',
  formulas: '--kb-cat-formulas',
  architectures: '--kb-cat-architectures',
};

interface ResolvedColors {
  categoryColors: Record<Category, string>;
  linkColor: string;
  accentColor: string;
}

function resolveToken(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

// getPropertyValue returns '' (not undefined) for an unresolved custom
// property, so a `?? fallback` guard can never fire — `|| fallback` is
// required for the fallback to actually be reachable. `--kb-border-strong`
// itself falls back to a literal as the last resort in the (should-never-
// happen) case even that token fails to resolve.
function resolveColors(): ResolvedColors {
  const linkColor = resolveToken('--kb-border-strong') || '#94a3b8';
  const accentColor = resolveToken('--kb-accent') || linkColor;
  const categoryColors = Object.fromEntries(
    Object.entries(CATEGORY_TOKEN_VARS).map(([category, cssVar]) => [category, resolveToken(cssVar) || linkColor]),
  ) as Record<Category, string>;
  return { categoryColors, linkColor, accentColor };
}

// d3-force (which react-force-graph-2d wraps) mutates link.source/target in
// place once the simulation initializes, replacing the plain id string with
// a reference to the resolved node object — so a link endpoint must be read
// through this helper, not compared to an id string directly, or the hover
// highlight would silently stop matching after the first simulation tick.
function linkEndpointId(endpoint: string | number | NodeObject<GraphNode>): string {
  return typeof endpoint === 'object' ? String(endpoint.id) : String(endpoint);
}

export default function Map() {
  const navigate = useNavigate();
  const [selectedModule, setSelectedModule] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  const [colors, setColors] = useState(resolveColors);

  useEffect(() => {
    function handleThemeChange() {
      setColors(resolveColors());
    }
    window.addEventListener('kb-theme-change', handleThemeChange);
    return () => window.removeEventListener('kb-theme-change', handleThemeChange);
  }, []);

  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    function updateDimensions() {
      if (!container) return;
      setDimensions({ width: container.clientWidth, height: container.clientHeight });
    }
    updateDimensions();
    const observer = new ResizeObserver(updateDimensions);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const [prefersReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  const graphData = useMemo(
    () => buildGraphData(topics, selectedModule, selectedCategory),
    [selectedModule, selectedCategory],
  );

  return (
    <>
      <Header />
      <main className="flex flex-col p-4">
        <h1 className="mb-4 text-xl font-bold text-[var(--kb-text)]">מפת ידע</h1>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <label className="flex flex-col text-sm text-[var(--kb-text)]">
            מודול
            <select
              value={selectedModule}
              onChange={(e) => setSelectedModule(e.target.value)}
              className="min-h-11 rounded-md border border-[var(--kb-border)] bg-[var(--kb-surface)] px-2 text-[var(--kb-text)]"
            >
              <option value="all">הכול</option>
              {Object.entries(modules).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col text-sm text-[var(--kb-text)]">
            קטגוריה
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="min-h-11 rounded-md border border-[var(--kb-border)] bg-[var(--kb-surface)] px-2 text-[var(--kb-text)]"
            >
              <option value="all">הכול</option>
              {Object.entries(categoryLabels).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <p className="text-sm text-[var(--kb-muted)]">{`${graphData.nodes.length} נושאים, ${graphData.links.length} קשרים`}</p>
        </div>
        <div
          ref={containerRef}
          aria-label="גרף אינטראקטיבי המציג קשרים בין נושאים"
          className="h-[70vh] overflow-hidden rounded-xl border border-[var(--kb-border)]"
        >
          {dimensions && (
            <ForceGraph2D<GraphNode, GraphLink>
              graphData={graphData}
              width={dimensions.width}
              height={dimensions.height}
              nodeId="id"
              nodeLabel="title"
              nodeColor={(node: NodeObject<GraphNode>) => colors.categoryColors[node.category]}
              linkColor={(link: LinkObject<GraphNode, GraphLink>) => {
                if (!hoveredNodeId) return colors.linkColor;
                const sourceId = link.source !== undefined ? linkEndpointId(link.source) : undefined;
                const targetId = link.target !== undefined ? linkEndpointId(link.target) : undefined;
                return sourceId === hoveredNodeId || targetId === hoveredNodeId ? colors.accentColor : colors.linkColor;
              }}
              onNodeClick={(node: NodeObject<GraphNode>) => {
                if (node.id) navigate(`/topic/${encodeURIComponent(String(node.id))}`);
              }}
              onNodeHover={(node: NodeObject<GraphNode> | null) => setHoveredNodeId(node ? String(node.id) : null)}
              cooldownTicks={prefersReducedMotion ? 0 : undefined}
            />
          )}
        </div>
      </main>
    </>
  );
}
