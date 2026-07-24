---
name: qbr-report
user-invocable: false
description: >-
  依 OakMega SCRM 帳號數據產出 QBR 綜合分析報告，涵蓋以下三大主題：帳號總覽分析、好友成長分析、發布文章成效。可輸出純文字（.md）、PPT（.pptx）、網頁（.html）三種格式其中一種或多種。
  使用時機：使用者要求生成「以上三大主題中兩個以上」的綜合報告，例如週報、月報、雙月報、季報、QBR 報告，或單純說「幫我生成報告」而完全沒有指定任何主題時使用。
  不使用時機：
  - 使用者只指名「三大主題中的單一主題」，例如「好友成長報告」「發文成效報告」——直接依該主題回答，不載入此 Skill。
  - 使用者指名的內容「不屬於這三大主題」，例如追蹤連結成效、聊天機器人成效、票券使用狀況等，無論提到幾個項目，都不載入此 Skill，直接依該主題回答。
---

# QBR Report

產出一份涵蓋帳號總覽、好友成長、發布文章成效三大區塊的分析報告。可依需求輸出純文字、PPT、網頁三種格式之一或多種，三種格式共用同一套分析結果，不會各自重新計算。

## 第一步：確認報告範圍與格式

一開始要先決定這份報告的時間單位（週、月、雙月、季等），全篇統一套用同一種單位，並決定本期的起訖日期。務必先用 AskUserQuestion 詢問使用者，就算前後文有說明，也還是要重複確認：

1. 時間單位（週／月／雙月／季等）與本期起訖日期
2. 要輸出哪些格式：純文字（.md）／網頁（.html）／PPT，可複選

未取得回覆前不要往下執行。

## 第二步：撈取資料並分析

嚴格依照以下規範撈取資料並分析

### 前置設定

- 「帳號總覽分析」需要拉「-3、-2、-1、本期」共 4 期做比較，期數固定為 4，不隨時間單位變動
- 發布文章成效的「發文成效總覽」章節需要拉「-1、本期」共 2 期做比較，期數固定為 2，不隨時間單位變動
- 發布文章成效的其他章節都只需要當期（本期）資料，不用跨期比較或列出
- 其餘所有分析都只需要當期（本期）資料，不用跨期比較。

### 數據小結撰寫原則

每個段落的「數據小結」沒有固定公式，統一遵守以下原則：
- 要以 CRM 專家的角度提出分析判斷，不能只是把表格裡已經看得到的數字複述一遍。
- 每個小結要列點說明，約 3 點左右，不強制。
- 每個列點要有標題和敘述，標題要在 10 字以內，敘述要在 50 字左右。

---

### 資料撈取一覽

全篇會用到的 CLI 與參數彙整在這裡，實際執行時照這份清單呼叫，不用回頭在各段落裡找。

- `statistics get-line-follow-insight`
  - 參數：`--date`（必填，查詢日期），`--profile`（選填）
  - 用途：帳號總覽分析的總好友數（`followers`，該日當下的總好友數快照）、有效（目標）好友數（`targetedReaches`）、封鎖數（`blocks`，該日當下的封鎖總數快照，非期間內新增封鎖事件數）
  - 呼叫方式：帳號總覽 4 期（-3～本期）各呼叫一次，`--date` 設為該期期末日，一次呼叫同時拿到總好友數、有效好友數與封鎖數三個欄位

- `statistics get-active-member-count-total`
  - 參數：`--start-dt`／`--end-dt`（必須成對提供，單次區間最長 100 天），`--profile`（選填）
  - 用途：帳號總覽分析的活躍人數，取該期區間去重後的 `active_member_count`
  - 呼叫方式：4 期各呼叫一次

- `statistics get-line-friend-count-series`
  - 參數：`--start-dt`／`--end-dt`（必須成對提供，單次區間最長 100 天），`--profile`（選填）
  - 用途：好友成長分析的每日新增／封鎖／淨成長、平均值、新增／封鎖排名
  - 呼叫方式：只需涵蓋本期區間，一次查完；若本期天數超過 100 天（例如季報），要分段查詢再拼接

