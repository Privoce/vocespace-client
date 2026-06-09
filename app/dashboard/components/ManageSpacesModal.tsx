import React from 'react';
import { Modal, Input, Button, Table, Space, Popconfirm, Select } from 'antd';
import { SpaceInfoMap } from '@/lib/std/space';
import { useI18n } from '@/lib/i18n/i18n';

interface ManageSpacesModalProps {
  open: boolean;
  isHostManager: boolean;
  hostToken: string;
  manageLoading: boolean;
  manageSpaces: SpaceInfoMap | null;
  manageSearchText: string;
  editingOwnerSpace: string | null;
  ownerCandidates: Array<{ id: string; name: string }>;
  selectedNewOwner: string | null;
  onTokenChange: (token: string) => void;
  onSearchTextChange: (text: string) => void;
  onVerifyAndLoad: () => Promise<void>;
  onClose: () => void;
  onLogout: () => void;
  onDeleteSpace: (spaceName: string) => Promise<void>;
  onEditOwner: (spaceName: string) => Promise<void>;
  onExportSpace: (spaceName: string) => Promise<void>;
  onSaveNewOwner: () => Promise<void>;
  onSelectedNewOwnerChange: (ownerId: string | null) => void;
  onEditingOwnerSpaceChange: (spaceName: string | null) => void;
}

export const ManageSpacesModal: React.FC<ManageSpacesModalProps> = ({
  open,
  isHostManager,
  hostToken,
  manageLoading,
  manageSpaces,
  manageSearchText,
  editingOwnerSpace,
  ownerCandidates,
  selectedNewOwner,
  onTokenChange,
  onSearchTextChange,
  onVerifyAndLoad,
  onClose,
  onLogout,
  onDeleteSpace,
  onEditOwner,
  onExportSpace,
  onSaveNewOwner,
  onSelectedNewOwnerChange,
  onEditingOwnerSpaceChange,
}) => {
  const { t } = useI18n();

  return (
    <Modal
      title={t('dashboard.manage_spaces')}
      open={open}
      onCancel={onClose}
      width={800}
      footer={null}
    >
      {!isHostManager ? (
        <div style={{ display: 'flex', gap: 8 }}>
          <Input
            placeholder={t('dashboard.host_token_placeholder')}
            value={hostToken}
            onChange={(e) => onTokenChange(e.target.value)}
          />
          <Button
            loading={manageLoading}
            onClick={onVerifyAndLoad}
            type="primary"
          >
            {t('dashboard.verify_and_load')}
          </Button>
        </div>
      ) : (
        <div style={{ overflow: 'auto', maxWidth: '100%' }}>
          <div style={{ marginBottom: 12 }}>
            <Button
              onClick={onLogout}
            >
              {t('dashboard.logout')}
            </Button>
          </div>
          <Input.Search
            placeholder={t('dashboard.manage_search_placeholder')}
            allowClear
            value={manageSearchText}
            onChange={(e) => onSearchTextChange(e.target.value)}
            style={{ marginBottom: 12 }}
          />
          <Table
            dataSource={
              manageSpaces
                ? Object.entries(manageSpaces)
                    .map(([k, v]) => ({
                      key: k,
                      space: k,
                      ownerId: v.ownerId,
                      ownerName: v.participants?.[v.ownerId]?.name || v.ownerId || '-',
                    }))
                    .filter((row) =>
                      manageSearchText
                        ? row.space.toLowerCase().includes(manageSearchText.toLowerCase())
                        : true,
                    )
                : []
            }
            loading={manageLoading}
            pagination={{ pageSize: 8 }}
            columns={[
              { title: 'Space', dataIndex: 'space', key: 'space', width: 200 },
              { title: 'Owner', dataIndex: 'ownerName', key: 'ownerName', width: 140 },
              {
                title: 'Actions',
                fixed: 'right',
                key: 'actions',
                render: (_: any, record: any) => (
                  <Space>
                    <Popconfirm
                      title={t('dashboard.confirm_delete_space')}
                      onConfirm={() => onDeleteSpace(record.space)}
                      okText={t('dashboard.yes')}
                      cancelText={t('dashboard.no')}
                    >
                      <Button danger size="small">
                        {t('dashboard.delete_space_button')}
                      </Button>
                    </Popconfirm>
                    <Button size="small" onClick={() => onEditOwner(record.space)}>
                      {t('dashboard.edit_owner_button')}
                    </Button>
                    <Button size="small" onClick={() => onExportSpace(record.space)}>
                      {t('dashboard.export_space_button')}
                    </Button>
                  </Space>
                ),
              },
            ]}
          />

          {/* 修改 owner 的 Modal */}
          <Modal
            title={t('dashboard.edit_owner_modal_title')}
            open={!!editingOwnerSpace}
            onCancel={() => onEditingOwnerSpaceChange(null)}
            footer={
              <div style={{ display: 'flex', gap: 8 }}>
                <Button onClick={() => onEditingOwnerSpaceChange(null)}>
                  {t('dashboard.cancel')}
                </Button>
                <Button type="primary" loading={manageLoading} onClick={onSaveNewOwner}>
                  {t('dashboard.save')}
                </Button>
              </div>
            }
          >
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{ minWidth: 120 }}>{editingOwnerSpace}</div>
              <Select
                style={{ minWidth: 240 }}
                placeholder="new owner"
                value={selectedNewOwner || undefined}
                onChange={(val) => onSelectedNewOwnerChange(val)}
              >
                {ownerCandidates.map((c) => (
                  <Select.Option key={c.id} value={c.id}>
                    {c.name} ({c.id})
                  </Select.Option>
                ))}
              </Select>
            </div>
          </Modal>
        </div>
      )}
    </Modal>
  );
};
