'use client';
import { SvgResource } from '@/app/resources/svg';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n/i18n';
import { FileType, handleLargeFileUpload, handleSmallFileUpload } from '@/lib/std';
import { FileImageOutlined, LayoutOutlined, ShrinkOutlined } from '@ant-design/icons';
import { Button, Image, Input, Modal, Spin, Tooltip, Upload } from 'antd';
import { MessageInstance } from 'antd/es/message/interface';
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { APP_FLOT_PIN_STYLE } from '../apps/app_pin';
import { FocusToggleIcon, UnfocusToggleIcon, useLocalParticipant } from '@livekit/components-react';
import { socket } from '@/app/[spaceName]/PageClientImpl';
import { WsTilePlayer } from '@/lib/std/device';

export interface TilePlayerProps {
  messageApi: MessageInstance;
  spaceName: string;
  room?: string;
  setFocus?: React.Dispatch<React.SetStateAction<boolean>>;
  focus?: boolean;
  afterFocus?: (focus: boolean) => void;
}

export interface TilePlayerExports {
  refresh: (created: boolean, ty?: 'iframe' | 'image' | 'nestedBrowser') => void;
}

/**
 * act as a participant tile, but show video/image
 * 这个组件的作用是占位，展示视频或者图片，点击后用户需要上传视频或图片，这个组件会常驻
 * 其他人加入后就可以直接看到这个组件展示的视频或图片了
 */
