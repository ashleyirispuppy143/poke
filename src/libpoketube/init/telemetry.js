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

function sumObjectValues(obj) {
  return Object.values(obj || {}).reduce((sum, value) => {
    const n = Number(value) || 0
    return sum + n
  }, 0)
}

function computeEstimatedTotalUsers(stats) {
  const uniqueUserIds = Object.keys(stats.users || {}).length
  const totalOsDetections = sumObjectValues(stats.os)
  const totalBrowserDetections = sumObjectValues(stats.browsers)
  const totalDetections = Math.max(totalOsDetections, totalBrowserDetections)
  const distinctOs = Object.keys(stats.os || {}).filter((key) => (stats.os[key] || 0) > 0).length
  const distinctBrowsers = Object.keys(stats.browsers || {}).filter((key) => (stats.browsers[key] || 0) > 0).length

  if (!uniqueUserIds) return 0
  if (!totalDetections) return uniqueUserIds

  const detectionsPerKnownUser = totalDetections / Math.max(uniqueUserIds, 1)
  const diversitySignal = Math.max(0, (distinctOs - 1) * 0.006) + Math.max(0, (distinctBrowsers - 1) * 0.005)
  let multiplier = 1

  if (detectionsPerKnownUser >= 1.2) multiplier += 0.01
  if (detectionsPerKnownUser >= 1.6) multiplier += 0.01
  if (detectionsPerKnownUser >= 2.4) multiplier += 0.01
  if (detectionsPerKnownUser >= 4.0) multiplier += 0.005

  multiplier += Math.min(diversitySignal, 0.025)
  multiplier = Math.min(multiplier, 1.05)

  return Math.max(uniqueUserIds, Math.round(uniqueUserIds * multiplier))
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
      <code><a href="/api/stats?view=gui">/api/stats?view=gui</a></code>.<br>
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

      updateStatus()
    })()
  </script>
