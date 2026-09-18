import React from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

const mounts=vi.hoisted(()=>({counts:{} as Record<string,number>,unmounts:{} as Record<string,number>}));
function tracked(name:string) {
  return React.forwardRef(function Tracked(_props:any,_ref:any){
    React.useEffect(()=>{mounts.counts[name]=(mounts.counts[name]||0)+1;return()=>{mounts.unmounts[name]=(mounts.unmounts[name]||0)+1;};},[]);
    return <div data-testid={name}/>;
  });
}
vi.mock('@/app/pages/apps/flot',()=>({FlotButton:()=>null,FlotLayout:tracked('widgets')}));
vi.mock('@/app/pages/chat/chat',()=>({ChatPanel:tracked('chat')}));
vi.mock('@/app/pages/controls/bar',()=>({Controls:tracked('controls')}));
vi.mock('@/app/pages/controls/channel',()=>({Channel:tracked('channel')}));
vi.mock('@/app/pages/controls/widgets/license_alert',()=>({LicenseAlert:()=>null}));
vi.mock('@/lib/std',()=>({src:(path:string)=>path}));
vi.mock('@livekit/components-react',()=>({ConnectionStateToast:()=>null,LayoutContextProvider:({children}:any)=>children,RoomAudioRenderer:tracked('audio')}));
vi.mock('@/features/conference/views/pc',()=>({VideoContainerPC:()=> <div>pc</div>}));
vi.mock('@/features/conference/views/phone',()=>({VideoContainerPhone:()=> <div>phone</div>,PhoneRoomHeader:()=>null}));
import { ConferenceSurface } from '@/features/conference/views/surface';

afterEach(cleanup);
it('keeps room audio, chat, controls, widgets and channel mounted while only the media layout switches',()=>{
  mounts.counts={};mounts.unmounts={};
  const model:any={device:'phone',space:{name:'space',localParticipant:{identity:'self'}},settings:{participants:{self:{}}},
    props:{},hasRoomLicense:true,chatOpen:true,showSideChannel:true,showFlot:true,showAI:true,
    FlotLayoutRef:{current:null},controlsRef:{current:null},channelRef:{current:null},waveAudioRef:{current:null},promptSoundRef:{current:null},aiCutServiceRef:{current:{}},widgetState:{},mainViewWidth:'100vw'};
  const view=render(<ConferenceSurface model={model}/>);
  view.rerender(<ConferenceSurface model={{...model,device:'pc'}}/>);
  view.rerender(<ConferenceSurface model={{...model,device:'phone',showFlot:false}}/>);
  expect(mounts.counts).toEqual({widgets:1,channel:1,chat:1,controls:1,audio:1});
  expect(mounts.unmounts).toEqual({});
});
