"""Validate the actual PDFs (text, embedded fonts, geometry and writing rules)."""
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
        assert compact(value) in compact(text), (context,'missing content',value)

counts={'A':3,'B':4,'C':2,'D':8,'all':17}
for lang in ['zh','en']:
    m=sources[lang]
    for part,file in manifest['languages'][lang]['files'].items():
        pdf=root/file['path'];assert hashlib.sha256(pdf.read_bytes()).hexdigest()==file['sha256']
        doc=fitz.open(pdf);assert len(doc)==file['pages']==counts[part]
        all_text='\n'.join(p.get_text() for p in doc)
        assert '\ufffd' not in all_text
        for i,page in enumerate(doc):
            text=page.get_text();layout=file['layout'][i];context=(lang,part,i+1)
            assert abs(page.rect.width-595.28)<1 and abs(page.rect.height-841.89)<1
            identity=layout['part'] in ['A','C'] and layout['page']==1
            assert bool(re.search(r'姓名\s*:|Name\s*:',unicodedata.normalize('NFKC',text)))==identity,(context,'identity location')
            assert all(n==2 for n in layout['writingLines'])
            # Read the PDF drawing primitives, not just HTML, for actual ruled lines.
            lines=[]
            for draw in page.get_drawings():
                fill=draw.get('fill')
                if fill and all(abs(c-.6)<.015 for c in fill):
                    for item in draw['items']:
                        if item[0]=='re' and item[1].width>100 and item[1].height<1.5:
                            lines.append(item[1])
            assert len(lines)==2*len(layout['writingLines']),(context,'actual PDF writing lines',len(lines),layout['writingLines'])
            for block in page.get_text('dict')['blocks']:
                for line in block.get('lines',[]):
                    for span in line['spans']:
                        x0,y0,x1,y1=span['bbox']
                        assert x0>=-1 and y0>=-1 and x1<=page.rect.width+1 and y1<=page.rect.height+1,(context,'text outside page',span)
            if layout['part']=='A' and layout['page']==1:
                require_text(text,[m['observation']['label'],m['observation']['hint'],m['context']['caption'],m['context']['note'],m['context']['question']]+m['context']['paragraphs'],context)
            if layout['part']=='A' and layout['page']==2:
                require_text(text,[m['hypothesis']['heading'],m['hypothesis']['reason'],m['hypothesis']['hint'],m['variables']['instruction']]+[o['text'] for o in m['hypothesis']['options']]+[o['text'] for o in m['variables']['choices']],context)
                assert layout['circles']==1
            if layout['part']=='A' and layout['page']==3:
                require_text(text,[m['assumptions']['heading'],m['assumptions']['reminder'],m['assumptions']['instruction'],m['control']['heading'],m['control']['question'],m['design']['heading'],m['design']['reminder'],m['design']['instruction'],m['design']['written'],m['design']['hint']]+m['control']['hints']+[o['text'] for o in m['assumptions']['choices']],context)
                assert layout['writingLines']==[2,2]
            if layout['part']=='B' and layout['page']==1:
                require_text(text,[m['experiment']['heading'],m['experiment']['instruction'],m['experiment']['conditions'],m['experiment']['timing'],m['experiment']['dataHeading'],m['experiment']['dataHint']]+m['experiment']['dataHeadings'],context)
                assert layout['liquidSurfaces']==4
            if layout['part']=='B' and layout['page']==2:
                require_text(text,m['experiment']['ruler'],context);assert layout['liquidSurfaces']==8
            if layout['part']=='B' and layout['page']==3:
                require_text(text,[m['calculation']['heading'],m['calculation']['instruction'],m['calculation']['formula']],context)
                assert layout['liquidSurfaces']==4
            if layout['part']=='B' and layout['page']==4:
                require_text(text,[m['conclusions']['heading'],m['graph']['heading'],m['graph']['labels']['x'],m['graph']['labels']['y'],m['graph']['instruction'],m['graph']['legend']]+[q['heading'] for q in m['conclusions']['questions']]+[o['text'] for q in m['conclusions']['questions'] for o in q['options']],context)
                assert layout['circles']==4
            if layout['part']=='C' and layout['page']==1:
                require_text(text,[m['learning']['heading'],m['learning']['limit']]+[piece.strip() for piece in re.split(r'<[^>]*>',m['learning']['points']) if piece.strip()]+m['learning']['caption']+[c['text'] for group in m['learning']['processes'] for c in group['cards']],context)
                require_text(text,re.findall(r'<text\b[^>]*>(.*?)</text>',m['learning']['diagram'],re.S),context)
            if layout['part']=='C' and layout['page']==2:
                require_text(text,[m['reflection']['heading'],m['reflection']['question']],context);assert layout['writingLines']==[2]
            if part!='all':
                page.get_pixmap(matrix=fitz.Matrix(1.25,1.25)).save(review/f'{lang}-{part}-{i+1}.png')
                if part in ['B','C']:
                    page.get_pixmap(matrix=fitz.Matrix(1.25,1.25),colorspace=fitz.csGRAY).save(review/f'{lang}-{part}-{i+1}-gray.png')
        if part in ['A','B','C']:
            assert not re.search(r'SPS|參考答案|評分準則|最高分|Full credit',all_text), (lang,part,'teacher material leaked')
            assert not re.search(r'tzechingchan|@gmail|隔離學生|教師示範',all_text)
            assert not re.search(r'乳化|脂肪酶|膽汁|bile|lipase',all_text,re.I)
            assert '✓' not in all_text and '✕' not in all_text
        if part=='D':
            for row in m['reference']['rubric']:
                require_text(all_text,row,(lang,part,'shared rubric'))
        if lang=='en':
            assert set(re.findall(r'[\u3400-\u9fff]+',all_text))<=approved,(part,'unapproved Chinese',set(re.findall(r'[\u3400-\u9fff]+',all_text))-approved)
        fonts={font for p in doc for font in p.get_fonts()}
        assert fonts
        for font in fonts:
            if font[2]=='Type3':
                obj=doc.xref_object(font[0]);assert '/CharProcs' in obj and '/ToUnicode' in obj,(lang,part,'Type3 glyphs or Unicode mapping missing')
                refs=re.findall(r'(\d+) 0 R',doc.xref_get_key(font[0],'CharProcs')[1]);assert refs and all(doc.xref_is_stream(int(ref)) and doc.xref_stream(int(ref)) for ref in refs)
            else:
                assert doc.extract_font(font[0])[3],(lang,part,'font program not embedded')
        print(f'PASS: {lang}/{part} actual {len(doc)} pages, all shared text, two-line vectors, identity placement, embedded fonts and bounds')

assert sources['zh']['experiment']['model']=={'A':[0,4,8,12],'B':[0,2.5,5,7.5],'C':[0,1.5,3,4.5],'D':[0,.5,1,1.5]}
assert manifest['languages']['zh']['ranges']=={'A':[1,3],'B':[4,7],'C':[8,9],'D':[10,17]}
print('PASS: data model and staged page ranges; color/grayscale renders:',review)
