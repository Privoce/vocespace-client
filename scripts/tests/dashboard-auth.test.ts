import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const fixture = vi.hoisted(() => ({
  error: vi.fn(), success: vi.fn(),
  getConf: vi.fn(), checkHostToken: vi.fn(), allSpaceInfos: vi.fn(), historySpaceInfos: vi.fn(),
  updateAIConf: vi.fn(), apiFetch: vi.fn(), updateSMTPConf: vi.fn(), dashboardData: vi.fn(),
}));
vi.mock('@/lib/api', () => ({ api: fixture }));
vi.mock('@/lib/api/client', () => ({ apiFetch: fixture.apiFetch }));
vi.mock('@/lib/realtime/socket', () => ({ socket: { emit: vi.fn() } }));
vi.mock('@/lib/hooks/use-socket-session', () => ({ useSocketSession: () => {} }));
vi.mock('@/lib/hooks/use-layout-device', () => ({ useLayoutDevice: () => 'pc' }));
vi.mock('@/lib/i18n/i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock('antd', () => ({ message: { useMessage: () => [fixture, null] } }));
import { useDashboard } from '@/app/dashboard/hooks/useDashboard';
import { useVoceSpaceConf } from '@/components/Settings/panels/conf';
import { clearHostCredential, readHostCredential, saveHostCredential } from '@/lib/api/host-credential';

const ai = { enabled: true, apiKey: 'fixture-ai-key', apiUrl: 'https://ai.invalid/v1', model: 'fixture-model', maxTokens: 120000 };
const smtp = { host: 'smtp.invalid', port: 587, secure: false, user: 'fixture-user', from: 'sender@example.invalid', pass: 'fixture-password' };
beforeEach(() => {
  localStorage.clear(); clearHostCredential();
  fixture.getConf.mockImplementation(async (token?: string) => Response.json({
    initialized: true, create_space: 'all', ...(token ? { smtp, ai } : {}),
  }));
  fixture.updateAIConf.mockImplementation(async () => Response.json({ success: true }));
  fixture.dashboardData.mockImplementation(async () => Response.json({ spaces: {}, records: {} }));
  // Return a fresh Response each time, just like fetch.
  fixture.checkHostToken.mockImplementation(async () => Response.json({ success: true }));
  fixture.allSpaceInfos.mockImplementation(async () => Response.json({}));
  fixture.historySpaceInfos.mockImplementation(async () => Response.json({ records: {} }));
  fixture.apiFetch.mockImplementation(async () => Response.json({ webhook: false }));
});
afterEach(() => { clearHostCredential(); vi.useRealTimers(); });

it('refreshes without verification and keeps credentials when a config dialog closes', async () => {
  const { result, unmount } = renderHook(useDashboard);
  await waitFor(() => expect(fixture.dashboardData).toHaveBeenCalled());
  expect(result.current.openConf).toBe(false);
  expect(fixture.allSpaceInfos).not.toHaveBeenCalled();
  expect(fixture.historySpaceInfos).not.toHaveBeenCalled();
  act(() => result.current.setHostToken('fixture-admin'));
  await act(async () => { await result.current.confirmConfHandle(); });
  expect(result.current.isHostManager).toBe(true);
  expect(fixture.allSpaceInfos).not.toHaveBeenCalled();
  expect(fixture.historySpaceInfos).not.toHaveBeenCalled();
  expect(result.current.smtpConf).toEqual(smtp);
  await act(async () => { await result.current.confirmConfHandle(); });
  expect(result.current.openConf).toBe(false);
  expect(readHostCredential()?.token).toBe('fixture-admin');
  await act(async () => { await result.current.fetchAllData(); });
  expect(result.current.openConf).toBe(false);
  unmount();
});

it('reloads authenticated SMTP fields when opening the form with a cached credential', async () => {
  saveHostCredential('fixture-admin');
  const { result, unmount } = renderHook(useDashboard);
  await waitFor(() => expect(fixture.dashboardData).toHaveBeenCalled());
  act(() => result.current.setSelectOption('smtp_conf'));
  await act(async () => { await result.current.handleProceed(); });
  expect(fixture.getConf).toHaveBeenCalledWith('fixture-admin');
  expect(result.current.smtpConf.user).toBe('fixture-user');
  expect(result.current.smtpConf.from).toBe('sender@example.invalid');
  expect(result.current.smtpConfOpen).toBe(true);
  expect(fixture.updateSMTPConf).not.toHaveBeenCalled();
  unmount();
});

it('continues refreshing without a modal after credential expiry', async () => {
  saveHostCredential('fixture-admin');
  const { result, unmount } = renderHook(useDashboard);
  await waitFor(() => expect(fixture.dashboardData).toHaveBeenCalled());
  localStorage.setItem('vocespace_host_token_verified', JSON.stringify({ token: 'fixture-admin', at: Date.now() - 3600_001 }));
  fixture.allSpaceInfos.mockClear(); fixture.historySpaceInfos.mockClear();
  await act(async () => { await result.current.fetchAllData(); });
  expect(fixture.allSpaceInfos).not.toHaveBeenCalled();
  expect(fixture.historySpaceInfos).not.toHaveBeenCalled();
  expect(result.current.openConf).toBe(false);
  expect(result.current.isHostManager).toBe(false);
  unmount();
});

it('reports a refresh failure without opening a configuration dialog', async () => {
  fixture.dashboardData.mockImplementation(async () => Response.json({ code: 'UNAVAILABLE' }, { status: 503 }));
  const { result, unmount } = renderHook(useDashboard);
  await waitFor(() => expect(fixture.error).toHaveBeenCalledWith('dashboard.spaces_fetch_failed'));
  expect(result.current.openConf).toBe(false);
  expect(fixture.checkHostToken).not.toHaveBeenCalled();
  unmount();
});

it.each([
  [403, { code: 'ORIGIN_DENIED' }, 'origin'],
  [500, { code: 'SERVER_ERROR' }, 'request'],
  [200, { success: false }, 'verify'],
])('distinguishes verification failure %s %j', async (status, body, key) => {
  fixture.checkHostToken.mockImplementation(async () => Response.json(body, { status }));
  const { result, unmount } = renderHook(useDashboard);
  await waitFor(() => expect(fixture.dashboardData).toHaveBeenCalled());
  act(() => result.current.setHostToken('fixture-admin'));
  await act(async () => { await result.current.confirmConfHandle(); });
  expect(result.current.isHostManager).toBe(false);
  expect(fixture.error).toHaveBeenCalledWith(`dashboard.conf.error.${key}`);
  unmount();
});

it('does not let a late anonymous config response erase authenticated SMTP values', async () => {
  let finishPublic!: (response: Response) => void;
  fixture.getConf.mockImplementation((token?: string) => token
    ? Promise.resolve(Response.json({ initialized: true, smtp }))
    : new Promise<Response>((resolve) => { finishPublic = resolve; }));
  const { result, unmount } = renderHook(useVoceSpaceConf);
  let pending: Promise<unknown>;
  act(() => { pending = result.current.getConf(); });
  await act(async () => { await result.current.getConf('fixture-admin'); });
  await act(async () => { finishPublic(Response.json({ initialized: true })); await pending; });
  expect(result.current.conf?.smtp).toEqual(smtp);
  unmount();
});

it('retains the verified credential in memory if browser storage refuses writes', () => {
  const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('storage blocked'); });
  try {
    saveHostCredential('fixture-admin');
    expect(readHostCredential()?.token).toBe('fixture-admin');
    clearHostCredential();
    expect(readHostCredential()).toBeNull();
  } finally { write.mockRestore(); }
});