- `statistics get-line-friend-count-total`
  - 參數：`--start-dt`／`--end-dt`（必須成對提供，單次區間最長 90 天），`--workspace-id`（選填）
  - 用途：好友成長分析 KPI 總覽的新增好友總數（`line_join_count`）、封鎖好友總數（`line_block_count`）、好友淨成長（`line_net_count`）
  - 呼叫方式：本期區間查一次即可；若本期天數超過 90 天，要分段查詢再加總（三個欄位分別加總）

- `broadcast search`
  - 參數：`--start-dt`／`--end-dt`（必填），`--name`（選填），`--limit`（選填，1～100，預設 50，單次最多回傳 100 筆）
  - 用途：
    - 好友新增／封鎖排名：日期範圍設為當天，取當日發文 `name`
    - 發文成效總覽／開封率點擊率排名／發文明細表：本期查一次即可，回傳結果已內建 `line_broadcast_insight`（開封率、點擊率等 LINE 官方數據），不用再逐篇呼叫其他 API 補資料
- 總好友數：`statistics get-line-follow-insight`（同上，同一次呼叫） → `followers`（該期期末當下的總好友數快照）
- 有效（目標）好友數：`statistics get-line-follow-insight`（`--date` 設為該期期末日） → `targetedReaches`
- 封鎖數：`statistics get-line-follow-insight`（同上，同一次呼叫） → `blocks`（該期期末當下的封鎖總數快照）
- 封鎖率：封鎖數（該期） ÷ 總好友數（該期期末 `followers`）
- 活躍數：`statistics get-active-member-count-total`（該期區間） → `active_member_count`（區間去重後的單一數字）
- 活躍率：活躍數（該期） ÷ 有效（目標）好友數（該期期末 `targetedReaches`）
  
---

### 帳號總覽分析

以下每個指標都要算出前 3、前 2、前 1、本期共 4 期的數值，並計算每期變化量，做成表格，表格最前面依序放這 6 項（定義與計算方式見「資料撈取一覽」）：

1. 總好友數
2. 有效（目標）好友數
3. 封鎖數
4. 封鎖率
5. 活躍數
6. 活躍率

- 數據小結：依數據小結原則撰寫

---

### 好友成長分析

#### KPI 總覽（新增好友總數／封鎖好友總數／好友淨成長）
- 新增好友總數／封鎖好友總數／好友淨成長：`statistics get-line-friend-count-total`（本期區間） → `line_join_count`／`line_block_count`／`line_net_count`
- 平均每日＝各總數 ÷ 本期天數；好友淨成長可為負，平均每日正負號一律顯示（如 +12.3 / -4.5）

#### 每日新增／封鎖趨勢
- 列出每日新增 / 封鎖 / 淨成長的數值
  - 每日新增好友：`statistics get-line-friend-count-series` → `line_join_count`
  - 每日封鎖好友：`statistics get-line-friend-count-series` → `line_block_count`
  - 每日淨成長：`statistics get-line-friend-count-series` → `line_net_count`
- 新增人數平均值：`line_join_count` 期間逐日平均
- 封鎖人數平均值：`line_block_count` 期間逐日平均
- 數據小結：依數據小結原則撰寫

#### 好友新增排名（前 10）
- 排名／新增好友數：`line_join_count` 依數值降冪排序取前 10 個日期
- 當日發文主題／活動：`broadcast search`（`--start-dt`／`--end-dt` 設為當天） → `name`，同一天有多篇發文時全部列出
- 數據小結：依數據小結原則撰寫

#### 好友封鎖排名（前 10）
- 排名／封鎖好友數：`line_block_count` 依數值降冪排序取前 10 個日期
- 當日發文主題／活動：同上，`broadcast search` → `name`
- 數據小結：依數據小結原則撰寫

---

### 發布文章成效

以下所有數據都來自同一次「本期」`broadcast search` 查詢結果，不用再逐篇呼叫其他 API 補資料。若某篇的 `line_broadcast_insight` 相關數值為 `null`（尚未產生 R2 資料），該篇不列入對應的平均值計算，也不納入排行榜候選。

