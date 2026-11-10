const express = require("express");
const fetch = require("node-fetch");
const { URL } = require("url");
const zlib = require("zlib");
const fs = require("fs");
const path = require("path");

const FONTS_DIR = path.join(__dirname, "fonts");
if (!fs.existsSync(FONTS_DIR)) {
  fs.mkdirSync(FONTS_DIR, { recursive: true });
}

// All Font Awesome v6.1.1 webfont filenames we need to serve locally.
// woff2 and ttf only — those are the only formats referenced in the CSS.
const FA_WEBFONTS = [
  "fa-brands-400.woff2",
  "fa-brands-400.ttf",
  "fa-duotone-900.woff2",
  "fa-duotone-900.ttf",
  "fa-light-300.woff2",
  "fa-light-300.ttf",
  "fa-regular-400.woff2",
  "fa-regular-400.ttf",
  "fa-solid-900.woff2",
  "fa-solid-900.ttf",
  "fa-thin-100.woff2",
  "fa-thin-100.ttf",
  "fa-v4compatibility.woff2",
  "fa-v4compatibility.ttf",
];

// MIME types for font extensions
const FONT_MIME = {
  ".woff2": "font/woff2",
  ".ttf":   "font/ttf",
  ".woff":  "font/woff",
  ".eot":   "application/vnd.ms-fontobject",
};

// In-memory cache for the rewritten CSS text — populated once, served forever
// (the fonts never change, so there's no need to re-fetch)
let FA_CSS_CACHE = null;

// In-memory cache for CDX timestamps keyed by original URL
const cdxTimestampCache = {};


/**
 * Query the Wayback Machine CDX API to find the most recent valid snapshot
 * timestamp for a given URL. Caches the result in memory.
 * Returns null if none found.
 * @param {string} assetUrl
 * @returns {Promise<string|null>}
 */
const findArchiveTimestamp = async (assetUrl) => {
  if (cdxTimestampCache[assetUrl]) {
    return cdxTimestampCache[assetUrl];
  }

  const { fetch } = await import("undici");
  const cdxUrl =
    `https://web.archive.org/cdx/search/cdx` +
    `?url=${encodeURIComponent(assetUrl)}` +
    `&output=json&limit=1&fl=timestamp,statuscode` +
    `&filter=statuscode:200&from=20220101&fastLatest=true`;

  try {
    const res = await fetch(cdxUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; poketube-proxy/1.0)",
        "Accept": "application/json",
        "Accept-Encoding": "identity",
      },
      redirect: "follow",
    });
    if (!res.ok) return null;
    const rows = await res.json();
    // rows[0] is the header ["timestamp","statuscode"], rows[1] is first result
    if (!Array.isArray(rows) || rows.length < 2) return null;
    const ts = rows[1][0];
    cdxTimestampCache[assetUrl] = ts;
    return ts;
  } catch (err) {
    console.error(`[fonts] CDX lookup failed for ${assetUrl}: ${err.message}`);
    return null;
  }
};

/**
 * Validate that a buffer is actually the binary font format we expect.
 * @param {Buffer} buf
 * @param {string} filename
 */
const validateFontBuffer = (buf, filename) => {
  if (!buf || buf.length < 8) return false;
  const ext = path.extname(filename).toLowerCase();
  if (ext === ".woff2") {
    return buf.toString("ascii", 0, 4) === "wOF2";
  }
  if (ext === ".ttf") {
    const magic = buf.readUInt32BE(0);
    const tag = buf.toString("ascii", 0, 4);
    return magic === 0x00010000 || tag === "OTTO" || tag === "true";
  }
  return true;
};

/**
 * Download a single font file from the Wayback Machine via CDX-discovered timestamp.
 * @param {string} filename
 * @returns {Promise<boolean>}
 */
