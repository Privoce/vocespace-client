'use client';

import { LangSelect } from '@/app/pages/controls/selects/lang_select';
import { LoginButtons, LoginStateBtn } from '@/app/pages/pre_join/login';
import { SvgResource } from '@/app/resources/svg';
import { src } from '@/lib/std';
import styles from './index.module.scss';
import { MediaDeviceMenu } from '@livekit/components-react';
import { Button, Divider, Input, Modal, Skeleton, Slider, Space, Spin } from 'antd';
import { LocalVideoTrack } from 'livekit-client';
import type { PreJoinModel } from './hooks/UsePreJoin';
import { AudioMutedOutlined, AudioOutlined, VideoCameraOutlined } from '@ant-design/icons';

export function PreJoinPC(m: PreJoinModel) {
  const {
    t,
    contextHolder,
    spinning,
    loading,
    data,
    config,
    space,
    userLabel,
    joinLabel,
    videoTrack,
    videoEnabled,
    videoEl,
    facingMode,
    blurValue,
    showLoginBtn,
    inputRef,
    username,
    setUsername,
    handleSubmit,
  } = m;
  const {
    permissionModalVisible,
    requestMediaPermissions,
    continueWithoutPermissions,
    missingPermissions,
    permissionPlaceholderText,
  } = m.permissions;

  if (loading) {
    return <PageLoading></PageLoading>;
  }

  return (
    <div className={styles.view}>
      {contextHolder}
      <Spin spinning={spinning} fullscreen />
      <Modal
        open={permissionModalVisible}
        centered
        closable={true}
        maskClosable={false}
        title={t('msg.request.device.pre_join.modal_title')}
        onOk={requestMediaPermissions}
        onCancel={continueWithoutPermissions}
        footer={[
          <Button type="primary" key={'request'} onClick={requestMediaPermissions}>
            {t('msg.request.device.pre_join.allow_media')}
          </Button>,
        ]}
      >
        <div className={styles.view__permission_modal__content}>
          <p>{t('msg.request.device.pre_join.modal_desc')}</p>
          {missingPermissions.length > 0 && (
            <p>
              {t('msg.request.device.pre_join.current_permission_prefix')}
              {missingPermissions.join(t('msg.request.device.pre_join.permission_joiner'))}
            </p>
          )}
        </div>
      </Modal>
      <span className={styles.view__lang_select}>
        <LangSelect></LangSelect>
      </span>
      <PreJoinVideo
        videoTrack={videoTrack}
        videoEnabled={videoEnabled}
        videoEl={videoEl}
        facingMode={facingMode}
        blurValue={blurValue}
        permissionPlaceholderText={permissionPlaceholderText}
        m={m}
      />
      <div className={styles.view__controls}>
        <AudioGroupItem m={m} />
        <VideoGroupItem m={m} />
        {showLoginBtn && <LoginButtons serverUrl={config.serverUrl} space={space}></LoginButtons>}
        <Input
          ref={inputRef}
          size="large"
          style={{ width: '100%' }}
          id="username"
          name="username"
          type="text"
          placeholder={userLabel}
          value={username}
          onChange={(inputEl) => {
            setUsername(inputEl.target.value);
          }}
          autoComplete="off"
        />
        <button
          style={{ backgroundColor: '#22CCEE' }}
          className={styles.view__controls__form__button}
          disabled={spinning}
          type="submit"
          onClick={handleSubmit}
        >
          {joinLabel}
        </button>
      </div>
      <LoginStateBtn data={data} />
    </div>
  );
}

const PageLoading = () => {
  return (
    <div className={styles.view}>
      <span className={styles.view__lang_select}>
        <Skeleton.Node
          active
          style={{ height: '40px', backgroundColor: '#333', width: '126px' }}
        ></Skeleton.Node>
      </span>

      <div className={styles.view__video}>
        <Skeleton.Node active style={{ width: '100%', height: '100%', backgroundColor: '#222' }} />
      </div>

      <div className={styles.view__controls}>
        <Space direction="vertical" size={'small'} style={{ width: '100%' }}>
          {[136, 92.4, 44, 44, 44, 44].map((h) => (
            <Skeleton.Input
              key={h}
              active
              style={{ height: `${h}px`, backgroundColor: '#333' }}
              block
            ></Skeleton.Input>
          ))}
        </Space>
      </div>
    </div>
  );
};

const PreJoinVideo = ({
  videoTrack,
  videoEnabled,
  videoEl,
  facingMode,
  blurValue,
  permissionPlaceholderText,
  m,
}: {
  videoTrack: LocalVideoTrack | null;
  videoEnabled: boolean;
  videoEl: React.RefObject<HTMLVideoElement>;
  facingMode: string;
  blurValue: number;
  permissionPlaceholderText: string;
  m: PreJoinModel;
}) => {
  return (
    <div className={styles.view__video}>
      {videoTrack && videoEnabled && (
        <video
          autoPlay
          muted
          playsInline
          ref={videoEl}
          data-lk-facing-mode={facingMode}
          style={{
            height: '100%',
            width: '100%',
            filter: `blur(${blurValue}px)`,
          }}
        />
      )}
      {(!videoTrack || !videoEnabled) && (
        <div className={styles.view__video__placeholder}>
          <SvgResource type="user_lk" svgSize={64}></SvgResource>
          <p className={styles.view__video__permission}>{permissionPlaceholderText}</p>
          <Button
            shape='round'
            type="primary"
            icon={<VideoCameraOutlined />}
            style={{ fontSize: 14}}
            onClick={() => m.permissions.handleVideoToggleChange(true)}
          >
            {m.camLabel}
          </Button>
        </div>
      )}
    </div>
  );
};

