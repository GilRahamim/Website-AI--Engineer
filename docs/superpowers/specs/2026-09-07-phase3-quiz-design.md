# Phase 3, Sub-project #4 — Quiz Mode: Design

**Status:** Approved, ready for implementation planning.
**Depends on:** Phase 2 (Frontend Core) and Phase 3 sub-projects #1-#3 (Foundation/Progress/Favorites/Recents, Personal Notes, Flashcards + SRS + Daily Review) — all complete and merged (`docs/superpowers/specs/2026-08-05-phase2-frontend-core-design.md`, `docs/superpowers/specs/2026-09-06-phase3-foundation-design.md`, `docs/superpowers/specs/2026-09-06-phase3-notes-design.md`, `docs/superpowers/specs/2026-09-07-phase3-flashcards-srs-design.md`).
**Scope boundary:** the fourth of six sub-projects decomposing "Phase 3 — כלי למידה מקומיים" (`site-build-docs/00-BUILD-README.md`, `03-FRONTEND-SPEC.md` §E). Covers only the multiple-choice archetype of §E ("לאיזה מושג שייכת ההגדרה?"); the knowledge-graph map and command palette are the remaining two sub-projects.

## Goal

Let a user take a filterable, auto-generated multiple-choice quiz — "which concept does this definition belong to?" — with same-category distractors, immediate feedback, a score summary, and wrong answers automatically marked for spaced-repetition review via the existing SRS system.

## Out of scope (later sub-projects / phases)

Knowledge-graph map, command palette (later Phase 3 sub-projects) · Supabase sync (Phase 5) · PWA/offline app shell (Phase 4) · the spec's second question archetype ("הסבר את X" with self-reveal) — that is a self-assessed flashcard-style format with no objective right/wrong, and sub-project #3's Flashcards page already covers exactly that interaction; building it again here would duplicate that page's job · touching a topic's `progress` status or its SRS schedule on a *correct* answer — quiz recognition (picking from 4 options) is a weaker signal than flashcard active recall, so only misses affect the schedule, matching the spec's literal "mark items that fell" framing · a due-only filter (quiz tests broad knowledge, not spaced review — the due-only concept belongs to Flashcards).

## Question generation

`src/lib/quiz.ts` (new, pure — no store import, matching `srs.ts`/`filterTopics.ts`):

```ts
export interface QuizQuestion {
  topicId: string;
  definition: string;
  options: string[];       // 4 titles, shuffled
  correctTitle: string;
}
```

- `buildDistractors(topic: Topic, allTopics: Topic[], count: number): Topic[]` — picks `count` random topics from `topic.category`, excluding `topic` itself. Distractors are always searched across **all 160 topics**, never just the user's filtered quiz pool — every category has at least 8 topics (verified: formulas 8, metrics 13, architectures 25, algorithms 45, concepts 69), so this guarantees enough same-category distractors even when the filtered question pool itself is narrow (e.g. one module within the smallest category).
- `buildQuestion(topic: Topic, allTopics: Topic[]): QuizQuestion` — `{ topicId: topic.id, definition: topic.definition, options: shuffle([topic.title, ...buildDistractors(topic, allTopics, 3).map(t => t.title)]), correctTitle: topic.title }`.
- `buildQuiz(candidates: Topic[], allTopics: Topic[], count: number): QuizQuestion[]` — shuffles `candidates`, takes `Math.min(count, candidates.length)`, maps each through `buildQuestion`.

## UI, session flow & the hydration-safety architecture

**Routing:** `App.tsx` gains `<Route path="/quiz" element={<Quiz />} />`. `Header.tsx` gains a second persistent nav link, "מבחן", alongside the existing "כרטיסיות" link — no due-count-style badge, since quiz has no "due" concept.

**`src/pages/Quiz.tsx`** (new), a single component with three phases driven by page-local state:

**Setup phase** (`questions: QuizQuestion[] | null` starts `null`): module/category/status filter dropdowns — the same widgets `Flashcards.tsx` already uses, minus the due-only toggle (out of scope, per above) — a question-count selector (5 / 10 / 20 / הכול, silently clamped to the filtered pool size), and a "התחל מבחן" button.

This is a deliberate structural safeguard, not a patch: `buildQuiz` is called **only** inside the start button's `onClick` handler, never in a `useState` lazy initializer, `useMemo`, or on mount. Sub-projects #2 and #3 each hit a Critical bug from a component reading `userDataStore` into local state before its async `loadUserData()` resolved (a snapshot taken at mount that then never self-corrected). By construction, nothing here reads the store into local state until a real user click — and `loadUserData()`'s IndexedDB read resolves in milliseconds, long before a human can read the setup screen and click start — so the entire hazard class is structurally unreachable here, with no need for a remount trick or hydration-guard state.

**Session phase** (`questions` populated): one question at a time — the definition as the prompt, four option buttons. Clicking an option sets `answeredIndex`, immediately highlighting it green (correct) or red (incorrect, with the correct option also highlighted green), and reveals a "הבא" control to advance (click, or Enter/→). A wrong answer calls `useUserDataStore.getState().gradeCard(topicId, 'again')` at the moment of selection — reusing sub-project #3's SM-2 machinery exactly, so the topic reappears in the next Daily Review/Flashcards session with its interval reset and ease reduced. A correct answer calls nothing — the topic's schedule is untouched. Keyboard: 1-4 selects an option, Enter/→ advances once answered.

**Summary phase** (after the last question): "סיימת! X מתוך Y נכונות", followed by a list of the missed topics (title + link to `/topic/:id`) — making the spec's "mark items that fell for SRS review" visible to the user, not just a silent side effect.

`role="status"` announces the summary region, matching `Flashcards.tsx`'s existing empty/end-state pattern. The page is fully keyboard-operable and uses only `--kb-*` tokens.

## Testing

- `quiz.ts`: `buildDistractors` (exact count, excludes the topic itself, drawn from the topic's category, no duplicates), `buildQuestion` (correct answer present exactly once among the options, options include exactly 4 entries), `buildQuiz` (clamps requested count to pool size, one question per candidate, no crash on a pool smaller than the requested count).
- `Quiz.test.tsx` (new): setup screen renders filters and the count selector; a regression-style test renders the page with `isLoaded: false`, hydrates the store via `act()`, *then* clicks start, and asserts the generated quiz reflects the hydrated data — proving start-time reads are always fresh by construction; selecting an option shows correct/incorrect feedback and reveals "הבא"; a wrong answer calls `gradeCard` with `'again'` for the right `topicId`; a correct answer does not call `gradeCard` at all; the summary shows the correct score and lists missed topics with working `/topic/:id` links; keyboard 1-4 + Enter work end-to-end through a short session.
- `Header.test.tsx` additions: renders a link to `/quiz`.
- Manual, not testable in jsdom: a full keyboard-only quiz session; light theme, dark theme, RTL on the new page.

## Definition of Done

- `npm run typecheck && npm run lint && npm run test && npm run build` all green.
- Manual check: a wrong answer changes the topic's due date and shows up in the next Flashcards/Daily Review session; a correct answer leaves the topic's SRS schedule untouched; distractors are always same-category and never repeat the correct answer; module/category/status filters narrow the question pool correctly; the count selector clamps to the pool size without crashing.
- Light theme, dark theme, RTL, keyboard-only, mobile viewport all checked.
- No regressions to Phase 2 or Phase 3 sub-projects #1-#3 behavior.
- No hardcoded colors outside `--kb-*` tokens (golden rule 7).
