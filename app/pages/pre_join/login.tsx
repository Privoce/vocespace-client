'use client';

import { SvgResource } from '@/app/resources/svg';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n/i18n';
import { VOCESPACE_PLATFORM_USER_ID } from '@/lib/std/space';
import styles from '@/styles/pre_join.module.scss';
import { Avatar, Button, Divider, Dropdown } from 'antd';
import { ItemType } from 'antd/es/menu/interface';
import { useEffect, useMemo, useState } from 'react';

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
      <Divider style={{ fontSize: 14, borderColor: '#333', margin: '0.25rem 0' }}>
        {t('login.following')}
      </Divider>
      <div className={styles.loginButton}>
        <button className={styles.loginButton_btn} onClick={() => toVocespace(true)}>
          <SvgResource type="google" svgSize={20}></SvgResource>
        </button>
        <span>Google</span>
      </div>
      <div className={styles.loginButton}>
        <button className={styles.loginButton_btn} onClick={() => toVocespace()}>
          <SvgResource type="logo" svgSize={24}></SvgResource>
        </button>
        <span>Email</span>
      </div>
    </div>
  );
}

export interface LoginStateBtnProps {
  userId?: string;
  username?: string;
  auth?: 'google' | 'vocespace';
  avatar?: string;
}

interface GoogleUserMeta {
  email: string;
  username: string;
  avatar: string;
}

export function LoginStateBtn({ userId, username, auth, avatar }: LoginStateBtnProps) {
  const { t } = useI18n();
  const [userInfo, setUserInfo] = useState<LoginStateBtnProps>({
    userId,
    username,
    auth,
    avatar,
  });

  // 外部传入username，如果没有则可能是匿名用户，我们需要到localStorage中获取用户信息
  useEffect(() => {
    if (!username) {
      const storedUserInfo = localStorage.getItem(VOCESPACE_PLATFORM_USER_ID);
      if (storedUserInfo) {
        // 直接解析存储的信息
        const parsedInfo = JSON.parse(storedUserInfo) as LoginStateBtnProps;
        // 需要判断是否是google登陆，如果是我们还需要向平台请求google的user meta信息
        if (parsedInfo.auth === 'google') {
          api.getGoogleUserMeta(parsedInfo.userId).then(async (response) => {
            if (response.ok) {
              const data: GoogleUserMeta = await response.json();
              parsedInfo.username = data.username;
              parsedInfo.avatar = data.avatar;
              // 更新本地存储的信息
              localStorage.setItem(VOCESPACE_PLATFORM_USER_ID, JSON.stringify(parsedInfo));
            }
          });
        }
        setUserInfo(parsedInfo);
      } else {
        // 不存在说明是匿名用户
        setUserInfo({} as LoginStateBtnProps);
      }
    }
  }, [username, userId]);

  const items: ItemType[] = useMemo(() => {
    if (userInfo.username && userInfo.userId) {
      return [
        {
          key: 'logout',
          label: t('login.out'),
          onClick: () => {
            localStorage.removeItem(VOCESPACE_PLATFORM_USER_ID);
            window.location.reload();
          },
        },
      ];
    } else {
      return [];
    }
  }, [userInfo, t]);

  return (
    <Dropdown menu={{ items }} placement="bottomRight" trigger={['hover']}>
      <Button
        className={styles.LoginStateBtn}
        size="large"
        type="text"
        onClick={(e) => {
          e.preventDefault();
          window.open('https://vocespace.com', '_blank');
        }}
      >
        <div className={styles.wrapper}>
          <Avatar
            src={userInfo.avatar}
            size={38}
            style={{ backgroundColor: '#22CCEE', verticalAlign: 'middle', fontSize: 16 }}
          >
            {}
            {userInfo.username ? userInfo.username.charAt(0).toUpperCase() : '?'}
          </Avatar>
        </div>
      </Button>
    </Dropdown>
  );
}
