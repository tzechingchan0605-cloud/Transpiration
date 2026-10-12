'use strict';
// The only network requests are static material files. No save/log/cloud calls.
(() => {
 let manifest=null,generation=0,previewURL=null;
 const byId=id=>document.getElementById(id),authorised=()=>isTeacher();
 const digest=async bytes=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');
 const status=text=>{byId('paperStatus').textContent=text;window.VL2I18n.apply(byId('paperStatus'));};
 function clearPreview(){byId('paperPreview').removeAttribute('src');byId('paperPreview').hidden=true;if(previewURL)URL.revokeObjectURL(previewURL);previewURL=null;}
 function close(){generation++;manifest=null;byId('paperPanel').hidden=true;clearPreview();}
 function render(){
  if(!manifest||!authorised())return;
  const entry=manifest.languages[byId('paperLanguage').value];
  byId('paperContentVersion').textContent=manifest.version;byId('paperMaterialVersion').textContent=`v${manifest.materialVersion} · ${manifest.revision}`;
  for(const part of ['A','B','C','D','all']){
   const file=entry.files[part],range=entry.ranges[part];byId('paperPages'+part).textContent=range?`${file.pages} 頁 · 套裝第 ${range[0]}–${range[1]} 頁`:`${file.pages} 頁`;
  }
  byId('paperPanel').querySelectorAll('[data-paper-download],[data-paper-preview]').forEach(button=>button.disabled=false);
  window.VL2I18n.apply(byId('paperPanel'));
 }
 async function open(){
  if(!authorised())return false;
  clearPreview();manifest=null;const token=++generation;
  byId('paperPanel').hidden=false;byId('paperLanguage').value=window.VL2I18n.language;
  byId('paperPanel').querySelectorAll('[data-paper-download],[data-paper-preview]').forEach(button=>button.disabled=true);
  status('正在準備紙本材料……');
  try{
   const response=await fetch('paperwork/generated/manifest.json',{cache:'no-store'});if(!response.ok)throw Error('manifest');
   const data=await response.json(),source={zh:getVL2PaperSource('zh'),en:getVL2PaperSource('en')};
   if(data.module!=='VL2'||data.version!==source.zh.version||await digest(new TextEncoder().encode(JSON.stringify(VL2PaperDigestSource(source))))!==data.sourceDigest)throw Error('stale');
   for(const lang of ['zh','en'])for(const part of ['A','B','C','D','all']){
    const file=data.languages?.[lang]?.files?.[part];
    if(!file||!new RegExp(`^paperwork/generated/VL2_${part}_${lang}_v\\d+_[a-f0-9]{10}\\.pdf$`).test(file.path)||!file.name.endsWith('.pdf')||!Number.isInteger(file.pages)||file.pages<1||!Number.isInteger(file.bytes)||!/^[a-f0-9]{64}$/.test(file.sha256))throw Error('invalid');
   }
   if(token!==generation||!authorised())return false;
   manifest=data;render();status('材料已準備好；請按分冊次序列印及派發。');return true;
  }catch{if(token===generation&&authorised())status('紙本材料未能載入或版本不一致，請重新載入網站；若仍未成功，請重新產生材料。');return false;}
 }
 async function fileBlob(part){
  if(!authorised()||!manifest||!['A','B','C','D','all'].includes(part))return null;
  const token=generation,lang=byId('paperLanguage').value,file=manifest.languages[lang].files[part];
  const response=await fetch(file.path,{cache:'no-cache'});if(!response.ok)throw Error('file');
  const bytes=await response.arrayBuffer();
  if(new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-'||bytes.byteLength!==file.bytes||await digest(bytes)!==file.sha256)throw Error('checksum');
  if(!authorised()||token!==generation||lang!==byId('paperLanguage').value)return null;
  return {blob:new Blob([bytes],{type:'application/pdf'}),name:file.name};
 }
 async function downloadPart(part){
  try{const file=await fileBlob(part);if(!file)return false;download(file.blob,file.name);status('PDF 已下載。');return true;}
  catch{if(authorised())status('PDF 下載失敗，請重試；現有學生紀錄不受影響。');return false;}
 }
 async function previewPart(part){
  try{const file=await fileBlob(part);if(!file)return false;clearPreview();previewURL=URL.createObjectURL(file.blob);byId('paperPreview').src=previewURL;byId('paperPreview').hidden=false;status('預覽已開啟；手機如未能顯示，可直接下載 PDF。');return true;}
  catch{if(authorised())status('PDF 下載失敗，請重試；現有學生紀錄不受影響。');return false;}
 }
 byId('openPaperwork').addEventListener('click',open);byId('closePaperwork').addEventListener('click',close);
 byId('paperLanguage').addEventListener('change',()=>{if(!authorised())return;generation++;clearPreview();render();});
 document.querySelectorAll('[data-paper-download]').forEach(button=>button.addEventListener('click',()=>downloadPart(button.dataset.paperDownload)));
 document.querySelectorAll('[data-paper-preview]').forEach(button=>button.addEventListener('click',()=>previewPart(button.dataset.paperPreview)));
 window.VL2Paperwork={open,close,download:downloadPart,preview:previewPart};
})();
