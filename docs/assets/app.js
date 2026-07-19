/* ============================================================
   個股研究室 — Tier 0 static viewer
   ============================================================ */
(function () {
  "use strict";

  var DATA_URL = "data/reports.json";

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function fmtDate(d) {
    return d.getFullYear() + "." +
      String(d.getMonth() + 1).padStart(2, "0") + "." +
      String(d.getDate()).padStart(2, "0");
  }
  function verdictClass(tone) {
    return "verdict verdict--" + (tone || "neu");
  }

  // ---- performance tracking (research base price vs latest quote snapshot) ----
  function parseDate(s) {
    var p = (s || "").split("-");
    return new Date(Date.UTC(+p[0], (+p[1] || 1) - 1, +p[2] || 1));
  }
  function daysBetween(a, b) {
    return Math.round((parseDate(b) - parseDate(a)) / 86400000);
  }
  function mmdd(s) { var p = (s || "").split("-"); return p[1] + "/" + p[2]; }

  // report-price freshness relative to the viewer's "today".
  // the site is static, so every quote is a daily snapshot — this labels
  // which day it's from and flags when it's not today's.
  function freshness(asOf) {
    if (!asOf) return null;
    var now = new Date();
    var today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    var diff = Math.round((today - parseDate(asOf)) / 86400000);
    if (diff <= 0) return { cls: "today", txt: "今日報價", short: "今日" };
    if (diff === 1) return { cls: "recent", txt: "報價 " + mmdd(asOf) + "（昨日）", short: mmdd(asOf) };
    return {
      cls: diff >= 4 ? "stale" : "recent",
      txt: "報價 " + mmdd(asOf) + "（" + diff + " 天前）",
      short: mmdd(asOf)
    };
  }

  function perf(meta) {
    if (!meta || !meta.quote || meta.quote.price == null) return null;
    var base = parseFloat(meta.price), cur = Number(meta.quote.price);
    if (!isFinite(base) || !isFinite(cur) || base <= 0) return null;
    var ret = (cur - base) / base * 100;
    var dir = ret > 0.005 ? "up" : (ret < -0.005 ? "down" : "flat");
    return {
      base: base, cur: cur, ret: ret, dir: dir,
      retStr: (ret > 0 ? "+" : "") + ret.toFixed(2) + "%",
      days: daysBetween(meta.date, meta.quote.asOf),
      asOf: meta.quote.asOf
    };
  }

  // normalize a report's intel into a chronological (newest-first) tip list.
  // supports both a single legacy intel object and an intel.tips[] timeline.
  function getTips(r) {
    if (!r || !r.intel) return [];
    var arr = (r.intel.tips && r.intel.tips.length)
      ? r.intel.tips.slice()
      : [{
          date: r.intel.received, source: r.intel.source,
          headline: r.intel.headline, summary: r.intel.summary,
          images: r.intel.images || [], verify: r.intel.verify
        }];
    arr.sort(function (a, b) { return (b.date || "").localeCompare(a.date || ""); });
    return arr;
  }
  function latestTipDate(r) {
    var t = getTips(r);
    return (t[0] && t[0].date) || r.date || "";
  }
  function shotHtml(im) {
    return '<figure class="intel-shot">' +
      '<a href="' + im.src + '" target="_blank" rel="noopener">' +
        '<img src="' + im.src + '" alt="" loading="lazy" ' +
        'onerror="this.closest(&quot;.intel-shot&quot;).classList.add(&quot;is-missing&quot;)">' +
        '<span class="intel-shot__missing mono">圖片待補<br>' + im.src.split("/").pop() + '</span>' +
      '</a>' +
      (im.caption ? '<figcaption>' + im.caption + '</figcaption>' : "") +
      '</figure>';
  }

  function loadReports() {
    return fetch(DATA_URL, { cache: "no-cache" }).then(function (r) {
      if (!r.ok) throw new Error("reports.json " + r.status);
      return r.json();
    });
  }

  /* ---------------------------------------------------------
     INDEX PAGE
     --------------------------------------------------------- */
  function initIndex() {
    var today = document.getElementById("today");
    if (today) today.textContent = fmtDate(new Date());

    loadReports().then(function (reports) {
      // newest tip first — sort by the most recent tip date (handles multi-tip stocks)
      reports.sort(function (a, b) { return latestTipDate(b).localeCompare(latestTipDate(a)); });
      buildTape(reports);
      buildFiles(reports);
    }).catch(function (err) {
      var files = document.getElementById("files");
      if (files) files.innerHTML =
        '<p style="font-family:var(--mono);color:var(--muted);padding:40px 0">' +
        '無法載入研究清單（' + err.message + '）。請透過 GitHub Pages 或本機伺服器開啟。</p>';
    });
  }

  function buildTape(reports) {
    var tape = document.getElementById("tape");
    if (!tape) return;
    var html = "";
    var once = reports.map(function (r) {
      var arrow = r.priceMove === "up" ? '<span class="up tri-up"></span>'
                : r.priceMove === "down" ? '<span class="down tri-down"></span>' : "";
      var curPrice = (r.quote && r.quote.price != null) ? r.quote.price : r.price;
      return '<span class="tape__item">' +
        '<span class="sym">' + r.ticker + " " + r.short + '</span>' +
        '<span class="' + (r.priceMove === "up" ? "up" : r.priceMove === "down" ? "down" : "") + '">' +
        arrow + curPrice + '</span>' +
        '<span class="tag">' + (r.priceNote || "") + '</span>' +
        '</span>';
    }).join("");
    // duplicate for seamless marquee
    tape.innerHTML = once + once;
  }

  function buildFiles(reports) {
    var wrap = document.getElementById("files");
    if (!wrap) return;
    wrap.innerHTML = "";

    reports.forEach(function (r, i) {
      var a = el("a", "file");
      a.href = "report.html?id=" + encodeURIComponent(r.id);

      var isHold = r.kind === "holding";
      var q = r.quote || {};
      var fr = freshness(q.asOf);
      var stats = (r.stats || []).map(function (s) {
        // keep the visible 股價 in sync with the auto-updated quote snapshot
        var v = (s.k === "股價" && q.price != null) ? q.price : s.v;
        return '<span class="file__stat"><span class="k">' + s.k +
          '</span><span class="v mono">' + v + '</span></span>';
      }).join("");
      var asofHtml = fr
        ? '<div class="file__asof file__asof--' + fr.cls + '">' +
            '<span class="asof-dot"></span>' + fr.txt +
            (q.asOfTime ? ' <span class="asof-time mono">· ' + q.asOfTime + '</span>' : "") +
          '</div>'
        : "";

      var tips = getTips(r);
      var latest = tips[0] || {};
      var pf = perf(r);
      var perfHtml = "";
      if (pf) {
        perfHtml = pf.days <= 0
          ? '<span class="tip-perf perf--flat">' + (isHold ? '研究當日 · 追蹤中' : '情報當日 · 追蹤中') + '</span>'
          : '<span class="tip-perf perf--' + pf.dir + '">自 ' + mmdd(r.date) +
              ' <span class="tip-base mono">基準 ' + r.price + '</span> <b>' + pf.retStr + '</b>' +
              (pf.dir === "up" ? " ▲" : pf.dir === "down" ? " ▼" : "") +
              ' <span class="tip-days">· ' + pf.days + '天</span></span>';
      }
      var headline = latest.headline || r.tagline;
      var tipDate = ((latest.date || r.date) || "").replace(/-/g, "/");
      var again = tips.length > 1 ? '<span class="tip-again">再報 ×' + tips.length + '</span>' : '';

      a.innerHTML =
        '<div class="file__tip">' +
          '<div class="file__tipbar">' +
            '<span class="tip-src">' + (isHold ? '📌 自選持股' : '📮 報馬仔') + ' <span class="tip-date mono">' + tipDate + '</span>' + again + '</span>' +
            perfHtml +
          '</div>' +
          '<div class="file__quote">「' + headline + '」</div>' +
        '</div>' +
        '<div class="file__verify">' +
          '<div class="file__plate">' +
            '<div class="file__ticker">' + r.ticker + '</div>' +
            '<div class="file__sector">' + r.sector + '</div>' +
          '</div>' +
          '<div class="file__body">' +
            '<div class="file__vline">' +
              '<span class="file__vlabel mono">' + (isHold ? '健檢' : '查證') + '</span>' +
              '<span class="' + verdictClass(r.verdictTone) + '">' + r.verdict + '</span>' +
              '<span class="file__name">' + r.name +
                ' <span class="short">' + r.short + '</span></span>' +
            '</div>' +
            '<div class="file__tag">' + r.tagline + '</div>' +
            '<div class="file__stats">' + stats + '</div>' +
            '<div class="file__foot">' +
              asofHtml +
              '<span class="file__go">閱讀完整查證 <span class="arrow">→</span></span>' +
            '</div>' +
          '</div>' +
        '</div>';

      wrap.appendChild(a);
    });

    // staggered reveal
    var items = wrap.querySelectorAll(".file");
    if (!("IntersectionObserver" in window)) {
      items.forEach(function (n) { n.classList.add("in"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e, idx) {
        if (e.isIntersecting) {
          var n = e.target;
          setTimeout(function () { n.classList.add("in"); },
            (parseInt(n.dataset.i, 10) || 0) * 90);
          io.unobserve(n);
        }
      });
    }, { threshold: 0.15 });
    items.forEach(function (n, idx) { n.dataset.i = idx; io.observe(n); });
  }

  /* ---------------------------------------------------------
     REPORT PAGE
     --------------------------------------------------------- */
  function initReport() {
    var params = new URLSearchParams(location.search);
    var id = params.get("id");
    var box = document.getElementById("report");

    if (!id) { fail(box, "缺少股票代號參數。"); return; }

    loadReports().then(function (reports) {
      var meta = reports.filter(function (r) { return r.id === id; })[0];
      if (!meta) { fail(box, "找不到代號 " + id + " 的報告。"); return; }
      setHeader(meta);
      return fetch(meta.file, { cache: "no-cache" }).then(function (r) {
        if (!r.ok) throw new Error(meta.file + " " + r.status);
        return r.text();
      }).then(function (md) { renderReport(md, box, meta); });
    }).catch(function (err) {
      fail(box, "載入失敗：" + err.message + "（請透過 GitHub Pages 或本機伺服器開啟）");
    });
  }

  function fail(box, msg) {
    if (box) box.innerHTML = '<p class="article__loading">' + msg + "</p>";
  }

  function setHeader(meta) {
    document.title = meta.ticker + " " + meta.name + " · 個股研究室";
    var idEl = document.getElementById("r-id");
    var nameEl = document.getElementById("r-name");
    var vEl = document.getElementById("r-verdict");
    if (idEl) idEl.textContent = meta.ticker;
    if (nameEl) nameEl.textContent = meta.name;
    if (vEl) vEl.innerHTML = '<span class="' + verdictClass(meta.verdictTone) +
      '">' + meta.verdict + '</span>';
  }

  function renderReport(md, box, meta) {
    if (typeof marked === "undefined") { box.textContent = md; return; }
    // 報告內的半形 ~ 一律作為數字區間分隔（如 60~100、2026~2027），
    // 但 GFM 會把成對的 ~ 解讀成刪除線、把中間文字劃掉。
    // 轉成全形 ～（中文區間的正確寫法，且不觸發刪除線）根治此問題。
    md = md.replace(/~/g, "～");
    marked.setOptions({ breaks: false, gfm: true });
    box.innerHTML = marked.parse(md);

    // performance scorecard at the very top (base price vs latest quote)
    if (meta) {
      var sc = buildScorecard(meta);
      if (sc) box.insertAdjacentHTML("afterbegin", sc);
    }

    // intel FIRST — the tip/rumour leads the page (message-first).
    // Runs after the scorecard prepend, so it lands above it: 情報 → 績效 → 報告
    if (meta && meta.intel) {
      box.insertAdjacentHTML("afterbegin", buildIntel(meta));
    }

    // sources appendix (downloadable first-hand files stored in this project)
    if (meta && meta.sources && meta.sources.length) {
      box.insertAdjacentHTML("beforeend", buildSources(meta.sources));
    }

    // wrap tables for horizontal scroll
    box.querySelectorAll("table").forEach(function (t) {
      var w = el("div", "table-wrap");
      t.parentNode.insertBefore(w, t);
      w.appendChild(t);
    });

    // ids on headings + TOC
    var heads = box.querySelectorAll("h2");
    var tocList = document.getElementById("toc-list");
    var toc = document.getElementById("toc");
    if (heads.length && tocList) {
      heads.forEach(function (h, i) {
        var hid = "sec-" + (i + 1);
        h.id = hid;
        var li = el("li");
        var a = el("a", "toc__link", h.textContent);
        a.href = "#" + hid;
        li.appendChild(a);
        tocList.appendChild(li);
      });
      if (toc) toc.hidden = false;
      setupScrollSpy(heads, tocList);
    }

    setupProgress();
  }

  function buildScorecard(meta) {
    var pf = perf(meta);
    if (!pf) return "";
    var retClass = pf.dir === "up" ? "up" : (pf.dir === "down" ? "down" : "");
    var retDisplay = pf.days <= 0 ? "研究當日" : pf.retStr;
    var daysSub = pf.days <= 0 ? "研究當日建立" : "持有 " + pf.days + " 天";
    var fr = freshness(pf.asOf) || { cls: "recent", txt: "報價 " + mmdd(pf.asOf), short: mmdd(pf.asOf) };
    return '<div class="scorecard">' +
      '<div class="scorecard__head">' +
        '<span class="scorecard__label">績效追蹤 · SCORECARD</span>' +
        '<span class="scorecard__asof scorecard__asof--' + fr.cls + '">' +
          '<span class="asof-dot"></span>' + fr.txt +
          (meta.quote.asOfTime ? ' · ' + meta.quote.asOfTime : "") + '</span>' +
      '</div>' +
      '<div class="scorecard__grid">' +
        '<div class="sc-cell"><span class="sc-k">基準價</span>' +
          '<span class="sc-v mono">' + pf.base.toFixed(2) + '</span>' +
          '<span class="sc-sub">' + meta.date + '</span></div>' +
        '<div class="sc-arrow">→</div>' +
        '<div class="sc-cell"><span class="sc-k">現價</span>' +
          '<span class="sc-v mono">' + pf.cur.toFixed(2) + '</span>' +
          '<span class="sc-sub sc-sub--' + fr.cls + '">' + pf.asOf + '</span></div>' +
        '<div class="sc-cell sc-cell--ret"><span class="sc-k">若當時買入至今</span>' +
          '<span class="sc-v mono ' + retClass + '">' + retDisplay + '</span>' +
          '<span class="sc-sub">' + daysSub + '</span></div>' +
      '</div>' +
      '<p class="scorecard__note">研究判斷：<b>' + meta.verdict + '</b>。' +
        '上表為單純價格變動，未計股利與交易成本，非投資建議。' +
        '報價為每日快照（交易日收盤後自動更新），<b>非即時</b>' +
        (fr.cls === "stale" ? '；目前這筆為 ' + pf.asOf + ' 的資料，可能不是最新。' : '。') +
      '</p>' +
    '</div>';
  }

  function buildIntel(r) {
    var tips = getTips(r);
    if (!tips.length) return "";
    var isHold = r.kind === "holding";
    var note = r.intel && r.intel.note;
    var multi = tips.length > 1;
    var vkLabel = isHold ? "健檢" : "查證";
    var entries = tips.map(function (t) {
      var imgs = (t.images || []).map(shotHtml).join("");
      return '<div class="tip-entry">' +
        '<div class="tip-entry__bar">' +
          '<span class="intel__tag">' + (isHold ? "持股" : "報馬") + '</span>' +
          '<span class="intel__src">' + (t.source || "") + '</span>' +
          (t.date ? '<span class="intel__date mono">' + t.date + '</span>' : "") +
        '</div>' +
        (t.headline ? '<p class="tip-entry__quote">「' + t.headline + '」</p>' : "") +
        (t.summary ? '<p class="tip-entry__summary">' + t.summary + '</p>' : "") +
        (imgs ? '<div class="intel__shots">' + imgs + '</div>' : "") +
        (t.verify ? '<p class="tip-entry__verify"><span class="tip-entry__vk mono">' + vkLabel + '</span>' + t.verify + '</p>' : "") +
        '</div>';
    }).join("");
    var noteLink = note
      ? '<a href="' + note + '" target="_blank" rel="noopener">完整逐字紀錄 →</a> · ' : "";
    if (isHold) {
      return '<h2>持股健檢 · SELF-CHECK</h2>' +
        '<div class="intel">' +
          '<div class="intel__timeline">' + entries + '</div>' +
          '<p class="intel__foot">' + noteLink + '自選持股的基本面健檢，非個人化投資建議。</p>' +
        '</div>';
    }
    return '<h2>情報來源 · INTEL' + (multi ? '（此檔已被報 ' + tips.length + ' 次）' : '') + '</h2>' +
      '<div class="intel">' +
        '<div class="intel__timeline">' + entries + '</div>' +
        '<p class="intel__foot">' + noteLink + '原始消息存證，未經查證，非投資建議。</p>' +
      '</div>';
  }

  function buildSources(sources) {
    var items = sources.map(function (s) {
      var ext = (s.file.split(".").pop() || "").toUpperCase();
      return '<li><a href="' + s.file + '" target="_blank" rel="noopener">' +
        '<span>' + s.label + '</span>' +
        '<span class="src-ext">' + ext + ' <span class="src-dl">↓</span></span>' +
        '</a></li>';
    }).join("");
    return '<h2>附錄 · 原始資料</h2>' +
      '<p>本報告引用的第一手文件，均存放於本專案，點擊下載或檢視：</p>' +
      '<ul class="src-list">' + items + '</ul>';
  }

  function setupScrollSpy(heads, tocList) {
    var links = tocList.querySelectorAll(".toc__link");
    if (!("IntersectionObserver" in window)) return;
    var visible = {};
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        visible[e.target.id] = e.isIntersecting;
      });
      // pick topmost visible heading
      var current = null;
      for (var i = 0; i < heads.length; i++) {
        if (visible[heads[i].id]) { current = heads[i].id; break; }
      }
      links.forEach(function (l) {
        l.classList.toggle("active", l.getAttribute("href") === "#" + current);
      });
    }, { rootMargin: "-72px 0px -70% 0px", threshold: 0 });
    heads.forEach(function (h) { io.observe(h); });
  }

  function setupProgress() {
    var bar = document.getElementById("prog");
    if (!bar) return;
    var ticking = false;
    function update() {
      var h = document.documentElement;
      var max = h.scrollHeight - h.clientHeight;
      var p = max > 0 ? (h.scrollTop || document.body.scrollTop) / max : 0;
      bar.style.width = Math.min(100, Math.max(0, p * 100)) + "%";
      ticking = false;
    }
    window.addEventListener("scroll", function () {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    update();
  }

  /* ---------------------------------------------------------
     BOOT
     --------------------------------------------------------- */
  function boot() {
    if (document.getElementById("files")) initIndex();
    if (document.getElementById("report")) initReport();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
