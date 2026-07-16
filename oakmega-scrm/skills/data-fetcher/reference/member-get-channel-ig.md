## `member get-channel-ig`

### CLI

```
member get-channel-ig
  --member-id <id>    # 必填，會員 workspace_member_id
```

取得會員在 Instagram 的渠道綁定身分。**未綁定 IG 時回 404。** 結構同 FB，額外有 `ig_username`。

### Response `200 OK`

```json
{
  "workspace_member_id": 123,
  "channel": "IG",
  "social_media_member_id": 456,
  "social_media_channel_id": 10,
  "social_media_channel_name": "IG 帳號",
  "uuid": "IGIDabc123",
  "display_name": "王小明",
  "profile_url": "https://...",
  "is_available": true,
  "join_dt": "2024-01-01 00:00:00",
  "block_dt": null,
  "service_list_id": 789,
  "ig_username": "wang_xiaoming"
}
```
