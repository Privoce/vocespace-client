import { Select, SelectProps } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { Trans, useI18n } from '@/lib/i18n/i18n';
import { UserDefineStatus, UserStatus } from '@/lib/std';
import { useRecoilState } from 'recoil';
import { roomStatusState, userState } from '@/app/[spaceName]/PageClientImpl';
import { SvgResource, SvgType } from '@/app/resources/svg';
import styles from '@/styles/controls.module.scss';
import { BaseOptionType } from 'antd/es/select';
import { LocalParticipant } from 'livekit-client';

export interface StatusItem extends BaseOptionType {
  title: string;
  value: string;
  isDefine: boolean;
  desc?: string;
}

export interface StatusSelectProps {
  style?: React.CSSProperties;
  className?: string;
  setUserStatus?: (status: UserStatus | string) => Promise<void>;
  localParticipant: LocalParticipant;
}

/**
 * ## 状态选择组件
 * 用于用户需要进行状态选择时使用。
 * ### 注意
 * 有一个特殊的状态"settings.general.status.working"，该状态表示用户正在进行某项任务(依赖TODO组件)，
 * 当用户的任务有更新时，系统会自动将用户的状态修改为"settings.general.status.working"。
 * 这个状态一开始创建出来时由系统管理，但只要有人使用了TODO组件，那么这个状态就会变成用户自定义的状态，此时
 * isDefine会变成true，但status的id不变，所以在StatusSelect组件中进行联合了isDefine和value来判断是否为用户自定义状态。
 */
export function StatusSelect({
  style,
  className,
  setUserStatus,
  localParticipant,
}: StatusSelectProps) {
  const { t } = useI18n();
  const [state, setState] = useRecoilState(userState);
  const [uRoomStatusState, setURoomStatusState] = useRecoilState(roomStatusState);
  const [active, setActive] = useState<string>(state.status);

  useEffect(() => {
    if (state.status !== active) {
      setActive(state.status);
    }
  }, [state.status]);

  const items = useMemo(() => {
    return getStatusItems(t, uRoomStatusState, localParticipant.identity);
  }, [uRoomStatusState, t, localParticipant.identity]);

  const selectActive = (active: string) => {
    setActive(active);
    if (setUserStatus) {
      setUserStatus(active);
    }
  };

  const renderedItem: SelectProps<any, StatusItem>['optionRender'] = (option) => {
    return (
      <div className={styles.status_item}>
        {!option.data.isDefine && <SvgResource type={option.data.icon} svgSize={14}></SvgResource>}
        <span>{option.data.title}</span>
        <div>{option.data.desc}</div>
      </div>
    );
  };

  const tagRender: SelectProps['labelRender'] = (option) => {
    const item = items.find((item) => item.value === option.value);

    return (
      <div className={styles.status_item}>
        {!item?.isDefine && <SvgResource type={item?.icon as SvgType} svgSize={14}></SvgResource>}
        <span>{item?.title}</span>
      </div>
    );
  };

  return (
    <Select
      size="large"
      className={className}
      defaultValue={state.status}
      options={items}
      value={active}
      onChange={selectActive}
      style={style}
      labelRender={tagRender}
      optionRender={renderedItem}
    ></Select>
  );
}

export const statusDefaultList = (t: Trans): StatusItem[] => {
  return [
    {
      title: t('settings.general.status.online'),
      desc: t('settings.general.status.online_desc'),
      icon: 'online_dot',
      value: UserStatus.Online,
      isDefine: false,
    },
    {
      title: t('settings.general.status.leisure'),
      desc: t('settings.general.status.leisure_desc'),
      icon: 'leisure_dot',
      value: UserStatus.Leisure,
      isDefine: false,
    },
    {
      title: t('settings.general.status.busy'),
      desc: t('settings.general.status.busy_desc'),
      icon: 'busy_dot',
      value: UserStatus.Busy,
      isDefine: false,
    },
    {
      title: t('settings.general.status.offline'),
      desc: t('settings.general.status.offline_desc'),
      icon: 'offline_dot',
      value: UserStatus.Offline,
      isDefine: false,
    },
  ];
};
/**
 * ## 为StatusSelect构建状态列表
 * @param t i18n翻译函数 (`const {t} = useI18n();`)
 * @param uRoomStatusState 全局用户自定义状态列表
 * @returns StatusItem[]
 */
export const getStatusItems = (
  t: Trans,
  uRoomStatusState: UserDefineStatus[],
  ownerId: string,
): StatusItem[] => {
  const list = statusDefaultList(t);
  if (uRoomStatusState.length > 0) {
    uRoomStatusState.forEach((status) => {
      if (status.id === UserStatus.Working && status.creator.id === 'system') {
        // 系统创建的"settings.general.status.working"状态
        list.push({
          title: t(status.title),
          value: status.id,
          isDefine: false,
          desc: t('settings.general.status.working_desc'),
          icon: 'working_dot',
        });
      } else if (status.creator.id === 'system' || status.creator.id === ownerId) {
        // 只有自己定义的状态才可见
        list.push({
          title: status.title,
          value: status.id,
          isDefine: status.creator.id !== 'system',
          icon: status.id === UserStatus.Working ? 'working_dot' : undefined,
        });
      }
    });
  }

  return list;
};
