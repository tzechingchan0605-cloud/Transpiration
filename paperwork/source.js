'use strict';
// Read only canonical question DOM and the same curriculum used by VL2.
// Never inspect a user's input value, profile, state, storage or cloud records.
(() => {
  const q=selector=>document.querySelector(selector);
  const clone=element=>{
    if(!element)throw new Error('Missing shared content');
    const template=document.createElement('template');
    template.innerHTML=window.VL2I18n.sourceHTML(element);
    return template.content.firstElementChild;
  };
  function fragment(element,lang){
    const root=typeof element==='string'?(()=>{const t=document.createElement('template');t.innerHTML=element;return t.content.firstElementChild;})():clone(element);
    const t=text=>window.VL2I18n.translate(text,lang,root.matches('.learning-points')?'learning':null);
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    for(let node;node=walker.nextNode();)if(!node.parentElement.closest('[data-i18n-svg]'))node.nodeValue=t(node.nodeValue);
    [root,...root.querySelectorAll('*')].forEach(el=>{
      for(const attr of ['alt','aria-label','title'])if(el.hasAttribute(attr))el.setAttribute(attr,t(el.getAttribute(attr)));
      if(el.namespaceURI!=='http://www.w3.org/2000/svg')el.removeAttribute('id');
    });
    window.VL2I18nSVG.apply(root,lang,text=>t(text));
    return root;
  }
  window.getVL2PaperSource=(lang='zh')=>{
    if(!['zh','en'].includes(lang))throw new Error('Unsupported language');
    const core=window.VL2InquiryContent(),t=value=>window.VL2I18n.translate(value,lang);
    if(core.times.length!==4||core.ids.length!==4)throw new Error('Measurement layout changed: update paper mapping');
    const tx=selector=>t(clone(q(selector)).textContent.trim());
    const html=selector=>fragment(q(selector),lang).outerHTML;
    const label=id=>{
      const root=clone(q('#'+id).closest('label'));
      root.querySelectorAll('textarea,input,select').forEach(el=>el.remove());
      return t(root.textContent.trim());
    };
    const article=id=>clone(q('#'+id).closest('article'));
    const options=id=>[...clone(q('#'+id)).options].filter(o=>o.value).map(o=>({id:o.value,text:t(o.textContent)}));
    const sentence=id=>{
      const root=fragment(q('#'+id).closest('label'),lang);
      root.querySelectorAll('select').forEach(el=>el.replaceWith('__________'));
      return root.textContent.trim();
    };
    const design=article('setupCanvas'),control=article('controlPlan'),assumptions=article('assumptionChoices');
    const specimen=(id,height,leaves,ruler=false)=>{
      const root=fragment(core.specimen(id,height,leaves,ruler),lang);
      // Presentation only: strengthen the existing surface and dye for B/W print.
      root.querySelectorAll('.dye-column').forEach(el=>el.setAttribute('fill','#222'));
      const surface=[...root.querySelectorAll('ellipse')].find(el=>el.getAttribute('cy')==='330');
      if(surface){surface.classList.add('liquid-surface');surface.setAttribute('stroke','#333');surface.setAttribute('stroke-width','2');}
      root.querySelectorAll('.ruler text').forEach(el=>{el.setAttribute('font-size','15');el.setAttribute('fill','#111');});
      root.querySelectorAll('.ruler path').forEach(el=>el.setAttribute('stroke','#333'));
      return root.outerHTML;
    };
    const graph=fragment(core.blankGraph(),lang);
    const yLabel=graph.querySelector('text[transform*="rotate"]');
    const xLabel=[...graph.querySelectorAll('text')].find(el=>el.getAttribute('font-size')==='14');
    const graphLabels={x:xLabel.textContent,y:yLabel.textContent};
    xLabel.remove();yLabel.remove();graph.querySelector('.graph-inline-legend')?.remove();graph.setAttribute('viewBox','45 0 710 407');graph.querySelectorAll('text').forEach(el=>el.setAttribute('font-size','15'));
    const anatomy=fragment(core.anatomy(),lang);
    const science=anatomy.querySelector('svg');
    const processes=[...science.querySelectorAll('.process-heading')].map(heading=>({
      title:heading.textContent.trim(),cards:[...science.querySelectorAll(`.process-card[data-process-group="${heading.dataset.processGroup}"]`)].map(card=>({number:card.querySelector('.process-marker').textContent.trim(),text:card.querySelector('text[data-i18n-svg]').textContent.trim()}))
    }));
    science.querySelectorAll('.process-heading,.process-card').forEach(el=>el.remove());
    const caption=[...science.querySelectorAll('text[data-i18n-svg]')].filter(el=>+el.getAttribute('data-i18n-y')<80||+el.getAttribute('data-i18n-y')>760).map(el=>el.textContent.trim());
    science.querySelectorAll('text[data-i18n-svg]').forEach(el=>{
      const y=+el.getAttribute('data-i18n-y');if(y<80||y>760)el.remove();
      // Give long bilingual cell names two lines, above their original baseline.
      if(lang==='en'&&+el.getAttribute('data-i18n-x')>=830&&+el.getAttribute('data-i18n-font')>=17){
        const text=t(JSON.parse(el.dataset.i18nLines).join('')),parts=text.match(/^(.*?)\s+(\([^()]+\))$/);
        if(parts&&[...text].reduce((sum,c)=>sum+(/[\u3400-\u9fff]/.test(c)?15:7),0)>217){el.setAttribute('font-size','15');el.innerHTML=parts.slice(1).map((line,i)=>`<tspan x="${el.dataset.i18nX}" dy="${i?20:-20}">${esc(line)}</tspan>`).join('');}
      }
    });
    if(lang==='en'){
      const labelAt=(x,y)=>[...science.querySelectorAll('text[data-i18n-svg]')].find(el=>el.dataset.i18nX===String(x)&&el.dataset.i18nY===String(y));
      labelAt(35,211).setAttribute('y','198');
      [...science.querySelectorAll('.anatomy-leader')].find(el=>el.getAttribute('d')==='M121 194L124 139').setAttribute('d','M121 178L124 139');
      labelAt(837,130).setAttribute('y','115');labelAt(837,150).setAttribute('y','135');
      labelAt(837,372).setAttribute('y','384');labelAt(837,412).setAttribute('y','428');labelAt(837,461).setAttribute('y','472');
      const loose=labelAt(837,338),looseParts=t(JSON.parse(loose.dataset.i18nLines).join('')).match(/^(Loosely packed cells)\s+(.*)$/i);
      if(looseParts){loose.setAttribute('font-size','14');loose.innerHTML=looseParts.slice(1).map((line,i)=>`<tspan x="837" dy="${i?20:-1}">${esc(line)}</tspan>`).join('');}
      const guard=labelAt(837,536),guardText=t(JSON.parse(guard.dataset.i18nLines).join('')),guardParts=guardText.match(/^(.*?)\s+(\([^()]+\));\s*(.*)$/);
      if(guardParts){guard.setAttribute('font-size','16');guard.innerHTML=guardParts.slice(1).map((line,i)=>`<tspan x="837" dy="${i?21:0}">${esc(line)}${i===1?';':''}</tspan>`).join('');}
      labelAt(742,575).setAttribute('y','610');
      [...science.querySelectorAll('.anatomy-leader')].find(el=>el.getAttribute('d')==='M734 570H715V530L687 515L642 496').setAttribute('d','M734 606H715V530L687 515L642 496');
      const xylemTitle=[...science.querySelectorAll('text[data-i18n-svg]')].find(el=>el.dataset.i18nX==='26'&&el.dataset.i18nY==='250');
      const parts=t(JSON.parse(xylemTitle.dataset.i18nLines).join('')).match(/^(.*?)\s+(\(xylem vessels.*)$/i);
      if(parts){xylemTitle.setAttribute('font-size','14');xylemTitle.setAttribute('y','258');xylemTitle.innerHTML=parts.slice(1).map((line,i)=>`<tspan x="26" dy="${i?20:-20}">${esc(line)}</tspan>`).join('');}
      science.querySelector('.anatomy-leader[data-label="xylem"]').setAttribute('d','M240 275H285V312H349L379 321');
    }
    science.setAttribute('viewBox','0 80 1080 535');
    const actualFields=[...q('main').querySelectorAll('textarea[id],select[id],input[id]')].filter(el=>!['hidden','file','checkbox'].includes(el.type)).map(el=>el.id).filter(id=>id!=='plotDevice'&&!/^(rate-[A-D]|point-[xy]-[A-D])$/.test(id));
    if(JSON.stringify(actualFields.slice().sort())!==JSON.stringify(core.fields.slice().sort()))throw new Error('Question fields changed: update paper mapping');
    return {
      moduleId:core.moduleId,version:core.version,language:lang,questionIds:core.fields,
      labels:(()=>{const localise=value=>Array.isArray(value)?t(value[lang==='zh'?0:1]):Object.fromEntries(Object.entries(value).map(([key,item])=>[key,typeof item==='string'?t(item):localise(item)]));const labels={...window.VL2PaperLabels};delete labels.names;delete labels.steps;return {...localise(labels),names:Object.fromEntries(Object.entries(window.VL2PaperLabels.names[lang]).map(([key,value])=>[key,t(value)])),steps:window.VL2PaperLabels.steps.map(pair=>t(pair[lang==='zh'?0:1]))};})(),
      title:t('西芹的紅色水跡'),
      context:{heading:tx('.scene-note'),before:specimen('paper-before',0,true),after:specimen('paper-after',7,true),afterLabel:tx('.scene-arrow small'),note:html('.anatomy-note'),caption:tx('.scene-card .caption'),
        taskHeading:tx('.prompt-card .card-kicker'),taskTitle:tx('.prompt-card h3'),paragraphs:[...clone(q('.prompt-card')).children].filter(el=>el.tagName==='P'&&!el.classList.contains('card-kicker')).map(el=>t(el.textContent)),question:html('.question-box')},
      observation:{label:label('observation'),hint:t(clone(q('#observation')).getAttribute('placeholder'))},
      hypothesis:{heading:t(article('prediction').querySelector('h3').textContent),sentence:sentence('prediction'),options:options('prediction'),reason:label('reason'),hint:t(clone(q('#reason')).getAttribute('placeholder'))},
      variables:{heading:t(clone(q('#variableQuiz').closest('article')).querySelector('h3').textContent),instruction:t(clone(q('#variableQuiz').closest('article')).querySelector('p.muted').textContent),groups:core.variableGroups.map(([id,title,definition])=>({id,title:t(title),definition:t(definition)})),choices:core.variableNames.map(id=>({id,text:t(id)}))},
      assumptions:{heading:t(assumptions.querySelector('h3').textContent),reminder:tx('#assumptionReminder'),instruction:t(assumptions.querySelector('p.muted').textContent),choices:core.assumptions.map(o=>({id:o.id,text:t(o.text)}))},
      control:{heading:t(control.querySelector('h3').textContent),question:(()=>{const root=control.querySelector('label');root.querySelectorAll('span,textarea').forEach(el=>el.remove());return t(root.textContent.trim());})(),hints:[...article('controlPlan').querySelectorAll('.question-hint')].map(el=>t(el.textContent))},
      design:{heading:t(design.querySelector('h3').textContent),reminder:tx('#drawingReminder'),instruction:t(design.querySelector('p.muted').textContent),materials:html('#equipmentBank'),written:label('setupDescription'),hint:t(clone(q('#setupDescription')).getAttribute('placeholder'))},
      experiment:{heading:tx('#phase-3 .phase-heading h2'),instruction:tx('#phase-3 .phase-heading p'),conditions:fragment(q('.fair-note'),lang).textContent.trim(),timing:fragment(q('.experiment-timing-note'),lang).textContent.trim(),ruler:[...clone(q('.ruler-guide')).querySelectorAll('p')].map(el=>t(el.textContent)),ids:core.ids,
        setups:core.ids.map(id=>({...core.conditions[id],id,label:t('裝置'+id),leafLabel:t(core.conditions[id].leaves?'帶葉':'不帶葉')})),
        frames:core.times.map(time=>({time,diagrams:core.ids.map(id=>({id,svg:specimen('paper-'+time+'-'+id,core.model[id][core.times.indexOf(time)],core.conditions[id].leaves,true)}))})),
        dataHeading:tx('.data-card h3'),dataHint:tx('.data-card p.muted'),dataHeadings:[...clone(q('.data-card thead')).querySelectorAll('th')].map(el=>{const root=fragment(el,lang);root.querySelectorAll('br').forEach(el=>el.replaceWith('\n'));return root.textContent.trim();}),model:core.model},
      calculation:{heading:tx('#phase-4 > article:first-of-type h3'),instruction:tx('#phase-4 > article:first-of-type p.muted'),formula:html('.formula')},
      graph:{heading:tx('.graph-card h3'),instruction:tx('.plot-controls > p'),svg:graph.outerHTML,labels:graphLabels,legend:[...fragment(q('.graph-legend'),lang).querySelectorAll('span')].map(el=>el.textContent.trim()).join(' | ')},
      conclusions:{heading:t(clone(q('#submitInvestigation').closest('article')).querySelector('h3').textContent),questions:['claim','leafComparison','leafConclusion','limitations'].map(id=>({id,heading:t(article(id).querySelector('#'+id).closest('.conclusion-question').querySelector('h4').textContent),sentence:sentence(id),options:options(id)}))},
      learning:{heading:tx('.reveal-card h3'),points:html('.learning-points'),limit:tx('.reveal-card .caption'),diagram:science.outerHTML,processes,caption},
      reflection:{heading:tx('.reflection-card h3'),question:label('reflection')},
      reference:{texts:Object.fromEntries(Object.entries(core.references).map(([key,value])=>[key,t(value)])),variables:{iv:[core.variableNames[0]],dv:[core.variableNames[1]],cv:core.variableNames.slice(2)},assumptions:core.assumptions.map(o=>({...o,text:t(o.text),reference:t(o.reference)})),answers:core.answers,
        model:core.model,rates:Object.fromEntries(core.ids.map(id=>[id,((core.model[id].at(-1)-core.model[id][0])/(core.times.at(-1)-core.times[0])).toFixed(2)])),rubric:core.rubric.map(row=>row.map(cell=>typeof cell==='string'?t(cell):cell))}
    };
  };
  // Font metrics differ across phones/OSes. Hash content, geometry and original
  // label positions, not browser-dependent line wrapping or fitted font sizes.
  window.VL2PaperDigestSource=value=>{
    if(Array.isArray(value))return value.map(window.VL2PaperDigestSource);
    if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,window.VL2PaperDigestSource(item)]));
    if(typeof value!=='string')return value;
    if(!/<[a-z]/i.test(value))return value.replace(/\s+/g,'');
    const template=document.createElement('template');template.innerHTML=value;
    const nodeData=node=>{
      if(node.nodeType===Node.TEXT_NODE)return ['text',node.nodeValue.replace(/\s+/g,'')];
      if(node.nodeType!==Node.ELEMENT_NODE)return null;
      if(node.hasAttribute('data-i18n-svg'))return ['label',node.dataset.i18nX,node.dataset.i18nY,node.dataset.i18nLines,node.textContent.replace(/\s+/g,'')];
      return [node.localName,[...node.attributes].map(a=>[a.name,a.value]).sort((a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:0),[...node.childNodes].map(nodeData).filter(Boolean)];
    };
    return [...template.content.childNodes].map(nodeData).filter(Boolean);
  };
})();
