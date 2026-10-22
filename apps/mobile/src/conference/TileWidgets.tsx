import { MeetingParticipantTools } from '@vocespace/ui';
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
    <MeetingParticipantTools
      Button={Button}
      Icon={MeetingIcon}
      focused={focused}
      onFocus={onFocus}
      onFullscreen={onFullscreen}
      onAvatar={onAvo}
      onApps={onApps}
      labels={{
        focus: t('phone_meeting.focus_layout'),
        unfocus: t('phone_meeting.grid'),
        fullscreen: t('common.full_screen'),
        exitFullscreen: t('phone_meeting.exit_fullscreen'),
        avatar: t('phone_meeting.avatar'),
        apps: t('more.app.title'),
      }}
    />
  );
}