const downloadFont = async (filename) => {
  const { fetch } = await import("undici");
  const destPath = path.join(FONTS_DIR, filename);
  const originalUrl = `https://site-assets.fontawesome.com/releases/v6.1.1/webfonts/${filename}`;

  console.log(`[fonts] Looking up snapshot for ${filename}...`);
  const timestamp = await findArchiveTimestamp(originalUrl);

  if (!timestamp) {
    console.error(`[fonts] No archived snapshot found for ${filename}`);
    return false;
  }

  const archiveUrl = `https://web.archive.org/web/${timestamp}if_/${originalUrl}`;
  console.log(`[fonts] Downloading ${filename} @ ts=${timestamp}`);

  try {
    const res = await fetch(archiveUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "*/*",
        "Accept-Encoding": "identity",
        "Referer": "https://web.archive.org/",
      },
      redirect: "follow",
    });

    if (!res.ok) {
      console.error(`[fonts] HTTP ${res.status} downloading ${filename}`);
      return false;
    }

    const ct = res.headers.get("content-type") || "";
    if (ct.includes("text/html")) {
      console.error(`[fonts] Skipping ${filename}: got HTML content-type`);
      return false;
    }

    const buf = Buffer.from(await res.arrayBuffer());

    if (!validateFontBuffer(buf, filename)) {
      console.error(`[fonts] Skipping ${filename}: failed binary validation (${buf.length} bytes, first 4: "${buf.toString("ascii", 0, 4)}")`);
      return false;
    }

    fs.writeFileSync(destPath, buf);
    console.log(`[fonts] Saved ${filename} (${buf.length} bytes)`);
    return true;
  } catch (err) {
    console.error(`[fonts] Error downloading ${filename}: ${err.message}`);
    return false;
  }
};

/**
 * Rewrite all font URL variants inside CSS text to local /fonts/<filename> paths.
 * Handles:
 *   /web/20260129053127im_/https://site-assets.fontawesome.com/.../fa-solid-900.woff2
 *   https://web.archive.org/web/<ts>if_/https://site-assets.fontawesome.com/.../fa-solid-900.woff2
 *   https://site-assets.fontawesome.com/.../fa-solid-900.woff2
 * @param {string} css
 * @returns {string}
 */
const rewriteCssFontUrls = (css) => {
  // Strip Wayback Machine injected comment blocks (header notice + playback timings)
  css = css.replace(/\/\*[\s\S]*?FILE ARCHIVED ON[\s\S]*?\*\//g, "");
  css = css.replace(/\/\*\s*playback timings[\s\S]*?\*\//gi, "");
  // Rewrite all font URLs to local /fonts/<filename>
  css = css.replace(
    /(?:(?:https?:\/\/web\.archive\.org)?\/web\/\d{14}[a-z_]*\/)?(?:https?:\/\/)?site-assets\.fontawesome\.com\/releases\/v6\.1\.1\/webfonts\/(fa-[\w-]+\.(?:woff2|ttf|woff|eot))/g,
    "/fonts/$1"
  );
  return css.trim();
};

// Disk path for the cached & rewritten CSS (lives alongside the fonts)
const FA_CSS_DISK_PATH = path.join(__dirname, "fonts", "all.css");

/**
 * Load, rewrite, and cache the Font Awesome CSS.
 *
 * Priority order:
 *   1. In-memory cache  (instant, zero I/O)
 *   2. Disk cache at fonts/all.css  (fast, no network)
 *   3. Fetch from Wayback Machine, rewrite, save to disk + memory
 *
 * Safe to call concurrently — a single in-flight promise is shared so
 * parallel requests during the first fetch don't fire duplicate downloads.
 */
let cssLoadPromise = null;
const loadCss = () => {
  // 1. Already in memory
  if (FA_CSS_CACHE !== null) return Promise.resolve(FA_CSS_CACHE);

  // 2. Already on disk — load synchronously into memory and return immediately
  if (fs.existsSync(FA_CSS_DISK_PATH) && fs.statSync(FA_CSS_DISK_PATH).size > 100) {
    try {
      FA_CSS_CACHE = fs.readFileSync(FA_CSS_DISK_PATH, "utf8");
      console.log(`[css] Loaded FA CSS from disk cache (${Buffer.byteLength(FA_CSS_CACHE, "utf8")} bytes)`);
      return Promise.resolve(FA_CSS_CACHE);
    } catch (e) {
      console.warn(`[css] Failed to read disk cache, will re-fetch: ${e.message}`);
    }
  }

  // 3. Not on disk yet — fetch, rewrite, persist
  if (cssLoadPromise) return cssLoadPromise;

  cssLoadPromise = (async () => {
    const cssOriginalUrl = "https://site-assets.fontawesome.com/releases/v6.1.1/css/all.css";

    let cssTimestamp = await findArchiveTimestamp(cssOriginalUrl);
    if (!cssTimestamp) {
      cssTimestamp = "20260310233449";
    }

    const archiveUrl = `https://web.archive.org/web/${cssTimestamp}if_/${cssOriginalUrl}`;
    console.log(`[css] Fetching FA CSS from ${archiveUrl}`);

    const { fetch } = await import("undici");
    const f = await fetch(archiveUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "text/css,*/*;q=0.1",
        "Accept-Encoding": "identity",
        "Referer": "https://web.archive.org/",
      },
      redirect: "follow",
    });

    if (!f.ok) throw new Error(`Upstream CSS ${f.status}`);

    const rawBody = Buffer.from(await f.arrayBuffer());
    const encoding = f.headers.get("content-encoding");
    let cssText;
    try { cssText = (await decompress(rawBody, encoding)).toString("utf8"); }
    catch (_) { cssText = rawBody.toString("utf8"); }

    cssText = rewriteCssFontUrls(cssText);

    // Persist to disk so future server restarts skip the network entirely
    try {
      fs.writeFileSync(FA_CSS_DISK_PATH, cssText, "utf8");
      console.log(`[css] FA CSS saved to disk (${Buffer.byteLength(cssText, "utf8")} bytes)`);
    } catch (e) {
      console.warn(`[css] Could not write CSS to disk: ${e.message}`);
    }

    FA_CSS_CACHE = cssText;
    cssLoadPromise = null;
    return cssText;
  })();

  return cssLoadPromise;
};

