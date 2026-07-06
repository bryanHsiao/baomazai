#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
更新 docs/data/reports.json 每一檔的 quote{price, asOf, prevClose}。

- 資料來源：證交所 MIS API（上市 tse_ / 上櫃 otc_ 同時查，取有效者，可自動判斷市場別）。
- 只更新 quote 快照；每檔的績效基準 date / price 一律不動。
- 沒有有效報價、或值沒變的檔，就不動它 —— 讓 git 沒有差異、避免無意義 commit。

用法：python scripts/update_quotes.py
"""
import json
import os
import time
import datetime
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REPORTS = os.path.join(ROOT, "docs", "data", "reports.json")

MIS = "https://mis.twse.com.tw/stock/api/getStockInfo.jsp"


def numify(v):
    """把 '352.0000' → 352（整數）或 14.95（浮點），讓 JSON 好看且穩定。"""
    if v is None:
        return None
    f = float(v)
    return int(f) if f == int(f) else round(f, 4)


def fetch(channels):
    url = (
        MIS
        + "?ex_ch="
        + "|".join(channels)
        + "&json=1&delay=0&_="
        + str(int(time.time() * 1000))
    )
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (baomazai quote-bot)",
            "Accept": "application/json",
        },
    )
    with urllib.request.urlopen(req, timeout=25) as r:
        return json.load(r)


def tw_today():
    return (datetime.datetime.utcnow() + datetime.timedelta(hours=8)).date().isoformat()


def main():
    with open(REPORTS, encoding="utf-8") as f:
        data = json.load(f)

    tickers = [x["ticker"] for x in data]
    channels = []
    for t in tickers:
        channels += [f"tse_{t}.tw", f"otc_{t}.tw"]

    got = {}
    for i in range(0, len(channels), 40):
        chunk = channels[i : i + 40]
        try:
            resp = fetch(chunk)
        except Exception as e:  # noqa: BLE001
            print("fetch error:", e)
            continue
        for m in resp.get("msgArray", []):
            code = m.get("c")
            z, y = m.get("z", "-"), m.get("y", "-")
            if code and (z not in ("-", "") or y not in ("-", "")):
                got[code] = m
        time.sleep(0.6)

    changed = 0
    for x in data:
        t = x["ticker"]
        m = got.get(t)
        if not m:
            print("!! 無報價：", t)
            continue

        z, y, d = m.get("z", "-"), m.get("y", "-"), m.get("d", "")
        if z in ("-", ""):
            # 漲跌停鎖死無成交／盤中無成交 → 不用不可靠的值覆蓋，保留原快照
            print("!! 無有效成交價（保留原值）：", t)
            continue

        price = numify(z)
        asof = f"{d[:4]}-{d[4:6]}-{d[6:8]}" if len(d) == 8 else tw_today()
        prev = numify(y) if y not in ("-", "") else x.get("quote", {}).get("prevClose")

        newq = {"price": price, "asOf": asof, "prevClose": prev}
        if x.get("quote") != newq:
            print(f"更新 {t}: {x.get('quote')} -> {newq}")
            x["quote"] = newq
            changed += 1

    with open(REPORTS, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")

    print(f"完成，共更新 {changed} 檔。")


if __name__ == "__main__":
    main()
