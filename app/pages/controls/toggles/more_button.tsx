import { Badge, Button, Dropdown, MenuProps } from 'antd';
import { SvgResource } from '@/app/resources/svg';
import { useI18n } from '@/lib/i18n/i18n';
import { useMemo, useState } from 'react';
import { SizeType } from 'antd/es/config-provider/SizeContext';
import { ViewAdjusts } from '@/lib/std/window';
import { usePlatformUserInfo } from '@/lib/hooks/platform';
import { useLocalParticipant } from '@livekit/components-react';
import { HomeOutlined } from '@ant-design/icons';

export interface MoreButtonProps {
  showText?: boolean;
  setOpenMore: (open: boolean) => void;
  isRecording: boolean;
  setMoreType: (type: 'record' | 'participant') => void;
  onSettingOpen?: () => Promise<void>;
  onClickManage?: () => Promise<void>;
  onClickRecord?: () => Promise<void>;
  onClickApp?: () => Promise<void>;
  controlWidth: number;
  chat?: {
    visible: boolean;
    enabled: boolean;
    count: number;
    onClicked: () => void;
  };
  size: SizeType;
}

export interface MoreButtonInnerProps extends MoreButtonProps {
  isDot?: boolean;
  setIsDot?: (dot: boolean) => void;
}

export function MoreButtonInner({
  showText = true,
  setOpenMore,
  setMoreType,
  onClickManage,
  onClickRecord,
  onSettingOpen,
  onClickApp,
  isRecording,
  controlWidth,
  chat,
  isDot,
  setIsDot,
  size,
}: MoreButtonInnerProps) {
  const { t } = useI18n();

  const showTextOrHide = useMemo(() => {
    return ViewAdjusts(controlWidth).w720 ? false : showText;
  }, [controlWidth]);

  const { localParticipant } = useLocalParticipant();

  const { platUser } = usePlatformUserInfo({ uid: localParticipant.identity });

  const onClickChatMsg = () => {
    if (chat && chat.visible) {
      chat.onClicked();
      setIsDot!(false);
    }
  };
  const items: MenuProps['items'] = useMemo(() => {
    let moreItems = [
      // 应用
      {
        label: <div style={{ marginLeft: '8px' }}>{t('more.app.title')}</div>,
        key: 'app',
        icon: <SvgResource type="app" svgSize={16} />,
      },
      // 录屏功能
      {
        label: (
          <div style={{ marginLeft: '8px' }}>
            {!isRecording ? t('more.record.start') : t('more.record.stop')}
          </div>
        ),
        key: 'record',
        icon: <SvgResource type="record" svgSize={16} color={isRecording ? '#FF0000' : '#fff'} />,
      },
      // 参与者管理功能
      {
        label: <div style={{ marginLeft: '8px' }}>{t('more.participant.title')}</div>,
        key: 'participant',
        icon: <SvgResource type="user" svgSize={16} />,
      },
      {
        label: <div style={{ marginLeft: '8px' }}>{t('common.setting')}</div>,
        key: 'setting',
        icon: <SvgResource type="setting" svgSize={16} />,
      },
      ...(platUser
        ? [
            {
              label: <div>{t('more.platform')}</div>,
              key: 'platform_user',
              icon: <HomeOutlined style={{ fontSize: 16 }} />,
            },
          ]
        : []),
    ];
    if (chat && chat.visible) {
      moreItems.push({
        label: (
          <div style={{ marginLeft: '8px' }}>
            {t('common.chat')}{' '}
            <Badge count={chat.count} color="#22CCEE" size="small" dot={isDot} offset={[2, -2]} />
          </div>
        ),
        key: 'chat',
        icon: <SvgResource type="chat" svgSize={16} />,
      });
    }
    return moreItems;
  }, [isRecording, chat, t]);

  const handleMenuClick: MenuProps['onClick'] = async (e) => {
    switch (e.key) {
      case 'record':
        // space.voce.chat中暂不开启
        // Handle record action
        setMoreType('record');
        if (onClickRecord) {
          await onClickRecord();
        }
        break;
      case 'participant':
        // Handle participant action
        if (onClickManage) {
          await onClickManage();
        }
        setMoreType('participant');
        setOpenMore(true);
        break;
      case 'setting':
        if (onSettingOpen) {
          await onSettingOpen();
        }
        break;
      case 'app':
        if (onClickApp) {
          await onClickApp();
        }
        break;
      case 'chat':
        onClickChatMsg();
        break;
      case 'platform_user':
        if (platUser && platUser.userId) {
          window.open(`https://home.vocespace.com/auth/user/${platUser.userId}`, '_blank');
        }
        break;
      default:
        break;
    }
  };

  const menuProps = {
    items,
    onClick: handleMenuClick,
  };

  return (
    <Dropdown menu={menuProps} trigger={['click']}>
      <Button
        size={size}
        style={{
          backgroundColor: '#1E1E1E',
          height: '46px',
          borderRadius: '8px',
          border: 'none',
          color: '#fff',
        }}
      >
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
          <SvgResource type="more" svgSize={18}></SvgResource>
          {showTextOrHide && t('more.title')}
          <SvgResource type="down" svgSize={14}></SvgResource>
        </div>
      </Button>
    </Dropdown>
  );
}

export function MoreButton(props: MoreButtonProps) {
  const [isDot, setIsDot] = useState(true);

  return props.chat ? (
    <Badge
      count={props.chat.count}
      color="#22CCEE"
      size="small"
      offset={[-4, 4]}
      dot={isDot}
      style={{ zIndex: 1000 }}
    >
      <MoreButtonInner {...props} isDot={isDot} setIsDot={setIsDot}></MoreButtonInner>
    </Badge>
  ) : (
    <MoreButtonInner {...props}></MoreButtonInner>
  );
}
