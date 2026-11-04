#!/usr/bin/env python3
"""WS2 canonical editable Word source. PDF is rendered from this exact DOCX."""
import json,re,sys,subprocess,os,hashlib
from pathlib import Path
from docx import Document
from docx.shared import Pt,Cm,RGBColor
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
import cairosvg
import native
ROOT=Path(__file__).resolve().parent; OUT=ROOT/'generated'; WORK=ROOT.parent/'work'/'paper-build';WORK.mkdir(parents=True,exist_ok=True)
SRC=json.loads((OUT/'source.json').read_text());REF=json.loads((ROOT/'reflection.json').read_text())
TEAL='206B73';RED='BC2927';BLUE='165CA5';FONT='Noto Sans CJK TC'
# Only pedagogical concepts are red; answers use blue separately.
TERMS=['蒸騰拉力','木質導管','水勢下降','水膜','氣室','蒸發','擴散','滲透','氣孔','葉柄','蒸騰','光強度','evaporates','diffuses','Osmosis','stomatal opening','transpiration pull','xylem vessels','xylem','water potential','water films','air spaces','evaporation','diffusion','osmosis','stomata','petiole','transpiration','light intensity']
def xml(tag,**attrs):
 e=OxmlElement(tag)
 for k,v in attrs.items():e.set(qn(k),str(v))
 return e
class CellWriter:
 def __init__(self,cell,width):self.cell=cell;self.width=width;self.first=True
 def add_paragraph(self,text='',style=None):
  if self.first:
   p=self.cell.paragraphs[0];p.text=text
   if style:p.style=style
   self.first=False;return p
  return self.cell.add_paragraph(text,style)
 def add_table(self,rows,cols):return self.cell.add_table(rows,cols)
