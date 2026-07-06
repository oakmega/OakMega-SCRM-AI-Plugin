---
description: 產出 OakMega 發文成效 HTML 報告（資料自動從 API 取得，不需上傳檔案）。
argument-hint: [時間範圍，例如：最近三個月｜2026-04 至 2026-06｜Q2；留空＝最近三個月]
---

使用者透過 `/oakmega-broadcast-report` 明確要求產出發文成效報告。

請 spawn **broadcast-report** agent 執行，傳入：

```
start_dt: <YYYY-MM-DD>
end_dt: <YYYY-MM-DD>
```

時間範圍由 $ARGUMENTS 轉換（留空代表最近三個月，今天往回推 90 天）。

agent 完成後將回傳摘要 JSON，請用 2–3 句繁體中文向使用者說明產出結果與關鍵數字。
