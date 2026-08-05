## `chatbot list-members-triggered-batch`

### CLI

```
chatbot list-members-triggered-batch
  --member-ids <id1,id2,...>    # 必填，逗號分隔，最多 20 人
  --days <n>                     # [🔯 選填] 往回查詢天數，1~60，預設 60；int 型別（非字串）
  --profile <workspace_id>            # [🔯 選填] 指定要用哪一組 profile
```

一次撈多個會員的 chatbot 觸發排行。

### Response `200 OK`

```json
{
  "results": [
    {
      "workspace_member_id": 123,
      "result": [
        {
          "bot_template_id": 1,
          "template_name": "歡迎機器人",
          "trigger_count": 5,
          "last_triggered_dt": "2024-06-01 10:00:00"
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