class Sheet:
 def __init__(self,lang,answers=False,teacher=False):
  self.pending_break=False;self.lang=lang;self.answers=answers;self.teacher=teacher;self.m=SRC[lang];self.d=Document();sec=self.d.sections[0]
  sec.page_width=Cm(21);sec.page_height=Cm(29.7);sec.top_margin=Cm(1.25);sec.bottom_margin=Cm(1.25);sec.left_margin=Cm(1.5);sec.right_margin=Cm(1.5)
  sec.header_distance=Cm(.5);sec.footer_distance=Cm(.5)
  st=self.d.styles['Normal'];st.font.name=FONT;st.font.size=Pt(12);st.element.rPr.rFonts.set(qn('w:eastAsia'),FONT)
  st.paragraph_format.line_spacing=1.5;st.paragraph_format.space_after=Pt(4)
  for sn in ['Heading 1','Heading 2','Heading 3']:
   sty=self.d.styles[sn];sty.font.name=FONT;sty.font.size=Pt(15 if sn=='Heading 1' else 12);sty.font.color.rgb=RGBColor.from_string(TEAL);sty.paragraph_format.space_before=Pt(5);sty.paragraph_format.space_after=Pt(3)
  hp=sec.header.paragraphs[0];self.runs(hp,self.t('生物科｜蒸騰與水分運輸','Biology | Transpiration and water transport')+(self.t('｜參考答案',' | Reference answers') if answers else ''),11)
  fp=sec.footer.paragraphs[0];fp.alignment=2;self.runs(fp,self.t('工作紙二｜','Worksheet 2 | '),11);fp._p.append(xml('w:fldSimple',**{'w:instr':'PAGE'}))
 def t(self,z,e):return z if self.lang=='zh' else e
 def runs(self,p,text,size=12,colour=None,bold=False,concept=False):
  text=str(text).replace('□ ','□\u00a0').replace('☑ ','☑\u00a0')
  pieces=re.split('('+'|'.join(map(re.escape,sorted(TERMS,key=len,reverse=True)))+')',str(text)) if concept else [str(text)]
  for piece in pieces:
   if not piece:continue
   r=p.add_run(piece);r.font.name=FONT;r._element.get_or_add_rPr().rFonts.set(qn('w:eastAsia'),FONT);r.font.size=Pt(size);r.bold=bold or (concept and piece in TERMS)
   if colour or (concept and piece in TERMS):r.font.color.rgb=RGBColor.from_string(RED if concept and piece in TERMS else colour)
  return p
 def p(self,text='',size=12,colour=None,bold=False,concept=False,after=3):
  p=self.d.add_paragraph();self.apply_break(p);p.paragraph_format.space_after=Pt(after);p.paragraph_format.line_spacing=1.15;self.runs(p,text,size,colour,bold,concept);return p
 def h(self,text,level=2):
  p=self.d.add_paragraph(text,'Heading '+str(level));self.apply_break(p)
  if text.startswith(('部分','Part ')):
   for r in p.runs:r.font.size=Pt(13)
  return p
 def hint(self,text):
  p=self.p(text,11,'607D85');p.paragraph_format.line_spacing=Pt(16.5)
 def answer(self,text,lines=2):
  if self.answers:
   p=self.p(self.t('參考答案：','Reference answer: ')+text,12,BLUE,True);p.paragraph_format.line_spacing=1.0
  else:
   for _ in range(lines):
    p=self.p('',after=0);p.paragraph_format.line_spacing=Pt(23);p.paragraph_format.space_before=Pt(0);p.add_run(' ');pr=p._p.get_or_add_pPr();b=xml('w:pBdr');b.append(xml('w:bottom',**{'w:val':'single','w:sz':'8','w:color':'333333','w:space':'1'}));b.append(xml('w:between',**{'w:val':'single','w:sz':'8','w:color':'333333','w:space':'1'}));pr.append(b)
 def table(self,rows,widths=None,mark=None):
  if rows[0][0] in ['題','Item']:rows=[rows[0]]+sorted(rows[1:],key=lambda row:int(row[0].split('–')[0].split(',')[0]))
  self.table_numeric=rows[0][0] in ['時間（min）','Time (min)','A','min']
  t=self.d.add_table(rows=0,cols=len(rows[0]));t.autofit=False
  if widths:
   for c,w in zip(t.columns,widths):c.width=Cm(w)
  for i,row in enumerate(rows):
   cells=t.add_row().cells
   if widths:
    for c,w in zip(cells,widths):c.width=Cm(w)
   for j,txt in enumerate(row):
    p=cells[j].paragraphs[0];p.paragraph_format.space_after=Pt(1);p.paragraph_format.space_before=Pt(0);p.paragraph_format.line_spacing=Pt(20)
    if self.table_numeric:p.paragraph_format.line_spacing=Pt(16);p.paragraph_format.space_before=Pt(0);p.paragraph_format.space_after=Pt(0)
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
  p=self.p('',after=0);p.alignment=1;p.paragraph_format.line_spacing=1;p.add_run().add_picture(str(path),width=Cm(width))
 def apply_break(self,p):
  if self.pending_break:p.paragraph_format.page_break_before=True;self.pending_break=False
 def page(self):self.pending_break=True
 def save(self,name):
  path=OUT/name;self.d.save(path);return path

