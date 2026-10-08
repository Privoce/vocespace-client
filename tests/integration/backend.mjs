/** Starts only disposable Redis/API processes. Never reads the developer's configuration. */
import { mkdtemp, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { createServer as createHttpServer } from 'node:http';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import Redis from 'ioredis';
import { io } from 'socket.io-client';

const root = process.cwd();
const directory = await mkdtemp(path.join(tmpdir(), 'vocespace-api-integration-'));
const children = [], sockets = [];
let redis;
let mediaServer;
let mediaParticipants = [];
let logs = '';
const port = async () => {
  const server = createServer(); await new Promise((r) => server.listen(0,'127.0.0.1',r));
  const value = server.address().port; await new Promise((r) => server.close(r)); return value;
};
const waitUntil = async (action) => {
  for (let n=0;n<100;n++) { try { return await action(); } catch { await new Promise((r) => setTimeout(r,50)); } }
  throw new Error(`Service did not become ready\n${logs}`);
};
const child = (command,args,env={},cwd=directory) => {
  const process = spawn(command,args,{cwd,env:{...globalThis.process.env,...env},stdio:['ignore','pipe','pipe']});
  children.push(process); process.stdout.on('data',(d)=>{logs+=d;}); process.stderr.on('data',(d)=>{logs+=d;}); return process;
};
try {
  await symlink(path.join(root,'node_modules'),path.join(directory,'node_modules'));
  await symlink(path.join(root,'prompt'),path.join(directory,'prompt'));
  await build({stdin:{contents:"export { DEFAULT_SPACE_INFO, DEFAULT_PARTICIPANT_SETTINGS } from './lib/std/space'; export { DEFAULT_VOCESPACE_CONFIG } from './lib/std/conf';",resolveDir:root,loader:'ts'},outfile:path.join(directory,'fixtures.cjs'),bundle:true,packages:'external',platform:'node',format:'cjs',tsconfig:path.join(root,'tsconfig.json'),logLevel:'silent'});
  const require=createRequire(import.meta.url);
  const {DEFAULT_SPACE_INFO,DEFAULT_PARTICIPANT_SETTINGS,DEFAULT_VOCESPACE_CONFIG}=require(path.join(directory,'fixtures.cjs'));
  const redisPort=await port(), apiPort=await port();
  const mediaPort=await port();
  mediaServer=createHttpServer(async(req,res)=>{
    const chunks=[]; for await(const chunk of req) chunks.push(chunk);
    if(req.url.endsWith('/RemoveParticipant')) { const body=JSON.parse(Buffer.concat(chunks).toString()); mediaParticipants=mediaParticipants.filter((p)=>p.identity!==body.identity); }
    res.writeHead(200,{'Content-Type':'application/json'}); res.end(JSON.stringify({participants:mediaParticipants}));
  });
  await new Promise((resolve)=>mediaServer.listen(mediaPort,'127.0.0.1',resolve));
  const webPort=process.env.WEB_BUILD_DIR ? await port() : apiPort;
  child('redis-server',['--bind','127.0.0.1','--port',String(redisPort),'--save','','--appendonly','no','--dir',directory]);
  redis=new Redis({host:'127.0.0.1',port:redisPort,lazyConnect:true,retryStrategy:()=>50});
  redis.on('error',()=>{}); await waitUntil(()=>redis.ping());
  await writeFile(path.join(directory,'vocespace.conf.json'),JSON.stringify({...DEFAULT_VOCESPACE_CONFIG,
    create_space:'all',hostToken:'integration-admin',redis:{enabled:true,host:'127.0.0.1',port:redisPort,db:0,password:''},
    livekit:{url:`ws://127.0.0.1:${mediaPort}`,key:'test-only',secret:'test-only-secret-never-production-123456',turn:[]}}));
  const apiOrigin=`http://127.0.0.1:${apiPort}`;
  const origin=`http://127.0.0.1:${webPort}`;
  const apiDirectory=process.env.API_BUILD_DIR || path.join(root,'services/api');
  const startApi=()=>child(process.execPath,[path.join(apiDirectory,'start.mjs')],{VOCESPACE_DATA_DIR:directory,API_PORT:String(apiPort),WORKER_ENABLED:'false',NATIVE_CONFERENCE_SPACE:'room',PUBLIC_ORIGIN:origin,PLATFORM_JWT_SECRET:'test-only-platform-signing-secret-32-characters'},apiDirectory);
  const apiProcess=startApi();
  await waitUntil(async()=>{assert.equal((await fetch(`${apiOrigin}/healthz`)).status,200);});
  if (process.env.WEB_BUILD_DIR) {
    child(process.execPath,[path.join(process.env.WEB_BUILD_DIR,'server.js')],{HOST:'127.0.0.1',PORT:String(webPort),VOCESPACE_API_URL:apiOrigin,NODE_ENV:'production',PUBLIC_ORIGIN:origin},process.env.WEB_BUILD_DIR);
    await waitUntil(async()=>{assert.equal((await fetch(`${origin}/api/hello`)).status,200);});
    assert.equal((await fetch(origin)).status,200,'production Web home renders');
  }
  let count=0;
  const check=(value,message)=>{assert.ok(value,message);count++;};
  const session=async(name,room)=>{
    const response=await fetch(`${origin}/api/connection-details?spaceName=${room}&participantName=${name}&identity=forged-owner`);
    assert.equal(response.status,200);
    const cookie=response.headers.get('set-cookie').split(';')[0];
    const data=await response.json(); const claims=JSON.parse(Buffer.from(data.participantToken.split('.')[1],'base64url').toString());
    return {cookie,id:claims.sub,room,name};
  };
  const alice=await session('Alice','room'), bob=await session('Bob','room'), carol=await session('Carol','other');
  check(alice.id!=='forged-owner','client identity must be ignored');
  const room={...DEFAULT_SPACE_INFO(Date.now(),true),ownerId:alice.id,participants:{
    [alice.id]:{...structuredClone(DEFAULT_PARTICIPANT_SETTINGS),name:'Alice'},
    [bob.id]:{...structuredClone(DEFAULT_PARTICIPANT_SETTINGS),name:'Bob'},
  }};
  await redis.set('space:room',JSON.stringify(room)); await redis.sadd('space:list:','room');
  await redis.set('space:other',JSON.stringify({...DEFAULT_SPACE_INFO(Date.now(),true),ownerId:carol.id,participants:{[carol.id]:{...DEFAULT_PARTICIPANT_SETTINGS,name:'Carol'}}}));
  const post=(user,path,body,originHeader=origin)=>fetch(origin+path,{method:'POST',headers:{cookie:user.cookie,origin:originHeader,'Content-Type':'application/json'},body:JSON.stringify(body)});
  check((await post(bob,'/api/space?space=true&allowGuest=update',{spaceName:'room',allowGuest:'disable'})).status===403,'nonmanager rejected');
  check((await post(alice,'/api/v1/space?space=true&allowGuest=update',{spaceName:'room',allowGuest:'allow'})).status===200,'v1 owner uses same service');
  check((await post(alice,'/api/space?space=true&allowGuest=update',{spaceName:'room',allowGuest:'disable'},'https://evil.invalid')).status===403,'CSRF origin rejected');
  check((await post(bob,'/api/space?space=true&participant=update',{spaceName:'room',participantId:alice.id,settings:{name:'stolen'}})).status===403,'cannot update another identity');
  check((await post(alice,'/api/space?space=true&update=true',{spaceName:'room',info:{ownerId:bob.id}})).status===403,'cannot bypass ownership transfer');
  check((await fetch(`${origin}/api/space?all=true`)).status===403,'admin listing protected');
  check((await fetch(`${origin}/api/space?all=true&pre=true`)).status===403,'public flags cannot bypass admin authorization');
  check((await post(bob,'/api/record',{spaceName:'room',type:'start'})).status===403,'recording needs room management');
  check((await post(bob,'/api/ai',{spaceName:'room',userId:alice.id,isAuth:true})).status===403,'AI cannot impersonate another user');
  check((await post(bob,'/api/conf?license=true',{license:'forged'})).status===403,'license settings require host management');
  const form=new FormData();form.append('file',new Blob(['hello']), 'note.txt');form.append('roomName','room');form.append('senderId',bob.id);form.append('senderName','Bob');
  const uploaded=await fetch(`${origin}/api/upload`,{method:'POST',headers:{cookie:bob.cookie,origin},body:form});
  check(uploaded.status===200,'small file upload uses the HTTP adapter');
  const file=await uploaded.json();
  const range=await fetch(origin+file.fileUrl,{headers:{cookie:bob.cookie,range:'bytes=1-3'}});
  check(range.status===206&&await range.text()==='ell','protected file range download');
  check((await fetch(origin+file.fileUrl,{headers:{cookie:carol.cookie}})).status===403,'other space cannot read uploaded files');
  const invalid=await fetch(`${origin}/api/v1/space?all=true`);
  const invalidBody=await invalid.json();
  check(invalid.status===403&&invalidBody.requestId&&invalidBody.code==='ADMIN_REQUIRED','v1 errors include request ID and stable code');
  const connect=async(user)=>{const socket=io(origin,{transports:['websocket'],extraHeaders:{cookie:user.cookie,origin},reconnection:false});sockets.push(socket);await new Promise((r,j)=>{socket.once('connect',r);socket.once('connect_error',j);});return socket;};
  const a=await connect(alice),b=await connect(bob),c=await connect(carol);
  const ack=(socket,event,msg)=>socket.timeout(2000).emitWithAck(event,msg);
  let otherMessages=0;c.on('chat_msg_response',()=>otherMessages++);
  const msg={id:'stable-message-id',roomName:'room',sender:{id:'forged',name:'forged'},message:'hello',type:'text',file:null};
  const results=await Promise.all([ack(b,'chat_msg',msg),ack(b,'chat_msg',msg)]);
  check(results.every((r)=>r.ok)&&results.some((r)=>r.duplicate),'concurrent message dedup');
  const saved=JSON.parse(await redis.get('chat:room'));
  check(saved.length===1&&saved[0].sender.id===bob.id,'atomic storage and trusted sender');
  check((await ack(b,'wave',{space:'room',socketId:c.id})).ok===false,'cross-space target rejected');
  check((await ack(b,'remove_participant',{space:'room',socketId:a.id})).ok===false,'nonmanager socket action rejected');
  b.disconnect(); const b2=await connect(bob);
  check((await ack(b2,'chat_msg',msg)).duplicate===true,'dedup survives reconnect');
  delete room.participants[bob.id];await redis.set('space:room',JSON.stringify(room));
  check((await ack(b2,'chat_msg',{...msg,id:'after-revoke'})).ok===false,'membership revocation applied without reconnect');
  check(otherMessages===0,'space broadcasts are isolated');
  await redis.del(`v1:session:${alice.cookie.split('=')[1]}`);
  check((await ack(a,'wave',{space:'room',socketId:b2.id})).ok===false,'session revocation enforced');
  await new Promise((resolve)=>{apiProcess.once('exit',resolve);apiProcess.kill('SIGTERM');});
  startApi();await waitUntil(async()=>{assert.equal((await fetch(`${apiOrigin}/healthz`)).status,200);});
  const restored=await fetch(`${origin}/api/space?spaceName=other`,{headers:{cookie:carol.cookie}});
  check((await restored.json()).settings.ownerId===carol.id,'session and room survive API restart');
  room.participants[bob.id]={...DEFAULT_PARTICIPANT_SETTINGS,name:'Bob'};await redis.set('space:room',JSON.stringify(room));
  const restoredBob=await connect(bob);
  check((await ack(restoredBob,'chat_msg',msg)).duplicate===true,'message dedup survives API restart');
  const left=await fetch(`${origin}/api/space?participant=delete&space=true`,{method:'DELETE',headers:{cookie:carol.cookie,origin,'Content-Type':'application/json'},body:JSON.stringify({spaceName:'other',participantId:carol.id})});
  check(left.status===200&&(await left.json()).success,'HTTP leave checks RTC adapter and removes business membership');
  const guest=await session('Guest','fresh');
  const initialized=await post(guest,'/api/space?participant=update&space=true',{spaceName:'fresh',participantId:guest.id,init:true,settings:{...DEFAULT_PARTICIPANT_SETTINGS,name:'Guest',auth:{platform:'vocespace',identity:'owner'}}});
  check(initialized.status===200&&(await initialized.json()).success,'HTTP member initialization creates the first room owner');
  const fresh=JSON.parse(await redis.get('space:fresh'));
  check(fresh.ownerId===guest.id&&fresh.participants[guest.id].auth.platform==='other','initialization uses server identity and ignores forged platform');

  // Native pilot uses the same Redis, permissions and media adapter, with explicit Bearer auth.
  const nativeCall=(path,method,body,token,extra={})=>fetch(origin+path,{method,headers:{'Content-Type':'application/json',...(token?{authorization:`Bearer ${token}`}:{ }),...extra},body:JSON.stringify(body)});
  const sessionPath='/api/v1/session/native', meetingPath='/api/v1/native/conferences';
  check((await nativeCall(sessionPath,'POST',{},undefined,{origin})).status===403,'browser origin cannot use native bearer exchange');
  const nativeResponse=await nativeCall(sessionPath,'POST',{},undefined,{cookie:bob.cookie});
  const native=await nativeResponse.json();
  check(nativeResponse.status===200&&native.accessToken!==bob.cookie.split('=')[1]&&!nativeResponse.headers.has('set-cookie'),'native guest is independent from browser Cookie');
  const resumed=await (await nativeCall(sessionPath,'POST',{},native.accessToken)).json();
  check(resumed.accessToken===native.accessToken,'native session restores stable identity');
  check((await fetch(`${origin}/api/connection-details?spaceName=room&participantName=Mobile`,{headers:{authorization:`Bearer ${native.accessToken}`}})).status===403,'native observer cannot obtain legacy publishing grants');
  check((await nativeCall(meetingPath,'POST',{joinId:'subroom-denied-test',spaceName:'room',nickname:'Mobile'},native.accessToken)).status===409,'native observation rejects existing subrooms');
  // Remove only disposable fixture subrooms before enabling the manual observer flow.
  const pilot=JSON.parse(await redis.get('space:room'));pilot.children=[];
  pilot.ownerId=bob.id;
  await redis.set('space:room',JSON.stringify(pilot));
  const reinitialized=await post(bob,'/api/space?participant=update&space=true',{spaceName:'room',participantId:bob.id,init:true,settings:pilot.participants[bob.id]});
  check(reinitialized.status===200&&JSON.parse(await redis.get('space:room')).children.length===0,'Web initialization cannot create private subrooms in the opted-in pilot');
  const cancelled='cancel-before-prepare';
  await nativeCall(meetingPath,'DELETE',{joinId:cancelled},native.accessToken);
  check((await nativeCall(meetingPath,'POST',{joinId:cancelled,spaceName:'room',nickname:'Mobile'},native.accessToken)).status===409,'cancel tombstone rejects late prepare');
  check((await nativeCall(meetingPath,'POST',{joinId:'disabled-room-join',spaceName:'fresh',nickname:'Mobile'},native.accessToken)).status===403,'native access restricted to explicitly enabled pilot room');
  const beforeNative=JSON.parse(await redis.get('space:room'));
  await redis.set('space:room',JSON.stringify({...beforeNative,children:{}}));
  check((await nativeCall(meetingPath,'POST',{joinId:'corrupt-room-test',spaceName:'room',nickname:'Mobile'},native.accessToken)).status===503,'corrupt childroom data fails closed');
  await redis.set('space:room',JSON.stringify(beforeNative));
  const joinId='native-join-confirm-test';
  const prepared=await nativeCall(meetingPath,'POST',{joinId,spaceName:'room',nickname:'Mobile'},native.accessToken);
  assert.equal(prepared.status,200,await prepared.clone().text());
  const nativeJoin=await prepared.json();
  const nativeClaims=JSON.parse(Buffer.from(nativeJoin.participantToken.split('.')[1],'base64url').toString());
  check(nativeClaims.video.canPublish===false&&nativeClaims.video.canPublishData===false,'native RTC grants are observer-only');
  check(!JSON.parse(await redis.get('space:room')).participants[nativeJoin.identity],'prepare does not create business membership');
  check((await nativeCall(meetingPath,'PUT',{joinId},native.accessToken)).status===409,'confirmation requires server-observed RTC presence');
  mediaParticipants=[{sid:'PA_native_test',identity:nativeJoin.identity,metadata:'null'}];
  check((await nativeCall(meetingPath,'PUT',{joinId},native.accessToken)).status===409,'invalid RTC metadata is rejected without initializing membership');
  mediaParticipants=[{sid:'PA_native_test',identity:nativeJoin.identity,name:'Mobile',metadata:nativeClaims.metadata}];
  const confirmed=await Promise.all([nativeCall(meetingPath,'PUT',{joinId},native.accessToken),nativeCall(meetingPath,'PUT',{joinId},native.accessToken)]);
  check(confirmed.every((r)=>r.status===200),'duplicate confirmation is idempotent');
  const member=JSON.parse(await redis.get('space:room')).participants[nativeJoin.identity];
  assert.deepEqual(JSON.parse(await redis.get('space:room')).children, [], 'Native confirm preserves empty arrays');
  assert.deepEqual(member.appDatas, DEFAULT_PARTICIPANT_SETTINGS.appDatas, 'Native defaults preserve nested arrays');
  check(member.auth.identity==='guest'&&member.name==='Mobile'&&!member.ai.cut.enabled,'native member initialized from server defaults without AI');
  const blockedChild=await post(bob,'/api/space?childRoom=create',{spaceName:'room',roomName:'private'},origin);
  check(blockedChild.status===409,'pilot room cannot add subrooms while native observation is enabled');
  const nativeSocket=io(origin,{auth:{token:native.accessToken},transports:['websocket'],reconnection:false});sockets.push(nativeSocket);
  await new Promise((resolve,reject)=>{nativeSocket.once('connect',resolve);nativeSocket.once('connect_error',reject);});
  check((await ack(nativeSocket,'chat_msg',{...msg,id:'native-ack'})).ok===true,'native Bearer socket uses shared membership authorization');
  const assigned=JSON.parse(await redis.get('space:room')); assigned.managers.push(nativeJoin.identity);
  await redis.set('space:room',JSON.stringify(assigned));
  check((await ack(nativeSocket,'clear_space_resources',{space:'room'})).ok===false,'Native observer cannot acquire Socket management even if assigned a manager role');
  assigned.managers=beforeNative.managers;await redis.set('space:room',JSON.stringify(assigned));
  check((await nativeCall(meetingPath,'DELETE',{joinId},native.accessToken)).status===200&&mediaParticipants.length===0,'native exit removes actual media participant');
  check(!JSON.parse(await redis.get('space:room')).participants[nativeJoin.identity],'native exit removes business membership');
  assert.deepEqual(JSON.parse(await redis.get('space:room')),beforeNative,'Native round trip preserves Web room data including empty arrays');
  check((await nativeCall(meetingPath,'PUT',{joinId},native.accessToken)).status===409,'late confirmation cannot resurrect a cancelled join');
  check((await nativeCall(meetingPath,'DELETE',{joinId},native.accessToken)).status===200,'native exit is idempotent');
  await nativeCall(sessionPath,'DELETE',{},native.accessToken);
  check((await nativeCall(sessionPath,'POST',{},native.accessToken)).status===401,'revoked native credentials cannot restore');
  console.log(`${process.env.WEB_BUILD_DIR ? 'Production Web proxy + ' : ''}Independent HTTP + Redis + Socket integration: ${count} checks passed`);
} finally {
  for(const socket of sockets) socket.disconnect();
  if(redis) redis.disconnect();
  if(mediaServer) await new Promise((resolve)=>mediaServer.close(resolve));
  for(const process of children) process.kill('SIGTERM');
  await Promise.all(children.map((process)=>new Promise((resolve)=>{if(process.exitCode!==null)return resolve();process.once('exit',resolve);setTimeout(resolve,2000);} )));
  await rm(directory,{recursive:true,force:true});
}
