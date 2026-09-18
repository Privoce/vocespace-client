import { LangSelect } from '@/app/pages/controls/selects/lang_select';
import { LoginButtons } from '@/app/pages/pre_join/login';
import { src } from '@/lib/std';
import { ArrowLeftOutlined,AudioOutlined,UserOutlined,VideoCameraOutlined } from '@ant-design/icons';
import { MediaDeviceMenu } from '@livekit/components-react';
import { Button,Input,Modal,Slider,Spin } from 'antd';
import type { PreJoinModel } from '../hooks/use-pre-join';
import styles from './phone.module.scss';

export function PreJoinPhone(m: PreJoinModel) {
  const { t, permissions: p } = m;
  return (
    <div className={styles.page} data-device="phone">
      {m.contextHolder}
      <Spin spinning={m.spinning} fullscreen />
      <Modal open={p.permissionModalVisible} centered maskClosable={false}
        title={t('msg.request.device.pre_join.modal_title')}
        onCancel={p.continueWithoutPermissions}
        footer={<Button type="primary" onClick={p.requestMediaPermissions}>{t('msg.request.device.pre_join.allow_media')}</Button>}>
        <p>{t('msg.request.device.pre_join.modal_desc')}</p>
        {p.missingPermissions.length > 0 && <p>{t('msg.request.device.pre_join.current_permission_prefix')}{p.missingPermissions.join(t('msg.request.device.pre_join.permission_joiner'))}</p>}
      </Modal>
      <div className={styles.scroll}>
        <header className={styles.header}>
          <Button type="text" aria-label={t('msg.error.client.back')} icon={<ArrowLeftOutlined />} onClick={m.goHome} />
          <h1>{m.joinLabel}</h1><LangSelect />
        </header>
        <div className={styles.preview}>
          {m.videoTrack && m.videoEnabled
            ? <video ref={m.videoEl} autoPlay muted playsInline data-lk-facing-mode={m.facingMode} style={{ filter: `blur(${m.blurValue}px)` }} />
            : <><UserOutlined className={styles.avatar} /><p>{p.permissionPlaceholderText}</p>
              <Button type="link" icon={<VideoCameraOutlined />} onClick={() => p.handleVideoToggleChange(true)}>{m.camLabel}</Button></>}
        </div>
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <Button type="text" icon={<AudioOutlined />} aria-pressed={m.audioEnabled} onClick={() => p.handleAudioToggleChange(!m.audioEnabled)}>{m.micLabel}</Button>
            <MediaDeviceMenu kind="audioinput" initialSelection={m.audioDeviceId} tracks={{ audioinput: m.audioTrack }}
              disabled={!m.audioTrack} onActiveDeviceChange={(_, id) => m.setAudioDeviceId(id)} />
          </div>
          <div className={styles.cardBody}>
            <div className={styles.row}><span>{t('common.device.volume')}</span><span>{m.volume}</span></div>
            <Slider min={0} max={100} value={m.volume} onChange={m.changeVolume} />
            <audio ref={m.audio_play_ref} src={src('/audios/pre_test.mp3')} onEnded={() => m.setPlay(false)} />
            <Button className={styles.testButton} onClick={m.play_sound}>{t(m.play ? 'common.device.test.close_audio' : 'common.device.test.audio')}</Button>
          </div>
        </section>
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <Button type="text" icon={<VideoCameraOutlined />} aria-pressed={m.videoEnabled} onClick={() => p.handleVideoToggleChange(!m.videoEnabled)}>{m.camLabel}</Button>
            <MediaDeviceMenu kind="videoinput" initialSelection={m.videoDeviceId} tracks={{ videoinput: m.videoTrack }}
              disabled={!m.videoTrack} onActiveDeviceChange={(_, id) => m.setVideoDeviceId(id)} />
          </div>
          <div className={styles.cardBody}>
            <div className={styles.row}><span>{t('common.device.blur')}</span><span>{Math.round(m.blur * 100)}%</span></div>
            <Slider min={0} max={1} step={0.01} value={m.blur} onChange={m.changeBlur} />
          </div>
        </section>
        {m.showLoginBtn && <div className={styles.login}><LoginButtons serverUrl={m.config.serverUrl} space={m.space} /></div>}
        <Input ref={m.inputRef} size="large" className={styles.name} name="username" aria-label={m.userLabel}
          placeholder={m.userLabel} value={m.username} autoComplete="nickname"
          onChange={(event) => m.setUsername(event.target.value)} onPressEnter={m.handleSubmit} />
      </div>
      <div className={styles.joinBar}>
        <Button type="primary" size="large" block loading={m.spinning} disabled={m.loading} onClick={m.handleSubmit}>{m.joinLabel}</Button>
      </div>
    </div>
  );
}
