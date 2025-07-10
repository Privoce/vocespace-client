import { Button, Tabs, TabsProps, Tag, Tooltip } from 'antd';
import styles from '@/styles/controls.module.scss';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { MessageInstance } from 'antd/es/message/interface';
import { ModelBg, ModelRole } from '@/lib/std/virtual';
import { useI18n } from '@/lib/i18n/i18n';
import { connect_endpoint, isUndefinedString, UserStatus } from '@/lib/std';
import { useRecoilState } from 'recoil';
import { userState } from '@/app/[roomName]/PageClientImpl';
import { LocalParticipant } from 'livekit-client';
import { LicenseControl } from './settings/license';
import { AudioSettings } from './settings/audio';
import { GeneralSettings } from './settings/general';
import { TabItem } from './settings/tab_item';
import { VirtualSettingsExports } from './settings/virtual';
import { VideoSettings } from './settings/video';
import { AboutUs } from './settings/about_us';
import { RecordingTable } from '@/app/recording/table';
import {
  EnvData,
  RecordData,
  RecordResponse,
  RecordState,
  useRecordingEnv,
} from '@/lib/std/recording';
import { ulid } from 'ulid';
import { ReloadOutlined } from '@ant-design/icons';

export interface SettingsProps {
  username: string;
  close: boolean;
  tab: {
    key: TabKey;
    setKey: (e: TabKey) => void;
  };
  messageApi: MessageInstance;
  setUserStatus?: (status: UserStatus | string) => Promise<void>;
  room: string;
  localParticipant: LocalParticipant;
}

export interface SettingsExports {
  username: string;
  removeVideo: () => void;
  startVideo: () => Promise<void>;
  state: {
    volume: number;
    blur: number;
    screenBlur: number;
    virtual: {
      enabled: boolean;
      role: ModelRole;
      bg: ModelBg;
    };
    openShareAudio: boolean;
    openPromptSound: boolean;
  };
}

export type TabKey = 'general' | 'audio' | 'video' | 'screen' | 'about_us';

