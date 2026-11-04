import { useEffect, useState, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { type User } from "@supabase/supabase-js";
import { dbApi } from "@/lib/api/db";
import { UserInfo } from "@/lib/std/user";
import { vocespace } from "@/lib/api/vocespace/space";
import { Nullable } from "@/lib/std";
import { Space } from "@/lib/std/space";
import { useUserStore } from "@/app/store/user";

export interface UseUserOptions {
  /**
   * 要查看的用户ID，如果不提供则使用当前认证用户
   */
  userId?: string;
}

export interface UseUserResult {
  // 当前用户相关（可能是认证用户或指定查看的用户）
  user: Nullable<User>;
  userInfo: Nullable<UserInfo>;
  spaces: Space[];
  avatar: Nullable<string>;
  isSelf: boolean;
  isAuthenticated: boolean;
  refreshUserData: () => Promise<void>;
  // 状态
  loading: boolean;
  error: Nullable<string>;
  needsOnboarding: boolean; // 是否需要onboarding

  // 操作
  createSpace: (spaceName?: string) => Promise<Response>;
  updateUserInfo: (updates: Partial<UserInfo>) => Promise<boolean>;

  // 兼容旧版本
  client: ReturnType<typeof createClient>;
  setLoading: (loading: boolean) => void;
}

/**
 * Enhanced user hook that handles both authenticated users and viewing other users
 *
 * @param options - Configuration options
 * @param options.userId - Optional user ID to view, if not provided uses current auth user
 *
 * @example
 * // View current authenticated user
 * const { user, userInfo, username, avatar, isSelf } = useUser();
 *
 * @example
 * // View another user
 * const { userInfo, username, avatar, isSelf } = useUser({ userId: 'other-user-id' });
 */
export function useUser(options: UseUserOptions = {}): UseUserResult {
  const [user, setUser] = useState<Nullable<User>>(null);

  const userInfo = useUserStore((state) => state.userInfo);
  const setUserInfo = useUserStore((state) => state.setUserInfo);
  const mergeUserInfo = useUserStore((state) => state.mergeUserInfo);
  const [currentAuthUser, setCurrentAuthUser] = useState<Nullable<User>>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Nullable<string>>(null);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const { userId } = options;
  const client = createClient();

  // 判断是否在查看自己的信息
  const isSelf = useMemo(() => {
    return !userId || (currentAuthUser && userId === currentAuthUser.id);
  }, [userId, currentAuthUser]);

  // 是否已认证
  const isAuthenticated = useMemo(() => {
    return !!currentAuthUser;
  }, [currentAuthUser]);

  // 计算头像URL（优先级：自定义头像 > OAuth头像（仅自己））
  const avatar = useMemo(() => {
    if (userInfo?.avatar) return userInfo.avatar;
    // 只有查看自己时才使用 OAuth 头像
    if (isSelf && user?.user_metadata?.avatar_url)
      return user.user_metadata.avatar_url;
    return null;
  }, [userInfo?.avatar, isSelf, user?.user_metadata?.avatar_url]);

  // 判断是否需要onboarding（只有查看自己时才需要判断）
  const needsOnboarding = useMemo(() => {
    if (!isSelf || !isAuthenticated || loading) return false;
    // 如果没有username或没有userInfo，认为需要onboarding
    return !userInfo || !userInfo?.username || userInfo.username.trim() === "";
  }, [isSelf, isAuthenticated, loading, userInfo?.username]);

  // 获取用户的spaces
  const fetchSpaces = async (userId: string) => {
    try {
      const userSpaces = await dbApi.space.getByUserId(client, userId);
      setSpaces(userSpaces);
    } catch (error) {
      console.error("Error fetching spaces:", error);
    }
  };

  useEffect(() => {
    if (userInfo) {
      fetchSpaces(userInfo.id);
    }
  }, [userInfo]);

  // 初始化：获取当前认证用户
  useEffect(() => {
    const getCurrentAuthUser = async () => {
      try {
        const {
          data: { user },
        } = await client.auth.getUser();
        setCurrentAuthUser(user);
      } catch (err) {
        console.error("Failed to get current auth user:", err);
      }
    };

    getCurrentAuthUser();

    // 监听认证状态变化
    // const {
    //   data: { subscription },
    // } = client.auth.onAuthStateChange(async (event, session) => {
    //   setCurrentAuthUser(session?.user || null);
    // });

    // return () => subscription.unsubscribe();
  }, []);
  const fetchUserData = async () => {
    try {
      setLoading(true);
      setError(null);

      if (userId) {
        // 有 userId：获取指定用户的信息
        const userInfo = await dbApi.userInfo.get(client, userId);
        setUserInfo(userInfo);
        // 如果查看的是自己，user 就是当前认证用户
        if (currentAuthUser && userId === currentAuthUser.id) {
          setUser(currentAuthUser);
        } else {
          // 查看其他用户时，不设置 user 对象（因为无法安全获取其他用户的认证信息）
          setUser(null);
        }
      } else {
        // 没有 userId：获取当前认证用户的信息
        if (currentAuthUser) {
          const userInfo = await dbApi.userInfo.get(client, currentAuthUser.id);
          setUser(currentAuthUser);
          setUserInfo(userInfo);
        } else {
          setUser(null);
          setUserInfo(null);
        }
      }
    } catch (err: any) {
      if (err?.code === "PGRST116") {
        // 用户不存在
        // 如果user的授权信息是有的，需要转到引导页面
        if (isSelf && isAuthenticated) {
          setUser(currentAuthUser);
          setUserInfo(null);
        }
      } else {
        setError("Failed to fetch user data");
      }
    } finally {
      setLoading(false);
    }
  };
  // 获取用户数据：根据是否有 userId 决定获取哪个用户的信息
  useEffect(() => {
    // 只有在 currentAuthUser 已知的情况下才获取数据
    if (currentAuthUser !== null || !userId) {
      fetchUserData();
    }
  }, [userId, currentAuthUser]);

  // 创建空间（只有认证用户才能创建）
  const createSpace = async (spaceName?: string) => {
    if (!currentAuthUser || !userInfo) {
      throw new Error("User not authenticated");
    }

    const displayName =
      userInfo.username || currentAuthUser.email || "Unknown User";

    try {
      const response = await vocespace.createSpace(
        currentAuthUser.id,
        displayName,
        spaceName,
      );

      if (!response.ok) {
        throw new Error("Failed to create space");
      }

      return response;
    } catch (error) {
      console.error("Error creating space:", error);
      throw error;
    }
  };

  // 更新用户信息（只能更新自己的信息）
  const updateUserInfo = async (updates: Partial<UserInfo>) => {
    if (!currentAuthUser) {
      throw new Error("User not authenticated");
    }

    try {
      await dbApi.userInfo.update(client, currentAuthUser.id, updates);
      // 更新本地状态
      // setUserInfo((prev) => (prev ? { ...prev, ...updates } : null));
      mergeUserInfo(updates);
      return true;
    } catch (error) {
      console.error("Error updating user info:", error);
      throw error;
    }
  };

  return {
    // 当前用户相关
    user,
    userInfo,
    spaces,
    avatar,
    isSelf: isSelf || false,
    isAuthenticated,

    // 状态
    loading,
    error,
    needsOnboarding,

    // 操作
    createSpace,
    updateUserInfo,

    // 兼容旧版本
    client,
    refreshUserData: fetchUserData,
    setLoading,
  };
}

/**
 * Custom hook for user authentication actions
 *
 * Usage:
 * const { signOut, signIn, signUp } = useAuth();
 */
export function useAuth() {
  const client = createClient();

  const signOut = async () => {
    const uid = (await client.auth.getUser()).data.user?.id;
    if (uid) {
      const _ = await dbApi.userInfo.offline(client, uid);
    }
    const { error } = await client.auth.signOut();
    if (error) throw error;
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await client.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data;
  };

  const signUp = async (email: string, password: string) => {
    const { data, error } = await client.auth.signUp({
      email,
      password,
    });
    if (error) throw error;
    return data;
  };

  return { signOut, signIn, signUp };
}

export const getUsername = (
  user: Nullable<User>,
  userInfo: Nullable<UserInfo>,
): string => {
  if (!user) return "unknown";
  if (userInfo?.username) {
    return userInfo.username;
  } else {
    if (
      user?.app_metadata &&
      user.app_metadata.provider === "google" &&
      user.user_metadata
    ) {
      return user.user_metadata.full_name || user.email;
    }
    return user.email!;
  }
};

export const whereUserFrom = (user: Nullable<User>): "vocespace" | "google" => {
  if (!user) return "vocespace";
  return user.app_metadata?.provider === "google" ? "google" : "vocespace";
};
