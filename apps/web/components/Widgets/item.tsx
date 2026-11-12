'use client';

import phone from './phone.module.scss';
import mobile from '@/styles/mobile.module.scss';
import { useWidgetApps } from '@/components/Widgets/hooks/useWidgetApps';
import { FlotAppExports, FlotAppItemProps } from '@/components/Flot/types';
import { getWidgetPanels, type FlotAppItemModel } from './panels';
import { Collapse, type CollapseProps } from 'antd';
import { MeetingAppsPanel } from '@vocespace/ui';
import styles from '@/styles/apps.module.scss';
import type { AppKey } from '@/lib/std/space';

import * as React from 'react';
export * from '@/components/Flot/types';

export const FlotAppItem = React.forwardRef<FlotAppExports, FlotAppItemProps>(
  function FlotAppItem(props, ref) {
    const model = useWidgetApps(props, ref);
    const panels = getWidgetPanels(model) || [];
    const isPhone = model.device === 'phone';
    const active = panels.some((panel) => panel.key === model.activeTab)
      ? model.activeTab
      : String(panels[0]?.key || '');
    return (
      <div
        ref={model.containerRef}
        className={isPhone ? `${mobile.surface} ${phone.panels}` : styles.flot_app_item}
      >
        {isPhone && <FlotAppItemPhone model={model} panels={panels} active={active} />}
        {!isPhone && (
          <Collapse
            bordered={false}
            activeKey={isPhone ? [active] : model.activeKeys}
            onChange={(keys) => {
              if (!isPhone) model.setActiveKeys(keys as AppKey[]);
            }}
            items={panels.map((panel) => ({
              ...panel,
              forceRender: true,
              collapsible: isPhone ? 'disabled' : undefined,
            }))}
          />
        )}
      </div>
    );
  },
);

export function FlotAppItemPhone({
  model,
  panels,
  active,
}: {
  model: FlotAppItemModel;
  panels: NonNullable<CollapseProps['items']>;
  active: string;
}) {
  return (
    <MeetingAppsPanel
      active={active}
      onChange={model.setActiveTab}
      tabs={panels.map((panel) => ({
        id: String(panel.key),
        header: panel.label,
        content: panel.children,
        label: model.t(
          panel.key === 'together' ? 'more.app.todo.together.title' : `more.app.${panel.key}.title`,
        ),
      }))}
    />
  );
}
