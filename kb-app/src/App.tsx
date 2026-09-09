import { Component, lazy, Suspense, useEffect, type ReactNode } from 'react';
import { Route, Routes } from 'react-router-dom';
import Home from './pages/Home';
import Reader from './pages/Reader';
import { useUserDataStore } from './store/userDataStore';
import CommandPalette from './components/palette/CommandPalette';

const Flashcards = lazy(() => import('./pages/Flashcards'));
const Quiz = lazy(() => import('./pages/Quiz'));
const KnowledgeMap = lazy(() => import('./pages/Map'));
const Settings = lazy(() => import('./pages/Settings'));

function RouteFallback() {
  return (
    <p role="status" className="p-8 text-center text-[var(--kb-muted)]">
      טוען…
    </p>
  );
}

interface RouteErrorBoundaryState {
  hasError: boolean;
}

export class RouteErrorBoundary extends Component<{ children: ReactNode }, RouteErrorBoundaryState> {
  state: RouteErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 text-center">
          <p role="alert" className="mb-4 text-[var(--kb-text)]">
            שגיאה בטעינת הדף.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="min-h-11 rounded-md border border-[var(--kb-border)] px-4 text-[var(--kb-text)]"
          >
            רענן את הדף
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const isLoaded = useUserDataStore((s) => s.isLoaded);

  useEffect(() => {
    void useUserDataStore.getState().loadUserData();
  }, []);

  return (
    <>
      <RouteErrorBoundary>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/topic/:id" element={<Reader />} />
            {/* Flashcards' initial session queue is built once via a useState lazy
                initializer that reads userDataStore synchronously at first render
                — before loadUserData() has necessarily resolved. Keying on
                isLoaded forces a remount the moment hydration completes, so the
                lazy initializer re-runs against the now-correct data instead of
                silently keeping a queue built from an empty pre-hydration
                snapshot. When isLoaded is already true at mount (the common case
                — navigating here after the app already loaded), the key never
                changes, so no extra remount happens. This is unrelated to (and
                unaffected by) the React.lazy() code-splitting below — lazy()
                only defers fetching the module, not when the component mounts. */}
            <Route path="/flashcards" element={<Flashcards key={String(isLoaded)} />} />
            {/* Quiz never reads userDataStore into local state until the user
                clicks "התחל מבחן" — by which point loadUserData() has always
                resolved (an IndexedDB read finishes in milliseconds, long before
                a human reads the setup screen and clicks). Unlike Flashcards, no
                key/remount trick is needed here. */}
            <Route path="/quiz" element={<Quiz />} />
            {/* Map never reads userDataStore at all — the graph is derived purely
                from the static topic dataset, so it carries none of the
                hydration hazard the routes above had to design around. */}
            <Route path="/map" element={<KnowledgeMap />} />
            {/* Settings never reads userDataStore during render — it only provides
                export/import UI for data backup, so it carries none of the
                hydration hazard the routes above had to design around. */}
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </Suspense>
      </RouteErrorBoundary>
      {/* Mounted once, globally — safe here since main.tsx already wraps
          App in <BrowserRouter>, so useNavigate() works inside it. Renders
          nothing until Cmd/Ctrl+K opens it. */}
      <CommandPalette />
    </>
  );
}
