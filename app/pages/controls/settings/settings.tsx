import { Button, Tabs, TabsProps, Tag } from 'antd';
import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { MessageInstance } from 'antd/es/message/interface';
import { ModelBg, ModelRole } from '@/lib/std/virtual';
import { useI18n } from '@/lib/i18n/i18n';
import { isMobile, UserStatus } from '@/lib/std';
import { useRecoilState } from 'recoil';
import { userState } from '@/app/[spaceName]/PageClientImpl';
import { LocalParticipant } from 'livekit-client';
import { LicenseControl } from './license';
import { AudioSettings } from './audio';
import { GeneralSettings } from './general';
import { TabItem } from './tab_item';
import { VirtualSettingsExports } from './virtual';
import { VideoSettings } from './video';
import { AboutUs } from './about_us';
import { RecordingTable } from '@/app/recording/table';
import { RecordData, RecordResponse, useRecordingEnv } from '@/lib/std/recording';
import { ulid } from 'ulid';
import { ReloadOutlined } from '@ant-design/icons';
import { AppSettings } from './app';
import { SettingState, SpaceInfo } from '@/lib/std/space';

export interface SettingsProps {
  username: string;
  close: boolean;
  tab: {
    key: TabKey;
    setKey: (e: TabKey) => void;
  };
  messageApi: MessageInstance;
  setUserStatus?: (status: UserStatus | string) => Promise<void>;
  space: string;
  localParticipant: LocalParticipant;
  spaceInfo: SpaceInfo;
}

export interface SettingsExports {
  username: string;
  removeVideo: () => void;
  startVideo: () => Promise<void>;
  setAppendStatus: (append: boolean) => void;
  state: SettingState;
}

export type TabKey =
  | 'general'
  | 'audio'
  | 'video'
  | 'screen'
  | 'about_us'
  | 'app'
  | 'recording'
  | 'license';

export const Settings = forwardRef<SettingsExports, SettingsProps>(
  (
    {
      close,
      username: uname,
      tab: { key, setKey },
      // saveChanges,
      messageApi,
      setUserStatus,
      space,
      localParticipant,
      spaceInfo,
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
      const response = await fetch(`${env?.server_host}/api/s3/${space}`);
      if (response.ok) {
        const { records, success }: RecordResponse = await response.json();
        if (success && records.length > 0) {
          let formattedRecords: RecordData[] = records.map((record) => ({
            ...record,
            id: ulid(), // 使用 ulid 生成唯一 ID
          }));

          setRecordsData(formattedRecords);
          messageApi.success(t('recording.search.success'));
          return;
        } else {
          messageApi.error(t('recording.search.error'));
          setRecordsData([]);
        }
      }
    };

    // useEffect(() => {
    //   setVolume(uState.volume);
    //   setVideoBlur(uState.blur);
    //   setScreenBlur(uState.screenBlur);
    //   setVirtualEnabled(uState.virtual.enabled);
    //   setModelRole(uState.virtual.role);
    //   setModelBg(uState.virtual.bg);
    //   setOpenShareAudio(uState.openShareAudio);
    //   setOpenPromptSound(uState.openPromptSound);
    // }, [uState]);

    const items: TabsProps['items'] = [
      {
        key: 'general',
        label: <TabItem type="setting" label={t('settings.general.title')}></TabItem>,
        children: (
          <GeneralSettings
            space={space}
            localParticipant={localParticipant}
            messageApi={messageApi}
            appendStatus={appendStatus}
            username={username}
            setUsername={setUsername}
            openPromptSound={openPromptSound}
            setOpenPromptSound={setOpenPromptSound}
            spaceInfo={spaceInfo}
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
              space,
              localParticipant,
            }}
          ></VideoSettings>
        ),
      },
      {
        key: 'app',
        label: <TabItem type="app" label={t('more.app.title')}></TabItem>,
        children: (
          <AppSettings
            spaceInfo={spaceInfo}
            localParticipant={localParticipant}
            spaceName={space}
            messageApi={messageApi}
          ></AppSettings>
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
              <Button size="small" icon={<ReloadOutlined />} onClick={searchRoomRecords}>
                {t('recording.fresh')}
              </Button>
            </div>
            <RecordingTable
              messageApi={messageApi}
              env={env}
              currentRoom={space}
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
        children: <LicenseControl messageApi={messageApi} space={space}></LicenseControl>,
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
      setAppendStatus,
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
