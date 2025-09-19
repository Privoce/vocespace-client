import { SvgResource } from '@/app/resources/svg';
import { useI18n } from '@/lib/i18n/i18n';
import { ParticipantSettings, SpaceInfo } from '@/lib/std/space';
import { Dropdown, MenuProps, Modal, Slider } from 'antd';
import { Participant, Room, Track } from 'livekit-client';
import { useMemo, useState } from 'react';
import styles from '@/styles/controls.module.scss';
import { ControlType, WsBase, WsControlParticipant, WsInviteDevice, WsTo } from '@/lib/std/device';
import { socket } from '@/app/[spaceName]/PageClientImpl';
import { src } from '@/lib/std';

export interface ControlRKeyMenuProps {
  disabled?: boolean;
  children: React.ReactNode;
  menu: MenuProps;
  onOpenChange: (open: boolean) => void;
  isRKey?: boolean;
}

export function ControlRKeyMenu({
  disabled = false,
  children,
  menu,
  onOpenChange,
  isRKey = false,
}: ControlRKeyMenuProps) {
  const trigger: ('click' | 'contextMenu' | 'hover')[] = isRKey ? ['contextMenu'] : ['click'];

  return (
    <Dropdown disabled={disabled} trigger={trigger} menu={menu} onOpenChange={onOpenChange}>
      {children}
    </Dropdown>
  );
}

export interface UseControlRKeyMenuProps {
  space?: Room;
  spaceInfo: SpaceInfo;
  selectedParticipant: Participant | null;
  setSelectedParticipant: (participant: Participant | null) => void;
  setOpenNameModal?: (open: boolean) => void;
  setUsername: (username: string) => void;
  updateSettings: (newSettings: Partial<ParticipantSettings>) => Promise<boolean | undefined>;
  toRenameSettings: () => void;
}

