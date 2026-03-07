const fs = require("fs")
const path = require("path")

const telemetryConfig = { telemetry: true }

// Define file paths
const statsFile = path.join(__dirname, "stats.json")
const statsFileV2 = path.join(__dirname, "stats-v2.json")

// Helper for empty structure
const getEmptyStats = () => ({ videos: {}, browsers: {}, os: {}, users: {} })

function parseUA(ua) {
  let browser = "unknown"
  let os = "unknown"

  if (/firefox/i.test(ua)) browser = "firefox"
  else if (/chrome|chromium|crios/i.test(ua)) browser = "chrome"
  else if (/safari/i.test(ua)) browser = "safari"
  else if (/edge/i.test(ua)) browser = "edge"

  if (/windows/i.test(ua)) os = "windows"
  else if (/android/i.test(ua)) os = "android"
  else if (/mac os|macintosh/i.test(ua)) os = "macos"
  else if (/linux/i.test(ua)) os = "gnu-linux"
  else if (/iphone|ipad|ios/i.test(ua)) os = "ios"

  return { browser, os }
}

// Helper: Safely read a JSON file, returning null if missing or corrupt
function safeRead(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null
    return JSON.parse(fs.readFileSync(filePath, "utf8"))
  } catch (e) {
    return null
  }
}

