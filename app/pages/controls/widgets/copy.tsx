import { useI18n } from '@/lib/i18n/i18n';
import { CopyOutlined } from '@ant-design/icons';
import { Tooltip } from 'antd';
import { MessageInstance } from 'antd/es/message/interface';
import { forwardRef, useImperativeHandle } from 'react';

export interface CopyButtonProps {
  text: string;
  messageApi: MessageInstance;
  onExtraCopy?: () => void;
}

export interface CopyButtonExports {
  copyToClipboard: () => Promise<void>;
}

/**
 * A button component that copies the provided text to the clipboard when clicked.
 * - in todo list:
 * ```
 * --- 2025/01/01 ---  ----> date header
 * - [ ] 1. todo1  ----> undone
 * - [x] 2. todo2  ----> done
 * - [ ] 3. todo3
 * ```
 * @param param0
 * @returns
 */
export const CopyButton = forwardRef<CopyButtonExports, CopyButtonProps>(
  ({ text, messageApi, onExtraCopy }: CopyButtonProps, ref) => {
    const { t } = useI18n();

    const copyToClipboard = async () => {
      try {
        await navigator.clipboard.writeText(text);
        messageApi.success(t('common.copy.success'));
      } catch (e) {
        messageApi.error(t('common.copy.error'));
      }
    };

    useImperativeHandle(ref, () => ({
      copyToClipboard,
    }));

    return (
      <Tooltip title={t('more.app.todo.copy')}>
        <CopyOutlined
          style={{ fontSize: 16, cursor: 'pointer' }}
          onClick={(e) => {
            e.stopPropagation();
            copyToClipboard();
            onExtraCopy && onExtraCopy();
          }}
        ></CopyOutlined>
      </Tooltip>
    );
  },
);
