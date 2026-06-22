import React from 'react';
import { Modal, Input, Button, Radio, message } from 'antd';
import { CreateSpaceStrategy } from '@/lib/std/conf';
import { useI18n } from '@/lib/i18n/i18n';

interface CreateSpaceStrategyModalProps {
  open: boolean;
  isHostManager: boolean;
  hostToken: string;
  createSpaceOption: CreateSpaceStrategy;
  createSpaceWhiteList: string;
  addWhiteListValue: string;
  onTokenChange: (token: string) => void;
  onOptionChange: (option: CreateSpaceStrategy) => void;
  onWhiteListChange: (whiteList: string) => void;
  onAddWhiteListValueChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}

export const CreateSpaceStrategyModal: React.FC<CreateSpaceStrategyModalProps> = ({
  open,
  isHostManager,
  hostToken,
  createSpaceOption,
  createSpaceWhiteList,
  addWhiteListValue,
  onTokenChange,
  onOptionChange,
  onWhiteListChange,
  onAddWhiteListValueChange,
  onCancel,
  onConfirm,
}) => {
  const { t } = useI18n();
  const [messageApi, contextHolder] = message.useMessage();

  const handleAddWhiteList = () => {
    const currentList = createSpaceWhiteList
      ? createSpaceWhiteList.split('\n').map((s) => s.trim())
      : [];
    if (addWhiteListValue && !currentList.includes(addWhiteListValue.trim())) {
      currentList.push(addWhiteListValue.trim());
      onWhiteListChange(currentList.join('\n'));
      onAddWhiteListValueChange('');
    } else {
      messageApi.warning(t('dashboard.conf.white_list_exist'));
    }
  };

  const handleDeleteWhiteList = () => {
    const currentList = createSpaceWhiteList
      ? createSpaceWhiteList.split('\n').map((s) => s.trim())
      : [];
    if (addWhiteListValue && currentList.includes(addWhiteListValue.trim())) {
      const newList = currentList.filter((s) => s !== addWhiteListValue.trim());
      onWhiteListChange(newList.join('\n'));
      onAddWhiteListValueChange('');
    } else {
      messageApi.warning(t('dashboard.conf.white_list_not_exist'));
    }
  };

  return (
    <Modal
      title={t('dashboard.conf.create_space')}
      open={open}
      onCancel={onCancel}
      footer={
        <Button type="primary" onClick={onConfirm}>
          {!isHostManager ? t('dashboard.conf.verify') : t('dashboard.conf.close')}
        </Button>
      }
    >
      {contextHolder}
      {isHostManager ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          <div>
            <div>{t('dashboard.conf.create_space_desc.0')}</div>
            <div>{t('dashboard.conf.create_space_desc.1')}</div>
            <div>{t('dashboard.conf.create_space_desc.2')}</div>
            <div>{t('dashboard.conf.create_space_desc.3')}</div>
          </div>
          <Radio.Group
            block
            size="large"
            optionType="button"
            value={createSpaceOption}
            onChange={(e) => {
              onOptionChange(e.target.value);
            }}
            style={{
              display: 'flex',
              flexDirection: 'column',
              margin: '16px 0',
            }}
            options={[
              {
                label: t('dashboard.conf.create_space_option.all'),
                value: 'all',
                style: { width: '100%' },
              },
              {
                label: t('dashboard.conf.create_space_option.white'),
                value: 'white',
                style: { width: '100%' },
              },
              {
                label: t('dashboard.conf.create_space_option.white_platform'),
                value: 'white_platform',
                style: { width: '100%' },
              },
            ]}
          ></Radio.Group>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div>
              <div>{t('dashboard.conf.white_list')}</div>
              <div>{t('dashboard.conf.white_list_desc.0')}</div>
              <div>{t('dashboard.conf.white_list_desc.1')}</div>
            </div>
            <div
              style={{
                display: 'flex',
                gap: 8,
              }}
            >
              <Input
                value={addWhiteListValue}
                onChange={(e) => {
                  onAddWhiteListValueChange(e.target.value);
                }}
              ></Input>
              <Button
                type="primary"
                onClick={handleAddWhiteList}
              >
                {t('dashboard.conf.add_white_list')}
              </Button>
              <Button
                variant="filled"
                danger
                onClick={handleDeleteWhiteList}
              >
                {t('dashboard.conf.delete_white_list')}
              </Button>
            </div>
            <Input.TextArea
              placeholder={t('dashboard.conf.white_list')}
              value={createSpaceWhiteList}
              autoSize
              disabled
            ></Input.TextArea>
          </div>
        </div>
      ) : (
        <Input
          placeholder={t('dashboard.conf.placeholder')}
          value={hostToken}
          onChange={(e) => {
            onTokenChange(e.target.value);
          }}
        ></Input>
      )}
    </Modal>
  );
};
