// A random id that identifies this browser/device for the "one active device
// per tenant" rule. It is created once and kept on the device; the server only
// lets the device that holds it refresh or release the session.
const DEVICE_ID_KEY = 'FINROUTE_DEVICE_ID';

function randomId() {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
  }
}

export function getDeviceSessionId() {
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id || !/^[A-Za-z0-9-]{16,64}$/.test(id)) {
      id = randomId();
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    // Storage blocked: a per-tab id still works for this visit
    if (!globalThis.__finrouteDeviceId) globalThis.__finrouteDeviceId = randomId();
    return globalThis.__finrouteDeviceId;
  }
}

/** Short human-readable label, e.g. "Chrome on Android". */
export function getDeviceLabel(ua = typeof navigator !== 'undefined' ? navigator.userAgent : '') {
  const s = String(ua || '');
  const browser = /Edg\//.test(s) ? 'Edge'
    : /OPR\/|Opera/.test(s) ? 'Opera'
    : /SamsungBrowser/.test(s) ? 'Samsung Internet'
    : /Chrome\//.test(s) ? 'Chrome'
    : /Firefox\//.test(s) ? 'Firefox'
    : /Safari\//.test(s) ? 'Safari'
    : 'Browser';
  const os = /Android/.test(s) ? 'Android'
    : /iPhone|iPad|iPod/.test(s) ? 'iPhone/iPad'
    : /Windows/.test(s) ? 'Windows'
    : /Mac OS X|Macintosh/.test(s) ? 'Mac'
    : /Linux/.test(s) ? 'Linux'
    : 'unknown system';
  return `${browser} on ${os}`;
}
