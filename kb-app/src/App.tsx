import { useEffect } from 'react';
import { Route, Routes } from 'react-router-dom';
import Home from './pages/Home';
import Reader from './pages/Reader';
import Flashcards from './pages/Flashcards';
import { useUserDataStore } from './store/userDataStore';

export default function App() {
  const isLoaded = useUserDataStore((s) => s.isLoaded);

  useEffect(() => {
    void useUserDataStore.getState().loadUserData();
  }, []);

  return (
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
          changes, so no extra remount happens. */}
      <Route path="/flashcards" element={<Flashcards key={String(isLoaded)} />} />
    </Routes>
  );
}
