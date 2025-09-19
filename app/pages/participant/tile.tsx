import { isTrackReferencePlaceholder } from '@/app/pages/controls/video_container';
import { MouseMove, useVideoBlur, WsMouseMove, WsTo } from '@/lib/std/device';
import {
  AudioTrack,
  ConnectionQualityIndicator,
  isTrackReference,
  LockLockedIcon,
  ParticipantName,
  ParticipantPlaceholder,
  ParticipantTile,
  PinState,
  ScreenShareIcon,
  TrackMutedIndicator,
  TrackReferenceOrPlaceholder,
  useEnsureTrackRef,
  useFeatureContext,
  useIsEncrypted,
  useLocalParticipant,
  useMaybeLayoutContext,
  VideoTrack,
} from '@livekit/components-react';
import { Participant, Track } from 'livekit-client';
import React, { useEffect, useMemo, useState } from 'react';
import VirtualRoleCanvas from '../virtual_role/live2d';
import { useRecoilState } from 'recoil';
import {
  SingleAppDataState,
  socket,
  userState,
  virtualMaskState,
} from '@/app/[spaceName]/PageClientImpl';
import styles from '@/styles/controls.module.scss';
import { SvgResource, SvgType } from '@/app/resources/svg';
import { useI18n } from '@/lib/i18n/i18n';
import { randomColor } from '@/lib/std';
import { MessageInstance } from 'antd/es/message/interface';
import { AppKey, castCountdown, castTimer, castTodo, ChildRoom, ParticipantSettings } from '@/lib/std/space';
import { WaveHand } from '../controls/widgets/wave';
import { StatusInfo, useStatusInfo } from './status_info';
import { ControlRKeyMenu, useControlRKeyMenu, UseControlRKeyMenuProps } from './menu';
import { AppFlotIconCollect } from '../apps/app_pin';
import { ParticipantTileMiniProps } from './mini';

export interface ParticipantItemProps extends ParticipantTileMiniProps {
  toSettings?: () => void;
  messageApi: MessageInstance;
  isFocus?: boolean;
  selfRoom?: ChildRoom
}

