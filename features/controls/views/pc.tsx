import { DevicesSelector } from '@/app/api/devices/device_selector';
import { ChatToggle } from '@/app/pages/controls/toggles/chat_toggle';
import { MoreButton } from '@/app/pages/controls/toggles/more_button';
import { Work } from '@/app/pages/controls/widgets/work';
import { markExplicitLeaveIntent } from '@/lib/roomLeaveIntent';
import { MediaDeviceKind } from '@/lib/std/device';
import styles from '@/styles/controls.module.scss';
import {
  DisconnectButton,
  LeaveIcon,
  TrackToggle
} from '@livekit/components-react';
import { Popover } from 'antd';
import { Track } from 'livekit-client';
import type { useControls } from '../hooks/useControls';
import { renderDeviceMenuTrigger } from '../shared';
export type ControlsModel = ReturnType<typeof useControls>;
export function ControlsPC({ model }: { model: ControlsModel }) {
  const {
    controls,
    onDeviceError,
    updateSettings,
    spaceInfo,
    fetchSettings,
    setPermissionDevice,
    config,
    ref,
    t,
    chatMsg,
    controlLeftRef,
    controlWidth,
    isMobile,
    controlSize,
    visibleControls,
    showIcon,
    showText,
    browserSupportsScreenSharing,
    isScreenShareEnabled,
    audioMenuOpen,
    setAudioMenuOpen,
    videoMenuOpen,
    setVideoMenuOpen,
    onScreenShareChange,
    htmlProps,
    userChoices,
    saveAudioInputDeviceId,
    saveVideoInputDeviceId,
    space,
    microphoneOnChange,
    cameraOnChange,
    showAI,
    setOpenMore,
    setMoreType,
    uState,
    setSettingVis,
    isRecording,
    onClickRecord,
    chatOpen,
    setChatOpen,
    onClickApp,
    onClickAI,
    setWorkModalOpen,
    workEnabled,
    setWorkEnabled,
    startOrStopWork,
    lastAICutConfig,
    device,
  } = model;
  return <div {...htmlProps} className={styles.controls} style={{ marginBottom: 4 }}><div
    className={styles.controls_left}
    ref={controlLeftRef}
    style={{
      width: isMobile ? 'calc(100% - 64px)' : 'calc(100% - 100px)',
    }}
  >
    {visibleControls.microphone && (
      <div className="lk-button-group">
        <TrackToggle
          style={{ height: 46, padding: controlSize === 'small' ? 7 : 15 }}
          source={Track.Source.Microphone}
          showIcon={showIcon}
          onChange={microphoneOnChange}
          onDeviceError={(error) => {
            setPermissionDevice(Track.Source.Microphone);
            onDeviceError?.({ source: Track.Source.Microphone, error });
          }}
        >
          {showText && t('common.device.microphone')}
        </TrackToggle>
        <div className="lk-button-group-menu">
          <Popover
            trigger="click"
            open={audioMenuOpen}
            onOpenChange={setAudioMenuOpen}
            content={
              <DevicesSelector
                enabled={audioMenuOpen}
                kind={MediaDeviceKind.AudioInput}
                preferredDeviceId={userChoices.audioDeviceId}
                requestPermissions
                err={(error) => {
                  setPermissionDevice(Track.Source.Microphone);
                  onDeviceError?.({ source: Track.Source.Microphone, error });
                }}
                onDeviceChanged={(deviceId) => {
                  saveAudioInputDeviceId(deviceId ?? 'default');
                  setAudioMenuOpen(false);
                }}
              />
            }
            placement="top"
          >
            {renderDeviceMenuTrigger()}
          </Popover>
        </div>
      </div>
    )}
    {visibleControls.camera && (
      <div className="lk-button-group">
        <TrackToggle
          style={{ height: 46, padding: controlSize === 'small' ? 7 : 15 }}
          source={Track.Source.Camera}
          showIcon={showIcon}
          onChange={cameraOnChange}
          onDeviceError={(error) => {
            setPermissionDevice(Track.Source.Camera);
            onDeviceError?.({ source: Track.Source.Camera, error });
          }}
        >
          {showText && t('common.device.camera')}
        </TrackToggle>
        <div className="lk-button-group-menu">
          <Popover
            trigger="click"
            open={videoMenuOpen}
            onOpenChange={setVideoMenuOpen}
            content={
              <DevicesSelector
                enabled={videoMenuOpen}
                kind={MediaDeviceKind.VideoInput}
                preferredDeviceId={userChoices.videoDeviceId}
                requestPermissions
                err={(error) => {
                  setPermissionDevice(Track.Source.Camera);
                  onDeviceError?.({ source: Track.Source.Camera, error });
                }}
                onDeviceChanged={(deviceId) => {
                  saveVideoInputDeviceId(deviceId ?? 'default');
                  setVideoMenuOpen(false);
                }}
              />
            }
            placement="top"
          >
            {renderDeviceMenuTrigger()}
          </Popover>
        </div>
      </div>
    )}
    {visibleControls.screenShare && browserSupportsScreenSharing && (
      <TrackToggle
        style={{ height: 46, padding: 15 }}
        source={Track.Source.ScreenShare}
        captureOptions={{ audio: uState.openShareAudio, selfBrowserSurface: 'include' }}
        showIcon={showIcon}
        onChange={onScreenShareChange}
        onDeviceError={(error) => {
          setPermissionDevice(Track.Source.ScreenShare);
          onDeviceError?.({ source: Track.Source.ScreenShare, error });
        }}
      >
        {showText &&
          (isScreenShareEnabled ? t('common.stop_share') : t('common.share_screen'))}
      </TrackToggle>
    )}
    {space && visibleControls.microphone && spaceInfo.ai.cut.enabled && showAI && (
      // <Reaction
      //   updateSettings={updateSettings}
      //   space={space.name}
      //   size={controlSize}
      //   controlWidth={controlWidth}
      //   spaceInfo={spaceInfo}
      // ></Reaction>

      <Work
        isStartWork={workEnabled}
        setIsStartWork={setWorkEnabled}
        setOpenModal={setWorkModalOpen}
        showText={showText}
        size={controlSize}
        controlWidth={controlWidth}
        spaceInfo={spaceInfo}
        space={space.name}
        startOrStopWork={startOrStopWork}
        localParticipant={space.localParticipant}
        lastAICutConfig={lastAICutConfig}
      ></Work>
    )}
    {visibleControls.chat && !isMobile && (
      <ChatToggle
        controlWidth={controlWidth}
        enabled={chatOpen}
        onClicked={() => {
          setChatOpen(!chatOpen);
        }}
        count={chatMsg.unhandled}
      ></ChatToggle>
    )}
    {space && spaceInfo.participants && (
      <MoreButton
        space={space}
        spaceInfo={spaceInfo}
        config={config}
        size={controlSize}
        controlWidth={controlWidth}
        setOpenMore={setOpenMore}
        setMoreType={setMoreType}
        onSettingOpen={async () => {
          setSettingVis(true);
        }}
        onClickAI={onClickAI}
        onClickRecord={onClickRecord}
        onClickManage={fetchSettings}
        onClickApp={onClickApp}
        isRecording={isRecording}
        chat={
          isMobile
            ? {
              visible: visibleControls.chat || false,
              enabled: chatOpen,
              count: chatMsg.unhandled,
              onClicked: () => {
                setChatOpen(!chatOpen);
              },
            }
            : undefined
        }
      ></MoreButton>
    )}
  </div>{visibleControls.leave && (
    <DisconnectButton style={{ height: 46 }} onClick={() => markExplicitLeaveIntent()}>
      {showIcon && <LeaveIcon />}
      {showText && t('common.leave')}
    </DisconnectButton>
  )}</div>;
}
