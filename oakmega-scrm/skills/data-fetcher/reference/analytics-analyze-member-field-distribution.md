## `analytics analyze-member-field-distribution`

### CLI

```
analytics analyze-member-field-distribution
  --advanced-filter-id <id>       # 必填，進階篩選 id
  --profile <workspace_id>        # [🔯 選填] 指定要用哪一組 profile
```

用進階篩選（Advanced Filter）篩出一批會員，分析這批會員在會員主表欄位上的分布：傳訊狀態、是否有真實名稱、是否有信箱、性別、是否有生日、是否有電話、是否有地址。每個 workspace 限流每分鐘 1 次。

### Response `200 OK`

```json
{
  // 該進階篩選篩出的會員總數，即下方 percentage 的分母
  "matched_member_count": 1000,
  "fields": {
    // 傳訊狀態：available = 至少一個已串接 channel（LINE/FB/IG/WhatsApp）可正常傳訊；unavailable = 全部已封鎖或未串接任何 channel
    "messaging_status": [
      {"key": "available", "count": 880, "percentage": 88.0},
      {"key": "unavailable", "count": 120, "percentage": 12.0}
    ],
    // 是否有真實名稱
    "has_real_name": [
      {"key": "yes", "count": 800, "percentage": 80.0},
      {"key": "no", "count": 200, "percentage": 20.0}
    ],
    // 是否有信箱
    "has_email": [
      {"key": "yes", "count": 400, "percentage": 40.0},
      {"key": "no", "count": 600, "percentage": 60.0}
    ],
    // 是否有生日
    "has_birthday": [
      {"key": "yes", "count": 300, "percentage": 30.0},
      {"key": "no", "count": 700, "percentage": 70.0}
    ],
    // 是否有電話（一般電話與國際碼電話任一有值即算有）
    "has_phone": [
      {"key": "yes", "count": 900, "percentage": 90.0},
      {"key": "no", "count": 100, "percentage": 10.0}
    ],
    // 是否有地址
    "has_address": [
      {"key": "yes", "count": 50, "percentage": 5.0},
      {"key": "no", "count": 950, "percentage": 95.0}
    ],
    // 性別，四個 bucket 加總等於 matched_member_count
    "gender": [
      {"key": "none", "count": 100, "percentage": 10.0},
      {"key": "male", "count": 400, "percentage": 40.0},
      {"key": "female", "count": 450, "percentage": 45.0},
      {"key": "other", "count": 50, "percentage": 5.0}
    ]
  }
}
```

- `--advanced-filter-id` 不存在或不屬於此 workspace，回 404。
- 該進階篩選尚未有可用的篩選條件資料（例如舊資料尚未 backfill），回 400。
- 「是否有真實名稱／信箱／電話／地址」的判斷排除 `null` 也排除空字串。
- `matched_member_count` 為 0 時，`fields` 直接回空物件。
