import { TileWidgets } from './TileWidgets';
import { MeetingAvo } from '../ui/MeetingAvo';
import { ParticipantApps } from './ParticipantApps';
import { useEffect, useState } from 'react';
import Drawer from '@ant-design/react-native/lib/drawer';
import { ChannelDrawer } from './ChannelDrawer';
import { RoomNavigation } from './RoomNavigation';
import { Modal, Text, View } from 'react-native';
import { VideoTrack, isTrackReference } from '@livekit/react-native';
import { Track } from 'livekit-client';
import { PhoneMeeting, MeetingControls, MeetingMembers, MeetingMenu } from '@vocespace/ui';
import {
  MeetingButton as Button,
  MeetingIcon as Icon,
  MeetingSettingsInput as Input,
} from '../ui/meeting';
import { SharedConferenceChat } from '../chat/SharedConferenceChat';
import { ui } from '../theme';
import { useSharedMeetingRoom } from './useSharedMeetingRoom';
import { RoomSettings } from './RoomSettings';
import { mediaFailure } from './mediaFailure';
import type { useConference } from './useConference';
import type { NativeRoom } from './room';
export function SharedMeetingRoom({
  conference,
  room,
  onBrowse,
}: {
  conference: ReturnType<typeof useConference>;
  room: NativeRoom;
  onBrowse?: (direction: number) => Promise<void>;
}) {
  const model = useSharedMeetingRoom(conference, room);
  const [focused, setFocused] = useState(false);
  const [fullscreen, setFullscreen] = useState<string>();
  const [appsId, setAppsId] = useState<string>();
  const ownAvoList = model.settings.snapshot?.avoList;
  const avatar = (item: (typeof model.tiles)[number]) =>
    item.local && ownAvoList?.length
      ? (ownAvoList.find((avo) => avo.isUsed) ?? ownAvoList[0])
      : item.avo;
  const fullscreenTile = model.tiles.find((item) => item.id === fullscreen);
  useEffect(() => {
    if (fullscreen && !fullscreenTile) setFullscreen(undefined);
  }, [fullscreen, !!fullscreenTile]);
  const video = (id: string) => {
    const track = model.allTracks.find((item) => model.key(item) === id);
    return track && isTrackReference(track) ? (
      <VideoTrack
        trackRef={track}
        style={{ width: '100%', height: '100%' }}
        objectFit={track.source === Track.Source.ScreenShare ? 'contain' : 'cover'}
      />
    ) : null;
  };
  return (
    <RoomNavigation
      conference={conference}
      directory={model.directory}
      enabled={model.panel === 'stage' && !focused && !fullscreen}
      onBrowse={onBrowse}
    >
      {({ move, busy }) => (
        <Drawer
          open={model.panel === 'channel'}
          drawerLockMode="locked-closed"
          onOpenChange={(open) => {
            if (!open && model.panel === 'channel') model.open('stage');
          }}
          drawerBackgroundColor="#1e1e1e"
          sidebar={
            <View style={{ flex: 1 }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: 12,
                }}
              >
                <Text style={ui.subtitle}>{conference.state.spaceName}</Text>
                <Button
                  appearance="icon"
                  label={model.settings.t('common.close')}
                  onPress={() => model.open('stage')}
                >
                  <Icon name="close" />
                </Button>
              </View>
              <ChannelDrawer
                directory={model.directory}
                space={conference.state.spaceName || room.raw.name}
                busy={busy}
                onJoin={async (name) => {
                  model.open('stage');
                  await move(name);
                }}
              />
            </View>
          }
        >
          <PhoneMeeting
            leadingAction={{
              id: 'channel',
              icon: 'menu',
              label: model.settings.t('more.channel'),
              onPress: () => model.open('channel'),
            }}
            onFocusedChange={setFocused}
            avoidKeyboard={false}
            name={conference.state.spaceName || room.raw.name}
            connected={model.connected}
            status={model.connected ? `${model.participants.length} 在线` : '正在重新连接'}
            labels={{
              previous: '上一页',
              next: '下一页',
              focus: '放大',
              unfocus: '取消固定',
              cameraOff: '摄像头关闭',
              empty: '等待参与者',
              chat: '会议聊天',
              close: '关闭',
            }}
            Button={Button}
            Icon={Icon}
            tiles={model.tiles}
            renderAvatar={(item) => (
              <MeetingAvo
                avo={avatar(item)}
                level={item.speaking ? 0.65 : 0}
                animate={model.panel === 'stage' && !fullscreen}
              />
            )}
            renderTileActions={(item, focused, toggle) => {
              const track = model.allTracks.find((track) => model.key(track) === item.id);
              const id = track?.participant.identity;
              const apps = id ? model.directory?.participants?.[id]?.apps : undefined;
              return (
                <TileWidgets
                  focused={focused}
                  onFocus={toggle}
                  onFullscreen={() => setFullscreen(item.id)}
                  onAvo={
                    item.local && !item.screen
                      ? () => {
                          model.settings.select('profile');
                          model.open('settings');
                        }
                      : undefined
                  }
                  onApps={
                    !item.screen && apps && Object.keys(apps).length
                      ? () => {
                          setAppsId(id);
                          model.open('apps');
                        }
                      : undefined
                  }
                />
              );
            }}
            headerActions={[
              {
                id: 'share',
                icon: 'copy',
                label: '分享 Space 名称',
                onPress: () => {
                  void model.share();
                },
              },
              {
                id: 'members',
                icon: 'members',
                label: '会议成员',
                onPress: () => model.open('participants'),
              },
            ]}
            renderVideo={(id) => (id === fullscreen ? null : video(id))}
            chat={{
              open: model.panel === 'chat',
              onClose: () => model.open('stage'),
              content: (
                <SharedConferenceChat
                  model={conference.chat}
                  identity={conference.state.joined!.identity}
                />
              ),
            }}
            panel={{
              variant: model.panel === 'settings' ? 'settings' : undefined,
              open:
                model.panel === 'participants' ||
                model.panel === 'more' ||
                model.panel === 'settings' ||
                model.panel === 'apps',
              title:
                model.panel === 'participants'
                  ? `${model.settings.t('more.participant.manage')} · ${model.members.length}`
                  : model.panel === 'apps'
                    ? model.settings.t('more.app.title')
                    : model.panel === 'settings'
                      ? model.settings.t('settings.title')
                      : '更多',
              onClose: () => model.open('stage'),
              content:
                model.panel === 'apps' ? (
                  <ParticipantApps
                    apps={appsId ? model.directory?.participants?.[appsId]?.apps : undefined}
                  />
                ) : model.panel === 'settings' ? (
                  <RoomSettings model={model.settings} />
                ) : model.panel === 'participants' ? (
                  <MeetingMembers
                    Button={Button}
                    Icon={Icon}
                    Input={Input}
                    searchLabel={model.settings.t('more.participant.search')}
                    hostLabel={model.settings.t('more.participant.host')}
                    managerLabel={model.settings.t('more.participant.manager')}
                    inviteLabel={model.settings.t('channel.menu.share')}
                    onInvite={() => {
                      void model.share();
                    }}
                    members={model.members}
                  />
                ) : (
                  <MeetingMenu Button={Button} Icon={Icon} actions={model.menu} />
                ),
            }}
            notice={
              <>
                {model.notice ? <Text style={ui.body}>{model.notice}</Text> : null}
                {model.shareError ? <Text style={ui.body}>{model.shareError}</Text> : null}
                {model.invitations.map((item) => (
                  <View key={item.id} style={ui.card}>
                    <Text style={ui.body}>
                      {item.senderName} 邀请你开启
                      {item.device === 'microphone'
                        ? '麦克风'
                        : item.device === 'camera'
                          ? '摄像头'
                          : '屏幕共享'}
                    </Text>
                    <Button
                      disabled={!model.connected || !!model.media.busy}
                      onPress={() => {
                        void model.accept(item.device);
                      }}
                    >
                      接受并开启设备
                    </Button>
                  </View>
                ))}
                {model.media.error != null && (
                  <Text accessibilityRole="alert" style={ui.body}>
                    {mediaFailure(model.media.error)}
                  </Text>
                )}
              </>
            }
            controls={<MeetingControls Button={Button} Icon={Icon} actions={model.actions} />}
          />
          <Modal
            visible={!!fullscreenTile}
            animationType="fade"
            onRequestClose={() => setFullscreen(undefined)}
            supportedOrientations={['portrait', 'landscape']}
          >
            <View style={{ flex: 1, backgroundColor: '#111', paddingTop: 48, paddingBottom: 24 }}>
              <View style={{ alignItems: 'flex-end', padding: 12 }}>
                <Button
                  appearance="icon"
                  label={model.settings.t('common.close')}
                  onPress={() => setFullscreen(undefined)}
                >
                  <Icon name="fullscreenExit" />
                </Button>
              </View>
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                {fullscreenTile &&
                  (fullscreenTile.video ? (
                    video(fullscreenTile.id)
                  ) : (
                    <MeetingAvo
                      avo={avatar(fullscreenTile)}
                      level={fullscreenTile.speaking ? 0.65 : 0}
                    />
                  ))}
              </View>
            </View>
          </Modal>
        </Drawer>
      )}
    </RoomNavigation>
  );
}
