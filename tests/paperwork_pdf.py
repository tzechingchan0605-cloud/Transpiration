"""Check real Word-rendered PDFs and editable OOXML in both languages."""
from pathlib import Path
import json,zipfile,re,hashlib
from lxml import etree as E
import fitz
root=Path(__file__).resolve().parents[1];m=json.loads((root/'paperwork/generated/manifest.json').read_text());src=json.loads((root/'paperwork/generated/source.json').read_text());ref=json.loads((root/'paperwork/reflection.json').read_text())
ns={'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
for lang in ['zh','en']:
 for key,f in m['languages'][lang]['files'].items():
  p=root/f['path'];data=p.read_bytes();assert hashlib.sha256(data).hexdigest()==f['sha256']
  if key.endswith('Word'):
   with zipfile.ZipFile(p) as z:
    assert z.testzip() is None
    xml=E.fromstring(z.read('word/document.xml'));text=''.join(xml.xpath('//w:t/text()',namespaces=ns))
    # Paragraphs, options, tables and answer lines remain actual Word elements.
    assert len(xml.xpath('//w:tbl',namespaces=ns))==5
    assert len(xml.xpath('//w:p',namespaces=ns))>40
    assert '□\u00a0' in text or '☑\u00a0' in text
    assert xml.xpath('//w:rPr/w:color[@w:val="BC2927"]',namespaces=ns)
    if key=='studentWord':
     borders=xml.xpath('//w:pBdr/w:bottom',namespaces=ns);assert len(borders)==9
     assert all(x.get('{'+ns['w']+'}color')=='333333' and x.get('{'+ns['w']+'}sz')=='8' for x in borders)
    # Shared candidate text/order, three complete occurrences; no deleted distractors.
    choices=src[lang]['variables']['choices']
    variable_text=''.join(xml.xpath('(//w:tbl)[1]//w:t/text()',namespaces=ns))
    for c in choices:assert variable_text.count(c['text'])==3,(lang,c['text'])
    for c in src[lang]['assumptions']['choices']:assert c['text'] in text
    assert src[lang]['assumptions']['reminder'] in text
    for h in src[lang]['control']['hints']:assert h in text
    assert text.index('1. '+('辨識主探究' if lang=='zh' else 'Identify variables')) < text.index('2. '+('選出公平比較' if lang=='zh' else 'Select the assumptions')) < text.index('3. '+('主探究' if lang=='zh' else 'Main investigation')) < text.index('4. '+('葉片的存在' if lang=='zh' else 'Does the presence of leaves'))
    assert src[lang]['reflection']['question'] in text
    if lang=='zh':
     assert '帶葉的裝置B的水跡平均上移速度比不帶葉的裝置D' in text
     assert '但無法代表葉片的蒸騰速率（即水分由氣孔散失的速度）' in text
     assert '下圖顯示3個帶葉裝置中植物木質部在不同時間點的吸水情況' in text
    main_table=xml.xpath('(//w:tbl)[2]',namespaces=ns)[0]
    assert len(main_table.xpath('./w:tr',namespaces=ns))==4 and len(main_table.xpath('./w:tr[1]/w:tc',namespaces=ns))==5
    assert ('時間(mins)' if lang=='zh' else 'Time (mins)') in ''.join(main_table.xpath('.//w:t/text()',namespaces=ns))
    if lang=='zh':
     assert not re.search(r'(?<!裝置)(?<![A-Za-z0-9])(?:A|B|C)(?![A-Za-z0-9])',text)
     assert '裝置A、裝置B、裝置C的植物的紅色水跡高度變化' in text
    # No tiny visible text in document XML.
    assert all(int(x.get('{'+ns['w']+'}val'))>=22 for x in xml.xpath('//w:sz',namespaces=ns))
    if lang=='en':
     assert 'A celery stalk is a petiole.' in text and 'setup A celery' not in text
     if key=='answersWord':assert 'leafy setup B' in text and 'leafless setup D' in text
     for q in src[lang]['conclusions']['questions']:
      assert not re.search('[\u3400-\u9fff]',re.sub(r'\([^()]*\)','',q['sentence'])),q['sentence']
   continue
  d=fitz.open(p);assert not d.is_encrypted
  if key!='D':assert len(d)==4,(lang,key,len(d))
  for page in d:
   assert abs(page.rect.width-595.28)<1 and abs(page.rect.height-841.89)<1
   spans=[s for b in page.get_text('dict')['blocks'] if 'lines' in b for l in b['lines'] for s in l['spans'] if s['text'].strip()]
   assert all(not ''.join(s['text'] for s in line['spans']).rstrip().endswith(('□','☑')) for block in page.get_text('dict')['blocks'] if 'lines' in block for line in block['lines']), (p,'orphan checkbox')
   assert all(s['size']>=10.9 for s in spans),(p,[(s['text'],s['size']) for s in spans if s['size']<10.9])
   assert all(12<=s['bbox'][0]<=584 and s['bbox'][2]<=585 and s['bbox'][3]<=836 for s in spans),(p,'overflow')
  if key!='D':
   main_image=next(b for b in d[1].get_text('dict')['blocks'] if b['type']==1)
   assert main_image['bbox'][2]-main_image['bbox'][0]>500 and main_image['bbox'][3]-main_image['bbox'][1]>170
   table_label='時間(mins)' if lang=='zh' else 'Time (mins)'
   main_table_blocks=[b for b in d[1].get_text('blocks') if table_label in b[4]]
   assert len(main_table_blocks)==1 and main_table_blocks[0][1]>=main_image['bbox'][3]-1
   target='葉片的存在' if lang=='zh' else 'presence of leaves'
   assert any(target in s['text'] and s['color']==0xBC2927 for block in d[2].get_text('dict')['blocks'] if 'lines' in block for line in block['lines'] for s in line['spans']), (p,'red leaves heading')
   first=d[0];needle='姓名' if lang=='zh' else 'Name:';blocks=[b for b in first.get_text('blocks') if needle in b[4]];assert len(blocks)==1
   identity=blocks[0][4];assert ('班別' if lang=='zh' else 'Class:') in identity and ('學號' if lang=='zh' else 'No.:') in identity;assert len(identity.strip().splitlines())==1
   spans=[s for b in first.get_text('dict')['blocks'] if 'lines' in b for l in b['lines'] for s in l['spans']]
   assert any(s['color']==0xBC2927 and 'Bold' in s['font'] for s in spans)
   if key=='studentPDF':
    rules=[(i,dr) for i,page in enumerate(d) for dr in page.get_drawings() if dr.get('color') and all(abs(c-.2)<.01 for c in dr['color']) and dr.get('width',0)>=.9 and dr['rect'].width>300 and dr['rect'].height<2]
    positions=sorted(set((i,round(dr['rect'].y0,1)) for i,dr in rules))
    assert len(positions)==9,(lang,positions)
    for page in [2,3]:
     ys=[y for i,y in positions if i==page]
     assert all(25<ys[k+1]-ys[k]<27 for k in range(len(ys)-1)),ys
   full=''.join(x.get_text() for x in d)
   assert ('修訂原始假說' not in full)
  for i,page in enumerate(d):
   dest=root/'work/review';dest.mkdir(parents=True,exist_ok=True);page.get_pixmap(matrix=fitz.Matrix(1.3,1.3)).save(dest/f'{lang}-{key}-{i+1}.png')
# The canonical VL and generator share the requested final question.
assert src['zh']['reflection']['question']==ref['question']
assert ref['question'] in (root/'app.js').read_text()
assert ref['answer'] in (root/'app.js').read_text()
print('PASS: four actual A4 Word-rendered pages per student/answer edition; real editable Word elements and exact original options/hints; >=11pt PDF text; red bold concepts; one-line identity; dark 1pt rules; ten valid files; versioned shared final question')

# Original native botanical geometry is preserved, not replaced by simplified art.
import sys
sys.path.insert(0,str(root/'paperwork'))
import native
for lang in ['zh','en']:
 ns2={'s':'http://www.w3.org/2000/svg'}
 raw=E.fromstring(src[lang]['native']['anatomy']['svg'].encode());printed=E.fromstring(native.anatomy(src[lang],lang).encode())
 assert raw.xpath('//@data-anatomy')==printed.xpath('//@data-anatomy')
 assert raw.xpath('//s:path/@d',namespaces=ns2)==printed.xpath('//s:path/@d',namespaces=ns2)
 markers=printed.xpath('//s:g[@class="process-marker"]/s:circle/@fill',namespaces=ns2)
 assert set(markers)=={'#'+c for c in native.COLOURS}
 reading=E.fromstring(native.readings(src[lang],lang).encode())
 y=reading.xpath('//s:rect[@class="dye-column"]/@y',namespaces=ns2)
 expected=[str(330-src[lang]['experiment']['model'][id][i]*18) for id in 'ABCD' for i in range(4) for _ in range(2)]
 assert list(map(float,y))==list(map(float,expected))
 assert len(y)==32 and sum('cm' in ''.join(e.itertext()) for e in reading.xpath('./s:svg/s:g/s:text',namespaces=ns2))==4
 print('PASS:',lang,'full native anatomy/path provenance, three matched step colours, 16 native xylem frames and cm labels')

# Current split-page print diagrams retain all 16 native frames and unclipped top scale labels.
for lang in ["zh","en"]:
 for ids in ["ABC","D"]:
  diagram=E.fromstring(native.compact_readings(src[lang],lang,ids).encode())
  assert len(diagram.xpath("//s:rect[@class='dye-column']",namespaces=ns2))==8*len(ids)
  rulers=diagram.xpath("./s:svg[s:g[@class='ruler']]",namespaces=ns2)
  assert len(rulers)==len(ids) and all(r.get("overflow")=="visible" for r in rulers)
  if ids=='ABC':
   text_labels=diagram.xpath('./s:text/text()',namespaces=ns2)
   assert text_labels.count('長度(cm)' if lang=='zh' else 'Length (cm)')==3
   assert text_labels.count('時間(mins)' if lang=='zh' else 'Time (mins)')==3
   assert all(('裝置' if lang=='zh' else 'Setup ')+id in text_labels for id in ids)
   assert all(float(frame.get('height'))>100 for frame in diagram.xpath('./s:svg[not(s:g[@class="ruler"])]',namespaces=ns2))
  else:assert sum("16 cm" in "".join(r.itertext()) for r in rulers)==len(ids)
print("PASS: current ABC and D native print frames, readable centimetre labels and unclipped ruler tops")

for lang in ['zh','en']:
 scene=E.fromstring(native.scene(src[lang],lang).encode());labels=scene.xpath('./s:text/text()',namespaces=ns2)
 assert ('觀察：' if lang=='zh' else 'Observation:') in labels
 assert ('實驗設計：' if lang=='zh' else 'Experimental design:') in labels
 assert scene.xpath('./s:path[@d="M204 0V128"]',namespaces=ns2)
 assert len(scene.xpath('./s:svg',namespaces=ns2))==5
 assert all(float(el.get('height'))>80 for el in scene.xpath('./s:svg',namespaces=ns2))
 anatomy=E.fromstring(native.anatomy(src[lang],lang).encode())
 assert anatomy.xpath('//s:g[@class="process-card"]/s:text/s:tspan[@dy="28"]',namespaces=ns2)
print('PASS: enlarged native rulers with per-setup axes; editable table below; explicit setup names; larger five-frame scene with group headings/divider; wider process-card leading')
