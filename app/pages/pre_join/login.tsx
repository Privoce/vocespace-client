'use client';

import { SvgResource } from '@/app/resources/svg';
import { useI18n } from '@/lib/i18n/i18n';
import { PlatformUser, TokenResult } from '@/lib/std';
import { VOCESPACE_PLATFORM_USER } from '@/lib/std/space';
import styles from '@/styles/pre_join.module.scss';
import { MailOutlined, UserOutlined } from '@ant-design/icons';
import { Avatar, Button, Divider, Dropdown } from 'antd';
import { ItemType } from 'antd/es/menu/interface';
import { useRouter } from 'next/navigation';
import { useMemo } from 'react';

export function LoginButtons({ space }: { space: string }) {
  const { t } = useI18n();

  const toVocespace = (google = false) => {
    window.open(
      `https://home.vocespace.com/auth/login?from=vocespace&spaceName=${space}&auth=${
        google ? 'google' : 'email'
      }`,
      '_self',
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

export interface LoginStateBtnProps {
  data?: PlatformUser;
}

export function LoginStateBtn({ data }: LoginStateBtnProps) {
  const { t } = useI18n();
  const { userId, username, avatar } = useMemo(() => {
    return {
      userId: data?.id,
      username: data?.username,
      avatar: data?.avatar,
    };
  }, [data]);

  const items: ItemType[] = useMemo(() => {
    if (userId && username) {
      return [
        {
          key: 'logout',
          label: t('login.out'),
          onClick: () => {
            localStorage.removeItem(VOCESPACE_PLATFORM_USER);
            if (data?.auth === 'vocespace') {
              window.open(`https://home.vocespace.com/auth/user/${userId}?logout=true`, '_self');
            } else {
              window.location.reload();
            }
          },
        },
      ];
    } else {
      return [];
    }
  }, [userId, username, t, data?.auth]);

  return (
    <Dropdown menu={{ items }} placement="bottomRight" trigger={['hover']}>
      <Button
        className={styles.LoginStateBtn}
        size="large"
        type="text"
        onClick={(e) => {
          e.preventDefault();
          if (!userId) {
            window.open(`https://home.vocespace.com/auth/login`, '_self');
          } else {
            window.open(`https://home.vocespace.com/auth/user/${userId}`, '_self');
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
