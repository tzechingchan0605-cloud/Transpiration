const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const rows=[['Attempt ID','Saved at','Name','Class','Email','Status','File','Token']],files=new Map();
const props={SHEET_ID:'sheet',FOLDER_ID:'folder',TEACHER_KEY:'teacher-private-key'};
const sheet={getLastRow:()=>rows.length,getRange:(start,col,n=1,w=1)=>({getValues:()=>rows.slice(start-1,start-1+n).map(r=>r.slice(col-1,col-1+w)),setValues:values=>{values.forEach((v,i)=>rows[start-1+i]=v)}})};
const backend={PropertiesService:{getScriptProperties:()=>({getProperty:key=>props[key]})},SpreadsheetApp:{openById:()=>({getSheetByName:()=>sheet})},DriveApp:{getFileById:id=>files.get(id),getFolderById:()=>({createFile:(name,data)=>{const id=String(files.size+1);let content=data;const file={getId:()=>id,setContent:x=>content=x,getBlob:()=>({getDataAsString:()=>content})};files.set(id,file);return file;}})},MimeType:{PLAIN_TEXT:'text/plain'},Utilities:{DigestAlgorithm:{SHA_256:'sha256'},computeDigest:(_,s)=>[...require('node:crypto').createHash('sha256').update(s).digest()]},ContentService:{MimeType:{JSON:'application/json'},createTextOutput:s=>({setMimeType:()=>s})},LockService:{getScriptLock:()=>({waitLock(){},hasLock:()=>true,releaseLock(){}})}};
vm.createContext(backend);vm.runInContext(fs.readFileSync('server/Code.gs','utf8'),backend);
const post=b=>JSON.parse(backend.doPost({postData:{contents:JSON.stringify(b)}}));
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 const contexts=[];
 try{
  async function client(){const c=await browser.newContext();contexts.push(c);const p=await c.newPage();await p.route('**/cloud-config.js',r=>r.fulfill({contentType:'text/javascript',body:"window.VL_CLOUD_CONFIG={url:'https://script.google.com/macros/s/test/exec'};"}));await p.route('https://script.google.com/macros/s/test/exec',r=>r.fulfill({contentType:'application/json',body:JSON.stringify(post(r.request().postDataJSON()))}));await p.goto(process.env.LAB_URL||'http://127.0.0.1:8000');return p;}
  async function login(p,email){for(const[id,v] of Object.entries({profileName:'測試學生',profileClass:'S4-01',profileEmail:email}))await p.locator('#'+id).fill(v);await p.locator('#profileForm button[type=submit]').click();}
  const phone=await client();await login(phone,'phone@example.com');await phone.locator('#observation').fill('手機上的回答');await phone.evaluate(()=>{save();return cloud.flush();});
  const laptop=await client();await login(laptop,'laptop@example.com');await laptop.locator('#observation').fill('電腦上的回答');await laptop.evaluate(()=>{save();return cloud.flush();});
  await phone.evaluate(()=>{state=freshState(activeProfile);save();return cloud.flush();});
  await phone.waitForFunction(()=>Object.keys(cloud.pending).length===0);await laptop.waitForFunction(()=>Object.keys(cloud.pending).length===0);
  assert.equal(rows.length,4,'two devices plus second attempt retained');
  const teacher=await client();await login(teacher,'tzechingchan0605@gmail.com');await teacher.locator('#cloudTeacherKey').fill('wrong');await teacher.locator('#refreshCloud').click();await teacher.waitForFunction(()=>document.querySelector('#dashboardStatus').textContent.includes('未能讀取'));
  assert.equal(await teacher.locator('[data-view-record]').count(),0);
  await teacher.locator('#cloudTeacherKey').fill(props.TEACHER_KEY);await teacher.locator('#refreshCloud').click();await teacher.waitForFunction(()=>document.querySelectorAll('[data-view-record]').length===3);
  const all=await teacher.evaluate(()=>teacherRecords());assert(all.some(r=>r.form.observation==='手機上的回答'));assert(all.some(r=>r.form.observation==='電腦上的回答'));
  const downloadPromise=teacher.waitForEvent('download');await teacher.locator('#exportExcel').click();const download=await downloadPromise;await download.saveAs('/tmp/vl2-central.xlsx');
  const before=rows.length;await teacher.locator('#teacherDemo').click();await teacher.locator('#observation').fill('教師示範');await teacher.evaluate(()=>save());assert.equal(rows.length,before);
  const r=all[0];assert.equal(post({action:'save',record:{...r,profile:{...r.profile,email:'tzechingchan0605@gmail.com'}},token:'x'.repeat(64)}).ok,false);
  assert.equal(post({action:'save',record:r,token:'x'.repeat(64)}).ok,false,'cannot replace another attempt');
  const retry=await client();await login(retry,'retry@example.com');await retry.waitForFunction(()=>!cloud.busy);await retry.unroute('https://script.google.com/macros/s/test/exec');await retry.route('https://script.google.com/macros/s/test/exec',r=>r.abort());await retry.locator('#observation').fill('斷線保存');await retry.evaluate(()=>{save();return cloud.flush();});assert(await retry.evaluate(()=>Object.keys(cloud.pending).length>0));
  await retry.unroute('https://script.google.com/macros/s/test/exec');await retry.route('https://script.google.com/macros/s/test/exec',r=>r.fulfill({contentType:'application/json',body:JSON.stringify(post(r.request().postDataJSON()))}));await retry.evaluate(()=>cloud.flush());await retry.waitForFunction(()=>Object.keys(cloud.pending).length===0);
  assert.equal(rows.length,5);console.log('PASS: independent browser records, separate repeat attempts, teacher key protection, central XLSX export, demo exclusion, ownership tokens, offline retry; real Code.gs executed with Google service doubles.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
