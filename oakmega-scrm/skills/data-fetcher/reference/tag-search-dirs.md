## `tag search-dirs`

### CLI

```
tag search-dirs
  --query <關鍵字>            # [🔯 選填] 名稱關鍵字，模糊比對，不帶則回全部
  --limit <n>                 # [🔯 選填] 回傳筆數上限，1~100，預設 50
  --profile <workspace_id>    # [🔯 選填] 指定要用哪一組 profile
```

依名稱模糊搜尋標籤資料夾（不含已刪除的 tag_dir）。

### Response `200 OK`

```json
{
  "result": [
    {
      "tag_dir_id": 5,
      "tag_dir_name": "等級",
      // tag_dir 的顏色名稱，null 表示未設定顏色
      "tag_dir_color": "red"
    }
  ]
}
```

- 最多回傳 100 筆。
