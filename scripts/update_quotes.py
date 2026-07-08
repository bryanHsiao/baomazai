#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
更新 docs/data/reports.json 每一檔的 quote{price, asOf, prevClose}。

- 資料來源：Yahoo Finance chart API（全球可用，含 GitHub Actions 雲端 runner）。
  先試上市 `{代號}.TW`，抓不到再試上櫃 `{代號}.TWO`，自動判斷市場別。
  （不用證交所 MIS API —— 它對海外/雲端 IP 會回 502。）
- 只更新 quote 快照；每檔的績效基準 date / price 一律不動。
- 沒抓到有效報價的檔就保留原值 —— 讓 git 沒有差異、避免無意義 commit。

用法：python scripts/update_quotes.py
"""
import json
import os
import time
import datetime
import urllib.request
import urllib.error

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REPORTS = os.path.join(ROOT, "docs", "data", "reports.json")

YAHOO = "https://query1.finance.yahoo.com/v8/finance/chart/"


def numify(v):
    """把 352.0 → 352（整數）或 14.85（浮點），讓 JSON 好看且穩定。"""
    if v is None:
        return None
    f = float(v)
    return int(f) if f == int(f) else round(f, 4)


def fetch_symbol(symbol):
    url = f"{YAHOO}{symbol}?interval=1d&range=1d"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (baomazai quote-bot)"})
    with urllib.request.urlopen(req, timeout=25) as r:
        d = json.load(r)
    res = (d.get("chart") or {}).get("result")
    if not res:
        return None
    meta = res[0].get("meta") or {}
    price = meta.get("regularMarketPrice")
    if price is None:
        return None
    tw = datetime.timezone(datetime.timedelta(hours=8))  # 台股時區固定 +8
    ts = meta.get("regularMarketTime")
    # regularMarketTime 是報價當下 epoch 秒 → 轉台北當地時間
    dt = datetime.datetime.fromtimestamp(int(ts), tw) if ts else datetime.datetime.now(tw)
    asof = dt.date().isoformat()             # 給新鮮度判斷用（僅日期）
    asof_time = dt.strftime("%Y/%m/%d %H:%M")  # 給畫面顯示「報價時間」
    prev = meta.get("chartPreviousClose")
    if prev is None:
        prev = meta.get("previousClose")
    return {"price": numify(price), "asOf": asof, "asOfTime": asof_time, "prevClose": numify(prev)}


def get_quote(ticker):
    """先試上市 .TW，再試上櫃 .TWO；各自小重試一次。"""
    for symbol in (f"{ticker}.TW", f"{ticker}.TWO"):
        for attempt in range(2):
            try:
                q = fetch_symbol(symbol)
                if q:
                    return q
                break  # 有回應但無此市場 → 換下一個市場別
            except urllib.error.HTTPError as e:
                if e.code == 404:
                    break  # 此市場別不存在，換下一個
                time.sleep(1.0)  # 429/5xx 等 → 重試
            except Exception:  # noqa: BLE001
                time.sleep(1.0)
    return None


def main():
    with open(REPORTS, encoding="utf-8") as f:
        data = json.load(f)

    changed = 0
    for x in data:
        t = x["ticker"]
        newq = get_quote(t)
        if not newq:
            print("!! 無報價（保留原值）：", t)
            continue
        if x.get("quote") != newq:
            print(f"更新 {t}: {x.get('quote')} -> {newq}")
            x["quote"] = newq
            changed += 1
        time.sleep(0.3)

    with open(REPORTS, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")

    print(f"完成，共更新 {changed} 檔。")


if __name__ == "__main__":
    main()
