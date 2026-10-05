# VL2：Google 集中紀錄設定 / Google collector setup

網站與收集端須一起更新。此 VL2 收集端只接受 `VL_BIO_TRANSPIRATION`，使用「VL2雲端紀錄」工作表及本 VL 自己的 `/exec`；不要使用 VL1 的部署網址。Google 試算表可與其他 VL 共用，但 Apps Script 專案／部署應獨立。教師密碼不用提供給開發者。

## 中文設定步驟

1. 用 **tzechingchan0605@gmail.com** 建立私人 Google 試算表，或沿用原 VL2 試算表。可建立獨立 Apps Script 專案，或選「擴充功能 → Apps Script」建立綁定專案。不要公開試算表或 Apps Script 專案。
2. 將 [Code.gs](Code.gs) 完整貼入編輯器，取代舊版 VL2 收集程式，儲存。
3. 左側 **Project Settings／專案設定 → Script Properties／指令碼屬性 → Add script property／新增指令碼屬性**，加入：

   | 屬性 | 私人值 |
   | --- | --- |
   | `SPREADSHEET_ID` | 試算表完整 Google Sheet 網址或 ID |
   | `SETUP_TEACHER_PASSWORD` | 至少 12 字元的独立教師密碼，勿用 Google 帳戶密碼 |

4. 按 **Save script properties／儲存指令碼屬性**。回到 **Editor／編輯器**，上方選 `setupCollector` → **Run／執行**，依 Google 提示授權。**Execution log／執行記錄** 應顯示「設定完成」。初始化不使用 `SpreadsheetApp.getUi()`、prompt 或 alert；成功後只保留密碼雜湊，刪除暫存密碼。再次執行會保留學生列，沒有新暫存密碼時沿用既有雜湊。
5. 選 **Deploy／部署 → New deployment／新增部署 → Web app／網頁應用程式**：Execute as／執行身分選 **Me／自己**，Who has access／誰可以存取選 **Anyone／所有人**。若學校禁止匿名網頁應用程式，需學校管理員允許或另用校內收集端。
6. 複製以 `/exec` 結尾的公開網址（不要用 `/dev`），提供此網址即可，**不要分享密碼、雜湊或私人設定截圖**。將它填入本專案 `cloud-config.js` 的 `VL2_CLOUD_CONFIG.endpoint`，提交 GitHub。程式使用嵌入頁、`google.script.run` 和驗證來源／隨機通道的 postMessage，不直接跨網站 fetch。
7. 更新已部署程式時：**Deploy／部署 → Manage deployments／管理部署 → Edit／編輯 → New version／新版本 → Deploy／部署**。只儲存編輯器不會更新公開執行版本。

## English setup

1. Sign in as **tzechingchan0605@gmail.com**. Create a private Google Sheet, or retain the existing VL2 sheet. Create a standalone Apps Script project or use **Extensions → Apps Script** in the sheet. Keep the sheet/project private.
2. Replace the old VL2 collector with the complete [Code.gs](Code.gs), then save.
3. Open **Project Settings → Script Properties → Add script property**. Set `SPREADSHEET_ID` to the full Google Sheet URL or ID, and `SETUP_TEACHER_PASSWORD` to a separate password of at least 12 characters. Do not use your Google account password.
4. Click **Save script properties**. In **Editor**, select `setupCollector` and click **Run**. Authorize access. **Execution log** must confirm setup completed. Setup supports bound and standalone projects without spreadsheet UI APIs. It preserves existing rows, hashes the password and deletes the temporary plaintext property only after setup succeeds.
5. Choose **Deploy → New deployment → Web app**, **Execute as: Me**, **Who has access: Anyone**. Institutional restrictions require administrator support or another collector.
6. Copy the public `/exec` URL into `VL2_CLOUD_CONFIG.endpoint` in `cloud-config.js`, then publish the website update. Share only the endpoint with the developer, never the teacher password/hash. VL2 must use its own collector, not VL1's endpoint.
7. To update an existing deployment: **Deploy → Manage deployments → Edit → New version → Deploy**. Saving source alone does not update the deployed version.

## 舊紀錄 / Existing records

本機 `transpirationLab.*` 紀錄不清除。重新開啟原瀏覽器，登入頁也可按「重試同步舊紀錄」。程式保留先前寫入 token 及待傳答案，以原 ID／時間戳補傳；不補造缺失答案。已確認的重試不新增重複列。同電郵再次登入產生新 ID，保留每次探究。

