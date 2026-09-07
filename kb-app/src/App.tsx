import { useEffect } from 'react';
import { Route, Routes } from 'react-router-dom';
import Home from './pages/Home';
import Reader from './pages/Reader';
import Flashcards from './pages/Flashcards';
import { useUserDataStore } from './store/userDataStore';

export default function App() {
  useEffect(() => {
    void useUserDataStore.getState().loadUserData();
  }, []);

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/topic/:id" element={<Reader />} />
      <Route path="/flashcards" element={<Flashcards />} />
    </Routes>
  );
}
