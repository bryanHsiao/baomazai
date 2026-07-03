# 個股研究室 · 台股基本面研究

台股個股基本面研究報告，加上一個可用 GitHub Pages 呈現的靜態網站。

## 專案結構

```
.
├─ README.md                  本說明
├─ TIER1-待回答問題.md         Tier 1（輸入代號自動產報告）待你拍板的決策
├─ docs/                      ← 網站（GitHub Pages 根目錄）＋ 報告唯一來源
│  ├─ index.html              研究檔案首頁
│  ├─ report.html             報告內頁（?id=代號）
│  ├─ assets/                 style.css / app.js
│  ├─ data/                   報告與索引（唯一來源）
│  │  ├─ reports.json         股票清單與中繼資料
│  │  ├─ 1718/                中國人造纖維
│  │  │  └─ report.md         （日後可加 sources/、charts/、版本…）
│  │  ├─ 6226/                光鼎電子
│  │  │  └─ report.md
│  │  └─ 1449/                佳和實業
│  │     ├─ report.md
│  │     └─ sources/          年報／財報／法說 PDF＋逐字稿、研究筆記、規格、迭代紀錄
│  ├─ .nojekyll
│  └─ README.md               網站與部署細節
└─ .claude/                   Claude Code 設定（launch.json 等）
```

> **每個代號一個資料夾 `docs/data/<代號>/`，報告放 `report.md`**，日後可在同資料夾放年報／財報 PDF、圖表、不同日期版本。這是報告的唯一來源，網站直接讀取；Tier 1 自動產報告時也寫進這裡，不另存副本，避免版本分歧。
>
> 註：資料夾放在 `docs/` 底下，是因為 GitHub Pages 只發佈 `/docs`，放在專案根目錄網站會讀不到。
>
> 若在 `reports.json` 某檔加上 `sources` 陣列（`{ label, file }`），報告頁底會自動長出「附錄 · 原始資料」下載區（如 1449）。
>
> **績效追蹤**：每檔的 `quote: { price, asOf, prevClose }` 是「最近報價快照」。前端會用它跟研究基準價 `price`（＋基準日 `date`）算出報酬率，顯示在首頁徽章與報告頁頂端的「績效追蹤」面板。純靜態拿不到即時價（CORS），所以這是快照——要更新就改 `quote`（現在人工，之後 Tier 1 後端排程自動抓價寫回）。
>
> **情報存證**：觸發研究的小道消息（文字＋截圖）放在 `docs/data/<代號>/intel/`（圖片檔＋ `intel.md` 逐字紀錄），並在 `reports.json` 加 `intel: { received, source, summary, note, images:[{src,caption}] }`，報告頁就會長出「情報來源 · INTEL」區塊、首頁卡片顯示「情報」標記（如 1449）。

## 目前收錄

| 代號 | 公司 | 評等 | 研究基準日 |
|---|---|---|---|
| 1718 | 中國人造纖維（中纖） | 中性偏保守 | 2026-07-03 |
| 6226 | 光鼎電子 | 不建議／避開 | 2026-07-03 |
| 1449 | 佳和實業 | 觀望／不追價 | 2026-06-08 |

## 看網站

本機預覽（前端用 fetch 讀 .md，不能 file:// 直接開）：

```bash
python -m http.server 5178 --directory docs
# 開 http://localhost:5178
```

部署到 GitHub Pages：Settings → Pages → Source 選 `main` 分支的 `/docs` 資料夾。詳見 [docs/README.md](docs/README.md)。

## 研究方法

以證交所 OpenAPI、公開資訊觀測站、法說資料為第一級來源；新聞財經網站僅補脈絡。
題材依證據分 A（官方/財報/第三方確認）、B（管理層說法＋營運佐證）、C（規劃/洽談/送樣）、
D（市場推測）四級；財務數字標明期間、單位與是否含合併子公司；並附估值情境、催化劑、
風險與「待確認」清單。

## 免責

本專案為公開資訊之整理與研究，屬教育與參考用途，非個人化投資建議，
不構成任何證券之買賣要約。投資決策與風險請自行判斷與承擔。
