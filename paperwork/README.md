# WS2：蒸騰與水分運輸 · v3

本版依使用者提供的最終 WS1 學生／答案 PDF，及 Digestive-System 現行 `a9ea711` 的題型與下載安排重製。承接青綠標題、紅色粗體概念詞、先讀需知、變量逐列剔選、前提複選、對照開放題、原句選擇及最後整合解釋；不沿用脂質概念、數據、題數或活動總分。

每語各五類教材：完整學生 PDF／Word、完整連答案 PDF／Word、D 教師 PDF。學生及答案各四頁 A4；D 獨立。面板跟隨介面語言，僅三種 PDF 有預覽，Word 直接下載。切換語言清除舊預覽並取消舊語言請求結果。沒有中文代用英文的 fallback。舊 A/B/C 和完整教師套裝已移除。

控制組開始可讀需知、無課前概念講授、不操作 VL；保存首次作答後才派答案，保留原答以另一顏色修正。共同目標15–20分鐘，須試教，不保證人人完成。派發、支援、完整答案、分項評分及科學限制均在D。

## 四頁設計

1. 標題、姓名同列、兩組概念與流程圖、研究情境、原對照題及兩個逐字提示。
2. 三列完整七候選因素、原四項假設及逐字定義、A/B/C/D裝置、必要固定條件。
3. 原模型0/10/20/30 min的16項靜態刻度、讀數表、四組平均速度及空圖。數據留白；尺圖以同組並列四時點，零點對齊水面。半厘米小刻度不預印讀數。
4. 原四項分析選擇，最後整合解釋；不加理由欄、逐組證據要求、限制長答或修訂假說要求。

每列IV/DV/CV完整候選文字、順序及多選規則均由實際VL讀取，英文選項／提示包含VL原有已批准中文詞彙支援。正文及選項12pt、提示11pt，正文及表格行距18pt，答線#333333、1pt、26pt。重繪圖文字11pt以上，原始SVG保存在生成工作目錄；PDF/Word內圖為高解像度原創圖示，非網站截圖；整頁及正文不轉成圖。

## 單一來源與重建

`source.js`只讀canonical DOM及`VL2InquiryContent()`，不讀學生value/storage。`worksheet.py`以同一雙語來源產生可編輯DOCX，LibreOffice實際開啟後轉PDF，確保Word/PDF內容與頁序一致。`reflection.json`保存雙語最終題／答案；修改時須同步`app.js`和翻譯，測試檢核一致性。生成器不改寫學生資料或呼叫正式雲端。

依賴：Node20+、Playwright1.62.1、Chromium、Python3.12、LibreOffice Writer、Noto Sans CJK TC、libcairo2。支援`CHROMIUM_PATH`／`SOFFICE_PATH`。在需額外網路權限的sandbox中，以環境支援的網路權限執行本機測試伺服器。

```sh
npm install --no-save --package-lock=false playwright@1.62.1
python -m pip install -r paperwork/requirements.txt
node paperwork/build.cjs
node paperwork/build.cjs --check
node tests/paperwork.cjs
python tests/paperwork_pdf.py
node tests/v3.cjs
python tests/v3_excel.py
node tests/language.cjs
```

`manifest.json`含兩語五檔的bytes、MIME及SHA-256；來源快照和實際HTML載入來源的fingerprint拒絕過時檔案。重建可能因Office/PDF時間戳而改變bytes，manifest跟隨實際bytes更新；不宣稱跨環境逐位元相同。

## 題目與規準版本

新探究`VL2-Q3`／`VL2-R3`。最後反思保留8分：蒸騰／氣孔2、木質部／蒸騰拉力2、光強度2、葉片與同距比較2。按獨立概念因果給分，不數關鍵字；不再要求修訂原始假說。歷史Q1–2原規準保留，只在歷史報告／歷史rubric使用。

新Excel逐列識別版本，歷史修訂欄／新葉片欄按版本標不適用。Q3量度記錄品質人工0–2取代四輪完成自動分，避免把完成率直接作能力分；其他SPS架構保留24分。讀數、計算、圖點以合理原容差與自己的上游數據檢核，避免重複扣錯。人工欄有整數驗證及公式守門，貼入負數、超限、小數或文字不得顯示有效總分；空白待評、0已評、不適用不阻擋。

原始／首次／最後答案、研究ID、事件、裝置圖、快照、舊模型及雲端佇列保留。學生PDF不顯示教師能力分。紙本與VL作答機會不同，不直接換算活動總分或宣稱同一量表。舊下載Excel不會自動更新，新檔不合併舊人工分。

課程與研究安排見[教學大綱](../SYLLABUS.md)，配對見[繁中](ALIGNMENT.zh.md)／[英文](ALIGNMENT.en.md)。原課本／官方syllabus未在本次提供，只能核對repo既有引用與學習重點，不宣稱外部官方要求或效度證據。
