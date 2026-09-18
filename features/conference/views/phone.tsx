import { CopyOutlined, MenuOutlined } from '@ant-design/icons';
import { Button } from 'antd';
import { MediaStage, type ConferenceModel } from './media-stage';
import styles from './phone.module.scss';

export function PhoneRoomHeader({ model }: { model: ConferenceModel }) {
  return <header className={styles.header}>
    <div className={styles.identity}><strong title={model.space?.name}>{model.space?.name}</strong>
      <span><i /> {model.onlineCount} {model.t('channel.menu.active')}</span>
    </div>
    <Button type="text" aria-label={model.t('recording.copy.title')} icon={<CopyOutlined />} onClick={model.copyRoomName} />
    {model.showSideChannel && <Button type="text" aria-label={model.t('more.participant.title')} icon={<MenuOutlined />} onClick={model.toggleChannel} />}
  </header>;
}

export function VideoContainerPhone({ model }: { model: ConferenceModel }) {
  return <div className={styles.stage}><MediaStage model={model} /></div>;
}