def svg(w,h,body):return f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}pt" height="{h}pt" viewBox="0 0 {w} {h}"><rect width="{w}" height="{h}" rx="5" fill="#F4F8F8"/>{body}</svg>'
def txt(x,y,s,size=11,col='#206B73',anchor='start'):return f'<text x="{x}" y="{y}" font-family="Noto Sans CJK TC" font-size="{size}" fill="{col}" text-anchor="{anchor}">{s}</text>'
def anatomy(s):s.pic(native.anatomy(s.m,s.lang),'native-anatomy-'+s.lang,16.8)
def scene(s):s.pic(native.scene(s.m,s.lang),'native-scene-'+s.lang)
def apparatus(s):s.pic(native.apparatus(s.m,s.lang),'native-apparatus-'+s.lang)
def rulers(s):s.pic(native.readings(s.m,s.lang),'native-readings-'+s.lang)
def graph(s):
 body='';x0=63;y0=135;pw=420;ph=88
 for i in range(7):
  x=x0+i*pw/6;body+=f'<path d="M{x} 47V{y0}" stroke="#CDD9DB" stroke-width=".5"/>'+txt(x,y0+16,str(i*200),11,'#333','middle')
 for i in range(6):
  y=y0-i*ph/5;body+=f'<path d="M{x0} {y}H483" stroke="#CDD9DB" stroke-width=".5"/>'+txt(x0-5,y+4,f'{i/10:.1f}',11,'#333','end')
 body+=txt(255,16,s.t('光強度與紅色水跡平均上移速度','Light intensity and average upward speed of the red water trace'),11,anchor='middle')
 label=s.t(['紅色水跡頂的平均上移速度','（cm/min）'],['Average upward speed of','the top of the red water trace','(cm/min)'])
 body+='<text x="25" y="91" transform="rotate(-90 25 91)" font-family="Noto Sans CJK TC" font-size="11" text-anchor="middle" fill="#206B73">'+''.join(f'<tspan x="25" dy="{(-6 if len(label)==2 else -13) if i==0 else 13}">{line}</tspan>' for i,line in enumerate(label))+'</text>'
 body+=txt(273,172,s.t('光強度（lux）','Light intensity (lux)'),11,anchor='middle')
 if s.answers:
  coords=[]
  for c in s.m['experiment']['setups']:
   id=c['id'];rate=float(s.m['reference']['rates'][id]);x=x0+c['light']/1200*pw;y=y0-rate/.5*ph
   body+=f'<circle cx="{x}" cy="{y}" r="3" fill="#165CA5"/>'+txt(x+5,y-4,id,11,'#165CA5')
   if id!='D':coords.append((c['light'],x,y))
  coords.sort();(_,xa,ya),(_,xb,yb),(_,xc,yc)=coords;body+=f'<path d="M{xa} {ya} C{xa+15} {ya-18},{xb-15} {yb+4},{xb} {yb} S{xc-90} {yc+2},{xc} {yc}" fill="none" stroke="#165CA5" stroke-width="1.3"/>'
 s.pic(svg(510,180,body),f'graph-{s.lang}-{s.answers}')

