'use client';

import { api } from '@/lib/api';
import {
  FileType
} from '@/lib/std';
import {
  useCallback
} from 'react';
import type { useChannelRooms } from './useChannelRooms';
export function useChannelFeedback(context: ReturnType<typeof useChannelRooms>) {
  const {
    messageApi,
    t,
    setFeedbackOpen,
    feedbackType,
    setFeedbackType,
    feedbackUploading,
    setFeedbackUploading,
    setFeedbackSubmitting,
    feedbackUploads,
    setFeedbackUploads,
    feedbackForm,
  } = context;
  const resetFeedbackState = useCallback(() => {
    feedbackForm.resetFields();
    setFeedbackType('bug');
    setFeedbackUploads([]);
    setFeedbackUploading(false);
    setFeedbackSubmitting(false);
  }, [feedbackForm, setFeedbackType, setFeedbackUploads, setFeedbackUploading, setFeedbackSubmitting]);
  const closeFeedbackModal = useCallback(() => {
    setFeedbackOpen(false);
    resetFeedbackState();
  }, [resetFeedbackState, setFeedbackOpen]);
  const handleFeedbackUpload = useCallback(
    async (file: FileType) => {
      const email = String(feedbackForm.getFieldValue('email') || '')
        .trim()
        .toLowerCase();
      if (!email) {
        messageApi.error({
          content: t('channel.feedback.validation.email_required'),
          duration: 3,
        });
        return false;
      }

      const maxSize = 10 * 1024 * 1024;
      if (file.size > maxSize) {
        messageApi.error({
          content: t('channel.feedback.validation.file_too_large'),
          duration: 3,
        });
        return false;
      }

      const uid = `${Date.now()}-${file.name}`;
      setFeedbackUploading(true);
      setFeedbackUploads((prev) => [...prev, { uid, name: file.name, status: 'uploading' }]);

      try {
        const response = await api.uploadFeedbackFile(file, email);
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'upload failed');
        }

        setFeedbackUploads((prev) =>
          prev.map((item) =>
            item.uid === uid
              ? { ...item, status: 'done', url: data.absoluteUrl || data.fileUrl }
              : item,
          ),
        );
        messageApi.success({ content: t('channel.feedback.upload_success'), duration: 2 });
      } catch (error) {
        setFeedbackUploads((prev) =>
          prev.map((item) => (item.uid === uid ? { ...item, status: 'error' } : item)),
        );
        messageApi.error({
          content: `${t('channel.feedback.upload_error')}: ${error instanceof Error ? error.message : error}`,
          duration: 3,
        });
      } finally {
        setFeedbackUploading(false);
      }

      return false;
    },
    [feedbackForm, messageApi, t, setFeedbackUploading, setFeedbackUploads],
  );
  const submitFeedback = useCallback(async () => {
    const values = await feedbackForm.validateFields();
    const effectiveType = feedbackType === 'other' ? values.otherType?.trim() : feedbackType;

    if (!effectiveType) {
      messageApi.error({ content: t('channel.feedback.validation.type_required'), duration: 3 });
      return;
    }

    if (feedbackUploading) {
      messageApi.info({ content: t('channel.feedback.uploading_wait'), duration: 2 });
      return;
    }

    setFeedbackSubmitting(true);
    try {
      const response = await api.sendFeedback({
        email: values.email.trim().toLowerCase(),
        feedbackType: effectiveType,
        content: values.content.trim(),
        attachments: feedbackUploads
          .filter((item) => item.status === 'done' && item.url)
          .map((item) => item.url as string),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'send failed');
      }

      messageApi.success({ content: t('channel.feedback.submit_success'), duration: 3 });
      closeFeedbackModal();
    } catch (error) {
      messageApi.error({
        content: `${t('channel.feedback.submit_error')}: ${error instanceof Error ? error.message : error}`,
        duration: 3,
      });
    } finally {
      setFeedbackSubmitting(false);
    }
  }, [
    setFeedbackSubmitting,
    closeFeedbackModal,
    feedbackForm,
    feedbackType,
    feedbackUploading,
    feedbackUploads,
    messageApi,
    t,
  ]);
  return { ...context, resetFeedbackState, closeFeedbackModal, handleFeedbackUpload, submitFeedback };
}
