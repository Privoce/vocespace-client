import { Dropdown, MenuProps } from 'antd';
import { ItemType } from 'antd/es/menu/interface';
import { useMemo } from 'react';
import styles from '@/styles/controls.module.scss';
import { SvgResource } from '@/app/resources/svg';
import { useRecoilState } from 'recoil';
import { roomStatusState, userState } from '@/app/rooms/[spaceName]/PageClientImpl';
import { statusDefaultList } from '../controls/selects/status_select';
import { Trans } from '@/lib/i18n/i18n';
import { UserDefineStatus, UserStatus } from '@/lib/std';
import { SpaceInfo } from '@/lib/std/space';
import { TrackReferenceOrPlaceholder } from '@livekit/components-react';

export interface StatusInfoProps {
  disabled?: boolean;
  items: ItemType[];
  children: React.ReactNode;
}

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
  toRenameSettings?: () => void;
  username: string;
  t: Trans;
  setUserStatus: (status: UserStatus | string) => Promise<void>;
  settings: SpaceInfo;
  trackReference: TrackReferenceOrPlaceholder;
}

export function useStatusInfo({
  toRenameSettings,
  username,
  t,
  setUserStatus,
  settings,
  trackReference,
}: UseStatusInfoProps) {
  const [uRoomStatusState, setURoomStatusState] = useRecoilState(roomStatusState);
  const [uState, setUState] = useRecoilState(userState);
  const userStatusDisply = useMemo(() => {
    switch (settings.participants[trackReference.participant.identity]?.status) {
      case UserStatus.Online:
        return 'online_dot';
      case UserStatus.Offline:
        return 'offline_dot';
      case UserStatus.Busy:
        return 'busy_dot';
      case UserStatus.Leisure:
        return 'leisure_dot';
      default:
        return 'online_dot';
    }
  }, [settings.participants, trackReference.participant.identity]);
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
  const statusMenu: MenuProps['items'] = useMemo(() => {
    const list = statusDefaultList(t);
    if (uRoomStatusState.length > 0) {
      uRoomStatusState.forEach((item) => {
        list.push({
          title: item.name,
          desc: item.desc,
          icon: 'dot',
          value: item.id,
          isDefine: true,
          color: item.icon.color,
        });
      });
    }

    return list.map((item) => ({
      key: item.value,
      label: (
        <div className={styles.status_item}>
          {item.isDefine ? (
            <SvgResource type={item.icon} svgSize={14} color={item.color}></SvgResource>
          ) : (
            <SvgResource type={item.icon} svgSize={14}></SvgResource>
          )}
          <span>{item.title}</span>
          <div>{item.desc}</div>
        </div>
      ),
    }));
  }, [uRoomStatusState, t]);

  const items: MenuProps['items'] = useMemo(() => {
    return [
      {
        key: 'user_info',
        label: (
          <div className={styles.user_info_wrap} onClick={toRenameSettings}>
            <SvgResource type="modify" svgSize={16} color="#fff"></SvgResource>
            <div className={styles.user_info_wrap_name}>
              {' '}
              {settings.participants[trackReference.participant.identity]?.name || username}
            </div>
          </div>
        ),
      },
      {
        key: 'user_status',
        label: (
          <div onClick={(e) => e.stopPropagation()}>
            <Dropdown
              trigger={['hover', 'click']}
              placement="topLeft"
              menu={{
                items: statusMenu,
                onClick: async (e) => {
                  e.domEvent.stopPropagation();
                  await setUserStatus(e.key);
                },
              }}
            >
              <div className={styles.status_item_inline} style={{ width: '100%' }}>
                <div className={styles.status_item_inline}>
                  {defineStatus ? (
                    <SvgResource
                      type="dot"
                      svgSize={16}
                      color={defineStatus.icon.color}
                    ></SvgResource>
                  ) : (
                    <SvgResource type={userStatusDisply} svgSize={16}></SvgResource>
                  )}
                  <div>{setStatusLabel(defineStatus?.name)}</div>
                </div>
                <SvgResource type="right" svgSize={14} color="#fff"></SvgResource>
              </div>
            </Dropdown>
          </div>
        ),
      },
    ];
  }, [settings.participants, userStatusDisply, statusMenu, defineStatus]);

  return {
    items,
    setStatusLabel,
    userStatusDisply,
    defineStatus
  };
}
