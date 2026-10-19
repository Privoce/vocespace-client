export interface DemoCredentials {
  email: string;
  password: string;
}
export interface DemoProfile {
  email: string;
  nickname: string;
  notifications: boolean;
  gestures: boolean;
}
export type AuthMode = 'login' | 'register';
export const accountSessionKey = 'vocespace.demo-account.session.v1';
export const accountProfileKey = 'vocespace.demo-account.profile.v1';
// Presentation fixture only. This id is never sent as an API identity or ownership claim.
export const demoRoomName = '882-4417';
export function defaultProfile(email: string): DemoProfile {
  return { email, nickname: '夜风_Nightfall', notifications: true, gestures: true };
}
export function matchesDemoCredentials(input: DemoCredentials, configured: DemoCredentials) {
  return (
    input.email.trim().toLowerCase() === configured.email.trim().toLowerCase() &&
    input.password === configured.password
  );
}
export function parseDemoProfile(raw: string | null, email: string): DemoProfile {
  const fallback = defaultProfile(email);
  try {
    const value: unknown = raw ? JSON.parse(raw) : null;
    if (!value || typeof value !== 'object' || Array.isArray(value)) return fallback;
    const saved = value as Record<string, unknown>;
    if (saved.email !== email) return fallback;
    return {
      email,
      nickname:
        typeof saved.nickname === 'string' && saved.nickname.trim()
          ? saved.nickname.trim().slice(0, 30)
          : fallback.nickname,
      notifications: typeof saved.notifications === 'boolean' ? saved.notifications : true,
      gestures: typeof saved.gestures === 'boolean' ? saved.gestures : true,
    };
  } catch {
    return fallback;
  }
}
