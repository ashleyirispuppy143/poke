const express = require("express");
const fetch = require("node-fetch");
const { URL } = require("url");
const zlib = require("zlib");
const fs = require("fs");
const path = require("path");
const dns = require("dns");
 

const SmartIPadressProxy = {
   enabled: true,
   forceFamily: null,
   autoSelectFamily: true,
  autoSelectFamilyAttemptTimeout: 250,
   connectTimeout: 10000,
   rememberBrokenIpv6: true,
  cooldownMs: 10 * 60 * 1000, 
};

const smartIpState = {
  ipv6BrokenUntil: 0,
  dualStackAgent: null,
  ipv4Agent: null,
  ipv6Agent: null,
};

/**
 * Checks whether an error (or any nested cause / AggregateError sub-error)
 * was caused by an unreachable or broken IPv6 network route.
 * @param {any} err
 * @returns {boolean}
 */
const isIpv6RoutingError = (err) => {
  if (!err) return false;
  const ipv6ErrorCodes = new Set([
    "EHOSTUNREACH",
    "ENETUNREACH",
    "EADDRNOTAVAIL",
    "EAFNOSUPPORT",
    "UND_ERR_CONNECT_TIMEOUT",
  ]);

  let cur = err;
  let depth = 0;
  while (cur && depth < 6) {
    depth++;
    const isV6Addr = typeof cur.address === "string" && cur.address.includes(":");
    if (ipv6ErrorCodes.has(cur.code) && (isV6Addr || cur.code === "EAFNOSUPPORT" || cur.code === "ENETUNREACH")) {
      return true;
    }
    if (typeof cur.message === "string" && /EHOSTUNREACH|ENETUNREACH|2001:|2606:|2607:|2a00:|::/i.test(cur.message)) {
      return true;
    }
    if (Array.isArray(cur.errors)) {
      for (const sub of cur.errors) {
        if (isIpv6RoutingError(sub)) return true;
      }
    }
    cur = cur.cause;
  }
  return false;
};

/**
 * Automatically uses IPv6 when available and falls back to IPv4 if needed.
 */
const getUndiciFetch = async () => {
  const undici = await import("undici");

  if (!smartIpState.dualStackAgent) {
    smartIpState.dualStackAgent = new undici.Agent({
      connect: {
        autoSelectFamily: SmartIPadressProxy.autoSelectFamily,
        autoSelectFamilyAttemptTimeout: SmartIPadressProxy.autoSelectFamilyAttemptTimeout,
        timeout: SmartIPadressProxy.connectTimeout,
      },
    });
    smartIpState.ipv4Agent = new undici.Agent({
      connect: {
        family: 4,
        timeout: SmartIPadressProxy.connectTimeout,
      },
    });
    smartIpState.ipv6Agent = new undici.Agent({
      connect: {
        family: 6,
        timeout: SmartIPadressProxy.connectTimeout,
      },
    });
  }

  return async (url, opts = {}) => {
    // 1. If smart proxy is disabled, use standard undici fetch
    if (!SmartIPadressProxy.enabled) {
      return undici.fetch(url, opts);
    }

    // 2. Respect explicit forceFamily override if set (4 or 6)
    if (SmartIPadressProxy.forceFamily === 4) {
      return undici.fetch(url, { ...opts, dispatcher: smartIpState.ipv4Agent });
    }
    if (SmartIPadressProxy.forceFamily === 6) {
      return undici.fetch(url, { ...opts, dispatcher: smartIpState.ipv6Agent });
    }

     const now = Date.now();
    if (SmartIPadressProxy.rememberBrokenIpv6 && now < smartIpState.ipv6BrokenUntil) {
      return undici.fetch(url, { ...opts, dispatcher: smartIpState.ipv4Agent });
    }

     try {
      return await undici.fetch(url, { ...opts, dispatcher: smartIpState.dualStackAgent });
    } catch (err) {
      if (isIpv6RoutingError(err)) {
        console.warn(`[SmartIPadressProxy] IPv6 unreachable for ${url}, falling back to IPv4...`);
        if (SmartIPadressProxy.rememberBrokenIpv6) {
          smartIpState.ipv6BrokenUntil = Date.now() + SmartIPadressProxy.cooldownMs;
          console.warn(
            `[SmartIPadressProxy] Caching IPv4-preferred mode for ${Math.round(SmartIPadressProxy.cooldownMs / 1000)}s`
          );
        }
        return await undici.fetch(url, { ...opts, dispatcher: smartIpState.ipv4Agent });
      }
      throw err;
    }
  };
};