/**
 * Download all missing font files at startup. Non-blocking.
 */
const ensureFontsDownloaded = async () => {
  for (const filename of FA_WEBFONTS) {
    const destPath = path.join(FONTS_DIR, filename);
    if (fs.existsSync(destPath) && fs.statSync(destPath).size > 100) {
      const buf = fs.readFileSync(destPath);
      if (validateFontBuffer(buf, filename)) {
        console.log(`[fonts] Already have valid ${filename}, skipping`);
        continue;
      } else {
        console.warn(`[fonts] Cached ${filename} failed validation, re-downloading`);
        fs.unlinkSync(destPath);
      }
    }
    await downloadFont(filename);
  }
  console.log("[fonts] Font cache check complete");
};

// Kick off both font downloads and CSS pre-warming in background
Promise.all([
  ensureFontsDownloaded(),
  loadCss(),
]).catch((err) => console.error("[startup] Background init error:", err));

// ---------------------------------------------------------------------------
// URL whitelist 
// ---------------------------------------------------------------------------

const URL_WHITELIST = [
  "i.ytimg.com",
  "yt3.googleusercontent.com",
  "cdn.statically.io",
  "site-assets.fontawesome.com",
  "fonts.gstatic.com",
  "cdn.jsdelivr.net",
  "yt3.ggpht.com",
  "tube.kuylar.dev",
  "lh3.googleusercontent.com",
  "is4-ssl.mzstatic.com",
  "is2-ssl.mzstatic.com",
  "is1-ssl.mzstatic.com",
  "fonts.bunny.net",
  "demo.matomo.org",
  "is5-ssl.mzstatic.com",
  "is3-ssl.mzstatic.com",
  "twemoji.maxcdn.com",
  "cdnjs.cloudflare.com",
  "unpkg.com",
  "lite.duckduckgo.com",
  "youtube.com",
  "returnyoutubedislikeapi.com",
  "cdn.zptr.cc",
  "inv.vern.cc",
  "invidious.privacydev.net",
  "inv.zzls.xyz",
  "vid.puffyan.us",
  "invidious.lidarshield.cloud",
  "invidious.epicsite.xyz",
  "invidious.esmailelbob.xyz",
  "web.archive.org",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Dynamically extracts and normalizes a target URL from Express's req.originalUrl
 * without relying on hardcoded character slice indices.
 *
 * Handles:
 *   - /https://fonts.bunny.net/...
 *   - /http://fonts.bunny.net/...
 *   - /https:/fonts.bunny.net/... (when a reverse proxy collapses double slashes)
 *   - /fonts.bunny.net/...        (when protocol is omitted)
 *   - //fonts.bunny.net/...
 *
 * @param {string} originalUrl
 * @returns {string}
 */
const extractTargetUrl = (originalUrl) => {
  // 1. Strip any leading slashes
  let cleaned = originalUrl.replace(/^\/+/, "");

  // 2. If it starts with http://, https://, http:/, or https:/ (collapsed slash),
  //    normalize the scheme to always have exactly "://"
  if (/^https?:\/+/i.test(cleaned)) {
    cleaned = cleaned.replace(/^(https?):\/+/i, "$1://");
  } else {
    // 3. Otherwise, default to https://
    cleaned = "https://" + cleaned;
  }

  return cleaned;
};

const getSpoofedHeaders = (host) => {
  if (host === "web.archive.org") {
    return {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Accept": "*/*",
      "Accept-Language": "en-US,en;q=0.9",
      "Accept-Encoding": "identity",
      "Referer": "https://web.archive.org/",
    };
  }
  if (host === "site-assets.fontawesome.com") {
    return {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Referer": "https://fontawesome.com/",
      "Origin": "https://fontawesome.com",
      "Accept": "text/css,*/*;q=0.1",
      "Accept-Language": "en-US,en;q=0.9",
      "Accept-Encoding": "identity",
      "Sec-Fetch-Dest": "style",
      "Sec-Fetch-Mode": "no-cors",
      "Sec-Fetch-Site": "same-site",
    };
  }
  return {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "*/*",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "identity",
  };
};

const decompress = (buf, encoding) => {
  return new Promise((resolve, reject) => {
    if (!encoding || encoding === "identity") return resolve(buf);
    if (encoding === "gzip") return zlib.gunzip(buf, (e, r) => e ? reject(e) : resolve(r));
    if (encoding === "deflate") {
      return zlib.inflate(buf, (e, r) => {
        if (e) zlib.inflateRaw(buf, (e2, r2) => e2 ? reject(e2) : resolve(r2));
        else resolve(r);
      });
    }
    if (encoding === "br") return zlib.brotliDecompress(buf, (e, r) => e ? reject(e) : resolve(r));
    resolve(buf);
  });
};

const fetchAndForward = async (targetUrl, method, res) => {
  const { fetch } = await import("undici");
  const url = new URL(targetUrl);
  const headers = getSpoofedHeaders(url.host);

  console.log(`==> Fetching ${targetUrl}`);
  const f = await fetch(targetUrl, { method, headers, redirect: "follow" });

  if (!f.ok) {
    console.log(`==> Upstream returned ${f.status} for ${url.host}`);
    return res.status(f.status).send(`Upstream error: ${f.status} ${f.statusText}`);
  }

  const rawBody = Buffer.from(await f.arrayBuffer());
  const encoding = f.headers.get("content-encoding");
  let body;
  try { body = await decompress(rawBody, encoding); }
  catch (e) { body = rawBody; }

  for (const h of ["content-type", "last-modified", "etag"]) {
    const v = f.headers.get(h);
    if (v) res.setHeader(h, v);
  }
  res.removeHeader("content-encoding");
  res.setHeader("content-length", body.length);
  res.send(body);
};

// ---------------------------------------------------------------------------
// Express app
// ---------------------------------------------------------------------------

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, _res, next) => {
  console.log(`=> ${req.method} ${req.originalUrl}`);
  next();
});

