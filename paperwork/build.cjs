#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path'),http=require('http'),crypto=require('crypto');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=path.join(__dirname,'generated'),MATERIAL_VERSION=2;
const inputs=['index.html','app.js','styles.css','i18n-static.js','i18n-dynamic.js','i18n-paper.js','i18n.js','i18n-svg.js','paperwork/source.js','paperwork/texts.js','paperwork/curriculum.js','paperwork/render.cjs','paperwork/print.css','paperwork/client.js','paperwork/build.cjs','paperwork/fonts/NotoSansHK-paper.otf'].sort();
const sha=data=>crypto.createHash('sha256').update(data).digest('hex');
const fingerprints=()=>Object.fromEntries(inputs.map(name=>[name,sha(fs.readFileSync(path.join(root,name)))]));
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const {generate,originalPrompts,paperTask}=require('./render.cjs');
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
  const manifest={module:'VL2',version:sources.zh.version,materialVersion:MATERIAL_VERSION,revision,sourceDigest,snapshotDigest,inputs:inputHashes,reference:'Self-study comparison: concepts → worked examples → practice → application → checking; 15–20 minutes',timeMinutes:{range:[15,20],target:18,concepts:4,supported:3,independent:8,checking:3},languages:{}};
  fs.writeFileSync(path.join(out,'source.json'),JSON.stringify(sources,null,2)+'\n');
  fs.writeFileSync(path.join(out,'source-canonical.json'),JSON.stringify(canonical)+'\n');
  for(const lang of ['zh','en']){
   const m=sources[lang],originals=originalPrompts(m),cell=value=>String(value).replace(/\|/g,'\\|').replace(/\n/g,' ');
   const rows=m.alignment.map(row=>[originals[row.original],row.treatment,row.page+': '+paperTask(m,row),row.goal,row.reason]);
   fs.writeFileSync(path.join(__dirname,`ALIGNMENT.${lang}.md`),`# ${m.paper.alignment}\n\n${m.labels.teacher}\n\n${m.labels.paperMarking}\n\n| ${m.paper.mappingHeads.map(cell).join(' | ')} |\n| ${m.paper.mappingHeads.map(()=>'---').join(' | ')} |\n${rows.map(row=>'| '+row.map(cell).join(' | ')+' |').join('\n')}\n`);
  }
  for(const lang of ['zh','en']){
   const m=sources[lang],g=generate(m,lang),files={};
   for(const part of ['A','B','C','D','all']){
    const parts=part==='all'?['A','B','C','D']:[part],html=documentHTML(parts,g,m,server.base,revision);
    await page.setContent(html);await page.evaluate(()=>document.fonts.ready);
    await page.waitForFunction(()=>document.fonts.check('12px PaperNoto'));
    const overflow=await page.locator('.sheet-body').evaluateAll(els=>els.map((el,i)=>({page:i+1,height:el.scrollHeight,limit:el.clientHeight,width:el.scrollWidth,allowedWidth:el.clientWidth})).filter(p=>p.height>p.limit+2||p.width>p.allowedWidth+2));
    if(overflow.length)throw Error(`${lang}/${part} overflow: ${JSON.stringify(overflow)}`);
    const layout=await page.locator('.sheet').evaluateAll(sheets=>sheets.map(sheet=>({part:sheet.dataset.part,page:+sheet.dataset.page,identity:sheet.querySelectorAll('.identity').length,writingLines:[...sheet.querySelectorAll('.ruled')].map(el=>el.querySelectorAll('.writing-line').length),circles:sheet.querySelectorAll('.circle-options').length,liquidSurfaces:sheet.querySelectorAll('.liquid-surface').length,blankReadings:sheet.querySelectorAll('.data-table tbody td:not(:first-child):empty').length,text:sheet.querySelector('.sheet-body').innerText,questions:[...sheet.querySelectorAll('[data-question]')].map(el=>el.dataset.question)})));
    if(layout.some(p=>p.identity!==(p.page===1&&['A','C'].includes(p.part)?1:0)||p.writingLines.some(n=>n!==2)))throw Error('Identity or two-line answer rule failed');
    const filename=`VL2_${part}_${lang}_v${MATERIAL_VERSION}_${revision}.pdf`,file=path.join(out,filename);
    await page.pdf({path:file,format:'A4',printBackground:true,preferCSSPageSize:true});
    const pages=parts.reduce((n,p)=>n+g.pages[p].length,0);
    files[part]={path:'paperwork/generated/'+filename,name:`VL2_${lang==='zh'?'西芹水分運輸':'CeleryWaterTransport'}_${part==='all'?(lang==='zh'?'完整教師列印套裝':'CompleteTeacherPack'):part}_${lang==='zh'?'繁中':'EN'}_v${MATERIAL_VERSION}_${revision}.pdf`,pages,bytes:fs.statSync(file).size,sha256:sha(fs.readFileSync(file)),layout};
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
