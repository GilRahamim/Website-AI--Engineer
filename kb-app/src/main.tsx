import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import { initTheme } from './lib/theme';
// Self-hosted woff2 (spec doc 03): Heebo for Hebrew/Latin body text, JetBrains
// Mono for code blocks. Each import registers @font-face rules with
// unicode-range subsets, so only the glyph ranges a page uses are fetched.
import '@fontsource/heebo/400.css';
import '@fontsource/heebo/500.css';
import '@fontsource/heebo/600.css';
import '@fontsource/heebo/700.css';
import '@fontsource/heebo/800.css';
import '@fontsource/rubik/600.css';
import '@fontsource/rubik/700.css';
import '@fontsource/rubik/800.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import './styles/index.css';

initTheme();
registerSW({ immediate: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
