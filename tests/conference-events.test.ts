import { expect, it, vi } from 'vitest';
import { createSocketScope } from '@/lib/realtime/socket-scope';
import { chatMessageKey, mergeChatMessages } from '@/features/chat/message-key';
import type { ChatMsgItem } from '@/lib/std/chat';

const store = vi.hoisted(() => ({chat:{msgs:[] as any[],unhandled:0},setChatMsg(update:any){this.chat=update(this.chat);}}));
vi.mock('@/lib/store', () => ({useRoomStore:{getState:()=>store}}));
import { registerChatEvents } from '@/features/conference/events/registerChatEvents';

const msg=(timestamp:number,roomName='space'):ChatMsgItem=>({sender:{id:'other',name:'Guest'},roomName,timestamp,type:'text',message:'Hello',file:null});
it('cleans up only listeners owned by the unmounting surface', () => {
  const callbacks=new Map<string,Set<Function>>();
  const socket={on:vi.fn((event:string,fn:Function)=>{if(!callbacks.has(event))callbacks.set(event,new Set());callbacks.get(event)!.add(fn);}),off:vi.fn((event:string,fn:Function)=>callbacks.get(event)?.delete(fn))};
  const one=createSocketScope(socket as any),two=createSocketScope(socket as any);
  const remaining=vi.fn();one.on('chat',vi.fn());two.on('chat',remaining);
  one.dispose();one.dispose();
  callbacks.get('chat')?.forEach(fn=>fn());
  expect(remaining).toHaveBeenCalledOnce();
  expect(socket.off).toHaveBeenCalledTimes(1);
  two.dispose();expect(callbacks.get('chat')?.size).toBe(0);
});
it('merges reconnect history in chronological order with stable legacy message keys',()=>{
  const a=msg(1),b=msg(2);
  expect(chatMessageKey({...a})).toBe(chatMessageKey(a));
  expect(mergeChatMessages([b],[a,b])).toEqual([a,b]);
});
it('filters other rooms and counts each unread message once, including files without IDs',()=>{
  store.chat={msgs:[],unhandled:0};
  const callbacks=new Map<string,Function>();
  const controlsRef={current:{isChatOpen:false}};
  registerChatEvents({space:{name:'space',localParticipant:{identity:'self'}},controlsRef} as any,{on:(name:string,fn:Function)=>callbacks.set(name,fn),dispose:()=>{}} as any);
  const receive=callbacks.get('chat_msg_response')!;
  receive(msg(1,'another'));receive(msg(2));receive(msg(2));
  expect(store.chat.unhandled).toBe(1);expect(store.chat.msgs).toHaveLength(1);
  controlsRef.current.isChatOpen=true;
  callbacks.get('chat_file_response')!({...msg(3),type:'file',file:{name:'a.txt',size:3,type:'text/plain'}});
  expect(store.chat.unhandled).toBe(0);expect(store.chat.msgs).toHaveLength(2);
});
