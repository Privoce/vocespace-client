/**
 * ## 判断当前窗口是否需要调整
 * @param width
 */
export const isAdjustWindowWhen = (width: number = 720, view?: number) => {
  if (typeof window === 'undefined') {
    return view === undefined ? false : view <= width;
  }
  return (view ?? window.innerWidth) <= width;
};

/**
 * ## 窗口调整配置
 * ### example:
 * ```
 * const showTextOrHide = useMemo(() => {
 *   // 判断窗口的宽度是否大于720px, 如果小于则需要隐藏文字
 *   // 如果需要处理，否则直接可以 return !WindowAdjusts.w720;
 *   return WindowAdjusts.w720 ? false : showText;
 * }, [window.innerWidth]);
 * ```
 */
export const WindowAdjusts = {
  /** <= 540px? true: false */
  w540: isAdjustWindowWhen(540),
  /** <= 720px? true: false */
  w720: isAdjustWindowWhen(720),
  /** <= 960px? true: false */
  w960: isAdjustWindowWhen(960),
  /** <= 1080px? true: false */
  w1080: isAdjustWindowWhen(1080),
  /** <= 1440px? true: false */
  w1440: isAdjustWindowWhen(1440),
  /** <= 1720px? true: false */
  w1720: isAdjustWindowWhen(1720),
  /** <= 1920px? true: false */
  w1920: isAdjustWindowWhen(1920),
};

export const ViewAdjusts = (view: number) => {
  return {
    w540: isAdjustWindowWhen(540, view),
    w720: isAdjustWindowWhen(720, view),
    w960: isAdjustWindowWhen(960, view),
    w1080: isAdjustWindowWhen(1080, view),
    w1440: isAdjustWindowWhen(1440, view),
    w1720: isAdjustWindowWhen(1720, view),
    w1920: isAdjustWindowWhen(1920, view),
  };
};

export const DEFAULT_WINDOW_ADJUST_WIDTH = 960;