import { Tabs, type CollapseProps } from 'antd';
import type { FlotAppItemModel } from './panels';

export function FlotAppItemPhone({ model, panels, active }: { model: FlotAppItemModel; panels: NonNullable<CollapseProps['items']>; active: string }) {
  return <Tabs activeKey={active} onChange={model.setActiveTab} items={panels.map(panel => ({
    key: String(panel.key),
    label: model.t(panel.key === 'together' ? 'more.app.todo.together.title' : `more.app.${panel.key}.title`),
  }))} />;
}
