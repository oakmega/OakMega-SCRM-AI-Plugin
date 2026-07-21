## `statistics list-broadcast-six-hour-interaction-batch`

### CLI

```
statistics list-broadcast-six-hour-interaction-batch
  --broadcast-ids <id1,id2,...>    # 必填，逗號分隔，最多 20 筆
  --workspace-id <id>               # [🔯 選填] 指定 workspace
```

批次取得多筆發文的 6 小時互動數據（發文後 6 小時內的好友加入/封鎖/互動數）。

### Response `200 OK`

```json
{
  "results": [
    {
      "broadcast_id": 123,
      "six_hour_interaction": {
        "adds": 10,
        "blocks": 2,
        "interactions": 80,
        "unique_interactors": 60,
        "contribution": 8
      }
    }
  ]
}
```

- 不存在 / 已刪除 / 非好友發文 / 不屬於此 workspace 的 broadcast id，直接從 `results` 省略，不會回傳該筆、也不回傳錯誤標記。若請求的 `--broadcast-ids` 數量與回傳的 `results` 筆數不一致，代表其中有 id 屬於這種情況。
