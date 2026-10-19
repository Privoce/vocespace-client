import { useState, type ReactNode } from 'react';
import type { SettingsViewProps, SettingsSlots } from './types';

/** These are the established Phone panel structures. Platform widgets are supplied in slots. */
export function GeneralSettingsContent({
  elements: { Div },
  styles,
  t,
  slots,
  owner = false,
}: SettingsViewProps & {
  slots: SettingsSlots<
    'language' | 'status' | 'saveStatus' | 'prompt' | 'persistence' | 'guests' | 'dashboard'
  > & { introIcon?: ReactNode };
  owner?: boolean;
}) {
  const row = {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  } as const;
  const card = {
    backgroundColor: '#1A2832',
    border: '1px solid #2A3D49',
    borderRadius: 16,
    padding: 16,
  };
  const label = { color: '#ADC1CD', marginTop: 24, marginBottom: 12, fontSize: 13 };
  return (
    <Div className={styles.setting_box}>
      <Div style={{ ...row, justifyContent: 'flex-start', marginBottom: 24 }}>
        {slots.introIcon && (
          <Div
            style={{
              backgroundColor: '#15343F',
              border: '1px solid #285565',
              borderRadius: 14,
              padding: 14,
            }}
          >
            {slots.introIcon}
          </Div>
        )}
        <Div style={{ flex: 1 }}>
          <Div style={{ color: '#E8EFF3', fontSize: 19, fontWeight: 600 }}>
            {t('phone_meeting.general_title')}
          </Div>
          <Div style={{ color: '#829EAE', marginTop: 8 }}>{t('phone_meeting.general_hint')}</Div>
        </Div>
      </Div>
      <Div style={label}>{t('settings.general.lang')}</Div>
      {slots.language}
      <Div style={label}>{t('settings.general.status.title')}</Div>
      <Div style={row}>
        <Div style={{ flex: 1 }}>{slots.status}</Div>
        {slots.saveStatus}
      </Div>
      <Div style={label}>{t('phone_meeting.preferences')}</Div>
      <Div style={card}>
        <Div style={row}>
          <Div style={{ flex: 1 }}>
            <Div>{t('settings.general.prompt_sound')}</Div>
            <Div style={{ color: '#829EAE', fontSize: 12, marginTop: 6 }}>
              {t('phone_meeting.prompt_hint')}
            </Div>
          </Div>
          {slots.prompt}
        </Div>
        {owner && (
          <Div style={{ ...row, borderTop: '1px solid #2A3D49', paddingTop: 16, marginTop: 16 }}>
            <Div style={{ flex: 1 }}>
              <Div>{t('settings.general.persistence.title')}</Div>
              <Div style={{ color: '#829EAE', fontSize: 12, marginTop: 6 }}>
                {t('phone_meeting.persistence_hint')}
              </Div>
            </Div>
            {slots.persistence}
          </Div>
        )}
      </Div>
      {owner && (
        <>
          <Div style={label}>{t('settings.general.conf.allow_guest.title')}</Div>
          <Div style={card}>{slots.guests}</Div>
        </>
      )}
      {slots.dashboard && <Div style={{ marginTop: 24 }}>{slots.dashboard}</Div>}
    </Div>
  );
}
export function ProfileSettingsContent({
  elements: { Div },
  styles,
  t,
  slots,
}: SettingsViewProps & {
  slots: SettingsSlots<'username' | 'avo'>;
}) {
  return (
    <Div>
      <Div className={styles.setting_box}>
        <Div>{t('settings.general.username')}:</Div>
        {slots.username}
      </Div>
      {slots.avo}
    </Div>
  );
}
export function AudioSettingsContent({
  elements: { Div },
  styles,
  t,
  slots,
}: SettingsViewProps & {
  slots: SettingsSlots<
    'device' | 'volume' | 'noise_suppression' | 'echo_cancellation' | 'auto_gain_control'
  >;
}) {
  return (
    <Div>
      <Div className={styles.setting_box}>
        <Div>{t('settings.audio.device')}:</Div>
        {slots.device}
      </Div>
      <Div className={styles.setting_box}>
        <Div>{t('settings.audio.volume')}:</Div>
        {slots.volume}
      </Div>
      <Div className={styles.setting_box}>
        <Div>{t('settings.audio.noise_suppression')}:</Div>
        {slots.noise_suppression}
      </Div>
      <Div className={styles.setting_box}>
        <Div>{t('settings.audio.echo_cancellation')}:</Div>
        {slots.echo_cancellation}
      </Div>
      <Div className={styles.setting_box}>
        <Div>{t('settings.audio.auto_gain_control')}:</Div>
        {slots.auto_gain_control}
      </Div>
    </Div>
  );
}
export function VideoSettingsContent({
  elements: { Div, Span },
  styles,
  t,
  slots,
}: SettingsViewProps & {
  slots: SettingsSlots<'device' | 'shareAudio' | 'videoBlur' | 'screenBlur' | 'virtual'>;
}) {
  return (
    <Div className={styles.scroll_box}>
      <Div className={styles.setting_box}>
        <Div>{t('settings.video.device')}:</Div>
        {slots.device}
      </Div>
      <Div>
        <Div className={styles.common_space}>{t('settings.general.share_audio')}:</Div>
        {slots.shareAudio}
      </Div>
      <Div className={styles.setting_box}>
        <Span>{t('settings.video.video_blur')}:</Span>
        {slots.videoBlur}
      </Div>
      <Div className={styles.setting_box}>
        <Span>{t('settings.video.screen_blur')}:</Span>
        {slots.screenBlur}
      </Div>
      <Div className={styles.setting_box}>
        <Div style={{ marginBottom: '6px' }}>{t('settings.virtual.title')}:</Div>
        {slots.virtual}
      </Div>
    </Div>
  );
}
export function AuthSettingsContent({
  elements,
  elements: { Div },
  styles,
  t,
  slots,
}: SettingsViewProps & {
  slots: SettingsSlots<'table' | 'save'> & {
    microphone?: ReactNode;
    camera?: ReactNode;
    management?: ReactNode;
    introIcon?: ReactNode;
  };
}) {
  return (
    <Div className={`${styles.setting_box} ${styles.scroll_box}`}>
      <Div
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 14,
          marginBottom: 24,
        }}
      >
        {slots.introIcon && (
          <Div
            style={{
              backgroundColor: '#15343F',
              border: '1px solid #285565',
              borderRadius: 14,
              padding: 14,
            }}
          >
            {slots.introIcon}
          </Div>
        )}
        <Div style={{ flex: 1 }}>
          <Div style={{ color: '#E8EFF3', fontSize: 19, fontWeight: 600 }}>
            {t('phone_meeting.permissions_title')}
          </Div>
          <Div style={{ color: '#829EAE', marginTop: 8 }}>
            {t('phone_meeting.permissions_hint')}
          </Div>
        </Div>
      </Div>
      {(slots.microphone || slots.camera) && (
        <Div
          style={{
            backgroundColor: '#1A2832',
            border: '1px solid #2A3D49',
            borderRadius: 16,
            padding: 16,
          }}
        >
          <Div
            style={{
              display: 'flex',
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <Div>{t('common.device.microphone')}</Div>
            <Div>{slots.microphone}</Div>
          </Div>
          <Div
            style={{
              display: 'flex',
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
              marginTop: 24,
            }}
          >
            <Div>{t('common.device.camera')}</Div>
            <Div>{slots.camera}</Div>
          </Div>
        </Div>
      )}
      <PermissionDetails
        elements={elements}
        title={t('phone_meeting.manage_permissions')}
        table={slots.table}
        save={slots.save}
      />
    </Div>
  );
}
function PermissionDetails({
  elements: { Div, Clickable },
  title,
  table,
  save,
}: {
  elements: SettingsViewProps['elements'];
  title: string;
  table: ReactNode;
  save: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Div style={{ marginTop: 24 }}>
      <Clickable
        onClick={() => setOpen(!open)}
        role="button"
        tabIndex={0}
        onKeyDown={(event: { key: string; preventDefault: () => void }) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            setOpen(!open);
          }
        }}
        aria-expanded={open}
      >
        <Div
          style={{
            border: '1px solid #304753',
            borderRadius: 14,
            backgroundColor: '#1A2832',
            padding: 16,
            color: '#E8EFF3',
            fontWeight: 600,
            textAlign: 'center',
          }}
        >
          {title}
        </Div>
      </Clickable>
      <Div style={{ display: open ? 'block' : 'none', overflowX: 'auto', marginTop: 16 }}>
        {table}
        {save}
      </Div>
    </Div>
  );
}
export function AppSettingsContent({
  elements: { Div },
  styles,
  slots,
}: SettingsViewProps & {
  slots: SettingsSlots<'owner' | 'syncLabel' | 'sync'>;
}) {
  return (
    <Div className={styles.setting_box}>
      {slots.owner}
      {slots.syncLabel}
      {slots.sync}
    </Div>
  );
}
export function AISettingsContent({
  elements: { Div },
  styles,
  t,
  slots,
}: SettingsViewProps & {
  slots: SettingsSlots<'analysis' | 'save' | 'deployment'>;
}) {
  return (
    <Div className={`${styles.setting_box} ${styles.scroll_box}`}>
      <Div className={styles.common_space}>{t('settings.ai.desc')}</Div>
      {slots.analysis}
      <Div className={styles.common_space}>{slots.save}</Div>
      {slots.deployment}
    </Div>
  );
}
export function RecordingSettingsContent({
  elements: { Div },
  slots,
}: SettingsViewProps & {
  slots: SettingsSlots<'connection' | 'refresh' | 'records'>;
}) {
  return (
    <Div>
      <Div
        style={{
          width: '100%',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
        }}
      >
        {slots.connection}
        {slots.refresh}
      </Div>
      {slots.records}
    </Div>
  );
}
export function LicenseSettingsContent({
  elements: { Div },
  styles,
  slots,
}: SettingsViewProps & {
  slots: SettingsSlots<
    'calendar' | 'updateDialog' | 'cancelDialog' | 'details' | 'buy' | 'cancel' | 'update'
  >;
}) {
  return (
    <Div>
      {slots.calendar}
      {slots.updateDialog}
      {slots.cancelDialog}
      {slots.details}
      <Div className={styles.setting_box} style={{ gap: '8px', display: 'flex' }}>
        {slots.buy}
        {slots.cancel}
        {slots.update}
      </Div>
    </Div>
  );
}
export function AboutSettingsContent({
  elements: { Div, Span, Link },
  t,
  logo,
}: SettingsViewProps & { logo: ReactNode }) {
  return (
    <Div
      style={{
        display: 'flex',
        gap: '16px',
        alignItems: 'center',
        justifyContent: 'center',
        flexWrap: 'wrap',
      }}
    >
      <Div style={{ display: 'inline-flex', alignItems: 'center', gap: '16px' }}>
        {logo}
        <Span style={{ fontSize: '32px', color: '#fff', fontWeight: '700' }}>VoceSpace</Span>
      </Div>
      <Div
        style={{
          fontSize: '18px',
          fontWeight: '700',
          color: '#FFFFFF',
          textAlign: 'left',
          width: '100%',
          wordSpacing: '0px',
        }}
      >
        {t('settings.about_us.brief')}
      </Div>
      <Div style={{ textAlign: 'justify', textIndent: '2rem' }}>{t('settings.about_us.desc')}</Div>
      <Div style={{ textAlign: 'right', width: '100%' }}>
        <Div>
          {' '}
          {t('msg.info.contact')}
          <Link
            href="mailto:han@privoce.com"
            style={{ color: '#22CCEE', textDecorationLine: 'none', margin: '0 4px' }}
          >
            han@privoce.com
          </Link>
        </Div>
        <Div>
          {' '}
          {t('msg.info.learn_more')}:
          <Link
            href="https://vocespace.com"
            style={{ color: '#22CCEE', textDecorationLine: 'none', margin: '0 4px' }}
          >
            {t('msg.info.offical_web')}
          </Link>
        </Div>
      </Div>
    </Div>
  );
}