it('keeps a completed verification when the initial public config arrives late', async () => {
  let finishPublic!: (response: Response) => void;
  fixture.getConf.mockImplementation((token?: string) => token
    ? Promise.resolve(Response.json({ initialized: true, smtp }))
    : new Promise<Response>((resolve) => { finishPublic = resolve; }));
  const { result, unmount } = renderHook(useDashboard);
  act(() => result.current.setHostToken('fixture-admin'));
  await act(async () => { await result.current.confirmConfHandle(); });
  await act(async () => { finishPublic(Response.json({ initialized: true })); });
  expect(result.current.isHostManager).toBe(true);
  expect(readHostCredential()?.token).toBe('fixture-admin');
  expect(result.current.smtpConf).toEqual(smtp);
  unmount();
});

it('opens AI configuration behind host verification and saves all five fields with the credential', async () => {
  const { result, unmount } = renderHook(useDashboard);
  await waitFor(() => expect(fixture.dashboardData).toHaveBeenCalled());
  act(() => result.current.setSelectOption('ai_conf'));
  await act(async () => { await result.current.handleProceed(); });
  expect(result.current.aiConfOpen).toBe(true);
  expect(result.current.isHostManager).toBe(false);
  expect(fixture.updateAIConf).not.toHaveBeenCalled();
  act(() => result.current.setHostToken('fixture-admin'));
  await act(async () => { await result.current.confirmAIConfHandle(); });
  expect(result.current.isHostManager).toBe(true);
  expect(result.current.aiConf).toEqual(ai);
  expect(fixture.updateAIConf).not.toHaveBeenCalled();
  const edited = { ...ai, model: 'next-model', maxTokens: 64000, enabled: false };
  act(() => result.current.setAIConf(edited));
  await act(async () => { await result.current.confirmAIConfHandle(); });
  expect(fixture.updateAIConf).toHaveBeenCalledWith(edited, 'fixture-admin');
  expect(fixture.getConf).toHaveBeenLastCalledWith('fixture-admin');
  expect(result.current.aiConfOpen).toBe(false);
  unmount();
});
