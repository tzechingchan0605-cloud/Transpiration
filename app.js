'use strict';

const CURRENT_KEY = 'transpirationLab.current.v1';
const RECORDS_KEY = 'transpirationLab.records.v1';
const PROFILE_KEY = 'transpirationLab.profile.v1';
const TEACHER_EMAIL = 'tzechingchan0605@gmail.com';
const MODULE_ID = 'VL_BIO_TRANSPIRATION';
const PAGE_TITLE=document.title;
const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const IDS = ['A','B','C','D'];
const CONDITIONS = {
  A: {distance:10, light:1200, leaves:true},
  B: {distance:20, light:300, leaves:true},
  C: {distance:30, light:133, leaves:true},
  D: {distance:20, light:300, leaves:false}
};
const VARIABLE_NAMES = ['光強度','紅色水跡上升高度／平均上移速度','溫度','濕度及氣流','紅色水濃度及浸入深度','帶葉組的總葉面積','西芹長柄的長度及粗幼'];
const VARIABLE_GROUPS = [['iv','獨立變量','主動改變的因素'],['dv','因變量','量度的結果'],['cv','控制變量','保持相同的因素']];
const ASSUMPTIONS = [
  {id:'temperature', text:'改變燈距不會造成各裝置溫度不同。', valid:true, reference:'溫度亦可能影響蒸騰。此模擬維持各裝置 25°C，避免光照與溫度同時改變。'},
  {id:'equalArea', text:'裝置A、裝置B、裝置C 的總葉面積相同。', valid:true, reference:'葉面積可能影響水分散失，因此帶葉組裝置A、裝置B、裝置C 應保持相同總葉面積；不帶葉的裝置D 是另一項比較。'},
  {id:'areaIrrelevant', text:'葉面積不會影響結果，因此毋須控制。', valid:false, reference:'不能把葉面積視為沒有影響；它可能影響水分散失，光照比較中需要控制。'},
  {id:'air', text:'各裝置的濕度及氣流相同。', valid:true, reference:'濕度及氣流亦可能影響蒸騰，因此比較光照時應保持相同。'}
];
const FIELD_IDS = ['observation','prediction','reason','controlPlan','setupDescription','xAxis','yAxis','graphMax','claim','leafComparison','leafConclusion','limitations','reflection'];
const PREDICTIONS = {increase:'增加',decrease:'減少',same:'沒有明顯改變'};
const ANSWER_LABELS = {
  claim:{increase:'當光強度增加時，紅色水跡的平均上移速度通常會增加。',decrease:'當光強度增加時，紅色水跡的平均上移速度通常會減少。',same:'當光強度增加時，紅色水跡的平均上移速度沒有明顯改變。',unclear:'光強度與紅色水跡的平均上移速度沒有一致的變化趨勢。'},
  leafComparison:{faster:'相同 20 cm 光照距離下，裝置B（帶葉）比裝置D（不帶葉）快。',slower:'相同 20 cm 光照距離下，裝置B（帶葉）比裝置D（不帶葉）慢。',same:'相同 20 cm 光照距離下，裝置B（帶葉）與裝置D（不帶葉）的速度相近。'},
  leafConclusion:{promotes:'葉片有助水分向上運輸。',prevents:'葉片阻止水分向上運輸。',unrelated:'葉片與水分向上運輸沒有關係。'},
  limitations:{indirect:'紅色水跡可作為植物吸水及水分向上運輸的線索，不能代表葉片蒸發水分的速度，即蒸騰速率。',direct:'水跡上移速度就是葉片散失水汽的速率，可直接當作蒸騰速率。',proof:'只要帶葉組比不帶葉組快，就已完全證明水汽只經氣孔散失。'}
};
const answerText=(field,value)=>ANSWER_LABELS[field]?.[value]||value||'未回答';
const defaults = ()=>Object.fromEntries(FIELD_IDS.map(id=>[id,id==='graphMax'?'0.5':id==='xAxis'?'light':id==='yAxis'?'rate':'']));
function isTeacher(profile=activeProfile){return profile?.email?.trim().toLowerCase()===TEACHER_EMAIL;}
function upgradeRecord(record){
  if(!record||record.moduleId!==MODULE_ID||!record.form)return record;
  record.form={...defaults(),...record.form};
  if(!record.uiVersion)record.uiVersion=1;
  if(!record.submitted){record.form.xAxis='light';record.form.yAxis='rate';record.form.graphMax='0.5';}
  Object.values(record.variables||{}).forEach(values=>{if(Array.isArray(values))values.forEach((value,i)=>{if(value==='光照強度')values[i]='光強度';});});
  IDS.forEach(id=>{if(record.ruler?.[id])record.ruler[id].y=0;});
  return record;
}
function storedRecords(){return readStored(RECORDS_KEY,[]).map(upgradeRecord).filter(isRecord).filter(r=>!isTeacher(r.profile));}

function freshState(profile = null) {
  const seed = crypto.getRandomValues(new Uint32Array(1))[0];
  let n = seed;
  const random = () => { n = (Math.imul(n,1664525)+1013904223)>>>0; return n/4294967296; };
  const base = [.37,.245,.16,.055];
  const model = Object.fromEntries(IDS.map((id,index) => {
    const slope = base[index] * (.94 + random()*.12);
    return [id,[0,10,20,30].map(t => Math.round(slope*t*2)/2)];
  }));
  return {
    schemaVersion:1, uiVersion:2, rateDecimals:2, moduleId:MODULE_ID, id:crypto.randomUUID(), profile,
    createdAt:new Date().toISOString(), savedAt:null, submittedAt:null, reflectionSubmittedAt:null,
    phase:1, unlocked:1, submitted:false, seed, model,
    form:defaults(),
    variables:{iv:[],dv:[],cv:[]}, assumptions:[], initialControl:null,
    initialDesign:null, setup:{image:'',method:'',saved:false,description:'',lamps:{A:10,B:20,C:30,D:20}},
    measurements:{}, currentTime:0, running:false,
    ruler:Object.fromEntries(IDS.map(id => [id,{x:0,y:0}])),
    calculations:{}, graph:{points:{},connected:false},
    events:[], phaseDurations:{1:0,2:0,3:0,4:0}, hintsUsed:0
  };
}

function readStored(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}
let activeProfile=null;
const cloud=new LabCloudSync({url:window.VL_CLOUD_CONFIG?.url||'',teacherEmail:TEACHER_EMAIL,onStatus:message=>$('#cloudStatus').textContent=message});
cloud.status(cloud.enabled?'已啟用中央儲存；登入後會自動同步學生答案。':'中央儲存尚未設定：目前答案只保留在這部瀏覽器。');
function teacherRecords(){return cloud.enabled?(cloud.records||[]).map(upgradeRecord).filter(isRecord).filter(r=>!isTeacher(r.profile)):storedRecords();}
async function refreshCloudRecords(){
  if(!isTeacher()||!cloud.enabled)return false;
  const key=$('#cloudTeacherKey').value.trim()||cloud.teacherKey;
  if(!key){toast('請輸入教師中央紀錄存取金鑰。');return false;}
  $('#dashboardStatus').textContent='正在讀取中央學生紀錄…';
  try{await cloud.load(key);renderTeacherDashboard();return true;}
  catch{cloud.records=null;renderTeacherDashboard();$('#dashboardStatus').textContent='未能讀取中央紀錄：請檢查金鑰、連線及中央服務部署。';return false;}
}
// Archive older current-only records, but never restore a learner session.
const previousCurrent=upgradeRecord(readStored(CURRENT_KEY,null));
if(isRecord(previousCurrent)&&previousCurrent.profile&&!isTeacher(previousCurrent.profile)) {
  const records=storedRecords(),index=records.findIndex(r=>r.id===previousCurrent.id);
  if(index<0||Date.parse(previousCurrent.savedAt)>Date.parse(records[index].savedAt)) {
    if(index<0)records.push(previousCurrent);else records[index]=previousCurrent;
    try{localStorage.setItem(RECORDS_KEY,JSON.stringify(records));}catch{/* Keep the current backup if storage is full. */}
  }
}
let state=freshState();
let allowUnload=false;
let activeSince = Date.now();
let saveTimer;
let timerHandle;
let drawingChanged = false;
let drawingTool = 'pencil';

