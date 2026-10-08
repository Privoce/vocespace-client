import jwt from 'jsonwebtoken';
import type { TokenResult, IdentityType, RoomType } from '@/lib/std';
import type { ParticipantSettings } from '@/lib/std/space';

const signingKey = () => {
  const key = process.env.PLATFORM_JWT_SECRET;
  if (!key || key.length < 32) throw new Error('PLATFORM_JWT_SECRET must contain at least 32 characters');
  return key;
};

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

  const verified = jwt.verify(token, signingKey(), { algorithms: ['HS256'] }) as Record<string, any>;
  if (!verified.exp || !verified.id && !verified.sub && !verified.userId) throw new Error('Invalid platform claims');
  const result = map(verified);
  if (!result.id || !result.username || !result.space || !['assistant','customer','owner','manager','participant','guest'].includes(result.identity || '')) throw new Error('Invalid platform claims');
  return result;
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

  return jwt.sign(claims, signingKey(), { algorithm: 'HS256', noTimestamp: true });
};

const platformTokens = { parseToken, generateToken };
export default platformTokens;

/**
 * 服务端处理平台用户信息的 Hook
 */
export const getServerParticipantPlatformInfo = ({user}: {user: ParticipantSettings}) => {
  const {auth} = user;

  const isAuth = auth ? (auth.platform === "vocespace"|| auth.platform === 'space') : false;
  const createRoom = auth ? !(auth.platform === 'c_s') : true;

  return {
    isAuth,
    createRoom,
  };
}
/** @deprecated Use getServerParticipantPlatformInfo. */
export const usePlatformUserInfoServer = getServerParticipantPlatformInfo;
