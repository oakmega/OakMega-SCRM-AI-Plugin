## `statistics get-tag-member-count`

### CLI

```
statistics get-tag-member-count
  --tag-id <tag_id>         # 必填，標籤 id（可用 `tag search` 查詢取得）
  --dt <YYYY-MM-DD>         # [🔯 選填] 查詢日期，未提供則預設查今天
  --profile <workspace_id>       # [🔯 選填] 指定要用哪一組 profile；不帶則使用目前啟用中的 profile
```

取得指定標籤在某一天的累積貼標人數（截至該日為止，仍持有此標籤的人數）。`--tag-id` 不存在或不屬於該 workspace 時回 404。

### Response `200 OK`

```json
{
  "result": {
    "dt": "2024-05-01",
    "tag_member_count": 42
  }
}
```

- `tag_member_count` 為累積人數：查詢對象是「目前」仍持有此標籤的成員，若成員之後被移除標籤，其歷史累積數也不會回溯計入。
