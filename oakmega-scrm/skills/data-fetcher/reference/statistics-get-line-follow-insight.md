## `statistics get-line-follow-insight`

### CLI

```
statistics get-line-follow-insight
  --date <YYYY-MM-DD>       # 必填，查詢日期
  --workspace-id <id>       # [🔯 選填] 覆蓋 config 中的預設 workspace ID
```

取得 workspace 所串接 LINE 官方帳號在指定日期的 follow insight（追蹤者洞察數據）。**workspace 尚未串接 LINE 官方帳號時回 404；`--date` 為未來日期時回 417。**

### Response `200 OK`

```json
{
  "result": {
    // 該日追蹤者數
    "followers": 1000,
    // 該日排除封鎖用戶後的目標觸及人數
    "targetedReaches": 950,
    // 該日封鎖用戶數
    "blocks": 50
  }
}
```

- 資料來自 LINE Messaging API 並以小時為單位快取。
- 該日 LINE 官方帳號尚未產生 insight 資料時（通常為當日或過早日期），`result` 回傳空物件 `{}`。
