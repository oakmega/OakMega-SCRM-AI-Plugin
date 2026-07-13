---
name: oakmega-broadcast-report
user-invocable: false
description: >-
  OakMega 發文成效 HTML 報告的規格文件（報告結構、欄位定義、HTML 建置規範）。
  供 broadcast-report agent 讀取，不獨立執行。
---

# OakMega 發文成效報告 — HTML 規格

供 `broadcast-report` agent 產出 self-contained HTML 報告時參照。

## 資料欄位

每筆發文的使用欄位：

| 欄位 | 說明 |
|------|------|
| `id` | 發文 ID |
| `name` | 發文名稱 |
| `broadcast_dt` | 發送時間 |
| `status` | `draft` / `published` |
| `audience_target_count.point` | 受眾人數 |
| `line_broadcast_insight.unique_impression` | 開封數 |
| `line_broadcast_insight.unique_impression_rate` | 開封率（0–1） |
| `six_hour_interaction.interactions` | 6 小時互動次數 |
| `six_hour_interaction.unique_interactors` | 6 小時互動人數 |
| `six_hour_interaction.adds` | 6 小時新增好友 |
| `six_hour_interaction.blocks` | 6 小時封鎖 |
| `line_message_insight[].insight.unique_media_played` | 影片播放數（單一影片訊息） |
| `line_message_insight[].insight.unique_media_played_100_percent_rate` | 影片完播率（0–1，單一影片訊息） |
| `broadcaster` | 發送者 |

只取 `status === 'published'` 的項目做分析；草稿在明細表裡標示但不計入 KPI。

`line_broadcast_insight`、`six_hour_interaction` 與 `line_message_insight` 是由 `broadcast-report` agent 逐筆呼叫 `broadcast get-statistics` 補上的（`broadcast search` 不再回傳 `line_broadcast_insight`），未成功取得統計數據的發文，該筆的這些欄位視為缺值（KPI 加總時跳過，明細表對應欄位顯示「—」）。

## 報告結構

### Hero

- 標題「OakMega 發文成效報告」
- 日期範圍、發文則數（已發送 / 草稿）
- 發送者

### 01 整體成效一覽

4 個 KPI cards：
- 平均開封率（`unique_impression_rate` 平均值，% 格式）
- 最高開封率（含該則名稱）
- 總互動人數（`unique_interactors` 加總）
- 6 小時淨好友（`adds` 加總 − `blocks` 加總）

開封率趨勢 bar chart（Chart.js）：
- x 軸：每則發文名稱（縮短至 15 字）
- y 軸：開封率 %
- 整體平均線（dashed）
- 開封率低於平均 × 0.7 的 bar 用 error 紅色標示

### 02 逐則明細

完整表格，依 `broadcast_dt` 排序（最新在前）：

| 發送時間 | 名稱 | 受眾 | 開封數 | 開封率 | 互動人數 | 新增好友 | 封鎖 | 發送者 |

顏色規則（獨立套用於「開封率」欄）：
- top 10%（`sorted[n - ceil(n × 0.1)]` 閾值）→ `success-700 #006E17` 底色
- bottom 10%（`sorted[ceil(n × 0.1) - 1]` 閾值）→ `error-50 #FFEDEA` 底色
- 草稿列整列用 `gray-50` 底色，開封率欄顯示「草稿」
- 統計數據缺值（`stats_fetch_failed`）的欄位顯示「—」

### 03 影片播放數據

只在至少一則發文的 `line_message_insight` 非空陣列時才產出此區塊；若沒有任何影片訊息，整節略過不顯示。

表格，依 `broadcast_dt` 排序（最新在前）：

| 發文名稱 | 播放數 | 完播率 |

- 同一則發文有多個影片訊息時，`line_message_insight` 陣列中每一筆各自一列，發文名稱重複顯示
- 完播率使用 `unique_media_played_100_percent_rate`，% 格式

### 04 建議

1–2 條建議，每條格式：
```
▶ [建議標題]
依據：[引用具體數字]
```

## HTML 建置規範

產出**單一 self-contained `.html` 檔案**。

### Head

```html
<script src="https://cdn.tailwindcss.com"></script>
<script>
tailwind.config = {
  theme: {
    extend: {
      fontFamily: { sans: ['"Noto Sans TC"','"PingFang TC"','system-ui','sans-serif'] },
      colors: {
        gray:    {25:'#F8F9FD',50:'#EEF1F6',100:'#E5E8EF',200:'#D9DDE5',300:'#B6BCC7',400:'#9199A6',500:'#6E7887',600:'#4F5A6D',700:'#323E54',800:'#17233C',900:'#050F2C'},
        brand:   {25:'#FDF7FF',50:'#F5EEFF',100:'#EDE4FF',200:'#E3D7FF',300:'#BEA9FF',400:'#AF96FF',500:'#9674FB',600:'#815FE5',700:'#6744CA',800:'#4F26B1',900:'#380095'},
        error:   {25:'#FFF8F7',50:'#FFEDEA',100:'#FFE2DD',200:'#FFD3CC',300:'#FF9B8D',400:'#FF8070',500:'#F75141',600:'#DA3C30',700:'#B7221A',800:'#930005',900:'#690002'},
        success: {25:'#F3FCEC',50:'#DFF8D7',100:'#CBF3C1',200:'#B5EBAB',300:'#85C67D',400:'#7EC776',500:'#419E42',600:'#2A882F',700:'#006E17',800:'#00530F',900:'#003908'},
      }
    }
  }
}
</script>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;700&display=swap" rel="stylesheet">
```

### 配色常數（Chart.js 用）

```js
const C = {
  ink: '#050F2C', muted: '#6E7887', line: '#E5E8EF',
  brand: '#9674FB', brandDeep: '#6744CA',
  good: '#006E17', goodBg: '#DFF8D7',
  bad: '#DA3C30', badBg: '#FFEDEA',
  gray400: '#9199A6',
};
```

### 版面

- 頁面背景 `gray-25 #F8F9FD`
- 最大寬度 `max-w-5xl mx-auto px-6 py-10`
- Section 標題前綴數字用 `brand-700` 色
- KPI card：白色底、`rounded-xl shadow-sm border border-gray-100`
- 表格 header：`gray-50 #EEF1F6`，hover row：`gray-25`

### 禁止事項

- 不使用 `chartjs-adapter-date-fns`（CORS 問題）
- x 軸一律用 categorical string label，不用 `type: 'time'`
- 不引用任何外部圖片或字型以外的資源（保持 self-contained）
