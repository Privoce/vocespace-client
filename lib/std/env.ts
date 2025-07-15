export interface EnvConf {
  resolution:  '540p' | '720p' | '1080p' | '2k' | '4k';
  maxBitrate: number;
  maxFramerate: number;
  priority: RTCPriorityType;
}
