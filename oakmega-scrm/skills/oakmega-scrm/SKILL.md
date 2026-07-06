---
name: oakmega-scrm
description: 操作「OakMega SCRM」後台專用。僅在使用者明確提到 OakMega SCRM（或已在處理 OakMega SCRM 的客戶、對話、資料）時使用：例如登入/設定 OakMega SCRM、查詢或管理其客戶與對話。透過內附 oakmega-scrm CLI 執行，API key 以本機網頁表單輸入。不要用於一般性的「登入」「查客戶」需求，也不要用於其他 CRM / 系統。
---

# OakMega SCRM

操作 OakMega SCRM 後台的 skill。**所有操作一律透過內附 CLI 執行**，呼叫方式：

```
node "${CLAUDE_PLUGIN_ROOT}/bin/oakmega-scrm.js" <command>
```

> **觸發界線（重要）**：只有當需求明確指向 **OakMega SCRM** 時才使用本 skill。
> 使用者單講「幫我登入」「查一下客戶」而沒有 OakMega SCRM 的上下文時，**不要**觸發，
> 以免干擾使用者其他工作。
>
> 多數情況下使用者會用 `/oakmega-scrm` 指令明確進入本流程；該指令是薄入口，細節以本 skill 為準。

## 已知雷：${CLAUDE_PLUGIN_ROOT} 展開

`${CLAUDE_PLUGIN_ROOT}` 在 JSON 設定裡一定會展開，但在 markdown / 實際執行時歷史上曾發生展開不了的狀況。若你發現指令裡出現了字面的 `${CLAUDE_PLUGIN_ROOT}`（沒被換成真實路徑），請改用環境變數寫法：

```
node "$CLAUDE_PLUGIN_ROOT/bin/oakmega-scrm.js" <command>
```

若仍無法解析，請先找出 plugin 實際安裝路徑（含 `bin/oakmega-scrm.js` 的目錄），再用絕對路徑執行。

## 核心安全規則

- **永遠不要請使用者把 API key 貼進對話。** key 只能透過 `login` 開啟的本機網頁表單輸入。
- CLI 會自己從 `~/.config/oakmega-scrm/config.json` 讀 key，你不需要、也不應該接觸 key 全文。CLI 最多只會印出前 10 碼。

## 輸出規則

預設將結果整理成人類可讀格式回覆（摘要、表格、條列等）。
若呼叫端在 context 中明確指定 `output: json`，改為回傳 CLI 的 raw JSON 原文，不做任何格式轉換。

## Auth bootstrap（任何操作前都先做）

1. 先檢查登入狀態：

   ```
   node "${CLAUDE_PLUGIN_ROOT}/bin/oakmega-scrm.js" auth status
   ```

   - exit code 0 → 已登入，直接進行後續操作。
   - exit code 非 0 → 尚未登入，進入下一步。

2. 觸發登入：

   ```
   node "${CLAUDE_PLUGIN_ROOT}/bin/oakmega-scrm.js" login
   ```

   這會啟動本機網頁表單並自動開啟瀏覽器。請明確告訴使用者：

   > 請在自動打開的瀏覽器視窗貼上你的 API key 完成設定（若沒自動開，請手動貼上終端機印出的網址）。

3. 使用者完成後，重跑 `auth status` 確認已登入，再繼續。

## 操作

### whoami（驗證認證流程）

```
node "${CLAUDE_PLUGIN_ROOT}/bin/oakmega-scrm.js" whoami
```

輸出形如 `API_KEY 前 10 碼：xxxxxxxxxx` 即代表認證流程正常。

### tag list-member-tags（取得 member 的所有有效標籤）

取得指定 workspace member 身上所有有效標籤（不含 is_delete 的 tag 與 tag_dir）：

```
node "${CLAUDE_PLUGIN_ROOT}/bin/oakmega-scrm.js" tag list-member-tags --member-id <workspace_member_id>
```

- `--member-id`：必填，workspace member 的 ID。
- `--workspace-id`：選填，覆蓋 config 中儲存的預設 workspace ID。

**環境變數 `OAKMEGA_BASE_URL`**：開發時可覆蓋 API base URL（不設則連 production）。

輸出格式依全域輸出規則決定。，exit code 0 表示成功；非 0 表示失敗並印出錯誤。

### member search（搜尋會員）

```
node "${CLAUDE_PLUGIN_ROOT}/bin/oakmega-scrm.js" member search --query <搜尋內容> --search-by <欄位>
```

