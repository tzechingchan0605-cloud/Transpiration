"""Check workbooks exported by the real split-flow learner test."""
import json
from openpyxl import load_workbook
for lang in ['zh','en']:
 w=load_workbook('/tmp/vl2-split-'+lang+'.xlsx');s=w['教師評分'];d=list(w['量度計算與圖點'].values)[1:]
 assert len(d)==16 and len({(r[2],r[3])for r in d})==16
 b=[r for r in d if r[2]==30 and r[3]=='裝置B'][0]
 assert b[7:9]==('7.4','7.5') and b[-1]=='主探究；延伸沿用'
 assert all(r[-1]=='延伸新增' for r in d if r[3]=='裝置D')
 assert s['F2'].value==2 and s['AH2'].value=='VL2-Q4' and s['AI2'].value=='VL2-R4'
 assert s.data_validations.count==10 and s['AC2'].value=='不適用'
 events=[json.loads(r[-1])for r in list(w['操作事件紀錄'].values)[1:]]
 assert len([e for e in events if e['type']=='measurements_recorded'])==8
 snap=next(e['snapshot']for e in events if e['type']=='main_investigation_completed')
 assert snap['30']['firstValues']['B']=='7.4' and snap['30']['values']['B']=='7.5'
 assert all(e.get('investigation')for e in events)
 print('PASS',lang,'actual Q4 XLSX: 16 unique readings; B provenance and first/final/main snapshot; extension D; full accuracy credit without double B; ten applicable validations; stage-tagged events')
