'use client';

import React from 'react';
import styles from '@/styles/controls.module.scss';
import { Table } from 'antd';
import { CheckCircleTwoTone, CloseCircleTwoTone } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';

type RolePerm = {
  key: string;
  role: string;
  createRooms: boolean;
  manageRooms: boolean;
  manageRoles: boolean;
  muteUsers: boolean;
  recordingSpace: boolean;
};

const data: RolePerm[] = [
  {
    key: 'owner',
    role: 'owner',
    createRooms: true,
    manageRooms: true,
    manageRoles: true,
    muteUsers: true,
    recordingSpace: true,
  },
  {
    key: 'manager',
    role: 'manager',
    createRooms: true,
    manageRooms: false,
    manageRoles: false,
    muteUsers: true,
    recordingSpace: true,
  },
  {
    key: 'participant',
    role: 'participant',
    createRooms: true,
    manageRooms: false,
    manageRoles: false,
    muteUsers: false,
    recordingSpace: false,
  },
  {
    key: 'guest',
    role: 'guest',
    createRooms: false,
    manageRooms: false,
    manageRoles: false,
    muteUsers: false,
    recordingSpace: false,
  },
];

const renderBool = (v: boolean) =>
  v ? <CheckCircleTwoTone twoToneColor="#52c41a" /> : <CloseCircleTwoTone twoToneColor="#ff4d4f" />;

const columns: ColumnsType<RolePerm> = [
  {
    title: 'RBAC',
    dataIndex: 'role',
    key: 'role',
    width: 100,
  },
  {
    title: 'create rooms',
    dataIndex: 'createRooms',
    key: 'createRooms',
    render: renderBool,
    width: 100,
  },
  {
    title: 'manage rooms',
    dataIndex: 'manageRooms',
    key: 'manageRooms',
    render: renderBool,
    width: 100,
  },
  {
    title: 'manage roles',
    dataIndex: 'manageRoles',
    key: 'manageRoles',
    render: renderBool,
    width: 100,
  },
  { title: 'mute users', dataIndex: 'muteUsers', key: 'muteUsers', render: renderBool, width: 100 },
  {
    title: 'recording space',
    dataIndex: 'recordingSpace',
    key: 'recordingSpace',
    render: renderBool,
    width: 100,
  },
];

export function AuthSettings() {
  return (
    <div
      className={`${styles.setting_box} ${styles.scroll_box}`}
      style={{ overflowX: 'scroll', width: '100%' }}
    >
      <Table<RolePerm>
        columns={columns}
        dataSource={data}
        pagination={false}
        bordered
        rowKey="key"
        size="middle"
      />
    </div>
  );
}
