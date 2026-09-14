
export interface Device {
  value: string;
  label: string;
}


export interface LiveKitDevice {
  deviceId: string;
  kind: MediaDeviceKind;
  label: string;
  groupId: string;
}


export enum MediaDeviceKind {
  AudioInput = 'audioinput',
  AudioOutput = 'audiooutput',
  VideoInput = 'videoinput',
}
