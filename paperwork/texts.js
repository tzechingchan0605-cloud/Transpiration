'use strict';
const labels={
 names:{zh:{A:'自學概念與示例',B:'練習與獨立應用',C:'核對答案與修正',D:'教師指引、答案及評分',all:'完整教師列印套裝'},en:{A:'Concepts and worked examples',B:'Practice and independent application',C:'Check answers and correct mistakes',D:'Teacher guide, answers and scoring',all:'Complete teacher print pack'}},
 identity:['姓名：________________　班別及學號：________________','Name: ____________________   Class and student number: ____________________'],
 circle:['請圈出句內括號的答案，每組只選一項。','Circle one answer in each set of brackets.'],
 revision:['保留首次答案，核對後在 C 另寫修正，不擦去原答案。','Keep first answers; write corrections in C after checking, without erasing first answers.'],
 static:['圖像來自目前 VL 的同一教學模型，並非實測。尺零點固定在液面，每小格 0.5 cm；自行讀尺，圖旁沒有另列答案。','Images use the same teaching model as the VL, not real measurements. Zero stays at the liquid surface; each small division is 0.5 cm. Read the rulers yourself; no answers are listed beside them.'],
 learning:['A 從開始即可閱讀，做 B 時亦可翻閱。完成並保留 B 答案後才領取 C。','Read A from the start and while doing B. Receive C only after completing and keeping answers in B.'],
 teacher:['只供教師，請勿派給學生。','For teachers only. Do not give this part to students.'],
 key:['核對答案','Check answers'],
 rubric:['分項回饋準則（不作兩組成效總分）','Feedback by area (not a group-effectiveness total)'],
 draft:['準則是待試教及評分者校準的初稿，不是已驗證的研究量表。','This guide is a draft for piloting and rater calibration, not a validated instrument.'],
 paperMarking:['紙本讀尺不等同完整實驗操作能力。紙本分數不可與 VL 原始預測、操作或完成分數直接比較；成效另用兩組共同測驗。','Paper ruler reading is not full experimental operation. Do not directly compare paper scores with VL original prediction, operation or completion scores; evaluate effectiveness through separate common tests.'],
 steps:[
 ['研究條件：實驗組使用 IBL＋VL；比較組無課前講授、不操作 VL，只靠 A、B、C 自學。兩組各 15–20 分鐘，以 18 分鐘為共同目標，須試教確認實際用時。','Study conditions: experimental group uses IBL plus VL; comparison group has no prior lecture, does not operate VL, and learns from A, B and C alone. Allow 15–20 minutes per group, targeting 18 minutes for both; pilot actual time.'],
 ['0–4 分鐘：同時派 A、B。學生自行閱讀 A 的概念、葉片圖及已解說示例。核心教學從開始即可閱讀。','Minutes 0–4: give out A and B together. Students read concepts, the leaf diagram and worked examples in A themselves. Core teaching is available from the start.'],
 ['4–7 分鐘：B1–B2 有提示練習、指定裝置及公平比較。可繼續翻閱 A，不要求從零設計。','Minutes 4–7: B1–B2 supported practice, specified setups and fair comparisons. Students may consult A; no design from scratch.'],
 ['7–15 分鐘：B3–B5 讀尺、計算、標點及分析。先保存 B 的首次答案再派 C；未完成按共同時限記錄未完成，不直接當零分。','Minutes 7–15: B3–B5 ruler reading, calculation, plotting and analysis. Save first B answers before giving C; record unfinished work within the common time limit, not automatic zero.'],
 ['15–18 分鐘：用 C 核對、引用數據解釋及修正。A 仍可閱讀。D 與完整套裝只供教師，不能在開始混派 C、D。','Minutes 15–18: check with C, explain using data and correct errors. A remains available. D and the full pack are teacher-only; do not distribute C or D at the start.'],
 ['教師只澄清頁序、圈選、單位及讀尺位置等程序；不作課前講授，不在 B 完成前提示答案。記錄澄清及實際用時；C 使用統一答案回饋。','Teachers clarify procedures such as page order, circling, units or ruler position only. No prior lecture or answer hints before B is completed. Record clarifications and actual time; use the standard C key for feedback.'],
 ['兩組共同概念、技能目標及模型資料，相近時間；教學次序與互動方式不同。學習後評估假說不能冒充原始假說表現。C 包含完整核對答案，D 提供配對及分項回饋。','Both groups share concepts, skill goals and model data with similar time; teaching order and interaction differ. Hypothesis evaluation after teaching is not original hypothesis performance. C provides the full key; D supplies alignment and feedback.'],
 ['成效另用研究方案的共同 SPSAI／CKT 等測驗，不以活動總分代替。研究者須核對測驗版本、語言、評分者、15–20 分鐘可行性及灰階印刷。','Use separate common tests such as proposal SPSAI / CKT for effectiveness, not activity totals. Researchers must confirm test versions, language, raters, feasibility within 15–20 minutes, and grayscale printing.']
 ]
};
if(typeof module!=='undefined')module.exports={labels};
if(typeof window!=='undefined')window.VL2PaperLabels=labels;
