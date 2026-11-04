'use strict';
// Read canonical UI curriculum only. Never read student records or input values.
(() => {
 window.getVL2PaperSource=(lang='zh')=>{
  if(!['zh','en'].includes(lang))throw Error('language');
  const core=VL2InquiryContent(),t=v=>VL2I18n.translate(v,lang);
  const clone=selector=>{const e=document.createElement('div');e.innerHTML=VL2I18n.sourceHTML(document.querySelector(selector));return e.firstElementChild;};
  const question=id=>{const e=document.createElement('div');e.innerHTML=VL2I18n.sourceHTML(document.querySelector('#'+id).closest('label'));e.querySelectorAll('textarea,span').forEach(n=>n.remove());return t(e.textContent.trim());};
  const options=id=>[...clone('#'+id).options].filter(o=>o.value).map(o=>({id:o.value,text:t(o.textContent)}));
  const sentence=id=>{const e=document.createElement('div');e.innerHTML=VL2I18n.sourceHTML(document.querySelector('#'+id).closest('label'));const walker=document.createTreeWalker(e,NodeFilter.SHOW_TEXT);for(let node;node=walker.nextNode();)node.nodeValue=t(node.nodeValue);e.querySelector('select').replaceWith('__________');return e.textContent.trim();};
  return {moduleId:core.moduleId,version:'VL2-WS2-v3',sharedVersion:core.version,language:lang,
   variables:{groups:core.variableGroups.map(([id,title,definition])=>({id,title:t(title),definition:t(definition)})),choices:core.variableNames.map(id=>({id,text:t(id)}))},
   assumptions:{reminder:t(clone('#assumptionReminder').textContent),choices:core.assumptions.map(o=>({id:o.id,text:t(o.text)}))},
   control:{question:question('controlPlan'),hints:[...document.querySelector('#controlPlan').closest('article').querySelectorAll('.question-hint')].map(e=>t(VL2I18n.sourceHTML(e).replace(/<[^>]*>/g,'')))},
   experiment:{model:core.model,setups:core.ids.map(id=>({...core.conditions[id],id}))},
   conclusions:{questions:['claim','leafComparison','leafConclusion','limitations'].map(id=>({id,heading:(()=>{const e=document.createElement('div');e.innerHTML=VL2I18n.sourceHTML(document.querySelector('#'+id).closest('.conclusion-question').querySelector('h4'));return t(e.textContent);})(),sentence:sentence(id),options:options(id)}))},
   reflection:{question:question('reflection')},
   reference:{texts:Object.fromEntries(Object.entries(core.references).map(([k,v])=>[k,t(v)])),variables:{iv:[core.variableNames[0]],dv:[core.variableNames[1]],cv:core.variableNames.slice(2)},assumptions:core.assumptions.map(o=>({...o,text:t(o.text)})),rates:Object.fromEntries(core.ids.map(id=>[id,((core.model[id][3]-core.model[id][0])/30).toFixed(2)])),rubric:core.rubric}
  };
 };
 window.VL2PaperDigestSource=value=>value;
})();
