import { Select, SelectProps } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { Trans, useI18n } from '@/lib/i18n/i18n';
import { UserStatus } from '@/lib/std';
import { useRecoilState } from 'recoil';
import { roomStatusState, userState } from '@/app/[roomName]/PageClientImpl';
import { SvgResource, SvgType } from '@/app/resources/svg';
import styles from '@/styles/controls.module.scss';
import { BaseOptionType } from 'antd/es/select';

export interface StatusItem extends BaseOptionType {
  title: string;
  icon: SvgType;
  value: string;
  desc: string;
  isDefine: boolean;
  color?: string;
}

export function StatusSelect({
  style,
  className,
  setUserStatus,
}: {
  style?: React.CSSProperties;
  className?: string;
  setUserStatus?: (status: UserStatus | string) => Promise<void>;
}) {
  const { t } = useI18n();
  const [state, setState] = useRecoilState(userState);
  const [uRoomStatusState, setURoomStatusState] = useRecoilState(roomStatusState);
  const [active, setActive] = useState<string>(state.status);

  useEffect(()=> {
    if (state.status !== active) {
      setActive(state.status);
    }
  }, [state.status]);

  const items = useMemo(() => {
    const list = statusDefaultList(t);
    if (uRoomStatusState.length > 0) {
      uRoomStatusState.forEach((status) => {
        list.push({
          title: status.name,
          desc: status.desc,
          icon: 'dot',
          value: status.id,
          isDefine: true,
          color: status.icon.color,
        });
      });
    }

    return list;
  }, [uRoomStatusState, t]);

  const selectActive = (active: string) => {
    setActive(active);
    if (setUserStatus) {
      setUserStatus(active);
    }
  };

  const renderedItem: SelectProps<any, StatusItem>['optionRender'] = (option) => {
    return (
      <div className={styles.status_item}>
        {option.data.isDefine ? (
          <SvgResource type={option.data.icon} svgSize={14} color={option.data.color}></SvgResource>
        ) : (
          <SvgResource type={option.data.icon} svgSize={14}></SvgResource>
        )}
        <span>{option.data.title}</span>
        <div>{option.data.desc}</div>
      </div>
    );
  };

  const tagRender: SelectProps['labelRender'] = (option) => {
    const item = items.find((item) => item.value === option.value);

    return (
      <div className={styles.status_item}>
        {item?.isDefine ? (
          <SvgResource type="dot" svgSize={14} color={item?.color}></SvgResource>
        ) : (
          <SvgResource type={item?.icon as SvgType} svgSize={14}></SvgResource>
        )}
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


export const statusDefaultList = (t: Trans):StatusItem[] =>  {
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
}