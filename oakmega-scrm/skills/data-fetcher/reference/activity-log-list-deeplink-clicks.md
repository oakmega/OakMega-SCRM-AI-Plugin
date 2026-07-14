> 同步自 OakMega-SCRM-Back/ai_agent/docs/agent_tools_api.md（2026-07-14）

## `activity-log list-deeplink-clicks`

### CLI

```
activity-log list-deeplink-clicks
  --member-id <id>          # 與 --member-ids 二擇一，單一會員 workspace_member_id
  --member-ids <id1,id2>    # 與 --member-id 二擇一，逗號分隔，批次查詢
  --days <n>                 # [🔯 選填] 往回查詢天數，1~60，預設 60
```

某會員最近 N 日的 deeplink 點擊逐筆紀錄，依時間降冪。

**單一查詢**（`--member-id`）對應後端 `GET .../activity-log/list-member-deeplink-clicks/{workspace_member_id}/`，回傳如下：

### Response `200 OK`（單一）

```json
{
  "result": [
    {
      "create_dt": "2024-06-01 10:00:00",
      "deep_link_id": 10,
      "deep_link_title": "夏季特賣連結",
      "final_url": "https://example.com/summer",
      "is_delete": false
    }
  ]
}
```

- 最多回傳 100 筆。

**批次查詢**（`--member-ids`）由 CLI 對每個 id 呼叫上述單一 endpoint 並彙整，回傳 `{"results": [...]}`（複數 key），未在 `agent_tools_api.md` 找到對應的後端 batch endpoint，實際逐筆結構請以執行後的回傳為準，預期沿用其他 batch 指令的慣例（每筆含 `workspace_member_id` + `result` 或 `error: "not_in_workspace"`）。
