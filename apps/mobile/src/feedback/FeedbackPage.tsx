import { useState } from 'react';
import { ProfilePage } from '../account/ProfilePage';
import { useI18n } from '../i18n';
import { FeedbackContent } from './FeedbackContent';
import type { FeedbackSend } from './client';
export function FeedbackPage({
  accountEmail,
  send,
  onBack,
}: {
  accountEmail?: string;
  send: FeedbackSend;
  onBack: () => void;
}) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  return (
    <ProfilePage title={t('channel.feedback.title')} onBack={onBack} busy={busy}>
      <FeedbackContent
        accountEmail={accountEmail}
        send={send}
        onBusyChange={setBusy}
        onDone={onBack}
      />
    </ProfilePage>
  );
}
