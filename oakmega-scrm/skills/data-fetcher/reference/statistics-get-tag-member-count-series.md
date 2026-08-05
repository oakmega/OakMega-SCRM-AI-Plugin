## `statistics get-tag-member-count-series`

### CLI

```
statistics get-tag-member-count-series
  --tag-id <tag_id>         # 必填，標籤 id（可用 `tag search` 查詢取得）
  --start-dt <YYYY-MM-DD>   # [🔯 選填] 查詢起始日期。需與 --end-dt 同時提供，否則 CLI 端會直接報錯；區間最長 100 天；都未提供則預設查最近 30 天
  --end-dt <YYYY-MM-DD>     # [🔯 選填] 查詢結束日期。需與 --start-dt 同時提供
  --profile <workspace_id>       # [🔯 選填] 指定要用哪一組 profile；不帶則使用目前啟用中的 profile
```

取得指定標籤在某時間區間內，逐日的累積貼標人數與當日新增貼標人數。`--tag-id` 不存在或不屬於該 workspace 時回 404。

### Response `200 OK`

```json
{
  "result": [
    {
      // 日期，逐日遞增排序
      "dt": "2024-05-01",
      // 截至當日為止的累積貼標人數
      "tag_member_count": 42,
      // 當日新增的貼標人數
      "tag_member_add_count": 3
    }
  ]
}
```

- `tag_member_count` 定義與 `statistics get-tag-member-count` 相同。
- 回傳的日期序列連續不中斷，缺資料的日期 `tag_member_add_count` 補 `0`。
