import {useEffect, useState} from 'react';

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{outcome: 'accepted' | 'dismissed'}>;
};

let deferred: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(fn => fn());

/** Chrome fires this once, early; it has to be captured before any page mounts. */
export function captureInstallPrompt() {
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferred = event as InstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    notify();
  });
}

export function useInstallPrompt() {
  const [available, setAvailable] = useState(() => deferred != null);
  useEffect(() => {
    const update = () => setAvailable(deferred != null);
    listeners.add(update);
    return () => void listeners.delete(update);
  }, []);

  const install = async () => {
    if (!deferred) return false;
    const event = deferred;
    deferred = null;
    notify();
    await event.prompt();
    return (await event.userChoice).outcome === 'accepted';
  };

  return {available, install};
}
