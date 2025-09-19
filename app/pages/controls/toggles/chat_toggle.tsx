import { Badge, Button } from 'antd';
import { ToggleProps } from '@/lib/std/device';
import { useI18n } from '@/lib/i18n/i18n';
import { useMemo, useState } from 'react';
import { ViewAdjusts } from '@/lib/std/window';
import { ToggleBtn } from './toggle_btn';

export interface ChatToggleProps extends ToggleProps {
  count?: number;
}
/**
 * ## 聊天开关组件
 * - 用于控制聊天功能的开关。
 * - 具有Badge功能, 用于显示未读消息数量。
 * - 具有响应式设计, 根据窗口宽度决定是否显示文字。
 * - 具有点击事件处理器, 用于切换聊天功能状态。
 * @param [`ChatToggleProps`]
 */
export function ChatToggle({
  enabled,
  onClicked,
  showText = true,
  count = 0,
  controlWidth,
}: ChatToggleProps) {
  const { t } = useI18n();
  const [isDot, setIsDot] = useState(true);
  const onClick = () => {
    onClicked(enabled);
    setIsDot(false);
  };
  const showTextOrHide = useMemo(() => {
    return ViewAdjusts(controlWidth).w720 ? false : showText;
  }, [controlWidth]);

  return (
    <Badge
      count={count}
      color="#22CCEE"
      size="small"
      offset={[-4, 4]}
      dot={isDot}
      style={{ zIndex: 1000 }}
    >
      {showTextOrHide ? (
        <ToggleBtn svgType="chat" label={t('common.chat')} onClick={onClick} />
      ) : (
        <ToggleBtn svgType="chat" onClick={onClick} />
      )}
    </Badge>
  );
}
