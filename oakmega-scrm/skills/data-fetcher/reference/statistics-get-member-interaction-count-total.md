## `statistics get-member-interaction-count-total`

### CLI

```
statistics get-member-interaction-count-total
  --start-dt <YYYY-MM-DD>   # [🔯 選填] 查詢起始日期。需與 --end-dt 同時提供，否則 CLI 端會直接報錯；區間最長 100 天；都未提供則預設查最近 30 天
  --end-dt <YYYY-MM-DD>     # [🔯 選填] 查詢結束日期。需與 --start-dt 同時提供
  --profile <workspace_id>       # [🔯 選填] 指定要用哪一組 profile；不帶則使用目前啟用中的 profile
```

取得 workspace 在指定日期區間內的會員互動「總數」（傳訊息數、追蹤連結點擊數，整個區間加總的單一數字，非逐日序列）。定義與 `statistics get-member-interaction-count-series` 相同。

### Response `200 OK`

```json
{
  "result": {
    "message_count": 620,
    "click_count": 88
  }
}
```

- `message_count`／`click_count` 為事件計數（非去重人數），等同將 `statistics get-member-interaction-count-series` 逐日結果加總。
- `message_count` 僅計算會員發送給 bot 的訊息，不含 bot 回覆的訊息。