module.exports = function (app, config, renderTemplate) {
  let memoryStats = getEmptyStats()
  let needsSave = false

  const v1 = safeRead(statsFile)
  const v2 = safeRead(statsFileV2)

  const mergeData = (source) => {
    if (!source) return

    if (source.videos) {
      for (const [id, count] of Object.entries(source.videos)) {
        memoryStats.videos[id] = (memoryStats.videos[id] || 0) + count
      }
    }

    if (source.browsers) {
      for (const [name, count] of Object.entries(source.browsers)) {
        memoryStats.browsers[name] = (memoryStats.browsers[name] || 0) + count
      }
    }

    if (source.os) {
      for (const [name, count] of Object.entries(source.os)) {
        memoryStats.os[name] = (memoryStats.os[name] || 0) + count
      }
    }

    if (source.users) {
      Object.assign(memoryStats.users, source.users)
    }
  }

  mergeData(v1)
  mergeData(v2)

  fs.writeFileSync(statsFile, JSON.stringify(memoryStats, null, 2))

  if (fs.existsSync(statsFileV2)) {
    try {
      fs.unlinkSync(statsFileV2)
    } catch (e) {
      console.error("Could not delete legacy stats-v2.json", e)
    }
  }

  // Periodically save to disk
  setInterval(() => {
    if (!needsSave) return

    fs.writeFile(statsFile, JSON.stringify(memoryStats, null, 2), (err) => {
      if (err) {
        console.error("Failed to save stats", err)
      } else {
        needsSave = false
      }
    })
  }, 5000)

  // POST: Write stats
  app.post(["/api/stats", "/api/nexus"], (req, res) => {
    if (!telemetryConfig.telemetry) return res.status(200).json({ ok: true })

    const { videoId, userId } = req.body
    if (!videoId) return res.status(400).json({ error: "missing videoId" })
    if (!userId) return res.status(400).json({ error: "missing userId" })

    const ua = req.headers["user-agent"] || ""
    const { browser, os } = parseUA(ua)

    memoryStats.videos[videoId] = (memoryStats.videos[videoId] || 0) + 1
    memoryStats.browsers[browser] = (memoryStats.browsers[browser] || 0) + 1
    memoryStats.os[os] = (memoryStats.os[os] || 0) + 1
    memoryStats.users[userId] = true

    needsSave = true

    res.json({ ok: true })
  })

  // OPT-OUT Page
  app.get("/api/stats/optout", (req, res) => {
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Poke – Opt out of stats</title>
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <link rel="icon" href="/favicon.ico">
  <style>
    @font-face {
      font-family: "PokeTube Flex";
      src: url("/static/robotoflex.ttf");
      font-style: normal;
      font-stretch: 1% 800%;
      font-display: swap;
    }
    :root { color-scheme: dark; }
    body { color: #fff; }
    body {
      background: #1c1b22;
      margin: 0;
    }
    :visited { color: #00c0ff; }
    a { color: #0ab7f0; }
    .app { max-width: 1000px; margin: 0 auto; padding: 24px; }
    p {
      font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif;
      line-height: 1.6;
    }
    ul {
      font-family: "poketube flex";
      font-weight: 500;
      font-stretch: extra-expanded;
      padding-left: 1.2rem;
    }
    h2 {
      font-family: "poketube flex", sans-serif;
      font-weight: 700;
      font-stretch: extra-expanded;
      margin-top: 1.5rem;
      margin-bottom: .3rem;
    }
    h1 {
      font-family: "poketube flex", sans-serif;
      font-weight: 1000;
      font-stretch: ultra-expanded;
      margin-top: 0;
      margin-bottom: .3rem;
    }
    .note { color: #bbb; font-size: .95rem; }
    .btn {
      display: inline-block;
      margin-top: 1rem;
      padding: .5rem 1rem;
      border-radius: 999px;
      border: 1px solid #2a2a35;
      background: #252432;
      color: #fff;
      font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif;
      text-decoration: none;
      font-size: .95rem;
    }
    .btn:hover {
      background: #2f2e3d;
    }
    .status {
      margin-top: .5rem;
      font-size: .95rem;
    }
  </style>
</head>
<body>
  <div class="app">
    <h1>Stats opt-out</h1>
    <p>
      This page lets you turn off <strong>anonymous usage stats</strong> for this browser.
      Poke will remember this choice using <code>localStorage</code> only (no cookies).
    </p>

    <p class="note">
      Anonymous stats help us understand which videos are popular and which platforms people use —
      without collecting personal data. You can read the full details here:
      <a href="/policies/privacy#stats">Privacy Policy</a>.
    </p>

    <a href="#" id="optout-btn" class="btn">Opt out of anonymous stats</a>
    <div id="status" class="status note"></div>

    <p class="note" style="margin-top:1.5rem;">
      • To see the stats UI (if enabled on this instance), visit
      <code><a href="/api/stats?view=human">/api/stats?view=human</a></code>.<br>
      • For raw JSON, use <code><a href="/api/stats?view=json">/api/stats?view=json</a></code>.
    </p>
  </div>

  <script>
    (function () {
      var KEY = "poke_stats_optout";
      var btn = document.getElementById("optout-btn");
      var status = document.getElementById("status");

      function updateStatus() {
        try {
          var v = localStorage.getItem(KEY);
          if (v === "1") {
            status.textContent = "Anonymous stats are currently DISABLED in this browser.";
            btn.textContent = "Re-enable anonymous stats";
          } else {
            status.textContent = "Anonymous stats are currently ENABLED in this browser.";
            btn.textContent = "Opt out of anonymous stats";
          }
        } catch (e) {
          status.textContent = "Your browser blocked localStorage, so we cannot store your opt-out choice.";
        }
      }

      btn.addEventListener("click", function (ev) {
        ev.preventDefault();
        try {
          var v = localStorage.getItem(KEY);
          if (v === "1") {
            localStorage.removeItem(KEY);
          } else {
            localStorage.setItem(KEY, "1");
          }
          updateStatus();
        } catch (e) {
          status.textContent = "Could not save opt-out preference (localStorage error).";
        }
      });

      updateStatus();
    })();
  </script>
</body>
</html>`)
  })

  // GET Stats (JSON & Human)
  app.get("/api/stats", (req, res) => {
    const view = (req.query.view || "").toString()

    if (view === "json") {
      if (!telemetryConfig.telemetry) {
        return res.json({ videos: {}, browsers: {}, os: {}, totalUsers: 0, limit: 0 })
      }

      const hasLimit = typeof req.query.limit !== "undefined"
      const rawLimit = parseInt((hasLimit ? req.query.limit : "10").toString(), 10)
      const limit = Number.isFinite(rawLimit)
        ? Math.max(1, Math.min(rawLimit, 500))
        : 10

      const sortedVideos = Object.entries(memoryStats.videos)
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)

      const topVideos = Object.fromEntries(sortedVideos)

      return res.json({
        videos: topVideos,
        browsers: memoryStats.browsers,
        os: memoryStats.os,
        totalUsers: Object.keys(memoryStats.users).length,
        limit
      })
    }

    if (view === "human") {
      const telemetryOn = telemetryConfig.telemetry

      return res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Improving Poke – Stats</title>
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <link rel="icon" href="/favicon.ico">
  <style>
    @font-face {
      font-family: "PokeTube Flex";
      src: url("/static/robotoflex.ttf");
      font-style: normal;
      font-stretch: 1% 800%;
      font-display: swap;
    }
    :root { color-scheme: dark; }
    body { color: #fff; }
    body {
      background: #1c1b22;
      margin: 0;
    }
    img.logo {
      float: right;
      margin: .3em 0 1em 2em;
    }
    :visited { color: #00c0ff; }
    a { color: #0ab7f0; }
    .app { max-width: 1100px; margin: 0 auto; padding: 24px; }
    p {
      font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif;
      line-height: 1.6;
    }
    ul {
      font-family: "poketube flex";
      font-weight: 500;
      font-stretch: extra-expanded;
      padding-left: 1.2rem;
    }
    h2 {
      font-family: "poketube flex", sans-serif;
      font-weight: 700;
      font-stretch: extra-expanded;
      margin-top: 1.5rem;
      margin-bottom: .3rem;
    }
    h1 {
      font-family: "poketube flex", sans-serif;
      font-weight: 1000;
      font-stretch: ultra-expanded;
      margin-top: 0;
      margin-bottom: .3rem;
    }
    .toc { margin: 1rem 0 2rem; }
    .toc li { margin: .25rem 0; }
    pre.license {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
      background: #111;
      padding: 14px 16px;
      border-radius: 12px;
      overflow-x: auto;
      line-height: 1.45;
      border: 1px solid #222;
    }
    hr { border: 0; border-top: 1px solid #222; margin: 28px 0; }
    .note { color: #bbb; font-size: .95rem; }
    .stats-list li { margin: .15rem 0; }
    .muted { opacity: .8; font-size: .95rem; }

    .explain-box {
      margin-top: 1rem;
      margin-bottom: 1.25rem;
      background: #252432;
      border: 1px solid #2a2a35;
      border-radius: 16px;
      padding: 16px;
    }
    .explain-box p {
      margin: 0 0 .9rem 0;
    }
    .explain-box p:last-child {
      margin-bottom: 0;
    }

    .breakdown-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 16px;
      margin-top: 1rem;
      margin-bottom: 1.25rem;
    }
    .breakdown-card {
      background: #252432;
      border: 1px solid #2a2a35;
      border-radius: 16px;
      padding: 16px;
    }
    .breakdown-card h3 {
      margin: 0 0 .85rem 0;
      font-family: "poketube flex", sans-serif;
      font-weight: 700;
      font-stretch: extra-expanded;
      font-size: 1.05rem;
    }
    .breakdown-empty {
      color: #bbb;
      font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif;
    }
    .breakdown-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .breakdown-item {
      font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif;
    }
    .breakdown-topline {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: baseline;
      margin-bottom: .4rem;
    }
    .breakdown-label {
      font-weight: 600;
      min-width: 0;
      word-break: break-word;
    }
    .breakdown-count {
      color: #bbb;
      white-space: nowrap;
      font-size: .92rem;
    }
    .breakdown-bar-wrap {
      width: 100%;
      height: 12px;
      background: #17161d;
      border: 1px solid #2a2a35;
      border-radius: 999px;
      overflow: hidden;
    }
    .breakdown-bar {
      height: 100%;
      width: 0%;
      background: linear-gradient(90deg, #0ab7f0 0%, #52d3ff 100%);
      border-radius: 999px;
    }
    .breakdown-sub {
      margin-top: .35rem;
      color: #bbb;
      font-size: .9rem;
      line-height: 1.45;
    }

    .controls {
      display: flex;
      align-items: center;
      gap: .75rem;
      flex-wrap: wrap;
      margin: .75rem 0 1rem 0;
    }
    .controls label {
      font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif;
    }
    .controls select {
      background: #252432;
      color: #fff;
      border: 1px solid #2a2a35;
      border-radius: 10px;
      padding: .45rem .7rem;
      font: inherit;
    }

    .video-grid {
      list-style: none;
      padding-left: 0;
      margin: 0;
      display: grid;
      grid-template-columns: 1fr;
      gap: 14px;
    }
    .video-card {
      display: grid;
      grid-template-columns: 180px 1fr;
      gap: 14px;
      background: #252432;
      border: 1px solid #2a2a35;
      border-radius: 16px;
      padding: 12px;
      align-items: start;
    }
    .video-thumb {
      display: block;
      width: 100%;
      aspect-ratio: 16 / 9;
      object-fit: cover;
      border-radius: 12px;
      background: #111;
    }
    .video-meta {
      min-width: 0;
      font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif;
    }
    .video-title {
      display: inline-block;
      font-weight: 700;
      line-height: 1.35;
      text-decoration: none;
      word-break: break-word;
    }
    .video-id {
      color: #bbb;
      font-size: .9rem;
      margin-top: .4rem;
      word-break: break-all;
    }
    .video-views {
      margin-top: .5rem;
      font-size: .95rem;
      color: #fff;
    }
    .video-note {
      margin-top: .45rem;
      color: #bbb;
      font-size: .9rem;
      line-height: 1.45;
    }
    .video-rank {
      margin-top: .45rem;
      color: #bbb;
      font-size: .9rem;
    }

    .pagination-wrap {
      margin-top: 1rem;
      display: flex;
      flex-direction: column;
      gap: .75rem;
    }
    .pagination-info {
      color: #bbb;
      font-size: .95rem;
      font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif;
    }
    .pagination-controls {
      display: flex;
      align-items: center;
      gap: .5rem;
      flex-wrap: wrap;
    }
    .page-btn {
      background: #252432;
      color: #fff;
      border: 1px solid #2a2a35;
      border-radius: 10px;
      padding: .5rem .8rem;
      font: inherit;
      cursor: pointer;
    }
    .page-btn[disabled] {
      opacity: .5;
      cursor: not-allowed;
    }
    .page-number {
      min-width: 2.2rem;
      text-align: center;
      background: #1f1e29;
    }
    .page-number.active {
      border-color: #0ab7f0;
      box-shadow: inset 0 0 0 1px #0ab7f0;
    }

    @media (max-width: 860px) {
      .breakdown-grid {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 640px) {
      .video-card {
        grid-template-columns: 1fr;
      }
      .breakdown-topline {
        flex-direction: column;
        align-items: flex-start;
        gap: .2rem;
      }
    }
  </style>
</head>
<body>
  <div class="app">
    <h1>Anonymous stats</h1>
    <p class="note">
      These stats are aggregated locally on this Poke instance. For what is collected (and what is not),
      see <a href="/policies/privacy#stats">privacy policy</a>.
    </p>

    <div class="explain-box">
      <p><strong>Important:</strong> the numbers shown on this page are <strong>not</strong> the public video view counts from YouTube or any other upstream site.</p>
      <p>They only show views recorded on this specific Poke instance.</p>
      <p>If a video says <strong>27 local Poke instance views</strong>, that means this instance recorded 27 anonymous views for it here.</p>
    </div>

    <h2>Current anonymous stats</h2>
    <p id="stats-note" class="note">Loading…</p>
    <ul id="stats-list" class="stats-list"></ul>

    <div class="breakdown-grid">
      <div class="breakdown-card">
        <h3>Operating systems</h3>
        <div id="os-breakdown" class="breakdown-list"></div>
      </div>

      <div class="breakdown-card">
        <h3>Browsers</h3>
        <div id="browser-breakdown" class="breakdown-list"></div>
      </div>
    </div>

    <h2>Top videos (local-only)</h2>
    <p class="note">
      This section ranks videos by <strong>local Poke instance views</strong> only.
      It does <strong>not</strong> show YouTube public view totals.
    </p>

    <div class="controls">
      <label for="video-limit">Show top videos:</label>
      <select id="video-limit">
        <option value="10">10</option>
        <option value="20">20</option>
        <option value="50">50</option>
        <option value="100" selected>100</option>
        <option value="200">200</option>
        <option value="500">500</option>
      </select>
    </div>

    <ul id="top-videos" class="video-grid"></ul>

    <div id="pagination-wrap" class="pagination-wrap" style="display:none;">
      <div id="pagination-info" class="pagination-info"></div>
      <div id="pagination-controls" class="pagination-controls"></div>
    </div>

    <hr>

    <h2>API usage</h2>
    <p class="note">
      • Human view (this page): <code><a href="/api/stats?view=human">/api/stats?view=human</a></code><br>
      • JSON view (for scripts/tools): <code><a href="/api/stats?view=json">/api/stats?view=json</a></code><br>
      • JSON default limit: <code><a href="/api/stats?view=json">/api/stats?view=json</a></code> (10 videos)<br>
      • JSON with custom limit: <code><a href="/api/stats?view=json&limit=500">/api/stats?view=json&limit=500</a></code><br>
      • Opt out for this browser: <code><a href="/api/stats/optout">/api/stats/optout</a></code>
    </p>
  </div>

  <script>
    const TELEMETRY_ON = ${telemetryOn ? "true" : "false"};
    const OPT_KEY = "poke_stats_optout";
    const CARDS_PER_PAGE = 50;

    const statsNote = document.getElementById("stats-note");
    const statsList = document.getElementById("stats-list");
    const topVideos = document.getElementById("top-videos");
    const videoLimitSelect = document.getElementById("video-limit");
    const paginationWrap = document.getElementById("pagination-wrap");
    const paginationInfo = document.getElementById("pagination-info");
    const paginationControls = document.getElementById("pagination-controls");
    const osBreakdown = document.getElementById("os-breakdown");
    const browserBreakdown = document.getElementById("browser-breakdown");

    var allVideos = {};
    var currentPage = 1;

    function getThumbnailUrl(videoId) {
      return "https://i.ytimg.com/vi/" + encodeURIComponent(videoId) + "/hqdefault.jpg";
    }

    function getSelectedLimit() {
      return parseInt(videoLimitSelect.value, 10) || 100;
    }

    function getLimitedEntries() {
      return Object.entries(allVideos).slice(0, getSelectedLimit());
    }

    function getTotalPages(entries) {
      return Math.max(1, Math.ceil(entries.length / CARDS_PER_PAGE));
    }

    function createPageButton(label, page, disabled, active) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "page-btn" + (active ? " page-number active" : page ? " page-number" : "");
      btn.textContent = label;

      if (disabled) {
        btn.disabled = true;
        return btn;
      }

      btn.addEventListener("click", function () {
        if (page === currentPage) return;
        currentPage = page;
        renderTopVideos();
      });

      return btn;
    }

    function renderPagination(entries) {
      var totalPages = getTotalPages(entries);

      if (entries.length <= CARDS_PER_PAGE) {
        paginationWrap.style.display = "none";
        paginationInfo.textContent = "";
        paginationControls.innerHTML = "";
        return;
      }

      paginationWrap.style.display = "flex";
      paginationControls.innerHTML = "";

      var startIndex = (currentPage - 1) * CARDS_PER_PAGE + 1;
      var endIndex = Math.min(currentPage * CARDS_PER_PAGE, entries.length);

      paginationInfo.textContent =
        "Showing " + startIndex + "–" + endIndex + " of " + entries.length +
        " videos. These are local Poke instance view rankings, not YouTube public views.";

      paginationControls.appendChild(
        createPageButton("Prev", currentPage - 1, currentPage === 1, false)
      );

      var startPage = Math.max(1, currentPage - 2);
      var endPage = Math.min(totalPages, currentPage + 2);

      if (startPage > 1) {
        paginationControls.appendChild(createPageButton("1", 1, false, currentPage === 1));
        if (startPage > 2) {
          var gapLeft = document.createElement("span");
          gapLeft.className = "note";
          gapLeft.textContent = "…";
          paginationControls.appendChild(gapLeft);
        }
      }

      for (var page = startPage; page <= endPage; page++) {
        paginationControls.appendChild(
          createPageButton(String(page), page, false, page === currentPage)
        );
      }

      if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
          var gapRight = document.createElement("span");
          gapRight.className = "note";
          gapRight.textContent = "…";
          paginationControls.appendChild(gapRight);
        }
        paginationControls.appendChild(
          createPageButton(String(totalPages), totalPages, false, currentPage === totalPages)
        );
      }

      paginationControls.appendChild(
        createPageButton("Next", currentPage + 1, currentPage === totalPages, false)
      );
    }

    function formatPercent(part, total) {
      if (!total) return "0.00";
      return ((part / total) * 100).toFixed(2);
    }

    function sumValues(obj) {
      return Object.values(obj || {}).reduce(function (sum, value) {
        return sum + value;
      }, 0)
    }

    function humanizeOsName(name) {
      if (name === "windows") return "Windows"
      if (name === "android") return "Android"
      if (name === "unknown") return "Unknown"
      if (name === "macos") return "macOS"
      if (name === "gnu-linux") return "GNU/Linux"
      if (name === "ios") return "iOS"
      return name
    }

    function humanizeBrowserName(name) {
      if (name === "firefox") return "Firefox"
      if (name === "chrome") return "Chromium browser"
      if (name === "safari") return "Safari"
      if (name === "edge") return "Edge"
      if (name === "unknown") return "Unknown"
      return name
    }

    function renderBreakdown(targetEl, data, kind) {
      targetEl.innerHTML = "";

      var entries = Object.entries(data || {}).sort(function (a, b) {
        return b[1] - a[1];
      });

      if (entries.length === 0) {
        var empty = document.createElement("div");
        empty.className = "breakdown-empty";
        empty.textContent = "No data recorded yet.";
        targetEl.appendChild(empty);
        return;
      }

      var total = sumValues(data);

      entries.forEach(function (entry) {
        var key = entry[0];
        var count = entry[1];
        var percent = formatPercent(count, total);
        var label = kind === "os" ? humanizeOsName(key) : humanizeBrowserName(key);

        var item = document.createElement("div");
        item.className = "breakdown-item";

        var topLine = document.createElement("div");
        topLine.className = "breakdown-topline";

        var labelEl = document.createElement("div");
        labelEl.className = "breakdown-label";
        labelEl.textContent = label + " — " + percent + "% of total " + (kind === "os" ? "OS detections" : "browser detections");

        var countEl = document.createElement("div");
        countEl.className = "breakdown-count";
        countEl.textContent = count + " detections";

        var barWrap = document.createElement("div");
        barWrap.className = "breakdown-bar-wrap";

        var bar = document.createElement("div");
        bar.className = "breakdown-bar";
        bar.style.width = percent + "%";

        var sub = document.createElement("div");
        sub.className = "breakdown-sub";
        sub.textContent =
          label + " was detected " + count + " times out of " + total + " total " +
          (kind === "os" ? "OS detections" : "browser detections") + " on this Poke instance.";

        barWrap.appendChild(bar);
        topLine.appendChild(labelEl);
        topLine.appendChild(countEl);

        item.appendChild(topLine);
        item.appendChild(barWrap);
        item.appendChild(sub);

        targetEl.appendChild(item);
      });
    }

    function renderTopVideos() {
      var entries = getLimitedEntries();
      var totalPages = getTotalPages(entries);

      if (currentPage > totalPages) currentPage = totalPages;
      if (currentPage < 1) currentPage = 1;

      if (entries.length === 0) {
        topVideos.innerHTML = "<li>No stats recorded yet.</li>";
        paginationWrap.style.display = "none";
        return;
      }

      var start = (currentPage - 1) * CARDS_PER_PAGE;
      var end = start + CARDS_PER_PAGE;
      var pageEntries = entries.slice(start, end);

      topVideos.innerHTML = "";

      pageEntries.forEach(function (entry, pageIndex) {
        var absoluteIndex = start + pageIndex;
        var id = entry[0];
        var views = entry[1];

        var li = document.createElement("li");
        li.className = "video-card";

        var thumbLink = document.createElement("a");
        thumbLink.href = "/watch?v=" + encodeURIComponent(id);
        thumbLink.setAttribute("aria-label", "Open video " + id);

        var img = document.createElement("img");
        img.className = "video-thumb";
        img.src = getThumbnailUrl(id);
        img.alt = "Thumbnail for video " + id;
        img.loading = "lazy";
        img.referrerPolicy = "no-referrer";
        img.onerror = function () {
          this.style.display = "none";
        };

        thumbLink.appendChild(img);

        var meta = document.createElement("div");
        meta.className = "video-meta";

        var titleLink = document.createElement("a");
        titleLink.className = "video-title";
        titleLink.href = "/watch?v=" + encodeURIComponent(id);
        titleLink.textContent = id;

        var rank = document.createElement("div");
        rank.className = "video-rank";
        rank.textContent = "Rank #" + (absoluteIndex + 1);

        var idEl = document.createElement("div");
        idEl.className = "video-id";
        idEl.textContent = "Video ID: " + id;

        var viewsEl = document.createElement("div");
        viewsEl.className = "video-views";
        viewsEl.textContent = views + " local Poke instance views";

        var noteEl = document.createElement("div");
        noteEl.className = "video-note";
        noteEl.textContent =
          "This number is counted only from anonymous requests on this Poke instance. It is not the video's public YouTube view count.";

        meta.appendChild(titleLink);
        meta.appendChild(rank);
        meta.appendChild(idEl);
        meta.appendChild(viewsEl);
        meta.appendChild(noteEl);

        li.appendChild(thumbLink);
        li.appendChild(meta);

        topVideos.appendChild(li);
      });

      renderPagination(entries);
    }

    if (!TELEMETRY_ON) {
      statsNote.textContent =
        "Anonymous usage statistics are disabled on this instance. No stats are being collected.";
      statsList.innerHTML = "";
      topVideos.innerHTML = "<li>No data (telemetry disabled).</li>";
      videoLimitSelect.disabled = true;
      paginationWrap.style.display = "none";
      osBreakdown.innerHTML = '<div class="breakdown-empty">No data (telemetry disabled).</div>';
      browserBreakdown.innerHTML = '<div class="breakdown-empty">No data (telemetry disabled).</div>';
    } else {
      var optedOut = false;
      try {
        optedOut = localStorage.getItem(OPT_KEY) === "1";
      } catch (e) {}

      if (optedOut) {
        statsNote.textContent =
          "You have opted out of anonymous stats in this browser. Poke will not load stats for you here.";
        statsList.innerHTML = "";
        topVideos.innerHTML = "<li>Opt-out active (no stats loaded).</li>";
        videoLimitSelect.disabled = true;
        paginationWrap.style.display = "none";
        osBreakdown.innerHTML = '<div class="breakdown-empty">Opt-out active (no stats loaded).</div>';
        browserBreakdown.innerHTML = '<div class="breakdown-empty">Opt-out active (no stats loaded).</div>';
      } else {
        fetch("/api/stats?view=json&limit=500")
          .then(function (res) { return res.json(); })
          .then(function (data) {
            var videos = data.videos || {};
            var browsers = data.browsers || {};
            var os = data.os || {};
            var totalUsers = data.totalUsers || 0;

            allVideos = videos;

            statsNote.textContent = "";
            statsList.innerHTML = "";

            var summaryItems = [
              "Anonymous users (unique local IDs): " + totalUsers
            ];

            summaryItems.forEach(function (text) {
              var li = document.createElement("li");
              li.textContent = text;
              statsList.appendChild(li);
            });

            renderBreakdown(osBreakdown, os, "os");
            renderBreakdown(browserBreakdown, browsers, "browser");

            currentPage = 1;
            renderTopVideos();

            videoLimitSelect.addEventListener("change", function () {
              currentPage = 1;
              renderTopVideos();
            });
          })
          .catch(function () {
            statsNote.textContent =
              "Could not load stats (maybe they are disabled or there was an error).";
            statsList.innerHTML = "";
            topVideos.innerHTML = "<li>Error loading data.</li>";
            videoLimitSelect.disabled = true;
            paginationWrap.style.display = "none";
            osBreakdown.innerHTML = '<div class="breakdown-empty">Error loading OS data.</div>';
            browserBreakdown.innerHTML = '<div class="breakdown-empty">Error loading browser data.</div>';
          });
      }
    }
  </script>
</body>
</html>`)
    }

    return res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Improving Poke</title>
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <link rel="icon" href="/favicon.ico">
  <style>
    @font-face {
      font-family: "PokeTube Flex";
      src: url("/static/robotoflex.ttf");
      font-style: normal;
      font-stretch: 1% 800%;
      font-display: swap;
    }
    :root { color-scheme: dark; }
    body { color: #fff; }
    body {
      background: #1c1b22;
      margin: 0;
    }
    img {
      float: right;
      margin: .3em 0 1em 2em;
    }
    :visited { color: #00c0ff; }
    a { color: #0ab7f0; }
    .app { max-width: 1000px; margin: 0 auto; padding: 24px; }
    p {
      font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif;
      line-height: 1.6;
    }
    ul {
      font-family: "poketube flex";
      font-weight: 500;
      font-stretch: extra-expanded;
      padding-left: 1.2rem;
    }
    h2 {
      font-family: "poketube flex", sans-serif;
      font-weight: 700;
      font-stretch: extra-expanded;
      margin-top: 1.5rem;
      margin-bottom: .3rem;
    }
    h1 {
      font-family: "poketube flex", sans-serif;
      font-weight: 1000;
      font-stretch: ultra-expanded;
      margin-top: 0;
      margin-bottom: .3rem;
    }
    .toc { margin: 1rem 0 2rem; }
    .toc li { margin: .25rem 0; }
    pre.license {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
      background: #111;
      padding: 14px 16px;
      border-radius: 12px;
      overflow-x: auto;
      line-height: 1.45;
      border: 1px solid #222;
    }
    hr { border: 0; border-top: 1px solid #222; margin: 28px 0; }
    .note { color: #bbb; font-size: .95rem; }
    .stats-list li { margin: .15rem 0; }
    .muted { opacity: .8; font-size: .95rem; }
  </style>
</head>
<body>
  <div class="app">
    <img src="/css/logo-poke.svg" alt="Poke logo">
    <h1>Improving Poke</h1>
    <h2>Private by design</h2>

    <p>
      At <a href="/">Poke</a>, we do not collect or share any personal information.
      That's our privacy promise in a nutshell.
      To improve Poke we use a completely anonymous, local-only way to figure out how the site is being used.
    </p>

    <p>
      Any anonymous stats recorded by this instance come from the <code>/api/stats</code> system.
      You can read exactly what is measured (and what is <em>not</em>) in our privacy policy:
      <a href="/policies/privacy#stats">here</a>.
    </p>

    <hr>

    <h2>API usage</h2>
    <p class="note">
      • Human view (stats UI): <code><a href="/api/stats?view=human">/api/stats?view=human</a></code><br>
      • JSON view (for scripts/tools): <code><a href="/api/stats?view=json">/api/stats?view=json</a></code><br>
      • JSON default limit: <code><a href="/api/stats?view=json">/api/stats?view=json</a></code> (10 videos)<br>
      • JSON with custom limit: <code><a href="/api/stats?view=json&limit=500">/api/stats?view=json&limit=500</a></code><br>
      • Opt out for this browser: <code><a href="/api/stats/optout">/api/stats/optout</a></code>
    </p>
  </div>
</body>
</html>`)
  })
}