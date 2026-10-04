const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const {execFileSync}=require('node:child_process');

(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
  const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true,reducedMotion:'reduce'});
  const page=await context.newPage();const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  try{
    await page.goto('http://127.0.0.1:8000');
    await page.locator('#profileName').fill('P012');await page.locator('#profileClass').fill('S4X1');
    await page.locator('#profileForm button[type=submit]').click();
    await page.screenshot({path:'/tmp/vl2-orientation.png',fullPage:true});
    await page.locator('#orientationNext').click();
    assert.equal(await page.locator('#phase-1').isVisible(),true,'empty observation must block progress');
    await page.locator('#observation').fill('西芹長柄內出現向上延伸的紅色水跡。');
    await page.locator('#orientationNext').click();
    await page.locator('#designNext').click();
    assert.equal(await page.locator('#phase-2').isVisible(),true,'incomplete design must block progress');
    await page.locator('#prediction').selectOption('decrease');
    await page.locator('#reason').fill('我預測強光可能令水跡變慢，需要量度才能知道。');
    await page.locator('[data-group=iv]').first().click();
    await page.locator('[data-group=dv]').nth(1).click();
    for(let i=2;i<7;i++)await page.locator('[data-group=cv]').nth(i).click();
    await page.locator('#assumptionChoices input[value=temperature]').check();
    await page.locator('#assumptionChoices input[value=equalArea]').check();
    await page.locator('#assumptionChoices input[value=areaIrrelevant]').check();
    await page.locator('#assumptionReason').fill('若溫度不同，就不能確定差異由光照造成。');
    await page.locator('#controlNeed').fill('需要對照，以比較葉片有無。');
    await page.locator('#controlPlan').fill('先用相同光照比較一株帶葉和一株無葉西芹。');
    await page.locator('#saveControl').click();
    await page.locator('#controlPlan').fill('修訂後：無葉西芹放在 20 cm，与 B 比較。');
    await page.locator('#controlPair').selectOption('B');
    await page.locator('#controlConstants').fill('燈距、濕度、氣流、溫度、西芹長柄粗幼相同。');
    await page.locator('#setupDescription').fill('四個裝置：A 帶葉10cm，B 帶葉20cm，C 帶葉30cm，D 無葉20cm。浸入紅色水2cm，尺子0對準水面。');
    await page.locator('#saveSetup').click();await page.locator('#designNext').click();
    assert.equal(await page.locator('#phase-3').isVisible(),true);
    assert.equal(await page.locator('#timerButton').isDisabled(),true);
    assert.equal(await page.locator('#experimentNext').isDisabled(),true);
    await page.locator('[data-align=A]').click();
    assert.match(await page.locator('[data-ruler=A]').getAttribute('transform'),/-30,0/);
    for(const time of [0,10,20,30]){
      const model=await page.evaluate(()=>state.model);
      for(const id of ['A','B','C','D'])await page.locator(`[data-time="${time}"][data-measure="${id}"]`).fill(String(model[id][time/10]));
      await page.locator('#recordMeasurements').click();
      if(time===10){
        const input=page.locator('[data-time="10"][data-measure="B"]');
        await input.fill('2.9');assert.equal(await page.locator('#timerButton').isDisabled(),true);
        await page.locator('#recordMeasurements').click();
      }
      if(time<30){
        await page.locator('#timerButton').click();
        await page.waitForFunction(t=>state.currentTime===t&&!state.running,time+10);
      }
    }
    await page.screenshot({path:'/tmp/vl2-experiment.png',fullPage:true});
    await page.locator('#experimentNext').click();
    const rates=await page.evaluate(()=>Object.fromEntries(IDS.map(id=>[id,expectedRate(state,id).toFixed(3)])));
    rates.D='0.120'; // Deliberately wrong: the platform must preserve it, then explain it after submission.
    for(const id of ['A','B','C','D'])await page.locator('#rate-'+id).fill(rates[id]);
    await page.locator('#xAxis').selectOption('light');await page.locator('#yAxis').selectOption('rate');
    for(const[id,x]of Object.entries({A:1200,B:300,C:133,D:300})){
      await page.locator('#point-x-'+id).fill(String(x));await page.locator('#point-y-'+id).fill(rates[id]);
      await page.locator(`[data-plot=${id}]`).click();
    }
    await page.locator('#connectPoints').click();
    assert.equal(await page.locator('#studentGraph polyline').count(),1);
    assert.equal(await page.locator('#studentGraph circle').count(),3,'D must not be a leafy series point');
    for(const[id,text]of Object.entries({claim:'光照較強的裝置水跡上移較快。',evidence:`A 1200 lux 是 ${rates.A} cm/min，C 133 lux 是 ${rates.C} cm/min。`,leafConclusion:'B 與 D 在相同光照下結果不同，支持葉片參與水分運輸。',limitations:'染料上移不是直接水分散失量，亦不能單獨證明氣孔作用。'}))await page.locator('#'+id).fill(text);
    await page.screenshot({path:'/tmp/vl2-analysis.png',fullPage:true});
    await page.locator('#submitInvestigation').click();await page.locator('#confirmSubmit').click();
    assert.equal(await page.locator('#learningReveal').isVisible(),true);
    assert.equal(await page.locator('#rate-D').isDisabled(),true);
    assert.equal(await page.locator('#rate-D').inputValue(),'0.120','incorrect calculation must be preserved');
    assert.equal(await page.locator('#reason').inputValue(),'我預測強光可能令水跡變慢，需要量度才能知道。');
    assert.match(await page.locator('#feedbackSummary').innerText(),/不合理/);
    await page.locator('#reflection').fill('原始預測不獲支持，數據顯示較強光照下水跡上移較快。');await page.locator('#saveReflection').click();
    await page.reload();
    assert.equal(await page.locator('#learningReveal').isVisible(),true,'submission must survive reload');
    assert.equal(await page.locator('#rate-D').isDisabled(),true);
    assert.match(await page.locator('#reflection').inputValue(),/原始預測/);
    const record=await page.evaluate(()=>state);
    assert.equal(record.initialControl.plan,'先用相同光照比較一株帶葉和一株無葉西芹。');
    assert.equal(record.measurements[10].values.B,'2.9');
    assert.notEqual(record.measurements[10].firstValues.B,'2.9');
    await page.evaluate(()=>{window.print=()=>window.printCalled=true;});
    await page.locator('#downloadPDF').click();await page.waitForFunction(()=>window.printCalled);
    const report=await page.locator('#printReport').innerText();
    assert.match(report,/此探究的假設是什麼/);assert.match(report,/我的假設解釋/);assert.match(report,/葉面積/);
    assert.match(report,/原始預測不獲支持/);assert(!report.includes('undefined'));
    await page.emulateMedia({media:'print'});
    await page.pdf({path:'/tmp/vl2-report.pdf',format:'A4',printBackground:true});
    await page.emulateMedia({media:'screen'});
    const jsonDownload=page.waitForEvent('download');await page.locator('#downloadJSON').click();
    const jsonFile=await jsonDownload;await jsonFile.saveAs('/tmp/vl2-record.json');
    const parsed=JSON.parse(await fs.readFile('/tmp/vl2-record.json','utf8'));assert.equal(parsed.submitted,true);
    await page.locator('#recordsButton').click();
    const excelDownload=page.waitForEvent('download');await page.locator('#exportExcel').click();
    await(await excelDownload).saveAs('/tmp/vl2-records.xlsx');
    execFileSync('python',['-c',`from zipfile import ZipFile\nfrom xml.etree import ElementTree as ET\nwith ZipFile('/tmp/vl2-records.xlsx') as z:\n assert z.testzip() is None\n for n in z.namelist(): ET.fromstring(z.read(n))\n assert len([n for n in z.namelist() if n.startswith('xl/worksheets/')])==3\n`]);
    await page.locator('#closeRecords').click();
    // Phone layout and touch alternative.
    const mobile=await context.newPage();await mobile.setViewportSize({width:390,height:844});await mobile.goto('http://127.0.0.1:8000');
    await mobile.screenshot({path:'/tmp/vl2-mobile.png',fullPage:true});
    assert.equal(await mobile.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true,'mobile page must not overflow horizontally');
    await mobile.locator('[data-phase="3"]').click();assert.equal(await mobile.locator('[data-align=D]').isDisabled(),true);
    // Import from another device and ensure a real record is visible.
    const other=await browser.newContext({viewport:{width:1280,height:900}});const teacher=await other.newPage();
    await teacher.goto('http://127.0.0.1:8000');await teacher.locator('#profileName').fill('資料整理');await teacher.locator('#profileForm button[type=submit]').click();
    await teacher.locator('#recordsButton').click();await teacher.locator('#importRecords').setInputFiles('/tmp/vl2-record.json');
    await teacher.waitForFunction(()=>document.querySelector('#importStatus').textContent.includes('已處理 1'));
    assert.match(await teacher.locator('#recordsBody').innerText(),/P012/);
    assert.deepEqual(errors,[],'no browser errors');
    console.log('PASS: full inquiry, gates, measurements/revisions, graph, locked submission, reload, PDF, JSON, XLSX, import and mobile layout.');
    console.log('Artifacts: /tmp/vl2-orientation.png, /tmp/vl2-experiment.png, /tmp/vl2-analysis.png, /tmp/vl2-mobile.png, /tmp/vl2-report.pdf, /tmp/vl2-records.xlsx');
    await other.close();
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
