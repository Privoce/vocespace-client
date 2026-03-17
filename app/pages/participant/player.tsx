"use client";
import { SvgResource } from '@/app/resources/svg';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n/i18n';
import { FileType, handleLargeFileUpload, handleSmallFileUpload } from '@/lib/std';
import { Button, Image, Tooltip, Upload } from 'antd';
import { MessageInstance } from 'antd/es/message/interface';
import { useEffect, useState } from 'react';

export interface TilePlayerProps {
  messageApi: MessageInstance;
  spaceName: string;
  room?: string;
}

/**
 * act as a participant tile, but show video/image
 * 这个组件的作用是占位，展示视频或者图片，点击后用户需要上传视频或图片，这个组件会常驻
 * 其他人加入后就可以直接看到这个组件展示的视频或图片了
 */
export const TilePlayer = ({ messageApi, spaceName, room }: TilePlayerProps) => {
  const { t } = useI18n();
  const [fileUrl, setFileUrl] = useState<string | null>(null);

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
        const { url } = await response.json();
        setFileUrl(url);
      } else {
        throw new Error('Failed to fetch file URL');
      }
    } catch (error) {
      console.error('Error fetching file URL:', error);
    }
  };

  // 开始时尝试直接通过
  useEffect(() => {
    getFileUrl();
  }, []);

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
    >
      {/* <PlusOutlined style={{ fontSize: 32, color: '#565656' }}></PlusOutlined> */}
      {fileUrl ? (
        <Image src={fileUrl} alt="tile player" />
      ) : (
        <Upload beforeUpload={handleBeforeUpload} showUploadList={false} accept="image/*">
          <Tooltip title={t('common.upload')}>
            <Button shape="circle" style={{ background: 'transparent', border: 'none' }}>
              <SvgResource type="add" svgSize={18} color="#565656" />
            </Button>
          </Tooltip>
        </Upload>
      )}
    </div>
  );
};
