'use client';

import { SvgResource } from '@/app/resources/svg';

import { PUserInfo } from '@/lib/hooks/platform';
import { useI18n } from '@/lib/i18n/i18n';
import { VOCESPACE_PLATFORM_USER_ID } from '@/lib/std/space';
import styles from '@/styles/pre_join.module.scss';
import { MailOutlined, UserOutlined } from '@ant-design/icons';
import { Avatar, Button, Divider, Dropdown } from 'antd';
import { ItemType } from 'antd/es/menu/interface';
import { useMemo } from 'react';

export function LoginButtons({ space }: { space: string }) {
  const { t } = useI18n();

  const toVocespace = (google = false) => {
    window.open(
      `https://home.vocespace.com/auth/login?from=vocespace&spaceName=${space}&auth=${
        google ? 'google' : 'email'
      }`,
      '_blank',
    );
  };

  return (
    <div className={styles.loginButtons}>
      <Divider style={{ fontSize: 12, borderColor: '#333', margin: '0 0' }}>
        {t('login.following')}
      </Divider>
      <div className={styles.loginButton}>
        <button className={styles.loginButton_btn} onClick={() => toVocespace(true)}>
          <SvgResource type="google" svgSize={20}></SvgResource>
          Continue with Google
        </button>
      </div>
      <div className={styles.loginButton}>
        <button className={styles.loginButton_btn} onClick={() => toVocespace()}>
          <MailOutlined style={{ fontSize: 20 }} />
          Continue with Email
        </button>
      </div>
      <Divider style={{ fontSize: 12, borderColor: '#333', margin: '0 0' }}>
        {t('login.guest')}
      </Divider>
    </div>
  );
}

export interface LoginStateBtnProps extends PUserInfo {}

export function LoginStateBtn({ userId, username, auth, avatar }: LoginStateBtnProps) {
  const { t } = useI18n();

  const items: ItemType[] = useMemo(() => {
    if (userId && username) {
      return [
        {
          key: 'logout',
          label: t('login.out'),
          onClick: () => {
            window.open(`https://home.vocespace.com/auth/user/${userId}`, '_blank');
            localStorage.removeItem(VOCESPACE_PLATFORM_USER_ID);
            window.location.reload();
          },
        },
      ];
    } else {
      return [];
    }
  }, [userId, username, t]);

  return (
    <Dropdown menu={{ items }} placement="bottomRight" trigger={['hover']}>
      <Button
        className={styles.LoginStateBtn}
        size="large"
        type="text"
        onClick={(e) => {
          e.preventDefault();
          if (!userId) {
            window.open(`https://home.vocespace.com/auth/login`, '_blank');
          } else {
            window.open(`https://home.vocespace.com/auth/user/${userId}`, '_blank');
          }
        }}
      >
        <div className={styles.wrapper}>
          <Avatar
            src={avatar}
            size={38}
            style={{
              backgroundColor: avatar ? 'transparent' : '#22CCEE',
              verticalAlign: 'middle',
              fontSize: 16,
              border: 'none',
            }}
          >
            {}
            {username ? username.charAt(0).toUpperCase() : <UserOutlined></UserOutlined>}
          </Avatar>
        </div>
      </Button>
    </Dropdown>
  );
}
