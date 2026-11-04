#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path'),http=require('http'),crypto=require('crypto'),{execFileSync}=require('child_process');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=path.join(__dirname,'generated');
const inputs=['index.html','app.js','i18n-static.js','i18n-dynamic.js','i18n-paper.js','i18n.js','paperwork/source.js','paperwork/client.js','paperwork/build.cjs','paperwork/worksheet.py','paperwork/native.py','paperwork/reflection.json','paperwork/requirements.txt'];
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const fingerprints=()=>Object.fromEntries(inputs.map(n=>[n,sha(fs.readFileSync(path.join(root,n)))]));
async function localServer(){const server=http.createServer((req,res)=>{let file=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]==='/'?'/index.html':req.url.split('?')[0]));if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}try{res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.pdf':'application/pdf','.docx':'application/vnd.openxmlformats-officedocument.wordprocessingml.document'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));return {base:'http://127.0.0.1:'+server.address().port,close:()=>new Promise(r=>server.close(r))};}
async function main(){
 if(process.argv.includes('--check')){const m=JSON.parse(fs.readFileSync(path.join(out,'manifest.json')));if(JSON.stringify(m.inputs)!==JSON.stringify(fingerprints()))throw Error('stale inputs');if(sha(fs.readFileSync(path.join(out,'source-canonical.json')))!==m.sourceDigest)throw Error('snapshot');for(const l of ['zh','en']){if(Object.keys(m.languages[l].files).length!==5)throw Error('five files required');for(const f of Object.values(m.languages[l].files)){const b=fs.readFileSync(path.join(root,f.path));if(sha(b)!==f.sha256||b.length!==f.bytes)throw Error('checksum '+f.path);}}console.log('PASS: version, ten files and SHA-256');return;}
 fs.mkdirSync(out,{recursive:true});const server=await localServer();let browser;
 try{browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});const p=await browser.newPage();await p.route('**/cloud-config.js*',r=>r.fulfill({contentType:'text/javascript',body:"window.VL2_CLOUD_CONFIG={endpoint:'',transport:'bridge'};"}));await p.route('https://**/*',r=>r.abort());await p.goto(server.base);await p.waitForFunction(()=>window.getVL2PaperSource);const sources=await p.evaluate(()=>({zh:getVL2PaperSource('zh'),en:getVL2PaperSource('en')}));fs.writeFileSync(path.join(out,'source.json'),JSON.stringify(sources,null,2));fs.writeFileSync(path.join(out,'source-canonical.json'),JSON.stringify(sources));}finally{if(browser)await browser.close();await server.close();}
 execFileSync('python',['paperwork/worksheet.py'],{cwd:root,stdio:'inherit'});
 const work=path.join(root,'work/rendered');fs.mkdirSync(work,{recursive:true});
 const names=['WS2_student_zh','WS2_answers_zh','WS2_student_en','WS2_answers_en','D_zh','D_en'];
 for(const n of names){const old=path.join(work,n+'.pdf');if(fs.existsSync(old))fs.unlinkSync(old);}
 execFileSync(process.env.SOFFICE_PATH||'soffice',['-env:UserInstallation=file://'+path.join(root,'work/lo'),'--headless','--convert-to','pdf','--outdir',work,...names.map(n=>path.join(out,n+'.docx'))],{cwd:root,stdio:'inherit'});
 const inputHashes=fingerprints(),sourceDigest=sha(fs.readFileSync(path.join(out,'source-canonical.json'))),revision=sha(JSON.stringify({inputHashes,sourceDigest})).slice(0,10);
 const m={module:'VL2',version:'VL2-WS2-v5',materialVersion:5,questionVersion:'VL2-Q4',rubricVersion:'VL2-R4',revision,sourceDigest,inputs:inputHashes,languages:{}};
 for(const lang of ['zh','en']){const files={};for(const [key,name,ext] of [['studentPDF','WS2_student','pdf'],['studentWord','WS2_student','docx'],['answersPDF','WS2_answers','pdf'],['answersWord','WS2_answers','docx'],['D','D','pdf']]){const src=path.join(ext==='pdf'?work:out,`${name}_${lang}.${ext}`),filename=`VL2_${key}_${lang}_v5_${revision}.${ext}`,target=path.join(out,filename);fs.copyFileSync(src,target);const bytes=fs.readFileSync(target);files[key]={path:'paperwork/generated/'+filename,name:`${name}_${lang}_v5.${ext}`,bytes:bytes.length,sha256:sha(bytes),mime:ext==='pdf'?'application/pdf':'application/vnd.openxmlformats-officedocument.wordprocessingml.document'};}m.languages[lang]={files};}
 fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(m,null,2)+'\n');
 const keep=new Set(['manifest.json','source.json','source-canonical.json',...Object.values(m.languages).flatMap(l=>Object.values(l.files).map(f=>path.basename(f.path)))]);for(const n of fs.readdirSync(out))if(!keep.has(n))fs.unlinkSync(path.join(out,n));
 console.log('Built five material types in each language, revision '+revision);
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});module.exports={localServer};
