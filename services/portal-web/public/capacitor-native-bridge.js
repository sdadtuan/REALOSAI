/**
 * RNOS-M3 — Capacitor native bridge (early init before React).
 * Full init: CapacitorShellInit.tsx (deep links, status bar, fetch headers).
 */
(function () {
  if (typeof window === 'undefined') return;

  var cap = window.Capacitor;
  if (!cap || typeof cap.isNativePlatform !== 'function' || !cap.isNativePlatform()) {
    return;
  }

  var platform = typeof cap.getPlatform === 'function' ? cap.getPlatform() : 'unknown';
  var appVersion = '0.1.0';
  try {
    var meta = document.querySelector('meta[name="ptt-app-version"]');
    if (meta && meta.content) appVersion = meta.content;
  } catch (_e) {
    /* non-fatal */
  }

  window.__PTT_CAPACITOR__ = {
    native: true,
    platform: platform,
    version: '1.0',
    appVersion: appVersion,
  };
  document.documentElement.dataset.pttCapacitor = platform;

  try {
    window.dispatchEvent(new CustomEvent('ptt-capacitor-ready', { detail: window.__PTT_CAPACITOR__ }));
  } catch (_e2) {
    /* IE11 N/A */
  }
})();
