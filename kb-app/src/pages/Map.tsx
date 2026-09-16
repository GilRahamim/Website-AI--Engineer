import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ForceGraph2D, { type ForceGraphMethods, type LinkObject, type NodeObject } from 'react-force-graph-2d';
import type { Category } from '../types';
import { buildGraphData, type GraphLink, type GraphNode } from '../lib/graph';
import { categoryLabels, modules, topics } from '../lib/catalog';
import { usePageTitle } from '../hooks/usePageTitle';
import Header from '../components/layout/Header';
import TopicFilters from '../components/browse/TopicFilters';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';


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
  usePageTitle('מפת ידע');
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

  // The simulation spreads nodes well beyond the initial viewport (whole
  // clusters used to sit clipped above and below the frame); once the
  // layout settles, zoom so every node is inside the box with some margin.
  const graphRef = useRef<ForceGraphMethods<GraphNode, GraphLink> | undefined>(undefined);
  function fitGraph() {
    graphRef.current?.zoomToFit(prefersReducedMotion ? 0 : 400, 24);
  }

  const graphData = useMemo(
    () => buildGraphData(topics, selectedModule, selectedCategory),
    [selectedModule, selectedCategory],
  );

  return (
    <>
      <Header />
      <main className="flex flex-col p-4">
        <h1 className="mb-4 text-xl font-bold font-[var(--kb-font-heading)] text-[var(--kb-text)]">מפת ידע</h1>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <TopicFilters
            modules={modules}
            categoryLabels={categoryLabels}
            selectedModule={selectedModule}
            selectedCategory={selectedCategory}
            onModuleChange={setSelectedModule}
            onCategoryChange={setSelectedCategory}
          />
          <div className="flex flex-col gap-1 text-sm text-[var(--kb-text)]">
            <Label htmlFor="map-jump-to-topic">קפוץ לנושא</Label>
            <Select
              value=""
              onValueChange={(value) => {
                if (value) navigate(`/topic/${encodeURIComponent(value)}`);
              }}
            >
              <SelectTrigger id="map-jump-to-topic" className="min-h-11 max-w-64">
                <SelectValue placeholder="בחר נושא מהמפה…" />
              </SelectTrigger>
              <SelectContent>
                {graphData.nodes.map((node) => (
                  <SelectItem key={node.id} value={node.id}>
                    {node.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-sm text-[var(--kb-muted)]">{`${graphData.nodes.length} נושאים, ${graphData.links.length} קשרים`}</p>
        </div>
        <ul aria-label="מקרא קטגוריות" className="mb-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--kb-text2)]">
          {Object.entries(categoryLabels).map(([key, label]) => (
            <li key={key} className="flex items-center gap-1.5">
              <span className="kb-category-dot" data-category={key} aria-hidden="true" />
              {label}
            </li>
          ))}
        </ul>
        <div
          ref={containerRef}
          aria-label="גרף אינטראקטיבי המציג קשרים בין נושאים"
          className="h-[70dvh] min-h-80 overflow-hidden rounded-xl border border-[var(--kb-border)] bg-[var(--kb-surface)]"
        >
          {dimensions && (
            <ForceGraph2D<GraphNode, GraphLink>
              ref={graphRef}
              graphData={graphData}
              onEngineStop={fitGraph}
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
              // A bounded tick budget lets the layout settle in a second or
              // two (instead of the library's 15s wall clock) so the
              // fit-to-view above runs while the user is still looking.
              warmupTicks={prefersReducedMotion ? 200 : 60}
              cooldownTicks={prefersReducedMotion ? 0 : 120}
            />
          )}
        </div>
      </main>
    </>
  );
}
