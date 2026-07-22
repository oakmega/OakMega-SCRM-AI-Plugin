---
name: data-fetcher
user-invocable: false
description: >-
  OakMega SCRM 統一資料層。查詢會員主檔、渠道綁定、標籤、發文成效、聊天機器人（chatbot）觸發紀錄、追蹤連結（deeplink）點擊紀錄、
  客服對話紀錄、workspace 統計數據等資料，呼叫對應 CLI 指令並永遠回傳 raw JSON。當上層需要 OakMega SCRM 任何結構化資料時使用。
---

# data-fetcher

**所有輸出固定為 `output: json`**——raw JSON 原文，不做任何整理或格式轉換。

## CLI 路徑

```
node "$CLAUDE_PLUGIN_ROOT/bin/oakmega-scrm.js" <command>
```

## 輸入格式

呼叫端透過 prompt 傳入：

```
fetch: <描述要什麼資料>
params: { ... }
```

根據 `fetch` 描述判斷要執行哪個 CLI 指令，`params` 對應到 CLI flags。

---

## 可用指令一覽

### Member

```bash
# 搜尋會員 → reference/member-search.md
member search --query <q> --search-by <name|workspace_member_id|uuid> [--workspace-id <id>]

# 查詢會員主表 → reference/member-get-basic-info.md
member get-basic-info --member-id <id> [--workspace-id <id>]

# 查詢 LINE 渠道會員資訊（未綁定回 404）→ reference/member-get-channel-line.md
member get-channel-line --member-id <id>
# 查詢 Facebook 渠道會員資訊（未綁定回 404 → reference/member-get-channel-fb.md
member get-channel-fb --member-id <id>
# 查詢 Instagram 渠道會員資訊（未綁定回 404）→ reference/member-get-channel-ig.md
member get-channel-ig --member-id <id>
# 查詢 Whatsapp 渠道會員資訊（未綁定回 404）→ reference/member-get-channel-whatsapp.md
member get-channel-whatsapp --member-id <id>

# 最近有訊息往來的會員（days: 1~7，預設 1） → reference/member-list-recent-messaged.md
member list-recent-messaged [--days <n>]

# 最近觸發過 chatbot 的會員（days: 1~7，預設 7） → reference/member-list-recent-chatbot-triggered.md
member list-recent-chatbot-triggered [--days <n>]

# 最近點擊過追蹤連結的會員（days: 1~7，預設 7） → reference/member-list-recent-deeplink-clicked.md
member list-recent-deeplink-clicked [--days <n>]
```

### Tag

```bash
# 單一會員標籤 → reference/tag-list-member-tags.md
tag list-member-tags --member-id <id> [--workspace-id <id>]

# 批次（最多 20 人） → reference/tag-list-members-batch.md
tag list-members-batch --member-ids <id1,id2,...> [--workspace-id <id>]
```

### Broadcast

```bash
# 搜尋時間範圍內、名稱包含關鍵字的發文，已含開封率/點擊/影片播放數據（區間最長 100 天） → reference/broadcast-search.md
broadcast search --start-dt <YYYY-MM-DD> --end-dt <YYYY-MM-DD> [--name <關鍵字>] [--limit <n>]
```

### Chatbot

```bash
# workspace 最近 N 日 chatbot 排行，依觸發次數降冪（days: 1~7，預設 7） → reference/chatbot-list-recent-triggered.md
chatbot list-recent-triggered [--days <n>] [--workspace-id <id>]

# 單一會員的 chatbot 觸發排行（days: 1~60，預設 60） → reference/chatbot-list-member-triggered.md
chatbot list-member-triggered --member-id <id> [--days <n>] [--workspace-id <id>]

# 批次（最多 20 人，days 為 int） → reference/chatbot-list-members-triggered-batch.md
chatbot list-members-triggered-batch --member-ids <id1,id2,...> [--days <n>] [--workspace-id <id>]
```

### Deeplink

```bash
# workspace 最近 N 日 deeplink 排行，依點擊次數降冪（days: 1~7，預設 7） → reference/deeplink-list-recent-clicked.md
deeplink list-recent-clicked [--days <n>] [--workspace-id <id>]

# 單一會員的 deeplink 點擊排行（days: 1~60，預設 60） → reference/deeplink-list-member-clicked.md
deeplink list-member-clicked --member-id <id> [--days <n>] [--workspace-id <id>]

# 批次（最多 20 人，days 為 int） → reference/deeplink-list-members-clicked-batch.md
deeplink list-members-clicked-batch --member-ids <id1,id2,...> [--days <n>] [--workspace-id <id>]
```

### Service Center

```bash
# 單一渠道會員的對話紀錄（以 social_media_member_id 為鍵，最多 500 筆） → reference/service-center-list-member-messages.md
service-center list-member-messages --social-media-member-id <id> [--workspace-id <id>]

# 批次（最多 20 人，每人最多 20 筆） → reference/service-center-list-members-messages-batch.md
service-center list-members-messages-batch --social-media-member-ids <id1,id2,...> [--workspace-id <id>]
```

