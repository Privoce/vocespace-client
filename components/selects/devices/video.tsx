import { Select } from 'antd';
import { MediaDeviceKind } from '@/lib/livekit/devices';
import { useMediaDevices } from '@livekit/components-react';
import { useEffect, useState } from 'react';
import { SelectPrefix } from '../prefix';

/**
 * ## 视频设备选择组件
 * - 用于选择视频输入设备。
 * @param param0
 * @returns
 */
export function VideoSelect({ className }: { className?: string }) {
  // 获取所有视频输入设备
  const devices = useMediaDevices({
    kind: MediaDeviceKind.VideoInput,
  });

  const [activeVideo, setActiveVideo] = useState('');
  const [items, setItems] = useState<{ label: string; value: string }[]>([]);
  // 选择视频设备时的处理函数
  const selectActive = (active: string) => {
    setActiveVideo(active);
  };
  // 当设备列表变化时，更新选项，当没有选中的设备时，设置第一个设备为默认选中项
  useEffect(() => {
    if (devices && devices.length > 0) {
      const validDevices = devices.filter((device) => device.deviceId !== '');
      if (validDevices.length > 0) {
        setItems(
          validDevices.map((device) => ({
            label: device.label,
            value: device.deviceId,
          })),
        );

        // 如果没有选中的设备，设置第一个为默认
        if (!activeVideo) {
          setActiveVideo(validDevices[0].label);
        }
      }
    }
  }, [devices]);

  return (
    <Select
      size="large"
      prefix={<SelectPrefix type="video" color="#22CCEE" svgSize={16}></SelectPrefix>}
      className={className}
      defaultValue={activeVideo}
      options={items}
      value={activeVideo}
      onChange={selectActive}
      style={{ width: '100%' }}
    ></Select>
  );
}
