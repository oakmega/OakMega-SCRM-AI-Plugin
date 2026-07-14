> 同步自 OakMega-SCRM-Back/ai_agent/docs/agent_tools_api.md（2026-07-14）

## `broadcast get-statistics`

### CLI

```
broadcast get-statistics
  --broadcast-id <id>    # 必填
```

取得單一發文完整的 LINE 官方 insight 數據（開封、點擊、6 小時互動、訊息層級播放數據）。資料來源含 R2 即時查詢，成本較高，**僅適合針對單筆發文查詢，不要用於大量迴圈**。

### Response `200 OK`

```json
{
  "result": {
    "line_broadcast_insight": {
      "unique_impression": 500,
      "unique_impression_rate": 0.5,
      "unique_click": 120,
      "unique_click_rate": 0.24,
      "click": 150
    },
    "six_hour_interaction": {
      "adds": 10,
      "blocks": 2,
      "interactions": 80,
      "unique_interactors": 60,
      "contribution": 8
    },
    // 依訊息序號（seq）逐一列出，僅影片 / 圖文影片訊息會有播放相關數據
    "line_message_insight": [
      {
        "seq": 1,
        "insight": {}
      }
    ]
  }
}
```

- 找不到發文（不存在 / 已刪除 / 非好友發文）回傳 `404`。
- 資料來源為 R2，若尚未產生對應資料，`line_broadcast_insight` 相關數值可能為 `null`。
