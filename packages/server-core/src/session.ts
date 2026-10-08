export interface SessionPrincipal {
  client?: 'native';
  id: string;
  expiresAt: number;
  identities: Record<string, string>;
  platform?: { id: string; username: string; space: string; identity: string; auth: string;
    exp: number; iat: number; room?: string; avatar?: string; preJoin?: boolean };
}
export interface SessionPort {
  read(key: string): Promise<string | null>;
  write(key: string, value: string, ttlSeconds: number, existingOnly?: boolean): Promise<void>;
  consume(key: string): Promise<string | null>;
  remove(key: string): Promise<void>;
}
export function createSessionService(port: SessionPort, random: () => string, now = Date.now) {
  const ttl = 7 * 24 * 3600;
  return {
    async create() {
      const token = random();
      const principal: SessionPrincipal = { id: random(), expiresAt: now() + ttl * 1000, identities: {} };
      await port.write(`session:${token}`, JSON.stringify(principal), ttl);
      return { token, principal };
    },
    async read(token: string | undefined) {
      if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
      const raw = await port.read(`session:${token}`);
      if (!raw) return null;
      const principal = JSON.parse(raw) as SessionPrincipal;
      return principal.expiresAt > now() ? principal : null;
    },
    async save(token: string, principal: SessionPrincipal) {
      await port.write(`session:${token}`, JSON.stringify(principal), Math.max(1, Math.ceil((principal.expiresAt - now()) / 1000)), true);
    },
    async revoke(token: string) { await port.remove(`session:${token}`); },
    async code(value: unknown) {
      const code = random();
      await port.write(`code:${code}`, JSON.stringify(value), 60);
      return code;
    },
    async exchange(code: string): Promise<unknown> {
      if (!/^[a-f0-9]{64}$/.test(code)) return null;
      const value = await port.consume(`code:${code}`);
      return value ? JSON.parse(value) : null;
    },
  };
}