function isRecord(record) {
  return record && record.schemaVersion===1 && record.moduleId===MODULE_ID &&
    typeof record.id==='string' && record.id.length<100 &&
    record.form && FIELD_IDS.every(id => typeof record.form[id]==='string') &&
    record.variables && VARIABLE_GROUPS.every(([id]) => Array.isArray(record.variables[id]) && record.variables[id].every(v=>VARIABLE_NAMES.includes(v))) &&
    Array.isArray(record.assumptions) && record.assumptions.every(id=>ASSUMPTIONS.some(a=>a.id===id)) && Array.isArray(record.events) && record.events.every(e=>e&&typeof e.type==='string') &&
    record.setup && record.measurements && record.calculations && record.graph?.points &&
    record.model && IDS.every(id => Array.isArray(record.model[id]) && record.model[id].length===4 && record.model[id].every(Number.isFinite)) &&
    [0,10,20,30].includes(record.currentTime) && [1,2,3,4].includes(record.phase) &&
    [1,2,3,4].includes(record.unlocked) && record.phaseDurations && [1,2,3,4].every(p=>Number.isFinite(record.phaseDurations[p])&&record.phaseDurations[p]>=0) &&
    typeof record.submitted==='boolean' && record.ruler &&
    IDS.every(id => Number.isFinite(record.ruler[id]?.x) && Number.isFinite(record.ruler[id]?.y)) &&
    (!record.profile || (typeof record.profile.name==='string' && typeof record.profile.classInfo==='string'));
}
function toast(message) {
  $('#toast').textContent=message;
  $('#toast').classList.add('show');
  clearTimeout(toast.timer);
  toast.timer=setTimeout(()=>$('#toast').classList.remove('show'),4500);
}
function accountTime() {
  const now=Date.now();
  if(state.profile && !isTeacher() && !document.hidden) state.phaseDurations[state.phase]+=(now-activeSince)/1000;
  activeSince=now;
}
function readForm() {
  FIELD_IDS.forEach(id => { state.form[id] = $('#'+id).value; });
}
function save() {
  accountTime();
  readForm();
  state.savedAt=new Date().toISOString();
  if (!state.profile || isTeacher()) return;
  try {
    localStorage.setItem(CURRENT_KEY,JSON.stringify(state));
    const records=storedRecords();
    const index=records.findIndex(record=>record.id===state.id);
    if(index<0) records.push(state); else records[index]=state;
    localStorage.setItem(RECORDS_KEY,JSON.stringify(records));
  } catch {
    toast('瀏覽器儲存空間不足或未允許儲存。請保持頁面開啟並確認中央同步狀態。');
  }
  cloud.enqueue(state);
}
function scheduleSave() { clearTimeout(saveTimer); saveTimer=setTimeout(save,400); }
function log(type,details={}) {
  if(isTeacher())return;
  state.events.push({type,at:new Date().toISOString(),phase:state.phase,...details});
  scheduleSave();
}
function phase(number) {
  if(number>state.unlocked) return;
  accountTime(); state.phase=number;
  $$('.phase').forEach(el=>el.hidden=el.id!==`phase-${number}`);
  $$('.step').forEach(el=>{
    const p=+el.dataset.phase;
    el.disabled=p>state.unlocked;
    el.classList.toggle('active',p===number);
    el.classList.toggle('done',p<number);
    if(p===number) el.setAttribute('aria-current','step'); else el.removeAttribute('aria-current');
  });
  if(number===4) {renderCalculations(); renderGraph();}
  log('phase_opened',{phase:number});
  $('#phase-'+number+' h2').focus({preventScroll:true});
  window.scrollTo({top:0,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
}
function incomplete(message, selector) {
  toast(message);
  $(selector)?.focus();
  $(selector)?.scrollIntoView({block:'center',behavior:'smooth'});
}

// SVG illustrations are drawn locally: no external images, fonts or network calls.
function celerySVG(id,height=0,leafy=true,withRuler=false) {
  const unique = `celery-${id}`;
  const front=330-height*18;
  const leafMarkup=leafy?`<g fill="#78a66a" stroke="#527e4f" stroke-width="1.4">
    <path d="M112 83 C87 55 90 26 68 33 C53 21 39 37 51 48 C27 45 24 66 48 70 C32 91 53 102 65 86 C78 105 96 91 86 75 Z"/>
    <path d="M125 72 C138 45 134 19 158 27 C169 11 189 28 178 43 C200 37 207 58 184 66 C205 82 187 99 172 84 C160 99 143 84 149 71 Z"/>
    <path d="M119 62 C101 43 105 17 120 22 C130 7 146 19 139 32 C151 40 141 56 129 51 Z"/>
    <path d="M58 57 L114 92 M177 49 L123 86 M121 36 L119 92" fill="none" stroke="#4f7f4e" stroke-width="2"/></g>`:
    `<path d="M111 82 L96 66 M125 82 L140 64" stroke="#7a9c66" stroke-width="6" stroke-linecap="round"/><text x="119" y="40" text-anchor="middle" fill="#9b896f" font-size="11">不帶葉</text>`;
  let ticks='';
  for(let half=0;half<=32;half++){
    const cm=half/2,y=330-cm*18;
    ticks+=`<path d="M${half%2===0?190:196} ${y}h${half%2===0?17:11}" stroke="#8d784f" stroke-width=".9"/>`;
    if(half%2===0) ticks+=`<text x="212" y="${y+3}" font-size="9" fill="#6b5e40">${cm}</text>`;
  }
  return `<svg ${withRuler?`id="specimen-${id}"`:''} class="specimen-svg" viewBox="0 0 240 410" role="img" aria-label="${leafy?'帶葉':'不帶葉'}西芹長柄的紅色水跡${withRuler?'及可移動量尺':''}">
    <defs><linearGradient id="${unique}-stem"><stop stop-color="#7f9d66"/><stop offset=".4" stop-color="#d7e1b1"/><stop offset=".7" stop-color="#a7bf84"/><stop offset="1" stop-color="#6f9259"/></linearGradient><clipPath id="${unique}-clip"><path d="M109 78 Q118 69 128 78 L136 366 Q122 375 105 366 Z"/></clipPath></defs>
    <ellipse cx="123" cy="391" rx="77" ry="8" fill="#dbe7d9"/>
    <path d="M109 78 Q118 69 128 78 L136 366 Q122 375 105 366 Z" fill="url(#${unique}-stem)" stroke="#6e8d58" stroke-width="1.5"/>
    <path d="M114 91 L112 360 M120 86 L121 366 M126 92 L131 360" stroke="#6b8c55" stroke-width="1" opacity=".5"/>
    <g clip-path="url(#${unique}-clip)"><rect class="dye-column" x="114" y="${front}" width="5" height="${366-front}" rx="2" fill="#bd4652"/><rect class="dye-column" x="124" y="${front}" width="5" height="${366-front}" rx="2" fill="#bd4652"/></g>
    ${leafMarkup}
    ${withRuler?`<g aria-label="燈具示意，非按比例繪製"><path d="M29 174V126l13-15" fill="none" stroke="#a29a7b" stroke-width="3"/><path d="M18 174h25" stroke="#a29a7b" stroke-width="4" stroke-linecap="round"/><path d="M35 101l17 17 9-20Z" fill="#eac57c" stroke="#b49861"/><path d="M56 101L97 54 102 98Z" fill="#f3d79522"/><text x="29" y="194" text-anchor="middle" fill="#9e8961" font-size="9">燈具</text></g>`:''}
    <path d="M62 310 L71 381 Q123 392 176 381 L184 310" fill="#ffffff4d" stroke="#a9bfb2" stroke-width="2"/>
    <path d="M67 330 L72 378 Q121 389 175 378 L179 330 Z" fill="#cf627044" stroke="#c1818666"/>
    <ellipse cx="123" cy="330" rx="56" ry="6" fill="#d2687633" stroke="#ce879077"/>
    <path d="M49 330 H186" stroke="#668d74" stroke-dasharray="4 3" stroke-width="1"/>
    <text x="44" y="326" text-anchor="end" fill="#6e8873" font-size="9">水面</text>
    <text x="124" y="402" text-anchor="middle" fill="#7e9181" font-size="10">浸入深度 2 cm · 虛擬剖視</text>
    ${withRuler?`<g class="ruler" data-ruler="${id}" transform="translate(${state.ruler[id].x},0)"><rect x="188" y="28" width="40" height="321" rx="3" fill="#f8e9beee" stroke="#c7b27e"/><text x="211" y="22" text-anchor="middle" fill="#8a774d" font-size="9">cm</text>${ticks}<path d="M188 330h40" stroke="#b85a4e" stroke-width="1.5"/></g>`:''}
  </svg>`;
}
function renderEquipment() {
  const material=(name,count,art)=>`<figure class="equipment"><svg viewBox="0 0 100 100" role="img" aria-label="${name}">${art}</svg><figcaption>${name} ×${count}</figcaption></figure>`;
  $('#equipmentBank').innerHTML=[
    material('西芹',4,'<path d="M47 89L45 36h10l4 53Z" fill="#b7cb8c" stroke="#6d9559"/><g fill="#78a76b" stroke="#57814f"><path d="M47 38C12 29 18 5 35 16C41 4 54 15 49 23Z"/><path d="M52 40C85 37 92 13 74 16C68 3 55 15 59 25Z"/></g>'),
    material('檯燈',4,'<path d="M20 85h40M39 84V51L53 29" fill="none" stroke="#7f9a93" stroke-width="5" stroke-linecap="round"/><path class="lamp-beam" d="M69 12L98 3V65L61 40Z" fill="#f7dba555"/><path d="M40 22L61 40 69 12Z" fill="#edca82" stroke="#ba9e68" stroke-width="2"/>'),
    material('紅色水杯',4,'<path d="M20 22L28 85Q50 93 72 85L80 22" fill="#eff7f6" stroke="#9abdb5" stroke-width="3"/><path d="M24 43L29 82Q50 90 71 82L76 43Z" fill="#d96f8066"/><ellipse cx="50" cy="43" rx="26" ry="5" fill="#d66a7c66" stroke="#c86e7d"/>'),
    material('30 cm 尺子',4,'<g transform="rotate(-25 50 50)"><rect x="8" y="35" width="84" height="30" rx="3" fill="#f6e8ba" stroke="#c8b582"/>'+Array.from({length:16},(_,i)=>`<path d="M${12+i*5} 35v${i%5===0?14:7}" stroke="#927d4a"/>`).join('')+'<text x="50" y="59" text-anchor="middle" fill="#8d774a" font-size="9">30 cm</text></g>'),
    material('剪刀',1,'<path d="M38 56L77 17M61 58L24 18" stroke="#9eaeb0" stroke-width="7" stroke-linecap="round"/><circle cx="49" cy="47" r="4" fill="#788c8d"/><ellipse cx="31" cy="73" rx="13" ry="17" fill="none" stroke="#087b78" stroke-width="7"/><ellipse cx="69" cy="73" rx="13" ry="17" fill="none" stroke="#087b78" stroke-width="7"/>'),
    material('計時器',1,'<circle cx="50" cy="55" r="30" fill="#f0f7ee" stroke="#7faaa0" stroke-width="3"/><path d="M50 55V34M50 55L64 64M43 17h14M50 17v8" stroke="#087b78" stroke-width="4" stroke-linecap="round"/><text x="50" y="94" text-anchor="middle" fill="#6c8a7b" font-size="10">min</text>')
  ].join('');
}
function renderVariables() {
  $('#variableQuiz').innerHTML=VARIABLE_GROUPS.map(([group,title,description])=>`<section class="variable-group"><h4>${title} <span>（${description}）</span></h4><div class="variable-options">${VARIABLE_NAMES.map(name=>`<button type="button" data-group="${group}" data-variable="${esc(name)}" aria-pressed="${state.variables[group].includes(name)}" class="${state.variables[group].includes(name)?'selected':''}">${name}</button>`).join('')}</div></section>`).join('');
  $$('.variable-options button').forEach(button=>button.onclick=()=>{
    if(state.submitted) return;
    const {group,variable}=button.dataset;
    state.variables[group]=state.variables[group].includes(variable)?state.variables[group].filter(x=>x!==variable):[...state.variables[group],variable];
    button.classList.toggle('selected',state.variables[group].includes(variable));
    button.setAttribute('aria-pressed',String(state.variables[group].includes(variable)));
    log('variable_choice',{group,choices:[...state.variables[group]]});
  });
  $('#assumptionChoices').innerHTML=ASSUMPTIONS.map(item=>`<label class="check-option"><input type="checkbox" value="${item.id}" ${state.assumptions.includes(item.id)?'checked':''}>${item.text}</label>`).join('');
  $$('#assumptionChoices input').forEach(input=>input.onchange=()=>{
    state.assumptions=$$('#assumptionChoices input:checked').map(x=>x.value);
    log('assumptions_changed',{selected:[...state.assumptions]});
  });
}
function initCanvas() {
  const canvas=$('#setupCanvas'),ctx=canvas.getContext('2d');
  ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.lineCap='round';ctx.lineJoin='round';
  if(state.setup.image && /^data:image\/(jpeg|png|webp);base64,/.test(state.setup.image)) {
    const recordId=state.id,image=new Image();
    image.onload=()=>{if(state.id===recordId)ctx.drawImage(image,0,0,canvas.width,canvas.height);};image.src=state.setup.image;
  }
  let drawing=false;
  const point=event=>{const box=canvas.getBoundingClientRect();return{x:(event.clientX-box.left)*canvas.width/box.width,y:(event.clientY-box.top)*canvas.height/box.height};};
  canvas.onpointerdown=event=>{
    if(state.submitted)return;
    const p=point(event);drawing=true;canvas.setPointerCapture(event.pointerId);
    ctx.strokeStyle=drawingTool==='eraser'?'#fff':'#214d3e';ctx.lineWidth=drawingTool==='eraser'?28:3;
    ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x+.1,p.y+.1);ctx.stroke();
  };
  canvas.onpointermove=event=>{if(!drawing)return;const p=point(event);ctx.lineTo(p.x,p.y);ctx.stroke();};
  const end=()=>{if(!drawing)return;drawing=false;drawingChanged=true;state.setup.saved=false;state.setup.method='drawing';$('#setupStatus').textContent='繪圖已更新，請儲存。';log('setup_drawing_changed');};
  canvas.onpointerup=end;canvas.onpointercancel=end;
  $$('[data-tool]').forEach(button=>button.onclick=()=>{
    drawingTool=button.dataset.tool;
    $$('[data-tool]').forEach(el=>{el.classList.toggle('selected',el===button);el.setAttribute('aria-pressed',String(el===button));});
  });
  $('#clearDrawing').onclick=()=>{
    ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
    state.setup.image='';state.setup.saved=false;state.setup.method='';drawingChanged=false;
    $('#setupStatus').textContent='繪圖已清除。';log('setup_cleared');
  };
  $('#setupPhoto').onchange=event=>{
    const file=event.target.files[0];if(!file)return;
    if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>5*1024*1024){toast('請選擇不超過 5 MB 的 PNG、JPEG 或 WebP 圖片。');return;}
    const reader=new FileReader();reader.onload=()=>{
      const image=new Image();image.onload=()=>{
        ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
        const scale=Math.min(canvas.width/image.width,canvas.height/image.height);
        ctx.drawImage(image,(canvas.width-image.width*scale)/2,(canvas.height-image.height*scale)/2,image.width*scale,image.height*scale);
        drawingChanged=true;state.setup.method='photo';state.setup.saved=false;
        $('#setupStatus').textContent='相片已加入，請儲存。';log('setup_photo_added');
      };image.onerror=()=>toast('圖片無法讀取，請選擇另一張。');image.src=reader.result;
    };reader.readAsDataURL(file);
  };
  $('#saveSetup').onclick=()=>{
    const description=$('#setupDescription').value.trim();
    if(!drawingChanged&&!state.setup.image&&!description){incomplete('請先繪圖、上載相片，或輸入文字裝置設計。','#setupDescription');return;}
    if(drawingChanged)state.setup.image=canvas.toDataURL('image/jpeg',.8);
    state.setup.description=description;state.setup.saved=true;
    if(!state.setup.image)state.setup.method='text';
    $('#setupStatus').textContent='✓ 裝置設計已儲存';log('setup_saved',{method:state.setup.method,description});save();
  };
}
function designMissing() {
  const required=[['prediction','請完成結果預測。'],['reason','請寫下預測理由。'],['controlPlan','請寫下你的對照裝置設計。']];
  for(const [id,message] of required) if(!$('#'+id).value.trim()) return[message,'#'+id];
  if(!VARIABLE_GROUPS.every(([id])=>state.variables[id].length))return['請在三類變量中各選擇至少一項。','#variableQuiz button'];
  if(!state.assumptions.length)return['請選擇至少一項實驗假設。','#assumptionChoices input'];
  if(!state.setup.saved)return['請儲存裝置設計。','#saveSetup'];
  return null;
}

