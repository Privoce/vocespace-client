import mobile from '@/styles/mobile.module.scss';
import type { DashboardModel } from './pc';

export function DashboardPhone({ model }: { model: DashboardModel }) {
  return <nav className={mobile.tabs} aria-label={model.t('dashboard.title')}>
    {model.menuItems.map(item => <button key={item.key} type="button" className={mobile.tab}
      aria-current={model.menuTab === item.key ? 'page' : undefined}
      aria-pressed={model.menuTab === item.key}
      onClick={() => model.setMenuTab(item.key as typeof model.menuTab)}>{item.label}</button>)}
  </nav>;
}
