import { RecordingTable } from '@/app/recording/table';
import mobile from '@/styles/mobile.module.scss';
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { Button, Input, Spin, Tag } from 'antd';
import type { RecordingContentModel } from './pc';

export function RecordingContentPhone({ model }: { model: RecordingContentModel }) {
  const {
    t,
    contextHolder,
    roomName,
    setRoomName,
    isConnected,
    searchLoading,
    searchRoomRecords,
    currentRoom,
    handleRefresh,
    messageApi,
    env,
    recordsData,
    setRecordsData,
  } = model;
  return <main className={mobile.surface} style={{ padding: 16, minHeight: '100%', paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}>
    {contextHolder}
    <h2>{t('dashboard.recording.title')}</h2>
    <Tag color="cyan">{isConnected}</Tag>
    <p style={{ color: '#98a4b6' }}>{t('dashboard.recording.description')}</p>
    <form className={mobile.card} onSubmit={event => { event.preventDefault(); void searchRoomRecords(); }}>
      <Input value={roomName} onChange={event => setRoomName(event.target.value)} placeholder={t('dashboard.recording.input_placeholder')} aria-label={t('dashboard.recording.input_placeholder')} />
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <Button htmlType="submit" type="primary" icon={<SearchOutlined />} loading={searchLoading}>{t('dashboard.recording.search')}</Button>
        {currentRoom && <Button icon={<ReloadOutlined />} onClick={handleRefresh} loading={searchLoading}>{t('dashboard.recording.refresh')}</Button>}
      </div>
    </form>
    <h3 style={{ marginTop: 24 }}>{currentRoom || t('dashboard.recording.list_title')} · {recordsData.length}</h3>
    <Spin spinning={searchLoading}><RecordingTable messageApi={messageApi} env={env} currentRoom={currentRoom} recordsData={recordsData} setRecordsData={setRecordsData} /></Spin>
  </main>;
}
