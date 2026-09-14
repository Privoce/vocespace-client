/** Resolve an already-prefixed API endpoint without coupling requests to a business domain. */
export function createApiUrl(
  endpoint: string,
  search: Readonly<Record<string, string | undefined>> = {},
  origin?: string,
): URL {
  const base = origin ?? (typeof window !== 'undefined' ? window.location.origin : undefined);
  const url = new URL(endpoint, base);
  for (const [key, value] of Object.entries(search)) {
    if (value !== undefined) url.searchParams.append(key, value);
  }
  return url;
}
