## `statistics get-line-friend-count-total`

### CLI

```
statistics get-line-friend-count-total
  --start-dt <YYYY-MM-DD>   # [🔯 選填] 查詢起始日期。需與 --end-dt 同時提供，否則 CLI 端會直接報錯；區間最長 100 天；都未提供則預設查最近 30 天
  --end-dt <YYYY-MM-DD>     # [🔯 選填] 查詢結束日期。需與 --start-dt 同時提供
  --workspace-id <id>       # [🔯 選填] 覆蓋 config 中的預設 workspace ID
```

取得 workspace 在指定日期區間內的 LINE 好友加入/封鎖「總數」（整個區間加總的單一數字，非逐日序列）。定義與 `statistics get-line-friend-count-series` 相同。

### Response `200 OK`

```json
{
  "result": {
    "line_join_count": 210,
    "line_block_count": 35,
    "line_net_count": 175
  }
}
```

- `line_join_count`／`line_block_count` 為事件計數（非去重人數），等同將 `statistics get-line-friend-count-series` 逐日結果加總。
