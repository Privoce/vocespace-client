// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest';
const state=vi.hoisted(()=>({files:new Map<string,string>(),send:vi.fn()}));
vi.mock('fs',()=>({default:{
  existsSync:(key:string)=>state.files.has(key),
  mkdirSync:vi.fn(),
  readFileSync:(key:string)=>{
    if(key.endsWith('vocespace.conf.json'))return JSON.stringify({s3:{accessKey:'test-only',secretKey:'test-only',bucket:'test',region:'test'}});
    const value=state.files.get(key);if(value===undefined)throw new Error('missing');return value;
  },
  writeFileSync:(key:string,value:string)=>{state.files.set(key,value);},
  renameSync:(from:string,to:string)=>{state.files.set(to,state.files.get(from)!);state.files.delete(from);},
}}));
vi.mock('@aws-sdk/client-s3',()=>({S3Client:class{send=state.send;},DeleteObjectCommand:class{constructor(public input:unknown){}}}));
import { addCleanTask, removeCleanTask, runDueCleanTasks } from '@/lib/s3-clean';
beforeEach(()=>{state.files.clear();state.send.mockReset().mockResolvedValue({});});
it('persists without starting timers and deduplicates schedule keys',async()=>{
  const timer=vi.spyOn(globalThis,'setTimeout');
  addCleanTask('room/file.mp4',-1);addCleanTask('room/file.mp4',-1);
  expect(timer).not.toHaveBeenCalled();timer.mockRestore();
  await runDueCleanTasks();await runDueCleanTasks();
  expect(state.send).toHaveBeenCalledTimes(1);
});
it('retains failed work for retry and honors persisted cancellation',async()=>{
  state.send.mockRejectedValueOnce(new Error('test storage unavailable'));
  addCleanTask('room/retry.mp4',-1);
  await runDueCleanTasks();await runDueCleanTasks();
  expect(state.send).toHaveBeenCalledTimes(2);
  addCleanTask('room/cancel.mp4',-1);removeCleanTask('room/cancel.mp4');
  await runDueCleanTasks();expect(state.send).toHaveBeenCalledTimes(2);
});
