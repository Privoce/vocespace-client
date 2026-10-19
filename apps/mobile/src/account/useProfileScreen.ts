import { useState } from 'react';
import { Alert, Clipboard, Share } from 'react-native';
import { useI18n } from '../i18n';
import type { DemoAccountModel } from './useDemoAccount';
import { demoRoomName } from './model';
export function useProfileScreen(account: DemoAccountModel) {
  const { t } = useI18n();
  const [panel, setPanel] = useState<'edit' | 'preferences'>();
  const [nickname, setNickname] = useState(account.profile.nickname);
  const text = (key: string) => t(`native_account.${key}`);
  return {
    panel,
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
      Clipboard.setString(demoRoomName);
      Alert.alert(text('copied'), demoRoomName);
    },
    share: async () => {
      try {
        await Share.share({ message: `VoceSpace · ${text('my_room')}: ${demoRoomName}` });
      } catch {
        Alert.alert(text('share_room'), t('msg.error.room.unexpect'));
      }
    },
  };
}
