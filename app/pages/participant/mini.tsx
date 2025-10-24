import {
  AudioTrack,
  isTrackReference,
  LockLockedIcon,
  ParticipantName,
  ParticipantPlaceholder,
  ParticipantTile,
  ParticipantTileProps,
  ScreenShareIcon,
  TrackMutedIndicator,
  useEnsureTrackRef,
  useFeatureContext,
  useIsEncrypted,
  useLocalParticipant,
  useMaybeLayoutContext,
  useTrackMutedIndicator,
  VideoTrack,
} from '@livekit/components-react';
import { ConnectionState, Participant, Room, Track } from 'livekit-client';
import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { isTrackReferencePinned } from './tile';
import {
  AppKey,
  castCountdown,
  castTimer,
  castTodo,
  ChildRoom,
  ParticipantSettings,
  SpaceInfo,
} from '@/lib/std/space';
import { useVideoBlur, WsBase, WsSender, WsWave } from '@/lib/std/device';
import { useRecoilState } from 'recoil';
import { SingleAppDataState, socket } from '@/app/[spaceName]/PageClientImpl';
import { UserStatus } from '@/lib/std';
import { ControlRKeyMenu, useControlRKeyMenu, UseControlRKeyMenuProps } from './menu';
import { StatusInfo, useStatusInfo } from './status_info';
import { useI18n } from '@/lib/i18n/i18n';
import { AppFlotIconCollect } from '../apps/app_pin';
import { TileActionCollect } from '../controls/widgets/tile_action_pin';
import { Tooltip } from 'antd';

export interface ParticipantTileMiniProps extends ParticipantTileProps {
  settings: SpaceInfo;
  /**
   * host room name
   */
  space: Room;
  updateSettings: (newSettings: Partial<ParticipantSettings>) => Promise<boolean | undefined>;
  toRenameSettings: () => void;
  setUserStatus: (status: UserStatus | string) => Promise<void>;
  showSingleFlotApp: (appKey: AppKey) => void;
}

