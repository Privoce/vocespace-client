import { analytics } from '../analytics';
import { useEffect, useRef, useState } from 'react';
import { Modal, Text } from 'react-native';
import { FebType, MemberActions, MeetingSheet, type MeetingTile } from '@vocespace/ui';
import { MeetingButton, MeetingIcon } from '../ui/meeting';
import { SettingsDialog } from '../ui/settings-widgets';
import { FeedbackDialog } from '../feedback/FeedbackDialog';
import { useI18n } from '../i18n';
import type { NativeRoom } from './room';

export function MemberModeration({ member, room, canBlock, accountEmail, onClose }: {
  member: MeetingTile; room: NativeRoom; canBlock: boolean; accountEmail?: string; onClose: () => void;
}) {
  const { t } = useI18n();
  const [mode, setMode] = useState<'actions' | 'confirm' | 'report'>('actions');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const active = useRef(true);
  const flight = useRef(false);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  return <>
    <Modal transparent visible={mode === 'actions'} animationType="slide" onRequestClose={onClose}>
      <MeetingSheet open title={t('moderation.title')} height="58%" onClose={onClose}
        closeLabel={t('common.close')} Button={MeetingButton} Icon={MeetingIcon}
        content={<MemberActions name={member.name} status={member.status} canBlock={canBlock}
          t={t} Button={MeetingButton} Icon={MeetingIcon}
          onBlock={() => setMode('confirm')} onReport={() => setMode('report')} />} />
    </Modal>
    <SettingsDialog open={mode === 'confirm'} title={t('moderation.confirm_title')}
      disabled={busy || !canBlock} confirmLabel={t('moderation.block')} onClose={() => { if (!busy) onClose(); }}
      onConfirm={() => {
        if (flight.current || !canBlock) return;
        flight.current = true;
        setBusy(true); setError(false);
        void analytics.run('member_block', { source: 'meeting', actor_role: room.isOwner ? 'owner' : 'admin' }, () => room.blockMember(member.id)).then(() => { if (active.current) onClose(); })
          .catch(() => { if (active.current) setError(true); })
          .finally(() => { flight.current = false; if (active.current) setBusy(false); });
      }}>
      <Text style={{ color: '#C8D6DF' }}>{member.name}\n{t('moderation.confirm')}</Text>
      {error && <Text accessibilityRole="alert" style={{ color: '#FF8195' }}>{t('moderation.failed')}</Text>}
    </SettingsDialog>
    <FeedbackDialog open={mode === 'report'} room={room} accountEmail={accountEmail}
      varient={FebType.Report} target={{ id: member.id, name: member.name, spaceName: room.raw.name }} onClose={onClose} />
  </>;
}
