/* Sirius IDE — ux.js
   Unified UX helpers: notifications, preflight, recovery. */
'use strict';

const UX = {
  success: function (msg, ms) { return toast(msg, 'success', ms ?? 1800); },
  info: function (msg, ms) { return toast(msg, 'info', ms ?? 2600); },
  warn: function (msg, ms) { return toast(msg, 'info', ms ?? 3200); },
  error: function (msg, ms) { return toast(msg, 'error', ms ?? 5000); },
  errorWithRecovery: function (msg, actionLabel, actionFn, ms) {
    return toast(msg, 'error', ms ?? 9000, { label: actionLabel, fn: actionFn });
  },
  // Silent preflight: no success toast, only fail with recovery.
  preflight: async function (checkFn, onFail) {
    try {
      const ok = await checkFn();
      if (ok) return true;
    } catch (_) {}
    if (typeof onFail === 'function') onFail();
    return false;
  },
  /** Apply a one-shot enter animation class (CSS: @keyframes ux-fade-up). */
  enter: function (el, className) {
    if (!el) return;
    const cls = className || 'ux-enter';
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
  },
};
