## `member list-recent-chatbot-triggered`

### CLI

```
member list-recent-chatbot-triggered
  --days <n>    # [🔯 選填] 往回查詢天數，1~7，預設 7
```

撈最近 N 日觸發過聊天機器人的會員，依觸發次數降冪。

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
      "trigger_count": 5,
      "triggered_templates": [
        {
          "bot_template_id": 1,
          "template_name": "歡迎機器人"
        }
      ]
    }
  ]
}
```

- 最多回傳 50 筆。
