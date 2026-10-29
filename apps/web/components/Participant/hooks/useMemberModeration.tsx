import { analytics } from '@/lib/analytics';
import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { Modal } from 'antd';
import { FebType, MemberActions } from '@vocespace/ui';
import { useI18n } from '@/lib/i18n/i18n';
import { apiFetch } from '@/lib/api/client';
import { PhoneSheet } from '../../MeetingUI/PhoneSheet';
import { MeetingButton, MeetingIcon } from '../../MeetingUI/primitives';
import { FeedbackDialog } from '../../Feedback';

export function useMemberModeration({ spaceName, targetId, name, canBlock, disabled, actorRole }: {
  spaceName: string; targetId: string; name: string; canBlock: boolean; disabled: boolean; actorRole?: 'owner' | 'admin';
}) {
  const { t } = useI18n();
  const [mode, setMode] = useState<'actions' | 'confirm' | 'report'>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const origin = useRef<{ x: number; y: number } | undefined>(undefined);
  const held = useRef(false);
  const active = useRef(true);
  const flight = useRef(false);
  const cancel = () => { clearTimeout(timer.current); origin.current = undefined; };
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; clearTimeout(timer.current); };
  }, [spaceName, targetId]);
  const close = () => { if (!flight.current) { setMode(undefined); setError(false); } };
  const handlers = {
    onPointerDownCapture(event: PointerEvent) {
      cancel(); held.current = false;
      if (disabled || event.button !== 0 || !event.isPrimary ||
        (event.target as Element).closest('button,input,textarea,a,[role="button"]')) return;
      origin.current = { x: event.clientX, y: event.clientY };
      timer.current = setTimeout(() => { held.current = true; setMode('actions'); }, 500);
    },
    onPointerMoveCapture(event: PointerEvent) {
      if (origin.current && Math.hypot(event.clientX - origin.current.x, event.clientY - origin.current.y) > 10) cancel();
    },
    onPointerUpCapture: cancel,
    onPointerCancelCapture: cancel,
    onClickCapture(event: React.MouseEvent) { if (held.current && event.currentTarget.contains(event.target as Node)) { event.preventDefault(); event.stopPropagation(); held.current = false; } },
  };
  return { handlers, modal: <>
    <PhoneSheet open={mode === 'actions'} height="58%" title={t('moderation.title')}
      closeLabel={t('common.close')} onClose={close}>
      <MemberActions name={name} canBlock={canBlock} t={t} Button={MeetingButton} Icon={MeetingIcon}
        onBlock={() => setMode('confirm')} onReport={() => setMode('report')} />
    </PhoneSheet>
    <Modal open={mode === 'confirm'} title={t('moderation.confirm_title')}
      okText={t('moderation.block')} okButtonProps={{ danger: true, disabled: !canBlock }}
      confirmLoading={busy} onCancel={close} closable={!busy} maskClosable={!busy}
      onOk={async () => {
        if (flight.current || !canBlock) return;
        flight.current = true; setBusy(true); setError(false);
        const operation = analytics.begin('member_block', { source: 'meeting', actor_role: actorRole });
        try {
          const response = await apiFetch('/api/v1/moderation', { method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Vocespace-Request': '1' },
            body: JSON.stringify({ spaceName, targetId, confirm: true }) });
          if (!response.ok) throw { status: response.status };
          operation.end('success');
          if (active.current) setMode(undefined);
        } catch (error) { operation.fail(error); if (active.current) setError(true); }
        finally { flight.current = false; if (active.current) setBusy(false); }
      }}>
      <p>{name}</p><p>{t('moderation.confirm')}</p>
      {error && <p role="alert">{t('moderation.failed')}</p>}
    </Modal>
    <FeedbackDialog open={mode === 'report'} onClose={close} varient={FebType.Report}
      target={{ id: targetId, name, spaceName }} />
  </> };
}
