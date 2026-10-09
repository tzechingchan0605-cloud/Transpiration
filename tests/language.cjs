// Real UI language checks. All contexts replace the production cloud config;
// the cloud scenario uses an in-browser bridge with an in-memory collector.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const http=require('node:http');
const {execFileSync}=require('node:child_process');

const TEACHER='tzechingchan0605@gmail.com';
const STUDENT={name:'光強度同學',classInfo:'S4X1-語言',email:'language-isolated@example.edu.hk'};
const ANSWERS={observation:'我觀察到……光強度（lux）；I observe a red trace.',reason:'主動改變的因素；My original reason stays in English.',controlPlan:'裝置D 不帶葉，與裝置B 比較。structure-report-water; celery-report-before-stem.',setupDescription:'裝置A：10 cm；裝置B：20 cm；裝置C：30 cm；裝置D不帶葉。',reflection:'木質導管、蒸騰拉力與水勢。My reflection keeps both languages.'};
const artifacts=process.env.LANGUAGE_ARTIFACTS||'/tmp/vl2-language';
const han=/[\u3400-\u9fff]/;
const APPROVED_CHINESE=['蒸騰','蒸騰拉力','葉柄','木質導管','韌皮部','葉肉細胞','柵狀葉肉細胞','海綿葉肉細胞','表皮細胞','保衞細胞','氣孔','角質層','維管束','蒸發','水汽','水膜','氣室','葉綠體','液泡','木質部','氣孔張開','草本莖','光強度','濕度','浸入深度','蒸騰速率','可測試的','坐標'];

