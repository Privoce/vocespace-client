import { Nullable } from ".";
import { ParticipantSettings, Space, SpaceType } from "./space";

export interface UserInfo {
  id: string;
  username: string;
  nickname: Nullable<string>;
  desc: Nullable<string>;
  location: Nullable<string>;
  /**
   * 用户订阅过的空间ID列表
   */
  subscribes: Nullable<string[]>;
  /**
   * 用户参与使用过的空间的时间戳列表 (用于生成热力图)
   */
  records: Nullable<string[]>;
  linkedin: Nullable<string>;
  github: Nullable<string>;
  twitter: Nullable<string>;
  website: Nullable<string>;
  wx: Nullable<string>;
  avatar: Nullable<string>;
  online: boolean;
  settings: Nullable<ParticipantSettings>;
}

export const DEFAULT_USER_INFO = (id: string, username: string): UserInfo => ({
  id,
  username,
  nickname: null,
  desc: null,
  location: null,
  subscribes: null,
  records: null,
  linkedin: null,
  github: null,
  twitter: null,
  avatar: null,
  website: null,
  wx: null,
  online: false,
  settings: null,
});

export interface User {
  id: string;
  username: string;
  email: string;
  avatar_url?: string;
  bio?: string;
  created_at: number;
  updated_at: number;
  location?: string;
  website?: string;
  social_links?: {
    github?: string;
    twitter?: string;
    linkedin?: string;
  };
  // 统计信息
  total_spaces_created: number;
  total_spaces_subscribed: number;
  total_participation_hours: number;
}

export interface UserSubscription {
  id: string;
  user_id: string;
  space_id: string;
  subscribed_at: number;
  space_type: SpaceType;
  is_active: boolean;
}

export interface UserParticipation {
  id: string;
  user_id: string;
  space_id: string;
  joined_at: number;
  left_at?: number;
  duration_minutes: number;
  date: string; // YYYY-MM-DD format for activity heatmap
  space_type: SpaceType;
}

export interface UserStats {
  // 空间类型偏好统计
  space_type_preferences: {
    [key in SpaceType]: number;
  };

  // 参与活动热力图数据 (类似GitHub贡献图)
  activity_heatmap: {
    date: string; // YYYY-MM-DD
    count: number; // 参与次数
    duration: number; // 参与时长(分钟)
  }[];

  // 每月统计
  monthly_stats: {
    month: string; // YYYY-MM
    spaces_created: number;
    spaces_joined: number;
    total_duration: number;
  }[];

  // 总体统计
  overview: {
    total_spaces_created: number;
    total_spaces_subscribed: number;
    total_participation_hours: number;
    longest_streak_days: number; // 连续参与天数
    current_streak_days: number;
    most_active_space_type: SpaceType;
    average_session_duration: number; // 平均每次参与时长(分钟)
  };
}
