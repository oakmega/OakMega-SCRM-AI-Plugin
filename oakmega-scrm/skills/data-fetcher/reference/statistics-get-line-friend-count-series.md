## `statistics get-line-friend-count-series`

### CLI

```
statistics get-line-friend-count-series
  --start-dt <YYYY-MM-DD>   # [🔯 選填] 查詢起始日期。需與 --end-dt 同時提供，否則 CLI 端會直接報錯；區間最長 100 天；都未提供則預設查最近 30 天
  --end-dt <YYYY-MM-DD>     # [🔯 選填] 查詢結束日期。需與 --start-dt 同時提供
  --profile <workspace_id>       # [🔯 選填] 指定要用哪一組 profile；不帶則使用目前啟用中的 profile
```

取得 workspace 逐日的 LINE 好友加入/封鎖數時序資料。

### Response `200 OK`

```json
{
  "result": [
    {
      // 日期，逐日遞增排序
      "dt": "2024-05-01",
      "line_join_count": 10,
      "line_block_count": 2,
      "line_net_count": 8
    }
  ]
}
```

- 回傳的日期序列連續不中斷，缺資料的日期各數值欄位補 `0`。