### Activity Log

```bash
# 單一會員的 tag 變動紀錄 → reference/activity-log-list-tag-changes.md
activity-log list-tag-changes       --member-id <id> [--days <1-60>]
# 單一會員的 chatbot 觸發紀錄 → reference/activity-log-list-chatbot-triggers.md
activity-log list-chatbot-triggers  --member-id <id> [--days <1-60>]
# 單一會員的 deeplink 點擊紀錄 → reference/activity-log-list-deeplink-clicks.md
activity-log list-deeplink-clicks   --member-id <id> [--days <1-60>]
```

### Statistics

```bash
# workspace 會員/好友概況 → reference/statistics-get-workspace-member-overview.md
statistics get-workspace-member-overview [--workspace-id <id>]

# LINE 好友加入/封鎖逐日時序（區間最長 100 天，預設近 30 天） → reference/statistics-get-line-friend-count-series.md
statistics get-line-friend-count-series [--start-dt <YYYY-MM-DD>] [--end-dt <YYYY-MM-DD>]

# LINE 好友加入/封鎖總數（整個區間加總的單一數字，非逐日序列，同上區間規則） → reference/statistics-get-line-friend-count-total.md
statistics get-line-friend-count-total [--start-dt <YYYY-MM-DD>] [--end-dt <YYYY-MM-DD>]

# 活躍會員數逐日時序（同上區間規則） → reference/statistics-get-active-member-count-series.md
statistics get-active-member-count-series [--start-dt <YYYY-MM-DD>] [--end-dt <YYYY-MM-DD>]

# 活躍會員總數（整個區間去重的單一數字，非逐日序列，同上區間規則） → reference/statistics-get-active-member-count-total.md
statistics get-active-member-count-total [--start-dt <YYYY-MM-DD>] [--end-dt <YYYY-MM-DD>]

# 會員互動數（訊息數/點擊數）逐日時序（同上區間規則） → reference/statistics-get-member-interaction-count-series.md
statistics get-member-interaction-count-series [--start-dt <YYYY-MM-DD>] [--end-dt <YYYY-MM-DD>]

# 會員互動總數（訊息數/點擊數，整個區間加總的單一數字，非逐日序列，同上區間規則） → reference/statistics-get-member-interaction-count-total.md
statistics get-member-interaction-count-total [--start-dt <YYYY-MM-DD>] [--end-dt <YYYY-MM-DD>]

# LINE 官方帳號指定日期的追蹤者洞察 → reference/statistics-get-line-follow-insight.md
statistics get-line-follow-insight --date <YYYY-MM-DD> [--workspace-id <id>]

# 批次取得多筆發文的 6 小時互動數據（最多 20 筆） → reference/statistics-list-broadcast-six-hour-interaction-batch.md
statistics list-broadcast-six-hour-interaction-batch --broadcast-ids <id1,id2,...> [--workspace-id <id>]

# 依日期區間取得多筆發文的 6 小時互動數據（區間規則同 broadcast search，預設近 30 天） → reference/statistics-search-broadcast-six-hour-interaction.md
statistics search-broadcast-six-hour-interaction [--start-dt <YYYY-MM-DD>] [--end-dt <YYYY-MM-DD>] [--limit <n>]
```

---

## API 呼叫順序與依賴

跨指令常見的三種 id，彼此不可混用：

- `workspace_member_id`（`--member-id`/`--member-ids`）：大部分 member 相關指令用的會員主鍵。
- `social_media_member_id`（`--social-media-member-id`/`--social-media-member-ids`）：會員在某個渠道的綁定身分 id，只有 `service-center` 系列指令需要，**不等於 `workspace_member_id`**。
- `broadcast_id`（`--broadcast-ids`）：只有 `statistics list-broadcast-six-hour-interaction-batch` 需要（`statistics search-broadcast-six-hour-interaction` 用日期區間查詢，不需要 id）。

### 查詢 member-id

入口指令（不需任何前置 id，直接呼叫即可查詢）：
`member search`、`member list-recent-messaged`、`member list-recent-chatbot-triggered`、`member list-recent-deeplink-clicked`（回傳每筆資料皆含 `workspace_member_id`）。

需要先有 member-id 才能呼叫的指令：
`member get-basic-info`、`member get-channel-line/fb/ig/whatsapp`、`tag list-member-tags`（批次：`tag list-members-batch`）、`chatbot list-member-triggered`（批次：`chatbot list-members-triggered-batch`）、`deeplink list-member-clicked`（批次：`deeplink list-members-clicked-batch`）、`activity-log list-tag-changes`／`list-chatbot-triggers`／`list-deeplink-clicks`。

### 查詢 social_media_member_id

