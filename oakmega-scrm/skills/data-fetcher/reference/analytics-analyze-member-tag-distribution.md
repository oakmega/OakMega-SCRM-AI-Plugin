## `analytics analyze-member-tag-distribution`

### CLI

```
analytics analyze-member-tag-distribution
  --advanced-filter-id <id>       # 必填，進階篩選 id
  --tag-ids <id1,id2,...>         # [🔯 選填] 逗號分隔，只分析這些標籤；不帶則回佔比最高前 20 個標籤
  --profile <workspace_id>        # [🔯 選填] 指定要用哪一組 profile
```

用進階篩選（Advanced Filter）篩出一批會員，分析這批會員的標籤分布。每個 workspace 限流每分鐘 1 次。

### Response `200 OK`

```json
{
  // 該進階篩選篩出的會員總數，即下方 percentage 的分母
  "matched_member_count": 1000,
  "result": [
    {
      "tag_id": 1,
      "tag_name": "VIP",
      // 篩出的會員中，有此標籤的人數
      "member_count": 300,
      // 0~100，四捨五入取 2 位小數
      "percentage": 30.0
    }
  ]
}
```

- `--advanced-filter-id` 不存在或不屬於此 workspace，回 404。
- 該進階篩選尚未有可用的篩選條件資料（例如舊資料尚未 backfill），回 400。
- `--tag-ids` 有帶：忽略不存在或不屬於此 workspace 的 id；即使某標籤完全沒人貼，仍回傳該筆（`member_count: 0, percentage: 0`）。
- `--tag-ids` 沒帶：回傳全 workspace 未刪除標籤中，`member_count > 0` 且佔比最高的前 20 個，依 `member_count` 降冪排序。
- `matched_member_count` 為 0 時，`result` 直接回空陣列。
