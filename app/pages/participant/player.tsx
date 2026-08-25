'use client';
import { SvgResource } from '@/app/resources/svg';
import { api } from '@/lib/api';
import { uploadIframeUrl } from '@/lib/api/space';
import { useI18n } from '@/lib/i18n/i18n';
import { FileType } from '@/lib/std';
import {
  FileImageOutlined,
  FullscreenExitOutlined,
  FullscreenOutlined,
  GlobalOutlined,
  LayoutOutlined,
  MessageOutlined,
} from '@ant-design/icons';
import { AutoComplete, Button, Image, Modal, Spin, Tooltip, Upload } from 'antd';
import { MessageInstance } from 'antd/es/message/interface';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { APP_FLOT_PIN_STYLE } from '../apps/app_pin';
import {
  FocusToggleIcon,
  UnfocusToggleIcon,
  useMaybeLayoutContext,
} from '@livekit/components-react';
import { socket } from '@/app/[spaceName]/PageClientImpl';
import { WsTilePlayer } from '@/lib/std/device';
import { handleIdentityType, SpaceInfo } from '@/lib/std/space';
import { useSpaceStore, useRoomStore } from '@/lib/store';
import { Participant, Track } from 'livekit-client';
import styles from '@/styles/player.module.scss';

// ─── 共享类型 ─────────────────────────────────────────────────────────────────

export interface TilePlayerItem {
  id: string;
  ownerId: string;
  mode: 'image' | 'iframe' | 'hyperbeam';
  url?: string | null;
  fileName?: string | null;
  iframeUrl?: string | null;
  createdAt: number;
  updatedAt: number;
}

type ShadowDeskUserInfo = {
  userId: string;
  username: string;
  isOwner: boolean;
};

type ShadowDeskEnvelope<T> = {
  type: string;
  data?: T;
} & Partial<T>;

const SHADOW_DESK_MARK = 'shadowdesk';
const SHADOW_DESK_USER_INFO_TYPE = 'user-info';
const SHADOW_DESK_USER_INFO_ACK_TYPE = 'user-info-ack';
const SHADOW_DESK_CONTROL_CHANGE_TYPE = 'user-control-change';
const SHADOW_DESK_MAX_RETRY = 10;
const SHADOW_DESK_RETRY_INTERVAL = 10000;

function isShadowDeskUrl(url: string): boolean {
  return url.toLowerCase().includes(SHADOW_DESK_MARK);
}

function getShadowDeskOrigin(url: string): string {
  try {
    return new URL(url, window.location.href).origin;
  } catch {
    return '*';
  }
}

function getShadowDeskPayloadUserId(payload: unknown): string | undefined {
  if (!payload || typeof payload !== 'object') {
    return undefined;
  }

  const maybeRecord = payload as { userId?: unknown; data?: { userId?: unknown } };
  if (typeof maybeRecord.userId === 'string') {
    return maybeRecord.userId;
  }

  if (typeof maybeRecord.data?.userId === 'string') {
    return maybeRecord.data.userId;
  }

  return undefined;
}

// ─── 单个 TilePlayer（显示一张图或一个 iframe）───────────────────────────────

export interface TilePlayerProps {
  item: TilePlayerItem;
  spaceName: string;
  room?: string;
  myIdentity: string;
  messageApi: MessageInstance;
  setFocus?: React.Dispatch<React.SetStateAction<boolean>>;
  focus?: boolean;
  afterFocus?: (focus: boolean) => void;
  onRemoved?: () => void;
  spaceInfo: SpaceInfo;
}

