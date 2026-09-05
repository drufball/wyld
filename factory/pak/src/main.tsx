import '@fontsource/press-start-2p/400.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App.js';
import './theme.css';

const root = document.querySelector('#root');

if (!root) {
  throw new Error('Missing #root mount point');
}

createRoot(root).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
