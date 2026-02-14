import { Room } from 'livekit-client';
import styles from '@/styles/chat.module.scss';
import { Image, Tooltip, Dropdown, Menu, message, MenuProps } from 'antd';
import {
  FileZipOutlined,
  FileWordOutlined,
  FileMarkdownOutlined,
  FilePdfOutlined,
  FilePptOutlined,
  FileOutlined,
  DownloadOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import * as api from '@/lib/api/chat';
import React from 'react';
import { useI18n } from '@/lib/i18n/i18n';
import { downloadFile } from '@/lib/std';

export interface FSProps {
  space: Room;
  files: string[];
  onFresh: (fresh?: boolean) => Promise<void>;
}

// 获取文件扩展名
const getFileExtension = (filename: string): string => {
  const parts = filename.split('.');
  return parts.length > 1 ? parts.pop()!.toLowerCase() : '';
};

// 判断是否为图片
const isImage = (ext: string): boolean => {
  return ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'].includes(ext);
};

// 判断是否为视频
const isVideo = (ext: string): boolean => {
  return ['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv'].includes(ext);
};

// 根据文件类型获取图标
const getFileIcon = (ext: string) => {
  const iconStyle = { fontSize: '48px', color: '#1890ff' };

  switch (ext) {
    case 'zip':
    case 'rar':
    case '7z':
    case 'tar':
    case 'gz':
      return <FileZipOutlined style={iconStyle} />;
    case 'doc':
    case 'docx':
      return <FileWordOutlined style={iconStyle} />;
    case 'md':
    case 'markdown':
      return <FileMarkdownOutlined style={iconStyle} />;
    case 'pdf':
      return <FilePdfOutlined style={iconStyle} />;
    case 'ppt':
    case 'pptx':
      return <FilePptOutlined style={iconStyle} />;
    default:
      return <FileOutlined style={iconStyle} />;
  }
};

// 文件项组件
const FileItem = ({
  spaceName,
  filename,
  prefix,
  onFresh,
}: {
  spaceName: string;
  filename: string;
  prefix: string;
  onFresh: (fresh?: boolean) => Promise<void>;
}) => {
  const { t } = useI18n();
  const ext = getFileExtension(filename);
  const filePath = `${prefix}${filename}`;

  const handleFile = async (ty: api.HandleFileSystemType) => {
    const response = await api.handleFileSystem(spaceName, ty, filename);
    if (response.ok) {
      if (ty === 'download') {
        downloadFile((await response.json()).fileUrl, filename);
      } else {
        onFresh(true);
      }
    }
  };

  const items: MenuProps['items'] = [
    {
      key: 'download',
      icon: <DownloadOutlined />,
      label: t('recording.download.title'),
      onClick: async () => await handleFile('download'),
    },
    {
      key: 'rm',
      icon: <DeleteOutlined style={{ color: 'red' }} />,
      label: <span style={{ color: 'red' }}>{t('recording.delete.title')}</span>,
      onClick: async () => await handleFile('rm'),
    },
  ];
  return (
    <Dropdown menu={{ items }} trigger={['contextMenu', 'click']}>
      <div className={styles.file_item}>
        <div className={styles.file_preview}>
          {isImage(ext) ? (
            <Image
              src={filePath}
              alt={filename}
              width={80}
              height={80}
              style={{ objectFit: 'cover', borderRadius: '4px' }}
              preview={{
                src: filePath,
              }}
            />
          ) : isVideo(ext) ? (
            <div className={styles.video_wrapper}>
              <video
                src={filePath}
                width={80}
                height={80}
                controls
                style={{ borderRadius: '4px', objectFit: 'cover' }}
              />
            </div>
          ) : (
            <div className={styles.file_icon}>{getFileIcon(ext)}</div>
          )}
        </div>
        <Tooltip title={filename}>
          <div className={styles.file_name}>{filename}</div>
        </Tooltip>
      </div>
    </Dropdown>
  );
};

export function FS({ space, files, onFresh }: FSProps) {
  const prefix = `/uploads/${space.name}/`;

  return (
    <div className={styles.fs_container}>
      <div className={styles.files_grid}>
        {files.map((file, index) => (
          <FileItem
            spaceName={space.name}
            key={index}
            filename={file}
            prefix={prefix}
            onFresh={onFresh}
          />
        ))}
      </div>
      {files.length === 0 && (
        <div className={styles.empty_state}>
          <FileOutlined style={{ fontSize: '48px', color: '#ccc' }} />
        </div>
      )}
    </div>
  );
}