app.use((_req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "public, max-age=864000");
  res.setHeader("poketube-cacher", "PROXY_FILES");
  next();
});

// ---------------------------------------------------------------------------
// Route: serve locally cached Font Awesome fonts from /fonts/<filename>
// ---------------------------------------------------------------------------
app.get("/fonts/:filename", (req, res) => {
  const { filename } = req.params;

  if (!FA_WEBFONTS.includes(filename)) {
    return res.status(404).send("Font not found");
  }

  const filePath = path.join(FONTS_DIR, filename);

  if (!fs.existsSync(filePath) || fs.statSync(filePath).size < 100) {
    downloadFont(filename).catch(() => {});
    return res
      .status(503)
      .setHeader("Retry-After", "5")
      .send("Font is being downloaded, please retry in a moment");
  }

  const ext = path.extname(filename).toLowerCase();
  res.setHeader("Content-Type", FONT_MIME[ext] || "application/octet-stream");
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.sendFile(filePath);
});

// ---------------------------------------------------------------------------
// Route: Font Awesome CSS — served from in-memory cache after first load
// ---------------------------------------------------------------------------
const FA_CSS_HANDLER = async (req, res) => {
  try {
    const cssText = await loadCss();
    const buf = Buffer.from(cssText, "utf8");
    res.setHeader("Content-Type", "text/css; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=864000");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.removeHeader("content-encoding");
    res.setHeader("content-length", buf.length);
    res.send(cssText);
  } catch (e) {
    console.error(`==> FA CSS handler error: ${e}`);
    res.status(500).send("Internal server error");
  }
};

