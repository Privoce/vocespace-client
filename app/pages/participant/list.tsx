import { Avatar, Dropdown, List, MenuProps } from 'antd';
import styles from '@/styles/controls.module.scss';
import { randomColor } from '@/lib/std';
import { useI18n } from '@/lib/i18n/i18n';
import { ParticipantSettings } from '@/lib/std/space';
import { ControlRKeyMenu } from './menu';
import { Room } from 'livekit-client';

export type ParticipantItemType = [string, ParticipantSettings];

export interface ParticipantListProps {
  participants: ParticipantItemType[];
  ownerId: string;
  size?: 'small' | 'large' | 'default';
  suffix?: (item: ParticipantItemType, index: number) => React.ReactNode;
  menu: MenuProps;
  selfMenu: MenuProps;
  onOpenMenu: (open: boolean, pid: string) => void;
  space: Room;
}

/**
 * 参与者列表组件
 * 一个用于展示参与者信息的列表，包括参与者头像，名字，是否为主持人和一个后置插槽进行扩展
 * - 允许鼠标右键打开菜单(自定义)
 * @param [`ParticipantListProps`]
 */
export function ParticipantList({
  participants,
  ownerId,
  suffix,
  menu,
  onOpenMenu,
  size = 'large',
  selfMenu,
  space,
}: ParticipantListProps) {
  const { t } = useI18n();

  return (
    <List
      itemLayout="horizontal"
      dataSource={participants}
      split={false}
      renderItem={(item, index) => (
        <List.Item>
          <ControlRKeyMenu
            menu={item[0] === space.localParticipant.identity ? selfMenu : menu}
            onOpenChange={(open) => onOpenMenu(open, item[0])}
            isRKey={true}
            children={
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
            }
          ></ControlRKeyMenu>
        </List.Item>
      )}
    />
  );
}
