"""Print adaptations of VL2's own SVGs. Botanical paths and model geometry stay native."""
import copy,re,json
from PIL import ImageFont
from functools import lru_cache
@lru_cache(None)
def font(size):return ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',round(size*10),index=3)
def measure(text,size):return font(size).getlength(text)/10
from lxml import etree as E
NS='http://www.w3.org/2000/svg';Q=lambda n:'{'+NS+'}'+n
COLOURS=['C27832','76569E','218BAC']
def english(text):
 # Figures use English labels; original bilingual choices/hints are untouched.
 while re.search(r'\([^()]*[\u3400-\u9fff][^()]*\)',text):text=re.sub(r'\([^()]*[\u3400-\u9fff][^()]*\)','',text)
 return re.sub(r'\s+',' ',text).strip()
def wrap(text,width,size):
 lines=[];line='';total=0
 tokens=list(text) if re.search('[\u3400-\u9fff]',text) else re.findall(r'\S+\s*',text)
 for token in tokens:
  w=measure(token,size)
  if line and total+w>width:lines.append(line.strip());line='';total=0
  line+=token;total+=w
 if line:lines.append(line.strip())
 return lines

def root(asset,lang,labels=True):
 r=E.fromstring(asset['svg'].encode());r.set('font-family','Noto Sans CJK TC')
 for el in r.iter(Q('text')):
  original=''.join(json.loads(el.get('data-i18n-lines'))) if el.get('data-i18n-lines') else ''.join(el.itertext())
  text=asset['labels'].get(original,original)
  if lang=='en':text=english(text)
  if labels:
   x=el.get('x','0');el.text=None
   for c in list(el):el.remove(c)
   span=E.SubElement(el,Q('tspan'));span.set('x',x);span.text=text
  el.set('font-family','Noto Sans CJK TC')
 return r

def anatomy(m,lang):
 r=root(m['native']['anatomy'],lang)
 for el in r.iter(Q('text')):
  text=''.join(el.itertext());x=float(el.get('x','0'));y=float(el.get('y','0'));size=max(20,float(el.get('font-size','17')))
  width=230 if x>=830 else 270 if x<280 and 80<y<560 else 1000
  card=el.getparent()
  if card.get('class')=='process-card':width=float(card.find(Q('rect')).get('width'))-43;size=19.5
  if y==63:
   text='1：蒸發與擴散　　2：失水與補水　　3：蒸騰拉力與上運' if lang=='zh' else '1: Evaporation / diffusion   2: Water loss / replacement   3: Transpiration pull'
   width=1025
  if y==783:
   el.getparent().remove(el);continue
  if card.get('class')=='process-heading':
   width=float(card.find(Q('rect')).get('width'))-30
   x=float(card.find(Q('rect')).get('x'))+15;el.set('x',str(x));size=20
  if card.get('class')=='process-marker':
   token=card.get('data-process','');colour=COLOURS[0] if token.startswith('evaporation') else COLOURS[1] if token in ['pull-1','pull-2'] else COLOURS[2]
   card.find(Q('circle')).set('fill','#'+colour)
   text={'evaporation-1':'1a','evaporation-2':'1b','pull-1':'2a','pull-2':'2b','pull-3':'3'}.get(token,text)
   size=18;el.set('font-weight','700');width=80
  if card.get('class')=='process-card':
   kind=card.get('data-process-group');token=card.find('.//'+Q('g')).get('data-process','')
   colour=COLOURS[0] if kind=='evaporation' else COLOURS[1] if token in ['pull-1','pull-2'] else COLOURS[2]
   el.set('fill','#'+colour);el.set('font-weight','600');card.find(Q('rect')).set('height','135')
  if y==150:el.set('y','153');y=153
  if y==193:el.set('y','199');y=199
  if y==372:el.set('y','380');y=380
  if lang=='en':
   original=el.get('data-i18n-lines','')
   if '葉脈' in original:x=26;el.set('x','26');size=17.5
   elif '木質部（木質導管）' in original:width=175
   elif '維管束' in original and x==193:x=165;y=389;el.set('x','165');el.set('y','389');width=85
   elif '韌皮部' in original:x=165;el.set('x','165')
  lines=wrap(text,width,size)
  # Titles and descriptions retain their native positions; wrap upwards where needed.
  if False and 90<y<610 and len(lines)>1:
   y-=min(19,(len(lines)-1)*10);el.set('y',str(y))
  if card.get('class')=='process-card':y=681;el.set('y','681')
  el.set('font-size',str(size));el.text=None
  for child in list(el):el.remove(child)
  for i,line in enumerate(lines):
   sp=E.SubElement(el,Q('tspan'));sp.set('x',str(x));sp.set('dy','0' if i==0 else str(size+2));sp.text=line
 r.set('viewBox','0 0 1080 810')
 r.find(Q('rect')).set('height','808')
 return E.tostring(r).decode()