export const Settings = forwardRef<SettingsExports, SettingsProps>(
  (
    {
      close,
      username: uname,
      tab: { key, setKey },
      // saveChanges,
      messageApi,
      setUserStatus,
      room,
      localParticipant,
    }: SettingsProps,
    ref,
  ) => {
    const { t } = useI18n();
    const [username, setUsername] = useState(uname);
    const [appendStatus, setAppendStatus] = useState(false);
    const [uState, setUState] = useRecoilState(userState);
    const [volume, setVolume] = useState(uState.volume);
    const [videoBlur, setVideoBlur] = useState(uState.blur);
    const [screenBlur, setScreenBlur] = useState(uState.screenBlur);
    const [virtualEnabled, setVirtualEnabled] = useState(false);
    const [modelRole, setModelRole] = useState<ModelRole>(ModelRole.None);
    const [modelBg, setModelBg] = useState<ModelBg>(ModelBg.ClassRoom);
    const [openShareAudio, setOpenShareAudio] = useState<boolean>(uState.openShareAudio);
    const [openPromptSound, setOpenPromptSound] = useState<boolean>(uState.openPromptSound);
    const [compare, setCompare] = useState(false);
    const virtualSettingsRef = useRef<VirtualSettingsExports>(null);
    const { env, state, isConnected } = useRecordingEnv(messageApi);
    const [recordsData, setRecordsData] = useState<RecordData[]>([]);
    const [firstOpen, setFirstOpen] = useState(true);

    const searchRoomRecords = async () => {
      console.warn('search -----');
      const response = await fetch(`${env?.server_host}/api/s3/${room}`);
      if (response.ok) {
        const { records, success }: RecordResponse = await response.json();
        if (success && records.length > 0) {
          let formattedRecords: RecordData[] = records.map((record) => ({
            ...record,
            id: ulid(), // 使用 ulid 生成唯一 ID
          }));

          setRecordsData(formattedRecords);
          messageApi.success('查找录制文件成功');
          return;
        } else {
          messageApi.error(
            '查找录制文件为空，请检查房间名是否正确，房间内可能没有录制视频文件或已经删除',
          );
          setRecordsData([]);
        }
      }
    };

    useEffect(() => {
      setVolume(uState.volume);
      setVideoBlur(uState.blur);
      setScreenBlur(uState.screenBlur);
      setVirtualEnabled(uState.virtual.enabled);
      setModelRole(uState.virtual.role);
      setModelBg(uState.virtual.bg);
      setOpenShareAudio(uState.openShareAudio);
      setOpenPromptSound(uState.openPromptSound);
    }, [uState]);

    const items: TabsProps['items'] = [
      {
        key: 'general',
        label: <TabItem type="setting" label={t('settings.general.title')}></TabItem>,
        children: (
          <GeneralSettings
            room={room}
            localParticipant={localParticipant}
            messageApi={messageApi}
            appendStatus={appendStatus}
            setAppendStatus={setAppendStatus}
            setUserStatus={setUserStatus}
            username={username}
            setUsername={setUsername}
            openPromptSound={openPromptSound}
            setOpenPromptSound={setOpenPromptSound}
          ></GeneralSettings>
        ),
      },
      {
        key: 'audio',
        label: <TabItem type="audio" label={t('settings.audio.title')}></TabItem>,
        children: <AudioSettings volume={volume} setVolume={setVolume}></AudioSettings>,
      },
      {
        key: 'video',
        label: <TabItem type="video" label={t('settings.video.title')}></TabItem>,
        children: (
          <VideoSettings
            videoBlur={videoBlur}
            setVideoBlur={setVideoBlur}
            screenBlur={screenBlur}
            setScreenBlur={setScreenBlur}
            virtualSettingsRef={virtualSettingsRef}
            openShareAudio={openShareAudio}
            setOpenShareAudio={setOpenShareAudio}
            virtual={{
              close,
              blur: videoBlur,
              messageApi,
              modelRole,
              setModelRole,
              modelBg,
              setModelBg,
              enabled: virtualEnabled,
              setEnabled: setVirtualEnabled,
              compare,
              setCompare,
              room,
              localParticipant,
            }}
          ></VideoSettings>
        ),
      },
      {
        key: 'recording',
        label: <TabItem type="record" label={t('recording.title')}></TabItem>,
        children: (
          <div>
            <div
              style={{
                width: '100%',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 16,
              }}
            >
              <Tag color="#22ccee">{isConnected}</Tag>
              <Tooltip title="刷新数据">
                <Button size="small" icon={<ReloadOutlined />} onClick={searchRoomRecords}>
                  刷新
                </Button>
              </Tooltip>
            </div>
            <RecordingTable
              messageApi={messageApi}
              env={env}
              currentRoom={room}
              recordsData={recordsData}
              setRecordsData={setRecordsData}
              expandable={true}
            ></RecordingTable>
          </div>
        ),
      },
      {
        key: 'license',
        label: <TabItem type="license" label={t('settings.license.title')}></TabItem>,
        children: <LicenseControl messageApi={messageApi}></LicenseControl>,
      },
      {
        key: 'about_us',
        label: <TabItem type="logo" label={t('settings.about_us.title')}></TabItem>,
        children: <AboutUs></AboutUs>,
      },
    ];

    useImperativeHandle(ref, () => ({
      username,
      removeVideo: () => {
        if (virtualSettingsRef.current) {
          virtualSettingsRef.current.removeVideo();
          setCompare(false);
        }
      },
      startVideo: async () => {
        if (virtualSettingsRef.current) {
          await virtualSettingsRef.current.startVideo();
        }
      },
      state: {
        volume,
        blur: videoBlur,
        screenBlur,
        virtual: {
          enabled: virtualEnabled,
          role: modelRole,
          bg: modelBg,
        },
        openShareAudio,
        openPromptSound,
      },
    }));

    return (
      <Tabs
        activeKey={key}
        tabPosition="left"
        centered
        items={items}
        style={{ width: '100%', height: '100%' }}
        onChange={(k: string) => {
          setKey(k as TabKey);
          if (k === 'recording' && firstOpen) {
            searchRoomRecords();
            setFirstOpen(false);
          }
        }}
      />
    );
  },
);
export function TabItem({ type, label }: { type: SvgType; label: string }) {
  const tabStyles = {
    display: 'inline-flex',
    alignItems: 'center',
    width: '100%',
    height: '100%',
    justifyContent: 'space-between',
    gap: '6px',
  };

  return (
    <div style={tabStyles}>
      <SvgResource type={type} svgSize={14}></SvgResource>
      {label}
    </div>
  );
}

