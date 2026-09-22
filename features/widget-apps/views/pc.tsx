import mobile from '@/styles/mobile.module.scss';
import type { AppKey } from '@/lib/std/space';
import styles from '@/styles/apps.module.scss';
import { Collapse } from 'antd';
import { getWidgetPanels, type FlotAppItemModel } from './panels';
import { FlotAppItemPhone } from './phone';
import phone from './phone.module.scss';

/** A stable panel host preserves each app's local draft and running timer on resize. */
export function FlotAppItemPC({ model }: { model: FlotAppItemModel }) {
  const panels = getWidgetPanels(model) || [];
  const isPhone = model.device === 'phone';
  const active = panels.some(panel => panel.key === model.activeTab) ? model.activeTab : String(panels[0]?.key || '');
  return <div ref={model.containerRef} className={isPhone ? `${mobile.surface} ${phone.panels}` : styles.flot_app_item}>
    {isPhone && <FlotAppItemPhone model={model} panels={panels} active={active} />}
    <Collapse bordered={false} activeKey={isPhone ? [active] : model.activeKeys}
      onChange={keys => { if (!isPhone) model.setActiveKeys(keys as AppKey[]); }}
      items={panels.map(panel => ({ ...panel, forceRender: true, collapsible: isPhone ? 'disabled' : undefined }))} />
  </div>;
}
