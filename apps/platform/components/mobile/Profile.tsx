'use client';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { Avatar, Button, Input, Modal, Select, Switch, Spin, message } from 'antd';
import {
  UserOutlined,
  CopyOutlined,
  EditOutlined,
  RightOutlined,
  VideoCameraOutlined,
  ShareAltOutlined,
  GiftOutlined,
} from '@ant-design/icons';
import { useUser } from '@/hooks/useUser';
import { useI18n } from '@/lib/i18n/i18n';
import { vocespaceUrl, vocespaceUrlVisit } from '@/lib/std/space';
import { platformConfiguration } from '@/lib/runtime-config';
import { platformFetch } from '@/lib/api/client';
import { EditAvatarBtn } from '@/app/auth/user/[userId]/widgets/avatar';
import { PolicyLinks } from '@/components/legal/PolicyLinks';
import { useMobileText } from './useMobileText';
import s from './phone.module.scss';
export function MobileProfile({ onBrowse }: { onBrowse: () => void }) {
  const m = useUser({});
  const t = useMobileText();
  const { locale, changeLocale } = useI18n();
  const [toast, context] = message.useMessage();
  const [panel, setPanel] = useState('');
  const [nickname, setNickname] = useState('');
  const [busy, setBusy] = useState(false);
  const [content, setContent] = useState('');
  const [email, setEmail] = useState<string | undefined>();
  const [prefs, setPrefs] = useState({
    notifications: true,
    gestures: true,
    autoJoin: true,
    previewMuted: true,
  });
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('vocespace.platform.preferences') || '{}');
      setPrefs((p) => ({
        ...p,
        ...Object.fromEntries(Object.entries(stored).filter(([, v]) => typeof v === 'boolean')),
      }));
    } catch {}
  }, []);
  const preference = (key: keyof typeof prefs, value: boolean) => {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    try {
      localStorage.setItem('vocespace.platform.preferences', JSON.stringify(next));
      window.dispatchEvent(new Event('vocespace-preferences'));
    } catch {
      toast.error(t('native_account.storage_error'));
    }
  };
  const run = async (task: () => Promise<void>) => {
    setBusy(true);
    try {
      await task();
    } catch {
      toast.error(t('account_auth.unavailable'));
    } finally {
      setBusy(false);
    }
  };
  const copy = (value: string) =>
    run(async () => {
      await navigator.clipboard.writeText(value);
      toast.success(t('native_account.copied'));
    });
  const room = m.userInfo?.username;
  return (
    <div className={s.page}>
      {context}
      {m.loading && !m.user ? (
        <Spin />
      ) : m.user ? (
        <div className={s.identity}>
          <EditAvatarBtn
            userId={m.user.id}
            oldAvatar={m.avatar}
            client={m.client}
            messageApi={toast}
            afterUpdate={() => void m.refreshUserData()}
          >
            <Avatar size={72} src={m.avatar} icon={<UserOutlined />} />
          </EditAvatarBtn>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className={s.row}>
              <h2>{m.userInfo?.nickname || room || m.user.email}</h2>
              <Button
                type="text"
                icon={<EditOutlined />}
                onClick={() => {
                  setNickname(m.userInfo?.nickname || room || '');
                  setPanel('edit');
                }}
              >
                {t('native_account.edit')}
              </Button>
            </div>
            <div className={s.row}>
              <p style={{ overflowWrap: 'anywhere' }}>{m.user.email}</p>
              <Button
                aria-label={t('native_account.email')}
                icon={<CopyOutlined />}
                onClick={() => void copy(m.user!.email || '')}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className={s.guest}>
          <Avatar size={80} icon={<UserOutlined />} />
          <h2>{t('native_account.guest')}</h2>
          <p>{t('native_account.guest_description')}</p>
          <div className={s.actions}>
            <Button type="primary" href="/auth/login?mode=register">
              {t('native_account.email_register')}
            </Button>
            <Button onClick={onBrowse}>{t('native_account.browse')}</Button>
          </div>
          <Button type="link" href="/auth/login">
            {t('native_account.login')}
          </Button>
        </div>
      )}
      {m.user ? (
        <section className={s.panel}>
          <div className={s.row}>
            <h3>{t('native_account.my_room')}</h3>
          </div>
          <div className={s.row}>
            <h2>{room || t('account_auth.room_unavailable')}</h2>
            <Button disabled={!room} icon={<CopyOutlined />} onClick={() => void copy(room!)} />
          </div>
          <div className={s.actions}>
            <Button
              type="primary"
              icon={<VideoCameraOutlined />}
              disabled={!room || busy}
              onClick={() =>
                void run(async () => {
                  window.location.assign(await vocespaceUrl(m.userInfo!));
                })
              }
            >
              {t('native_account.quick_meeting')}
            </Button>
            <Button
              icon={<ShareAltOutlined />}
              disabled={!room || busy}
              onClick={() =>
                void run(async () => {
                  const url = vocespaceUrlVisit(room!);
                  if (navigator.share) await navigator.share({ title: room, url });
                  else await navigator.clipboard.writeText(url);
                })
              }
            >
              {t('native_account.share_room')}
            </Button>
          </div>
        </section>
      ) : (
        <section className={s.panel}>
          <GiftOutlined />
          <p>
            {t('native_account.benefit_prefix')} {t('native_account.benefit_meetings')}{' '}
            {t('native_account.benefit_and')} {t('native_account.benefit_storage')}{' '}
            {t('native_account.benefit_suffix')}
          </p>
        </section>
      )}
      <p>{t('native_account.general')}</p>
      <section className={s.panel}>
        {(['notifications', 'gestures'] as const).map((key) => (
          <div key={key} className={s.row}>
            <div>
              {t(`native_account.${key}`)}
              <p>{t(`native_account.${key}_detail`)}</p>
            </div>
            <Switch
              aria-label={t(`native_account.${key}`)}
              checked={prefs[key]}
              onChange={(v) => preference(key, v)}
            />
          </div>
        ))}
        {['preferences', 'help', 'about'].map((key) => (
          <button
            key={key}
            className={s.rowButton}
            onClick={() => {
              if (key === 'help') setEmail(m.user?.email || '');
              setPanel(key);
            }}
          >
            {t(`native_account.${key}`)}
            <RightOutlined />
          </button>
        ))}
      </section>
      {m.error && <p role="alert">{m.error}</p>}
      {m.user && (
        <>
          <Button
            danger
            disabled={busy}
            onClick={() =>
              void run(async () => {
                const r = await m.client.auth.signOut();
                if (r.error) throw r.error;
                await m.refreshUserData();
              })
            }
          >
            {t('native_account.logout')}
          </Button>
          <Button danger type="text" href={`${platformConfiguration().meetingUrl}/deleteAccount`}>
            {t('account_auth.delete_account')}
          </Button>
        </>
      )}
      <Modal
        open={panel === 'edit'}
        title={t('native_account.edit')}
        onCancel={() => setPanel('')}
        confirmLoading={busy}
        onOk={() =>
          void run(async () => {
            if (!nickname.trim() || !(await m.updateUserInfo({ nickname: nickname.trim() })))
              throw new Error();
            setPanel('');
          })
        }
      >
        <Input value={nickname} maxLength={30} onChange={(e) => setNickname(e.target.value)} />
      </Modal>
      <Modal
        open={panel === 'preferences'}
        title={t('native_account.preferences')}
        onCancel={() => setPanel('')}
        footer={null}
      >
        <div className={s.page}>
          <Select
            value={locale}
            onChange={changeLocale}
            options={[
              { value: 'zh', label: '简体中文' },
              { value: 'en', label: 'English' },
            ]}
          />
          <div className={s.row}>
            {t('native_account.auto_join')}
            <Switch checked={prefs.autoJoin} onChange={(v) => preference('autoJoin', v)} />
          </div>
          <div className={s.row}>
            {t('native_account.preview_muted')}
            <Switch checked={prefs.previewMuted} onChange={(v) => preference('previewMuted', v)} />
          </div>
        </div>
      </Modal>
      <Modal
        open={panel === 'about'}
        title={t('native_account.about')}
        onCancel={() => setPanel('')}
        footer={null}
      >
        <div className={s.page}>
          <Image src="/logo.svg" alt="VoceSpace" width={80} height={80} />
          <h2>VoceSpace</h2>
          <PolicyLinks />
        </div>
      </Modal>
      <Modal
        open={panel === 'help'}
        title={t('native_account.help')}
        onCancel={() => setPanel('')}
        confirmLoading={busy}
        onOk={() =>
          void run(async () => {
            const r = await platformFetch('feedback', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                email: email ?? m.user?.email,
                feedbackType: 'feedback',
                content,
                attachments: [],
              }),
            });
            if (!r.ok) throw new Error();
            setContent('');
            setPanel('');
          })
        }
      >
        <div className={s.page}>
          <Input
            type="email"
            placeholder={t('native_account.email')}
            value={email ?? m.user?.email ?? ''}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input.TextArea
            placeholder={t('channel.feedback.content_placeholder')}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            maxLength={4000}
            rows={6}
          />
        </div>
      </Modal>
    </div>
  );
}
