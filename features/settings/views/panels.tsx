import { AboutUs } from '@/app/pages/controls/settings/about_us';
import { AISettings } from '@/app/pages/controls/settings/ai';
import { AppSettings } from '@/app/pages/controls/settings/app';
import { AudioSettings } from '@/app/pages/controls/settings/audio';
import { AuthSettings } from '@/app/pages/controls/settings/auth';
import { GeneralSettings } from '@/app/pages/controls/settings/general';
import { LicenseControl } from '@/app/pages/controls/settings/license';
import { ProfileSettings } from '@/app/pages/controls/settings/profile';
import { TabItem } from '@/app/pages/controls/settings/tab_item';
import { VideoSettings } from '@/app/pages/controls/settings/video';
import { RecordingTable } from '@/app/recording/table';
import { ParticipantAvoParams } from '@/lib/std/space';
import { ReloadOutlined } from '@ant-design/icons';
import { Button, TabsProps, Tag } from 'antd';
import type { useSettings } from '../hooks/useSettings';
export type SettingsModel = ReturnType<typeof useSettings>;
export function getSettingsPanels(model: SettingsModel) {
  const {
    close,
    key,
    updateSettings,
    messageApi,
    space,
    localParticipant,
    spaceInfo,
    showAI,
    t,
    username,
    setUsername,
    appendStatus,
    uState,
    volume,
    setVolume,
    videoBlur,
    setVideoBlur,
    screenBlur,
    setScreenBlur,
    virtualEnabled,
    setVirtualEnabled,
    modelRole,
    setModelRole,
    modelBg,
    setModelBg,
    openShareAudio,
    setOpenShareAudio,
    openPromptSound,
    setOpenPromptSound,
    noiseSuppression,
    setNoiseSuppression,
    echoCancellation,
    setEchoCancellation,
    autoGainControl,
    setAutoGainControl,
    compare,
    setCompare,
    virtualSettingsRef,
    env,
    isConnected,
    recordsData,
    setRecordsData,
    searchRoomRecords,
  } = model;
  const items: TabsProps['items'] = [
    {
      key: 'general',
      label: <TabItem type="setting" label={t('settings.general.title')}></TabItem>,
      children: (
        <GeneralSettings
          space={space.name}
          localParticipant={localParticipant}
          messageApi={messageApi}
          appendStatus={appendStatus}
          openPromptSound={openPromptSound}
          setOpenPromptSound={setOpenPromptSound}
          spaceInfo={spaceInfo}
        ></GeneralSettings>
      ),
    },
    {
      key: "profile",
      label: <TabItem type="smile" label={t('settings.profile.title')}></TabItem>,
      children: <ProfileSettings
        username={username}
        setUsername={setUsername}
        avoList={uState.avoList}
        onSave={(params: ParticipantAvoParams[]) => { void updateSettings({ avoList: params }); }}
      ></ProfileSettings>
    },
    {
      key: 'auth',
      label: <TabItem type="auth" label={t('settings.auth.title')}></TabItem>,
      children: <AuthSettings spaceInfo={spaceInfo} space={space} messageApi={messageApi}></AuthSettings>,
    },
    ...(showAI
      ? [
        {
          key: 'ai',
          label: <TabItem type="ai" svgSize={16} label={t('settings.ai.title')}></TabItem>,
          children: (
            <AISettings
              space={space}
              messageApi={messageApi}
              spaceInfo={spaceInfo}
              localParticipant={localParticipant}
              updateSettings={updateSettings}
            ></AISettings>
          ),
        },
      ]
      : []),
    {
      key: 'audio',
      label: <TabItem type="audio" label={t('settings.audio.title')}></TabItem>,
      children: (
        <AudioSettings
          volume={volume}
          setVolume={setVolume}
          noiseSuppression={noiseSuppression}
          setNoiseSuppression={setNoiseSuppression}
          echoCancellation={echoCancellation}
          setEchoCancellation={setEchoCancellation}
          autoGainControl={autoGainControl}
          setAutoGainControl={setAutoGainControl}
          localParticipant={localParticipant}
        ></AudioSettings>
      ),
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
            space: space.name,
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
          spaceName={space.name}
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
            currentRoom={space.name}
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
      children: (
        <LicenseControl
          messageApi={messageApi}
          space={space.name}
        ></LicenseControl>
      ),
    },
    {
      key: 'about_us',
      label: <TabItem type="logo" label={t('settings.about_us.title')}></TabItem>,
      children: <AboutUs></AboutUs>,
    },
  ];
  return items;
}