export const TilePlayer = forwardRef<TilePlayerExports, TilePlayerProps>(
  ({ messageApi, spaceName, room, setFocus, focus, afterFocus }: TilePlayerProps, ref) => {
    const { t } = useI18n();
    const { localParticipant } = useLocalParticipant();
    const [fileUrl, setFileUrl] = useState<string | null>(null);
    const [toolVis, setToolVis] = useState(false);
    const [openInputIframe, setOpenInputIframe] = useState(false);
    const [iframeUrl, setIframeUrl] = useState('');
    const [showIframe, setShowIframe] = useState(false);

    const emitTilePlayerChange = (
      created: boolean,
      ty?: 'iframe' | 'image' | 'nestedBrowser',
    ) => {
      // console.warn("emit tile player change", { created, ty });
      socket.emit('tile_player_change', {
        ty,
        created,
        participantId: localParticipant?.identity,
        space: spaceName,
      } as WsTilePlayer);
    };

    const handleBeforeUpload = async (file: FileType) => {
      // 检查文件大小限制（建议限制为 10MB）
      const maxFileSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxFileSize) {
        messageApi.error({
          content: t('msg.error.file.too_large') + ' 10MB',
          duration: 3,
        });
        return false;
      }
      // 直接上传到服务器并将获取到的 URL绑定
      try {
        const response = await api.handleTilePlayerFile(spaceName, room, 'upload', file);
        if (response.ok) {
          const { url } = await response.json();
          setFileUrl(url);
          setShowIframe(false);
          // console.warn("upload success, emit tile player change", { url });
          emitTilePlayerChange(true, 'image');
          // messageApi.success({
          //   content: t('msg.success.file.uploaded'),
          //   duration: 3,
          // });
          
        }
      } catch (e) {
        console.error('Error uploading file:', e);
        messageApi.error({
          content: t('msg.error.file.upload_failed'),
          duration: 3,
        });
        return false;
      }

      return false; // 阻止自动上传
    };
    /**
     * 从服务器获取文件URL，如果存在就设置到state中
     */
    const getFileUrl = async () => {
      try {
        const response = await api.handleTilePlayerFile(spaceName, room, 'ls');
        if (response.ok) {
          const { url, iframeUrl: savedIframeUrl, mode } = await response.json();
          setFileUrl(url);
          setIframeUrl(savedIframeUrl || '');
          setShowIframe(mode === 'iframe');
        } else {
          throw new Error('Failed to fetch file URL');
        }
      } catch (error) {
        console.error('Error fetching file URL:', error);
      }
    };

    const removePlayer = async () => {
      try {
        const response = await api.handleTilePlayerFile(spaceName, room, 'rm');
        if (response.ok) {
          setFileUrl(null);
          setIframeUrl('');
          setShowIframe(false);
          emitTilePlayerChange(false);
        } else {
          throw new Error('Failed to remove player file');
        }
      } catch (error) {
        console.error('Error removing player:', error);
      }
    };

    // 组件加载以及room变化时获取当前的文件URL
    useEffect(() => {
      getFileUrl();
    }, [room]);

    useImperativeHandle(
      ref,
      () => ({
        refresh: (created: boolean, ty?: 'iframe' | 'image' | 'nestedBrowser') => {
          if (created) {
            if (ty === 'image' || ty === 'iframe') {
              getFileUrl();
            } else {
            }
          } else {
            // 表示清理
            setFileUrl(null);
            setIframeUrl('');
            setShowIframe(false);
          }
        },
      }),
      [],
    );

    return (
      <div
        className="vocespace_full_size lk-participant-tile"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          backgroundColor: '#1f1f1f',
          borderRadius: '0.5em',
        }}
        onMouseEnter={() => {
          setToolVis(true);
        }}
        onMouseLeave={() => {
          setToolVis(false);
        }}
      >
        {/* <PlusOutlined style={{ fontSize: 32, color: '#565656' }}></PlusOutlined> */}

        <div
          style={{
            position: 'relative',
            height: '100%',
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* 聚焦按钮和删除按钮 */}
          <div
            style={{
              position: 'absolute',
              right: 4,
              top: '4px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 0,
              zIndex: 10,
              height: '100%',

              visibility: toolVis ? 'visible' : 'hidden',
            }}
          >
            {fileUrl || showIframe ? (
              <button className="lk-button" style={APP_FLOT_PIN_STYLE} onClick={removePlayer}>
                <SvgResource type="close" svgSize={16}></SvgResource>
              </button>
            ) : null}
            <button
              className="lk-button"
              style={APP_FLOT_PIN_STYLE}
              onClick={() => {
                setFocus?.((pre) => !pre);
                afterFocus?.(focus || false);
              }}
            >
              {!focus ? (
                <FocusToggleIcon></FocusToggleIcon>
              ) : (
                <UnfocusToggleIcon></UnfocusToggleIcon>
              )}
            </button>
          </div>

          {fileUrl || showIframe ? (
            showIframe ? (
              <IframeWindow url={iframeUrl}></IframeWindow>
            ) : (
              <Image style={{ height: '100%' }} src={fileUrl || undefined} alt="tile player" />
            )
          ) : (
            <div
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-evenly',
                gap: 16,
              }}
            >
              <Upload beforeUpload={handleBeforeUpload} showUploadList={false} accept="image/*">
                <Tooltip title={t('common.upload')}>
                  <Button shape="circle" style={{ background: 'transparent', border: 'none' }}>
                    {/* <SvgResource type="add" svgSize={18} color="#565656" /> */}
                    <FileImageOutlined
                      style={{ color: '#565656', fontSize: 24 }}
                    ></FileImageOutlined>
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
          )}
        </div>
        <Modal
          title={'Input Iframe URL'}
          open={openInputIframe}
          onOk={async () => {
            let nextUrl = iframeUrl.trim();
            // 如果nextUrl没有https协议就需要加上
            if (nextUrl && !/^https?:\/\//i.test(nextUrl)) {
              nextUrl = 'https://' + nextUrl;
            }

            if (!nextUrl) {
              messageApi.warning({
                content: 'Iframe URL is required',
                duration: 2,
              });
              return;
            }

            const response = await api.handleTilePlayerFile(
              spaceName,
              room,
              'set_meta',
              undefined,
              nextUrl,
            );

            if (response.ok) {
              setFileUrl(null);
              setIframeUrl(nextUrl);
              setShowIframe(true);
              setOpenInputIframe(false);
              emitTilePlayerChange(true, 'iframe');
            } else {
              messageApi.error({
                content: 'Failed to save iframe config',
                duration: 2,
              });
            }
          }}
          onCancel={() => {
            setOpenInputIframe(false);
          }}
        >
          <Input
            value={iframeUrl}
            onChange={(e) => {
              setIframeUrl(e.target.value);
            }}
          ></Input>
        </Modal>
      </div>
    );
  },
);

const IframeWindow = ({ url }: { url: string }) => {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
  }, [url]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      {loading ? (
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
      ) : null}
      <iframe
        title="tile-iframe"
        src={url}
        style={{ width: '100%', height: '100%', border: 'none' }}
        onLoad={() => setLoading(false)}
        onError={() => setLoading(false)}
      ></iframe>
    </div>
  );
};
