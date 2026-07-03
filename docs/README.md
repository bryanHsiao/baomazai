# 個股研究室 — Tier 0 靜態網站

台股個股基本面研究報告的靜態瀏覽器。用 GitHub Pages 呈現，純前端、零後端。

## 結構

```
docs/
├─ index.html          研究檔案首頁（股票清單）
├─ report.html         報告內頁（?id=1718）
├─ .nojekyll           關閉 Jekyll，讓 .md 以原始文字提供
├─ assets/
│  ├─ style.css        設計系統（Market Broadsheet）
│  └─ app.js           清單渲染、markdown 渲染、章節目錄、閱讀進度
└─ data/
   ├─ reports.json     報告索引與中繼資料（評等、指標…）
   ├─ 1718/report.md   中纖研究報告（每代號一資料夾，可加 sources/、charts/）
   ├─ 6226/report.md   光鼎研究報告
   └─ 1449/report.md   佳和研究報告
```

## 部署到 GitHub Pages

1. 把整個專案 push 到 GitHub repo。
2. Repo → **Settings → Pages**。
3. **Source** 選 `Deploy from a branch`；Branch 選 `main`、資料夾選 **`/docs`**。
4. 儲存後等一兩分鐘，網址會是 `https://<你的帳號>.github.io/<repo>/`。

> 因為有 `.nojekyll`，GitHub 不會用 Jekyll 處理，`data/*.md` 會以原始文字提供給前端 `fetch` 渲染。

## 本機預覽

前端用 `fetch` 讀取 `.md` 與 `reports.json`，**不能用 file:// 直接打開**（會被 CORS 擋）。請起一個本機伺服器：

```bash
# 於專案根目錄
python -m http.server 5178 --directory docs
# 然後開 http://localhost:5178
```

## 新增一檔股票

1. 建 `data/<代號>/` 資料夾，把報告放成 `data/<代號>/report.md`（同資料夾可再放 `sources/`、圖表等）。
2. 在 `data/reports.json` 加一筆（`id`、`ticker`、`name`、`verdict`、`stats`，`file` 指向 `data/<代號>/report.md`）。
3. 完成，首頁會自動多一列。

## 設計說明

- 方向：**Market Broadsheet** — 冷調紙白、近黑墨色、台股紅漲綠跌訊號色、等寬數字。
- 字體：Noto Serif TC（標題）／Noto Sans TC（內文）／IBM Plex Mono（數字）／Archivo（英文標）。
- 之後接 Tier 1（輸入代號自動產報告）時，只要讓後端把新報告寫進 `data/` 並更新 `reports.json`，本站即可直接呈現。
