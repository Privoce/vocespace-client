export interface LocalSettings {
  nickname: string;
  previewMuted: boolean;
  autoJoin: boolean;
}

export const defaultSettings: LocalSettings = {
  nickname: '访客', previewMuted: true, autoJoin: true,
};
export const settingsKey = 'vocespace.local-settings.v1';

/** Local preferences are display/interaction choices, never an authenticated identity. */
export function parseSettings(raw: string | null): LocalSettings {
  try {
    const value: unknown = raw ? JSON.parse(raw) : null;
    if (!value || typeof value !== 'object' || Array.isArray(value)) return { ...defaultSettings };
    const saved = value as Record<string, unknown>;
    return {
      nickname: typeof saved.nickname === 'string' && saved.nickname.trim()
        ? saved.nickname.trim().slice(0, 30) : defaultSettings.nickname,
      previewMuted: typeof saved.previewMuted === 'boolean' ? saved.previewMuted : true,
      autoJoin: typeof saved.autoJoin === 'boolean' ? saved.autoJoin : true,
    };
  } catch { return { ...defaultSettings }; }
}
