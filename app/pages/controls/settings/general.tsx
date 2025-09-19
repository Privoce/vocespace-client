import styles from '@/styles/controls.module.scss';
import { Button, Input, Radio } from 'antd';
import { LangSelect } from '../selects/lang_select';
import { StatusSelect } from '../selects/status_select';
import { SvgResource } from '@/app/resources/svg';
import { BuildUserStatus } from './user_status';
import { useI18n } from '@/lib/i18n/i18n';
import { LocalParticipant } from 'livekit-client';
import { MessageInstance } from 'antd/es/message/interface';
import { UserStatus } from '@/lib/std';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { SpaceInfo } from '@/lib/std/space';
export interface GeneralSettingsProps {
  space: string;
  localParticipant: LocalParticipant;
  messageApi: MessageInstance;
  appendStatus: boolean;
  setAppendStatus: (append: boolean) => void;
  setUserStatus?: (status: UserStatus | string) => Promise<void>;
  username: string;
  setUsername: (username: string) => void;
  openPromptSound: boolean;
  setOpenPromptSound: (open: boolean) => void;
  spaceInfo: SpaceInfo;
}

export function GeneralSettings({
  space,
  spaceInfo,
  localParticipant,
  messageApi,
  appendStatus,
  setAppendStatus,
  setUserStatus,
  username,
  setUsername,
  openPromptSound,
  setOpenPromptSound,
}: GeneralSettingsProps) {
  const { t } = useI18n();
  const [isOwner, setIsOwner] = useState<boolean>(false);
  const [persistence, setPersistence] = useState(false);

  useEffect(() => {
    setIsOwner(localParticipant.identity === spaceInfo.ownerId);
  }, [localParticipant.identity, spaceInfo.ownerId]);

  const setSpacePersistence = async (persistence: boolean) => {
    const response = await api.persistentSpace(space, persistence);
    if (response.ok) {
      messageApi.success(t('settings.general.persistence.success'));
    } else {
      messageApi.error(t('settings.general.persistence.error'));
    }
  };

  return (
    <div className={`${styles.setting_box} ${styles.scroll_box}`}>
      <div>{t('settings.general.username')}:</div>
      <Input
        size="large"
        className={styles.common_space}
        value={username}
        onChange={(e: any) => {
          setUsername(e.target.value);
        }}
      ></Input>
      <div className={styles.common_space}>{t('settings.general.lang')}:</div>
      <LangSelect style={{ width: '100%' }}></LangSelect>
      <div className={styles.common_space}>{t('settings.general.status.title')}:</div>
      <div className={styles.setting_box_line}>
        <StatusSelect
          style={{ width: 'calc(100% - 52px)' }}
          setUserStatus={setUserStatus}
        ></StatusSelect>
        <Button
          type="primary"
          shape="circle"
          style={{ cursor: 'pointer' }}
          onClick={() => {
            setAppendStatus(!appendStatus);
          }}
        >
          <SvgResource type="add" svgSize={16}></SvgResource>
        </Button>
      </div>
      {appendStatus && (
        <BuildUserStatus
          messageApi={messageApi}
          space={space}
          localParticipant={localParticipant}
        ></BuildUserStatus>
      )}
      <div className={styles.common_space}>{t('settings.general.prompt_sound')}:</div>
      <Radio.Group
        size="large"
        block
        value={openPromptSound}
        onChange={(e) => {
          setOpenPromptSound(e.target.value);
        }}
      >
        <Radio.Button value={true}>{t('common.open')}</Radio.Button>
        <Radio.Button value={false}>{t('common.close')}</Radio.Button>
      </Radio.Group>

      {/* 设置是否需要持久化房间 */}
      {isOwner && (
        <>
          <div className={styles.common_space}>{t('settings.general.persistence.title')}:</div>
          <Radio.Group
            size="large"
            block
            value={persistence}
            onChange={async (e) => {
              setPersistence(e.target.value);
              await setSpacePersistence(e.target.value);
            }}
          >
            <Radio.Button value={true}>{t('common.open')}</Radio.Button>
            <Radio.Button value={false}>{t('common.close')}</Radio.Button>
          </Radio.Group>
        </>
      )}
    </div>
  );
}
