#!/usr/bin/env python3
"""WS2 canonical editable Word source. PDF is rendered from this exact DOCX."""
import json,re,sys,subprocess,os,hashlib
from pathlib import Path
from docx import Document
from docx.shared import Pt,Cm,RGBColor
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
import cairosvg
ROOT=Path(__file__).resolve().parent; OUT=ROOT/'generated'; WORK=ROOT.parent/'work'/'paper-build';WORK.mkdir(parents=True,exist_ok=True)
SRC=json.loads((OUT/'source.json').read_text());REF=json.loads((ROOT/'reflection.json').read_text())
TEAL='206B73';RED='BC2927';BLUE='165CA5';FONT='Noto Sans CJK TC'
# Only pedagogical concepts are red; answers use blue separately.
TERMS=['蒸騰拉力','木質導管','水勢下降','水膜','氣室','蒸發','擴散','滲透','氣孔','葉柄','蒸騰','光強度','evaporates','diffuses','Osmosis','stomatal opening','transpiration pull','xylem vessels','xylem','water potential','water films','air spaces','evaporation','diffusion','osmosis','stomata','petiole','transpiration','light intensity']
def xml(tag,**attrs):
 e=OxmlElement(tag)
 for k,v in attrs.items():e.set(qn(k),str(v))
 return e
class Sheet:
 def __init__(self,lang,answers=False,teacher=False):
  self.lang=lang;self.answers=answers;self.teacher=teacher;self.m=SRC[lang];self.d=Document();sec=self.d.sections[0]
  sec.page_width=Cm(21);sec.page_height=Cm(29.7);sec.top_margin=Cm(1.25);sec.bottom_margin=Cm(1.25);sec.left_margin=Cm(1.5);sec.right_margin=Cm(1.5)
  sec.header_distance=Cm(.5);sec.footer_distance=Cm(.5)
  st=self.d.styles['Normal'];st.font.name=FONT;st.font.size=Pt(12);st.element.rPr.rFonts.set(qn('w:eastAsia'),FONT)
  st.paragraph_format.line_spacing=Pt(18);st.paragraph_format.space_after=Pt(3)
  for sn in ['Heading 1','Heading 2','Heading 3']:
   sty=self.d.styles[sn];sty.font.name=FONT;sty.font.size=Pt(15 if sn=='Heading 1' else 12);sty.font.color.rgb=RGBColor.from_string(TEAL);sty.paragraph_format.space_before=Pt(5);sty.paragraph_format.space_after=Pt(3)
  hp=sec.header.paragraphs[0];self.runs(hp,self.t('生物科｜蒸騰與水分運輸','Biology | Transpiration and water transport')+(self.t('｜參考答案',' | Reference answers') if answers else ''),11)
  fp=sec.footer.paragraphs[0];fp.alignment=2;self.runs(fp,self.t('工作紙二｜','Worksheet 2 | '),11);fp._p.append(xml('w:fldSimple',**{'w:instr':'PAGE'}))
 def t(self,z,e):return z if self.lang=='zh' else e
 def runs(self,p,text,size=12,colour=None,bold=False,concept=False):
  pieces=re.split('('+'|'.join(map(re.escape,sorted(TERMS,key=len,reverse=True)))+')',str(text)) if concept else [str(text)]
  for piece in pieces:
   if not piece:continue
   r=p.add_run(piece);r.font.name=FONT;r._element.get_or_add_rPr().rFonts.set(qn('w:eastAsia'),FONT);r.font.size=Pt(size);r.bold=bold or (concept and piece in TERMS)
   if colour or (concept and piece in TERMS):r.font.color.rgb=RGBColor.from_string(RED if concept and piece in TERMS else colour)
  return p
 def p(self,text='',size=12,colour=None,bold=False,concept=False,after=3):
  p=self.d.add_paragraph();p.paragraph_format.space_after=Pt(after);p.paragraph_format.line_spacing=Pt(size*1.5);self.runs(p,text,size,colour,bold,concept);return p
 def h(self,text,level=2):return self.d.add_paragraph(text,'Heading '+str(level))
 def hint(self,text):self.p(text,11,'607D85')
 def answer(self,text,lines=2):
  if self.answers:self.p(self.t('參考答案：','Reference answer: ')+text,12,BLUE,True)
  else:
   for _ in range(lines):
    p=self.p('',after=0);p.paragraph_format.line_spacing=Pt(23);p.paragraph_format.space_before=Pt(0);p.add_run(' ');pr=p._p.get_or_add_pPr();b=xml('w:pBdr');b.append(xml('w:bottom',**{'w:val':'single','w:sz':'8','w:color':'333333','w:space':'1'}));b.append(xml('w:between',**{'w:val':'single','w:sz':'8','w:color':'333333','w:space':'1'}));pr.append(b)
 def table(self,rows,widths=None,mark=None):
  t=self.d.add_table(rows=0,cols=len(rows[0]));t.autofit=False
  if widths:
   for c,w in zip(t.columns,widths):c.width=Cm(w)
  for i,row in enumerate(rows):
   cells=t.add_row().cells
   if widths:
    for c,w in zip(cells,widths):c.width=Cm(w)
   for j,txt in enumerate(row):
    p=cells[j].paragraphs[0];p.paragraph_format.space_after=Pt(2);p.paragraph_format.space_before=Pt(1);p.paragraph_format.line_spacing=Pt(18)
    self.runs(p,txt,12,BLUE if mark and (i,j) in mark else TEAL if i==0 else None,bool(i==0 or mark and (i,j) in mark))
    tcpr=cells[j]._tc.get_or_add_tcPr();b=xml('w:tcBorders')
    for edge in ['top','left','bottom','right']:b.append(xml('w:'+edge,**{'w:val':'single','w:sz':'4','w:color':'BED0D2'}))
    tcpr.append(b)
   t.rows[-1]._tr.get_or_add_trPr().append(xml('w:cantSplit'))
   if i==0:t.rows[-1]._tr.get_or_add_trPr().append(xml('w:tblHeader'))
  return t
 def pic(self,svg,key,width=18):
  path=WORK/(key+'.png');cairosvg.svg2png(bytestring=svg.encode(),write_to=str(path),scale=4)
  (WORK/(key+'.svg')).write_text(svg)
  p=self.p('',after=3);p.paragraph_format.line_spacing=1;p.add_run().add_picture(str(path),width=Cm(width))
 def page(self):self.d.add_page_break()
 def save(self,name):
  path=OUT/name;self.d.save(path);return path

