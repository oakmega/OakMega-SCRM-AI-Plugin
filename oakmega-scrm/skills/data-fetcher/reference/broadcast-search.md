## `broadcast search`

### CLI

```
broadcast search
  --start-dt <YYYY-MM-DD>   # 必填，查詢起始日期（Taipei 時區）；對應後端 broadcast_start_dt，需與 --end-dt 同時提供，否則 417
  --end-dt <YYYY-MM-DD>     # 必填，查詢結束日期（Taipei 時區）；對應後端 broadcast_end_dt，需與 --start-dt 同時提供
  --name <keyword>          # [🔯 選填] 依發文名稱模糊搜尋；對應後端 broadcast_name
  --limit <n>                # [🔯 選填] 回傳筆數上限，1~100，預設 50
```

依 `broadcast_dt` 降冪排序搜尋發文。

### Response `200 OK`

```json
{
  "result": [
    {
      "id": 123,
      "name": "母親節優惠",
      "broadcast_dt": "2024-05-01 10:00:00",
      "is_draft": false,
      "is_published": true,
      "broadcast_result_code": 200,
      // 1. draft: 草稿 2. publishing: 發送中 3. scheduled: 排程中 4. published: 已發送 5. failed: 發送失敗
      "status": "published",
      "audience_target_count": {
        // 1. point: 精確人數 2. range: 區間人數
        "type": "point",
        "point": 1000
      },
      "left_preview_img_url": "https://...",
      "right_preview_img_url": "https://...",
      // 受眾條件，結構依 source/type 而異（LINE 全部好友、LINE Demographic、LINE Audience、OakMega 分眾 tag、LINE 群組...），此處僅列一種代表性結構
      "audience_target": {
        "source": "line",
        "type": "all"
      },
      // 發文訊息內容，結構依訊息型態（文字/圖片/影片/圖文選單...）而異
      "message_dict": {},
      "broadcaster": "王小明"
    }
  ]
}
```

- 最多回傳 100 筆。
- 不含 `line_broadcast_insight`、`six_hour_interaction`、`line_message_insight`（開封/點擊/6 小時互動/訊息層級播放數據），這些欄位僅在 `broadcast get-statistics` 才會回傳，需針對想要的發文另外逐筆呼叫。
