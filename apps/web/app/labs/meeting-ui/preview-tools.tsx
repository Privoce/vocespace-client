'use client';

import { useState } from 'react';
import { Button, Modal, Upload } from 'antd';
import {
  FileImageOutlined,
  LayoutOutlined,
  GlobalOutlined,
  EditOutlined,
  FolderOutlined,
} from '@ant-design/icons';
import { MeetingToolsPanel } from '@vocespace/ui';
import { MeetingIcon } from '@/components/MeetingUI/primitives';
import { useI18n } from '@/lib/i18n/i18n';

/** Preview adapters only retain selected names in memory; no upload or meeting API. */
export function PreviewTools({
  onSelect,
  onFile,
}: {
  onSelect: () => void;
  onFile: (name: string) => void;
}) {
  const { t } = useI18n();
  const [files, setFiles] = useState<string[]>([]);
  const [filesOpen, setFilesOpen] = useState(false);
  const [tool, setTool] = useState<string>();
  const iconStyle = { fontSize: 24 };
  const buttonStyle = { width: 58, height: 58 };
  const tools = [
    {
      id: 'image',
      label: t('shared_meeting.image'),
      icon: <FileImageOutlined style={iconStyle} />,
    },
    { id: 'iframe', label: 'Iframe', icon: <LayoutOutlined style={iconStyle} /> },
    { id: 'browser', label: 'HyperBeam', icon: <GlobalOutlined style={iconStyle} /> },
    {
      id: 'whiteboard',
      label: t('common.whiteboard.title'),
      icon: <EditOutlined style={iconStyle} />,
    },
  ];
  return (
    <>
      <MeetingToolsPanel
        onSelect={onSelect}
        items={[
          ...tools.map((item) => ({
            ...item,
            content: (close: () => void) => (
              <Button
                type="text"
                style={buttonStyle}
                aria-label={item.label}
                icon={item.icon}
                onClick={() => {
                  close();
                  setTool(item.label);
                }}
              />
            ),
          })),
          {
            id: 'upload-file',
            label: t('shared_meeting.upload'),
            icon: <FolderOutlined />,
            content: (close) => (
              <Upload
                showUploadList={false}
                beforeUpload={(file) => {
                  close();
                  setFiles((current) => [...current, file.name]);
                  onFile(file.name);
                  return false;
                }}
              >
                <Button
                  type="text"
                  style={buttonStyle}
                  aria-label={t('shared_meeting.upload')}
                  icon={<FolderOutlined style={iconStyle} />}
                />
              </Upload>
            ),
          },
          {
            id: 'files',
            label: t('shared_meeting.files'),
            icon: <MeetingIcon name="file" />,
            content: (close) => (
              <Button
                type="text"
                style={buttonStyle}
                aria-label={t('shared_meeting.files')}
                icon={<MeetingIcon name="file" size={24} />}
                onClick={() => {
                  close();
                  setFilesOpen(true);
                }}
              />
            ),
          },
        ]}
      />
      <Modal
        title={t('shared_meeting.files')}
        open={filesOpen}
        zIndex={1200}
        footer={null}
        onCancel={() => setFilesOpen(false)}
      >
        <p>{t('shared_meeting.preview_note')}</p>
        {files.length ? (
          <ul>
            {files.map((name, index) => (
              <li key={index}>{name}</li>
            ))}
          </ul>
        ) : (
          <p>{t('shared_meeting.files_empty')}</p>
        )}
      </Modal>
      <Modal
        title={tool}
        open={!!tool}
        zIndex={1200}
        footer={null}
        onCancel={() => setTool(undefined)}
      >
        <p>{t('shared_meeting.preview_note')}</p>
      </Modal>
    </>
  );
}
