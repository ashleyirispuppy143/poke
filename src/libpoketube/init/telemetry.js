const fs = require("fs")
const path = require("path")

const telemetryConfig = { telemetry: true }

const telemetryFile = path.join(__dirname, "telemetry.json")
const recentVideoLimit = 300
const maxJsonLimit = 3000
const telemetrySaveDebounceMs = 15000
const telemetryMaxUnsavedMs = 60000
const telemetryMinWriteIntervalMs = 5000
const telemetryBackupMinIntervalMs = 10 * 60 * 1000

const getNowIso = () => new Date().toISOString()

let lastTelemetryJson = null
let lastTelemetryBackupAt = 0

function isMissingRecordedTitle(value) {
  const title = String(value || "").trim().toLowerCase()
  return !title || title === "unknown" || title === "couldnt record" || title === "couldn't record"
}

function shouldReplaceRecordedTitle(oldTitle, newTitle) {
  const cleanOld = cleanPageTitle(oldTitle)
  const cleanNew = cleanPageTitle(newTitle)

  if (isMissingRecordedTitle(cleanNew)) return false
  if (isMissingRecordedTitle(cleanOld)) return true
  if (cleanNew.length > cleanOld.length && cleanNew.toLowerCase() !== cleanOld.toLowerCase()) return true

  return false
}

function cleanPageTitle(value) {
  let title = String(value || "")
    .replace(/\s+/g, " ")
    .trim()

  if (!title) return ""

  title = title
    .replace(/\s*(?:\||-|–|—)\s*Poke(?:Tube)?\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim()

  if (/^Poke(?:Tube)?$/i.test(title)) return ""

  return title.slice(0, 300)
}

const getEmptyStats = () => ({
  version: 4,
  startedAt: getNowIso(),
  videos: {},
  pageTitles: {},
  browsers: {},
  os: {},
  users: {},
  recentVideos: []
})

function normalizeStats(input) {
  const stats = getEmptyStats()

  if (!input || typeof input !== "object") return stats

  if (typeof input.startedAt === "string" && input.startedAt.trim()) {
    stats.startedAt = input.startedAt.trim()
  }

  if (input.videos && typeof input.videos === "object") {
    for (const [key, value] of Object.entries(input.videos)) {
      const id = String(key || "").trim()
      const count = Math.max(0, Number(value) || 0)
      if (id && count > 0) stats.videos[id] = (stats.videos[id] || 0) + count
    }
  }

  if (input.pageTitles && typeof input.pageTitles === "object") {
    for (const [key, value] of Object.entries(input.pageTitles)) {
      const id = String(key || "").trim()
      const title = cleanPageTitle(value)
      if (id && shouldReplaceRecordedTitle(stats.pageTitles[id], title)) stats.pageTitles[id] = title
    }
  }

  if (input.videoTitles && typeof input.videoTitles === "object") {
    for (const [key, value] of Object.entries(input.videoTitles)) {
      const id = String(key || "").trim()
      const title = cleanPageTitle(value)
      if (id && shouldReplaceRecordedTitle(stats.pageTitles[id], title)) stats.pageTitles[id] = title
    }
  }

  if (input.browsers && typeof input.browsers === "object") {
    for (const [key, value] of Object.entries(input.browsers)) {
      const name = String(key || "unknown").trim() || "unknown"
      const count = Math.max(0, Number(value) || 0)
      if (count > 0) stats.browsers[name] = (stats.browsers[name] || 0) + count
    }
  }

  if (input.os && typeof input.os === "object") {
    for (const [key, value] of Object.entries(input.os)) {
      const name = String(key || "unknown").trim() || "unknown"
      const count = Math.max(0, Number(value) || 0)
      if (count > 0) stats.os[name] = (stats.os[name] || 0) + count
    }
  }

  if (input.users && typeof input.users === "object") {
    for (const key of Object.keys(input.users)) {
      const userId = String(key || "").trim()
      if (userId) stats.users[userId] = true
    }
  }

  if (Array.isArray(input.recentVideos)) {
    for (const rawId of input.recentVideos) {
      const id = String(rawId || "").trim()
      if (!id) continue
      stats.recentVideos = stats.recentVideos.filter((item) => item !== id)
      stats.recentVideos.push(id)
    }

    if (stats.recentVideos.length > recentVideoLimit) {
      stats.recentVideos = stats.recentVideos.slice(-recentVideoLimit)
    }
  }

  for (const id of Object.keys(stats.pageTitles)) {
    if (!stats.videos[id] && !(stats.recentVideos || []).includes(id)) {
      delete stats.pageTitles[id]
    }
  }

  return stats
}

function mergeStats(target, source) {
  const clean = normalizeStats(source)

  if (!target.startedAt || new Date(clean.startedAt).getTime() < new Date(target.startedAt).getTime()) {
    target.startedAt = clean.startedAt
  }

  for (const [id, count] of Object.entries(clean.videos)) {
    target.videos[id] = (target.videos[id] || 0) + count
  }

  for (const [id, title] of Object.entries(clean.pageTitles)) {
    if (shouldReplaceRecordedTitle(target.pageTitles[id], title)) target.pageTitles[id] = title
  }

  for (const [name, count] of Object.entries(clean.browsers)) {
    target.browsers[name] = (target.browsers[name] || 0) + count
  }

  for (const [name, count] of Object.entries(clean.os)) {
    target.os[name] = (target.os[name] || 0) + count
  }

  for (const userId of Object.keys(clean.users)) {
    target.users[userId] = true
  }

  if (Array.isArray(clean.recentVideos)) {
    for (const id of clean.recentVideos) {
      target.recentVideos = (target.recentVideos || []).filter((item) => item !== id)
      target.recentVideos.push(id)
    }

    if (target.recentVideos.length > recentVideoLimit) {
      target.recentVideos = target.recentVideos.slice(-recentVideoLimit)
    }
  }

  return normalizeStats(target)
}

function safeRead(filePath) {
  try {
    if (!fs.existsSync(filePath)) return { ok: true, data: null }
    const raw = fs.readFileSync(filePath, "utf8")
    if (!raw.trim()) return { ok: false, data: null, error: new Error("file is empty") }
    return { ok: true, data: JSON.parse(raw) }
  } catch (error) {
    return { ok: false, data: null, error }
  }
}

function atomicWriteJson(filePath, data) {
  const dir = path.dirname(filePath)
  const tmpPath = path.join(dir, `${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`)
  const backupPath = `${filePath}.bak`
  const json = JSON.stringify(data, null, 2)

  if (lastTelemetryJson === json) return false

  if (lastTelemetryJson === null) {
    try {
      if (fs.existsSync(filePath)) {
        const current = fs.readFileSync(filePath, "utf8")
        if (current === json) {
          lastTelemetryJson = json
          return false
        }
      }
    } catch (error) {
      console.error("Could not compare existing telemetry file before write:", filePath, error)
    }
  }

  const fileExists = fs.existsSync(filePath)
  const now = Date.now()
  const shouldBackup = fileExists && now - lastTelemetryBackupAt >= telemetryBackupMinIntervalMs

  fs.writeFileSync(tmpPath, json)

  if (shouldBackup) {
    try {
      fs.copyFileSync(filePath, backupPath)
      lastTelemetryBackupAt = now
    } catch (error) {
      console.error("Could not create telemetry backup for", filePath, error)
    }
  }

  fs.renameSync(tmpPath, filePath)
  lastTelemetryJson = json
  return true
}

function saveTelemetryStorage(stats) {
  const clean = normalizeStats(stats)
  atomicWriteJson(telemetryFile, clean)
  return clean
}

function readTelemetryStorage() {
  const result = safeRead(telemetryFile)

  if (!result.ok) {
    console.error("Could not read telemetry file, starting with empty telemetry:", telemetryFile, result.error)
    const empty = getEmptyStats()
    saveTelemetryStorage(empty)
    return empty
  }

  if (!result.data) {
    const empty = getEmptyStats()
    saveTelemetryStorage(empty)
    return empty
  }

  const clean = normalizeStats(result.data)
  lastTelemetryJson = JSON.stringify(clean, null, 2)
  return clean
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

function parseUA(ua) {
  let browser = "unknown"
  let os = "unknown"
  const userAgent = String(ua || "")

  if (/firefox|fxios/i.test(userAgent)) browser = "firefox"
  else if (/edg|edge|edgios|edga/i.test(userAgent)) browser = "edge"
  else if (/opr|opera/i.test(userAgent)) browser = "opera"
  else if (/chrome|chromium|crios/i.test(userAgent)) browser = "chrome"
  else if (/safari/i.test(userAgent)) browser = "safari"

  if (/android/i.test(userAgent)) os = "android"
  else if (/iphone|ipad|ipod|ios/i.test(userAgent)) os = "ios"
  else if (/windows/i.test(userAgent)) os = "windows"
  else if (/mac os|macintosh/i.test(userAgent)) os = "macos"
  else if (/linux/i.test(userAgent)) os = "gnu-linux"

  return { browser, os }
}

function isSafeId(value, maxLength) {
  if (typeof value !== "string") return false
  if (!value.trim()) return false
  if (value.length > maxLength) return false
  return true
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function normalizeTelemetryTab(value) {
  const raw = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "")

  if (raw === "recent" || raw === "recents") return "recent"
  if (raw === "top" || raw === "topvideo" || raw === "topvideos" || raw === "videos") return "topvideos"
  if (raw === "api" || raw === "json" || raw === "endpoints") return "api"
  return "overview"
}

function getTelemetryTabHref(tab, nojs) {
  const cleanTab = normalizeTelemetryTab(tab)
  const params = new URLSearchParams()
  params.set("view", "gui")
  if (nojs) params.set("nojs", "1")
  params.set("tab", cleanTab)
  return `/api/stats?${params.toString()}`
}

function getServerDisplayPageTitle(value) {
  const title = cleanPageTitle(value)
  return title || "Couldnt record"
}

function formatServerStartedAt(value) {
  if (!value) return "Not started"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  })
}