</body>
</html>`)
  })

  app.get("/api/stats", (req, res) => {
    const view = (req.query.view || "").toString()

    if (view === "human") {
      const params = new URLSearchParams()

      for (const [key, value] of Object.entries(req.query || {})) {
        if (key === "view") continue
        if (Array.isArray(value)) {
          for (const item of value) {
            params.append(key, String(item))
          }
        } else if (typeof value !== "undefined") {
          params.append(key, String(value))
        }
      }

      params.set("view", "gui")

      return res.redirect(`/api/stats?${params.toString()}`)
    }

    if (view === "json") {
      if (!telemetryConfig.telemetry) {
        return res.json({
          videos: {},
          recentVideos: [],
          browsers: {},
          os: {},
          totalUsers: 0,
          estimatedTotalUsers: 0,
          totalVideoIds: 0,
          totalDetections: 0,
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
      const totalUsers = Object.keys(memoryStats.users).length
      const estimatedTotalUsers = computeEstimatedTotalUsers(memoryStats)
      const totalDetections = Math.max(sumObjectValues(memoryStats.os), sumObjectValues(memoryStats.browsers))

      return res.json({
        videos: topVideos,
        recentVideos: (memoryStats.recentVideos || []).slice(0, 32),
        browsers: memoryStats.browsers,
        os: memoryStats.os,
        totalUsers,
        estimatedTotalUsers,
        totalVideoIds: Object.keys(memoryStats.videos).length,
        totalDetections,
        limit
      })
    }

    if (view === "gui") {
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
    :visited{color:#00c0ff}
    a{color:#0ab7f0}
    button{
      font:inherit;
    }
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

    .nojs-warning{
      margin-bottom:18px;
      padding:18px;
      background:linear-gradient(180deg,#2b2130 0%,#241d29 100%);
      border:1px solid #5e3a63;
      border-radius:18px;
      color:#ffe3eb;
      font-family:system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,"Noto Sans",sans-serif;
      line-height:1.6;
      box-shadow:0 10px 30px rgba(0,0,0,.22);
    }
    .nojs-warning h2{
      margin:0 0 .55rem 0;
      font-size:1.2rem;
      color:#fff;
    }
    .nojs-warning p{
      margin:.45rem 0 0 0;
    }
    .nojs-warning ul{
      margin:.75rem 0 0 1.2rem;
      padding:0;
      color:#ffd6e1;
      font-family:system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,"Noto Sans",sans-serif;
    }
    .nojs-warning code{
      white-space:nowrap;
    }

    .hero{
      display:grid;
      grid-template-columns:1.45fr .95fr;
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
      gap:14px;
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
      display:flex;
      align-items:center;
      gap:.45rem;
      flex-wrap:wrap;
    }
    .mini-stat-sub{
      color:#bbb;
      font-size:.9rem;
      line-height:1.45;
      font-family:system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,"Noto Sans",sans-serif;
    }
    .shield-btn{
      display:inline-flex;
      align-items:center;
      justify-content:center;
      width:2rem;
      height:2rem;
      border-radius:999px;
      border:1px solid #3a3947;
      background:#1f1e29;
      color:#fff;
      cursor:pointer;
      padding:0;
      font-size:1rem;
    }
    .shield-btn:hover{
      background:#2a2837;
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

    .section-help{
      margin-bottom:16px;
      background:#22212d;
      border:1px solid #2e2d3b;
      border-radius:16px;
      padding:16px;
    }
    .section-help p{
      margin:.35rem 0 0 0;
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
    .compact-actions{
      display:flex;
      gap:.6rem;
      flex-wrap:wrap;
      align-items:center;
    }
    .action-btn{
      display:inline-flex;
      align-items:center;
      gap:.45rem;
      padding:.58rem .9rem;
      border-radius:999px;
      border:1px solid #2e2d3b;
      background:#1f1e29;
      color:#fff;
      text-decoration:none;
      cursor:pointer;
    }
    .action-btn:hover{
      background:#2a2837;
    }
    .action-btn[disabled]{
      opacity:.5;
      cursor:not-allowed;
    }

    .recent-summary{
      display:grid;
      grid-template-columns:repeat(3,minmax(0,1fr));
      gap:12px;
      margin-bottom:16px;
    }
    .summary-card{
      background:#1f1e29;
      border:1px solid #2e2d3b;
      border-radius:16px;
      padding:14px;
    }
    .summary-label{
      color:#bbb;
      font-size:.88rem;
      margin-bottom:.25rem;
      font-family:system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,"Noto Sans",sans-serif;
    }
    .summary-value{
      font-size:1.2rem;
      font-weight:700;
      font-family:system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,"Noto Sans",sans-serif;
    }
    .summary-sub{
      margin-top:.35rem;
      color:#bbb;
      font-size:.9rem;
      line-height:1.4;
      font-family:system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,"Noto Sans",sans-serif;
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
    .recent-badge{
      display:inline-flex;
      align-items:center;
      gap:.35rem;
      width:max-content;
      background:#1f1e29;
      border:1px solid #2e2d3b;
      color:#fff;
      border-radius:999px;
      padding:.35rem .65rem;
      font-size:.85rem;
      font-family:system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,"Noto Sans",sans-serif;
    }
    .recent-empty,
    .error-box{
      background:#1f1e29;
      border:1px solid #2e2d3b;
      border-radius:16px;
      padding:16px;
      color:#bbb;
      font-family:system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,"Noto Sans",sans-serif;
      line-height:1.5;
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

    .modal-backdrop{
      position:fixed;
      inset:0;
      display:none;
      align-items:center;
      justify-content:center;
      background:rgba(0,0,0,.55);
      padding:20px;
      z-index:40;
    }
    .modal-backdrop.open{
      display:flex;
    }
    .modal{
      width:min(100%,520px);
      background:#252432;
      border:1px solid #2f2e3b;
      border-radius:20px;
      padding:18px;
      box-shadow:0 20px 60px rgba(0,0,0,.45);
    }
    .modal-head{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:12px;
      margin-bottom:10px;
    }
    .modal-title{
      font-family:"poketube flex",sans-serif;
      font-weight:700;
      font-stretch:extra-expanded;
      font-size:1.05rem;
    }
    .modal-close{
      width:2rem;
      height:2rem;
      border-radius:999px;
      border:1px solid #3a3947;
      background:#1f1e29;
      color:#fff;
      cursor:pointer;
      padding:0;
    }
    .modal p{
      margin:.55rem 0 0 0;
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
      .recent-summary{
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
    <noscript>
      <div class="nojs-warning">
        <h2>JavaScript is disabled</h2>
        <p>
          This human-readable stats page is designed as an interactive view, so without JavaScript it cannot load live instance numbers, switch between sections, paginate top videos, or generate the downloadable recent-video JSON file.
        </p>
        <ul>
          <li>You can still read the raw local stats at <code>/api/stats?view=json</code>.</li>
          <li>You can still read the stats privacy details at <code>/policies/privacy#stats</code>.</li>
          <li>This warning itself does not enable any tracking, cookies, or extra data collection.</li>
        </ul>
      </div>
    </noscript>

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
          <div class="mini-stat-label">anonymous user id count</div>
          <div id="user-id-count" class="mini-stat-value">Loading…</div>
          <div class="mini-stat-sub">
            Conservative count from unique anonymous user IDs already recorded by this Poke instance.
          </div>
        </div>

        <div class="mini-stat">
          <div class="mini-stat-label">estimated total users</div>
          <div class="mini-stat-value">
            <span id="estimated-total-users">Loading…</span>
            <button type="button" id="estimated-users-info-btn" class="shield-btn" aria-label="About estimated total users">🛡️</button>
          </div>
          <div class="mini-stat-sub">
            Private estimate based on anonymous user IDs plus aggregate OS/browser detection patterns. No page-viewer tracking is used here.
          </div>
        </div>

        <div class="mini-stat">
          <div class="mini-stat-label">total video ids seen in total</div>
          <div id="total-video-id-count" class="mini-stat-value">Loading…</div>
          <div class="mini-stat-sub">
            Unique video IDs this Poke instance has seen in its local stats data.
          </div>
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
      <div class="section-help">
        <h2>How to read recent videos</h2>
        <p class="note">
          This section shows the most recently recorded video IDs from this Poke instance, in newest-first order. It is useful for checking what this instance has touched lately, not for measuring popularity.
        </p>
      </div>

      <div class="section-card">
        <div class="compact-head">
          <div>
            <h2>Recently viewed video IDs</h2>
            <p class="note" style="margin:0;">
              A rolling local list of recent video IDs recorded by this Poke instance. These are not public platform stats.
            </p>
          </div>

          <div class="compact-actions">
            <button type="button" id="download-recent-json-btn" class="action-btn">Download recent video IDs</button>
          </div>
        </div>

        <div class="recent-summary">
          <div class="summary-card">
            <div class="summary-label">recent IDs loaded</div>
            <div id="recent-count" class="summary-value">Loading…</div>
            <div class="summary-sub">How many recent IDs are currently visible in this page session.</div>
          </div>

          <div class="summary-card">
            <div class="summary-label">latest recorded ID</div>
            <div id="recent-latest" class="summary-value">Loading…</div>
            <div class="summary-sub">The first item in the recency queue, if any recent ID exists.</div>
          </div>
 
        </div>

        <ul id="recent-videos" class="recent-grid"></ul>
      </div>
    </section>

    <section id="top-panel" class="panel">
      <div class="section-help">
        <h2>How to read top videos</h2>
        <p class="note">
          Rankings here are based only on anonymous local detections on this Poke instance. A higher number means this instance saw that video more often here, not that the upstream platform reported more public views.
        </p>
      </div>

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
          • GUI view (this page): <code><a href="/api/stats?view=gui">/api/stats?view=gui</a></code><br>
          • JSON view (for scripts/tools): <code><a href="/api/stats?view=json">/api/stats?view=json</a></code><br>
          • JSON default limit: <code><a href="/api/stats?view=json">/api/stats?view=json</a></code> (8 videos)<br>
          • JSON with custom limit: <code><a href="/api/stats?view=json&limit=3000">/api/stats?view=json&limit=3000</a></code><br>
          • Opt out for this browser: <code><a href="/api/stats/optout">/api/stats/optout</a></code>
        </p>
      </div>
    </section>
  </div>

  <div id="privacy-modal-backdrop" class="modal-backdrop" aria-hidden="true">
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="privacy-modal-title">
      <div class="modal-head">
        <div id="privacy-modal-title" class="modal-title">Estimated total users</div>
        <button type="button" id="privacy-modal-close" class="modal-close" aria-label="Close">×</button>
      </div>
      <p class="note" style="margin:0;">
        This estimate is based on already-aggregated anonymous stats only. It does not add personal profiles, cookies, account linking, or unique page-viewer tracking for this page.
      </p>
      <p class="note">
        For more detail about what is measured and what is not, see <a href="/policies/privacy#stats">our privacy policy</a>.
      </p>
    </div>
  </div>

  <script>
    const TELEMETRY_ON = ${telemetryOn ? "true" : "false"}
    const OPT_KEY = "poke_stats_optout"
    const CARDS_PER_PAGE = 40

    const topVideos = document.getElementById("top-videos")
    const recentVideos = document.getElementById("recent-videos")
    const recentCount = document.getElementById("recent-count")
    const recentLatest = document.getElementById("recent-latest")
    const downloadRecentJsonBtn = document.getElementById("download-recent-json-btn")
    const videoLimitSelect = document.getElementById("video-limit")
    const paginationWrap = document.getElementById("pagination-wrap")
    const paginationInfo = document.getElementById("pagination-info")
    const paginationControls = document.getElementById("pagination-controls")
    const osBreakdown = document.getElementById("os-breakdown")
    const browserBreakdown = document.getElementById("browser-breakdown")
    const userIdCount = document.getElementById("user-id-count")
    const estimatedTotalUsers = document.getElementById("estimated-total-users")
    const totalVideoIdCount = document.getElementById("total-video-id-count")
    const limitWarning = document.getElementById("limit-warning")
    const segButtons = document.querySelectorAll(".seg-btn")
    const panels = document.querySelectorAll(".panel")
    const estimatedUsersInfoBtn = document.getElementById("estimated-users-info-btn")
    const privacyModalBackdrop = document.getElementById("privacy-modal-backdrop")
    const privacyModalClose = document.getElementById("privacy-modal-close")

    var allVideos = {}
    var recentVideoIds = []
    var currentPage = 1

    function setActivePanel(panelId) {
      panels.forEach(function (panel) {
        panel.classList.toggle("active", panel.id === panelId)
      })

      segButtons.forEach(function (btn) {
        btn.classList.toggle("active", btn.getAttribute("data-panel") === panelId)
      })
    }

    segButtons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        setActivePanel(btn.getAttribute("data-panel"))
      })
    })

    function openPrivacyModal() {
      privacyModalBackdrop.classList.add("open")
      privacyModalBackdrop.setAttribute("aria-hidden", "false")
    }

    function closePrivacyModal() {
      privacyModalBackdrop.classList.remove("open")
      privacyModalBackdrop.setAttribute("aria-hidden", "true")
    }

    estimatedUsersInfoBtn.addEventListener("click", openPrivacyModal)
    privacyModalClose.addEventListener("click", closePrivacyModal)

    privacyModalBackdrop.addEventListener("click", function (ev) {
      if (ev.target === privacyModalBackdrop) {
        closePrivacyModal()
      }
    })

    document.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape" && privacyModalBackdrop.classList.contains("open")) {
        closePrivacyModal()
      }
    })

    function getThumbnailUrl(videoId) {
      return "https://i.ytimg.com/vi/" + encodeURIComponent(videoId) + "/hqdefault.jpg"
    }

    function getSelectedLimit() {
      return parseInt(videoLimitSelect.value, 10) || 100
    }

    function getLimitedEntries() {
      return Object.entries(allVideos).slice(0, getSelectedLimit())
    }

    function shouldPaginate() {
      var selected = getSelectedLimit()
      return selected === 1000 || selected === 3000
    }

    function updateLimitWarning() {
      var selected = getSelectedLimit()
      limitWarning.style.display = selected === 1000 || selected === 3000 ? "block" : "none"
    }

    function getTotalPages(entries) {
      return Math.max(1, Math.ceil(entries.length / CARDS_PER_PAGE))
    }

    function createPageButton(label, page, disabled, active) {
      var btn = document.createElement("button")
      btn.type = "button"
      btn.className = "page-btn" + (active ? " page-number active" : page ? " page-number" : "")
      btn.textContent = label

      if (disabled) {
        btn.disabled = true
        return btn
      }

      btn.addEventListener("click", function () {
        if (page === currentPage) return
        currentPage = page
        renderTopVideos()
      })

      return btn
    }

    function renderPagination(entries) {
      if (!shouldPaginate()) {
        paginationWrap.style.display = "none"
        paginationInfo.textContent = ""
        paginationControls.innerHTML = ""
        return
      }

      var totalPages = getTotalPages(entries)

      if (entries.length <= CARDS_PER_PAGE) {
        paginationWrap.style.display = "none"
        paginationInfo.textContent = ""
        paginationControls.innerHTML = ""
        return
      }

      paginationWrap.style.display = "flex"
      paginationControls.innerHTML = ""

      var startIndex = (currentPage - 1) * CARDS_PER_PAGE + 1
      var endIndex = Math.min(currentPage * CARDS_PER_PAGE, entries.length)

      paginationInfo.textContent =
        "Showing " + startIndex + "–" + endIndex + " of " + entries.length +
        " videos. These are local Poke instance view rankings, not YouTube public views."

      paginationControls.appendChild(
        createPageButton("Prev", currentPage - 1, currentPage === 1, false)
      )

      var startPage = Math.max(1, currentPage - 2)
      var endPage = Math.min(totalPages, currentPage + 2)

      if (startPage > 1) {
        paginationControls.appendChild(createPageButton("1", 1, false, currentPage === 1))
        if (startPage > 2) {
          var gapLeft = document.createElement("span")
          gapLeft.className = "note"
          gapLeft.textContent = "…"
          paginationControls.appendChild(gapLeft)
        }
      }

      for (var page = startPage; page <= endPage; page++) {
        paginationControls.appendChild(
          createPageButton(String(page), page, false, page === currentPage)
        )
      }

      if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
          var gapRight = document.createElement("span")
          gapRight.className = "note"
          gapRight.textContent = "…"
          paginationControls.appendChild(gapRight)
        }
        paginationControls.appendChild(
          createPageButton(String(totalPages), totalPages, false, currentPage === totalPages)
        )
      }

      paginationControls.appendChild(
        createPageButton("Next", currentPage + 1, currentPage === totalPages, false)
      )
    }

    function formatPercent(part, total) {
      if (!total) return "0.00"
      return ((part / total) * 100).toFixed(2)
    }

    function sumValues(obj) {
      return Object.values(obj || {}).reduce(function (sum, value) {
        return sum + value
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
      targetEl.innerHTML = ""

      var entries = Object.entries(data || {}).sort(function (a, b) {
        return b[1] - a[1]
      })

      if (entries.length === 0) {
        var empty = document.createElement("div")
        empty.className = "breakdown-empty"
        empty.textContent = "No data recorded yet."
        targetEl.appendChild(empty)
        return
      }

      var total = sumValues(data)

      entries.forEach(function (entry) {
        var key = entry[0]
        var count = entry[1]
        var percent = formatPercent(count, total)
        var label = kind === "os" ? humanizeOsName(key) : humanizeBrowserName(key)

        var item = document.createElement("div")
        item.className = "breakdown-item"

        var topLine = document.createElement("div")
        topLine.className = "breakdown-topline"

        var labelEl = document.createElement("div")
        labelEl.className = "breakdown-label"
        labelEl.textContent = label + " — " + percent + "% of total " + (kind === "os" ? "OS detections" : "browser detections")

        var countEl = document.createElement("div")
        countEl.className = "breakdown-count"
        countEl.textContent = count + " detections"

        var barWrap = document.createElement("div")
        barWrap.className = "breakdown-bar-wrap"

        var bar = document.createElement("div")
        bar.className = "breakdown-bar"
        bar.style.width = percent + "%"

        var sub = document.createElement("div")
        sub.className = "breakdown-sub"
        sub.textContent =
          label + " was detected " + count + " times out of " + total + " total " +
          (kind === "os" ? "OS detections" : "browser detections") + " on this Poke instance."

        barWrap.appendChild(bar)
        topLine.appendChild(labelEl)
        topLine.appendChild(countEl)

        item.appendChild(topLine)
        item.appendChild(barWrap)
        item.appendChild(sub)

        targetEl.appendChild(item)
      })
    }

    function createVideoCard(videoId, extraText, thumbAlt, href, badgeText) {
      var li = document.createElement("li")
      li.className = "video-card"

      var thumbLink = document.createElement("a")
      thumbLink.className = "video-thumb-link"
      thumbLink.href = href
      thumbLink.setAttribute("aria-label", "Open video " + videoId)

      var img = document.createElement("img")
      img.className = "video-thumb"
      img.src = getThumbnailUrl(videoId)
      img.alt = thumbAlt
      img.loading = "lazy"
      img.referrerPolicy = "no-referrer"
      img.onerror = function () {
        this.style.display = "none"
      }

      thumbLink.appendChild(img)

      var meta = document.createElement("div")
      meta.className = "video-meta"

      if (badgeText) {
        var badge = document.createElement("div")
        badge.className = "recent-badge"
        badge.textContent = badgeText
        meta.appendChild(badge)
      }

      var titleLink = document.createElement("a")
      titleLink.className = "video-title"
      titleLink.href = href
      titleLink.textContent = videoId

      var idEl = document.createElement("div")
      idEl.className = "video-id"
      idEl.textContent = "Video ID: " + videoId

      var infoEl = document.createElement("div")
      infoEl.className = "video-note"
      infoEl.textContent = extraText

      meta.appendChild(titleLink)
      meta.appendChild(idEl)
      meta.appendChild(infoEl)

      li.appendChild(thumbLink)
      li.appendChild(meta)

      return li
    }

    function updateRecentSummary() {
      var count = Array.isArray(recentVideoIds) ? recentVideoIds.length : 0
      recentCount.textContent = String(count)
      recentLatest.textContent = count > 0 ? recentVideoIds[0] : "None"
      downloadRecentJsonBtn.disabled = count === 0
    }

    function downloadRecentVideoIds() {
      if (!Array.isArray(recentVideoIds) || recentVideoIds.length === 0) return

      var payload = {
        exportedAt: new Date().toISOString(),
        source: "/api/stats?view=gui",
        totalRecentVideoIds: recentVideoIds.length,
        recentVideoIds: recentVideoIds.slice()
      }

      var blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" })
      var url = URL.createObjectURL(blob)
      var a = document.createElement("a")
      a.href = url
      a.download = "poke-recent-video-ids.json"
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    }

    downloadRecentJsonBtn.addEventListener("click", downloadRecentVideoIds)

    function renderRecentVideos() {
      recentVideos.innerHTML = ""
      updateRecentSummary()

      if (!Array.isArray(recentVideoIds) || recentVideoIds.length === 0) {
        var empty = document.createElement("div")
        empty.className = "recent-empty"
        empty.textContent = "No recent video IDs recorded yet."
        recentVideos.replaceWith(empty)

        var replacementList = document.createElement("ul")
        replacementList.id = "recent-videos"
        replacementList.className = "recent-grid"
        empty.insertAdjacentElement("afterend", replacementList)
        empty.remove()
        return
      }

      recentVideoIds.slice(0, 12).forEach(function (videoId, index) {
        var card = createVideoCard(
          videoId,
          "Recently recorded on this Poke instance. Position #" + (index + 1) + " in the live recent queue.",
          "Thumbnail for recent video " + videoId,
          "/watch?v=" + encodeURIComponent(videoId),
          index === 0 ? "Newest recent ID" : "Recent position #" + (index + 1)
        )

        card.className = "recent-card"
        recentVideos.appendChild(card)
      })
    }

    function renderTopVideos() {
      var entries = getLimitedEntries()

      if (entries.length === 0) {
        topVideos.innerHTML = "<li class=\\"error-box\\">No stats recorded yet.</li>"
        paginationWrap.style.display = "none"
        return
      }

      var pageEntries = entries
      var start = 0

      if (shouldPaginate()) {
        var totalPages = getTotalPages(entries)
        if (currentPage > totalPages) currentPage = totalPages
        if (currentPage < 1) currentPage = 1

        start = (currentPage - 1) * CARDS_PER_PAGE
        var end = start + CARDS_PER_PAGE
        pageEntries = entries.slice(start, end)
      } else {
        currentPage = 1
      }

      topVideos.innerHTML = ""

      pageEntries.forEach(function (entry, pageIndex) {
        var absoluteIndex = start + pageIndex
        var id = entry[0]
        var views = entry[1]

        var li = document.createElement("li")
        li.className = "video-card"

        var thumbLink = document.createElement("a")
        thumbLink.className = "video-thumb-link"
        thumbLink.href = "/watch?v=" + encodeURIComponent(id)
        thumbLink.setAttribute("aria-label", "Open video " + id)

        var img = document.createElement("img")
        img.className = "video-thumb"
        img.src = getThumbnailUrl(id)
        img.alt = "Thumbnail for video " + id
        img.loading = "lazy"
        img.referrerPolicy = "no-referrer"
        img.onerror = function () {
          this.style.display = "none"
        }

        thumbLink.appendChild(img)

        var meta = document.createElement("div")
        meta.className = "video-meta"

        var titleLink = document.createElement("a")
        titleLink.className = "video-title"
        titleLink.href = "/watch?v=" + encodeURIComponent(id)
        titleLink.textContent = id

        var rank = document.createElement("div")
        rank.className = "video-rank"
        rank.textContent = "Rank #" + (absoluteIndex + 1)

        var idEl = document.createElement("div")
        idEl.className = "video-id"
        idEl.textContent = "Video ID: " + id

        var viewsEl = document.createElement("div")
        viewsEl.className = "video-views"
        viewsEl.textContent = views + " local Poke instance views"

        var noteEl = document.createElement("div")
        noteEl.className = "video-note"
        noteEl.textContent =
          "This number is counted only from anonymous requests on this Poke instance. It is not the video's public YouTube view count."

        meta.appendChild(titleLink)
        meta.appendChild(rank)
        meta.appendChild(idEl)
        meta.appendChild(viewsEl)
        meta.appendChild(noteEl)

        li.appendChild(thumbLink)
        li.appendChild(meta)

        topVideos.appendChild(li)
      })

      renderPagination(entries)
    }

    function setDisabledState(message) {
      topVideos.innerHTML = "<li class=\\"error-box\\">" + message + "</li>"
      recentVideos.innerHTML = "<li class=\\"error-box\\">" + message + "</li>"
      videoLimitSelect.disabled = true
      downloadRecentJsonBtn.disabled = true
      paginationWrap.style.display = "none"
      osBreakdown.innerHTML = '<div class="breakdown-empty">' + message + "</div>"
      browserBreakdown.innerHTML = '<div class="breakdown-empty">' + message + "</div>"
      recentCount.textContent = "0"
      recentLatest.textContent = "None"
    }

    if (!TELEMETRY_ON) {
      setDisabledState("No data (telemetry disabled).")
      userIdCount.textContent = "0"
      estimatedTotalUsers.textContent = "0"
      totalVideoIdCount.textContent = "0"
    } else {
      var optedOut = false
      try {
        optedOut = localStorage.getItem(OPT_KEY) === "1"
      } catch (e) {}

      if (optedOut) {
        setDisabledState("Opt-out active (no stats loaded).")
        userIdCount.textContent = "Opt-out active"
        estimatedTotalUsers.textContent = "Opt-out active"
        totalVideoIdCount.textContent = "Opt-out active"
      } else {
        fetch("/api/stats?view=json&limit=3000")
          .then(function (res) { return res.json() })
          .then(function (data) {
            var videos = data.videos || {}
            var recent = data.recentVideos || []
            var browsers = data.browsers || {}
            var os = data.os || {}
            var totalUsers = data.totalUsers || 0
            var estimatedUsers = data.estimatedTotalUsers || 0
            var totalVideoIds = data.totalVideoIds || 0

            allVideos = videos
            recentVideoIds = recent
            userIdCount.textContent = String(totalUsers)
            estimatedTotalUsers.textContent = String(estimatedUsers)
            totalVideoIdCount.textContent = String(totalVideoIds)

            renderBreakdown(osBreakdown, os, "os")
            renderBreakdown(browserBreakdown, browsers, "browser")
            renderRecentVideos()

            updateLimitWarning()
            currentPage = 1
            renderTopVideos()

            videoLimitSelect.addEventListener("change", function () {
              currentPage = 1
              updateLimitWarning()
              renderTopVideos()
            })
          })
          .catch(function () {
            setDisabledState("Error loading data.")
            userIdCount.textContent = "Error"
            estimatedTotalUsers.textContent = "Error"
            totalVideoIdCount.textContent = "Error"
          })
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
      • GUI view (stats UI): <code><a href="/api/stats?view=gui">/api/stats?view=gui</a></code><br>
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