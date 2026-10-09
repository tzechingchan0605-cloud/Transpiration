'use strict';

// Language belongs to this page's presentation, never to a saved investigation.
// Translate text and accessible hints in place; leave controls, values and IDs intact.
window.VL2I18n = (() => {
  let language = 'zh';
  const originals = new WeakMap(), attributes = new WeakMap();
  const attributeNames = ['placeholder','aria-label','aria-description','alt','title'];
  const exact = {...window.VL2_I18N_STATIC, ...window.VL2_I18N_DYNAMIC?.exact};
  const approvedVocabulary = [
    {term:'transpiration pull',zh:'蒸騰拉力',pattern:'transpiration pull'},
    {term:'palisade mesophyll cell',zh:'柵狀葉肉細胞',pattern:'palisade mesophyll cells?'},
    {term:'spongy mesophyll cell',zh:'海綿葉肉細胞',pattern:'spongy mesophyll cells?'},
    {term:'mesophyll cell',zh:'葉肉細胞',pattern:'mesophyll cells?'},
    {term:'epidermal cell',zh:'表皮細胞',pattern:'epidermal cells?'},
    {term:'vascular bundle',zh:'維管束',pattern:'vascular bundles?'},
    {term:'xylem vessel',zh:'木質導管',pattern:'xylem vessels?'},
    {term:'guard cell',zh:'保衞細胞',pattern:'guard cells?'},
    {term:'transpiration',zh:'蒸騰',pattern:'transpiration'},
    {term:'petiole',zh:'葉柄',pattern:'petioles?'},
    {term:'phloem',zh:'韌皮部',pattern:'phloem'},
    {term:'stoma / stomata',zh:'氣孔',pattern:'stomata|stoma'},
    {term:'cuticle',zh:'角質層',pattern:'cuticles?'},
    {term:'evaporation / evaporate',zh:'蒸發',pattern:'evaporat(?:ion|e[sd]?|ing)'},
    {term:'water vapour',zh:'水汽',pattern:'water vapour'},
    {term:'water film',zh:'水膜',pattern:'water films?'},
    {term:'air space',zh:'氣室',pattern:'air spaces?'},
    {term:'chloroplast',zh:'葉綠體',pattern:'chloroplasts?'},
    {term:'vacuole',zh:'液泡',pattern:'vacuoles?'},
    {term:'xylem',zh:'木質部',pattern:'xylem'},
    {term:'stomatal opening',zh:'氣孔張開',pattern:'stomatal openings?'},
    {term:'herbaceous stem',zh:'草本莖',pattern:'herbaceous stems?'},
    {term:'light intensity',zh:'光強度',pattern:'light intensit(?:y|ies)'},
    {term:'humidity',zh:'濕度',pattern:'humidity'},
    {term:'depth of immersion',zh:'浸入深度',pattern:'depth of immersion'},
    {term:'transpiration rate',zh:'蒸騰速率',pattern:'transpiration rates?'},
    {term:'testable',zh:'可測試的',pattern:'testable'},
    {term:'coordinates',zh:'坐標',pattern:'coordinates?'}
  ].sort((a,b)=>b.term.length-a.term.length);
  const vocabularyPattern = new RegExp('\\b('+approvedVocabulary.map(v=>'(?:'+v.pattern+')').join('|')+')\\b','gi');
  const withVocabulary = text => text.replace(vocabularyPattern, (word, matched, offset, source) => {
    const entry = approvedVocabulary.find(v=>new RegExp('^(?:'+v.pattern+')$','i').test(word));
    if(source.slice(offset+word.length).startsWith(` (${entry.zh})`))return word;
    return `${word} (${entry.zh})`;
  });
  const escapeRegex = text => text.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const patterns = (window.VL2_I18N_DYNAMIC?.patterns || []).map(([source,target])=>{
    const names=[];
    let previous=0,regex='';
    for(const match of source.matchAll(/\{([A-Za-z][A-Za-z0-9_]*)\}/g)){
      regex+=escapeRegex(source.slice(previous,match.index))+'([\\s\\S]+?)';
      names.push(match[1]);previous=match.index+match[0].length;
    }
    return {regex:new RegExp('^'+regex+escapeRegex(source.slice(previous))+'$'),names,target};
  });
  function translateCore(text,depth=0){
    if(depth>8)return text;
    const trimmed=text.trim();
    if(Object.hasOwn(exact,trimmed))return exact[trimmed];
    // Dates stay Chinese in Excel; only their visible DOM presentation changes.
    const date=trimmed.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日\s*(上午|下午)?\s*(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if(date)return `${date[1]}-${date[2].padStart(2,'0')}-${date[3].padStart(2,'0')} ${date[5]}:${date[6]}${date[7]?':'+date[7]:''}${date[4]?' '+(date[4]==='上午'?'AM':'PM'):''} (HKT)`;
    for(const pattern of patterns){
      const match=trimmed.match(pattern.regex);if(!match)continue;
      const values=Object.fromEntries(pattern.names.map((name,i)=>[name,translateCore(match[i+1],depth+1)]));
      return pattern.target.replace(/\{([A-Za-z][A-Za-z0-9_]*)\}/g,(_,name)=>values[name]??'');
    }
    for(const [separator,replacement] of [['、',', '],['；','; '],['：',': '],['\n','\n']]){
      if(trimmed.includes(separator))return trimmed.split(separator).map(part=>translateCore(part,depth+1)).join(replacement);
    }
    return text;
  }
  function translate(text,locale=language,context=null){
    const value=String(text??'');
    if(locale!=='en')return value;
    const prose=context==='learning'&&Object.hasOwn(window.VL2_I18N_STATIC,value.trim());
    return withVocabulary(prose?window.VL2_I18N_STATIC[value.trim()]:translateCore(value));
  }
  function skipText(node){
    return !!node.parentElement?.closest('script,style,textarea,input,[data-user-text],[data-i18n-svg]');
  }
  function applyText(node){
    if(skipText(node)){originals.delete(node);return;}
    const current=node.nodeValue;
    let entry=originals.get(node);
    if(!entry||entry.output!==current)entry={source:current,output:current};
    const output=translate(entry.source,language,node.parentElement?.closest('.learning-points')?'learning':null);
    if(output!==current)node.nodeValue=output;
    entry.output=output;originals.set(node,entry);
  }
  function applyAttributes(element){
    let entries=attributes.get(element);
    if(!entries){entries={};attributes.set(element,entries);}
    for(const name of attributeNames){
      if(!element.hasAttribute(name))continue;
      const current=element.getAttribute(name);
      let entry=entries[name];
      if(!entry||entry.output!==current)entry={source:current,output:current};
      const output=translate(entry.source);
      if(output!==current)element.setAttribute(name,output);
      entry.output=output;entries[name]=entry;
    }
  }
  function apply(root=document.body){
    if(!root)return;
    if(root.nodeType===Node.TEXT_NODE){applyText(root);return;}
    const elements=root.nodeType===Node.ELEMENT_NODE?[root,...root.querySelectorAll('*')]:[...root.querySelectorAll('*')];
    for(const element of elements){
      if(element.matches('script,style'))continue;
      applyAttributes(element);
      if(element.matches('option[data-legacy-answer]')){
        const value=(language==='en'?'Previous answer: ':'先前答案：')+element.dataset.legacyAnswer;
        if(element.textContent!==value)element.textContent=value;
      }
    }
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    while(walker.nextNode())applyText(walker.currentNode);
    window.VL2I18nSVG?.apply(root,language,translate);
  }
  // Clone canonical source, rather than a translated presentation, into a new report.
  function sourceHTML(element,inner=false){
    const clone=element.cloneNode(true);
    function restore(original,copy){
      if(original.nodeType===Node.TEXT_NODE){copy.nodeValue=originals.get(original)?.source??original.nodeValue;return;}
      const entries=attributes.get(original);
      if(entries)for(const [name,entry]of Object.entries(entries))copy.setAttribute(name,entry.source);
      if(original.nodeType===Node.ELEMENT_NODE&&original.hasAttribute('data-i18n-svg')){
        const lines=JSON.parse(original.dataset.i18nLines);
        copy.innerHTML=lines.map((line,i)=>`<tspan x="${original.dataset.i18nX}" dy="${i?22:0}">${line.replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))}</tspan>`).join('');
        copy.setAttribute('x',original.dataset.i18nX);copy.setAttribute('y',original.dataset.i18nY);copy.setAttribute('font-size',original.dataset.i18nFont);
        return;
      }
      original.childNodes.forEach((child,i)=>restore(child,copy.childNodes[i]));
    }
    restore(element,clone);return inner?clone.innerHTML:clone.outerHTML;
  }
  function setLanguage(locale){
    if(locale!=='zh'&&locale!=='en')return;
    language=locale;
    document.documentElement.lang=language==='en'?'en':'zh-Hant-HK';
    document.title=translate('西芹的紅色水跡｜探究實驗室');
    apply();
  }
  function requestSwitch(){setLanguage(language==='zh'?'en':'zh');}
  for(const id of ['languageButton','loginLanguageButton','teacherLanguageButton'])document.querySelector('#'+id).addEventListener('click',requestSwitch);
  // Batch UI updates. No form events, re-render, save, timer reset or network action.
  let queued=false;
  const changedRoots=new Set();
  const observer=new MutationObserver(changes=>{
    for(const change of changes)changedRoots.add(change.target);
    if(queued)return;queued=true;
    queueMicrotask(()=>{
      queued=false;
      const roots=[...changedRoots];changedRoots.clear();
      for(const root of roots){
        if(!root.isConnected||!document.body.contains(root))continue;
        if(roots.some(parent=>parent!==root&&parent.contains(root)))continue;
        apply(root);
      }
    });
  });
  observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:attributeNames});
  apply();
  return {get language(){return language;},approvedVocabulary,translate,apply,sourceHTML,setLanguage,requestSwitch};
})();
