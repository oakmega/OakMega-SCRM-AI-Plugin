## `advanced-filter search`

### CLI

```
advanced-filter search
  --query <關鍵字>            # [🔯 選填] 名稱關鍵字，模糊比對，不帶則回全部
  --limit <n>                 # [🔯 選填] 回傳筆數上限，1~100，預設 50
  --profile <workspace_id>    # [🔯 選填] 指定要用哪一組 profile
```

依名稱模糊搜尋進階篩選（受眾篩選條件）。不回傳篩選條件內容。

### Response `200 OK`

```json
{
  "result": [
    {
      "id": 12,
      "name": "高活躍會員"
    }
  ]
}
```

- 最多回傳 100 筆。
