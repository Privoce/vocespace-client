'use client';

import { api } from '@/lib/api';
import {
  CreateSpaceError
} from '@/lib/std';
import {
  Modal
} from 'antd';
import {
  useImperativeHandle
} from 'react';
import type { useChannelFeedback } from './useChannelFeedback';
export function useChannelActions(context: ReturnType<typeof useChannelFeedback>) {
  const { config, settings, messageApi, localParticipantId, ref, t, joinChildRoom, joinMainRoom } = context;
  const createOwnSpace = async () => {
    let ownSpace = settings.participants[localParticipantId].name;
    const response = await api.createSpace(ownSpace);
    if (response.ok) {
      const { success, error }: { success?: boolean; error?: CreateSpaceError } =
        await response.json();
      if (success) {
        // 新建标签页进行跳转
        Modal.success({
          title: t('common.create_space.success'),
          content: `${t('common.create_space.jump')} ${config.serverUrl}/${ownSpace}`,
          okText: t('common.create_space.ok'),
          onOk: () => {
            window.open(`/${ownSpace}`, '_blank');
          },
          cancelText: t('common.create_space.cancel'),
        });
      } else {
        messageApi.error({
          content: t(error as string),
          duration: 3,
        });
      }
    } else {
      messageApi.error({
        content: t('common.create_space.error.unknown'),
        duration: 3,
      });
    }
  };
  useImperativeHandle(ref, () => ({
    join: joinChildRoom,
    joinMain: joinMainRoom,
  }));
  return { ...context, createOwnSpace };
}
