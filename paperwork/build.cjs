#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path'),http=require('http'),crypto=require('crypto');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=path.join(__dirname,'generated'),MATERIAL_VERSION=1;
const inputs=['index.html','app.js','styles.css','i18n-static.js','i18n-dynamic.js','i18n-paper.js','i18n.js','i18n-svg.js','paperwork/source.js','paperwork/texts.js','paperwork/print.css','paperwork/client.js','paperwork/build.cjs','paperwork/fonts/NotoSansHK-paper.otf'].sort();
const sha=data=>crypto.createHash('sha256').update(data).digest('hex');
const fingerprints=()=>Object.fromEntries(inputs.map(name=>[name,sha(fs.readFileSync(path.join(root,name)))]));
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function generate(m,lang){
 const s=key=>m.labels[key],pages={A:[],B:[],C:[],D:[]};
 const hint=text=>`<p class="hint">${esc(text)}</p>`;
 const ruled=()=>'<div class="ruled"><div class="writing-line"></div><div class="writing-line"></div></div>';
 const card=(heading,body)=>`<section class="card"><h2>${esc(heading)}</h2>${body}</section>`;
 const options=items=>`<div class="choices">${items.map(o=>`<span class="choice"><span class="checkbox"></span><span>${esc(o.text)}</span></span>`).join('')}</div>`;
 const inline=q=>esc(q.sentence).replace('__________',`<span class="circle-options">（${q.options.map(o=>esc(o.text)).join(' ／ ')}）</span>`);
 const question=(q,i=0,items=[])=>`<section class="question" data-question="${q.id}">${i&&items[i-1].heading===q.heading?'':`<h3>${esc(q.heading)}</h3>`}<p>${inline(q)}</p></section>`;
 const revision=()=>hint(s('revision'))+ruled();
 const add=(part,body)=>pages[part].push(body);
 add('A',`<div class="context"><h1>${esc(m.title)}</h1><div class="two-cols"><div><h3>${esc(m.context.heading)}</h3><div class="scene-pair"><div>${m.context.before}</div><div>${m.context.after}<p>${esc(m.context.afterLabel)}</p></div></div>${m.context.note}${hint(m.context.caption)}</div><div class="scene-copy"><h3>${esc(m.context.taskTitle)}</h3>${m.context.paragraphs.map(p=>`<p>${esc(p)}</p>`).join('')}${m.context.question}</div></div>${card(m.observation.label,hint(m.observation.hint)+ruled())}</div>`);
 add('A',card(m.hypothesis.heading,`<p>${inline(m.hypothesis)}</p>${hint(s('circle'))}<p>${esc(m.hypothesis.reason)}</p>${hint(m.hypothesis.hint)}${ruled()}`)+card(m.variables.heading,`<p>${esc(m.variables.instruction)}</p>${m.variables.groups.map(g=>`<h3>${esc(g.title)} <span class="hint">(${esc(g.definition)})</span></h3><div class="choices variable">${m.variables.choices.map(o=>`<span class="choice"><span class="checkbox"></span>${esc(o.text)}</span>`).join('')}</div>`).join('')}`));
 add('A',`<div class="merged-design">${card(m.assumptions.heading,hint(m.assumptions.reminder)+`<p>${esc(m.assumptions.instruction)}</p>`+options(m.assumptions.choices))}${card(m.control.heading,`<p>${esc(m.control.question)}</p>${m.control.hints.map(hint).join('')}${ruled()}`)}${card(m.design.heading,hint(m.design.reminder)+`<p>${esc(m.design.instruction)}</p>${m.design.materials}<div class="drawbox"></div><p>${esc(m.design.written)}</p>${hint(m.design.hint)}${ruled()}`)}${hint(s('original'))}</div>`);
 const setupLabels=m.experiment.setups.map(c=>`${c.label} · ${c.leafLabel}<br>${c.distance} cm · ${c.light} lux`);
 const frame=f=>`<section class="frame" data-time="${f.time}"><h3>${f.time} min</h3><div class="frame-row">${f.diagrams.map((d,i)=>`<div class="specimen" data-specimen="${d.id}"><div class="specimen-label">${setupLabels[i]}</div>${d.svg}</div>`).join('')}</div></section>`;
 const dataTable=()=>`<table class="data-table"><thead><tr><th>${esc(m.experiment.dataHeadings[0])}</th><th colspan="4">${esc(m.experiment.dataHeadings[1])}</th></tr><tr><th>min</th>${m.experiment.dataHeadings.slice(2).map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${m.experiment.frames.map(f=>`<tr><td>${f.time}</td>${m.experiment.ids.map(()=>'<td class="numeric"></td>').join('')}</tr>`).join('')}</tbody></table>`;
 add('B',`<div class="merged-basic"><h1>${esc(m.experiment.heading)}</h1><p>${esc(m.experiment.instruction)}</p><div class="condition-copy"><p>${esc(m.experiment.conditions)}</p><p>${esc(m.experiment.timing)}</p></div>${hint(s('static'))}${frame(m.experiment.frames[0])}<h3>${esc(m.experiment.dataHeading)}</h3>${dataTable()}${hint(m.experiment.dataHint)}${revision()}</div>`);
 add('B',`<div class="results"><h1>${esc(m.experiment.heading)}</h1>${hint(s('static'))}${m.experiment.frames.slice(1,3).map(frame).join('')}<div class="condition-copy">${m.experiment.ruler.map(p=>`<p>${esc(p)}</p>`).join('')}</div></div>`);
 const calculationTable=`<table><thead><tr><th>${lang==='zh'?'裝置':'Setup'}</th><th>${lang==='zh'?'平均上移速度（cm/min）':'Average upward speed (cm/min)'}</th></tr></thead><tbody>${m.experiment.setups.map(c=>`<tr><td>${esc(c.label)} · ${esc(c.leafLabel)} · ${c.distance} cm</td><td class="numeric"></td></tr>`).join('')}</tbody></table>`;
 add('B',`<div class="analysis-page">${frame(m.experiment.frames[3])}<h2>${esc(m.calculation.heading)}</h2>${hint(m.calculation.instruction)}${m.calculation.formula}${calculationTable}</div>`);
 add('B',`<div class="analysis-page"><h1>${esc(m.graph.heading)}</h1><div class="paper-graph"><p class="axis-caption">Y: ${esc(m.graph.labels.y)}</p>${m.graph.svg}<p class="axis-caption">X: ${esc(m.graph.labels.x)}</p></div>${hint(m.graph.legend)}<p>${esc(m.graph.instruction)}</p><h2>${esc(m.conclusions.heading)}</h2>${hint(s('circle'))}${m.conclusions.questions.map(question).join('')}${revision()}${hint(s('learning'))}</div>`);
 const processHTML=`<div class="processes">${m.learning.processes.map(group=>`<section><h3>${esc(group.title)}</h3><div class="process-list">${group.cards.map(c=>`<p><b>${esc(c.number)}</b> ${esc(c.text)}</p>`).join('')}</div></section>`).join('')}</div>`;
 add('C',`<div class="merged-learning">${hint(s('learning'))}<h1>${esc(m.learning.heading)}</h1><div class="anatomy">${m.learning.diagram}</div>${processHTML}${m.learning.points}<div class="evidence"><p>${esc(m.learning.limit)}</p>${m.learning.caption.map(hint).join('')}</div></div>`);
 add('C',`<h1>${esc(m.reflection.heading)}</h1>${hint(s('reflect'))}<p>${esc(m.reflection.question)}</p>${ruled()}`);
 add('D',`<div class="teacher-only">${esc(s('teacher'))}</div><h1>${esc(s('guide'))}</h1><ol class="guide-list">${m.labels.steps.map(text=>`<li>${esc(text)}</li>`).join('')}</ol>${hint(s('draft'))}${hint(s('paperMarking'))}${hint(s('pending'))}`);
 const refs=m.reference;
 const variableRows=m.variables.groups.map(g=>`<tr><td>${esc(g.title)}</td><td>${refs.variables[g.id].map(id=>esc(m.variables.choices.find(o=>o.id===id).text)).join(' / ')}</td></tr>`).join('');
 const answerRows=m.conclusions.questions.map(q=>`<tr><td>${esc(q.heading)}</td><td>${esc(q.options.find(o=>o.id===refs.answers[q.id]).text)}</td></tr>`).join('');
 add('D',`<div class="teacher-only">${esc(s('teacher'))}</div><h1>${esc(s('key'))}</h1><table class="reference"><tbody>${variableRows}<tr><td>${esc(m.assumptions.heading)}</td><td>${refs.assumptions.filter(o=>o.valid).map(o=>esc(o.text)).join('<br>')}</td></tr>${answerRows}</tbody></table><table><thead><tr><th>min</th>${m.experiment.ids.map(id=>`<th>${id} (cm)</th>`).join('')}</tr></thead><tbody>${m.experiment.frames.map((f,i)=>`<tr><td>${f.time}</td>${m.experiment.ids.map(id=>`<td>${refs.model[id][i].toFixed(1)}</td>`).join('')}</tr>`).join('')}<tr><td>cm/min</td>${m.experiment.ids.map(id=>`<td>${refs.rates[id]}</td>`).join('')}</tr></tbody></table>`);
 add('D',`<div class="teacher-only">${esc(s('teacher'))}</div><h1>${lang==='zh'?'開放題及實驗前提參考':'References for written answers and assumptions'}</h1>${Object.entries(refs.texts).map(([id,text])=>`<section class="question"><p>${esc(text)}</p></section>`).join('')}${refs.assumptions.map(o=>`<section class="question"><h3>${esc(o.text)}</h3><p>${esc(o.reference)}</p></section>`).join('')}`);
 const rubric=refs.rubric;
 for(let i=1;i<rubric.length;i+=4)add('D',`<div class="teacher-only">${esc(s('teacher'))}</div><h1>${esc(s('rubric'))}</h1>${hint(s('draft'))}<table class="rubric"><thead><tr>${rubric[0].map(c=>`<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${rubric.slice(i,i+4).map(row=>`<tr>${row.map(c=>`<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>${hint(s('paperMarking'))}`);
 return {pages};
}
function documentHTML(parts,g,m,base,revision){
 let n=0;const total=parts.reduce((n,part)=>n+g.pages[part].length,0);
 const body=parts.flatMap(part=>g.pages[part].map((body,i)=>`<article class="sheet" data-part="${part}" data-page="${i+1}"><header class="page-head"><strong>VL2 · ${part} · ${esc(m.labels.names[part])}</strong><span>${m.language==='zh'?'繁體中文':'English'}</span></header>${i===0&&['A','C'].includes(part)?`<div class="identity">${esc(m.labels.identity)}</div>`:''}<div class="sheet-body">${body}</div><footer class="page-footer"><span>VL2 · v${MATERIAL_VERSION} · ${revision}</span><span>${++n} / ${total} · ${part}-${i+1}</span></footer></article>`)).join('');
 return `<!doctype html><html lang="${m.language==='zh'?'zh-Hant-HK':'en-HK'}"><head><meta charset="utf-8"><base href="${base}/"><title>VL2 paper materials</title><link rel="stylesheet" href="paperwork/print.css"></head><body>${body}</body></html>`;
}
async function localServer(){
 const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+(req.url.split('?')[0]==='/'?'/index.html':decodeURIComponent(req.url.split('?')[0])));if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}try{res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.json':'application/json','.pdf':'application/pdf','.otf':'font/otf'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404);res.end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));return {base:'http://127.0.0.1:'+server.address().port,close:()=>new Promise(r=>server.close(r))};
}
async function main(){
 if(process.argv.includes('--check')){
  const manifest=JSON.parse(fs.readFileSync(path.join(out,'manifest.json')));
  if(JSON.stringify(manifest.inputs)!==JSON.stringify(fingerprints()))throw Error('Paper materials are stale: run node paperwork/build.cjs');
  const sources=JSON.parse(fs.readFileSync(path.join(out,'source.json')));
  if(sha(JSON.stringify(sources))!==manifest.snapshotDigest||sha(fs.readFileSync(path.join(out,'source-canonical.json'),'utf8').trim())!==manifest.sourceDigest)throw Error('Source snapshot changed');
  for(const lang of ['zh','en'])for(const file of Object.values(manifest.languages[lang].files))if(sha(fs.readFileSync(path.join(root,file.path)))!==file.sha256)throw Error('PDF checksum mismatch: '+file.path);
  console.log('PASS: shared content fingerprints, source digest and all ten PDF checksums');return;
 }
 fs.mkdirSync(out,{recursive:true});const server=await localServer();let browser;
 try{
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
  const page=await browser.newPage();await page.route('**/cloud-config.js*',r=>r.fulfill({contentType:'text/javascript',body:"window.VL2_CLOUD_CONFIG={endpoint:'',transport:'bridge'};"}));await page.route('https://**/*',r=>r.abort());
  await page.goto(server.base);await page.waitForFunction(()=>window.getVL2PaperSource&&window.VL2InquiryContent);
  const sources=await page.evaluate(()=>({zh:getVL2PaperSource('zh'),en:getVL2PaperSource('en')}));
  const supported=['observation','prediction','reason','controlPlan','setupDescription','claim','leafComparison','leafConclusion','limitations','reflection'];
  if(JSON.stringify(sources.zh.questionIds)!==JSON.stringify(supported))throw Error('Question fields changed: update paper layout and mapping');
  const canonical=await page.evaluate(sources=>VL2PaperDigestSource(sources),sources);
  const sourceDigest=sha(JSON.stringify(canonical)),snapshotDigest=sha(JSON.stringify(sources)),inputHashes=fingerprints(),revision=sha(JSON.stringify({canonical,inputHashes})).slice(0,10);
  const manifest={module:'VL2',version:sources.zh.version,materialVersion:MATERIAL_VERSION,revision,sourceDigest,snapshotDigest,inputs:inputHashes,reference:'VL1 v3 layout; VL2 current content',languages:{}};
  fs.writeFileSync(path.join(out,'source.json'),JSON.stringify(sources,null,2)+'\n');
  fs.writeFileSync(path.join(out,'source-canonical.json'),JSON.stringify(canonical)+'\n');
  for(const lang of ['zh','en']){
   const m=sources[lang],g=generate(m,lang),files={};
   for(const part of ['A','B','C','D','all']){
    const parts=part==='all'?['A','B','C','D']:[part],html=documentHTML(parts,g,m,server.base,revision);
    await page.setContent(html);await page.evaluate(()=>document.fonts.ready);
    await page.waitForFunction(()=>document.fonts.check('12px PaperNoto'));
    const overflow=await page.locator('.sheet-body').evaluateAll(els=>els.map((el,i)=>({page:i+1,height:el.scrollHeight,limit:el.clientHeight,width:el.scrollWidth,allowedWidth:el.clientWidth})).filter(p=>p.height>p.limit+2||p.width>p.allowedWidth+2));
    if(overflow.length)throw Error(`${lang}/${part} overflow: ${JSON.stringify(overflow)}`);
    const layout=await page.locator('.sheet').evaluateAll(sheets=>sheets.map(sheet=>({part:sheet.dataset.part,page:+sheet.dataset.page,identity:sheet.querySelectorAll('.identity').length,writingLines:[...sheet.querySelectorAll('.ruled')].map(el=>el.querySelectorAll('.writing-line').length),circles:sheet.querySelectorAll('.circle-options').length,liquidSurfaces:sheet.querySelectorAll('.liquid-surface').length,questions:[...sheet.querySelectorAll('[data-question]')].map(el=>el.dataset.question)})));
    if(layout.some(p=>p.identity!==(p.page===1&&['A','C'].includes(p.part)?1:0)||p.writingLines.some(n=>n!==2)))throw Error('Identity or two-line answer rule failed');
    const filename=`VL2_${part}_${lang}_v${MATERIAL_VERSION}_${revision}.pdf`,file=path.join(out,filename);
    await page.pdf({path:file,format:'A4',printBackground:true,preferCSSPageSize:true});
    const pages=parts.reduce((n,p)=>n+g.pages[p].length,0);
    files[part]={path:'paperwork/generated/'+filename,name:`VL2_${lang==='zh'?'紙本對照組':'ControlGroup'}_${part==='all'?(lang==='zh'?'完整教師列印套裝':'CompleteTeacherPack'):part}_${lang==='zh'?'繁中':'EN'}_v${MATERIAL_VERSION}_${revision}.pdf`,pages,bytes:fs.statSync(file).size,sha256:sha(fs.readFileSync(file)),layout};
    console.log(`Built ${lang}/${part}: ${pages} A4 pages`);
   }
   let first=1;manifest.languages[lang]={files,ranges:Object.fromEntries(['A','B','C','D'].map(part=>{const range=[first,first+files[part].pages-1];first+=files[part].pages;return [part,range];}))};
  }
  fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  const current=new Set(Object.values(manifest.languages).flatMap(entry=>Object.values(entry.files).map(f=>path.basename(f.path))));
  fs.readdirSync(out).filter(name=>/^VL2_(A|B|C|D|all)_(zh|en)_v\d+_[a-f0-9]+\.pdf$/.test(name)&&!current.has(name)).forEach(name=>fs.unlinkSync(path.join(out,name)));
 }finally{if(browser)await browser.close();await server.close();}
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1});
module.exports={localServer,generate,documentHTML};
