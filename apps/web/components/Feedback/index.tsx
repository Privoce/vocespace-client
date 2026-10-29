'use client';
import { analytics } from '@/lib/analytics';
import { useEffect, useState } from 'react';
import { Modal, App } from 'antd';
import { FeedbackForm, FebType, type ReportTarget } from '@vocespace/ui';
import { MeetingButton, MeetingSettingsInput } from '../MeetingUI/primitives';
import { useI18n } from '@/lib/i18n/i18n';
import { api } from '@/lib/api';
import { connect_endpoint } from '@/lib/std';
import { apiFetch } from '@/lib/api/client';
export function FeedbackDialog({ open, onClose, varient = FebType.Feedback, target }: { open: boolean; onClose: () => void; varient?: FebType; target?: ReportTarget }) {
  const { t } = useI18n();
  const { message } = App.useApp();
  const [email, setEmail] = useState<string>();
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    let active = true;
    setBusy(false);
    setEmail(undefined);
    void apiFetch(connect_endpoint('/api/v1/feedback/account'))
      .then(async (response) => {
        if (!response.ok) return;
        const value = await response.json();
        if (active && typeof value.email === 'string') setEmail(value.email);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [open]);
  return (
    <Modal
      open={open}
      title={t(varient === FebType.Report ? 'moderation.report.title' : 'channel.feedback.title')}
      footer={null}
      onCancel={() => {
        if (!busy) onClose();
      }}
      closable={!busy}
      maskClosable={!busy}
    >
      {open && (
        <FeedbackForm
          t={t}
          varient={varient}
          target={target}
          accountEmail={email}
          Button={MeetingButton}
          Input={MeetingSettingsInput}
          onBusyChange={setBusy}
          onUpload={(email) =>
            new Promise((resolve, reject) => {
              const input = document.createElement('input');
              input.type = 'file';
              input.addEventListener('cancel', () => resolve(undefined), { once: true });
              input.addEventListener(
                'change',
                () => {
                  const file = input.files?.[0];
                  if (!file) {
                    resolve(undefined);
                    return;
                  }
                  if (file.size > 10 * 1024 * 1024) {
                    reject(new Error('FILE_TOO_LARGE'));
                    return;
                  }
                  void api
                    .uploadFeedbackFile(file, email)
                    .then(async (response) => {
                      if (!response.ok) throw new Error('UPLOAD_FAILED');
                      const value = await response.json();
                      resolve({ name: file.name, url: value.absoluteUrl || value.fileUrl });
                    })
                    .catch(reject);
                },
                { once: true },
              );
              input.click();
            })
          }
          onSubmit={async (value) => {
            await analytics.run('feedback_submit', { variant: varient === FebType.Report ? 'report' : 'feedback', has_attachment: !!value.attachments?.length, category: value.feedbackType }, async () => {
              const response = await api.sendFeedback(value);
              if (!response.ok) throw { status: response.status };
            });
          }}
          onDone={() => {
            setBusy(false);
            void message.success(t('channel.feedback.submit_success'));
            onClose();
          }}
        />
      )}
    </Modal>
  );
}