/**
 * Formats an Error (including undici's nested `err.cause` and AggregateError)
 * into a detailed, human-readable string showing error codes, syscalls, IPs, etc.
 * @param {any} err
 * @returns {string}
 */
const formatError = (err) => {
  if (!err) return "Unknown error";
  const parts = [err.stack || `${err.name}: ${err.message}`];

  let cause = err.cause;
  let depth = 0;
  while (cause && depth < 5) {
    depth++;
    const details = [];
    if (cause.code) details.push(`code=${cause.code}`);
    if (cause.errno) details.push(`errno=${cause.errno}`);
    if (cause.syscall) details.push(`syscall=${cause.syscall}`);
    if (cause.hostname) details.push(`host=${cause.hostname}`);
    if (cause.address) details.push(`addr=${cause.address}`);
    if (cause.port) details.push(`port=${cause.port}`);

    const detailStr = details.length ? ` (${details.join(", ")})` : "";
    parts.push(`  [Cause #${depth}] ${cause.name || "Error"}: ${cause.message}${detailStr}`);

    // Handle AggregateError (e.g., Happy Eyeballs IPv4 + IPv6 connection failures)
    if (Array.isArray(cause.errors)) {
      cause.errors.forEach((subErr, idx) => {
        const subDetails = [];
        if (subErr.code) subDetails.push(`code=${subErr.code}`);
        if (subErr.syscall) subDetails.push(`syscall=${subErr.syscall}`);
        if (subErr.address) subDetails.push(`addr=${subErr.address}`);
        if (subErr.port) subDetails.push(`port=${subErr.port}`);
        const subStr = subDetails.length ? ` (${subDetails.join(", ")})` : "";
        parts.push(`    -> [SubError #${idx + 1}] ${subErr.message || subErr}${subStr}`);
      });
    }

    cause = cause.cause;
  }

  return parts.join("\n");
};

/**
 * Extract just the error code (e.g., UND_ERR_CONNECT_TIMEOUT) for a concise detail block.
 * @param {any} err
 * @returns {string}
 */
const getErrorSummary = (err) => {
  if (!err) return "UNKNOWN_ERROR";
  const cause = err.cause || err;

  if (Array.isArray(cause.errors) && cause.errors.length > 0) {
    const codes = cause.errors.map((e) => e.code || e.name || "ERROR").join(", ");
    return cause.code ? `${cause.code} (${codes})` : codes;
  }

  return cause.code || cause.name || "UNKNOWN_ERROR";
};

/**
 * Escapes HTML special characters to prevent XSS in error pages.
 * @param {string} str
 * @returns {string}
 */
