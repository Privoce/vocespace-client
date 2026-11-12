'use client';
import { Button, Upload, Modal } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { MeetingChat } from '@vocespace/ui';
import { MeetingButton, MeetingIcon, MeetingInput } from './primitives';
import type { ChatPanelModel } from '@/components/Chat/pc';
import { chatMessageKey } from '@/components/Chat/message-key';
import { FS } from '@/components/Chat/fs';
export function SharedChat({
  model,
  compact,
  roomName,
}: {
  model: ChatPanelModel;
  compact?: boolean;
  roomName?: string;
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
        composerTools={
          <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0, gap: 2 }}>
            <Upload showUploadList={false} beforeUpload={model.handleBeforeUpload}>
              <Button
                type="text"
                aria-label={model.t('shared_meeting.upload')}
                icon={<PlusOutlined />}
              />
            </Upload>
            <Button
              type="text"
              aria-label={model.t('shared_meeting.files')}
              icon={<MeetingIcon name="file" />}
              onClick={() => {
                void model.openLocalFileSystem();
              }}
            ></Button>
          </div>
        }
      />
      {!compact && (
        <Modal
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
      )}
    </>
  );
}