#### 預覽文字規則（供本節各段落共用）
- 取 `expanded_message_dict.contents` 最後一則訊息：
  - 該則為 `TEXT` 類型：預覽文字＝該則文字內容
  - 該則有 `alt_text` 欄位（`RICHVIDEO`／`IMAGEMAP`／`FLEXM`／`FLEXS`／`FLEX`）：預覽文字＝該則 `alt_text`
  - 該則既非 `TEXT` 也沒有 `alt_text`（`IMAGE`／`VIDEO`／`AUDIO`／`STICKER`／`CHARGE`）：預覽文字＝「傳送了一則{訊息格式}」，`{訊息格式}` 為該 `msg_type` 對應的中文名稱（例如圖片、影片、語音、貼圖）

#### 發文成效總覽
- 排除測試／草稿：`broadcast search` → `is_draft == false` 且 `status == "published"`（先篩選，後面所有發文相關指標都以篩選後的清單為準）
- 發文數：篩選後的筆數
- 平均受眾數：`broadcast search` → `audience_target_count.point` 的平均；`type == "range"`（區間人數）時，取該篇區間的平均值後再納入整體平均
- 平均開封率：`broadcast search` → `line_broadcast_insight.unique_impression_rate` 的平均（`null` 不列入計算）
- 平均點擊率：`broadcast search` → `line_broadcast_insight.unique_click_rate` 的平均（`null` 不列入計算）
- 數據小結：依數據小結原則撰寫
- 文章名稱：若 `name` 無法直觀理解，依上方「預覽文字規則」取得的內容摘要成 15 字內名稱

#### 開封率前 3 文章
- 排名：`line_broadcast_insight.unique_impression_rate` 降冪排序取前 3（`null` 不納入候選）
- 文章名稱／預覽文字／受眾數：`broadcast search` → `name`／依「預覽文字規則」／`audience_target_count`
- 開封率：`unique_impression_rate`
- 數據小結：依數據小結原則撰寫
- 同分時排序規則：以 `broadcast_dt` 由早到晚排序

#### 點擊率前 3 文章
- 排名：`unique_click_rate` 降冪排序取前 3（`null` 不納入候選）
- 其餘欄位同上開封率前 3
- 同分時排序規則：同上，以 `broadcast_dt` 由早到晚排序

#### 發文明細表
- 序：依 `broadcast_dt` 排序後的序號
- 發佈時間：`broadcast search` → `broadcast_dt`
- 文章名稱／預覽文字：同上「發文成效總覽」的文章名稱規則／「預覽文字規則」
- 受眾數：`audience_target_count`
- 開封數：`broadcast search` → `line_broadcast_insight.unique_impression`
- 開封率：`unique_impression_rate`
- 點擊次數：`line_broadcast_insight.click`
- 點擊人數：`unique_click`
- 點擊率：`unique_click_rate`

#### 發文洞察
- 分類維度候選：預覽文字、發文內容、發文時間、受眾規模、受眾標籤
- 分類方法：以成效（開封率、點擊率）為基準，從候選維度中找出 1～2 個「切出來後各組成效有明顯差異」的維度，用這 1～2 個維度做分類與分析，不是把候選維度全部都拿來分
- 每個類型最少篇數：不特別規定下限
- 類型內發文清單／成效摘要：依上面分類結果，列出該類型的 `name` 與對應開封率／點擊率

---

## 第三步：依格式生成

依第一步使用者選擇的格式，參照對應範例的排版風格直接生成內容，不產出中繼資料檔案。

- 純文字：參考 `example/example.md`
- 網頁（html）：參考 `example/example.html`

若選了多種格式，依序產出；因為都來自同一次分析結果，內容必須彼此一致（數字、數據小結用詞可依格式調整語氣，但結論不能互相矛盾）。

## 第四步：交付

### 檔案命名

檔名格式固定為：

```
OakMega_QBR_{本期起訖日期}.{副檔名}
```

- 本期起訖日期格式為 `YYYYMMDD-YYYYMMDD`（例如本期為 2026-01-01～2026-03-31，則為 `20260101-20260331`）
- 副檔名依格式決定：純文字 `.md`、網頁 `.html`、PPT `.pptx`
- 檢查輸出目錄下是否已有相同檔名（同副檔名比對，各格式各自查重）：若無重複，直接使用上述檔名；若有重複，在副檔名前加上 `-1`、`-2`……取目前未被使用的最小號碼（例如 `OakMega_QBR_20260101-20260331-1.md`）

完成後把產出的檔案提供給使用者。