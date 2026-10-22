import { MeetingTileActions } from './MeetingDock';
import type { MeetingParticipantToolsProps } from './types';

/** One tool order and capability gating for Web Phone and Native. */
export function MeetingParticipantTools({
  focused,
  fullscreen,
  onFocus,
  onFullscreen,
  onAvatar,
  onApps,
  labels,
  Button,
  Icon,
}: MeetingParticipantToolsProps) {
  return (
    <MeetingTileActions
      Button={Button}
      Icon={Icon}
      actions={[
        {
          id: 'focus',
          icon: focused ? 'app' : 'focus',
          label: focused ? labels.unfocus : labels.focus,
          onPress: onFocus,
        },
        {
          id: 'fullscreen',
          icon: fullscreen ? 'fullscreenExit' : 'fullscreen',
          label: fullscreen ? labels.exitFullscreen : labels.fullscreen,
          onPress: onFullscreen,
        },
        ...(onAvatar
          ? [{ id: 'avo', icon: 'avatar' as const, label: labels.avatar, onPress: onAvatar }]
          : []),
        ...(onApps
          ? [{ id: 'apps', icon: 'app' as const, label: labels.apps, onPress: onApps }]
          : []),
      ]}
    />
  );
}
