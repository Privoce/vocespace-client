import { Tabs } from 'antd';
import type { SettingsModel } from './panels';
import { getSettingsPanels } from './panels';
export function SettingsPC({ model }: { model: SettingsModel }) { return <Tabs activeKey={model.key} tabPosition="left" items={getSettingsPanels(model)} onChange={model.selectPanel} style={{ width: '100%', height: '100%' }} />; }
