import { Card, Input, List, message, Slider, Switch, Tabs, TabsProps } from 'antd';
import { SvgResource, SvgType } from '../../pre_join/resources';
import styles from '@/styles/controls.module.scss';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import * as faceapi from 'face-api.js';
import { MessageInstance } from 'antd/es/message/interface';
import { loadVideo } from '@/lib/std/device';
import { ModelBg, ModelRole } from '@/lib/std/virtual';

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
  user: {
    username: string;
    save_username: (e: string) => void;
  };
  virtual: VirtualSettingsProps;
  tab_key: {
    key: TabKey;
    set_key: (e: TabKey) => void;
  };
  save_changes: (e: boolean, tab_key: TabKey) => void;
  messageApi: MessageInstance;
}

export interface SettingsExports {
  username: string;
}

export type TabKey = 'common' | 'audio' | 'video' | 'virtual' | 'about_us';

export const Settings = forwardRef<SettingsExports, SettingsProps>(
  (
    {
      microphone: {
        audio: { volume, set_volume },
      },
      camera: {
        video: { blur: video_blur, set_video_blur },
        screen: { blur: screen_blur, set_screen_blur },
        set_blur,
      },
      user,
      tab_key: { key, set_key },
      virtual: { enabled, set_enabled, model_role, set_model_role, model_bg, set_model_bg },
      save_changes,
      messageApi,
    }: SettingsProps,
    ref,
  ) => {
    const virtual_settings_ref = useRef<VirtualSettingsExports>(null);

    const [username, set_username] = useState(user.username);

    const items: TabsProps['items'] = [
      {
        key: 'common',
        label: <TabItem type="setting" label="Common"></TabItem>,
        children: (
          <div className={styles.setting_box}>
            <div>username:</div>
            <Input
              className={styles.common_space}
              value={username}
              onChange={(e: any) => {
                set_username(e.target.value);
              }}
            ></Input>
          </div>
        ),
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
                  save_changes(false, 'audio');
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
                  save_changes(false, 'video');
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
                  save_changes(false, 'video');
                }}
              />
            </div>
          </div>
        ),
      },
      {
        key: 'virtual',
        label: <TabItem type="user" label="Virtual"></TabItem>,
        children: (
          <VirtualSettings
            messageApi={messageApi}
            model_role={model_role}
            set_model_role={set_model_role}
            model_bg={model_bg}
            set_model_bg={set_model_bg}
            enabled={enabled}
            set_enabled={set_enabled}
          ></VirtualSettings>
        ),
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
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '16px' }}>
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

    useImperativeHandle(ref, () => ({
      username,
    }));

    return (
      <Tabs
        tabPosition="left"
        centered
        items={items}
        style={{ width: '100%', height: 'max-content' }}
        onChange={(k: string) => {
          set_key(k as TabKey);
        }}
      />
    );
  },
);
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

export interface VirtualSettingsProps {
  enabled: boolean;
  set_enabled: (e: boolean) => void;
  model_role: ModelRole;
  set_model_role: (e: ModelRole) => void;
  model_bg: ModelBg;
  set_model_bg: (e: ModelBg) => void;
}

export interface VirtualSettingsExports {}

export const VirtualSettings = forwardRef<
  VirtualSettingsExports,
  VirtualSettingsProps & { messageApi: MessageInstance }