def svg(w,h,body):return f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}pt" height="{h}pt" viewBox="0 0 {w} {h}"><rect width="{w}" height="{h}" rx="5" fill="#F4F8F8"/>{body}</svg>'
def txt(x,y,s,size=11,col='#206B73',anchor='start'):return f'<text x="{x}" y="{y}" font-family="Noto Sans CJK TC" font-size="{size}" fill="{col}" text-anchor="{anchor}">{s}</text>'
def flow(s,labels,key):
 w=510;cw=166;body=''
 for i,lines in enumerate(labels):
  x=i*172;body+=f'<rect x="{x+2}" y="4" width="160" height="50" rx="5" fill="#E3F0EF" stroke="#BDD0D2"/>'
  for j,line in enumerate(lines):body+=txt(x+82,24+j*18,line,11,anchor='middle')
  if i<2:body+=f'<path d="M{x+164} 30H{x+172}M{x+169} 27L{x+172} 30L{x+169} 33" fill="none" stroke="#206B73" stroke-width="1"/>'
 s.pic(svg(w,58,body),key)
def scene(s):
 body=''
 for i,label in enumerate([s.t('開始時','At the start'),s.t('過了一段時間','After some time')]):
  x=60+i*270
  body+=txt(x+70,15,label,11,anchor='middle')
  body+=f'<path d="M{x+8} 34V54H{x+51}V34" fill="#F9DDD8" stroke="#607D85"/><path d="M{x+29} 48V21" stroke="#9BB67A" stroke-width="8"/>'
  body+=f'<ellipse cx="{x+20}" cy="25" rx="12" ry="4" fill="#77A379"/><ellipse cx="{x+39}" cy="21" rx="12" ry="4" fill="#77A379"/>'
  if i:body+=f'<path d="M{x+29} 48V31" stroke="#BE302D" stroke-width="2"/>'
 body+=txt(255,42,'→',15,anchor='middle')
 s.pic(svg(510,60,body),'scene-'+s.lang)
