'use client';
import { MeetingShare } from '@vocespace/ui';
import { MeetingButton, MeetingIcon } from './primitives';
import { useI18n } from '@/lib/i18n/i18n';
import { basePath } from '@/lib/runtime-config';
import { analytics } from '@/lib/analytics';
import type { MessageInstance } from 'antd/es/message/interface';

export function ShareInvitation({
  name,
  messageApi,
}: {
  name: string;
  messageApi: MessageInstance;
}) {
  const { t } = useI18n();
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(
        new URL(`${basePath}/${encodeURIComponent(name)}`, window.location.origin).href,
      );
      analytics.track('space_share', { method: 'copy_link', result: 'success' });
      messageApi.success(t('phone_meeting.link_copied'));
    } catch {
      analytics.track('space_share', { method: 'copy_link', result: 'failure' });
      messageApi.error(t('common.copy.error'));
    }
  };
  return (
    <MeetingShare
      Button={MeetingButton}
      Icon={MeetingIcon}
      name={name}
      title={t('phone_meeting.share_title')}
      description={t('phone_meeting.share_link_description')}
      copyLabel={t('more.participant.invite.ok')}
      onCopy={() => void copy()}
    />
  );
}
