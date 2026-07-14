# 居鑑｜北台灣建案履歷

這個專案整理林口與 A7 建案的官方基本資料、成交行情、生活機能與品質查核狀態。

## 平常怎麼更新

在 Windows 直接雙擊根目錄的 `更新建案資料.cmd`。它會依序：

1. 下載內政部最新建案備查資料，辨識新案與既有案變更。
2. 更新林口與 A7 的官方成交行情。
3. 補齊新案定位與生活機能。
4. 更新品質查核佇列，但保留人工確認過的事件與進度。
5. 檢查建案、價格、定位與品質資料是否同步。

完成後請先看 `data/processed/update-report.json`，再請 Codex「發布居鑑網站」。本機更新不會自行發布正式網站。

## 更新保護規則

- 新案只在晚於該區目前最新申報日，而且官方身分可唯一辨識時自動加入。
- 官方來源某期暫時找不到的既有建案不會被刪除。
- 多重匹配、改名或身分歧義會列入報告，不會直接覆蓋。
- `data/manual/location-overrides.json` 內的人工定位優先於自動定位。
- `quality-evidence.json` 內已查核的事件、來源進度與日期會被保留。
- 首批目錄以外的較舊建案會列在 `historicalBacklog`，不會一次全部塞進網站。

## 報告怎麼看

- `changes.added`：這次安全加入的新案。
- `changes.updated`：官方欄位有變動的既有案。
- `changes.ambiguous`：同時符合多個建案，需人工判斷。
- `changes.missing`：目前官方檔暫時找不到，但網站仍保留的案。
- `historicalBacklog`：首批目錄以外的歷史候選案。
- `pipeline`：價格、定位與品質資料是否完成同步。

## 開發與檢查

需要 Node.js 22.13 以上。

```bash
npm install
npm run data:update
npm run data:check
npm run build
npm test
```

主要資料來源為內政部不動產成交案件實際資訊資料供應系統、新北市政府資料開放平臺、國土測繪圖資服務雲與 OpenStreetMap。網站上的「資料說明」會顯示資料範圍與限制。
