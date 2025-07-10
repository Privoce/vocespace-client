'use client';

import { encodePassphrase, generateRoomId, randomString } from '@/lib/client_utils';
import { useI18n } from '@/lib/i18n/i18n';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import styles from '@/styles/Home.module.css';
import { Button, Input, message, Radio } from 'antd';
import { CheckboxGroupProps } from 'antd/es/checkbox';
import { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { MessageInstance } from 'antd/es/message/interface';

const SERVER_NAME = process.env.SERVER_NAME ?? '';
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
export function DemoMeetingTab() {
  const { t } = useI18n();
  const router = useRouter();
  const [messageApi, contextHolder] = message.useMessage();
  const [e2ee, setE2ee] = useState(false);
  const [roomUrl, setRoomUrl] = useState('');
  const [sharedPassphrase, setSharedPassphrase] = useState(randomString(64));
  // tab options -----------------------------------------------------------------------------
  const options: CheckboxGroupProps<string>['options'] = [
    { label: t('common.demo'), value: 'demo' },
    { label: t('common.custom'), value: 'custom' },
  ];
  const [optionVal, setOptionVal] = useState('demo');
  // start meeting if valid ------------------------------------------------------------------
  const startMeeting = () => {
    if (e2ee) {
      router.push(`/${generateRoomId()}#${encodePassphrase(sharedPassphrase)}`);
    } else {
      if (roomUrl == '') {
        router.push(`/${generateRoomId()}`);
      } else {
        // 对roomUrl进行判断，如果是个有效的网址则直接跳转，否则跳转到房间
        isAllowUrlAnd(roomUrl, router, messageApi, t('msg.error.room.invalid'));
      }
    }
  };
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
          setRoomUrl('');
          setOptionVal(e.target.value);
        }}
      />
      <p style={{ margin: 0, textAlign: 'justify' }}>
        {optionVal == 'demo' ? t('msg.info.try_free') : t('msg.info.try_enter_room')}
      </p>
      {optionVal == 'custom' && (
        <Input
          size="large"
          type="text"
          placeholder={t('msg.info.enter_room')}
          value={roomUrl}
          onChange={(e) => {
            setRoomUrl(e.target.value);
          }}
        />
      )}
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
