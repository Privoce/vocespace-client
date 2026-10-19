'use client';
import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { isTrackReference, VideoTrack } from '@livekit/components-react';
import { Track } from 'livekit-client';
import {
  PhoneMeeting,
  MeetingMembers,
  MeetingShare,
  MeetingDock,
  MeetingTileActions,
} from '@vocespace/ui';
import {
  MeetingButton as Button,
  MeetingIcon as Icon,
  MeetingSettingsInput as Input,
} from '@/components/MeetingUI/primitives';
import { PhoneSheet } from '@/components/MeetingUI/PhoneSheet';
import { SharedChat } from '@/components/MeetingUI/SharedChat';
import { useSharedMeeting } from './useSharedMeeting';
import type { ConferenceModel } from './mediaStage';
import { renderConferenceEntity } from './entity';

export default function SharedMeeting({
  model,
  controls,
}: {
  model: ConferenceModel;
  controls: ReactNode;
}) {
  const { membersOpen, setMembersOpen, chat, tracks, key, t, tiles } = useSharedMeeting(model);
  const [fullscreen, setFullscreen] = useState<string>();
  useEffect(() => {
    if (fullscreen && !tiles.some((item) => item.id === fullscreen)) setFullscreen(undefined);
  }, [fullscreen, tiles]);
  const [shareOpen, setShareOpen] = useState(false);
  return (
    <PhoneMeeting
      renderSheet={(props) => <PhoneSheet {...props}>{props.content}</PhoneSheet>}
      fullscreenTileId={fullscreen}
      name={model.space?.name || ''}
      status={`${model.onlineCount} ${t('channel.menu.active')}`}
      labels={{
        previous: t('shared_meeting.previous'),
        next: t('shared_meeting.next'),
        focus: t('shared_meeting.focus'),
        unfocus: t('shared_meeting.unfocus'),
        cameraOff: t('shared_meeting.camera_off'),
        empty: t('shared_meeting.empty'),
        chat: t('phone_meeting.chat'),
        close: t('common.close'),
      }}
      Button={Button}
      Icon={Icon}
      tiles={tiles}
      renderTileActions={(item, focused, toggle) => {
        const participant = tracks.find((track) => key(track) === item.id)?.participant;
        const settings = participant && model.settings.participants[participant.identity];
        return (
          <MeetingTileActions
            Button={Button}
            Icon={Icon}
            actions={[
              {
                id: 'focus',
                icon: focused ? 'unfocus' : 'focus',
                label: t(focused ? 'shared_meeting.unfocus' : 'shared_meeting.focus'),
                onPress: () => {
                  setFullscreen(undefined);
                  toggle();
                },
              },
              {
                id: 'fullscreen',
                icon: fullscreen === item.id ? 'fullscreenExit' : 'fullscreen',
                label: t(
                  fullscreen === item.id ? 'phone_meeting.exit_fullscreen' : 'common.full_screen',
                ),
                onPress: () => setFullscreen(fullscreen === item.id ? undefined : item.id),
              },
              ...(!item.screen && participant && settings?.sync?.length
                ? [
                    {
                      id: 'apps',
                      icon: 'app' as const,
                      label: t('more.app.title'),
                      onPress: () => {
                        setFullscreen(undefined);
                        model.showFlotApp(participant.identity, participant.name, settings.appAuth);
                      },
                    },
                  ]
                : []),
            ]}
          />
        );
      }}
      leadingAction={
        model.showSideChannel
          ? {
              id: 'channel',
              icon: 'menu',
              label: t('more.channel'),
              onPress: model.toggleChannel,
            }
          : undefined
      }
      headerActions={[
        {
          id: 'copy',
          icon: 'copy',
          label: t('recording.copy.title'),
          onPress: () => setShareOpen(true),
        },
        {
          id: 'members',
          icon: 'members',
          label: t('more.participant.title'),
          onPress: () => setMembersOpen(true),
        },
      ]}
      focusedExtraTile={
        model.focusedTilePlayerId ? `tile-player:${model.focusedTilePlayerId}` : undefined
      }
      onFocusTrack={() => model.layoutContext.pin.dispatch?.({ msg: 'clear_pin' })}
      extraTiles={model.tilePlayerEntities.map((entity) => ({
        id: entity.id,
        content: renderConferenceEntity(model, entity, {
          isFocus: entity.id === `tile-player:${model.focusedTilePlayerId}`,
        }),
      }))}
      renderVideo={(id) => {
        const track = tracks.find((item) => key(item) === id);
        return track && isTrackReference(track) ? (
          <VideoTrack
            trackRef={track}
            style={{
              width: '100%',
              height: '100%',
              objectFit: track.source === Track.Source.ScreenShare ? 'contain' : 'cover',
            }}
          />
        ) : null;
      }}
      dock={
        <MeetingDock
          Button={Button}
          Icon={Icon}
          chatLabel={t('common.chat')}
          membersLabel={t('phone_meeting.members')}
          expandLabel={t('common.full_screen')}
          count={tiles.filter((tile) => !tile.screen).length}
          unread={chat.chatMsg.msgs.length}
          onExpand={(tab) => {
            if (tab === 'chat') model.setChatOpen(true);
            else setMembersOpen(true);
          }}
          chat={<SharedChat compact model={chat} />}
          members={
            <MeetingMembers
              compact
              Button={Button}
              Icon={Icon}
              members={tiles.filter((tile) => !tile.screen)}
              hostLabel={t('more.participant.host')}
              selfLabel={t('phone_meeting.self')}
              speakingLabel={t('phone_meeting.speaking')}
              onlineLabel={t('phone_meeting.online')}
            />
          }
        />
      }
      controls={controls}
      chat={{
        open: model.chatOpen,
        onClose: () => model.setChatOpen(false),
        content: <SharedChat model={chat} roomName={model.space?.name} />,
      }}
      panel={{
        open: membersOpen || shareOpen,
        height: shareOpen
          ? '76%'
          : tiles.filter((tile) => !tile.screen).length <= 4
            ? '62%'
            : '88%',
        subtitle: !shareOpen
          ? t('phone_meeting.members_count').replace(
              '$count',
              String(tiles.filter((tile) => !tile.screen).length),
            )
          : undefined,
        title: t(shareOpen ? 'phone_meeting.share' : 'phone_meeting.members'),
        onClose: () => {
          setMembersOpen(false);
          setShareOpen(false);
        },
        content: shareOpen ? (
          <MeetingShare
            Button={Button}
            Icon={Icon}
            name={model.space?.name || ''}
            title={t('phone_meeting.share_title')}
            description={t('phone_meeting.share_description')}
            copyLabel={t('phone_meeting.copy')}
            onCopy={model.copyRoomName}
          />
        ) : (
          <MeetingMembers
            Button={Button}
            Icon={Icon}
            Input={Input}
            searchLabel={t('more.participant.search')}
            hostLabel={t('more.participant.host')}
            managerLabel={t('more.participant.manager')}
            inviteLabel={t('phone_meeting.invite')}
            selfLabel={t('phone_meeting.self')}
            speakingLabel={t('phone_meeting.speaking')}
            onlineLabel={t('phone_meeting.online')}
            onInvite={() => {
              setMembersOpen(false);
              setShareOpen(true);
            }}
            members={tiles.filter((tile) => !tile.screen)}
          />
        ),
      }}
    />
  );
}
