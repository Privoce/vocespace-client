import { is_web } from '@/lib/std';
import { AddDeviceInfo, default_device } from '@/lib/std/device';
import { default_virtual_info, VirtualInfo } from '@/lib/std/virtual';

export type UserAddInfos = Map<string, UserAddInfo>;

export interface UserAddInfo {
  device: AddDeviceInfo;
  virtual?: VirtualInfo;
}

/// This hook is used to store the user's choices into the local storage
export function use_stored_set(key: string, val: UserAddInfo) {
  if (!is_web()) {
    return;
  }
  let user_infos = new Map<string, UserAddInfo>();
  const user_infos_json = localStorage.getItem('voce_space_user_infos');

  if (user_infos_json) {
    const parsed = JSON.parse(user_infos_json);
    user_infos = new Map(Object.entries(parsed));
  }

  user_infos.set(key, val);

  // 将 Map 转换为对象再存储
  const obj = Object.fromEntries(user_infos);
  localStorage.setItem('voce_space_user_infos', JSON.stringify(obj));
}

/// This hook is used to get the user's choices from the local storage
export function use_stored_get(): UserAddInfos | undefined {
  if (!is_web()) {
    return undefined;
  }
  const data = localStorage.getItem('voce_space_user_infos');
  if (data) {
    // 将解析后的对象转换为 Map
    const parsed = JSON.parse(data);
    return new Map(Object.entries(parsed));
  }
  return undefined;
}

export function use_user_infos(username?: string): UserAddInfo {
  if (!is_web()) {
    return {
      device: default_device(),
      virtual: default_virtual_info(),
    };
  }
  const user_name = use_lk_username() || username || '';
  const user_infos = use_stored_get();
  if (user_infos && user_name !== '') {
    return (
      user_infos.get(user_name) || {
        device: default_device(),
        virtual: default_virtual_info(),
      }
    );
  }
  return {
    device: default_device(),
    virtual: default_virtual_info(),
  };
}

export function use_lk_username(): string {
  if (!is_web()) {
    return '';
  }

  const lk_json = localStorage.getItem('lk-user-choices');
  if (lk_json) {
    const lk = JSON.parse(lk_json);
    return lk.username;
  }
  return '';
}

export function use_add_user_device(username?: string): AddDeviceInfo {
  if (!is_web()) {
    return default_device();
  }
  const user_name = use_lk_username() || username || '';
  const user_infos = use_stored_get();
  let device_settings = default_device();
  if (user_infos && user_name !== '') {
    device_settings = user_infos.get(user_name)?.device || default_device();
  }
  return device_settings;
}

export function use_add_user_virtual(username?: string): VirtualInfo {
  if (!is_web()) {
    return default_virtual_info();
  }
  const user_name = use_lk_username() || username || '';
  const user_infos = use_stored_get();
  let virtual_settings = default_virtual_info();
  if (user_infos && user_name !== '') {
    virtual_settings = user_infos.get(user_name)?.virtual || default_virtual_info();
  }
  return virtual_settings;
}

export function rename_user_and_store(from_name: string, to_name: string) {
  if (!is_web()) {
    return;
  }
  const user_infos = use_stored_get();
  if (user_infos) {
    const from_info = user_infos.get(from_name);
    if (from_info) {
      user_infos.delete(from_name);
      user_infos.set(to_name, from_info);
      const obj = Object.fromEntries(user_infos);
      localStorage.setItem('voce_space_user_infos', JSON.stringify(obj));
    }
  }
}