入口：上述四個 member 入口指令回傳的 `channels[].social_media_member_id`；或先查詢 member-id 後呼叫 `member get-channel-line/fb/ig/whatsapp`，回傳中也含 `social_media_member_id`。

需要此 id 的指令：`service-center list-member-messages`（批次：`service-center list-members-messages-batch`）。

### 查詢 broadcast-id

入口：`broadcast search` 回傳每筆的 `id`。

需要此 id 的指令：`statistics list-broadcast-six-hour-interaction-batch`。

### 補充

- 批次指令（`--member-ids`/`--*-ids`）一次最多 20 個，id 來源與對應的單筆版本相同。
- `chatbot list-recent-triggered` 與 `deeplink list-recent-clicked` 是 workspace 層級排行榜，不需要前置 id，也不是其他指令的前置步驟，直接呼叫即可。

---

## 詳細規格（Request 參數 / Response 欄位）

`reference/` 目錄下有每個指令對應的完整規格文件，路徑已直接標在「可用指令一覽」每個指令旁邊（`→ reference/...`）。

**確定要呼叫某個指令後、執行 CLI 之前，一律先讀取該指令旁標註的 reference 檔案**，取得完整的參數規則與回傳欄位說明，再組出正確的 CLI 呼叫、或正確解讀回傳的 raw JSON。不要一次讀多份，只讀當下要用的那一份；single/batch 版本即使動作相同，回傳的 key 也可能不同（`result` vs `results`），務必各自對應到旁邊標註的那一份，不要沿用剛讀過的另一份。

## 安全規則

- 永遠不要請使用者貼 API key。
- CLI 從 `~/.config/oakmega-scrm/config.json` 讀取憑證，不需接觸。

## 行為限制

- **禁止分析原始碼**：任何情況下都不要讀取、檢視或分析 API/CLI 原始碼檔案（例如 `bin/oakmega-scrm.js` 或其他實作檔）來推敲指令、flags 或行為。所有可用指令與參數僅限本文件「可用指令一覽」與 `reference/` 目錄所列，需要用什麼指令、flag、回傳欄位一律以這些文件為準。`reference/` 底下的文件是文件，不是原始碼，是允許且必須參考的權威來源。
- **超出範圍不查詢**：若使用者想要的資料對應不到本文件列出的任一指令，直接回報「此資料不在 data-fetcher 支援範圍內」，不要嘗試呼叫任何未列出的指令或去源碼裡找替代方法。
- **禁止猜測／枚舉 id**：`workspace_member_id`、`social_media_member_id`、`broadcast_id` 等任何 id，只能使用某個入口指令（見「API 呼叫順序與依賴」）實際回傳的值。這些 id **不是依建立時間或流水順序遞增的流水號**，數值大小與資料存在與否、發文先後順序無關，所以即使已經拿到一批確切的 id（例如 `broadcast search` 回傳的多筆 `id`），也**不得**再取這批 id 的最大值／最小值去推算中間可能存在的其他 id 並逐一嘗試查詢；只查詢已知確實存在、且使用者需要的那些 id。若還需要更多資料，回頭呼叫對應的入口指令（如放寬 `--start-dt`/`--end-dt`、調整 `--limit`）取得更多確切 id，而不是自行遞增/遞減數字去試。
- **錯誤代碼處理**：
  - CLI 回傳 `401` 或 `403`：不要重試、不要換 workspace-id 或其他參數嘗試繞過，直接回報請使用者檢查 API Key 是否正確／有效，若確認無誤仍失敗，請聯絡 OakMega 窗口確認權限。
  - CLI 回傳 `417`：直接回報請使用者修改查詢條件（例如調整 `--days`、`--limit`、日期範圍等），不要自行重試不同參數組合。
- **跨指令通則**（詳細內容仍以個別 `reference/` 文件為準）：
  - **Batch vs Single**：batch 指令的回傳用 `"results"`（複數 key，逐一標示每個 id 的結果），single 指令用 `"result"`（單數 key）。
  - **`days` 型別差異**：single 指令的 `--days` 對應 query string，字串型別；batch 指令（`--member-ids`/`--*-ids`）的 `--days` 對應 request body，**int** 型別。
  - **不存在的 id**：batch 指令對不屬於此 workspace 的 id，回傳該筆 `{"..._id": <id>, "error": "not_in_workspace"}`，不會拋 404。例外：`statistics list-broadcast-six-hour-interaction-batch` 對不存在的 broadcast id 是直接從 `results` 省略，不回傳該筆，也不回傳 `not_in_workspace`——若請求的 id 數量與回傳筆數不一致，代表其中有 id 不屬於此 workspace。
  - **日期格式**：所有時間欄位格式為 `"YYYY-MM-DD HH:MM:SS"`（台北時間，+08:00）。
  - **Throttle**：list 類指令較嚴（5 次/分鐘/帳號），get / search 類較寬鬆（30 次/分鐘/帳號），短時間內大量呼叫可能被限流。