export const ParticipantItem: (
  props: ParticipantItemProps & React.RefAttributes<HTMLDivElement>,
) => React.ReactNode = React.forwardRef<HTMLDivElement, ParticipantItemProps>(
  function ParticipantItem(
    {
      trackRef,
      settings,
      toSettings,
      messageApi,
      setUserStatus,
      isFocus,
      space,
      updateSettings,
      toRenameSettings,
      showSingleFlotApp,
      selfRoom
    }: ParticipantItemProps,
    ref,
  ) {
    const { t } = useI18n();
    const { localParticipant } = useLocalParticipant();
    const videoRef = React.useRef<HTMLVideoElement>(null);
    const [uState, setUState] = useRecoilState(userState);
    // const [uRoomStatusState, setURoomStatusState] = useRecoilState(roomStatusState);
    const [appsData, setAppsData] = useRecoilState(SingleAppDataState);
    const trackReference = useEnsureTrackRef(trackRef);
    const isEncrypted = useIsEncrypted(trackReference.participant);
    const layoutContext = useMaybeLayoutContext();
    const autoManageSubscription = useFeatureContext()?.autoSubscription;
    const isLocal = React.useMemo(() => {
      return localParticipant.identity === trackReference.participant.identity;
    }, [localParticipant, trackReference]);
    const [lastMousePos, setLastMousePos] = React.useState({ x: 0, y: 0 });
    const [virtualReady, setVirtualReady] = React.useState(false);
    const [virtualMask, setVirtualMask] = useRecoilState(virtualMaskState);
    const [remoteMask, setRemoteMask] = React.useState(false);
    const [deleyMask, setDelayMask] = React.useState(virtualMask);

    useEffect(() => {
      socket.on(
        'reload_virtual_response',
        (msg: { identity: string; reloading: boolean; roomId: string }) => {
          console.log('reload_virtual_response', msg);
          if (space.name == msg.roomId) {
            if (msg.identity != localParticipant.identity) {
              setRemoteMask(msg.reloading);
            }
          }
        },
      );

      return () => {
        socket.off('reload_virtual_response');
      };
    }, [space, localParticipant.identity]);

    useEffect(() => {
      if (isLocal) {
        if (virtualMask) {
          setDelayMask(virtualMask);
        } else {
          if (virtualReady) {
            setTimeout(() => {
              setDelayMask(virtualMask);
            }, 1500);
          } else {
            setTimeout(() => {
              setDelayMask(virtualMask);
            }, 1500);
          }
        }
      } else {
        setVirtualReady(false);
        if (remoteMask) {
          setDelayMask(true);
        } else {
          setTimeout(() => {
            setDelayMask(false);
          }, 3500);
        }
      }
    }, [virtualMask, virtualReady, isLocal, remoteMask]);

    useEffect(() => {
      setVirtualReady(false);
    }, [uState.virtual]);

    // 存储所有观众的鼠标位置
    const [remoteCursors, setRemoteCursors] = React.useState<{
      [participantId: string]: MouseMove;
    }>({});
    const { blurValue, setVideoBlur } = useVideoBlur({
      videoRef,
      initialBlur: 0.0,
    });
    const [loading, setLoading] = React.useState(true);
    useEffect(() => {
      if (settings.participants && Object.keys(settings.participants).length > 0) {
        if (trackReference.source === Track.Source.Camera) {
          setVideoBlur(settings.participants[trackReference.participant.identity]?.blur ?? 0.0);
        } else {
          setVideoBlur(
            settings.participants[trackReference.participant.identity]?.screenBlur ?? 0.0,
          );
        }
        setLoading(false);
      }
    }, [settings.participants, trackReference]);

    const handleSubscribe = React.useCallback(
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

    const videoFilter = React.useMemo(() => {
      return settings.participants[trackReference.participant.identity]?.virtual?.enabled ?? false
        ? `none`
        : `blur(${blurValue}px)`;
    }, [settings.participants, trackReference.participant.identity, blurValue]);

    const currentParticipant: ParticipantSettings | undefined = useMemo(() => {
      return settings.participants[trackReference.participant.identity];
    }, [settings.participants, trackReference.participant.identity]);

    const deviceTrack = React.useMemo(() => {
      if (isTrackReference(trackReference) && !loading) {
        if (trackReference.source === Track.Source.Camera) {
          return (
            <div
              style={{
                height: '100%',
                width: '100%',
              }}
            >
              {deleyMask && (
                <div className="lk-participant-placeholder" style={{ opacity: 1, zIndex: 1000 }}>
                  <ParticipantPlaceholder />
                </div>
              )}
              {isLocal && uState.virtual.enabled && !virtualMask && (
                <div
                  className={styles.virtual_video_box_canvas}
                  style={{ visibility: 'hidden', zIndex: '111' }}
                >
                  <VirtualRoleCanvas
                    video_ele={videoRef}
                    model_bg={uState.virtual.bg}
                    model_role={uState.virtual.role}
                    enabled={uState.virtual.enabled}
                    messageApi={messageApi}
                    trackRef={trackReference}
                    isLocal={isLocal}
                    isReplace={true}
                    onReady={() => {
                      setVirtualReady(true);
                    }}
                    onDestroy={() => {
                      setVirtualReady(false);
                    }}
                  ></VirtualRoleCanvas>
                </div>
              )}
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

              {/** 暂停使用WebGL虚化 */}
              {/* {localParticipant.identity === trackReference.participant.identity &&
              uState.virtual.enabled ? (
                <div className={styles.virtual_video_box_canvas} style={{ visibility: 'hidden' }}>
                  <VirtualRoleCanvas
                    video_ele={videoRef}
                    model_bg={uState.virtual.bg}
                    model_role={uState.virtual.role}
                    enabled={uState.virtual.enabled}
                    messageApi={messageApi}
                    trackRef={trackReference}
                    isLocal={trackReference.participant.identity === localParticipant.identity}
                  ></VirtualRoleCanvas>
                </div>
              ) : (
                blurValue > 0 && <BlurVideo blur={blurValue}></BlurVideo>
              )} */}
            </div>
          );
        } else if (trackReference.source === Track.Source.ScreenShare) {
          // 包含远程鼠标位置
          return (
            <div style={{ height: '100%', width: '100%', position: 'relative' }}>
              <VideoTrack
                ref={videoRef}
                style={{
                  filter: `blur(${blurValue}px)`,
                  transition: 'filter 0.2s ease-in-out',
                }}
                trackRef={trackReference}
                onSubscriptionStatusChanged={handleSubscribe}
                manageSubscription={autoManageSubscription}
              />
              {isFocus &&
                Object.entries(remoteCursors).map(([participantId, cursor]) => {
                  // 计算视频元素上的绝对位置
                  if (!videoRef.current) return null;
                  const containerRect = videoRef.current?.getBoundingClientRect();
                  if (!containerRect) return null;

                  // 获取视频元素的实际尺寸
                  const videoElement = videoRef.current;
                  // 视频没有加载完成时，可能没有宽高
                  if (!videoElement.videoWidth || !videoElement.videoHeight) return null;

                  // 计算视频在容器中的实际显示区域
                  const actualVideoRect = {
                    width: 0,
                    height: 0,
                    left: 0,
                    top: 0,
                  };

                  // 计算视频的宽高比
                  const videoRatio = videoElement.videoWidth / videoElement.videoHeight;

                  // 正确计算视频在容器中的实际显示尺寸
                  // 1. 首先尝试使用容器的宽度
                  let computedHeight = containerRect.width / videoRatio;
                  if (computedHeight <= containerRect.height) {
                    // 如果计算出的高度不超过容器高度，则使用容器宽度作为基准
                    actualVideoRect.width = containerRect.width;
                    actualVideoRect.height = computedHeight;
                    actualVideoRect.left = 0;
                    actualVideoRect.top = (containerRect.height - actualVideoRect.height) / 2;
                  } else {
                    // 如果计算出的高度超过容器高度，则使用容器高度作为基准
                    actualVideoRect.height = containerRect.height;
                    actualVideoRect.width = containerRect.height * videoRatio;
                    actualVideoRect.left = (containerRect.width - actualVideoRect.width) / 2;
                    actualVideoRect.top = 0;
                  }

                  // 从归一化坐标计算实际像素坐标
                  const absoluteX = cursor.x * actualVideoRect.width + actualVideoRect.left;
                  const absoluteY = cursor.y * actualVideoRect.height + actualVideoRect.top;
                  // 检查时间戳，如果超过10秒没有更新，则不显示
                  const now = Date.now();
                  if (now - cursor.timestamp > 10000) return null;

                  return (
                    <div
                      key={participantId}
                      className={styles.remote_cursor}
                      style={{
                        position: 'absolute',
                        left: `${absoluteX}px`,
                        top: `${absoluteY}px`,
                        pointerEvents: 'none', // 确保鼠标事件穿透
                        zIndex: 1000,
                        transform: 'translate(3px, 9.5px)', // 使鼠标指针居中
                      }}
                    >
                      {/* 鼠标指针 */}
                      <div className={styles.cursor_icon}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                          <path
                            d="M7 2L18 13H11L7 20V2Z"
                            fill={cursor.color}
                            stroke="white"
                            strokeWidth="1.5"
                          />
                        </svg>
                      </div>

                      {/* 用户名标签 */}
                      <div
                        className={styles.cursor_label}
                        style={{
                          backgroundColor: cursor.color,
                          color: 'white',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: '12px',
                          position: 'absolute',
                          top: '-22px',
                          left: '10px',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {cursor.name}
                      </div>
                    </div>
                  );
                })}
            </div>
          );
        } else {
          return (
            <AudioTrack trackRef={trackReference} onSubscriptionStatusChanged={handleSubscribe} />
          );
        }
      }
    }, [
      trackReference,
      loading,
      blurValue,
      videoRef,
      uState.virtual,
      remoteCursors,
      settings,
      virtualMask,
      remoteMask,
      isLocal,
      deleyMask,
      virtualReady,
      videoFilter,
    ]);

    // [status] ------------------------------------------------------------
    const { items, setStatusLabel, userStatusDisply, defineStatus } = useStatusInfo({
      username: localParticipant.name || '',
      trackReference,
      settings,
      toRenameSettings: toSettings,
      t,
      setUserStatus,
    });
    // 使用ws向服务器发送消息，告诉某个人打招呼
    const wsTo = useMemo(() => {
      return {
        space: space.name,
        senderName: localParticipant.name,
        senderId: localParticipant.identity,
        receiverId: trackReference.participant.identity,
        socketId: settings.participants[trackReference.participant.identity]?.socketId,
      } as WsTo;
    }, [space, localParticipant, trackReference, settings.participants]);

    // 处理当前用户如果是演讲者并且当前track source是screen share，那么就需要获取其他用户的鼠标位置
    useEffect(() => {
      // 如果当前用户是观看者，并且当前的屏幕主视口是screen share，且is_focus为true
      // console.log(isFocus, trackReference.source, localParticipant.isSpeaking);
      if (
        isFocus &&
        trackReference.source === Track.Source.ScreenShare &&
        !localParticipant.isSpeaking
      ) {
        // 此时说明当前参与者正在观看屏幕共享，当这个观看者希望引导演讲者时（鼠标在窗口中移动，点击），需要将鼠标位置发送给演讲者
        const handleMouseMove = (e: MouseEvent) => {
          if (!videoRef.current) return;
          const containerRect = videoRef.current?.getBoundingClientRect();
          const videoElement = videoRef.current;
          const actualVideoRect = {
            width: 0,
            height: 0,
            left: 0,
            top: 0,
          };

          const videoRatio = videoElement.videoWidth / videoElement.videoHeight;
          let computedHeight = containerRect.width / videoRatio;

          if (computedHeight <= containerRect.height) {
            actualVideoRect.width = containerRect.width;
            actualVideoRect.height = computedHeight;
            actualVideoRect.left = 0;
            actualVideoRect.top = (containerRect.height - actualVideoRect.height) / 2;
          } else {
            actualVideoRect.height = containerRect.height;
            actualVideoRect.width = containerRect.height * videoRatio;
            actualVideoRect.left = (containerRect.width - actualVideoRect.width) / 2;
            actualVideoRect.top = 0;
          }

          // 检查鼠标是否在视频显示区域内
          if (
            e.clientX >= containerRect.left + actualVideoRect.left &&
            e.clientX <= containerRect.left + actualVideoRect.left + actualVideoRect.width &&
            e.clientY >= containerRect.top + actualVideoRect.top &&
            e.clientY <= containerRect.top + actualVideoRect.top + actualVideoRect.height
          ) {
            // 计算归一化坐标 (0-1范围内)
            const x =
              (e.clientX - (containerRect.left + actualVideoRect.left)) / actualVideoRect.width;
            const y =
              (e.clientY - (containerRect.top + actualVideoRect.top)) / actualVideoRect.height;

            // 降低变化阈值，提高灵敏度
            if (Math.abs(x - lastMousePos.x) < 0.005 && Math.abs(y - lastMousePos.y) < 0.005) {
              return;
            } else {
              setLastMousePos({ x, y });
            }
            let data = {
              space: space.name,
              x,
              y,
              color: randomColor(localParticipant.identity),
              senderName: localParticipant.name || localParticipant.identity,
              senderId: localParticipant.identity,
              receiverId: trackReference.participant.identity,
              socketId: settings.participants[trackReference.participant.identity]?.socketId,
              realVideoRect: actualVideoRect,
            } as WsMouseMove;

            setRemoteCursors((prev) => ({
              ...prev,
              [data.senderId]: {
                space: data.space,
                x: data.x,
                y: data.y,
                name: data.senderName,
                color: data.color,
                timestamp: Date.now(),
                realVideoRect: data.realVideoRect,
              },
            }));
            socket.emit('mouse_move', data);
          } else {
            // 去除鼠标位置, 在remoteCursors中删除当前用户
            setRemoteCursors((prev) => {
              const newCursors = { ...prev };
              delete newCursors[localParticipant.identity];
              return newCursors;
            });
            // 发送socket, 只需要知道去除者的id
            socket.emit('mouse_remove', {
              space: space.name,
              senderName: localParticipant.name || localParticipant.identity,
              senderId: localParticipant.identity,
              receiverId: trackReference.participant.identity,
              socketId: settings.participants[trackReference.participant.identity]?.socketId,
            } as WsTo);
          }
        };
        // 300ms触发一次, 节流
        const throttledMouseMove = throttle(handleMouseMove, 300);
        document.addEventListener('mousemove', throttledMouseMove);

        return () => {
          // 清除事件监听器
          document.removeEventListener('mousemove', handleMouseMove);
        };
      }

      // 如果当前用户是演讲者并且当前track source是screen share，那么就需要获取其他用户的鼠标位置
      if (localParticipant.isSpeaking && trackReference.source === Track.Source.ScreenShare) {
        socket.on('mouse_move_response', (data: WsMouseMove) => {
          // 获取之后需要将别人的鼠标位置在演讲者的屏幕上进行显示
          const { senderId, senderName, x, y, color, realVideoRect, space: spaceName } = data;
          // 更新状态
          if (space.name == spaceName && selfRoom && selfRoom.participants.includes(data.senderId)) {
            setRemoteCursors((prev) => ({
              ...prev,
              [senderId]: {
                space: spaceName,
                x,
                y,
                name: senderName,
                color,
                timestamp: Date.now(),
                realVideoRect,
              },
            }));
          }
        });
        socket.on('mouse_remove_response', ({ senderId, space: spaceName }: WsTo) => {
          // 删除状态
          if (space.name == spaceName) {
            setRemoteCursors((prev) => {
              const newCursors = { ...prev };
              delete newCursors[senderId];
              return newCursors;
            });
          }
        });
      }

      // return () => {
      //   socket.off('mouse_move_response');
      //   socket.off('mouse_remove_response');
      // };
    }, [trackReference.source, localParticipant.isSpeaking, isFocus]);
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

    const showApp = (appKey: AppKey) => {
      showSingleFlotApp(appKey);
      const targetParticipant = {
        participantId: trackReference.participant.identity,
        participantName: trackReference.participant.name,
        auth: currentParticipant.auth,
      };
      console.warn(targetParticipant);
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
        isRKey={true}
        onOpenChange={(open) => {
          optOpen(open, space.getParticipantByIdentity(trackReference.participant.identity)!);
        }}
        children={
          <ParticipantTile ref={ref} trackRef={trackReference}>
            {deviceTrack}
            <div className="lk-participant-placeholder">
              <ParticipantPlaceholder />
            </div>
            <div className="lk-participant-metadata" style={{ zIndex: 4 }}>
              <StatusInfo
                disabled={trackReference.participant.identity != localParticipant.identity}
                items={items}
                children={
                  <div className="lk-participant-metadata-item">
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
                        <ParticipantName />
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
                        <ParticipantName>&apos;s screen</ParticipantName>
                      </>
                    )}
                  </div>
                }
              ></StatusInfo>

              <ConnectionQualityIndicator className="lk-participant-metadata-item" />
            </div>
            {trackReference.participant.identity != localParticipant.identity && (
              <WaveHand wsWave={{ ...wsTo }} />
            )}
            {trackReference.source !== Track.Source.ScreenShare && (
              <AppFlotIconCollect
                showApp={showApp}
                participant={currentParticipant}
              ></AppFlotIconCollect>
            )}
          </ParticipantTile>
        }
      ></ControlRKeyMenu>
    );
  },
);

export function isTrackReferencePinned(
  trackReference: TrackReferenceOrPlaceholder,
  pinState: PinState | undefined,
): boolean {
  if (typeof pinState === 'undefined') {
    return false;
  }
  if (isTrackReference(trackReference)) {
    return pinState.some(
      (pinnedTrackReference) =>
        pinnedTrackReference.participant.identity === trackReference.participant.identity &&
        isTrackReference(pinnedTrackReference) &&
        pinnedTrackReference.publication.trackSid === trackReference.publication.trackSid,
    );
  } else if (isTrackReferencePlaceholder(trackReference)) {
    return pinState.some(
      (pinnedTrackReference) =>
        pinnedTrackReference.participant.identity === trackReference.participant.identity &&
        isTrackReferencePlaceholder(pinnedTrackReference) &&
        pinnedTrackReference.source === trackReference.source,
    );
  } else {
    return false;
  }
}

// 节流函数 - 限制函数调用频率
function throttle<T extends (...args: any[]) => any>(func: T, limit: number) {
  let lastFunc: ReturnType<typeof setTimeout>;
  let lastRan: number = 0;

  return function (this: any, ...args: Parameters<T>) {
    const context = this;
    const now = Date.now();

    if (now - lastRan >= limit) {
      func.apply(context, args);
      lastRan = now;
    } else {
      clearTimeout(lastFunc);
      lastFunc = setTimeout(() => {
        if (Date.now() - lastRan >= limit) {
          func.apply(context, args);
          lastRan = Date.now();
        }
      }, limit - (now - lastRan));
    }
  };
}
