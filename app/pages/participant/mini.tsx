import {
  AudioTrack,
  ConnectionQualityIndicator,
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
import { Participant, Room, Track } from 'livekit-client';
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
import { useVideoBlur, WsBase, WsTo, WsWave } from '@/lib/std/device';
import { SvgResource, SvgType } from '@/app/resources/svg';
import { useRecoilState } from 'recoil';
import { SingleAppDataState } from '@/app/[spaceName]/PageClientImpl';
import { UserStatus } from '@/lib/std';
import { WaveHand } from '../controls/widgets/wave';
import { ControlRKeyMenu, useControlRKeyMenu, UseControlRKeyMenuProps } from './menu';
import { RaiseHand } from '../controls/widgets/raise';
import { StatusInfo, useStatusInfo } from './status_info';
import { useI18n } from '@/lib/i18n/i18n';
import { AppFlotIconCollect } from '../apps/app_pin';

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

    const { blurValue, setVideoBlur } = useVideoBlur({
      videoRef,
      initialBlur: 0.0,
    });

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

    const wsTo = useMemo(() => {
      return {
        space: space.name,
        senderName: localParticipant.name,
        senderId: localParticipant.identity,
        receiverId: trackReference.participant.identity,
        socketId: settings.participants[trackReference.participant.identity]?.socketId,
      } as WsTo;
    }, [space, localParticipant, trackReference, settings.participants]);

    const wsBase = useMemo(() => {
      return {
        space: space.name,
        senderName: localParticipant.name,
        senderId: localParticipant.identity,
      } as WsBase;
    }, [space, localParticipant]);

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
      } as UseControlRKeyMenuProps);

    // 右键菜单可以使用：当不是自己的时候且source不是屏幕分享
    const showSelfControlMenu = useMemo(() => {
      return (
        trackReference.participant.identity === localParticipant.identity ||
        trackReference.source === Track.Source.ScreenShare
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
      }

      return {
        ...wsTo,
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
            <div className="lk-participant-metadata" style={{ zIndex: 1000 }}>
              <StatusInfo
                disabled={
                  trackReference.participant.identity != localParticipant.identity ||
                  trackReference.source !== Track.Source.Camera
                }
                items={items}
              >
                <div
                  className="lk-participant-metadata-item"
                  style={{ maxWidth: 'calc(100% - 32px)', width: 'max-content' }}
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
                      <ParticipantName
                        style={{
                          maxWidth: `calc(100% - ${
                            useTrackMutedIndicator({
                              participant: trackReference.participant,
                              source: Track.Source.Microphone,
                            }).isMuted
                              ? 2.5
                              : 1.25
                          }rem)`,
                          overflow: 'clip',
                          textWrap: 'nowrap',
                          width: '100%',
                        }}
                      />
                      <div
                        style={{
                          marginLeft: '0.25rem',
                          display: 'inline-flex',
                          alignItems: 'center',
                        }}
                      >
                        {defineStatus ? (
                          <SvgResource
                            type="dot"
                            svgSize={16}
                            color={defineStatus.icon.color}
                          ></SvgResource>
                        ) : (
                          <SvgResource
                            type={userStatusDisply as SvgType}
                            svgSize={16}
                          ></SvgResource>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <ScreenShareIcon style={{ marginRight: '0.25rem' }} />
                      <ParticipantName
                        style={{
                          maxWidth: 'calc(100% - 1.5rem)',
                          overflow: 'clip',
                          textWrap: 'nowrap',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        &apos;s screen
                      </ParticipantName>
                    </>
                  )}
                </div>
              </StatusInfo>
              <ConnectionQualityIndicator className="lk-participant-metadata-item" />
            </div>
            {trackReference.participant.identity != localParticipant.identity && (
              <>
                <WaveHand
                  wsWave={buildWsWave}
                  contextUndefined={false}
                  style={{
                    zIndex: 111,
                    left: '0.25rem',
                    top: '0.25rem',
                    width: 'fit-content',
                  }}
                />
                <RaiseHand wsBase={wsBase}></RaiseHand>
              </>
            )}
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
