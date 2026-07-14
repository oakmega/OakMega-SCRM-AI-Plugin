> 同步自 OakMega-SCRM-Back/ai_agent/docs/agent_tools_api.md（2026-07-14）

## `member list-recent-messaged`

### CLI

```
member list-recent-messaged
  --days <n>    # [🔯 選填] 往回查詢天數，1~7，預設 1
```

撈最近 N 日內有訊息往來的會員，依最後訊息時間降冪。

### Response `200 OK`

```json
{
  "result": [
    {
      "workspace_member_id": 123,
      "display_name": "王小明",
      "real_name": "王小明",
      "profile_url": null,
      "channels": [
        {
          "channel": "LINE",
          "social_media_member_id": 456,
          "uuid": "Uabc123",
          "service_list_id": 789
        }
      ],
      "last_msg_dt": "2024-06-01 10:00:00"
    }
  ]
}
```

- 最多回傳 200 筆。
