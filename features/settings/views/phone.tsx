import mobile from '@/styles/mobile.module.scss';
import { ArrowLeftOutlined, RightOutlined } from '@ant-design/icons';
import { Button } from 'antd';
import type { SettingsModel } from './panels';
import { getSettingsPanels } from './panels';
import styles from './phone.module.scss';

export function SettingsPhone({ model }: { model: SettingsModel }) {
  const panels = getSettingsPanels(model);
  const groups = [['general', 'profile', 'auth'], ['audio', 'video', 'app', 'ai'], ['recording', 'license', 'about_us']];
  if (model.phonePanelOpen) return <header className={mobile.header}>
    <Button type="text" aria-label={model.t('common.back')} icon={<ArrowLeftOutlined />} onClick={() => model.setPhonePanelOpen(false)} />
    <h2>{panels.find(panel => panel.key === model.key)?.label}</h2>
  </header>;
  return <div className={`${mobile.surface} ${styles.settings}`}>
    <div className={`${mobile.card} ${styles.profile}`}>
      <span className={styles.avatar}>{(model.username || model.localParticipant.identity).slice(0, 1).toUpperCase()}</span>
      <div className={styles.name}>{model.username || model.localParticipant.identity}<small>{model.space.name}</small></div>
    </div>
    {groups.map(group => <nav key={group[0]} className={styles.group}>
      {panels.filter(panel => group.includes(panel.key)).map(panel => <button type="button" key={panel.key} className={styles.row} onClick={() => model.selectPanel(panel.key)}>
        <span>{panel.label}</span><RightOutlined />
      </button>)}
    </nav>)}
  </div>;
}