- `--query`：必填，搜尋的關鍵字或值。
- `--search-by`：必填，搜尋欄位，只接受 `name` | `workspace_member_id` | `uuid`。
- `--workspace-id`：選填，覆蓋 config 中儲存的預設 workspace ID。

輸出：raw JSON，exit code 0 表示成功；非 0 表示失敗。

輸出格式依全域輸出規則決定。，exit code 0 表示成功；非 0 表示失敗並印出錯誤。

### member get-basic-info（取得會員主表與自訂欄位）

```
node "${CLAUDE_PLUGIN_ROOT}/bin/oakmega-scrm.js" member get-basic-info --member-id <workspace_member_id>
```

- `--member-id`：必填，workspace member 的 ID。
- `--workspace-id`：選填，覆蓋預設 workspace ID。

輸出格式依全域輸出規則決定。，exit code 0 表示成功；非 0 表示失敗並印出錯誤。

---

### member get-channel-line（取得會員的 LINE 渠道資訊）

```
node "${CLAUDE_PLUGIN_ROOT}/bin/oakmega-scrm.js" member get-channel-line --member-id <workspace_member_id>
```

- `--member-id`：必填。
- `--workspace-id`：選填。
- 若會員未綁定 LINE，API 回 404，CLI 印錯誤 exit 1。

輸出格式依全域輸出規則決定。exit code 0 表示成功；非 0 表示失敗並印出錯誤。

---

### member get-channel-fb（取得會員的 Facebook 渠道資訊）

```
node "${CLAUDE_PLUGIN_ROOT}/bin/oakmega-scrm.js" member get-channel-fb --member-id <workspace_member_id>
```

- `--member-id`：必填。
- `--workspace-id`：選填。
- 若會員未綁定 FB，API 回 404，CLI 印錯誤 exit 1。

輸出格式依全域輸出規則決定。exit code 0 表示成功；非 0 表示失敗並印出錯誤。

---

### member get-channel-ig（取得會員的 Instagram 渠道資訊）

```
node "${CLAUDE_PLUGIN_ROOT}/bin/oakmega-scrm.js" member get-channel-ig --member-id <workspace_member_id>
```

- `--member-id`：必填。
- `--workspace-id`：選填。
- 若會員未綁定 IG，API 回 404，CLI 印錯誤 exit 1。

輸出格式依全域輸出規則決定。exit code 0 表示成功；非 0 表示失敗並印出錯誤。

---

### member get-channel-whatsapp（取得會員的 WhatsApp 渠道資訊）

```
node "${CLAUDE_PLUGIN_ROOT}/bin/oakmega-scrm.js" member get-channel-whatsapp --member-id <workspace_member_id>
```

- `--member-id`：必填。
- `--workspace-id`：選填。
- 若會員未綁定 WhatsApp，API 回 404，CLI 印錯誤 exit 1。

輸出格式依全域輸出規則決定。exit code 0 表示成功；非 0 表示失敗並印出錯誤。

---

### member list-recent-messaged（最近有訊息往來的會員）

```
node "${CLAUDE_PLUGIN_ROOT}/bin/oakmega-scrm.js" member list-recent-messaged [--days <1-7>]
```

- `--days`：選填，1~7，預設 1。
- `--workspace-id`：選填。

輸出格式依全域輸出規則決定。exit code 0 表示成功；非 0 表示失敗並印出錯誤。

---

### member list-recent-chatbot-triggered（最近觸發過 chatbot 的會員）

```
node "${CLAUDE_PLUGIN_ROOT}/bin/oakmega-scrm.js" member list-recent-chatbot-triggered [--days <1-7>]
```

- `--days`：選填，1~7，預設 7。
- `--workspace-id`：選填。

輸出格式依全域輸出規則決定。exit code 0 表示成功；非 0 表示失敗並印出錯誤。

---

### member list-recent-deeplink-clicked（最近點擊過追蹤連結的會員）

```
node "${CLAUDE_PLUGIN_ROOT}/bin/oakmega-scrm.js" member list-recent-deeplink-clicked [--days <1-7>]
```

- `--days`：選填，1~7，預設 7。
- `--workspace-id`：選填。

輸出格式依全域輸出規則決定。exit code 0 表示成功；非 0 表示失敗並印出錯誤。

---

### tag list-members-batch（批次取得多個會員的標籤）

