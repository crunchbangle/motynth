import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import { AudioProvider } from './state/audio.tsx';
import { SoundsProvider } from './state/sounds.tsx';

const root = document.getElementById('root');
if (!root) throw new Error('index.html needs an element with id="root"');

createRoot(root).render(
  <StrictMode>
    <AudioProvider>
      <SoundsProvider>
        <App />
      </SoundsProvider>
    </AudioProvider>
  </StrictMode>,
);
