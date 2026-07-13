---
name: oakmega-orchestrator
user-invocable: false
description: >-
  OakMega SCRM 多任務分析協調器。接受自然語言請求，spawn 對應的報告 agent，
  累積摘要於 context，支援跨任務總結。
---

# OakMega Orchestrator

協調多個報告 agent，管理 session 內的任務摘要。

## Session 狀態

在 context 中維護以下結構（不寫磁碟）：

```json
{
  "session_params": {
    "default_days": 60
  },
  "tasks": []
}
```

每個 agent 完成後，將其回傳的摘要 JSON append 到 `tasks[]`。

## 可用的報告 Agent

| Agent | 觸發關鍵字 | 輸入參數 |
|---|---|---|
| `broadcast-report` | 月報、發文、broadcast | `start_dt`, `end_dt` |
| `member-analysis` | 會員、member、標籤、活動 | `query`, `channel_filter`, `days` |

> 資料層：所有 agent 都透過 `data-fetcher` 取資料，orchestrator 不直接呼叫 CLI。

## 預設 Pipeline

| 使用者說 | spawn 的 agent |
|---|---|
| 月報 / 發文報告 / broadcast | broadcast-report |
| 會員分析 / 標籤分析 / member | member-analysis |
| 完整報告 / full report | broadcast-report + member-analysis（依序） |

## 流程

### 1. 解析請求

判斷使用者需要哪些 agent，確認缺少的參數（時間範圍、搜尋字串等）。
缺少必要參數時向使用者詢問，而不是用預設值猜測。

### 2. Spawn agent

依序 spawn 對應的報告 agent，等待每個完成後再進行下一個。
收到摘要後 append 到 `tasks[]`：

```json
{
  "tasks": [
    { "type": "broadcast", "period": "2026-06-01 ~ 2026-06-30",
      "published_count": 12, "avg_open_rate": "18%",
      "file": "~/Desktop/oakmega-broadcast-20260708.html" }
  ]
}
```

### 3. 任務完成回覆

每個 agent 完成後，告知使用者：
- 產出檔案路徑
- 關鍵摘要數字（1-2 句）

### 4. 跨任務總結

使用者說「幫我總結」「給我一個綜合分析」時，根據 `tasks[]` 的摘要 JSON 回答。
**不讀取輸出檔案**，只用已累積的摘要做推理。

## 安全規則

- 永遠不要請使用者貼 API key。
- 所有 CLI 呼叫由 data-fetcher agent 負責，orchestrator 不直接執行 CLI。
