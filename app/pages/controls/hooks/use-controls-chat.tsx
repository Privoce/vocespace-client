import { useCallback } from 'react';
import { Button, Modal } from 'antd';
import { message } from 'antd';
import { ChatMsgItem } from '@/lib/std/chat';
import { useI18n } from '@/lib/i18n/i18n';
import { useRoomStore } from '@/lib/store';

export function useControlsChat() {
  const { t } = useI18n();
  const chatOpen = useRoomStore((s) => s.chatOpen);
  const setChatOpen = useRoomStore((s) => s.setChatOpen);
  const [messageApi, contextHolder] = message.useMessage();

  const onChatClose = useCallback(() => {
    setChatOpen(false);
  }, []);

  const sendFileConfirm = useCallback(
    (onOk: (abortController?: AbortController) => Promise<ChatMsgItem>) => {
      Modal.confirm({
        title: t('common.send'),
        content: t('common.send_file_or'),
        okText: t('common.send'),
        cancelText: t('common.cancel'),
        onOk: async () => {
          await sendingFile(onOk);
        },
      });
    },
    [t],
  );

  const sendingFile = useCallback(
    async (onOk: (abortController?: AbortController) => Promise<ChatMsgItem>) => {
      const abortController = new AbortController();
      let isUploading = false;

      const sending = Modal.confirm({
        title: t('common.send'),
        content: t('common.sending'),
        okText: <Button type="primary" loading>{t('common.sending')}</Button>,
        cancelText: t('common.cancel'),
        onCancel: () => {
          if (isUploading) {
            abortController.abort();
            messageApi.info({ content: t('msg.info.file.upload_cancelled'), duration: 2 });
          }
        },
      });

      try {
        isUploading = true;
        const fileMessage = await onOk(abortController);
        isUploading = false;
        if (fileMessage) {
          sending.destroy();
          messageApi.success({ content: t('msg.success.file.upload'), duration: 2 });
          return fileMessage;
        }
      } catch (error: any) {
        isUploading = false;
        sending.destroy();
        if (error.name !== 'AbortError') {
          console.error(error);
        }
      }
      return null;
    },
    [t, messageApi],
  );

  return {
    chatOpen,
    setChatOpen,
    onChatClose,
    sendFileConfirm,
    sendingFile,
    messageApi,
    contextHolder,
  };
}
