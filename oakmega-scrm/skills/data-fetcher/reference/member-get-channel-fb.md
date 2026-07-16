## `member get-channel-fb`

### CLI

```
member get-channel-fb
  --member-id <id>    # 必填，會員 workspace_member_id
```

取得會員在 Facebook 的渠道綁定身分。**未綁定 FB 時回 404。**

### Response `200 OK`

```json
{
  "workspace_member_id": 123,
  "channel": "FB",
  "social_media_member_id": 456,
  "social_media_channel_id": 10,
  "social_media_channel_name": "粉絲專頁",
  "uuid": "PSIDabc123",
  "display_name": "王小明",
  "profile_url": "https://...",
  "is_available": true,
  "join_dt": "2024-01-01 00:00:00",
  "block_dt": null,
  "service_list_id": 789
}
```
