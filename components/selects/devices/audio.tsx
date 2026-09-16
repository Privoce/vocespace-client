import { Select } from 'antd';
import { MediaDeviceKind } from '@/lib/livekit/devices';
import { useMediaDevices } from '@livekit/components-react';
import { useEffect, useState } from 'react';
import { SelectPrefix } from '../prefix';

/**
 * ## 音频设备选择组件
 * 用于用户需要进行音频设备选择时使用。
 * 该组件会自动获取当前设备的音频输入设备列表，并将其显示在下拉框中，用户可以选择其中一个设备作为音频输入设备。
 * 该组件会在设备列表发生变化时自动更新。
 */
export function AudioSelect({ className }: { className?: string }) {
  const devices = useMediaDevices({
    kind: MediaDeviceKind.AudioInput,
  });

  const [active_audio, set_active_audio] = useState('');
  const [items, set_items] = useState<{ label: string; value: string }[]>([]);

  const select_active = (active: string) => {
    set_active_audio(active);
  };

  useEffect(() => {
    if (devices && devices.length > 0) {
      const validDevices = devices.filter((device) => device.deviceId !== '');
      if (validDevices.length > 0) {
        set_items(
          validDevices.map((device) => ({
            label: device.label,
            value: device.deviceId,
          })),
        );

        // 如果没有选中的设备，设置第一个为默认
        if (!active_audio) {
          set_active_audio(validDevices[0].label);
        }
      }
    }
  }, [devices]);

  return (
    <Select
      size="large"
      prefix={<SelectPrefix type="audio" color="#22CCEE" svgSize={16}></SelectPrefix>}
      className={className}
      defaultValue={active_audio}
      options={items}
      value={active_audio}
      onChange={select_active}
      style={{ width: '100%' }}
    ></Select>
  );
}
