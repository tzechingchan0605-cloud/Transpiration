'use strict';
// Static material requests only. No logging, persistence or cloud writes.
(() => {
 const keys=['studentPDF','studentWord','answersPDF','answersWord','D'],pdfs=['studentPDF','answersPDF','D'];
 let manifest=null,generation=0,previewURL=null;
 const byId=id=>document.getElementById(id),authorised=()=>isTeacher();
 const digest=async bytes=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');
 const status=text=>{byId('paperStatus').textContent=text;VL2I18n.apply(byId('paperStatus'));};
 function clearPreview(){byId('paperPreview').removeAttribute('src');byId('paperPreview').hidden=true;if(previewURL)URL.revokeObjectURL(previewURL);previewURL=null;}
 function close(){generation++;manifest=null;byId('paperPanel').hidden=true;clearPreview();}
 function languageChanged(){generation++;clearPreview();if(!byId('paperPanel').hidden&&!manifest)void open();}
 function render(){if(!manifest||!authorised())return;byId('paperContentVersion').textContent=manifest.version;byId('paperMaterialVersion').textContent=`v5 · ${manifest.revision}`;byId('paperPanel').querySelectorAll('[data-paper-download],[data-paper-preview]').forEach(b=>b.disabled=false);VL2I18n.apply(byId('paperPanel'));}
 async function open(){
  if(!authorised())return false;clearPreview();manifest=null;const token=++generation;byId('paperPanel').hidden=false;byId('paperPanel').querySelectorAll('[data-paper-download],[data-paper-preview]').forEach(b=>b.disabled=true);status('正在準備紙本材料……');
  try{
   const r=await fetch('paperwork/generated/manifest.json',{cache:'no-store'});if(!r.ok)throw Error('manifest');const data=await r.json();
   if(data.module!=='VL2'||data.version!=='VL2-WS2-v5'||data.materialVersion!==5||await digest(new TextEncoder().encode(JSON.stringify({zh:getVL2PaperSource('zh'),en:getVL2PaperSource('en')})))!==data.sourceDigest)throw Error('stale');
   for(const lang of ['zh','en'])for(const key of keys){const f=data.languages?.[lang]?.files?.[key],ext=pdfs.includes(key)?'pdf':'docx';if(!f||!new RegExp(`^paperwork/generated/VL2_${key}_${lang}_v5_[a-f0-9]{10}\\.${ext}$`).test(f.path)||!f.name.endsWith('.'+ext)||!Number.isInteger(f.bytes)||f.bytes<100||!/^[a-f0-9]{64}$/.test(f.sha256))throw Error('invalid');}
   if(token!==generation||!authorised())return false;manifest=data;render();status('教材已準備好。');return true;
  }catch{if(token===generation&&authorised())status('紙本材料未能載入或版本不一致，請重新載入網站；若仍未成功，請重新產生材料。');return false;}
 }
 async function fileBlob(key){
  if(!authorised()||!manifest||!keys.includes(key))return null;
  const token=generation,lang=VL2I18n.language,f=manifest.languages[lang].files[key];const r=await fetch(f.path,{cache:'no-cache'});if(!r.ok)throw Error('file');const bytes=await r.arrayBuffer(),a=new Uint8Array(bytes);
  if((pdfs.includes(key)?new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-':a[0]!==80||a[1]!==75)||bytes.byteLength!==f.bytes||await digest(bytes)!==f.sha256)throw Error('checksum');
  if(!authorised()||token!==generation||lang!==VL2I18n.language)return null;
  return {blob:new Blob([bytes],{type:f.mime}),name:f.name};
 }
 async function downloadPart(key){try{const f=await fileBlob(key);if(!f)return false;download(f.blob,f.name);status('教材已下載。');return true;}catch{if(authorised())status('教材下載失敗，請重試。');return false;}}
 async function previewPart(key){if(!pdfs.includes(key))return false;const token=++generation;clearPreview();try{const f=await fileBlob(key);if(!f||token!==generation)return false;previewURL=URL.createObjectURL(f.blob);byId('paperPreview').src=previewURL;byId('paperPreview').hidden=false;status('預覽已開啟；手機如未能顯示，可直接下載 PDF。');return true;}catch{if(token===generation&&authorised())status('教材下載失敗，請重試。');return false;}}
 byId('openPaperwork').addEventListener('click',open);byId('closePaperwork').addEventListener('click',close);
 document.addEventListener('vl2-language-change',languageChanged);
 document.querySelectorAll('[data-paper-download]').forEach(b=>b.addEventListener('click',()=>downloadPart(b.dataset.paperDownload)));
 document.querySelectorAll('[data-paper-preview]').forEach(b=>b.addEventListener('click',()=>previewPart(b.dataset.paperPreview)));
 window.VL2Paperwork={open,close,download:downloadPart,preview:previewPart};
})();