def apparatus(s):
 body=''
 for i,c in enumerate(s.m['experiment']['setups']):
  x=i*127;body+=txt(x+63,15,c['id']+' · '+s.t('帶葉' if c['leaves'] else '不帶葉','leaves' if c['leaves'] else 'no leaves'),11,anchor='middle')
  body+=f'<path d="M{x+28} 34V75H{x+67}V34" fill="#FAE7E5" stroke="#607D85"/><path d="M{x+45} 66V28" stroke="#8B9C66" stroke-width="7"/>'
  if c['leaves']:body+=f'<ellipse cx="{x+37}" cy="29" rx="12" ry="5" fill="#77A379"/><ellipse cx="{x+54}" cy="22" rx="12" ry="5" fill="#77A379"/>'
  body+=f'<path d="M{x+88} 35L{x+78} 48H{x+100}Z M{x+88} 35V24H{x+105}V64" fill="#F6D98A" stroke="#607D85"/>'
  body+=txt(x+63,93,f"{c['distance']} cm · {c['light']} lux",11,anchor='middle')
 s.pic(svg(510,101,body),f'apparatus-{s.lang}')
def rulers(s):
 body=''
 for c,id in enumerate('ABCD'):
  x=c*127;base=143;sc=7
  body+=txt(x+63,15,id+' · cm',11,anchor='middle')
  for half in range(33):
   v=half/2;y=base-v*sc
   body+=f'<path d="M{x+28} {y}h{12 if half%8==0 else 8 if half%2==0 else 4}" stroke="#333" stroke-width=".6"/>'
   if half%8==0:body+=txt(x+24,y+3,str(int(v)),11,'#333','end')
  for i,t in enumerate([0,10,20,30]):
   bx=x+46+i*23;h=s.m['experiment']['model'][id][i]
   body+=f'<rect x="{bx}" y="31" width="8" height="112" fill="#E1E9D7" stroke="#849A75"/><rect x="{bx}" y="{base-h*sc}" width="8" height="{max(h*sc,.4)}" fill="#BD302D"/>'
   body+=txt(bx+4,160,str(t),11,'#333','middle')
  body+=f'<path d="M{x+28} {base}H{x+126}" stroke="#333"/>'
  body+=txt(x+63,178,'min',11,'#333','middle')
 s.pic(svg(510,184,body),'rulers-'+s.lang)
def graph(s):
 body='';x0=40;y0=143;pw=440;ph=120
 for i in range(7):
  x=x0+i*pw/6;body+=f'<path d="M{x} 23V{y0}" stroke="#CDD9DB" stroke-width=".5"/>'+txt(x,y0+16,str(i*200),11,'#333','middle')
 for i in range(6):
  y=y0-i*ph/5;body+=f'<path d="M{x0} {y}H480" stroke="#CDD9DB" stroke-width=".5"/>'+txt(x0-5,y+4,f'{i/10:.1f}',11,'#333','end')
 body+=txt(40,15,s.t('Y：紅色水跡平均上移速度（cm/min）','Y: Average upward speed of red water trace (cm/min)'),11)
 body+=txt(480,177,s.t('X：光強度（lux）','X: Light intensity (lux)'),11,anchor='end')
 if s.answers:
  coords=[]
  for c in s.m['experiment']['setups']:
   id=c['id'];rate=float(s.m['reference']['rates'][id]);x=x0+c['light']/1200*pw;y=y0-rate/.5*ph
   body+=f'<circle cx="{x}" cy="{y}" r="3" fill="#165CA5"/>'+txt(x+5,y-4,id,11,'#165CA5')
   if id!='D':coords.append((c['light'],x,y))
  coords.sort();(_,xa,ya),(_,xb,yb),(_,xc,yc)=coords;body+=f'<path d="M{xa} {ya} C{xa+15} {ya-18},{xb-15} {yb+4},{xb} {yb} S{xc-90} {yc+2},{xc} {yc}" fill="none" stroke="#165CA5" stroke-width="1.3"/>'
 s.pic(svg(510,184,body),f'graph-{s.lang}-{s.answers}')

