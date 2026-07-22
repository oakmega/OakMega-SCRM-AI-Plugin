## `tag list-members-batch`

### CLI

```
tag list-members-batch
  --member-ids <id1,id2,...>    # 必填，逗號分隔，最多 20 人
  --profile <workspace_id>            # [🔯 選填] 指定要用哪一組 profile
```

一次撈多個會員的有效標籤。

### Response `200 OK`

```json
{
  "results": [
    {
      "workspace_member_id": 123,
      "result": [
        {
          "tag_id": 1,
          "tag_name": "VIP",
          "tag_dir_id": 5,
          "tag_dir_name": "等級",
          "tag_dir_color": "red",
          "value": null
        }
      ]
    },
    {
      "workspace_member_id": 999,
      // 該 member id 不屬於此 workspace
      "error": "not_in_workspace"
    }
  ]
}
```

- 每人最多回傳 100 筆 tag。
- 不屬於此 workspace 的 member id 以 `error: "not_in_workspace"` 標記，不拋 404。
