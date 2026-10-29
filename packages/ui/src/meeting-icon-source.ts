import type { MeetingIconProps } from './types';
import { settingsIcons, settingsVector, type SettingsIconName } from './settings-icons';
import { meetingVector, type MeetingVectorName } from './meeting-icons';
import { svgResource } from './svg-resource';
export const meetingIconSources = {
  block: 'block',
  flag: 'flag',
  microphone: 'microphone',
  camera: 'camera',
  screen: 'lkScreen',
  chat: 'chat',
  more: 'more2',
  leave: 'lkLeave',
  copy: 'copy',
  link: 'link',
  members: 'user',
  close: 'close',
  send: 'send',
  hand: 'hand',
  host: 'host',
  settings: 'setting',
  file: 'file',
  back: 'back',
  menu: 'menu',
  fullscreen: 'fullscreen',
  fullscreenExit: 'fullscreenExit',
  focus: 'lkFocus',
  unfocus: 'unfocus',
  app: 'app',
  avatar: 'smile',
  userAdd: 'user_add',
  room: 'public',
  space: 'space',
} as const;
/** Original Web resources; DOM and Native only differ in their SVG renderer. */
export function meetingIconSource({ name, size = 20, color = '#E7EDF5' }: MeetingIconProps) {
  const source = meetingIconSources[name];
  const node =
    source === 'host'
      ? svgResource({ type: 'host', svgSize: size, color })!
      : source in settingsIcons
        ? settingsVector(source as SettingsIconName, size, color)
        : meetingVector(source as MeetingVectorName, size, color);
  return {
    ...node,
    attrs: {
      ...node.attrs,
      viewBox: node.attrs.viewBox || (source === 'lkScreen' ? '0 0 20 16' : '0 0 16 16'),
      preserveAspectRatio: 'xMidYMid meet',
    },
  };
}
