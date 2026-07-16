## `statistics get-active-member-count-series`

### CLI

```
statistics get-active-member-count-series
  --start-dt <YYYY-MM-DD>   # [🔯 選填] 查詢起始日期。需與 --end-dt 同時提供，否則 CLI 端會直接報錯；區間最長 90 天；都未提供則預設查最近 30 天
  --end-dt <YYYY-MM-DD>     # [🔯 選填] 查詢結束日期。需與 --start-dt 同時提供
  --workspace-id <id>       # [🔯 選填] 覆蓋 config 中的預設 workspace ID
```

取得 workspace 逐日的活躍會員數時序資料。活躍會員定義為有傳訊息到平台的會員，不含僅點擊 deep link 的會員。

### Response `200 OK`

```json
{
  "result": [
    {
      // 日期，逐日遞增排序
      "dt": "2024-05-01",
      "active_member_count": 42
    }
  ]
}
```

- 回傳的日期序列連續不中斷，缺資料的日期補 `0`。
