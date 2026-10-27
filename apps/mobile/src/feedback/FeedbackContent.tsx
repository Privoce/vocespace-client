import Toast from '@ant-design/react-native/lib/toast';
import { FeedbackForm } from '@vocespace/ui';
import { pickDocument } from '../ui/document-picker';
import type { FeedbackSend } from './client';
import { MeetingButton, MeetingSettingsInput } from '../ui/meeting';
import { useI18n } from '../i18n';
export function FeedbackContent({
  accountEmail,
  send,
  onDone,
  onBusyChange,
}: {
  accountEmail?: string;
  send: FeedbackSend;
  onDone: () => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const { t } = useI18n();
  return (
    <FeedbackForm
      t={t}
      accountEmail={accountEmail}
      Button={MeetingButton}
      Input={MeetingSettingsInput}
      onBusyChange={onBusyChange}
      onUpload={async (email) => {
        const selected = await pickDocument();
        if (selected.canceled) return;
        const file = selected.assets[0];
        if (file.size !== undefined && file.size > 10 * 1024 * 1024)
          throw new Error('FILE_TOO_LARGE');
        const body = new FormData();
        body.append('email', email);
        body.append('file', {
          uri: file.uri,
          name: file.name,
          type: file.mimeType || 'application/octet-stream',
        } as unknown as Blob);
        const result = await send(body);
        return { name: file.name, url: result.absoluteUrl || result.fileUrl };
      }}
      onSubmit={async (value) => {
        await send(value);
      }}
      onDone={() => {
        onBusyChange(false);
        Toast.success(t('channel.feedback.submit_success'));
        onDone();
      }}
    />
  );
}
