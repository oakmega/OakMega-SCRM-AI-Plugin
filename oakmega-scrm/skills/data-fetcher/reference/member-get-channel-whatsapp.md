## `member get-channel-whatsapp`

### CLI

```
member get-channel-whatsapp
  --member-id <id>    # 必填，會員 workspace_member_id
```

取得會員在 WhatsApp 的渠道綁定身分。**未綁定 WhatsApp 時回 404。** 結構同 FB，`channel` 固定為 `"WHATSAPP"`。

### Response `200 OK`

```json
{
  "workspace_member_id": 123,
  "channel": "WHATSAPP",
  "social_media_member_id": 456,
  "social_media_channel_id": 10,
  "social_media_channel_name": "官方帳號",
  "uuid": "abc123",
  "display_name": "王小明",
  "profile_url": "https://...",
  "is_available": true,
  "join_dt": "2024-01-01 00:00:00",
  "block_dt": null,
  "service_list_id": 789
}
```
