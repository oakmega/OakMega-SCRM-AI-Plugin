## `member get-basic-info`

### CLI

```
member get-basic-info
  --member-id <id>       # 必填，會員 workspace_member_id
  --profile <workspace_id>    # [🔯 選填] 指定要用哪一組 profile
```

取得會員主表欄位、自訂欄位、各渠道是否綁定。不含 tag 與渠道明細（渠道明細請用 `member get-channel-*`）。

### Response `200 OK`

```json
{
  "workspace_member_id": 123,
  "display_name": "王小明",
  "real_name": "王小明",
  "profile_url": "https://...",
  // 1. M: 男 2. F: 女 3. O: 其他
  "gender": "M",
  "gender_label": "男",
  // 格式 YYYY-MM-DD
  "birthday": "1990-01-01",
  "cellphone": "0912345678",
  "phone_e164": "+886912345678",
  "is_phone_e164_verified": true,
  "email": "user@example.com",
  "is_email_verified": false,
  "address": "台北市...",
  "memo": "備註",
  "total_point": 100,
  "blocked_member": false,
  "create_dt": "2024-01-01 00:00:00",
  "update_dt": "2024-06-01 00:00:00",
  "extra_columns": [
    {
      "col_key": "col_1",
      "col_name": "自訂欄位A",
      // workspace 設定的欄位型別，null 表示未設定
      "col_type": "text",
      "col_value": "值"
    }
  ],
  "channel_presence": {
    "line": true,
    "fb": false,
    "ig": false,
    "whatsapp": false
  }
}
```
