import {ComponentType, lazy} from 'react';

const RELOAD_KEY = 'petapp.chunk-reload';

/** Reload once when a page bundle is missing (an older tab after a new deploy). */
export function reloadForNewVersion() {
  const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
  if (Date.now() - last < 30_000) return false;
  sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  window.location.reload();
  return true;
}

export function lazyPage<T extends ComponentType<any>>(load: () => Promise<{default: T}>) {
  return lazy(() =>
    load().catch(error => {
      if (reloadForNewVersion()) return new Promise<{default: T}>(() => {});
      throw error;
    }),
  );
}
