這份文件是 qbr-report 唯一的邏輯來源。執行方式：讀原始資料 → 依這份文件算出這次需要的所有數字與洞察 → 依使用者要的格式直接生成。資料來源固定為 `data-fetcher` skill，以下每一項都標明來源 CLI 與要取的 key。

## 前置設定

一開始要先決定這份報告的時間單位（週、月、雙月、季擇一），全篇統一套用同一種單位，並決定本期的起訖日期。只有「帳號總覽分析」需要拉「-3、-2、-1、本期」共 4 期做比較，期數固定為 4，不隨時間單位變動；其餘所有分析（好友成長、發布文章成效）都只需要當期（本期）資料，不用跨期比較。

## 數據小結 撰寫原則

每個段落的「數據小結」沒有固定公式，統一遵守以下原則：
- 要以 CRM 專家的角度提出分析判斷，不能只是把表格裡已經看得到的數字複述一遍。
- 每個小結要列點說明，約 3 點左右，不強制。
- 每個列點要有標題和敘述，標題要在 10 字以內，敘述要在 50 字左右。

---

## 資料撈取一覽

全篇會用到的 CLI 與參數彙整在這裡，實際執行時照這份清單呼叫，不用回頭在各段落裡找。

- `statistics get-workspace-member-overview`
  - 參數：`--workspace-id`（選填）
  - 用途：帳號總覽分析的有效好友數、封鎖率／活躍率的期末好友總數基準
  - 限制：只能查「現在」快照，無法回溯歷史（暫記，等 API 支援日期參數後改為依期呼叫）

- `statistics get-line-friend-count-series`
  - 參數：`--start-dt`／`--end-dt`（必須成對提供，單次區間最長 90 天），`--workspace-id`（選填）
  - 用途：帳號總覽分析的封鎖數；好友成長分析的每日新增／封鎖／淨成長、平均值、新增／封鎖排名
  - 呼叫方式：涵蓋帳號總覽 4 期（-3～本期）的完整區間，一次查完後在本地依日期切成 4 個期間分別加總，不用呼叫 4 次；若總天數超過 90 天（例如季報），要分段查詢再拼接

- `statistics get-active-member-count-series`
  - 參數：`--start-dt`／`--end-dt`（同上規則），`--workspace-id`（選填）
  - 用途：帳號總覽分析的活躍人數
  - 呼叫方式：同上，一次查完整區間後在本地切期間

- `broadcast search`
  - 參數：`--start-dt`／`--end-dt`（必填），`--name`（選填），`--limit`（選填，1～100，預設 50，單次最多回傳 100 筆）
  - 用途：
    - 好友新增／封鎖排名：日期範圍設為當天，取當日發文 `name`
    - 發文成效總覽：「上期」「本期」各查一次，取得兩期的發文清單（後續篩選 `is_draft == false` 且 `status == "published"`）
    - 發文明細表：直接沿用本期查詢結果，不用重查
  - 【暫記：單次最多回傳 100 筆，ref 目前沒提供分頁參數；若本期發文數可能超過 100 篇，之後要另外確認怎麼分頁】

- `broadcast get-statistics`
  - 參數：`--broadcast-id`（必填，逐篇呼叫，id 來自 `broadcast search` 回傳的 `id`）
  - 用途：發文成效總覽的平均開封率／互動率、開封率／點擊率前 3、發文明細表的開封／點擊數據
  - 限制：成本較高、不建議大量迴圈（暫記，之後會改成支援批次或依時間區間查詢）

---

## 帳號總覽分析

以下每個指標都要算出前 3、前 2、前 1、本期共 4 期的數值，並計算每期變化量，做成表格：

- 有效（目標）好友數：`statistics get-workspace-member-overview` → `active_line_member_count`
  【待確認：這隻 API 只有「現在」快照，前三期的歷史值目前無法取得，等這隻 API 加上日期參數後再補】
- 封鎖數：`statistics get-line-friend-count-series` → 該期區間內 `line_block_count` 加總
- 封鎖率：封鎖數（該期） ÷（`active_line_member_count`（期末好友總數）＋封鎖數（該期））
- 活躍人數：`statistics get-active-member-count-series` → `active_member_count`
  【待確認：期間統計方式用逐日加總，還是逐日平均？逐日加總會重複計同一人多天活躍】
  【暫記：之後會有「區間總計（去重）」的 API，屆時直接改用該去重數值，不用再煩惱加總或平均】
