import { Button, List, Tabs, TabsProps } from 'antd';
import styles from '@/styles/controls.module.scss';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { MessageInstance } from 'antd/es/message/interface';
import { loadVideo, useVideoBlur } from '@/lib/std/device';
import { ModelBg, ModelRole } from '@/lib/std/virtual';
import { SvgResource } from '@/app/resources/svg';
import { useI18n } from '@/lib/i18n/i18n';
import VirtualRoleCanvas from '@/app/pages/virtual_role/live2d';
import { src } from '@/lib/std';
import { useRecoilState } from 'recoil';
import { socket, virtualMaskState } from '@/app/[spaceName]/PageClientImpl';
import { LocalParticipant } from 'livekit-client';
import { TabItem } from './tab_item';
import { SelectedMask } from './mask';

export interface VirtualSettingsProps {
  enabled: boolean;
  setEnabled: (e: boolean) => void;
  modelRole: ModelRole;
  setModelRole: (e: ModelRole) => void;
  modelBg: ModelBg;
  setModelBg: (e: ModelBg) => void;
  compare: boolean;
  setCompare: (e: boolean) => void;
  close: boolean;
  blur: number;
  space: string;
  localParticipant: LocalParticipant;
  messageApi: MessageInstance;
}

export interface VirtualSettingsExports {
  removeVideo: () => void;
  startVideo: () => Promise<void>;
}

export const VirtualSettings = forwardRef<VirtualSettingsExports, VirtualSettingsProps>(
  (
    {
      close,
      blur,
      messageApi,
      enabled,
      setEnabled,
      modelRole,
      setModelRole,
      modelBg,
      setModelBg,
      compare,
      setCompare,
      space,
      localParticipant,
    }: VirtualSettingsProps,
    ref,
  ) => {
    const { t } = useI18n();
    const videoRef = useRef<HTMLVideoElement>(null);
    const [model_selected_index, set_model_selected_index] = useState(0);
    const [bg_selected_index, set_bg_selected_index] = useState(0);
    const [showBlur, setShowBlur] = useState(true);
    const [virtualMask, setVirtualMask] = useRecoilState(virtualMaskState);
    const { blurValue, setVideoBlur } = useVideoBlur({
      videoRef,
      initialBlur: blur,
    });

    const reloadVirtual = () => {
      socket.emit('reload_virtual', {
        identity: localParticipant.identity,
        roomId: space,
        reloading: true,
      });
    };

    useEffect(() => {
      setVideoBlur(blur);
    }, [blur]);

    useEffect(() => {
      if (modelRole != ModelRole.None) {
        setEnabled(true);
      } else {
        setEnabled(false);
      }
    }, [modelRole]);
    useEffect(() => {
      if (close && videoRef.current && !videoRef.current.srcObject) {
        loadVideo(videoRef);
        if (modelRole != ModelRole.None) {
          setVirtualMask(true);
          reloadVirtual();
          setCompare(true);
        }
      }
    }, [videoRef, close]);

    const modelDatas = [
      {
        name: 'None',
        src: 'none.png',
      },
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
        label: <TabItem type="model" label={t('settings.virtual.tab.model')}></TabItem>,
        children: (
          <div>
            <h4>{t('settings.virtual.model')}</h4>
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
                      reloadVirtual();
                      set_model_selected_index(index);
                      setModelRole(item.name as ModelRole);
                      setVirtualMask(true);
                      if (compare && item.name != ModelRole.None) {
                        // 这里需要将外部视频进行遮罩
                        setCompare(false);
                        setTimeout(() => {
                          setCompare(true);
                        }, 200);
                      } else if (item.name == ModelRole.None) {
                        setCompare(false);
                      } else {
                        setCompare(true);
                      }
                    }}
                  >
                    {model_selected_index == index && <SelectedMask></SelectedMask>}
                    {/* <h4>{item.name}</h4> */}
                    {item.name == ModelRole.None ? (
                      <div
                        style={{
                          height: '120px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: '700',
                        }}
                      >
                        {t('settings.virtual.none')}
                      </div>
                    ) : (
                      <img src={src(`/images/models/${item.src}`)} alt="" />
                    )}
                  </div>
                </List.Item>
              )}
            />
          </div>
        ),
      },
      {
        key: 'background',
        label: <TabItem type="bg" label={t('settings.virtual.tab.background')}></TabItem>,
        children: (
          <div>
            <h4>{t('settings.virtual.background')}</h4>
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
                      reloadVirtual();
                      set_bg_selected_index(index);
                      setVirtualMask(true);
                      setModelBg(item.src as ModelBg);
                      if (compare && modelRole != ModelRole.None) {
                        setCompare(false);
                        setTimeout(() => {
                          setCompare(true);
                        }, 200);
                      } else if (modelRole == ModelRole.None && !compare) {
                        setCompare(false);
                      } else {
                        setCompare(true);
                      }
                    }}
                  >
                    {bg_selected_index == index && <SelectedMask></SelectedMask>}
                    {/* <h4>{item.name}</h4> */}
                    <img src={src(`/images/bg/${item.src}`)} alt="" />
                  </div>
                </List.Item>
              )}
            />
          </div>
        ),
      },
    ];

    const removeVideo = () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
        videoRef.current.srcObject = null;
      }
    };

    useImperativeHandle(ref, () => ({
      removeVideo,
      startVideo: async () => {
        await loadVideo(videoRef);
      },
    }));

    return (
      <div className={styles.virtual_settings}>
        <div className={styles.virtual_video_box}>
          {modelRole == ModelRole.None && (
            <div className={styles.virtual_video_box_compare}>
              <Button
                color="default"
                variant="solid"
                style={{ padding: '8px' }}
                onClick={() => {
                  if (modelRole != ModelRole.None) {
                    const val = !compare;
                    setCompare(val);
                  } else {
                    setShowBlur(!showBlur);
                  }
                }}
              >
                <SvgResource type="switch" color="#fff" svgSize={14}></SvgResource>
              </Button>
            </div>
          )}

          <video
            className={compare ? '' : styles.virtual_video_box_video}
            style={{
              visibility: compare ? 'hidden' : 'visible',
              filter: showBlur ? `blur(${blurValue}px)` : 'none',
              transition: 'filter 0.2s ease-in-out',
            }}
            ref={videoRef}
            playsInline
          />
          {compare && modelRole != ModelRole.None && (
            <div className={styles.virtual_video_box_canvas}>
              <VirtualRoleCanvas
                model_bg={modelBg}
                model_role={modelRole}
                enabled={compare}
                messageApi={messageApi}
                isLocal={true}
                isReplace={false}
                onReady={() => {}}
                onDestroy={() => {}}
              ></VirtualRoleCanvas>
            </div>
          )}
        </div>
        <Tabs
          defaultActiveKey="general"
          tabPosition="top"
          items={items}
          style={{ width: '100%', height: '100%' }}
        />
      </div>
    );
  },
);
