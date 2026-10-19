import { SvgResource } from '@/components/Icon';

import { GeneralSettingsContent as SharedGeneralSettingsContent } from '@vocespace/ui';
import { useLayoutDevice } from '@/lib/hooks/use-layout-device';
import { settingsElements } from '../phone-content';
import styles from '@/components/Controller/index.module.scss';
import { Button, Input, type InputRef, Radio, Switch } from 'antd';
import { LangSelect } from '../../Select/lang';
import type { LocalParticipant } from 'livekit-client';
import type { MessageInstance } from 'antd/es/message/interface';
import type { SpaceInfo } from '@/lib/std/space';
import { useEffect, useRef } from 'react';
import { useGeneralSettings } from '../hooks/useGeneralSettings';
export interface GeneralSettingsProps {
  space: string;
  localParticipant: LocalParticipant;
  messageApi: MessageInstance;
  appendStatus: boolean;
  openPromptSound: boolean;
  setOpenPromptSound: (open: boolean) => void;
  spaceInfo: SpaceInfo;
}

export function GeneralSettings(props: GeneralSettingsProps) {
  return (
    <GeneralSettingsContent key={`${props.space}:${props.localParticipant.identity}`} {...props} />
  );
}
function GeneralSettingsContent(props: GeneralSettingsProps) {
  const phoneSettings = useLayoutDevice() === 'phone';
  const { appendStatus, openPromptSound, setOpenPromptSound } = props;
  const {
    t,
    isOwner,
    persistence,
    allowGuest,
    status: state,
    setStatus: setState,
    savePersistence: setSpacePersistence,
    saveAllowGuest: setSpaceAllowGuest,
    saveStatus,
  } = useGeneralSettings(props);
  const StateInputRef = useRef<InputRef>(null);
  useEffect(() => {
    if (appendStatus) StateInputRef.current?.input?.focus();
  }, [appendStatus]);
  if (phoneSettings)
    return SharedGeneralSettingsContent({
      elements: settingsElements,
      styles,
      t,
      owner: isOwner,
      slots: {
        introIcon: <SvgResource type="setting" svgSize={24} color="#22CCEE" />,
        language: <LangSelect style={{ width: '100%' }}></LangSelect>,
        status: (
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
        ),
        saveStatus: (
          <Button
            size="large"
            style={{ width: 'fit-content', margin: '8px 0' }}
            type="primary"
            onClick={saveStatus}
          >
            {t('settings.general.status.define.save')}
          </Button>
        ),
        prompt: <Switch checked={openPromptSound} onChange={setOpenPromptSound} />,
        persistence: (
          <Switch
            checked={persistence}
            onChange={(value) => {
              void setSpacePersistence(value);
            }}
          />
        ),
        guests: (
          <Radio.Group
            size="large"
            block
            value={allowGuest}
            style={{
              display: 'flex',
              flexDirection: 'column',
            }}
            onChange={async (e) => {
              await setSpaceAllowGuest(e.target.value);
            }}
          >
            <Radio value={'allow'}>{t('settings.general.conf.allow_guest.allow')}</Radio>
            <Radio value={'link'}>{t('settings.general.conf.allow_guest.link')}</Radio>
            <Radio value={'disable'}>{t('settings.general.conf.allow_guest.disable')}</Radio>
          </Radio.Group>
        ),
        dashboard: (
          <Button
            size="large"
            type="primary"
            block
            onClick={() => window.open(`/dashboard`, '_blank')}
          >
            {t('settings.general.manage_dashboard') || 'Dashboard'}
          </Button>
        ),
      },
    });

  return (
    <div className={`${styles.setting_box} ${styles.scroll_box}`}>
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
            style={{
              display: 'flex',
              flexDirection: 'column',
            }}
            onChange={async (e) => {
              await setSpaceAllowGuest(e.target.value);
            }}
          >
            <Radio.Button value={'allow'}>
              {t('settings.general.conf.allow_guest.allow')}
            </Radio.Button>
            <Radio.Button value={'link'}>
              {t('settings.general.conf.allow_guest.link')}
            </Radio.Button>
            <Radio.Button value={'disable'}>
              {t('settings.general.conf.allow_guest.disable')}
            </Radio.Button>
          </Radio.Group>
        </>
      )}
      {/* 访问管理后台 */}
      <div className={styles.common_space}>
        {t('settings.general.manage_dashboard') || 'Dashboard'}:
      </div>
      <Button size="large" type="primary" block onClick={() => window.open(`/dashboard`, '_blank')}>
        {t('settings.general.manage_dashboard') || 'Dashboard'}
      </Button>
    </div>
  );
}
