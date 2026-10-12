'use strict';
// Paper administration only. Questions, options, data and rubric come from VL2.
const labels={
  names:{zh:{A:'情境與原始探究設計',B:'實驗資料、分析與結論',C:'學習重點及反思',D:'教師指引、參考答案及評分準則',all:'完整教師列印套裝'},en:{A:'Context and original design',B:'Data, analysis and conclusions',C:'Key learning points and reflection',D:'Teacher guide, answers and scoring guide',all:'Complete teacher print pack'}},
  identity:['姓名：________________　班別及學號：________________','Name: ____________________   Class and student number: ____________________'],
  circle:['請圈出句內括號的答案，每組只選一項。','Circle one answer in each set of brackets in the sentence.'],
  original:['保存原始設計後才派 B；學生保留 A 副本供反思參閱。','Save the original design before giving out B. Students keep a copy of A for reflection.'],
  revision:['如有修訂，保留首次答案，並在以下兩行另記修訂。','If you revise an answer, keep the first answer and write the change on the two lines below.'],
  static:['讀取靜態圖中的量尺，自行記錄讀數；這些圖來自目前 VL 的同一教學模型。','Read the rulers in the static images and record your own readings. These images use the same teaching model as the current VL.'],
  numeric:['請自行填寫；不要把圖中的結果當作實測蒸騰速率。','Complete the entries yourself. Do not treat the images as direct measurements of transpiration rate.'],
  learning:['原探究答案固定後才派發 C。','Give out C only after the original investigation answers are fixed.'],
  reflect:['參閱 A 冊的原始假說及理由，不必憑記憶重寫。','Refer to the original hypothesis and reason in A. You do not need to rewrite them from memory.'],
  teacher:['只供教師，請勿派給學生。','For teachers only. Do not give this part to students.'],
  guide:['派發與證據保存程序','Distribution and evidence preservation'],
  key:['參考答案','Reference answers'],
  rubric:['評分準則','Scoring guide'],
  draft:['活動評分準則為待研究者校準的初稿，並非已驗證的研究量表。','The activity scoring guide is a draft for researcher calibration, not a validated research instrument.'],
  paperMarking:['共用準則中的「自動」指 VL Excel；紙本答案由教師按相同準則批改，不會自動辨識手寫內容。','Automatic scoring in the shared guide refers to VL Excel. Teachers mark paper answers using the same criteria; handwriting is not read automatically.'],
  pending:['人工評分空白為待評，與 0 分不同。六項 SPS 共 24 分，新知識共 8 分。','Blank teacher scores mean awaiting marking, not zero. The six SPS areas total 24 points; new knowledge totals 8.'],
  steps:[
    ['本工作紙按 proposal 4.1 及 4.3.2 提供相同情境、概念、題幹及靜態資料；活動在正式授課前進行。每週工作紙與正式 10 題 SPSAI、4 題 CKT 前後測分開。','Following proposal 4.1 and 4.3.2, these worksheets use the same scenarios, concepts, prompts and static data, before formal teaching. Keep weekly worksheets separate from the formal 10-item SPSAI and 4-item CKT pre- and post-tests.'],
    ['先派 A，保存原始觀察、假說、理由、變量、前提及裝置設計；保留可供學生反思參閱的副本。','Give out A first. Save the original observation, hypothesis, reason, variables, assumptions and setup design. Keep a copy students can consult during reflection.'],
    ['原始設計保存後才派 B。以同一四裝置、四時間點的靜態圖取代互動；讀數、計算、圖表及結論由學生完成。','Give out B after saving the original design. Static images replace interaction for the same four setups and four times. Students complete the readings, calculations, graph and conclusions.'],
    ['保存首次讀數；修訂另記，讓原答案保持可讀。固定原探究答案後才派 C，不預先揭示學習重點。','Keep first readings legible and record revisions separately. Give out C only after the original investigation answers are fixed; do not reveal the learning points earlier.'],
    ['學生參閱 A 的原始假說及理由，在 C 完成相同反思。D 及完整套裝只供教師，分冊派發。','Students consult their original hypothesis and reason in A and complete the same reflection in C. D and the full pack are for teachers only; distribute the parts separately.'],
    ['兩組使用相同情境、問題、提示、資料、語言及可用時間。靜態閱讀與數位操作是處理方式差異，不能把紙本完成率當作操作能力。','Use the same situation, questions, hints, data, language and available time for both groups. Static reading and digital interaction are different treatments; paper completion is not a measure of operating skill.'],
    ['目前 VL2 沒有延伸探究，紙本不加入額外題目。正式研究前後測與本次活動工作紙分開。','The current VL2 has no extension investigation; the paper does not add one. Keep formal research pre- and post-tests separate from these activity worksheets.'],
    ['正式派發前試印 B 和 C 的灰階圖，確認水面、紅色水跡、量尺及科學標籤可讀。用時、點擊及完成率不直接換算 SPS 分數。','Test-print B and C in grayscale before use. Check liquid surfaces, water traces, rulers and scientific labels. Time, clicks and completion rate do not directly become SPS scores.']
  ]
};
if(typeof module!=='undefined')module.exports={labels};
if(typeof window!=='undefined')window.VL2PaperLabels=labels;
