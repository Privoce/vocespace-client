import { Button, Dropdown, MenuProps, Tooltip } from 'antd';
import { ItemType } from 'antd/es/menu/interface';
import { useMemo } from 'react';
import styles from '@/styles/controls.module.scss';
import { SvgResource } from '@/app/resources/svg';
import { useRecoilState } from 'recoil';
import { roomStatusState, userState } from '@/app/rooms/[spaceName]/PageClientImpl';
import { Trans } from '@/lib/i18n/i18n';
import { UserStatus } from '@/lib/std';
import { SpaceInfo } from '@/lib/std/space';
import { TrackReferenceOrPlaceholder } from '@livekit/components-react';

export interface StatusInfoProps {
  disabled?: boolean;
  items: ItemType[];
  children: React.ReactNode;
}

/**
 * ## 用户状态信息组件
 * 用于显示用户的状态信息，并提供一个下拉菜单来选择和更改状态。
 * - 如果disabled为true，则禁用下拉菜单。
 * - items是下拉菜单的选项列表。
 * - children是触发下拉菜单的元素。
 * 通常这个组件会使用在tile或mini(title)中，来显示用户的状态信息。
 */
export function StatusInfo({ disabled = false, items, children }: StatusInfoProps) {
  return (
    <Dropdown
      disabled={disabled}
      placement="topLeft"
      trigger={['click']}
      menu={{
        items,
      }}
    >
      {children}
    </Dropdown>
  );
}

export interface UseStatusInfoProps {
  toRenameSettings?: (isDefineStatus?: boolean) => void;
  username: string;
  t: Trans;
  setUserStatus: (status: UserStatus | string) => Promise<void>;
  settings: SpaceInfo;
  trackReference: TrackReferenceOrPlaceholder;
  disabled?: boolean;
}
/**
 * ## 用户状态信息钩子
 * 用于处理用户状态信息的显示和菜单项生成。
 */
export function useStatusInfo({
  toRenameSettings,
  username,
  t,
  setUserStatus,
  settings,
  disabled=false,
  trackReference,
}: UseStatusInfoProps) {
  const [uRoomStatusState, setURoomStatusState] = useRecoilState(roomStatusState);
  const [uState, setUState] = useRecoilState(userState);
  const userStatusDisply = useMemo(() => {
    let status = settings.participants[trackReference.participant.identity]?.status;
    let item: {
      title: string;
      icon?: React.ReactNode;
    } = {
      title: status || UserStatus.Online,
      icon: <SvgResource type={'online_dot'} svgSize={14}></SvgResource>,
    };

    switch (status) {
      case UserStatus.Online:
        item.title = t(UserStatus.Online);
        break;
      case UserStatus.Offline:
        item.title = t(UserStatus.Offline);
        item.icon = <SvgResource type={'offline_dot'} svgSize={14}></SvgResource>;
        break;
      case UserStatus.Busy:
        item.title = t(UserStatus.Busy);
        item.icon = <SvgResource type={'busy_dot'} svgSize={14}></SvgResource>;
        break;
      case UserStatus.Leisure:
        item.title = t(UserStatus.Leisure);
        item.icon = <SvgResource type={'leisure_dot'} svgSize={14}></SvgResource>;
        break;
      case UserStatus.Working:
        item.title = t(UserStatus.Working);
        item.icon = <SvgResource type={'working_dot'} svgSize={14}></SvgResource>;
        break;
      default:
        let targetState = status;
        if (!targetState) {
          item.title = t(UserStatus.Online);
        } else {
          item.title = targetState;
          item.icon = undefined;
        }

        break;
    }

    const stateItems: MenuProps['items'] = [
      {
        key: 'user_status',
        label: (
          <div
            onClick={(_e) => {
              toRenameSettings && toRenameSettings(true);
            }}
          >
            <div className={styles.status_item_inline} style={{ width: '220px', height: '38px' }}>
              <div className={styles.status_item_inline}>
                {item?.icon}
                {item.title}
              </div>
              <SvgResource type="modify" svgSize={16} color="#fff"></SvgResource>
            </div>
          </div>
        ),
      },
    ];

    return {
      label: item.title,
      icon: item.icon,
      tag: (
        <Dropdown
          placement="topRight"
          trigger={['click']}
          menu={{
            items: stateItems,
          }}
          disabled={disabled}
        >
          <Tooltip placement="right" title={item.title}>
            <div className={styles.status_tag}>
              {item.icon && <span>{item.icon}</span>}
              <div className={styles.status_tag_title}>{item.title}</div>
            </div>
          </Tooltip>
        </Dropdown>
      ),
    };
  }, [settings, trackReference.participant.identity, t]);

  const setStatusLabel = (name?: string): String => {
    switch (uState.status) {
      case UserStatus.Online:
        return t('settings.general.status.online');
      case UserStatus.Offline:
        return t('settings.general.status.offline');
      case UserStatus.Busy:
        return t('settings.general.status.busy');
      case UserStatus.Leisure:
        return t('settings.general.status.leisure');
      default:
        return name || '';
    }
  };
  const defineStatus = useMemo(() => {
    return uRoomStatusState.find(
      (item) => item.id === settings.participants[trackReference.participant.identity]?.status,
    );
  }, [uRoomStatusState, settings.participants, trackReference]);

  const items: MenuProps['items'] = useMemo(() => {
    return [
      {
        key: 'user_info',
        label: (
          <div
            className={styles.user_info_wrap}
            onClick={() => toRenameSettings && toRenameSettings()}
          >
            <div className={styles.user_info_wrap_name}>
              {' '}
              {settings.participants[trackReference.participant.identity]?.name || username}
            </div>
            <SvgResource type="modify" svgSize={16} color="#fff"></SvgResource>
          </div>
        ),
      },
    ];
  }, [settings.participants]);

  return {
    items,
    setStatusLabel,
    userStatusDisply,
    defineStatus,
  };
}