export interface VirtualSettingsProps {
  enabled: boolean;
  setEnabled: (e: boolean) => void;
  modelRole: ModelRole;
  setModelRole: (e: ModelRole) => void;
  modelBg: ModelBg;
  setModelBg: (e: ModelBg) => void;
  compare: boolean;
  setCompare: (e: boolean) => void;
  close: boolean;
  blur: number;
  room: string;
  localParticipant: LocalParticipant;
}

export interface VirtualSettingsExports {
  removeVideo: () => void;
  startVideo: () => Promise<void>;
}

export const VirtualSettings = forwardRef<
  VirtualSettingsExports,
  VirtualSettingsProps & { messageApi: MessageInstance }
>(
  (
    {
      close,
      blur,
      messageApi,
      enabled,
      setEnabled,
      modelRole,
      setModelRole,
      modelBg,
      setModelBg,
      compare,
      setCompare,
      room,
      localParticipant,
    }: VirtualSettingsProps & { messageApi: MessageInstance },
    ref,
  ) => {
    const { t } = useI18n();
    const videoRef = useRef<HTMLVideoElement>(null);
    const [model_selected_index, set_model_selected_index] = useState(0);
    const [bg_selected_index, set_bg_selected_index] = useState(0);
    const [showBlur, setShowBlur] = useState(true);
    const [virtualMask, setVirtualMask] = useRecoilState(virtualMaskState);
    const { blurValue, setVideoBlur } = useVideoBlur({
      videoRef,
      initialBlur: blur,
    });

    const reloadVirtual = () => {
      socket.emit('reload_virtual', {
        identity: localParticipant.identity,
        roomId: room,
        reloading: true,
      });
    };

    useEffect(() => {
      setVideoBlur(blur);
    }, [blur]);

    useEffect(() => {
      if (modelRole != ModelRole.None) {
        setEnabled(true);
      } else {
        setEnabled(false);
      }
    }, [modelRole]);
    useEffect(() => {
      if (close && videoRef.current && !videoRef.current.srcObject) {
        loadVideo(videoRef);
        if (modelRole != ModelRole.None) {
          setVirtualMask(true);
          reloadVirtual();
          setCompare(true);
        }
      }
    }, [videoRef, close]);

    const modelDatas = [
      {
        name: 'None',
        src: 'none.png',
      },
      {
        name: 'Haru',
        src: 'Haru.png',
      },
      {
        name: 'Hiyori',
        src: 'Hiyori.png',
      },
      {
        name: 'Mao',
        src: 'Mao.png',
      },
      {
        name: 'Mark',
        src: 'Mark.png',
      },
      {
        name: 'Natori',
        src: 'Natori.png',
      },
      {
        name: 'Rice',
        src: 'Rice.png',
      },
    ];

    const bgDatas = [
      {
        name: 'Class Room',
        src: 'v_bg1.png',
      },
      {
        name: 'Waiting Space',
        src: 'v_bg2.jpg',
      },
      {
        name: 'Office',
        src: 'v_bg3.jpg',
      },
      {
        name: 'Leisure Space',
        src: 'v_bg4.jpg',
      },
      {
        name: 'Meeting Room',
        src: 'v_bg5.jpg',
      },
    ];

    const items: TabsProps['items'] = [
      {
        key: 'model',
        label: <TabItem type="model" label={t('settings.virtual.tab.model')}></TabItem>,
        children: (
          <div>
            <h4>{t('settings.virtual.model')}</h4>
            <List
              grid={{
                gutter: 16,
                column: 3,
              }}
              dataSource={modelDatas}
              renderItem={(item, index) => (
                <List.Item>
                  <div
                    className={styles.virtual_model_box}
                    onClick={() => {
                      reloadVirtual();
                      set_model_selected_index(index);
                      setModelRole(item.name as ModelRole);
                      setVirtualMask(true);
                      if (compare && item.name != ModelRole.None) {
                        // 这里需要将外部视频进行遮罩
                        setCompare(false);
                        setTimeout(() => {
                          setCompare(true);
                        }, 200);
                      } else if (item.name == ModelRole.None) {
                        setCompare(false);
                      } else {
                        setCompare(true);
                      }
                    }}
                  >
                    {model_selected_index == index && <SelectedMask></SelectedMask>}
                    {/* <h4>{item.name}</h4> */}
                    {item.name == ModelRole.None ? (
                      <div
                        style={{
                          height: '120px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: '700',
                        }}
                      >
                        {t('settings.virtual.none')}
                      </div>
                    ) : (
                      <img src={src(`/images/models/${item.src}`)} alt="" />
                    )}
                  </div>
                </List.Item>
              )}
            />
          </div>
        ),
      },
      {
        key: 'background',
        label: <TabItem type="bg" label={t('settings.virtual.tab.background')}></TabItem>,
        children: (
          <div>
            <h4>{t('settings.virtual.background')}</h4>
            <List
              grid={{
                gutter: 16,
                column: 3,
              }}
              dataSource={bgDatas}
              renderItem={(item, index) => (
                <List.Item>
                  <div
                    className={styles.virtual_model_box}
                    onClick={() => {
                      reloadVirtual();
                      set_bg_selected_index(index);
                      setVirtualMask(true);
                      setModelBg(item.src as ModelBg);
                      if (compare && modelRole != ModelRole.None) {
                        setCompare(false);
                        setTimeout(() => {
                          setCompare(true);
                        }, 200);
                      } else if (modelRole == ModelRole.None && !compare) {
                        setCompare(false);
                      } else {
                        setCompare(true);
                      }
                    }}
                  >
                    {bg_selected_index == index && <SelectedMask></SelectedMask>}
                    {/* <h4>{item.name}</h4> */}
                    <img src={src(`/images/bg/${item.src}`)} alt="" />
                  </div>
                </List.Item>
              )}
            />
          </div>
        ),
      },
    ];

    const removeVideo = () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
        videoRef.current.srcObject = null;
      }
    };

    useImperativeHandle(ref, () => ({
      removeVideo,
      startVideo: async () => {
        await loadVideo(videoRef);
      },
    }));

    return (
      <div className={styles.virtual_settings}>
        <div className={styles.virtual_video_box}>
          {modelRole == ModelRole.None && (
            <div className={styles.virtual_video_box_compare}>
              <Button
                color="default"
                variant="solid"
                style={{ padding: '8px' }}
                onClick={() => {
                  if (modelRole != ModelRole.None) {
                    const val = !compare;
                    setCompare(val);
                  } else {
                    setShowBlur(!showBlur);
                  }
                }}
              >
                <SvgResource type="switch" color="#fff" svgSize={14}></SvgResource>
              </Button>
            </div>
          )}

          <video
            className={compare ? '' : styles.virtual_video_box_video}
            style={{
              visibility: compare ? 'hidden' : 'visible',
              filter: showBlur ? `blur(${blurValue}px)` : 'none',
              transition: 'filter 0.2s ease-in-out',
            }}
            ref={videoRef}
            playsInline
          />
          {compare && modelRole != ModelRole.None && (
            <div className={styles.virtual_video_box_canvas}>
              <VirtualRoleCanvas
                model_bg={modelBg}
                model_role={modelRole}
                enabled={compare}
                messageApi={messageApi}
                isLocal={true}
                isReplace={false}
                onReady={() => {}}
                onDestroy={() => {}}
              ></VirtualRoleCanvas>
            </div>
          )}
        </div>
        <Tabs
          defaultActiveKey="general"
          tabPosition="top"
          items={items}
          style={{ width: '100%', height: '100%' }}
        />
      </div>
    );
  },
);

