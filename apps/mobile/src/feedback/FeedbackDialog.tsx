import { useState } from 'react';
import Toast from '@ant-design/react-native/lib/toast';
import { pickFeedbackDocument } from './document-picker';
import { FeedbackForm } from '@vocespace/ui';
import { SettingsDialog } from '../ui/settings-widgets';
import { MeetingButton, MeetingSettingsInput } from '../ui/meeting';
import { useI18n } from '../i18n';
import type { NativeRoom } from '../conference/room';
export function FeedbackDialog({
  open,
  onClose,
  accountEmail,
  room,
}: {
  open: boolean;
  onClose: () => void;
  accountEmail?: string;
  room: NativeRoom;
}) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  return (
    <SettingsDialog
      closeInHeader
      open={open}
      title={t('channel.feedback.title')}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      {open && (
        <FeedbackForm
          t={t}
          accountEmail={accountEmail}
          Button={MeetingButton}
          Input={MeetingSettingsInput}
          onBusyChange={setBusy}
          onUpload={async (email) => {
            const selected = await pickFeedbackDocument();
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
            const value = await room.feedback(body);
            return { name: file.name, url: value.absoluteUrl || value.fileUrl };
          }}
          onSubmit={async (value) => {
            await room.feedback(value);
          }}
          onDone={() => {
            setBusy(false);
            Toast.success(t('channel.feedback.submit_success'));
            onClose();
          }}
        />
      )}
    </SettingsDialog>
  );
}
