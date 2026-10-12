'use strict';
// Real downloads; no production collector, no Google login/password required.
const {chromium}=require('playwright'),assert=require('assert/strict'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const {localServer}=require('../paperwork/build.cjs');
const manifest=require('../paperwork/generated/manifest.json');
const root=path.resolve(__dirname,'..'),artifacts='/tmp/vl2-paper-test';
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const TEACHER='tzechingchan0605@gmail.com';
async function login(page,email=TEACHER){
 await page.locator('#profileName').fill(email===TEACHER?'教師示範':'隔離學生');await page.locator('#profileClass').fill('X1-05');await page.locator('#profileEmail').fill(email);await page.locator('#profileForm button[type=submit]').click();
}
function snapshot(){return {state:JSON.stringify(state),profile:JSON.stringify(activeProfile),storage:JSON.stringify(Object.keys(localStorage).sort().map(key=>[key,localStorage.getItem(key)])),drawing:document.querySelector('#setupCanvas').toDataURL(),drawingChanged,drawingTool,timer:timerHandle,language:VL2I18n.language,values:FIELD_IDS.map(id=>[id,document.getElementById(id).value]),graph:JSON.stringify(state.graph)};}
async function invariant(page,action){const before=await page.evaluate(snapshot);await action();assert.deepEqual(await page.evaluate(snapshot),before,'materials must not change investigation, drawing, timer, events, language or local/cloud backup');}
async function excel(page,name){const waiting=page.waitForEvent('download');await page.locator('#exportExcel').click();const download=await waiting,file=path.join(artifacts,name);await download.saveAs(file);return fs.readFileSync(file);}
(async()=>{
 fs.mkdirSync(artifacts,{recursive:true});const server=await localServer(),browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});const errors=[],requests=[];
 async function context(options={}){
  const c=await browser.newContext({acceptDownloads:true,...options});
  await c.addInitScript(()=>{const start=window.setInterval;window.setInterval=(fn,ms,...args)=>{if(ms===15000||ms===30000)return 0;return start(fn,ms,...args);};});
  await c.route('**/cloud-config.js*',r=>r.fulfill({contentType:'text/javascript',body:"window.VL2_CLOUD_CONFIG={endpoint:'',transport:'bridge'};"}));
  await c.route('https://**/*',r=>r.abort());c.on('page',p=>{p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>requests.push(r.url()));});return c;
 }
 try{
  const c=await context({viewport:{width:1280,height:900}}),page=await c.newPage();await page.goto(server.base);await page.waitForFunction(()=>!!window.VL2Paperwork);
  const beforeLogin=await page.evaluate(snapshot);assert.equal(await page.evaluate(()=>VL2Paperwork.open()),false);assert.deepEqual(await page.evaluate(snapshot),beforeLogin);
  await login(page,'paper-isolated@example.edu.hk');
  assert.equal(await page.locator('#openPaperwork').isVisible(),false);
  assert.equal(await page.evaluate(async()=>{const before=JSON.stringify(state);const result=await VL2Paperwork.download('D');return result===false&&JSON.stringify(state)===before;}),true);
  await page.locator('#profileButton').click();await login(page);
  await page.evaluate(()=>{
   const record=freshState({name:'隔離學生',classInfo:'X1-05',email:'paper-isolated@example.edu.hk'});
   record.form={...record.form,observation:'學生原文',prediction:'increase',reason:'Original reason',controlPlan:'帶葉與不帶葉比較',setupDescription:'四個裝置',reflection:'反思原文'};
   record.variables={iv:[VARIABLE_NAMES[0]],dv:[VARIABLE_NAMES[1]],cv:VARIABLE_NAMES.slice(2)};record.assumptions=['temperature','equalArea','air'];
   record.initialDesign={form:structuredClone(record.form),variables:structuredClone(record.variables),setup:{image:''}};
   record.setup.image=document.querySelector('#setupCanvas').toDataURL('image/png');
   for(const [i,time] of [0,10,20,30].entries()){const values=Object.fromEntries(IDS.map(id=>[id,String(record.model[id][i])]));record.measurements[time]={values,firstValues:structuredClone(values),confirmed:true};}
   record.calculations={A:'0.40',B:'0.25',C:'0.15',D:'0.05'};record.graph={points:Object.fromEntries(IDS.map(id=>[id,{x:CONDITIONS[id].light,y:+record.calculations[id]}])),connected:true};
   record.form.claim='increase';record.form.leafComparison='faster';record.form.leafConclusion='promotes';record.form.limitations='indirect';record.submitted=true;record.submittedAt=new Date().toISOString();record.reflectionSubmittedAt=record.submittedAt;
   localStorage.setItem(RECORDS_KEY,JSON.stringify([record]));localStorage.setItem('transpirationLab.cloudSync.v2',JSON.stringify({[record.id]:{token:'isolated-test-token'.repeat(4),acknowledgements:{}}}));
   document.querySelector('#observation').value='未提交的教師示範文字';state.form.observation='未提交的教師示範文字';
  });
  assert.equal(await page.evaluate(()=>{
   const before=JSON.stringify(VL2PaperDigestSource({zh:getVL2PaperSource('zh'),en:getVL2PaperSource('en')}));
   const original=CanvasRenderingContext2D.prototype.measureText;
   try{CanvasRenderingContext2D.prototype.measureText=function(text){return {width:original.call(this,text).width*1.3};};return JSON.stringify(VL2PaperDigestSource({zh:getVL2PaperSource('zh'),en:getVL2PaperSource('en')}))===before;}
   finally{CanvasRenderingContext2D.prototype.measureText=original;}
  }),true,'content version is independent of phone/OS font metrics');
  assert.deepEqual(await page.evaluate(()=>{
   const missing=[];const inspect=value=>{
    if(Array.isArray(value)){value.forEach(inspect);return;}
    if(value&&typeof value==='object'){Object.values(value).forEach(inspect);return;}
    if(typeof value!=='string'||!value.includes('<svg'))return;
    const template=document.createElement('template');template.innerHTML=value;const ids=new Set([...template.content.querySelectorAll('[id]')].map(el=>el.id));
    for(const el of template.content.querySelectorAll('*'))for(const attribute of el.attributes)for(const match of attribute.value.matchAll(/url\(#([^)]*)\)/g))if(!ids.has(match[1]))missing.push(match[1]);
   };inspect(getVL2PaperSource('zh'));inspect(getVL2PaperSource('en'));return missing;
  }),[],'all SVG clip paths, gradients, patterns and movement arrowheads resolve');
  const workbookBefore=await excel(page,'before.xlsx');
  await invariant(page,async()=>{assert.equal(await page.evaluate(()=>VL2Paperwork.open()),true);});
  assert.equal(await page.locator('#paperPanel').isVisible(),true);
  for(const lang of ['zh','en']){
   await invariant(page,()=>page.locator('#paperLanguage').selectOption(lang));
   for(const part of ['A','B','C','D','all']){
    await invariant(page,async()=>{
     const waiting=page.waitForEvent('download');await page.locator(`[data-paper-download="${part}"]`).click();const d=await waiting;
     const file=manifest.languages[lang].files[part];assert.equal(d.suggestedFilename(),file.name);
     const target=path.join(artifacts,`${lang}-${part}.pdf`);await d.saveAs(target);assert.equal(sha(fs.readFileSync(target)),file.sha256);assert(fs.readFileSync(target).subarray(0,5).equals(Buffer.from('%PDF-')));
    });
    await page.waitForTimeout(350);
   }
  }
  await invariant(page,async()=>{assert.equal(await page.evaluate(()=>VL2Paperwork.preview('C')),true);assert((await page.locator('#paperPreview').getAttribute('src')).startsWith('blob:'));});
  const workbookAfter=await excel(page,'after.xlsx');assert(workbookBefore.equals(workbookAfter),'actual teacher Excel bytes, formulas and drawing remain unchanged');
  // Independent materials language does not alter the VL interface or source.
  await page.locator('#teacherLanguageButton').click();
  await invariant(page,async()=>{assert.equal(await page.evaluate(()=>VL2Paperwork.open()),true);assert.equal(await page.locator('#paperLanguage').inputValue(),'en');await page.locator('#paperLanguage').selectOption('zh');});
  assert.equal(await page.evaluate(()=>VL2I18n.language),'en');
  await invariant(page,async()=>{
   await page.route('**/paperwork/generated/manifest.json',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({...manifest,sourceDigest:'0'.repeat(64)})}));
   assert.equal(await page.evaluate(()=>VL2Paperwork.open()),false);assert.equal(await page.locator('[data-paper-download="A"]').isDisabled(),true);
   await page.unroute('**/paperwork/generated/manifest.json');
  });
  assert.equal(await page.evaluate(()=>VL2Paperwork.open()),true);
  await invariant(page,async()=>{
   await page.route('**/paperwork/generated/*.pdf',r=>r.fulfill({contentType:'application/pdf',body:Buffer.from('%PDF-corrupt')}));
   assert.equal(await page.evaluate(()=>VL2Paperwork.download('A')),false);await page.unroute('**/paperwork/generated/*.pdf');
  });
  // A question edit changes the shared source digest; no stale materials offered.
  await page.evaluate(()=>{document.querySelector('.hypothesis-sentence').firstChild.textContent+='Changed question';});
  assert.equal(await page.evaluate(()=>VL2Paperwork.open()),false);
  const mc=await context({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),mobile=await mc.newPage();await mobile.goto(server.base);await login(mobile);
  await invariant(mobile,async()=>{assert.equal(await mobile.evaluate(()=>VL2Paperwork.open()),true);});
  assert.equal(await mobile.locator('#paperPanel').evaluate(el=>el.scrollWidth<=el.clientWidth+1),true,'phone panel does not overflow horizontally');
  for(const lang of ['zh','en']){
   await mobile.locator('#paperLanguage').selectOption(lang);
   await invariant(mobile,async()=>{const waiting=mobile.waitForEvent('download');await mobile.locator('[data-paper-download="all"]').click();const d=await waiting;assert.equal(d.suggestedFilename(),manifest.languages[lang].files.all.name);});
  }
  assert.deepEqual(errors,[]);assert(!requests.some(url=>/script\.(google|googleusercontent)\.com/.test(url)),'no Apps Script requests');
  console.log('PASS: ten real bilingual PDFs and checksums, teacher-only entry, preview, independent language, stale/corrupt rejection, phone downloads, identical state/local/cloud backup/drawing/timer/events and actual Excel bytes. Autosave/flush intervals paused only in this isolation test.');
 }finally{await browser.close();await server.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
