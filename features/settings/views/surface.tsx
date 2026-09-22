import mobile from '@/styles/mobile.module.scss';
import { Tabs } from 'antd';
import { getSettingsPanels, type SettingsModel } from './panels';
import { SettingsPhone } from './phone';
import styles from './phone.module.scss';

/** Keep mounted panels and their media previews when the breakpoint changes. */
export function SettingsSurface({ model }: { model: SettingsModel }) {
  const phone = model.device === 'phone';
  return <div className={phone ? mobile.surface : undefined} style={{ width: '100%', minWidth: 0 }}>
    {phone && <SettingsPhone model={model} />}
    <Tabs className={phone ? styles.panel : undefined} activeKey={model.key} tabPosition="left"
      renderTabBar={phone ? () => <></> : undefined} items={getSettingsPanels(model)} onChange={model.selectPanel}
      style={{ width: '100%', height: '100%', display: phone && !model.phonePanelOpen ? 'none' : undefined }} />
  </div>;
}
