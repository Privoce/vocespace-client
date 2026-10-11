// @vitest-environment node
import { expect, it, vi } from 'vitest';
vi.mock('../services/api/lib/server/config',()=>({getConfig:()=>({hostToken:'test-host'})}));
vi.mock('../services/api/lib/server/host-authorization',()=>({verifyHostToken:()=>false}));
vi.mock('../services/api/lib/server/sessions',()=>({sessionToken:()=> 'test',sessions:{read:async()=>({id:'session',identities:{room:'owner'}})}}));
vi.mock('../services/api/lib/server/space-repository',()=>({spaceRepository:{get:async()=>({ownerId:'owner',managers:[],children:[],participants:{owner:{},member:{socketId:'member-socket',auth:{identity:'guest',platform:'other'}}}})}}));
import { authorizeRequest } from '@/services/api/access';
import { ApiRequest } from '@/services/api/http';
const request=(query:string,body:unknown)=>new ApiRequest(`https://web.test/api/${query}`,{method:'POST',headers:{'Content-Type':'application/json',origin:'https://web.test'},body:JSON.stringify(body)});
it('accepts the existing empty-room representation for Space-level TilePlayers',async()=>{
  const input=request('upload?tilePlayer=true',{spaceName:'room',room:'',ty:'ls'});
  expect((await authorizeRequest(input,'/api/upload')).method).toBe('POST');
});
it('allows manager settings changes without rebinding another member socket',async()=>{
  const input=request('space?space=true&participant=update',{spaceName:'room',participantId:'member',settings:{socketId:'forged-socket',auth:{identity:'owner'}}});
  const output=await authorizeRequest(input,'/api/space');
  expect((await output.json()).settings).toEqual({socketId:'member-socket',auth:{identity:'guest',platform:'other'}});
});
it('does not allow even a manager to initialize a different session identity',async()=>{
  const input=request('space?space=true&participant=update',{spaceName:'room',participantId:'member',init:true,settings:{}});
  await expect(authorizeRequest(input,'/api/space')).rejects.toMatchObject({code:'IDENTITY_MISMATCH'});
});
