import { SvgResource } from '@/app/resources/svg';
import { useI18n } from '@/lib/i18n/i18n';
import { ParticipantSettings, SpaceInfo } from '@/lib/std/space';
import { Dropdown, MenuProps, Modal, Slider } from 'antd';
import { AudioPresets, createLocalAudioTrack, Participant, Room, Track } from 'livekit-client';
import { useEffect, useMemo, useState } from 'react';
import styles from '@/styles/controls.module.scss';
import {
  ControlType,
  hasHeadphonesConnected,
  WsBase,
  WsControlParticipant,
  WsInviteDevice,
  WsTo,
} from '@/lib/std/device';
import { socket } from '@/app/[spaceName]/PageClientImpl';
import { isSpaceManager, src } from '@/lib/std';
import { exportRBAC, usePlatformUserInfo } from '@/lib/hooks/platform';
import { HomeOutlined } from '@ant-design/icons';
import { MessageInstance } from 'antd/es/message/interface';

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
    <Dropdown
      disabled={disabled}
      trigger={trigger}
      menu={menu}
      onOpenChange={onOpenChange}
      className="vocespace_full_size"
    >
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
  isSelf: boolean;
  messageApi: MessageInstance;
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
  isSelf,
  messageApi,
}: UseControlRKeyMenuProps) {
  const { t } = useI18n();
  // 必要的状态和Owner的确定 -------------------------------------------------------------------
  const [isInEarMonitorOpen, setIsInEarMonitorOpen] = useState(false);
  const [isLocalEarMonitorSupported, setIsLocalEarMonitorSupported] = useState(false);
  const [isMicDisabled, setIsMicDisabled] = useState(false);
  const [isCamDisabled, setIsCamDisabled] = useState(false);
  const [isScreenShareDisabled, setIsScreenShareDisabled] = useState(false);
  const [volume, setVolume] = useState(0.0);
  const [volumeScreen, setVolumeScreen] = useState(0.0);
  const [blurVideo, setBlurVideo] = useState(0.0);
  const [blurScreen, setBlurScreen] = useState(0.0);
  // const isOwner = useMemo(() => {
  //   return spaceInfo.ownerId === space?.localParticipant.identity;
  // }, [spaceInfo.ownerId, space?.localParticipant.identity]);
  const isOwner = useMemo(() => {
    return isSpaceManager(spaceInfo, space?.localParticipant.identity || '').ty === 'Owner';
  }, [spaceInfo.ownerId, space?.localParticipant.identity]);
  const { manageRole, controlUser } = useMemo(() => {
    return exportRBAC(space?.localParticipant.identity || '', spaceInfo);
  }, [space, spaceInfo]);
  const { platUser } = usePlatformUserInfo({
    space: space,
    uid: space?.localParticipant.identity!,
  });

  const checkEarMonitorSupported = async (showMessage = false): Promise<boolean> => {
    if (!space?.localParticipant) return false; // 如果没有本地参与者信息，无法判断支持性，直接返回false

    let supported = true;
    // 判断浏览器必须支持AudioWorklet
    if (!window.AudioWorkletNode) {
      showMessage &&
        messageApi.error(t('more.participant.set.control.in_ear_monitor.not_supported'));
      return false; // 立即失败
    }
    const localParticipant = space.localParticipant;
    // 判断是否有可用的音频输入设备（麦克风），判断用户是否开启了麦克风权限并且没有设置成isMuted，并且volume也必须大于0
    if (!localParticipant.isMicrophoneEnabled) {
      showMessage && messageApi.warning(t('more.participant.set.control.in_ear_monitor.no_mic'));
      supported = false;
    }
    // 判断用户是否佩戴耳机，检测耳机是否已连接（有线 / 蓝牙）使用MediaDevices.enumerateDevices() + Audio Output Devices API
    const connected = await hasHeadphonesConnected();
    if (!connected) {
      supported = false;
      showMessage &&
        messageApi.error(t('more.participant.set.control.in_ear_monitor.no_headphone'));
    }

    return supported;
  };

  // 当前本地用户是否支持耳返功能，耳返功能需要满足以下条件：
  // 1. 必须是本地用户自己的菜单 (这个会在菜单开启时判断)
  // 2. 浏览器必须支持AudioWorklet（目前主流浏览器都支持，但仍需判断）
  // 3. 用户必须有可用的音频输入设备（麦克风），因为耳返功能需要获取麦克风音频流进行处理
  // 4. 用户必须在空间中开启了麦克风权限，因为即使有麦克风设备，如果没有权限也是无法使用耳返功能的
  // 5. 用户必须佩戴耳机，因为耳返功能的主要作用是让用户在耳机中听到自己的声音，如果没有佩戴耳机，开启耳返可能会导致声音回馈和回声问题
  useEffect(() => {
    const checkSupport = async () => {
      const supported = await checkEarMonitorSupported();
      setIsLocalEarMonitorSupported(supported);
    };
    checkSupport();
  }, [space?.localParticipant]);

  // 处理音量、模糊视频和模糊屏幕的调整------------------------------------------------------------
  const handleAdjustment = async (
    key: 'control.volume' | 'control.blur_video' | 'control.blur_screen' | 'control.volume_screen',
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
        } else if (key === 'control.volume_screen') {
          // 调整屏幕分享的音量，控制别人的屏幕分享音量只需要更新自己的设置，因为自己分享的屏幕音量默认就是100%
          await updateSettings({
            volumeScreen: volumeScreen,
          });
        }
        socket.emit('update_user_status', {
          space: space.name,
        } as WsBase);
      }
    } else {
      if (space?.localParticipant && selectedParticipant && manageRole) {
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
        } else if (key === 'control.volume_screen') {
          socket.emit('control_participant', {
            ...wsTo,
            type: ControlType.VolumeScreen,
            volumeScreen: volumeScreen,
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
            key: 'control.in_ear_monitor',
            label: (
              <span style={{ marginLeft: '8px' }}>
                {isInEarMonitorOpen
                  ? t('more.participant.set.control.in_ear_monitor.close')
                  : t('more.participant.set.control.in_ear_monitor.open')}
              </span>
            ),
            icon: (
              <SvgResource
                type={isInEarMonitorOpen ? 'in_ear_monitor_close' : 'in_ear_monitor_open'}
                svgSize={16}
              />
            ),
            // disabled: !isLocalEarMonitorSupported,
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
                    disabled={!isSelf}
                    min={0.0}
                    max={100.0}
                    step={1.0}
                    value={volume}
                    onChange={(e) => {
                      setVolume(e);
                    }}
                    onChangeComplete={(e) => {
                      setVolume(e);
                      handleAdjustment('control.volume', true);
                    }}
                  ></Slider>
                </div>
              </div>
            ),
          },
          {
            key: 'control.volume_screen',
            label: (
              <div>
                <div className={styles.inline_flex}>
                  <SvgResource type="volume" svgSize={16} />
                  <span style={{ marginLeft: '8px' }}>
                    {t('more.participant.set.control.volume_screen')}
                  </span>
                </div>
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                  }}
                >
                  <Slider
                    disabled={!controlUser}
                    min={0.0}
                    max={100.0}
                    step={1.0}
                    value={volumeScreen}
                    onChange={(e) => {
                      setVolumeScreen(e);
                    }}
                    onChangeComplete={(e) => {
                      setVolumeScreen(e);
                      handleAdjustment('control.volume_screen', true);
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
                    disabled={!isSelf}
                    min={0.0}
                    max={1.0}
                    step={0.05}
                    value={blurVideo}
                    onChange={(e) => {
                      setBlurVideo(e);
                    }}
                    onChangeComplete={(e) => {
                      setBlurVideo(e);
                      handleAdjustment('control.blur_video', true);
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
                    disabled={!isSelf}
                    min={0.0}
                    max={1.0}
                    step={0.05}
                    value={blurScreen}
                    onChange={(e) => {
                      setBlurScreen(e);
                    }}
                    onChangeComplete={(e) => {
                      setBlurScreen(e);
                      handleAdjustment('control.blur_screen', true);
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
          ...(platUser
            ? [
                {
                  key: 'safe.platform',
                  label: <span>{t('more.platform')}</span>,
                  icon: <HomeOutlined style={{ fontSize: 16 }}></HomeOutlined>,
                },
              ]
            : []),
        ],
      },
    ];
  }, [
    isCamDisabled,
    isMicDisabled,
    isScreenShareDisabled,
    volume,
    blurVideo,
    blurScreen,
    isSelf,
    selectedParticipant?.isScreenShareEnabled,
    volumeScreen,
    isInEarMonitorOpen,
    isLocalEarMonitorSupported,
  ]);
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
                disabled={!controlUser}
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
        disabled: !controlUser,
      },
      {
        key: 'control.volume_screen',
        label: (
          <div>
            <div className={styles.inline_flex}>
              <SvgResource type="volume" svgSize={16} />
              <span style={{ marginLeft: '8px' }}>
                {t('more.participant.set.control.volume_screen')}
              </span>
            </div>
            <div
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
              }}
            >
              <Slider
                disabled={!controlUser}
                min={0.0}
                max={100.0}
                step={1.0}
                value={volumeScreen}
                onChange={(e) => {
                  setVolumeScreen(e);
                }}
                onChangeComplete={(e) => {
                  setVolumeScreen(e);
                  handleAdjustment('control.volume_screen');
                }}
              ></Slider>
            </div>
          </div>
        ),
        disabled: !controlUser,
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
                disabled={!controlUser}
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
        disabled: !controlUser,
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
                disabled={!controlUser}
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
        disabled: !controlUser,
      },
    ];

    // 如果selectParticipant是Owner，就不能转让管理员权限
    const managerItems = [];

    if (spaceInfo.ownerId !== selectedParticipant?.identity) {
      managerItems.push({
        key: 'control.trans',
        label: (
          <span style={{ marginLeft: '8px' }}>
            {isOwner
              ? t('more.participant.set.control.trans')
              : t('more.participant.set.control.trans_manager')}
          </span>
        ),
        icon: <SvgResource type="switch" svgSize={16} />,
        disabled: !manageRole,
      });
      managerItems.push({
        key: 'control.setManager',
        label: (
          <span style={{ marginLeft: '8px' }}>
            {spaceInfo.managers.includes(selectedParticipant?.identity || '')
              ? t('more.participant.set.control.remove_manager')
              : t('more.participant.set.control.set_manager')}
          </span>
        ),
        icon: <SvgResource type="manager" svgSize={16} color="#FFAA33" />,
        disabled: !isOwner,
      });
    }

    const otherItems: MenuProps['items'] = controlUser
      ? [
          {
            label: t('more.participant.set.control.title'),
            key: 'control',
            type: 'group',
            children: [
              ...managerItems,
              {
                key: 'control.change_name',
                label: (
                  <span style={{ marginLeft: '8px' }}>
                    {t('more.participant.set.control.change_name')}
                  </span>
                ),
                icon: <SvgResource type="user" svgSize={16} />,
                disabled: !controlUser,
              },
              {
                key: 'control.mute_audio',
                label: (
                  <span style={{ marginLeft: '8px' }}>
                    {t('more.participant.set.control.mute.audio')}
                  </span>
                ),
                icon: <SvgResource type="audio_close" svgSize={16} />,
                disabled: !controlUser ? true : !isMicDisabled,
              },
              {
                key: 'control.mute_video',
                label: (
                  <span style={{ marginLeft: '8px' }}>
                    {t('more.participant.set.control.mute.video')}
                  </span>
                ),
                icon: <SvgResource type="video_close" svgSize={16} />,
                disabled: !controlUser ? true : !isCamDisabled,
              },
              {
                key: 'control.mute_screen',
                label: (
                  <span style={{ marginLeft: '8px' }}>
                    {t('more.participant.set.control.mute.screen')}
                  </span>
                ),
                icon: <SvgResource type="screen_close" svgSize={16} />,
                disabled: !controlUser ? true : !isScreenShareDisabled,
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
                disabled: !controlUser,
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
  }, [
    isCamDisabled,
    isMicDisabled,
    isOwner,
    isScreenShareDisabled,
    volume,
    blurVideo,
    blurScreen,
    spaceInfo,
    selectedParticipant,
    manageRole,
    controlUser,
  ]);
  // 处理自己的菜单点击事件 -------------------------------------------------------------
  const handleSelfOptClick: MenuProps['onClick'] = async (e) => {
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
        case 'safe.platform': {
          if (platUser && platUser.id) {
            window.open(`https://home.vocespace.com/auth/user/${platUser.id}`, '_blank');
          }
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
        case 'control.in_ear_monitor': {
          // 如果需要开启耳返，需要重新创建本地音频轨道，并且自己订阅，不需要发给别人，因为耳返只是自己听到自己的声音
          if (!isInEarMonitorOpen) {
            const isSupport = await checkEarMonitorSupported(true);
            console.warn('耳返支持性检查结果:', isSupport);
            if (!isSupport) {
              // messageApi.error(t('more.participant.set.control.in_ear_monitor.not_supported'));
              return;
            }

            const track = await createLocalAudioTrack({
              echoCancellation: false,
              noiseSuppression: false,
              autoGainControl: false,
              channelCount: 2,
              sampleRate: 48000,
            });
            // 发布轨道,(video_container组件中会进行订阅)
            await space.localParticipant.publishTrack(track, {
              name: `${space.localParticipant.identity}_in_ear_monitor_track`, //设置专用轨道名称，方便订阅和取消订阅
              audioPreset: AudioPresets.musicHighQualityStereo,
            });

            await updateSettings({
              inEarMonitor: true,
            });
          } else {
            // 关闭耳返, 停止并取消发布专用的耳返轨道
            space.localParticipant.audioTrackPublications.forEach((publication) => {
              if (
                publication.trackName === `${space.localParticipant.identity}_in_ear_monitor_track`
              ) {
                if (publication.track) {
                  publication.track.stop();
                  space.localParticipant.unpublishTrack(publication.track);
                }
              }
            });

            await updateSettings({
              inEarMonitor: false,
            });
          }
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
          isOpen,
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
        case 'control.setManager': {
          socket.emit('control_participant', {
            ...wsTo,
            type: ControlType.setManager,
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
    if (participant.isScreenShareEnabled) {
      setVolumeScreen(spaceInfo.participants[participant.identity]?.volumeScreen || 100.0);
    }
    setIsInEarMonitorOpen(spaceInfo.participants[participant.identity]?.inEarMonitor || false);
  };

  return {
    optSelfItems,
    optItems,
    handleSelfOptClick,
    handleOptClick,
    optOpen,
    isOwner,
    manageRole,
  };
}
