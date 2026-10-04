const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const {execFileSync}=require('node:child_process');
const LAB_URL=process.env.LAB_URL||'http://127.0.0.1:8000';
const TEACHER='tzechingchan0605@gmail.com';
async function login(p,name,cl,email){for(const[id,v]of Object.entries({profileName:name,profileClass:cl,profileEmail:email}))await p.locator('#'+id).fill(v);await p.locator('#profileForm button[type=submit]').click();}
async function reloadToLogin(p){p.once('dialog',async d=>{assert.equal(d.type(),'beforeunload');await d.accept();});await p.reload();assert.equal(await p.locator('#profileDialog').isVisible(),true);assert.equal(await p.locator('#profileName').inputValue(),'');assert.equal(await p.locator('#observation').inputValue(),'');assert.equal(await p.locator('#teacherButton').isVisible(),false);assert.equal(await p.locator('main').evaluate(el=>el.inert),true);}
async function dye(p,selector){assert.equal(await p.locator(selector).evaluate(svg=>{const c=[...svg.querySelectorAll('.dye-column')];return c.length===2&&['y','height','fill','width'].every(a=>c[0].getAttribute(a)===c[1].getAttribute(a));}),true);}
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true,reducedMotion:'reduce'});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto(LAB_URL);await page.screenshot({path:'/tmp/vl2-profile.png'});
  await login(page,'陳小明','S4X1-05','p012@example.edu.hk');
  assert.equal(await page.locator('#teacherButton').isVisible(),false);
  assert(!(await page.locator('.prompt-card').innerText()).includes('發現葉柄內逐漸出現向上延伸'));await dye(page,'#sceneAfter svg');
  await page.locator('#orientationNext').click();assert.equal(await page.locator('#phase-1').isVisible(),true);
  await page.locator('#observation').fill('西芹長柄內出現向上延伸的紅色水跡。');await page.locator('#orientationNext').click();
  await page.locator('#designNext').click();assert.equal(await page.locator('#phase-2').isVisible(),true);
  assert.equal(await page.locator('#assumptionReason,#controlNeed,#saveControl,#controlScaffold,[data-lamp]').count(),0);
  assert.equal(await page.locator('#equipmentBank .equipment').count(),6);
  assert.equal(await page.locator('#equipmentBank .lamp-beam').getAttribute('d'),'M69 12L98 3V65L61 40Z');await page.locator('#equipmentBank').screenshot({path:'/tmp/vl2-materials.png'});
  const materials=await page.locator('#equipmentBank').innerText();for(const t of ['西芹 ×4','檯燈 ×4','紅色水杯 ×4','30 cm 尺子 ×4','剪刀 ×1','計時器 ×1'])assert(materials.includes(t));
  await page.locator('#prediction').selectOption('decrease');await page.locator('#reason').fill('我預測強光可能令水跡變慢，需要量度才能知道。');
  await page.locator('[data-group=iv]').first().click();await page.locator('[data-group=dv]').nth(1).click();for(let i=2;i<7;i++)await page.locator('[data-group=cv]').nth(i).click();
  for(const v of ['temperature','equalArea','areaIrrelevant'])await page.locator(`#assumptionChoices input[value=${v}]`).check();
  await page.locator('#controlPlan').fill('不帶葉西芹放在 20 cm，與裝置B 比較，其他條件相同。');
  await page.locator('#setupDescription').fill('裝置A帶葉10cm、裝置B帶葉20cm、裝置C帶葉30cm、裝置D無葉20cm，各浸入紅色水2cm。');
  await page.locator('#setupCanvas').scrollIntoViewIfNeeded();const cb=await page.locator('#setupCanvas').boundingBox();
  await page.mouse.move(cb.x+70,cb.y+70);await page.mouse.down();await page.mouse.move(cb.x+140,cb.y+130);await page.mouse.up();await page.locator('#saveSetup').click();
  await page.screenshot({path:'/tmp/vl2-design.png',fullPage:true});await page.locator('#designNext').click();
  assert.equal(await page.locator('#initialReadingReminder').isVisible(),true);assert.match(await page.locator('.experiment-timing-note').innerText(),/不應為了量度而停止計時/);assert.match(await page.locator('.data-card thead').innerText(),/紅色水跡向上移動的距離（cm）/);assert.equal(await page.locator('#timerButton').isDisabled(),true);assert.equal(await page.locator('[data-dy]').count(),0);
  await page.locator('[data-ruler=A]').scrollIntoViewIfNeeded();const rb=await page.locator('[data-ruler=A]').boundingBox();
  await page.mouse.move(rb.x+15,rb.y+100);await page.mouse.down();await page.mouse.move(rb.x-25,rb.y+160);await page.mouse.up();
  assert.equal(await page.evaluate(()=>state.ruler.A.y),0);assert((await page.evaluate(()=>state.ruler.A.x))<0);
  const first=page.locator('[data-time="0"][data-measure="A"]');await first.fill('0.0');await first.press('ArrowUp');assert.equal(await first.inputValue(),'0.5');await first.press('ArrowDown');assert.equal(await first.inputValue(),'0.0');
  await page.locator('[data-adjust-time="0"][data-adjust-id=A][data-amount="0.5"]').click();assert.equal(await first.inputValue(),'0.5');await page.locator('[data-adjust-time="0"][data-adjust-id=A][data-amount="-0.5"]').click();assert.equal(await first.inputValue(),'0.0');
  for(const t of [0,10,20,30]){
   const m=await page.evaluate(()=>state.model);for(const id of ['A','B','C','D'])await page.locator(`[data-time="${t}"][data-measure="${id}"]`).fill(String(m[id][t/10]));
   if(t===0){await first.fill('0.05');await page.locator('#recordMeasurements').click();assert.equal(await page.locator('#timerButton').isDisabled(),true);await first.fill('0.0');}
   await page.locator('#recordMeasurements').click();if(t<30)assert(Math.abs(await page.locator('.timer-bar').evaluate(el=>el.getBoundingClientRect().top))<50);else assert((await page.locator('.timer-bar').evaluate(el=>el.getBoundingClientRect().top))<-50);
   assert.equal(await page.locator(`[data-time="${t}"][data-measure="A"]`).inputValue(),Number(m.A[t/10]).toFixed(1));
   if(t===10){await page.locator('[data-time="10"][data-measure="B"]').fill('2.9');assert.equal(await page.locator('#timerButton').isDisabled(),true);await page.locator('#recordMeasurements').click();}
   if(t<30){await page.locator('#timerButton').click();assert(Math.abs(await page.locator('#labBench').evaluate(el=>el.getBoundingClientRect().top))<50);await page.waitForFunction(time=>state.currentTime===time&&!state.running,t+10);for(const id of ['A','B','C','D'])await dye(page,'#specimen-'+id);}
  }
  await page.screenshot({path:'/tmp/vl2-experiment.png',fullPage:true});await page.locator('#experimentNext').click();
  assert.equal(await page.locator('#evidence').count(),0);assert.equal(await page.locator('#phase-4 .formula').count(),1);assert.match(await page.locator('#phase-4 .formula').innerText(),/平均上移速度.*÷.*所用時間/);assert.match(await page.locator('#phase-4 .card').first().innerText(),/小數點後兩位/);assert(!(await page.locator('#calculationGrid').innerText()).includes('÷'));assert.equal(await page.locator('.graph-settings select').count(),0);
  assert.equal(await page.locator('#studentGraph .graph-inline-legend').count(),0);assert.equal(await page.locator('.graph-legend').count(),1);assert.match(await page.locator('.graph-legend').innerText(),/裝置D（獨立比較點）/);
  const rates=await page.evaluate(()=>Object.fromEntries(IDS.map(id=>[id,expectedRate(state,id).toFixed(2)])));rates.D='0.12';
  for(const id of ['A','B','C','D']){
    const card=page.locator('.calc-card').filter({has:page.locator('#rate-'+id)});
    const record=await page.evaluate(()=>state),end=record.measurements[30].values[id];
    assert((await card.innerText()).includes(`30 分鐘 ${end} cm`));assert((await card.innerText()).includes(`光強度：${{A:1200,B:300,C:133,D:300}[id]} lux`));assert.equal(await card.locator('.calc-distance').count(),0);
    assert.equal(await page.locator('#rate-'+id).getAttribute('step'),'0.01');
  }
  await page.locator('#rate-A').fill('0.383');await page.locator('#rate-A').blur();assert.equal(await page.locator('#rate-A').inputValue(),'0.38');
  for(const id of ['A','B','C','D'])await page.locator('#rate-'+id).fill(rates[id]);
  for(const[id,x]of Object.entries({A:1200,B:300,C:133,D:300})){await page.locator('#point-x-'+id).fill(String(x));await page.locator('#point-y-'+id).fill(rates[id]);await page.locator(`[data-plot=${id}]`).click();}
  await page.locator('#connectPoints').click();assert.match(await page.locator('#studentGraph .student-curve').getAttribute('d'),/C/);assert.equal(await page.locator('#studentGraph circle').count(),3);
  for(const[id,v]of Object.entries({claim:'increase',leafComparison:'faster',leafConclusion:'promotes',limitations:'indirect'}))await page.locator('#'+id).selectOption(v);
  await page.screenshot({path:'/tmp/vl2-analysis.png',fullPage:true});await page.locator('#submitInvestigation').click();await page.locator('#confirmSubmit').click();
  assert.equal(await page.locator('#learningReveal').isVisible(),true);assert.equal(await page.locator('#rate-D').isDisabled(),true);assert.equal(await page.locator('#rate-D').inputValue(),'0.12');
  assert.equal(await page.locator('#feedbackSummary,#downloadJSON').count(),0);
  assert.equal(await page.locator('#downloadPDF').isDisabled(),true);
  assert.match(await page.locator('#originalHypothesis').innerText(),/將會減少/);
  assert.match(await page.locator('#originalHypothesis').innerText(),/需要量度才能知道/);
  await page.locator('#saveReflection').click();assert.equal(await page.locator('#downloadPDF').isDisabled(),true);
  await page.evaluate(async()=>{window.print=()=>{window.printCalled=true;window.titleAtPrint=document.title;};await document.querySelector('#downloadPDF').onclick();});assert.equal(await page.evaluate(()=>!!window.printCalled),false);assert.match(await page.locator('#mechanismDiagram').innerText(),/木質導管/);
  const anatomy=page.locator('#mechanismDiagram');for(const label of ['角質層','上表皮','柵狀葉肉','海綿葉肉','水膜','氣室','下表皮','保衞細胞','氣孔','維管束','木質部','韌皮部','蒸騰拉力'])assert((await anatomy.innerText()).includes(label));
  assert.equal(await anatomy.locator('.process-card').count(),5);
  assert.equal(await anatomy.locator('.process-card[data-process-group=evaporation]').count(),2);assert.equal(await anatomy.locator('.process-card[data-process-group=pull]').count(),3);
  const processText=(await anatomy.locator('svg').textContent()).replace(/\s/g,'');
  for(const sentence of ['水份從葉肉細胞表面蒸發，並進入氣室中。','氣室內的水汽經氣孔擴散到大氣中。','水份從葉肉細胞散失，細胞的水勢因而下降。','葉肉細胞藉滲透從鄰近細胞吸收水份。','木質導管內的水被抽出，形成蒸騰拉力。'])assert(processText.includes(sentence));
  assert.equal(await anatomy.locator('[data-anatomy=xylem]').evaluate(el=>el.getBBox().y<el.ownerSVGElement.querySelector('[data-anatomy=phloem]').getBBox().y),true);
  assert.equal(await anatomy.locator('[data-anatomy=upper-epidermis]').evaluate(el=>el.getBBox().y<el.ownerSVGElement.querySelector('[data-anatomy=palisade-mesophyll]').getBBox().y),true);
  assert.equal(await anatomy.locator('[data-anatomy=guard-cells]').count(),1);assert.equal(await anatomy.locator('[data-anatomy=stoma]').count(),1);
  for(const layer of ['upper-epidermis','lower-epidermis'])assert.equal(await anatomy.locator(`[data-anatomy=${layer}] .epidermis-cell`).evaluateAll(cells=>cells.every(cell=>cell.querySelector('[data-organelle=vacuole]'))),true);
  assert.equal(await anatomy.locator('[data-anatomy=guard-cells] [data-organelle=vacuole]').count(),2);assert.equal(await anatomy.locator('[data-anatomy=stoma]').getAttribute('stroke'),'none');
  assert.equal(await anatomy.locator('.palisade-cell .cell-wall').evaluateAll(cells=>cells.every((cell,i)=>!i||+cell.getAttribute('x')===+cells[i-1].getAttribute('x')+(+cells[i-1].getAttribute('width')))),true);
  assert.equal(await anatomy.locator('[data-anatomy=stem-xylem]').evaluate(el=>{const leaf=el.ownerSVGElement.querySelector('[data-anatomy=xylem] circle');return ['fill','stroke'].every(attr=>el.getAttribute(attr)===leaf.getAttribute(attr));}),true);
  assert.equal(await anatomy.locator('[data-anatomy=air-space]').count(),1);assert.equal(await anatomy.locator('[data-anatomy=water-film] ellipse').count(),0);assert.equal(await anatomy.locator('[data-anatomy=water-film] path').count(),7);
  assert.equal(await anatomy.locator('circle[fill="#dfa268"],[id$="zoom"]').count(),0);
  assert.equal(await anatomy.locator('marker').count(),2);assert.equal(await anatomy.locator('marker').evaluateAll(markers=>markers.every(marker=>marker.getAttribute('markerUnits')==='userSpaceOnUse'&&+marker.getAttribute('markerWidth')===8)),true);
  await anatomy.locator('svg').screenshot({path:'/tmp/vl2-leaf-desktop.png'});

  await page.locator('#reflection').fill('原始預測不獲支持，數據顯示較強光照下水跡上移較快。');assert.equal(await page.locator('#downloadPDF').isDisabled(),true);await page.locator('#saveReflection').click();assert.equal(await page.locator('#downloadPDF').isDisabled(),false);assert.equal(await page.locator('#reflection').isDisabled(),true);assert.equal(await page.locator('#saveReflection').isDisabled(),true);
  assert.equal(await page.locator('#claim').isDisabled(),true);assert.equal(await page.locator('#claim').inputValue(),'increase');
  const record=await page.evaluate(()=>state);assert.match(record.initialDesign.form.controlPlan,/不帶葉/);assert.equal(record.measurements[10].values.B,'2.9');assert.notEqual(record.measurements[10].firstValues.B,'2.9');
  await page.evaluate(()=>{window.print=()=>{window.printCalled=true;window.titleAtPrint=document.title;};});await page.locator('#downloadPDF').click();await page.waitForFunction(()=>window.printCalled);
  assert.equal(await page.evaluate(()=>window.titleAtPrint),'VL2_西芹的紅色水跡_S4X1-05_陳小明');
  const report=await page.locator('#printReport').innerText();assert(!report.includes('描述可見變化，並把觀察與解釋分開'));assert(!report.includes('探究時的假說與理由'));assert(report.includes('不能代表葉片蒸發水分的速度，即蒸騰速率'));assert.match(await page.locator('#submitDialog').innerText(),/填寫並遞交學習反思/);for(const t of ['此探究的假設是什麼','葉面積','原始預測不獲支持','水膜','氣室','當光強度增加時'])assert(report.includes(t));assert(!report.includes('我的假設解釋'));assert(!report.includes('undefined'));assert(!report.includes('參考回饋'));assert(!report.includes('整體分數'));assert(!report.includes('新知識學習分數'));assert(!report.includes('SPS 總分'));
  assert.match(report,/✓/);assert.match(report,/✕/);
  for(const title of ['你的初步觀察','探究的對照組','原始假說理由','原始假說是否獲數據支持']){const card=page.locator('#printReport .report-answer').filter({has:page.locator('b').filter({hasText:title})}).first();assert.equal(await card.getAttribute('data-graded'),'false');assert.equal(await card.locator('.answer-mark').count(),0);assert.equal(await card.locator('.report-reference').count(),1);}
  const dCard=page.locator('#printReport .report-answer').filter({has:page.locator('b').filter({hasText:'裝置D · 平均上移速度'})});assert.equal(await dCard.locator('.incorrect').count(),1);
  const ivCard=page.locator('#printReport .report-answer').filter({has:page.locator('b').filter({hasText:'獨立變量'})});assert.equal(await ivCard.locator('.correct').count(),1);
  await page.emulateMedia({media:'print'});await page.pdf({path:'/tmp/vl2-report.pdf',format:'A4',printBackground:true});await page.emulateMedia({media:'screen'});await page.evaluate(()=>window.dispatchEvent(new Event('afterprint')));assert.equal(await page.title(),'西芹的紅色水跡｜探究實驗室');
  const parsed=await page.evaluate(()=>state);await fs.writeFile('/tmp/vl2-record.json',JSON.stringify(parsed));assert.equal(parsed.uiVersion,2);assert(parsed.reflectionSubmittedAt);
  const mobile=await context.newPage();await mobile.setViewportSize({width:390,height:844});await mobile.goto(LAB_URL);assert.equal(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  assert.equal(await mobile.locator('#profileDialog').isVisible(),true);await login(mobile,'教師','教師',TEACHER);await mobile.locator('[data-view-record]').first().click();await mobile.locator('#teacherReport .structure-wrap').screenshot({path:'/tmp/vl2-anatomy.png'});await mobile.screenshot({path:'/tmp/vl2-mobile.png',fullPage:true});await mobile.close();
  // The explicit new-investigation button has one confirmation, then login.
  const buttonDialogs=[];const buttonLoad=page.waitForEvent('load');
  const buttonDialog=async d=>{buttonDialogs.push(d.type());assert.equal(d.type(),'confirm');assert.match(d.message(),/開始新的探究/);await d.accept();};
  page.on('dialog',buttonDialog);await page.locator('#newInvestigation').click();await buttonLoad;page.off('dialog',buttonDialog);
  assert.deepEqual(buttonDialogs,['confirm']);assert.equal(await page.locator('#profileDialog').isVisible(),true);assert.equal(await page.locator('#observation').inputValue(),'');
  await login(page,'教師','教師',TEACHER);assert.equal(await page.locator('#teacherDialog').isVisible(),true);assert.equal(await page.locator('#teacherButton').isVisible(),true);
  assert.match(await page.locator('#teacherData').innerText(),/陳小明/);assert(!(await page.locator('#teacherData').innerText()).includes(TEACHER));
  await page.locator('[data-view-record]').first().click();assert.equal(await page.evaluate(()=>{const ids=[...document.querySelectorAll('.structure-svg [id]')].map(e=>e.id);return new Set(ids).size===ids.length;}),true);assert.match(await page.locator('#teacherReport').innerText(),/葉片有助水分向上運輸/);await page.screenshot({path:'/tmp/vl2-teacher.png'});
  await page.evaluate(()=>{
    const perfect=structuredClone(storedRecords()[0]);
    perfect.assumptions=ASSUMPTIONS.filter(a=>a.valid).map(a=>a.id);
    for(const t of [0,10,20,30])for(const id of IDS){perfect.measurements[t].values[id]=String(perfect.model[id][t/10]);}
    for(const id of IDS){perfect.calculations[id]=expectedRate(perfect,id).toFixed(2);perfect.graph.points[id]={x:CONDITIONS[id].light,y:+perfect.calculations[id]};}
    const score=scoringWorkbook([perfect]),row=score.sheet.rows[1];
    const get=id=>row[score.sheet.rows[0].findIndex(c=>c.value.startsWith(id))].value;
    for(const [heading,max] of [['觀察｜量尺',2],['分類｜獨立',1],['分類｜因變',1],['分類｜控制',2],['設計｜假設',1],['實作｜四輪',2],['推論｜平均',2],['推論｜四項',2],['溝通｜標點',2]])if(get(heading)!==max)throw new Error('Perfect score mismatch: '+heading);
    const old=structuredClone(perfect);delete old.rateDecimals;
    for(const id of IDS)old.calculations[id]=expectedRate(old,id).toFixed(3);
    if(rateTolerance(old)!==.00051||rateTolerance(perfect)!==.0051)throw new Error('Legacy precision changed');
    if(rateReference(old,'A')!==expectedRate(old,'A').toFixed(3)+' cm/min')throw new Error('Legacy rate formatting changed');
    const oldScore=scoringWorkbook([old]);if(oldScore.sheet.rows[1][18].value!==2)throw new Error('Legacy correct calculations lost credit');
    const empty=freshState();const blank=scoringWorkbook([empty]);
    for(const cell of blank.sheet.rows[1])if(typeof cell.value==='number'&&cell.value!==0)throw new Error('Unanswered work must receive no automatic points');
  });
  const xd=page.waitForEvent('download');await page.locator('#exportExcel').click();await(await xd).saveAs('/tmp/vl2-records.xlsx');
  execFileSync('python',['tests/excel_scores.py'],{stdio:'inherit'});
  // Teacher login after a submitted student attempt creates its own playable
  // demonstration. Complete the same UI flow without changing student records.
  const beforeDemo=await page.evaluate(()=>JSON.stringify(storedRecords()));
  assert.equal(await page.evaluate(()=>state.profile.email),TEACHER);assert.equal(await page.locator('main').evaluate(el=>el.inert),false);
  await page.locator('#teacherDemo').click();assert.equal(await page.locator('#teacherDialog').isVisible(),false);assert.equal(await page.locator('#phase-1').isVisible(),true);assert.equal(await page.locator('#observation').inputValue(),'');assert.equal(await page.locator('#observation').isDisabled(),false);
  await page.locator('#observation').fill('教師示範：觀察紅色水跡向上延伸。');await page.locator('#orientationNext').click();
  await page.locator('#prediction').selectOption('increase');await page.locator('#reason').fill('教師示範：用數據檢驗光照與水分運輸的關係。');
  await page.locator('[data-group=iv]').first().click();await page.locator('[data-group=dv]').nth(1).click();for(let i=2;i<7;i++)await page.locator('[data-group=cv]').nth(i).click();
  for(const v of ['temperature','equalArea','air'])await page.locator(`#assumptionChoices input[value=${v}]`).check();
  await page.locator('#controlPlan').fill('示範：裝置D 不帶葉，與同距離的裝置B 比較。');await page.locator('#setupDescription').fill('四株西芹，各浸紅色水2cm；帶葉組燈距10、20、30cm，不帶葉組20cm。');await page.locator('#saveSetup').click();await page.locator('#designNext').click();
  for(const t of [0,10,20,30]){const model=await page.evaluate(()=>state.model);for(const id of ['A','B','C','D'])await page.locator(`[data-time="${t}"][data-measure="${id}"]`).fill(model[id][t/10].toFixed(1));await page.locator('#recordMeasurements').click();if(t<30){await page.locator('#timerButton').click();await page.waitForFunction(time=>state.currentTime===time&&!state.running,t+10);}}
  await page.locator('#experimentNext').click();const demoRates=await page.evaluate(()=>Object.fromEntries(IDS.map(id=>[id,expectedRate(state,id).toFixed(2)])));
  for(const[id,x]of Object.entries({A:1200,B:300,C:133,D:300})){await page.locator('#rate-'+id).fill(demoRates[id]);await page.locator('#point-x-'+id).fill(String(x));await page.locator('#point-y-'+id).fill(demoRates[id]);await page.locator(`[data-plot=${id}]`).click();}
  await page.locator('#connectPoints').click();for(const[id,v]of Object.entries({claim:'increase',leafComparison:'faster',leafConclusion:'promotes',limitations:'indirect'}))await page.locator('#'+id).selectOption(v);
  await page.locator('#submitInvestigation').click();await page.locator('#confirmSubmit').click();assert.equal(await page.locator('#learningReveal').isVisible(),true);
  await page.locator('#reflection').fill('教師示範：數據支持原始假說；光照促進氣孔開啟，蒸騰拉力牽引水份沿木質導管向上運輸。');await page.locator('#saveReflection').click();assert.equal(await page.locator('#downloadPDF').isDisabled(),false);assert.equal(await page.locator('.complete-bar').isVisible(),true);await page.evaluate(()=>{window.print=()=>window.demoPrinted=true;});await page.locator('#downloadPDF').click();await page.waitForFunction(()=>window.demoPrinted);assert.match(await page.locator('#printReport').innerText(),/教師示範：觀察紅色水跡/);await page.evaluate(()=>window.dispatchEvent(new Event('afterprint')));
  assert.equal(await page.evaluate(()=>JSON.stringify(storedRecords())),beforeDemo);assert.equal(await page.evaluate(()=>storedRecords().some(r=>isTeacher(r.profile))),false);
  await page.locator('#teacherButton').click();assert.equal(await page.locator('#teacherDialog').isVisible(),true);assert.match(await page.locator('#teacherData').innerText(),/陳小明/);assert(!(await page.locator('#teacherData').innerText()).includes('教師示範'));
  const demoExport=page.waitForEvent('download');await page.locator('#exportExcel').click();await(await demoExport).saveAs('/tmp/vl2-after-demo.xlsx');assert((await fs.readFile('/tmp/vl2-records.xlsx')).equals(await fs.readFile('/tmp/vl2-after-demo.xlsx')));
  await reloadToLogin(page);assert.equal(await page.locator('#teacherDialog').isVisible(),false);await login(page,'教師','教師',TEACHER);assert.equal(await page.locator('#teacherDialog').isVisible(),true);await page.locator('#closeTeacher').click();await page.locator('#profileButton').click();await login(page,'另一位同學','S4X1-06','p013@example.edu.hk');
  assert.equal(await page.locator('#teacherButton').isVisible(),false);assert.equal(await page.locator('#phase-1').isVisible(),true);assert.equal(await page.locator('#observation').isDisabled(),false);assert.equal(await page.evaluate(()=>storedRecords().filter(r=>r.submitted).length),1);
  // Every explicit login starts a new attempt, even for the same learner.
  await page.locator('#observation').fill('第二位學生自己的初步觀察');await page.locator('#orientationNext').click();
  const secondId=await page.evaluate(()=>state.id);
  await page.locator('#profileButton').click();await login(page,'共用電郵另一位','S4X1-07','p013@example.edu.hk');
  assert.equal(await page.locator('#phase-1').isVisible(),true);assert.equal(await page.locator('#observation').inputValue(),'');assert.equal(await page.locator('#observation').isDisabled(),false);assert.notEqual(await page.evaluate(()=>state.id),secondId);
  await page.locator('#profileButton').click();await login(page,'另一位同學','S4X1-06','p013@example.edu.hk');
  assert.notEqual(await page.evaluate(()=>state.id),secondId);assert.equal(await page.locator('#phase-1').isVisible(),true);assert.equal(await page.locator('#observation').inputValue(),'');assert.equal(await page.evaluate(id=>storedRecords().find(r=>r.id===id).form.observation,secondId),'第二位學生自己的初步觀察');assert.equal(await page.locator('#prediction').isDisabled(),false);
  // Explicit login after completing an attempt creates an editable attempt;
  // old completed and unfinished attempts remain available to teachers.
  await page.locator('#profileButton').click();await login(page,'陳小明','S4X1-05','p012@example.edu.hk');
  assert.notEqual(await page.evaluate(()=>state.id),record.id);assert.equal(await page.locator('.step.done').count(),0);assert.equal(await page.locator('#phase-1').isVisible(),true);assert.equal(await page.locator('#observation').isDisabled(),false);assert.equal(await page.locator('#observation').inputValue(),'');
  assert.equal(await page.evaluate(id=>storedRecords().find(r=>r.id===id).submitted,record.id),true);
  await page.locator('#observation').fill('重新登入後可開始新探究');await page.locator('#orientationNext').click();assert.equal(await page.locator('#phase-2').isVisible(),true);
  // Legacy records with no email must not transfer answers to a new profile.
  const legacyContext=await browser.newContext(),legacyPage=await legacyContext.newPage();legacyPage.on('pageerror',e=>errors.push(e.message));
  const noEmail=structuredClone(parsed);delete noEmail.profile.email;
  await legacyContext.addInitScript(r=>{localStorage.setItem('transpirationLab.current.v1',JSON.stringify(r));localStorage.setItem('transpirationLab.records.v1',JSON.stringify([r]));localStorage.removeItem('transpirationLab.profile.v1');},noEmail);
  await legacyPage.goto(LAB_URL);await login(legacyPage,'新學生','S4X2-01','new@example.edu.hk');
  assert.equal(await legacyPage.locator('#observation').inputValue(),'');assert.equal(await legacyPage.locator('#observation').isDisabled(),false);assert.notEqual(await legacyPage.evaluate(()=>state.id),parsed.id);assert.equal(await legacyPage.evaluate(()=>storedRecords().some(r=>r.submitted)),true);await legacyContext.close();
  // A stale active profile/current-record mismatch also recovers on page load.
  const staleContext=await browser.newContext(),stalePage=await staleContext.newPage();stalePage.on('pageerror',e=>errors.push(e.message));
  await staleContext.addInitScript(r=>{localStorage.setItem('transpirationLab.current.v1',JSON.stringify(r));localStorage.setItem('transpirationLab.records.v1',JSON.stringify([r]));localStorage.setItem('transpirationLab.profile.v1',JSON.stringify({name:'另一位學生',classInfo:'S4X2-02',email:'other@example.edu.hk'}));},parsed);
  await stalePage.goto(LAB_URL);assert.equal(await stalePage.locator('#observation').inputValue(),'');assert.equal(await stalePage.locator('#observation').isDisabled(),false);assert.equal(await stalePage.locator('#profileDialog').isVisible(),true);assert.equal(await stalePage.evaluate(()=>activeProfile),null);await login(stalePage,'另一位學生','S4X2-02','other@example.edu.hk');assert.equal(await stalePage.evaluate(()=>state.profile.email),'other@example.edu.hk');await staleContext.close();
  // Cancel keeps the current attempt; accepting reload saves it, returns to
  // blank login, and the same identity starts a new empty attempt.
  const beforeReloadId=await page.evaluate(()=>state.id);
  const cancelled=page.waitForEvent('dialog');await page.evaluate(()=>{setTimeout(()=>location.reload(),0);});
  const cancelDialog=await cancelled;assert.equal(cancelDialog.type(),'beforeunload');await cancelDialog.dismiss();
  assert.equal(await page.evaluate(()=>state.id),beforeReloadId);assert.equal(await page.locator('#phase-2').isVisible(),true);assert.equal(await page.locator('#profileDialog').isVisible(),false);
  await reloadToLogin(page);assert.equal(await page.evaluate(id=>storedRecords().find(r=>r.id===id).form.observation,beforeReloadId),'重新登入後可開始新探究');
  await login(page,'陳小明','S4X1-05','p012@example.edu.hk');assert.notEqual(await page.evaluate(()=>state.id),beforeReloadId);assert.equal(await page.locator('#phase-1').isVisible(),true);assert.equal(await page.locator('#observation').inputValue(),'');assert.equal(await page.locator('#observation').isDisabled(),false);assert.equal(await page.locator('#downloadPDF').isDisabled(),true);
  await page.locator('#observation').fill('重新載入後的新探究');await page.locator('#orientationNext').click();assert.equal(await page.locator('#phase-2').isVisible(),true);
  const other=await browser.newContext({viewport:{width:1280,height:900}}),teacher=await other.newPage();teacher.on('pageerror',e=>errors.push(e.message));await teacher.goto(LAB_URL);await login(teacher,'教師','教師',TEACHER);
  await teacher.locator('#importRecords').setInputFiles('/tmp/vl2-record.json');await teacher.waitForFunction(()=>document.querySelector('#importStatus').textContent.includes('已處理 1'));assert.match(await teacher.locator('#teacherData').innerText(),/陳小明/);
  const legacy=structuredClone(parsed);legacy.id+='-legacy';delete legacy.uiVersion;legacy.form.evidence='先前版本的證據文字';delete legacy.form.leafComparison;legacy.variables.iv=['光照強度'];legacy.profile.name='舊版同學';await fs.writeFile('/tmp/vl2-legacy-import.json',JSON.stringify(legacy));
  await teacher.locator('#importRecords').setInputFiles('/tmp/vl2-legacy-import.json');await teacher.waitForFunction(()=>document.querySelector('#teacherData').textContent.includes('舊版同學'));assert.equal(await teacher.evaluate(()=>storedRecords().find(r=>r.profile.name==='舊版同學').form.evidence),'先前版本的證據文字');
  assert.deepEqual(errors,[]);await other.close();console.log('PASS: revised student flow, one-decimal readings, 0.5 steps, horizontal ruler, equal dye, autoscroll, fixed axes, smooth curve, general formula and recorded distances, two-decimal rates/score tolerance, print filename, structured answers, anatomy, reflection submission gate, original hypothesis, inline PDF ticks/crosses and ungraded open answers, teacher full demonstration and unchanged student Excel, teacher login/switch/reload, completed/legacy/shared-email learner isolation and fresh login on every reload, cancel/accept beforeunload and old record retention, single graph legend, front-facing lamp, XLSX drawings, JSON import, old records, mobile.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
