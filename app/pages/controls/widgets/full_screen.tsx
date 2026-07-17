import { FullscreenExitOutlined, FullscreenOutlined } from '@ant-design/icons';
import { forwardRef } from 'react';
import { APP_FLOT_PIN_STYLE } from '../../apps/app_pin';
import {
  LayoutContext,
  LayoutContextType,
  TrackReferenceOrPlaceholder,
  useEnsureTrackRef,
  useMaybeTrackRefContext,
} from '@livekit/components-react';
import { isTrackReferencePinned } from '../../participant/tile';
import { Tooltip } from 'antd';
import { useI18n } from '@/lib/i18n/i18n';
import { useSpaceStore } from '@/lib/store';

export interface FullScreenBtnProps {}

export interface FullScreenBtnExports {}

export const useFullScreenBtn = () => {
  const isFullScreen = useSpaceStore((state) => state.isFullScreen);
  const setIsFullScreen = useSpaceStore((state) => state.setIsFullScreen);
  return {
    isFullScreen,
    setIsFullScreen,
  };
};

export const FullScreenBtn = forwardRef<
  FullScreenBtnExports,
  { trackReference?: TrackReferenceOrPlaceholder }
>(
  ({ trackReference }: { trackReference?: TrackReferenceOrPlaceholder }, ref) => {
    const isFullScreen = useSpaceStore((state) => state.isFullScreen);
    const setIsFullScreen = useSpaceStore((state) => state.setIsFullScreen);
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

interface FullScreenBtnPinProps {
  layoutContext?: LayoutContextType;
  isFullScreen: boolean;
  setIsFullScreen: (isFullScreen: boolean) => void;
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

  const handleToggleView = () => {
    if (isFullScreen) {
      setCollapsed(false);
      setIsFullScreen(false);
      return;
    }

    if (!isPinned) {
      layoutContext?.pin.dispatch?.({
        msg: 'set_pin',
        trackReference: trackRef,
      });
    }
    setCollapsed(true);
    setIsFullScreen(true);
  };

  return (
    <Tooltip placement="bottom" title={t('common.full_screen')}>
      <button className="lk-button" style={APP_FLOT_PIN_STYLE} onClick={handleToggleView}>
        {isFullScreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
      </button>
    </Tooltip>
  );
};
