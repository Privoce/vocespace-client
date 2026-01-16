import jwt from 'jsonwebtoken';
import { TokenResult, IdentityType, RoomType } from '../std';

export const SECRET_KEY = 'vocespace_secret_privoce';

export const parseToken = (token: string): TokenResult => {
  if (!token) throw new Error('empty token');

  const map = (payload: Record<string, any>): TokenResult => {
    const id = String(payload.id ?? payload.userId ?? payload.sub ?? '');
    const username = payload.username ?? payload.name ?? '';
    const avatar = payload.avatar ?? payload.photo ?? undefined;
    const space = payload.space ?? payload.site ?? '';
    const room = (payload.room as RoomType) ?? undefined;
    const identity =
      (payload.identity as IdentityType) ?? (payload.role as IdentityType) ?? 'customer';
    const preJoin = !!payload.preJoin;
    const iat = typeof payload.iat === 'number' ? payload.iat : Number(payload.iat) || 0;
    const exp = typeof payload.exp === 'number' ? payload.exp : Number(payload.exp) || 0;

    return {
      id,
      username,
      avatar,
      space,
      room,
      identity,
      preJoin,
      iat,
      exp,
    } as TokenResult;
  };

  try {
    const verified = jwt.verify(token, SECRET_KEY) as Record<string, any>;
    return map(verified);
  } catch (_err) {
    const decoded = jwt.decode(token) as Record<string, any> | null;
    if (!decoded) throw new Error('invalid token');
    return map(decoded);
  }
};

export const generateToken = (payload: TokenResult): string => {
  const now = Math.floor(Date.now() / 1000);
  const iat = payload.iat && payload.iat > 0 ? payload.iat : now;
  const exp = payload.exp && payload.exp > 0 ? payload.exp : now + 3600 * 24 * 15; // default 15 days

  const claims: Record<string, any> = {
    ...payload,
    iat,
    exp,
  };

  if (!claims.id && claims.userId) claims.id = claims.userId;

  return jwt.sign(claims, SECRET_KEY, { algorithm: 'HS256', noTimestamp: true });
};

export default {
  SECRET_KEY,
  parseToken,
  generateToken,
};
