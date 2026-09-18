import { LangSelect } from '@/app/pages/controls/selects/lang_select';
import { LoginButtons,LoginStateBtn } from '@/app/pages/pre_join/login';
import { SvgResource } from '@/app/resources/svg';
import { src } from '@/lib/std';
import styles from '@/styles/pre_join.module.scss';
import { MediaDeviceMenu,TrackToggle } from '@livekit/components-react';
import { Button,Input,Modal,Skeleton,Slider,Space,Spin } from 'antd';
import { Track } from 'livekit-client';
import type { PreJoinModel } from '../hooks/use-pre-join';

export function PreJoinPC(m: PreJoinModel) {
  const { t, contextHolder, spinning, loading, data, config, space, micLabel, camLabel, userLabel,
    joinLabel, videoTrack, videoEnabled, videoEl, facingMode, blurValue, audioEnabled,
    audioDeviceId, audioTrack, setAudioDeviceId, volume, changeVolume, audio_play_ref,
    play_sound, play, setPlay, videoDeviceId, setVideoDeviceId, blur, changeBlur,
    showLoginBtn, inputRef, username, setUsername, handleSubmit } = m;
  const { permissionModalVisible, requestMediaPermissions, continueWithoutPermissions,
    missingPermissions, permissionPlaceholderText, handleAudioToggleChange, handleVideoToggleChange } = m.permissions;
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
          <Button type="primary" key={"request"} onClick={requestMediaPermissions}>
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
        {loading ? (
          <Skeleton.Node
            active
            style={{ height: `40px`, backgroundColor: '#333', width: '126px' }}
          ></Skeleton.Node>
        ) : (
          <LangSelect></LangSelect>
        )}
      </span>
      <div className={styles.view__video}>
        {videoTrack && videoEnabled && (
          <video autoPlay muted playsInline
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
            <p className={styles.view__video__permission}>{permissionPlaceholderText}</p>
          </div>
        )}
      </div>
      {loading ? (
        <div className={styles.view__controls}>
          <Space direction="vertical" size={'small'} style={{ width: '100%' }}>
            {[44, 136, 44, 92.4, 44, 44].map((h) => (
              <Skeleton.Input
                key={h}
                active
                style={{ height: `${h}px`, backgroundColor: '#333' }}
                block
              ></Skeleton.Input>
            ))}
          </Space>
        </div>
      ) : (
        <div className={styles.view__controls}>
          <div className={`${styles.view__controls__group} audio lk-button-group`}>
            <TrackToggle
              className={styles.view__controls__toggle}
              initialState={audioEnabled}
              source={Track.Source.Microphone}
              onChange={handleAudioToggleChange}
            >
              {micLabel}
            </TrackToggle>
            <div className="lk-button-group-menu">
              <MediaDeviceMenu
                initialSelection={audioDeviceId}
                kind="audioinput"
                disabled={!audioTrack}
                tracks={{ audioinput: audioTrack }}
                onActiveDeviceChange={(_, id) => setAudioDeviceId(id)}
              />
            </div>
          </div>
          <div className={styles.view__controls__group_volume}>
            <div className={styles.view__controls__group_volume__header}>
              <div className={styles.view__controls__group_volume__header__left}>
                <SvgResource type="volume" svgSize={18}></SvgResource>
                <span>{t('common.device.volume')}</span>
              </div>
              <span>{volume}</span>
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
          <div className={`${styles.view__controls__group} video lk-button-group`}>
            <TrackToggle
              className={styles.view__controls__toggle}
              initialState={videoEnabled}
              source={Track.Source.Camera}
              onChange={handleVideoToggleChange}
            >
              {camLabel}
            </TrackToggle>
            <div className="lk-button-group-menu">
              <MediaDeviceMenu
                initialSelection={videoDeviceId}
                kind="videoinput"
                disabled={!videoTrack}
                tracks={{ videoinput: videoTrack }}
                onActiveDeviceChange={(_, id) => setVideoDeviceId(id)}
              />
            </div>
          </div>
          <div className={styles.view__controls__group_volume}>
            <div className={styles.view__controls__group_volume__header}>
              <div className={styles.view__controls__group_volume__header__left}>
                <SvgResource type="video" svgSize={18}></SvgResource>
                <span>{t('common.device.blur')}</span>
              </div>
              <span>{Math.round(blur * 100.0)}%</span>
            </div>
            <Slider
              min={0.0}
              max={1.0}
              step={0.01}
              value={blur}
              onChange={changeBlur}
            ></Slider>
          </div>
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
      )}
      <LoginStateBtn data={data} />
    </div>
  );
}

