'use client';
import * as React from 'react';
import { useSettings } from './hooks/useSettings';
import { Tabs } from 'antd';
import { SettingsProps, SettingsExports } from '@/components/Settings/types';
import { getSettingsPanels, type SettingsModel } from './panels';
import styles from './index.module.scss';
import mobile from '@/styles/mobile.module.scss';
import { SettingsPhone } from './phone';


export * from '@/components/Settings/types';

export const Settings = React.forwardRef<SettingsExports, SettingsProps>(
  function Settings(props, ref) {
    const model = useSettings(props, ref);
    const phone = model.device === 'phone';

    return (
    <div className={phone ? mobile.surface : undefined} style={{ width: '100%', minWidth: 0 }}>
      {phone && <SettingsPhone model={model} />}
      <Tabs
        className={phone ? styles.panel : undefined}
        activeKey={model.key}
        tabPosition="left"
        renderTabBar={phone ? () => <></> : undefined}
        items={getSettingsPanels(model)}
        onChange={model.selectPanel}
        style={{
          width: '100%',
          height: '100%',
          display: phone && !model.phonePanelOpen ? 'none' : undefined,
        }}
      />
    </div>
  );
  },
);
