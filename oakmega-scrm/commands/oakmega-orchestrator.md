---
description: OakMega SCRM 多任務分析協調器（月報、會員分析、完整報告等）。
argument-hint: [任務描述，例如：月報｜幫我看 wayne 的活動｜完整報告；留空＝說明可用任務]
---

使用者透過 `/oakmega-orchestrator` 進入 **OakMega 分析協調器**。

請依照 **oakmega-orchestrator** skill 的指示執行 —— 解析請求、spawn 對應報告 agent、
累積任務摘要，全都寫在該 skill 裡，以它為準。

本次請求：$ARGUMENTS
（留空代表請說明目前可以執行哪些任務。）

> 若 skill 未自動載入，請直接讀取並遵循
> `${CLAUDE_PLUGIN_ROOT}/skills/oakmega-orchestrator/SKILL.md` 後再執行。
