import { LangSelect } from '@/app/pages/controls/selects/lang_select';
import { SvgResource } from '@/app/resources/svg';
import { Button,Checkbox,Input,Spin } from 'antd';
import type { HomePageModel } from '../hooks/use-home-page';
import styles from './phone.module.scss';

export function HomePagePhone({ t, meeting: m }: HomePageModel) {
  return (
    <main className={styles.page} data-lk-theme="default" data-device="phone">
      {m.contextHolder}
      <Spin spinning={m.spinning} fullscreen />
      <header className={styles.header}><LangSelect /></header>
      <section className={styles.intro}>
        <SvgResource type="logo" svgSize={56} />
        <h1><span>Voce</span>Space</h1>
        <p>{t('msg.info.title')}</p>
      </section>
      <section className={styles.card}>
        <div className={styles.tabs} role="tablist" aria-label={t('msg.info.title')}>
          {m.options.map((option) => (
            <button key={option.value} role="tab" aria-selected={m.optionVal === option.value}
              onClick={() => { m.setRoomUrl(''); m.setOptionVal(option.value); }}>{option.label}</button>
          ))}
        </div>
        <p>{t(m.optionVal === 'demo' ? 'msg.info.try_free' : 'msg.info.try_enter_room')}</p>
        {m.optionVal === 'custom' && <Input size="large" value={m.roomUrl}
          aria-label={t('msg.info.enter_room')} placeholder={t('msg.info.enter_room')}
          onChange={(event) => m.setRoomUrl(event.target.value)} onPressEnter={m.startMeeting} />}
        <Button className={styles.primary} type="primary" size="large" onClick={m.startMeeting} disabled={m.spinning}>
          {t('common.start_metting')}
        </Button>
      </section>
      <div className={styles.options}>
        <Checkbox checked={m.e2ee} onChange={(event) => m.setE2ee(event.target.checked)}>{t('msg.info.enabled_e2ee')}</Checkbox>
        <Checkbox checked={m.hq} onChange={(event) => m.setHq(event.target.checked)}>{t('common.high_quality')}</Checkbox>
      </div>
      <footer className={styles.footer}>
        <a href="mailto:han@privoce.com">han@privoce.com</a>
        <a href="https://vocespace.com">{t('msg.info.offical_web')}</a>
      </footer>
    </main>
  );
}