export const TilePlayer = ({
  item,
  spaceName,
  room,
  myIdentity,
  messageApi,
  setFocus,
  focus,
  afterFocus,
  onRemoved,
  spaceInfo,
}: TilePlayerProps) => {
  const [toolVis, setToolVis] = useState(false);
  const layoutContext = useMaybeLayoutContext();
  const setCollapsed = useSpaceStore((state) => state.setCollapsed);
  const isFullScreen = useSpaceStore((state) => state.isFullScreen);
  const setIsFullScreen = useSpaceStore((state) => state.setIsFullScreen);
  // 是否可以被删除，只有RBAC允许或者自己的卡片才可以被删除
  const canDelete = useMemo(() => {
    if (!spaceInfo?.auth) return item.ownerId === myIdentity;
    let auth = handleIdentityType(spaceInfo.participants[myIdentity]?.auth?.identity || 'guest');
    const canDeleteRBAC = spaceInfo.auth[auth]?.managePlayer || false;

    if (item.ownerId === myIdentity) {
      return true;
    } else {
      return canDeleteRBAC;
    }
  }, [spaceInfo?.auth, myIdentity]);

  const removePlayer = async () => {
    try {
      const response = await api.handleTilePlayerFile(
        spaceName,
        room,
        'rm',
        undefined,
        undefined,
        myIdentity,
        item.id,
      );
      if (response.ok) {
        socket.emit('tile_player_change', {
          ty: item.mode,
          created: false,
          playerId: item.id,
          ownerId: myIdentity,
          action: 'remove',
          participantId: myIdentity,
          space: spaceName,
        } as WsTilePlayer);
        onRemoved?.();
      } else if (response.status === 403) {
        messageApi.error({ content: 'You can only remove your own tile', duration: 2 });
      }
    } catch (error) {
      console.error('Error removing player:', error);
    }
  };

  const showFullScreen =
    item.mode === 'iframe' || item.mode === 'hyperbeam' || item.mode === 'image';
  const isActiveView = !!focus || !!isFullScreen;

  const handleFullScreen = () => {
    const nextIsFullScreen = !isFullScreen;
    const playerTrackReference = {
      participant: new Participant(
        `${spaceName}_player_${item.id}`,
        `${spaceName}_player_${item.id}`,
        `${spaceName}_player_${item.id}`,
      ),
      source: Track.Source.Unknown,
    };
    const isPinned =
      layoutContext?.pin.state?.some(
        (pinnedTrackReference) =>
          pinnedTrackReference.participant.identity === playerTrackReference.participant.identity &&
          pinnedTrackReference.source === playerTrackReference.source,
      ) ?? false;

    if (nextIsFullScreen) {
      layoutContext?.pin.dispatch?.({
        msg: 'set_pin',
        trackReference: playerTrackReference,
      });
    } else if (isPinned) {
      layoutContext?.pin.dispatch?.({
        msg: 'clear_pin',
      });
    }

    setIsFullScreen?.(nextIsFullScreen);
    setCollapsed(nextIsFullScreen);
  };

  const handleExitView = () => {
    if (isFullScreen) {
      setIsFullScreen?.(false);
      setCollapsed(false);
      return;
    }

    if (focus) {
      setFocus?.(() => false);
      afterFocus?.(false);
    }
  };

  const handleFocusToggle = () => {
    const nextFocus = !focus;

    if (!nextFocus && isFullScreen) {
      setIsFullScreen?.(false);
      setCollapsed(false);
    }

    setFocus?.(() => nextFocus);
    afterFocus?.(nextFocus);
  };

  const shadowDeskUserInfo = useMemo<ShadowDeskUserInfo>(
    () => ({
      userId: myIdentity,
      username: spaceInfo.participants[myIdentity]?.name || myIdentity,
      isOwner: spaceInfo.ownerId === myIdentity,
    }),
    [myIdentity, spaceInfo.ownerId, spaceInfo.participants],
  );

  return (
    <div
      className="vocespace_full_size lk-participant-tile"
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#1f1f1f',
        borderRadius: '0.5em',
        overflow: 'hidden',
      }}
      onMouseEnter={() => setToolVis(true)}
      onMouseLeave={() => setToolVis(false)}
    >
      {/* 工具栏 */}
      <div
        style={{
          position: 'absolute',
          right: 4,
          top: 4,
          display: 'flex',
          gap: 4,
          zIndex: 10,
          visibility: toolVis ? 'visible' : 'hidden',
        }}
      >
        {canDelete && (
          <button className="lk-button" style={APP_FLOT_PIN_STYLE} onClick={removePlayer}>
            <SvgResource type="close" svgSize={16} />
          </button>
        )}
        {!isFullScreen && showFullScreen && (
          <Tooltip placement="bottom" title={isFullScreen ? '退出全屏' : '全屏'}>
            <button className="lk-button" style={APP_FLOT_PIN_STYLE} onClick={handleFullScreen}>
              {isFullScreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
            </button>
          </Tooltip>
        )}
        <button
          className="lk-button"
          style={APP_FLOT_PIN_STYLE}
          onClick={isActiveView ? handleExitView : handleFocusToggle}
        >
          {!isActiveView ? <FocusToggleIcon /> : <UnfocusToggleIcon />}
        </button>
      </div>

      {/* 内容 */}
      {item.mode === 'hyperbeam' ? (
        <HyperbeamWindow url={item.iframeUrl || ''} messageApi={messageApi} />
      ) : item.mode === 'iframe' ? (
        <IframeWindow
          url={item.iframeUrl || ''}
          shadowDeskUserInfo={shadowDeskUserInfo}
          onLoad={() => {
            if (item.iframeUrl) {
              uploadIframeUrl(spaceName, item.iframeUrl).catch(() => {});
            }
          }}
        />
      ) : (
        <Image
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          src={item.url || undefined}
          alt="tile player"
          preview={false}
        />
      )}
    </div>
  );
};

