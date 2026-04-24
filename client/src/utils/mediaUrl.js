// Resolves media URLs from the API.
// In dev, Vite proxies /uploads → localhost:3001.
// In production, we prefix with VITE_API_URL.
const API_URL = import.meta.env.VITE_API_URL || '';

export function resolveMediaUrl(path) {
  if (!path) return null;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  if (path.startsWith('/')) return `${API_URL}${path}`;
  return `${API_URL}/${path}`;
}
