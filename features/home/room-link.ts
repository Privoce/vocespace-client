/** Keep the query before the E2EE fragment so HQ never becomes part of the key. */
export function temporaryRoomLink(roomId: string, hq: boolean, encodedPassphrase?: string) {
  return `/${roomId}${hq ? '?hq=true' : ''}${encodedPassphrase ? `#${encodedPassphrase}` : ''}`;
}

export function resolveRoomLink(input: string, origin: string, extraHost = ''): string | null {
  const value = input.trim();
  if (!value) return null;
  const allowedHosts = new Set(['vocespace.com', 'space.voce.chat', new URL(origin).hostname]);
  if (extraHost) allowedHosts.add(extraHost);
  const hasScheme = /^[a-z][a-z\d+.-]*:/i.test(value);
  const hostname = value.split('/')[0];
  const isBareHost = allowedHosts.has(hostname) && value.includes('/');
  try {
    const url = new URL(isBareHost ? `https://${value}` : value.startsWith('/') || hasScheme ? value : `/${value}`, origin);
    if (!['http:', 'https:'].includes(url.protocol) || !allowedHosts.has(url.hostname) || url.username || url.password) return null;
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
    let pathname = url.pathname;
    for (const prefix of [basePath, '/chat', '/dev'].filter(Boolean)) {
      if (pathname.startsWith(`${prefix}/`)) { pathname = pathname.slice(prefix.length); break; }
    }
    if (!/^\/[^/]+$/.test(pathname)) return null;
    if (url.origin === origin) return `${pathname}${url.search}${url.hash}`;
    return url.href;
  } catch {
    return null;
  }
}