>(
  (
    {
      messageApi,
      enabled,
      set_enabled,
      model_role,
      set_model_role,
      model_bg,
      set_model_bg,
    }: VirtualSettingsProps & { messageApi: MessageInstance },
    ref,
  ) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [trackingActive, setTrackingActive] = useState(false);
    const [model_selected_index, set_model_selected_index] = useState(0);
    const [bg_selected_index, set_bg_selected_index] = useState(0);
    // const [use, set_use] = useState(false);
    const [detector_ready, set_detector_ready] = useState(false);

    const modelDatas = [
      {
        name: 'Haru',
        src: 'Haru.png',
      },
      {
        name: 'Hiyori',
        src: 'Hiyori.png',
      },
      {
        name: 'Mao',
        src: 'Mao.png',
      },
      {
        name: 'Mark',
        src: 'Mark.png',
      },
      {
        name: 'Natori',
        src: 'Natori.png',
      },
      {
        name: 'Rice',
        src: 'Rice.png',
      },
      {
        name: 'Wanko',
        src: 'Wanko.png',
      },
    ];

    const bgDatas = [
      {
        name: 'Class Room',
        src: 'v_bg1.png',
      },
      {
        name: 'Waiting Space',
        src: 'v_bg2.jpg',
      },
      {
        name: 'Office',
        src: 'v_bg3.jpg',
      },
      {
        name: 'Leisure Space',
        src: 'v_bg4.jpg',
      },
      {
        name: 'Meeting Room',
        src: 'v_bg5.jpg',
      },
    ];

    const items: TabsProps['items'] = [
      {
        key: 'model',
        label: <TabItem type="model" label="Model"></TabItem>,
        children: (
          <div>
            <List
              grid={{
                gutter: 16,
                column: 3,
              }}
              dataSource={modelDatas}
              renderItem={(item, index) => (
                <List.Item>
                  <div
                    className={styles.virtual_model_box}
                    onClick={() => {
                      set_model_selected_index(index);
                      set_model_role(item.name as ModelRole);
                    }}
                  >
                    {model_selected_index == index && <SelectedMask></SelectedMask>}
                    <h4>{item.name}</h4>
                    <img
                      src={`${process.env.NEXT_PUBLIC_BASE_PATH}/images/models/${item.src}`}
                      alt=""
                    />
                  </div>
                </List.Item>
              )}
            />
          </div>
        ),
      },
      {
        key: 'background',
        label: <TabItem type="bg" label="Background"></TabItem>,
        children: (
          <div>
            <List
              grid={{
                gutter: 16,
                column: 3,
              }}
              dataSource={bgDatas}
              renderItem={(item, index) => (
                <List.Item>
                  <div
                    className={styles.virtual_model_box}
                    onClick={() => {
                      set_bg_selected_index(index)
                      set_model_bg(item.src as ModelBg)
                    }}
                  >
                    {bg_selected_index == index && <SelectedMask></SelectedMask>}
                    <h4>{item.name}</h4>
                    <img
                      src={`${process.env.NEXT_PUBLIC_BASE_PATH}/images/bg/${item.src}`}
                      alt=""
                    />
                  </div>
                </List.Item>
              )}
            />
          </div>
        ),
      },
    ];

    // 单次检测人脸，主要用于测试
    const detectFace = async (videoele: HTMLVideoElement) => {
      if (!detector_ready) {
        await new Promise<void>((resolve) => {
          const checkDetector = () => {
            if (detector_ready) {
              resolve();
            } else {
              console.log('等待检测器...');
              setTimeout(checkDetector, 2000);
            }
          };
          checkDetector();
        });
      }
      try {
        const detection = await faceapi.detectSingleFace(
          videoele,
          new faceapi.TinyFaceDetectorOptions(),
        );

        if (detection) {
          console.log('检测到人脸', detection);
          const { x, y, width, height } = detection.box;
          const centerX = x + width / 2;
          const centerY = y + height / 2;
          return { centerX, centerY };
        }
      } catch (e) {
        console.error('Failed to detect face:', e);
      }
      return null;
    };

    useEffect(() => {
      const loadFaceDetection = async () => {
        try {
          await faceapi.loadTinyFaceDetectorModel(
            `${process.env.NEXT_PUBLIC_BASE_PATH}/models/tiny_face_detector_model-weights_manifest.json`,
          );
          set_detector_ready(true);
        } catch (error) {
          messageApi.error('failed to load face detection model');
        }
      };
      loadFaceDetection();
      loadVideo(videoRef);
      return () => {
        if (videoRef.current && videoRef.current.srcObject) {
          const stream = videoRef.current.srcObject as MediaStream;
          stream.getTracks().forEach((track) => track.stop());
        }
      };
    }, [loadVideo]);

    // useImperativeHandle(ref, () => ({
    //   enabled: use,
    //   model_role: modelDatas[model_selected_index].name as ModelRole,
    //   model_bg: bgDatas[bg_selected_index].src as ModelBg,
    // }));

    return (
      <div className={styles.virtual_settings}>
        <div className={styles.virtual_settings_header}>
          <span>Use Virtual Model:</span>
          <Switch value={enabled} onClick={() => set_enabled(!enabled)}></Switch>
        </div>
        <div className={styles.virtual_video_box}>
          <div className={styles.virtual_video_box_preview}>
            <img
              className={styles.virtual_video_box_preview_model}
              src={`${process.env.NEXT_PUBLIC_BASE_PATH}/images/models/${modelDatas[model_selected_index].src}`}
              alt=""
            />
            <img
              className={styles.virtual_video_box_preview_bg}
              src={`${process.env.NEXT_PUBLIC_BASE_PATH}/images/bg/${bgDatas[bg_selected_index].src}`}
              alt=""
            />
          </div>
          <button
            className={styles.virtual_video_box_test_btn}
            onClick={async () => {
              // 执行一次人脸检测测试
              if (videoRef.current && videoRef.current.readyState >= 2) {
                const pos = await detectFace(videoRef.current);
                if (pos) {
                  messageApi.success('success to detect face');
                }
              } else {
                messageApi.error('video element is not ready');
              }
            }}
          >
            detect face
          </button>
          <video
            ref={videoRef}
            style={{
              border: trackingActive ? '2px solid #22CCEE' : '2px solid #efefef',
            }}
            playsInline
            muted
          />
        </div>
        <Tabs
          defaultActiveKey="common"
          tabPosition="top"
          items={items}
          style={{ width: '100%', height: '100%' }}
        />
      </div>
    );
  },
);

function SelectedMask() {
  return (
    <div className={styles.selected_mask}>
      <SvgResource type="check" svgSize={24} color="#44de4f"></SvgResource>
    </div>
  );
}
