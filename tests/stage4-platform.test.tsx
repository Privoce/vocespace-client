import { act, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { MessageInstance } from 'antd/es/message/interface';
vi.mock('@/lib/i18n/i18n', () => ({ useI18n: () => ({ t: (key:string) => key }) }));
vi.mock('@/lib/realtime/socket', () => ({ socket: { connected: false } }));
import { usePlatformUser } from '@/lib/hooks/platform';
const messageApi={} as MessageInstance;
afterEach(()=>{vi.unstubAllGlobals();localStorage.clear();});
it('exchanges login once, removes the code and obtains RTC credentials through the SDK',async()=>{
  window.history.replaceState({},'', '/room?code=test-code');
  const platform={id:'alice',username:'Alice',space:'room',identity:'participant',auth:'space',iat:1,exp:9999999999};
  const transport=vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
    if(String(input).includes('connection-details'))return Response.json({roomName:'room',participantName:'Alice',serverUrl:'wss://rtc.invalid',participantToken:'test-rtc-token'});
    return Response.json({platform});
  });
  vi.stubGlobal('fetch',transport);
  const {result}=renderHook(()=>usePlatformUser({searchParams:{code:'test-code'},messageApi}));
  await act(async()=>{await Promise.all([result.current.checkOrUpdateStore(),result.current.checkOrUpdateStore()]);});
  expect(transport.mock.calls.filter(([,init])=>init?.method==='POST')).toHaveLength(1);
  expect(result.current.platformUser?.id).toBe('alice');
  expect(result.current.details?.participantToken).toBe('test-rtc-token');
  expect(window.location.search).toBe('');
});
it('does not treat old URL identity/RTC data or localStorage as authentication',async()=>{
  window.history.replaceState({},'', '/room');
  localStorage.setItem('vocespace_platform_user',JSON.stringify({id:'forged',exp:9999999999}));
  vi.stubGlobal('fetch',vi.fn(async()=>Response.json({platform:null})));
  const {result}=renderHook(()=>usePlatformUser({searchParams:{auth:'space',data:'{}',details:'{}'},messageApi}));
  await act(async()=>{await result.current.checkOrUpdateStore();});
  expect(result.current.isValid).toBe(false);
  expect(result.current.details).toBeUndefined();
  expect(localStorage.getItem('vocespace_platform_user')).toBeNull();
});
