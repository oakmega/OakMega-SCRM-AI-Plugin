> 同步自 OakMega-SCRM-Back/ai_agent/docs/agent_tools_api.md（2026-07-14）

## `activity-log list-tag-changes`

### CLI

```
activity-log list-tag-changes
  --member-id <id>    # 必填，會員 workspace_member_id
  --days <n>            # [🔯 選填] 往回查詢天數，1~60，預設 60
```

某會員最近 N 日的標籤異動逐筆紀錄，依時間降冪。對應後端 `GET .../activity-log/list-member-tag-changes/{workspace_member_id}/`。無批次版本（後端沒有對應的 batch endpoint），CLI 與 API 保持 1:1。

### Response `200 OK`

```json
{
  "result": [
    {
      "create_dt": "2024-06-01 10:00:00",
      // 1. UPDATE: 新增或更新 tag 2. DELETE: 移除 tag
      "action": "UPDATE",
      // tag 的數值，DELETE 時為 null
      "action_value": 1,
      // 觸發來源，無法對應時為 null
      "source": "CHATBOT",
      // 操作人員名稱，系統自動執行時為 null
      "operator_name": null,
      "tag": {
        "tag_id": 1,
        "tag_name": "VIP",
        "tag_dir_id": 5,
        "tag_dir_name": "等級",
        "tag_dir_color": "red",
        "is_delete": false
      }
    }
  ]
}
```

- 最多回傳 100 筆。
