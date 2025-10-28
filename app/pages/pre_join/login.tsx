'use client';

import { SvgResource } from '@/app/resources/svg';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n/i18n';
import { VOCESPACE_PLATFORM_USER_ID } from '@/lib/std/space';
import styles from '@/styles/pre_join.module.scss';
import { MailOutlined, UserOutlined } from '@ant-design/icons';
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
          <MailOutlined style={{ fontSize: 20 }} />
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

interface UserMeta {
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

  // 调试日志
  // console.log('LoginStateBtn props:', { userId, username, auth, avatar });

  // 使用 useEffect 在客户端加载用户信息
  useEffect(() => {
    // 如果外部传入了完整的用户信息，优先使用
    const checkInfo = async () => {
      if (username && userId && auth && avatar) {
        // console.log('Using props user info:', { userId, username, auth, avatar });
        setUserInfo({
          userId,
          username,
          auth,
          avatar,
        });
        return;
      }

      // 检查是否在客户端环境中
      const storedUserInfo = localStorage.getItem(VOCESPACE_PLATFORM_USER_ID);
      console.warn('Checking localStorage for user info', storedUserInfo);
      if (storedUserInfo) {
        try {
          const parsedInfo = JSON.parse(storedUserInfo) as LoginStateBtnProps;
          // 登陆后向平台服务器请求完整信息
          const response = await api.getUserMeta(parsedInfo.userId);

          if (response.ok) {
            const data: UserMeta = await response.json();
            const updatedInfo = {
              ...parsedInfo,
              username: data.username,
              avatar: data.avatar,
            };
            setUserInfo(updatedInfo);
            // 更新本地存储
            localStorage.setItem(VOCESPACE_PLATFORM_USER_ID, JSON.stringify(updatedInfo));
          } else {
            setUserInfo(parsedInfo);
          }
        } catch (error) {
          console.error('Failed to parse stored user info:', error);
          setUserInfo({} as LoginStateBtnProps);
        }
      } else {
        setUserInfo({} as LoginStateBtnProps);
      }
    };
    checkInfo();
  }, [username, userId, auth, avatar]); // 依赖外部传入的 props

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
            {userInfo.username ? (
              userInfo.username.charAt(0).toUpperCase()
            ) : (
              <UserOutlined></UserOutlined>
            )}
          </Avatar>
        </div>
      </Button>
    </Dropdown>
  );
}
