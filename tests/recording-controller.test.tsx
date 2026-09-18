import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({get:vi.fn(), message:{success:vi.fn(),warning:vi.fn(),error:vi.fn()}, recordingState:2,t:(key:string)=>key}));
vi.mock('@/lib/api', () => ({api:{getS3Records:state.get}}));
vi.mock('@/lib/std/recording', () => ({RecordState:{Connected:2},useRecordingEnv:()=>({env:null,isConnected:'ready',state:state.recordingState})}));
vi.mock('@/lib/i18n/i18n', () => ({useI18n:()=>({t:state.t})}));
vi.mock('antd', () => ({message:{useMessage:()=>[state.message,null]}}));
vi.mock('@/lib/hooks/use-layout-device', () => ({useLayoutDevice:()=> 'phone'}));
import { useRecordings } from '@/features/recording/hooks/useRecordings';

afterEach(() => {cleanup();vi.clearAllMocks();state.recordingState=2;});
const response = (room:string) => ({ok:true,json:async()=>({success:true,records:[{key:`${room}/video.mp4`,size:100,last_modified:1}]})});

it('auto-searches a URL room once and does not submit again while the user edits the field', async () => {
  state.get.mockResolvedValue(response('alpha'));
  const {result} = renderHook(()=>useRecordings({initialRoom:'alpha',autoSearchRoom:'alpha'}));
  await act(async()=>{});
  act(()=>result.current.setRoomName('beta'));
  expect(state.get).toHaveBeenCalledTimes(1);
  expect(result.current.roomName).toBe('beta');
  expect(result.current.currentRoom).toBe('alpha');
});

it('ignores an older search response and a response after unmount', async () => {
  const pending:((value:any)=>void)[]=[];
  state.get.mockImplementation(()=>new Promise(resolve=>pending.push(resolve)));
  const {result,unmount} = renderHook(()=>useRecordings({}));
  act(()=>{void result.current.searchRoomRecords('old');void result.current.searchRoomRecords('new');});
  await act(async()=>pending[1](response('new')));
  await act(async()=>pending[0](response('old')));
  expect(result.current.currentRoom).toBe('new');
  act(()=>{void result.current.searchRoomRecords('late');});
  unmount();
  const count=state.message.success.mock.calls.length;
  await act(async()=>pending[2](response('late')));
  expect(state.message.success).toHaveBeenCalledTimes(count);
});

it('waits for S3 readiness before consuming the automatic room query',async()=>{
  state.recordingState=0;state.get.mockResolvedValue(response('alpha'));
  const {rerender}=renderHook(()=>useRecordings({autoSearchRoom:'alpha'}));
  expect(state.get).not.toHaveBeenCalled();
  state.recordingState=2;
  await act(async()=>rerender());
  expect(state.get).toHaveBeenCalledWith('alpha');
});
