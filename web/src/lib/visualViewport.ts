import {useEffect, useState} from 'react';

/**
 * Tracks how much of the layout viewport is covered by the iOS Safari keyboard
 * (or other chrome), so fixed bottoms / chat composers can lift clear of it.
 */
export function useKeyboardInset() {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const update = () => {
      const covered = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      const next = covered > 40 ? covered : 0;
      setInset(next);
      document.documentElement.style.setProperty('--keyboard-inset', `${next}px`);
      document.documentElement.classList.toggle('is-keyboard-open', next > 0);
    };

    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    window.addEventListener('orientationchange', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      window.removeEventListener('orientationchange', update);
      document.documentElement.style.setProperty('--keyboard-inset', '0px');
      document.documentElement.classList.remove('is-keyboard-open');
    };
  }, []);

  return inset;
}

/** Keep --keyboard-inset in sync app-wide (chat, tabbar, update banner). */
export function useSyncKeyboardInset() {
  useKeyboardInset();
}
