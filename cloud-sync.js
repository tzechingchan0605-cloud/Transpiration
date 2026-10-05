'use strict';
// Answers remain in the VL2 record store. Metadata grants per-attempt write access;
// acknowledgements are scoped to the collector URL, never to a student's email.
window.createCloudSync = function ({endpoint,storage,records,status,transport='bridge'}) {
  const enabled=Boolean(endpoint),key='transpirationLab.cloudSync.v2';
  const legacyPrefix='transpirationLab.cloud.v1.';
  const pending=new Map();
  let bridge,running=null,timer,credential='',confirmed=false;
  const clone=value=>JSON.parse(JSON.stringify(value));
  function objectAt(name){
    const raw=storage.getItem(name),value=raw?JSON.parse(raw):{};
    if(!value||Array.isArray(value)||typeof value!=='object')throw Error('同步設定損壞，原資料已保留');
    return value;
  }
  function metadata(){return objectAt(key);}
  function entry(id){
    const all=metadata();
    if(!all[id]){
      // Preserve the credentials of attempts already uploaded by the old version.
      const oldTokens=objectAt(legacyPrefix+'tokens');
      all[id]={token:oldTokens[id]||crypto.randomUUID()+crypto.randomUUID(),acknowledgements:{}};
      storage.setItem(key,JSON.stringify(all));
    }
    if(typeof all[id].token!=='string'||all[id].token.length<64||!all[id].acknowledgements||typeof all[id].acknowledgements!=='object')throw Error('同步設定不完整，原資料已保留');
    return all[id];
  }
  function student(r){return r?.moduleId==='VL_BIO_TRANSPIRATION'&&typeof r.id==='string'&&r.profile?.email&&r.profile.email.trim().toLowerCase()!=='tzechingchan0605@gmail.com';}
  async function request(body){
    // Apps Script traffic exclusively uses the embedded Google RPC bridge.
    bridge ||= createAppsScriptBridge(endpoint);
    const result=await bridge.send(body);
    if(!result?.ok)throw Error(result?.error||'收集端未確認操作');
    return result;
  }
  function enqueue(record){
    if(!enabled||!student(record))return;
    try{
      const info=entry(record.id);
      if(info.acknowledgements[endpoint]===record.savedAt)return;
      const previous=pending.get(record.id);
      if(!previous||Date.parse(record.savedAt)>=Date.parse(previous.savedAt))pending.set(record.id,clone(record));
      status('pending',`尚有 ${pending.size} 份紀錄等待同步；本機備份已保留。`);
      if(!timer)timer=setTimeout(()=>{timer=null;flush().catch(()=>{});},1200);
    }catch(e){pending.set(record.id,clone(record));status('error',e.message+'；請勿清除瀏覽器資料。');}
  }
  async function drain(){
    let acknowledged=false;
    while(pending.size){
      const [id,record]=pending.entries().next().value,info=entry(id);
      if(JSON.stringify(record).length>960000)throw Error('紀錄超過 960,000 字元，請減小裝置相片；完整答案仍保留本機');
      const reply=await request({action:'save',token:info.token,record});
      if(reply.id!==id)throw Error('收集端回覆的探究 ID 不符，未確認儲存');
      const all=metadata();all[id].acknowledgements[endpoint]=record.savedAt;storage.setItem(key,JSON.stringify(all));
      if(pending.get(id)?.savedAt===record.savedAt)pending.delete(id);
      acknowledged=true;
    }
    if(acknowledged){confirmed=true;status('synced','✓ 本機學生紀錄已獲中央確認儲存。');}
  }
  function flush(){
    clearTimeout(timer);timer=null;
    if(!enabled||!running&&!pending.size)return Promise.resolve();
    if(!running)running=drain().catch(e=>{status('error','同步失敗：'+e.message+'。本機備份仍在，請重試。');throw e;}).finally(()=>{running=null;});
    return running;
  }
  function recover(){
    if(!enabled){status('unconfigured','未設定雲端：答案只存於這部瀏覽器，尚不能跨裝置收集。');return;}
    try{
      // Read and preserve the previous durable outbox, including saves which could
      // not fit in the old main store. Never clear or rewrite its original value.
      const candidates=[...records(),...Object.values(objectAt(legacyPrefix+'pending'))];
      const latest=new Map();
      candidates.filter(student).forEach(r=>{const old=latest.get(r.id);if(!old||Date.parse(r.savedAt)>=Date.parse(old.savedAt))latest.set(r.id,r);});
      latest.forEach(enqueue);
      if(!pending.size&&!confirmed)status('configured','已設定雲端；尚未確認本次連線或儲存成功。');
    }catch(e){status('error','無法補傳：'+e.message+'；原資料已保留，請勿清除瀏覽器資料。');}
  }
  async function list(password){
    if(password!==undefined)credential=password;
    if(!credential)throw Error('請先輸入教師雲端密碼');
    const all=[];let cursor=0;
    do{
      const page=await request({action:'list',teacherEmail:'tzechingchan0605@gmail.com',password:credential,cursor});
      if(!Array.isArray(page.records)||!(page.nextCursor===null||Number.isInteger(page.nextCursor)&&page.nextCursor>cursor))throw Error('雲端分頁回應格式不正確');
      if(page.records.some(r=>!student(r)))throw Error('雲端紀錄模組或學生身分不符');
      all.push(...page.records);cursor=page.nextCursor;
    }while(cursor!==null);
    return all;
  }
  return {enabled,enqueue,flush,recover,list,clearCredential(){credential='';},student};
};
