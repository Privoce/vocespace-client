import styles from '@/styles/controls.module.scss';
import { Button, Input, InputRef, Radio } from 'antd';
import { LangSelect } from '../selects/lang_select';
import { useI18n } from '@/lib/i18n/i18n';
import { LocalParticipant } from 'livekit-client';
import { MessageInstance } from 'antd/es/message/interface';
import { TransIfSystemStatus, UserStatus } from '@/lib/std';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { SpaceInfo } from '@/lib/std/space';
import { socket } from '@/app/[spaceName]/PageClientImpl';
import { WsBase } from '@/lib/std/device';
import { DefineUserStatusResponse } from '@/lib/api/space';
export interface GeneralSettingsProps {
  space: string;
  localParticipant: LocalParticipant;
  messageApi: MessageInstance;
  appendStatus: boolean;
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
  username,
  setUsername,
  openPromptSound,
  setOpenPromptSound,
}: GeneralSettingsProps) {
  const { t } = useI18n();
  const [isOwner, setIsOwner] = useState<boolean>(false);
  const [persistence, setPersistence] = useState(spaceInfo.persistence);
  const [allowGuest, setAllowGuest] = useState(spaceInfo.allowGuest);
  const [state, setState] = useState('');
  const StateInputRef = useRef<InputRef>(null);
  useEffect(() => {
    setIsOwner(localParticipant.identity === spaceInfo.ownerId);
    setState(TransIfSystemStatus(t, spaceInfo.participants[localParticipant.identity].status));
  }, [localParticipant.identity, spaceInfo]);

  // 当appendStatus为true时自动聚焦状态输入框
  useEffect(() => {
    if (appendStatus && StateInputRef.current) {
      StateInputRef.current.input?.focus();
    }
  }, [appendStatus, StateInputRef]);

  const setSpacePersistence = async (persistence: boolean) => {
    const response = await api.persistentSpace(space, persistence);
    if (response.ok) {
      messageApi.success(t('settings.general.persistence.success'));
    } else {
      messageApi.error(t('settings.general.persistence.error'));
    }
  };

  const setSpaceAllowGuest = async (allowGuest: boolean) => {
    const response = await api.allowGuest(space, allowGuest);
    if (response.ok) {
      messageApi.success(t('settings.general.conf.allow_guest.success'));
    } else {
      messageApi.error(t('settings.general.conf.allow_guest.error'));
    }
  };

  const saveStatus = async () => {
    try {
      // 发送到服务器保存状态
      const response = await api.defineUserStatus(space, localParticipant.identity, state);
      if (!response.ok) {
        throw new Error(`Failed to save status: ${response.status}`);
      }
      const data: DefineUserStatusResponse = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }
      messageApi.success({
        content: t('settings.general.status.define.success'),
      });
      socket.emit('update_user_status', {
        space: data.spaceName,
      } as WsBase);
    } catch (e) {
      messageApi.error({
        content: `${t('settings.general.status.define.fail')}: ${e}`,
      });
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
      {/* <div className={styles.setting_box_line}>
        <StatusSelect
          style={{ width: 'calc(100% - 52px)' }}
          setUserStatus={setUserStatus}
          localParticipant={localParticipant}
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
      </div> */}
      {/* {appendStatus && (
        <BuildUserStatus
          messageApi={messageApi}
          space={space}
          localParticipant={localParticipant}
        ></BuildUserStatus>
      )} */}
      <div className={styles.setting_box_line}>
        <Input
          ref={StateInputRef}
          size="large"
          style={{ width: '100%' }}
          value={state}
          placeholder={t('settings.general.status.define.placeholder.name')}
          onChange={(e) => {
            setState(e.target.value);
          }}
        ></Input>
        <Button
          size="large"
          style={{ width: 'fit-content', margin: '8px 0' }}
          type="primary"
          onClick={saveStatus}
        >
          {t('settings.general.status.define.save')}
        </Button>
      </div>

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
          <div className={styles.common_space}>{t('settings.general.conf.allow_guest.title')}:</div>
          <Radio.Group
            size="large"
            block
            value={allowGuest}
            onChange={async (e) => {
              setAllowGuest(e.target.value);
              await setSpaceAllowGuest(e.target.value);
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
