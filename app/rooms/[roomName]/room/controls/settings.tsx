import { Slider, Tabs, TabsProps } from 'antd';
import { SvgResource, SvgType } from '../../pre_join/resources';
import styles from '@/styles/controls.module.scss';

export interface SettingsProps {
  microphone: {
    audio: {
      volume: number;
      set_volume: (e: number) => void;
    };
  };
  camera: {
    video: {
      blur: number;
      set_video_blur: (e: number) => void;
    };
    screen: {
      blur: number;
      set_screen_blur: (e: number) => void;
    };
    set_blur: (e: number) => void;
  };
  save_changes: (e: boolean) => void;
}

export function Settings({
  microphone: {
    audio: { volume, set_volume },
  },
  camera: {
    video: { blur: video_blur, set_video_blur },
    screen: { blur: screen_blur, set_screen_blur },
    set_blur,
  },
  save_changes,
}: SettingsProps) {
  const items: TabsProps['items'] = [
    {
      key: 'common',
      label: <TabItem type="setting" label="Common"></TabItem>,
      children: <div></div>,
    },
    {
      key: 'audio',
      label: <TabItem type="audio" label="Audio"></TabItem>,
      children: (
        <div>
          <div className={styles.setting_box}>
            <div>volume:</div>
            <Slider
              defaultValue={volume}
              className={styles.common_space}
              onChange={(e) => {
                set_volume(e);
                save_changes(false);
              }}
            />
          </div>
        </div>
      ),
    },
    {
      key: 'video',
      label: <TabItem type="video" label="Video"></TabItem>,
      children: (
        <div>
          <div className={styles.setting_box}>
            <span>Video Blur:</span>
            <Slider
              defaultValue={0.15}
              className={`${styles.common_space} ${styles.slider}`}
              value={video_blur}
              min={0.0}
              max={1.0}
              step={0.05}
              onChange={(e) => {
                set_video_blur(e);
                set_blur(e);
                save_changes(false);
              }}
            />
          </div>
          <div className={styles.setting_box}>
            <span>Screen Blur:</span>
            <Slider
              defaultValue={0.15}
              className={`${styles.common_space} ${styles.slider}`}
              value={screen_blur}
              min={0.0}
              max={1.0}
              step={0.05}
              onChange={(e) => {
                set_screen_blur(e);
                set_blur(e);
                save_changes(false);
              }}
            />
          </div>
        </div>
      ),
    },
    {
      key: 'virtual',
      label: <TabItem type="user" label="Virtual"></TabItem>,
      children: <div></div>,
    },
    {
      key: 'about_us',
      label: <TabItem type="logo" label="About Us"></TabItem>,
      children: (
        <div
          style={{
            display: 'flex',
            gap: '16px',
            alignItems: 'center',
            justifyContent: 'center',
            flexWrap: 'wrap',
          }}
        >
          <div style={{display: 'inline-flex', alignItems: 'center', gap: '16px'}}>
            <SvgResource type="logo" svgSize={64}></SvgResource>
            <span style={{ fontSize: '32px', color: '#fff', fontWeight: '700' }}>VoceSpace</span>
          </div>
          <div
            style={{ fontSize: '20px', fontWeight: '700', color: '#FFFFFF', textAlign: 'center' }}
          >
            Secure Video Calls Under Your Domain and Brand
          </div>
          <div style={{ textAlign: 'center' }}>
            We will help you host your own secure video and audio conferencing platform under your
            subdomain with your own logo and branding. Complete control over your data with
            enterprise-grade encryption.
          </div>
        </div>
      ),
    },
  ];

  return (
    <Tabs tabPosition="left" centered items={items} style={{ width: '100%', height: '100%' }} />
  );
}

export function TabItem({ type, label }: { type: SvgType; label: string }) {
  const tabStyles = {
    display: 'inline-flex',
    alignItems: 'center',
    width: '100%',
    height: '100%',
    justifyContent: 'space-between',
    gap: '6px',
  };

  return (
    <div style={tabStyles}>
      <SvgResource type={type} svgSize={14}></SvgResource>
      {label}
    </div>
  );
}
