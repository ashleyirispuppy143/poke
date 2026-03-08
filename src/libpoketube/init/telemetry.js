//  At Poke, we do not collect or share any personal information. That's our privacy promise in a nutshell. To improve Poke we use a completely anonymous, local-only way to figure out how the site is being used.
//Any anonymous stats recorded by this instance come from the /api/stats system. You can read exactly what is measured (and what is not) in our privacy policy.

const fs = require("fs")
const path = require("path")

const telemetryConfig = { telemetry: true }

const statsFile = path.join(__dirname, "stats.json")
const statsFileV2 = path.join(__dirname, "stats-v2.json")

const getEmptyStats = () => ({
  videos: {},
  browsers: {},
  os: {},
  users: {},
  recentVideos: []
})

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

  function touchRecentVideo(videoId) {
    if (!videoId) return
    memoryStats.recentVideos = (memoryStats.recentVideos || []).filter((id) => id !== videoId)
    memoryStats.recentVideos.unshift(videoId)
    if (memoryStats.recentVideos.length > 300) {
      memoryStats.recentVideos.length = 300
    }
  }

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

    if (Array.isArray(source.recentVideos)) {
      for (let i = source.recentVideos.length - 1; i >= 0; i--) {
        touchRecentVideo(source.recentVideos[i])
      }
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
    touchRecentVideo(videoId)

    needsSave = true

    res.json({ ok: true })
  })

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
    p{
      font-family: system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,"Noto Sans",sans-serif;
      line-height: 1.6;
    }
    ul{
      font-family:"poketube flex";
      font-weight:500;
      font-stretch:extra-expanded;
      padding-left:1.2rem;
    }
    h2{
      font-family:"poketube flex",sans-serif;
      font-weight:700;
      font-stretch:extra-expanded;
      margin-top:1.5rem;
      margin-bottom:.3rem;
    }
    h1{
      font-family:"poketube flex",sans-serif;
      font-weight:1000;
      font-stretch:ultra-expanded;
      margin-top:0;
      margin-bottom:.3rem;
    }
    .note{color:#bbb;font-size:.95rem;}
    .btn{
      display:inline-block;
      margin-top:1rem;
      padding:.5rem 1rem;
      border-radius:999px;
      border:1px solid #2a2a35;
      background:#252432;
      color:#fff;
      font-family:system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,"Noto Sans",sans-serif;
      text-decoration:none;
      font-size:.95rem;
    }
    .btn:hover{
      background:#2f2e3d;
    }
    .status{
      margin-top:.5rem;
      font-size:.95rem;
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

  app.get("/api/stats", (req, res) => {
    const view = (req.query.view || "").toString()

    if (view === "json") {
      if (!telemetryConfig.telemetry) {
        return res.json({
          videos: {},
          recentVideos: [],
          browsers: {},
          os: {},
          totalUsers: 0,
          totalVideoIds: 0,
          limit: 0
        })
      }

      const hasLimit = typeof req.query.limit !== "undefined"
      const rawLimit = parseInt((hasLimit ? req.query.limit : "8").toString(), 10)
      const limit = Number.isFinite(rawLimit)
        ? Math.max(1, Math.min(rawLimit, 3000))
        : 8

      const sortedVideos = Object.entries(memoryStats.videos)
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)

      const topVideos = Object.fromEntries(sortedVideos)

      return res.json({
        videos: topVideos,
        recentVideos: (memoryStats.recentVideos || []).slice(0, 32),
        browsers: memoryStats.browsers,
        os: memoryStats.os,
        totalUsers: Object.keys(memoryStats.users).length,
        totalVideoIds: Object.keys(memoryStats.videos).length,
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
    :root{color-scheme:dark}
    body{color:#fff}
    body{
      background:#1c1b22;
      margin:0;
    }
    img.logo{
      float:right;
      margin:.3em 0 1em 2em;
    }
    :visited{color:#00c0ff}
    a{color:#0ab7f0}
    .app{
      max-width:1100px;
      margin:0 auto;
      padding:24px;
    }
    p{
      font-family:system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,"Noto Sans",sans-serif;
      line-height:1.6;
    }
    h2{
      font-family:"poketube flex",sans-serif;
      font-weight:700;
      font-stretch:extra-expanded;
      margin-top:0;
      margin-bottom:.4rem;
    }
    h1{
      font-family:"poketube flex",sans-serif;
      font-weight:1000;
      font-stretch:ultra-expanded;
      margin-top:0;
      margin-bottom:.35rem;
    }
    h3{
      font-family:"poketube flex",sans-serif;
      font-weight:700;
      font-stretch:extra-expanded;
      margin:0 0 .75rem 0;
      font-size:1.02rem;
    }
    hr{
      border:0;
      border-top:1px solid #222;
      margin:28px 0;
    }
    .note{
      color:#bbb;
      font-size:.95rem;
    }

    .hero{
      display:grid;
      grid-template-columns:1.5fr .9fr;
      gap:16px;
      align-items:start;
      margin-bottom:18px;
    }
    .hero-main,
    .hero-side{
      background:#252432;
      border:1px solid #2a2a35;
      border-radius:18px;
      padding:18px;
    }
    .hero-main p,
    .hero-side p{
      margin:.4rem 0 0 0;
    }
    .hero-side{
      display:flex;
      flex-direction:column;
      gap:16px;
    }
    .mini-stat{
      display:flex;
      flex-direction:column;
      gap:.15rem;
    }
    .mini-stat-label{
      color:#bbb;
      font-size:.92rem;
      font-family:system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,"Noto Sans",sans-serif;
    }
    .mini-stat-value{
      font-size:1.55rem;
      font-weight:700;
      font-family:system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,"Noto Sans",sans-serif;
    }

    .segmented{
      display:flex;
      gap:10px;
      flex-wrap:wrap;
      margin:0 0 18px 0;
    }
    .seg-btn{
      background:#252432;
      color:#fff;
      border:1px solid #2a2a35;
      border-radius:999px;
      padding:.58rem .9rem;
      font:inherit;
      cursor:pointer;
    }
    .seg-btn.active{
      border-color:#0ab7f0;
      box-shadow:inset 0 0 0 1px #0ab7f0;
      background:#1f1e29;
    }

    .panel{
      display:none;
    }
    .panel.active{
      display:block;
    }

    .section-card{
      background:#252432;
      border:1px solid #2a2a35;
      border-radius:18px;
      padding:18px;
      margin-bottom:16px;
    }

    .overview-grid{
      display:grid;
      grid-template-columns:repeat(2,minmax(0,1fr));
      gap:16px;
    }

    .breakdown-empty{
      color:#bbb;
      font-family:system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,"Noto Sans",sans-serif;
    }
    .breakdown-list{
      display:flex;
      flex-direction:column;
      gap:12px;
    }
    .breakdown-item{
      font-family:system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,"Noto Sans",sans-serif;
    }
    .breakdown-topline{
      display:flex;
      justify-content:space-between;
      gap:12px;
      align-items:baseline;
      margin-bottom:.4rem;
    }
    .breakdown-label{
      font-weight:600;
      min-width:0;
      word-break:break-word;
    }
    .breakdown-count{
      color:#bbb;
      white-space:nowrap;
      font-size:.92rem;
    }
    .breakdown-bar-wrap{
      width:100%;
      height:12px;
      background:#17161d;
      border:1px solid #2a2a35;
      border-radius:999px;
      overflow:hidden;
    }
    .breakdown-bar{
      height:100%;
      width:0%;
      background:linear-gradient(90deg,#0ab7f0 0%,#52d3ff 100%);
      border-radius:999px;
    }
    .breakdown-sub{
      margin-top:.35rem;
      color:#bbb;
      font-size:.9rem;
      line-height:1.45;
    }

    .controls{
      display:flex;
      align-items:center;
      gap:.75rem;
      flex-wrap:wrap;
      margin:.25rem 0 1rem 0;
    }
    .controls label{
      font-family:system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,"Noto Sans",sans-serif;
    }
    .controls select{
      background:#252432;
      color:#fff;
      border:1px solid #2a2a35;
      border-radius:10px;
      padding:.45rem .7rem;
      font:inherit;
    }
    .limit-warning{
      width:100%;
      color:#bbb;
      font-size:.95rem;
      font-family:system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,"Noto Sans",sans-serif;
      margin-top:-.15rem;
    }

    .compact-head{
      display:flex;
      justify-content:space-between;
      gap:16px;
      align-items:flex-start;
      flex-wrap:wrap;
      margin-bottom:12px;
    }

    .recent-grid,
    .video-grid{
      list-style:none;
      padding-left:0;
      margin:0;
      display:grid;
      grid-template-columns:repeat(4,minmax(0,1fr));
      gap:14px;
    }

    .recent-card,
    .video-card{
      display:flex;
      flex-direction:column;
      gap:10px;
      background:#252432;
      border:1px solid #2a2a35;
      border-radius:16px;
      padding:12px;
      min-width:0;
    }

    .video-thumb-link{
      display:block;
      width:100%;
    }
    .video-thumb{
      display:block;
      width:100%;
      aspect-ratio:16 / 9;
      object-fit:cover;
      border-radius:12px;
      background:#111;
    }
    .video-meta{
      min-width:0;
      font-family:system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,"Noto Sans",sans-serif;
    }
    .video-title{
      display:inline-block;
      font-weight:700;
      line-height:1.35;
      text-decoration:none;
      word-break:break-word;
    }
    .video-id{
      color:#bbb;
      font-size:.9rem;
      margin-top:.4rem;
      word-break:break-all;
    }
    .video-views{
      margin-top:.5rem;
      font-size:.95rem;
      color:#fff;
    }
    .video-note{
      margin-top:.45rem;
      color:#bbb;
      font-size:.9rem;
      line-height:1.45;
    }
    .video-rank{
      margin-top:.45rem;
      color:#bbb;
      font-size:.9rem;
    }

    .pagination-wrap{
      margin-top:1rem;
      display:flex;
      flex-direction:column;
      gap:.75rem;
    }
    .pagination-info{
      color:#bbb;
      font-size:.95rem;
      font-family:system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,"Noto Sans",sans-serif;
    }
    .pagination-controls{
      display:flex;
      align-items:center;
      gap:.5rem;
      flex-wrap:wrap;
    }
    .page-btn{
      background:#252432;
      color:#fff;
      border:1px solid #2a2a35;
      border-radius:10px;
      padding:.5rem .8rem;
      font:inherit;
      cursor:pointer;
    }
    .page-btn[disabled]{
      opacity:.5;
      cursor:not-allowed;
    }
    .page-number{
      min-width:2.2rem;
      text-align:center;
      background:#1f1e29;
    }
    .page-number.active{
      border-color:#0ab7f0;
      box-shadow:inset 0 0 0 1px #0ab7f0;
    }

    .api-lines code{
      white-space:nowrap;
    }

    @media (max-width: 1000px){
      .recent-grid,
      .video-grid{
        grid-template-columns:repeat(3,minmax(0,1fr));
      }
    }

    @media (max-width: 900px){
      .hero{
        grid-template-columns:1fr;
      }
      .overview-grid{
        grid-template-columns:1fr;
      }
    }

    @media (max-width: 860px){
      .recent-grid,
      .video-grid{
        grid-template-columns:repeat(2,minmax(0,1fr));
      }
    }

    @media (max-width: 640px){
      .recent-grid,
      .video-grid{
        grid-template-columns:1fr;
      }
      .breakdown-topline{
        flex-direction:column;
        align-items:flex-start;
        gap:.2rem;
      }
    }
  </style>
</head>
<body>
  <div class="app">
    <div class="hero">
      <div class="hero-main">
        <h1>Anonymous stats</h1>
        <p class="note">
          These stats are aggregated locally on this Poke instance. For what is collected (and what is not),
          see <a href="/policies/privacy#stats">privacy policy</a>.
        </p>
        <p class="note" style="margin-top:.7rem;">
          <strong>Important:</strong> these are local Poke instance numbers, not public YouTube view counts.
        </p>
      </div>

      <div class="hero-side">
        <div class="mini-stat">
          <div class="mini-stat-label">user id count</div>
          <div id="user-id-count" class="mini-stat-value">Loading…</div>
        </div>

        <div class="mini-stat">
          <div class="mini-stat-label">total video ids seen in total</div>
          <div id="total-video-id-count" class="mini-stat-value">Loading…</div>
        </div>
      </div>
    </div>

    <div class="segmented">
      <button type="button" class="seg-btn active" data-panel="overview-panel">Overview</button>
      <button type="button" class="seg-btn" data-panel="recent-panel">Recent</button>
      <button type="button" class="seg-btn" data-panel="top-panel">Top videos</button>
      <button type="button" class="seg-btn" data-panel="api-panel">API</button>
    </div>

    <section id="overview-panel" class="panel active">
      <div class="section-card">
        <h2>How to read this page</h2>
        <p class="note" style="margin:0;">
          If a video shows <strong>27 local Poke instance views</strong>, it means this Poke instance recorded 27 anonymous views for that video here.
          It does not reflect the public upstream platform counter.
        </p>
      </div>

      <div class="overview-grid">
        <div class="section-card">
          <h3>Operating systems</h3>
          <div id="os-breakdown" class="breakdown-list"></div>
        </div>

        <div class="section-card">
          <h3>Browsers</h3>
          <div id="browser-breakdown" class="breakdown-list"></div>
        </div>
      </div>
    </section>

    <section id="recent-panel" class="panel">
      <div class="section-card">
        <div class="compact-head">
          <div>
            <h2>Recently viewed video IDs</h2>
            <p class="note" style="margin:0;">The most recently viewed IDs recorded by this Poke instance.</p>
          </div>
        </div>
        <ul id="recent-videos" class="recent-grid"></ul>
      </div>
    </section>

    <section id="top-panel" class="panel">
      <div class="section-card">
        <div class="compact-head">
          <div>
            <h2>Top videos (local-only)</h2>
            <p class="note" style="margin:0;">
              Ranked by <strong>local Poke instance views</strong> only, not public YouTube totals.
            </p>
          </div>
        </div>

        <div class="controls">
          <label for="video-limit">Show top videos:</label>
          <select id="video-limit">
            <option value="8">8</option>
            <option value="20">20</option>
            <option value="100" selected>100</option>
            <option value="200">200</option>
            <option value="500">500</option>
            <option value="1000">1000</option>
            <option value="3000">3000</option>
          </select>
          <div id="limit-warning" class="limit-warning" style="display:none;">
            Warning: this mode may have a lot of pages.
          </div>
        </div>

        <ul id="top-videos" class="video-grid"></ul>

        <div id="pagination-wrap" class="pagination-wrap" style="display:none;">
          <div id="pagination-info" class="pagination-info"></div>
          <div id="pagination-controls" class="pagination-controls"></div>
        </div>
      </div>
    </section>

    <section id="api-panel" class="panel">
      <div class="section-card api-lines">
        <h2>API usage</h2>
        <p class="note">
          • Human view (this page): <code><a href="/api/stats?view=human">/api/stats?view=human</a></code><br>
          • JSON view (for scripts/tools): <code><a href="/api/stats?view=json">/api/stats?view=json</a></code><br>
          • JSON default limit: <code><a href="/api/stats?view=json">/api/stats?view=json</a></code> (8 videos)<br>
          • JSON with custom limit: <code><a href="/api/stats?view=json&limit=3000">/api/stats?view=json&limit=3000</a></code><br>
          • Opt out for this browser: <code><a href="/api/stats/optout">/api/stats/optout</a></code>
        </p>
      </div>
    </section>
  </div>

  <script>
    const TELEMETRY_ON = ${telemetryOn ? "true" : "false"};
    const OPT_KEY = "poke_stats_optout";
    const CARDS_PER_PAGE = 40;

    const topVideos = document.getElementById("top-videos");
    const recentVideos = document.getElementById("recent-videos");
    const videoLimitSelect = document.getElementById("video-limit");
    const paginationWrap = document.getElementById("pagination-wrap");
    const paginationInfo = document.getElementById("pagination-info");
    const paginationControls = document.getElementById("pagination-controls");
    const osBreakdown = document.getElementById("os-breakdown");
    const browserBreakdown = document.getElementById("browser-breakdown");
    const userIdCount = document.getElementById("user-id-count");
    const totalVideoIdCount = document.getElementById("total-video-id-count");
    const limitWarning = document.getElementById("limit-warning");
    const segButtons = document.querySelectorAll(".seg-btn");
    const panels = document.querySelectorAll(".panel");

    var allVideos = {};
    var recentVideoIds = [];
    var currentPage = 1;

    function setActivePanel(panelId) {
      panels.forEach(function (panel) {
        panel.classList.toggle("active", panel.id === panelId);
      });

      segButtons.forEach(function (btn) {
        btn.classList.toggle("active", btn.getAttribute("data-panel") === panelId);
      });
    }

    segButtons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        setActivePanel(btn.getAttribute("data-panel"));
      });
    });

    function getThumbnailUrl(videoId) {
      return "https://i.ytimg.com/vi/" + encodeURIComponent(videoId) + "/hqdefault.jpg";
    }

    function getSelectedLimit() {
      return parseInt(videoLimitSelect.value, 10) || 100;
    }

    function getLimitedEntries() {
      return Object.entries(allVideos).slice(0, getSelectedLimit());
    }

    function shouldPaginate() {
      var selected = getSelectedLimit();
      return selected === 1000 || selected === 3000;
    }

    function updateLimitWarning() {
      var selected = getSelectedLimit();
      limitWarning.style.display = selected === 1000 || selected === 3000 ? "block" : "none";
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
      if (!shouldPaginate()) {
        paginationWrap.style.display = "none";
        paginationInfo.textContent = "";
        paginationControls.innerHTML = "";
        return;
      }

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
      }, 0);
    }

    function humanizeOsName(name) {
      if (name === "windows") return "Windows";
      if (name === "android") return "Android";
      if (name === "unknown") return "Unknown";
      if (name === "macos") return "macOS";
      if (name === "gnu-linux") return "GNU/Linux";
      if (name === "ios") return "iOS";
      return name;
    }

    function humanizeBrowserName(name) {
      if (name === "firefox") return "Firefox";
      if (name === "chrome") return "Chromium browser";
      if (name === "safari") return "Safari";
      if (name === "edge") return "Edge";
      if (name === "unknown") return "Unknown";
      return name;
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

    function createVideoCard(videoId, extraText, thumbAlt, href) {
      var li = document.createElement("li");
      li.className = "video-card";

      var thumbLink = document.createElement("a");
      thumbLink.className = "video-thumb-link";
      thumbLink.href = href;
      thumbLink.setAttribute("aria-label", "Open video " + videoId);

      var img = document.createElement("img");
      img.className = "video-thumb";
      img.src = getThumbnailUrl(videoId);
      img.alt = thumbAlt;
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
      titleLink.href = href;
      titleLink.textContent = videoId;

      var idEl = document.createElement("div");
      idEl.className = "video-id";
      idEl.textContent = "Video ID: " + videoId;

      var infoEl = document.createElement("div");
      infoEl.className = "video-note";
      infoEl.textContent = extraText;

      meta.appendChild(titleLink);
      meta.appendChild(idEl);
      meta.appendChild(infoEl);

      li.appendChild(thumbLink);
      li.appendChild(meta);

      return li;
    }

    function renderRecentVideos() {
      recentVideos.innerHTML = "";

      if (!Array.isArray(recentVideoIds) || recentVideoIds.length === 0) {
        recentVideos.innerHTML = "<li>No recent video IDs recorded yet.</li>";
        return;
      }

      recentVideoIds.slice(0, 8).forEach(function (videoId, index) {
        var card = createVideoCard(
          videoId,
          "Recently viewed on this Poke instance. Position #" + (index + 1) + " in the recent list.",
          "Thumbnail for recent video " + videoId,
          "/watch?v=" + encodeURIComponent(videoId)
        );

        card.className = "recent-card";
        recentVideos.appendChild(card);
      });
    }

    function renderTopVideos() {
      var entries = getLimitedEntries();

      if (entries.length === 0) {
        topVideos.innerHTML = "<li>No stats recorded yet.</li>";
        paginationWrap.style.display = "none";
        return;
      }

      var pageEntries = entries;
      var start = 0;

      if (shouldPaginate()) {
        var totalPages = getTotalPages(entries);
        if (currentPage > totalPages) currentPage = totalPages;
        if (currentPage < 1) currentPage = 1;

        start = (currentPage - 1) * CARDS_PER_PAGE;
        var end = start + CARDS_PER_PAGE;
        pageEntries = entries.slice(start, end);
      } else {
        currentPage = 1;
      }

      topVideos.innerHTML = "";

      pageEntries.forEach(function (entry, pageIndex) {
        var absoluteIndex = start + pageIndex;
        var id = entry[0];
        var views = entry[1];

        var li = document.createElement("li");
        li.className = "video-card";

        var thumbLink = document.createElement("a");
        thumbLink.className = "video-thumb-link";
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
      topVideos.innerHTML = "<li>No data (telemetry disabled).</li>";
      recentVideos.innerHTML = "<li>No data (telemetry disabled).</li>";
      videoLimitSelect.disabled = true;
      paginationWrap.style.display = "none";
      userIdCount.textContent = "0";
      totalVideoIdCount.textContent = "0";
      osBreakdown.innerHTML = '<div class="breakdown-empty">No data (telemetry disabled).</div>';
      browserBreakdown.innerHTML = '<div class="breakdown-empty">No data (telemetry disabled).</div>';
    } else {
      var optedOut = false;
      try {
        optedOut = localStorage.getItem(OPT_KEY) === "1";
      } catch (e) {}

      if (optedOut) {
        topVideos.innerHTML = "<li>Opt-out active (no stats loaded).</li>";
        recentVideos.innerHTML = "<li>Opt-out active (no stats loaded).</li>";
        videoLimitSelect.disabled = true;
        paginationWrap.style.display = "none";
        userIdCount.textContent = "Opt-out active";
        totalVideoIdCount.textContent = "Opt-out active";
        osBreakdown.innerHTML = '<div class="breakdown-empty">Opt-out active (no stats loaded).</div>';
        browserBreakdown.innerHTML = '<div class="breakdown-empty">Opt-out active (no stats loaded).</div>';
      } else {
        fetch("/api/stats?view=json&limit=3000")
          .then(function (res) { return res.json(); })
          .then(function (data) {
            var videos = data.videos || {};
            var recent = data.recentVideos || [];
            var browsers = data.browsers || {};
            var os = data.os || {};
            var totalUsers = data.totalUsers || 0;
            var totalVideoIds = data.totalVideoIds || 0;

            allVideos = videos;
            recentVideoIds = recent;
            userIdCount.textContent = String(totalUsers);
            totalVideoIdCount.textContent = String(totalVideoIds);

            renderBreakdown(osBreakdown, os, "os");
            renderBreakdown(browserBreakdown, browsers, "browser");
            renderRecentVideos();

            updateLimitWarning();
            currentPage = 1;
            renderTopVideos();

            videoLimitSelect.addEventListener("change", function () {
              currentPage = 1;
              updateLimitWarning();
              renderTopVideos();
            });
          })
          .catch(function () {
            topVideos.innerHTML = "<li>Error loading data.</li>";
            recentVideos.innerHTML = "<li>Error loading recent video IDs.</li>";
            videoLimitSelect.disabled = true;
            paginationWrap.style.display = "none";
            userIdCount.textContent = "Error";
            totalVideoIdCount.textContent = "Error";
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
    :root{color-scheme:dark}
    body{color:#fff}
    body{
      background:#1c1b22;
      margin:0;
    }
    img{
      float:right;
      margin:.3em 0 1em 2em;
    }
    :visited{color:#00c0ff}
    a{color:#0ab7f0}
    .app{
      max-width:1000px;
      margin:0 auto;
      padding:24px;
    }
    p{
      font-family:system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,"Noto Sans",sans-serif;
      line-height:1.6;
    }
    ul{
      font-family:"poketube flex";
      font-weight:500;
      font-stretch:extra-expanded;
      padding-left:1.2rem;
    }
    h2{
      font-family:"poketube flex",sans-serif;
      font-weight:700;
      font-stretch:extra-expanded;
      margin-top:1.5rem;
      margin-bottom:.3rem;
    }
    h1{
      font-family:"poketube flex",sans-serif;
      font-weight:1000;
      font-stretch:ultra-expanded;
      margin-top:0;
      margin-bottom:.3rem;
    }
    hr{
      border:0;
      border-top:1px solid #222;
      margin:28px 0;
    }
    .note{color:#bbb;font-size:.95rem;}
    .muted{opacity:.8;font-size:.95rem;}
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
      • JSON default limit: <code><a href="/api/stats?view=json">/api/stats?view=json</a></code> (8 videos)<br>
      • JSON with custom limit: <code><a href="/api/stats?view=json&limit=3000">/api/stats?view=json&limit=3000</a></code><br>
      • Opt out for this browser: <code><a href="/api/stats/optout">/api/stats/optout</a></code>
    </p>
  </div>
</body>
</html>`)
  })
}