async function localServer(){
 if(process.env.LAB_URL)return {url:process.env.LAB_URL,close:async()=>{}};
 const root=path.resolve(__dirname,'..');
 const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1');
  const target=path.resolve(root,'.'+(url.pathname==='/'?'/index.html':url.pathname));
  if(!target.startsWith(root+path.sep)){res.writeHead(404);res.end();return;}
  try{res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml'})[path.extname(target)]||'application/octet-stream');res.end(await fs.readFile(target));}
  catch{res.writeHead(404);res.end();}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 return {url:'http://127.0.0.1:'+server.address().port,close:()=>new Promise(resolve=>server.close(resolve))};
}

async function login(page,profile=STUDENT){
 await page.locator('#profileName').fill(profile.name);
 await page.locator('#profileClass').fill(profile.classInfo);
 await page.locator('#profileEmail').fill(profile.email);
 await page.locator('#profileForm button[type=submit]').click();
}

// Capture only content which a language switch must preserve, including local
// backups, original snapshots, clocks, option order, locks and actual pixels.
function preserved(){
 const controls=[...document.querySelectorAll('input,textarea,select')].map(el=>({
  id:el.id,time:el.dataset.time,measure:el.dataset.measure,value:el.value,checked:el.checked,disabled:el.disabled,
  options:el.options?[...el.options].map(option=>({value:option.value,selected:option.selected,disabled:option.disabled})):undefined
 }));
 return {
  state:JSON.stringify(state),activeSince,timerHandle,
  storage:Object.fromEntries(Object.keys(localStorage).sort().map(key=>[key,localStorage.getItem(key)])),controls,
  canvas:document.querySelector('#setupCanvas').toDataURL(),
  graph:[...document.querySelectorAll('#studentGraph circle,#studentGraph .student-curve')].map(el=>[el.tagName,...['cx','cy','r','d'].map(attr=>el.getAttribute(attr))]),
  phases:[...document.querySelectorAll('.phase')].map(el=>[el.id,el.hidden]),
  lock:document.querySelector('#downloadPDF').disabled
 };
}

async function switchLanguage(page,locale,button='#languageButton'){
 if(await page.evaluate(()=>VL2I18n.language)!==locale)await page.locator(button).click();
 assert.equal(await page.evaluate(()=>VL2I18n.language),locale);
 assert.equal(await page.locator('#languageDialog,#languageCode').count(),0,'switches freely without a code or confirmation dialog');
}

async function invariantSwitch(page,locale){
 // Run before/after in one task so ordinary experiment animation and scheduled
 // autosave cannot race the assertion about the switch itself.
 const result=await page.evaluate(({source,locale})=>{
  const snapshot=(0,eval)('('+source+')');
  const before=snapshot();VL2I18n.setLanguage(locale);
  return {before,after:snapshot(),language:VL2I18n.language};
 },{source:preserved.toString(),locale});
 assert.deepEqual(result.after,result.before,'language-only change must preserve answers, order, drawing, locks, snapshots, events, timing and cloud metadata');
 assert.equal(result.language,locale);
 await page.waitForTimeout(30);
}

async function untranslated(page,scope='body'){
 return page.locator(scope).evaluate((root,approved)=>{
  const bad=[],cjk=/[\u3400-\u9fff]/;
  const withoutApproved=value=>approved.reduce((text,term)=>text.replaceAll('('+term+')',''),value);
  const user=el=>el.closest('[data-user-text]');
  const label=el=>el.id?'#'+el.id:el.tagName.toLowerCase()+(el.className?.baseVal!==undefined?'.'+el.className.baseVal:typeof el.className==='string'&&el.className?'.'+el.className.trim().replace(/\s+/g,'.'):'');
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
  for(let node;node=walker.nextNode();){const parent=node.parentElement;if(!parent||parent.closest('script,style,noscript')||user(parent))continue;if(cjk.test(withoutApproved(node.nodeValue)))bad.push({node:label(parent),text:node.nodeValue.trim()});}
  for(const el of [root,...root.querySelectorAll('*')])for(const attr of ['placeholder','aria-label','aria-description','alt','title']){
   // A protected student value never exempts UI hint/accessibility attributes.
   const value=el.getAttribute(attr);if(value&&cjk.test(withoutApproved(value)))bad.push({node:label(el),attribute:attr,text:value});
  }
  return bad;
 },APPROVED_CHINESE);
}

async function assertEnglish(page,stage,scope='body'){
 assert.equal(await page.evaluate(()=>VL2I18n.language),'en');
 if(scope==='body'){
  assert.equal(await page.locator('html').getAttribute('lang'),'en');
  const title=APPROVED_CHINESE.reduce((text,term)=>text.replaceAll('('+term+')',''),await page.title());
  assert(!han.test(title),stage+': browser title must use English');
 }
 const bad=await untranslated(page,scope);
 if(bad.length)await fs.writeFile(path.join(artifacts,'untranslated-'+stage+'.json'),JSON.stringify(bad,null,2));
 assert.deepEqual(bad,[],stage+': all owned text, SVG, hints and accessibility attributes must be English');
}

(async()=>{
 await fs.mkdir(artifacts,{recursive:true});
 const server=await localServer();
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 const errors=[];
 async function context(options={},cloud=false){
  const result=await browser.newContext({acceptDownloads:true,...options});
  await result.route('**/cloud-config.js*',route=>route.fulfill({contentType:'application/javascript',body:cloud?
   "window.VL2_CLOUD_CONFIG={endpoint:'http://127.0.0.1/isolated-language-collector',transport:'bridge'};":
   "window.VL2_CLOUD_CONFIG={endpoint:'',transport:'bridge'};"}));
  await result.route('https://fonts.googleapis.com/**',route=>route.abort());
  await result.route('https://fonts.gstatic.com/**',route=>route.abort());
  if(cloud)await result.route('**/cloud-bridge.js*',route=>route.fulfill({contentType:'application/javascript',body:`
   window.__isolatedCloud={online:false,calls:[],records:{}};
   window.createAppsScriptBridge=endpoint=>({send:async body=>{
    if(endpoint!=='http://127.0.0.1/isolated-language-collector')throw Error('Forbidden test collector');
    const mock=window.__isolatedCloud;mock.calls.push(structuredClone(body));
    if(!mock.online)throw Error('isolated offline');
    if(body.action==='save'){mock.records[body.record.id]=structuredClone(body.record);return {ok:true,id:body.record.id};}
    return {ok:true,records:Object.values(mock.records),nextCursor:null};
   }});`}));
  // Fail closed if a production endpoint somehow escapes the config override.
  await result.route('https://script.google.com/**',route=>route.abort());
  await result.route('https://script.googleusercontent.com/**',route=>route.abort());
  result.on('page',page=>page.on('pageerror',error=>errors.push(error.message)));
  return result;
 }
 try{
  const desktop=await context({viewport:{width:1440,height:1000}}),page=await desktop.newPage();
  await page.goto(server.url);
  assert.equal(await page.evaluate(()=>VL2I18n.language),'zh');
  assert.equal(await page.locator('#profileDialog').isVisible(),true);
  await page.locator('#profileName').fill(STUDENT.name);
  await page.locator('#profileClass').fill(STUDENT.classInfo);
  await page.locator('#profileEmail').fill(STUDENT.email);
  const chineseHints=await page.locator('input[placeholder],textarea[placeholder]').evaluateAll(els=>els.map(el=>({id:el.id,value:el.getAttribute('placeholder')})));
  assert(chineseHints.length>=6,'cover every existing input and textarea hint');

  assert.equal(await page.locator('#languageDialog,#languageCode').count(),0);
  const beforeSwitch=await page.evaluate(preserved);
  await switchLanguage(page,'en','#loginLanguageButton');
  assert.deepEqual(await page.evaluate(preserved),beforeSwitch,'direct login switch keeps entered personal information and records');
  for(const hint of chineseHints){const english=await page.locator('#'+hint.id).getAttribute('placeholder');if(han.test(hint.value)){assert(!han.test(english),hint.id+' placeholder must be translated');assert.notEqual(english,hint.value);}}
  assert.equal(await page.locator('#profileName').inputValue(),STUDENT.name);await assertEnglish(page,'login');
  await switchLanguage(page,'zh','#loginLanguageButton');await switchLanguage(page,'en','#loginLanguageButton');
  assert.equal(await page.locator('#profileDialog').isVisible(),true,'direct switch keeps the login form open');
  await page.locator('#profileForm button[type=submit]').click();
  await page.locator('#orientationNext').click();await assertEnglish(page,'observation-required');
  await page.locator('#observation').fill(ANSWERS.observation);await invariantSwitch(page,'zh');await invariantSwitch(page,'en');
  await page.locator('#orientationNext').click();await assertEnglish(page,'design');
  await page.locator('#prediction').selectOption('decrease');await page.locator('#reason').fill(ANSWERS.reason);
  await page.locator('[data-group=iv]').first().click();await page.locator('[data-group=dv]').nth(1).click();
  for(let i=2;i<7;i++)await page.locator('[data-group=cv]').nth(i).click();
  for(const value of ['temperature','equalArea','air'])await page.locator('#assumptionChoices input[value='+value+']').check();
  await page.locator('#controlPlan').fill(ANSWERS.controlPlan);await page.locator('#setupDescription').fill(ANSWERS.setupDescription);
  await page.locator('#setupCanvas').scrollIntoViewIfNeeded();const box=await page.locator('#setupCanvas').boundingBox();
  await page.mouse.move(box.x+70,box.y+60);await page.mouse.down();await page.mouse.move(box.x+180,box.y+100);await page.mouse.up();
  await page.locator('#saveSetup').click();await invariantSwitch(page,'zh');await invariantSwitch(page,'en');await assertEnglish(page,'saved-design');
  await page.locator('#designNext').click();assert.equal(await page.locator('#phase-3').isVisible(),true);await assertEnglish(page,'experiment');
  for(const time of [0,10,20,30]){
   const model=await page.evaluate(()=>state.model);
   for(const id of ['A','B','C','D'])await page.locator('[data-time="'+time+'"][data-measure="'+id+'"]').fill(model[id][time/10].toFixed(1));
   await page.locator('#recordMeasurements').click();
   if(time===10){await page.locator('[data-time="10"][data-measure=B]').fill('2.9');await page.locator('#recordMeasurements').click();}
   await invariantSwitch(page,'zh');await invariantSwitch(page,'en');await assertEnglish(page,'measurement-'+time);
   if(time<30){
    await page.locator('#timerButton').click();
    if(time===0){assert.equal(await page.evaluate(()=>state.running),true);await invariantSwitch(page,'zh');await invariantSwitch(page,'en');assert.equal(await page.evaluate(()=>state.running),true);await assertEnglish(page,'running');}
    await page.waitForFunction(t=>state.currentTime===t&&!state.running,time+10);
    await assertEnglish(page,'timer-finished-'+time);
   }
  }
  assert.notEqual(await page.evaluate(()=>state.measurements[10].firstValues.B),await page.evaluate(()=>state.measurements[10].values.B));
  await page.locator('#experimentNext').click();await assertEnglish(page,'analysis');
  const rates=await page.evaluate(()=>Object.fromEntries(IDS.map(id=>[id,expectedRate(state,id).toFixed(2)])));
  for(const [id,x] of Object.entries({A:1200,B:300,C:133,D:300})){
   await page.locator('#rate-'+id).fill(rates[id]);await page.locator('#point-x-'+id).fill(String(x));await page.locator('#point-y-'+id).fill(rates[id]);await page.locator('[data-plot='+id+']').click();
  }
  await page.locator('#connectPoints').click();
  const graphBox=await page.locator('#studentGraph').boundingBox();await page.mouse.move(graphBox.x+graphBox.width/2,graphBox.y+graphBox.height/2);
  for(const [id,value] of Object.entries({claim:'increase',leafComparison:'faster',leafConclusion:'promotes',limitations:'indirect'}))await page.locator('#'+id).selectOption(value);
  await invariantSwitch(page,'zh');await invariantSwitch(page,'en');await assertEnglish(page,'graph');
  await page.locator('#submitInvestigation').click();await assertEnglish(page,'submission-confirmation');await page.locator('#confirmSubmit').click();
  assert.equal(await page.locator('#rate-A').isDisabled(),true);assert.equal(await page.locator('#downloadPDF').isDisabled(),true);await assertEnglish(page,'learning');
  const science=await page.locator('#mechanismDiagram').innerText();
  const learningProse=(await page.locator('.learning-points').textContent()).replace(/\s+/g,' ');
  assert(learningProse.includes('through stomata (氣孔) in leaves'),'running prose uses plural stomata, while the diagram can label one stoma');
  assert(learningProse.includes('higher light intensity'),'inline terms keep sentence capitalization');
  assert(learningProse.includes('the water film'),'the inline water-film label remains natural English');
  for(const [term,chinese] of [['transpiration','蒸騰'],['transpiration pull','蒸騰拉力'],['petiole','葉柄'],['xylem vessel','木質導管'],['phloem','韌皮部'],['mesophyll cell','葉肉細胞'],['palisade mesophyll cell','柵狀葉肉細胞'],['spongy mesophyll cell','海綿葉肉細胞'],['epidermal cell','表皮細胞'],['guard cell','保衞細胞'],['stoma','氣孔'],['cuticle','角質層'],['vascular bundle','維管束']]){
   assert(science.includes('('+chinese+')'),'approved term appears with Chinese support: '+term);
  }
  for(const term of ['water potential','osmosis','diffusion'])assert(!new RegExp(term+'\\s*\\([^)]*[\\u3400-\\u9fff]','i').test(science),'unapproved word has no Chinese support: '+term);
  assert(!/transpiration\s*\(蒸騰\)\s*pull/i.test(science),'transpiration pull gets one complete approved translation');
  const vocabularyChecks=await page.evaluate(()=>{
   const examples=['evaporation','evaporate','evaporates','evaporated','evaporating','water vapour','water film','water films','air space','air spaces','chloroplast','chloroplasts','vacuole','vacuoles','xylem','stomatal opening','herbaceous stem','herbaceous stems','light intensity','humidity','depth of immersion','transpiration rate','transpiration rates','testable','coordinate','coordinates'];
   return examples.map(text=>({text,once:VL2I18n.translate(text,'en'),twice:VL2I18n.translate(VL2I18n.translate(text,'en'),'en')}));
  });
  for(const item of vocabularyChecks){assert(/\([\u3400-\u9fff]+\)/.test(item.once),'newly approved word gets Chinese: '+item.text);assert.equal(item.twice,item.once,'Chinese glosses do not duplicate: '+item.text);}
  assert(!/transpiration\s*\(蒸騰\)\s*rate/i.test(learningProse),'transpiration rate uses a single complete gloss');
  assert(!/xylem\s*\(木質部\)\s*vessels?/i.test(science),'xylem vessel keeps its complete scientific label');
  assert(learningProse.includes('transpiration rate (蒸騰速率)'));
  assert(learningProse.includes('water film (水膜)'));

  await page.locator('#reflection').fill(ANSWERS.reflection);await invariantSwitch(page,'zh');await invariantSwitch(page,'en');
  await page.locator('#saveReflection').click();assert.equal(await page.locator('#reflection').isDisabled(),true);assert.equal(await page.locator('#downloadPDF').isDisabled(),false);
  await invariantSwitch(page,'zh');await invariantSwitch(page,'en');await assertEnglish(page,'reflection-submitted');
  for(const [id,value] of Object.entries(ANSWERS))assert.equal(await page.locator('#'+id).inputValue(),value);
  await page.evaluate(()=>{window.print=()=>{window.__printed=(window.__printed||0)+1;};});
  for(const [code,lang] of [['zh','zh'],['en','en']]){
   await invariantSwitch(page,code);await page.locator('#downloadPDF').click();await page.waitForFunction(()=>!!window.__printed);
   const report=await page.locator('#printReport').innerText();
   for(const value of Object.values(ANSWERS))assert(report.includes(value),'PDF retains original student text: '+value);
   assert(report.includes(STUDENT.name));
   if(lang==='en')await assertEnglish(page,'pdf','\u0023printReport');
   const title=await page.locator('#printReport h1').innerText();assert.equal(han.test(title),lang==='zh');
   await fs.writeFile(path.join(artifacts,'report-'+lang+'.txt'),report);
   await page.emulateMedia({media:'print'});await page.pdf({path:path.join(artifacts,'report-'+lang+'.pdf'),format:'A4',printBackground:true});await page.emulateMedia({media:'screen'});
   await page.evaluate(()=>{window.dispatchEvent(new Event('afterprint'));window.__printed=0;});
  }
  execFileSync('python',['-c',`from pypdf import PdfReader
from pathlib import Path
import unicodedata
root=Path(${JSON.stringify(artifacts)})
for language in ['zh','en']:
 text=' '.join(unicodedata.normalize('NFKC', ''.join(page.extract_text() or '' for page in PdfReader(root / ('report-'+language+'.pdf')).pages)).split())
 assert len(text)>500, (language, 'PDF lacks extractable text')
 if language=='en':
  for term in ['transpiration', 'xylem', 'My original reason', 'My reflection']:
   assert term.lower() in text.lower(), (term, 'missing in actual English PDF')
 print('PASS: actual '+language+' PDF has readable text and original answers')
`],{stdio:'inherit'});
  await fs.writeFile(path.join(artifacts,'student-record.json'),JSON.stringify(await page.evaluate(()=>state),null,2));
  await page.locator('#profileButton').click();await login(page,{name:'教師',classInfo:'教師',email:TEACHER});
  assert.equal(await page.locator('#teacherDialog').isVisible(),true);await assertEnglish(page,'teacher');
  await page.locator('[data-view-record]').first().click();await assertEnglish(page,'teacher-preview');
  assert((await page.locator('#teacherReport').innerText()).includes(ANSWERS.controlPlan),'diagram ID remapping must not change original student words');
  for(const [code,lang] of [['zh','zh'],['en','en']]){
   await invariantSwitch(page,code);const download=page.waitForEvent('download');await page.locator('#exportExcel').click();await (await download).saveAs(path.join(artifacts,'excel-'+lang+'.xlsx'));
  }
  assert((await fs.readFile(path.join(artifacts,'excel-zh.xlsx'))).equals(await fs.readFile(path.join(artifacts,'excel-en.xlsx'))),'Chinese and English interfaces must export identical workbook bytes, including scores, formulas and images');
  execFileSync('python',['-c',`from zipfile import ZipFile
from pathlib import Path
root=Path(${JSON.stringify(artifacts)})
with ZipFile(root/'excel-en.xlsx') as z:
 xml=''.join(z.read(n).decode('utf-8') for n in z.namelist() if n.endswith('.xml'))
 for value in ['學生探究答案', '教師評分', '主動改變的因素；My original reason stays in English.', '木質導管、蒸騰拉力與水勢。My reflection keeps both languages.']:
  assert value in xml, ('Original answer or Chinese heading missing', value)
 assert '<f>' in xml, 'Scoring formulas missing'
 assert any(n.startswith('xl/media/') for n in z.namelist()), 'Drawing image missing'
 print('PASS: Excel keeps Chinese headings, original bilingual answers, grading formulas and drawing')
`],{stdio:'inherit'});
  const beforeDemo=await page.evaluate(()=>JSON.stringify(storedRecords()));
  await switchLanguage(page,'zh','#teacherLanguageButton');await switchLanguage(page,'en','#teacherLanguageButton');await page.locator('#teacherDemo').click();
  await assertEnglish(page,'teacher-demonstration');await page.locator('#observation').fill('教師自己的示範文字');await invariantSwitch(page,'zh');await invariantSwitch(page,'en');
  assert.equal(await page.evaluate(()=>JSON.stringify(storedRecords())),beforeDemo);

  const mobile=await desktop.newPage();await mobile.setViewportSize({width:390,height:844});await mobile.goto(server.url);
  assert.equal(await mobile.evaluate(()=>VL2I18n.language),'zh','a new page always starts in Traditional Chinese');
  const mobileButton=await mobile.locator('#loginLanguageButton').boundingBox();assert(mobileButton&&mobileButton.x>=0&&mobileButton.x+mobileButton.width<=390&&mobileButton.y>=0&&mobileButton.y+mobileButton.height<=844);
  await switchLanguage(mobile,'en','#loginLanguageButton');await assertEnglish(mobile,'mobile-login');
  await login(mobile,{name:'Mobile student',classInfo:'S4-mobile',email:'mobile-language-isolated@example.edu.hk'});
  await switchLanguage(mobile,'zh');await switchLanguage(mobile,'en');await assertEnglish(mobile,'mobile-student');
  assert.equal(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await mobile.screenshot({path:path.join(artifacts,'mobile-en.png'),fullPage:true});
  await mobile.locator('#profileButton').click();await login(mobile,{name:'教師',classInfo:'教師',email:TEACHER});
  await switchLanguage(mobile,'zh','#teacherLanguageButton');await switchLanguage(mobile,'en','#teacherLanguageButton');await assertEnglish(mobile,'mobile-teacher');
  assert.equal(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await mobile.locator('#teacherDemo').click();await switchLanguage(mobile,'zh');await switchLanguage(mobile,'en');await assertEnglish(mobile,'mobile-teacher-demo');
  mobile.on('dialog',dialog=>dialog.accept());await mobile.reload();assert.equal(await mobile.evaluate(()=>VL2I18n.language),'zh');assert.equal(await mobile.locator('#profileDialog').isVisible(),true);

  const cloudContext=await context({viewport:{width:1280,height:900}},true),cloud=await cloudContext.newPage();await cloud.goto(server.url);await login(cloud);
  await cloud.locator('#observation').fill(ANSWERS.observation);await cloud.evaluate(async()=>{save();clearTimeout(saveTimer);await cloudSync.flush().catch(()=>{});});
  assert.equal(await cloud.locator('#cloudStatus').getAttribute('data-state'),'error');
  const pendingRecord=await cloud.evaluate(()=>JSON.stringify(storedRecords()));const sentBefore=await cloud.evaluate(()=>window.__isolatedCloud.calls.length);
  await invariantSwitch(cloud,'en');await assertEnglish(cloud,'cloud-offline');await invariantSwitch(cloud,'zh');
  assert.equal(await cloud.evaluate(()=>window.__isolatedCloud.calls.length),sentBefore,'language switches do not create sync requests');
  assert.equal(await cloud.evaluate(()=>JSON.stringify(storedRecords())),pendingRecord,'pending cloud record remains unchanged');
  await cloud.evaluate(()=>window.__isolatedCloud.online=true);await cloud.locator('#retryCloud').click();await cloud.waitForFunction(()=>document.querySelector('#cloudStatus').dataset.state==='synced');
  assert.equal(await cloud.evaluate(()=>window.__isolatedCloud.records[state.id].form.observation),ANSWERS.observation);
  await invariantSwitch(cloud,'en');await assertEnglish(cloud,'cloud-confirmed');
  const acknowledged=await cloud.evaluate(()=>JSON.stringify(window.__isolatedCloud.records));await invariantSwitch(cloud,'zh');await invariantSwitch(cloud,'en');assert.equal(await cloud.evaluate(()=>JSON.stringify(window.__isolatedCloud.records)),acknowledged);
  assert.deepEqual(errors,[]);
  console.log('PASS: default Chinese on every page/reload; free direct language switching without a code dialog; every placeholder and owned text/SVG/accessibility attribute; original bilingual answers, option order, canvas, graph, ID, snapshots, events, timers, locks and local/cloud records; running experiment; full English student flow and dynamic statuses; actual bilingual PDF; byte-identical Chinese Excel with original answers, scoring formulas and images; mobile; teacher preview/demo; isolated offline/retry cloud sync. Artifacts: '+artifacts);
 }finally{await browser.close();await server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
