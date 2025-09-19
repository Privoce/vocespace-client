import { useI18n } from '@/lib/i18n/i18n';
import { AppAuth, AppKey, SpaceInfo } from '@/lib/std/space';
import { CarryOutOutlined, ClockCircleOutlined, HistoryOutlined } from '@ant-design/icons';
import { Checkbox, CheckboxChangeEvent, CheckboxProps, Radio, Tooltip } from 'antd';
import styles from '@/styles/controls.module.scss';
import { useEffect, useMemo, useState } from 'react';
import { LocalParticipant } from 'livekit-client';
import { api } from '@/lib/api';
import { MessageInstance } from 'antd/es/message/interface';
import { socket } from '@/app/[spaceName]/PageClientImpl';
import { WsBase } from '@/lib/std/device';

export interface AppSettingsProps {
  spaceName: string;
  spaceInfo: SpaceInfo;
  localParticipant: LocalParticipant;
  messageApi: MessageInstance;
}

export function AppSettings({
  spaceInfo,
  localParticipant,
  spaceName,
  messageApi,
}: AppSettingsProps) {
  const { t } = useI18n();
  const [isOwner, setIsOwner] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [auth, setAuth] = useState<AppAuth>('read');

  useEffect(() => {
    setIsOwner(localParticipant.identity === spaceInfo.ownerId);
  }, [localParticipant.identity, spaceInfo.ownerId]);

  const appOptions = useMemo(() => {
    return [
      {
        label: t('more.app.timer.title'),
        value: 'timer',
        icon: <ClockCircleOutlined className={styles.checkbox_icon} />,
        checked: spaceInfo.apps.includes('timer'),
      },
      {
        label: t('more.app.countdown.title'),
        value: 'countdown',
        icon: <HistoryOutlined className={styles.checkbox_icon} />,
        checked: spaceInfo.apps.includes('countdown'),
      },
      {
        label: t('more.app.todo.title'),
        value: 'todo',
        icon: <CarryOutOutlined className={styles.checkbox_icon} />,
        checked: spaceInfo.apps.includes('todo'),
      },
    ];
  }, [spaceInfo.apps, t]);

  const onChange = async (e: CheckboxChangeEvent, value: AppKey) => {
    const { checked } = e.target;
    // 发送请求
    setLoading(true);
    const response = await api.updateSpaceApps(spaceName, value, checked);
    setLoading(false);
    if (response.ok) {
      socket.emit('update_user_status', {
        space: spaceName,
      } as WsBase);
      messageApi.success(t('more.app.settings.update.success'));
    } else {
      messageApi.error(t('more.app.settings.update.error'));
    }
  };

  const updateSpaceAppAuth = async (appAuth: AppAuth) => {
    const response = await api.updateSpaceAppAuth(spaceName, localParticipant.identity, appAuth);
    if (response.ok) {
      socket.emit('update_user_status', {
        space: spaceName,
      } as WsBase);
      messageApi.success(t('more.app.settings.sync.update.success'));
    } else {
      messageApi.error(t('more.app.settings.sync.update.error'));
    }
  };

  return (
    <div className={styles.setting_box}>
      {isOwner && (
        <>
          <Tooltip title={t('more.app.settings.desc')} placement="right">
            <div className={styles.common_space}>{t('more.app.settings.filter')}:</div>
          </Tooltip>
          {appOptions.map((item) => (
            <div className={styles.common_space} style={{ width: '100%' }} key={item.value}>
              <Checkbox
                onChange={(e) => onChange(e, item.value as AppKey)}
                style={{ width: '100%' }}
                checked={item.checked}
                disabled={loading}
              >
                <div className={styles.checkbox_item}>
                  {item.icon}
                  <span>{item.label}</span>
                </div>
              </Checkbox>
            </div>
          ))}
        </>
      )}

      <Tooltip title={t('more.app.settings.sync.auth_desc')} placement="right">
        <div className={styles.common_space}>{t('more.app.settings.sync.auth')}:</div>
      </Tooltip>
      <Radio.Group
        size="large"
        block
        value={auth}
        onChange={async (e) => {
          setAuth(e.target.value);
          await updateSpaceAppAuth(e.target.value);
        }}
      >
        <Radio.Button value="read">{t('more.app.settings.sync.read')}</Radio.Button>
        <Radio.Button value="write" disabled>{t('more.app.settings.sync.write')}</Radio.Button>
      </Radio.Group>
    </div>
  );
}