export function useControlRKeyMenu({
  space,
  spaceInfo,
  selectedParticipant,
  setSelectedParticipant,
  setOpenNameModal,
  setUsername,
  updateSettings,
  toRenameSettings,
}: UseControlRKeyMenuProps) {
  const { t } = useI18n();
  // 必要的状态和Owner的确定 -------------------------------------------------------------------
  const [isMicDisabled, setIsMicDisabled] = useState(false);
  const [isCamDisabled, setIsCamDisabled] = useState(false);
  const [isScreenShareDisabled, setIsScreenShareDisabled] = useState(false);
  const [volume, setVolume] = useState(0.0);
  const [blurVideo, setBlurVideo] = useState(0.0);
  const [blurScreen, setBlurScreen] = useState(0.0);
  const isOwner = useMemo(() => {
    return spaceInfo.ownerId === space?.localParticipant.identity;
  }, [spaceInfo.ownerId, space?.localParticipant.identity]);

  // 处理音量、模糊视频和模糊屏幕的调整------------------------------------------------------------
  const handleAdjustment = async (
    key: 'control.volume' | 'control.blur_video' | 'control.blur_screen',
    isSelf = false,
  ) => {
    if (isSelf) {
      if (space?.localParticipant) {
        if (key === 'control.volume') {
          await updateSettings({
            volume,
          });
        } else if (key === 'control.blur_video') {
          await updateSettings({
            blur: blurVideo,
          });
        } else if (key === 'control.blur_screen') {
          await updateSettings({
            screenBlur: blurScreen,
          });
        }
        socket.emit('update_user_status', {
          space: space.name,
        } as WsBase);
      }
    } else {
      if (space?.localParticipant && selectedParticipant && isOwner) {
        let wsTo = {
          space: space.name,
          senderName: space.localParticipant.name,
          senderId: space.localParticipant.identity,
          receiverId: selectedParticipant.identity,
          socketId: spaceInfo.participants[selectedParticipant.identity].socketId,
        } as WsTo;
        if (key === 'control.volume') {
          socket.emit('control_participant', {
            ...wsTo,
            type: ControlType.Volume,
            volume,
          } as WsControlParticipant);
        } else if (key === 'control.blur_video') {
          socket.emit('control_participant', {
            ...wsTo,
            type: ControlType.BlurVideo,
            blur: blurVideo,
          } as WsControlParticipant);
        } else if (key === 'control.blur_screen') {
          socket.emit('control_participant', {
            ...wsTo,
            type: ControlType.BlurScreen,
            blur: blurScreen,
          } as WsControlParticipant);
        }
      }
    }
  };
  // 右键自己的菜单选项 -------------------------------------------------------------
  const optSelfItems: MenuProps['items'] = useMemo(() => {
    return [
      {
        label: t('more.participant.set.control.title'),
        key: 'control',
        type: 'group',
        children: [
          {
            key: 'control.change_name',
            label: (
              <span style={{ marginLeft: '8px' }}>
                {t('more.participant.set.control.change_name')}
              </span>
            ),
            icon: <SvgResource type="user" svgSize={16} />,
          },
          {
            key: 'control.mute_audio',
            label: (
              <span style={{ marginLeft: '8px' }}>
                {t('more.participant.set.control.mute.audio')}
              </span>
            ),
            icon: <SvgResource type="audio_close" svgSize={16} />,
            disabled: !isMicDisabled,
          },
          {
            key: 'control.mute_video',
            label: (
              <span style={{ marginLeft: '8px' }}>
                {t('more.participant.set.control.mute.video')}
              </span>
            ),
            icon: <SvgResource type="video_close" svgSize={16} />,
            disabled: !isCamDisabled,
          },
          {
            key: 'control.mute_screen',
            label: (
              <span style={{ marginLeft: '8px' }}>
                {t('more.participant.set.control.mute.screen')}
              </span>
            ),
            icon: <SvgResource type="screen_close" svgSize={16} />,
            disabled: !isScreenShareDisabled,
          },
          {
            key: 'control.volume',
            label: (
              <div>
                <div className={styles.inline_flex}>
                  <SvgResource type="volume" svgSize={16} />
                  <span style={{ marginLeft: '8px' }}>
                    {t('more.participant.set.control.volume')}
                  </span>
                </div>
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                  }}
                >
                  <Slider
                    disabled={!isOwner}
                    min={0.0}
                    max={100.0}
                    step={1.0}
                    value={volume}
                    onChange={(e) => {
                      setVolume(e);
                    }}
                    onChangeComplete={(e) => {
                      setVolume(e);
                      handleAdjustment('control.volume');
                    }}
                  ></Slider>
                </div>
              </div>
            ),
          },
          {
            key: 'control.blur_video',
            label: (
              <div>
                <div className={styles.inline_flex}>
                  <SvgResource type="blur" svgSize={16} />
                  <span style={{ marginLeft: '8px' }}>
                    {t('more.participant.set.control.blur.video')}
                  </span>
                </div>
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                  }}
                >
                  <Slider
                    disabled={!isOwner}
                    min={0.0}
                    max={1.0}
                    step={0.05}
                    value={blurVideo}
                    onChange={(e) => {
                      setBlurVideo(e);
                    }}
                    onChangeComplete={(e) => {
                      setBlurVideo(e);
                      handleAdjustment('control.blur_video');
                    }}
                  ></Slider>
                </div>
              </div>
            ),
          },
          {
            key: 'control.blur_screen',
            label: (
              <div>
                <div className={styles.inline_flex}>
                  <SvgResource type="blur" svgSize={16} />
                  <span style={{ marginLeft: '8px' }}>
                    {t('more.participant.set.control.blur.screen')}
                  </span>
                </div>
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                  }}
                >
                  <Slider
                    disabled={!isOwner}
                    min={0.0}
                    max={1.0}
                    step={0.05}
                    value={blurScreen}
                    onChange={(e) => {
                      setBlurScreen(e);
                    }}
                    onChangeComplete={(e) => {
                      setBlurScreen(e);
                      handleAdjustment('control.blur_screen');
                    }}
                  ></Slider>
                </div>
              </div>
            ),
          },
        ],
      },

      {
        label: t('more.participant.set.safe.title'),
        key: 'safe',
        type: 'group',
        children: [
          {
            key: 'safe.remove',
            label: (
              <span style={{ marginLeft: '8px' }}>
                {t('more.participant.set.safe.leave.title')}
              </span>
            ),
            icon: <SvgResource type="leave" svgSize={16} />,
          },
        ],
      },
    ];
  }, [isCamDisabled, isMicDisabled, isOwner, isScreenShareDisabled, volume, blurVideo, blurScreen]);
  // 右键他人的菜单选项 -------------------------------------------------------------
  const optItems: MenuProps['items'] = useMemo(() => {
    const controlItems: MenuProps['items'] = [
      {
        key: 'control.volume',
        label: (
          <div>
            <div className={styles.inline_flex}>
              <SvgResource type="volume" svgSize={16} />
              <span style={{ marginLeft: '8px' }}>{t('more.participant.set.control.volume')}</span>
            </div>
            <div
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
              }}
            >
              <Slider
                disabled={!isOwner}
                min={0.0}
                max={100.0}
                step={1.0}
                value={volume}
                onChange={(e) => {
                  setVolume(e);
                }}
                onChangeComplete={(e) => {
                  setVolume(e);
                  handleAdjustment('control.volume');
                }}
              ></Slider>
            </div>
          </div>
        ),
        disabled: !isOwner,
      },
      {
        key: 'control.blur_video',
        label: (
          <div>
            <div className={styles.inline_flex}>
              <SvgResource type="blur" svgSize={16} />
              <span style={{ marginLeft: '8px' }}>
                {t('more.participant.set.control.blur.video')}
              </span>
            </div>
            <div
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
              }}
            >
              <Slider
                disabled={!isOwner}
                min={0.0}
                max={1.0}
                step={0.05}
                value={blurVideo}
                onChange={(e) => {
                  setBlurVideo(e);
                }}
                onChangeComplete={(e) => {
                  setBlurVideo(e);
                  handleAdjustment('control.blur_video');
                }}
              ></Slider>
            </div>
          </div>
        ),
        disabled: !isOwner,
      },
      {
        key: 'control.blur_screen',
        label: (
          <div>
            <div className={styles.inline_flex}>
              <SvgResource type="blur" svgSize={16} />
              <span style={{ marginLeft: '8px' }}>
                {t('more.participant.set.control.blur.screen')}
              </span>
            </div>
            <div
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
              }}
            >
              <Slider
                disabled={!isOwner}
                min={0.0}
                max={1.0}
                step={0.05}
                value={blurScreen}
                onChange={(e) => {
                  setBlurScreen(e);
                }}
                onChangeComplete={(e) => {
                  setBlurScreen(e);
                  handleAdjustment('control.blur_screen');
                }}
              ></Slider>
            </div>
          </div>
        ),
        disabled: !isOwner,
      },
    ];

    const otherItems: MenuProps['items'] = isOwner
      ? [
          {
            label: t('more.participant.set.control.title'),
            key: 'control',
            type: 'group',
            children: [
              {
                key: 'control.trans',
                label: (
                  <span style={{ marginLeft: '8px' }}>
                    {t('more.participant.set.control.trans')}
                  </span>
                ),
                icon: <SvgResource type="switch" svgSize={16} />,
                disabled: !isOwner,
              },
              {
                key: 'control.change_name',
                label: (
                  <span style={{ marginLeft: '8px' }}>
                    {t('more.participant.set.control.change_name')}
                  </span>
                ),
                icon: <SvgResource type="user" svgSize={16} />,
                disabled: !isOwner,
              },
              {
                key: 'control.mute_audio',
                label: (
                  <span style={{ marginLeft: '8px' }}>
                    {t('more.participant.set.control.mute.audio')}
                  </span>
                ),
                icon: <SvgResource type="audio_close" svgSize={16} />,
                disabled: !isOwner ? true : !isMicDisabled,
              },
              {
                key: 'control.mute_video',
                label: (
                  <span style={{ marginLeft: '8px' }}>
                    {t('more.participant.set.control.mute.video')}
                  </span>
                ),
                icon: <SvgResource type="video_close" svgSize={16} />,
                disabled: !isOwner ? true : !isCamDisabled,
              },
              {
                key: 'control.mute_screen',
                label: (
                  <span style={{ marginLeft: '8px' }}>
                    {t('more.participant.set.control.mute.screen')}
                  </span>
                ),
                icon: <SvgResource type="screen_close" svgSize={16} />,
                disabled: !isOwner ? true : !isScreenShareDisabled,
              },
              ...controlItems,
            ],
          },
          {
            label: t('more.participant.set.safe.title'),
            key: 'safe',
            type: 'group',
            children: [
              {
                key: 'safe.remove',
                label: (
                  <span style={{ marginLeft: '8px' }}>
                    {t('more.participant.set.safe.remove.title')}
                  </span>
                ),
                icon: <SvgResource type="leave" svgSize={16} />,
                disabled: !isOwner,
              },
            ],
          },
        ]
      : [];

    return [
      {
        label: t('more.participant.set.invite.title'),
        key: 'invite',
        type: 'group',
        children: [
          {
            key: 'invite.wave',
            label: (
              <span style={{ marginLeft: '8px' }}>{t(`more.participant.set.invite.wave`)}</span>
            ),
            icon: <SvgResource type="wave" svgSize={16} />,
          },
          {
            key: 'invite.audio',
            label: (
              <span style={{ marginLeft: '8px' }}>
                {t(`more.participant.set.invite.${isMicDisabled ? 'close' : 'open'}.audio`)}
              </span>
            ),
            icon: <SvgResource type="audio" svgSize={16} />,
          },
          {
            key: 'invite.video',
            label: (
              <span style={{ marginLeft: '8px' }}>
                {t(`more.participant.set.invite.${isCamDisabled ? 'close' : 'open'}.video`)}
              </span>
            ),
            icon: <SvgResource type="video" svgSize={16} />,
          },
          {
            key: 'invite.share',
            label: (
              <span style={{ marginLeft: '8px' }}>
                {t(`more.participant.set.invite.${isScreenShareDisabled ? 'close' : 'open'}.share`)}
              </span>
            ),
            icon: <SvgResource type="screen" svgSize={16} />,
          },
        ],
      },
      ...otherItems,
    ];
  }, [isCamDisabled, isMicDisabled, isOwner, isScreenShareDisabled, volume, blurVideo, blurScreen]);
  // 处理自己的菜单点击事件 -------------------------------------------------------------
  const handleSelfOptClick: MenuProps['onClick'] = (e) => {
    if (space?.localParticipant) {
      switch (e.key) {
        case 'safe.remove': {
          Modal.confirm({
            title: t('more.participant.set.safe.leave.title'),
            content: t('more.participant.set.safe.leave.desc'),
            okText: t('more.participant.set.safe.leave.confirm'),
            cancelText: t('more.participant.set.safe.leave.cancel'),
            onOk: () => {
              space.disconnect(true);
            },
          });
          break;
        }
        case 'control.change_name': {
          toRenameSettings();
          break;
        }
        case 'control.mute_audio': {
          space.localParticipant.setMicrophoneEnabled(false);
          break;
        }
        case 'control.mute_video': {
          space.localParticipant.setCameraEnabled(false);
          break;
        }
        case 'control.mute_screen': {
          space.localParticipant.setScreenShareEnabled(false);
          break;
        }
        default:
          break;
      }
    }
  };

  // 处理菜单点击事件 -------------------------------------------------------------
  const handleOptClick: MenuProps['onClick'] = (e) => {
    if (space?.localParticipant && selectedParticipant) {
      let device = Track.Source.Unknown;
      let wsTo = {
        space: space.name,
        senderName: space.localParticipant.name,
        senderId: space.localParticipant.identity,
        receiverId: selectedParticipant.identity,
        socketId: spaceInfo.participants[selectedParticipant.identity].socketId,
      } as WsTo;

      const inviteDevice = (isOpen: boolean) => {
        socket.emit('invite_device', {
          ...wsTo,
          device,
          isOpen
        } as WsInviteDevice);
      };

      switch (e.key) {
        case 'invite.wave': {
          socket.emit('wave', wsTo);
          const audioSrc = src('/audios/vocespacewave.m4a');
          const audio = new Audio(audioSrc);
          audio.volume = 1.0;
          audio.play().then(() => {
            setTimeout(() => {
              audio.pause();
              audio.currentTime = 0;
              audio.remove();
            }, 2000);
          });
          break;
        }
        case 'invite.audio': {
          device = Track.Source.Microphone;
          inviteDevice(!isMicDisabled);
          break;
        }
        case 'invite.video': {
          device = Track.Source.Camera;
          inviteDevice(!isCamDisabled);
          break;
        }
        case 'invite.share': {
          device = Track.Source.ScreenShare;
          inviteDevice(!isScreenShareDisabled);
          break;
        }
        case 'safe.remove':
          {
            Modal.confirm({
              title: t('more.participant.set.safe.remove.title'),
              content: t('more.participant.set.safe.remove.desc'),
              okText: t('more.participant.set.safe.remove.confirm'),
              cancelText: t('more.participant.set.safe.remove.cancel'),
              onOk: () => {
                socket.emit('remove_participant', wsTo);
              },
            });
          }
          break;
        case 'control.change_name': {
          setOpenNameModal && setOpenNameModal(true);
          break;
        }
        case 'control.mute_audio': {
          socket.emit('control_participant', {
            ...wsTo,
            type: ControlType.MuteAudio,
          } as WsControlParticipant);
          break;
        }
        case 'control.mute_video': {
          socket.emit('control_participant', {
            ...wsTo,
            type: ControlType.MuteVideo,
          } as WsControlParticipant);
          break;
        }
        case 'control.mute_screen': {
          socket.emit('control_participant', {
            ...wsTo,
            type: ControlType.MuteScreen,
          } as WsControlParticipant);
          break;
        }
        case 'control.trans': {
          socket.emit('control_participant', {
            ...wsTo,
            type: ControlType.Transfer,
          } as WsControlParticipant);
          break;
        }
        default:
          break;
      }
    }
  };

  const optOpen = (open: boolean, participant: Participant) => {
    if (!open) {
      return;
    }
    setIsMicDisabled(participant.isMicrophoneEnabled);
    setIsCamDisabled(participant.isCameraEnabled);
    setIsScreenShareDisabled(participant.isScreenShareEnabled);
    setSelectedParticipant(participant);
    setUsername(participant.name || participant.identity);
    setBlurVideo(spaceInfo.participants[participant.identity]?.blur || 0.0);
    setBlurScreen(spaceInfo.participants[participant.identity]?.screenBlur || 0.0);
    setVolume(spaceInfo.participants[participant.identity]?.volume || 0.0);
  };

  return {
    optSelfItems,
    optItems,
    handleSelfOptClick,
    handleOptClick,
    optOpen,
    isOwner,
  };
}
