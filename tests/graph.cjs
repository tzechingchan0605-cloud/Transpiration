// Exercise real mouse/touch plotting with a disabled live collector.
const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 const errors=[];
 try{
  async function open(options){
   const context=await browser.newContext(options);
   await context.route('**/cloud-config.js*',r=>r.fulfill({contentType:'application/javascript',body:"window.VL2_CLOUD_CONFIG={endpoint:''};"}));
   const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(process.env.LAB_URL||'http://127.0.0.1:8000');
   for(const[id,value]of Object.entries({profileName:'圖表測試',profileClass:'S4-01',profileEmail:'graph-test@example.com'}))await p.locator('#'+id).fill(value);
   await p.locator('#profileForm button[type=submit]').click();
   await p.evaluate(()=>{state.unlocked=4;phase(4);});await p.locator('#studentGraph').scrollIntoViewIfNeeded();return p;
  }
  async function position(p,x,y){return p.locator('#studentGraph').evaluate((svg,{x,y})=>{const pt=new DOMPoint(90+x/1300*587,362-y/.5*335).matrixTransform(svg.getScreenCTM());return {x:pt.x,y:pt.y};},{x,y});}
  async function clickAt(p,x,y){const pt=await position(p,x,y);await p.mouse.click(pt.x,pt.y);}
  const p=await open({viewport:{width:1440,height:1000}});
  const before=await p.evaluate(()=>({graph:JSON.stringify(state.graph),events:state.events.length}));
  let pos=await position(p,650,.20);await p.mouse.move(pos.x,pos.y);
  assert.match(await p.locator('#graphCoordinates').innerText(),/X = 650 lux；Y = 0.20/);
  assert.equal(await p.locator('#graphPointerGuide').getAttribute('visibility'),'visible');
  assert.deepEqual(await p.evaluate(()=>({graph:JSON.stringify(state.graph),events:state.events.length})),before,'hover must not save/log points');
  const margin=await p.locator('#studentGraph').evaluate(svg=>{const pt=new DOMPoint(30,200).matrixTransform(svg.getScreenCTM());return {x:pt.x,y:pt.y};});await p.mouse.click(margin.x,margin.y);assert.equal(await p.evaluate(()=>Object.keys(state.graph.points).length),0,'axis label margins cannot place');
  await p.locator('#plotDevice').selectOption('B');await clickAt(p,310,.27);
  let point=await p.evaluate(()=>state.graph.points.B);assert(Math.abs(point.x-310)<=1);assert.equal(point.y,.27);assert.equal(await p.evaluate(()=>Object.keys(state.graph.points).length),1);assert.equal(await p.locator('#point-y-B').inputValue(),'0.27');
  await p.locator('#plotDevice').selectOption('A');const pointsBefore=await p.evaluate(()=>JSON.stringify(state.graph.points));await p.locator('[data-graph-point=B] .plot-mark').click();assert.equal(await p.locator('#plotDevice').inputValue(),'B');assert.equal(await p.locator('#point-x-B').evaluate(el=>el===document.activeElement),true);assert.equal(await p.evaluate(()=>JSON.stringify(state.graph.points)),pointsBefore,'select existing point without moving it');
  await p.locator('#point-x-B').fill('300');await p.locator('#point-y-B').fill('0.250');await p.locator('[data-plot=B]').click();assert.deepEqual(await p.evaluate(()=>state.graph.points.B),{x:300,y:.25});assert.equal(await p.locator('#point-y-B').inputValue(),'0.25');
  for(const[id,x,y]of [['A',1200,.35],['C',133,.16],['D',300,.05]]){await p.locator('#point-x-'+id).fill(String(x));await p.locator('#point-y-'+id).fill(String(y));await p.locator('[data-plot='+id+']').click();}
  await p.locator('#connectPoints').click();const oldCurve=await p.locator('.student-curve').getAttribute('d');await p.locator('#point-y-B').fill('0.24');await p.locator('[data-plot=B]').click();assert.notEqual(await p.locator('.student-curve').getAttribute('d'),oldCurve);assert.equal(await p.locator('[data-graph-point=D] path.plot-mark').count(),1);
  const report=await p.evaluate(()=>graphMarkup(state));assert(!report.includes('data-graph-point'));assert(!report.includes('graphPointerGuide'));
  await p.locator('#studentGraph').scrollIntoViewIfNeeded();pos=await position(p,700,.31);await p.mouse.move(pos.x,pos.y);await p.mouse.move(0,0);assert.equal(await p.locator('#graphPointerGuide').getAttribute('visibility'),'hidden');
  await p.screenshot({path:'/tmp/vl2-mouse-graph.png',fullPage:true});
  await p.evaluate(()=>{state.submitted=true;applyLock();});assert.equal(await p.locator('#plotDevice').isDisabled(),true);const locked=await p.evaluate(()=>JSON.stringify(state.graph));await clickAt(p,550,.32);await p.evaluate(()=>{placeGraphPoint('A',100,.1,'mouse');document.querySelector('[data-plot=A]').onclick();});assert.equal(await p.evaluate(()=>JSON.stringify(state.graph)),locked);assert.equal(await p.locator('[data-graph-point]').count(),0);
  const mobile=await open({viewport:{width:390,height:844},hasTouch:true,isMobile:true});await mobile.locator('#plotDevice').selectOption('C');pos=await position(mobile,123,.17);await mobile.touchscreen.tap(pos.x,pos.y);point=await mobile.evaluate(()=>state.graph.points.C);assert(point);assert(Math.abs(point.x-123)<6);assert(Math.abs(point.y-.17)<=.01);assert.equal(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await mobile.locator('#point-x-C').fill('133');await mobile.locator('#point-y-C').fill('0.16');await mobile.locator('[data-plot=C]').click();assert.deepEqual(await mobile.evaluate(()=>state.graph.points.C),{x:133,y:.16});
  await mobile.locator('#clearGraph').click();assert.equal(await mobile.locator('#plotDevice').inputValue(),'A');assert.equal(await mobile.evaluate(()=>Object.keys(state.graph.points).length),0);
  assert.deepEqual(errors,[]);console.log('PASS: hover coordinates without mutation, plot-area boundaries, selected-device mouse placement, point selection and precise typing, curve updates, isolated D, clean report markup, leave cleanup, submitted lock and real mobile touch.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
