import type { ReactNode } from 'react';
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
  >;
  owner?: boolean;
}) {
  return (
    <Div className={`${styles.setting_box} ${styles.scroll_box}`}>
      <Div className={styles.common_space}>{t('settings.general.lang')}:</Div>
      {slots.language}
      <Div className={styles.common_space}>{t('settings.general.status.title')}:</Div>
      <Div className={styles.setting_box_line}>
        {slots.status}
        {slots.saveStatus}
      </Div>
      <Div className={styles.common_space}>{t('settings.general.prompt_sound')}:</Div>
      {slots.prompt}
      {owner && (
        <>
          <Div className={styles.common_space}>{t('settings.general.persistence.title')}:</Div>
          {slots.persistence}
          <Div className={styles.common_space}>{t('settings.general.conf.allow_guest.title')}:</Div>
          {slots.guests}
        </>
      )}
      <Div className={styles.common_space}>
        {t('settings.general.manage_dashboard') || 'Dashboard'}:
      </Div>
      {slots.dashboard}
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
  elements: { Div },
  styles,
  slots,
}: SettingsViewProps & {
  slots: SettingsSlots<'table' | 'save'>;
}) {
  return (
    <Div className={`${styles.setting_box} ${styles.scroll_box}`}>
      {slots.table}
      {slots.save}
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
