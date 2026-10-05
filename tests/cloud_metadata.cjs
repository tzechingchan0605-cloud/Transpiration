const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const source=fs.readFileSync('cloud-sync.js','utf8');
function testHarness(){
 const data=new Map(),statuses=[],calls=[];let reply=b=>({ok:true,id:b.record?.id});
 const storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};
 const context={window:{},crypto:crypto.webcrypto,structuredClone,setTimeout:()=>1,clearTimeout(){},createAppsScriptBridge:()=>({send:async b=>{calls.push(b);return reply(b);}})};
 vm.createContext(context);vm.runInContext(source,context);
 const local=[];
 const sync=context.window.createCloudSync({endpoint:'https://script.google.com/macros/s/test/exec',storage,records:()=>local,status:(...args)=>statuses.push(args)});
 return {sync,local,data,statuses,calls,setReply:fn=>reply=fn};
}
const record={moduleId:'VL_BIO_TRANSPIRATION',id:'legacy-id',profile:{email:'student@example.com'},savedAt:'2026-10-05T01:00:00Z',form:{answer:'原始答案'},events:[{type:'original_event'}]};
(async()=>{
 const h=testHarness();h.sync.recover();await h.sync.flush();assert.equal(h.statuses.at(-1)[0],'configured');assert.equal(h.calls.length,0);
 const token='x'.repeat(72);h.data.set('transpirationLab.cloud.v1.tokens',JSON.stringify({[record.id]:token}));h.data.set('transpirationLab.cloud.v1.pending',JSON.stringify({[record.id]:record}));
 h.sync.recover();await h.sync.flush();assert.equal(h.calls[0].token,token);assert.deepEqual(JSON.parse(JSON.stringify(h.calls[0].record)),record);assert.equal(h.statuses.at(-1)[0],'synced');
 h.sync.recover();await h.sync.flush();assert.equal(h.calls.length,1,'acknowledged recovery must not send duplicate');
 const newer={...record,savedAt:'2026-10-05T02:00:00Z'};h.sync.enqueue(newer);h.sync.enqueue(record);await h.sync.flush();assert.equal(h.calls.at(-1).record.savedAt,newer.savedAt);
 h.setReply(()=>({ok:true,id:'unrelated'}));h.sync.enqueue({...newer,savedAt:'2026-10-05T03:00:00Z'});await assert.rejects(h.sync.flush(),/ID/);assert.equal(h.statuses.at(-1)[0],'error');
 h.setReply(b=>({ok:true,id:b.record.id}));await h.sync.flush();assert.equal(h.statuses.at(-1)[0],'synced');
 h.sync.enqueue({...record,id:'teacher',profile:{email:'tzechingchan0605@gmail.com'}});const n=h.calls.length;await h.sync.flush();assert.equal(h.calls.length,n);
 const damaged=testHarness();damaged.data.set('transpirationLab.cloudSync.v2','{broken');damaged.local.push(record);damaged.sync.recover();await assert.rejects(damaged.sync.flush());assert.equal(damaged.data.get('transpirationLab.cloudSync.v2'),'{broken');assert.equal(damaged.statuses.at(-1)[0],'error');
 const huge=testHarness();huge.sync.enqueue({...record,form:{image:'a'.repeat(960001)}});await assert.rejects(huge.sync.flush(),/960,000/);assert.equal(huge.calls.length,0);
 console.log('PASS: durable legacy token/outbox migration, truthful idle, endpoint-scoped acknowledgements, latest version coalescing, wrong-ID rejection and retry, teacher exclusion, corrupted metadata preservation and explicit size limit.');
})().catch(e=>{console.error(e);process.exitCode=1});
