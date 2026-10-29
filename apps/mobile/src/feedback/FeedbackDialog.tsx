import { FebType, type ReportTarget } from '@vocespace/ui';
import { useState } from 'react';
import { SettingsDialog } from '../ui/settings-widgets';
import { useI18n } from '../i18n';
import type { NativeRoom } from '../conference/room';
import { FeedbackContent } from './FeedbackContent';
export function FeedbackDialog({
  open,
  varient = FebType.Feedback,
  target,
  onClose,
  accountEmail,
  room,
}: {
  open: boolean;
  varient?: FebType;
  target?: ReportTarget;
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
      title={t(varient === FebType.Report ? 'moderation.report.title' : 'channel.feedback.title')}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      {open && (
        <FeedbackContent
          accountEmail={accountEmail}
          varient={varient}
          target={target}
          send={(body) => room.feedback(body)}
          onBusyChange={setBusy}
          onDone={onClose}
        />
      )}
    </SettingsDialog>
  );
}