def worksheet(lang,answers):
 s=Sheet(lang,answers);m=s.m;T=s.t
 s.h(T('工作紙二：蒸騰與水分運輸','Worksheet 2: Transpiration and water transport'),1)
 s.p(T('姓名：________________　班別：________　學號：________','Name: ________________   Class: ________   No.: ________'))
 s.h(T('課題需知','Topic notes'))
 anatomy(s)
 for n,(z,e) in enumerate([
  ('蒸騰：葉肉表面水膜蒸發，水汽經氣孔擴散到大氣。','Transpiration: water films evaporate; vapour diffuses through stomata.'),
  ('失水與補水：葉肉細胞水勢下降，藉滲透吸收水分。','Water replacement: mesophyll water potential falls; osmosis draws in water.'),
  ('水分上運：木質導管內的水被抽出，形成蒸騰拉力。','Upward transport: removing xylem water creates transpiration pull.')]):
  p=s.p(str(n+1)+'. '+T(z,e),colour=native.COLOURS[n],bold=True,after=1);p.paragraph_format.line_spacing=1.5
 s.p(T('供水充足、其他條件相同時，較強光照通常促進氣孔張開。西芹長柄是葉柄。','With adequate water and other conditions equal, stronger light favours stomatal opening. A celery stalk is a petiole.'),concept=True)
 s.h(T('部分 1｜主探究：光強度與水分運輸','Part 1 | Light intensity and water transport'))
 s.p(T('園藝小組把帶葉西芹插入紅色水中。他們想知道：光照和葉片會否影響水分運輸？','The gardening club asks: do light and leaves affect upward water transport?'))
 scene(s)
 s.page()
 s.h(T('1. 辨識主探究 A／B／C 的實驗變量','1. Identify variables for the main A/B/C investigation'))
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
   p=cell.paragraphs[0];p.paragraph_format.line_spacing=Pt(20);p.paragraph_format.space_after=Pt(1)
   for j,c in enumerate(m['variables']['choices']):
    ok=c['id'] in m['reference']['variables'][g['id']];s.runs(p,('☑ ' if ok else '□ ')+c['text']+'  ',12,BLUE if ok else None,ok)
 s.h(T('2. 選出公平比較所需的前提（可選多於一項）','2. Select the assumptions for a fair comparison (select all that apply)'))
 s.hint(m['assumptions']['reminder'])
 for c in m['assumptions']['choices']:
  ok=next(x['valid'] for x in m['reference']['assumptions'] if x['id']==c['id']);s.p(('☑ ' if answers and ok else '□ ')+c['text'],colour=BLUE if answers and ok else None,bold=answers and ok,after=1)
 s.h(T('3. 主探究：A／B／C 量度記錄','3. Main investigation: A/B/C readings'))
 s.p(T('下圖顯示3個帶葉裝置中植物木質部在不同時間點的吸水情況，請讀取各時間點紅色水跡頂端的高度，並取至一位小數（cm）。','Read each red-trace height at each time to one decimal place (cm).'))
 outer=s.d.add_table(rows=1,cols=2);outer.autofit=False;outer.columns[0].width=Cm(13);outer.columns[1].width=Cm(5)
 doc=s.d;s.d=CellWriter(outer.cell(0,0),13);s.pic(native.compact_readings(m,lang,'ABC'),'main-readings-'+lang,12.7)
 s.d=CellWriter(outer.cell(0,1),5)
 rows=[['min','A','B','C']]+[[str(t)]+[f"{m['experiment']['model'][id][i]:.1f}" if answers else '' for id in 'ABC'] for i,t in enumerate([0,10,20,30])]
 s.table(rows,[1.25]*4,mark={(i,j) for i in range(1,5) for j in range(1,4)} if answers else None);s.d=doc
 s.page()
 s.h(T('部分 2｜延伸探究：葉片與水分運輸','Part 2 | Leaves and water transport'))
 s.h(T('4. 葉片的存在會否影響吸水及水分向上運輸？','4. Do leaves affect water uptake and upward water transport?'))
 outer=s.d.add_table(rows=1,cols=2);outer.autofit=False;outer.columns[0].width=Cm(13.5);outer.columns[1].width=Cm(4.5)
 doc=s.d;s.d=CellWriter(outer.cell(0,0),13.5)
 s.p(m['control']['question'])
 for h in m['control']['hints']:s.hint(h)
 s.answer(T(m['reference']['texts']['control'],'Compare leafy B with leafless D at the same 20 cm lamp distance, keeping other conditions equal.'),2)
 s.d=CellWriter(outer.cell(0,1),4.5);s.pic(native.compact_readings(m,lang,'D'),'extension-readings-'+lang,4.23);s.d=doc
 s.h(T('5. 延伸量度記錄','5. Extension readings'))
 s.p(T('B 沿用第3題的讀數，只讀取及記錄不帶葉 D 的高度（一位小數，cm）。','Reuse B from item 3. Read and record only leafless D (one decimal place, cm).'))
 s.table([['min','0','10','20','30'],['D']+[f"{m['experiment']['model']['D'][i]:.1f}" if answers else '' for i in range(4)]],[3.6]*5,mark={(1,i) for i in range(1,5)} if answers else None)
 s.h(T('6. 計算紅色水跡頂的平均上移速度','6. Calculate the average upward speed of the top of the red water trace'))
 s.p(T('（30 min讀數 − 0 min讀數）÷ 30；結果保留兩位小數（cm/min）。','(30 min reading − 0 min reading) ÷ 30; give two decimal places (cm/min).'))
 s.table([['A','B','C','D'],[m['reference']['rates'][id] if answers else '' for id in 'ABCD']],[4.5]*4,mark={(1,i) for i in range(4)} if answers else None)
 s.h(T('7. 光強度與紅色水跡上移速度','7. Light intensity and water-trace speed'))
 s.p(T('根據自己的計算標出A／B／C／D；以平滑趨勢線連接帶葉A／B／C，D獨立標示。','Plot A–D from your calculations. Join A–C with a smooth trend line; keep D separate.'))
 s.p('A: 1200 lux　B: 300 lux　C: 133 lux　D: 300 lux',11,after=0)
 graph(s)
 s.page()
 s.h(T('部分 2｜實驗結果與分析（續）','Part 2 | Results and analysis (continued)'))
 # Retain the native four analysis questions as sentence choices, with no reason fields.
 for i,q in enumerate(m['conclusions']['questions']):
  s.h(str(8+i)+'. '+re.sub(r'^\d+\.\s*','',q['heading']))
  text=q['sentence'];opts=q['options'];correct={'claim':'increase','leafComparison':'faster','leafConclusion':'promotes','limitations':'indirect'}[q['id']]
  if q['id']=='limitations':
   p=s.p(text.replace('__________',''),after=0);p.paragraph_format.line_spacing=1.0
   for c in opts:
    p=s.p(('☑ ' if answers and c['id']==correct else '□ ')+c['text'],colour=BLUE if answers and c['id']==correct else None,bold=answers and c['id']==correct,after=0);p.paragraph_format.line_spacing=1.0
  else:
   p=s.p(after=0);p.paragraph_format.line_spacing=1.0;pre,post=text.split('__________');s.runs(p,pre+'（')
   for j,c in enumerate(opts):
    if j:s.runs(p,' / ')
    s.runs(p,c['text'],12,BLUE if answers and c['id']==correct else None,answers and c['id']==correct)
   s.runs(p,'）'+post)
 s.h(T('部分 3｜整合解釋','Part 3 | Integrated explanation'))
 s.p('12. '+m['reflection']['question'])
 s.answer(T(REF['answer'], 'Other conditions equal, stronger light usually opens stomata, increasing transpiration and water transport. Water evaporates from mesophyll water films into air spaces; vapour diffuses down its concentration gradient through stomata: transpiration. Loss lowers mesophyll water potential; xylem replenishes water. Removal creates transpiration pull, drawing water up xylem vessels. Leaves provide the main transpiring surface, so leafy B has a faster trace than leafless D at equal distance.'),7)
 return s.save(f'WS2_{"answers" if answers else "student"}_{lang}.docx')

