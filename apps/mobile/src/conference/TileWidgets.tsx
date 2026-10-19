import { MeetingTileActions } from '@vocespace/ui';
import { MeetingIcon, MeetingButton as Button } from '../ui/meeting';
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
  return (
    <MeetingTileActions
      Button={Button}
      Icon={MeetingIcon}
      actions={[
        {
          id: 'focus',
          icon: focused ? 'unfocus' : 'focus',
          label: t(focused ? 'shared_meeting.unfocus' : 'shared_meeting.focus'),
          onPress: onFocus,
        },
        {
          id: 'fullscreen',
          icon: 'fullscreen',
          label: t('common.full_screen'),
          onPress: onFullscreen,
        },
        ...(onApps
          ? [{ id: 'apps', icon: 'app' as const, label: t('more.app.title'), onPress: onApps }]
          : []),
      ]}
    />
  );
}
