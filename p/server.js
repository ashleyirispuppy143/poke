const express = require("express");
const fetch = require("node-fetch");
const { URL } = require("url");
const { Readable } = require("node:stream");
const zlib = require("zlib");

// Array of hostnames that will be proxied
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

// Timestamp to use for all Font Awesome Wayback Machine snapshots.
// The `if_` modifier tells the Wayback Machine to return the raw archived file
// without injecting its toolbar HTML/JS — critical for binary font files.
const FA_TS = "20260129053127";

// All known Font Awesome v6.1.1 webfont filenames
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

// Lookup map: FA asset path -> canonical Wayback Machine if_ URL
const FONTAWESOME_ARCHIVE_MAP = {
  "/releases/v6.1.1/css/all.css": `https://web.archive.org/web/${FA_TS}if_/https://site-assets.fontawesome.com/releases/v6.1.1/css/all.css`,
};
for (const font of FA_WEBFONTS) {
  const path = `/releases/v6.1.1/webfonts/${font}`;
  FONTAWESOME_ARCHIVE_MAP[path] = `https://web.archive.org/web/${FA_TS}if_/https://site-assets.fontawesome.com${path}`;
}

/**
 * Rewrite Font Awesome URLs to their correct Wayback Machine if_ equivalents.
 *
 * Three cases:
 *
 * 1. Direct request to site-assets.fontawesome.com
 *    → rewrite to web.archive.org/web/<TS>if_/...
 *
 * 2. The archived CSS rewrites its own font src() URLs to Wayback Machine
 *    paths with the `im_` modifier (image mode), e.g.:
 *      /web/20260129053127im_/https://site-assets.fontawesome.com/.../fa-solid-900.woff2
 *    These arrive at our proxy as GET /web/... and 404 because we don't handle
 *    that path prefix. We intercept and rewrite im_ → if_ so the binary is
 *    fetched correctly.
 *
 * 3. Any other web.archive.org URL that contains site-assets.fontawesome.com
 *    but is not already using if_ — normalise it to if_.
 *
 * @param {string} rawUrl
 * @returns {string} possibly-rewritten URL
 */
const rewriteFontAwesomeUrl = (rawUrl) => {
  // Case 1: direct hit on site-assets.fontawesome.com
  if (rawUrl.includes("site-assets.fontawesome.com") && !rawUrl.includes("web.archive.org")) {
    const clean = rawUrl.split("?")[0];
    let pathname = "";
    try {
      pathname = new URL(clean).pathname;
    } catch (_) {}
    if (FONTAWESOME_ARCHIVE_MAP[pathname]) {
      return FONTAWESOME_ARCHIVE_MAP[pathname];
    }
    // Unknown path — still serve from archive with if_
    return `https://web.archive.org/web/${FA_TS}if_/https://site-assets.fontawesome.com${pathname}`;
  }

  // Case 2 & 3: already a web.archive.org URL referencing FA — ensure if_ not im_/cs_/js_/etc.
  if (rawUrl.includes("web.archive.org") && rawUrl.includes("site-assets.fontawesome.com")) {
    // Replace any WBM modifier (im_, cs_, js_, fw_, mp_, oe_, or none) with if_
    return rawUrl.replace(
      /(\/web\/\d{14})((?:im_|cs_|js_|fw_|mp_|oe_)?)\//,
      `$1if_/`
    );
  }

  return rawUrl;
};

/**
 * Builds spoofed headers for hosts that require specific referrers/origins.
 * @param {string} host
 * @returns {Record<string, string>}
 */
const getSpoofedHeaders = (host) => {
  if (host === "web.archive.org") {
    return {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Accept": "*/*",
      "Accept-Language": "en-US,en;q=0.9",
      // Request plain encoding — prevents receiving zstd or other encodings
      // that Node's http stack cannot handle natively.
      "Accept-Encoding": "identity",
      "Referer": "https://web.archive.org/",
    };
  }

  if (host === "site-assets.fontawesome.com") {
    return {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
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

  // Default headers for all other proxied hosts
  return {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "*/*",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "identity",
  };
};

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(function (req, res, next) {
  console.log(`=> ${req.method} ${req.originalUrl.slice(1)}`);
  next();
});

app.use(function (_req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "public, max-age=864000");
  res.setHeader("poketube-cacher", "PROXY_FILES");
  next();
});

/**
 * Decompress a Buffer according to the Content-Encoding header value.
 * Returns the original buffer unchanged if encoding is identity/unknown.
 * @param {Buffer} buf
 * @param {string|null} encoding
 * @returns {Promise<Buffer>}
 */