function renderBench() {
  $('#labBench').innerHTML=IDS.map(id=>{
    const c=CONDITIONS[id];
    return `<article class="specimen-card" data-id="${id}"><div class="specimen-head"><span class="specimen-letter">裝置${id}</span><span>${c.distance} cm</span></div><div class="specimen-meta">${c.leaves?'帶葉':'不帶葉'} · 光強度：${c.light} lux</div>${celerySVG(id,state.model[id][state.currentTime/10],c.leaves,true)}<div class="ruler-buttons"><button data-move="${id}" data-dx="-3" aria-label="裝置${id} 尺子左移">← 左移</button><button data-move="${id}" data-dx="3" aria-label="裝置${id} 尺子右移">右移 →</button><button data-align="${id}">移近長柄</button></div></article>`;
  }).join('');
  $$('.ruler').forEach(ruler=>{
    const id=ruler.dataset.ruler;let drag=null;
    ruler.onpointerdown=event=>{
      if(state.submitted||state.running)return;
      const svg=ruler.ownerSVGElement;
      const p=new DOMPoint(event.clientX,event.clientY).matrixTransform(svg.getScreenCTM().inverse());
      drag={x:p.x,start:{...state.ruler[id]}};ruler.setPointerCapture(event.pointerId);event.preventDefault();
    };
    ruler.onpointermove=event=>{
      if(!drag)return;
      const p=new DOMPoint(event.clientX,event.clientY).matrixTransform(ruler.ownerSVGElement.getScreenCTM().inverse());
      setRuler(id,drag.start.x+p.x-drag.x);
    };
    const end=()=>{if(!drag)return;drag=null;log('ruler_moved',{id,position:{...state.ruler[id]}});};
    ruler.onpointerup=end;ruler.onpointercancel=end;
  });
  $$('[data-move]').forEach(button=>button.onclick=()=>{
    const id=button.dataset.move,pos=state.ruler[id];
    setRuler(id,pos.x+(+button.dataset.dx||0));
    log('ruler_adjusted',{id,position:{...state.ruler[id]}});
  });
  $$('[data-align]').forEach(button=>button.onclick=()=>{
    const id=button.dataset.align;setRuler(id,-30,0);log('ruler_zero_aligned',{id});
  });
  updateTimer();
}
function setRuler(id,x) {
  state.ruler[id]={x:Math.min(7,Math.max(-120,x)),y:0};
  const p=state.ruler[id];$(`[data-ruler="${id}"]`).setAttribute('transform',`translate(${p.x},${p.y})`);
}
function renderMeasurements() {
  const times=[0,10,20,30].filter(t=>t<=state.currentTime);
  $('#dataBody').innerHTML=times.map(time=>{
    const row=state.measurements[time];
    const disabled=state.submitted||time!==state.currentTime||state.running;
    return `<tr class="${row?.confirmed?'saved-row':'current-row'}"><td>${time} ${row?.confirmed?'✓':''}</td>${IDS.map(id=>`<td><div class="measurement-input"><input type="number" min="0" max="16" step="any" inputmode="decimal" data-time="${time}" data-measure="${id}" aria-label="${time} 分鐘裝置${id} 水跡高度（cm）" value="${esc(row?.values?.[id]??'')}" ${disabled?'disabled':''}><span class="measurement-arrows"><button data-adjust-time="${time}" data-adjust-id="${id}" data-amount="0.5" aria-label="${time} 分鐘裝置${id} 讀數增加 0.5 cm" ${disabled?'disabled':''}>▴</button><button data-adjust-time="${time}" data-adjust-id="${id}" data-amount="-0.5" aria-label="${time} 分鐘裝置${id} 讀數減少 0.5 cm" ${disabled?'disabled':''}>▾</button></span></div></td>`).join('')}</tr>`;
  }).join('');
  $$('[data-measure]').forEach(input=>{
    input.oninput=()=>{
      const time=+input.dataset.time,id=input.dataset.measure;
      if(!state.measurements[time])state.measurements[time]={values:{},firstValues:null,confirmed:false};
      state.measurements[time].values[id]=input.value;
      if(state.measurements[time].confirmed){
        state.measurements[time].confirmed=false;
        toast('本輪讀數已修改，請再次確認並記錄。');
      }
      invalidateAnalysis();updateTimer();scheduleSave();
    };
    input.onchange=()=>log('measurement_entered',{time:+input.dataset.time,id:input.dataset.measure,value:input.value});
    input.onblur=()=>{
      if(input.value!==''&&input.validity.valid&&oneDecimal(+input.value)){
        input.value=(+input.value).toFixed(1);state.measurements[input.dataset.time].values[input.dataset.measure]=input.value;scheduleSave();
      }
    };
    input.onkeydown=event=>{
      if(event.key==='ArrowUp'||event.key==='ArrowDown'){event.preventDefault();adjustMeasurement(input,event.key==='ArrowUp'?0.5:-0.5);}
    };
  });
  $$('[data-adjust-id]').forEach(button=>button.onclick=()=>adjustMeasurement($(`[data-time="${button.dataset.adjustTime}"][data-measure="${button.dataset.adjustId}"]`),+button.dataset.amount));
  updateTimer();
}
function oneDecimal(value){return Math.abs(value*10-Math.round(value*10))<1e-7;}
function adjustMeasurement(input,amount){
  if(input.disabled)return;
  const next=(Number(input.value)||0)+amount;
  if(next<0||next>16)return;
  input.value=next.toFixed(1);
  input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));
}
function scrollToElement(selector){$(selector).scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});}
function invalidateAnalysis() {
  if(state.unlocked===4){
    state.unlocked=3;state.calculations={};state.graph={points:{},connected:false};
    renderCalculations();renderPoints();renderGraph();
    toast('讀數已修改，請重新確認量度、計算及標點。');
    $$('.step').find(el=>el.dataset.phase==='4').disabled=true;
  }
}
function allMeasurements() {return[0,10,20,30].every(t=>state.measurements[t]?.confirmed);}
function updateTimer() {
  $('#timeDisplay').innerHTML=`${String(state.currentTime).padStart(2,'0')} <small>分鐘</small>`;
  if(!state.running)$('#timerFill').style.width=(state.currentTime/30*100)+'%';
  const confirmed=!!state.measurements[state.currentTime]?.confirmed;
  $('#timerButton').disabled=state.submitted||state.running||!confirmed||state.currentTime===30;
  $('#recordMeasurements').disabled=state.submitted||state.running;
  $('#timerStatus').textContent=state.running?'四個裝置同步運行中……':state.currentTime===30&&confirmed?'30 分鐘量度已完成':confirmed?'本輪已記錄，可以繼續':'到達量度時間：請量度四個裝置';
  $('#measurementProgress').textContent=`${[0,10,20,30].filter(t=>state.measurements[t]?.confirmed).length} / 4 個量度時間`;
  $('#experimentNext').disabled=state.running||!allMeasurements();
  $('#initialReadingReminder').hidden=state.currentTime!==0||confirmed;
  $$('[data-move],[data-align]').forEach(button=>button.disabled=state.submitted||state.running);
}
function runInterval() {
  if(state.submitted||state.running||!state.measurements[state.currentTime]?.confirmed||state.currentTime>=30)return;
  const from=state.currentTime,to=from+10;
  state.running=true;updateTimer();renderMeasurements();log('interval_started',{from,to});
  scrollToElement('#labBench');
  const started=performance.now(),duration=matchMedia('(prefers-reduced-motion: reduce)').matches?600:3000;
  timerHandle=setInterval(()=>{
    const p=Math.min(1,(performance.now()-started)/duration);
    IDS.forEach(id=>{
      const start=state.model[id][from/10],end=state.model[id][to/10],height=start+(end-start)*p;
      const columns=$$(`#specimen-${id} .dye-column`);
      columns.forEach(column=>{
        const y=330-height*18;column.setAttribute('y',y);column.setAttribute('height',366-y);
      });
    });
    $('#timerFill').style.width=((from+10*p)/30*100)+'%';
    $('#timeDisplay').innerHTML=`${String(Math.floor(from+10*p)).padStart(2,'0')} <small>分鐘</small>`;
    if(p===1){
      clearInterval(timerHandle);state.currentTime=to;state.running=false;
      log('measurement_time_reached',{time:to});renderMeasurements();save();toast(`${to} 分鐘：請量度並記錄四個裝置。`);
    }
  },50);
}
function recordMeasurements() {
  if(state.submitted||state.running)return;
  const time=state.currentTime,inputs=$$(`[data-time="${time}"][data-measure]`);
  if(inputs.length!==4)return;
  for(const input of inputs){
    if(input.value.trim()===''||!input.validity.valid||!Number.isFinite(+input.value)||!oneDecimal(+input.value)){
      incomplete('請填寫四項 0 至 16 cm 的讀數，保留一位小數。',`[data-time="${time}"][data-measure="${input.dataset.measure}"]`);return;
    }
  }
  const values=Object.fromEntries(inputs.map(input=>[input.dataset.measure,(+input.value).toFixed(1)]));
  const row=state.measurements[time]||{};
  state.measurements[time]={...row,values,firstValues:row.firstValues||{...values},confirmed:true};
  log(row.firstValues?'measurements_reconfirmed':'measurements_recorded',{time,values:{...values},ruler:structuredClone(state.ruler)});
  $('#measurementStatus').textContent=`✓ ${time} 分鐘讀數已記錄`;
  renderMeasurements();save();if(time<30)scrollToElement('.timer-bar');
}
function expectedRate(record,id){
  const start=record.measurements[0]?.values?.[id],end=record.measurements[30]?.values?.[id];
  return start===undefined||end===undefined||start===''||end===''?NaN:(+end-+start)/30;
}
function rateDigits(record){return record.rateDecimals===2?2:3;}
function rateTolerance(record){return record.rateDecimals===2?.0051:.00051;}
function rateReference(record,id){const value=expectedRate(record,id);return Number.isFinite(value)?`${value.toFixed(rateDigits(record))} cm/min`:'尚未有完整的 0 和 30 分鐘讀數';}
function recordedDistance(record,id){
  const start=record.measurements[0]?.values?.[id],end=record.measurements[30]?.values?.[id];
  return start===undefined||end===undefined||start===''||end===''||!Number.isFinite(+start)||!Number.isFinite(+end)?'未記錄':(+end-+start).toFixed(1);
}
function normaliseRateInput(input){
  if(input.value!==''&&Number.isFinite(+input.value)&&+input.value>=+input.min&&+input.value<=+input.max)input.value=(+input.value).toFixed(2);
}
function renderCalculations() {
  $('#calculationGrid').innerHTML=IDS.map(id=>{
    const c=CONDITIONS[id],start=state.measurements[0]?.values?.[id],end=state.measurements[30]?.values?.[id];
    return `<div class="calc-card"><strong>裝置${id} · ${c.leaves?'帶葉':'不帶葉'}<span class="calc-condition">（光距：${c.distance} cm ＝ 光強度：${c.light} lux）</span></strong><p class="calc-readings">你的讀數：0 分鐘 ${esc(start??'未記錄')} cm；30 分鐘 ${esc(end??'未記錄')} cm。</p><label class="field">平均上移速度（cm/min）<input type="number" id="rate-${id}" data-rate="${id}" step="0.01" min="-0.54" max="0.54" value="${esc(state.calculations[id]??'')}" ${state.submitted?'disabled':''}></label></div>`;
  }).join('');
  $$('[data-rate]').forEach(input=>{
    input.oninput=()=>{state.calculations[input.dataset.rate]=input.value;scheduleSave();};
    const format=()=>{normaliseRateInput(input);state.calculations[input.dataset.rate]=input.value;scheduleSave();};
    input.onchange=()=>{format();log('rate_calculated',{id:input.dataset.rate,value:input.value});};
    input.onblur=format;
  });
}
function renderPoints() {
  $('#pointControls').innerHTML=IDS.map(id=>{
    const point=state.graph.points[id];
    const c=CONDITIONS[id];
    return `<div class="plot-point"><strong>裝置${id} · ${c.leaves?'帶葉':'不帶葉'} · ${c.distance} cm<br>（光強度：${c.light} lux）</strong><div><label>X坐標<input type="number" id="point-x-${id}" aria-label="裝置${id} 圖點 X坐標" min="0" value="${esc(point?.x??'')}" ${state.submitted?'disabled':''}></label><label>Y坐標<input type="number" id="point-y-${id}" aria-label="裝置${id} 圖點 Y坐標" step="0.01" min="0" max="0.5" value="${esc(point?point.y.toFixed(2):'')}" ${state.submitted?'disabled':''}></label></div><button class="secondary" data-plot="${id}" ${state.submitted?'disabled':''}>${point?'更新標點':'標點'}</button></div>`;
  }).join('');
  IDS.forEach(id=>{$('#point-y-'+id).onblur=()=>normaliseRateInput($('#point-y-'+id));});
  $$('[data-plot]').forEach(button=>button.onclick=()=>{
    const id=button.dataset.plot,x=$('#point-x-'+id),y=$('#point-y-'+id);
    normaliseRateInput(y);
    if(!$('#xAxis').value||!$('#yAxis').value){incomplete('先選擇圖表的X軸及Y軸。','#xAxis');return;}
    if(x.value===''||y.value===''||!x.validity.valid||!y.validity.valid){incomplete('請填寫有效的非負坐標。','#point-x-'+id);return;}
    const xMax=graphXMax(),yMax=+$('#graphMax').value;
    if(+x.value>xMax||+y.value>yMax){toast('坐標超出圖表刻度，請檢查計算結果及坐標。');return;}
    state.graph.points[id]={x:+x.value,y:+y.value};
    log('graph_point_plotted',{id,point:{...state.graph.points[id]}});renderGraph();button.textContent='更新標點';save();
  });
}
function graphXMax(form=state.form) {return form.xAxis==='distance'?35:form.xAxis==='time'?40:1300;}
// Shape-preserving cubic interpolation: pass through students' points, never add data.
function smoothCurve(points,x,y){
  if(points.length<2)return '';
  const h=points.slice(1).map((p,i)=>p.x-points[i].x);
  if(h.some(v=>v<=0))return 'M'+points.map(p=>`${x(p.x)},${y(p.y)}`).join(' L');
  const d=points.slice(1).map((p,i)=>(p.y-points[i].y)/h[i]);
  const m=[d[0],0,d[1]];
  if(d[0]*d[1]>0){const w1=2*h[1]+h[0],w2=h[1]+2*h[0];m[1]=(w1+w2)/(w1/d[0]+w2/d[1]);}
  m[0]=((2*h[0]+h[1])*d[0]-h[0]*d[1])/(h[0]+h[1]);
  m[2]=((2*h[1]+h[0])*d[1]-h[1]*d[0])/(h[0]+h[1]);
  for(const[i,slope]of [[0,d[0]],[2,d[1]]]){
    if(m[i]*slope<=0)m[i]=0;
    else if(d[0]*d[1]<=0&&Math.abs(m[i])>3*Math.abs(slope))m[i]=3*slope;
  }
  let path=`M${x(points[0].x)},${y(points[0].y)}`;
  for(let i=0;i<2;i++)path+=` C${x(points[i].x+h[i]/3)},${y(points[i].y+m[i]*h[i]/3)} ${x(points[i+1].x-h[i]/3)},${y(points[i+1].y-m[i+1]*h[i]/3)} ${x(points[i+1].x)},${y(points[i+1].y)}`;
  return path;
}
function graphMarkup(record,withLegend=true) {
  const form=record.form,maxX=graphXMax(form),maxY=+form.graphMax||.5;
  const left=90,right=677,top=27,bottom=362;
  const x=value=>left+value/maxX*(right-left),y=value=>bottom-value/maxY*(bottom-top);
  const xLabels={light:'光強度（lux）',distance:'光照距離（cm）',time:'模擬時間（min）'};
  const yLabels={rate:'紅色水跡平均上移速度（cm/min）',height:'紅色水跡上升高度（cm）'};
  let grid='';
  for(let i=0;i<=5;i++){
    const yy=top+(bottom-top)*i/5,value=maxY*(5-i)/5;
    grid+=`<path d="M${left} ${yy}H${right}" stroke="#e4ece2"/><text x="${left-12}" y="${yy+4}" text-anchor="end" fill="#75907b" font-size="12">${+value.toFixed(3)}</text>`;
  }
  const ticks=form.xAxis==='distance'?[0,10,20,30]:form.xAxis==='time'?[0,10,20,30,40]:[0,200,400,600,800,1000,1200];
  ticks.forEach(value=>{grid+=`<path d="M${x(value)} ${bottom}v6" stroke="#8ca18b"/><text x="${x(value)}" y="${bottom+23}" text-anchor="middle" fill="#75907b" font-size="12">${value}</text>`;});
  const validPoint=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<=maxX&&p.y>=0&&p.y<=maxY;
  const leafy=['A','B','C'].filter(id=>validPoint(record.graph.points[id])).map(id=>record.graph.points[id]).sort((a,b)=>a.x-b.x);
  let marks=record.graph.connected&&leafy.length===3?`<path class="student-curve" d="${smoothCurve(leafy,x,y)}" fill="none" stroke="#087b78" stroke-width="2.5"/>`:'';
  IDS.forEach(id=>{
    const p=record.graph.points[id];if(!validPoint(p))return;
    const px=x(p.x),py=y(p.y),bare=id==='D',colour=bare?'#bf8854':'#087b78';
    marks+=bare?`<path d="M${px} ${py-7}l7 7-7 7-7-7Z" fill="${colour}" stroke="white" stroke-width="2"/>`:`<circle cx="${px}" cy="${py}" r="6" fill="${colour}" stroke="white" stroke-width="2"/>`;
    marks+=`<text x="${px+10}" y="${py-9}" font-size="13" font-weight="700" fill="${colour}">裝置${id}</text>`;
  });
  return `<title>學生繪製的光照與紅色水跡平均上移速度圖</title>${grid}<path d="M${left} ${top}V${bottom}H${right}" fill="none" stroke="#8ba28a" stroke-width="1.5"/>${marks}<text x="380" y="${bottom+58}" text-anchor="middle" fill="#4d715a" font-size="14">${xLabels[form.xAxis]||'請選擇X軸'}</text><text transform="translate(25 195) rotate(-90)" text-anchor="middle" fill="#4d715a" font-size="13">${yLabels[form.yAxis]||'請選擇Y軸'}</text>${withLegend?'<text class="graph-inline-legend" x="380" y="449" text-anchor="middle" fill="#829680" font-size="11">● 帶葉組：裝置A、裝置B、裝置C　◆ 不帶葉組：裝置D（獨立比較點）</text>':''}`;
}
function renderGraph() {
  readForm();$('#studentGraph').innerHTML=graphMarkup(state,false);
  $('#graphStatus').textContent=`已標示 ${Object.keys(state.graph.points).length} / 4 個裝置${state.graph.connected?'；帶葉組已連線':''}。`;
}
function conclusionMissing() {
  for(const id of IDS){const input=$('#rate-'+id);if(!input||input.value===''||!input.validity.valid)return['請完成四個裝置的平均上移速度計算。','#rate-'+id];}
  if(!$('#xAxis').value||!$('#yAxis').value)return['請選擇圖表的X軸及Y軸。','#xAxis'];
  if(!IDS.every(id=>state.graph.points[id]))return['請標示四個裝置的圖點。','#point-x-A'];
  if(!state.graph.connected)return['請連接帶葉組裝置A、裝置B、裝置C 的圖點。','#connectPoints'];
  const max=+$('#graphMax').value;
  if(IDS.some(id=>state.graph.points[id].y>max))return['圖點超出目前刻度，請調整Y軸上限。','#graphMax'];
  for(const id of ['claim','leafComparison','leafConclusion','limitations'])if(!$('#'+id).value.trim())return['請完成光強度關係、葉片比較及實驗限制的選項。','#'+id];
  return null;
}
function sameChoices(selected,expected){return selected.length===expected.length&&expected.every(x=>selected.includes(x));}
function applyLock() {
  $$('#phase-1 input,#phase-1 textarea,#phase-1 button,#phase-2 input,#phase-2 textarea,#phase-2 select,#phase-2 button,#phase-3 input,#phase-3 button,#phase-4 input,#phase-4 textarea,#phase-4 select,#phase-4 button').forEach(el=>{
    if(el.closest('#learningReveal')||el.id==='newInvestigation'||el.dataset.back)return;
    if(state.submitted)el.disabled=true;
    else if(!el.matches('[data-measure],[data-adjust-id]'))el.disabled=false;
  });
  $('#learningReveal').hidden=!state.submitted;
  if(state.submitted)$('#submitInvestigation').textContent='✓ 已遞交本次探究';
  else $('#submitInvestigation').textContent='遞交探究，查看學習重點 →';
  updateReflection();
  updateTimer();
}
function submit() {
  $('#submitDialog').close();
  if(state.submitted)return;
  const missing=conclusionMissing();if(missing){incomplete(...missing);return;}
  readForm();state.submitted=true;state.submittedAt=new Date().toISOString();
  log('investigation_submitted',{calculations:{...state.calculations},graph:structuredClone(state.graph)});
  applyLock();save();$('#learningReveal').scrollIntoView({behavior:'smooth'});toast('探究已遞交。現在可以查看學習重點及填寫反思。');
}
function download(blob,name) {
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function dateText(value){return value&&Number.isFinite(Date.parse(value))?new Intl.DateTimeFormat('zh-HK',{timeZone:'Asia/Hong_Kong',dateStyle:'medium',timeStyle:'short'}).format(new Date(value)):'—';}
function hypothesisText(record) {
  const original=record.initialDesign?.form||record.form;
  return `若光強度增加，紅色水跡上移速度將會${PREDICTIONS[original.prediction]||'（未回答）'}。`;
}
function reflectionComplete(record=state) {
  return record.submitted && typeof record.reflectionSubmittedAt==='string' && Number.isFinite(Date.parse(record.reflectionSubmittedAt)) && !!record.form.reflection.trim();
}
function updateReflection() {
  const original=state.initialDesign?.form||state.form, complete=reflectionComplete();
  $('#originalHypothesis').innerHTML=`<strong>你的原始假說</strong><p>${esc(hypothesisText(state))}</p><p>原始理由：${esc(original.reason||'未回答')}</p>`;
  $('#reflection').disabled=complete;
  $('#saveReflection').disabled=!state.submitted||complete;
  $('#saveReflection').textContent=isTeacher()?(complete?'✓ 已完成反思示範':'完成反思示範'):(complete?'✓ 學習反思已提交':'儲存並提交學習反思');
  $('#downloadPDF').disabled=!complete;
  $('.complete-bar').hidden=false;
  $('.complete-bar strong').textContent=isTeacher()?'本次示範已完成':'本次探究已遞交';
  $('.complete-bar p').textContent=isTeacher()?'可下載示範 PDF；教師操作不會儲存至學生紀錄或 Excel。':'原始答案、量度、計算及圖表已儲存在這部瀏覽器。';
  $('#downloadPDF').textContent=isTeacher()?'列印／儲存示範 PDF':'列印／儲存學習紀錄 PDF';
  $('#reflectionStatus').textContent=isTeacher()?(complete?'反思示範已完成，可以下載示範 PDF；不會儲存至學生紀錄或 Excel。':'完成反思示範後可下載 PDF；示範操作不會儲存至學生紀錄或 Excel。'):complete?'學習反思已儲存並提交，可以下載學習紀錄 PDF。':'提交學習反思後，便可下載學習紀錄 PDF。';
}
function answerMark(correct) {
  return correct===null?'':`<span class="answer-mark ${correct?'correct':'incorrect'}" aria-label="${correct?'正確':'錯誤'}">${correct?'✓':'✕'}</span>`;
}
function reportAnswer(title,answer,reference='',correct=null) {
  return `<div class="report-answer" data-graded="${correct!==null}"><b>${esc(title)}</b>${answerMark(correct)}<p>${esc(answer||'未回答')}</p>${reference?`<div class="report-reference">${correct===null?'參考答案／說明':'參考答案'}：${esc(reference)}</div>`:''}</div>`;
}
function structureDiagram(scope='learning'){
  const prefix=`structure-${scope}-`,water=prefix+'water',vapour=prefix+'vapour';
  const xylemFill='#fbebed',xylemStroke='#ba8195',evaporation='#c77838',pull='#218bb0';
  const text=(x,y,lines,size=17,colour='#31594b',weight=400)=>`<text x="${x}" y="${y}" fill="${colour}" font-size="${size}" font-weight="${weight}">${lines.map((line,i)=>`<tspan x="${x}" dy="${i?22:0}">${line}</tspan>`).join('')}</text>`;
  const leader=(d,label='')=>`<path class="anatomy-leader" ${label?`data-label="${label}"`:''} d="${d}" fill="none" stroke="#849b90" stroke-width="1.4" stroke-linejoin="round"/>`;
  const arrow=(d,gas=false,kind='')=>`<path class="movement-arrow" ${kind?`data-movement="${kind}"`:''} d="${d}" fill="none" stroke="${gas?evaporation:pull}" stroke-width="2" ${gas?'stroke-dasharray="5 4"':''} marker-end="url(#${gas?vapour:water})"/>`;
  const badge=(x,y,n,group)=>`<g class="process-marker" data-process="${group}-${n}"><circle cx="${x}" cy="${y}" r="12" fill="${group==='evaporation'?evaporation:pull}" stroke="#fff" stroke-width="2"/><text x="${x}" y="${y+5}" text-anchor="middle" font-size="14" font-weight="700" fill="white">${n}</text></g>`;
  const palisade=Array.from({length:16},(_,i)=>{
    const x=300+i*27.75;
    // Shared vertical walls keep the columnar cells tightly packed.
    return `<g class="palisade-cell"><rect class="cell-wall" x="${x}" y="222" width="27.75" height="83" rx="5" fill="#e5efd1" stroke="#85ab66" stroke-width="1.3"/><rect data-organelle="vacuole" x="${x+6}" y="230" width="15.75" height="63" rx="6" fill="#f8fcf4" stroke="#c7ddbc" stroke-width=".7"/>${[231,249,267,287].map(y=>`<ellipse cx="${x+3}" cy="${y}" rx="2" ry="2.7" fill="#639946"/><ellipse cx="${x+24.75}" cy="${y}" rx="2" ry="2.7" fill="#639946"/>`).join('')}<ellipse cx="${x+14}" cy="299" rx="3" ry="2.3" fill="#b6a0c6"/></g>`;
  }).join('');
  // The central air space lies between these mesophyll cells, with a passage to the stoma.
  const cells=[[325,331,23,17,-12],[345,397,27,21,12],[319,446,20,16,-12],[397,449,28,15,7],[464,431,22,17,-16],[487,332,24,17,-8],[521,379,23,24,0],[548,422,27,22,0],[564,342,30,20,0],[622,344,31,20,0],[665,383,23,30,0],[604,447,29,17,0],[675,439,28,18,0],[715,326,22,15,17],[717,365,20,13,-12],[715,454,19,12,8]];
  const spongy=cells.map(([x,y,rx,ry,angle])=>`<g class="spongy-cell" transform="rotate(${angle} ${x} ${y})"><ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="#e7f0d3" stroke="#88ac69" stroke-width="1.6"/><ellipse data-organelle="vacuole" cx="${x}" cy="${y}" rx="${rx-7}" ry="${ry-5}" fill="#f8fcf4"/>${[0,1,2,3,4,5].map(i=>{const a=i*Math.PI/3;return `<ellipse cx="${x+(rx-4)*Math.cos(a)}" cy="${y+(ry-4)*Math.sin(a)}" rx="2.6" ry="2" fill="#639946"/>`;}).join('')}<circle cx="${x+rx-7}" cy="${y+4}" r="2.8" fill="#b6a0c6"/></g>`).join('');
  const filmArc=(x,y,rx,ry,start,end)=>{
    const point=a=>[x+(rx+1.5)*Math.cos(a*Math.PI/180),y+(ry+1.5)*Math.sin(a*Math.PI/180)].map(n=>n.toFixed(2)).join(' ');
    return `<path d="M${point(start)}A${rx+1.5} ${ry+1.5} 0 0 1 ${point(end)}" fill="none" stroke="#70bcd2" stroke-width="2.2"/>`;
  };
  const waterFilm=[[564,342,30,20,25,140],[622,344,31,20,30,145],[521,379,23,24,-45,50],[665,383,23,30,125,235],[548,422,27,22,240,350],[604,447,29,17,210,325],[675,439,28,18,140,235]].map(args=>filmArc(...args)).join('');
  const epidermisCell=(x,y,width=27.75)=>`<g class="epidermis-cell"><rect class="cell-wall" x="${x}" y="${y}" width="${width}" height="26" rx="7" fill="#e9f0df" stroke="#95b77c" stroke-width="1.2"/><rect data-organelle="vacuole" x="${x+3}" y="${y+3}" width="${width-6}" height="17" rx="5" fill="#f8fcf4" stroke="#c7ddbc" stroke-width=".7"/><circle cx="${x+width-6}" cy="${y+22}" r="2.2" fill="#b6a0c6"/></g>`;
  const xylem=Array.from({length:4},(_,row)=>Array.from({length:6},(_,col)=>`<circle cx="${379+col*11+(row%2)*4}" cy="${321+row*11}" r="5" fill="${xylemFill}" stroke="${xylemStroke}" stroke-width="1.2"/>`).join('')).join('');
  const phloem=Array.from({length:3},(_,row)=>Array.from({length:7},(_,col)=>`<path d="M${374+col*11+(row%2)*4} ${367+row*10}h9l2 7-5 4-6-3Z" fill="#9ea2cf" stroke="#696d9a" stroke-width="1"/>`).join('')).join('');
  const processes=[
    {group:'evaporation',n:1,x:20,width:202,lines:['水份從葉肉細胞表面蒸發，','並進入氣室中。']},
    {group:'evaporation',n:2,x:230,width:202,lines:['氣室內的水汽經氣孔','擴散到大氣中。']},
    {group:'pull',n:1,x:450,width:198,lines:['水份從葉肉細胞散失，','細胞的水勢因而下降。']},
    {group:'pull',n:2,x:656,width:198,lines:['葉肉細胞藉滲透從鄰近','細胞吸收水份。']},
    {group:'pull',n:3,x:862,width:198,lines:['木質導管內的水被抽出，','形成蒸騰拉力。']}
  ];
  return `<div class="structure-wrap"><svg xmlns="http://www.w3.org/2000/svg" class="structure-svg" viewBox="0 0 1080 810" role="img" aria-labelledby="${prefix}title ${prefix}desc">
    <title id="${prefix}title">葉的內部構造與蒸騰：水份如何沿木質導管進入葉，再以水汽形式散失</title>
    <desc id="${prefix}desc">葉片局部立體橫切示意。柵狀葉肉細胞緊密排列；海綿葉肉細胞之間形成氣室，朝向氣室的細胞表面覆有水膜。上、下表皮細胞及保衞細胞均畫有液泡，兩個保衞細胞之間保留沒有橫線的氣孔開口。維管束中木質部在上、韌皮部在下；莖和葉的木質導管均為粉紅色。藍色箭嘴表示水份運輸及滲透，橙色虛線箭嘴表示水汽移動與擴散。橙色數字對應經氣孔進行的蒸騰兩步，藍色數字對應蒸騰拉力的形成三步。</desc>
    <defs>
      ${[[water,pull,8],[vapour,evaporation,8]].map(([id,fill,size])=>`<marker id="${id}" markerUnits="userSpaceOnUse" markerWidth="${size}" markerHeight="${size}" refX="${size}" refY="${size/2}" orient="auto"><path d="M0 0L${size} ${size/2}L0 ${size}Z" fill="${fill}"/></marker>`).join('')}
      <pattern id="${prefix}surface" width="42" height="28" patternUnits="userSpaceOnUse"><rect width="42" height="28" fill="#c4db98"/><path d="M0 7L13 0H31L42 9 34 25H14L0 17Z" fill="#cfe3aa" stroke="#90b465" stroke-width="1.3"/></pattern>
      <clipPath id="${prefix}bundle"><ellipse cx="406" cy="353" rx="48" ry="48"/></clipPath>
    </defs>
    <rect x="1" y="1" width="1078" height="808" rx="18" fill="#fbfdf9" stroke="#d8e8df"/>
    ${text(26,37,['葉的內部構造與蒸騰'],23,'#087b78',700)}
    ${text(26,63,['橙色數字：經氣孔進行的蒸騰　｜　藍色數字：蒸騰拉力的形成'],15,'#688475')}
    <g aria-label="葉片、葉柄及葉脈示意">
      <path d="M54 174Q66 100 175 100Q185 166 54 174Z" fill="#8eb972" stroke="#587f48" stroke-width="2"/>
      <path d="M58 170L163 111M93 146L93 126M117 133L128 113M101 143L130 153M133 125L151 138" fill="none" stroke="#c1d395" stroke-width="1.6"/>
      <path d="M164 111L204 91" fill="none" stroke="#71935a" stroke-width="4" stroke-linecap="round"/>
      ${text(32,112,['葉片'],15)}${leader('M68 109L92 116')}
      ${text(211,96,['葉柄'],15)}${leader('M207 99L189 99')}
      ${text(35,211,['葉脈（內含維管束）'],15)}${leader('M121 194L124 139')}
    </g>
    <g aria-label="葉片局部橫切面">
      <path d="M744 190L798 145V438L744 491Z" fill="#d6e6b3" stroke="#90ae71" stroke-width="1.6"/>
      <path d="M300 190L354 145H798L744 190Z" fill="url(#${prefix}surface)" stroke="#93b477" stroke-width="1.8"/>
      <path data-anatomy="cuticle" d="M300 185L354 140H798V145L744 196H300Z" fill="#bad4a3" fill-opacity=".55" stroke="#85a96b" stroke-width="1.2"/>
      <path d="M300 196H744V491H300Z" fill="#f3f7e8"/>
      <path d="M300 491V196H744V491H674M598 491H300" fill="none" stroke="#93b477" stroke-width="1.7"/>
      <path data-anatomy="air-space" d="M549 367Q579 370 601 366Q624 369 640 370Q639 390 642 408L649 435Q638 444 637 466Q627 449 628 435Q605 425 579 428Q571 404 552 403Q553 383 549 367Z" fill="#ecf8fc"/>
      <g data-anatomy="upper-epidermis">${Array.from({length:16},(_,i)=>epidermisCell(300+i*27.75,196)).join('')}</g>
      <g data-anatomy="palisade-mesophyll"><rect x="300" y="222" width="444" height="83" fill="#e5efd1"/>${palisade}</g>
      <g data-anatomy="spongy-mesophyll">${spongy}</g>
      <ellipse data-anatomy="vascular-bundle" cx="406" cy="353" rx="54" ry="54" fill="#d5e5a8" stroke="#8ca966" stroke-width="2"/>
      <g clip-path="url(#${prefix}bundle)"><rect x="356" y="304" width="100" height="57" fill="#d9b4c4"/><rect x="356" y="362" width="100" height="45" fill="#bbbddb"/><g data-anatomy="xylem">${xylem}</g><g data-anatomy="phloem">${phloem}</g></g>
      <ellipse cx="406" cy="353" rx="48" ry="48" fill="none" stroke="#9fb975" stroke-width="1.5"/>
      <g data-anatomy="water-film">${waterFilm}</g>
      <g data-anatomy="lower-epidermis">${Array.from({length:10},(_,i)=>epidermisCell(300+i*28,465,28)).join('')}${epidermisCell(580,465,18)}${epidermisCell(674,465,35)}${epidermisCell(709,465,35)}</g>
      <g data-anatomy="guard-cells">${[false,true].map(mirror=>`<g ${mirror?'transform="translate(1272 0) scale(-1 1)"':''}><path d="M619 465C601 455 589 475 600 489C608 499 621 498 627 489C615 487 611 479 619 473Z" fill="#b4d596" stroke="#688f55" stroke-width="1.7"/><path data-organelle="vacuole" d="M611 466C601 464 595 476 603 485C608 490 614 491 618 488C608 482 607 474 611 466Z" fill="#f8fcf4" stroke="#c7ddbc" stroke-width=".7"/>${[[601,467],[598,477],[603,489],[618,493]].map(([x,y])=>`<ellipse cx="${x}" cy="${y}" rx="2.2" ry="1.8" fill="#4d8b41"/>`).join('')}<circle cx="616" cy="469" r="2.2" fill="#b6a0c6"/></g>`).join('')}</g>
      <path data-anatomy="stoma" d="M627 466Q636 469 645 466V492Q636 489 627 492Z" fill="#fbfdf9" stroke="none"/>
    </g>
    <g aria-label="莖內木質導管與水份上升"><rect data-anatomy="stem-xylem" x="109" y="322" width="45" height="180" rx="9" fill="${xylemFill}" stroke="${xylemStroke}" stroke-width="1.7"/><path d="M119 328V493M144 328V493" stroke="#dfbdca" stroke-width="1.3"/>${arrow('M130 487V435')}${arrow('M130 416V355')}${arrow('M130 348C224 355 279 357 379 343',false,'stem-to-leaf')}
      ${text(27,297,['莖內的木質導管'],17,'#31594b',600)}${leader('M146 303L143 321')}
      ${text(24,518,['水份及已溶解的礦物質'],15,'#527768')}
    </g>
    ${arrow('M438 332L477 332',false,'xylem-to-mesophyll')}${arrow('M493 344L516 366')}${arrow('M531 396L544 413')}${arrow('M570 362C573 370 576 376 581 382',true,'evaporation')}${arrow('M575 414C584 410 593 406 601 399',true,'evaporation')}${arrow('M611 409C628 422 637 438 637 461',true)}${arrow('M636 474V550',true)}
    ${badge(607,380,1,'evaporation')}${badge(677,535,2,'evaporation')}${badge(504,435,1,'pull')}${badge(478,375,2,'pull')}${badge(262,412,3,'pull')}
    ${text(26,250,['木質部（木質導管）'],17,'#89576b',600)}${leader('M210 245H265V312H349L379 321','xylem')}
    ${text(193,394,['維管束'],16,'#527768',600)}${leader('M253 389H262V359H347L353 353','vascular-bundle')}
    ${text(191,446,['韌皮部'],16,'#65678e',600)}${text(191,470,['轉運食物'],14,'#7a7d93')}${leader('M251 441H283V370H357L386 382','phloem')}
    ${text(837,130,['角質層'],17,'#31594b',600)}${text(837,150,['減少水份散失、保護葉片'],14,'#6f8775')}${leader('M828 127H812L751 187')}
    ${text(837,193,['上表皮細胞'],17,'#31594b',600)}${leader('M828 188H807L730 208','upper-epidermis')}
    ${text(837,243,['柵狀葉肉細胞'],17,'#31594b',600)}${text(837,265,['細胞呈柱狀，緊密排列'],14,'#6f8775')}${leader('M828 238H798L730 259','palisade-mesophyll')}
    ${text(837,316,['海綿葉肉細胞'],17,'#31594b',600)}${text(837,338,['細胞排列疏鬆，其間形成氣室'],14,'#6f8775')}${leader('M828 311H789L718 326','spongy-mesophyll')}
    ${text(837,372,['水膜'],17,pull,600)}${leader('M828 367H779V347H658L650 355','water-film')}
    ${text(837,412,['氣室（細胞之間）'],17,'#31594b',600)}${leader('M828 407H779V417H653L614 404','air-space')}
    ${text(837,461,['下表皮細胞'],17,'#31594b',600)}${leader('M828 456H779L723 478','lower-epidermis')}
    ${text(837,514,['保衞細胞'],17,'#31594b',600)}${text(837,536,['控制氣孔開合；含葉綠體'],14,'#6f8775')}${leader('M828 509H746L686 500L668 490','guard-cells')}
    ${text(742,575,['氣孔'],17,'#31594b',600)}${leader('M734 570H715V530L687 515L642 496','stoma')}
    ${arrow('M24 589H57')}${text(67,594,['水份運輸／滲透'],15,pull)}${arrow('M282 589H315',true)}${text(324,594,['水汽移動／擴散'],15,evaporation)}
    <g class="process-heading" data-process-group="evaporation"><rect x="20" y="620" width="412" height="34" rx="10" fill="${evaporation}"/>${text(130,643,['經氣孔進行的蒸騰'],18,'#fff',600)}</g>
    <g class="process-heading" data-process-group="pull"><rect x="450" y="620" width="610" height="34" rx="10" fill="${pull}"/>${text(683,643,['蒸騰拉力的形成'],18,'#fff',600)}</g>
    ${processes.map(({group,n,x,width,lines})=>`<g class="process-card" data-process-group="${group}"><rect x="${x}" y="665" width="${width}" height="89" rx="12" fill="${group==='evaporation'?'#fff8f1':'#eff7fb'}" stroke="${group==='evaporation'?'#e9c7a6':'#badbe7'}"/>${badge(x+19,687,n,group)}${text(x+37,688,lines,14,'#4e625a')}</g>`).join('')}
    ${text(23,783,['局部放大示意，並非按比例。實驗中的西芹長柄實際是葉柄；本圖的莖部用作說明木質導管的運輸。'],14,'#6e897b')}
  </svg></div>`;
}
function renderReport(record) {
  const f=record.form, initial=record.initialDesign?.form||f;
  const setupImage=/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(record.setup.image||'')?`<img class="setup-image" src="${esc(record.setup.image)}" alt="學生實驗裝置設計">`:'';
  const refs={iv:['光強度'],dv:[VARIABLE_NAMES[1]],cv:VARIABLE_NAMES.slice(2)};
  const variables=VARIABLE_GROUPS.map(([id,title])=>reportAnswer(title,record.variables[id].join('、'),refs[id].join('、'),record.variables[id].length?sameChoices(record.variables[id],refs[id]):null)).join('');
  const assumptions=ASSUMPTIONS.map(item=>reportAnswer(item.text,record.assumptions.includes(item.id)?'已選擇':'未選擇',(item.valid?'應選擇。':'不應選擇。')+item.reference,record.assumptions.length?record.assumptions.includes(item.id)===item.valid:null)).join('');
  const measurements=[0,10,20,30].map(t=>`<tr><td>${t}</td>${IDS.map(id=>{
    const raw=record.measurements[t]?.values?.[id], answered=raw!==undefined&&raw!==''&&Number.isFinite(+raw), reference=record.model[id][t/10];
    return `<td>${answered?esc((+raw).toFixed(1)):'未回答'} ${answerMark(answered?Math.abs(+raw-reference)<=.25:null)}<small>參考：${reference.toFixed(1)}</small></td>`;
  }).join('')}</tr>`).join('');
  const calculations=IDS.map(id=>{
    const raw=record.calculations[id],expected=expectedRate(record,id),answered=raw!==undefined&&raw!==''&&Number.isFinite(+raw);
    return reportAnswer(`裝置${id} · 平均上移速度`,answered?`${esc(raw)} cm/min`:'未回答',`光距：${CONDITIONS[id].distance} cm；光強度：${CONDITIONS[id].light} lux；30 分鐘讀數：${record.measurements[30]?.values?.[id]??'未記錄'} cm；向上移動的距離：${recordedDistance(record,id)} cm。根據你的讀數計算：${rateReference(record,id)}。`,answered&&Number.isFinite(expected)?Math.abs(+raw-expected)<=rateTolerance(record):null);
  }).join('');
  const points=IDS.map(id=>{
    const p=record.graph.points[id],rate=record.calculations[id],hasRate=rate!==undefined&&rate!==''&&Number.isFinite(+rate);
    return reportAnswer(`裝置${id} · X坐標、Y坐標`,p?`（${p.x}, ${Number.isFinite(+p.y)?(+p.y).toFixed(rateDigits(record)):'未回答'}）`:'未回答',`X坐標為光強度 ${CONDITIONS[id].light} lux；Y坐標為你計算的平均上移速度${hasRate?` ${rate} cm/min`:'（尚未計算）'}。`,p&&hasRate?p.x===CONDITIONS[id].light&&Math.abs(p.y-(+rate))<.00051:null);
  }).join('');
  const b=record.calculations.B,d=record.calculations.D,comparable=b!==undefined&&d!==undefined&&b!==''&&d!==''&&Number.isFinite(+b)&&Number.isFinite(+d);
  const comparison=+b>+d+.0005?'faster':+b<+d-.0005?'slower':'same';
  const choice=(field,title,key,reference)=>reportAnswer(title,f[field]?answerText(field,f[field]):'',reference??ANSWER_LABELS[field][key],f[field]&&key?f[field]===key:null);
  const total=Math.round(Object.values(record.phaseDurations).reduce((sum,n)=>sum+n,0));
  $('#printReport').innerHTML=`<header class="report-cover"><span class="report-logo">✦</span><div><p>IBL 虛擬實驗室 · S4 生物 · 模組 2</p><h1>西芹的紅色水跡</h1><strong>個人學習紀錄</strong></div></header><div class="report-meta"><span>姓名：${esc(record.profile?.name)}</span><span>班別及學號：${esc(record.profile?.classInfo||'—')}</span><span>電郵：${esc(record.profile?.email||'—')}</span><span>探究遞交：${esc(dateText(record.submittedAt))}</span><span>反思提交：${esc(dateText(record.reflectionSubmittedAt))}</span><span>有效操作時間：約 ${Math.floor(total/60)} 分 ${total%60} 秒</span></div>
    <section class="report-section"><h2>01 · 了解情境</h2><div class="report-card"><p class="card-kicker">研究情境</p><div class="report-scene"><div><p>開始時</p>${celerySVG('report-before',0,true)}</div><div><p>過了一段時間</p>${celerySVG('report-after',7,true)}</div></div>${reportAnswer('主要探究問題','在其他條件相同下，光強度如何影響帶葉西芹中紅色水跡向上移動的速度？')}${reportAnswer('你的初步觀察',f.observation,'過了一段時間後，紅色水跡沿西芹長柄內的部分區域向上延伸。')}${reportAnswer('構造辨認','西芹長柄是葉柄，外觀像莖，內含木質部。')}</div></section>
    <section class="report-section"><h2>02 · 設計探究</h2><div class="report-card"><p class="card-kicker">我的假說</p>${reportAnswer('實驗前的原始假說',hypothesisText(record),'此題沒有固定答案；假說應能透過改變光強度和量度水跡上移速度來測試。')}${reportAnswer('原始假說理由',initial.reason,'說明你預期光照與水分運輸有何關係；預測毋須猜中結果。')}</div><div class="report-card"><p class="card-kicker">我的公平測試設計</p>${variables}</div><div class="report-card"><p class="card-kicker">此探究的假設是什麼？</p>${assumptions}</div><div class="report-card">${reportAnswer('探究的對照組',f.controlPlan,'裝置D 不帶葉，與帶葉的裝置B 比較；兩者皆為 20 cm 光照距離，其餘條件相同，主要差別是葉片有無。')}${reportAnswer('我的實驗裝置設計',f.setupDescription,'材料：西芹 ×4、檯燈 ×4、紅色水杯 ×4、30 cm 尺子 ×4、剪刀 ×1、計時器 ×1。三株帶葉西芹的燈距為 10、20、30 cm；不帶葉組與其中一個帶葉組保持相同燈距。各浸入紅色水 2 cm。')}${setupImage}</div></section>
    <section class="report-section"><h2>03 · 進行探究與收集數據</h2><div class="report-card"><p>你的量度記錄（cm）</p><table><thead><tr><th>時間（min）</th>${IDS.map(id=>`<th>裝置${id} · ${CONDITIONS[id].leaves?'帶葉':'不帶葉'}<br>${CONDITIONS[id].distance} cm（光強度：${CONDITIONS[id].light} lux）</th>`).join('')}</tr></thead><tbody>${measurements}</tbody></table></div></section>
    <section class="report-section"><h2>04 · 分析與結論</h2><div class="report-card"><p class="card-kicker">計算平均上移速度</p><p>參考計算方法：平均上移速度＝（30 分鐘高度 − 0 分鐘高度）÷ 30 分鐘</p>${calculations}</div><div class="report-card"><p class="card-kicker">我的圖表：光照與紅色水跡上移速度</p><div class="report-graph"><svg viewBox="0 0 760 460" role="img" aria-label="學生圖表">${graphMarkup(record)}</svg></div>${points}<p>標點按你的計算檢核；計算是否正確另列於上方。曲線呈現三點之間的趨勢，並不能證明其間所有光強度的精確結果。</p></div><div class="report-card">${choice('claim','主張：光照與水跡上移速度有甚麼關係？','increase')}${choice('leafComparison','相同光照距離下，裝置B（帶葉）與裝置D（不帶葉）的速度比較',comparable?comparison:null,comparable?`按你計算的數值：裝置B ${(+b).toFixed(rateDigits(record))}、裝置D ${(+d).toFixed(rateDigits(record))} cm/min。${ANSWER_LABELS.leafComparison[comparison]}`:'先完成裝置B 和裝置D 的平均上移速度計算，再比較兩者。')}${choice('leafConclusion','帶葉與不帶葉的比較顯示葉片有何作用？','promotes')}${choice('limitations','這些數據還不能直接證明甚麼？','indirect')}</div></section>
    <section class="report-section"><h2>學習重點：葉與莖的內部構造</h2><div class="report-card">${structureDiagram('report')}${$('.learning-points').outerHTML}</div></section><section class="report-section"><h2>學習反思</h2><div class="report-card">${reportAnswer('你的原始假說',hypothesisText(record))}${reportAnswer('原始假說是否獲數據支持？請運用學習重點修訂或完善假說解釋，並連結你的數據。',f.reflection,'比較原始預測與量度結果，指出支持或不支持的數據，再修訂解釋。例如：若原先預測光強度增加會令水跡變慢，但帶葉組在較強光照下上移較快，則原始預測不獲支持；可修訂為光照通常促進氣孔開啟及蒸騰，並促進水分沿木質部向上運輸。水跡仍只是間接線索。')}</div></section><footer class="report-footer">✓／✕ 為有標準答案項目的檢核；開放題只附參考答案，不自動評分。這些檢核不等同 SPS 評分。學習重點參照課本第 11.1 節（頁 11-3 至 11-8）。水跡為教學模擬，不是直接蒸騰速率量度。紀錄識別碼：${esc(record.id)}</footer>`;
}

// Minimal OOXML writer: genuine .xlsx, UTF-8 inline strings, no external library.
function xml(value){return String(value??'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));}
function colName(index){let name='';for(let n=index+1;n;n=Math.floor((n-1)/26))name=String.fromCharCode(65+(n-1)%26)+name;return name;}
const EXCEL_GROUPS=['identity','observing','classifying','designing','conducting','inferring','communicating','knowledge','score','reference'];
const EXCEL_FILLS=['EEF1F4','E7F0FC','EEE8FA','FFF4D9','E7F3E8','FCEBDD','E1F3F6','FBE7EF','E5ECEF','F6F8F7'];
const excelCell=(value,group='identity',mark=null)=>({value,group,mark});
const excelFormula=(formula,group='score')=>({value:'',formula,group});
function excelStyle(group,variant=0){return 1+Math.max(0,EXCEL_GROUPS.indexOf(group))*5+variant;}
function excelStylesXML(){
  const colours=['173E34','00834A','C03030','A46900','FFFFFF'];
  const fonts=colours.map((colour,i)=>`<font><sz val="11"/><color rgb="FF${colour}"/><name val="Calibri"/>${i===4?'<b/>':''}</font>`).join('');
  const fills='<fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>'+EXCEL_FILLS.map(colour=>`<fill><patternFill patternType="solid"><fgColor rgb="FF${colour}"/><bgColor indexed="64"/></patternFill></fill>`).join('')+'<fill><patternFill patternType="solid"><fgColor rgb="FF087B78"/><bgColor indexed="64"/></patternFill></fill>';
  const xfs='<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'+EXCEL_GROUPS.map((_,g)=>[0,1,2,3,4].map(v=>`<xf numFmtId="0" fontId="${v}" fillId="${v===4?12:g+2}" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>`).join('')).join('');
  return `<?xml version="1.0"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="5">${fonts}</fonts><fills count="13">${fills}</fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="51">${xfs}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles><dxfs count="3">${[1,2,3].map(i=>`<dxf><font><color rgb="FF${colours[i]}"/></font></dxf>`).join('')}</dxfs></styleSheet>`;
}
function sheetXML(sheet){
  const rows=sheet.rows;
  const cells=rows.map((row,r)=>`<row r="${r+1}">${row.map((raw,c)=>{
    const cell=raw&&typeof raw==='object'?raw:excelCell(raw),value=cell.value??'';
    const variant=r===0?4:cell.mark===true?1:cell.mark===false?2:cell.mark==='partial'?3:0;
    const attrs=`r="${colName(c)}${r+1}" s="${excelStyle(cell.group,variant)}"`;
    if(cell.formula)return `<c ${attrs}><f>${xml(cell.formula)}</f></c>`;
    if(typeof value==='number'&&Number.isFinite(value))return `<c ${attrs}><v>${value}</v></c>`;
    return `<c ${attrs} t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`;
  }).join('')}</row>`).join('');
  const validation=sheet.validations?.length?`<dataValidations count="${sheet.validations.length}">${sheet.validations.map(v=>`<dataValidation type="whole" operator="between" allowBlank="1" showErrorMessage="1" errorTitle="分數超出範圍" error="請輸入 0 至 ${v.max} 的整數。" sqref="${v.range}"><formula1>0</formula1><formula2>${v.max}</formula2></dataValidation>`).join('')}</dataValidations>`:'';
  const conditional=(sheet.conditional||[]).map((rule,i)=>`<conditionalFormatting sqref="${rule.cell}">${[0,1,2].map(v=>`<cfRule type="expression" dxfId="${v}" priority="${i*3+v+1}"><formula>${xml(rule.formulas[v])}</formula></cfRule>`).join('')}</conditionalFormatting>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane xSplit="2" ySplit="1" topLeftCell="C2" activePane="bottomRight" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="${rows[0].length}" width="24" customWidth="1"/></cols><sheetData>${cells}</sheetData>${rows.length>1?`<autoFilter ref="A1:${colName(rows[0].length-1)}${rows.length}"/>`:''}${conditional}${validation}</worksheet>`;
}
const crcTable=Array.from({length:256},(_,n)=>{let c=n;for(let i=0;i<8;i++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
function crc32(bytes){let crc=0xffffffff;for(const b of bytes)crc=crcTable[(crc^b)&255]^(crc>>>8);return(crc^0xffffffff)>>>0;}
function zipStore(files){
  const encoder=new TextEncoder(),parts=[],central=[];let offset=0;
  const u16=v=>new Uint8Array([v&255,(v>>>8)&255]);
  const u32=v=>new Uint8Array([v&255,(v>>>8)&255,(v>>>16)&255,(v>>>24)&255]);
  const join=arrays=>{const out=new Uint8Array(arrays.reduce((n,a)=>n+a.length,0));let pos=0;for(const a of arrays){out.set(a,pos);pos+=a.length;}return out;};
  for(const[name,content]of Object.entries(files)){
    const nb=encoder.encode(name),bytes=typeof content==='string'?encoder.encode(content):content,crc=crc32(bytes);
    const local=join([u32(0x04034b50),u16(20),u16(0x800),u16(0),u16(0),u16(0),u32(crc),u32(bytes.length),u32(bytes.length),u16(nb.length),u16(0),nb,bytes]);parts.push(local);
    central.push(join([u32(0x02014b50),u16(20),u16(20),u16(0x800),u16(0),u16(0),u16(0),u32(crc),u32(bytes.length),u32(bytes.length),u16(nb.length),u16(0),u16(0),u16(0),u16(0),u32(0),u32(offset),nb]));offset+=local.length;
  }
  const directory=join(central),end=join([u32(0x06054b50),u16(0),u16(0),u16(central.length),u16(central.length),u32(directory.length),u32(offset),u16(0)]);
  return new Blob([...parts,directory,end],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
}
function workbook(sheets,images=[]){
  const files={
    '[Content_Types].xml':`<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheets.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`,
    '_rels/.rels':'<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    'xl/workbook.xml':`<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s,i)=>`<sheet name="${xml(s.name)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets><calcPr calcId="191029" fullCalcOnLoad="1" forceFullCalc="1"/></workbook>`,
    'xl/_rels/workbook.xml.rels':`<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`
  };
  files['xl/styles.xml']=excelStylesXML();
  sheets.forEach((s,i)=>files[`xl/worksheets/sheet${i+1}.xml`]=sheetXML(s));
  if(images.length){
    files['[Content_Types].xml']=files['[Content_Types].xml'].replace('</Types>','<Default Extension="jpeg" ContentType="image/jpeg"/><Default Extension="png" ContentType="image/png"/><Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/></Types>');
    const last=sheets.length;
    files[`xl/worksheets/sheet${last}.xml`]=files[`xl/worksheets/sheet${last}.xml`].replace('</worksheet>','<drawing xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="rId1"/></worksheet>').replace(/<row r="(\d+)"/g,(match,row)=>+row>1?match+' ht="130" customHeight="1"':match);
    files[`xl/worksheets/_rels/sheet${last}.xml.rels`]='<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/></Relationships>';
    files['xl/drawings/drawing1.xml']=`<?xml version="1.0"?><xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">${images.map((item,i)=>`<xdr:twoCellAnchor editAs="oneCell"><xdr:from><xdr:col>4</xdr:col><xdr:colOff>50000</xdr:colOff><xdr:row>${item.row}</xdr:row><xdr:rowOff>50000</xdr:rowOff></xdr:from><xdr:to><xdr:col>8</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${item.row+1}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to><xdr:pic><xdr:nvPicPr><xdr:cNvPr id="${i+1}" name="裝置設計圖 ${i+1}"/><xdr:cNvPicPr/></xdr:nvPicPr><xdr:blipFill><a:blip r:embed="rId${i+1}"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill><xdr:spPr><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic><xdr:clientData/></xdr:twoCellAnchor>`).join('')}</xdr:wsDr>`;
    files['xl/drawings/_rels/drawing1.xml.rels']=`<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${images.map((item,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/setup-${i+1}.${item.ext}"/>`).join('')}</Relationships>`;
    images.forEach((item,i)=>files[`xl/media/setup-${i+1}.${item.ext}`]=Uint8Array.from(atob(item.data.split(',')[1]),c=>c.charCodeAt(0)));
  }
  return zipStore(files);
}
// Scores exist only in the teacher workbook. Open responses require teacher judgement.
function scoringWorkbook(records){
  const columns=[
    ['id','紀錄識別碼','identity'],['name','姓名','identity'],['class','班別及學號','identity'],['status','完成狀態','identity'],
    ['observation','觀察｜初步觀察・教師評分（0–2）','observing',2],['measure','觀察｜量尺讀數・自動（0–2）','observing'],['observing','SPS 觀察（0–4）','observing'],
    ['iv','分類｜獨立變量・自動（0–1）','classifying'],['dv','分類｜因變量・自動（0–1）','classifying'],['cv','分類｜控制變量・自動（0–2）','classifying'],['classifying','SPS 分類（0–4）','classifying'],
    ['hypothesis','設計｜可測試假說及理由・教師評分（0–2）','designing',2],['assumptions','設計｜假設選擇・自動（0–1）','designing'],['control','設計｜對照裝置・教師評分（0–1）','designing',1],['designing','SPS 設計探究（0–4）','designing'],
    ['rounds','實作｜四輪完整量度・自動（0–2）','conducting'],['setup','實作｜裝置方案・教師評分（0–2）','conducting',2],['conducting','SPS 進行實驗（0–4）','conducting'],
    ['rates','推論｜平均速度計算・自動（0–2）','inferring'],['conclusions','推論｜四項結論・自動（0–2）','inferring'],['inferring','SPS 推論（0–4）','inferring'],
    ['graph','溝通｜標點及連線・自動（0–2）','communicating'],['communication','溝通｜書面表達・教師評分（0–2）','communicating',2],['communicating','SPS 溝通（0–4）','communicating'],['sps','SPS 總分（0–24）','score'],
    ['evaporation','新知識｜蒸騰與氣孔・教師評分（0–2）','knowledge',2],['transport','新知識｜木質部及蒸騰拉力・教師評分（0–2）','knowledge',2],['light','新知識｜光強度影響・教師評分（0–2）','knowledge',2],['revision','新知識｜運用概念修訂原始解釋・教師評分（0–2）','knowledge',2],['knowledge','新知識學習分數（0–8）','knowledge'],['overall','整體分數（0–32）','score'],['marking','評分狀態','score']
  ];
  const col=Object.fromEntries(columns.map(([id],i)=>[id,colName(i)])),rows=[columns.map(([,label,group])=>excelCell(label,group))];
  const round=n=>Math.round(n*100)/100;
  records.forEach((r,index)=>{
    const n=index+2,ref=id=>col[id]+n,vars=r.variables,readings=[0,10,20,30].flatMap(t=>IDS.map(id=>{const v=r.measurements[t]?.values?.[id];return r.measurements[t]?.confirmed&&v!==undefined&&v!==''&&Number.isFinite(+v)&&Math.abs(+v-r.model[id][t/10])<=.25;}));
    const rateCorrect=IDS.map(id=>{const v=r.calculations[id];return v!==undefined&&v!==''&&Number.isFinite(+v)&&Number.isFinite(expectedRate(r,id))&&Math.abs(+v-expectedRate(r,id))<=rateTolerance(r);});
    const b=r.calculations.B,d=r.calculations.D,comparable=b!==undefined&&d!==undefined&&b!==''&&d!==''&&Number.isFinite(+b)&&Number.isFinite(+d);
    const comparison=+b>+d+.0005?'faster':+b<+d-.0005?'slower':'same';
    const conclusionCorrect=[r.form.claim==='increase',comparable&&r.form.leafComparison===comparison,r.form.leafConclusion==='promotes',r.form.limitations==='indirect'];
    const pointCorrect=IDS.map(id=>{const p=r.graph.points[id],v=r.calculations[id];return p&&v!==undefined&&v!==''&&Number.isFinite(+v)&&p.x===CONDITIONS[id].light&&Math.abs(p.y-(+v))<.00051;});
    const graphConnected=r.graph.connected&&['A','B','C'].every(id=>pointCorrect[IDS.indexOf(id)]);
    const values={id:r.id,name:r.profile?.name,class:r.profile?.classInfo,status:reflectionComplete(r)?'已完成':r.submitted?'待提交反思':'進行中',measure:round(readings.filter(Boolean).length/16*2),iv:sameChoices(vars.iv,[VARIABLE_NAMES[0]])?1:0,dv:sameChoices(vars.dv,[VARIABLE_NAMES[1]])?1:0,cv:round(VARIABLE_NAMES.slice(2).filter(v=>vars.cv.includes(v)).length/5*2*(vars.cv.some(v=>!VARIABLE_NAMES.slice(2).includes(v))?0:1)),assumptions:sameChoices(r.assumptions,ASSUMPTIONS.filter(a=>a.valid).map(a=>a.id))?1:0,rounds:[0,10,20,30].filter(t=>r.measurements[t]?.confirmed&&IDS.every(id=>{const v=r.measurements[t].values?.[id];return v!==undefined&&v!==''&&Number.isFinite(+v)&&+v>=0&&+v<=16;})).length*.5,rates:rateCorrect.filter(Boolean).length*.5,conclusions:conclusionCorrect.filter(Boolean).length*.5,graph:round(pointCorrect.filter(Boolean).length*.375+(graphConnected?.5:0))};
    const manual=columns.filter(c=>c[3]!==undefined).map(([id])=>ref(id));
    const sum=(ids,required)=>`IF(COUNT(${required.map(ref).join(',')})=${required.length},ROUND(SUM(${ids.map(ref).join(',')}),2),"待評")`;
    const formulas={observing:sum(['observation','measure'],['observation']),classifying:`SUM(${ref('iv')},${ref('dv')},${ref('cv')})`,designing:sum(['hypothesis','assumptions','control'],['hypothesis','control']),conducting:sum(['rounds','setup'],['setup']),inferring:`SUM(${ref('rates')},${ref('conclusions')})`,communicating:sum(['graph','communication'],['communication']),sps:`IF(COUNT(${['observing','classifying','designing','conducting','inferring','communicating'].map(ref).join(',')})=6,ROUND(SUM(${['observing','classifying','designing','conducting','inferring','communicating'].map(ref).join(',')}),2),"待評")`,knowledge:sum(['evaporation','transport','light','revision'],['evaporation','transport','light','revision']),overall:`IF(AND(COUNT(${ref('sps')},${ref('knowledge')})=2,${ref('status')}="已完成"),ROUND(SUM(${ref('sps')},${ref('knowledge')}),2),"待評／未完成")`,marking:`IF(AND(COUNT(${manual.join(',')})=${manual.length},${ref('status')}="已完成"),"評分完成","待教師評分／學生未完成")`};
    rows.push(columns.map(([id,,group,max])=>formulas[id]?excelFormula(formulas[id],group):excelCell(max!==undefined?'':values[id],group)));
  });
  const validations=columns.flatMap(([id,,group,max])=>max===undefined?[]:[{range:`${col[id]}2:${col[id]}${records.length+1}`,max}]);
  const rubric=[['類別／題目','最高分','評分方式','滿分準則','部分得分準則','零分準則']];
  const add=(group,title,max,method,full,partial,zero)=>rubric.push([excelCell(title,group),max,method,full,partial,zero]);
  add('observing','初步觀察',2,'教師填寫','描述紅色水跡沿長柄內部分區域向上延伸；能分開觀察與解釋。','1：提及紅色水跡或顏色改變，但缺少位置／方向。','未回答、無關或把未觀察到的機制當作直接觀察。');
  add('observing','量尺讀數',2,'自動','16 個最後確認讀數全部與尺子模型參考值相差不超過 0.25 cm。','2 × 正確讀數數目 ÷ 16（保留兩位小數）。','沒有正確且已確認的讀數。');
  add('classifying','變量分類',4,'自動','獨立：光強度（1）；因變量：紅色水跡上升高度／平均上移速度（1）；五項控制變量（2）。','控制變量：每項 0.4；誤選獨立／因變量作控制變量則該欄 0 分。','未回答或分類錯誤。');
  add('designing','可測試假說及理由',2,'教師填寫','明確預測改變光強度後水跡速度如何改變，並給出與現象相關的理由；不要求預測結果正確。','1：假說可測試，但理由缺漏或不清晰。','沒有可測試的假說；只抄結論而無實驗前預測。');
  add('designing','實驗假設選擇',1,'自動','只選溫度不改變、帶葉組總葉面積相同、濕度及氣流相同三項。','全組正確才給分；不另計部分分。','錯選、漏選或未作答。');
  add('designing','對照裝置設計',1,'教師填寫','帶葉／不帶葉裝置使用相同燈距，其餘條件保持相同。','此項只給 0 或 1 分。','沒有控制葉片以外的因素，或未作答。');
  add('conducting','四輪完整量度',2,'自動','0、10、20、30 min 各有四個有效、已確認讀數。','每輪 0.5；量度準確度另計於觀察，不重複計。','沒有完整確認的量度輪次。');
  add('conducting','實驗裝置方案',2,'教師填寫','圖像／文字顯示四株、三種帶葉燈距及同距不帶葉對照、紅色水及量尺／時間量度安排。','1：方案基本可操作，但缺少一項主要安排。','不能操作、無關或未完成。');
  add('inferring','平均上移速度計算',2,'自動','四組（30 min 高度 − 0 min 高度）÷ 30；每組正確 0.5。','依學生最後確認讀數計算，新紀錄保留兩位小數，允許 0.0051 cm/min 捨入差異；舊紀錄依原有三位小數及 0.00051 容差檢核。','無正確計算；不使用模型高度取代學生讀數評算術。');
  add('inferring','四項結論',2,'自動','光強度增加速度通常增加；B/D 比較與學生計算相符；葉片促進運輸；水跡為間接線索。','每個正確選項 0.5。B/D 資料不足不得分。','錯誤／未回答。');
  add('communicating','圖表標點及連線',2,'自動','四點 X = 各組 lux、Y = 學生自己計算速度（每點 0.375）；正確 A/B/C 三點已連線（0.5）。','以未四捨五入的點數計分再保留兩位小數；不把 D 連入帶葉曲線。','無正確標點或連線。計算錯誤另計於推論，圖表以其計算檢核。');
  add('communicating','書面表達',2,'教師填寫','觀察、裝置方案及反思能清楚傳達想法，數據／裝置名稱／單位使用清晰；評表達而非概念正確性。','1：可理解，但描述含糊或缺乏必要標示。','無法理解或未提供可評的表達。');
  add('knowledge','學習反思：蒸騰與氣孔',2,'教師填寫','修訂解釋中正確說明葉肉細胞表面水膜蒸發，水汽經氣孔擴散離開葉。','1：正確提及葉片蒸發／氣孔散失水汽，但機制不完整。','未用此概念或有核心錯誤。');
  add('knowledge','學習反思：木質部及蒸騰拉力',2,'教師填寫','修訂解釋中連結蒸騰產生蒸騰拉力，使水份沿木質導管向上運輸。','1：正確提及木質部運輸或蒸騰拉力，但沒有連結。','未用此概念或有核心錯誤。');
  add('knowledge','學習反思：光強度影響',2,'教師填寫','修訂解釋中連結較強光照通常促進氣孔開啟、蒸騰及水分向上運輸，避免稱水跡速度就是蒸騰速率。','1：正確描述較強光照與較快水跡的關係，但沒有機制。','關係相反、直接等同蒸騰速率或未運用概念。');
  add('knowledge','學習反思：運用概念修訂原始解釋',2,'教師填寫','指出原始假說是否獲自己數據支持，以數據及學習重點修訂／完善解釋；原始假說正確也可得滿分。','1：有判斷或修訂，但欠缺數據／概念連結。','只抄學習重點，未檢驗原始假說，或未提交反思。');
  add('score','配分與完成條件',32,'公式彙總','六項 SPS 各 4 分，共 24；新知識四項各 2，共 8；整體 32。教師填完九個評分格及學生完成反思，整體分數才顯示。','人工評分格空白＝待評，與填 0 分不同。公式由 Excel 開啟時重算；教師在此檔填分後請保存。','新下載 Excel 不會讀取之前檔案內的人工分數；分數只存於教師保存的 Excel。');
  add('reference','色彩與研究使用',0,'說明','底色區分 SPS 類別及新知識；綠字正確／滿分，紅字錯誤／零分，橙字部分得分，未評中性色。','人工答案在填分後依公式變色。PDF 不顯示任何分數；活動紀錄不是 SPS 分數。','本 rubric 為 VL2 初稿；正式縱向比較前需對四個模組統一準則、配分及評分者校準。');
  return {sheet:{name:'教師評分',rows,validations},rubric:{name:'評分準則',rows:rubric},col};
}

async function exportExcel(){
  if(!isTeacher())return;
  if(cloud.enabled&&!await refreshCloudRecords())return;
  save();const records=teacherRecords();
  if(!records.length){toast('目前沒有可匯出的研究紀錄。');return;}
  const headings=['紀錄識別碼','姓名','班別及學號','電郵','狀態','建立時間','遞交時間','初步觀察','原始預測','原始理由','目前預測','目前理由','獨立變量－學生答案','獨立變量－參考答案','因變量－學生答案','因變量－參考答案','控制變量－學生答案','控制變量－參考答案','假設－學生答案','假設－參考答案','對照裝置設計－學生答案','對照裝置設計－參考答案','裝置文字設計','X軸','Y軸','光強度關係－學生答案','光強度關係－參考答案','葉片比較－學生答案','葉片作用－學生答案','葉片作用－參考答案','實驗限制－學生答案','實驗限制－參考答案','反思','總有效秒數','階段一有效秒數','階段二有效秒數','階段三有效秒數','階段四有效秒數','記錄量度次數','計算作答次數','標點次數','結論作答次數'];
  const rows=[headings],data=[['紀錄識別碼','姓名','模擬時間（min）','裝置','光照距離（cm）','光強度（lux）','葉片','首次讀數（cm）','最後讀數（cm）','模型參考高度（cm）','學生平均速度（cm/min）','依學生數據計算的速度（cm/min）','圖點 X坐標','圖點 Y坐標']];
  const events=[['紀錄識別碼','姓名','事件','時間（香港）','階段','事件詳情']];
  const designs=[['姓名','班別及學號','電郵','文字設計','裝置設計圖']];
  const images=[];
  records.forEach(r=>{
    const f=r.form,initial=r.initialDesign?.form||f;
    const count=type=>r.events.filter(e=>e.type===type).length;
    rows.push([r.id,r.profile?.name,r.profile?.classInfo,r.profile?.email,r.submitted?'已遞交':'進行中',dateText(r.createdAt),dateText(r.submittedAt),f.observation,PREDICTIONS[initial.prediction],initial.reason,PREDICTIONS[f.prediction],f.reason,r.variables.iv.join('、'),'光強度',r.variables.dv.join('、'),'紅色水跡上升高度／平均上移速度',r.variables.cv.join('、'),VARIABLE_NAMES.slice(2).join('、'),r.assumptions.map(id=>ASSUMPTIONS.find(a=>a.id===id)?.text||id).join('；'),ASSUMPTIONS.filter(a=>a.valid).map(a=>a.text).join('；'),f.controlPlan,'同一光照距離，帶葉與不帶葉比較，其餘條件相同。',f.setupDescription,'光強度（lux）','紅色水跡平均上移速度（cm/min）',answerText('claim',f.claim),ANSWER_LABELS.claim.increase,answerText('leafComparison',f.leafComparison),answerText('leafConclusion',f.leafConclusion),ANSWER_LABELS.leafConclusion.promotes,answerText('limitations',f.limitations),ANSWER_LABELS.limitations.indirect,f.reflection,Math.round(Object.values(r.phaseDurations).reduce((a,b)=>a+b,0)),...[1,2,3,4].map(p=>Math.round(r.phaseDurations[p])),count('measurements_recorded')+count('measurements_reconfirmed'),count('rate_calculated'),count('graph_point_plotted'),r.events.filter(e=>e.type==='answer_changed'&&['claim','leafComparison','leafConclusion','limitations'].includes(e.field)).length]);
    [0,10,20,30].forEach(t=>IDS.forEach(id=>{const c=CONDITIONS[id];data.push([r.id,r.profile?.name,t,`裝置${id}`,c.distance,c.light,c.leaves?'帶葉':'不帶葉',r.measurements[t]?.firstValues?.[id]??'',r.measurements[t]?.values?.[id]??'',r.model[id][t/10].toFixed(1),r.calculations[id]??'',r.measurements[30]?.confirmed?expectedRate(r,id).toFixed(rateDigits(r)):'',r.graph.points[id]?.x??'',r.graph.points[id]?.y??'']);}));
    r.events.forEach(e=>events.push([r.id,r.profile?.name,e.type,dateText(e.at),e.phase,JSON.stringify(e)]));
    designs.push([r.profile?.name,r.profile?.classInfo,r.profile?.email,f.setupDescription,r.setup.image?'圖像如下':'文字設計']);
    const match=/^data:image\/(jpeg|png);base64,[A-Za-z0-9+/=]+$/.exec(r.setup.image||'');
    if(match)images.push({row:designs.length-1,data:r.setup.image,ext:match[1]});
  });
  const scoring=scoringWorkbook(records),answerGroups=headings.map((_,c)=>c<7?'identity':c===7?'observing':c<12?'designing':c<18?'classifying':c<23?'designing':c<25?'communicating':c<32?'inferring':c===32?'knowledge':'identity');
  const styledAnswers=rows.map((row,index)=>row.map((value,c)=>{
    if(!index)return excelCell(value,answerGroups[c]);
    const r=records[index-1],v=r.variables,b=r.calculations.B,d=r.calculations.D;
    const comparable=b!==undefined&&d!==undefined&&b!==''&&d!==''&&Number.isFinite(+b)&&Number.isFinite(+d),comparison=+b>+d+.0005?'faster':+b<+d-.0005?'slower':'same';
    const checks={12:v.iv.length?sameChoices(v.iv,[VARIABLE_NAMES[0]]):null,14:v.dv.length?sameChoices(v.dv,[VARIABLE_NAMES[1]]):null,16:v.cv.length?sameChoices(v.cv,VARIABLE_NAMES.slice(2)):null,18:r.assumptions.length?sameChoices(r.assumptions,ASSUMPTIONS.filter(a=>a.valid).map(a=>a.id)):null,25:r.form.claim?r.form.claim==='increase':null,27:r.form.leafComparison&&comparable?r.form.leafComparison===comparison:null,28:r.form.leafConclusion?r.form.leafConclusion==='promotes':null,30:r.form.limitations?r.form.limitations==='indirect':null};
    return excelCell(value,answerGroups[c],checks[c]??null);
  }));
  const styledData=data.map((row,index)=>row.map((value,c)=>{
    const group=c<7?'identity':c<10?'observing':c<12?'inferring':'communicating';
    if(!index||![7,8,10,12,13].includes(c)||value==='')return excelCell(value,group);
    const r=records[Math.floor((index-1)/16)],id=IDS[(index-1)%4],t=Math.floor(((index-1)%16)/4)*10;
    let correct=null;
    if(c===7||c===8)correct=Number.isFinite(+value)&&Math.abs(+value-r.model[id][t/10])<=.25;
    if(c===10&&Number.isFinite(expectedRate(r,id)))correct=Math.abs(+value-expectedRate(r,id))<=rateTolerance(r);
    if(c===12)correct=+value===CONDITIONS[id].light;
    if(c===13&&r.calculations[id]!==undefined&&r.calculations[id]!=='')correct=Math.abs(+value-(+r.calculations[id]))<.00051;
    return excelCell(value,group,correct);
  }));
  const conditional=[];
  const colourRule=(cell,score,max)=>({cell,formulas:[`AND(ISNUMBER(${score}),${score}=${max})`,`AND(ISNUMBER(${score}),${score}=0)`,`AND(ISNUMBER(${score}),${score}>0,${score}<${max})`]});
  records.forEach((r,i)=>{
    const row=i+2,ref=id=>`INDIRECT("'教師評分'!${scoring.col[id]}${row}")`;
    [[7,'observation',2],[8,'hypothesis',2],[9,'hypothesis',2],[10,'hypothesis',2],[11,'hypothesis',2],[20,'control',1],[22,'setup',2],[32,'knowledge',8]].forEach(([c,key,max])=>conditional.push(colourRule(colName(c)+row,ref(key),max)));
    const maxById={observation:2,measure:2,observing:4,iv:1,dv:1,cv:2,classifying:4,hypothesis:2,assumptions:1,control:1,designing:4,rounds:2,setup:2,conducting:4,rates:2,conclusions:2,inferring:4,graph:2,communication:2,communicating:4,sps:24,evaporation:2,transport:2,light:2,revision:2,knowledge:8,overall:32};
    scoring.sheet.conditional??=[];
    Object.entries(maxById).forEach(([key,max])=>{const cell=scoring.col[key]+row;scoring.sheet.conditional.push(colourRule(cell,cell,max));});
  });
  download(workbook([{name:'學生探究答案',rows:styledAnswers,conditional},{name:'量度計算與圖點',rows:styledData},scoring.sheet,scoring.rubric,{name:'操作事件紀錄',rows:events},{name:'裝置設計圖',rows:designs}],images),'VL2_蒸騰探究_全班學習紀錄.xlsx');
}
function formatDuration(seconds){const value=Math.round(seconds);return`${Math.floor(value/60)} 分 ${value%60} 秒`;}
function observationAccuracy(record){
  let correct=0,total=0;
  for(const t of [0,10,20,30])if(record.measurements[t]?.confirmed)for(const id of IDS){total++;if(Math.abs(+record.measurements[t].values[id]-record.model[id][t/10])<=.25)correct++;}
  return`${correct} / ${total}`;
}
let previewRecord=null;
function renderTeacherDashboard(){
  if(!isTeacher())return;
  const records=teacherRecords();
  $('#refreshCloud').disabled=!cloud.enabled;$('#cloudTeacherKey').disabled=!cloud.enabled;
  $('#dashboardStatus').textContent=cloud.enabled?(cloud.records?`中央現有 ${records.length} 份學生紀錄，包含不同裝置及多次探究。下載 Excel 時會重新讀取中央資料。`:'請輸入教师存取金鑰並連線，讀取不同裝置的學生紀錄。'):`中央儲存尚未設定。這部瀏覽器現有 ${records.length} 份學生紀錄。`;
  $('#teacherData').innerHTML=records.length?records.map(r=>`<tr><td><strong>${esc(r.profile?.name||'—')}</strong><small>${esc(r.profile?.email||'—')}</small></td><td>${esc(r.profile?.classInfo||'—')}</td><td><span class="report-status ${reflectionComplete(r)?'complete':''}">${reflectionComplete(r)?'已完成':r.submitted?'待提交反思':`階段 ${r.phase}`}</span></td><td>${observationAccuracy(r)}</td><td>${formatDuration(Object.values(r.phaseDurations).reduce((a,b)=>a+b,0))}</td><td>${esc(dateText(r.savedAt))}</td><td><button class="small-button" data-view-record="${esc(r.id)}">查看紀錄</button></td></tr>`).join(''):'<tr><td colspan="7">這部瀏覽器暫無學生紀錄。</td></tr>';
  $$('[data-view-record]').forEach(button=>button.onclick=()=>{
    previewRecord=records.find(r=>r.id===button.dataset.viewRecord);
    renderReport(previewRecord);$('#teacherReport').innerHTML=$('#printReport').innerHTML.replaceAll('structure-report-','structure-teacher-').replaceAll('celery-report-','celery-teacher-');
    $('#teacherDetail').hidden=false;$('#teacherDetail').scrollIntoView({block:'start',behavior:'smooth'});
  });
}
function refreshProfileUI(){
  $('#studentName').textContent=isTeacher()?'教師示範':activeProfile?.name||'同學';
  $('.avatar').textContent=isTeacher()?'師':activeProfile?.name?.[0]||'同';
  $('#teacherButton').hidden=!isTeacher();$('main').inert=!activeProfile?.email;
}
function reportFilename(record){
  const safe=value=>String(value||'未填寫').replace(/[\\/:*?"<>|\u0000-\u001f]/g,'_').trim();
  return `VL2_西芹的紅色水跡_${safe(record.profile?.classInfo)}_${safe(record.profile?.name)}`;
}
async function printRecord(record){
  renderReport(record);
  await Promise.all($$('#printReport img').map(image=>image.complete?Promise.resolve():new Promise(resolve=>{image.onload=resolve;image.onerror=resolve;})));
  await document.fonts.ready;
  document.title=reportFilename(record);
  try{window.print();}catch(error){document.title=PAGE_TITLE;throw error;}
}
window.addEventListener('afterprint',()=>{document.title=PAGE_TITLE;});

function init() {
  FIELD_IDS.forEach(id=>{
    const input=$('#'+id),value=state.form[id];
    if(input.tagName==='SELECT'&&value&&![...input.options].some(option=>option.value===value))input.add(new Option(`先前答案：${value}`,value));
    input.value=value;
  });
  refreshProfileUI();
  $('#sceneBefore').innerHTML=celerySVG('before',0,true);
  $('#sceneAfter').innerHTML=celerySVG('after',7,true);
  renderEquipment();
  $('#mechanismDiagram').innerHTML=structureDiagram();
  renderVariables();initCanvas();renderBench();renderMeasurements();renderCalculations();renderPoints();renderGraph();
  $('#setupStatus').textContent=state.setup.saved?'✓ 裝置設計已儲存':'';
  $$('[data-tool]').forEach(button=>{button.classList.toggle('selected',button.dataset.tool===drawingTool);button.setAttribute('aria-pressed',String(button.dataset.tool===drawingTool));});
  $$('.phase').forEach(el=>el.hidden=el.id!==`phase-${state.phase}`);
  $$('.step').forEach(el=>{el.disabled=+el.dataset.phase>state.unlocked;el.classList.toggle('active',+el.dataset.phase===state.phase);el.classList.toggle('done',+el.dataset.phase<state.phase);if(+el.dataset.phase===state.phase)el.setAttribute('aria-current','step');else el.removeAttribute('aria-current');});
  applyLock();
  $('#profileName').value=activeProfile?.name||state.profile?.name||'';
  $('#profileClass').value=activeProfile?.classInfo||state.profile?.classInfo||'';
  $('#profileEmail').value=activeProfile?.email||'';
  if(!activeProfile?.email)$('#profileDialog').showModal();
  else if(isTeacher()){renderTeacherDashboard();if(!$('#teacherDialog').open)$('#teacherDialog').showModal();}
}

FIELD_IDS.forEach(id=>{
  const input=$('#'+id);
  input.addEventListener('input',()=>{
    state.form[id]=input.value;
    if(id==='setupDescription'){state.setup.saved=false;$('#setupStatus').textContent='文字設計已更新，請儲存。';}
    scheduleSave();
  });
  input.addEventListener('change',()=>{
    state.form[id]=input.value;log('answer_changed',{field:id,value:input.value});
    if(['xAxis','yAxis','graphMax'].includes(id)){
      if(id!=='graphMax'){state.graph={points:{},connected:false};renderPoints();}
      renderGraph();
    }
  });
});
$('#profileForm').onsubmit=event=>{
  event.preventDefault();const name=$('#profileName').value.trim();if(!name){$('#profileName').focus();return;}
  const classInfo=$('#profileClass').value.trim(),email=$('#profileEmail').value.trim().toLowerCase();
  if(!classInfo||!email)return;
  clearInterval(timerHandle);state.running=false;save();clearTimeout(saveTimer);const profile={name,classInfo,email};
  state=freshState(profile);
  drawingChanged=false;drawingTool='pencil';
  activeProfile=profile;activeSince=Date.now();
  try{localStorage.setItem(PROFILE_KEY,JSON.stringify(profile));}catch{toast('未能保存學習者資料。');}
  cloud.records=null;cloud.teacherKey='';$('#cloudTeacherKey').value='';
  $('#profileDialog').close();init();log('profile_saved');save();
  if(cloud.enabled){storedRecords().forEach(record=>cloud.enqueue(record));cloud.flush();}
};
$('#profileButton').onclick=()=>{
  $('#profileName').value=activeProfile?.name||'';$('#profileClass').value=activeProfile?.classInfo||'';$('#profileEmail').value=activeProfile?.email||'';
  $('#closeProfile').hidden=!activeProfile?.email;$('#profileDialog').showModal();
};
$('#closeProfile').onclick=()=>$('#profileDialog').close();
$('#profileDialog').addEventListener('cancel',event=>{if(!activeProfile?.email)event.preventDefault();});
$('#orientationNext').onclick=()=>{
  if(!$('#observation').value.trim()){incomplete('先記錄你的初步觀察。','#observation');return;}
  state.unlocked=Math.max(2,state.unlocked);phase(2);save();
};
$('#designNext').onclick=()=>{
  const missing=designMissing();if(missing){incomplete(...missing);return;}
  readForm();if(!state.initialDesign)state.initialDesign={form:{...state.form},variables:structuredClone(state.variables),assumptions:[...state.assumptions],setup:structuredClone(state.setup),at:new Date().toISOString()};
  log('design_confirmed',{form:{...state.form},variables:structuredClone(state.variables),assumptions:[...state.assumptions]});
  state.unlocked=Math.max(3,state.unlocked);phase(3);save();
};
$$('.step').forEach(button=>button.onclick=()=>phase(+button.dataset.phase));
$$('[data-back]').forEach(button=>button.onclick=()=>phase(+button.dataset.back));
$('#timerButton').onclick=runInterval;
$('#recordMeasurements').onclick=recordMeasurements;
$('.ruler-guide').addEventListener('toggle',()=>{if($('.ruler-guide').open){state.hintsUsed++;log('ruler_guide_opened');}});
$('#experimentNext').onclick=()=>{
  if(!allMeasurements())return;
  state.unlocked=4;phase(4);save();
};
$('#connectPoints').onclick=()=>{
  if(!['A','B','C'].every(id=>state.graph.points[id])){toast('先標示帶葉組裝置A、裝置B、裝置C 的三個圖點。');return;}
  state.graph.connected=true;log('leafy_points_connected');renderGraph();save();
};
$('#clearGraph').onclick=()=>{state.graph={points:{},connected:false};log('graph_cleared');renderPoints();renderGraph();save();};
$('#submitInvestigation').onclick=()=>{const missing=conclusionMissing();if(missing){incomplete(...missing);return;}$('#submitDialog').showModal();};
$('#cancelSubmit').onclick=()=>$('#submitDialog').close();$('#confirmSubmit').onclick=submit;
$('#saveReflection').onclick=()=>{
  if(!state.submitted||reflectionComplete())return;
  if(!$('#reflection').value.trim()){incomplete('請先寫下你的學習反思。','#reflection');return;}
  readForm();state.reflectionSubmittedAt=new Date().toISOString();
  log('reflection_submitted',{value:state.form.reflection});save();updateReflection();
  toast(isTeacher()?'反思示範已完成，可以下載 PDF；不會儲存至學生紀錄或 Excel。':'學習反思已儲存並提交，可以下載學習紀錄 PDF。');
};
$('#downloadPDF').onclick=async()=>{
  if(!reflectionComplete()){toast('請先儲存並提交學習反思，才可下載學習紀錄 PDF。');return;}
  save();log('pdf_print_requested');save();await printRecord(state);
};
$('#newInvestigation').onclick=()=>{
  if(!confirm(isTeacher()?'重新開始教師示範？重新載入後需再次登入，示範操作不會保存。':'開始新的探究？本次紀錄會保留於本機，教師儀表板可查看。未遞交的答案亦會保存。'))return;
  save();clearInterval(timerHandle);clearTimeout(saveTimer);
  allowUnload=true; // The button already obtained confirmation.
  location.reload();
};
$('#teacherButton').onclick=()=>{if(!isTeacher())return;renderTeacherDashboard();$('#teacherDialog').showModal();};
$('#refreshCloud').onclick=refreshCloudRecords;
$('#closeTeacher').onclick=()=>$('#teacherDialog').close();
$('#teacherDemo').onclick=()=>{if(!isTeacher())return;$('#teacherDialog').close();phase(state.phase);toast('教師示範模式：可以進行完整探究，操作不會加入學生紀錄。');};$('#exportExcel').onclick=exportExcel;
$('#teacherPDF').onclick=()=>{if(isTeacher()&&previewRecord)return printRecord(previewRecord);};
$('#importRecords').onchange=async event=>{
  if(!isTeacher())return;
  let success=0,failed=0;const records=storedRecords();
  for(const file of event.target.files){
    try{
      if(file.size>8*1024*1024)throw new Error('too large');
      const record=upgradeRecord(JSON.parse(await file.text()));
      if(!isRecord(record)||!record.profile||isTeacher(record.profile)||JSON.stringify(record).length>8*1024*1024)throw new Error('invalid');
      // Do not replace the active investigation from an imported file.
      const index=records.findIndex(r=>r.id===record.id);
      if(index<0)records.push(record);else if(Date.parse(record.savedAt)>Date.parse(records[index].savedAt))records[index]=record;
      success++;
    }catch{failed++;}
  }
  try{localStorage.setItem(RECORDS_KEY,JSON.stringify(records));records.forEach(record=>cloud.enqueue(record));renderTeacherDashboard();$('#importStatus').textContent=`已處理 ${success} 份紀錄；${failed} 份未匯入（格式不符或檔案過大）。`;}catch{toast('儲存空間不足，未能匯入。');}
  event.target.value='';
};
document.addEventListener('visibilitychange',()=>{
  if(document.hidden){const now=Date.now();if(state.profile&&!isTeacher())state.phaseDurations[state.phase]+=(now-activeSince)/1000;activeSince=now;save();}
  else activeSince=Date.now();
});
window.addEventListener('beforeunload',event=>{
  if(!activeProfile?.email||allowUnload)return;
  save();
  event.preventDefault();event.returnValue=''; // Browsers supply the confirmation wording.
});
window.addEventListener('pagehide',save);
setInterval(()=>{if(state.profile&&!document.hidden)save();},15000);
init();
