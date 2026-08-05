## `service-center list-members-messages-batch`

### CLI

```
service-center list-members-messages-batch
  --social-media-member-ids <id1,id2,...>    # 必填，逗號分隔，最多 20 人，注意是渠道綁定 ID
  --profile <workspace_id>                          # [🔯 選填] 指定要用哪一組 profile
```

一次撈多個渠道成員的核心對話紀錄。相較單一查詢版本，**額外排除 TEMPLATE、chatbot 觸發訊息、broadcast**。

### Response `200 OK`

```json
{
  "results": [
    {
      "social_media_member_id": 456,
      "workspace_member_id": 123,
      "channel": "LINE",
      "messages": [
        {
          "message_id": "msg_abc",
          "message_dt": "2024-06-01 10:00:00",
          "msg_type": "TEXT",
          "message_data": { "text": "你好" },
          "is_template": false,
          "is_reply": false,
          "is_broadcast": false,
          "sender": "member",
          "message_status": null,
          "reply_to_origin_message": null
        }
      ]
    },
    {
      "social_media_member_id": 999,
      "error": "not_in_workspace"
    }
  ]
}
```

- 每人最多回傳 20 筆。
- 不屬於此 workspace 的 social_media_member_id 以 `error: "not_in_workspace"` 標記，不拋 404。
- 相較單一查詢版本額外排除：`TEMPLATE` msg_type、`is_template=true`（chatbot 觸發訊息）、`is_broadcast=true`（僅 LINE）。
