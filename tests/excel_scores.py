"""Inspect the real UI-exported XLSX; formula recalculation cases are in v3_excel.py."""
from zipfile import ZipFile
from xml.etree import ElementTree as ET
from openpyxl import load_workbook
p='/tmp/vl2-records.xlsx'
with ZipFile(p) as z:
 assert z.testzip() is None
 for n in z.namelist():
  if n.endswith(('.xml','.rels')):ET.fromstring(z.read(n))
 assert any(n.startswith('xl/media/') for n in z.namelist())
w=load_workbook(p);s=w['教師評分'];a=w['學生探究答案']
assert len(w.sheetnames)==6 and len(w['裝置設計圖']._images)==1
assert len(s.data_validations.dataValidation)==10
assert a['B2'].value=='陳小明'
assert a['M2'].font.color.rgb=='FF00834A'
assert a['S2'].font.color.rgb=='FFC03030'
assert a['H2'].font.color.rgb=='FF173E34'
assert len(a.conditional_formatting)==8
h={c.value:c.column_letter for c in s[1]}
assert any('葉片' in x for x in h) and any('歷史反思' in x for x in h)
assert s['AC2'].value=='不適用'
assert any(c.value=='VL2-Q3' for c in s[2])
assert all('IFERROR' in s[cell].value and 'MOD(' in s[cell].value for cell in ['G2','O2','R2','X2'])
assert all(v.type=='whole' and v.formula1=='0' for v in s.data_validations.dataValidation)
assert w.calculation.fullCalcOnLoad and w.calculation.forceFullCalc
print('PASS: actual XLSX six sheets, image, colours, ten current manual inputs, validation, formula guards and version metadata')
