## `statistics get-workspace-member-overview`

### CLI

```
statistics get-workspace-member-overview
  --workspace-id <id>    # [🔯 選填] 覆蓋 config 中的預設 workspace ID
```

取得 workspace 整體的會員/好友概況數據。

### Response `200 OK`

```json
{
  "result": {
    "bot_member_count": 1000,
    "active_line_member_count": 800,
    "leave_line_member_count": 200,
    // 百分比數值，保留 2 位小數
    "line_block_rate": 20.0
  }
}
```

- `active_line_member_count`、`leave_line_member_count`、`line_block_rate` 取自 LINE 官方帳號好友數快取；workspace 尚未串接 LINE 官方帳號時，這三個欄位固定回傳 `0`。
