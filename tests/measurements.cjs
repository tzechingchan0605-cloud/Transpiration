// Real measurement controls and animations; never send synthetic pupils to Google.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const EXPECTED={A:[0,4,8,12],B:[0,2.5,5,7.5],C:[0,1.5,3,4.5],D:[0,.5,1,1.5]};
const RATE={A:.4,B:.25,C:.15,D:.05};
const TIMES=[0,10,20,30],IDS=['A','B','C','D'];
const LAB_URL=process.env.LAB_URL||'http://127.0.0.1:8000';

(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
  const errors=[],cloudRequests=[];
  try{
    async function open(options={}){
      const context=await browser.newContext({reducedMotion:'reduce',...options});
      await context.route('**/cloud-config.js*',route=>route.fulfill({contentType:'application/javascript',body:"window.VL2_CLOUD_CONFIG={endpoint:'',transport:'bridge'};"}));
      await context.route(/https:\/\/(?:script\.google\.com|[^/]*script\.googleusercontent\.com)\//,route=>{cloudRequests.push(route.request().url());return route.abort();});
      const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));await page.goto(LAB_URL);return page;
    }
    async function enterExperiment(page,email){
      for(const[id,value]of Object.entries({profileName:'讀數互動測試',profileClass:'S4-01',profileEmail:email}))await page.locator('#'+id).fill(value);
      await page.locator('#profileForm button[type=submit]').click();
      // The full inquiry gates are covered by smoke.cjs. This test isolates the
      // actual phase-3 input controls and runInterval animation without guessing answers.
      await page.evaluate(()=>{state.unlocked=3;phase(3);renderBench();renderMeasurements();});
    }
    const input=(page,time,id)=>page.locator(`[data-time="${time}"][data-measure="${id}"]`);
    async function assertFocus(locator,message){assert.equal(await locator.evaluate(el=>el===document.activeElement),true,message);}
    async function assertDye(page,time){
      for(const id of IDS){
        const columns=await page.locator(`#specimen-${id} .dye-column`).evaluateAll(nodes=>nodes.map(el=>({y:+el.getAttribute('y'),height:+el.getAttribute('height')})));
        assert.equal(columns.length,2);
        for(const column of columns){assert.equal(column.y,330-EXPECTED[id][time/10]*18,`裝置${id}, ${time} min: ruler position`);assert.equal(column.height,36+EXPECTED[id][time/10]*18,`裝置${id}, ${time} min: dye height`);}
      }
    }

    const page=await open({viewport:{width:1440,height:1000}});
    const fresh=await page.evaluate(()=>{
      const attempts=Array.from({length:32},()=>freshState());
      const models=attempts.map(attempt=>structuredClone(attempt.model));
      attempts[0].model.A[1]=99;
      return {models,ids:attempts.map(attempt=>attempt.id),other:attempts[1].model,newModel:freshState().model};
    });
    assert.equal(new Set(fresh.ids).size,fresh.ids.length,'attempt IDs remain unique although measurements are fixed');
    for(const model of fresh.models){
      assert.deepEqual(model,EXPECTED,'every new attempt uses the same reference measurements');
      for(const id of IDS)for(const time of TIMES){
        const distance=model[id][time/10];assert.equal(distance*2,Math.round(distance*2),'model height is a multiple of 0.5 cm');
        if(time)assert.equal(distance/time,RATE[id],`裝置${id}: constant distance/time ratio`);
      }
    }
    assert.deepEqual(fresh.other,EXPECTED,'attempts have independent arrays');assert.deepEqual(fresh.newModel,EXPECTED,'editing one model cannot change future attempts');

    const legacy=await page.evaluate(()=>{
      const record=freshState({name:'舊紀錄',classInfo:'S4-old',email:'legacy-measure@example.edu.hk'});
      record.model={A:[0,3.5,7,10.5],B:[0,2,4.5,7],C:[0,1.5,3,5],D:[0,.5,1,2]};
      record.savedAt='2026-09-01T00:00:00.000Z';record.currentTime=10;
      record.measurements[10]={values:{A:'3.5',B:'2.9',C:'1.5',D:'0.5'},firstValues:{A:'3.5',B:'2.0',C:'1.5',D:'0.5'},confirmed:true};
      localStorage.setItem(RECORDS_KEY,JSON.stringify([record]));
      const read=storedRecords().find(item=>item.id===record.id);
      return {record,read,raw:JSON.parse(localStorage.getItem(RECORDS_KEY))};
    });
    assert.deepEqual(legacy.read.model,legacy.record.model,'old reference heights must not be replaced');
    assert.deepEqual(legacy.read.measurements,legacy.record.measurements,'old answers and first readings remain intact');
    assert.deepEqual(legacy.raw,[legacy.record],'reading old records does not rewrite the backup');

    await enterExperiment(page,'measurement-test@example.edu.hk');
    assert.deepEqual(await page.evaluate(()=>state.model),EXPECTED);await assertDye(page,0);
    const first=input(page,0,'A');
    for(const value of ['','17','0.05']){
      await first.fill(value);await first.press('Enter');await assertFocus(first,'invalid or blank entry keeps focus');
      assert.equal(await page.evaluate(()=>!!state.measurements[0]?.confirmed),false);assert.equal(await page.evaluate(()=>state.currentTime),0);
    }
    // Some browsers report IME confirmation as Enter; Safari can finish the
    // composition before keydown while still setting the legacy keyCode to229.
    for(const composition of [{isComposing:true,keyCode:13},{isComposing:false,keyCode:229}]){
      await first.fill('0.0');
      await first.evaluate((el,properties)=>el.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true,...properties})),composition);
      await assertFocus(first,'IME confirmation must not advance measurement focus');
      assert.equal(await page.evaluate(()=>!!state.measurements[0]?.confirmed),false,'IME confirmation cannot record the row');
    }
    await first.fill('0.0');await first.press('ArrowUp');assert.equal(await first.inputValue(),'0.5');await first.press('ArrowDown');assert.equal(await first.inputValue(),'0.0');

    for(const time of TIMES){
      const before=await page.evaluate(()=>state.id);
      for(const prior of TIMES.filter(value=>value<time))for(const id of IDS)assert.equal(await input(page,prior,id).isDisabled(),true,'completed earlier rows stay disabled');
      for(let index=0;index<IDS.length;index++){
        const id=IDS[index],field=input(page,time,id);await field.fill(String(EXPECTED[id][time/10]));await field.press('Enter');
        await assertFocus(index<3?input(page,time,IDS[index+1]):page.locator('#recordMeasurements'),'Enter advances through the current row, then focuses confirmation');
        assert.equal(await field.inputValue(),EXPECTED[id][time/10].toFixed(1),'leaving the field formats one decimal place');
      }
      assert.equal(await page.evaluate(time=>!!state.measurements[time]?.confirmed,time),false,'Enter on D must not automatically confirm');
      assert.equal(await page.evaluate(()=>state.currentTime),time);assert.equal(await page.evaluate(()=>state.running),false);assert.equal(await page.evaluate(()=>state.submitted),false);assert.equal(await page.evaluate(()=>state.id),before);
      await page.locator('#recordMeasurements').click();assert.equal(await page.evaluate(time=>state.measurements[time].confirmed,time),true);
      if(time<30){
        await page.locator('#timerButton').click();
        assert.equal(await input(page,time,'A').isDisabled(),true,'measurement inputs lock during the simulation');
        await page.waitForFunction(next=>state.currentTime===next&&!state.running,time+10);await assertDye(page,time+10);
      }
    }
    // Editing a mistaken current-row answer remains allowed; it must preserve
    // the first confirmed value rather than silently snap the student's answer.
    const finalA=input(page,30,'A');await finalA.fill('11.9');await finalA.press('Enter');await assertFocus(input(page,30,'B'));
    assert.equal(await finalA.inputValue(),'11.9');assert.equal(await page.evaluate(()=>state.measurements[30].firstValues.A),'12.0');
    assert.equal(await page.evaluate(()=>state.measurements[30].confirmed),false);await page.locator('#recordMeasurements').click();
    assert.equal(await page.evaluate(()=>state.measurements[30].values.A),'11.9');
    await page.locator('.data-card').screenshot({path:'/tmp/vl2-fixed-measurements.png'});
    assert.deepEqual(await page.evaluate(id=>storedRecords().find(record=>record.id===id).model,legacy.record.id),legacy.record.model,'a new inquiry still preserves the old attempt model');
    await page.evaluate(()=>{state.submitted=true;applyLock();});for(const id of IDS)assert.equal(await input(page,30,id).isDisabled(),true,'submitted measurements are locked');

    // A separate phone/browser gets the same model and can navigate its own row.
    const phone=await open({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
    await enterExperiment(phone,'measurement-phone@example.edu.hk');assert.deepEqual(await phone.evaluate(()=>state.model),EXPECTED);
    for(let index=0;index<IDS.length;index++){
      const field=input(phone,0,IDS[index]);await field.fill('0');await field.press('Enter');
      await assertFocus(index<3?input(phone,0,IDS[index+1]):phone.locator('#recordMeasurements'));
    }
    assert.equal(await phone.evaluate(()=>!!state.measurements[0]?.confirmed),false);assert.equal(await phone.evaluate(()=>state.running),false);
    assert.deepEqual(errors,[]);assert.deepEqual(cloudRequests,[],'no synthetic measurements reach the real collector');
    console.log('PASS: identical half-step models and constant apparatus speeds, unique attempts and independent arrays, preserved legacy measurements, valid/invalid Enter navigation, no automatic confirmation, disabled prior/running/submitted rows, actual 10/20/30-minute dye/ruler positions, retained wrong answers, and a separate phone browser.');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
