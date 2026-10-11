import { matchesCreateWhitelist } from './creation-whitelist';
export function canCreateSpace(input: { mode: string; name: string; platformIdentity?: string; whiteList?: string[] }) {
  const matches = matchesCreateWhitelist(input.name, input.platformIdentity, input.whiteList);
  return input.mode === 'all' || input.mode === 'white' && matches ||
    input.mode === 'white_platform' && (!!input.platformIdentity || matches);
}
