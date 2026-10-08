import styles from '@/styles/dashboard.module.scss';
import { Menu } from 'antd';
import type { useDashboard } from '../hooks/useDashboard';
export type DashboardModel = ReturnType<typeof useDashboard>;
export function DashboardPC({ model }: { model: DashboardModel }) {
  const { menuTab, menuItems, changeMenu } = model;
  return <aside className={styles.menu}>
    <Menu
      selectedKeys={[menuTab]}
      onClick={changeMenu}
      style={{ width: 256 }}
      mode="vertical"
      items={menuItems}
    />
  </aside>;
}
