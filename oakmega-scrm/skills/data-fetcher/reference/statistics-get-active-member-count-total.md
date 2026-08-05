## `statistics get-active-member-count-total`

### CLI

```
statistics get-active-member-count-total
  --start-dt <YYYY-MM-DD>   # [🔯 選填] 查詢起始日期。需與 --end-dt 同時提供，否則 CLI 端會直接報錯；區間最長 100 天；都未提供則預設查最近 30 天
  --end-dt <YYYY-MM-DD>     # [🔯 選填] 查詢結束日期。需與 --start-dt 同時提供
  --profile <workspace_id>       # [🔯 選填] 指定要用哪一組 profile；不帶則使用目前啟用中的 profile
```

取得 workspace 在指定日期區間內的活躍會員「總數」（整個區間去重的單一數字，非逐日序列）。活躍會員定義與 `statistics get-active-member-count-series` 相同：有傳訊息到平台的會員，不含僅點擊 deep link 的會員。

### Response `200 OK`

```json
{
  "result": {
    "active_member_count": 128
  }
}
```

- `active_member_count` 為整個區間內不重複活躍會員數，不等於將 `statistics get-active-member-count-series` 逐日結果加總（同一會員跨日活躍只計一次）。
