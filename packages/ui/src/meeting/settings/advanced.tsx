import type { ReactNode } from 'react';
import type { SettingsViewProps, SettingsSlots } from './types';

export function AvoPhoneContent({
  elements: { Div, Strong, Flex },
  t,
  slots,
}: SettingsViewProps & {
  slots: SettingsSlots<
    | 'preview'
    | 'name'
    | 'enabled'
    | 'style'
    | 'palette'
    | 'energy'
    | 'shuffle'
    | 'reset'
    | 'save'
    | 'export'
    | 'import'
    | 'presets'
  >;
}) {
  return (
    <Div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <Div>
        <Div
          style={{
            height: 240,
            borderRadius: 16,
            overflow: 'hidden',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          {slots.preview}
        </Div>
        <Div style={{ marginTop: 12 }}>
          <Strong strong style={{ fontSize: 12 }}>
            {t('avo.displayName') || 'Display Name'}
          </Strong>
          {slots.name}
        </Div>
      </Div>
      <Div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <Flex justify="space-between" align="center">
          <Strong strong style={{ fontSize: 12 }}>
            {t('avo.title')}
          </Strong>
          {slots.enabled}
        </Flex>
        <Div>
          <Strong strong style={{ fontSize: 12 }}>
            {t('avo.style')}
          </Strong>
          <Div style={{ width: '100%' }}>{slots.style}</Div>
        </Div>
        <Div>
          <Strong strong style={{ fontSize: 12 }}>
            {t('avo.color')}
          </Strong>
          <Div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between' }}>
            {slots.palette}
          </Div>
        </Div>
        <Div>
          <Strong strong style={{ fontSize: 12 }}>
            {t('avo.energy')}
          </Strong>
          {slots.energy}
        </Div>
        <Div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <Flex justify="space-between" style={{ width: '100%' }}>
            {slots.shuffle}
            {slots.reset}
          </Flex>
          <Div style={{ flex: 1 }} />
          {slots.save}
          <Flex justify="space-between" style={{ width: '100%' }}>
            {slots.export}
            <Div style={{ width: 'calc(50% - 8px)' }}>{slots.import}</Div>
          </Flex>
        </Div>
        {slots.presets}
      </Div>
    </Div>
  );
}
export function VirtualSettingsContent({
  elements: { Div },
  styles,
  slots,
}: SettingsViewProps & { slots: SettingsSlots<'preview' | 'tabs'> }) {
  return (
    <Div className={styles.virtual_settings}>
      <Div className={styles.virtual_video_box}>{slots.preview}</Div>
      {slots.tabs}
    </Div>
  );
}
export function AIDeploymentContent({
  elements: { Div },
  styles,
  t,
  verified,
  owner,
  changed,
  slots,
}: SettingsViewProps & {
  verified: boolean;
  owner: boolean;
  changed: boolean;
  slots: SettingsSlots<'token' | 'verify' | 'model' | 'key' | 'url' | 'enabled' | 'save'>;
}) {
  return verified ? (
    <>
      <Div className={styles.common_space}>
        {t('settings.ai.recommand.0')}
        {[1, 2, 3, 4, 5].map((i) => (
          <Div key={i}>{t(`settings.ai.recommand.${i}`)}</Div>
        ))}
      </Div>
      <Div className={styles.common_space}>{t('settings.ai.model')}:</Div>
      {slots.model}
      {owner && (
        <>
          <Div className={styles.common_space}>{t('settings.ai.key')}:</Div>
          {slots.key}
          <Div className={styles.common_space}>{t('settings.ai.url')}:</Div>
          {slots.url}
          <Div className={styles.common_space}>{t('settings.ai.enabled')}:</Div>
          {slots.enabled}
        </>
      )}
      {changed && owner && <Div className={styles.common_space}>{slots.save}</Div>}
    </>
  ) : (
    <>
      <Div className={styles.common_space}>{t('settings.ai.precheck.desc')}</Div>
      {slots.token}
      <Div className={styles.common_space}>{slots.verify}</Div>
    </>
  );
}
export function LicenseUpdateContent({
  elements: { Div },
  t,
  circleIp,
  slots,
}: SettingsViewProps & { circleIp: boolean; slots: SettingsSlots<'ip' | 'license'> }) {
  return circleIp ? (
    <>
      <Div>{t('settings.license.circle_ip')}</Div>
      {slots.ip}
    </>
  ) : (
    <>{slots.license}</>
  );
}
export function LicenseCancelContent({
  elements: { Div },
  t,
  email,
}: SettingsViewProps & { email: ReactNode }) {
  return (
    <>
      <Div style={{ marginBottom: '12px' }}>{t('settings.license.cancel_email_desc')}</Div>
      {email}
    </>
  );
}
export function RecordingListContent({
  elements: { Div },
  styles,
  sort,
  empty,
  records,
  pagination,
}: SettingsViewProps & {
  sort: ReactNode;
  empty: ReactNode;
  records: ReactNode;
  pagination: ReactNode;
}) {
  return (
    <Div className={styles.surface}>
      {sort}
      {empty}
      <Div style={{ display: 'grid', gap: 12 }}>{records}</Div>
      {pagination}
    </Div>
  );
}
export function AIAnalysisContent({
  elements: { Div, Span },
  styles,
  t,
  isPanel,
  manager,
  owner,
  hasSpace,
  showSettings,
  slots,
}: SettingsViewProps & {
  isPanel: boolean;
  manager: boolean;
  owner: boolean;
  hasSpace: boolean;
  showSettings: boolean;
  slots: SettingsSlots<
    | 'enabled'
    | 'frequencyInfo'
    | 'frequency'
    | 'sourcesInfo'
    | 'sources'
    | 'extractionInfo'
    | 'extraction'
    | 'blurInfo'
    | 'blur'
  >;
}) {
  return (
    <Div>
      <Div>{t('more.ai.desc')}</Div>
      {!isPanel && manager && (
        <Div className={styles.ai_cut_line}>
          <Div className={styles.ai_cut_line}>
            <Span> {t('ai.cut.open')}</Span>
          </Div>
          <Div style={{ width: '100%' }}>{hasSpace && slots.enabled}</Div>
        </Div>
      )}
      {owner && showSettings && (
        <>
          {' '}
          <Div className={styles.ai_cut_line}>
            <Span> {t('ai.cut.freq')}</Span>
            {slots.frequencyInfo}
          </Div>{' '}
          {slots.frequency}
        </>
      )}
      {showSettings && (
        <Div className={styles.ai_cut_line}>
          <Div className={styles.ai_cut_line}>
            <Span> {t('ai.cut.source_dep')}</Span>
            {slots.sourcesInfo}
          </Div>
          <Div style={{ width: '100%' }}>{slots.sources}</Div>
          <Div className={styles.ai_cut_line}>
            <Span> {t('ai.cut.extraction.title')}</Span>
            {slots.extractionInfo}
          </Div>
          <Div style={{ width: '100%' }}>{slots.extraction}</Div>
          <Div className={styles.ai_cut_line}>
            <Span> {t('ai.cut.blur.title')}</Span>
            {slots.blurInfo}
          </Div>
          <Div style={{ width: '100%' }}>{slots.blur}</Div>
        </Div>
      )}
    </Div>
  );
}
export function AvoPresetsContent({
  elements: { Div, Strong },
  t,
  children,
}: SettingsViewProps & { children: ReactNode }) {
  return (
    <Div>
      <Div style={{ display: 'flex', width: '100%', justifyContent: 'space-between' }}>
        <Strong strong style={{ fontSize: 12 }}>
          {t('avo.presets') || 'Presets'}
        </Strong>
      </Div>
      <Div
        style={{
          margin: '8px 0',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          height: 164,
          overflowY: 'auto',
        }}
      >
        {children}
      </Div>
    </Div>
  );
}
export function AvoPresetContent({
  elements: { Div },
  active,
  name,
  style,
  preview,
  actions,
}: SettingsViewProps & {
  active: boolean;
  name: string;
  style: string;
  preview: ReactNode;
  actions: ReactNode;
}) {
  return (
    <Div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 10px',
        borderRadius: 10,
        background: active ? '#131518' : 'transparent',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <Div
        style={{
          width: 64,
          height: 64,
          borderRadius: 8,
          overflow: 'hidden',
          flexShrink: 0,
          backgroundColor: '#0F1214',
          border: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        {preview}
      </Div>
      <Div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          height: 48,
        }}
      >
        <Div
          style={{
            fontWeight: 700,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            color: '#ffffff',
            fontSize: 16,
          }}
        >
          {name || 'guest'}
        </Div>
        <Div style={{ opacity: 0.6, fontSize: 12 }}>{style}</Div>
      </Div>
      {actions}
    </Div>
  );
}
export function RecordingCardContent({
  elements: { Article, Bold, Div, Break },
  styles,
  name,
  tag,
  size,
  date,
  actions,
}: SettingsViewProps & {
  name: string;
  tag: ReactNode;
  size: string;
  date: string;
  actions: ReactNode;
}) {
  return (
    <Article className={styles.card}>
      <Bold>{name}</Bold>
      <Div style={{ color: '#98a4b6', fontSize: 12, margin: '12px 0', lineHeight: 1.8 }}>
        {tag}
        {size}
        <Break />
        {date}
      </Div>
      {actions}
    </Article>
  );
}
export function VirtualGalleryContent({
  elements: { Div, Heading4 },
  title,
  children,
}: SettingsViewProps & { title: string; children: ReactNode }) {
  return (
    <Div>
      <Heading4>{title}</Heading4>
      <Div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {children}
      </Div>
    </Div>
  );
}
export function VirtualGalleryItem({
  elements: { Div, Clickable },
  styles,
  onSelect,
  selected,
  preview,
  noneLabel,
}: SettingsViewProps & {
  onSelect?: () => void;
  selected: ReactNode;
  preview: ReactNode;
  noneLabel?: string;
}) {
  return (
    <Clickable className={styles.virtual_model_box} onClick={onSelect}>
      {selected}
      {noneLabel !== undefined ? (
        <Div
          style={{
            height: '120px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: '700',
          }}
        >
          {noneLabel}
        </Div>
      ) : (
        preview
      )}
    </Clickable>
  );
}
export function SettingsSelectedMask({
  elements: { Div },
  styles,
  icon,
}: Pick<SettingsViewProps, 'elements' | 'styles'> & { icon: ReactNode }) {
  return <Div className={styles.selected_mask}>{icon}</Div>;
}
