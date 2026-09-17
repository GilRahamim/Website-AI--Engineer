# 06 — Learning Path ("My Path")

A feature that guides the user topic-by-topic in the correct order, with no skips and without losing their place. This is the core of the self-learning experience.

## Principle
The spine of the path is **the course's own teaching order** — derived from the `module` + `num` fields already present in the data, not from the relations graph. The order the instructors designed is continuous by definition. `related_match` is used only as optional side enrichment, never as the ordering key.

## Spine order
Fully linear: by module order, and within each module by ascending `num`.

```
1. Intro to Data Science             — 8 topics
2. Topic 1 - Unsupervised Learning   — 18
3. Topic 2 - NLP                     — 24
4. Topic 3 - Deep Learning           — 43
5. RAG, Agents, MCP                  — 67   (160 total)
```

```ts
const MODULE_ORDER = [
  'Intro to Data Science','Topic 1 - Unsupervised Learning',
  'Topic 2 - Natural Language Processing','Topic 3 - Deep Learning','RAG, Agents, MCP',
];
export function buildLearningPath(topics: Topic[]): Topic[] {
  return [...topics].sort((a, b) => {
    const m = MODULE_ORDER.indexOf(a.module) - MODULE_ORDER.indexOf(b.module);
    return m !== 0 ? m : (a.num - b.num);
  });
}
// pathIndex = a topic's position in this array.
```
> Unknown module → push to the end + warn in console. Equal `num` → break the tie by `title` (stable).

## Skip prevention & continuity (based on `Progress.status`)
- **"Continue where you left off"** — primary button on Home: jumps to the first topic in the path that is not `mastered`.
- **Path markers** — each topic marked: ✓ learned · ● current · ○ not yet. Overall progress bar ("42 / 160") plus per-module.
- **Soft locking (setting):** *Guided* (default) — steers you to the current topic; doesn't block jumping ahead but marks it "you haven't reached this yet"; *Free* — no guidance. Hard locking is frustrating for self-learning.
- **Next/Previous in path** — buttons inside the Reader by `pathIndex`, so you can learn continuously without returning to the grid.
- **Finish a topic** — "Mark as learned & continue" → sets `mastered` + jumps to `pathIndex + 1`.

## "My Path" page (`/path`)
A vertical list of all 160 topics in order, grouped by module (accordion), with a state marker per topic; overall progress bar + "Continue"; the current topic highlighted and auto-scrolled into view; clicking a row opens the Reader.

## Enrichment (does not change order)
Inside the Reader, the "Related topics" area (from `related_match`) is shown as optional links only, tagged "Deep dive" — making clear it's a detour, not the next step in the path. Returning from them goes back to the main path.

## Integration
- **SRS (daily review):** separate — the Path = "learn new material in order"; SRS = "maintain old material". Home shows both.
- **Quiz:** when a module is completed, offer a short quiz before moving on.
- **Local-first:** position is derived from the already-synced `Progress` — no new data to sync.

## Definition of Done
- [ ] `buildLearningPath` returns 160 topics in module→num order, stable.
- [ ] "Continue" accurately targets the first not-yet-learned topic.
- [ ] Next/Previous + "Mark as learned & continue" work in the Reader.
- [ ] `/path` shows order/state/progress; RTL + both themes.
- [ ] Guided/Free mode is toggleable.
