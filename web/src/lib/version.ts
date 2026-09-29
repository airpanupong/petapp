import {useEffect, useState} from 'react';

export const APP_VERSION = __APP_VERSION__;

const CHECK_EVERY_MS = 5 * 60_000;

async function fetchDeployedVersion(): Promise<string | null> {
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, {cache: 'no-store'});
    if (!res.ok) return null;
    const data = (await res.json()) as {version?: string};
    return data.version ?? null;
  } catch {
    return null;
  }
}

/** True once a newer build than the running one has been deployed. */
export function useUpdateAvailable() {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    if (import.meta.env.DEV) return;
    let stopped = false;
    const check = async () => {
      const deployed = await fetchDeployedVersion();
      if (!stopped && deployed && deployed !== APP_VERSION) setAvailable(true);
    };
    const onVisible = () => document.visibilityState === 'visible' && void check();
    void check();
    const timer = window.setInterval(() => void check(), CHECK_EVERY_MS);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return available;
}
