> 同步自 OakMega-SCRM-Back/ai_agent/docs/agent_tools_api.md（2026-07-14）

## `deeplink list-member-clicked`

### CLI

```
deeplink list-member-clicked
  --member-id <id>        # 必填，會員 workspace_member_id
  --days <n>               # [🔯 選填] 往回查詢天數，1~60，預設 60
  --workspace-id <id>     # [🔯 選填] 指定 workspace
```

某會員最近 N 日點擊過的 deeplink 排行，依點擊次數降冪。結構同 workspace 排行。

### Response `200 OK`

```json
{
  "result": [
    {
      "deep_link_id": 10,
      "deep_link_dir_id": 2,
      "deep_link_dir_name": "夏季活動",
      "deep_link_title": "夏季特賣連結",
      "deep_link_desc": "描述文字",
      "deep_link_final_url": "https://example.com/summer",
      "click_count": 5,
      "last_clicked_dt": "2024-06-01 10:00:00"
    }
  ]
}
```

- 最多回傳 50 筆。