// ─── 新建卡（上传图片 / 输入 iframe URL）─────────────────────────────────────

export interface TilePlayerAddProps {
  spaceName: string;
  room?: string;
  myIdentity: string;
  messageApi: MessageInstance;
  onCreated?: () => void;
  iframeUrls?: string[];
}

export const TilePlayerAdd = ({
  spaceName,
  room,
  myIdentity,
  messageApi,
  onCreated,
  iframeUrls,
}: TilePlayerAddProps) => {
  const { t } = useI18n();
  const [openInputIframe, setOpenInputIframe] = useState(false);
  const [inputIframeUrl, setInputIframeUrl] = useState('');
  const chatOpen = useRoomStore((s) => s.chatOpen);
  const setChatOpen = useRoomStore((s) => s.setChatOpen);

  const createHyperbeamPlayer = async () => {
    try {
      const response = await api.handleTilePlayerFile(
        spaceName,
        room,
        'create_hyperbeam',
        undefined,
        undefined,
        myIdentity,
      );

      if (response.ok) {
        const data = await response.json();
        socket.emit('tile_player_change', {
          ty: 'nestedBrowser',
          created: true,
          playerId: data.player?.id,
          ownerId: myIdentity,
          action: 'create',
          participantId: myIdentity,
          space: spaceName,
        } as WsTilePlayer);
        onCreated?.();
        return;
      }

      const errorData = await response.json().catch(() => ({}));

      if (response.status === 409) {
        messageApi.warning({
          content: 'Only one HyperBeam browser is allowed in this space',
          duration: 3,
        });
        return;
      }

      messageApi.error({
        content: errorData?.error || 'Failed to create HyperBeam browser',
        duration: 3,
      });
    } catch (e) {
      console.error('Error creating HyperBeam browser:', e);
      messageApi.error({
        content: 'HyperBeam network unreachable, please check server outbound network or proxy',
        duration: 4,
      });
    }
  };

  const handleBeforeUpload = async (file: FileType) => {
    const maxFileSize = 10 * 1024 * 1024;
    if (file.size > maxFileSize) {
      messageApi.error({ content: t('msg.error.file.too_large') + ' 10MB', duration: 3 });
      return false;
    }
    try {
      const response = await api.handleTilePlayerFile(
        spaceName,
        room,
        'upload',
        file,
        undefined,
        myIdentity,
      );
      if (response.ok) {
        const data = await response.json();
        socket.emit('tile_player_change', {
          ty: 'image',
          created: true,
          playerId: data.player?.id,
          ownerId: myIdentity,
          action: 'create',
          participantId: myIdentity,
          space: spaceName,
        } as WsTilePlayer);
        onCreated?.();
      }
    } catch (e) {
      console.error('Error uploading file:', e);
      messageApi.error({ content: t('msg.error.file.upload_failed'), duration: 3 });
    }
    return false;
  };

  return (
    <>
      <div
        className={`vocespace_full_size lk-participant-tile ${styles.container}`}
        style={{
          border: '1px dashed #565656',
          borderRadius: '0.5em',
          background: '#202020',
        }}
      >
        <div
          style={{
            margin: 'auto',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '60%',
            width: '60%',
          }}
        >
          <Tooltip title={t('common.upload')}>
            <Upload beforeUpload={handleBeforeUpload} showUploadList={false} accept="image/*">
              <Button
                type="text"
                style={{ height: '100%', width: '100%' }}
                className={styles.appLikeBtn_btn}
                icon={<FileImageOutlined style={{ color: '#aaa', fontSize: 20 }} />}
              ></Button>
            </Upload>
          </Tooltip>
        </div>

        <Tooltip title="Iframe">
          <Button
            type="text"
            className={styles.appLikeBtn_btn}
            onClick={() => setOpenInputIframe(true)}
            icon={<LayoutOutlined style={{ color: '#aaa', fontSize: 20 }} />}
          ></Button>
        </Tooltip>
        <Tooltip title="HyperBeam Browser">
          <Button
            type="text"
            className={styles.appLikeBtn_btn}
            onClick={createHyperbeamPlayer}
            icon={<GlobalOutlined style={{ color: '#aaa', fontSize: 20 }} />}
          ></Button>
        </Tooltip>
        <Tooltip title={t('common.chat')}>
          <Button
            type="text"
            className={styles.appLikeBtn_btn}
            onClick={() => setChatOpen(!chatOpen)}
            icon={<SvgResource type="chat" svgSize={24} color={'#aaa'} />}
          ></Button>
        </Tooltip>
      </div>

      <Modal
        title="Input Iframe URL"
        open={openInputIframe}
        onOk={async () => {
          let nextUrl = inputIframeUrl.trim();
          if (nextUrl && !/^https?:\/\//i.test(nextUrl)) {
            nextUrl = 'https://' + nextUrl;
          }
          if (!nextUrl) {
            messageApi.warning({ content: 'Iframe URL is required', duration: 2 });
            return;
          }
          const response = await api.handleTilePlayerFile(
            spaceName,
            room,
            'set_meta',
            undefined,
            nextUrl,
            myIdentity,
          );
          if (response.ok) {
            const data = await response.json();
            // 先持久化 URL，再刷新本地和远端视图，避免 fetchSettings 读到旧值
            await uploadIframeUrl(spaceName, nextUrl);
            socket.emit('tile_player_change', {
              ty: 'iframe',
              created: true,
              playerId: data.player?.id,
              ownerId: myIdentity,
              action: 'create',
              participantId: myIdentity,
              space: spaceName,
            } as WsTilePlayer);
            setInputIframeUrl('');
            setOpenInputIframe(false);
            onCreated?.();
          } else {
            messageApi.error({ content: 'Failed to save iframe config', duration: 2 });
          }
        }}
        onCancel={() => setOpenInputIframe(false)}
      >
        <AutoComplete
          style={{ width: '100%' }}
          placeholder="Search or input iframe URL"
          value={inputIframeUrl}
          onChange={setInputIframeUrl}
          filterOption={(inputValue: string, option?: { value?: string | number }) =>
            String(option?.value || '')
              .toLowerCase()
              .includes(inputValue.toLowerCase())
          }
          options={(iframeUrls || []).map((url) => ({ value: url }))}
        />
      </Modal>
    </>
  );
};

