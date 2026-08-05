## `member list-recent-deeplink-clicked`

### CLI

```
member list-recent-deeplink-clicked
  --days <n>    # [🔯 選填] 往回查詢天數，1~7，預設 7
```

撈最近 N 日點擊過追蹤連結的會員，依點擊次數降冪。

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
      "click_count": 3,
      "clicked_deeplinks": [
        {
          "deep_link_id": 10,
          "deep_link_name": "夏季活動連結"
        }
      ]
    }
  ]
}
```

- 最多回傳 50 筆。
