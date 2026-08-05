## `member search`

### CLI

```
member search
  --search-by <name|workspace_member_id|uuid>   # 必填，搜尋方式
  --query <string>                               # 必填，搜尋字串，不可空白
  --profile <workspace_id>                            # [🔯 選填] 指定要搜尋的 workspace
```

後端 API 另外支援 `channel`（僅 `search_by=uuid` 時用來限定搜尋渠道，1. LINE 2. FB 3. IG 4. WHATSAPP）與 `limit`（回傳筆數上限，1~100，預設 50）兩個 query params，但目前 CLI 未曝露對應 flag。

### Response `200 OK`

```json
{
  "result": [
    {
      "workspace_member_id": 123,
      "display_name": "王小明",
      "real_name": "王小明",
      "profile_url": "https://...",
      "channels": [
        {
          // 1. LINE: LINE 2. FB: Facebook 3. IG: Instagram 4. WHATSAPP: WhatsApp
          "channel": "LINE",
          "social_media_member_id": 456,
          "uuid": "Uabc123",
          "service_list_id": 789
        }
      ]
    }
  ]
}
```

- 最多回傳 100 筆。
