import { beforeAll, afterEach, describe, expect, it, vi } from 'vitest';
import { type ComponentProps } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { createTranslator } from '@vocespace/i18n';
const state = vi.hoisted(() => ({
  phone: false,
  owner: false,
  locale: 'zh' as 'zh' | 'en' | 'ru',
}));
vi.mock('../apps/web/lib/hooks/use-layout-device', () => ({
  useLayoutDevice: () => (state.phone ? 'phone' : 'pc'),
}));
vi.mock('../apps/web/lib/i18n/i18n', () => ({
  useI18n: () => ({
    t: createTranslator(state.locale),
    locale: state.locale,
    changeLocale: () => {},
  }),
}));
vi.mock('../apps/web/components/Settings/panels/PhoneDeviceSwitch', () => ({
  PhoneDeviceSwitch: ({ device }: { device: string }) => (
    <button role="switch" aria-label={device} disabled />
  ),
}));
vi.mock('../apps/web/lib/api/index', () => ({ api: {} }));
vi.mock('../apps/web/lib/realtime/socket', () => ({ socket: { emit: vi.fn() } }));
vi.mock('../apps/web/lib/std/index', () => ({
  isSpaceManager: () => ({ ty: state.owner ? 'Owner' : 'Guest' }),
  src: (s: string) => s,
}));
vi.mock('../apps/web/lib/store/index', () => ({
  useLicenseStore: () => ({ room: null }),
  useRoomStore: () => ({ virtualMask: false }),
}));
vi.mock('../apps/web/components/Settings/hooks/useGeneralSettings', () => ({
  useGeneralSettings: () => ({
    t: createTranslator(state.locale),
    isOwner: state.owner,
    persistence: true,
    allowGuest: 'allow',
    status: 'hello',
    setStatus: () => {},
    savePersistence: () => {},
    saveAllowGuest: () => {},
    saveStatus: () => {},
  }),
}));
vi.mock('../apps/web/components/Select/audio', () => ({
  AudioSelect: ({ className }: { className: string }) => (
    <input aria-label="device draft" className={className} defaultValue="microphone" />
  ),
}));
vi.mock('../apps/web/components/Select/video', () => ({
  VideoSelect: ({ className }: { className: string }) => (
    <select className={className}>
      <option>camera</option>
    </select>
  ),
}));
vi.mock('../apps/web/components/Select/lang', () => ({
  LangSelect: () => (
    <select>
      <option>language</option>
    </select>
  ),
}));
vi.mock('../apps/web/components/Participant/avo', () => ({
  ParticipantAvoPlaceholder: () => <canvas />,
  AVO_STYLES: ['blob', 'ring', 'wave'],
  AVO_PALETTE: [193, 214],
  normalizeAvoParams: (p: object | undefined, name: string) => ({
    name,
    style: 'blob',
    variant: 0,
    hue: 193,
    energy: 0.6,
    isUsed: true,
    enabled: true,
    ...p,
  }),
  randomizeAvo: () => ({}),
}));
vi.mock('../apps/web/components/VirtualRole/live2d', () => ({ default: () => <canvas /> }));
import { App as AntApp } from 'antd';
import { GeneralSettings } from '../apps/web/components/Settings/panels/general';
import { ProfileSettings } from '../apps/web/components/Settings/panels/profile';
import { AudioSettings } from '../apps/web/components/Settings/panels/audio';
import { VideoSettings } from '../apps/web/components/Settings/panels/video';
import { AuthSettings } from '../apps/web/components/Settings/panels/auth';
import { AppSettings } from '../apps/web/components/Settings/panels/app';
import { AISettings } from '../apps/web/components/Settings/panels/ai';
import { LicenseControl } from '../apps/web/components/Settings/panels/license';
import { RecordingTablePhone } from '../apps/web/components/Recording/table/phone';
import { RecordingTablePhone as OriginalRecordingPhone } from './fixtures/recording-phone-original';
import { AvoConfigPanel } from '../apps/web/components/Participant/avo_conf';
import { AvoConfigPanel as OriginalAvo } from './fixtures/avo-phone-original';
import { AboutUs } from '../apps/web/components/Settings/panels/about_us';
import { settingsPermissionKeys, settingsRoles } from '@vocespace/contracts';
const noop = () => {};
const participant = { identity: 'member' };
const auth = Object.fromEntries(
  settingsRoles.map((role) => [
    role,
    Object.fromEntries(settingsPermissionKeys.map((key) => [key, true])),
  ]),
);
const spaceInfo = {
  ownerId: 'member',
  managers: [],
  apps: ['timer'],
  auth,
  participants: {
    member: { ai: { cut: { extraction: 'medium', spent: true, todo: true, blur: false } } },
  },
  ai: { cut: { enabled: false, freq: 3 } },
};
const base = {
  space: { name: 'space', localParticipant: participant },
  spaceName: 'space',
  localParticipant: participant,
  spaceInfo,
  messageApi: { success: noop, error: noop, warning: noop },
  username: 'Ada',
  setUsername: noop,
  onSave: noop,
  appendStatus: false,
  openPromptSound: true,
  setOpenPromptSound: noop,
  volume: 75,
  setVolume: noop,
  noiseSuppression: true,
  setNoiseSuppression: noop,
  echoCancellation: false,
  setEchoCancellation: noop,
  autoGainControl: true,
  setAutoGainControl: noop,
  videoBlur: 0.1,
  screenBlur: 0.2,
  setVideoBlur: noop,
  setScreenBlur: noop,
  openShareAudio: false,
  setOpenShareAudio: noop,
  virtualSettingsRef: { current: null },
  virtual: {
    enabled: false,
    setEnabled: noop,
    modelRole: 'None',
    setModelRole: noop,
    modelBg: 'v_bg1.png',
    setModelBg: noop,
    compare: false,
    setCompare: noop,
    close: false,
    blur: 0,
    space: 'space',
    localParticipant: participant,
    messageApi: { success: noop, error: noop },
  },
  updateSettings: async () => true,
};
const normalize = (html: string) => html.replace(/_R_[\w]+_/g, '_ID_');
const cases = [
  ['general', <GeneralSettings {...(base as unknown as ComponentProps<typeof GeneralSettings>)} />],
  ['profile + AVO', <ProfileSettings {...base} />],
  ['audio', <AudioSettings {...(base as unknown as ComponentProps<typeof AudioSettings>)} />],
  [
    'video + virtual',
    <VideoSettings {...(base as unknown as ComponentProps<typeof VideoSettings>)} />,
  ],
  ['permissions', <AuthSettings {...(base as unknown as ComponentProps<typeof AuthSettings>)} />],
  ['apps', <AppSettings {...(base as unknown as ComponentProps<typeof AppSettings>)} />],
  ['AI + analysis', <AISettings {...(base as unknown as ComponentProps<typeof AISettings>)} />],
  [
    'license',
    <LicenseControl
      space="space"
      messageApi={base.messageApi as unknown as ComponentProps<typeof LicenseControl>['messageApi']}
    />,
  ],
  ['about', <AboutUs />],
] as const;
beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: () => ({
      matches: false,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
    }),
  });
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});
afterEach(cleanup);
describe('Extracted Phone internals preserve approved DOM and controls', () => {
  it.each(cases.filter(([name]) => name !== 'general' && name !== 'permissions'))(
    '%s preserves the original view in all languages and owner/guest modes',
    (name, element) => {
      for (const locale of ['zh', 'en', 'ru'] as const)
        for (const owner of [false, true]) {
          state.locale = locale;
          state.owner = owner;
          state.phone = false;
          const old = normalize(renderToStaticMarkup(<AntApp>{element}</AntApp>));
          state.phone = true;
          const extracted = normalize(renderToStaticMarkup(<AntApp>{element}</AntApp>));
          // AVO's original Phone uses 12px labels whereas PC has the default typography size.
          const normalizeFont = (s: string) =>
            name === 'profile + AVO'
              ? s.replace(/font-size:12px/g, '').replace(/ style=""/g, '')
              : s;
          expect(normalizeFont(extracted)).toBe(normalizeFont(old));
        }
    },
  );
  it('redesigns only Phone general/permissions and keeps owner-only policy editing gated', () => {
    const general = cases.find(([name]) => name === 'general')![1];
    for (const locale of ['zh', 'en', 'ru'] as const)
      for (const owner of [false, true]) {
        state.locale = locale;
        state.owner = owner;
        const t = createTranslator(locale);
        state.phone = false;
        const pc = renderToStaticMarkup(<AntApp>{general}</AntApp>);
        expect(pc).not.toContain(t('phone_meeting.general_title'));
        expect(pc).toContain('ant-radio-button-wrapper');
        state.phone = true;
        const phone = renderToStaticMarkup(<AntApp>{general}</AntApp>);
        expect(phone).toContain(t('phone_meeting.general_title'));
        expect(phone).toContain('role="switch"');
        expect(phone.includes(t('settings.general.conf.allow_guest.title'))).toBe(owner);
        const permissions = renderToStaticMarkup(
          <AntApp>{cases.find(([name]) => name === 'permissions')![1]}</AntApp>,
        );
        expect(permissions).toContain(t('phone_meeting.permissions_title'));
        expect(permissions).toContain('aria-label="microphone"');
        expect(permissions).toContain('aria-label="camera"');
        expect(permissions).toContain('RBAC');
        expect(permissions.includes(t('auth.save'))).toBe(owner);
      }
  });
  it('keeps the same device input and its draft across Phone / PC switching', () => {
    state.phone = false;
    const props = base as unknown as ComponentProps<typeof AudioSettings>;
    const view = render(<AudioSettings {...props} localParticipant={undefined} />);
    const input = screen.getByRole('textbox', { name: 'device draft' });
    fireEvent.change(input, { target: { value: 'draft-device' } });
    state.phone = true;
    view.rerender(<AudioSettings {...props} localParticipant={undefined} />);
    expect(screen.getByRole('textbox', { name: 'device draft' })).toBe(input);
    expect((input as HTMLInputElement).value).toBe('draft-device');
  });
});

