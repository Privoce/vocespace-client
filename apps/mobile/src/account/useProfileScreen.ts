import { useState } from 'react';
import { Alert, Clipboard, Share } from 'react-native';
import { useI18n } from '../i18n';
import type { AccountModel } from './useAccount';

export function useProfileScreen(account: AccountModel) {
  const { t } = useI18n();
  const [panel, setPanel] = useState<'edit' | 'preferences' | 'delete'>();
  const [nickname, setNickname] = useState(account.profile.nickname);
  const roomName = account.profile.id ? `u-${account.profile.id}` : '';
  const [deletePassword, setDeletePassword] = useState('');
  const text = (key: string) => t(`native_account.${key}`);
  return {
    panel,
    roomName,
    deletePassword,
    setDeletePassword,
    copyUid: () => {
      Clipboard.setString(account.profile.id);
      Alert.alert(text('copied'));
    },
    setPanel,
    nickname,
    setNickname,
    edit: () => {
      setNickname(account.profile.nickname);
      setPanel('edit');
    },
    save: () => {
      if (!nickname.trim()) return;
      account.update({ nickname });
      setPanel(undefined);
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
