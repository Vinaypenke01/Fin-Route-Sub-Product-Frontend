// Loads a classic <script> once, on demand (e.g. the 900 kB PDF library is
// only fetched when someone actually downloads a PDF).
const pending = new Map();

export function loadScriptOnce(src, { timeoutMs = 30000 } = {}) {
  if (pending.has(src)) return pending.get(src);
  const p = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    const timer = setTimeout(() => {
      reject(new Error(`Timed out loading ${src}. Check your internet connection.`));
    }, timeoutMs);
    script.onload = () => { clearTimeout(timer); resolve(); };
    script.onerror = () => {
      clearTimeout(timer);
      script.remove();
      pending.delete(src); // allow a retry later
      reject(new Error(`Couldn't load ${src}. Check your internet connection.`));
    };
    document.head.appendChild(script);
  });
  pending.set(src, p);
  return p;
}
