# WS2：蒸騰與水分運輸 · v5

本版依使用者提供的最終 WS1 學生／答案 PDF，及 Digestive-System 現行 `a9ea711` 的題型與下載安排重製。承接青綠標題、紅色粗體概念詞、先讀需知、變量逐列剔選、前提複選、對照開放題、原句選擇及最後整合解釋；不沿用脂質概念、數據、題數或活動總分。

每語各五類教材：完整學生 PDF／Word、完整連答案 PDF／Word、D 教師 PDF。學生及答案各四頁 A4；D 獨立。面板跟隨介面語言，僅三種 PDF 有預覽，Word 直接下載。切換語言清除舊預覽並取消舊語言請求結果。沒有中文代用英文的 fallback。舊 A/B/C 和完整教師套裝已移除。

控制組開始可讀需知、無課前概念講授、不操作 VL；保存首次作答後才派答案，保留原答以另一顏色修正。共同目標15–20分鐘，須試教，不保證人人完成。派發、支援、完整答案、分項評分及科學限制均在D。

## 四頁設計

1. 標題、姓名同列、VL完整葉內部構造圖與三色步驟；三段文字與圖上1a/1b、2a/2b、3採相同橙／紫／藍色。研究情境及A/B/C使用VL原生植物與裝置SVG，沒有另畫簡化植物。
2. 按WS1共通題型次序：1變量、2前提，3主探究讀數；4延伸對照，5只記錄D。每列完整七選項、原四假設及逐字提示保留。
3. 16讀尺以VL原生葉柄剖視及量尺幾何構成，保留雙水跡、漸層及原生模型刻度；A–D組名不含cm，cm在最高刻度旁；數字表留白。計算標題指紅色水跡頂；作圖附四組lux，提供置中圖題及兩軸題。
4. 原四項分析選擇及整合解釋。最後題直接取VL共用題幹，中英文連原有詞彙支援逐字相同。

使用者確認必須維持四頁，允許原圖縮小；完整構造圖保留全部原生構造和連線，以高解像度印刷，原生圖內標籤隨圖縮放。沒有以新簡化構造圖代替。學生版不另放原圖的技術性「非按比例」圖注；實驗模型與科學限制列於D。

正文與選項12pt、提示11pt。版面改參考WS1實際Word樣式：概念段落1.5倍、一般題幹1.15倍；長選項與答案採較緊密的題目段落，變量表固定20pt，避免四頁以外孤頁。數值表保持可填寫格；作答線#333333、1pt、26pt。部分標題13pt，僅略大於題目。

## 單一來源與重建

`source.js`只讀canonical DOM及`VL2InquiryContent()`，不讀學生value/storage。`native.py`從VL原生SVG作印刷排版及標籤調整，保留植物、細胞、木質部、水跡與刻度幾何；`worksheet.py`以同一雙語來源產生可編輯DOCX，LibreOffice實際開啟後轉PDF，確保Word/PDF內容與頁序一致。`reflection.json`保存雙語最終題／答案；修改時須同步`app.js`和翻譯，測試檢核一致性。生成器不改寫學生資料或呼叫正式雲端。

依賴：Node20+、Playwright1.62.1、Chromium、Python3.12、LibreOffice Writer（重算XLSX測試另需Calc）、Noto Sans CJK TC、libcairo2。支援`CHROMIUM_PATH`／`SOFFICE_PATH`。在需額外網路權限的sandbox中，以環境支援的網路權限執行本機測試伺服器。

```sh
npm install --no-save --package-lock=false playwright@1.62.1
python -m pip install -r paperwork/requirements.txt
node paperwork/build.cjs
node paperwork/build.cjs --check
node tests/paperwork.cjs
python tests/paperwork_pdf.py
node tests/split.cjs
node tests/v3.cjs
python tests/v3_excel.py
node tests/language.cjs
```

`manifest.json`含兩語五檔的bytes、MIME及SHA-256；來源快照和實際HTML載入來源的fingerprint拒絕過時檔案。重建可能因Office/PDF時間戳而改變bytes，manifest跟隨實際bytes更新；不宣稱跨環境逐位元相同。

## 題目與規準版本

新探究`VL2-Q4`／`VL2-R4`。最後反思保留8分：蒸騰／氣孔2、木質部／蒸騰拉力2、光強度2、葉片與同距比較2。按獨立概念因果給分，不數關鍵字；不再要求修訂原始假說。歷史Q1–2原規準保留，只在歷史報告／歷史rubric使用。

新Excel逐列識別版本，歷史修訂欄／新葉片欄按版本標不適用。Q3量度記錄品質人工0–2取代四輪完成自動分，避免把完成率直接作能力分；其他SPS架構保留24分。讀數、計算、圖點以合理原容差與自己的上游數據檢核，避免重複扣錯。人工欄有整數驗證及公式守門，貼入負數、超限、小數或文字不得顯示有效總分；空白待評、0已評、不適用不阻擋。

原始／首次／最後答案、研究ID、事件、裝置圖、快照、舊模型及雲端佇列保留。學生PDF不顯示教師能力分。紙本與VL作答機會不同，不直接換算活動總分或宣稱同一量表。舊下載Excel不會自動更新，新檔不合併舊人工分。

課程與研究安排見[教學大綱](../SYLLABUS.md)，配對見[繁中](ALIGNMENT.zh.md)／[英文](ALIGNMENT.en.md)。原課本／官方syllabus未在本次提供，只能核對repo既有引用與學習重點，不宣稱外部官方要求或效度證據。


Q4／R4 分拆探究：主探究只設計及量度三個帶葉裝置 A／B／C（光強度為唯一IV）；完成12個讀數後才呈現 B／D 延伸探究的對照設計。延伸以葉片有無為唯一IV，B沿用並鎖定主探究讀數，動畫顯示B／D，只新增D四個讀數。兩部分完成後才開放原有計算、作圖、分析及結論。無須替主探究另加無光組；延伸D為帶葉B的同距無葉對照。B不是獨立重複實驗。

Q4/R4 separates two investigations. Design and measure leafy A/B/C first, varying light intensity only (12 readings). Next answer the extension control-design question, varying leaf presence only. Replay B/D, retaining locked main-investigation B and recording only four D readings. Complete both before the unchanged calculation, graph and analysis tasks. No extra dark setup is required for the light-level comparison; leafless D controls the equal-distance B/D comparison. B is shared data, not an independent replicate. Main snapshot, extension initial control response and stage-tagged events are retained; the Excel data sheet identifies reused B and extension D. SPS24 + reflection8 remains32; Q3 and older records keep their historical design rubrics.