app.get(
  /^\/https?:\/+site-assets\.fontawesome\.com\/releases\/v6\.1\.1\/css\/all\.css/,
  FA_CSS_HANDLER
);
app.get(
  /^\/web\/\d{14}[a-z_]*\/https?:\/+site-assets\.fontawesome\.com\/releases\/v6\.1\.1\/css\/all\.css/,
  FA_CSS_HANDLER
);

// ---------------------------------------------------------------------------
// Route: catch Wayback Machine /web/... font paths and redirect to /fonts/
// ---------------------------------------------------------------------------
app.get(
  /^\/web\/\d{14}[a-z_]*\/https?:\/+site-assets\.fontawesome\.com\/releases\/v6\.1\.1\/webfonts\/(.+)$/,
  (req, res) => {
    const filename = req.params[0];
    if (!FA_WEBFONTS.includes(filename)) {
      return res.status(404).send("Font not found");
    }
    res.redirect(301, `/fonts/${filename}`);
  }
);

// ---------------------------------------------------------------------------
// Route: index
// ---------------------------------------------------------------------------

app.get("/", (_req, res) => {
  res.json({
    status: "200",
    version: "1.3.332a-b3-9e",
    URL_WHITELIST,
    cache: "max-age-864000",
  });
});

// ---------------------------------------------------------------------------
// Route: YouTube engagement API
// ---------------------------------------------------------------------------

const apiUrls = [
  "https://returnyoutubedislikeapi.com/votes?videoId=",
  "https://prod-poketube.testing.poketube.fun/api?v=",
  "https://ipv6-t.poketube.fun/api?v=",
];

const apiCache = {};

app.get("/api", async (req, res) => {
  const { fetch } = await import("undici");
  try {
    const cacheKey = req.query.v;
    if (apiCache[cacheKey] && Date.now() - apiCache[cacheKey].timestamp < 3600000) {
      return res.json(apiCache[cacheKey].data);
    }
    const errors = [];
    for (const apiUrl of apiUrls) {
      try {
        const engagement = await fetch(apiUrl + req.query.v).then((r) => r.json());
        apiCache[cacheKey] = { data: engagement, timestamp: Date.now() };
        return res.json(engagement);
      } catch (err) {
        console.log(`Error fetching from ${apiUrl}: ${err.message}`);
        errors.push(err.message);
      }
    }
    res.status(500).json({ error: "All API endpoints failed", errors });
  } catch (err) {
    console.log(err);
  }
});

// ---------------------------------------------------------------------------
// Route: DuckDuckGo bangs
// ---------------------------------------------------------------------------

app.get("/bangs", async (req, res) => {
  const f = await fetch("https://lite.duckduckgo.com/lite/?q=" + req.query.q);
  res.redirect(f);
});

// ---------------------------------------------------------------------------
// Route: generic proxy catch-all
// ---------------------------------------------------------------------------

const proxy = async (req, res) => {
  res.setHeader("Cache-Control", "public, max-age=864000");
  try {
    const rawUrl = extractTargetUrl(req.originalUrl);

    let url;
    try {
      url = new URL(rawUrl);
    } catch (e) {
      console.log("==> Cannot parse URL: " + e);
      return res.status(400).send("Malformed URL");
    }

    if (!URL_WHITELIST.includes(url.host)) {
      console.log(`==> Refusing to proxy host ${url.host}`);
      return res.status(401).send(`Hostname '${url.host}' is not permitted`);
    }

    if (url.host !== "web.archive.org") {
      url.searchParams.set("cachefixer", Buffer.from(String(Date.now())).toString("base64"));
    }

    await fetchAndForward(url.toString(), req.method, res);
  } catch (e) {
    console.log(`==> Error: ${e}`);
    res.status(500).send("Internal server error");
  }
};

app.all("/*", (req, res) => proxy(req, res));

app.listen(6014, () => console.log("Listening on 0.0.0.0:6014"));