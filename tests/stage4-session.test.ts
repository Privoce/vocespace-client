// @vitest-environment node
import { expect, it } from 'vitest';
import { createSessionService, spaceAccess } from '@vocespace/server-core';
import { parsePageLimit } from '@vocespace/contracts';

it('expires sessions, invalidates logout and consumes a login code only once', async () => {
  const values=new Map<string,string>();let now=0;let n=0;
  const service=createSessionService({read:async(k)=>values.get(k)||null,write:async(k,v)=>{values.set(k,v);},consume:async(k)=>{const v=values.get(k);values.delete(k);return v||null;},remove:async(k)=>{values.delete(k);}},()=>String(++n).padStart(64,'0'),()=>now);
  const session=await service.create();
  expect((await service.read(session.token))?.id).toBe(session.principal.id);
  expect(await service.read('../../private')).toBeNull();
  const code=await service.code({id:'alice'});
  expect(await Promise.all([service.exchange(code),service.exchange(code)])).toEqual([{id:'alice'},null]);
  now=8*24*3600*1000;
  expect(await service.read(session.token)).toBeNull();
  const next=await service.create();await service.revoke(next.token);
  expect(await service.read(next.token)).toBeNull();
});
it('derives access from persisted ownership, independently of participant auth claims',()=>{
  const space={ownerId:'alice',managers:['bob'],participants:{carol:{auth:{identity:'owner'}}}};
  expect(spaceAccess(space,'carol')).toEqual({owner:false,manager:false,member:true});
  expect(spaceAccess(space,'alice').owner).toBe(true);
  expect(spaceAccess(space,'bob').manager).toBe(true);
});
it('bounds page limits instead of accepting unbounded backend reads',()=>{
  expect(parsePageLimit(undefined)).toBe(50);
  expect(parsePageLimit('100')).toBe(100);
  for(const value of [0,-1,101,'bad',1.5])expect(()=>parsePageLimit(value)).toThrow();
});
