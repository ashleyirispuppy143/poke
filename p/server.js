const express = require("express");
const fetch = require("node-fetch");
const { URL } = require("url");
const { Readable } = require("node:stream");
const zlib = require("zlib");
const fs = require("fs");
const path = require("path");

// ---------------------------------------------------------------------------
// Font Awesome local cache setup
// ---------------------------------------------------------------------------

const FONTS_DIR = path.join(__dirname, "fonts");

// Ensure the fonts directory exists on startup
if (!fs.existsSync(FONTS_DIR)) {
  fs.mkdirSync(FONTS_DIR, { recursive: true });
}

const FA_TS = "20260129053127";

// All Font Awesome v6.1.1 assets we want to serve locally.
// Each entry maps a local filename to its Wayback Machine if_ source URL.
// woff2 and ttf are the only formats used in the CSS — we download both.
const FA_LOCAL_ASSETS = {
  "fa-brands-400.woff2":       `https://web.archive.org/web/${FA_TS}if_/https://site-assets.fontawesome.com/releases/v6.1.1/webfonts/fa-brands-400.woff2`,
  "fa-brands-400.ttf":         `https://web.archive.org/web/${FA_TS}if_/https://site-assets.fontawesome.com/releases/v6.1.1/webfonts/fa-brands-400.ttf`,
  "fa-duotone-900.woff2":      `https://web.archive.org/web/${FA_TS}if_/https://site-assets.fontawesome.com/releases/v6.1.1/webfonts/fa-duotone-900.woff2`,
  "fa-duotone-900.ttf":        `https://web.archive.org/web/${FA_TS}if_/https://site-assets.fontawesome.com/releases/v6.1.1/webfonts/fa-duotone-900.ttf`,
  "fa-light-300.woff2":        `https://web.archive.org/web/${FA_TS}if_/https://site-assets.fontawesome.com/releases/v6.1.1/webfonts/fa-light-300.woff2`,
  "fa-light-300.ttf":          `https://web.archive.org/web/${FA_TS}if_/https://site-assets.fontawesome.com/releases/v6.1.1/webfonts/fa-light-300.ttf`,
  "fa-regular-400.woff2":      `https://web.archive.org/web/${FA_TS}if_/https://site-assets.fontawesome.com/releases/v6.1.1/webfonts/fa-regular-400.woff2`,
  "fa-regular-400.ttf":        `https://web.archive.org/web/${FA_TS}if_/https://site-assets.fontawesome.com/releases/v6.1.1/webfonts/fa-regular-400.ttf`,
  "fa-solid-900.woff2":        `https://web.archive.org/web/${FA_TS}if_/https://site-assets.fontawesome.com/releases/v6.1.1/webfonts/fa-solid-900.woff2`,
  "fa-solid-900.ttf":          `https://web.archive.org/web/${FA_TS}if_/https://site-assets.fontawesome.com/releases/v6.1.1/webfonts/fa-solid-900.ttf`,
  "fa-thin-100.woff2":         `https://web.archive.org/web/${FA_TS}if_/https://site-assets.fontawesome.com/releases/v6.1.1/webfonts/fa-thin-100.woff2`,
  "fa-thin-100.ttf":           `https://web.archive.org/web/${FA_TS}if_/https://site-assets.fontawesome.com/releases/v6.1.1/webfonts/fa-thin-100.ttf`,
  "fa-v4compatibility.woff2":  `https://web.archive.org/web/${FA_TS}if_/https://site-assets.fontawesome.com/releases/v6.1.1/webfonts/fa-v4compatibility.woff2`,
  "fa-v4compatibility.ttf":    `https://web.archive.org/web/${FA_TS}if_/https://site-assets.fontawesome.com/releases/v6.1.1/webfonts/fa-v4compatibility.ttf`,
};

// MIME types for font files
const FONT_MIME = {
  ".woff2": "font/woff2",
  ".ttf":   "font/ttf",
  ".woff":  "font/woff",
  ".eot":   "application/vnd.ms-fontobject",
};

/**
 * Download a single font file from the Wayback Machine and save it locally.
 * Returns true on success, false on failure.
 * @param {string} filename
 * @param {string} sourceUrl
 * @returns {Promise<boolean>}
 */