- 活躍率：活躍人數（該期） ÷（`active_line_member_count`（期末好友總數）＋封鎖數（該期）），分母與封鎖率相同
- 數據小結：依數據小結原則撰寫

---

## 好友成長分析

### 每日新增／封鎖趨勢
- 列出每日新增 / 封鎖 / 淨成長的數值
  - 每日新增好友：`statistics get-line-friend-count-series` → `line_join_count`
  - 每日封鎖好友：`statistics get-line-friend-count-series` → `line_block_count`
  - 每日淨成長：`statistics get-line-friend-count-series` → `line_net_count`
- 新增人數平均值：`line_join_count` 期間逐日平均
- 封鎖人數平均值：`line_block_count` 期間逐日平均
- 數據小結：依數據小結原則撰寫

### 好友新增排名（前 10）
- 排名／新增好友數：`line_join_count` 依數值降冪排序取前 10 個日期
- 當日發文主題／活動：`broadcast search`（`--start-dt`／`--end-dt` 設為當天） → `name`，同一天有多篇發文時全部列出
- 數據小結：依數據小結原則撰寫

### 好友封鎖排名（前 10）
- 排名／封鎖好友數：`line_block_count` 依數值降冪排序取前 10 個日期
- 當日發文主題／活動：同上，`broadcast search` → `name`
- 數據小結：依數據小結原則撰寫

---

## 發布文章成效

### 發文成效總覽
- 排除測試／草稿：`broadcast search` → `is_draft == false` 且 `status == "published"`（先篩選，後面所有發文相關指標都以篩選後的清單為準）
- 發文數：篩選後的筆數
- 平均受眾數：`broadcast search` → `audience_target_count.point` 的平均；`type == "range"`（區間人數）時，取該篇區間的平均值後再納入整體平均
  【待確認：`range` 結構目前 ref 只寫「僅列代表性結構」，沒列出區間欄位名稱，實作時要另外確認 `range` 底下的實際 key】
- 平均開封率：`broadcast get-statistics`（逐篇呼叫） → `line_broadcast_insight.unique_impression_rate` 的平均
- 平均互動率：`broadcast get-statistics` → `line_broadcast_insight.unique_click_rate` 的平均（互動率＝點擊率，已確認視為同一件事）
- 數據小結：依數據小結原則撰寫
- 文章名稱：若 `name` 無法直觀理解，依 `message_dict` 內容摘要成 15 字內名稱，並標記 `title_is_generated = true`

【暫記：`broadcast get-statistics` 目前不建議大量迴圈，之後會改成支援批次或依時間區間查詢，屆時直接改用新版呼叫方式；現階段先照現有單篇呼叫方式寫，不另外設上限】

### 開封率前 3 文章
- 排名：`line_broadcast_insight.unique_impression_rate` 降冪排序取前 3
- 文章名稱／預覽文字／受眾數：`broadcast search` → `name`／`message_dict`／`audience_target_count`
- 開封率：`unique_impression_rate`
- 數據小結：依數據小結原則撰寫
- 同分時排序規則：以 `broadcast_dt` 由早到晚排序

### 點擊率前 3 文章
- 排名：`unique_click_rate` 降冪排序取前 3
- 其餘欄位同上開封率前 3
- 同分時排序規則：同上，以 `broadcast_dt` 由早到晚排序

### 發文明細表
- 序：依 `broadcast_dt` 排序後的序號
- 發佈時間：`broadcast search` → `broadcast_dt`
- 文章名稱／預覽文字：同上「發文成效總覽」的文章名稱規則
- 受眾數：`audience_target_count`
- 開封數：`broadcast get-statistics` → `line_broadcast_insight.unique_impression`
- 開封率：`unique_impression_rate`
- 點擊次數：`line_broadcast_insight.click`
- 點擊人數：`unique_click`
- 點擊率：`unique_click_rate`
- 高於平均標記：與本期（篩選後）算術平均比較，嚴格大於才算「高於」（等於不算）

### 發文洞察
- 分類維度候選：預覽文字、發文內容、發文時間、受眾規模、受眾標籤
- 分類方法：以成效（開封率、點擊率）為基準，從候選維度中找出 1～2 個「切出來後各組成效有明顯差異」的維度，用這 1～2 個維度做分類與分析，不是把候選維度全部都拿來分
- 每個類型最少篇數：不特別規定下限
- 類型內發文清單／成效摘要：依上面分類結果，列出該類型的 `name` 與對應開封率／點擊率