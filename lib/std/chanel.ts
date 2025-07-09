//! # use rxjs to do pub/sub pattern
//! when we using a control component like audio_toggle, the component should publish the state change to the receive component
//! the receive component should subscribe to the state change and update some other things.

// import { BehaviorSubject } from 'rxjs';
// import { AddDeviceInfo, ScreenFocus, State } from './device';

// export enum SubjectKey {
//   Audio = 'audio',
//   AudioState = 'audio_state',
//   Video = 'video',
//   VideoState = 'video_state',
//   Screen = 'screen',
//   ScreenState = 'screen_state',
//   Focus = 'focus',
//   Setting = 'setting',
// }

// // 初始化所有主题
// export const subject_map = new Map<SubjectKey, BehaviorSubject<any>>([
//   [SubjectKey.Audio, new BehaviorSubject<boolean>(true)],
//   [SubjectKey.AudioState, new BehaviorSubject<State>(State.Stop)],
//   [SubjectKey.Video, new BehaviorSubject<boolean>(true)],
//   [SubjectKey.VideoState, new BehaviorSubject<State>(State.Stop)],
//   [SubjectKey.Screen, new BehaviorSubject<boolean>(false)],
//   [SubjectKey.Focus, new BehaviorSubject<ScreenFocus>({})],
//   [SubjectKey.Setting, new BehaviorSubject<AddDeviceInfo | undefined>(undefined)],
//   [SubjectKey.ScreenState, new BehaviorSubject<State>(State.Stop)],
// ]);

// // 发布事件
// export function publisher<T>(key: SubjectKey, data: T): void {
//   const subject = subject_map.get(key);
//   if (subject) {
//     subject.next(data);
//   }
// }

// // 订阅事件
// export function subscriber<T>(key: SubjectKey, callback: (data: T) => void) {
//   const subject = subject_map.get(key);
//   if (subject) {
//     return subject.subscribe(callback);
//   }
//   return undefined;
// }
