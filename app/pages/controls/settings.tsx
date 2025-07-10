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
    // const { env, state, isConnected } = useRecordingEnv(messageApi);
    const [recordsData, setRecordsData] = useState<RecordData[]>([]);
    // const [firstOpen, setFirstOpen] = useState(true);

    // const searchRoomRecords = async () => {

    //   console.warn('search -----');
    //   const response = await fetch(`${env?.server_host}/api/s3/${room}`);
    //   if (response.ok) {
    //     const { records, success }: RecordResponse = await response.json();
    //     if (success && records.length > 0) {
    //       let formattedRecords: RecordData[] = records.map((record) => ({
    //         ...record,
    //         id: ulid(), // 使用 ulid 生成唯一 ID
    //       }));

    //       setRecordsData(formattedRecords);
    //       messageApi.success('查找录制文件成功');
    //       return;
    //     } else {
    //       messageApi.error(
    //         '查找录制文件为空，请检查房间名是否正确，房间内可能没有录制视频文件或已经删除',
    //       );
    //       setRecordsData([]);
    //     }
    //   }
    // };

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
        disabled: true,
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
        disabled: true,
        label: <TabItem type="record" label={t('recording.title')}></TabItem>,
        children: (
          <div>
            {/* <div
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
                <Button size='small' icon={<ReloadOutlined />} onClick={searchRoomRecords}>
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
            ></RecordingTable> */}
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
          // if (k === "recording" && firstOpen) {
          //    searchRoomRecords();
          //    setFirstOpen(false);
          // }
        }}
      />
    );
  },
);