import { Select } from 'antd';
import { MediaDeviceKind } from '@/lib/std/device';
import { useMediaDevices } from '@livekit/components-react';
import { useEffect, useState } from 'react';
import { SvgResource } from '@/app/resources/svg';

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
      prefix={<SvgResource type="audio" color="#22CCEE" svgSize={14}></SvgResource>}
      className={className}
      size="large"
      defaultValue={active_audio}
      options={items}
      value={active_audio}
      onChange={select_active}
      style={{ width: '100%' }}
    ></Select>
  );
}