// ─── iframe 加载窗口 ─────────────────────────────────────────────────────────

const IframeWindow = ({
  url,
  onLoad,
  shadowDeskUserInfo,
}: {
  url: string;
  onLoad?: () => void;
  shadowDeskUserInfo: ShadowDeskUserInfo;
}) => {
  const [loading, setLoading] = useState(true);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [iframeScale, setIframeScale] = useState(1);
  const iframeViewport = useMemo(() => ({ width: 1440, height: 900 }), []);

  useEffect(() => {
    setLoading(true);
    setIframeLoaded(false);
  }, [url]);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const updateScale = () => {
      if (!containerRef.current) {
        return;
      }

      const { clientWidth, clientHeight } = containerRef.current;
      if (!clientWidth || !clientHeight) {
        return;
      }

      setIframeScale(
        Math.min(clientWidth / iframeViewport.width, clientHeight / iframeViewport.height),
      );
    };

    updateScale();

    const observer = new ResizeObserver(() => {
      updateScale();
    });

    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
    };
  }, [iframeViewport]);

  useEffect(() => {
    if (!url || !iframeLoaded || !isShadowDeskUrl(url)) {
      return;
    }

    const targetOrigin = getShadowDeskOrigin(url);
    let stopped = false;
    let retryCount = 0;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const postUserInfo = () => {
      const iframeWindow = iframeRef.current?.contentWindow;
      if (!iframeWindow || stopped || retryCount >= SHADOW_DESK_MAX_RETRY) {
        return;
      }

      const payload = {
        ...shadowDeskUserInfo,
        resolution: {
          x: window.screen.width,
          y: window.screen.height,
        },
      };

      const message: ShadowDeskEnvelope<typeof payload> = {
        type: SHADOW_DESK_USER_INFO_TYPE,
        data: payload,
        ...payload,
      };

      iframeWindow.postMessage(message, targetOrigin);
      retryCount += 1;

      if (retryCount < SHADOW_DESK_MAX_RETRY) {
        retryTimer = setTimeout(postUserInfo, SHADOW_DESK_RETRY_INTERVAL);
      }
    };

    const stopRetry = () => {
      stopped = true;
      if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
    };

    const handleMessage = (event: MessageEvent) => {
      const iframeWindow = iframeRef.current?.contentWindow;
      if (!iframeWindow || event.source !== iframeWindow) {
        return;
      }

      if (targetOrigin !== '*' && event.origin !== targetOrigin) {
        return;
      }

      const data = event.data as ShadowDeskEnvelope<{ userId: string }> | undefined;
      if (!data || typeof data.type !== 'string') {
        return;
      }

      if (data.type === SHADOW_DESK_USER_INFO_ACK_TYPE) {
        const ackUserId = getShadowDeskPayloadUserId(data);
        if (ackUserId === shadowDeskUserInfo.userId) {
          stopRetry();
        }
        return;
      }

      if (data.type === SHADOW_DESK_CONTROL_CHANGE_TYPE) {
        const controlUserId = getShadowDeskPayloadUserId(data);
        if (!controlUserId) {
          return;
        }

        window.dispatchEvent(
          new CustomEvent(SHADOW_DESK_CONTROL_CHANGE_TYPE, {
            detail: {
              userId: controlUserId,
            },
          }),
        );
      }
    };

    window.addEventListener('message', handleMessage);
    postUserInfo();

    return () => {
      stopRetry();
      window.removeEventListener('message', handleMessage);
    };
  }, [iframeLoaded, shadowDeskUserInfo, url]);

  const handleLoad = () => {
    setLoading(false);
    setIframeLoaded(true);
    onLoad?.();
  };

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}
    >
      {loading && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#1f1f1f',
            zIndex: 1,
          }}
        >
          <Spin size="large" />
        </div>
      )}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: iframeViewport.width,
          height: iframeViewport.height,
          transform: `translate(-50%, -50%) scale(${iframeScale})`,
          transformOrigin: 'center center',
        }}
      >
        <iframe
          ref={iframeRef}
          allow="clipboard-read; clipboard-write"
          title="tile-iframe"
          src={url}
          style={{
            width: iframeViewport.width,
            height: iframeViewport.height,
            border: 'none',
            background: '#fff',
          }}
          onLoad={handleLoad}
          onError={() => setLoading(false)}
        />
      </div>
    </div>
  );
};

