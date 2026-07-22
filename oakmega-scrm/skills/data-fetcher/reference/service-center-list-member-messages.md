## `service-center list-member-messages`

### CLI

```
service-center list-member-messages
  --social-media-member-id <id>    # 必填，注意是渠道綁定 ID（social_media_member_id），不是 workspace_member_id
  --profile <workspace_id>                # [🔯 選填] 指定要用哪一組 profile
```

取得單一渠道成員的對話紀錄。保留 TEMPLATE / chatbot 觸發 / broadcast 訊息，僅排除 webhook 事件與客服系統事件。

### Response `200 OK`

```json
{
  "social_media_member_id": 456,
  "workspace_member_id": 123,
  // 1. LINE: LINE 2. FB: Facebook 3. IG: Instagram 4. WHATSAPP: WhatsApp
  "channel": "LINE",
  "messages": [
    {
      "message_id": "msg_abc",
      "message_dt": "2024-06-01 10:00:00",
      "msg_type": "TEXT",
      // 訊息內容，格式依 msg_type 而異
      "message_data": { "text": "你好" },
      // 是否為 chatbot / template 觸發的訊息
      "is_template": false,
      // 是否為客服人員 / 系統回覆（非 member 發送）
      "is_reply": false,
      // 是否為群發訊息，僅 LINE 有意義
      "is_broadcast": false,
      // 1. member: 會員發送 2. user: 客服人員發送 3. bot: 系統/機器人發送
      "sender": "member",
      "message_status": null,
      // 被引用的原始訊息，不是引用回覆時為 null
      "reply_to_origin_message": null
    }
  ]
}
```

- 最多回傳 500 筆，依 id 降冪（最新的訊息在前）。
- 排除的 `msg_type`：`EVENT`、`FOLLOW`、`SHORTLINK`、`SERVICE`、`COMMENT_REPLY_BOT`。
- `reply_to_origin_message` 有值時結構如下：

```json
{
  "message_id": "msg_xyz",
  "msg_type": "TEXT",
  "message_data": { "text": "原始訊息" }
}
```