const escapeHtml = (str) =>
  String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const sendErrorPage = (res, status, statusText, messageHtml, detailText = "") => {
  const detailBlock = detailText
    ? `<div class="err-detail"><code>${escapeHtml(detailText)}</code></div>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="initial-scale=1, minimum-scale=1, width=device-width">
  <title>Error ${status} (${escapeHtml(statusText)})!!1</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, code { font: 15px/22px arial, sans-serif; }
    
    html {
      background: #0f0f12;
      color: #e4e4e7;
      color-scheme: dark;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
    }
    
    body {
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: center;
      gap: 50px;
      padding: 30px;
      width: 100%;
      max-width: 750px;
    }
    
    .error-container {
      flex: 1;
      max-width: 440px;
    }
    
    .mascot-container {
      flex-shrink: 0;
      width: 160px;
      height: 30em;
      background: url('https://poketube.fun/static/poke-mascot-new.webp?v=78') no-repeat center center / contain;
    }

    p {
      margin: 11px 0 22px;
      overflow-wrap: break-word;
      word-break: break-word;
    }
    ins {
      color: #9ca3af;
      text-decoration: none;
    }
    code {
      background: #1a1a22;
      color: #f472b6;
      padding: 2px 5px;
      border-radius: 4px;
      border: 1px solid #272732;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 13px;
    }
    .err-detail {
      margin: -10px 0 18px;
    }
    .err-detail code {
      display: inline-block;
      color: #a1a1aa;
      background: #14141b;
      border-color: #262630;
      font-size: 12px;
      line-height: 18px;
      padding: 4px 8px;
      word-break: break-all;
    }
    a { color: #60a5fa; text-decoration: none; }
    a img { border: 0; }
    
    #logo {
      display: inline-block;
      height: 54px;
      width: 165px;
      background: url('https://poketube.fun/css/logo-poke.svg?v=78') no-repeat 0% 50% / contain;
      margin-left: -2px;
      margin-bottom: 4px;
    }
    
    @media screen and (max-width: 772px) {
      body {
        flex-direction: column-reverse;
        text-align: center;
        gap: 20px;
      }
      #logo {
        background-position: center;
        margin-left: 0;
      }
      .mascot-container {
        margin-bottom: 10px;
      }
    }
  </style>
</head>
<body>
  <div class="error-container">
    <a href="https://poketube.fun/"><span id="logo" aria-label="PokeTube"></span></a>
    <p><b>${status}.</b> <ins>That’s an error.</ins></p>
    <p>${messageHtml} <ins>That’s all we know.</ins></p>
    ${detailBlock}
  </div>
  
  <div class="mascot-container" aria-hidden="true"></div>
</body>
</html>`;

  res.status(status);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.send(html);
};

 
const FONTS_DIR = path.join(__dirname, "fonts");
if (!fs.existsSync(FONTS_DIR)) {
  fs.mkdirSync(FONTS_DIR, { recursive: true });
}

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

const FONT_MIME = {
  ".woff2": "font/woff2",
  ".ttf":   "font/ttf",
  ".woff":  "font/woff",
  ".eot":   "application/vnd.ms-fontobject",
};

let FA_CSS_CACHE = null;
const cdxTimestampCache = {};
 
const findArchiveTimestamp = async (assetUrl) => {
  if (cdxTimestampCache[assetUrl]) {
    return cdxTimestampCache[assetUrl];
  }

  const uFetch = await getUndiciFetch();
  const cdxUrl =
    `https://web.archive.org/cdx/search/cdx` +
    `?url=${encodeURIComponent(assetUrl)}` +
    `&output=json&limit=1&fl=timestamp,statuscode` +
    `&filter=statuscode:200&from=20220101&fastLatest=true`;

  try {
    const res = await uFetch(cdxUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; poketube-proxy/1.0)",
        "Accept": "application/json",
        "Accept-Encoding": "identity",
      },
      redirect: "follow",
    });
    if (!res.ok) return null;
    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length < 2) return null;
    const ts = rows[1][0];
    cdxTimestampCache[assetUrl] = ts;
    return ts;
  } catch (err) {
    console.error(`[fonts] CDX lookup failed for ${assetUrl}:\n${formatError(err)}`);
    return null;
  }
};

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