def teacher(lang):
 s=Sheet(lang,teacher=True);T=s.t;m=s.m
 s.h(T('D · 教師指引、配對及評分','D · Teacher guidance, alignment and marking'),1)
 s.p('WS2 v5 · VL2-Q4 · VL2-R4')
 s.p(T('v5依使用者四頁要求採用VL原生完整構造圖及剖視素材；橙色1a／1b、紫色2a／2b、藍色3與需知三段配對。變量與前提為1、2；對照移至延伸探究第4題；最後題逐字取VL同一來源，英文保留VL原有詞彙支援。','v5 keeps four pages and uses the full native VL anatomy and cutaway artwork. Orange 1a/1b, purple 2a/2b and blue 3 match the three note paragraphs. Variables and assumptions are items 1 and 2; control moves to extension item 4. The final question is taken verbatim from the VL source, including existing English vocabulary support.'))
 s.p(T('Q4分兩次量度流程：主探究A／B／C先設計及記錄12個讀數；然後才問B／D延伸對照設計。B沿用主探究，延伸動畫只新增D四個讀數。計算、作圖及結論保持原任務。SPS24＋反思8不變；主探究裝置方案只評三個帶葉裝置，延伸對照獨立評1分，B不重複計量度分。舊Q3及更早版本按原規準。','Q4 collects A/B/C first (12 readings), then asks the B/D extension control design. B is reused; extension animation adds only four D readings. Calculation, graph and conclusions retain their tasks. SPS24 + reflection8 is unchanged. Score only three leafy setups for the main plan; score extension control separately (1). Do not count B twice. Q3 and earlier retain their rubric.'))
 s.p(T('主探究只有光強度一個自變量；A／B／C是不同光強度的比較，無須另設無光組。延伸探究只有葉片有無一個自變量；同距不帶葉D作帶葉B的對照。B為共用比較裝置，並非重新收集的一份獨立重複數據。','The main investigation varies only light intensity; A/B/C compare light levels, without requiring an extra dark setup. The extension varies only leaf presence; leafless D is the equal-distance control for leafy B. B is shared comparison data, not an independent repeat.'))
 s.p(T('VL可從設計頁進入已開放的主探究，亦可從延伸探究返回查看主探究；延伸開始後主探究讀數只供查看，返回延伸時保留原時點及D讀數，不重設B或覆寫主探究快照。','The VL design page can reopen the unlocked main investigation. The extension can return to the saved main readings for review; once the extension begins, those readings are read-only. Returning preserves the extension time, D readings, reused B and the main snapshot.'))
 s.h(T('派發及共同時限','Distribution and shared time'))
 s.p(T('控制組沒有課前概念講授，不操作VL。開始派發完整學生版，課題需知全程可讀。完成首次答案後先收取／掃描保存，再派完整答案版；保留原答，用另一顏色修正。D只供教師。','The control group receives no prior concept lecture and does not operate the VL. Distribute the complete student worksheet at the start, with topic notes available throughout. Collect or scan first responses before distributing complete answers. Keep original responses and correct in another colour. D is for teachers only.'))
 s.p(T('兩組共同目標15–20分鐘：需知3–4、研究情境與公平比較4–5、量度計算及作圖5–6、分析與整合3–4、保存及核對約1分鐘。須試教核對實際負荷；不是所有學生必定完成的保證。若核對需較長時間，兩組採同一安排並記錄。','Shared target: 15–20 minutes: notes 3–4, context and fair comparison 4–5, measurement/calculation/graph 5–6, analysis/integration 3–4, saving/checking about 1 minute. Pilot the workload; completion by every pupil is not guaranteed. If checking takes longer, apply the same arrangement to both groups and record it.'))
 s.p(T('教師只澄清頁序、圈選、讀尺位置與單位；首次答案保存前不講授概念或提示正確選項。記錄支援、未完成項目及實際用時。VL仍先探究，提交後才顯示學習重點與反思，反思提交後才解鎖學生PDF。','Clarify procedure, choices, scale position and units only. Before saving first responses, give no concept teaching or correct choices. Record support, unfinished items and time. VL learning points and reflection remain locked until investigation submission; student PDF unlocks after reflection submission.'))
 s.h(T('逐題配對、題型與共同內容','Item alignment, format and shared content'))
 mapping=[['WS','VL',T('題型／共同概念技能','Format / shared concept or skill')],['4','controlPlan',T('開放設計：同距帶葉／不帶葉公平比較','Open design: equal-distance leaf comparison')],['1','variableQuiz',T('各列七完整選項複選：IV／DV／CV','Seven full choices per row: IV/DV/CV')],['2','assumptionChoices',T('原四選項複選：公平比較前提','Original four choices: fair-comparison assumptions')],['3,5','measurements 0/10/20/30',T('16讀尺：觀察與記錄','16 scale readings: observation and recording')],['6','rate-A/B/C/D',T('四計算：按自己的初末數據','Four calculations: own initial/final readings')],['7','graph.points / connected',T('四標點、A/B/C趨勢：溝通','Four points and A/B/C trend: communication')],['8','claim',T('原句圈選：光照趨勢','Original sentence choice: light trend')],['9','leafComparison',T('原句圈選：B/D比較','Original sentence choice: B/D comparison')],['10','leafConclusion',T('原句圈選：葉片作用','Original sentence choice: leaf function')],['11','limitations',T('原三選項：間接指標','Original three choices: indirect indicator')],['12','reflection (Q4)',T('整合解釋：蒸騰及拉力因果','Integrated explanation: transpiration and pull')]]
 mapping=[mapping[0]]+sorted(mapping[1:],key=lambda row:int(row[0].split(',')[0]))
 s.table(mapping,[1,5,12])
 s.p(T('紙本沒有原始初步觀察、實驗前預測及理由、自由繪畫／文字裝置方案、移尺、模擬計時及確認操作的作答機會；不把讀靜態圖當完整實作。紙本前置概念使預測表現與VL不同，故不另造「修訂假說」題。','Paper has no response opportunity for original preliminary observation, pre-experiment prediction/reason, free apparatus drawing/written plan, ruler dragging, simulation timing or confirmation actions. Static scale reading is not a full practical investigation. Concept-first study changes prediction opportunities, so no hypothesis-revision question is invented.'))
 s.h(T('紙本分項評分與缺答','Paper item marking and omissions'))
 s.p(T('各項分開記錄，不合成可與VL32分直接換算的活動總分。缺答填0；尚未評留白；沒有作答機會填不適用。計分依概念與因果，接受等義表述，不數關鍵字。','Record item scores separately; do not convert a paper activity total to the VL 32-point scale. Mark an omitted asked item 0, an unmarked item blank, and an unasked item not applicable. Judge concepts and causes; accept equivalent wording rather than counting keywords.'))
 s.table([[T('題','Item'),T('最高分','Max'),T('給分及部分分','Credit and partial credit')],['4','1',T('同燈距、帶葉／不帶葉、其他條件相同，三者齊得1。','1 for equal lamp distance, leaves versus no leaves, and other conditions equal.')],['1','4',T('IV全對1；DV全對1；CV每正確0.4，誤選IV/DV則CV為0。','IV exact 1; DV exact 1; CV 0.4 each; including IV/DV in CV gives CV 0.')],['2','1',T('只選第1、2、4項得1；不另給部分分。','Select only choices 1, 2 and 4: 1; otherwise 0.')],['3,5','2',T('2×正確數÷16，容差±0.25cm，保留兩位小數。','2 × correct/16; tolerance ±0.25 cm; two decimals.')],['6','2',T('每組0.5；自己的末−初再÷30，±0.0051cm/min。','0.5 each; own (final−initial)/30; ±0.0051 cm/min.')],['7','2',T('各點0.375，按自己的計算標點；A/B/C正確趨勢0.5，D不連入。','0.375 per point against own calculations; correct A/B/C trend 0.5, D separate.')],['8–11','2',T('8、9、10、11各0.5；9依學生B/D計算比較。','0.5 each for 8, 9, 10, 11; judge 9 against own B/D rates.')],['12','8',T('依以下Q3–4機制規準，不要求修訂原假說。','Use the Q3–4 mechanism rubric below; no hypothesis revision required.')]], [1.5,1.5,15])
 s.h(T('完整參考答案及可接受表述','Full answers and acceptable equivalents'))
 s.p(T('4：','4: ')+m['reference']['texts']['control'])
 s.p(T('1：IV光強度；DV紅色水跡上升高度／平均上移速度；CV為餘下五項。2：第1、2、4項。','1: IV light intensity; DV height/average upward speed of red trace; CV the remaining five factors. 2: choices 1, 2, 4.'))
 s.table([[T('時點 min','Time min'),'A','B','C','D']]+[[str(t)]+[f"{m['experiment']['model'][id][i]:.1f}" for id in 'ABCD'] for i,t in enumerate([0,10,20,30])],[3.6]*5)
 s.p(T('6：A 0.40、B 0.25、C 0.15、D 0.05 cm/min。接受依學生自己讀數正確計算，量度誤差不重複扣計算及作圖分。','6: A 0.40, B 0.25, C 0.15, D 0.05 cm/min. Accept correct calculation from own readings; do not penalise the same scale error again in calculation or plotting.'))
 s.p(T('7：A(1200,0.40)、B(300,0.25)、C(133,0.15)、D(300,0.05)，D獨立。8增加；9快（按學生數據）；10有助水分向上運輸；11第一項。','7: A(1200,0.40), B(300,0.25), C(133,0.15), D(300,0.05), with D separate. 8 increase; 9 faster (follow own data); 10 help water move upwards; 11 first choice.'))
 s.p('12: '+T(REF['answer'],REF['answer_en']),concept=True)
 s.p(T('VL圖點沿用X為指定lux、Y與自己的速度差小於0.00051；紙本依可辨的標點位置及其計算判斷，不把手繪定位當數位輸入精度，須試教校準。','VL plotting retains exact assigned lux and Y within 0.00051 of own calculated speed. Judge paper points by their legible plotted position and own calculations; handwritten position is not digital input precision and requires piloting.'))
 s.h(T('Q3–4最後題：八分規準','Q3–4 final item: eight-point rubric'))
 s.table([[T('領域','Domain'),T('兩個獨立給分點（各1分）','Two independent points (1 each)')],[T('蒸騰與氣孔','Transpiration / stomata'),T('水膜蒸發進入氣室；水汽沿濃度梯度經氣孔擴散。','Water films evaporate into air spaces; vapour diffuses down a concentration gradient through stomata.')],[T('木質部及拉力','Xylem / pull'),T('失水令水勢下降、木質部補水；移走導管水形成拉力、向上運輸。','Loss lowers water potential and xylem replenishes water; removal creates pull and upward transport.')],[T('光強度','Light intensity'),T('其他條件相同，強光通常促氣孔開啟；連結蒸騰與水分運輸加快。','Other conditions equal, stronger light favours stomatal opening; connect to faster transpiration/water transport.')],[T('葉片與比較','Leaves / comparison'),T('帶葉比同距不帶葉水跡較快；葉片提供蒸騰主要表面、有助牽引水分。','Faster trace with leaves at equal distance; leaves provide the main transpiring surface and help draw water.')]], [4.5,13.5])
 s.p(T('每領域0／1／2分。不另加逐組證據、限制或修訂原假說要求。矛盾因果不得該點；接受「水汽濃度較高向較低擴散」等義表述。','Each domain: 0/1/2. Do not require group-by-group citations, limitations or hypothesis revision. A contradictory cause earns no credit for that point. Accept equivalents such as diffusion from higher to lower vapour concentration.'))
 s.h(T('Excel、歷史版本與研究使用','Excel, historical versions and research use'))
 s.p(T('現行匯出仍為SPS24＋反思8＝32，僅供VL內部回饋。Q3–4反思改用葉片欄，舊修訂假說欄不適用；Q1–2維持舊規準，葉片欄不適用。Q3–4「量度記錄品質」改為人工0–2，不以完成四輪自動當能力分；歷史四輪分保留。其他人工欄為觀察、假說及理由、對照、裝置、表達、蒸騰、木質部、光照、適用的最後領域。','Current export retains SPS24 + reflection8 = 32 for within-VL feedback. Q3–4 uses the leaves field; the old revision field is not applicable. Q1–2 retain their old rubric and have no leaves field. Q3–4 measurement-record quality is manual 0–2, rather than automatically treating completion as ability; historical round scores are retained. Other manual fields cover observation, hypothesis/reason, control, setup, communication, transpiration, xylem, light and the applicable final domain.'))
 s.p(T('人工欄整數驗證0至上限。公式再檢查數值型、上下限及整數，拒絕貼入負數、超限、小數、文字；空白待評，0已評零分，不適用不阻擋總分。所有適用人工欄有效且反思已提交，總分才顯示；色彩隨有效分數更新。','Manual inputs use whole-number validation from 0 to the maximum. Formula guards also reject pasted negatives, out-of-range values, fractions and text. Blank means pending; 0 means marked zero; not applicable does not block totals. Totals require valid applicable manual marks and a submitted reflection; colours follow valid scores.'))
 s.p(T('Q3–4量度品質：裝置／時點、單位與記錄可追溯1分；水面零點和一致讀尺方法1分。依記錄與方案判斷，資料不足待評。合理原始預測即使不獲結果支持亦可得滿分。操作事件、點擊、速度、完成率及用時不直接當SPS能力分。','Q3–4 record quality: traceable setup/time labels, units and records 1; water-level zero and consistent scale method 1. Judge records and plan; leave pending if evidence is insufficient. A reasonable original prediction can earn full credit even if unsupported. Events, clicks, speed, completion and time are not direct SPS scores.'))
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
