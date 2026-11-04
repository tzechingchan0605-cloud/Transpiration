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
    assert len(xml.xpath('//w:tbl',namespaces=ns))==3
    assert len(xml.xpath('//w:p',namespaces=ns))>40
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
    # No tiny visible text in document XML.
    assert all(int(x.get('{'+ns['w']+'}val'))>=22 for x in xml.xpath('//w:sz',namespaces=ns))
    if lang=='en':
     for q in src[lang]['conclusions']['questions']:
      assert not re.search('[\u3400-\u9fff]',re.sub(r'\([^()]*\)','',q['sentence'])),q['sentence']
   continue
  d=fitz.open(p);assert not d.is_encrypted
  if key!='D':assert len(d)==4,(lang,key,len(d))
  for page in d:
   assert abs(page.rect.width-595.28)<1 and abs(page.rect.height-841.89)<1
   spans=[s for b in page.get_text('dict')['blocks'] if 'lines' in b for l in b['lines'] for s in l['spans'] if s['text'].strip()]
   assert all(s['size']>=10.9 for s in spans),(p,[(s['text'],s['size']) for s in spans if s['size']<10.9])
   assert all(12<=s['bbox'][0]<=584 and s['bbox'][2]<=585 and s['bbox'][3]<=836 for s in spans),(p,'overflow')
  if key!='D':
   first=d[0];needle='姓名' if lang=='zh' else 'Name:';blocks=[b for b in first.get_text('blocks') if needle in b[4]];assert len(blocks)==1
   identity=blocks[0][4];assert ('班別' if lang=='zh' else 'Class:') in identity and ('學號' if lang=='zh' else 'No.:') in identity;assert len(identity.strip().splitlines())==1
   spans=[s for b in first.get_text('dict')['blocks'] if 'lines' in b for l in b['lines'] for s in l['spans']]
   assert any(s['color']==0xBC2927 and 'Bold' in s['font'] for s in spans)
   if key=='studentPDF':
    rules=[(i,dr) for i,page in enumerate(d) for dr in page.get_drawings() if dr.get('color') and all(abs(c-.2)<.01 for c in dr['color']) and dr.get('width',0)>=.9 and dr['rect'].width>500 and dr['rect'].height<2]
    positions=sorted(set((i,round(dr['rect'].y0,1)) for i,dr in rules))
    assert len(positions)==9,(lang,positions)
    for page in [0,3]:
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
