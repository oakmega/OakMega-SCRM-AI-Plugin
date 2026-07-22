## `statistics search-broadcast-six-hour-interaction`

### CLI

```
statistics search-broadcast-six-hour-interaction
  --start-dt <YYYY-MM-DD>   # [🔯 選填] 查詢起始日期（Taipei 時區）。需與 --end-dt 同時提供，否則 417；區間最長 100 天；都未提供則預設查最近 30 天
  --end-dt <YYYY-MM-DD>     # [🔯 選填] 查詢結束日期（Taipei 時區）。需與 --start-dt 同時提供
  --limit <n>                # [🔯 選填] 回傳筆數上限，1~100，預設 50
  --workspace-id <id>        # [🔯 選填] 指定 workspace
```

依日期區間取得多筆發文的 6 小時互動數據，依 `broadcast_dt` 降冪排序。

### Response `200 OK`

```json
{
  "result": [
    {
      "broadcast_id": 123,
      "six_hour_interaction": {
        "adds": 10,
        "blocks": 2,
        "interactions": 80,
        "unique_interactors": 60,
        "contribution": 8
      }
    }
  ]
}
```

- 最多回傳 100 筆。