it('preserves the exact original AVO Phone preview, controls and preset list', () => {
  state.phone = true;
  for (const locale of ['zh', 'en', 'ru'] as const) {
    state.locale = locale;
    const props = { direction: 'vertical' as const, name: 'Ada', onSave: noop };
    expect(
      normalize(
        renderToStaticMarkup(
          <AntApp>
            <AvoConfigPanel {...props} />
          </AntApp>,
        ),
      ),
    ).toBe(
      normalize(
        renderToStaticMarkup(
          <AntApp>
            <OriginalAvo {...props} />
          </AntApp>,
        ),
      ),
    );
  }
});
it('preserves original recording cards, empty state, sorting and pagination markup', () => {
  for (const count of [0, 2, 12]) {
    const model = {
      t: createTranslator('zh'),
      sortedRecords: Array.from({ length: count }, (_, i) => ({
        id: String(i),
        key: `room/record-${i}.mp4`,
        size: 1024,
        last_modified: 1700000000,
      })),
      phonePage: 1,
      setPhonePage: noop,
      phoneSort: 'newest',
      setPhoneSort: noop,
      currentRoom: 'room',
      formatFileSize: () => '1 KB',
      loading: false,
      handleDownload: noop,
      handleDelete: noop,
      copyDownloadLink: noop,
    } as unknown as ComponentProps<typeof RecordingTablePhone>['model'];
    expect(normalize(renderToStaticMarkup(<RecordingTablePhone model={model} />))).toBe(
      normalize(renderToStaticMarkup(<OriginalRecordingPhone model={model} />)),
    );
  }
});
