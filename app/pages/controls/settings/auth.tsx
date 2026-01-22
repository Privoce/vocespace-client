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

type RolePerm = {
  key: string;
  role: string;
  createRoom: boolean;
  manageRoom: boolean;
  manageRole: boolean;
  controlUser: boolean;
  recording: boolean;
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

  const renderSwitch = (field: keyof RolePerm) => (_: any, record: RolePerm) => {
    const roleKey = record.key as keyof SpaceInfo['auth'];
    const checked = Boolean((changeableAuth as any)[roleKey]?.[field]);
    return (
      <Switch
        checkedChildren={<CheckCircleTwoTone twoToneColor="#52c41a" />}
        unCheckedChildren={<CloseCircleTwoTone twoToneColor="#ff4d4f" />}
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

  const columns: ColumnsType<RolePerm> = useMemo(() => {
    return [
      {
        title: 'RBAC',
        dataIndex: 'role',
        key: 'role',
        width: 100,
      },
      {
        title: t('auth.createRoom'),
        dataIndex: 'createRoom',
        key: 'createRoom',
        render: renderSwitch('createRoom'),
        width: 100,
      },
      {
        title: t('auth.manageRoom'),
        dataIndex: 'manageRoom',
        key: 'manageRoom',
        render: renderSwitch('manageRoom'),
        width: 100,
      },
      {
        title: t('auth.manageRole'),
        dataIndex: 'manageRole',
        key: 'manageRole',
        render: renderSwitch('manageRole'),
        width: 100,
      },
      {
        title: t('auth.controlUser'),
        dataIndex: 'controlUser',
        key: 'controlUser',
        render: renderSwitch('controlUser'),
        width: 100,
      },
      {
        title: t('auth.recording'),
        dataIndex: 'recording',
        key: 'recording',
        render: renderSwitch('recording'),
        width: 100,
      },
    ];
  }, [t, changeableAuth, isOwner]);

  const data: RolePerm[] = useMemo(() => {
    return [
      {
        key: 'owner',
        role: 'owner',
        createRoom: changeableAuth.owner.createRoom,
        manageRoom: changeableAuth.owner.manageRoom,
        manageRole: changeableAuth.owner.manageRole,
        controlUser: changeableAuth.owner.controlUser,
        recording: changeableAuth.owner.recording,
      },
      {
        key: 'manager',
        role: 'manager',
        createRoom: changeableAuth.manager.createRoom,
        manageRoom: changeableAuth.manager.manageRoom,
        manageRole: changeableAuth.manager.manageRole,
        controlUser: changeableAuth.manager.controlUser,
        recording: changeableAuth.manager.recording,
      },
      {
        key: 'participant',
        role: 'participant',
        createRoom: changeableAuth.participant.createRoom,
        manageRoom: changeableAuth.participant.manageRoom,
        manageRole: changeableAuth.participant.manageRole,
        controlUser: changeableAuth.participant.controlUser,
        recording: changeableAuth.participant.recording,
      },
      {
        key: 'guest',
        role: 'guest',
        createRoom: changeableAuth.guest.createRoom,
        manageRoom: changeableAuth.guest.manageRoom,
        manageRole: changeableAuth.guest.manageRole,
        controlUser: changeableAuth.guest.controlUser,
        recording: changeableAuth.guest.recording,
      },
    ];
  }, [changeableAuth]);

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
    } catch (e) {
      console.error(e);
      messageApi.error(t('auth.saveFail'));
    }
  };

  return (
    <div className={`${styles.setting_box} ${styles.scroll_box}`}>
      <Table<RolePerm>
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