const AudioGroupItem = ({ m }: { m: PreJoinModel }) => {
  const {
    t,
    micLabel,
    audioEnabled,
    audioDeviceId,
    audioTrack,
    setAudioDeviceId,
    volume,
    changeVolume,
    audio_play_ref,
    play_sound,
    play,
    setPlay,
  } = m;
  const { handleAudioToggleChange } = m.permissions;
  return (
    <div className={styles.view__controls__group_volume}>
      <div className={`${styles.view__controls__group} audio lk-button-group`}>
        <Button
          type="text"
          icon={audioEnabled ? <AudioOutlined /> : <AudioMutedOutlined />}
          aria-pressed={audioEnabled}
          onClick={() => handleAudioToggleChange(!audioEnabled)}
          style={{
            padding: 0,
            height: '100%',
            flex: 1,
            justifyContent: 'flex-start',
            color: audioEnabled ? '#22CCEE' : '#a0a0a0',
          }}
        >
          {micLabel}
        </Button>
        <div
          className="lk-button-group-menu"
          style={{ height: '100%', transform: 'translateX(-8px)' }}
        >
          <MediaDeviceMenu
            initialSelection={audioDeviceId}
            kind="audioinput"
            disabled={!audioTrack}
            tracks={{ audioinput: audioTrack }}
            onActiveDeviceChange={(_, id) => setAudioDeviceId(id)}
          />
        </div>
      </div>
      <Divider style={{ margin: '0 0 4px 0' }}></Divider>
      <div className={styles.view__controls__group_container}>
        <div className={styles.view__controls__group_volume__header}>
          <div className={styles.view__controls__group_volume__header__left}>
            {/* <SvgResource type="volume" svgSize={18}></SvgResource> */}
            <span>{t('common.device.volume')}</span>
          </div>
          <span style={{ fontSize: 14 }}>{volume}</span>
          <audio
            onEnded={() => setPlay(false)}
            ref={audio_play_ref}
            src={src('/audios/pre_test.mp3')}
            style={{ display: 'none' }}
          ></audio>
        </div>
        <Slider
          min={0.0}
          max={100.0}
          step={1}
          defaultValue={80}
          value={volume}
          onChange={changeVolume}
        ></Slider>
        <button
          style={{ backgroundColor: '#22CCEE' }}
          className={styles.view__controls__group_volume__button}
          onClick={play_sound}
        >
          {!play ? t('common.device.test.audio') : t('common.device.test.close_audio')}
        </button>
      </div>
    </div>
  );
};

const VideoGroupItem = ({ m }: { m: PreJoinModel }) => {
  const {
    t,
    camLabel,
    videoTrack,
    videoEnabled,
    videoDeviceId,
    setVideoDeviceId,
    blur,
    changeBlur,
  } = m;
  const { handleVideoToggleChange } = m.permissions;
  return (
    <div className={styles.view__controls__group_volume}>
      <div className={`${styles.view__controls__group} video lk-button-group`}>
        <Button
          type="text"
          icon={<VideoCameraOutlined />}
          aria-pressed={videoEnabled}
          onClick={() => handleVideoToggleChange(!videoEnabled)}
          style={{
            padding: 0,
            height: '100%',
            flex: 1,
            justifyContent: 'flex-start',
            color: videoEnabled ? '#22CCEE' : '#a0a0a0',
          }}
        >
          {camLabel}
        </Button>
        <div
          className="lk-button-group-menu"
          style={{ height: '100%', transform: 'translateX(-8px)' }}
        >
          <MediaDeviceMenu
            initialSelection={videoDeviceId}
            kind="videoinput"
            disabled={!videoTrack}
            tracks={{ videoinput: videoTrack }}
            onActiveDeviceChange={(_, id) => setVideoDeviceId(id)}
          />
        </div>
      </div>
      <Divider style={{ margin: '0 0 4px 0' }}></Divider>
      <div className={styles.view__controls__group_container}>
        <div className={styles.view__controls__group_volume__header}>
          <div className={styles.view__controls__group_volume__header__left}>
            {/* <SvgResource type="video" svgSize={18}></SvgResource> */}
            <span>{t('common.device.blur')}</span>
          </div>
          <span style={{ fontSize: 14 }}>{Math.round(blur * 100.0)}%</span>
        </div>
        <Slider min={0.0} max={1.0} step={0.01} value={blur} onChange={changeBlur}></Slider>
      </div>
    </div>
  );
};