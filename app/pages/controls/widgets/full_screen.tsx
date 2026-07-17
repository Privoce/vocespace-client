import { FullscreenExitOutlined, FullscreenOutlined } from '@ant-design/icons';
import { forwardRef, useState } from 'react';
import { APP_FLOT_PIN_STYLE } from '../../apps/app_pin';
import {
  FocusToggleIcon,
  UnfocusToggleIcon,
  LayoutContext,
  LayoutContextType,
  TrackReferenceOrPlaceholder,
  useEnsureTrackRef,
  useMaybeLayoutContext,
  useMaybeTrackRefContext,
} from '@livekit/components-react';
import { isTrackReferencePinned } from '../../participant/tile';
import { Tooltip } from 'antd';
import { useI18n } from '@/lib/i18n/i18n';
import { useSpaceStore } from '@/lib/store';

export interface FullScreenBtnProps {
  isFullScreen: boolean;
  setIsFullScreen: (isFullScreen: boolean) => void;
}

export interface FullScreenBtnExports {}

export const useFullScreenBtn = () => {
  const [isFullScreen, setIsFullScreen] = useState(false);
  return {
    isFullScreen,
    setIsFullScreen,
  };
};

export const FullScreenBtn = forwardRef<
  FullScreenBtnExports,
  FullScreenBtnProps & { trackReference?: TrackReferenceOrPlaceholder }
>(
  (
    {
      isFullScreen,
      setIsFullScreen,
      trackReference,
    }: FullScreenBtnProps & { trackReference?: TrackReferenceOrPlaceholder },
    ref,
  ) => {
    const trackRefFromContext = useMaybeTrackRefContext();
    const trackRef = useEnsureTrackRef(trackReference ?? trackRefFromContext);

    return (
      <LayoutContext.Consumer>
        {(layoutContext) =>
          layoutContext !== undefined && (
            <FullScreenBtnPin
              isFullScreen={isFullScreen}
              setIsFullScreen={setIsFullScreen}
              layoutContext={layoutContext}
              trackRef={trackRef}
            />
          )
        }
      </LayoutContext.Consumer>
    );
  },
);

interface FullScreenBtnPinProps extends FullScreenBtnProps {
  layoutContext?: LayoutContextType;
  trackRef: TrackReferenceOrPlaceholder;
}

export const FullScreenBtnPin = ({
  isFullScreen,
  setIsFullScreen,
  layoutContext,
  trackRef,
}: FullScreenBtnPinProps) => {
  const { t } = useI18n();
  const setCollapsed = useSpaceStore((s) => s.setCollapsed);
  const isPinned = isTrackReferencePinned(trackRef, layoutContext?.pin.state);
  const isActiveView = isFullScreen || isPinned;

  const handleToggleView = () => {
    if (isActiveView) {
      if (isPinned) {
        layoutContext?.pin.dispatch?.({
          msg: 'clear_pin',
        });
      }
      if (isFullScreen) {
        setCollapsed(false);
        setIsFullScreen(false);
      }
      return;
    }

    layoutContext?.pin.dispatch?.({
      msg: 'set_pin',
      trackReference: trackRef,
    });
    setCollapsed(true);
    setIsFullScreen(true);
  };

  return (
    <Tooltip placement="bottom" title={t('common.full_screen')}>
      <button className="lk-button" style={APP_FLOT_PIN_STYLE} onClick={handleToggleView}>
        {isActiveView ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
      </button>
    </Tooltip>
  );
};
