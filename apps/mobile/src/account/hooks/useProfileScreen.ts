import { useEffect, useRef, useState } from 'react';
import { Alert, Clipboard, Share } from 'react-native';
import { ACCOUNT_AVATAR_MAX_BYTES, ACCOUNT_AVATAR_TYPES } from '@vocespace/contracts';
import { pickDocument } from '../../ui/document-picker';
import { useI18n } from '../../i18n';
import type { AccountModel } from './useAccount';

export function useProfileScreen(account: AccountModel) {
  const { t } = useI18n();
  const [panel, setPanel] = useState<'edit' | 'preferences' | 'delete' | 'feedback' | 'about'>();
  const [pickingAvatar, setPickingAvatar] = useState(false);
  const picking = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const [nickname, setNickname] = useState(account.profile.nickname);
  const roomName = account.profile.username;
  const [deletePassword, setDeletePassword] = useState('');
  const text = (key: string) => t(`native_account.${key}`);
  return {
    panel,
    pickingAvatar,
    pickAvatar: async () => {
      if (picking.current || account.busy) return;
      picking.current = true;
      setPickingAvatar(true);
      try {
        const result = await pickDocument(ACCOUNT_AVATAR_TYPES);
        if (result.canceled || !mounted.current) return;
        const image = result.assets[0];
        if (image.size !== undefined && image.size >= ACCOUNT_AVATAR_MAX_BYTES)
          throw new Error('AVATAR_TOO_LARGE');
        if (!image.mimeType || !ACCOUNT_AVATAR_TYPES.includes(image.mimeType))
          throw new Error('AVATAR_INVALID_IMAGE');
        const body = new FormData();
        body.append('file', {
          uri: image.uri,
          name: image.name,
          type: image.mimeType,
        } as unknown as Blob);
        const ok = await account.uploadAvatar(body);
        if (!ok && mounted.current) Alert.alert(t('account_auth.avatar_failed'));
      } catch (error) {
        if (!mounted.current) return;
        const code = error instanceof Error ? error.message : '';
        Alert.alert(
          t('account_auth.change_avatar'),
          t(
            code === 'DOCUMENT_PICKER_UNAVAILABLE'
              ? 'account_auth.avatar_picker_unavailable'
              : code === 'AVATAR_TOO_LARGE'
                ? 'account_auth.avatar_size'
                : code === 'AVATAR_INVALID_IMAGE'
                  ? 'account_auth.avatar_format'
                  : 'account_auth.avatar_failed',
          ),
        );
      } finally {
        picking.current = false;
        if (mounted.current) setPickingAvatar(false);
      }
    },
    roomName,
    deletePassword,
    setDeletePassword,
    copyEmail: () => {
      Clipboard.setString(account.profile.email);
      Alert.alert(text('copied'));
    },
    setPanel,
    nickname,
    setNickname,
    edit: () => {
      setNickname(account.profile.nickname);
      setPanel('edit');
    },
    save: async () => {
      if (!nickname.trim() || picking.current || account.busy) return;
      if (await account.updateNickname(nickname.trim())) {
        if (mounted.current) setPanel(undefined);
      }
    },
    notice: (title: string) =>
      Alert.alert(text(title), text(title === 'about' ? 'prototype' : 'not_connected')),
    copy: () => {
      Clipboard.setString(roomName);
      Alert.alert(text('copied'), roomName);
    },
    share: async () => {
      try {
        await Share.share({ message: `VoceSpace · ${text('my_room')}: ${roomName}` });
      } catch {
        Alert.alert(text('share_room'), t('msg.error.room.unexpect'));
      }
    },
  };
}
