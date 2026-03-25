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
};
