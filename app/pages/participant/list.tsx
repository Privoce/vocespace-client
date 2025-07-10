import { Avatar, Dropdown, List, MenuProps } from 'antd';
import styles from '@/styles/controls.module.scss';
import { randomColor } from '@/lib/std';
import { useI18n } from '@/lib/i18n/i18n';
import { ParticipantSettings } from '@/lib/std/room';

export type ParticipantItemType = [string, ParticipantSettings];

export interface ParticipantListProps {
  participants: ParticipantItemType[];
  ownerId: string;
  size?: 'small' | 'large' | 'default';
  suffix?: (item: ParticipantItemType, index: number) => React.ReactNode;
  menu: MenuProps;
  onOpenMenu: (open: boolean, pid: string) => void;
}

export function ParticipantList({
  participants,
  ownerId,
  suffix,
  menu,
  onOpenMenu,
  size = 'large',
}: ParticipantListProps) {
  const { t } = useI18n();
  return (
    <List
      itemLayout="horizontal"
      dataSource={participants}
      split={false}
      renderItem={(item, index) => (
        <List.Item>
          <Dropdown
            disabled={item[0] === ownerId}
            trigger={['contextMenu']}
            menu={menu}
            onOpenChange={(open) => onOpenMenu(open, item[0])}
          >
            <div className={styles.particepant_item}>
              <div className={styles.particepant_item_left}>
                <Avatar
                  size={size}
                  style={{
                    backgroundColor: randomColor(item[1].name),
                  }}
                >
                  {item[1].name.substring(0, 3)}
                </Avatar>
                <span>{item[1].name}</span>
                {ownerId !== '' && item[0] === ownerId && (
                  <span className={styles.particepant_item_owner}>
                    ( {t('more.participant.manager')} )
                  </span>
                )}
              </div>
              {suffix && suffix(item, index)}
            </div>
          </Dropdown>
        </List.Item>
      )}
    />
  );
}
