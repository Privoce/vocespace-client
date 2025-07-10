import { Drawer, Tabs, TabsProps } from 'antd';
import { DEFAULT_DRAWER_PROP, DrawerCloser, DrawerHeader } from '../controls/drawer_tools';
import { useState } from 'react';
import { AppTimer } from './timer';
import { useI18n } from '@/lib/i18n/i18n';
import { AppCountdown } from './countdown';
import { MessageInstance } from 'antd/es/message/interface';
import { AppTodo } from './todo_list';

export interface AppDrawerProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  messageApi: MessageInstance;
}

type AppKey = 'timer' | 'countdown' | 'todo';

export function AppDrawer({ open, setOpen, messageApi }: AppDrawerProps) {
  const [key, setKey] = useState<AppKey>('timer');
  const {t} = useI18n();

  const items: TabsProps['items'] = [
    {
      key: 'timer',
      label: t('more.app.timer.title'),
      children: <AppTimer></AppTimer>,
    },
    {
      key: 'countdown',
      label: t('more.app.countdown.title'),
      children: <AppCountdown messageApi={messageApi}></AppCountdown>
    },
    {
      key: 'todo',
      label: t('more.app.todo.title'),
      children: <AppTodo messageApi={messageApi}></AppTodo>,
    },
  ];

  return (
    <Drawer
      {...DEFAULT_DRAWER_PROP}
      width={'640px'}
      open={open}
      onClose={() => setOpen(false)}
      title={<DrawerHeader title={'App'}></DrawerHeader>}
      extra={DrawerCloser({
        on_clicked: () => {
          setOpen(false);
        },
      })}
    >
      <Tabs
        activeKey={key}
        tabPosition="left"
        centered
        items={items}
        style={{ width: '100%', height: '100%' }}
        onChange={(k: string) => {
          setKey(k as AppKey);
        }}
      />
    </Drawer>
  );
}
