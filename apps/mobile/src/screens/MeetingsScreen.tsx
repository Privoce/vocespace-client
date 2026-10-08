import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { RoomContext, useTracks, VideoTrack, isTrackReference } from '@livekit/react-native';
import { Track } from 'livekit-client';
import { ApiError } from '@vocespace/client-sdk';
import type { useConference } from '../conference/useConference';
import { colors, ui } from '../theme';
import { Input, PrimaryButton } from '../ui/controls';

type Model = ReturnType<typeof useConference>;
function failure(error: unknown) {
  if (error instanceof ApiError) {
    const messages: Record<string, string> = {
      NATIVE_CONFERENCE_NOT_ENABLED: '该会议暂未开放手机端加入。',
      NATIVE_SUBROOMS_UNSUPPORTED: '该会议包含子房间，暂请使用网页加入。',
      SPACE_NOT_FOUND: '没有找到这个 Space，请检查名称。',
      GUEST_DENIED: '该会议不允许访客加入。',
      SESSION_REQUIRED: '访客会话已失效，请重试。',
      RTC_NOT_CONNECTED: '会议连接尚未就绪，请重试。',
      JOIN_NO_LONGER_ALLOWED: '会议权限已变化，请重新加入。',
      JOIN_EXPIRED: '本次加入已超时，请重试。',
    };
    if (messages[error.code]) return messages[error.code];
  }
  return '连接未完成，请检查网络后重试。';
}
function MeetingVideo() {
  const tracks = useTracks([Track.Source.Camera, Track.Source.ScreenShare]);
  return (
    <View style={styles.videos}>
      {tracks.filter(isTrackReference).map((track) => (
        <View key={`${track.participant.identity}:${track.publication.trackSid}`} style={ui.card}>
          <VideoTrack trackRef={track} style={styles.video} />
          <Text style={ui.body}>{track.participant.name || '参与者'}</Text>
        </View>
      ))}
      {!tracks.length && (
        <Text style={ui.body}>已加入会议，正在等待对方的视频或屏幕共享。音频会正常播放。</Text>
      )}
    </View>
  );
}
export function MeetingsScreen({ model, nickname }: { model: Model; nickname: string }) {
  const [spaceName, setSpaceName] = useState('');
  const { state } = model;
  const busy = state.phase === 'joining' || state.phase === 'leaving';
  const connected = state.phase === 'joined' && state.room;
  return (
    <ScrollView contentContainerStyle={ui.page} keyboardShouldPersistTaps="handled">
      <Text style={ui.eyebrow}>MEETINGS</Text>
      <Text style={ui.title}>{connected ? state.spaceName : '加入会议'}</Text>
      {connected ? (
        <>
          <Text style={ui.body}>观众模式 · 麦克风与摄像头已关闭</Text>
          <RoomContext.Provider value={connected.raw}>
            <MeetingVideo />
          </RoomContext.Provider>
        </>
      ) : (
        <View style={ui.card}>
          <Text style={ui.subtitle}>通过 Space 名称加入</Text>
          <Text style={ui.body}>
            以「{nickname || '访客'}」进入已开放手机端的会议。公开会议发现将在后续开放。
          </Text>
          <Input
            accessibilityLabel="Space 名称"
            placeholder="输入 Space 名称"
            placeholderTextColor={colors.muted}
            value={spaceName}
            onChangeText={setSpaceName}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!busy && !model.hasPendingCleanup}
            maxLength={200}
          />
          {!model.configured && <Text style={ui.body}>当前应用尚未配置会议服务。</Text>}
        </View>
      )}
      {state.error != null && (
        <Text accessibilityRole="alert" style={ui.body}>
          {failure(state.error)}
        </Text>
      )}
      {busy && (
        <ActivityIndicator
          color={colors.accent}
          accessibilityLabel={state.phase === 'leaving' ? '正在退出' : '正在加入'}
        />
      )}
      {model.hasPendingCleanup || connected ? (
        <PrimaryButton
          accessibilityRole="button"
          onPress={() => {
            void model.leave();
          }}
        >
          {state.phase === 'joining'
            ? '取消加入'
            : state.phase === 'error'
              ? '重试退出'
              : '退出会议'}
        </PrimaryButton>
      ) : (
        <PrimaryButton
          accessibilityRole="button"
          disabled={!model.configured || !spaceName.trim()}
          onPress={() => {
            void model.join(spaceName.trim(), nickname.trim() || '访客');
          }}
        >
          以观众身份加入
        </PrimaryButton>
      )}
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  videos: { gap: 16 },
  video: { width: '100%', aspectRatio: 4 / 3, borderRadius: 16 },
});
