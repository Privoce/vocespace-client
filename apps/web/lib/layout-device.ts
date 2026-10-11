/** Layout only. Browser/media capability detection remains in lib/std. */
export const PHONE_MEDIA_QUERY = '(max-width: 767px)';
export type LayoutDevice = 'phone' | 'pc';

export function getLayoutDevice(): LayoutDevice {
  return typeof window !== 'undefined' && window.matchMedia(PHONE_MEDIA_QUERY).matches
    ? 'phone'
    : 'pc';
}

export function subscribeLayoutDevice(onChange: () => void) {
  const query = window.matchMedia(PHONE_MEDIA_QUERY);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}
