# 協作開發指南

## 前置條件

- Git
- Node.js（CLI 執行需要）
- 已安裝 Claude Code

---

## 第一次設定

### 1. Clone repo

```bash
git clone git@github.com:oakmega/OakMega-SCRM-AI-Plugin.git
cd OakMega-SCRM-AI-Plugin
```

### 2. 啟動 Claude Code 並掛載本機 plugin

```bash
claude --plugin-dir oakmega-scrm
```

這樣 Claude Code 會直接讀取你本機的 `oakmega-scrm/` 目錄，不需要額外安裝或建立 symlink。

---

## 開發循環

1. 開新 branch：`git checkout -b feat/my-change`
2. 用 `claude --plugin-dir oakmega-scrm` 啟動 Claude Code
3. 改檔案（skill、command、CLI 都可）
4. 在 Claude Code 跑 `/reload-plugins` 套用最新改動
5. 重複 3–4 直到滿意
6. 送 PR 到 `master`

---

## PR 規範

- Branch 名稱：`new-<功能>`、`fix-<問題>`、`content-<skill名稱>`
- PR 標題用中文寫清楚改了什麼
- 改 SKILL.md 的 PR 在描述裡說明改動理由（例如：「加入缺少的錯誤處理說明」）

---

## FAQ

### 改了檔案但 Claude Code 沒有反應

在 Claude Code 輸入框跑：

```
/reload-plugins
```

### 想用正式版測試（不用本機目錄）

不加 `--plugin-dir` 啟動即可，再透過 Claude Code 安裝：

```
/plugin marketplace add oakmega/OakMega-SCRM-AI-Plugin
/plugin install oakmega-scrm@oakmega
```
