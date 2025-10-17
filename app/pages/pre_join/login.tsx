import { SvgResource } from '@/app/resources/svg';
import styles from '@/styles/pre_join.module.scss';
import { Avatar, Button, Divider, Dropdown } from 'antd';
import { ItemType } from 'antd/es/menu/interface';
import { useMemo } from 'react';

export function LoginButtons({ space }: { space: string }) {
  const toVocespace = () => {
    window.open(`http://localhost:3000/auth/login?from=vocespace&spaceName=${space}`, '_blank');
  };

  return (
    <div className={styles.loginButtons}>
      <Divider style={{ fontSize: 14, borderColor: '#333', margin: '0.25rem 0' }}>
        使用以下方式登陆
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

export function LoginStateBtn({ username }: { username?: string }) {
  const items: ItemType[] = useMemo(() => {
    if (username) {
      return [{ key: 'logout', label: '退出登录' }];
    } else {
      return [];
    }
  }, [username]);

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
        {username ? (
          <div className={styles.wrapper}>
            <Avatar
              size={28}
              style={{ backgroundColor: '#22CCEE', verticalAlign: 'middle', fontSize: 20 }}
            >
              {username.charAt(0).toUpperCase()}
            </Avatar>
            <span>Google/Vocespace 已登陆</span>
          </div>
        ) : (
          <div className={styles.wrapper}>
            <Avatar
              size={28}
              style={{ backgroundColor: '#22CCEE', verticalAlign: 'middle', fontSize: 20 }}
            >
              ?
            </Avatar>
            <span>匿名用户</span>
          </div>
        )}
      </Button>
    </Dropdown>
  );
}
