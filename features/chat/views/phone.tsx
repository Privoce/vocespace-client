import mobile from '@/features/shared/mobile.module.scss';
import { Drawer } from 'antd';
import { ChatContent, type ChatPanelModel } from './content';
import styles from './phone.module.scss';

export function ChatPanelPhone({ model }: { model: ChatPanelModel }) {
  return <Drawer open width="100%" closable={false} onClose={model.onClose} title={null}
    rootStyle={{ height: model.viewport?.height, top: model.viewport?.top }}
    styles={{ header: { display: 'none' }, body: { padding: 0 }, content: { background: '#0c0f14' } }}>
    <section className={`${mobile.surface} ${styles.phone}`} aria-label={model.t('common.chat')}><ChatContent model={model} /></section>
  </Drawer>;
}
