'use client';
import { Button, Upload, Modal } from 'antd';
import { PlusCircleOutlined, FolderOutlined } from '@ant-design/icons';
import { MeetingChat, type MeetingToolsPanelProps } from '@vocespace/ui';
import { MeetingButton, MeetingIcon, MeetingInput } from './primitives';
import type { ChatPanelModel } from '@/components/Chat/pc';
import { chatMessageKey } from '@/components/Chat/message-key';
import { FS } from '@/components/Chat/fs';
export function SharedChat({
  model,
  compact,
  roomName,
  onToggleTools,
  toolsOpen,
}: {
  model: ChatPanelModel;
  compact?: boolean;
  roomName?: string;
  onToggleTools: () => void;
  toolsOpen?: boolean;
}) {
  return (
    <>
      <MeetingChat
        compact={compact}
        roomName={roomName}
        roomSubtitle={model.t('phone_meeting.chat_hint')}
        Button={MeetingButton}
        Icon={MeetingIcon}
        Input={MeetingInput}
        messages={model.chatMsg.msgs.map((item) => ({
          id: chatMessageKey(item),
          name: item.sender.name,
          time: new Date(item.timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          }),
          local: model.isLocal(item.sender.id),
          text: item.message || '',
          attachment:
            item.type === 'file' ? (
              <Button
                type="link"
                onClick={() => {
                  void model.downloadFile(item.file?.url);
                }}
              >
                {item.file?.name || model.t('shared_meeting.files')}
              </Button>
            ) : undefined,
        }))}
        draft={model.value}
        onDraft={model.setValue}
        onSend={() => {
          void model.sendMsg();
        }}
        maxLength={4000}
        placeholder={model.t('common.chat_placeholder')}
        sendLabel={model.t('common.send')}
        emptyLabel={model.t('shared_meeting.empty_chat')}
        onComposerFocus={() => {
          if (toolsOpen) onToggleTools();
        }}
        composerTools={
          <Button
            type="text"
            aria-label={model.t('more.app.title')}
            aria-expanded={!!toolsOpen}
            onClick={onToggleTools}
            icon={
              <PlusCircleOutlined
                style={{ fontSize: 24, color: toolsOpen ? '#22ccee' : '#adc1cd' }}
              />
            }
          />
        }
      />
      <Modal
        zIndex={1200}
        title={model.t('shared_meeting.files')}
        open={model.fsModal}
        onCancel={() => model.setFsModal(false)}
        footer={null}
      >
        <FS
          files={model.files}
          space={model.space}
          onFresh={model.openLocalFileSystem}
          canDeleteRBAC={model.canDeleteRBAC}
        />
      </Modal>
    </>
  );
}

export function chatFileTools(model: ChatPanelModel): MeetingToolsPanelProps['items'] {
  return [
    {
      id: 'upload-file',
      label: model.t('shared_meeting.upload'),
      icon: <FolderOutlined />,
      content: (close) => (
        <Upload
          showUploadList={false}
          beforeUpload={(file) => {
            close();
            return model.handleBeforeUpload(file);
          }}
        >
          <Button
            type="text"
            aria-label={model.t('shared_meeting.upload')}
            style={{ width: 58, height: 58 }}
            icon={<FolderOutlined style={{ fontSize: 24 }} />}
          />
        </Upload>
      ),
    },
    {
      id: 'files',
      label: model.t('shared_meeting.files'),
      icon: <MeetingIcon name="file" />,
      content: (close) => (
        <Button
          type="text"
          aria-label={model.t('shared_meeting.files')}
          style={{ width: 58, height: 58 }}
          icon={<MeetingIcon name="file" size={24} />}
          onClick={() => {
            close();
            void model.openLocalFileSystem();
          }}
        />
      ),
    },
  ];
}