const downloadFont = async (filename) => {
  const uFetch = await getUndiciFetch();
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
    const res = await uFetch(archiveUrl, {
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
    console.error(`[fonts] Error downloading ${filename}:\n${formatError(err)}`);
    return false;
  }
};

const rewriteCssFontUrls = (css) => {
  css = css.replace(/\/\*[\s\S]*?FILE ARCHIVED ON[\s\S]*?\*\//g, "");
  css = css.replace(/\/\*\s*playback timings[\s\S]*?\*\//gi, "");
  css = css.replace(
    /(?:(?:https?:\/\/web\.archive\.org)?\/web\/\d{14}[a-z_]*\/)?(?:https?:\/\/)?site-assets\.fontawesome\.com\/releases\/v6\.1\.1\/webfonts\/(fa-[\w-]+\.(?:woff2|ttf|woff|eot))/g,
    "/fonts/$1"
  );
  return css.trim();
};

const FA_CSS_DISK_PATH = path.join(__dirname, "fonts", "all.css");

let cssLoadPromise = null;
const loadCss = () => {
  if (FA_CSS_CACHE !== null) return Promise.resolve(FA_CSS_CACHE);

  if (fs.existsSync(FA_CSS_DISK_PATH) && fs.statSync(FA_CSS_DISK_PATH).size > 100) {
    try {
      FA_CSS_CACHE = fs.readFileSync(FA_CSS_DISK_PATH, "utf8");
      console.log(`[css] Loaded FA CSS from disk cache (${Buffer.byteLength(FA_CSS_CACHE, "utf8")} bytes)`);
      return Promise.resolve(FA_CSS_CACHE);
    } catch (e) {
      console.warn(`[css] Failed to read disk cache, will re-fetch: ${e.message}`);
    }
  }

  if (cssLoadPromise) return cssLoadPromise;

  cssLoadPromise = (async () => {
    try {
      const cssOriginalUrl = "https://site-assets.fontawesome.com/releases/v6.1.1/css/all.css";

      let cssTimestamp = await findArchiveTimestamp(cssOriginalUrl);
      if (!cssTimestamp) {
        cssTimestamp = "20260310233449";
      }

      const archiveUrl = `https://web.archive.org/web/${cssTimestamp}if_/${cssOriginalUrl}`;
      console.log(`[css] Fetching FA CSS from ${archiveUrl}`);

      const uFetch = await getUndiciFetch();
      const f = await uFetch(archiveUrl, {
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

      try {
        fs.writeFileSync(FA_CSS_DISK_PATH, cssText, "utf8");
        console.log(`[css] FA CSS saved to disk (${Buffer.byteLength(cssText, "utf8")} bytes)`);
      } catch (e) {
        console.warn(`[css] Could not write CSS to disk: ${e.message}`);
      }

      FA_CSS_CACHE = cssText;
      return cssText;
    } finally {
      cssLoadPromise = null;
    }
  })();

  return cssLoadPromise;
};

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

Promise.all([
  ensureFontsDownloaded(),
  loadCss(),
]).catch((err) => console.error(`[startup] Background init error:\n${formatError(err)}`));

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
  "lh3.googleusercontent.com",
  "is4-ssl.mzstatic.com",
  "is2-ssl.mzstatic.com",
  "fonts.googleapis.com",
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
  "vid.puffyan.us",
  "web.archive.org",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const extractTargetUrl = (originalUrl) => {
  let cleaned = originalUrl.replace(/^\/+/, "");
  if (/^https?:\/+/i.test(cleaned)) {
    cleaned = cleaned.replace(/^(https?):\/+/i, "$1://");
  } else {
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

const fetchAndForward = async (targetUrl, displayUrl, method, res) => {
  const uFetch = await getUndiciFetch();
  const url = new URL(targetUrl);
  const headers = getSpoofedHeaders(url.host);

  console.log(`==> Fetching ${targetUrl}`);
  let f;
  try {
    f = await uFetch(targetUrl, { method, headers, redirect: "follow" });
  } catch (err) {
    console.error(`==> Fetch failed for ${targetUrl}:\n${formatError(err)}`);
    throw err;
  }

  if (!f.ok) {
    console.log(`==> Upstream returned ${f.status} for ${url.host}`);
    return sendErrorPage(
      res,
      f.status,
      f.statusText || "Upstream Error",
      `The requested URL <code>${escapeHtml(displayUrl)}</code> returned an error from the upstream server (<code>${escapeHtml(url.host)}</code>).`,
      `Upstream HTTP ${f.status} ${f.statusText || ""}`.trim()
    );
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
    return sendErrorPage(
      res,
      404,
      "Not Found",
      `The requested URL <code>${escapeHtml(req.originalUrl)}</code> was not found on this server.`
    );
  }

  const filePath = path.join(FONTS_DIR, filename);

  if (!fs.existsSync(filePath) || fs.statSync(filePath).size < 100) {
    downloadFont(filename).catch(() => {});
    res.setHeader("Retry-After", "5");
    return sendErrorPage(
      res,
      503,
      "Service Unavailable",
      `The requested font <code>${escapeHtml(filename)}</code> is currently being downloaded. Please retry in a moment.`
    );
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
    const displayUrl = extractTargetUrl(req.originalUrl);
    console.error(`==> FA CSS handler error:\n${formatError(e)}`);
    return sendErrorPage(
      res,
      500,
      "Internal Server Error",
      `The server encountered an error while loading <code>${escapeHtml(displayUrl)}</code>.`,
      getErrorSummary(e)
    );
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
      return sendErrorPage(
        res,
        404,
        "Not Found",
        `The requested URL <code>${escapeHtml(extractTargetUrl(req.originalUrl))}</code> was not found on this server.`
      );
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
    SmartIPadressProxy: {
      enabled: SmartIPadressProxy.enabled,
      forceFamily: SmartIPadressProxy.forceFamily,
      activeMode:
        SmartIPadressProxy.forceFamily === 4
          ? "ipv4-forced"
          : SmartIPadressProxy.forceFamily === 6
          ? "ipv6-forced"
          : Date.now() < smartIpState.ipv6BrokenUntil
          ? "ipv4-fallback-active"
          : "dual-stack-ipv6-preferred",
    },
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
  const uFetch = await getUndiciFetch();
  try {
    const cacheKey = req.query.v;
    if (apiCache[cacheKey] && Date.now() - apiCache[cacheKey].timestamp < 3600000) {
      return res.json(apiCache[cacheKey].data);
    }
    const errors = [];
    for (const apiUrl of apiUrls) {
      try {
        const engagement = await uFetch(apiUrl + req.query.v).then((r) => r.json());
        apiCache[cacheKey] = { data: engagement, timestamp: Date.now() };
        return res.json(engagement);
      } catch (err) {
        console.error(`Error fetching from ${apiUrl}:\n${formatError(err)}`);
        errors.push(`${apiUrl}: ${err.cause ? `${err.cause.code || err.cause.message}` : err.message}`);
      }
    }
    res.status(500).json({ error: "All API endpoints failed", errors });
  } catch (err) {
    console.error(`==> /api error:\n${formatError(err)}`);
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
  const rawUrl = extractTargetUrl(req.originalUrl);

  try {
    let url;
    try {
      url = new URL(rawUrl);
    } catch (e) {
      console.log("==> Cannot parse URL: " + e);
      return sendErrorPage(
        res,
        400,
        "Bad Request",
        `Your client has issued a malformed or illegal request for URL <code>${escapeHtml(rawUrl)}</code>.`
      );
    }

    if (!URL_WHITELIST.includes(url.host)) {
      console.log(`==> Refusing to proxy host ${url.host}`);
      return sendErrorPage(
        res,
        403,
        "Forbidden",
        `The requested hostname <code>${escapeHtml(url.host)}</code> is not permitted on this proxy server.`
      );
    }

    if (url.host !== "web.archive.org") {
      url.searchParams.set("cachefixer", Buffer.from(String(Date.now())).toString("base64"));
    }

    await fetchAndForward(url.toString(), rawUrl, req.method, res);
  } catch (e) {
    console.error(`==> Proxy Error for ${rawUrl}:\n${formatError(e)}`);
    return sendErrorPage(
      res,
      502,
      "Bad Gateway",
      `The proxy server could not fetch the requested URL <code>${escapeHtml(rawUrl)}</code>.`,
      getErrorSummary(e)
    );
  }
};

app.all("/*", (req, res) => proxy(req, res));

app.listen(6014, () => console.log("Listening on 0.0.0.0:6014"));