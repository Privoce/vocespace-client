'use client';

import { useI18n } from '@/lib/i18n/i18n';
import React, { useEffect, useState } from 'react';
import styles from '@/styles/Home.module.css';
import { Button, Input, InputRef, message, Radio } from 'antd';
import { CheckboxGroupProps } from 'antd/es/checkbox';
import { LocalUserChoices, usePersistentUserChoices } from '@livekit/components-react';
import { connect_endpoint } from '@/lib/std';

const CONN_DETAILS_ENDPOINT = connect_endpoint('/api/room-settings');

export interface DemoMeetingTabProps {
  onSubmit: (values: LocalUserChoices) => void;
  hostToken: string;
}

/**
 * # DemoMeetingTab
 * Demo meeting tab for room, which use before PreJoin
 * ## Features
 * - Start meeting and nav to PreJoin page
 * - Enable E2EE (input passphrase)
 * - Connect by room name or URL
 */
export function DemoMeetingTab({ onSubmit, hostToken }: DemoMeetingTabProps) {
  const { t } = useI18n();
  // user choices -------------------------------------------------------------------------------------
  const { userChoices, saveUsername } = usePersistentUserChoices({
    defaults: {
      videoEnabled: false,
      audioEnabled: false,
    },
    preventSave: false,
    preventLoad: false,
  });
  const inputRef = React.useRef<InputRef>(null);
  const [messageApi, contextHolder] = message.useMessage();
  const [token, setToken] = useState('');
  const [username, setUsername] = React.useState(userChoices.username);
  // tab options -----------------------------------------------------------------------------
  const options: CheckboxGroupProps<string>['options'] = [
    { label: t('voce_stream.teacher'), value: 'teacher' },
    { label: t('voce_stream.student'), value: 'student' },
  ];
  const [optionVal, setOptionVal] = useState<'teacher' | 'student'>('student');
  // start meeting if valid ------------------------------------------------------------------
  const startMeeting = async () => {
    let roomName = 'voce_stream';

    // 发起请求进入房间
    const finalUserChoices = {
      username,
      videoEnabled: false,
      audioEnabled: false,
      videoDeviceId: '',
      audioDeviceId: '',
    } as LocalUserChoices;

    if (username === '') {
      messageApi.loading(t('msg.request.user.name'), 2);
      // 向服务器请求一个唯一的用户名
      const url = new URL(CONN_DETAILS_ENDPOINT, window.location.origin);
      url.searchParams.append('roomId', roomName);
      url.searchParams.append('pre', 'true');
      url.searchParams.append('user_type', optionVal);
      const response = await fetch(url.toString());
      if (response.ok) {
        const { name } = await response.json();
        finalUserChoices.username = name;
        setUsername(name);
      } else {
        messageApi.error(`${t('msg.error.user.username.request')}: ${response.statusText}`);
      }
    } else {
      // 虽然用户名不为空，但依然需要验证是否唯一
      const url = new URL(CONN_DETAILS_ENDPOINT, window.location.origin);
      url.searchParams.append('nameCheck', 'true');
      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: roomName,
          participantName: username,
        }),
      });
      if (response.ok) {
        const { success } = await response.json();
        if (!success) {
          messageApi.error({
            content: t('msg.error.user.username.exist'),
          });
          return;
        }
      }
    }
    if (typeof onSubmit === 'function') {
      let allowJoin =
        optionVal === 'teacher'
          ? (() => {
              return hostToken === token;
            })()
          : true;

      if (allowJoin) {
        onSubmit(finalUserChoices);
      } else {
        messageApi.error(t('voce_stream.token_error'));
      }
    }
  };
  React.useEffect(() => {
    saveUsername(username);
  }, [username, saveUsername]);
  React.useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, [inputRef]);
  return (
    <div className={styles.tabContent}>
      {contextHolder}
      <Radio.Group
        block
        options={options}
        defaultValue="demo"
        optionType="button"
        buttonStyle="solid"
        size="large"
        value={optionVal}
        onChange={(e) => {
          setOptionVal(e.target.value);
        }}
      />
      {optionVal == 'teacher' && (
        <Input
          size="large"
          type="text"
          placeholder={t('voce_stream.token')}
          value={token}
          onChange={(e) => {
            setToken(e.target.value);
          }}
        />
      )}
      <Input
        ref={inputRef}
        size="large"
        style={{ width: '100%' }}
        id="username"
        name="username"
        type="text"
        placeholder={t('common.username')}
        value={username}
        onChange={(inputEl) => {
          setUsername(inputEl.target.value);
        }}
        autoComplete="off"
      />
      <Button size="large" type="primary" onClick={startMeeting}>
        {t('common.start_metting')}
      </Button>
    </div>
  );
}
