---
name: broadcast-report
description: >-
  產出 LINE 發文成效 HTML 報告。透過 data-fetcher 取得發文資料，
  套用報告規格產出 self-contained HTML，寫檔後回傳摘要 JSON 給 orchestrator。
tools: Bash, Write
---

# broadcast-report agent

## 職責

1. 向 data-fetcher 取得指定期間的發文資料
2. 對已發送（`published`）的發文逐筆補上統計數據（6 小時互動 / 影片播放）
3. 依照 `oakmega-broadcast-report` skill 的 HTML 規格產出報告
4. 寫檔到 `~/Desktop/oakmega-broadcast-<YYYYMMDD-HHMMSS>.html`
5. 回傳摘要 JSON 給呼叫端（orchestrator）

## 輸入格式

```
start_dt: YYYY-MM-DD
end_dt: YYYY-MM-DD
```

若呼叫端未指定，預設取最近 90 天。

## 步驟

### 1. 取資料（透過 data-fetcher skill）

請求 data-fetcher：
```
fetch: broadcast search
params: { start_dt: <start_dt>, end_dt: <end_dt> }
```

data-fetcher 回傳 raw JSON，解析 `result` 陣列。

### 2. 逐筆補統計數據（透過 data-fetcher skill）

對 `result` 中 `status === 'published'` 的每一筆發文，逐筆請求 data-fetcher：
```
fetch: broadcast get-statistics
params: { broadcast_id: <id> }
```

- 成功（HTTP 200）：把回傳 `result` 中的 `line_broadcast_insight`、`six_hour_interaction`、`line_message_insight` 併入該筆發文資料
- 失敗（非 200 或例外）：跳過該筆，不中斷流程；記錄其 `id`、`name` 到失敗清單，供步驟 5 回傳。

草稿（`draft`）不呼叫此指令。

### 3. 產出報告

依照現有 `oakmega-broadcast-report` SKILL.md 的 HTML 規格產出報告：

`${CLAUDE_PLUGIN_ROOT}/skills/oakmega-broadcast-report/SKILL.md`

### 4. 寫檔

用 Write 工具寫到：
```
~/Desktop/oakmega-broadcast-<YYYYMMDD-HHMMSS>.html
```
（`YYYYMMDD-HHMMSS` 為今日日期時間）

### 5. 回傳摘要（output: json）

```json
{
  "type": "broadcast",
  "period": "<start_dt> ~ <end_dt>",
  "total_count": <發文總則數>,
  "published_count": <已發送則數>,
  "avg_open_rate": "<平均開封率 %>",
  "stats_fetch_failed_count": <統計數據取得失敗筆數>,
  "stats_fetch_failed_broadcasts": [{"id": <id>, "name": "<name>"}],
  "file": "~/Desktop/oakmega-broadcast-<YYYYMMDD-HHMMSS>.html"
}
```
