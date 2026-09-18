import { DevicesSelector } from '@/app/api/devices/device_selector';
import { MoreButton } from '@/app/pages/controls/toggles/more_button';
import { Work } from '@/app/pages/controls/widgets/work';
import { markExplicitLeaveIntent } from '@/lib/roomLeaveIntent';
import { MediaDeviceKind } from '@/lib/std/device';
import { DesktopOutlined, MessageOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { DisconnectButton, LeaveIcon, TrackToggle } from '@livekit/components-react';
import { Badge, Button, Popover, Tooltip } from 'antd';
import { Track } from 'livekit-client';
import type { useControls } from '../hooks/useControls';
import phone from './phone.module.scss';

export type ControlsModel = ReturnType<typeof useControls>;
function DeviceControl({ model, source }: { model: ControlsModel; source: Track.Source.Camera | Track.Source.Microphone }) {
  const camera = source === Track.Source.Camera;
  const { t, visibleControls, onDeviceError, setPermissionDevice, userChoices } = model;
  const allowed = camera ? visibleControls.camera : visibleControls.microphone;
  const open = camera ? model.videoMenuOpen : model.audioMenuOpen;
  const setOpen = camera ? model.setVideoMenuOpen : model.setAudioMenuOpen;
  const onError = (error: Error) => { setPermissionDevice(source); onDeviceError?.({ source, error }); };
  const label = t(camera ? 'common.device.camera' : 'common.device.microphone');
  return <div className={phone.action}>
    <div className="lk-button-group">
      <TrackToggle source={source} showIcon disabled={!allowed} aria-label={label}
        onChange={camera ? model.cameraOnChange : model.microphoneOnChange} onDeviceError={onError} />
      {allowed && <div className="lk-button-group-menu"><Popover trigger="click" open={open} onOpenChange={setOpen} placement="top"
        content={<DevicesSelector enabled={open} kind={camera ? MediaDeviceKind.VideoInput : MediaDeviceKind.AudioInput}
          preferredDeviceId={camera ? userChoices.videoDeviceId : userChoices.audioDeviceId} requestPermissions err={onError}
          onDeviceChanged={id => { (camera ? model.saveVideoInputDeviceId : model.saveAudioInputDeviceId)(id ?? 'default'); setOpen(false); }} />}>
        <button type="button" className="lk-button lk-button-menu" aria-label={label} />
      </Popover></div>}
    </div>
    <span>{label}</span>
  </div>;
}
export function ControlsPhone({ model }: { model: ControlsModel }) {
  const { t, space, spaceInfo, visibleControls, chatMsg, chatOpen, setChatOpen, browserSupportsScreenSharing } = model;
  return <div {...model.htmlProps} className={phone.toolbar} ref={model.controlLeftRef} aria-label={t('common.setting')}>
    <DeviceControl model={model} source={Track.Source.Microphone} />
    <DeviceControl model={model} source={Track.Source.Camera} />
    <div className={phone.action}>
      {visibleControls.screenShare && browserSupportsScreenSharing ? <TrackToggle source={Track.Source.ScreenShare} showIcon
        aria-label={t('common.share_screen')} captureOptions={{ audio: model.uState.openShareAudio, selfBrowserSurface: 'include' }}
        onChange={model.onScreenShareChange} onDeviceError={error => { model.setPermissionDevice(Track.Source.ScreenShare); model.onDeviceError?.({ source: Track.Source.ScreenShare, error }); }} />
        : <Tooltip title={t('common.screen_share_unavailable')}><Button disabled aria-label={t('common.screen_share_unavailable')} icon={<DesktopOutlined />} /></Tooltip>}
      <span>{t('common.device.screen')}</span>
    </div>
    {visibleControls.chat && <div className={phone.action}>
      <Badge count={chatMsg.unhandled} size="small"><Button aria-label={t('common.chat')} aria-pressed={chatOpen} icon={<MessageOutlined />} onClick={() => setChatOpen(!chatOpen)} /></Badge>
      <span>{t('common.chat')}</span>
    </div>}
    {space && <div className={phone.action}>
      <MoreButton space={space} spaceInfo={spaceInfo} config={model.config} size="small" controlWidth={model.controlWidth}
        setOpenMore={model.setOpenMore} setMoreType={model.setMoreType} onSettingOpen={async () => model.setSettingVis(true)}
        onClickAI={model.onClickAI} onClickRecord={model.onClickRecord} onClickManage={model.fetchSettings} onClickApp={model.onClickApp} isRecording={model.isRecording} />
      <span>{t('more.title')}</span>
    </div>}
    {visibleControls.leave && <div className={`${phone.action} ${phone.leave}`}>
      <DisconnectButton aria-label={t('common.leave')} onClick={() => markExplicitLeaveIntent()}><LeaveIcon /></DisconnectButton><span>{t('common.leave')}</span>
    </div>}
    {space && visibleControls.microphone && spaceInfo.ai.cut.enabled && model.showAI && <Popover trigger="click" content={<>
      <Work isStartWork={model.workEnabled} setIsStartWork={model.setWorkEnabled} setOpenModal={model.setWorkModalOpen}
        showText size="small" controlWidth={model.controlWidth} spaceInfo={spaceInfo} space={space.name}
        startOrStopWork={model.startOrStopWork} localParticipant={space.localParticipant} lastAICutConfig={model.lastAICutConfig} />
      <Button onClick={model.onClickAI}>{t('ai.cut.title')}</Button>
    </>}><Button className={phone.work} aria-label={t('ai.cut.title')} icon={<ThunderboltOutlined />} /></Popover>}
  </div>;
}