def specimen(asset,lang,view=None):
 r=root(asset,lang)
 # Relocate the tiny native prose labels to editable captions in the worksheet.
 for t in list(r.iter(Q('text'))):t.getparent().remove(t)
 if view:r.set('viewBox',view)
 return r

def scene(m,lang):
 r=E.Element(Q('svg'),nsmap={None:NS});r.set('viewBox','0 0 510 100');r.set('width','510pt');r.set('height','100pt')
 sources=[m['native']['sceneBefore'],m['native']['sceneAfter']]+m['native']['setups'][:3]
 for i,a in enumerate(sources):
  x=i*85;n=specimen(a,lang);n.set('x',str(x+23));n.set('y','18');n.set('width','38');n.set('height','64.92');r.append(n)
  top=(['開始時','一段時間後'] if lang=='zh' else ['At the start','After some time'])[i] if i<2 else a['id']+' · '+str(m['experiment']['setups'][i-2]['distance'])+' cm'
  t=E.SubElement(r,Q('text'),x=str(x+42),y='12',**{'font-family':'Noto Sans CJK TC','font-size':'11','text-anchor':'middle','fill':'#206B73'});t.text=top
  if i>=2:
   t=E.SubElement(r,Q('text'),x=str(x+42),y='96',**{'font-family':'Noto Sans CJK TC','font-size':'11','text-anchor':'middle'});t.text=str(m['experiment']['setups'][i-2]['light'])+' lux'
 return E.tostring(r).decode()

def apparatus(m,lang):
 r=E.Element(Q('svg'),nsmap={None:NS});r.set('viewBox','0 0 510 90');r.set('width','510pt');r.set('height','90pt')
 for i,a in enumerate(m['native']['setups']):
  x=i*127;n=specimen(a,lang);n.set('x',str(x+43));n.set('y','16');n.set('width','40');n.set('height','68.33');r.append(n)
  t=E.SubElement(r,Q('text'),x=str(x+63),y='12',**{'font-family':'Noto Sans CJK TC','font-size':'11','text-anchor':'middle','fill':'#206B73'});c=m['experiment']['setups'][i];t.text=a['id']+' · '+str(c['distance'])+' cm · '+str(c['light'])+' lux'
 return E.tostring(r).decode()

