interface PreviewSpace {
  allowGuest: string;
  participants: Record<string, { name?: string }>;
  children: { participants: string[] }[];
}
/** Public and private child Rooms are both outside the preview audience. Fail closed on old bad data. */
export function previewMembers(space: PreviewSpace | null) {
  if (
    !space ||
    space.allowGuest !== 'allow' ||
    !Array.isArray(space.children) ||
    space.children.some((child) => !Array.isArray(child.participants))
  )
    return null;
  const children = new Set(space.children.flatMap((child) => child.participants));
  return Object.keys(space.participants)
    .filter((id) => !children.has(id))
    .sort()
    .map((id) => ({ id, name: space.participants[id].name || id }));
}
export function previewAssetName(name: string) {
  return /^[a-zA-Z0-9_-]+\.(m3u8|ts|m4s|mp4)$/.test(name) && name.length <= 180;
}
/** Never proxy an arbitrary URL or pass an unprotected segment/key URL through to the player. */
export function rewritePreviewPlaylist(playlist: string, assetUrl: (name: string) => string) {
  if (!playlist.startsWith('#EXTM3U')) throw new Error('INVALID_PLAYLIST');
  const asset = (name: string) => {
    if (!previewAssetName(name)) throw new Error('INVALID_PREVIEW_ASSET');
    return assetUrl(name);
  };
  return playlist
    .split(/\r?\n/)
    .map((line) => {
      if (!line) return line;
      if (!line.startsWith('#')) return asset(line);
      // This source produces unencrypted MPEG-TS. Reject unsupported encryption and external fetch tags.
      if (/^#EXT-X-(KEY|SESSION-KEY|SESSION-DATA|CONTENT-STEERING)/.test(line))
        throw new Error('UNSUPPORTED_PLAYLIST');
      return line.replace(/URI="([^"]+)"/g, (_, name: string) => `URI="${asset(name)}"`);
    })
    .join('\n');
}