function SelectedMask() {
  return (
    <div className={styles.selected_mask}>
      <SvgResource type="check" svgSize={24} color="#22CCEE"></SvgResource>
    </div>
  );
}

function BuildUserStatus({
  messageApi,
  room,
  localParticipant,
}: {
  messageApi: MessageInstance;
  room: string;
  localParticipant: LocalParticipant;
}) {
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const status_icons: {
    key: string;
    color: string;
  }[] = [
    {
      key: 'a',
      color: '#3357FF',
    },
    {
      key: 'b',
      color: '#0052d9',
    },
    {
      key: 'c',
      color: '#8e56dd',
    },
    {
      key: 'd',
      color: '#ffaedc',
    },
    {
      key: 'e',
      color: '#f5ba18',
    },
    {
      key: 'f',
      color: '#85d3ff',
    },
    {
      key: 'g',
      color: '#d54941',
    },
    {
      key: 'h',
      color: '#92dbb2',
    },
  ];
  const [selectedIcon, setSelectedIcon] = useState(status_icons[0].key);
  const [videoBlur, setVideoBlur] = useState(0.15);
  const [screenBlur, setScreenBlur] = useState(0.15);
  const [volume, setVolume] = useState(80);

  const saveStatus = async () => {
    try {
      const url = new URL(SAVE_STATUS_ENDPOINT, window.location.origin);

      const status: UserDefineStatus = {
        id: ulid(),
        creator: {
          name: localParticipant.name || localParticipant.identity,
          id: localParticipant.identity,
        },
        name,
        desc,
        icon: {
          key: selectedIcon,
          color: status_icons.find((item) => item.key == selectedIcon)?.color || '#3357FF',
        },
        volume,
        blur: videoBlur,
        screenBlur,
      };

      const response = await fetch(url.toString(), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          roomId: room,
          status,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to save status: ${response.status}`);
      }

      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }
      messageApi.success({
        content: t('settings.general.status.define.success'),
      });
      // 服务器已经保存了状态，使用socket通知所有房间里的人
      socket.emit('new_user_status', { status: data.status, room: data.roomId });
      // 清空所有输入框
      setName('');
      setDesc('');
      setSelectedIcon(status_icons[0].key);
      setVolume(80);
      setVideoBlur(0.15);
      setScreenBlur(0.15);
    } catch (e) {
      messageApi.error({
        content: `${t('settings.general.status.define.fail')}: ${e}`,
      });
    }
  };

  return (
    <div className={styles.build_status}>
      <hr />
      <h4 style={{ fontSize: '16px', color: '#fff' }}>
        {t('settings.general.status.define.title')}
      </h4>
      <div>
        <div className={styles.common_space}>{t('settings.general.status.define.name')}:</div>
        <Input
          value={name}
          placeholder={t('settings.general.status.define.placeholder.name')}
          onChange={(e) => {
            setName(e.target.value);
          }}
        ></Input>
      </div>
      <div>
        <div className={styles.common_space}>{t('settings.general.status.define.desc')}:</div>
        <TextArea
          rows={3}
          placeholder={t('settings.general.status.define.placeholder.desc')}
          value={desc}
          allowClear
          onChange={(e) => {
            setDesc(e.target.value);
          }}
          count={{
            show: true,
            max: 60,
          }}
        ></TextArea>
      </div>
      <div>
        <div className={styles.common_space}>{t('settings.general.status.define.icon')}:</div>
        <Radio.Group
          value={selectedIcon}
          size="large"
          onChange={(e) => {
            setSelectedIcon(e.target.value);
          }}
        >
          {status_icons.map((item, index) => (
            <Radio.Button value={item.key} key={index}>
              <SvgResource type="dot" svgSize={16} color={item.color}></SvgResource>
            </Radio.Button>
          ))}
        </Radio.Group>
      </div>
      <div>
        <div className={styles.common_space}>{t('settings.audio.volume')}:</div>
        <Slider
          value={volume}
          min={0.0}
          max={100.0}
          step={1}
          onChange={(e) => {
            setVolume(e);
          }}
        />
      </div>
      <div>
        <div className={styles.common_space}>{t('settings.video.video_blur')}:</div>
        <Slider
          className={`${styles.slider}`}
          value={videoBlur}
          min={0.0}
          max={1.0}
          step={0.05}
          onChange={(e) => {
            setVideoBlur(e);
          }}
        />
      </div>
      <div>
        <div className={styles.common_space}>{t('settings.video.screen_blur')}:</div>
        <Slider
          className={`${styles.slider}`}
          value={screenBlur}
          min={0.0}
          max={1.0}
          step={0.05}
          onChange={(e) => {
            setScreenBlur(e);
          }}
        />
      </div>

      <Button style={{ width: '100%', margin: '8px 0' }} type="primary" onClick={saveStatus}>
        {t('settings.general.status.define.save')}
      </Button>
    </div>
  );
}
