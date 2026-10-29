/** Supabase public table rows only; unrelated to Web/Redis temporary meeting models. */
export type SBTJson = string | number | boolean | null | SBTJson[] | { [key: string]: SBTJson };

/** UUID and timestamptz values are strings in PostgREST JSON responses. */
export interface SBTSpaceTb {
  id: string;
  created_at: string | null;
  name: string | null;
  desc: string | null;
  start_at: string | null;
  end_at: string | null;
  freq: string | null;
  owner_id: string | null;
  /** PostgREST serializes bigint as a JSON number, not a JavaScript bigint. */
  sub_count: number | null;
  fee: string | null;
  url: string | null;
  images: string | null;
  ty: string | null;
  public: boolean;
  expired_at: string;
  blacklist: string[] | null;
}

export interface SBTAIAnalysis {
  id: string;
  date: string;
  result: SBTJson;
  aid: string;
}

export interface SBTUserInfo {
  id: string;
  username: string | null;
  desc: string | null;
  location: string | null;
  records: SBTJson[] | null;
  linkedin: string | null;
  github: string | null;
  twitter: string | null;
  avatar: string | null;
  wx: string | null;
  website: string | null;
  subscribes: SBTJson[] | null;
  online: boolean;
  nickname: string | null;
  settings: SBTJson;
}

export interface SBTTodos {
  id: string;
  items: SBTJson;
  date: string;
  tid: string;
}

export interface SBTTables {
  space: SBTSpaceTb;
  ai_analysis: SBTAIAnalysis;
  user_info: SBTUserInfo;
  todos: SBTTodos;
}

/** Keep deletion filter columns checked against their own persistent table. */
export type SBTDeletionTarget = {
  [Table in keyof SBTTables]: readonly [Table, keyof SBTTables[Table]];
}[keyof SBTTables];
