'use strict';
// Exercise the actual Q4 learner flow; no production collector is reachable.
const {chromium}=require('playwright'),{localServer}=require('../paperwork/build.cjs'),assert=require('node:assert/strict');
(async()=>{const server=await localServer(),browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});try{
 for(const lang of ['zh','en']){
  const context=await browser.newContext({acceptDownloads:true,reducedMotion:'reduce',viewport:lang==='en'?{width:390,height:844}:{width:1280,height:960}}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await context.route('**/cloud-config.js*',r=>r.fulfill({contentType:'text/javascript',body:"window.VL2_CLOUD_CONFIG={endpoint:'',transport:'bridge'};"}));
  await context.route('https://**/*',r=>r.abort());await page.goto(server.base);
  await page.evaluate(l=>VL2I18n.setLanguage(l),lang);
  for(const [id,v]of Object.entries({profileName:'Split fixture',profileClass:'S4 Test',profileEmail:'split-isolated@example.test'}))await page.locator('#'+id).fill(v);
  await page.locator('#profileForm button[type=submit]').click();
  assert.equal(await page.evaluate(()=>state.questionVersion),'VL2-Q4');
  await page.locator('#observation').fill('Red trace rises along the petiole.');await page.locator('#orientationNext').click();
  assert.equal(await page.locator('#controlPlan').isVisible(),false);
  await page.locator('#prediction').selectOption('increase');await page.locator('#reason').fill('Stronger light may increase water movement.');
  for(const [g,indexes]of Object.entries({iv:[0],dv:[1],cv:[2,3,4,5,6]}))for(const i of indexes)await page.locator(`[data-group=${g}]`).nth(i).click();
  for(const a of ['temperature','equalArea','air'])await page.locator(`#assumptionChoices input[value=${a}]`).check();
  await page.locator('#setupDescription').fill('Three leafy setups A 10 cm B 20 cm C 30 cm; equal leaf area and water depth; zero scales at water level and time together.');await page.locator('#saveSetup').click();await page.locator('#designNext').click();
  assert.equal(await page.evaluate(()=>state.phase),3);assert.equal(await page.locator('#labBench .specimen-card').count(),3);assert.equal(await page.locator('#experimentNext').isDisabled(),true);assert.equal(await page.locator('#learningReveal').isVisible(),false);
  async function english(scope){if(lang!=='en')return;const bad=await page.locator(scope).evaluate(root=>{const out=[],w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);for(let n;n=w.nextNode();){if(n.parentElement.closest('script,style,textarea,[data-user-text]'))continue;const t=n.nodeValue.replace(/\([^()]*[\u3400-\u9fff][^()]*\)/g,'');if(/[\u3400-\u9fff]/.test(t))out.push(t.trim());}return out;});assert.deepEqual(bad,[]);}
  async function reviewMain(viaDesign=false){
   const saved=await page.evaluate(()=>JSON.stringify({measurements:state.measurements,mainSnapshot:state.mainSnapshot,initialControl:state.initialControl,labStage:state.labStage,currentTime:state.currentTime,unlocked:state.unlocked,graph:state.graph}));
   if(viaDesign){await page.locator('#phase-3 [data-back="2"]').click();await page.locator('#designNext').click();}else await page.locator('#backToMain').click();
   assert.equal(await page.locator('#labBench .specimen-card').count(),3);assert.equal(await page.locator('#dataBody tr').count(),4);assert.equal(await page.locator('[data-measure]:enabled').count(),0);assert(await page.locator('#recordMeasurements').isHidden());
   await english('#phase-3');await page.evaluate(l=>{VL2I18n.setLanguage(l==='en'?'zh':'en');VL2I18n.setLanguage(l);},lang);
   await page.locator('#experimentNext').click();
   const after=await page.evaluate(()=>JSON.stringify({measurements:state.measurements,mainSnapshot:state.mainSnapshot,initialControl:state.initialControl,labStage:state.labStage,currentTime:state.currentTime,unlocked:state.unlocked,graph:state.graph}));assert.equal(after,saved,'review navigation preserves both investigations and progress');
  }
  for(const stage of ['main','extension']){
   if(stage==='extension'){
    await page.locator('#experimentNext').click();assert.equal(await page.evaluate(()=>state.unlocked),3);assert(await page.locator('#extensionDesign').isVisible());assert(await page.locator('#labBench').isHidden());await reviewMain();assert(await page.locator('#extensionDesign').isVisible());await reviewMain(true);
    await page.locator('#confirmExtension').click();assert.equal(await page.evaluate(()=>state.labStage),'extensionDesign');
    await page.locator('#controlPlan').fill('Yes. Compare leafy B with leafless D, both at 20 cm; keep all other conditions equal.');await page.locator('#confirmExtension').click();
    assert.equal(await page.locator('#labBench .specimen-card').count(),2);assert(await page.locator('[data-measure=B]').first().isDisabled());
    const box=await page.locator('#labBench .specimen-card').first().boundingBox();assert(box.height<500);const svg=await page.locator('#labBench .specimen-svg').first().boundingBox();assert(svg.height<=301);await page.locator('#labBench').scrollIntoViewIfNeeded();await page.screenshot({path:'/tmp/vl2-extension-'+lang+'.png'});
   }
   await english('#phase-3');
   for(const t of [0,10,20,30]){
    for(const id of stage==='main'?['A','B','C']:['D'])await page.locator(`[data-time="${t}"][data-measure="${id}"]`).fill(String(await page.evaluate(({id,t})=>state.model[id][t/10],{id,t})));
    if(stage==='main'&&t===30)await page.locator('[data-time="30"][data-measure="B"]').fill('7.4');
    await page.locator('#recordMeasurements').click();
    if(stage==='main'&&t===30){await page.locator('[data-time="30"][data-measure="B"]').fill('7.5');assert(await page.locator('#experimentNext').isDisabled());await page.locator('#recordMeasurements').click();}
    if(stage==='extension'&&t===10){await reviewMain();await reviewMain(true);}
    if(t<30){await page.locator('#timerButton').click();await page.waitForFunction(t=>state.currentTime===t&&!state.running,t+10);}
   }
  }
  const record=await page.evaluate(()=>structuredClone(state));assert.equal(record.measurements[30].values.B,'7.5');assert.equal(record.measurements[30].firstValues.B,'7.4');assert.equal(record.mainSnapshot[30].values.B,'7.5');assert(record.initialControl.value.includes('20 cm'));
  const rounds=record.events.filter(e=>e.type==='measurements_recorded');assert.equal(rounds.length,8);assert.equal(rounds.filter(e=>e.investigation==='extension').length,4);assert(rounds.filter(e=>e.investigation==='extension').every(e=>Object.keys(e.values).join()==='D'));
  await page.locator('#experimentNext').click();assert.equal(await page.evaluate(()=>state.phase),4);assert.equal(await page.locator('#learningReveal').isVisible(),false);
  for(const [id,x]of Object.entries({A:1200,B:300,C:133,D:300})){
   const rate=await page.evaluate(id=>expectedRate(state,id).toFixed(2),id);
   await page.locator('#rate-'+id).fill(rate);await page.locator('#point-x-'+id).fill(String(x));await page.locator('#point-y-'+id).fill(rate);await page.locator('[data-plot='+id+']').click();
  }
  await page.locator('#connectPoints').click();for(const [id,v]of Object.entries({claim:'increase',leafComparison:'faster',leafConclusion:'promotes',limitations:'indirect'}))await page.locator('#'+id).selectOption(v);
  await page.locator('#submitInvestigation').click();await page.locator('#confirmSubmit').click();assert(await page.locator('#downloadPDF').isDisabled());assert(await page.locator('#controlPlan').isDisabled());
  await page.locator('#reflection').fill('Stronger light usually opens stomata. Water films evaporate; vapour diffuses through stomata. Water potential falls, xylem replenishes water and transpiration pull draws water upwards. Leafy B is faster than leafless D.');await page.locator('#saveReflection').click();assert.equal(await page.locator('#downloadPDF').isDisabled(),false);
  await page.locator('#phase-4 [data-back="3"]').click();await reviewMain(true);await page.locator('#experimentNext').click();assert.equal(await page.evaluate(()=>state.phase),4);
  await page.evaluate(()=>renderReport(state));await english('#printReport');await page.pdf({path:'/tmp/vl2-split-'+lang+'.pdf',format:'A4',printBackground:true});
  // Real exporter sees Q4 stage provenance, snapshots and original answers.
  const pending=page.waitForEvent('download');await page.evaluate(()=>{activeProfile={name:'Teacher',classInfo:'T',email:TEACHER_EMAIL};writeStored(RECORDS_KEY,[state]);exportExcel();});await(await pending).saveAs('/tmp/vl2-split-'+lang+'.xlsx');
  assert.deepEqual(errors,[]);await context.close();console.log('PASS Q4 '+lang+': real main design → ABC → extension control → B/D animation + D entry → analysis; B first/final/snapshot retained; English report; actual XLSX; no early reveal');
 }
}finally{await browser.close();await server.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