如果曾部署本專案較早的 Drive 收集端：在**原 VL2 Apps Script 專案**更新，保留私人 `SHEET_ID`、`FOLDER_ID` 及原試算表。新增上述兩個新屬性，執行 `setupCollector`，會將原 `Records` 索引對應的私人 Drive 檔案分段遷移至「VL2雲端紀錄」，保留 token 雜湊，原索引及檔案不刪除。大於新上限的舊紀錄會明確報錯並保留原檔，不能截斷。重新執行不重複新增已遷移紀錄。舊 `TEACHER_KEY` 不再作為讀取憑證，改用設定的新教師密碼。

Existing local answers, timestamps, attempt IDs, write tokens and old pending snapshots remain intact. Reopen the original browser and retry to upload its history. Previously cleared local data cannot be recovered. For the earlier Drive-backed VL2 collector, update the original Apps Script project, retain `SHEET_ID`, `FOLDER_ID`, the original sheet and files, then run setup with the new properties. Setup migrates the private files idempotently into the VL2 chunked sheet while retaining ownership hashes; original files/index are not deleted. Oversized records are rejected without truncation. Use the new teacher password instead of the previous `TEACHER_KEY`.

## 使用及驗收 / Use and verification

- 每份紀錄最多 **960,000 UTF-16 字元**，最多 24 段，每段 40,000 字元。照片過大會有錯誤並保留本機，不會默默截斷。試算表分段加上 `json:`，文字不能成為公式。請勿手動改動索引、token 雜湊及分段內容。
- 收集端未確認正確探究 ID 前不顯示已同步。離頁網路請求不能保證完成；未確認的答案保留本機，重連／定期重試／原瀏覽器重開可補傳。不要清除未同步資料。
- 教師電郵只開啟教師介面，中央讀取另驗證獨立密碼。密碼只留目前頁面；切換帳戶或重新整理即清除。學生電郵為自行填寫的識別欄，不是已驗證 Google 身分。
- 教師「重新載入全部學生紀錄」讀取全部雲端分頁，再依 ID／版本合併本機紀錄。Excel 匯出前重新讀取，任何分頁失敗均停止匯出。教師示範不寫入學生紀錄，個別報告保持唯讀。
- 每次匯出產生新的全班 Excel，保留六張工作表、圖片、配色、公式及人工評分欄。已下載並人工評分的檔案不會被修改；教師自行保留已評檔案，網站不回讀其中人工分數。
- Record limit: 960,000 UTF-16 characters across up to 24 chunks. Oversized records are explicitly rejected and retained locally. Teacher reads require the separate password; demonstrations are excluded. Export reads all cloud pages before merging by ID/version and generating the existing scored workbook. It does not overwrite previously downloaded/manual-graded files.

正式部署後，手機及獨立電腦瀏覽器各填不同答案並等候確認；第三個瀏覽器登入教師、輸入私人密碼，確認列表及 Excel 有兩份。再用同電郵做第二次，確認新增探究、舊次仍在；測試斷線補傳及教師示範不增加紀錄。可打開 `/exec` 查看版本 3，但健康回應不代表已完成學生保存或教師讀取。

`node tests/cloud_setup.cjs`、`node tests/cloud_metadata.cjs`、`node tests/cloud.cjs` 使用 Google 服務替身及獨立瀏覽器測試；`node tests/smoke.cjs` 驗證原流程、PDF、反思及評分。模擬資料不寫入正式收集端。仍需在取得正式 `/exec` 後驗證 Google 授權、真正匿名嵌入頁與 RPC、配額及真實手機讀寫；不能把模擬測試或健康回應當作正式部署成功。

已與使用者提供的可運作 VL1 Apps Script 比對：把模組、工作表及 `vl1-*` 訊息改為 VL2 後，核心嵌入頁／RPC／save／list 協定一致，並通過完整跨瀏覽器與 Excel 模擬測試。VL2 保留舊 Drive 紀錄遷移及分段資料檢核。測試其他參考版本可用 `COLLECTOR_SOURCE=/path/to/module-adapted-reference.gs node tests/cloud.cjs`；此設定只切換本機測試替身，不改正式部署或提交正式學生資料。
