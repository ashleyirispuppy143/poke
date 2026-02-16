const fs = require("fs")
const path = require("path")

const telemetryConfig = { telemetry: true }

// Define file paths
const statsFile = path.join(__dirname, "stats.json")
const statsFileV2 = path.join(__dirname, "stats-v2.json")

// Limit for the JSON file (e.g., 5MB). 
// If stats.json exceeds this, we switch writing to stats-v2.json
const MAX_FILE_SIZE = 5 * 1024 * 1024 

// Helper for empty structure
const getEmptyStats = () => ({ videos: {}, browsers: {}, os: {}, users: {} })

// Ensure legacy stats file exists to prevent errors
if (!fs.existsSync(statsFile)) {
  fs.writeFileSync(statsFile, JSON.stringify(getEmptyStats(), null, 2))
}

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
  
  // POST: Write stats
  app.post("/api/stats", (req, res) => {
    if (!telemetryConfig.telemetry) return res.status(200).json({ ok: true })

    const { videoId, userId } = req.body
    if (!videoId) return res.status(400).json({ error: "missing videoId" })
    if (!userId) return res.status(400).json({ error: "missing userId" })

    const ua = req.headers["user-agent"] || ""
    const { browser, os } = parseUA(ua)

    // Determine which file to write to
    let targetFile = statsFile

    // 1. If v2 already exists, we always use it for new writes
    if (fs.existsSync(statsFileV2)) {
      targetFile = statsFileV2
    } 
    // 2. If v2 doesn't exist, check if v1 is too big
    else {
      try {
        const stats = fs.statSync(statsFile)
        if (stats.size > MAX_FILE_SIZE) {
          // Initialize v2 and switch target
          fs.writeFileSync(statsFileV2, JSON.stringify(getEmptyStats(), null, 2))
          targetFile = statsFileV2
        }
      } catch (e) {
        // If file access fails, default to statsFile
      }
    }

    // Read current data from the target file
    let data = safeRead(targetFile)
    if (!data) data = getEmptyStats()

    // Ensure structure exists
    if (!data.users) data.users = {}
    if (!data.videos) data.videos = {}
    if (!data.browsers) data.browsers = {}
    if (!data.os) data.os = {}

    // Update counts
    if (!data.videos[videoId]) data.videos[videoId] = 0
    data.videos[videoId]++

    if (!data.browsers[browser]) data.browsers[browser] = 0
    data.browsers[browser]++

    if (!data.os[os]) data.os[os] = 0
    data.os[os]++

    if (!data.users[userId]) data.users[userId] = true

    // Write back to the target file
    fs.writeFileSync(targetFile, JSON.stringify(data, null, 2))
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
  src: url("https://p.poketube.fun/https://cdn.glitch.global/43b6691a-c8db-41d4-921c-8cf6aa0d9108/robotoflex.ttf?v=16683434286881");
  font-style: normal;
  font-stretch: 1% 800%;
  font-display: swap;
}
    :root{color-scheme:dark}
    body{color:#fff}
    body {
      background:#1c1b22;
      margin:0;
    }
    :visited{color:#00c0ff}
    a{color:#0ab7f0}
    .app{max-width:1000px;margin:0 auto;padding:24px}
    p{
      font-family: system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,"Noto Sans", sans-serif;
      line-height:1.6;
    }
    ul{
      font-family:"poketube flex";
      font-weight:500;
      font-stretch:extra-expanded;
      padding-left:1.2rem;
    }
    h2 {
      font-family:"poketube flex", sans-serif;
      font-weight:700;
      font-stretch:extra-expanded;
      margin-top:1.5rem;
      margin-bottom:.3rem;
    }
    h1 {
      font-family:"poketube flex", sans-serif;
      font-weight:1000;
      font-stretch:ultra-expanded;
      margin-top:0;
      margin-bottom:.3rem;
    }
    .note{color:#bbb;font-size:.95rem}
    .btn{
      display:inline-block;
      margin-top:1rem;
      padding:.5rem 1rem;
      border-radius:999px;
      border:1px solid #2a2a35;
      background:#252432;
      color:#fff;
      font-family:system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,"Noto Sans", sans-serif;
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

  // GET Stats (JSON & Human)
  app.get("/api/stats", (req, res) => {
    const view = (req.query.view || "").toString()

    if (view === "json") {
      if (!telemetryConfig.telemetry) {
        return res.json({ videos: {}, browsers: {}, os: {}, totalUsers: 0 })
      }

      // Load both files
      const v1 = safeRead(statsFile)
      const v2 = safeRead(statsFileV2)

      // Initialize combined object
      const combined = getEmptyStats()

      // Helper to merge data
      const mergeData = (source) => {
        if (!source) return
        
        // Merge Videos
        if (source.videos) {
            for (const [id, count] of Object.entries(source.videos)) {
                combined.videos[id] = (combined.videos[id] || 0) + count
            }
        }
        // Merge Browsers
        if (source.browsers) {
            for (const [name, count] of Object.entries(source.browsers)) {
                combined.browsers[name] = (combined.browsers[name] || 0) + count
            }
        }
        // Merge OS
        if (source.os) {
            for (const [name, count] of Object.entries(source.os)) {
                combined.os[name] = (combined.os[name] || 0) + count
            }
        }
        // Merge Users (Set Union)
        if (source.users) {
            Object.assign(combined.users, source.users)
        }
      }

      // Merge both sources
      mergeData(v1)
      mergeData(v2)

      // Calculate Top Videos
      const sortedVideos = Object.entries(combined.videos)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)

      const topVideos = Object.fromEntries(sortedVideos)

      return res.json({
        videos: topVideos,
        browsers: combined.browsers,
        os: combined.os,
        totalUsers: Object.keys(combined.users).length
      })
    }

    if (view === "human") {
      const telemetryOn = telemetryConfig.telemetry

      // Note: The HTML/JS below fetches ?view=json, so it will automatically 
      // display the combined data we calculated above.
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
  src: url("https://p.poketube.fun/https://cdn.glitch.global/43b6691a-c8db-41d4-921c-8cf6aa0d9108/robotoflex.ttf?v=16683434286881");
  font-style: normal;
  font-stretch: 1% 800%;
  font-display: swap;
}
    :root{color-scheme:dark}
    body{color:#fff}
    body {
      background:#1c1b22;
      margin:0;
    }
    img{float:right;margin:.3em 0 1em 2em}
    :visited{color:#00c0ff}
    a{color:#0ab7f0}
    .app{max-width:1000px;margin:0 auto;padding:24px}
    p{
      font-family: system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,"Noto Sans", sans-serif;
      line-height:1.6;
    }
    ul{
      font-family:"poketube flex";
      font-weight:500;
      font-stretch:extra-expanded;
      padding-left:1.2rem;
    }
    h2 {
      font-family:"poketube flex", sans-serif;
      font-weight:700;
      font-stretch:extra-expanded;
      margin-top:1.5rem;
      margin-bottom:.3rem;
    }
    h1 {
      font-family:"poketube flex", sans-serif;
      font-weight:1000;
      font-stretch:ultra-expanded;
      margin-top:0;
      margin-bottom:.3rem;
    }
    .toc{margin:1rem 0 2rem}
    .toc li{margin:.25rem 0}
    pre.license{
      font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace;
      background:#111;padding:14px 16px;border-radius:12px;overflow-x:auto;line-height:1.45;border:1px solid #222
    }
    hr{border:0;border-top:1px solid #222;margin:28px 0}
    .note{color:#bbb;font-size:.95rem}
    .stats-list li{margin:.15rem 0;}
    .muted{opacity:.8;font-size:.95rem;}
  </style>
</head>
<body>
  <div class="app">
    <h1>Anonymous stats</h1>
    <p class="note">
      These stats are aggregated locally on this Poke instance. For what is collected (and what is not),
      see <a href="/policies/privacy#stats">privacy policy</a>.
    </p>

    <h2>Current anonymous stats</h2>
    <p id="stats-note" class="note">Loading…</p>
    <ul id="stats-list" class="stats-list"></ul>

    <h2>Top videos (local-only)</h2>
    <p class="note">Up to 10 most watched videos on this instance.</p>
    <ul id="top-videos" class="stats-list"></ul>

    <hr>

    <h2>API usage</h2>
    <p class="note">
      • Human view (this page): <code><a href="/api/stats?view=human">/api/stats?view=human</a></code><br>
      • JSON view (for scripts/tools): <code><a href="/api/stats?view=json">/api/stats?view=json</a></code><br>
      • Opt out for this browser: <code><a href="/api/stats/optout">/api/stats/optout</a></code>
    </p>
  </div>

  <script>
    const TELEMETRY_ON = ${telemetryOn ? "true" : "false"};
    const OPT_KEY = "poke_stats_optout";

    const statsNote = document.getElementById("stats-note");
    const statsList = document.getElementById("stats-list");
    const topVideos = document.getElementById("top-videos");

    if (!TELEMETRY_ON) {
      statsNote.textContent =
        "Anonymous usage statistics are disabled on this instance. No stats are being collected.";
      statsList.innerHTML = "";
      topVideos.innerHTML = "<li>No data (telemetry disabled).</li>";
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
      } else {
        fetch("/api/stats?view=json")
          .then(function (res) { return res.json(); })
          .then(function (data) {
            var videos = data.videos || {};
            var browsers = data.browsers || {};
            var os = data.os || {};
            var totalUsers = data.totalUsers || 0;

            var videoCount = Object.keys(videos).length;

            statsNote.textContent = "";
            statsList.innerHTML = "";

            var summaryItems = [
              "Anonymous users (unique local IDs): " + totalUsers,
              "Videos with recorded views: " + videoCount,
              "Browser types seen: " + Object.keys(browsers).length,
              "OS families seen: " + Object.keys(os).length
            ];

            summaryItems.forEach(function (text) {
              var li = document.createElement("li");
              li.textContent = text;
              statsList.appendChild(li);
            });

            var videoKeys = Object.keys(videos);
            if (videoKeys.length === 0) {
              topVideos.innerHTML = "<li>No stats recorded yet.</li>";
            } else {
              topVideos.innerHTML = "";
              videoKeys.forEach(function (id) {
                var li = document.createElement("li");
                var a = document.createElement("a");
                a.href = "/watch?v=" + encodeURIComponent(id);
                a.textContent = id;
                li.appendChild(a);
                li.appendChild(document.createTextNode(" – " + videos[id] + " views"));
                topVideos.appendChild(li);
              });
            }
          })
          .catch(function () {
            statsNote.textContent =
              "Could not load stats (maybe they are disabled or there was an error).";
            statsList.innerHTML = "";
            topVideos.innerHTML = "<li>Error loading data.</li>";
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
  src: url("https://p.poketube.fun/https://cdn.glitch.global/43b6691a-c8db-41d4-921c-8cf6aa0d9108/robotoflex.ttf?v=16683434286881");
  font-style: normal;
  font-stretch: 1% 800%;
  font-display: swap;
}
    :root{color-scheme:dark}
    body{color:#fff}
    body {
      background:#1c1b22;
      margin:0;
    }
    img{float:right;margin:.3em 0 1em 2em}
    :visited{color:#00c0ff}
    a{color:#0ab7f0}
    .app{max-width:1000px;margin:0 auto;padding:24px}
    p{
      font-family: system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,"Noto Sans", sans-serif;
      line-height:1.6;
    }
    ul{
      font-family:"poketube flex";
      font-weight:500;
      font-stretch:extra-expanded;
      padding-left:1.2rem;
    }
    h2 {
      font-family:"poketube flex", sans-serif;
      font-weight:700;
      font-stretch:extra-expanded;
      margin-top:1.5rem;
      margin-bottom:.3rem;
    }
    h1 {
      font-family:"poketube flex", sans-serif;
      font-weight:1000;
      font-stretch:ultra-expanded;
      margin-top:0;
      margin-bottom:.3rem;
    }
    .toc{margin:1rem 0 2rem}
    .toc li{margin:.25rem 0}
    pre.license{
      font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace;
      background:#111;padding:14px 16px;border-radius:12px;overflow-x:auto;line-height:1.45;border:1px solid #222
    }
    hr{border:0;border-top:1px solid #222;margin:28px 0}
    .note{color:#bbb;font-size:.95rem}
    .stats-list li{margin:.15rem 0;}
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
      • Opt out for this browser: <code><a href="/api/stats/optout">/api/stats/optout</a></code>
    </p>
  </div>
</body>
</html>`)
  })
}