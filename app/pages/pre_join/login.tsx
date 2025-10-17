import { SvgResource } from '@/app/resources/svg';
import { useI18n } from '@/lib/i18n/i18n';
import { VOCESPACE_PLATFORM_USER_ID } from '@/lib/std/space';
import styles from '@/styles/pre_join.module.scss';
import { Avatar, Button, Divider, Dropdown } from 'antd';
import { ItemType } from 'antd/es/menu/interface';
import { useMemo } from 'react';

export function LoginButtons({ space }: { space: string }) {
  const { t } = useI18n();

  const toVocespace = () => {
    window.open(`http://localhost:3000/auth/login?from=vocespace&spaceName=${space}`, '_blank');
  };

  return (
    <div className={styles.loginButtons}>
      <Divider style={{ fontSize: 14, borderColor: '#333', margin: '0.25rem 0' }}>
        {t('login.following')}
      </Divider>
      <div className={styles.loginButton}>
        <button className={styles.loginButton_btn}>
          <SvgResource type="google" svgSize={20}></SvgResource>
        </button>
        <span>Google</span>
      </div>
      <div className={styles.loginButton}>
        <button className={styles.loginButton_btn} onClick={toVocespace}>
          <SvgResource type="logo" svgSize={24}></SvgResource>
        </button>
        <span>Vocespace</span>
      </div>
    </div>
  );
}

export interface LoginStateBtnProps {
  userId?: string;
  username?: string;
  auth?: 'google' | 'vocespace';
}

export function LoginStateBtn({ userId, username, auth }: LoginStateBtnProps) {
  const { t } = useI18n();

  // 外部传入username，如果没有则可能是匿名用户，我们需要到localStorage中获取用户信息
  const userInfo: LoginStateBtnProps = useMemo(() => {
    if (!username) {
      const storedUserInfo = localStorage.getItem(VOCESPACE_PLATFORM_USER_ID);
      if (storedUserInfo) {
        // 直接解析存储的信息
        return JSON.parse(storedUserInfo) as LoginStateBtnProps;
      } else {
        // 不存在说明是匿名用户
        return {
          userId: undefined,
          username: undefined,
        } as LoginStateBtnProps;
      }
    }
    return {
      userId,
      username,
      auth,
    } as LoginStateBtnProps;
  }, [username, userId]);

  const items: ItemType[] = useMemo(() => {
    if (userInfo.username && userInfo.userId) {
      return [
        {
          key: 'logout',
          label: t('login.out'),
          onClick: () => {
            localStorage.removeItem(VOCESPACE_PLATFORM_USER_ID);
          },
        },
      ];
    } else {
      return [];
    }
  }, [userInfo]);

  return (
    <Dropdown menu={{ items }} placement="topRight" trigger={['hover']}>
      <Button
        className={styles.LoginStateBtn}
        size="large"
        type="text"
        onClick={(e) => {
          e.preventDefault();
          window.open('https://vocespace.com', '_blank');
        }}
      >
        {userInfo.username ? (
          <div className={styles.wrapper}>
            <Avatar
              size={28}
              style={{ backgroundColor: '#22CCEE', verticalAlign: 'middle', fontSize: 16 }}
            >
              {userInfo.username.charAt(0).toUpperCase()}
            </Avatar>
            <span>Google/Vocespace 已登陆</span>
          </div>
        ) : (
          <div className={styles.wrapper}>
            <Avatar
              size={28}
              style={{ backgroundColor: '#22CCEE', verticalAlign: 'middle', fontSize: 16 }}
            >
              ?
            </Avatar>
            <span>
                {t('login.anon')}
            </span>
          </div>
        )}
      </Button>
    </Dropdown>
  );
}