const decompress = (buf, encoding) => {
  return new Promise((resolve, reject) => {
    if (!encoding || encoding === "identity") {
      return resolve(buf);
    }
    if (encoding === "gzip") {
      return zlib.gunzip(buf, (err, result) =>
        err ? reject(err) : resolve(result)
      );
    }
    if (encoding === "deflate") {
      return zlib.inflate(buf, (err, result) => {
        if (err) {
          // Some servers send raw deflate without the zlib wrapper
          zlib.inflateRaw(buf, (err2, result2) =>
            err2 ? reject(err2) : resolve(result2)
          );
        } else {
          resolve(result);
        }
      });
    }
    if (encoding === "br") {
      return zlib.brotliDecompress(buf, (err, result) =>
        err ? reject(err) : resolve(result)
      );
    }
    // Unknown encoding — pass through and hope for the best
    resolve(buf);
  });
};

/**
 * @param {express.Request} req
 * @param {express.Response} res
 */
const proxy = async (req, res) => {
  const { fetch } = await import("undici");
  res.setHeader("Cache-Control", "public, max-age=864000");

  try {
    let rawUrl = "https://" + req.originalUrl.slice(8);

    if (rawUrl.includes("cdn.glitch.global")) {
      rawUrl = rawUrl.replace("cdn.glitch.global", "cdn.glitch.me");
    }

    // Rewrite Font Awesome URLs (and broken im_ archive URLs) to if_ snapshots
    rawUrl = rewriteFontAwesomeUrl(rawUrl);

    let url;
    try {
      url = new URL(rawUrl);
    } catch (e) {
      console.log("==> Cannot parse URL: " + e);
      return res.status(400).send("Malformed URL");
    }

    if (
      !URL_WHITELIST.includes(url.host) &&
      !rawUrl.includes("cdn.glitch.me")
    ) {
      console.log(`==> Refusing to proxy host ${url.host}`);
      res.status(401).send(`Hostname '${url.host}' is not permitted`);
      return;
    }

    const spoofedHeaders = getSpoofedHeaders(url.host);

    // Do not append cachefixer to Wayback Machine URLs — it would corrupt
    // their URL structure and result in a 404.
    const fetchUrl =
      url.host === "web.archive.org"
        ? rawUrl
        : rawUrl + `?cachefixer=${btoa(Date.now())}`;

    console.log(`==> Proxying request to ${url.host} — ${fetchUrl}`);

    const f = await fetch(fetchUrl, {
      method: req.method,
      headers: spoofedHeaders,
      redirect: "follow",
    });

    if (!f.ok) {
      console.log(`==> Upstream returned ${f.status} for ${url.host}`);
      return res
        .status(f.status)
        .send(`Upstream error: ${f.status} ${f.statusText}`);
    }

    // Buffer the full response body so we can decompress it before forwarding.
    // This prevents the browser from receiving a Content-Encoding it cannot
    // handle (e.g. when upstream sends gzip but our proxy strips the header).
    const rawBody = Buffer.from(await f.arrayBuffer());
    const encoding = f.headers.get("content-encoding");

    let body;
    try {
      body = await decompress(rawBody, encoding);
    } catch (decompErr) {
      console.log(`==> Decompression failed (${encoding}): ${decompErr}`);
      body = rawBody;
    }

    // Forward safe response headers, but always strip Content-Encoding
    // because we have already decoded the body above.
    const headersToForward = ["content-type", "last-modified", "etag"];
    for (const header of headersToForward) {
      const value = f.headers.get(header);
      if (value) {
        res.setHeader(header, value);
      }
    }

    // Strip Content-Encoding — body is already decoded
    res.removeHeader("content-encoding");
    // Set accurate Content-Length for the decoded body
    res.setHeader("content-length", body.length);

    res.send(body);
  } catch (e) {
    console.log(`==> Error: ${e}`);
    res.status(500).send("Internal server error");
  }
};

const listener = (req, res) => {
  proxy(req, res);
};

app.get("/", (req, res) => {
  var json = {
    status: "200",
    version: "1.3.332a-b3-9e",
    URL_WHITELIST,
    cache: "max-age-864000",
  };
  res.json(json);
});

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
        const engagement = await fetch(apiUrl + req.query.v).then((res) =>
          res.json()
        );

        cache[cacheKey] = {
          data: engagement,
          timestamp: Date.now(),
        };

        res.json(engagement);
        return;
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

app.get("/bangs", async (req, res) => {
  let f = await fetch("https://lite.duckduckgo.com/lite/?q=" + req.query.q, {
    method: req.method,
  });

  res.redirect(f);
});

app.all("/*", listener);

app.listen(6014, () => console.log("Listening on 0.0.0.0:6014"));