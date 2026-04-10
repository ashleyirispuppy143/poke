/*

    Poke is an Free/Libre youtube front-end. this is our main file.
  
    Copyright (C) 2021-2025 Poke (https://codeberg.org/ashleyirispuppy/poke)
    
    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.
    
    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program. If not, see https://www.gnu.org/licenses/.
  */
(async function () {
  const {
    fetcher,
    core,
    wiki,
    musicInfo,
    modules,
    version,
    initlog,
    init,
  } = require("./src/libpoketube/libpoketube-initsys.js");
  const media_proxy = require("./src/libpoketube/libpoketube-video.js");
  const { sinit } = require("./src/libpoketube/init/superinit.js");
  const innertube = require("./src/libpoketube/libpoketube-youtubei-objects.json");
  const fs = require("fs");
  const config = require("./config.json");
  const u = await media_proxy();

  fs.readFile("ascii_txt.txt", "utf8", (err, data) => {
    if (err) {
      console.error("Error reading the file:", err);
      return;
    }

    console.log(data);
  });
  initlog("Loading. everything... ever....");
  initlog(
    "[Welcome] Welcome To Poke, where you can LIBERATE THE WEB! - :3 " +
      "Running " +
      `Node ${process.version} - V8 v${
        process.versions.v8
      } -  ${process.platform.replace("linux", "GNU/Linux")} ${
        process.arch
      } Server - libpt ${version}`
  );

  const {
    IsJsonString,
    convert,
    getFirstLine,
    capitalizeFirstLetter,
    turntomins,
    getRandomInt,
    getRandomArbitrary,
  } = require("./src/libpoketube/ptutils/libpt-coreutils.js");
  const { ieBlockMiddleware } = require("./src/libpoketube/ptutils/ie-blocker.js");
  initlog("Loaded libpt-coreutils and ieBlockMiddleware");

  const templateDir = modules.path.resolve(
    `${process.cwd()}${modules.path.sep}html`
  );

  const sha384 = modules.hash;

  var app = modules.express();

/*
 * poke trust proxy auto-config
 *
 * this has to run BEFORE the rate limiter or anything that touches req.ip,
 * otherwise express-rate-limit freaks out about x-forwarded-for headers
 * when trust proxy is still false. we learned that the hard way lol
 *
 * it figures out if we're behind a reverse proxy by checking env vars,
 * docker/k8s files, and network interfaces. if it cant tell at startup,
 * it sniffs the first actual request to see if proxy headers show up.
 *
 * even when enabled it ONLY trusts private/local IPs (10.x, 172.x, 192.168.x etc)
 * so nobody on the public internet can spoof x-forwarded-for at the tcp level.
 *
 * you can also just set TRUST_PROXY in your env/.env to force it on or off.
 */
(function configureTrustProxy() {
  const os = require("os");
  const net = require("net");
  const path = require("path");

  // try loading .env if it exists, no big deal if it doesnt
  const dotenvPath = path.resolve(process.cwd(), ".env");

  try {
    fs.accessSync(dotenvPath, fs.constants.F_OK);
    try {
      require("dotenv").config({ path: dotenvPath });
      initlog("[POKE-trust-proxy] found .env, loaded it");
    } catch (e) {
      // dotenv package isnt installed, just parse it ourselves
      initlog("[POKE-trust-proxy] .env exists but no dotenv package, parsing manually");
      try {
        const raw = fs.readFileSync(dotenvPath, "utf8");
        for (const line of raw.split("\n")) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith("#")) continue;
          const eq = trimmed.indexOf("=");
          if (eq === -1) continue;
          const key = trimmed.slice(0, eq).trim();
          let val = trimmed.slice(eq + 1).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          if (!process.env[key]) process.env[key] = val;
        }
        initlog("[POKE-trust-proxy] .env parsed ok");
      } catch (readErr) {
        initlog("[POKE-trust-proxy] couldnt read .env: " + readErr.message);
      }
    }
  } catch {
    initlog("[POKE-trust-proxy] no .env file, thats fine");
  }

  // ip math stuff for checking if an ip is in a cidr range
  function ipToLong(ip) {
    return ip.split(".").reduce((acc, oct) => (acc << 8) + parseInt(oct, 10), 0) >>> 0;
  }

  function cidrContains(cidr, ip) {
    if (!net.isIPv4(ip)) return false;
    const [subnet, bits] = cidr.split("/");
    const mask = ~(2 ** (32 - parseInt(bits, 10)) - 1) >>> 0;
    return (ipToLong(ip) & mask) === (ipToLong(subnet) & mask);
  }

  function isPrivateIP(ip) {
    if (net.isIPv6(ip)) {
      return /^(::1|fe80:|fc00:|fd00:|::ffff:((10\.)|(172\.(1[6-9]|2\d|3[01])\.)|(192\.168\.)))/i.test(ip);
    }
    if (!net.isIPv4(ip)) return false;
    return (
      cidrContains("10.0.0.0/8", ip) ||
      cidrContains("172.16.0.0/12", ip) ||
      cidrContains("192.168.0.0/16", ip) ||
      cidrContains("127.0.0.0/8", ip) ||
      cidrContains("169.254.0.0/16", ip)
    );
  }

  // checks for cloud platform / container env vars
  function detectEnvSignals() {
    const signals = {
      "DYNO": "Heroku",
      "FLY_APP_NAME": "Fly.io",
      "RENDER_SERVICE_ID": "Render",
      "RAILWAY_SERVICE_ID": "Railway",
      "VERCEL": "Vercel",
      "AWS_EXECUTION_ENV": "AWS Lambda/ECS",
      "GAE_APPLICATION": "Google App Engine",
      "K_SERVICE": "Cloud Run/Knative",
      "WEBSITE_SITE_NAME": "Azure App Service",
      "ECS_CONTAINER_METADATA_URI": "AWS ECS",
      "ECS_CONTAINER_METADATA_URI_V4": "AWS ECS v4",
      "KUBERNETES_SERVICE_HOST": "Kubernetes",
      "CF_INSTANCE_IP": "Cloud Foundry",
      "DOKKU_APP_TYPE": "Dokku",
      "COOLIFY_APP_ID": "Coolify",
      "CAPROVER_APP": "CapRover",
    };

    const detected = [];
    for (const [key, name] of Object.entries(signals)) {
      if (process.env[key]) detected.push({ key, name, value: process.env[key] });
    }
    return detected;
  }

  // checks for docker/podman/k8s files on disk
  function detectFilesystemSignals() {
    const signals = [];

    const checks = [
      { path: "/.dockerenv", name: "Docker" },
      { path: "/run/.containerenv", name: "Podman" },
      { path: "/var/run/secrets/kubernetes.io", name: "Kubernetes" },
    ];

    for (const { path, name } of checks) {
      try {
        fs.accessSync(path, fs.constants.F_OK);
        signals.push({ path, name });
      } catch {}
    }

    try {
      const cgroup = fs.readFileSync("/proc/1/cgroup", "utf8");
      const patterns = [
        [/docker/i, "Docker"],
        [/kubepods/i, "Kubernetes"],
        [/containerd/i, "containerd"],
        [/lxc/i, "LXC"],
        [/podman/i, "Podman"],
      ];
      for (const [re, name] of patterns) {
        if (re.test(cgroup)) signals.push({ path: "/proc/1/cgroup", name });
      }
    } catch {}

    try {
      const container = fs.readFileSync("/run/systemd/container", "utf8").trim();
      if (container) signals.push({ path: "/run/systemd/container", name: container });
    } catch {}

    return signals;
  }

  // checks for container-looking network interfaces
  function detectNetworkSignals() {
    const signals = [];
    const ifaces = os.networkInterfaces();
    const containerIfacePattern = /^(docker|br-|veth|cali|flannel|cni|wg|tun|tap|tailscale|podman)/;

    for (const [name, addrs] of Object.entries(ifaces)) {
      if (containerIfacePattern.test(name)) {
        signals.push({ iface: name, type: "container-interface" });
      }
    }
    return signals;
  }

  // only trusts private ips, never the whole internet
  function buildTrustFunction() {
    return function pokeTrustProxy(addr) {
      const ip = addr.replace("::ffff:", "");
      return isPrivateIP(ip);
    };
  }

  function logProxyHeaders(req) {
    const interesting = [
      "x-forwarded-for", "x-forwarded-proto", "x-forwarded-host",
      "x-real-ip", "via", "cf-ray", "cf-connecting-ip",
      "fly-request-id", "x-amzn-trace-id",
    ];
    const found = interesting.filter(h => req.headers[h]);
    if (found.length) {
      initlog("[POKE-trust-proxy] headers we saw: " + found.join(", "));
    }
  }

  // let people override via env var if they want
  function checkUserOverride() {
    const val = (process.env.TRUST_PROXY || "").toLowerCase().trim();
    if (!val) return null;

    if (val === "true" || val === "1" || val === "yes") return "force-on";
    if (val === "false" || val === "0" || val === "no") return "force-off";

    const num = parseInt(val, 10);
    if (!isNaN(num) && num > 0) return num;

    return val;
  }

  // ok lets actually do the thing
  const override = checkUserOverride();

  if (override === "force-off") {
    app.set("trust proxy", false);
    initlog("[POKE-trust-proxy] force-disabled via TRUST_PROXY=false");
    return;
  }

  if (override === "force-on") {
    app.set("trust proxy", buildTrustFunction());
    initlog("[POKE-trust-proxy] force-enabled via TRUST_PROXY=true (private IPs only)");
    return;
  }

  if (typeof override === "number") {
    app.set("trust proxy", override);
    initlog("[POKE-trust-proxy] hop count set via TRUST_PROXY=" + override);
    return;
  }

  if (typeof override === "string") {
    app.set("trust proxy", override);
    initlog("[POKE-trust-proxy] custom CIDR set via TRUST_PROXY=" + override);
    return;
  }

  // no override, auto-detect
  const envSignals = detectEnvSignals();
  const fsSignals = detectFilesystemSignals();
  const netSignals = detectNetworkSignals();

  const totalConfidence =
    envSignals.length * 3 +
    fsSignals.length * 2 +
    netSignals.length * 1;

  if (envSignals.length) initlog("[POKE-trust-proxy] env: " + envSignals.map(s => s.name).join(", "));
  if (fsSignals.length) initlog("[POKE-trust-proxy] fs: " + fsSignals.map(s => s.name).join(", "));
  if (netSignals.length) initlog("[POKE-trust-proxy] net: " + netSignals.map(s => `${s.iface}(${s.type})`).join(", "));
  initlog("[POKE-trust-proxy] confidence: " + totalConfidence);

  if (totalConfidence >= 2) {
    app.set("trust proxy", buildTrustFunction());
    initlog("[POKE-trust-proxy] ✓ auto-enabled (confidence: " + totalConfidence + ")");
    return;
  }

  // not sure if theres a proxy, so we'll sniff the first real request.
  // this middleware sits BEFORE the rate limiter in the stack so by the
  // time express-rate-limit runs, trust proxy is already configured.
  initlog("[POKE-trust-proxy] not sure yet, will check on first request");

  let probeComplete = false;

  app.use(function pokeProxyProbe(req, res, next) {
    if (probeComplete) return next();
    probeComplete = true;

    const hasForwardedFor = !!req.headers["x-forwarded-for"];
    const hasForwardedProto = !!req.headers["x-forwarded-proto"];
    const hasForwardedHost = !!req.headers["x-forwarded-host"];
    const hasVia = !!req.headers["via"];
    const hasCfRay = !!req.headers["cf-ray"];
    const hasFlyReqId = !!req.headers["fly-request-id"];
    const hasXRealIp = !!req.headers["x-real-ip"];
    const hasXAmznTraceId = !!req.headers["x-amzn-trace-id"];

    const headerScore =
      (hasForwardedFor ? 3 : 0) +
      (hasForwardedProto ? 2 : 0) +
      (hasForwardedHost ? 1 : 0) +
      (hasVia ? 2 : 0) +
      (hasCfRay ? 3 : 0) +
      (hasFlyReqId ? 3 : 0) +
      (hasXRealIp ? 2 : 0) +
      (hasXAmznTraceId ? 3 : 0);

    const remoteAddr = (req.socket.remoteAddress || "").replace("::ffff:", "");
    const remoteIsPrivate = isPrivateIP(remoteAddr);

    if (headerScore >= 3 && remoteIsPrivate) {
      // yep theres a proxy, and its coming from a local ip so its legit
      app.set("trust proxy", buildTrustFunction());
      initlog("[POKE-trust-proxy] ✓ confirmed proxy on first request (score: " + headerScore + ")");
      logProxyHeaders(req);
    } else if (headerScore >= 3 && !remoteIsPrivate) {
      // someone sending proxy headers from a public ip... nah
      app.set("trust proxy", false);
      initlog("[POKE-trust-proxy] ⚠ proxy headers from public ip " + remoteAddr + ", ignoring");
    } else {
      // no proxy headers, direct connection
      app.set("trust proxy", false);
      initlog("[POKE-trust-proxy] no proxy headers, disabled");
    }

    next();
  });

  // re-check every minute in case environment changes (container stuff)
  setInterval(() => {
    const freshEnv = detectEnvSignals();
    const freshFs = detectFilesystemSignals();
    const freshScore = freshEnv.length * 3 + freshFs.length * 2;

    if (freshScore >= 2 && !probeComplete) {
      app.set("trust proxy", buildTrustFunction());
      initlog("[POKE-trust-proxy] ✓ periodic re-check found proxy (score: " + freshScore + ")");
    }
  }, 60_000).unref();

})();

