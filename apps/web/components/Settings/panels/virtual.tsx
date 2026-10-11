import { SettingsSelectedMask } from '@vocespace/ui';
import { Fragment } from 'react';
import { VirtualGalleryContent, VirtualGalleryItem, virtualModels, virtualBackgrounds } from '@vocespace/ui';
import { VirtualSettingsContent } from '@vocespace/ui';
import { settingsElements } from '../phone-content';
import { useLayoutDevice } from '@/lib/hooks/use-layout-device';
import { Button, Tabs, TabsProps } from 'antd';
import styles from '@/components/Controller/index.module.scss';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { MessageInstance } from 'antd/es/message/interface';
import { loadVideo, useVideoBlur } from '@/lib/std/device';
import { ModelBg, ModelRole } from '@/lib/std/virtual';
import { SvgResource } from '@/components/Icon/index';
import { useI18n } from '@/lib/i18n/i18n';
import VirtualRoleCanvas from '@/components/VirtualRole/live2d';
import { src } from '@/lib/std';
import { useRoomStore } from '@/lib/store';
import { socket } from '@/lib/realtime/socket';
import { LocalParticipant } from 'livekit-client';
import { TabItem } from './tabItem';

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
    const phoneSettings = useLayoutDevice() === 'phone';
    const videoRef = useRef<HTMLVideoElement>(null);
    const [model_selected_index, set_model_selected_index] = useState(0);
    const [bg_selected_index, set_bg_selected_index] = useState(0);
    const [showBlur, setShowBlur] = useState(true);
    const virtualMask = useRoomStore((s) => s.virtualMask);
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
          useRoomStore.getState().setVirtualMask(true);
          reloadVirtual();
          setCompare(true);
        }
      }
    }, [videoRef, close]);

    const modelDatas = virtualModels;

    const bgDatas = virtualBackgrounds;

    const items: TabsProps['items'] = [
      {
        key: 'model',
        label: <TabItem type="model" label={t('settings.virtual.tab.model')}></TabItem>,
        children: (phoneSettings ? (
          VirtualGalleryContent({
            elements: settingsElements,
            styles,
            t,
            title: t('settings.virtual.model'),
            children: modelDatas.map((item, index) => (
              <Fragment key={item.src}>
                {VirtualGalleryItem({
                  elements: settingsElements,
                  styles,
                  t,
                  onSelect: () => {
                    reloadVirtual();
                    set_model_selected_index(index);
                    setModelRole(item.name as ModelRole);
                    useRoomStore.getState().setVirtualMask(true);
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
                  },
                  selected: modelDatas.map((item, index) => (
                    <div
                      key={item.src}
                      className={styles.virtual_model_box}
                      onClick={() => {
                        reloadVirtual();
                        set_model_selected_index(index);
                        setModelRole(item.name as ModelRole);
                        useRoomStore.getState().setVirtualMask(true);
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
                  )),
                  preview: <img src={src(`/images/models/${item.src}`)} alt="" />,
                  noneLabel: item.name == ModelRole.None ? t('settings.virtual.none') : undefined,
                })}
              </Fragment>
            )),
          })
        ) : (
          <div>
            <h4>{t('settings.virtual.model')}</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
              {modelDatas.map((item, index) => (
                <div
                  key={item.src}
                  className={styles.virtual_model_box}
                  onClick={() => {
                    reloadVirtual();
                    set_model_selected_index(index);
                    setModelRole(item.name as ModelRole);
                    useRoomStore.getState().setVirtualMask(true);
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
              ))}
            </div>
          </div>
        )),
      },
      {
        key: 'background',
        label: <TabItem type="bg" label={t('settings.virtual.tab.background')}></TabItem>,
        children: (phoneSettings ? (
          VirtualGalleryContent({
            elements: settingsElements,
            styles,
            t,
            title: t('settings.virtual.background'),
            children: bgDatas.map((item, index) => (
              <Fragment key={item.src}>
                {VirtualGalleryItem({
                  elements: settingsElements,
                  styles,
                  t,
                  onSelect: () => {
                    reloadVirtual();
                    set_bg_selected_index(index);
                    useRoomStore.getState().setVirtualMask(true);
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
                  },
                  selected: bgDatas.map((item, index) => (
                    <div
                      key={item.src}
                      className={styles.virtual_model_box}
                      onClick={() => {
                        reloadVirtual();
                        set_bg_selected_index(index);
                        useRoomStore.getState().setVirtualMask(true);
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
                  )),
                  preview: <img src={src(`/images/bg/${item.src}`)} alt="" />,
                })}
              </Fragment>
            )),
          })
        ) : (
          <div>
            <h4>{t('settings.virtual.background')}</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
              {bgDatas.map((item, index) => (
                <div
                  key={item.src}
                  className={styles.virtual_model_box}
                  onClick={() => {
                    reloadVirtual();
                    set_bg_selected_index(index);
                    useRoomStore.getState().setVirtualMask(true);
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
              ))}
            </div>
          </div>
        )),
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

    if (phoneSettings)
      return VirtualSettingsContent({
        elements: settingsElements,
        styles,
        t,
        slots: {
          preview: (
            <>
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
            </>
          ),
          tabs: (
            <Tabs
              defaultActiveKey="general"
              tabPosition="top"
              items={items}
              style={{ width: '100%', height: '100%' }}
            />
          ),
        },
      });
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

VirtualSettings.displayName = 'VirtualSettings';

export function SelectedMask() {
  return SettingsSelectedMask({elements:settingsElements,styles,icon:<SvgResource type="check" svgSize={24} color="#22CCEE"/>});
}
