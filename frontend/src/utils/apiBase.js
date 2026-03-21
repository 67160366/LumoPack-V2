/**
 * API base URL for fetch calls.
 * - Dev: empty string → same origin + Vite proxy to backend
 * - Prod: VITE_API_URL (e.g. https://lumopack-v2.onrender.com) — no trailing slash
 */
export function getApiBase() {
  const raw = import.meta.env.VITE_API_URL ?? '';
  return String(raw).replace(/\/+$/, '');
}

/** @param {string} path e.g. "/api/payments/upload-slip" */
export function apiUrl(path) {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${getApiBase()}${p}`;
}
