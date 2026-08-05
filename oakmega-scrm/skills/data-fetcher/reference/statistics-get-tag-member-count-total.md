## `statistics get-tag-member-count-total`

### CLI

```
statistics get-tag-member-count-total
  --tag-id <tag_id>         # 必填，標籤 id（可用 `tag search` 查詢取得）
  --start-dt <YYYY-MM-DD>   # [🔯 選填] 查詢起始日期。需與 --end-dt 同時提供，否則 CLI 端會直接報錯；區間最長 100 天；都未提供則預設查最近 30 天
  --end-dt <YYYY-MM-DD>     # [🔯 選填] 查詢結束日期。需與 --start-dt 同時提供
  --profile <workspace_id>       # [🔯 選填] 指定要用哪一組 profile；不帶則使用目前啟用中的 profile
```

取得指定標籤在某時間區間內，起訖累積貼標人數與淨新增總量。`--tag-id` 不存在或不屬於該 workspace 時回 404。

### Response `200 OK`

```json
{
  "result": {
    // 截至 start_dt 當天（不含）之前的累積貼標人數
    "start_tag_member_count": 39,
    // 截至 end_dt 當天（含）為止的累積貼標人數
    "end_tag_member_count": 55,
    // 區間內淨新增的貼標人數，等於 end_tag_member_count - start_tag_member_count
    "tag_member_add_count": 16
  }
}
```
