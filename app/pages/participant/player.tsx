'use client';
import { SvgResource } from '@/app/resources/svg';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n/i18n';
import { FileType } from '@/lib/std';
import { FileImageOutlined, LayoutOutlined } from '@ant-design/icons';
import { Button, Image, Input, Modal, Spin, Tooltip, Upload } from 'antd';
import { MessageInstance } from 'antd/es/message/interface';
import { useEffect, useMemo, useState } from 'react';
import { APP_FLOT_PIN_STYLE } from '../apps/app_pin';
import { FocusToggleIcon, UnfocusToggleIcon } from '@livekit/components-react';
import { socket } from '@/app/[spaceName]/PageClientImpl';
import { WsTilePlayer } from '@/lib/std/device';
import { handleIdentityType, SpaceInfo } from '@/lib/std/space';

// ─── 共享类型 ─────────────────────────────────────────────────────────────────

export interface TilePlayerItem {
  id: string;
  ownerId: string;
  mode: 'image' | 'iframe';
  url?: string | null;
  fileName?: string | null;
  iframeUrl?: string | null;
  createdAt: number;
  updatedAt: number;
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
  // 是否可以被删除，只有RBAC允许或者自己的卡片才可以被删除
  const canDelete = useMemo(() => {
    if (!spaceInfo?.auth) return false;
    let auth = handleIdentityType(spaceInfo.participants[myIdentity]?.auth?.identity || 'guest');
    const canDeleteRBAC = spaceInfo.auth[auth]?.manageFile || false;
    return item.ownerId === myIdentity || canDeleteRBAC;
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
        <button
          className="lk-button"
          style={APP_FLOT_PIN_STYLE}
          onClick={() => {
            const next = !focus;
            setFocus?.(() => next);
            afterFocus?.(next);
          }}
        >
          {!focus ? <FocusToggleIcon /> : <UnfocusToggleIcon />}
        </button>
      </div>

      {/* 内容 */}
      {item.mode === 'iframe' ? (
        <IframeWindow url={item.iframeUrl || ''} />
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
}

export const TilePlayerAdd = ({
  spaceName,
  room,
  myIdentity,
  messageApi,
  onCreated,
}: TilePlayerAddProps) => {
  const { t } = useI18n();
  const [openInputIframe, setOpenInputIframe] = useState(false);
  const [inputIframeUrl, setInputIframeUrl] = useState('');

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
        className="vocespace_full_size lk-participant-tile"
        style={{
          border: '1px dashed #565656',
          borderRadius: '0.5em',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-evenly',
          background: '#202020',
        }}
      >
        <Upload beforeUpload={handleBeforeUpload} showUploadList={false} accept="image/*">
          <Tooltip title={t('common.upload')}>
            <Button shape="circle" style={{ background: 'transparent', border: 'none' }}>
              <FileImageOutlined style={{ color: '#565656', fontSize: 24 }} />
            </Button>
          </Tooltip>
        </Upload>
        <Tooltip title="Iframe">
          <Button
            shape="circle"
            style={{ background: 'transparent', border: 'none' }}
            onClick={() => setOpenInputIframe(true)}
          >
            <LayoutOutlined style={{ color: '#565656', fontSize: 24 }} />
          </Button>
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
        <Input value={inputIframeUrl} onChange={(e) => setInputIframeUrl(e.target.value)} />
      </Modal>
    </>
  );
};

// ─── iframe 加载窗口 ─────────────────────────────────────────────────────────

const IframeWindow = ({ url }: { url: string }) => {
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
  }, [url]);
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
      <iframe
        title="tile-iframe"
        src={url}
        style={{ width: '100%', height: '100%', border: 'none' }}
        onLoad={() => setLoading(false)}
        onError={() => setLoading(false)}
      />
    </div>
  );
};