/*
 * PokeStopSkids
 *
 * poke's anti-ddos and anti-botnet system. we're a privacy
 * frontend, we're not about to start spying on users to stop skids.
 */
(function PokeStopSkids() {
  const net = require("net");
  const rateLimit = require("express-rate-limit");

  // cloudflare's published ip ranges - https://www.cloudflare.com/ips/
  const CLOUDFLARE_V4 = [
    "173.245.48.0/20", "103.21.244.0/22", "103.22.200.0/22",
    "103.31.4.0/22", "141.101.64.0/18", "108.162.192.0/18",
    "190.93.240.0/20", "188.114.96.0/20", "197.234.240.0/22",
    "198.41.128.0/17", "162.158.0.0/15", "104.16.0.0/13",
    "104.24.0.0/14", "172.64.0.0/13", "131.0.72.0/22",
  ];

  function ipToLong(ip) {
    return ip.split(".").reduce((acc, oct) => (acc << 8) + parseInt(oct, 10), 0) >>> 0;
  }

  function cidrContains(cidr, ip) {
    if (!net.isIPv4(ip)) return false;
    const [subnet, bits] = cidr.split("/");
    const mask = ~(2 ** (32 - parseInt(bits, 10)) - 1) >>> 0;
    return (ipToLong(ip) & mask) === (ipToLong(subnet) & mask);
  }

  function isCloudflareIP(ip) {
    const clean = ip.replace("::ffff:", "");
    if (!net.isIPv4(clean)) return false;
    return CLOUDFLARE_V4.some(cidr => cidrContains(cidr, clean));
  }

  // bots we like :3
  const KNOWN_BOT_PATTERNS = [
    // search
    /googlebot/i, /bingbot/i, /slurp/i, /duckduckbot/i,
    /baiduspider/i, /yandexbot/i, /sogou/i, /exabot/i,
    /facebot/i, /ia_archiver/i, /archive\.org_bot/i,
    /qwantify/i, /seznambot/i, /mojeekbot/i,
    /petalsearch/i, /applebot/i,
    // social / previews
    /discordbot/i, /telegrambot/i, /twitterbot/i,
    /whatsapp/i, /slackbot/i, /linkedinbot/i,
    // fediverse <3
    /mastodon/i, /pleroma/i, /misskey/i, /akkoma/i,
    /lemmy/i, /kbin/i, /pixelfed/i, /gotosocial/i,
    // uptime
    /uptimerobot/i, /pingdom/i, /statuscake/i,
    /site24x7/i, /hetrixtools/i, /freshping/i,
    // cdn
    /cloudflare/i, /cloudfront/i, /fastly/i,
    // feeds
    /feedfetcher/i, /feedly/i, /newsblur/i,
    /tiny\s?tiny\s?rss/i, /miniflux/i,
    // seo
    /researchscan/i, /censys/i, /semrush/i, /ahrefs/i,
  ];

  function isKnownBot(ua) {
    if (!ua) return false;
    return KNOWN_BOT_PATTERNS.some(p => p.test(ua));
  }

  // messages for skids. rotated randomly. have fun reading these in
  const SKID_MESSAGES = [
    "lol",
    "nope",
    "nice try",
    "do you think this is working? because its not",
    "you paid money for this botnet didnt you",
    "your requests are being dropped and nobody cares",
    "this is embarrassing for you",
    "imagine ddosing a youtube frontend. go outside",
    "all that bandwidth for nothing lmao",
    "you could be doing literally anything else right now",
    "hey quick question: why",
    "blocked <3",
    "skill issue",
    "maybe try a different hobby? this one isnt working out",
    "server is still up btw. just so you know",
    "your botnet has been blocked :3",
    "trans rights are human rights. anyway youre banned",
    "L + ratio + blocked + server still up",
    "every request you send makes poke stronger (it doesnt but you dont know that)",
    "have you considered that this is a waste of your time",
    "you are banned :3",
    "did your botnet come with a receipt? you should get a refund",
  ];

  function getSkidMessage() {
    return SKID_MESSAGES[Math.floor(Math.random() * SKID_MESSAGES.length)];
  }

  // per-ip tracking
  const ipData = new Map();

  // global flood tracking for siege mode
  let globalRequestsLastSecond = 0;
  let globalRequestsThisSecond = 0;
  let siegeMode = false;
  let siegeStartedAt = 0;
  let lastSecondTick = Date.now();

  // thresholds
  const BURST_LIMIT = 50;           // req/1s per ip (no human)
  const SUSTAINED_LIMIT = 200;      // req/10s per ip
  const SUSTAINED_WINDOW = 10000;
  const BAN_BASE_MS = 30000;        // first ban 30s
  const BAN_MAX_MS = 600000;        // max ban 10min
  const STRIKE_DECAY_MS = 300000;   // forgive after 5min
  const CLEANUP_INTERVAL = 60000;
  const MAX_TRACKED_IPS = 50000;

  // /watch gets tighter limits because thats what people target
  const WATCH_BURST_LIMIT = 20;     // 20 /watch req/sec is still insane
  const WATCH_SUSTAINED_LIMIT = 80; // 80 /watch in 10s, come on

  // pattern detection thresholds
  // if the time between requests has very low variance, its a script.
  // humans are messy and random, bots are precise.
  const TIMING_VARIANCE_THRESHOLD = 5; // ms - if stdev is under this, sus
  const TIMING_MIN_SAMPLES = 15;       // need at least this many to judge

  // siege mode: if the whole server is getting hit this hard,
  // stop serving non-essential stuff and only let through
  // requests that look legit
  const SIEGE_THRESHOLD = 2000;        // global req/sec to trigger siege
  const SIEGE_COOLDOWN_MS = 30000;     // stay in siege for at least 30s

  function getIPData(ip) {
    let data = ipData.get(ip);
    if (!data) {
      if (ipData.size >= MAX_TRACKED_IPS) {
        let oldestKey = null;
        let oldestTime = Infinity;
        for (const [key, val] of ipData) {
          const lastActive = val.ts.length > 0
            ? val.ts[val.ts.length - 1]
            : 0;
          if (lastActive < oldestTime && !val.banned) {
            oldestTime = lastActive;
            oldestKey = key;
          }
        }
        if (oldestKey) ipData.delete(oldestKey);
      }
      data = {
        ts: [],           // all request timestamps (last 10s)
        watchTs: [],      // /watch request timestamps (last 10s)
        intervals: [],    // time gaps between requests (for pattern detection)
        banned: false,
        banExpires: 0,
        strikes: 0,
        lastStrike: 0,
        reasons: [],      // what triggered the ban (for logging)
        wasSkid: false,   // got caught by pattern detection, not just volume
      };
      ipData.set(ip, data);
    }
    return data;
  }

  function isBanned(data) {
    if (!data.banned) return false;
    if (Date.now() >= data.banExpires) {
      data.banned = false;
      return false;
    }
    return true;
  }

  function banIP(data, ip, reasons) {
    data.strikes++;
    data.lastStrike = Date.now();
    data.reasons = reasons;
    const duration = Math.min(BAN_BASE_MS * Math.pow(2, data.strikes - 1), BAN_MAX_MS);
    data.banned = true;
    data.banExpires = Date.now() + duration;
    const reasonStr = reasons.join(" + ");
    initlog(
      `[PokeStopSkids] banned ${ip} for ${Math.round(duration / 1000)}s ` +
      `(${reasonStr}, strike #${data.strikes})`
    );
  }

  // check if request timing looks like a script
  // real humans have random, messy timing between clicks.
  // scripts and botnets have very consistent intervals.
  // we calculate the standard deviation of the gaps between requests.
  // low stdev = robotic = sus
  function checkTimingPattern(data) {
    const intervals = data.intervals;
    if (intervals.length < TIMING_MIN_SAMPLES) return null;

    // only look at the last 30 intervals
    const recent = intervals.slice(-30);
    const mean = recent.reduce((a, b) => a + b, 0) / recent.length;
    const variance = recent.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / recent.length;
    const stdev = Math.sqrt(variance);

    // if the timing is robotically consistent AND the mean interval is small
    // (they're going fast), thats a bot. a human with low stdev but slow
    // requests (like reading an article every 30s) is fine.
    if (stdev < TIMING_VARIANCE_THRESHOLD && mean < 500) {
      return "robotic timing (stdev: " + stdev.toFixed(1) + "ms, avg: " + mean.toFixed(0) + "ms)";
    }

    return null;
  }

  function checkAbuse(data, now, isWatch) {
    const ts = data.ts;
    const reasons = [];

    // record timing interval between this and last request
    if (ts.length > 0) {
      const gap = now - ts[ts.length - 1];
      data.intervals.push(gap);
      // only keep last 50 intervals
      if (data.intervals.length > 50) data.intervals.shift();
    }

    ts.push(now);

    // trim timestamps older than 10s
    while (ts.length > 0 && ts[0] < now - SUSTAINED_WINDOW) {
      ts.shift();
    }

    // burst check: requests in last 1 second
    const oneSecAgo = now - 1000;
    let burstCount = 0;
    for (let i = ts.length - 1; i >= 0; i--) {
      if (ts[i] >= oneSecAgo) burstCount++;
      else break;
    }
    if (burstCount >= BURST_LIMIT) {
      reasons.push("burst (" + burstCount + " req/1s)");
    }

    // sustained check
    if (ts.length >= SUSTAINED_LIMIT) {
      reasons.push("sustained (" + ts.length + " req/10s)");
    }

    // /watch specific checks (tighter because thats the expensive endpoint)
    if (isWatch) {
      data.watchTs.push(now);
      while (data.watchTs.length > 0 && data.watchTs[0] < now - SUSTAINED_WINDOW) {
        data.watchTs.shift();
      }

      let watchBurst = 0;
      for (let i = data.watchTs.length - 1; i >= 0; i--) {
        if (data.watchTs[i] >= oneSecAgo) watchBurst++;
        else break;
      }
      if (watchBurst >= WATCH_BURST_LIMIT) {
        reasons.push("/watch burst (" + watchBurst + " req/1s)");
      }
      if (data.watchTs.length >= WATCH_SUSTAINED_LIMIT) {
        reasons.push("/watch sustained (" + data.watchTs.length + " req/10s)");
      }
    }

    // timing pattern check (catches bots that stay under volume limits)
    const timingResult = checkTimingPattern(data);
    if (timingResult) {
      data.wasSkid = true;
      reasons.push(timingResult);
    }

    return reasons.length > 0 ? reasons : null;
  }

  // global per-second counter for siege mode
  setInterval(() => {
    globalRequestsLastSecond = globalRequestsThisSecond;
    globalRequestsThisSecond = 0;

    if (globalRequestsLastSecond >= SIEGE_THRESHOLD && !siegeMode) {
      siegeMode = true;
      siegeStartedAt = Date.now();
      initlog("[PokeStopSkids] SIEGE MODE ON - " + globalRequestsLastSecond + " req/s detected, locking down");
    }

    if (siegeMode && globalRequestsLastSecond < SIEGE_THRESHOLD / 2) {
      if (Date.now() - siegeStartedAt > SIEGE_COOLDOWN_MS) {
        siegeMode = false;
        initlog("[PokeStopSkids] siege mode off, traffic is back to normal");
      }
    }
  }, 1000).unref();

  // cleanup stale ip entries
  setInterval(() => {
    const now = Date.now();
    for (const [ip, data] of ipData) {
      if (data.strikes > 0 && now - data.lastStrike > STRIKE_DECAY_MS) {
        data.strikes = Math.max(0, data.strikes - 1);
      }
      while (data.ts.length > 0 && data.ts[0] < now - SUSTAINED_WINDOW) {
        data.ts.shift();
      }
      while (data.watchTs.length > 0 && data.watchTs[0] < now - SUSTAINED_WINDOW) {
        data.watchTs.shift();
      }
      if (!data.banned && data.strikes === 0 && data.ts.length === 0) {
        ipData.delete(ip);
      }
    }
  }, CLEANUP_INTERVAL).unref();

  // the main middleware
  app.use(function PokeStopSkids(req, res, next) {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const ua = req.headers["user-agent"] || "";
    const now = Date.now();
    const isWatch = req.path === "/watch" || req.path.startsWith("/watch?");

    globalRequestsThisSecond++;

    // cloudflare handles itself
    const rawIP = (req.socket.remoteAddress || "").replace("::ffff:", "");
    if (isCloudflareIP(rawIP)) return next();

    // let good bots through
    if (isKnownBot(ua)) return next();

    // siege mode: if the whole server is under attack,
    // only let through requests that arent from already-tracked IPs
    // with high activity. basically: if we're drowning, be stricter.
    if (siegeMode) {
      const existing = ipData.get(ip);
      if (existing && existing.ts.length > 20) {
        // this ip is already being noisy during a siege. nope.
        if (!existing.banned) {
          banIP(existing, ip, ["active during siege mode"]);
          existing.wasSkid = true;
        }
        res.set("Retry-After", "60");
        return res.status(503).send(getSkidMessage());
      }

      // during siege, tighten limits for everyone: new connections
      // get half the normal thresholds
      if (existing && existing.ts.length > BURST_LIMIT / 2) {
        if (!existing.banned) {
          banIP(existing, ip, ["exceeded siege limits"]);
        }
        res.set("Retry-After", "60");
        return res.status(503).send(getSkidMessage());
      }
    }

    const data = getIPData(ip);

    // already banned?
    if (isBanned(data)) {
      const retryAfter = Math.ceil((data.banExpires - now) / 1000);
      res.set("Retry-After", String(retryAfter));
      // skids get roasted. normal rate limit hits get a polite message.
      if (data.wasSkid || data.strikes >= 3) {
        return res.status(429).send(getSkidMessage());
      }
      return res.status(429).send(
        "Too many requests. Try again in " + retryAfter + " seconds."
      );
    }

    // check for abuse
    const reasons = checkAbuse(data, now, isWatch);
    if (reasons) {
      banIP(data, ip, reasons);
      const retryAfter = Math.ceil((data.banExpires - now) / 1000);
      res.set("Retry-After", String(retryAfter));
      if (data.wasSkid || data.strikes >= 2) {
        return res.status(429).send(getSkidMessage());
      }
      return res.status(429).send(
        "Too many requests. Try again in " + retryAfter + " seconds."
      );
    }

    next();
  });

  // softer rate limiter underneath
  const limiter = rateLimit({
    windowMs: 15 * 1000,
    max: 150,
    validate: { xForwardedForHeader: false },
    skip: (req) => {
      const ua = req.headers["user-agent"] || "";
      const rawIP = (req.socket.remoteAddress || "").replace("::ffff:", "");
      return isKnownBot(ua) || isCloudflareIP(rawIP);
    },
    handler: (req, res) => {
      return res.status(429).send("Slow down a bit! Too many requests.");
    },
  });
  app.use(limiter);

  // json stats api
  app.get("/_pokestopskids/stats", (req, res) => {
    const now = Date.now();
    let bannedCount = 0;
    let skidBans = 0;
    let trackedWithActivity = 0;
    for (const [, data] of ipData) {
      if (isBanned(data)) {
        bannedCount++;
        if (data.wasSkid) skidBans++;
      }
      if (data.ts.length > 0) trackedWithActivity++;
    }
    res.json({
      tracked_ips: ipData.size,
      active_ips: trackedWithActivity,
      currently_banned: bannedCount,
      skids_caught: skidBans,
      siege_mode: siegeMode,
      global_rps: globalRequestsLastSecond,
      thresholds: {
        burst: BURST_LIMIT + " req/1s",
        sustained: SUSTAINED_LIMIT + " req/10s",
        watch_burst: WATCH_BURST_LIMIT + " req/1s",
        watch_sustained: WATCH_SUSTAINED_LIMIT + " req/10s",
        siege_trigger: SIEGE_THRESHOLD + " global req/s",
        rate_limit: "150 req/15s",
      },
    });
  });

  // the about page, served inline
  app.get("/_antiddos*", (req, res) => {
    const now = Date.now();
    let bannedCount = 0;
    let skidBans = 0;
    let trackedWithActivity = 0;
    for (const [, data] of ipData) {
      if (isBanned(data)) {
        bannedCount++;
        if (data.wasSkid) skidBans++;
      }
      if (data.ts.length > 0) trackedWithActivity++;
    }

    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>PokeStopSkids - Poke Anti-DDoS</title>
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
ul li{
  font-family:system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,"Noto Sans",sans-serif;
  line-height:1.8;
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
.stat-box{
  display:inline-block;
  background:#2a2930;
  border-radius:8px;
  padding:12px 20px;
  margin:6px 8px 6px 0;
  font-family:"poketube flex",sans-serif;
  font-weight:600;
  font-stretch:expanded;
}
.stat-num{
  font-size:1.6rem;
  color:#0ab7f0;
}
.stat-label{
  font-size:.85rem;
  color:#aaa;
  display:block;
}
code{
  background:#2a2930;
  padding:2px 6px;
  border-radius:4px;
  font-size:.9rem;
}
.green{color:#4caf50}
.red{color:#f44336}
.orange{color:#ff9800}
.siege-banner{
  background:#f44336;
  color:#fff;
  padding:12px 20px;
  border-radius:8px;
  margin-bottom:16px;
  font-family:"poketube flex",sans-serif;
  font-weight:700;
  font-stretch:expanded;
}
</style>
</head>
<body>
<div class="app">

<img src="/css/logo-poke.svg" alt="Poke logo">

<h1>PokeStopSkids</h1>
<p class="muted">poke's anti-ddos and anti-botnet protection</p>

${siegeMode ? '<div class="siege-banner">SIEGE MODE ACTIVE - we are currently under attack. some requests may be slower or blocked. hang tight!</div>' : ''}

<h2>what this does</h2>
<p>
  PokeStopSkids protects poke from DDoS attacks and botnets. it
  watches for request patterns that no real person would make and
  temporarily bans IPs that cross the line. if you're just browsing
  around watching videos, you will never trigger any of this.
</p>
<p>
  there are a few things it checks, all based purely on IP request
  volume and timing:
</p>
<ul>
  <li><b>burst flood</b> - ${BURST_LIMIT}+ requests in 1 second from the same IP</li>
  <li><b>sustained flood</b> - ${SUSTAINED_LIMIT}+ requests in 10 seconds</li>
  <li><b>/watch abuse</b> - the video page has tighter limits (${WATCH_BURST_LIMIT} req/s, ${WATCH_SUSTAINED_LIMIT} req/10s) since it's the heaviest endpoint</li>
  <li><b>robotic timing</b> - if the time between your requests has almost zero variance, that's a script, not a person. humans are messy clickers</li>
  <li><b>siege mode</b> - if the server is getting ${SIEGE_THRESHOLD}+ req/sec globally, we go into lockdown and get way stricter with everyone</li>
</ul>
<p>
  first offense is a 30 second ban. repeat offenders get doubled each
  time up to 10 minutes. strikes go away after 5 minutes of not being
  weird. bots that get caught by pattern detection get roasted with
  funny messages because we think thats funny.
</p>

<hr>

<h2>what we don't look at</h2>
<p>
  we don't check your user agent, your cookies, whether javascript is
  on, what language your browser sends, your screen size, or anything
  like that. we don't fingerprint you. at all. poke is a privacy
  project and we would rather get ddosed than start tracking users.
</p>
<p>
  so tor browser, vpns, brave, librewolf, curl, wget, lynx, a
  terminal browser from 1997: all totally fine. empty or missing user
  agents are fine. we only look at "how many requests is this IP
  making and does the timing look like a script?" and that's it.
</p>

<hr>

<h2>whitelisted bots</h2>
<p>
  these crawlers and bots skip all checks so we don't break search
  results, link previews, or fediverse federation:
</p>
<ul>
  <li><b>search engines</b> - google, bing, duckduckgo, yandex, baidu, apple, qwant, mojeek, etc</li>
  <li><b>social/link previews</b> - discord, telegram, twitter, whatsapp, slack, linkedin</li>
  <li><b>fediverse</b> - mastodon, pleroma, misskey, akkoma, lemmy, kbin, pixelfed, gotosocial</li>
  <li><b>feed readers</b> - feedly, newsblur, tiny tiny rss, miniflux</li>
  <li><b>uptime monitors</b> - uptimerobot, pingdom, statuscake, hetrixtools</li>
  <li><b>cdn/infra</b> - cloudflare, cloudfront, fastly</li>
  <li><b>archive</b> - internet archive, archive.org bot</li>
</ul>
<p>
  cloudflare IPs are also fully exempt since cf handles its own
  L7 filtering before traffic even gets to us.
</p>

<hr>

<h2>live stats</h2>

<div>
  <div class="stat-box">
    <span class="stat-num">${ipData.size}</span>
    <span class="stat-label">tracked IPs</span>
  </div>
  <div class="stat-box">
    <span class="stat-num">${trackedWithActivity}</span>
    <span class="stat-label">active right now</span>
  </div>
  <div class="stat-box">
    <span class="stat-num ${bannedCount > 0 ? "red" : "green"}">${bannedCount}</span>
    <span class="stat-label">currently banned</span>
  </div>
  <div class="stat-box">
    <span class="stat-num ${skidBans > 0 ? "orange" : "green"}">${skidBans}</span>
    <span class="stat-label">skids caught</span>
  </div>
  <div class="stat-box">
    <span class="stat-num">${globalRequestsLastSecond}</span>
    <span class="stat-label">global req/sec</span>
  </div>
  <div class="stat-box">
    <span class="stat-num ${siegeMode ? "red" : "green"}">${siegeMode ? "ACTIVE" : "off"}</span>
    <span class="stat-label">siege mode</span>
  </div>
</div>

<h2>thresholds</h2>
<p class="note">
  burst limit: <code>${BURST_LIMIT} req/sec</code> per IP<br>
  sustained limit: <code>${SUSTAINED_LIMIT} req/10sec</code> per IP<br>
  /watch burst: <code>${WATCH_BURST_LIMIT} req/sec</code> per IP<br>
  /watch sustained: <code>${WATCH_SUSTAINED_LIMIT} req/10sec</code> per IP<br>
  siege mode trigger: <code>${SIEGE_THRESHOLD} req/sec</code> globally<br>
  rate limiter: <code>150 req/15sec</code> per IP<br>
  first ban: <code>30 seconds</code><br>
  max ban: <code>10 minutes</code><br>
  strike decay: <code>5 minutes</code><br>
  max tracked IPs: <code>${MAX_TRACKED_IPS}</code>
</p>

<hr>

<h2>api</h2>
<p class="note">
  json stats: <code><a href="/_pokestopskids/stats">/_pokestopskids/stats</a></code><br>
  this page: <code><a href="/_antiddos">/_antiddos</a></code>
</p>

<hr>

<h2>source code</h2>
<p>
  this is all free software. you can read exactly what PokeStopSkids does
  in <a href="https://codeberg.org/ashleyirispuppy/poke">poke's repo on codeberg</a>.
  if you got banned and you think it was wrong,
  <a href="https://codeberg.org/ashleyirispuppy/poke/issues">open an issue</a>
  and we'll look into it.
</p>

<p class="muted" style="margin-top:2rem">
  powered by poke. <a href="/">go back to watching videos</a>
</p>

</div>
</body>
</html>`);
  });

  initlog(
    "[PokeStopSkids] loaded - " +
    "burst: " + BURST_LIMIT + "/s, " +
    "sustained: " + SUSTAINED_LIMIT + "/10s, " +
    "/watch: " + WATCH_BURST_LIMIT + "/s, " +
    "siege at " + SIEGE_THRESHOLD + " global/s, " +
    KNOWN_BOT_PATTERNS.length + " bot patterns whitelisted"
  );
})();

  app.use(ieBlockMiddleware);
  initlog("Loaded express.js");

/*
 * poke response guard
 *
 * catches accidental double-sends before they crash the server with
 * ERR_HTTP_HEADERS_SENT. wraps res.send/json/redirect/render so the
 * second attempt just gets swallowed and logged instead of exploding.
 *
 * /api/ routes are skipped - they handle their own lifecycle and
 * some of them (stats, etc) do stuff that trips the guard unnecessarily.
 */
(function PokeResponseGuard() {
  app.use(function pokeResponseGuard(req, res, next) {
    // api routes are on their own, dont mess with them
    if (req.path.startsWith("/api/")) return next();

    const originalSend = res.send.bind(res);
    const originalJson = res.json.bind(res);
    const originalRedirect = res.redirect.bind(res);
    const originalRender = res.render.bind(res);

    let alreadySent = false;

    function blockDoubleSend(method) {
      if (alreadySent) {
        console.error(`[POKE-response-guard] caught double-send (${method}) on ${req.method} ${req.originalUrl}`);
        return true;
      }
      alreadySent = true;
      return false;
    }

    res.send = function (...args) {
      if (res.headersSent || blockDoubleSend("send")) return res;
      return originalSend(...args);
    };

    res.json = function (...args) {
      if (res.headersSent || blockDoubleSend("json")) return res;
      return originalJson(...args);
    };

    res.redirect = function (...args) {
      if (res.headersSent || blockDoubleSend("redirect")) return res;
      return originalRedirect(...args);
    };

    res.render = function (view, data, callback) {
      if (res.headersSent || blockDoubleSend("render")) return;
      if (typeof callback !== "function") {
        return originalRender(view, data, function (err, html) {
          if (err) {
            console.error("[POKE-response-guard] render broke for", view, ":", err.message);
            if (!res.headersSent) {
              res.status(500).send("Internal server error");
            }
            return;
          }
          if (!res.headersSent) {
            originalSend(html);
          }
        });
      }
      return originalRender(view, data, callback);
    };

    next();
  });

  initlog("[POKE-response-guard] loaded");
})();

  app.engine("html", require("ejs").renderFile);
  initlog("Loaded EJS");
  app.use(modules.express.urlencoded({ extended: true }));
  app.use(modules.useragent.express());
  app.use(modules.express.json());

  var toobusy = require("toobusy-js");

  const renderTemplate = async (res, req, template, data = {}) => {
    if (res.headersSent) {
      console.error("[POKE-render] headers already sent, skipping:", template);
      return;
    }
    try {
      res.render(
        modules.path.resolve(`${templateDir}${modules.path.sep}${template}`),
        Object.assign(data)
      );
    } catch (err) {
      console.error("[POKE-render] error on", template, ":", err.message);
      if (!res.headersSent) {
        res.status(500).send("Internal server error");
      }
    }
  };

  toobusy.interval(110);
  toobusy.maxLag(3500);

  app.use(function (req, res, next) {
    if (toobusy()) {
      return res.status(503).send("I'm busy right now, sorry.");
    }
    next();
  });

  toobusy.onLag(function (currentLag) {
    console.error("[POKE-toobusy] event loop lag: " + currentLag + "ms");
    if (currentLag > 5000) {
      console.error("[POKE-toobusy] lag is insane (" + currentLag + "ms), restarting");
      process.exit(1);
    }
  });
  
  initlog("inited anti ddos");


  const initPokeTube = function () {
    sinit(app, config, renderTemplate);
    initlog("inited super init");
    init(app);
    initlog("inited app");
  };

  try {
    app.use(function (req, res, next) {
      res.header("Access-Control-Allow-Origin", "*");
      if (req.secure) {
        res.header(
          "Strict-Transport-Security",
          "max-age=31536000; includeSubDomains; preload"
        );
      }
      res.header("secure-poketube-instance", "1");

      // opt out of googles "FLOC" bs :p See https://spreadprivacy.com/block-floc-with-duckduckgo/
      res.header("Permissions-Policy", "interest-cohort=()");
      res.header("software-name", "poke");
      next();
    });

    app.use(function (request, response, next) {
      if (config.enablealwayshttps && !request.secure) {
        if (
          !/^https:/i.test(
            request.headers["x-forwarded-proto"] || request.protocol
          )
        ) {
          return response.redirect(
            "https://" + request.headers.host + request.url
          );
        }
      }

      next();
    });

    app.use(function (req, res, next) {
 
      res.header(
        "X-PokeTube-Youtube-Client-Name",
        innertube.innertube.CONTEXT_CLIENT.INNERTUBE_CONTEXT_CLIENT_NAME
      );
      res.header(
        "Hey-there",
        "Do u wanna help poke? join us :3 https://codeberg.org/ashleyirispuppy/poke"
      );
      res.header(
        "X-PokeTube-Youtube-Client-Version",
        innertube.innertube.CLIENT.clientVersion
      );
      res.header(
        "X-PokeTube-Client-name",
        innertube.innertube.CLIENT.projectClientName
      );
      res.header("X-PokeTube-Speeder", "3 seconds no cache, 280ms w/cache");
      res.header("X-HOSTNAME", req.hostname);
      if (req.url.match(/^\/(css|js|img|font)\/.+/)) {
        res.setHeader(
          "Cache-Control",
          "public, max-age=" + config.cacher_max_age
        ); // cache header
        res.setHeader("poketube-cacher", "STATIC_FILES");
      }
      const a = 890;
      if (!req.url.match(/^\/(css|js|img|font)\/.+/)) {
        res.setHeader("Cache-Control", "public, max-age=" + a); // cache header
        res.setHeader("poketube-cacher", "PAGE");
      }
      next();
    });

    initlog("[OK] Load headers");
  } catch {
    initlog("[FAILED] load headers");
  }

  try {
    app.get("/robots.txt", (req, res) => {
      res.sendFile(__dirname + "/robots.txt");
    });

    initlog("[OK] Load robots.txt");
  } catch {
    initlog("[FAILED] load robots.txt");
  }

  // last-resort error catcher. has to be registered last.
  app.use(function pokeErrorHandler(err, req, res, next) {
    console.error("[POKE-error]", req.method, req.originalUrl, ":", err.message);
    if (process.env.NODE_ENV !== "production") {
      console.error(err.stack);
    }
    if (!res.headersSent) {
      res.status(500).send("Something went wrong. Please try again.");
    }
  });

  initPokeTube();
})();