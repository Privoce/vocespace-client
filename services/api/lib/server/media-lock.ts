// The supported deployment has one API writer. Serialize grant/revoke/leave for each identity.
const pending = new Map<string, Promise<unknown>>();
export async function withMediaMember<T>(space: string, identity: string, work: () => Promise<T>) {
  const key = JSON.stringify([space, identity]);
  const previous = pending.get(key);
  const current = (previous || Promise.resolve()).catch(() => {}).then(work);
  pending.set(key, current);
  try {
    return await current;
  } finally {
    if (pending.get(key) === current) pending.delete(key);
  }
}
