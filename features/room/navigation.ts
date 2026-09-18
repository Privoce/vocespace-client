/** Remove consumed login credentials without losing media options or the E2EE key. */
export function roomUrlAfterLogin(spaceName: string, href: string) {
  const url = new URL(href);
  for (const key of ['auth', 'data', 'details', 'token', 'fromServer']) url.searchParams.delete(key);
  return `/${encodeURIComponent(spaceName)}${url.search}${url.hash}`;
}