const downloadFont = async (filename, sourceUrl) => {
  const { fetch } = await import("undici");
  const destPath = path.join(FONTS_DIR, filename);

  console.log(`[fonts] Downloading ${filename} from ${sourceUrl}`);

  try {
    const res = await fetch(sourceUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "*/*",
        "Accept-Encoding": "identity",
        "Referer": "https://web.archive.org/",
      },
      redirect: "follow",
    });

    if (!res.ok) {
      console.error(`[fonts] Failed to download ${filename}: HTTP ${res.status}`);
      return false;
    }

    // Validate we got a binary font file and not an HTML error page.
    // Wayback Machine sometimes returns HTML with a 200 status for missing snapshots.
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("text/html")) {
      console.error(`[fonts] Skipping ${filename}: upstream returned HTML (snapshot may be missing)`);
      return false;
    }

    const buf = Buffer.from(await res.arrayBuffer());

    // Sanity-check: woff2 files start with 0x774F4632 ("wOF2"), ttf with 0x00010000 or "OTTO"
    const ext = path.extname(filename).toLowerCase();
    if (ext === ".woff2" && buf.length > 4) {
      const magic = buf.toString("ascii", 0, 4);
      if (magic !== "wOF2") {
        console.error(`[fonts] Skipping ${filename}: bad woff2 magic (got "${magic}"), file may be corrupt or HTML`);
        return false;
      }
    }
    if (ext === ".ttf" && buf.length > 4) {
      const magic = buf.readUInt32BE(0);
      const ottoMagic = buf.toString("ascii", 0, 4);
      if (magic !== 0x00010000 && ottoMagic !== "OTTO" && ottoMagic !== "true") {
        console.error(`[fonts] Skipping ${filename}: bad ttf magic (0x${magic.toString(16)}), file may be corrupt or HTML`);
        return false;
      }
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
 * Download all font files that are not already present on disk.
 * Runs once at startup, non-blocking (does not delay server start).
 */
const ensureFontsDownloaded = async () => {
  for (const [filename, sourceUrl] of Object.entries(FA_LOCAL_ASSETS)) {
    const destPath = path.join(FONTS_DIR, filename);
    if (fs.existsSync(destPath) && fs.statSync(destPath).size > 0) {
      console.log(`[fonts] Already have ${filename}, skipping download`);
      continue;
    }
    await downloadFont(filename, sourceUrl);
  }
  console.log("[fonts] Font cache check complete");
};

// Kick off font downloads in the background — server starts immediately
ensureFontsDownloaded().catch((err) =>
  console.error("[fonts] Startup font download error:", err)
);

// ---------------------------------------------------------------------------
// URL whitelist
// ---------------------------------------------------------------------------

const URL_WHITELIST = [
  "i.ytimg.com",
  "yt3.googleusercontent.com",
  "cdn.glitch.global",
  "cdn.glitch.me",
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
// Helper: spoofed headers
// ---------------------------------------------------------------------------

/**
 * Builds spoofed headers for hosts that require specific referrers/origins.
 * @param {string} host
 * @returns {Record<string, string>}
 */
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

// ---------------------------------------------------------------------------
// Helper: decompress
// ---------------------------------------------------------------------------

/**
 * Decompress a Buffer according to the Content-Encoding header value.
 * @param {Buffer} buf
 * @param {string|null} encoding
 * @returns {Promise<Buffer>}
 */
const decompress = (buf, encoding) => {
  return new Promise((resolve, reject) => {
    if (!encoding || encoding === "identity") return resolve(buf);
    if (encoding === "gzip") {
      return zlib.gunzip(buf, (err, result) => err ? reject(err) : resolve(result));
    }
    if (encoding === "deflate") {
      return zlib.inflate(buf, (err, result) => {
        if (err) {
          zlib.inflateRaw(buf, (err2, result2) => err2 ? reject(err2) : resolve(result2));
        } else {
          resolve(result);
        }
      });
    }
    if (encoding === "br") {
      return zlib.brotliDecompress(buf, (err, result) => err ? reject(err) : resolve(result));
    }
    resolve(buf);
  });
};

// ---------------------------------------------------------------------------
// Helper: fetch and forward
// ---------------------------------------------------------------------------

/**
 * Fetch a remote URL and pipe the decoded response to the Express response.
 * @param {string} targetUrl
 * @param {string} method
 * @param {express.Response} res
 */
const fetchAndForward = async (targetUrl, method, res) => {
  const { fetch } = await import("undici");
  const url = new URL(targetUrl);
  const spoofedHeaders = getSpoofedHeaders(url.host);

  console.log(`==> Fetching ${targetUrl}`);

  const f = await fetch(targetUrl, {
    method,
    headers: spoofedHeaders,
    redirect: "follow",
  });

  if (!f.ok) {
    console.log(`==> Upstream returned ${f.status} for ${url.host}`);
    return res.status(f.status).send(`Upstream error: ${f.status} ${f.statusText}`);
  }

  const rawBody = Buffer.from(await f.arrayBuffer());
  const encoding = f.headers.get("content-encoding");

  let body;
  try {
    body = await decompress(rawBody, encoding);
  } catch (decompErr) {
    console.log(`==> Decompression failed (${encoding}): ${decompErr}`);
    body = rawBody;
  }

  const headersToForward = ["content-type", "last-modified", "etag"];
  for (const header of headersToForward) {
    const value = f.headers.get(header);
    if (value) res.setHeader(header, value);
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

app.use(function (req, res, next) {
  console.log(`=> ${req.method} ${req.originalUrl}`);
  next();
});

app.use(function (_req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "public, max-age=864000");
  res.setHeader("poketube-cacher", "PROXY_FILES");
  next();
});

// ---------------------------------------------------------------------------
// Route: serve locally cached Font Awesome fonts
// ---------------------------------------------------------------------------
// Handles requests to /fonts/<filename> — these are the local URLs we
// substitute into the rewritten CSS.
app.get("/fonts/:filename", (req, res) => {
  const filename = req.params.filename;

  // Security: only allow known font filenames, no path traversal
  if (!Object.prototype.hasOwnProperty.call(FA_LOCAL_ASSETS, filename)) {
    return res.status(404).send("Font not found");
  }

  const filePath = path.join(FONTS_DIR, filename);

  if (!fs.existsSync(filePath) || fs.statSync(filePath).size === 0) {
    // File not yet downloaded — trigger download and return 503 so the browser retries
    downloadFont(filename, FA_LOCAL_ASSETS[filename]).catch(() => {});
    return res.status(503).send("Font is being downloaded, please retry shortly");
  }

  const ext = path.extname(filename).toLowerCase();
  const mime = FONT_MIME[ext] || "application/octet-stream";

  res.setHeader("Content-Type", mime);
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  res.sendFile(filePath);
});

// ---------------------------------------------------------------------------
// Route: Font Awesome CSS — fetch from archive and rewrite font URLs to /fonts/
// ---------------------------------------------------------------------------
// Handles:
//   /https://site-assets.fontawesome.com/releases/v6.1.1/css/all.css
// AND the Wayback Machine im_ variant that the archived CSS itself might embed:
//   /web/20260129053127im_/https://site-assets.fontawesome.com/releases/v6.1.1/css/all.css

const FA_CSS_HANDLER = async (req, res) => {
  try {
    const archiveUrl = `https://web.archive.org/web/${FA_TS}if_/https://site-assets.fontawesome.com/releases/v6.1.1/css/all.css`;

    console.log(`==> FA CSS: fetching ${archiveUrl}`);

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

    if (!f.ok) {
      return res.status(f.status).send(`Upstream error: ${f.status}`);
    }

    const rawBody = Buffer.from(await f.arrayBuffer());
    const encoding = f.headers.get("content-encoding");
    let cssText;
    try {
      cssText = (await decompress(rawBody, encoding)).toString("utf8");
    } catch (_) {
      cssText = rawBody.toString("utf8");
    }

    // Replace ALL Wayback Machine font URLs (any modifier: im_, if_, cs_, etc.)
    // AND any direct site-assets.fontawesome.com font URLs
    // with our local /fonts/<filename> paths.
    cssText = cssText.replace(
      /(?:https?:\/\/web\.archive\.org\/web\/\d{14}[a-z_]*\/)?(?:https?:\/\/)?site-assets\.fontawesome\.com\/releases\/v6\.1\.1\/webfonts\/(fa-[^"') ]+)/g,
      "/fonts/$1"
    );
    // Also rewrite root-relative Wayback paths like /web/20260129053127im_/https://site-assets...
    cssText = cssText.replace(
      /url\(\/web\/\d{14}[a-z_]*\/https:\/\/site-assets\.fontawesome\.com\/releases\/v6\.1\.1\/webfonts\/(fa-[^"') ]+)\)/g,
      "url(/fonts/$1)"
    );

    res.setHeader("Content-Type", "text/css; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=864000");
    res.removeHeader("content-encoding");
    res.setHeader("content-length", Buffer.byteLength(cssText, "utf8"));
    res.send(cssText);
  } catch (e) {
    console.log(`==> FA CSS handler error: ${e}`);
    res.status(500).send("Internal server error");
  }
};

// Direct proxy path: /https://site-assets.fontawesome.com/releases/v6.1.1/css/all.css
app.get(/^\/https:\/\/site-assets\.fontawesome\.com\/releases\/v6\.1\.1\/css\/all\.css/, FA_CSS_HANDLER);

// Wayback im_ path the browser might request directly
app.get(/^\/web\/\d{14}[a-z_]*\/https:\/\/site-assets\.fontawesome\.com\/releases\/v6\.1\.1\/css\/all\.css/, FA_CSS_HANDLER);

// ---------------------------------------------------------------------------
// Route: Wayback Machine font intercept (im_ / any modifier)
// ---------------------------------------------------------------------------
// Catches:  /web/20260129053127im_/https://site-assets.fontawesome.com/releases/v6.1.1/webfonts/fa-solid-900.woff2
// Redirects to the local /fonts/ cache so we never hit the archive again.
app.get(/^\/web\/\d{14}[a-z_]*\/https:\/\/site-assets\.fontawesome\.com\/releases\/v6\.1\.1\/webfonts\/(.+)$/, (req, res) => {
  const filename = req.params[0]; // captured group: e.g. "fa-solid-900.woff2"

  if (!Object.prototype.hasOwnProperty.call(FA_LOCAL_ASSETS, filename)) {
    return res.status(404).send("Font not found");
  }

  // Redirect to local /fonts/ — browser will cache the 301 so it never asks again
  res.redirect(301, `/fonts/${filename}`);
});

// ---------------------------------------------------------------------------
// Route: index
// ---------------------------------------------------------------------------

app.get("/", (req, res) => {
  res.json({
    status: "200",
    version: "1.3.332a-b3-9e",
    URL_WHITELIST,
    cache: "max-age-864000",
  });
});

// ---------------------------------------------------------------------------
// Route: YouTube engagement API with fallback chain
// ---------------------------------------------------------------------------

const apiUrls = [
  "https://returnyoutubedislikeapi.com/votes?videoId=",
  "https://prod-poketube.testing.poketube.fun/api?v=",
  "https://ipv6-t.poketube.fun/api?v=",
];

const cache = {};

app.get("/api", async (req, res) => {
  const { fetch } = await import("undici");

  try {
    const cacheKey = req.query.v;

    if (cache[cacheKey] && Date.now() - cache[cacheKey].timestamp < 3600000) {
      return res.json(cache[cacheKey].data);
    }

    const errors = [];
    for (const apiUrl of apiUrls) {
      try {
        const engagement = await fetch(apiUrl + req.query.v).then((r) => r.json());
        cache[cacheKey] = { data: engagement, timestamp: Date.now() };
        return res.json(engagement);
      } catch (err) {
        console.log(`Error fetching data from ${apiUrl}: ${err.message}`);
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
  let f = await fetch("https://lite.duckduckgo.com/lite/?q=" + req.query.q, {
    method: req.method,
  });
  res.redirect(f);
});

// ---------------------------------------------------------------------------
// Route: generic proxy catch-all
// ---------------------------------------------------------------------------

const proxy = async (req, res) => {
  res.setHeader("Cache-Control", "public, max-age=864000");

  try {
    let rawUrl = "https://" + req.originalUrl.slice(8);

    if (rawUrl.includes("cdn.glitch.global")) {
      rawUrl = rawUrl.replace("cdn.glitch.global", "cdn.glitch.me");
    }

    let url;
    try {
      url = new URL(rawUrl);
    } catch (e) {
      console.log("==> Cannot parse URL: " + e);
      return res.status(400).send("Malformed URL");
    }

    if (!URL_WHITELIST.includes(url.host) && !rawUrl.includes("cdn.glitch.me")) {
      console.log(`==> Refusing to proxy host ${url.host}`);
      return res.status(401).send(`Hostname '${url.host}' is not permitted`);
    }

    const fetchUrl =
      url.host === "web.archive.org"
        ? rawUrl
        : rawUrl + `?cachefixer=${btoa(Date.now())}`;

    await fetchAndForward(fetchUrl, req.method, res);
  } catch (e) {
    console.log(`==> Error: ${e}`);
    res.status(500).send("Internal server error");
  }
};

app.all("/*", (req, res) => proxy(req, res));

app.listen(6014, () => console.log("Listening on 0.0.0.0:6014"));