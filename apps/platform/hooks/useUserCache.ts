import { createContext, useContext, useCallback } from "react";
import { UserInfo } from "@/lib/std/user";
import { type User } from "@supabase/supabase-js";
import { Space } from "@/lib/std/space";
import { Nullable } from "@/lib/std";

// 缓存数据的接口
interface UserCacheData {
  user: Nullable<User>;
  userInfo: Nullable<UserInfo>;
  spaces: Space[];
  lastFetched: number;
}

// 缓存管理器
class UserCacheManager {
  private cache: Map<string, UserCacheData> = new Map();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5分钟缓存

  set(userId: string, data: Omit<UserCacheData, 'lastFetched'>) {
    this.cache.set(userId, {
      ...data,
      lastFetched: Date.now(),
    });
  }

  get(userId: string): UserCacheData | null {
    const cached = this.cache.get(userId);
    if (!cached) return null;

    // 检查缓存是否过期
    if (Date.now() - cached.lastFetched > this.CACHE_DURATION) {
      this.cache.delete(userId);
      return null;
    }

    return cached;
  }

  invalidate(userId?: string) {
    if (userId) {
      this.cache.delete(userId);
    } else {
      this.cache.clear();
    }
  }

  updateUserInfo(userId: string, updates: Partial<UserInfo>) {
    const cached = this.cache.get(userId);
    if (cached && cached.userInfo) {
      cached.userInfo = { ...cached.userInfo, ...updates };
      cached.lastFetched = Date.now(); // 更新缓存时间
    }
  }

  updateSpaces(userId: string, spaces: Space[]) {
    const cached = this.cache.get(userId);
    if (cached) {
      cached.spaces = spaces;
      cached.lastFetched = Date.now();
    }
  }
}

// 全局缓存实例
export const userCacheManager = new UserCacheManager();

// Context for cache management
const UserCacheContext = createContext<UserCacheManager | null>(null);

export const useUserCache = () => {
  const context = useContext(UserCacheContext);
  return context || userCacheManager;
};

// Hook for cache operations
export const useCacheOperations = () => {
  const cache = useUserCache();

  const invalidateUserCache = useCallback((userId?: string) => {
    cache.invalidate(userId);
  }, [cache]);

  const updateCachedUserInfo = useCallback((userId: string, updates: Partial<UserInfo>) => {
    cache.updateUserInfo(userId, updates);
  }, [cache]);

  const updateCachedSpaces = useCallback((userId: string, spaces: Space[]) => {
    cache.updateSpaces(userId, spaces);
  }, [cache]);

  return {
    invalidateUserCache,
    updateCachedUserInfo,
    updateCachedSpaces,
  };
};