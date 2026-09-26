import mobile from '@/styles/mobile.module.scss';
import { CopyOutlined, DeleteOutlined, DownloadOutlined } from '@ant-design/icons';
import { Button, Empty, Pagination, Select, Space, Tag } from 'antd';
import type { RecordingTableModel } from './pc';

export function RecordingTablePhone({ model }: { model: RecordingTableModel }) {
  const {
    t,
    sortedRecords,
    phonePage,
    setPhonePage,
    phoneSort,
    setPhoneSort,
    currentRoom,
    formatFileSize,
    loading,
    handleDownload,
    handleDelete,
    copyDownloadLink,
  } = model;
  const page = Math.min(phonePage, Math.max(1, Math.ceil(sortedRecords.length / 10)));
  return <div className={mobile.surface}>
    <Select aria-label={t('recording.table.last_modified')} value={phoneSort} style={{ width: '100%', marginBottom: 12 }} onChange={value => { setPhoneSort(value); setPhonePage(1); }}
      options={[
        { value: 'newest', label: `${t('recording.table.last_modified')} ↓` },
        { value: 'oldest', label: `${t('recording.table.last_modified')} ↑` },
        { value: 'size', label: `${t('recording.table.size')} ↓` },
        { value: 'name', label: `${t('recording.table.file')} ↑` },
      ]} />
    {sortedRecords.length === 0 && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('dashboard.recording.empty_description')} />}
    <div style={{ display: 'grid', gap: 12 }}>
      {sortedRecords.slice((page - 1) * 10, page * 10).map(record => <article key={record.id} className={mobile.card}>
        <strong>{record.key.replace(`${currentRoom}/`, '')}</strong>
        <div style={{ color: '#98a4b6', fontSize: 12, margin: '12px 0', lineHeight: 1.8 }}>
          <Tag color={record.key.endsWith('json') ? 'green' : 'blue'}>{t(record.key.endsWith('json') ? 'recording.table.ty_json' : 'recording.table.ty_video')}</Tag>
          {formatFileSize(record.size)}<br />{new Date(record.last_modified * 1000).toLocaleString()}
        </div>
        <Space wrap>
          <Button loading={loading} icon={<DownloadOutlined />} onClick={() => handleDownload(record)}>{t('recording.download.title')}</Button>
          <Button icon={<CopyOutlined />} onClick={() => copyDownloadLink(record)}>{t('recording.copy.title')}</Button>
          <Button danger loading={loading} icon={<DeleteOutlined />} onClick={() => handleDelete(record)}>{t('recording.delete.title')}</Button>
        </Space>
      </article>)}
    </div>
    <Pagination hideOnSinglePage simple current={page} pageSize={10} total={sortedRecords.length} onChange={setPhonePage} style={{ margin: '20px 0' }} />
  </div>;
}