const HyperbeamWindow = ({ url, messageApi }: { url: string; messageApi: MessageInstance }) => {
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const hbRef = useRef<any>(null);

  // Thorough cleanup function to stop all audio/video and clear container
  const cleanupHyperbeam = useCallback(() => {
    // Stop and destroy Hyperbeam instance
    if (hbRef.current) {
      try {
        // Try to stop media streams first
        if (hbRef.current.stop) {
          hbRef.current.stop();
        }
        // Then destroy
        if (hbRef.current.destroy) {
          hbRef.current.destroy();
        }
      } catch (e) {
        console.warn('Error during Hyperbeam cleanup:', e);
      }
      hbRef.current = null;
    }

    // Clear container and remove all child elements to ensure no lingering audio/video
    if (containerRef.current) {
      // Find and pause all audio/video elements before removing
      const mediaElements = containerRef.current.querySelectorAll('audio, video');
      mediaElements.forEach((el) => {
        try {
          (el as HTMLMediaElement).pause();
          (el as HTMLMediaElement).srcObject = null;
          (el as HTMLMediaElement).src = '';
          (el as HTMLMediaElement).load();
        } catch (e) {
          // ignore
        }
      });

      // Clear all children
      containerRef.current.innerHTML = '';
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let reconnectTimer: NodeJS.Timeout | null = null;

    const boot = async () => {
      if (!url || !containerRef.current) {
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const { default: Hyperbeam } = await import('@hyperbeam/web');

        if (cancelled || !containerRef.current) return;

        // Clean up any existing instance before creating new one
        cleanupHyperbeam();

        hbRef.current = await Hyperbeam(containerRef.current, url, {
          onConnectionStateChange: (event: { state: string }) => {
            if (event.state === 'playing') {
              setLoading(false);
            }

            if (event.state === 'failed') {
              messageApi.warning({
                content: 'HyperBeam connection failed, retrying...',
                duration: 2,
              });
              reconnectTimer = setTimeout(() => hbRef.current?.reconnect?.(), 1000);
            }
          },
          onDisconnect: (event: { type: string }) => {
            if (event.type === 'unknown') {
              reconnectTimer = setTimeout(() => hbRef.current?.reconnect?.(), 1000);
            }
          },
        });

        if (!cancelled) {
          setLoading(false);
        }
      } catch (error) {
        console.error('Failed to initialize HyperBeam SDK:', error);
        messageApi.error({
          content: 'Failed to load HyperBeam player, please check network and token validity',
          duration: 3,
        });
        setLoading(false);
      }
    };

    boot();

    return () => {
      cancelled = true;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      cleanupHyperbeam();
    };
  }, [url, cleanupHyperbeam, messageApi]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      {loading && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#1f1f1f',
            zIndex: 1,
          }}
        >
          <Spin size="large" />
        </div>
      )}
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
};
