import { Fragment } from 'react';
import { RecordingListContent, RecordingCardContent } from '@vocespace/ui';
import { settingsElements } from '../../Settings/phone-content';
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
  return RecordingListContent({elements:settingsElements,styles:mobile,t,sort:(<Select aria-label={t('recording.table.last_modified')} value={phoneSort} style={{ width: '100%', marginBottom: 12 }} onChange={value => { setPhoneSort(value); setPhonePage(1); }}
      options={[
        { value: 'newest', label: `${t('recording.table.last_modified')} ↓` },
        { value: 'oldest', label: `${t('recording.table.last_modified')} ↑` },
        { value: 'size', label: `${t('recording.table.size')} ↓` },
        { value: 'name', label: `${t('recording.table.file')} ↑` },
      ]} />),empty:(sortedRecords.length === 0 && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('dashboard.recording.empty_description')} />),records:(sortedRecords.slice((page - 1) * 10, page * 10).map(record => <Fragment key={record.id}>{RecordingCardContent({elements:settingsElements,styles:mobile,t,name:record.key.replace(`${currentRoom}/`,''),tag:(<Tag color={record.key.endsWith('json') ? 'green' : 'blue'}>{t(record.key.endsWith('json') ? 'recording.table.ty_json' : 'recording.table.ty_video')}</Tag>),size:formatFileSize(record.size),date:new Date(record.last_modified*1000).toLocaleString(),actions:(<Space wrap>
          <Button loading={loading} icon={<DownloadOutlined />} onClick={() => handleDownload(record)}>{t('recording.download.title')}</Button>
          <Button icon={<CopyOutlined />} onClick={() => copyDownloadLink(record)}>{t('recording.copy.title')}</Button>
          <Button danger loading={loading} icon={<DeleteOutlined />} onClick={() => handleDelete(record)}>{t('recording.delete.title')}</Button>
        </Space>)})}</Fragment>)),pagination:(<Pagination hideOnSinglePage simple current={page} pageSize={10} total={sortedRecords.length} onChange={setPhonePage} style={{ margin: '20px 0' }} />)});
}
