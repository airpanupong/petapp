import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter} from 'react-router-dom';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';

import './styles/global.css';
import {App} from './App';
import {reloadForNewVersion} from './lib/lazyPage';
import {registerServiceWorker} from './lib/push';
import {captureInstallPrompt} from './lib/install';

registerServiceWorker();
captureInstallPrompt();

window.addEventListener('vite:preloadError', event => {
  if (reloadForNewVersion()) event.preventDefault();
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {retry: 1, staleTime: 20_000, refetchOnWindowFocus: false},
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
