## `broadcast search`

### CLI

```
broadcast search
  --start-dt <YYYY-MM-DD>   # 必填，查詢起始日期（Taipei 時區）；對應後端 broadcast_start_dt，需與 --end-dt 同時提供，否則 417；區間最長 100 天
  --end-dt <YYYY-MM-DD>     # 必填，查詢結束日期（Taipei 時區）；對應後端 broadcast_end_dt，需與 --start-dt 同時提供
  --name <keyword>          # [🔯 選填] 依發文名稱模糊搜尋；對應後端 broadcast_name
  --limit <n>                # [🔯 選填] 回傳筆數上限，1~100，預設 50
```

依 `broadcast_dt` 降冪排序搜尋發文。

### Response `200 OK`

```json
{
  "result": [
    {
      "id": 123,
      "name": "母親節優惠",
      "broadcast_dt": "2024-05-01 10:00:00",
      "is_draft": false,
      "is_published": true,
      "broadcast_result_code": 200,
      // 1. draft: 草稿 2. publishing: 發送中 3. scheduled: 排程中 4. published: 已發送 5. failed: 發送失敗
      "status": "published",
      "audience_target_count": {
        // 1. point: 精確人數 2. range: 區間人數
        "type": "point",
        "point": 1000
      },
      // 受眾條件，結構依 source/type 而異（LINE 全部好友、LINE Demographic、LINE Audience、OakMega 分眾 tag、LINE 群組...），此處僅列一種代表性結構
      "audience_target": {
        "source": "line",
        "type": "all"
      },
      // 發文訊息內容（已將 CMS 範本訊息展開為實際內容的版本），結構依訊息型態而異；
      // 文字中的 {name} 等個人化變數不會在此被替換。完整欄位規格見下方「expanded_message_dict.contents 各 msg_type 規格」
      "expanded_message_dict": {
        "contents": [
          {"msg_type": "TEXT", "data": "歡迎光臨本次活動！"},
          {"msg_type": "IMAGE", "data": {"img_url": "https://...", "preview": "https://..."}}
        ],
        "has_quickreply": false,
        "qr_data": [],
        "reaction": {}
      },
      "line_broadcast_insight": {
        "unique_impression": 500,
        "unique_impression_rate": 0.5,
        "unique_click": 120,
        "unique_click_rate": 0.24,
        "click": 150
      },
      // 依訊息序號（seq）逐一列出，僅影片 / 圖文影片訊息會有播放相關數據
      "line_message_insight": [
        {
          "seq": 1,
          "insight": {}
        }
      ],
      "broadcaster": "王小明"
    }
  ]
}
```

- 最多回傳 100 筆。
- 資料來源含 R2 查詢（`line_broadcast_insight`／`line_message_insight`），若尚未產生對應資料，相關數值可能為 `null`。
- 不含 `six_hour_interaction`（6 小時互動數據），需另外呼叫 `statistics list-broadcast-six-hour-interaction-batch`（已知的一批 broadcast id）或 `statistics search-broadcast-six-hour-interaction`（同一段日期區間）補上。

### `expanded_message_dict.contents` 各 `msg_type` 規格

> 以下僅涵蓋 broadcast 合法的 12 種 `msg_type`（不含 `FUNCTION`，該型態僅用於 chatbot，不會出現在發文訊息中）。每個 `contents[i]` 的共同外層結構為 `{"msg_type": <型態>, "data": <依型態而異>}`。

- **TEXT（文字訊息）**
  ```json
  { "msg_type": "TEXT", "data": "文字內容，1~4000 字" }
  ```

- **IMAGE（圖片訊息）**
  ```json
  { "msg_type": "IMAGE", "data": { "img_url": "https://...", "preview": "https://..." } }
  ```

- **VIDEO（影片訊息）**
  ```json
  { "msg_type": "VIDEO", "data": { "video_url": "https://...", "thumbnail_url": "https://..." } }
  ```

- **AUDIO（語音訊息）**
  ```json
  {
    "msg_type": "AUDIO",
    "data": {
      "audio_url": "https://...",
      "duration": 60000,        // 毫秒
      "duration_min": "1:00"    // 分:秒 顯示用字串
    }
  }
  ```

- **STICKER（貼圖訊息）**
  ```json
  { "msg_type": "STICKER", "data": { "package_id": "1", "sticker_id": "1" } }
  ```

- **RICHVIDEO（進階影片）**
  ```json
  {
    "msg_type": "RICHVIDEO",
    "data": {
      "alt_text": "...",       // 1~100 字
      "video_url": "https://...",
      "thumbnail_url": "https://...",
      "image_url": "https://...",  // 影片播畢後顯示的圖文選單底圖
      "label": "了解更多",      // ≤20 字，外部連結按鈕文字
      "url": "https://...",     // 外部連結按鈕網址
      "height": 1040,
      "width": 1040
    }
  }
  ```

