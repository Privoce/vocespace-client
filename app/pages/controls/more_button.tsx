import { Button, Dropdown, MenuProps } from 'antd';
import { SvgResource } from '@/app/resources/svg';
import { useI18n } from '@/lib/i18n/i18n';
import { useMemo } from 'react';

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
}

export function MoreButton({
  showText = true,
  setOpenMore,
  setMoreType,
  onClickManage,
  onClickRecord,
  onSettingOpen,
  onClickApp,
  isRecording,
  controlWidth,
}: MoreButtonProps) {
  const { t } = useI18n();

  const showTextOrHide = useMemo(() => {
    // 判断窗口的宽度是否大于720px, 如果小于则需要隐藏文字
    if (controlWidth < 700) {
      return false;
    } else {
      return showText;
    }
  }, [controlWidth]);

  const items: MenuProps['items'] = useMemo(() => {
    return [
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
    ];
  }, [isRecording]);

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
      default:
        break;
    }
  };

  const menuProps = {
    items,
    onClick: handleMenuClick,
  };

  return (
    <>
      <Dropdown menu={menuProps} trigger={['click']}>
        <Button
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
    </>
  );
}
