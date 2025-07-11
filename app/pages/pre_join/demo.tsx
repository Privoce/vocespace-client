'use client';

import { encodePassphrase, generateRoomId, randomString } from '@/lib/client_utils';
import { useI18n } from '@/lib/i18n/i18n';
import { useRouter } from 'next/navigation';
import React, { useState } from 'react';
import styles from '@/styles/Home.module.css';
import { Button, Input, InputRef, message, Radio } from 'antd';
import { CheckboxGroupProps } from 'antd/es/checkbox';
import { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { MessageInstance } from 'antd/es/message/interface';
import { LocalUserChoices, usePersistentUserChoices } from '@livekit/components-react';
import { connect_endpoint } from '@/lib/std';

const SERVER_NAME = process.env.SERVER_NAME ?? '';
const CONN_DETAILS_ENDPOINT = connect_endpoint('/api/room-settings');
const SERVER_NAMES =
  SERVER_NAME === ''
    ? 'vocespace.com|space.voce.chat'
    : `vocespace.com|space.voce.chat|${SERVER_NAME}`;
const ENV_PRIFIX =
  (process.env.NEXT_PUBLIC_BASE_PATH ?? '') === ''
    ? `\/chat|\/dev\/`
    : `\/chat|\/dev\/|${process.env.NEXT_PUBLIC_BASE_PATH}\/`;
/**
 * # DemoMeetingTab
 * Demo meeting tab for room, which use before PreJoin
 * ## Features
 * - Start meeting and nav to PreJoin page
 * - Enable E2EE (input passphrase)
 * - Connect by room name or URL
 */
export function DemoMeetingTab({ onSubmit }: { onSubmit: (values: LocalUserChoices) => void }) {
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
  const router = useRouter();
  const inputRef = React.useRef<InputRef>(null);
  const [messageApi, contextHolder] = message.useMessage();
  const [e2ee, setE2ee] = useState(false);
  const [hq, setHq] = useState(true);
  const [roomUrl, setRoomUrl] = useState('');
  const [sharedPassphrase, setSharedPassphrase] = useState(randomString(64));
  const [username, setUsername] = React.useState(userChoices.username);
  // tab options -----------------------------------------------------------------------------
  const options: CheckboxGroupProps<string>['options'] = [
    { label: t('common.demo'), value: 'demo' },
    { label: t('common.custom'), value: 'custom' },
  ];
  const [optionVal, setOptionVal] = useState('demo');
  // start meeting if valid ------------------------------------------------------------------
  const startMeeting = async () => {
    let roomName = 'voce_stream';
    if (e2ee) {
      router.push(`/${roomName}${hq ? '?hq=true' : ''}#${encodePassphrase(sharedPassphrase)}`);
    } else {
      if (roomUrl == '') {
        router.push(`/${roomName}${hq ? '?hq=true' : ''}`);
      } else {
        // 对roomUrl进行判断，如果是个有效的网址则直接跳转，否则跳转到房间
        isAllowUrlAnd(roomUrl, router, messageApi, t('msg.error.room.invalid'));
      }
    }

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
      onSubmit(finalUserChoices);
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
      {/* <Radio.Group
        block
        options={options}
        defaultValue="demo"
        optionType="button"
        buttonStyle="solid"
        size="large"
        value={optionVal}
        onChange={(e) => {
          setRoomUrl('');
          setOptionVal(e.target.value);
        }}
      /> */}
      {/* <p style={{ margin: 0, textAlign: 'justify' }}>
        {t('msg.info.try_enter_room')}
      </p> */}
      {/* {optionVal == 'custom' && (
        <Input
          size="large"
          type="text"
          placeholder={t('msg.info.enter_room')}
          value={roomUrl}
          onChange={(e) => {
            setRoomUrl(e.target.value);
          }}
        />
      )} */}
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', flexDirection: 'row', gap: '1rem' }}>
          <input
            id="use-e2ee"
            type="checkbox"
            checked={e2ee}
            onChange={(ev) => setE2ee(ev.target.checked)}
          ></input>
          <label htmlFor="use-e2ee">{t('msg.info.enabled_e2ee')}</label>
        </div>
        <div style={{ display: 'flex', flexDirection: 'row', gap: '1rem' }}>
          <input
            id="use-hq"
            type="checkbox"
            checked={hq}
            onChange={(ev) => setHq(ev.target.checked)}
          ></input>
          <label htmlFor="use-hq">{t('common.hq')}</label>
        </div>
        {e2ee && (
          <div
            style={{
              display: 'inline-flex',
              flexDirection: 'row',
              gap: '1rem',
              alignItems: 'center',
            }}
          >
            <label htmlFor="passphrase" style={{ textWrap: 'nowrap' }}>
              {' '}
              {t('common.passphrase')}
            </label>
            <Input
              id="passphrase"
              type="password"
              value={sharedPassphrase}
              onChange={(ev) => setSharedPassphrase(ev.target.value)}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// 判断是否是允许的url，如果是则跳转，如果是房间名则拼接
const isAllowUrlAnd = (
  url: string,
  router: AppRouterInstance,
  messageApi: MessageInstance,
  msg: string,
) => {
  // 判断是否是允许的url，拼接AllowUrls，并且可能是没有AllowUrls的，当用户输入的只是一个房间名时
  // 格式为: ^(https?:\/\/)?(vocespace.com|space.voce.chat)?\/rooms\/([a-zA-Z0-9_-]+)$
  let regax = new RegExp(`^(https?:\/\/)?(${SERVER_NAMES})?(${ENV_PRIFIX})?([^/]+)$`);
  let match = url.match(regax);
  if (match) {
    if (!match[1] && !match[2] && !match[3]) {
      // 如果是房间名则拼接
      router.push(`/${match[4]}`);
    } else {
      // 只要match[2]可以成功匹配到，就直接进行外部跳转
      if (match[2] && match[4]) {
        router.replace(`${match[0]}`);
      }
    }
  } else {
    // 如果不是允许的url
    messageApi.error(msg);
  }
};