- **IMAGEMAP（圖文選單）**
  ```json
  {
    "msg_type": "IMAGEMAP",
    "data": {
      "alt_text": "...",         // 1~100 字
      "image_url": "https://...",
      "imagemap_type": 3,        // 3:1x1 0:2x2 2:3x2 1:4x1（區塊數與版型）
      "height": 1040,
      "width": 1040,
      "actions": [
        { "action": "URL", "data": "https://..." }
        // action="TEXT" 時 data 改為要傳送的文字（≤40 字）；action="NONE" 時該區塊不觸發任何動作，data 不使用
      ]
    }
  }
  ```

- **FLEXM（多頁訊息）**
  ```json
  {
    "msg_type": "FLEXM",
    "data": {
      "alt_text": "...",   // 1~100 字
      "preview": "https://...",  // [🔯 選填]
      "cards": [            // 1~10 張
        {
          "url": "https://...",
          "title": "...",              // ≤100 字
          "desc": "...",               // ≤500 字
          "content_text_color": "#000000",
          "background_color": "#FFFFFF",
          "hero_animated": false,
          "price": "$100",             // ≤20 字
          "slogan": "限時優惠",         // [🔯 選填] ≤20 字
          "slogan_color": "#FFFFFF",
          "slogan_text_color": "#000000",
          "height": 1040,
          "width": 1040,
          "buttons": [                 // ≤10 個
            { "action": "TEXT", "label": "...", "data": "...", "button_text_color": "#000000", "button_color": "#FFFFFF" }
            // action="URL" 時 data 改為連結網址（label/button_text_color/button_color 欄位相同，皆 ≤40 字）
          ]
        }
      ]
    }
  }
  ```

- **FLEXS（多圖訊息）**
  ```json
  {
    "msg_type": "FLEXS",
    "data": {
      "alt_text": "...",   // 1~100 字
      "preview": "https://...",  // [🔯 選填]
      "cards": [            // 1~10 張
        {
          "url": "https://...",
          "slogan": "限時優惠",   // ≤20 字
          "slogan_color": "#FFFFFF",
          "slogan_text_color": "#000000",
          "height": 1040,
          "width": 1040,
          "action": "URL",       // NONE / TEXT / URL
          "data": "https://...", // action="TEXT" 時為文字（≤40 字）；action="NONE" 時不使用
          "buttons": [           // 最多 1 個，結構同 FLEXM buttons（無 hero_animated）
            { "action": "TEXT", "label": "...", "data": "...", "button_text_color": "#000000", "button_color": "#FFFFFF" }
          ]
        }
      ]
    }
  }
  ```

- **FLEX（卡片訊息）**
  ```json
  {
    "msg_type": "FLEX",
    "data": {
      "alt_text": "...",    // 1~100 字
      "title": "...",       // 1~100 字
      "description": "...", // 1~100 字
      "hero_url": "https://...",  // 空字串 "" 代表不顯示圖片
      "preview": "https://...",   // [🔯 選填]
      "blocks": [            // 1~3 個
        {
          "n": 1,             // 1 或 3，該區塊按鈕排版
          "data": [
            { "action": "URL", "data": "https://...", "url": "https://..." }
            // data 為連結網址、url 為按鈕圖片網址；action="NONE" 時 data/url 皆為空字串 ""
          ]
        }
      ]
    }
  }
  ```

- **CHARGE（進階模組）**
  > ℹ️ 不會被 `expanded_message_dict` 展開，會原樣保留。
  ```json
  {
    "msg_type": "CHARGE",
    "data": {
      "charge_id": 1,
      "data_ds_key": "...",
      "msg_count": 1,
      "refer_point": 1,     // 發文情境下固定為 1
      "preview": "https://..."
    }
  }
  ```

- **CMS（範本訊息）**
  > ⚠️ 實際回傳的 `expanded_message_dict` 中，此類型項目會被範本實際內容（一組或多組其他 `msg_type` 項目）取代，只有當範本資料缺失時才會保留原始 `CMS` 形式。
  ```json
  {
    "msg_type": "CMS",
    "data": {
      "id": 10,
      "content_name": "母親節範本",
      "content_type": "LINE",   // 發文情境下固定為 LINE
      "content_ds_key": "...",
      "left_preview_img_url": "https://...",
      "right_preview_img_url": "https://...",
      "refer_point": 1,          // 發文情境下固定為 1
      "msg_count": 1,
      "content_template_dir_id": 5   // [🔯 選填]
    }
  }
  ```