function formatServerLocalViewCount(value) {
  const count = Number(value) || 0
  return count === 1 ? "1 local view" : `${count} local views`
}

function getFriendlyOsName(name) {
  if (name === "windows") return "Windows"
  if (name === "android") return "Android"
  if (name === "unknown") return "Unknown"
  if (name === "macos") return "macOS"
  if (name === "gnu-linux") return "GNU/Linux"
  if (name === "ios") return "iOS"
  return String(name || "unknown")
}

function getFriendlyBrowserName(name) {
  if (name === "firefox") return "Firefox"
  if (name === "chrome") return "Chromium browser"
  if (name === "safari") return "Safari"
  if (name === "edge") return "Edge"
  if (name === "opera") return "Opera"
  if (name === "unknown") return "Unknown"
  return String(name || "unknown")
}

function renderServerBreakdown(data, kind) {
  const entries = Object.entries(data || {})
    .map(([key, value]) => [key, Number(value) || 0])
    .filter((entry) => entry[1] > 0)
    .sort((a, b) => b[1] - a[1])

  if (!entries.length) {
    return '<div class="breakdown-empty">No data recorded yet.</div>'
  }

  const total = entries.reduce((sum, entry) => sum + entry[1], 0)

  return entries.map(([key, count]) => {
    const percent = total ? ((count / total) * 100).toFixed(2) : "0.00"
    const label = kind === "os" ? getFriendlyOsName(key) : getFriendlyBrowserName(key)
    const typeLabel = kind === "os" ? "OS detections" : "browser detections"

    return `<div class="breakdown-item">
      <div class="breakdown-topline">
        <div class="breakdown-label">${escapeHtml(label)} · ${percent}%</div>
        <div class="breakdown-count">${count} detections</div>
      </div>
      <div class="breakdown-bar-wrap">
        <div class="breakdown-bar" style="width:${percent}%"></div>
      </div>
      <div class="breakdown-sub">${escapeHtml(label)} was detected ${count} times out of ${total} total ${typeLabel} on this Poke instance.</div>
    </div>`
  }).join("")
}

function getTelemetrySnapshot(stats, rawLimit) {
  const parsedLimit = parseInt(String(rawLimit || "100"), 10)
  const limit = Number.isFinite(parsedLimit)
    ? Math.max(1, Math.min(parsedLimit, maxJsonLimit))
    : 100

  const sortedVideos = Object.entries((stats && stats.videos) || {})
    .sort((a, b) => b[1] - a[1])

  const topEntries = sortedVideos.slice(0, limit)
  const topVideos = Object.fromEntries(topEntries)
  const recentVideos = ((stats && stats.recentVideos) || []).slice(-32).reverse()
  const visibleVideoIds = new Set([...Object.keys(topVideos), ...recentVideos])
  const pageTitles = {}

  for (const id of visibleVideoIds) {
    const title = cleanPageTitle(((stats && stats.pageTitles) || {})[id])
    if (title) pageTitles[id] = title
  }

  const totalUsers = Object.keys((stats && stats.users) || {}).length
  const estimatedTotalUsers = computeEstimatedTotalUsers(stats || getEmptyStats())
  const totalDetections = Math.max(
    sumObjectValues((stats && stats.os) || {}),
    sumObjectValues((stats && stats.browsers) || {})
  )

  return {
    startedAt: (stats && stats.startedAt) || null,
    videos: topVideos,
    topEntries,
    recentVideos,
    pageTitles,
    browsers: (stats && stats.browsers) || {},
    os: (stats && stats.os) || {},
    totalUsers,
    estimatedTotalUsers,
    totalVideoIds: Object.keys((stats && stats.videos) || {}).length,
    totalDetections,
    limit
  }
}

function renderServerVideoCard(videoId, options = {}) {
  const title = getServerDisplayPageTitle(options.pageTitle)
  const href = `/watch?v=${encodeURIComponent(videoId)}`
  const badge = options.badge ? `<div class="recent-badge">${escapeHtml(options.badge)}</div>` : ""
  const rank = options.rank ? `<div class="video-rank">Rank #${options.rank}</div>` : ""
  const views = typeof options.views === "undefined"
    ? ""
    : `<div class="video-views">${escapeHtml(formatServerLocalViewCount(options.views))}</div>`

  return `<li class="${escapeHtml(options.className || "video-card")}">
    <a class="video-thumb-link" href="${href}" aria-label="Open video ${escapeHtml(videoId)}">
      <img class="video-thumb" src="https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/hqdefault.jpg" alt="Thumbnail for video ${escapeHtml(videoId)}" loading="lazy" referrerpolicy="no-referrer">
    </a>
    <div class="video-meta">
      ${badge}
      <a class="video-title" href="${href}">${escapeHtml(videoId)}</a>
      ${rank}
      <div class="video-page-title">${escapeHtml(title)}</div>
      <div class="video-id">Video ID: ${escapeHtml(videoId)}</div>
      ${views}
    </div>
  </li>`
}

