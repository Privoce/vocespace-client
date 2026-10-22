import type { LocalSettings } from '../settings/model';
import { ActivityIndicator, Text, View } from 'react-native';
import { RoomContext } from '@livekit/react-native';
import { useSpaceBrowser } from '../conference/hooks/useSpaceBrowser';
import { ScreenSharePicker } from '../conference/ScreenSharePicker';
import type { useConference } from '../conference/hooks/useConference';
import { meetingFailure } from '../conference/meetingFailure';
import { SharedMeetingRoom } from '../conference/SharedMeetingRoom';
import { SpaceBrowser } from './SpaceBrowser';
import { PrimaryButton } from '../ui/controls';
import { colors, ui } from '../theme';
export function MeetingsScreen({
  model,
  accountEmail,
  nickname,
  preferences,
  preferencesReady,
}: {
  model: ReturnType<typeof useConference>;
  nickname: string;
  accountEmail?: string;
  preferences: LocalSettings;
  preferencesReady: boolean;
}) {
  const browser = useSpaceBrowser(model, true);
  const { state } = model;
  const busy = state.phase === 'joining' || state.phase === 'leaving';
  const connected = state.phase === 'joined' && state.room;
  if (connected)
    return (
      <RoomContext.Provider value={connected.raw}>
        <SharedMeetingRoom
          key={state.joined!.joinId}
          accountEmail={accountEmail}
          conference={model}
          room={connected}
          onBrowse={browser.browse}
        />
        <ScreenSharePicker room={connected} />
      </RoomContext.Provider>
    );
  if (busy || model.hasPendingCleanup)
    return (
      <View style={ui.page}>
        {busy && <ActivityIndicator color={colors.accent} />}
        <Text style={ui.title}>{state.spaceName}</Text>
        {state.error != null && <Text style={ui.body}>{meetingFailure(state.error)}</Text>}
        <PrimaryButton
          onPress={() => {
            void model.leave();
          }}
        >
          {state.phase === 'joining' ? '取消加入' : '重试退出'}
        </PrimaryButton>
      </View>
    );
  return (
    <SpaceBrowser
      browser={browser}
      busy={busy}
      model={model}
      preferences={preferences}
      preferencesReady={preferencesReady}
      joinError={state.error != null ? meetingFailure(state.error) : undefined}
      join={async (name) => {
        await model.join(name, nickname.trim() || '访客');
      }}
    />
  );
}
