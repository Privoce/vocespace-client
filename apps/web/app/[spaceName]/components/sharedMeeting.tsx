'use client';
import { ParticipantAvoPlaceholder } from '@/components/Participant/avo';
import { DEFAULT_PARTICIPANT_SETTINGS } from '@/lib/std/space';

import type { ReactNode } from 'react';
import { isTrackReference, VideoTrack } from '@livekit/components-react';
import { Track } from 'livekit-client';
import { PhoneMeeting, MeetingMembers } from '@vocespace/ui';
import {
  MeetingButton as Button,
  MeetingIcon as Icon,
  MeetingSettingsInput as Input,
} from '@/components/MeetingUI/primitives';
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
  return (
    <PhoneMeeting
      name={model.space?.name || ''}
      status={`${model.onlineCount} ${t('channel.menu.active')}`}
      labels={{
        previous: t('shared_meeting.previous'),
        next: t('shared_meeting.next'),
        focus: t('shared_meeting.focus'),
        unfocus: t('shared_meeting.unfocus'),
        cameraOff: t('shared_meeting.camera_off'),
        empty: t('shared_meeting.empty'),
        chat: t('common.chat'),
        close: t('common.close'),
      }}
      Button={Button}
      Icon={Icon}
      tiles={tiles}
      renderAvatar={(item) => {
        const track = tracks.find((track) => key(track) === item.id);
        const list = model.settings.participants[track?.participant.identity || '']?.avoList;
        const effective = list?.length ? list : DEFAULT_PARTICIPANT_SETTINGS.avoList!;
        const avo = effective.find((item) => item.isUsed) ?? effective[0];
        return (
          <ParticipantAvoPlaceholder
            name={item.name}
            avo={avo?.enabled ? avo : undefined}
            participant={track?.participant}
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
        { id: 'copy', icon: 'copy', label: t('recording.copy.title'), onPress: model.copyRoomName },
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
      controls={controls}
      chat={{
        open: model.chatOpen,
        onClose: () => model.setChatOpen(false),
        content: <SharedChat model={chat} />,
      }}
      panel={{
        open: membersOpen,
        title: t('more.participant.title'),
        onClose: () => setMembersOpen(false),
        content: (
          <MeetingMembers
            Button={Button}
            Icon={Icon}
            Input={Input}
            searchLabel={t('more.participant.search')}
            hostLabel={t('more.participant.host')}
            managerLabel={t('more.participant.manager')}
            inviteLabel={t('channel.menu.share')}
            onInvite={model.copyRoomName}
            members={tiles.filter((tile) => !tile.screen)}
          />
        ),
      }}
    />
  );
}
