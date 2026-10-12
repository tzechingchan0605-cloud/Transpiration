"""Rebuild the licensed HK font subset from all material source characters."""
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools import subset
root=Path(__file__).resolve().parents[1]
characters=set(chr(i) for i in range(32,127))
for file in list(root.glob('*.js'))+list(root.glob('*.html'))+list((root/'paperwork').glob('*.js'))+list((root/'paperwork').glob('*.cjs')):
    characters.update(file.read_text())
font=TTFont('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',fontNumber=4,recalcTimestamp=False)
options=subset.Options();options.recalc_timestamp=False;options.layout_features=['*']
subsetter=subset.Subsetter(options=options);subsetter.populate(unicodes=[ord(c) for c in characters]);subsetter.subset(font)
font.save(root/'paperwork/fonts/NotoSansHK-paper.otf')
print('Built Noto Sans CJK HK subset with',len(font.getBestCmap()),'characters')
