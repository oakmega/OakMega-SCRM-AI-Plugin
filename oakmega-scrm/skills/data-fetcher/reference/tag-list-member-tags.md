## `tag list-member-tags`

### CLI

```
tag list-member-tags
  --member-id <id>       # 必填，會員 workspace_member_id
  --workspace-id <id>    # [🔯 選填] 指定 workspace
```

取得會員身上所有有效標籤（不含已刪除的 tag / tag_dir），依更新時間降冪。

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
      "tag_dir_color": "red",
      // tag 的數值，null 表示無數值
      "value": null
    }
  ]
}
```

- 最多回傳 100 筆。
