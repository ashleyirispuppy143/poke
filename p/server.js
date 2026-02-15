const express = require("express");
const fetch = require("node-fetch");
const { URL } = require("url");
const { Readable } = require("node:stream");

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
];

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

    let url;
    try {
      url = new URL(rawUrl);
    } catch (e) {
      console.log("==> Cannot parse URL: " + e);
      return res.status(400).send("Malformed URL");
    }

    if (!URL_WHITELIST.includes(url.host) && !rawUrl.includes("cdn.glitch.me")) {
      console.log(`==> Refusing to proxy host ${url.host}`);
      res.status(401).send(`Hostname '${url.host}' is not permitted`);
      return;
    }

    console.log(`==> Proxying request`);
    let f = await fetch(rawUrl + `?cachefixer=${btoa(Date.now())}`, {
      method: req.method,
    });

    Readable.fromWeb(f.body).pipe(res);
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
