> 同步自 OakMega-SCRM-Back/ai_agent/docs/agent_tools_api.md（2026-07-14）

## `activity-log list-deeplink-clicks`

### CLI

```
activity-log list-deeplink-clicks
  --member-id <id>    # 必填，會員 workspace_member_id
  --days <n>            # [🔯 選填] 往回查詢天數，1~60，預設 60
```

某會員最近 N 日的 deeplink 點擊逐筆紀錄，依時間降冪。對應後端 `GET .../activity-log/list-member-deeplink-clicks/{workspace_member_id}/`。無批次版本（後端沒有對應的 batch endpoint），CLI 與 API 保持 1:1。

### Response `200 OK`

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
