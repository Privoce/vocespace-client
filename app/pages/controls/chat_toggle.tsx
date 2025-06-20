import { Badge, Button } from 'antd';
import { ToggleProps } from '@/lib/std/device';
import { SvgResource } from '@/app/resources/svg';
import { useI18n } from '@/lib/i18n/i18n';
import { useMemo, useState } from 'react';

export interface ChatToggleProps extends ToggleProps {
  count?: number;
}

export function ChatToggle({ enabled, onClicked, showText = true, count=0 }: ChatToggleProps ) {
  const on_clicked = () => {
    onClicked(enabled);
  };
  const { t } = useI18n();
const [show, setShow] = useState(true);
  const showTextOrHide = useMemo(() => {
    if (window.innerWidth < 760) {
      return false;
    } else {
      return showText;
    }
  }, [window.innerWidth]);

  return (
    <Badge count={count} color='#22CCEE' size='small' offset={[-4, 4]}>
        {showTextOrHide ? (
        <Button
          variant="solid"
          color="default"
          size="large"
          onClick={on_clicked}
          style={{ backgroundColor: '#1E1E1E', height: '46px', borderRadius: '8px' }}
        >
          <SvgResource type="chat" svgSize={18}></SvgResource>
          {t('common.chat')}
        </Button>
      ) : (
        <Button  variant="solid" color="default" size="large" onClick={on_clicked}  style={{ backgroundColor: '#1E1E1E', height: '46px', borderRadius: '8px' }}>
          <SvgResource type="chat" svgSize={18}></SvgResource>
        </Button>
      )}
      </Badge>
  );
}
