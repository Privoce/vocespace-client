'use client';
import * as React from 'react';
import { useSettings } from './hooks/useSettings';
import { Tabs } from 'antd';
import { SettingsProps, SettingsExports } from '@/components/Settings/types';
import { getSettingsPanels } from './panels';
import styles from './index.module.scss';
import phoneStyles from './phone.module.scss';
import { MeetingSheetHeader } from '@vocespace/ui';
import { MeetingButton, MeetingIcon } from '@/components/MeetingUI/primitives';
import { SettingsPhone } from './phone';

export * from '@/components/Settings/types';

export const Settings = React.forwardRef<SettingsExports, SettingsProps>(
  function Settings(props, ref) {
    const model = useSettings(props, ref);
    const phone = model.device === 'phone';

    const tabs = (
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
    );
    const title = model.phonePanelOpen
      ? model.t(
          model.key === 'app'
            ? 'more.app.title'
            : model.key === 'recording'
              ? 'recording.title'
              : `settings.${model.key}.title`,
        )
      : model.t('settings.title');
    return (
      <div
        className={phone ? phoneStyles.phone : undefined}
        style={{
          width: '100%',
          minWidth: 0,
          ...(phone ? { height: '100%', display: 'flex', flexDirection: 'column' as const } : {}),
        }}
      >
        {phone && props.onClose && (
          <MeetingSheetHeader
            title={title}
            Button={MeetingButton}
            Icon={MeetingIcon}
            closeLabel={model.t('common.close')}
            backLabel={model.t('common.back')}
            onClose={props.onClose}
            onBack={model.phonePanelOpen ? () => model.setPhonePanelOpen(false) : undefined}
          />
        )}
        <div style={phone ? { overflowY: 'auto', flex: 1, minHeight: 0 } : { display: 'contents' }}>
          <>
            {phone && <SettingsPhone model={model} />}
            {tabs}
          </>
        </div>
      </div>
    );
  },
);
