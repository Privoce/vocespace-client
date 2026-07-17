import * as React from 'react';
import {
  useFocusToggle,
  useMaybeTrackRefContext,
  FocusToggleIcon,
  UnfocusToggleIcon,
  LayoutContext,
  FocusToggleProps,
  LayoutContextType,
} from '@livekit/components-react';
import { useSpaceStore } from '@/lib/store';

export const FocusToggle: (
  props: FocusToggleProps & React.RefAttributes<HTMLButtonElement>,
) => React.ReactNode = /* @__PURE__ */ React.forwardRef<HTMLButtonElement, FocusToggleProps>(
  function FocusToggle({ trackRef, ...props }: FocusToggleProps, ref) {
    const trackRefFromContext = useMaybeTrackRefContext();
    const isFullScreen = useSpaceStore((state) => state.isFullScreen);
    const setIsFullScreen = useSpaceStore((state) => state.setIsFullScreen);
    const setCollapsed = useSpaceStore((state) => state.setCollapsed);

    const { mergedProps, inFocus } = useFocusToggle({
      trackRef: trackRef ?? trackRefFromContext,
      props,
    });

    const clickFocus = (layoutContext: LayoutContextType) => {
      if (inFocus) {
        if (isFullScreen) {
          setIsFullScreen(false);
          setCollapsed(false);
          return;
        }

        layoutContext?.pin.dispatch?.({
          msg: 'clear_pin',
        });
        setIsFullScreen(false);
        setCollapsed(false);
      } else {
        layoutContext?.pin.dispatch?.({
          msg: 'set_pin',
          trackReference: (trackRef ?? trackRefFromContext)!,
        });
        setIsFullScreen(false);
      }
    };

    return (
      <LayoutContext.Consumer>
        {(layoutContext) =>
          layoutContext !== undefined && (
            <button ref={ref} {...mergedProps} onClick={() => clickFocus(layoutContext)}>
              {props.children ? (
                props.children
              ) : inFocus ? (
                <UnfocusToggleIcon />
              ) : (
                <FocusToggleIcon />
              )}
            </button>
          )
        }
      </LayoutContext.Consumer>
    );
  },
);
