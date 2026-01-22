import { Button } from 'antd';
import { ToggleProps } from '@/lib/std/device';
import { SvgResource } from '@/app/resources/svg';
import { useI18n } from '@/lib/i18n/i18n';
import { useMemo } from 'react';
import { VideoPresets } from 'livekit-client';
import { WindowAdjusts } from '@/lib/std/window';

export function SettingToggle({ enabled, onClicked, showText = true }: ToggleProps) {
  const on_clicked = () => {
    onClicked(enabled);
  };
  const { t } = useI18n();

  const showTextOrHide = useMemo(() => {
    // 判断窗口的宽度是否大于720px, 如果小于则需要隐藏文字
    return WindowAdjusts.w720 ? false : showText;
  }, [window.innerWidth]);

  return (
    <>
      {showTextOrHide ? (
        <Button
          variant="solid"
          color="default"
          size="large"
          onClick={on_clicked}
          style={{ backgroundColor: '#F59346', height: '44px', borderRadius: '8px' }}
        >
          <SvgResource type="setting" svgSize={16}></SvgResource>
          {t('common.setting')}
        </Button>
      ) : (
        <Button
          variant="solid"
          color="default"
          size="large"
          onClick={on_clicked}
          style={{ backgroundColor: '#F59346', height: '38px', borderRadius: '8px' }}
        >
          <SvgResource type="setting" svgSize={16}></SvgResource>
        </Button>
      )}
    </>
  );
}
