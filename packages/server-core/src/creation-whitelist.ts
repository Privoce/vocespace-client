/** Compatibility rule shared by the two existing creation entry points. */
export function matchesCreateWhitelist(name: string, id?: string | null, entries?: string[]): boolean {
  if (!entries?.length) return false;
  const normalizedName = name.trim().toLowerCase();
  const normalizedId = id?.trim().toLowerCase();
  if (!normalizedName && !normalizedId) return false;
  if (entries.includes('*')) return true;

  return entries.some((rawEntry) => {
    const entry = rawEntry.trim().toLowerCase();
    if (entry.startsWith('user-')) {
      const whitelistId = entry.slice('user-'.length);
      return normalizedName === whitelistId || Boolean(normalizedId && (
        normalizedId === entry || normalizedId === whitelistId ||
        normalizedId.startsWith(`${whitelistId}__`)
      ));
    }
    return entry === normalizedName || Boolean(normalizedId && entry === normalizedId);
  });
}
