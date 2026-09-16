import React from 'react';
import { Popover } from 'antd';
import { TrackToggle } from '@livekit/components-react';
import { Track } from 'livekit-client';
import { SizeType } from 'antd/es/config-provider/SizeContext';
import { MediaDeviceKind } from '@/lib/livekit/devices';
import { DevicesSelector } from '@/lib/livekit/device-selector';

interface MediaDeviceControlsProps {
  visibleMicrophone: boolean;
  visibleCamera: boolean;
  visibleScreenShare: boolean;
  browserSupportsScreenSharing: boolean;
  controlSize: SizeType;
  showIcon: boolean;
  showText: boolean;
  isScreenShareEnabled: boolean;
  openShareAudio: boolean;
  audioMenuOpen: boolean;
  setAudioMenuOpen: (open: boolean) => void;
  videoMenuOpen: boolean;
  setVideoMenuOpen: (open: boolean) => void;
  audioDeviceId?: string;
  videoDeviceId?: string;
  saveAudioInputDeviceId: (id: string) => void;
  saveVideoInputDeviceId: (id: string) => void;
  microphoneOnChange: (enabled: boolean, isUserInitiated: boolean) => void;
  cameraOnChange: (enabled: boolean, isUserInitiated: boolean) => void;
  onScreenShareChange: (enabled: boolean) => void;
  setPermissionDevice: (device: Track.Source) => void;
  onDeviceError?: (error: { source: Track.Source; error: Error }) => void;
  renderDeviceMenuTrigger: () => React.ReactNode;
  t: (key: string) => string;
}

export function MediaDeviceControls({
  visibleMicrophone,
  visibleCamera,
  visibleScreenShare,
  browserSupportsScreenSharing,
  controlSize,
  showIcon,
  showText,
  isScreenShareEnabled,
  openShareAudio,
  audioMenuOpen,
  setAudioMenuOpen,
  videoMenuOpen,
  setVideoMenuOpen,
  audioDeviceId,
  videoDeviceId,
  saveAudioInputDeviceId,
  saveVideoInputDeviceId,
  microphoneOnChange,
  cameraOnChange,
  onScreenShareChange,
  setPermissionDevice,
  onDeviceError,
  renderDeviceMenuTrigger,
  t,
}: MediaDeviceControlsProps) {
  return (
    <>
      {visibleMicrophone && (
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
                  preferredDeviceId={audioDeviceId}
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

      {visibleCamera && (
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
                  preferredDeviceId={videoDeviceId}
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

      {visibleScreenShare && browserSupportsScreenSharing && (
        <TrackToggle
          style={{ height: 46, padding: 15 }}
          source={Track.Source.ScreenShare}
          captureOptions={{ audio: openShareAudio, selfBrowserSurface: 'include' }}
          showIcon={showIcon}
          onChange={onScreenShareChange}
          onDeviceError={(error) => {
            setPermissionDevice(Track.Source.ScreenShare);
            onDeviceError?.({ source: Track.Source.ScreenShare, error });
          }}
        >
          {showText && (isScreenShareEnabled ? t('common.stop_share') : t('common.share_screen'))}
        </TrackToggle>
      )}
    </>
  );
}