def worksheet(lang,answers):
 s=Sheet(lang,answers);m=s.m;T=s.t
 s.h(T('工作紙二：蒸騰與水分運輸','Worksheet 2: Transpiration and water transport'),1)
 s.p(T('姓名：________________　班別：________　學號：________','Name: ________________   Class: ________   No.: ________'))
 s.p(T('請先閱讀「課題需知」，再根據情境及模擬結果作答。','Read the topic notes, then answer using the context and simulated results.'))
 s.h(T('課題需知','Topic notes'))
 s.h(T('01　蒸騰：水分以水汽形式散失','01  Transpiration: water loss as vapour'))
 s.p(T('水從葉肉細胞表面的水膜蒸發，進入氣室。氣室內的水汽沿濃度梯度經氣孔擴散到大氣，形成蒸騰。','Water evaporates from water films on mesophyll cell surfaces into air spaces. Water vapour diffuses down a concentration gradient through stomata into the air: transpiration.'),concept=True)
 flow(s,[[T('葉肉表面水膜','Mesophyll water films'),T('液態水','Liquid water')],[T('蒸發 → 氣室','Evaporation → air spaces'),T('形成水汽','Water vapour forms')],[T('經氣孔擴散','Diffusion via stomata'),T('水汽散失到大氣','Vapour lost to the air')]],'flow1-'+lang)
 s.h(T('02　蒸騰拉力：水分沿木質部上運','02  Transpiration pull: transport through xylem'))
 s.p(T('失水令葉肉細胞水勢下降，水分藉滲透從鄰近細胞補充，水因而從木質導管被移走，形成蒸騰拉力，牽引水分向上運輸。供水充足、其他條件相同時，較強光照通常促進氣孔張開。西芹長柄是葉柄，內含木質部。','Water loss lowers mesophyll water potential. Osmosis draws replacement water from neighbouring cells. Water is removed from xylem vessels, creating transpiration pull and drawing water upwards. With adequate water and other conditions equal, stronger light usually favours stomatal opening. A celery stalk is a petiole containing xylem.'),concept=True)
 flow(s,[[T('水勢下降','Water potential falls'),T('滲透補充水分','Osmosis replaces water')],[T('木質導管水被移走','Water leaves xylem'),T('形成蒸騰拉力','Transpiration pull forms')],[T('水分沿木質導管','Water moves upwards'),T('向上運輸','through xylem vessels')]],'flow2-'+lang)
 s.h(T('部分 1｜研究情境與公平比較','Part 1 | Context and fair comparison'))
 s.p(T('園藝小組把帶葉西芹插入紅色水中。他們想知道：光照和葉片會否影響水分運輸？','The gardening club puts celery with leaves in red water. Will light and leaves affect water transport?'))
 scene(s)
 s.h(T('1. 探究的對照組','1. A comparison setup'))
 s.p(m['control']['question'])
 for h in m['control']['hints']:s.hint(h)
 s.answer(m['reference']['texts']['control'],2)
 s.page()
 s.h(T('2. 辨識實驗變量','2. Identify the variables'))
 s.p(T('在每列剔選適當的因素；每類可選多於一項。','Tick the appropriate factors in each row. You may choose more than one per type.'))
 rows=[[T('變量類別','Variable type'),T('可選因素','Factors')]]
 for g in m['variables']['groups']:
  opts=[]
  for c in m['variables']['choices']:
   correct=c['id'] in m['reference']['variables'][g['id']]
   opts.append(('☑ ' if answers and correct else '□ ')+c['text'])
  rows.append([g['title']+'\n'+g['definition'],'  '.join(opts)])
 # Separate options runs make only correct answers blue; every distractor remains.
 tab=s.table(rows,[3.5,14.5])
 if answers:
  for i,g in enumerate(m['variables']['groups'],1):
   cell=tab.cell(i,1);cell.text=''
   p=cell.paragraphs[0];p.paragraph_format.line_spacing=Pt(18);p.paragraph_format.space_after=Pt(2)
   for j,c in enumerate(m['variables']['choices']):
    ok=c['id'] in m['reference']['variables'][g['id']];s.runs(p,('☑ ' if ok else '□ ')+c['text']+'  ',12,BLUE if ok else None,ok)
 s.h(T('3. 選出公平比較所需的前提（可選多於一項）','3. Select the assumptions for a fair comparison (select all that apply)'))
 s.hint(m['assumptions']['reminder'])
 for c in m['assumptions']['choices']:
  ok=next(x['valid'] for x in m['reference']['assumptions'] if x['id']==c['id']);s.p(('☑ ' if answers and ok else '□ ')+c['text'],colour=BLUE if answers and ok else None,bold=answers and ok,after=1)
 s.h(T('部分 2.1｜讀尺及計算','Part 2.1 | Read scales and calculate'))
 apparatus(s)
 s.hint(T('各裝置25°C、相同濕度及氣流、染液濃度及2 cm浸入深度、相近葉柄尺寸；A／B／C總葉面積相同。','All setups: 25°C, equal humidity, air movement and dye concentration, 2 cm immersion, similar petiole dimensions; A/B/C have equal total leaf area.'))
 s.page()
 s.h(T('4. 你的量度記錄','4. Your measurement record'))
 s.p(T('讀取各時點紅色水跡頂端的高度，保留一位小數（cm）。','Read the height of each red trace at each time, to one decimal place (cm).'))
 rulers(s)
 rows=[[T('時間（min）','Time (min)'),'A','B','C','D']]+[[str(t)]+[f"{m['experiment']['model'][id][i]:.1f}" if answers else '' for id in 'ABCD'] for i,t in enumerate([0,10,20,30])]
 s.table(rows,[3.6]*5,mark={(i,j) for i in range(1,5) for j in range(1,5)} if answers else None)
 s.h(T('5. 計算平均上移速度','5. Calculate average upward speed'))
 s.p(T('（30 min讀數 − 0 min讀數）÷ 30；結果保留兩位小數（cm/min）。','(30 min reading − 0 min reading) ÷ 30; give two decimal places (cm/min).'))
 s.table([['A','B','C','D'],[m['reference']['rates'][id] if answers else '' for id in 'ABCD']],[4.5]*4,mark={(1,i) for i in range(4)} if answers else None)
 s.h(T('部分 2.2｜作圖','Part 2.2 | Graph'))
 s.h(T('6. 光強度與紅色水跡上移速度','6. Light intensity and water-trace speed'))
 s.p(T('根據自己的計算標出A／B／C／D；以平滑趨勢線連接帶葉A／B／C，D獨立標示。','Plot A/B/C/D using your calculations. Join A/B/C with a smooth trend line; show D separately.'))
 graph(s)
 s.page()
 s.h(T('部分 2.3｜分析結果','Part 2.3 | Analyse the results'))
 # Retain the native four analysis questions as sentence choices, with no reason fields.
 for i,q in enumerate(m['conclusions']['questions']):
  s.h(str(7+i)+'. '+re.sub(r'^\d+\.\s*','',q['heading']))
  text=q['sentence'];opts=q['options'];correct={'claim':'increase','leafComparison':'faster','leafConclusion':'promotes','limitations':'indirect'}[q['id']]
  if q['id']=='limitations':
   s.p(text.replace('__________',''))
   for c in opts:s.p(('☑ ' if answers and c['id']==correct else '□ ')+c['text'],colour=BLUE if answers and c['id']==correct else None,bold=answers and c['id']==correct,after=0)
  else:
   p=s.p();pre,post=text.split('__________');s.runs(p,pre+'（')
   for j,c in enumerate(opts):
    if j:s.runs(p,' / ')
    s.runs(p,c['text'],12,BLUE if answers and c['id']==correct else None,answers and c['id']==correct)
   s.runs(p,'）'+post)
 s.h(T('部分 3｜整合解釋','Part 3 | Integrated explanation'))
 s.p('11. '+T(REF['question'].replace('學習重點','課題需知'),REF['question_en'].replace('learning points','topic notes')))
 s.answer(T(REF['answer'],REF['answer_en']),7)
 return s.save(f'WS2_{"answers" if answers else "student"}_{lang}.docx')

