const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent;

// iPadOS 13+ reports itself as Macintosh; touch support tells them apart.
export const isIOS = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && typeof document !== 'undefined' && 'ontouchend' in document);
export const isAndroid = /Android/i.test(ua);
export const isMobile = isIOS || isAndroid;
export const isIOSSafari = isIOS && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|Line\/|FBAN|FBAV|Instagram/.test(ua);
export const isInAppBrowser = /Line\/|FBAN|FBAV|Instagram|; wv\)/.test(ua);

export function isStandalone() {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & {standalone?: boolean}).standalone === true
  );
}
