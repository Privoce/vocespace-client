import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
const calls=vi.hoisted(()=>({history:vi.fn(),emit:vi.fn(),setChat:vi.fn()}));
vi.mock('@/lib/api',()=>({api:{getChatMsg:calls.history}}));
vi.mock('@/lib/realtime/socket',()=>({socket:{id:'socket',emit:calls.emit}}));
vi.mock('@/lib/store',()=>({useRoomStore:{getState:()=>({setChatMsg:calls.setChat})},useLicenseStore:{setState:vi.fn()}}));
import { useConferenceInitialization } from '@/features/conference/hooks/useConferenceInitialization';

afterEach(()=>{cleanup();vi.clearAllMocks();});
it('initializes once across layout rerenders and ignores results after leaving',async()=>{
  let historyDone!:(value:any)=>void,platformDone!:(value:any)=>void;
  calls.history.mockImplementation(()=>new Promise(resolve=>historyDone=resolve));
  const context:any={space:{name:'space',state:'connected',localParticipant:{identity:'self',name:'Me'}},init:true,
    uLicenseState:{space:{isAnalysis:true}},uState:{appDatas:{}},config:{},controlsRef:{current:null},
    fetchPlatformData:vi.fn(()=>new Promise(resolve=>platformDone=resolve)),fromVocespace:false,
    updateSettings:vi.fn(),roomEnter:vi.fn(),setInit:vi.fn(),setNoteStateForAICutService:vi.fn(),messageApi:{error:vi.fn()},t:(key:string)=>key};
  const view=renderHook(({model})=>useConferenceInitialization(model),{initialProps:{model:context}});
  await act(async()=>{});
  view.rerender({model:{...context,device:'pc'}});
  expect(calls.history).toHaveBeenCalledOnce();expect(context.fetchPlatformData).toHaveBeenCalledOnce();
  view.unmount();
  await act(async()=>{historyDone({ok:true,json:async()=>({msgs:[]})});platformDone([]);});
  expect(context.updateSettings).not.toHaveBeenCalled();expect(context.setInit).not.toHaveBeenCalled();
  expect(calls.setChat).not.toHaveBeenCalled();expect(calls.emit).not.toHaveBeenCalled();
});
