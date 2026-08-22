/**
 * RNOS-M3 — Native shell bootstrap (local www fallback + deep link notes).
 * When server.url is set, Portal loads remotely; this file documents native hooks.
 */
(function () {
  if (typeof window === 'undefined') return;
  window.__PTT_MOBILE_SHELL__ = {
    version: '0.1.0',
    deepLinkScheme: 'pttads',
  };
})();
