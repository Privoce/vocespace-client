import { useEffect, useRef } from 'react';
import { findNodeHandle, NativeModules, Platform, View } from 'react-native';
import { ScreenCapturePickerView } from '@livekit/react-native-webrtc';
import type { NativeRoom } from './room';
/** Native picker is mounted before the explicit, authorized screen-share action. */
export function ScreenSharePicker({ room }: { room: NativeRoom }) {
  const ref = useRef(null);
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    room.showScreenPicker = async () => {
      const tag = findNodeHandle(ref.current);
      if (!tag || !NativeModules.ScreenCapturePickerViewManager)
        throw new Error('SCREEN_EXTENSION_REQUIRED');
      await NativeModules.ScreenCapturePickerViewManager.show(tag);
    };
    return () => {
      room.showScreenPicker = undefined;
    };
  }, [room]);
  return Platform.OS === 'ios' ? (
    <View style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }} pointerEvents="none">
      <ScreenCapturePickerView ref={ref} />
    </View>
  ) : null;
}
