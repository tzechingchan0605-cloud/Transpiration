'use strict';
// Durable outbox: acknowledgement, rather than sending a request, means saved.
class LabCloudSync {
  constructor({url,teacherEmail,onStatus}) {
    this.url=url;this.teacherEmail=teacherEmail;this.onStatus=onStatus;
    this.prefix='transpirationLab.cloud.v1.';
    try {this.pending=JSON.parse(localStorage.getItem(this.prefix+'pending'))||{};this.tokens=JSON.parse(localStorage.getItem(this.prefix+'tokens'))||{};} catch {this.pending={};this.tokens={};}
    this.busy=false;this.timer=null;this.records=null;this.teacherKey='';
    addEventListener('online',()=>this.flush());
  }
  get enabled(){return /^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/.test(this.url||'');}
  status(message){this.onStatus(message);}
  persist(){localStorage.setItem(this.prefix+'tokens',JSON.stringify(this.tokens));localStorage.setItem(this.prefix+'pending',JSON.stringify(this.pending));}
  enqueue(record){
    if(!this.enabled||!record.profile||record.profile.email?.toLowerCase()===this.teacherEmail)return;
    this.tokens[record.id] ||= crypto.randomUUID()+crypto.randomUUID();
    this.pending[record.id]=JSON.parse(JSON.stringify(record));
    try{this.persist();}catch{this.status('中央同步待重試：本機儲存空間不足，請保持此頁開啟。');}
    this.status('答案已保留於本機，等待中央儲存確認。');
    if(!this.timer)this.timer=setTimeout(()=>{this.timer=null;this.flush();},1500);
  }
  async request(payload){
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),30000);
    try{
      const response=await fetch(this.url,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(payload),signal:controller.signal,redirect:'follow'});
      const result=await response.json();
      if(!response.ok||!result.ok)throw Error(result.error||'連線失敗');
      return result;
    }finally{clearTimeout(timeout);}
  }
  async flush(){
    if(!this.enabled||this.busy)return;
    this.busy=true;
    try{
      for(const id of Object.keys(this.pending)){
        const record=this.pending[id];
        await this.request({action:'save',record,token:this.tokens[id]});
        if(this.pending[id]?.savedAt===record.savedAt){delete this.pending[id];this.persist();}
      }
      this.status(Object.keys(this.pending).length?'仍有答案等待中央確認。':'✓ 答案已同步至教師中央紀錄。');
    }catch(error){
      this.status('尚未同步至中央；答案保留於本機，恢復連線後重試。');
      if(!this.timer)this.timer=setTimeout(()=>{this.timer=null;this.flush();},30000);
    }finally{this.busy=false;}
  }
  async load(key){
    let cursor=0,records=[];
    do{
      const result=await this.request({action:'list',teacherKey:key,cursor});
      records.push(...result.records);cursor=result.nextCursor;
    }while(cursor!==null);
    this.teacherKey=key;this.records=records;return records;
  }
}
