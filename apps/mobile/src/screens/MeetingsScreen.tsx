import { useState } from 'react';
import type { AccountModel } from '../account/hooks/useAccount';
import { MeetingTabHeader, type MeetingTab } from './meetings/MeetingTabHeader';
import { MySpaces } from './meetings/MySpaces';
import { meetingTabStyles } from './meetings/styles';
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
  account,
  active,
  onPreferences,
  nickname,
  preferences,
  preferencesReady,
}: {
  model: ReturnType<typeof useConference>;
  nickname: string;
  account: AccountModel;
  active: boolean;
  onPreferences: (patch: Partial<LocalSettings>) => void;
  preferences: LocalSettings;
  preferencesReady: boolean;
}) {
  const [section, setSection] = useState<MeetingTab>(account.signedIn ? 'mine' : 'plaza');
  const browser = useSpaceBrowser(model, true, active);
  const { state } = model;
  const busy = state.phase === 'joining' || state.phase === 'leaving';
  const connected = state.phase === 'joined' && state.room;
  if (connected)
    return (
      <RoomContext.Provider value={connected.raw}>
        <SharedMeetingRoom
          key={state.joined!.joinId}
          accountEmail={account.signedIn ? account.profile.email : undefined}
          conference={model}
          room={connected}
          onBrowse={async (direction) => {
            await browser.browse(direction);
            setSection('plaza');
          }}
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
  const joinError = state.error != null ? meetingFailure(state.error) : undefined;
  return (
    <View style={meetingTabStyles.screen}>
      <MeetingTabHeader selected={section} onSelect={setSection} />
      {section === 'mine' ? (
        <MySpaces
          account={account}
          active={active}
          spaces={browser.spaces}
          disabled={!model.configured || !preferencesReady || !account.ready || account.busy}
          error={joinError}
          onJoin={(name, create) => {
            void model.join(name, nickname.trim() || '访客', undefined, create);
          }}
        />
      ) : (
        <SpaceBrowser
          browser={browser}
          active={active}
          busy={busy}
          model={model}
          preferences={preferences}
          onPreferences={onPreferences}
          preferencesReady={preferencesReady}
          joinError={joinError}
          join={async (name) => {
            await model.join(name, nickname.trim() || '访客');
          }}
        />
      )}
    </View>
  );
}
