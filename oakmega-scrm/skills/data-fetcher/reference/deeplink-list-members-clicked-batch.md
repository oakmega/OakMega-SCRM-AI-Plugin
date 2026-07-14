> 同步自 OakMega-SCRM-Back/ai_agent/docs/agent_tools_api.md（2026-07-14）

## `deeplink list-members-clicked-batch`

### CLI

```
deeplink list-members-clicked-batch
  --member-ids <id1,id2,...>    # 必填，逗號分隔，最多 20 人
  --days <n>                     # [🔯 選填] 往回查詢天數，1~60，預設 60；int 型別（非字串）
  --workspace-id <id>            # [🔯 選填] 指定 workspace
```

一次撈多個會員的 deeplink 點擊排行。

### Response `200 OK`

```json
{
  "results": [
    {
      "workspace_member_id": 123,
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
    },
    {
      "workspace_member_id": 999,
      "error": "not_in_workspace"
    }
  ]
}
```

- 每人最多回傳 20 筆。
- 不屬於此 workspace 的 member id 以 `error: "not_in_workspace"` 標記，不拋 404。
