import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
const mock=vi.hoisted(()=>({upload:vi.fn(),emit:vi.fn(),t:(key:string)=>key}));
vi.mock('@/lib/api',()=>({api:{uploadSpaceApp:mock.upload}}));
vi.mock('@/lib/realtime/socket',()=>({socket:{emit:mock.emit}}));
vi.mock('@/lib/hooks/use-layout-device',()=>({useLayoutDevice:()=> 'phone'}));
vi.mock('@/lib/hooks/platform',()=>({getParticipantPlatformInfo:()=>({isAuth:false})}));
vi.mock('@/lib/i18n/i18n',()=>({useI18n:()=>({t:mock.t})}));
vi.mock('antd',()=>({theme:{useToken:()=>({token:{}})}}));
import { useWidgetApps } from '@/features/widget-apps/hooks/useWidgetApps';

afterEach(()=>{cleanup();vi.clearAllMocks();});
it('preserves read-only remote widgets and saves remote changes only with write access',async()=>{
  mock.upload.mockResolvedValue({ok:true});
  const messageApi={success:vi.fn(),error:vi.fn()};
  const props=(auth:string):any=>({messageApi,apps:['todo'],space:'space',isSelf:false,participantId:'remote',spaceInfo:{participants:{remote:{appAuth:auth,appDatas:{todo:[]}}}}});
  const {result,rerender}=renderHook(({auth})=>useWidgetApps(props(auth),null),{initialProps:{auth:'read'}});
  await act(async()=>{await result.current.widgetData.todo?.setData({items:[],date:1});});
  expect(mock.upload).not.toHaveBeenCalled();
  rerender({auth:'write'});
  await act(async()=>{await result.current.widgetData.todo?.setData({items:[],date:1});});
  expect(mock.upload).toHaveBeenCalledWith('space','remote','todo',{items:[],date:1},false);
  expect(mock.emit).toHaveBeenCalledWith('update_user_status',{space:'space'});
});
