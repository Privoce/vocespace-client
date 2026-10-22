import { FeedbackDialog } from '../feedback/FeedbackDialog';
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
import {
  PhoneMeeting,
  MeetingControls,
  MeetingMembers,
  MeetingMenu,
  MeetingShare,
  MeetingDock,
  MeetingRaisedHand,
} from '@vocespace/ui';
import {
  MeetingButton as Button,
  MeetingIcon as Icon,
  MeetingSettingsInput as Input,
} from '../ui/meeting';
import { SharedConferenceChat } from '../chat/SharedConferenceChat';
import { ui } from '../theme';
import { useSharedMeetingRoom } from './hooks/useSharedMeetingRoom';
import { RoomSettings } from './RoomSettings';
import { mediaFailure } from './mediaFailure';
import type { useConference } from './hooks/useConference';
import type { NativeRoom } from './room';
export function SharedMeetingRoom({
  conference,
  accountEmail,
  room,
  onBrowse,
}: {
  conference: ReturnType<typeof useConference>;
  room: NativeRoom;
  accountEmail?: string;
  onBrowse?: (direction: number) => Promise<void>;
}) {
  const model = useSharedMeetingRoom(conference, room);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const [fullscreen, setFullscreen] = useState<string>();
  const [appsId, setAppsId] = useState<string>();
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
      allowRoomSwipe={false}
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
                active={model.panel === 'channel'}
                renderMedia={(id) => {
                  const track = model.channelTracks.find(
                    (item) =>
                      item.participant.identity === id && item.source === Track.Source.Camera,
                  );
                  return track &&
                    isTrackReference(track) &&
                    track.publication.track &&
                    !track.publication.isMuted ? (
                    <VideoTrack
                      trackRef={track}
                      style={{ width: '100%', height: '100%' }}
                      objectFit="cover"
                    />
                  ) : null;
                }}
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
          <FeedbackDialog
            open={feedbackOpen}
            accountEmail={accountEmail}
            room={room}
            onClose={() => setFeedbackOpen(false)}
          />
          <PhoneMeeting
            handLabel={model.t('more.app.raise.title')}
            lowerHandLabel={model.t('more.app.raise.cancel')}
            onLowerHand={
              model.raising
                ? undefined
                : () => {
                    void model.raise();
                  }
            }
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
              grid: model.t('phone_meeting.grid'),
              focusLayout: model.t('phone_meeting.focus_layout'),
              page: model.t('phone_meeting.page'),
              previous: '上一页',
              next: '下一页',
              focus: model.t('phone_meeting.focus_layout'),
              unfocus: model.t('phone_meeting.grid'),
              cameraOff: '摄像头关闭',
              empty: '等待参与者',
              chat: '会议聊天',
              close: '关闭',
            }}
            Button={Button}
            Icon={Icon}
            tiles={model.tiles}
            renderAvatar={(item, compact) => (
              <View
                style={
                  compact
                    ? { width: 34, height: 34 }
                    : {
                        width: '100%',
                        height: '100%',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }
                }
              >
                <MeetingAvo
                  interactive
                  avo={item.screen ? undefined : item.avo}
                  level={
                    model.allTracks.find((track) => model.key(track) === item.id)?.participant
                      .audioLevel
                  }
                  animate={!fullscreen}
                />
              </View>
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
                  model.open('share');
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
                  roomName={conference.state.spaceName || room.raw.name}
                  model={conference.chat}
                  identity={conference.state.joined!.identity}
                />
              ),
            }}
            panel={{
              backLabel: model.t('common.back'),
              variant: model.panel === 'settings' ? 'settings' : undefined,
              open:
                model.panel === 'participants' ||
                model.panel === 'more' ||
                model.panel === 'settings' ||
                model.panel === 'apps' ||
                model.panel === 'share',
              height:
                model.panel === 'more' || model.panel === 'share'
                  ? '76%'
                  : model.panel === 'participants' && model.members.length <= 4
                    ? '62%'
                    : '88%',
              subtitle:
                model.panel === 'more'
                  ? model.t('phone_meeting.more_subtitle')
                  : model.panel === 'participants'
                    ? model
                        .t('phone_meeting.members_count')
                        .replace('$count', String(model.members.length))
                    : undefined,
              onBack:
                model.panel === 'settings' && model.settings.selected
                  ? () => model.settings.select(undefined)
                  : undefined,
              title:
                model.panel === 'share'
                  ? model.t('phone_meeting.share')
                  : model.panel === 'participants'
                    ? model.t('phone_meeting.members')
                    : model.panel === 'apps'
                      ? model.settings.t('more.app.title')
                      : model.panel === 'settings'
                        ? model.settings.panels.find((p) => p.id === model.settings.selected)
                            ?.label || model.settings.t('settings.title')
                        : model.t('phone_meeting.more_title'),
              onClose: () => model.open('stage'),
              content:
                model.panel === 'share' ? (
                  <MeetingShare
                    Button={Button}
                    Icon={Icon}
                    name={conference.state.spaceName || room.raw.name}
                    title={model.t('phone_meeting.share_title')}
                    description={model.t('phone_meeting.share_description')}
                    copyLabel={model.t('phone_meeting.copy')}
                    onCopy={() => {
                      void model.share();
                    }}
                    extra={model.shareError && <Text style={ui.body}>{model.shareError}</Text>}
                  />
                ) : model.panel === 'apps' ? (
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
                    inviteLabel={model.t('phone_meeting.invite')}
                    onInvite={() => {
                      model.open('share');
                    }}
                    selfLabel={model.t('phone_meeting.self')}
                    speakingLabel={model.t('phone_meeting.speaking')}
                    onlineLabel={model.t('phone_meeting.online')}
                    members={model.members}
                  />
                ) : (
                  <MeetingMenu
                    Button={Button}
                    Icon={Icon}
                    actions={[
                      ...model.menu,
                      {
                        id: 'feedback',
                        icon: 'chat',
                        label: model.t('channel.feedback.title'),
                        onPress: () => {
                          model.open('stage');
                          setFeedbackOpen(true);
                        },
                      },
                    ]}
                    footer={model.t('phone_meeting.media_hint')}
                  />
                ),
            }}
            notice={
              <>
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
            dock={
              <MeetingDock
                Button={Button}
                Icon={Icon}
                chatLabel={model.t('common.chat')}
                membersLabel={model.t('phone_meeting.members')}
                expandLabel={model.t('common.full_screen')}
                count={model.members.length}
                unread={conference.chat.state.messages.length}
                onExpand={(tab) => model.open(tab === 'chat' ? 'chat' : 'participants')}
                chat={
                  <SharedConferenceChat
                    compact
                    model={conference.chat}
                    identity={conference.state.joined!.identity}
                  />
                }
                members={
                  <MeetingMembers
                    compact
                    Button={Button}
                    Icon={Icon}
                    members={model.members}
                    hostLabel={model.t('more.participant.host')}
                    selfLabel={model.t('phone_meeting.self')}
                    speakingLabel={model.t('phone_meeting.speaking')}
                    onlineLabel={model.t('phone_meeting.online')}
                  />
                }
              />
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
                      interactive
                      avo={fullscreenTile.screen ? undefined : fullscreenTile.avo}
                      level={
                        model.allTracks.find((track) => model.key(track) === fullscreenTile.id)
                          ?.participant.audioLevel
                      }
                    />
                  ))}
                <MeetingRaisedHand
                  raised={fullscreenTile?.raiseHand}
                  label={model.t(
                    fullscreenTile?.local ? 'more.app.raise.cancel' : 'more.app.raise.title',
                  )}
                  Icon={Icon}
                  disabled={model.raising}
                  onLower={
                    fullscreenTile?.local
                      ? () => {
                          void model.raise();
                        }
                      : undefined
                  }
                />
              </View>
            </View>
          </Modal>
        </Drawer>
      )}
    </RoomNavigation>
  );
}
