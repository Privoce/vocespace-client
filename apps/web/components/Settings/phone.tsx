import mobile from '@/styles/mobile.module.scss';
import { ArrowLeftOutlined, RightOutlined } from '@ant-design/icons';
import { Button } from 'antd';
import { PhoneSettingsNavigation, type PhoneSettingsParts } from '@vocespace/ui';
import type { SettingsModel } from './panels';
import { getSettingsPanels } from './panels';
import styles from './index.module.scss';

// Keep the established Web markup and stylesheet unchanged. These are rendering ports,
// not a new visual design; only the Phone composition is shared with Native.
const webParts: PhoneSettingsParts = {
  Header: ({ title, backLabel, onBack }) => (
    <header className={mobile.header}>
      <Button type="text" aria-label={backLabel} icon={<ArrowLeftOutlined />} onClick={onBack} />
      <h2>{title}</h2>
    </header>
  ),
  Menu: ({ children }) => <div className={`${mobile.surface} ${styles.settings}`}>{children}</div>,
  Profile: ({ name, spaceName }) => (
    <div className={`${mobile.card} ${styles.profile}`}>
      <span className={styles.avatar}>{name.slice(0, 1).toUpperCase()}</span>
      <div className={styles.name}>
        {name}
        <small>{spaceName}</small>
      </div>
    </div>
  ),
  Group: ({ children }) => <nav className={styles.group}>{children}</nav>,
  Row: ({ children, onPress }) => (
    <button type="button" className={styles.row} onClick={onPress}>
      <span>{children}</span>
      <RightOutlined />
    </button>
  ),
};
export function SettingsPhone({ model }: { model: SettingsModel }) {
  return (
    <PhoneSettingsNavigation
      name={model.username || model.localParticipant.identity}
      spaceName={model.space.name}
      panels={getSettingsPanels(model).map((panel) => ({ id: panel.key, label: panel.label }))}
      activePanel={model.phonePanelOpen ? model.key : undefined}
      onSelect={model.selectPanel}
      onBack={() => model.setPhonePanelOpen(false)}
      backLabel={model.t('common.back')}
      parts={webParts}
    />
  );
}
