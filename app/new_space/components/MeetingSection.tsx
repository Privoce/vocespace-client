import styles from '../index.module.scss';
import { Button, Input, Segmented, Spin, Tooltip } from 'antd';
import Checkbox from 'antd/es/checkbox';
import type { MeetingModel } from '../hooks/UseMeeting';

export function MeetingSection({ model }: { model: MeetingModel }) {
  const {
    t,
    contextHolder,
    spinning,
    percent,
    options,
    optionVal,
    setRoomUrl,
    setOptionVal,
    roomUrl,
    startMeeting,
    e2ee,
    setE2ee,
    hq,
    setHq,
  } = model;

  return (
    <div className={styles.tabContent}>
      {contextHolder}
      <Spin spinning={spinning} percent={percent} fullscreen />
      <Segmented
        block
        options={options}
        size="large"
        value={optionVal}
        onChange={(value) => {
          setRoomUrl('');
          setOptionVal(value as string);
        }}
        styles={{
          label: {
            fontWeight: 500,
          },
        }}
      />
      <p className={styles.subtitle}>
        {optionVal == 'demo' ? t('msg.info.try_free') : t('msg.info.try_enter_room')}
      </p>
      {optionVal == 'custom' && (
        <Input
          size="large"
          type="text"
          placeholder={t('msg.info.enter_room')}
          value={roomUrl}
          onChange={(e) => {
            setRoomUrl(e.target.value);
          }}
        />
      )}
      <Button size="large" type="primary" onClick={startMeeting}>
        {t('common.start_metting')}
      </Button>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '1rem' }}>
          <Checkbox
            id="use-e2ee"
            checked={e2ee}
            onChange={(ev) => setE2ee(ev.target.checked)}
          ></Checkbox>
          <label htmlFor="use-e2ee">{t('msg.info.enabled_e2ee')}</label>
        </div>

        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '1rem' }}>
          <Checkbox id="use-hq" checked={hq} onChange={(ev) => setHq(ev.target.checked)}></Checkbox>
          <Tooltip title={t('common.high_quality_desc')} placement="right">
            <label htmlFor="use-hq">{t('common.high_quality')}</label>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}
