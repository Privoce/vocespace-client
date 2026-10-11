import { Pressable, View } from 'react-native';
import { tileWidgetsContent, type MeetingIconName } from '@vocespace/ui';
import { MeetingIcon } from '../ui/meeting';
import { SettingsIcon } from '../ui/SettingsIcon';
import { useI18n } from '../i18n';
export function TileWidgets({
  focused,
  onFocus,
  onFullscreen,
  onApps,
  onAvo,
}: {
  focused: boolean;
  onFocus: () => void;
  onFullscreen: () => void;
  onApps?: () => void;
  onAvo?: () => void;
}) {
  const { t } = useI18n();
  const button = (name: MeetingIconName, label: string, onPress: () => void) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={(event) => {
        event.stopPropagation();
        onPress();
      }}
      style={{ padding: 6, backgroundColor: '#00000080', borderRadius: 4 }}
    >
      <MeetingIcon name={name} size={16} />
    </Pressable>
  );
  return tileWidgetsContent({
    frame: (children) => <View style={{ flexDirection: 'row', gap: 4 }}>{children}</View>,
    app: onApps && button('app', t('more.app.title'), onApps),
    avo: onAvo && (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('settings.profile.title')}
        onPress={(event) => {
          event.stopPropagation();
          onAvo();
        }}
        style={{ padding: 6, backgroundColor: '#00000080', borderRadius: 4 }}
      >
        <SettingsIcon name="smile" size={16} />
      </Pressable>
    ),
    fullscreen: button('fullscreen', t('common.full_screen'), onFullscreen),
    focus: button(
      focused ? 'unfocus' : 'focus',
      t(focused ? 'shared_meeting.unfocus' : 'shared_meeting.focus'),
      onFocus,
    ),
  });
}
