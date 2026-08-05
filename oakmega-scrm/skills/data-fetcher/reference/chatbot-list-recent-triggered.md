## `chatbot list-recent-triggered`

### CLI

```
chatbot list-recent-triggered
  --days <n>              # [🔯 選填] 往回查詢天數，1~7，預設 7
  --profile <workspace_id>     # [🔯 選填] 指定要用哪一組 profile
```

workspace 內最近 N 日有被觸發過的 chatbot 排行，依觸發次數降冪。

### Response `200 OK`

```json
{
  "result": [
    {
      "bot_template_id": 1,
      "template_name": "歡迎機器人",
      "trigger_count": 120,
      "last_triggered_dt": "2024-06-01 10:00:00"
    }
  ]
}
```

- 最多回傳 50 筆。
