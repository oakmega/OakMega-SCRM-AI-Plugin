## `tag search`

### CLI

```
tag search
  --search-by <tag_dir_id|name>   # 必填，搜尋方式
  --query <值>                    # 必填，依 search-by 而定：
                                   #   tag_dir_id：單一資料夾 id，回該資料夾下所有標籤
                                   #   name：逗號分隔的名稱清單，完全相符，最多 20 個
  --limit <n>                     # [🔯 選填] 僅 --search-by=tag_dir_id 時有意義，回傳筆數上限，1~100，預設 50
  --profile <workspace_id>        # [🔯 選填] 指定要用哪一組 profile
```

搜尋標籤（不含已刪除的 tag / tag_dir）。`--search-by=tag_dir_id` 與 `--search-by=name` 為二擇一模式，不可同時使用。

### Response `200 OK`

```json
{
  "result": [
    {
      "tag_id": 1,
      "tag_name": "VIP",
      "tag_dir_id": 5,
      "tag_dir_name": "等級",
      // tag_dir 的顏色名稱，null 表示未設定顏色
      "tag_dir_color": "red"
    }
  ]
}
```

- `--search-by=tag_dir_id` 時，若該資料夾不存在或已刪除，回 404。
- `--search-by=name` 時，`--query` 最多 20 個名稱，不受 `--limit` 限制。
