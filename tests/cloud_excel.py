import sys, openpyxl
w=openpyxl.load_workbook(sys.argv[1])
assert len(w.worksheets)==6
s=w.worksheets[0]
r=list(s.values)
assert s.max_row==4
assert sum(row[3]=='phone@example.com' for row in r[1:])==2
assert sum(row[3]=='desktop@example.com' for row in r[1:])==1
assert not any(row[3]=='tzechingchan0605@gmail.com' for row in r[1:])
assert any('離線修改保留' in row for row in r[1:])
assert any('原始理由' in row for row in r[1:])
assert sum(len(sheet._images) for sheet in w.worksheets)>0
score=w['教師評分']
assert score.data_validations.count==9
assert any(c.data_type=='f' for row in score for c in row)
assert any(c.fill.fgColor.rgb not in (None,'00000000','00FFFFFF') for row in s for c in row)
print('PASS: actual central XLSX has both devices, two same-email attempts, restored answers, original reason, images, six sheets, scoring formulas, validation and category fills.')