```
node "${CLAUDE_PLUGIN_ROOT}/bin/oakmega-scrm.js" tag list-members-batch --member-ids <id1,id2,...>
```

- `--member-ids`：必填，逗號分隔的 workspace_member_id，1~20 人。
- `--workspace-id`：選填。

輸出格式依全域輸出規則決定。exit code 0 表示成功；非 0 表示失敗並印出錯誤。

---

### broadcast search（搜尋發文）

```
node "${CLAUDE_PLUGIN_ROOT}/bin/oakmega-scrm.js" broadcast search --start-dt <YYYY-MM-DD> --end-dt <YYYY-MM-DD>
```

- `--start-dt`：必填，搜尋起始日期（格式 YYYY-MM-DD）。
- `--end-dt`：必填，搜尋結束日期（格式 YYYY-MM-DD）。
- `--name`：選填，發文名稱關鍵字。
- `--limit`：選填，回傳筆數上限。
- `--workspace-id`：選填，覆蓋 config 中儲存的預設 workspace ID。

輸出格式依全域輸出規則決定。exit code 0 表示成功；非 0 表示失敗並印出錯誤。

---

### activity-log list-tag-changes（會員標籤異動紀錄）

```
node "${CLAUDE_PLUGIN_ROOT}/bin/oakmega-scrm.js" activity-log list-tag-changes --member-id <workspace_member_id> [--days <1-60>]
node "${CLAUDE_PLUGIN_ROOT}/bin/oakmega-scrm.js" activity-log list-tag-changes --member-ids <id1,id2,...> [--days <1-60>]
```

- `--member-id`：單一查詢（二擇一必填）。
- `--member-ids`：批次查詢，逗號分隔，CLI 內部依序打 API 並聚合結果（二擇一必填）。
- `--days`：選填，1~60，預設 60。
- `--workspace-id`：選填。

單一輸出：`result` 陣列，每筆含 `create_dt`、`action`（`UPDATE` | `DELETE`）、`source`、`operator_name`、`tag`（含 tag 名稱與分類）。最多 100 筆，依時間降冪。

批次輸出：`{"results": [{"workspace_member_id": 123, "result": [...]}, {"workspace_member_id": 999, "error": "not_in_workspace"}]}`

輸出格式依全域輸出規則決定。exit code 0 表示成功；非 0 表示失敗並印出錯誤。

---

### activity-log list-chatbot-triggers（會員 chatbot 觸發紀錄）

```
node "${CLAUDE_PLUGIN_ROOT}/bin/oakmega-scrm.js" activity-log list-chatbot-triggers --member-id <workspace_member_id> [--days <1-60>]
node "${CLAUDE_PLUGIN_ROOT}/bin/oakmega-scrm.js" activity-log list-chatbot-triggers --member-ids <id1,id2,...> [--days <1-60>]
```

- `--member-id`：單一查詢（二擇一必填）。
- `--member-ids`：批次查詢，逗號分隔（二擇一必填）。
- `--days`：選填，1~60，預設 60。
- `--workspace-id`：選填。

單一輸出：`result` 陣列，每筆含 `create_dt`、`bot_template_id`、`template_name`、`is_delete`。最多 100 筆，依時間降冪。

批次輸出：`{"results": [{"workspace_member_id": 123, "result": [...]}, ...]}`

輸出格式依全域輸出規則決定。exit code 0 表示成功；非 0 表示失敗並印出錯誤。

---

### activity-log list-deeplink-clicks（會員 deeplink 點擊紀錄）

```
node "${CLAUDE_PLUGIN_ROOT}/bin/oakmega-scrm.js" activity-log list-deeplink-clicks --member-id <workspace_member_id> [--days <1-60>]
node "${CLAUDE_PLUGIN_ROOT}/bin/oakmega-scrm.js" activity-log list-deeplink-clicks --member-ids <id1,id2,...> [--days <1-60>]
```

- `--member-id`：單一查詢（二擇一必填）。
- `--member-ids`：批次查詢，逗號分隔（二擇一必填）。
- `--days`：選填，1~60，預設 60。
- `--workspace-id`：選填。

單一輸出：`result` 陣列，每筆含 `create_dt`、`deep_link_id`、`deep_link_title`、`final_url`、`is_delete`。最多 100 筆，依時間降冪。

批次輸出：`{"results": [{"workspace_member_id": 123, "result": [...]}, ...]}`

輸出格式依全域輸出規則決定。exit code 0 表示成功；非 0 表示失敗並印出錯誤。
