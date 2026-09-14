// @vitest-environment node
import { expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';

it('imports scoped public entries without browser globals or server configuration', async () => {
  vi.stubGlobal('window', undefined);
  vi.stubGlobal('document', undefined);
  vi.stubGlobal('navigator', undefined);
  const [utils, browser, http, hooks, components, livekit, viewport] = await Promise.all([
    import('@/lib/utils'), import('@/lib/browser'), import('@/lib/http'), import('@/lib/hooks'),
    import('@/lib/components'), import('@/lib/livekit'), import('@/lib/browser/window'),
  ]);
  expect(utils.decodePassphrase(utils.encodePassphrase('中文 /?#'))).toBe('中文 /?#');
  expect(browser.isMobile()).toBe(false);
  expect(browser.supportsMediaDeviceChangeEvent()).toBe(false);
  expect(http.createApiUrl('/base/api/conf', {}, 'https://example.test').href).toBe('https://example.test/base/api/conf');
  expect(viewport.ViewAdjusts(600).w720).toBe(true);
  expect(livekit.isVideoCodec('vp8')).toBe(true);
  expect(livekit.isVideoCodec('not-a-codec')).toBe(false);
  function HookConsumer() {
    return <span>{hooks.useDebounce('ready', 100)}</span>;
  }
  expect(renderToString(<HookConsumer />)).toContain('ready');
  expect(renderToString(<components.DeviceList items={[]} activeValue="" onSelect={() => {}} emptyLabel="暂无设备" />)).toContain('暂无设备');
});

it('keeps legacy generic entry points equivalent to their new implementations', async () => {
  const [legacyIds, ids, legacyHooks, hooks, legacyWindow, viewport, legacyCodec, codec, legacyPage, page] = await Promise.all([
    import('@/lib/client_utils'), import('@/lib/utils/room-id'),
    import('@/lib/std/debounce'), import('@/lib/hooks/timing'),
    import('@/lib/std/window'), import('@/lib/browser/window'),
    import('@/lib/types'), import('@/lib/livekit/connection'),
    import('@/app/pages/controls/widgets/pagination'), import('@/lib/components/pagination'),
  ]);
  expect(legacyIds.generateRoomId).toBe(ids.generateRoomId);
  expect(legacyHooks.useDebounce).toBe(hooks.useDebounce);
  expect(legacyWindow.ViewAdjusts).toBe(viewport.ViewAdjusts);
  expect(legacyCodec.isVideoCodec).toBe(codec.isVideoCodec);
  expect(legacyPage.PaginationCtl).toBe(page.PaginationCtl);
  const [legacyPerformance, performance] = await Promise.all([import('@/lib/std/level'), import('@/lib/browser/performance')]);
  expect(legacyPerformance.PerformanceDetector).toBe(performance.PerformanceDetector);
});
