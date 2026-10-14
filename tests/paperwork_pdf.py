"""Inspect every actual PDF page, including self-study sequence and answer isolation."""
import json, re, hashlib, unicodedata, html
from pathlib import Path
import fitz
root=Path(__file__).resolve().parents[1]
manifest=json.loads((root/'paperwork/generated/manifest.json').read_text())
sources=json.loads((root/'paperwork/generated/source.json').read_text())
review=Path('/tmp/vl2-paper-review');review.mkdir(exist_ok=True)
approved={'蒸騰','蒸騰拉力','葉柄','木質導管','韌皮部','葉肉細胞','柵狀葉肉細胞','海綿葉肉細胞','表皮細胞','保衞細胞','氣孔','角質層','維管束','蒸發','水汽','水膜','氣室','葉綠體','液泡','木質部','氣孔張開','草本莖','光強度','濕度','浸入深度','蒸騰速率','可測試的','坐標'}
def compact(value):
 return re.sub(r'\s+','',unicodedata.normalize('NFKC',html.unescape(re.sub(r'<[^>]*>','',str(value)))))
def require_text(text,values,context):
 for value in values:
  assert compact(value) in compact(text),(context,'missing content',value)
counts={'A':2,'B':5,'C':2,'D':6,'all':15}
for lang in ['zh','en']:
 m=sources[lang];p=m['paper']
 for part,file in manifest['languages'][lang]['files'].items():
  pdf=root/file['path'];assert hashlib.sha256(pdf.read_bytes()).hexdigest()==file['sha256']
  doc=fitz.open(pdf);assert len(doc)==file['pages']==counts[part]
  all_text='\n'.join(page.get_text() for page in doc)
  assert '\ufffd' not in all_text
  for i,page in enumerate(doc):
   text=page.get_text();layout=file['layout'][i];context=(lang,part,i+1)
   assert abs(page.rect.width-595.28)<1 and abs(page.rect.height-841.89)<1
   identity=layout['part'] in ['A','C'] and layout['page']==1
   assert bool(re.search(r'姓名\s*:|Name\s*:',unicodedata.normalize('NFKC',text)))==identity,(context,'identity location')
   assert all(n==2 for n in layout['writingLines'])
   # Compare every body text character, not merely page counts or HTML flags.
   require_text(text,[line for line in layout['text'].splitlines() if line.strip()],context)
   lines=[]
   for draw in page.get_drawings():
    fill=draw.get('fill')
    if fill and all(abs(c-.6)<.015 for c in fill):
     lines.extend(item[1] for item in draw['items'] if item[0]=='re' and item[1].width>100 and item[1].height<1.5)
   assert len(lines)==2*len(layout['writingLines']),(context,'actual PDF writing lines')
   for block in page.get_text('dict')['blocks']:
    for line in block.get('lines',[]):
     for span in line['spans']:
      x0,y0,x1,y1=span['bbox']
      assert x0>=-1 and y0>=-1 and x1<=page.rect.width+1 and y1<=page.rect.height+1,(context,'text outside page',span)
   section=layout['part'];number=layout['page']
   if section=='A' and number==1:
    require_text(text,[m['learning']['limit']]+m['learning']['caption']+[c['text'] for g in m['learning']['processes'] for c in g['cards']],context)
    require_text(text,[piece for piece in re.split(r'<[^>]*>',m['learning']['points']) if piece.strip()],context)
    require_text(text,re.findall(r'<text\b[^>]*>(.*?)</text>',m['learning']['diagram'],re.S),context)
   if section=='A' and number==2:
    require_text(text,[p[k] for k in ['distinction','hypothesisExample','workedReading','workedCalculation','workedGraph','variableHelp']],context)
    assert layout['liquidSurfaces']==2
   if section=='B' and number==1:
    require_text(text,[p['hypothesisTask']]+[o['text'] for o in m['variables']['choices']],context)
   if section=='B' and number==2:
    require_text(text,[p[k] for k in ['conditions','labelsTask','fairTask','temperatureTask']]+[o['text'] for o in m['assumptions']['choices']]+[m['assumptions']['reminder']],context)
    assert layout['liquidSurfaces']==4
   if section=='B' and number==3: assert layout['liquidSurfaces']==8
   if section=='B' and number==4:
    assert layout['liquidSurfaces']==4 and layout['blankReadings']==16
    require_text(text,[p['calculation']],context)
   if section=='B' and number==5:
    require_text(text,[p[k] for k in ['plot','evidenceTask','rangeTask']]+[o['text'] for q in m['conclusions']['questions'] for o in q['options']],context)
    assert layout['circles']==4
   if section=='C' and number==1:
    require_text(text,[p[k] for k in ['checkNotice','keyObservation','keyHypothesis','keyDesign','keyTemperature','keyLimits']]+list(m['reference']['rates'].values()),context)
   if section=='C' and number==2:
    require_text(text,[p[k] for k in ['keyAnalysis','explain','correction','explanationKey','correctionKey']],context)
    assert layout['writingLines']==[2,2]
   if part!='all':
    page.get_pixmap(matrix=fitz.Matrix(1.25,1.25)).save(review/f'{lang}-{part}-{i+1}.png')
    if part in ['A','B','C']:page.get_pixmap(matrix=fitz.Matrix(1.25,1.25),colorspace=fitz.csGRAY).save(review/f'{lang}-{part}-{i+1}-gray.png')
  if part in ['A','B']:
   assert not re.search(r'0\.40|0\.25|0\.15|0\.05',all_text),(lang,part,'independent numeric solution leaked')
   assert not re.search(r'參考答案|核對答案|Check answers|分項回饋準則|Scoring guide|最高分|Full credit|SPS',all_text,re.I),(lang,part,'key or scores leaked')
  if part in ['A','B','C']:
   assert not re.search(r'tzechingchan|@gmail|隔離學生|教師示範|ControlGroup|對照組材料',all_text)
   assert not re.search(r'乳化|脂肪酶|膽汁|bile|lipase',all_text,re.I)
   assert '✕' not in all_text
  if part=='D':
   require_text(all_text,m['labels']['steps']+[p['feedbackNote']]+[v for row in m['feedback'] for v in row],(lang,part,'guide'))
   require_text(all_text,[p['mappingHeads'][0]]+[p[row['task']] for row in m['alignment']],(lang,part,'alignment'))
  if lang=='en':
   unknown=set(re.findall(r'[\u3400-\u9fff]+',all_text))-approved
   assert not unknown,(part,'unapproved Chinese',unknown)
  fonts={font for page in doc for font in page.get_fonts()};assert fonts
  for font in fonts:
   if font[2]=='Type3':
    obj=doc.xref_object(font[0]);assert '/CharProcs' in obj and '/ToUnicode' in obj
    refs=re.findall(r'(\d+) 0 R',doc.xref_get_key(font[0],'CharProcs')[1]);assert refs and all(doc.xref_is_stream(int(ref)) and doc.xref_stream(int(ref)) for ref in refs)
   else:assert doc.extract_font(font[0])[3],(lang,part,'font not embedded')
  print(f'PASS: {lang}/{part}, {len(doc)} actual A4 pages, complete text/labels, fonts, two-line vectors, no answer leakage or overflow')
assert sources['zh']['experiment']['model']=={'A':[0,4,8,12],'B':[0,2.5,5,7.5],'C':[0,1.5,3,4.5],'D':[0,.5,1,1.5]}
assert manifest['materialVersion']==2 and manifest['version']=='VL2-paper-selfstudy-v2'
assert manifest['timeMinutes']=={'range':[15,20],'target':18,'concepts':4,'supported':3,'independent':8,'checking':3}
assert manifest['languages']['zh']['ranges']=={'A':[1,2],'B':[3,7],'C':[8,9],'D':[10,15]}
print('PASS: unchanged model, self-study versions, 15–20 minute timing and staged page ranges; renders:',review)
