const KEY = 'vocespace_host_token_verified';
const TTL = 3600_000;
interface HostCredential { token: string; at: number }
let memory: HostCredential | null = null;
let memoryOnly = false;

/** A client convenience only: every protected request is still authorized by the API. */
export function readHostCredential(): HostCredential | null {
  let value: unknown = memory;
  if (!memoryOnly) {
    try { value = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { /* Storage may be blocked. */ }
  }
  if (!value || typeof value !== 'object' || !('token' in value) || !('at' in value)) return null;
  if (typeof value.token !== 'string' || !value.token || typeof value.at !== 'number' ||
    !Number.isFinite(value.at) || value.at > Date.now() || Date.now() - value.at >= TTL) return null;
  return { token: value.token, at: value.at };
}

export function saveHostCredential(token: string) {
  memory = { token, at: Date.now() };
  try {
    localStorage.setItem(KEY, JSON.stringify(memory));
    memoryOnly = false;
  } catch { memoryOnly = true; }
}

export function clearHostCredential() {
  memory = null;
  try {
    localStorage.removeItem(KEY);
    memoryOnly = false;
  } catch { memoryOnly = true; }
}