def readings(m,lang):
 r=E.Element(Q('svg'),nsmap={None:NS});r.set('viewBox','0 0 510 185');r.set('width','510pt');r.set('height','185pt')
 for j,id in enumerate('ABCD'):
  x=j*127
  t=E.SubElement(r,Q('text'),x=str(x+63),y='14',**{'font-family':'Noto Sans CJK TC','font-size':'12','text-anchor':'middle','fill':'#206B73'});t.text=id
  # The ruler is the VL's ruler: 18 native units/cm and half-centimetre ticks.
  a=m['native']['frames'][0]['diagrams'][j];raw=root(a,lang);g=next(el for el in raw.iter(Q('g')) if el.get('class')=='ruler')
  ruler=E.SubElement(r,Q('svg'),x=str(x),y='28',width='44',height='128.4',viewBox='188 28 110 321');ruler.append(copy.deepcopy(g))
  g=ruler[0]
  for el in list(g.iter(Q('text'))):
   text=''.join(el.itertext())
   if text not in ['0','4','8','12','16']:el.getparent().remove(el);continue
   el.set('font-size','27.5');el.set('x','210');el.text=None
   for c in list(el):el.remove(c)
   el.text=text+(' cm' if text=='16' else '')
  for i,f in enumerate(m['native']['frames']):
   a=f['diagrams'][j];n=specimen(a,lang,'100 42 50 288')
   for g2 in list(n.iter(Q('g'))):
    if g2.get('class')=='ruler':g2.getparent().remove(g2)
   for child in list(n):
    is_stem=child.tag==Q('path') and (child.get('fill','').startswith('url(') or child.get('opacity')=='.5')
    is_dye=child.tag==Q('g') and child.get('clip-path')
    if child.tag!=Q('defs') and not is_stem and not is_dye:n.remove(child)
   n.set('x',str(x+44+i*21));n.set('y','33.6');n.set('width','20');n.set('height','115.2');r.append(n)
   t=E.SubElement(r,Q('text'),x=str(x+54+i*21),y='164',**{'font-family':'Noto Sans CJK TC','font-size':'11','text-anchor':'middle'});t.text=str(f['time'])
 t=E.SubElement(r,Q('text'),x='255',y='179',**{'font-family':'Noto Sans CJK TC','font-size':'11','text-anchor':'middle'});t.text='時間（min）' if lang=='zh' else 'Time (min)'
 return E.tostring(r).decode()

def compact_readings(m,lang,ids):
 """Native xylem/ruler paths, with a shared readable scale for each group."""
 r=E.Element(Q('svg'),nsmap={None:NS});w=120*len(ids)
 r.set('viewBox',f'0 0 {w} 132');r.set('width',f'{w}pt');r.set('height','132pt')
 for j,id in enumerate(ids):
  original_index='ABCD'.index(id);x=j*120
  t=E.SubElement(r,Q('text'),x=str(x+60),y='12',**{'font-family':'Noto Sans CJK TC','font-size':'12','text-anchor':'middle','fill':'#206B73'});t.text=id
  a=m['native']['frames'][0]['diagrams'][original_index];raw=root(a,lang);g=next(el for el in raw.iter(Q('g')) if el.get('class')=='ruler')
  ruler=E.SubElement(r,Q('svg'),x=str(x),y='24',width='39',height='83.46',viewBox='188 28 150 321',overflow='visible');ruler.append(copy.deepcopy(g));g=ruler[0]
  for el in list(g.iter(Q('text'))):
   value=''.join(el.itertext())
   if value not in ['0','4','8','12','16']:el.getparent().remove(el);continue
   el.set('font-size',str(11/.26));el.set('x','210');el.text=None
   for c in list(el):el.remove(c)
   el.text=value+(' cm' if value=='16' else '')
  for i,f in enumerate(m['native']['frames']):
   n=specimen(f['diagrams'][original_index],lang,'100 42 50 288')
   for child in list(n):
    stem=child.tag==Q('path') and (child.get('fill','').startswith('url(') or child.get('opacity')=='.5')
    dye=child.tag==Q('g') and child.get('clip-path')
    if child.tag!=Q('defs') and not stem and not dye:n.remove(child)
   n.set('x',str(x+43+i*18));n.set('y','27.64');n.set('width','13');n.set('height','74.88');r.append(n)
   t=E.SubElement(r,Q('text'),x=str(x+49.5+i*18),y='116',**{'font-family':'Noto Sans CJK TC','font-size':'11','text-anchor':'middle'});t.text=str(f['time'])
 t=E.SubElement(r,Q('text'),x=str(w/2),y='130',**{'font-family':'Noto Sans CJK TC','font-size':'11','text-anchor':'middle'});t.text='時間（min）' if lang=='zh' else 'Time (min)'
 return E.tostring(r).decode()
