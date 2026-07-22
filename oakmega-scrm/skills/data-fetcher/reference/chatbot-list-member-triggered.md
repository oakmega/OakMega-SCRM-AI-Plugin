## `chatbot list-member-triggered`

### CLI

```
chatbot list-member-triggered
  --member-id <id>        # 必填，會員 workspace_member_id
  --days <n>               # [🔯 選填] 往回查詢天數，1~60，預設 60
  --profile <workspace_id>     # [🔯 選填] 指定要用哪一組 profile
```

某會員最近 N 日觸發過的 chatbot 排行，依觸發次數降冪。

### Response `200 OK`

```json
{
  "result": [
    {
      "bot_template_id": 1,
      "template_name": "歡迎機器人",
      "trigger_count": 5,
      "last_triggered_dt": "2024-06-01 10:00:00"
    }
  ]
}
```

- 最多回傳 50 筆。