def teacher(lang):
 s=Sheet(lang,teacher=True);T=s.t;m=s.m
 s.h(T('D · 教師指引、配對及評分','D · Teacher guidance, alignment and marking'),1)
 s.p('WS2 v3 · VL2-Q3 · VL2-R3')
 s.h(T('派發及共同時限','Distribution and shared time'))
 s.p(T('控制組沒有課前概念講授，不操作VL。開始派發完整學生版，課題需知全程可讀。完成首次答案後先收取／掃描保存，再派完整答案版；保留原答，用另一顏色修正。D只供教師。','The control group receives no prior concept lecture and does not operate the VL. Distribute the complete student worksheet at the start, with topic notes available throughout. Collect or scan first responses before distributing complete answers. Keep original responses and correct in another colour. D is for teachers only.'))
 s.p(T('兩組共同目標15–20分鐘：需知3–4、研究情境與公平比較4–5、量度計算及作圖5–6、分析與整合3–4、保存及核對約1分鐘。須試教核對實際負荷；不是所有學生必定完成的保證。若核對需較長時間，兩組採同一安排並記錄。','Shared target: 15–20 minutes: notes 3–4, context and fair comparison 4–5, measurement/calculation/graph 5–6, analysis/integration 3–4, saving/checking about 1 minute. Pilot the workload; completion by every pupil is not guaranteed. If checking takes longer, apply the same arrangement to both groups and record it.'))
 s.p(T('教師只澄清頁序、圈選、讀尺位置與單位；首次答案保存前不講授概念或提示正確選項。記錄支援、未完成項目及實際用時。VL仍先探究，提交後才顯示學習重點與反思，反思提交後才解鎖學生PDF。','Clarify procedure, choices, scale position and units only. Before saving first responses, give no concept teaching or correct choices. Record support, unfinished items and time. VL learning points and reflection remain locked until investigation submission; student PDF unlocks after reflection submission.'))
 s.h(T('逐題配對、題型與共同內容','Item alignment, format and shared content'))
 mapping=[['WS','VL',T('題型／共同概念技能','Format / shared concept or skill')],['1','controlPlan',T('開放設計：同距帶葉／不帶葉公平比較','Open design: equal-distance leaf comparison')],['2','variableQuiz',T('各列七完整選項複選：IV／DV／CV','Seven full choices per row: IV/DV/CV')],['3','assumptionChoices',T('原四選項複選：公平比較前提','Original four choices: fair-comparison assumptions')],['4','measurements 0/10/20/30',T('16讀尺：觀察與記錄','16 scale readings: observation and recording')],['5','rate-A/B/C/D',T('四計算：按自己的初末數據','Four calculations: own initial/final readings')],['6','graph.points / connected',T('四標點、A/B/C趨勢：溝通','Four points and A/B/C trend: communication')],['7','claim',T('原句圈選：光照趨勢','Original sentence choice: light trend')],['8','leafComparison',T('原句圈選：B/D比較','Original sentence choice: B/D comparison')],['9','leafConclusion',T('原句圈選：葉片作用','Original sentence choice: leaf function')],['10','limitations',T('原三選項：間接指標','Original three choices: indirect indicator')],['11','reflection (Q3)',T('整合解釋：蒸騰及拉力因果','Integrated explanation: transpiration and pull')]]
 s.table(mapping,[1,5,12])
 s.p(T('紙本沒有原始初步觀察、實驗前預測及理由、自由繪畫／文字裝置方案、移尺、模擬計時及確認操作的作答機會；不把讀靜態圖當完整實作。紙本前置概念使預測表現與VL不同，故不另造「修訂假說」題。','Paper has no response opportunity for original preliminary observation, pre-experiment prediction/reason, free apparatus drawing/written plan, ruler dragging, simulation timing or confirmation actions. Static scale reading is not a full practical investigation. Concept-first study changes prediction opportunities, so no hypothesis-revision question is invented.'))
 s.h(T('紙本分項評分與缺答','Paper item marking and omissions'))
 s.p(T('各項分開記錄，不合成可與VL32分直接換算的活動總分。缺答填0；尚未評留白；沒有作答機會填不適用。計分依概念與因果，接受等義表述，不數關鍵字。','Record item scores separately; do not convert a paper activity total to the VL 32-point scale. Mark an omitted asked item 0, an unmarked item blank, and an unasked item not applicable. Judge concepts and causes; accept equivalent wording rather than counting keywords.'))
 s.table([[T('題','Item'),T('最高分','Max'),T('給分及部分分','Credit and partial credit')],['1','1',T('同燈距、帶葉／不帶葉、其他條件相同，三者齊得1。','1 for equal lamp distance, leaves versus no leaves, and other conditions equal.')],['2','4',T('IV全對1；DV全對1；CV每正確0.4，誤選IV/DV則CV為0。','IV exact 1; DV exact 1; CV 0.4 each; including IV/DV in CV gives CV 0.')],['3','1',T('只選第1、2、4項得1；不另給部分分。','Select only choices 1, 2 and 4: 1; otherwise 0.')],['4','2',T('2×正確數÷16，容差±0.25cm，保留兩位小數。','2 × correct/16; tolerance ±0.25 cm; two decimals.')],['5','2',T('每組0.5；自己的末−初再÷30，±0.0051cm/min。','0.5 each; own (final−initial)/30; ±0.0051 cm/min.')],['6','2',T('各點0.375，按自己的計算標點；A/B/C正確趨勢0.5，D不連入。','0.375 per point against own calculations; correct A/B/C trend 0.5, D separate.')],['7–10','2',T('7、8、9、10各0.5；8依學生B/D計算比較。','0.5 each for 7, 8, 9, 10; judge 8 against own B/D rates.')],['11','8',T('依以下Q3機制規準，不要求修訂原假說。','Use the Q3 mechanism rubric below; no hypothesis revision required.')]], [1.5,1.5,15])
 s.h(T('完整參考答案及可接受表述','Full answers and acceptable equivalents'))
 s.p(T('1：','1: ')+m['reference']['texts']['control'])
 s.p(T('2：IV光強度；DV紅色水跡上升高度／平均上移速度；CV為餘下五項。3：第1、2、4項。','2: IV light intensity; DV height/average upward speed of red trace; CV the remaining five factors. 3: choices 1, 2, 4.'))
 s.table([[T('時點 min','Time min'),'A','B','C','D']]+[[str(t)]+[f"{m['experiment']['model'][id][i]:.1f}" for id in 'ABCD'] for i,t in enumerate([0,10,20,30])],[3.6]*5)
 s.p(T('5：A 0.40、B 0.25、C 0.15、D 0.05 cm/min。接受依學生自己讀數正確計算，量度誤差不重複扣計算及作圖分。','5: A 0.40, B 0.25, C 0.15, D 0.05 cm/min. Accept correct calculation from own readings; do not penalise the same scale error again in calculation or plotting.'))
 s.p(T('6：A(1200,0.40)、B(300,0.25)、C(133,0.15)、D(300,0.05)，D獨立。7增加；8快（按學生數據）；9有助水分向上運輸；10第一項。','6: A(1200,0.40), B(300,0.25), C(133,0.15), D(300,0.05), with D separate. 7 increase; 8 faster (follow own data); 9 help water move upwards; 10 first choice.'))
 s.p('11: '+T(REF['answer'],REF['answer_en']),concept=True)
 s.p(T('VL圖點沿用X為指定lux、Y與自己的速度差小於0.00051；紙本依可辨的標點位置及其計算判斷，不把手繪定位當數位輸入精度，須試教校準。','VL plotting retains exact assigned lux and Y within 0.00051 of own calculated speed. Judge paper points by their legible plotted position and own calculations; handwritten position is not digital input precision and requires piloting.'))
 s.h(T('Q3最後題：八分規準','Q3 final item: eight-point rubric'))
 s.table([[T('領域','Domain'),T('兩個獨立給分點（各1分）','Two independent points (1 each)')],[T('蒸騰與氣孔','Transpiration / stomata'),T('水膜蒸發進入氣室；水汽沿濃度梯度經氣孔擴散。','Water films evaporate into air spaces; vapour diffuses down a concentration gradient through stomata.')],[T('木質部及拉力','Xylem / pull'),T('失水令水勢下降、木質部補水；移走導管水形成拉力、向上運輸。','Loss lowers water potential and xylem replenishes water; removal creates pull and upward transport.')],[T('光強度','Light intensity'),T('其他條件相同，強光通常促氣孔開啟；連結蒸騰與水分運輸加快。','Other conditions equal, stronger light favours stomatal opening; connect to faster transpiration/water transport.')],[T('葉片與比較','Leaves / comparison'),T('帶葉比同距不帶葉水跡較快；葉片提供蒸騰主要表面、有助牽引水分。','Faster trace with leaves at equal distance; leaves provide the main transpiring surface and help draw water.')]], [4.5,13.5])
 s.p(T('每領域0／1／2分。不另加逐組證據、限制或修訂原假說要求。矛盾因果不得該點；接受「水汽濃度較高向較低擴散」等義表述。','Each domain: 0/1/2. Do not require group-by-group citations, limitations or hypothesis revision. A contradictory cause earns no credit for that point. Accept equivalents such as diffusion from higher to lower vapour concentration.'))
 s.h(T('Excel、歷史版本與研究使用','Excel, historical versions and research use'))
 s.p(T('現行匯出仍為SPS24＋反思8＝32，僅供VL內部回饋。Q3反思改用葉片欄，舊修訂假說欄不適用；Q1–2維持舊規準，葉片欄不適用。Q3「量度記錄品質」改為人工0–2，不以完成四輪自動當能力分；歷史四輪分保留。其他人工欄為觀察、假說及理由、對照、裝置、表達、蒸騰、木質部、光照、適用的最後領域。','Current export retains SPS24 + reflection8 = 32 for within-VL feedback. Q3 uses the leaves field; the old revision field is not applicable. Q1–2 retain their old rubric and have no leaves field. Q3 measurement-record quality is manual 0–2, rather than automatically treating completion as ability; historical round scores are retained. Other manual fields cover observation, hypothesis/reason, control, setup, communication, transpiration, xylem, light and the applicable final domain.'))
 s.p(T('人工欄整數驗證0至上限。公式再檢查數值型、上下限及整數，拒絕貼入負數、超限、小數、文字；空白待評，0已評零分，不適用不阻擋總分。所有適用人工欄有效且反思已提交，總分才顯示；色彩隨有效分數更新。','Manual inputs use whole-number validation from 0 to the maximum. Formula guards also reject pasted negatives, out-of-range values, fractions and text. Blank means pending; 0 means marked zero; not applicable does not block totals. Totals require valid applicable manual marks and a submitted reflection; colours follow valid scores.'))
 s.p(T('Q3量度品質：裝置／時點、單位與記錄可追溯1分；水面零點和一致讀尺方法1分。依記錄與方案判斷，資料不足待評。合理原始預測即使不獲結果支持亦可得滿分。操作事件、點擊、速度、完成率及用時不直接當SPS能力分。','Q3 record quality: traceable setup/time labels, units and records 1; water-level zero and consistent scale method 1. Judge records and plan; leave pending if evidence is insufficient. A reasonable original prediction can earn full credit even if unsupported. Events, clicks, speed, completion and time are not direct SPS scores.'))
 s.p(T('原始／首次／最後答案、快照、裝置圖、事件、研究ID及雲端佇列不改寫。學生PDF不顯示教師分數。舊下載Excel不會自動更新；重新下載也不會合併舊檔人工分。共同測驗及評分者一致性尚需另行驗證，WS與VL不是相同作答機會或已驗證同一量表。','Original/first/final answers, snapshots, setup images, events, research IDs and cloud queues remain intact. Student PDFs exclude teacher scores. Previously downloaded Excel files do not update automatically; a new download does not merge old manual marks. Common tests and marker agreement require separate validation; WS and VL do not offer identical response opportunities or an established common scale.'))
 s.h(T('課程、科學限制與版本','Curriculum, scientific limits and version'))
 s.p(T('依repo現有課本第11.1節頁11-3至11-8的引用及學習重點核對。未附原課本或官方syllabus，不能宣稱已獨立核實官方要求。目標：辨識公平比較變量；讀尺、計算及標點；區分間接證據與機制；解釋蒸發、擴散、滲透、木質部運輸及蒸騰拉力。','Checked against learning points and the existing repository citation to textbook section 11.1, pp.11-3–11-8. The original textbook and official syllabus were not supplied; official requirements are not independently verified. Objectives: fair-comparison variables; scale reading, calculation and plotting; indirect evidence versus mechanism; evaporation, diffusion, osmosis, xylem transport and transpiration pull.'))
 s.p(T('燈距改變可能升溫，真實實驗須監測溫度；模型固定25°C。紅色水跡速度只屬間接指標。無葉比較不能單獨證明氣孔機制；三個光強度點不足外推精確曲線。水分沿木質部受拉力上運，不是主動泵水或韌皮部上運。','Lamp distance can affect temperature; monitor it in a real experiment; the model fixes 25°C. Trace speed is indirect. Leaf removal alone cannot prove a stomatal mechanism, and three light levels do not justify an exact extrapolated curve. Xylem water is pulled upwards, not actively pumped or transported upwards in phloem.'))
 s.p(T('本版取代舊A–C分冊及完整教師套裝；網站只保留五類下載，每語學生PDF／Word、答案PDF／Word及D PDF。生成來源worksheet.py，模型／選項／提示由source.js從實際VL讀取。','This edition replaces A–C booklets and the combined teacher pack. Five download types per language: student PDF/Word, answers PDF/Word, D PDF. worksheet.py generates documents; source.js reads the actual VL model, choices and hints.'))
 path=s.save('D_'+lang+'.docx');return path

if __name__=='__main__':
 for lang in ['zh','en']:
  for ans in [False,True]:print(worksheet(lang,ans))
  print(teacher(lang))
