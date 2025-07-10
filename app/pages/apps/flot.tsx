import { SvgResource } from '@/app/resources/svg';
import { Button, Collapse, CollapseProps, Popover, theme } from 'antd';
import { useEffect, useState } from 'react';
import styles from '@/styles/apps.module.scss';
import { AppTimer } from './timer';
import { AppCountdown } from './countdown';
import { AppTodo } from './todo_list';
import { MessageInstance } from 'antd/es/message/interface';
import { MinusCircleOutlined, PlusCircleOutlined } from '@ant-design/icons';
import { useI18n } from '@/lib/i18n/i18n';

export interface FlotLayoutProps {
  style?: React.CSSProperties;
  messageApi: MessageInstance;
  openApp: boolean;
}

export function FlotLayout({ style, messageApi, openApp }: FlotLayoutProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (openApp && open) {
      setOpen(false);
    }
  }, [open, openApp]);

  return (
    <div style={style} className={styles.flot_layout}>
      <Popover
        open={open}
        placement="leftTop"
        content={<FlotAppItem messageApi={messageApi} />}
        styles={{
          body: {
            background: '#1a1a1a90',
            width: '300px',
          },
        }}
      >
        <Button
          onClick={() => {
            if (openApp) return;
            setOpen(!open);
          }}
          type="text"
          style={{ height: '100%', width: '100%' }}
          icon={<SvgResource type="app" svgSize={16}></SvgResource>}
        ></Button>
      </Popover>
    </div>
  );
}

interface FlotAppItemProps {
  messageApi: MessageInstance;
}

function FlotAppItem({ messageApi }: FlotAppItemProps) {
  const [activeKey, setActiveKey] = useState<string[]>(['timer', 'countdown', 'todo']);
  const { t } = useI18n();
  const { token } = theme.useToken();
  const itemStyle: React.CSSProperties = {
    marginBottom: 8,
    background: token.colorFillAlter,
    borderRadius: token.borderRadiusSM,
    border: 'none',
  };

  const toggleCollapse = (key: 'timer' | 'countdown' | 'todo') => {
    setActiveKey((prev) => {
      if (prev.includes(key)) {
        return prev.filter((k) => k !== key);
      }
      return [...prev, key];
    });
  };

  const items: CollapseProps['items'] = [
    {
      key: 'timer',
      label: activeKey.includes('timer') ? '' : t('more.app.timer.title'),
      children: <AppTimer size="small"></AppTimer>,
      style: itemStyle,

    },
    {
      key: 'countdown',
      label: activeKey.includes('countdown') ? '' : t('more.app.countdown.title'),
      children: <AppCountdown messageApi={messageApi} size="small"></AppCountdown>,
      style: itemStyle,

    },
    {
      key: 'todo',
      label: activeKey.includes('todo') ? '' : t('more.app.todo.title'),
      children: <AppTodo messageApi={messageApi}></AppTodo>,
      style: itemStyle,

    },
  ];

  return (
    <Collapse
      bordered={false}
      activeKey={activeKey}
      onChange={(keys) => setActiveKey(keys as string[])}
      expandIcon={({ isActive }) => (isActive ? <MinusCircleOutlined /> : <PlusCircleOutlined />)}
      expandIconPosition="end"
      items={items}
    />
  );
}