function renderTelemetryNoJsPage(query, stats, telemetryOn) {
  const tab = normalizeTelemetryTab(query && query.tab)
  const snapshot = telemetryOn
    ? getTelemetrySnapshot(stats, query && query.limit)
    : getTelemetrySnapshot(getEmptyStats(), query && query.limit)

  const tabs = [
    ["overview", "Overview"],
    ["recent", "Recent"],
    ["topvideos", "Top videos"],
    ["api", "API"]
  ]

  const tabLinks = tabs.map(([value, label]) => {
    const active = tab === value ? " active" : ""
    return `<a class="seg-btn${active}" href="${escapeHtml(getTelemetryTabHref(value, true))}">${escapeHtml(label)}</a>`
  }).join("")

  const overviewPanel = `<section class="panel active">
    <div class="overview-grid">
      <div class="section-card">
        <h3>Operating systems</h3>
        <div class="breakdown-list">${renderServerBreakdown(snapshot.os, "os")}</div>
      </div>
      <div class="section-card">
        <h3>Browsers</h3>
        <div class="breakdown-list">${renderServerBreakdown(snapshot.browsers, "browser")}</div>
      </div>
    </div>
  </section>`

  const recentCards = snapshot.recentVideos.length
    ? snapshot.recentVideos.slice(0, 12).map((videoId, index) => renderServerVideoCard(videoId, {
        className: "recent-card",
        badge: index === 0 ? "Newest ID" : `Position #${index + 1}`,
        pageTitle: snapshot.pageTitles[videoId]
      })).join("")
    : '<li class="recent-empty">No recent video IDs recorded yet.</li>'

  const recentPanel = `<section class="panel active">
    <div class="section-help">
      <h2>How to read recent videos</h2>
      <p class="note">This server-rendered view shows the most recently recorded video IDs from this Poke instance. It does not auto-refresh.</p>
    </div>
    <div class="section-card">
      <div class="compact-head">
        <div>
          <h2>Recently viewed video IDs</h2>
          <p class="note" style="margin:0;">A rolling local list of recent video IDs recorded by this Poke instance.</p>
        </div>
      </div>
      <div class="recent-summary">
        <div class="summary-card">
          <div class="summary-label">recent IDs loaded</div>
          <div class="summary-value">${snapshot.recentVideos.length}</div>
          <div class="summary-sub">How many recent IDs are visible in this snapshot.</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">latest recorded ID</div>
          <div class="summary-value">${escapeHtml(snapshot.recentVideos[0] || "None")}</div>
          <div class="summary-sub">The first item in the recency queue, if any recent ID exists.</div>
        </div>
      </div>
      <ul class="recent-grid">${recentCards}</ul>
    </div>
  </section>`

  const topCards = snapshot.topEntries.length
    ? snapshot.topEntries.map(([videoId, views], index) => renderServerVideoCard(videoId, {
        rank: index + 1,
        views,
        pageTitle: snapshot.pageTitles[videoId]
      })).join("")
    : '<li class="error-box">No stats recorded yet.</li>'

  const topPanel = `<section class="panel active">
    <div class="section-help">
      <h2>How to read top videos</h2>
      <p class="note">Rankings here are based only on anonymous local detections on this Poke instance.</p>
    </div>
    <div class="section-card">
      <div class="compact-head">
        <div>
          <h2>Top videos</h2>
          <p class="note" style="margin:0;">Ranked by <strong>local views</strong> only, not public YouTube totals.</p>
        </div>
      </div>
      <form class="controls" method="get" action="/api/stats">
        <input type="hidden" name="view" value="gui">
        <input type="hidden" name="nojs" value="1">
        <input type="hidden" name="tab" value="topvideos">
        <label for="video-limit">Show top videos:</label>
        <select id="video-limit" name="limit">
          ${[8, 20, 100, 200, 500, 1000, 3000].map((value) => `<option value="${value}"${snapshot.limit === value ? " selected" : ""}>${value}</option>`).join("")}
        </select>
        <button class="telemetry-refresh-btn" type="submit">Apply</button>
      </form>
      <ul class="video-grid">${topCards}</ul>
    </div>
  </section>`

  const apiPanel = `<section class="panel active">
    <div class="section-card api-lines">
      <h2>API usage</h2>
      <p class="note">
        These API views expose anonymous local telemetry collected by Poke from <code>telemetry.json</code>.<br><br>
        • Live GUI view: <code><a href="/api/stats?view=gui">/api/stats?view=gui</a></code><br>
        • No-JavaScript GUI view: <code><a href="/api/stats?view=gui&amp;nojs=1">/api/stats?view=gui&amp;nojs=1</a></code><br>
        • JSON view: <code><a href="/api/stats?view=json">/api/stats?view=json</a></code><br>
        • JSON with custom limit: <code><a href="/api/stats?view=json&amp;limit=3000">/api/stats?view=json&amp;limit=3000</a></code><br>
        • Opt out for this browser: <code><a href="/api/stats/optout">/api/stats/optout</a></code>
      </p>
    </div>
  </section>`

  const selectedPanel = tab === "recent"
    ? recentPanel
    : tab === "topvideos"
      ? topPanel
      : tab === "api"
        ? apiPanel
        : overviewPanel

  const disabledMessage = telemetryOn ? "" : '<div class="section-card"><p class="note">No data because telemetry is disabled.</p></div>'

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Improving Poke - Stats</title>
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
      font-family:system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,"Noto Sans",sans-serif;
    }
    :visited{color:#00c0ff}
    a{color:#0ab7f0}
    button{font:inherit}
    .app{max-width:1100px;margin:0 auto;padding:24px}
    p{font-family:system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,"Noto Sans",sans-serif;line-height:1.6}
    h1,h2,h3,.tab-btn{font-family:"PokeTube Flex",system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,"Noto Sans",sans-serif}
    h1{font-weight:1000;font-stretch:ultra-expanded;margin-top:0;margin-bottom:.35rem}
    h2{font-weight:700;font-stretch:extra-expanded;margin-top:0;margin-bottom:.4rem}
    h3{font-weight:700;font-stretch:extra-expanded;margin:0 0 .75rem 0;font-size:1.02rem}
    .note{color:#bbb;font-size:.95rem}
    .small{color:#bbb;font-size:.95rem}
    .logo{float:right;margin:.3em 0 1em 2em;max-width:130px}
    .header-container{display:flex;justify-content:space-between;align-items:flex-end;flex-wrap:wrap;margin-bottom:24px;gap:16px}
    .tabs{display:inline-flex;background:#15141a;border-radius:24px;padding:4px;border:1px solid rgba(255,255,255,0.05);flex-wrap:wrap;gap:2px}
    .tab-btn{background:transparent;color:#aaa;border:none;padding:8px 20px;border-radius:20px;cursor:pointer;font-weight:700;font-size:.95rem;outline:none;display:inline-block;line-height:1.2;text-decoration:none}
    .tab-btn:hover:not(.active){color:#fff;text-decoration:none}
    .tab-btn.active{background:#0ab7f0;color:#1c1b22;box-shadow:0 2px 8px rgba(10,183,240,.3)}
    .telemetry-notice,.hero-main,.hero-side,.section-card{background:#252432;border:1px solid #2a2a35;border-radius:18px;padding:18px}
    .telemetry-notice{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;flex-wrap:wrap;margin:0 0 18px 0}
    .telemetry-notice h2{margin:0 0 .4rem 0;font-size:1.05rem}
    .telemetry-notice p{margin:.4rem 0 0 0}
    .hero{display:grid;grid-template-columns:1.45fr .95fr;gap:16px;align-items:start;margin-bottom:18px}
    .hero-main p,.hero-side p{margin:.4rem 0 0 0}
    .hero-side{display:flex;flex-direction:column;gap:14px}
    .mini-stat{display:flex;flex-direction:column;gap:.15rem}
    .mini-stat-label{color:#bbb;font-size:.92rem}
    .mini-stat-value{font-size:1.55rem;font-weight:700;display:flex;align-items:center;gap:.45rem;flex-wrap:wrap}
    .mini-stat-sub{color:#bbb;font-size:.9rem;line-height:1.45}
    .segmented{display:flex;gap:10px;flex-wrap:wrap;margin:0 0 18px 0}
    .seg-btn{display:inline-block;background:#252432;color:#fff;border:1px solid #2a2a35;border-radius:999px;padding:.58rem .9rem;cursor:pointer;text-decoration:none}
    .seg-btn.active{border-color:#0ab7f0;box-shadow:inset 0 0 0 1px #0ab7f0;background:#1f1e29}
    .section-card{margin-bottom:16px}
    .section-help{margin-bottom:16px;background:#22212d;border:1px solid #2e2d3b;border-radius:16px;padding:16px}
    .section-help p{margin:.35rem 0 0 0}
    .overview-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
    .breakdown-empty{color:#bbb}
    .breakdown-list{display:flex;flex-direction:column;gap:12px}
    .breakdown-topline{display:flex;justify-content:space-between;gap:12px;align-items:baseline;margin-bottom:.4rem}
    .breakdown-label{font-weight:600;min-width:0;word-break:break-word}
    .breakdown-count{color:#bbb;white-space:nowrap;font-size:.92rem}
    .breakdown-bar-wrap{width:100%;height:12px;background:#17161d;border:1px solid #2a2a35;border-radius:999px;overflow:hidden}
    .breakdown-bar{height:100%;width:0%;background:linear-gradient(90deg,#0ab7f0 0%,#52d3ff 100%);border-radius:999px}
    .breakdown-sub{margin-top:.35rem;color:#bbb;font-size:.9rem;line-height:1.45}
    .controls{display:flex;align-items:center;gap:.75rem;flex-wrap:wrap;margin:.25rem 0 1rem 0}
    .controls select{background:#252432;color:#fff;border:1px solid #2a2a35;border-radius:10px;padding:.45rem .7rem;font:inherit}
    .telemetry-refresh-btn{padding:.48rem .76rem;border-radius:999px;border:1px solid #3a3947;background:#252432;color:#fff;cursor:pointer;font:inherit;font-size:.9rem}
    .compact-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;flex-wrap:wrap;margin-bottom:12px}
    .recent-summary{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-bottom:16px}
    .summary-card{background:#1f1e29;border:1px solid #2e2d3b;border-radius:16px;padding:14px}
    .summary-label{color:#bbb;font-size:.88rem;margin-bottom:.25rem}
    .summary-value{font-size:1.2rem;font-weight:700;word-break:break-word}
    .summary-sub{margin-top:.35rem;color:#bbb;font-size:.9rem;line-height:1.4}
    .recent-grid,.video-grid{list-style:none;padding-left:0;margin:0;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}
    .recent-card,.video-card{display:flex;flex-direction:column;gap:10px;background:#252432;border:1px solid #2a2a35;border-radius:16px;padding:12px;min-width:0}
    .video-thumb-link{display:block;width:100%}
    .video-thumb{display:block;width:100%;aspect-ratio:16 / 9;object-fit:cover;border-radius:12px;background:#111}
    .video-title{display:inline-block;font-weight:700;line-height:1.35;text-decoration:none;word-break:break-word}
    .video-page-title{margin-top:.45rem;color:#fff;font-size:.95rem;line-height:1.35;word-break:break-word}
    .video-id{color:#bbb;font-size:.9rem;margin-top:.4rem;word-break:break-all}
    .video-views{margin-top:.5rem;font-size:.95rem;color:#fff}
    .video-rank{margin-top:.45rem;color:#bbb;font-size:.9rem}
    .recent-badge{display:inline-flex;align-items:center;gap:.35rem;width:max-content;background:#1f1e29;border:1px solid #2e2d3b;color:#fff;border-radius:999px;padding:.35rem .65rem;font-size:.85rem}
    .recent-empty,.error-box{background:#1f1e29;border:1px solid #2e2d3b;border-radius:16px;padding:16px;color:#bbb;line-height:1.5}
    .api-lines code{white-space:nowrap}
    @media (max-width:1000px){.recent-grid,.video-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
    @media (max-width:900px){.hero{grid-template-columns:1fr}.overview-grid{grid-template-columns:1fr}.recent-summary{grid-template-columns:1fr}}
    @media (max-width:860px){.recent-grid,.video-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
    @media (max-width:640px){.recent-grid,.video-grid{grid-template-columns:1fr}.breakdown-topline{flex-direction:column;align-items:flex-start;gap:.2rem}}
  </style>
</head>
<body>
  <div class="app">
    <img class="logo" src="/css/logo-poke.svg" alt="Poke logo">
    <div class="header-container">
      <div>
        <h1>Anonymous Stats</h1>
        <p class="small" style="margin-top:0;">Privacy stats for Poke!</p>
      </div>
      <div class="tabs">
        <a class="tab-btn" href="/health">Server Vitals</a>
        <a class="tab-btn" href="/traffic">Requests</a>
        <a class="tab-btn active" href="/api/stats?view=gui">Anonymous Stats</a>
      </div>
    </div>

    <div class="telemetry-notice">
      <div>
        <h2>Telemetry system changed</h2>
        <p class="note">This instance now uses a single <code>telemetry.json</code> file. This no-JavaScript page is a server-rendered snapshot and does not auto-refresh.</p>
      </div>
      <div>
        <a class="seg-btn" href="/api/stats?view=gui&amp;tab=${escapeHtml(tab)}">Open live view</a>
      </div>
    </div>

    <div class="hero">
      <div class="hero-main">
        <h2>Private by design</h2>
        <p class="note">These stats are aggregated locally on this Poke instance. Video popularity is based on views recorded from Poke's video watch page.</p>
        <p class="note" style="margin-top:.7rem;"><strong>Important:</strong> these are local Poke numbers, not public YouTube view counts.</p>
      </div>
      <div class="hero-side">
        <div class="mini-stat">
          <div class="mini-stat-label">anonymous user id count</div>
          <div class="mini-stat-value">${telemetryOn ? snapshot.totalUsers : 0}</div>
          <div class="mini-stat-sub">Conservative count from unique anonymous user IDs recorded by this Poke instance.</div>
        </div>
        <div class="mini-stat">
          <div class="mini-stat-label">estimated total users</div>
          <div class="mini-stat-value">${telemetryOn ? snapshot.estimatedTotalUsers : 0}</div>
          <div class="mini-stat-sub">Private estimate based on anonymous user IDs plus aggregate OS/browser detection patterns.</div>
        </div>
        <div class="mini-stat">
          <div class="mini-stat-label">total video ids seen</div>
          <div class="mini-stat-value">${telemetryOn ? snapshot.totalVideoIds : 0}</div>
          <div class="mini-stat-sub">Unique video IDs this Poke instance has seen from its local telemetry data.</div>
        </div>
        <div class="mini-stat">
          <div class="mini-stat-label">telemetry started</div>
          <div class="mini-stat-value">${escapeHtml(telemetryOn ? formatServerStartedAt(snapshot.startedAt) : "Not started")}</div>
          <div class="mini-stat-sub">Date this local <code>telemetry.json</code> data file was started.</div>
        </div>
      </div>
    </div>

    <div class="segmented">${tabLinks}</div>
    ${disabledMessage}
    ${selectedPanel}
  </div>
</body>
</html>`
}

module.exports = function (app, config, renderTemplate) {
  let memoryStats = readTelemetryStorage()
  let needsSave = false
  let saveInProgress = false
  let pendingSave = false
  let saveTimer = null
  let firstUnsavedAt = 0
  let lastSaveAt = 0

  function touchRecentVideo(videoId) {
    if (!videoId) return

    memoryStats.recentVideos = (memoryStats.recentVideos || []).filter((id) => id !== videoId)
    memoryStats.recentVideos.push(videoId)

    if (memoryStats.recentVideos.length > recentVideoLimit) {
      memoryStats.recentVideos = memoryStats.recentVideos.slice(-recentVideoLimit)
    }
  }

  function scheduleTelemetrySave(force) {
    needsSave = true

    const now = Date.now()
    if (!firstUnsavedAt) firstUnsavedAt = now

    if (saveTimer) {
      clearTimeout(saveTimer)
      saveTimer = null
    }

    if (force) {
      saveTimer = setTimeout(saveNow, 0)
      return
    }

    const sinceFirstUnsaved = now - firstUnsavedAt
    const sinceLastSave = now - lastSaveAt

    if (sinceFirstUnsaved >= telemetryMaxUnsavedMs && sinceLastSave >= telemetryMinWriteIntervalMs) {
      saveTimer = setTimeout(saveNow, 0)
      return
    }

    const minIntervalDelay = Math.max(0, telemetryMinWriteIntervalMs - sinceLastSave)
    const maxUnsavedDelay = Math.max(0, telemetryMaxUnsavedMs - sinceFirstUnsaved)
    const debounceDelay = telemetrySaveDebounceMs
    const delay = Math.min(Math.max(debounceDelay, minIntervalDelay), maxUnsavedDelay)

    saveTimer = setTimeout(saveNow, delay)
  }

  function saveNow() {
    if (!needsSave) return
    if (saveInProgress) {
      pendingSave = true
      return
    }

    if (saveTimer) {
      clearTimeout(saveTimer)
      saveTimer = null
    }

    saveInProgress = true

    try {
      memoryStats = saveTelemetryStorage(memoryStats)
      needsSave = false
      firstUnsavedAt = 0
      lastSaveAt = Date.now()
    } catch (error) {
      console.error("Failed to save telemetry", error)
      scheduleTelemetrySave(false)
    } finally {
      saveInProgress = false

      if (pendingSave) {
        pendingSave = false
        scheduleTelemetrySave(false)
      }
    }
  }

  setInterval(() => {
    if (needsSave && firstUnsavedAt && Date.now() - firstUnsavedAt >= telemetryMaxUnsavedMs) {
      scheduleTelemetrySave(true)
    }
  }, Math.max(telemetryMinWriteIntervalMs, 1000))

  process.once("SIGINT", () => {
    try {
      scheduleTelemetrySave(true)
      saveNow()
    } finally {
      process.exit(0)
    }
  })

  process.once("SIGTERM", () => {
    try {
      scheduleTelemetrySave(true)
      saveNow()
    } finally {
      process.exit(0)
    }
  })

  process.once("beforeExit", () => {
    saveNow()
  })

  app.post(["/api/stats", "/api/nexus"], (req, res) => {
    if (!telemetryConfig.telemetry) return res.status(200).json({ ok: true })

    const body = req.body || {}
    const videoId = typeof body.videoId === "string" ? body.videoId.trim() : ""
    const userId = typeof body.userId === "string" ? body.userId.trim() : ""
    const rawPageTitle = typeof body.pageTitle === "string"
      ? body.pageTitle
      : typeof body.title === "string"
        ? body.title
        : ""
    const pageTitle = cleanPageTitle(rawPageTitle)

    if (!isSafeId(videoId, 128)) return res.status(400).json({ error: "missing or invalid videoId" })
    if (!isSafeId(userId, 256)) return res.status(400).json({ error: "missing or invalid userId" })

    const ua = req.headers["user-agent"] || ""
    const parsed = parseUA(ua)

    memoryStats.videos[videoId] = (memoryStats.videos[videoId] || 0) + 1
    if (shouldReplaceRecordedTitle(memoryStats.pageTitles[videoId], pageTitle)) {
      memoryStats.pageTitles[videoId] = cleanPageTitle(pageTitle)
    }
    memoryStats.browsers[parsed.browser] = (memoryStats.browsers[parsed.browser] || 0) + 1
    memoryStats.os[parsed.os] = (memoryStats.os[parsed.os] || 0) + 1
    memoryStats.users[userId] = true
    touchRecentVideo(videoId)

    scheduleTelemetrySave(false)

    res.json({ ok: true })
  })

  app.get("/api/stats/optout", (req, res) => {
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Poke - Opt out of stats</title>
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
      font-family:"PokeTube Flex",system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,"Noto Sans",sans-serif;
      font-weight:500;
      font-stretch:extra-expanded;
      padding-left:1.2rem;
    }
    h2{
      font-family:"PokeTube Flex",system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,"Noto Sans",sans-serif;
      font-weight:700;
      font-stretch:extra-expanded;
      margin-top:1.5rem;
      margin-bottom:.3rem;
    }
    h1{
      font-family:"PokeTube Flex",system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,"Noto Sans",sans-serif;
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
      This page lets you turn off <strong>anonymous stats</strong> for this browser.
      Poke will remember this choice using <code>localStorage</code> only.
    </p>

    <p class="note">
      Anonymous stats help us understand which videos are watched through Poke and which platforms people use,
      without collecting personal data. You can read the full details here:
      <a href="/policies/privacy#stats">Privacy Policy</a>.
    </p>

    <a href="#" id="optout-btn" class="btn">Opt out of anonymous stats</a>
    <div id="status" class="status note"></div>

    <p class="note" style="margin-top:1.5rem;">
      • To see the stats UI, visit
      <code><a href="/api/stats?view=gui">/api/stats?view=gui</a></code>.<br>
      • For raw JSON, use <code><a href="/api/stats?view=json">/api/stats?view=json</a></code>.
    </p>
  </div>

  <script>
    (function () {
      var KEY = "poke_stats_optout"
      var btn = document.getElementById("optout-btn")
      var status = document.getElementById("status")

      function updateStatus() {
        try {
          var v = localStorage.getItem(KEY)
          if (v === "1") {
            status.textContent = "Anonymous stats are currently DISABLED in this browser."
            btn.textContent = "Re-enable anonymous stats"
          } else {
            status.textContent = "Anonymous stats are currently ENABLED in this browser."
            btn.textContent = "Opt out of anonymous stats"
          }
        } catch (e) {
          status.textContent = "Your browser blocked localStorage, so we cannot store your opt-out choice."
        }
      }

      btn.addEventListener("click", function (ev) {
        ev.preventDefault()
        try {
          var v = localStorage.getItem(KEY)
          if (v === "1") {
            localStorage.removeItem(KEY)
          } else {
            localStorage.setItem(KEY, "1")
          }
          updateStatus()
        } catch (e) {
          status.textContent = "Could not save opt-out preference because localStorage is unavailable."
        }
      })

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
      res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate")
      res.set("Pragma", "no-cache")
      res.set("Expires", "0")

      if (!telemetryConfig.telemetry) {
        return res.json({
          startedAt: null,
          videos: {},
          pageTitles: {},
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

      const snapshot = getTelemetrySnapshot(
        memoryStats,
        typeof req.query.limit !== "undefined" ? req.query.limit : "8"
      )

      return res.json({
        startedAt: snapshot.startedAt,
        videos: snapshot.videos,
        pageTitles: snapshot.pageTitles,
        recentVideos: snapshot.recentVideos,
        browsers: snapshot.browsers,
        os: snapshot.os,
        totalUsers: snapshot.totalUsers,
        estimatedTotalUsers: snapshot.estimatedTotalUsers,
        totalVideoIds: snapshot.totalVideoIds,
        totalDetections: snapshot.totalDetections,
        limit: snapshot.limit
      })
    }

    if (view === "gui") {
      const telemetryOn = telemetryConfig.telemetry

      if ((req.query.nojs || "").toString() === "1") {
        return res.send(renderTelemetryNoJsPage(req.query || {}, memoryStats, telemetryOn))
      }

      return res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Improving Poke - Stats</title>
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
      font-family:system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,"Noto Sans",sans-serif;
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
    h1,h2,h3,.tab-btn{
      font-family:"PokeTube Flex",system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,"Noto Sans",sans-serif;
    }
    h2{
      font-weight:700;
      font-stretch:extra-expanded;
      margin-top:0;
      margin-bottom:.4rem;
    }
    h1{
      font-weight:1000;
      font-stretch:ultra-expanded;
      margin-top:0;
      margin-bottom:.35rem;
    }
    h3{
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

    .logo{
      float:right;
      margin:.3em 0 1em 2em;
      max-width:130px;
    }
    .header-container{
      display:flex;
      justify-content:space-between;
      align-items:flex-end;
      flex-wrap:wrap;
      margin-bottom:24px;
      gap:16px;
    }
    .tabs{
      display:inline-flex;
      background:#15141a;
      border-radius:24px;
      padding:4px;
      border:1px solid rgba(255,255,255,0.05);
      flex-wrap:wrap;
      gap:2px;
    }
    .tab-btn{
      background:transparent;
      color:#aaa;
      border:none;
      padding:8px 20px;
      border-radius:20px;
      cursor:pointer;
      font-weight:700;
      font-size:0.95rem;
      transition:all 0.3s ease;
      outline:none;
      display:inline-block;
      line-height:1.2;
      text-decoration:none;
    }
    .tab-btn:hover:not(.active){
      color:#fff;
      text-decoration:none;
    }
    .tab-btn.active{
      background:#0ab7f0;
      color:#1c1b22;
      box-shadow:0 2px 8px rgba(10,183,240,0.3);
    }
    .small{
      color:#bbb;
      font-size:.95rem;
      font-family:system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,"Noto Sans",sans-serif;
    }

    .telemetry-notice{
      display:flex;
      justify-content:space-between;
      gap:16px;
      align-items:flex-start;
      flex-wrap:wrap;
      margin:0 0 18px 0;
      padding:18px;
      border:1px solid #2a2a35;
      border-radius:18px;
      background:#252432;
    }
    .telemetry-notice h2{
      margin:0 0 .4rem 0;
      font-size:1.05rem;
    }
    .telemetry-notice p{
      margin:.4rem 0 0 0;
    }
    .telemetry-settings{
      display:flex;
      align-items:center;
      justify-content:flex-end;
      gap:.75rem;
      flex-wrap:wrap;
      margin-left:auto;
    }
    .telemetry-checkbox{
      display:inline-flex;
      align-items:center;
      gap:.45rem;
      padding:.48rem .76rem;
      border-radius:999px;
      border:1px solid #3a3947;
      background:#1f1e29;
      color:#fff;
      cursor:pointer;
      font-family:system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,"Noto Sans",sans-serif;
      font-size:.9rem;
      user-select:none;
    }
    .telemetry-checkbox input{
      accent-color:#0ab7f0;
    }
    .telemetry-checkbox:has(input:disabled){
      opacity:.55;
      cursor:not-allowed;
    }
    .telemetry-refresh-btn{
      padding:.48rem .76rem;
      border-radius:999px;
      border:1px solid #3a3947;
      background:#252432;
      color:#fff;
      cursor:pointer;
      font:inherit;
      font-size:.9rem;
    }
    .telemetry-refresh-btn:hover{
      background:#2f2e3d;
    }
    .telemetry-refresh-btn[disabled]{
      opacity:.55;
      cursor:not-allowed;
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
      font-weight:700;
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
      grid-template-columns:repeat(2,minmax(0,1fr));
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
      word-break:break-word;
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
    .video-page-title{
      margin-top:.45rem;
      color:#fff;
      font-size:.95rem;
      line-height:1.35;
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
      font-family:"PokeTube Flex",system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,"Noto Sans",sans-serif;
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
          This live GUI needs JavaScript for auto-refresh, client-side tabs, pagination, and downloads.
          A server-rendered snapshot is available and does not auto-refresh.
        </p>
        <ul>
          <li>Open the no-JavaScript stats view at <code><a href="/api/stats?view=gui&amp;nojs=1">/api/stats?view=gui&amp;nojs=1</a></code>.</li>
          <li>You can still read the raw local stats at <code><a href="/api/stats?view=json">/api/stats?view=json</a></code>.</li>
          <li>This warning itself does not enable any tracking, cookies, or extra data collection.</li>
        </ul>
      </div>
    </noscript>

    <img class="logo" src="/css/logo-poke.svg" alt="Poke logo">

    <div class="header-container">
      <div>
        <h1>Anonymous Stats</h1>
        <p class="small" style="margin-top:0;">Privacy stats for Poke!</p>
      </div>
      <div class="tabs">
        <a class="tab-btn" href="/health">Server Vitals</a>
        <a class="tab-btn" href="/traffic">Requests</a>
        <a class="tab-btn active" href="/api/stats?view=gui">Anonymous Stats</a>
      </div>
    </div>

    <div class="telemetry-notice">
      <div>
        <h2>Telemetry system changed</h2>
        <p class="note">
          Poke now stores anonymous local telemetry in one <code>telemetry.json</code> file.
          This GUI reads the JSON API and can refresh itself while you keep this page open.
        </p>
      </div>

      <div class="telemetry-settings">
        <label class="telemetry-checkbox" for="auto-refresh-toggle">
          <input type="checkbox" id="auto-refresh-toggle" checked>
          Auto refresh this view
        </label>
        <button type="button" id="refresh-now-btn" class="telemetry-refresh-btn">Refresh now</button>
      </div>
    </div>

    <div class="hero">
      <div class="hero-main">
        <h2>Private by design</h2>
        <p class="note">
          These stats are aggregated locally on this Poke instance. Video popularity is based on views recorded from Poke's video watch page. For what is collected and what is not,
          see <a href="/policies/privacy#stats">privacy policy</a>.
        </p>
        <p class="note" style="margin-top:.7rem;">
          <strong>Important:</strong> these are local Poke numbers, not public YouTube view counts.
        </p>
      </div>

      <div class="hero-side">
        <div class="mini-stat">
          <div class="mini-stat-label">anonymous user id count</div>
          <div id="user-id-count" class="mini-stat-value">Loading…</div>
          <div class="mini-stat-sub">
            Conservative count from unique anonymous user IDs recorded by this Poke instance.
          </div>
        </div>

        <div class="mini-stat">
          <div class="mini-stat-label">estimated total users</div>
          <div class="mini-stat-value">
            <span id="estimated-total-users">Loading…</span>
            <button type="button" id="estimated-users-info-btn" class="shield-btn" aria-label="About estimated total users">i</button>
          </div>
          <div class="mini-stat-sub">
            Private estimate based on anonymous user IDs plus aggregate OS/browser detection patterns. No page-viewer tracking is used here.
          </div>
        </div>

        <div class="mini-stat">
          <div class="mini-stat-label">total video ids seen</div>
          <div id="total-video-id-count" class="mini-stat-value">Loading…</div>
          <div class="mini-stat-sub">
            Unique video IDs this Poke instance has seen from its local telemetry data.
          </div>
        </div>

        <div class="mini-stat">
          <div class="mini-stat-label">telemetry started</div>
          <div id="telemetry-started-at" class="mini-stat-value">Loading…</div>
          <div class="mini-stat-sub">
            Date this local <code>telemetry.json</code> data file was started.
          </div>
        </div>
      </div>
    </div>

    <div class="segmented">
      <button type="button" class="seg-btn active" data-panel="overview-panel" data-tab="overview">Overview</button>
      <button type="button" class="seg-btn" data-panel="recent-panel" data-tab="recent">Recent</button>
      <button type="button" class="seg-btn" data-panel="top-panel" data-tab="topvideos">Top videos</button>
      <button type="button" class="seg-btn" data-panel="api-panel" data-tab="api">API</button>
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
          Rankings here are based only on anonymous local detections on this Poke instance. A higher number means this instance saw that video more often, not that the upstream platform reported more public views.
        </p>
      </div>

      <div class="section-card">
        <div class="compact-head">
          <div>
            <h2>Top videos</h2>
            <p class="note" style="margin:0;">
              Ranked by <strong>local views</strong> only, not public YouTube totals.
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
          These API views expose anonymous local telemetry collected by Poke from <code>telemetry.json</code>.<br><br>
          • GUI view: <code><a href="/api/stats?view=gui">/api/stats?view=gui</a></code><br>
          • GUI top videos tab: <code><a href="/api/stats?view=gui&amp;tab=topvideos">/api/stats?view=gui&amp;tab=topvideos</a></code><br>
          • No-JavaScript GUI: <code><a href="/api/stats?view=gui&amp;nojs=1">/api/stats?view=gui&amp;nojs=1</a></code><br>
          • JSON view: <code><a href="/api/stats?view=json">/api/stats?view=json</a></code><br>
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
        This estimate is based on already-aggregated anonymous stats only. It does not add personal profiles, account linking, or unique page-viewer tracking for this page.
      </p>
      <p class="note">
        For more detail about what is measured and what is not, see <a href="/policies/privacy#stats">our privacy policy</a>.
      </p>
    </div>
  </div>

  <script>
    const TELEMETRY_ON = ${telemetryOn ? "true" : "false"}
    const OPT_KEY = "poke_stats_optout"
    const AUTO_REFRESH_KEY = "poke_stats_auto_refresh"
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
    const telemetryStartedAt = document.getElementById("telemetry-started-at")
    const limitWarning = document.getElementById("limit-warning")
    const segButtons = document.querySelectorAll(".seg-btn")
    const panels = document.querySelectorAll(".panel")
    const estimatedUsersInfoBtn = document.getElementById("estimated-users-info-btn")
    const privacyModalBackdrop = document.getElementById("privacy-modal-backdrop")
    const privacyModalClose = document.getElementById("privacy-modal-close")
    const autoRefreshToggle = document.getElementById("auto-refresh-toggle")
    const refreshNowBtn = document.getElementById("refresh-now-btn")

    var allVideos = {}
    var pageTitles = {}
    var recentVideoIds = []
    var currentPage = 1
    var hasLoadedTelemetryOnce = false
    var telemetryRefreshTimer = null
    var telemetryFetchInProgress = false
    var lastTelemetrySignature = ""

    const TAB_TO_PANEL = {
      overview: "overview-panel",
      recent: "recent-panel",
      topvideos: "top-panel",
      api: "api-panel"
    }

    const PANEL_TO_TAB = {
      "overview-panel": "overview",
      "recent-panel": "recent",
      "top-panel": "topvideos",
      "api-panel": "api"
    }

    function normalizeTabName(value) {
      var raw = String(value || "")
        .trim()
        .toLowerCase()
        .replace(/[\s_-]+/g, "")

      if (raw === "recent" || raw === "recents") return "recent"
      if (raw === "top" || raw === "topvideo" || raw === "topvideos" || raw === "videos") return "topvideos"
      if (raw === "api" || raw === "json" || raw === "endpoints") return "api"
      return "overview"
    }

    function getTabFromUrl() {
      try {
        var params = new URLSearchParams(window.location.search)
        return normalizeTabName(params.get("tab"))
      } catch (e) {
        return "overview"
      }
    }

    function getPanelForTab(tab) {
      return TAB_TO_PANEL[normalizeTabName(tab)] || TAB_TO_PANEL.overview
    }

    function updateTabQuery(tab) {
      try {
        var url = new URL(window.location.href)
        url.searchParams.set("tab", normalizeTabName(tab))
        history.pushState({ tab: normalizeTabName(tab) }, "", url.toString())
      } catch (e) {}
    }

    function setActivePanel(panelId, updateUrl) {
      var cleanPanelId = PANEL_TO_TAB[panelId] ? panelId : "overview-panel"
      var tab = PANEL_TO_TAB[cleanPanelId] || "overview"

      panels.forEach(function (panel) {
        panel.classList.toggle("active", panel.id === cleanPanelId)
      })

      segButtons.forEach(function (btn) {
        btn.classList.toggle("active", btn.getAttribute("data-panel") === cleanPanelId)
      })

      if (updateUrl) {
        updateTabQuery(tab)
      }
    }

    segButtons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        setActivePanel(btn.getAttribute("data-panel"), true)
      })
    })

    window.addEventListener("popstate", function () {
      setActivePanel(getPanelForTab(getTabFromUrl()), false)
    })

    setActivePanel(getPanelForTab(getTabFromUrl()), false)

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
        " videos. These are local Poke rankings, not YouTube public views."

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
        return sum + (Number(value) || 0)
      }, 0)
    }

    function formatStartedAt(value) {
      if (!value) return "Not started"
      var date = new Date(value)
      if (Number.isNaN(date.getTime())) return value
      return date.toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      })
    }

    function formatLocalViewCount(value) {
      var count = Number(value) || 0
      return count === 1 ? "1 local view" : count + " local views"
    }

    function getFriendlyOsName(name) {
      if (name === "windows") return "Windows"
      if (name === "android") return "Android"
      if (name === "unknown") return "Unknown"
      if (name === "macos") return "macOS"
      if (name === "gnu-linux") return "GNU/Linux"
      if (name === "ios") return "iOS"
      return name
    }

    function getFriendlyBrowserName(name) {
      if (name === "firefox") return "Firefox"
      if (name === "chrome") return "Chromium browser"
      if (name === "safari") return "Safari"
      if (name === "edge") return "Edge"
      if (name === "opera") return "Opera"
      if (name === "unknown") return "Unknown"
      return name
    }

    function renderBreakdown(targetEl, data, kind) {
      targetEl.innerHTML = ""

      var entries = Object.entries(data || {})
        .map(function (entry) {
          return [entry[0], Number(entry[1]) || 0]
        })
        .filter(function (entry) {
          return entry[1] > 0
        })
        .sort(function (a, b) {
          return b[1] - a[1]
        })

      if (entries.length === 0) {
        var empty = document.createElement("div")
        empty.className = "breakdown-empty"
        empty.textContent = "No data recorded yet."
        targetEl.appendChild(empty)
        return
      }

      var total = entries.reduce(function (sum, entry) {
        return sum + entry[1]
      }, 0)

      entries.forEach(function (entry) {
        var key = entry[0]
        var count = entry[1]
        var percent = formatPercent(count, total)
        var label = kind === "os" ? getFriendlyOsName(key) : getFriendlyBrowserName(key)

        var item = document.createElement("div")
        item.className = "breakdown-item"

        var topLine = document.createElement("div")
        topLine.className = "breakdown-topline"

        var labelEl = document.createElement("div")
        labelEl.className = "breakdown-label"
        labelEl.textContent = label + " · " + percent + "%"

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

    function cleanGuiPageTitle(value) {
      var title = String(value || "")
        .replace(/\\s+/g, " ")
        .trim()

      if (!title) return ""

      title = title
        .replace(/\\s*(?:\\||-|–|—)\\s*Poke(?:Tube)?\\s*$/i, "")
        .replace(/\\s+/g, " ")
        .trim()

      if (/^Poke(?:Tube)?$/i.test(title)) return ""

      return title.slice(0, 300)
    }

    function getDisplayPageTitle(value) {
      var title = cleanGuiPageTitle(value)
      return title || "Couldnt record"
    }

    function cleanGuiPageTitles(input) {
      var output = {}

      Object.entries(input || {}).forEach(function (entry) {
        var id = String(entry[0] || "").trim()
        var title = cleanGuiPageTitle(entry[1])

        if (id && title) {
          output[id] = title
        }
      })

      return output
    }

    function escapeHtml(value) {
      return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;")
    }

    function createVideoCard(videoId, extraText, thumbAlt, href, badgeText, pageTitle) {
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

      var pageTitleEl = document.createElement("div")
      pageTitleEl.className = "video-page-title"
      pageTitleEl.textContent = getDisplayPageTitle(pageTitle)

      var idEl = document.createElement("div")
      idEl.className = "video-id"
      idEl.textContent = "Video ID: " + videoId

      meta.appendChild(titleLink)
      meta.appendChild(pageTitleEl)
      meta.appendChild(idEl)

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
        note: "These recent video IDs are from anonymous local Poke stats only.",
        totalRecentVideoIds: recentVideoIds.length,
        recentVideoIds: recentVideoIds.slice(),
        pageTitles: recentVideoIds.reduce(function (titles, videoId) {
          if (pageTitles[videoId]) titles[videoId] = cleanGuiPageTitle(pageTitles[videoId])
          return titles
        }, {})
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
        recentVideos.innerHTML = '<li class="recent-empty">No recent video IDs recorded yet.</li>'
        return
      }

      recentVideoIds.slice(0, 12).forEach(function (videoId, index) {
        var card = createVideoCard(
          videoId,
          "Recently recorded on this Poke instance. Position #" + (index + 1) + " in the live recent queue.",
          "Thumbnail for recent video " + videoId,
          "/watch?v=" + encodeURIComponent(videoId),
          index === 0 ? "Newest ID" : "Position #" + (index + 1),
          pageTitles[videoId]
        )

        card.className = "recent-card"
        recentVideos.appendChild(card)
      })
    }

    function renderTopVideos() {
      var entries = getLimitedEntries()

      if (entries.length === 0) {
        topVideos.innerHTML = '<li class="error-box">No stats recorded yet.</li>'
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

        var pageTitleEl = document.createElement("div")
        pageTitleEl.className = "video-page-title"
        pageTitleEl.textContent = getDisplayPageTitle(pageTitles[id])

        var idEl = document.createElement("div")
        idEl.className = "video-id"
        idEl.textContent = "Video ID: " + id

        var viewsEl = document.createElement("div")
        viewsEl.className = "video-views"
        viewsEl.textContent = formatLocalViewCount(views)

        meta.appendChild(titleLink)
        meta.appendChild(rank)
        meta.appendChild(pageTitleEl)
        meta.appendChild(idEl)
        meta.appendChild(viewsEl)

        li.appendChild(thumbLink)
        li.appendChild(meta)

        topVideos.appendChild(li)
      })

      renderPagination(entries)
    }

    function setDisabledState(message) {
      topVideos.innerHTML = '<li class="error-box">' + message + "</li>"
      recentVideos.innerHTML = '<li class="error-box">' + message + "</li>"
      videoLimitSelect.disabled = true
      downloadRecentJsonBtn.disabled = true
      refreshNowBtn.disabled = true
      autoRefreshToggle.disabled = true
      paginationWrap.style.display = "none"
      osBreakdown.innerHTML = '<div class="breakdown-empty">' + message + "</div>"
      browserBreakdown.innerHTML = '<div class="breakdown-empty">' + message + "</div>"
      recentCount.textContent = "0"
      recentLatest.textContent = "None"
      telemetryStartedAt.textContent = "Not started"
    }

    function getTelemetrySignature(data) {
      var videos = data && data.videos ? data.videos : {}
      var recent = data && Array.isArray(data.recentVideos) ? data.recentVideos : []
      var browsers = data && data.browsers ? data.browsers : {}
      var os = data && data.os ? data.os : {}
      var titles = cleanGuiPageTitles(data && data.pageTitles ? data.pageTitles : {})

      return JSON.stringify({
        startedAt: data ? data.startedAt || null : null,
        videos: videos,
        recentVideos: recent,
        browsers: browsers,
        os: os,
        pageTitles: titles,
        totalUsers: data ? data.totalUsers || 0 : 0,
        estimatedTotalUsers: data ? data.estimatedTotalUsers || 0 : 0,
        totalVideoIds: data ? data.totalVideoIds || 0 : 0,
        totalDetections: data ? data.totalDetections || 0 : 0
      })
    }

    function applyTelemetryData(data) {
      var videos = data.videos || {}
      var titles = cleanGuiPageTitles(data.pageTitles || {})
      var recent = data.recentVideos || []
      var browsers = data.browsers || {}
      var os = data.os || {}
      var totalUsers = data.totalUsers || 0
      var estimatedUsers = data.estimatedTotalUsers || 0
      var totalVideoIds = data.totalVideoIds || 0
      var startedAt = data.startedAt || null
      var signature = getTelemetrySignature(data)
      var changed = signature !== lastTelemetrySignature

      allVideos = videos
      pageTitles = titles
      recentVideoIds = recent
      lastTelemetrySignature = signature

      userIdCount.textContent = String(totalUsers)
      estimatedTotalUsers.textContent = String(estimatedUsers)
      totalVideoIdCount.textContent = String(totalVideoIds)
      telemetryStartedAt.textContent = formatStartedAt(startedAt)

      if (changed || !hasLoadedTelemetryOnce) {
        renderBreakdown(osBreakdown, os, "os")
        renderBreakdown(browserBreakdown, browsers, "browser")
        renderRecentVideos()
        updateLimitWarning()
        renderTopVideos()
      }

      hasLoadedTelemetryOnce = true

    }

    function getTelemetryJsonUrl() {
      return "/api/stats?view=json&limit=3000&_=" + encodeURIComponent(String(Date.now()))
    }

    function loadTelemetryData(force) {
      if (telemetryFetchInProgress && !force) return

      telemetryFetchInProgress = true
      refreshNowBtn.disabled = true

      fetch(getTelemetryJsonUrl(), {
        cache: "no-store",
        headers: {
          "Accept": "application/json"
        }
      })
        .then(function (res) {
          if (!res.ok) {
            throw new Error("Telemetry request failed with status " + res.status)
          }

          return res.json()
        })
        .then(function (data) {
          applyTelemetryData(data)
        })
        .catch(function () {
          if (!hasLoadedTelemetryOnce) {
            setDisabledState("Error loading data.")
            userIdCount.textContent = "Error"
            estimatedTotalUsers.textContent = "Error"
            totalVideoIdCount.textContent = "Error"
            telemetryStartedAt.textContent = "Error"
          }

        })
        .finally(function () {
          telemetryFetchInProgress = false
          refreshNowBtn.disabled = false
        })
    }

    function getAutoRefreshEnabled() {
      try {
        return localStorage.getItem(AUTO_REFRESH_KEY) !== "0"
      } catch (e) {
        return true
      }
    }

    function saveAutoRefreshEnabled(enabled) {
      try {
        localStorage.setItem(AUTO_REFRESH_KEY, enabled ? "1" : "0")
      } catch (e) {}
    }

    function stopTelemetryAutoRefresh() {
      if (telemetryRefreshTimer) {
        clearInterval(telemetryRefreshTimer)
        telemetryRefreshTimer = null
      }
    }

    function startTelemetryAutoRefresh() {
      stopTelemetryAutoRefresh()

      telemetryRefreshTimer = setInterval(function () {
        loadTelemetryData(false)
      }, 5000)
    }

    document.addEventListener("visibilitychange", function () {
      if (!document.hidden && autoRefreshToggle.checked) {
        loadTelemetryData(true)
      }
    })

    videoLimitSelect.addEventListener("change", function () {
      updateLimitWarning()
      renderTopVideos()
    })

    refreshNowBtn.addEventListener("click", function () {
      loadTelemetryData(true)
    })

    autoRefreshToggle.addEventListener("change", function () {
      var enabled = autoRefreshToggle.checked
      saveAutoRefreshEnabled(enabled)

      if (enabled) {
        startTelemetryAutoRefresh()
        loadTelemetryData(true)
      } else {
        stopTelemetryAutoRefresh()
      }
    })

    if (!TELEMETRY_ON) {
      setDisabledState("No data because telemetry is disabled.")
      userIdCount.textContent = "0"
      estimatedTotalUsers.textContent = "0"
      totalVideoIdCount.textContent = "0"
      telemetryStartedAt.textContent = "Not started"
    } else {
      var optedOut = false
      try {
        optedOut = localStorage.getItem(OPT_KEY) === "1"
      } catch (e) {}

      if (optedOut) {
        setDisabledState("Opt-out active, so no stats loaded.")
        userIdCount.textContent = "Opt-out active"
        estimatedTotalUsers.textContent = "Opt-out active"
        totalVideoIdCount.textContent = "Opt-out active"
        telemetryStartedAt.textContent = "Opt-out active"
      } else {
        var autoRefreshEnabled = getAutoRefreshEnabled()
        autoRefreshToggle.checked = autoRefreshEnabled
        autoRefreshToggle.disabled = false
        refreshNowBtn.disabled = false
        loadTelemetryData(true)

        if (autoRefreshEnabled) {
          startTelemetryAutoRefresh()
        }
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
      font-family:"PokeTube Flex",system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,"Noto Sans",sans-serif;
      font-weight:500;
      font-stretch:extra-expanded;
      padding-left:1.2rem;
    }
    h2{
      font-family:"PokeTube Flex",system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,"Noto Sans",sans-serif;
      font-weight:700;
      font-stretch:extra-expanded;
      margin-top:1.5rem;
      margin-bottom:.3rem;
    }
    h1{
      font-family:"PokeTube Flex",system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,"Noto Sans",sans-serif;
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
      To improve Poke we use a completely anonymous, local-only way to understand how videos are being watched through Poke.
    </p>

    <p>
      Any anonymous stats recorded by this instance come through the <code>/api/stats</code> system.
      You can read exactly what is measured and what is <em>not</em> in our privacy policy:
      <a href="/policies/privacy#stats">here</a>.
    </p>

    <hr>

    <h2>API usage</h2>
    <p class="note">
      These API views are for anonymous local Poke stats only.<br><br>
      • GUI view: <code><a href="/api/stats?view=gui">/api/stats?view=gui</a></code><br>
      • JSON view: <code><a href="/api/stats?view=json">/api/stats?view=json</a></code><br>
      • JSON default limit: <code><a href="/api/stats?view=json">/api/stats?view=json</a></code> (8 videos)<br>
      • JSON with custom limit: <code><a href="/api/stats?view=json&limit=3000">/api/stats?view=json&limit=3000</a></code><br>
      • Opt out for this browser: <code><a href="/api/stats/optout">/api/stats/optout</a></code>
    </p>
  </div>
</body>
</html>`)
  })
}