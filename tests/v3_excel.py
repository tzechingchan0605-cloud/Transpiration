"""Recalculate real exported XLSX formulas in LibreOffice, including pasted invalids."""
from pathlib import Path
import subprocess,os
from openpyxl import load_workbook
p=Path('/tmp/vl2-v3.xlsx');w=load_workbook(p);s=w['教師評分']
# 12 current rows followed by two genuine legacy rows, produced through the UI exporter.
assert s['AC2'].value=='不適用' and s['AD2'].value in (None,'')
assert s['AC14'].value in (None,'') and s['AD14'].value=='不適用'
manual={r:{} for r in range(2,16)}
for v in s.data_validations.dataValidation:
 for rng in v.sqref.ranges:
  for row in s.iter_rows(min_row=rng.min_row,max_row=rng.max_row,min_col=rng.min_col,max_col=rng.max_col):
   for cell in row:cell.value=int(v.formula2);manual[cell.row][cell.column_letter]=int(v.formula2)
assert len(manual[2])==10 and len(manual[14])==9
cases={2:None,3:0,4:-1,5:3,6:1.5,7:'2',8:'text',9:None,10:2,11:2,12:2,13:2}
# row2 leave a genuinely blank applicable mark; row3 explicit zero.
for row,value in cases.items():s[f'Z{row}']=value
# row9 valid, but a different required input was deleted.
s['Z9']=2;s['P9']=None
# Legacy irrelevant field is not a gate even if somebody pastes arbitrary text.
s['AD14']='ignored legacy N/A';s['AC14']=2
# Current irrelevant history field is not a gate.
s['AC10']='ignored current N/A'
# Legacy old revision remains an actual gate.
s['AC15']=None
work=Path('/tmp/vl2-xlsx-recalc');work.mkdir(exist_ok=True);src=work/'input.xlsx';w.save(src)
out=work/'recalculated';out.mkdir(exist_ok=True)
result=subprocess.run([os.environ.get('SOFFICE_PATH','soffice'),'-env:UserInstallation=file:///tmp/vl2-v3-lo','--headless','--convert-to','xlsx','--outdir',str(out),str(src)],capture_output=True,text=True,timeout=60)
assert result.returncode==0, 'Install LibreOffice Calc for XLSX recalculation: '+result.stdout+result.stderr
z=load_workbook(out/'input.xlsx',data_only=True)['教師評分']
# New leaf column AD, knowledge AE, overall AF, marking AG.
for row in [2,4,5,6,7,8,9,13,15]:
 assert not isinstance(z[f'AF{row}'].value,(int,float)),(row,z[f'AF{row}'].value)
 assert z[f'AG{row}'].value!='評分完成'
assert z['AE3'].value==6 and z['AF3'].value==30
for row in [10,11,12,14]:assert z[f'AF{row}'].value==32,(row,z[f'AF{row}'].value)
assert z['AG10'].value=='評分完成' and z['AG14'].value=='評分完成'
# A pasted fractional mark must not receive a valid full/partial conditional colour.
assert any('MOD(' in rule.formula[0] and 'IFERROR' in rule.formula[0] for cf,rules in s.conditional_formatting._cf_rules.items() if str(cf.sqref)=='Z6' for rule in rules)
assert len(w.sheetnames)==6
print('PASS: real LibreOffice XLSX calculation: blank vs 0; negative/high/fraction/text/numeric text rejected; all applicable gates; mixed legacy/current N/A ignored; historical revision retained; complete totals 32; conditional colours guarded')