export const ParticipantTileMini = forwardRef<HTMLDivElement, ParticipantTileMiniProps>(
  (
    {
      trackRef,
      settings,
      space,
      updateSettings,
      toRenameSettings,
      setUserStatus,
      showSingleFlotApp,
    }: ParticipantTileMiniProps,
    ref,
  ) => {
    const { t } = useI18n();
    const trackReference = useEnsureTrackRef(trackRef);
    const { localParticipant } = useLocalParticipant();
    const videoRef = useRef<HTMLVideoElement>(null);
    const [appsData, setAppsData] = useRecoilState(SingleAppDataState);
    const layoutContext = useMaybeLayoutContext();
    const autoManageSubscription = useFeatureContext()?.autoSubscription;
    const isEncrypted = useIsEncrypted(trackReference.participant);
    // const [isKeepRaise, setIsKeepRaise] = useState<boolean>(false);

    const { blurValue, setVideoBlur } = useVideoBlur({
      videoRef,
      initialBlur: 0.0,
    });

    const setIsKeepRaise = async (raise: boolean) => {
      await updateSettings({
        raiseHand: raise,
      });
      socket.emit('update_user_status', {
        space: space.name,
      } as WsBase);
    };

    useEffect(() => {
      if (settings.participants && Object.keys(settings.participants).length > 0) {
        if (trackReference.source === Track.Source.Camera) {
          setVideoBlur(settings.participants[trackReference.participant.identity]?.blur ?? 0.0);
        } else {
          setVideoBlur(
            settings.participants[trackReference.participant.identity]?.screenBlur ?? 0.0,
          );
        }
        // setLoading(false);
      }
    }, [settings.participants, trackReference]);

    const currentParticipant: ParticipantSettings | undefined = useMemo(() => {
      return settings.participants[trackReference.participant.identity];
    }, [settings.participants, trackReference.participant.identity]);

    const wsWave = useMemo(() => {
      return {
        space: space.name,
        senderName: localParticipant.name,
        senderId: localParticipant.identity,
        receiverId: trackReference.participant.identity,
        socketId: settings.participants[trackReference.participant.identity]?.socketId,
      } as WsWave;
    }, [space, localParticipant, trackReference, settings.participants]);

    const videoFilter = useMemo(() => {
      return settings.participants[trackReference.participant.identity]?.virtual?.enabled ?? false
        ? `none`
        : `blur(${blurValue}px)`;
    }, [settings.participants, trackReference.participant.identity, blurValue]);

    const handleSubscribe = useCallback(
      (subscribed: boolean) => {
        if (
          trackReference.source &&
          !subscribed &&
          layoutContext &&
          layoutContext.pin.dispatch &&
          isTrackReferencePinned(trackReference, layoutContext.pin.state)
        ) {
          layoutContext.pin.dispatch({ msg: 'clear_pin' });
        }
      },
      [trackReference, layoutContext],
    );

    // 右键菜单 --------------------------------------------------------------------------------
    const [selectedParticipant, setSelectedParticipant] = useState<Participant | null>(null);
    const [username, setUsername] = useState<string>('');
    const { optItems, handleOptClick, optOpen, optSelfItems, handleSelfOptClick } =
      useControlRKeyMenu({
        space,
        spaceInfo: settings,
        selectedParticipant,
        setSelectedParticipant,
        setUsername,
        updateSettings,
        toRenameSettings,
        isSelf: trackReference.participant.identity === localParticipant.identity,
      } as UseControlRKeyMenuProps);

    // 右键菜单可以使用：当不是自己的时候且source不是屏幕分享
    const showSelfControlMenu = useMemo(() => {
      return (
        trackReference.participant.identity === localParticipant.identity &&
        trackReference.source !== Track.Source.ScreenShare
      );
    }, [trackReference, localParticipant.identity]);
    // status标签渲染 -------------------------------------------------------------
    const { items, userStatusDisply, defineStatus } = useStatusInfo({
      username: localParticipant.name || '',
      trackReference,
      t,
      toRenameSettings,
      setUserStatus,
      settings,
    });
    // 构建WaveHand消息 --------------------------------------------------------------
    const buildWsWave = (): WsWave => {
      // 需要判断本地用户和发送的远程用户是否在同一个子房间中，如果不是则需要构建发送本地用户的childRoom/inSpace
      let remoteRoom = settings.children.find((child) => {
        return child.participants.includes(trackReference.participant.identity);
      });
      let selfRoom = settings.children.find((child) => {
        return child.participants.includes(localParticipant.identity);
      });
      let inSpace = false;
      let childRoom: ChildRoom | undefined = undefined;
      if (selfRoom && !remoteRoom) {
        // 本地用户在子房间中，远程用户在主空间中
        childRoom = selfRoom;
      } else if (!selfRoom && remoteRoom) {
        // 本地用户在主空间中，远程用户在子房间中
        inSpace = true;
      } else if (selfRoom && remoteRoom) {
        // 本地用户和远程用户都在子房间中
        if (selfRoom.name !== remoteRoom.name) {
          childRoom = selfRoom;
        }
      }

      return {
        ...wsWave,
        inSpace,
        childRoom,
      };
    };

    const showApp = (appKey: AppKey) => {
      showSingleFlotApp(appKey);
      const targetParticipant = {
        participantId: trackReference.participant.identity,
        participantName: trackReference.participant.name,
        auth: currentParticipant.auth,
      };
      if (appKey === 'timer') {
        const castedTimer = castTimer(currentParticipant.appDatas.timer);
        if (castedTimer) {
          setAppsData({
            ...targetParticipant,
            targetApp: castedTimer,
          });
        }
      } else if (appKey === 'countdown') {
        const castedCountdown = castCountdown(currentParticipant.appDatas.countdown);
        if (castedCountdown) {
          setAppsData({
            ...targetParticipant,
            targetApp: castedCountdown,
          });
        }
      } else if (appKey === 'todo') {
        const castedTodo = castTodo(currentParticipant.appDatas.todo);
        setAppsData({
          ...targetParticipant,
          targetApp: castedTodo || [],
        });
      }
    };

    return (
      <ControlRKeyMenu
        menu={
          showSelfControlMenu
            ? {
                items: optSelfItems,
                onClick: handleSelfOptClick,
              }
            : {
                items: optItems,
                onClick: handleOptClick,
              }
        }
        onOpenChange={(open) => {
          optOpen(open, space.getParticipantByIdentity(trackReference.participant.identity)!);
        }}
        isRKey={true}
        children={
          <ParticipantTile ref={ref} trackRef={trackReference}>
            {isTrackReference(trackReference) &&
            (trackReference.source === Track.Source.Camera ||
              trackReference.source === Track.Source.ScreenShare) ? (
              <VideoTrack
                ref={videoRef}
                style={{
                  WebkitFilter: videoFilter,
                  filter: videoFilter,
                  transition: 'filter 0.2s ease-in-out',
                  zIndex: '11',
                }}
                trackRef={trackReference}
                onSubscriptionStatusChanged={handleSubscribe}
                manageSubscription={autoManageSubscription}
              />
            ) : (
              isTrackReference(trackReference) && (
                <AudioTrack
                  trackRef={trackReference}
                  onSubscriptionStatusChanged={handleSubscribe}
                />
              )
            )}
            <div
              className="lk-participant-placeholder"
              style={{ border: '1px solid #111', zIndex: 110 }}
            >
              <ParticipantPlaceholder />
            </div>
            <div
              className="lk-participant-metadata"
              style={{
                zIndex: 1000,
                width: 'fit-content',
                maxWidth: '44%',
                overflow: 'hidden',
                padding: 4,
                backgroundColor: '#00000080',
                display: 'flex',
                borderRadius: 4,
              }}
            >
              <StatusInfo
                disabled={
                  trackReference.participant.identity != localParticipant.identity ||
                  trackReference.source !== Track.Source.Camera
                }
                items={items}
                children={
                  <Tooltip
                    placement="right"
                    title={
                      trackReference.source === Track.Source.ScreenShare &&
                      `${trackReference.participant.name}'s screen`
                    }
                  >
                    <div
                      className="lk-participant-metadata-item"
                      style={{
                        whiteSpace: 'nowrap',
                        width: 'fit-content',
                        padding: 0,
                        minWidth: 0,
                        maxWidth: '100%',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        backgroundColor: 'transparent',
                        color: '#fff',
                      }}
                    >
                      {trackReference.source === Track.Source.Camera ? (
                        <>
                          {isEncrypted && <LockLockedIcon style={{ marginRight: '0.25rem' }} />}
                          <TrackMutedIndicator
                            trackRef={{
                              participant: trackReference.participant,
                              source: Track.Source.Microphone,
                            }}
                            show={'muted'}
                          ></TrackMutedIndicator>
                          <Tooltip title={trackReference.participant.name} placement="right">
                            <ParticipantName />
                          </Tooltip>
                        </>
                      ) : (
                        <>
                          <ScreenShareIcon style={{ marginRight: '0.25rem' }} />
                          <ParticipantName>&apos;s screen</ParticipantName>
                        </>
                      )}
                    </div>
                  </Tooltip>
                }
              ></StatusInfo>
            </div>
            <div
              className="lk-participant-metadata"
              style={{
                zIndex: 111,
                right: 4,
                left: 'unset',
                width: 'fit-content',
                maxWidth: '48%',
              }}
            >
              {space.state !== ConnectionState.Connecting && userStatusDisply.tag}
            </div>

            <TileActionCollect
              wsWave={buildWsWave()}
              spaceInfo={settings}
              participantId={trackReference.participant.identity}
              localParticipant={localParticipant}
              contextUndefined={false}
              setIsKeepRaise={setIsKeepRaise}
            />

            {trackReference.source !== Track.Source.ScreenShare && (
              <AppFlotIconCollect
                style={{
                  right: '0px',
                  backgroundColor: 'transparent',
                  padding: 0,
                  zIndex: 111,
                  height: 'fit-content',
                  width: 'fit-content',
                  fontSize: 16,
                }}
                contextUndefined={false}
                showApp={showApp}
                participant={currentParticipant}
              ></AppFlotIconCollect>
            )}
          </ParticipantTile>
        }
      />
    );
  },
);
