/** Resolve a name/link locally. Links never change the configured API or forward credentials. */
export function resolveSpaceInput(input: string, apiUrl?: string): string | null {
  const value = input.trim();
  if (!value) return null;
  let name = value;
  try {
    if (/^[a-z][a-z\d+.-]*:/i.test(value) || value.includes('/')) {
      const endpoint = apiUrl ? new URL(apiUrl) : undefined;
      const hosts = new Set(['vocespace.com', 'space.voce.chat', endpoint?.hostname]);
      const bareHost = value.split('/')[0];
      const url = new URL(
        hosts.has(bareHost) ? `https://${value}` : value,
        endpoint?.origin,
      );
      if (
        !['http:', 'https:'].includes(url.protocol) ||
        !hosts.has(url.hostname) ||
        url.username || url.password || url.hash
      ) return null;
      let path = url.pathname;
      const prefix = endpoint?.pathname.replace(/\/+$/, '');
      for (const base of [prefix, '/chat', '/dev']) {
        if (base && path.startsWith(`${base}/`)) {
          path = path.slice(base.length);
          break;
        }
      }
      if (!/^\/[^/]+\/?$/.test(path)) return null;
      name = decodeURIComponent(path.replace(/^\/|\/$/g, ''));
    }
  } catch {
    return null;
  }
  if (
    !name.trim() || name.length > 200 || /[\\/\0?#]/.test(name) ||
    ['.', '..', '__proto__', 'constructor', 'prototype'].includes(name)
  ) return null;
  return name.trim();
}
