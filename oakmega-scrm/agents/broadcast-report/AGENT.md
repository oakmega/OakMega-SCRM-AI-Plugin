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
2. 依照 `oakmega-broadcast-report` skill 的 HTML 規格產出報告
3. 寫檔到 `~/Desktop/oakmega-broadcast-<YYYYMMDD-HHMMSS>.html`
4. 回傳摘要 JSON 給呼叫端（orchestrator）

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

### 2. 產出報告

依照現有 `oakmega-broadcast-report` SKILL.md 的 HTML 規格產出報告：

`${CLAUDE_PLUGIN_ROOT}/skills/oakmega-broadcast-report/SKILL.md`

### 3. 寫檔

用 Write 工具寫到：
```
~/Desktop/oakmega-broadcast-<YYYYMMDD-HHMMSS>.html
```
（`YYYYMMDD-HHMMSS` 為今日日期時間）

### 4. 回傳摘要（output: json）

```json
{
  "type": "broadcast",
  "period": "<start_dt> ~ <end_dt>",
  "total_count": <發文總則數>,
  "published_count": <已發送則數>,
  "avg_open_rate": "<平均開封率 %>",
  "file": "~/Desktop/oakmega-broadcast-<YYYYMMDD-HHMMSS>.html"
}
```
