'use client';

import React, { useMemo } from 'react';
import styles from '@/styles/controls.module.scss';
import { Button, Switch, Table, message } from 'antd';
import { CheckCircleTwoTone, CloseCircleTwoTone } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { SpaceInfo } from '@/lib/std/space';
import { useI18n } from '@/lib/i18n/i18n';
import { Room } from 'livekit-client';
import { isSpaceManager } from '@/lib/std';
import { MessageInstance } from 'antd/es/message/interface';
import { api } from '@/lib/api';
import { socket } from '@/app/[spaceName]/PageClientImpl';
import { WsBase } from '@/lib/std/device';

type PermissionKey = 'createRoom' | 'manageRoom' | 'manageRole' | 'controlUser' | 'recording' | 'viewRoom';

type PermissionRow = {
  key: PermissionKey;
  permLabel: string;
  owner: boolean;
  manager: boolean;
  participant: boolean;
  guest: boolean;
};

export interface AuthSettingsProps {
  spaceInfo: SpaceInfo;
  space: Room;
  messageApi: MessageInstance;
}

export function AuthSettings({ spaceInfo, space, messageApi }: AuthSettingsProps) {
  const { t } = useI18n();
  const isOwner = useMemo(() => {
    return isSpaceManager(spaceInfo, space.localParticipant.identity).ty === 'Owner';
  }, [space, spaceInfo]);
  const [changeableAuth, setChangeableAuth] = React.useState<SpaceInfo['auth']>({
    owner: { ...spaceInfo.auth.owner },
    manager: { ...spaceInfo.auth.manager },
    participant: { ...spaceInfo.auth.participant },
    guest: { ...spaceInfo.auth.guest },
  });

  const renderSwitch = (roleKey: keyof SpaceInfo['auth']) => (_: any, record: PermissionRow) => {
    const field = record.key as PermissionKey;
    const checked = Boolean((changeableAuth as any)[roleKey]?.[field]);
    return (
      <Switch
        style={{}}
        checked={checked}
        disabled={!isOwner}
        onChange={(val: boolean) => {
          setChangeableAuth((prev) => ({
            ...prev,
            [roleKey]: {
              ...((prev as any)[roleKey] || {}),
              [field]: val,
            },
          }));
        }}
      />
    );
  };

  const columns: ColumnsType<PermissionRow> = useMemo(() => {
    return [
      {
        title: 'RBAC',
        dataIndex: 'permLabel',
        key: 'permLabel',
        width: 140,
      },
      {
        title: 'Owner',
        dataIndex: 'owner',
        key: 'owner',
        render: renderSwitch('owner'),
        width: 100,
      },
      {
        title: 'Manager',
        dataIndex: 'manager',
        key: 'manager',
        render: renderSwitch('manager'),
        width: 100,
      },
      {
        title: 'Participant',
        dataIndex: 'participant',
        key: 'participant',
        render: renderSwitch('participant'),
        width: 120,
      },
      {
        title: 'Guest',
        dataIndex: 'guest',
        key: 'guest',
        render: renderSwitch('guest'),
        width: 100,
      },
    ];
  }, [t, changeableAuth, isOwner]);

  const data: PermissionRow[] = useMemo(() => {
    return [
      {
        key: "viewRoom",
        permLabel: t('auth.viewRoom'),
        owner: changeableAuth.owner.viewRoom,
        manager: changeableAuth.manager.viewRoom,
        participant: changeableAuth.participant.viewRoom,
        guest: changeableAuth.guest.viewRoom,
      },
      {
        key: 'createRoom',
        permLabel: t('auth.createRoom'),
        owner: changeableAuth.owner.createRoom,
        manager: changeableAuth.manager.createRoom,
        participant: changeableAuth.participant.createRoom,
        guest: changeableAuth.guest.createRoom,
      },
      {
        key: 'manageRoom',
        permLabel: t('auth.manageRoom'),
        owner: changeableAuth.owner.manageRoom,
        manager: changeableAuth.manager.manageRoom,
        participant: changeableAuth.participant.manageRoom,
        guest: changeableAuth.guest.manageRoom,
      },
      {
        key: 'manageRole',
        permLabel: t('auth.manageRole'),
        owner: changeableAuth.owner.manageRole,
        manager: changeableAuth.manager.manageRole,
        participant: changeableAuth.participant.manageRole,
        guest: changeableAuth.guest.manageRole,
      },
      {
        key: 'controlUser',
        permLabel: t('auth.controlUser'),
        owner: changeableAuth.owner.controlUser,
        manager: changeableAuth.manager.controlUser,
        participant: changeableAuth.participant.controlUser,
        guest: changeableAuth.guest.controlUser,
      },
      {
        key: 'recording',
        permLabel: t('auth.recording'),
        owner: changeableAuth.owner.recording,
        manager: changeableAuth.manager.recording,
        participant: changeableAuth.participant.recording,
        guest: changeableAuth.guest.recording,
      },
    ];
  }, [changeableAuth, t]);

  /**
   * 发送api更新权限设置
   */
  const saveAuthChange = async () => {
    if (!isOwner) return;
    try {
      // replace endpoint with real one if needed
      const res = await api.updateAuthRBACConf(space.name, changeableAuth);
      if (!res.ok) throw new Error('save failed');
      messageApi.success(t('auth.saveSuccess'));
      socket.emit('update_user_status', {
        space: space.name,
      } as WsBase);
    } catch (e) {
      console.error(e);
      messageApi.error(t('auth.saveFail'));
    }
  };

  return (
    <div className={`${styles.setting_box} ${styles.scroll_box}`}>
      <Table<PermissionRow>
        columns={columns}
        dataSource={data}
        pagination={false}
        bordered
        rowKey="key"
        size="middle"
      />
      {isOwner && (
        <Button
          block
          type="primary"
          size="large"
          style={{ marginTop: 16 }}
          onClick={saveAuthChange}
        >
          {t('auth.save')}
        </Button>
      )}
    </div>
  );
}
