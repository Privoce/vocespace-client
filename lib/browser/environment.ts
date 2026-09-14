
export function is_web(): boolean {
  return typeof window !== 'undefined';
}


export function isWeChatBrowser(): boolean {
  if (!is_web()) return false;

  return navigator.userAgent.includes('MicroMessenger');
}


/**
 * 是否是iOS设备
 */
export function isIos(): boolean {
  if (!is_web()) return false;

  const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;

  // iOS detection from: http://stackoverflow.com/a/9039885/177710
  return /iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream;
}


/**
 * 是否为移动设备
 */
export function isMobile(): boolean {
  if (!is_web()) return false;

  // 检查用户代理字符串
  const userAgent = navigator.userAgent.toLowerCase();
  const mobileKeywords = [
    'mobile',
    'android',
    'iphone',
    'ipad',
    'ipod',
    'blackberry',
    'windows phone',
    'opera mini',
  ];

  const isMobileUserAgent = mobileKeywords.some((keyword) => userAgent.includes(keyword));

  // 检查触摸屏支持
  const hasTouchScreen =
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    (navigator as any).msMaxTouchPoints > 0;

  // 检查屏幕尺寸 (小于768px认为是移动设备)
  const isSmallScreen = window.innerWidth < 768;

  return isMobileUserAgent || (hasTouchScreen && isSmallScreen);
}


export function isWeChatMobile(): boolean {
  return isWeChatBrowser() && isMobile();
}


export function supportsMediaDeviceChangeEvent(): boolean {
  if (!is_web() || !navigator.mediaDevices) return false;
  if (isWeChatMobile()) return false;

  return (
    typeof navigator.mediaDevices.addEventListener === 'function' &&
    typeof navigator.mediaDevices.removeEventListener === 'function'
  );
}


/**
 * 是否是平板设备
 */
export function isTablet(): boolean {
  if (!is_web()) return false;

  const userAgent = navigator.userAgent.toLowerCase();
  const isTabletUserAgent =
    userAgent.includes('ipad') || (userAgent.includes('android') && !userAgent.includes('mobile'));

  const hasTouchScreen = 'ontouchstart' in window;
  const isTabletScreen = window.innerWidth >= 768 && window.innerWidth <= 1024;

  return isTabletUserAgent || (hasTouchScreen && isTabletScreen);
}
