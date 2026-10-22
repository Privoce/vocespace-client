import { beforeEach, expect, it, vi } from 'vitest';
const native = vi.hoisted(() => ({ available: vi.fn(), pick: vi.fn() }));
vi.mock('expo', () => ({ requireOptionalNativeModule: native.available }));
vi.mock('expo-document-picker', () => ({ getDocumentAsync: native.pick }));
import { pickFeedbackDocument } from '../src/feedback/document-picker';
beforeEach(() => vi.resetAllMocks());
it('keeps imports safe and reports a recoverable error on old native builds', async () => {
  native.available.mockReturnValue(null);
  await expect(pickFeedbackDocument()).rejects.toThrow('DOCUMENT_PICKER_UNAVAILABLE');
  expect(native.pick).not.toHaveBeenCalled();
});
it('opens the installed native picker and returns cancellation without an upload', async () => {
  native.available.mockReturnValue({});
  native.pick.mockResolvedValue({ canceled: true, assets: null });
  await expect(pickFeedbackDocument()).resolves.toEqual({ canceled: true, assets: null });
  expect(native.pick).toHaveBeenCalledWith({
    type: '*/*',
    copyToCacheDirectory: true,
    multiple: false,
  });
});
