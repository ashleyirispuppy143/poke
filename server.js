/*

    Poke is an Free/Libre youtube front-end. this is our main file.
  
    Copyright (C) 2021-2026 Poke (https://codeberg.org/ashleyirispuppy/poke)
    
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
  const os = require("os");
  const nodePath = require("path");
  const { performance, monitorEventLoopDelay } = require("perf_hooks");
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
    
    // Anonymize the IP by replacing the last two octets
    const maskedIp = ip.replace(/\.\d+\.\d+$/, '.xxx.xxx');
    
    initlog(
      `[PokeStopSkids] banned ${maskedIp} for ${Math.round(duration / 1000)}s ` +
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

/*
 * PokeOverloadShield
 *
 * This is the nicer toobusy layer.
 *
 * It uses toobusy-js as the quick event-loop lag signal, then adds Node core
 * diagnostics and a defensive admission policy:
 *
 * - cheap static/status requests survive soft overload
 * - human page navigations get a short grace wait
 * - trusted-looking page navigations can spend a small soft-pass budget
 * - media, API, proxy, and background requests are shed first
 * - noisy clients get an overload-only cooldown
 * - critical lag still protects the process with hard rejects and restart
 *
 * This does not attack anyone back. It just makes bad traffic pay first.
 */
(function PokeOverloadShield() {
  const OVERLOAD_CHECK_INTERVAL_MS = Number(process.env.POKE_OVERLOAD_CHECK_INTERVAL_MS || process.env.POKE_TOOBUSY_INTERVAL_MS || 110);
  const OVERLOAD_BASE_REJECT_LAG_MS = Number(process.env.POKE_OVERLOAD_REJECT_LAG_MS || process.env.POKE_TOOBUSY_MAX_LAG_MS || 2500);

  const LOOP_WARN_LAG_MS_FLOOR = Number(process.env.POKE_LOOP_WARN_LAG_MS || process.env.POKE_EVENT_LOOP_WARN_LAG_MS || 750);
  const LOOP_CRITICAL_LAG_MS_FLOOR = Number(process.env.POKE_LOOP_CRITICAL_LAG_MS || process.env.POKE_INSANE_LAG_MS || Math.max(7500, OVERLOAD_BASE_REJECT_LAG_MS * 3));
  const LOOP_CRITICAL_P99_MS_FLOOR = Number(process.env.POKE_LOOP_CRITICAL_P99_MS || process.env.POKE_INSANE_P99_LAG_MS || Math.max(5000, OVERLOAD_BASE_REJECT_LAG_MS * 2));

  const LOOP_WARN_LAG_MS_CAP = Number(process.env.POKE_LOOP_WARN_LAG_MS_CAP || process.env.POKE_EVENT_LOOP_WARN_LAG_MS_CAP || 2500);
  const LOOP_REJECT_LAG_MS_CAP = Number(process.env.POKE_LOOP_REJECT_LAG_MS_CAP || process.env.POKE_TOOBUSY_MAX_LAG_MS_CAP || 6000);
  const LOOP_CRITICAL_LAG_MS_CAP = Number(process.env.POKE_LOOP_CRITICAL_LAG_MS_CAP || process.env.POKE_INSANE_LAG_MS_CAP || 30000);
  const LOOP_CRITICAL_P99_MS_CAP = Number(process.env.POKE_LOOP_CRITICAL_P99_MS_CAP || process.env.POKE_INSANE_P99_LAG_MS_CAP || 20000);

  const LOOP_DYNAMIC_LIMITS_ENABLED = process.env.POKE_LOOP_DYNAMIC_LIMITS !== "0" && process.env.POKE_DYNAMIC_EVENT_LOOP_MS !== "0";
  const LOOP_DYNAMIC_TOOBUSY_ENABLED = process.env.POKE_LOOP_DYNAMIC_TOOBUSY === "1" || process.env.POKE_DYNAMIC_TOOBUSY_MAX_LAG === "1";
  const LOOP_BASELINE_SAMPLE_INTERVAL_MS = Number(process.env.POKE_LOOP_BASELINE_SAMPLE_INTERVAL_MS || process.env.POKE_DYNAMIC_EVENT_LOOP_SAMPLE_INTERVAL_MS || 15_000);
  const LOOP_BASELINE_MIN_MS = Number(process.env.POKE_LOOP_BASELINE_MIN_MS || process.env.POKE_DYNAMIC_EVENT_LOOP_MIN_BASELINE_MS || 10);
  const LOOP_BASELINE_MAX_HEALTHY_MS = Number(process.env.POKE_LOOP_BASELINE_MAX_HEALTHY_MS || process.env.POKE_DYNAMIC_EVENT_LOOP_MAX_HEALTHY_BASELINE_MS || 1000);
  const LOOP_BASELINE_ALPHA = Number(process.env.POKE_LOOP_BASELINE_ALPHA || process.env.POKE_DYNAMIC_EVENT_LOOP_ALPHA || 0.22);

  const LOOP_WARN_MULTIPLIER = Number(process.env.POKE_LOOP_WARN_MULTIPLIER || process.env.POKE_DYNAMIC_WARN_MULTIPLIER || 20);
  const LOOP_REJECT_MULTIPLIER = Number(process.env.POKE_LOOP_REJECT_MULTIPLIER || process.env.POKE_DYNAMIC_TOOBUSY_MULTIPLIER || 45);
  const LOOP_CRITICAL_MULTIPLIER = Number(process.env.POKE_LOOP_CRITICAL_MULTIPLIER || process.env.POKE_DYNAMIC_INSANE_MULTIPLIER || 120);
  const LOOP_CRITICAL_P99_MULTIPLIER = Number(process.env.POKE_LOOP_CRITICAL_P99_MULTIPLIER || process.env.POKE_DYNAMIC_INSANE_P99_MULTIPLIER || 80);

  const LOOP_CRITICAL_ELU = Number(process.env.POKE_LOOP_CRITICAL_ELU || process.env.POKE_INSANE_ELU || 0.98);
  const LOOP_BUSY_ELU = Number(process.env.POKE_LOOP_BUSY_ELU || 0.92);

  const CRITICAL_STRIKES_TO_RESTART = Number(process.env.POKE_CRITICAL_STRIKES_TO_RESTART || process.env.POKE_INSANE_LAG_STRIKES || 3);
  const CRITICAL_STRIKE_WINDOW_MS = Number(process.env.POKE_CRITICAL_STRIKE_WINDOW_MS || process.env.POKE_INSANE_LAG_WINDOW_MS || 30_000);

  const OVERLOAD_LOG_COOLDOWN_MS = Number(process.env.POKE_OVERLOAD_LOG_COOLDOWN_MS || process.env.POKE_LAG_LOG_COOLDOWN_MS || 5_000);
  const OVERLOAD_POLICY_LOG_COOLDOWN_MS = Number(process.env.POKE_OVERLOAD_POLICY_LOG_COOLDOWN_MS || process.env.POKE_TOOBUSY_POLICY_LOG_COOLDOWN_MS || 15_000);
  const DIAGNOSTIC_REPORT_COOLDOWN_MS = Number(process.env.POKE_DIAGNOSTIC_REPORT_COOLDOWN_MS || process.env.POKE_LAG_REPORT_COOLDOWN_MS || 60_000);

  const RESTART_EXIT_GRACE_MS = Number(process.env.POKE_RESTART_EXIT_GRACE_MS || process.env.POKE_EXIT_GRACE_MS || 10_000);
  const CLIENT_RETRY_AFTER_SECONDS = Number(process.env.POKE_CLIENT_RETRY_AFTER_SECONDS || process.env.POKE_RETRY_AFTER_SECONDS || 15);

  const REQUEST_SLOW_LOG_MS = Number(process.env.POKE_REQUEST_SLOW_LOG_MS || process.env.POKE_REQUEST_SLOW_MS || 3000);
  const REQUEST_TRACK_MAX_ACTIVE = Number(process.env.POKE_REQUEST_TRACK_MAX_ACTIVE || process.env.POKE_MAX_TRACKED_ACTIVE_REQUESTS || 1000);
  const REQUEST_TRACK_MAX_RECENT_SLOW = Number(process.env.POKE_REQUEST_TRACK_MAX_RECENT_SLOW || process.env.POKE_MAX_RECENT_SLOW_REQUESTS || 20);

  const USER_GRACE_ENABLED = process.env.POKE_USER_GRACE_ENABLED !== "0" && process.env.POKE_NORMAL_USER_TOOBUSY_PROTECTION !== "0";
  const USER_GRACE_TOTAL_MS = Number(process.env.POKE_USER_GRACE_TOTAL_MS || process.env.POKE_NORMAL_USER_GRACE_MS || 1400);
  const USER_GRACE_POLL_MS = Number(process.env.POKE_USER_GRACE_POLL_MS || process.env.POKE_NORMAL_USER_GRACE_STEP_MS || 140);
  const USER_GRACE_JITTER_MS = Number(process.env.POKE_USER_GRACE_JITTER_MS || process.env.POKE_NORMAL_USER_GRACE_JITTER_MS || 180);
  const USER_PAGE_SOFT_PASS_ENABLED = process.env.POKE_USER_PAGE_SOFT_PASS !== "0" && process.env.POKE_NORMAL_USER_SOFT_PASS_ON_PAGE !== "0";

  const CLIENT_WINDOW_MS = Number(process.env.POKE_OVERLOAD_CLIENT_WINDOW_MS || process.env.POKE_TOOBUSY_CLIENT_WINDOW_MS || 30_000);
  const CLIENT_MAX_REQUESTS_PER_WINDOW = Number(process.env.POKE_OVERLOAD_CLIENT_MAX_REQUESTS_PER_WINDOW || process.env.POKE_NORMAL_USER_MAX_REQUESTS_PER_WINDOW || 45);
  const CLIENT_MAX_PAGE_SOFT_PASSES_PER_WINDOW = Number(process.env.POKE_OVERLOAD_CLIENT_MAX_PAGE_SOFT_PASSES_PER_WINDOW || process.env.POKE_NORMAL_USER_MAX_SOFT_PASSES_PER_WINDOW || 6);
  const CLIENT_MAX_REJECTS_BEFORE_COOLDOWN = Number(process.env.POKE_OVERLOAD_CLIENT_MAX_REJECTS_BEFORE_COOLDOWN || 4);
  const CLIENT_MAX_ACTIVE_REQUESTS_FOR_SOFT_PASS = Number(process.env.POKE_OVERLOAD_MAX_ACTIVE_FOR_SOFT_PASS || process.env.POKE_NORMAL_USER_MAX_ACTIVE_FOR_SOFT_PASS || 800);

  const CLIENT_HEAVY_REJECTS_BEFORE_COOLDOWN = Number(process.env.POKE_OVERLOAD_HEAVY_REJECTS_BEFORE_COOLDOWN || 3);
  const CLIENT_COOLDOWN_MS = Number(process.env.POKE_OVERLOAD_CLIENT_COOLDOWN_MS || 60_000);
  const CLIENT_COOLDOWN_MAX_MS = Number(process.env.POKE_OVERLOAD_CLIENT_COOLDOWN_MAX_MS || 10 * 60_000);

  const ALLOW_STATIC_DURING_SOFT_OVERLOAD = process.env.POKE_OVERLOAD_ALLOW_STATIC !== "0" && process.env.POKE_TOOBUSY_ALLOW_STATIC_DURING_SOFT_OVERLOAD !== "0";
  const ALLOW_STATUS_DURING_SOFT_OVERLOAD = process.env.POKE_OVERLOAD_ALLOW_STATUS !== "0" && process.env.POKE_TOOBUSY_ALLOW_HEALTH_DURING_SOFT_OVERLOAD !== "0";
  const CLIENT_STATE_CLEANUP_INTERVAL_MS = Number(process.env.POKE_OVERLOAD_CLIENT_CLEANUP_INTERVAL_MS || process.env.POKE_TOOBUSY_POLICY_CLEANUP_INTERVAL_MS || 60_000);

  const DIAGNOSTIC_REPORT_DIR = process.env.POKE_DIAGNOSTIC_REPORT_DIR || nodePath.join(process.cwd(), "reports");
  const DIAGNOSTIC_REPORTS_ENABLED = process.env.POKE_DIAGNOSTIC_REPORTS !== "0";

  const OVERLOAD_LOG_STYLE = String(process.env.POKE_OVERLOAD_LOG_STYLE || process.env.POKE_LAG_LOG_STYLE || "pretty").toLowerCase();
  const OVERLOAD_JSON_LOGS = process.env.POKE_OVERLOAD_JSON_LOGS === "1" || process.env.POKE_LAG_JSON_LOGS === "1" || OVERLOAD_LOG_STYLE === "json";

  let criticalStrikeTimes = [];
  let lastLagLogAt = 0;
  let lastPolicyLogAt = 0;
  let lastReportAt = 0;
  let overloadRestarting = false;

  let requestSequence = 0;
  const activeRequests = new Map();
  const activeRequestCounts = new Map();
  const recentSlowRequests = [];

  const overloadClients = new Map();
  let lastOverloadSnapshot = null;
  let lastOverloadSnapshotAt = 0;

  const overloadStats = {
    allowedHealthy: 0,
    allowedStatus: 0,
    allowedStatic: 0,
    pageGracePassed: 0,
    pageSoftPassed: 0,
    rejectedRestarting: 0,
    rejectedCritical: 0,
    rejectedCooldown: 0,
    rejectedHeavy: 0,
    rejectedBackground: 0,
    rejectedNoBudget: 0,
    rejectedGraceExpired: 0,
    cooldownsIssued: 0
  };

  let lastEventLoopUtilization = performance.eventLoopUtilization();
  let lastCpuUsage = process.cpuUsage();

  const adaptiveLoopLimits = {
    enabled: LOOP_DYNAMIC_LIMITS_ENABLED,
    dynamicToobusy: LOOP_DYNAMIC_TOOBUSY_ENABLED,
    samples: 0,
    baselineMs: 0,
    baselineP90Ms: 0,
    baselineP99Ms: 0,
    lastSampleP90Ms: 0,
    lastSampleP99Ms: 0,
    lastSampleMeanMs: 0,
    lastSampleMaxMs: 0,
    lastUpdatedAt: 0,
    warnLagMs: LOOP_WARN_LAG_MS_FLOOR,
    rejectLagMs: OVERLOAD_BASE_REJECT_LAG_MS,
    criticalLagMs: LOOP_CRITICAL_LAG_MS_FLOOR,
    criticalP99Ms: LOOP_CRITICAL_P99_MS_FLOOR
  };

  const loopDelay = monitorEventLoopDelay({ resolution: 20 });
  const loopBaselineDelay = monitorEventLoopDelay({ resolution: 20 });

  loopDelay.enable();
  loopBaselineDelay.enable();

  function bytesToMb(bytes) {
    return Math.round(bytes / 1024 / 1024) + "MB";
  }

  function nsToMs(ns) {
    if (!Number.isFinite(ns) || ns <= 0 || ns > 3_600_000_000_000) {
      return 0;
    }

    return Math.round((ns / 1_000_000) * 100) / 100;
  }

  function roundMs(value) {
    if (!Number.isFinite(value)) {
      return 0;
    }

    return Math.round(value * 100) / 100;
  }

  function roundRatio(value) {
    if (!Number.isFinite(value)) {
      return 0;
    }

    return Math.round(value * 10000) / 10000;
  }

  function clampNumber(value, min, max) {
    if (!Number.isFinite(value)) {
      return min;
    }

    return Math.max(min, Math.min(max, value));
  }

  function formatPercent(value) {
    if (!Number.isFinite(value)) {
      return "0%";
    }

    return (value * 100).toFixed(2) + "%";
  }

  function formatDuration(value) {
    if (!Number.isFinite(value)) {
      return "0s";
    }

    if (value < 1000) {
      return roundMs(value) + "ms";
    }

    return roundMs(value / 1000) + "s";
  }

  function sleep(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  function normalizePathname(pathname) {
    return String(pathname || "/")
      .replace(/[a-f0-9]{24}/gi, ":objectId")
      .replace(/[a-f0-9]{32,}/gi, ":hex")
      .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi, ":uuid")
      .replace(/\/\d{3,}(?=\/|$)/g, "/:number")
      .replace(/\/[A-Za-z0-9_-]{11}(?=\/|$)/g, "/:id");
  }

  function getRequestPath(req) {
    const url = req.originalUrl || req.url || "/";
    return (url.split("?")[0] || "/").toLowerCase();
  }

  function getRequestKey(req) {
    const pathname = getRequestPath(req);
    return req.method + " " + normalizePathname(pathname);
  }

  function incrementMapCount(map, key) {
    map.set(key, (map.get(key) || 0) + 1);
  }

  function decrementMapCount(map, key) {
    const nextValue = (map.get(key) || 0) - 1;

    if (nextValue <= 0) {
      map.delete(key);
      return;
    }

    map.set(key, nextValue);
  }

  function getTopMapEntries(map, limit) {
    return Array.from(map.entries())
      .sort(function (a, b) {
        return b[1] - a[1];
      })
      .slice(0, limit)
      .map(function (entry) {
        return {
          key: entry[0],
          count: entry[1]
        };
      });
  }

  function getActiveRequestSummary(limit) {
    const now = performance.now();

    return Array.from(activeRequests.values())
      .map(function (request) {
        return {
          id: request.id,
          key: request.key,
          ageMs: roundMs(now - request.startedAt)
        };
      })
      .sort(function (a, b) {
        return b.ageMs - a.ageMs;
      })
      .slice(0, limit);
  }

  function getActiveResourceCounts() {
    if (typeof process.getActiveResourcesInfo !== "function") {
      return {};
    }

    const counts = {};

    for (const resource of process.getActiveResourcesInfo()) {
      counts[resource] = (counts[resource] || 0) + 1;
    }

    return counts;
  }

  function getLoopDelaySnapshot() {
    return {
      minMs: nsToMs(loopDelay.min),
      meanMs: nsToMs(loopDelay.mean),
      maxMs: nsToMs(loopDelay.max),
      stddevMs: nsToMs(loopDelay.stddev),
      p50Ms: nsToMs(loopDelay.percentile(50)),
      p90Ms: nsToMs(loopDelay.percentile(90)),
      p99Ms: nsToMs(loopDelay.percentile(99))
    };
  }

  function getLoopBaselineSnapshot() {
    return {
      minMs: nsToMs(loopBaselineDelay.min),
      meanMs: nsToMs(loopBaselineDelay.mean),
      maxMs: nsToMs(loopBaselineDelay.max),
      stddevMs: nsToMs(loopBaselineDelay.stddev),
      p50Ms: nsToMs(loopBaselineDelay.percentile(50)),
      p90Ms: nsToMs(loopBaselineDelay.percentile(90)),
      p99Ms: nsToMs(loopBaselineDelay.percentile(99))
    };
  }

  function getEventLoopUtilizationSnapshot() {
    const delta = performance.eventLoopUtilization(lastEventLoopUtilization);
    lastEventLoopUtilization = performance.eventLoopUtilization();

    return {
      idleMs: roundMs(delta.idle),
      activeMs: roundMs(delta.active),
      utilization: roundRatio(delta.utilization)
    };
  }

  function getCpuUsageSnapshot() {
    const delta = process.cpuUsage(lastCpuUsage);
    lastCpuUsage = process.cpuUsage();

    return {
      userMs: roundMs(delta.user / 1000),
      systemMs: roundMs(delta.system / 1000),
      totalMs: roundMs((delta.user + delta.system) / 1000)
    };
  }

  function getLoopLimits() {
    return {
      dynamic: adaptiveLoopLimits.enabled,
      dynamicToobusy: adaptiveLoopLimits.dynamicToobusy,
      samples: adaptiveLoopLimits.samples,
      baselineMs: adaptiveLoopLimits.baselineMs,
      baselineP90Ms: adaptiveLoopLimits.baselineP90Ms,
      baselineP99Ms: adaptiveLoopLimits.baselineP99Ms,
      lastSampleP90Ms: adaptiveLoopLimits.lastSampleP90Ms,
      lastSampleP99Ms: adaptiveLoopLimits.lastSampleP99Ms,
      lastSampleMeanMs: adaptiveLoopLimits.lastSampleMeanMs,
      lastSampleMaxMs: adaptiveLoopLimits.lastSampleMaxMs,
      lastUpdatedAt: adaptiveLoopLimits.lastUpdatedAt,
      warnLagMs: adaptiveLoopLimits.warnLagMs,
      rejectLagMs: adaptiveLoopLimits.rejectLagMs,
      criticalLagMs: adaptiveLoopLimits.criticalLagMs,
      criticalP99Ms: adaptiveLoopLimits.criticalP99Ms,
      criticalElu: LOOP_CRITICAL_ELU,
      busyElu: LOOP_BUSY_ELU
    };
  }

  function updateToobusyRejectLag() {
    if (!LOOP_DYNAMIC_TOOBUSY_ENABLED) {
      return;
    }

    try {
      toobusy.maxLag(adaptiveLoopLimits.rejectLagMs);
    } catch (err) {
      console.error("[POKE-overload] failed to update toobusy maxLag:", err.message);
    }
  }

  function updateAdaptiveLoopLimits(reason) {
    if (!LOOP_DYNAMIC_LIMITS_ENABLED) {
      loopBaselineDelay.reset();
      return;
    }

    const sample = getLoopBaselineSnapshot();
    const sampleCandidateMs = Math.max(
      LOOP_BASELINE_MIN_MS,
      sample.p90Ms,
      sample.p99Ms,
      sample.meanMs * 3
    );

    adaptiveLoopLimits.lastSampleP90Ms = sample.p90Ms;
    adaptiveLoopLimits.lastSampleP99Ms = sample.p99Ms;
    adaptiveLoopLimits.lastSampleMeanMs = sample.meanMs;
    adaptiveLoopLimits.lastSampleMaxMs = sample.maxMs;
    adaptiveLoopLimits.lastUpdatedAt = Date.now();

    const usefulSample =
      Number.isFinite(sampleCandidateMs) &&
      sampleCandidateMs > 0 &&
      sampleCandidateMs <= LOOP_BASELINE_MAX_HEALTHY_MS;

    if (!usefulSample) {
      loopBaselineDelay.reset();
      return;
    }

    adaptiveLoopLimits.samples++;

    if (adaptiveLoopLimits.baselineMs <= 0) {
      adaptiveLoopLimits.baselineMs = sampleCandidateMs;
      adaptiveLoopLimits.baselineP90Ms = Math.max(LOOP_BASELINE_MIN_MS, sample.p90Ms);
      adaptiveLoopLimits.baselineP99Ms = Math.max(LOOP_BASELINE_MIN_MS, sample.p99Ms);
    } else {
      adaptiveLoopLimits.baselineMs =
        (adaptiveLoopLimits.baselineMs * (1 - LOOP_BASELINE_ALPHA)) +
        (sampleCandidateMs * LOOP_BASELINE_ALPHA);

      adaptiveLoopLimits.baselineP90Ms =
        (adaptiveLoopLimits.baselineP90Ms * (1 - LOOP_BASELINE_ALPHA)) +
        (Math.max(LOOP_BASELINE_MIN_MS, sample.p90Ms) * LOOP_BASELINE_ALPHA);

      adaptiveLoopLimits.baselineP99Ms =
        (adaptiveLoopLimits.baselineP99Ms * (1 - LOOP_BASELINE_ALPHA)) +
        (Math.max(LOOP_BASELINE_MIN_MS, sample.p99Ms) * LOOP_BASELINE_ALPHA);
    }

    const baseline = Math.max(LOOP_BASELINE_MIN_MS, adaptiveLoopLimits.baselineMs);
    const proposedWarnLagMs = baseline * LOOP_WARN_MULTIPLIER;
    const proposedRejectLagMs = baseline * LOOP_REJECT_MULTIPLIER;
    const proposedCriticalLagMs = Math.max(proposedRejectLagMs * 3, baseline * LOOP_CRITICAL_MULTIPLIER);
    const proposedCriticalP99Ms = Math.max(proposedRejectLagMs * 2, baseline * LOOP_CRITICAL_P99_MULTIPLIER);

    adaptiveLoopLimits.warnLagMs = roundMs(clampNumber(
      proposedWarnLagMs,
      LOOP_WARN_LAG_MS_FLOOR,
      LOOP_WARN_LAG_MS_CAP
    ));

    adaptiveLoopLimits.rejectLagMs = Math.round(clampNumber(
      proposedRejectLagMs,
      OVERLOAD_BASE_REJECT_LAG_MS,
      LOOP_REJECT_LAG_MS_CAP
    ));

    adaptiveLoopLimits.criticalLagMs = Math.round(clampNumber(
      proposedCriticalLagMs,
      LOOP_CRITICAL_LAG_MS_FLOOR,
      LOOP_CRITICAL_LAG_MS_CAP
    ));

    adaptiveLoopLimits.criticalP99Ms = Math.round(clampNumber(
      proposedCriticalP99Ms,
      LOOP_CRITICAL_P99_MS_FLOOR,
      LOOP_CRITICAL_P99_MS_CAP
    ));

    updateToobusyRejectLag();
    loopBaselineDelay.reset();
  }

  function getOverloadState(currentLagMs, delaySnapshot, eluSnapshot) {
    const limits = getLoopLimits();
    const p99LagMs = delaySnapshot.p99Ms;
    const maxLagMs = delaySnapshot.maxMs;
    const elu = eluSnapshot.utilization;

    if (overloadRestarting) {
      return "restarting";
    }

    if (
      currentLagMs >= limits.criticalLagMs ||
      p99LagMs >= limits.criticalP99Ms ||
      (elu >= limits.criticalElu && currentLagMs >= limits.rejectLagMs)
    ) {
      return "critical";
    }

    if (
      currentLagMs >= limits.rejectLagMs ||
      p99LagMs >= limits.rejectLagMs ||
      maxLagMs >= limits.criticalLagMs ||
      elu >= limits.busyElu
    ) {
      return "overloaded";
    }

    if (
      currentLagMs >= limits.warnLagMs ||
      p99LagMs >= limits.warnLagMs ||
      maxLagMs >= limits.warnLagMs
    ) {
      return "warm";
    }

    return "healthy";
  }

  function createOverloadSnapshot(currentLag, extra) {
    const currentLagMs = roundMs(currentLag);
    const memory = process.memoryUsage();
    const delaySnapshot = getLoopDelaySnapshot();
    const eluSnapshot = getEventLoopUtilizationSnapshot();
    const cpuSnapshot = getCpuUsageSnapshot();
    const limits = getLoopLimits();
    const state = getOverloadState(currentLagMs, delaySnapshot, eluSnapshot);

    return {
      reason: "event_loop_lag",
      state,
      source: {
        detector: "toobusy-js",
        note: "toobusy-js detected delayed event-loop polling; exact blocking call cannot be known from this callback alone"
      },
      lag: {
        currentMs: currentLagMs,
        warnMs: limits.warnLagMs,
        rejectMs: limits.rejectLagMs,
        baseRejectMs: OVERLOAD_BASE_REJECT_LAG_MS,
        dynamicToobusyEnabled: limits.dynamicToobusy,
        criticalMs: limits.criticalLagMs,
        criticalP99Ms: limits.criticalP99Ms,
        criticalElu: limits.criticalElu,
        strikes: criticalStrikeTimes.length,
        strikeWindowMs: CRITICAL_STRIKE_WINDOW_MS
      },
      adaptiveLimits: limits,
      eventLoopDelay: delaySnapshot,
      eventLoopUtilization: eluSnapshot,
      cpu: cpuSnapshot,
      memory: {
        rss: bytesToMb(memory.rss),
        heapUsed: bytesToMb(memory.heapUsed),
        heapTotal: bytesToMb(memory.heapTotal),
        external: bytesToMb(memory.external),
        arrayBuffers: bytesToMb(memory.arrayBuffers || 0)
      },
      process: {
        pid: process.pid,
        node: process.version,
        uptimeSeconds: Math.round(process.uptime()),
        platform: process.platform,
        arch: process.arch
      },
      system: {
        loadavg: os.loadavg().map(roundMs),
        freeMemory: bytesToMb(os.freemem()),
        totalMemory: bytesToMb(os.totalmem())
      },
      requests: {
        active: activeRequests.size,
        activeByRoute: getTopMapEntries(activeRequestCounts, 10),
        oldestActive: getActiveRequestSummary(10),
        recentSlow: recentSlowRequests.slice(-10).reverse()
      },
      resources: getActiveResourceCounts(),
      admission: {
        clients: overloadClients.size,
        userGraceEnabled: USER_GRACE_ENABLED,
        userGraceMs: USER_GRACE_TOTAL_MS,
        pageSoftPassEnabled: USER_PAGE_SOFT_PASS_ENABLED,
        stats: { ...overloadStats }
      },
      ...extra
    };
  }

  function formatRouteList(routes) {
    if (!routes || routes.length === 0) {
      return "none";
    }

    return routes
      .map(function (route) {
        return route.key + " x" + route.count;
      })
      .join(", ");
  }

  function formatOldestRequests(requests) {
    if (!requests || requests.length === 0) {
      return "none";
    }

    return requests
      .slice(0, 5)
      .map(function (request) {
        return request.key + " age=" + formatDuration(request.ageMs);
      })
      .join(", ");
  }

  function formatRecentSlowRequests(requests) {
    if (!requests || requests.length === 0) {
      return "none";
    }

    return requests
      .slice(0, 5)
      .map(function (request) {
        return request.key + " status=" + request.statusCode + " duration=" + formatDuration(request.durationMs);
      })
      .join(", ");
  }

  function formatResourceCounts(resources) {
    const entries = Object.entries(resources || {});

    if (entries.length === 0) {
      return "none";
    }

    return entries
      .sort(function (a, b) {
        return b[1] - a[1];
      })
      .slice(0, 10)
      .map(function (entry) {
        return entry[0] + "=" + entry[1];
      })
      .join(", ");
  }

  function getLikelyLagHints(snapshot) {
    const hints = [];

    if (snapshot.requests.activeByRoute.length > 0) {
      hints.push("busy routes: " + formatRouteList(snapshot.requests.activeByRoute.slice(0, 3)));
    }

    if (snapshot.requests.oldestActive.length > 0) {
      hints.push("oldest active: " + formatOldestRequests(snapshot.requests.oldestActive.slice(0, 3)));
    }

    if (snapshot.requests.recentSlow.length > 0) {
      hints.push("recent slow: " + formatRecentSlowRequests(snapshot.requests.recentSlow.slice(0, 3)));
    }

    const resources = formatResourceCounts(snapshot.resources);
    if (resources !== "none") {
      hints.push("active resources: " + resources);
    }

    if (hints.length === 0) {
      hints.push("no active request clue captured; likely sync CPU work, GC, startup work, dependency code, or another callback before this sample");
    }

    return hints;
  }

  function formatOverloadPretty(message, snapshot) {
    const lines = [];
    const lag = snapshot.lag;
    const limits = snapshot.adaptiveLimits;
    const delay = snapshot.eventLoopDelay;
    const elu = snapshot.eventLoopUtilization;
    const cpu = snapshot.cpu;
    const memory = snapshot.memory;
    const proc = snapshot.process;
    const system = snapshot.system;
    const hints = getLikelyLagHints(snapshot);

    lines.push("[POKE-overload] " + message);
    lines.push("  state: " + snapshot.state);
    lines.push(
      "  lag: current=" + lag.currentMs + "ms" +
      " warn=" + lag.warnMs + "ms" +
      " reject=" + lag.rejectMs + "ms" +
      " critical=" + lag.criticalMs + "ms" +
      " criticalP99=" + lag.criticalP99Ms + "ms" +
      " strikes=" + lag.strikes + "/" + CRITICAL_STRIKES_TO_RESTART
    );
    lines.push(
      "  adaptive limits: enabled=" + limits.dynamic +
      " dynamicToobusy=" + limits.dynamicToobusy +
      " samples=" + limits.samples +
      " baseline=" + roundMs(limits.baselineMs) + "ms" +
      " baselineP90=" + roundMs(limits.baselineP90Ms) + "ms" +
      " baselineP99=" + roundMs(limits.baselineP99Ms) + "ms"
    );
    lines.push(
      "  last baseline sample: p90=" + limits.lastSampleP90Ms + "ms" +
      " p99=" + limits.lastSampleP99Ms + "ms" +
      " mean=" + limits.lastSampleMeanMs + "ms" +
      " max=" + limits.lastSampleMaxMs + "ms"
    );
    lines.push(
      "  event loop delay: p50=" + delay.p50Ms + "ms" +
      " p90=" + delay.p90Ms + "ms" +
      " p99=" + delay.p99Ms + "ms" +
      " max=" + delay.maxMs + "ms" +
      " mean=" + delay.meanMs + "ms"
    );
    lines.push(
      "  event loop use: " + formatPercent(elu.utilization) +
      " active=" + formatDuration(elu.activeMs) +
      " idle=" + formatDuration(elu.idleMs)
    );
    lines.push(
      "  cpu: user=" + formatDuration(cpu.userMs) +
      " system=" + formatDuration(cpu.systemMs) +
      " total=" + formatDuration(cpu.totalMs)
    );
    lines.push(
      "  memory: rss=" + memory.rss +
      " heap=" + memory.heapUsed + "/" + memory.heapTotal +
      " external=" + memory.external +
      " arrayBuffers=" + memory.arrayBuffers
    );
    lines.push(
      "  process: pid=" + proc.pid +
      " uptime=" + proc.uptimeSeconds + "s" +
      " node=" + proc.node +
      " platform=" + proc.platform +
      " arch=" + proc.arch
    );
    lines.push(
      "  system: loadavg=" + system.loadavg.join(",") +
      " free=" + system.freeMemory +
      " total=" + system.totalMemory
    );
    lines.push(
      "  requests: active=" + snapshot.requests.active +
      " top=[" + formatRouteList(snapshot.requests.activeByRoute.slice(0, 5)) + "]"
    );
    lines.push("  oldest active: " + formatOldestRequests(snapshot.requests.oldestActive));
    lines.push("  recent slow: " + formatRecentSlowRequests(snapshot.requests.recentSlow));
    lines.push("  resources: " + formatResourceCounts(snapshot.resources));
    lines.push(
      "  admission: clients=" + snapshot.admission.clients +
      " graceMs=" + snapshot.admission.userGraceMs +
      " graceEnabled=" + snapshot.admission.userGraceEnabled +
      " pageSoftPass=" + snapshot.admission.pageSoftPassEnabled +
      " stats=" + JSON.stringify(snapshot.admission.stats)
    );
    lines.push("  likely clues:");
    for (const hint of hints) {
      lines.push("    - " + hint);
    }

    if (snapshot.restart) {
      lines.push(
        "  restart: grace=" + snapshot.restart.exitGraceMs + "ms" +
        " retryAfter=" + snapshot.restart.retryAfterSeconds + "s" +
        " report=" + (snapshot.restart.diagnosticReport || "not written")
      );
    }

    if (snapshot.diagnosticReport) {
      lines.push("  diagnostic report: " + snapshot.diagnosticReport);
    }

    lines.push("  note: exact blocking function cannot be recovered from this callback alone");
    lines.push("  set POKE_OVERLOAD_LOG_STYLE=json for machine-readable logs");

    return lines.join("\n");
  }

  function logOverload(message, snapshot) {
    if (OVERLOAD_JSON_LOGS) {
      console.error("[POKE-overload] " + message + " " + JSON.stringify(snapshot));
      return;
    }

    console.error(formatOverloadPretty(message, snapshot));
  }

  function shouldWriteDiagnosticReport() {
    if (!DIAGNOSTIC_REPORTS_ENABLED) {
      return false;
    }

    if (!process.report || typeof process.report.writeReport !== "function") {
      return false;
    }

    const now = Date.now();

    if (now - lastReportAt < DIAGNOSTIC_REPORT_COOLDOWN_MS) {
      return false;
    }

    lastReportAt = now;
    return true;
  }

  function writeDiagnosticReport(snapshot) {
    if (!shouldWriteDiagnosticReport()) {
      return null;
    }

    try {
      fs.mkdirSync(DIAGNOSTIC_REPORT_DIR, { recursive: true });

      const filename = nodePath.join(
        DIAGNOSTIC_REPORT_DIR,
        "event-loop-lag-" + Date.now() + "-pid-" + process.pid + ".json"
      );

      const err = new Error(
        "Sustained event-loop lag: " +
        snapshot.lag.currentMs +
        "ms, p99: " +
        snapshot.eventLoopDelay.p99Ms +
        "ms, max: " +
        snapshot.eventLoopDelay.maxMs +
        "ms"
      );

      return process.report.writeReport(filename, err);
    } catch (err) {
      console.error("[POKE-overload] failed to write diagnostic report", err);
      return null;
    }
  }

  function recordCriticalStrike() {
    const now = Date.now();

    criticalStrikeTimes = criticalStrikeTimes.filter(function (time) {
      return now - time <= CRITICAL_STRIKE_WINDOW_MS;
    });

    criticalStrikeTimes.push(now);

    return criticalStrikeTimes.length;
  }

  function resetCriticalStrikesIfHealthy(currentLag, snapshot) {
    const limits = getLoopLimits();

    if (currentLag >= limits.rejectLagMs) {
      return;
    }

    if (snapshot.eventLoopDelay.p99Ms >= limits.rejectLagMs) {
      return;
    }

    if (snapshot.eventLoopUtilization.utilization >= LOOP_BUSY_ELU) {
      return;
    }

    criticalStrikeTimes = [];
  }

  function isCriticalLag(currentLag, snapshot) {
    const limits = getLoopLimits();

    return (
      currentLag >= limits.criticalLagMs ||
      snapshot.eventLoopDelay.p99Ms >= limits.criticalP99Ms ||
      (
        snapshot.eventLoopUtilization.utilization >= limits.criticalElu &&
        currentLag >= limits.rejectLagMs
      )
    );
  }

  function getClientKey(req) {
    return String(req.ip || req.socket.remoteAddress || "unknown").replace("::ffff:", "");
  }

  function pruneClientState(client, now) {
    const oldest = now - CLIENT_WINDOW_MS;

    while (client.requestTimes.length > 0 && client.requestTimes[0] < oldest) {
      client.requestTimes.shift();
    }

    while (client.pageSoftPassTimes.length > 0 && client.pageSoftPassTimes[0] < oldest) {
      client.pageSoftPassTimes.shift();
    }

    while (client.pageGracePassTimes.length > 0 && client.pageGracePassTimes[0] < oldest) {
      client.pageGracePassTimes.shift();
    }

    while (client.rejectTimes.length > 0 && client.rejectTimes[0] < oldest) {
      client.rejectTimes.shift();
    }

    while (client.heavyRejectTimes.length > 0 && client.heavyRejectTimes[0] < oldest) {
      client.heavyRejectTimes.shift();
    }

    if (client.cooldownUntil > 0 && client.cooldownUntil <= now) {
      client.cooldownUntil = 0;
      client.cooldownLevel = Math.max(0, client.cooldownLevel - 1);
    }
  }

  function getClientState(req) {
    const key = getClientKey(req);
    const now = Date.now();
    let client = overloadClients.get(key);

    if (!client) {
      client = {
        key,
        requestTimes: [],
        pageSoftPassTimes: [],
        pageGracePassTimes: [],
        rejectTimes: [],
        heavyRejectTimes: [],
        cooldownUntil: 0,
        cooldownLevel: 0,
        lastSeen: now,
        lastPath: "",
        lastKind: "",
        lastDecision: ""
      };
      overloadClients.set(key, client);
    }

    client.lastSeen = now;
    pruneClientState(client, now);
    return client;
  }

  function rememberRequest(req, client, kind) {
    const now = Date.now();
    client.lastSeen = now;
    client.lastPath = getRequestPath(req);
    client.lastKind = kind;
    client.requestTimes.push(now);
    pruneClientState(client, now);
  }

  function rememberDecision(client, decision, kind) {
    const now = Date.now();
    client.lastDecision = decision;

    if (decision === "page-soft-pass") {
      client.pageSoftPassTimes.push(now);
    }

    if (decision === "page-grace-pass") {
      client.pageGracePassTimes.push(now);
    }

    if (decision === "reject") {
      client.rejectTimes.push(now);
    }

    if (decision === "reject" && (kind === "heavy" || kind === "background")) {
      client.heavyRejectTimes.push(now);
    }

    pruneClientState(client, now);
  }

  function applyClientCooldown(client, reason) {
    const now = Date.now();

    client.cooldownLevel++;
    const cooldownMs = Math.min(
      CLIENT_COOLDOWN_MAX_MS,
      CLIENT_COOLDOWN_MS * Math.pow(2, Math.max(0, client.cooldownLevel - 1))
    );

    client.cooldownUntil = now + cooldownMs;
    overloadStats.cooldownsIssued++;

    console.error(
      "[POKE-overload-policy] cooldown issued " +
      JSON.stringify({
        reason,
        cooldownMs,
        cooldownLevel: client.cooldownLevel,
        client: {
          requests: client.requestTimes.length,
          rejects: client.rejectTimes.length,
          heavyRejects: client.heavyRejectTimes.length,
          lastPath: client.lastPath,
          lastKind: client.lastKind
        }
      })
    );
  }

  function isSafeMethod(req) {
    return req.method === "GET" || req.method === "HEAD";
  }

  function isStaticRequest(req) {
    const pathname = getRequestPath(req);

    if (/^\/(css|js|img|font|static|favicon\.ico|manifest\.json|robots\.txt)(\/|$)/i.test(pathname)) {
      return true;
    }

    return /\.(css|js|mjs|png|jpg|jpeg|webp|gif|svg|ico|woff|woff2|ttf|otf|map|txt)$/i.test(pathname);
  }

  function isStatusRequest(req) {
    const pathname = getRequestPath(req);

    return (
      pathname === "/robots.txt" ||
      pathname === "/favicon.ico" ||
      pathname === "/_pokestopskids/stats" ||
      pathname === "/_pokeoverload/stats" ||
      pathname === "/_antiddos" ||
      pathname.startsWith("/_antiddos/")
    );
  }

  function isLikelyAutomationUserAgent(req) {
    const ua = String(req.headers["user-agent"] || "").toLowerCase();

    if (!ua) {
      return false;
    }

    return (
      ua.includes("curl") ||
      ua.includes("wget") ||
      ua.includes("python-requests") ||
      ua.includes("python/") ||
      ua.includes("aiohttp") ||
      ua.includes("httpx") ||
      ua.includes("axios") ||
      ua.includes("node-fetch") ||
      ua.includes("undici") ||
      ua.includes("go-http-client") ||
      ua.includes("java/") ||
      ua.includes("okhttp") ||
      ua.includes("libwww") ||
      ua.includes("scrapy") ||
      ua.includes("crawler") ||
      ua.includes("spider")
    );
  }

  function isHeavyRequest(req) {
    const pathname = getRequestPath(req);

    if (!isSafeMethod(req)) {
      return true;
    }

    return (
      pathname.startsWith("/api/") ||
      pathname.startsWith("/proxy/") ||
      pathname.startsWith("/videoplayback") ||
      pathname.startsWith("/vi/") ||
      pathname.startsWith("/ggpht/") ||
      pathname.startsWith("/avatars/") ||
      pathname.startsWith("/storyboard") ||
      pathname.startsWith("/sb/") ||
      pathname.startsWith("/manifest") ||
      pathname.startsWith("/channel_uploads") ||
      pathname.startsWith("/music")
    );
  }

  function isBackgroundRequest(req) {
    const accept = String(req.headers.accept || "").toLowerCase();
    const secFetchDest = String(req.headers["sec-fetch-dest"] || "").toLowerCase();
    const secFetchMode = String(req.headers["sec-fetch-mode"] || "").toLowerCase();

    if (!isSafeMethod(req)) {
      return true;
    }

    if (accept.includes("application/json") && !accept.includes("text/html")) {
      return true;
    }

    if (secFetchDest === "empty" && secFetchMode === "cors") {
      return true;
    }

    return false;
  }

  function isPageNavigation(req) {
    const pathname = getRequestPath(req);
    const accept = String(req.headers.accept || "").toLowerCase();
    const secFetchDest = String(req.headers["sec-fetch-dest"] || "").toLowerCase();
    const secFetchMode = String(req.headers["sec-fetch-mode"] || "").toLowerCase();

    if (!isSafeMethod(req)) {
      return false;
    }

    if (isStaticRequest(req) || isHeavyRequest(req) || isBackgroundRequest(req)) {
      return false;
    }

    if (
      pathname === "/" ||
      pathname === "/watch" ||
      pathname === "/search" ||
      pathname === "/hashtag" ||
      pathname.startsWith("/watch/") ||
      pathname.startsWith("/search/") ||
      pathname.startsWith("/channel/") ||
      pathname.startsWith("/user/") ||
      pathname.startsWith("/playlist")
    ) {
      return true;
    }

    if (accept.includes("text/html")) {
      return true;
    }

    if (secFetchDest === "document" || secFetchMode === "navigate") {
      return true;
    }

    return false;
  }

  function classifyRequest(req) {
    if (isStatusRequest(req)) {
      return "status";
    }

    if (isStaticRequest(req)) {
      return "static";
    }

    if (isHeavyRequest(req)) {
      return "heavy";
    }

    if (isBackgroundRequest(req)) {
      return "background";
    }

    if (isPageNavigation(req)) {
      return "page";
    }

    return "other";
  }

  function getCurrentPolicyState() {
    if (overloadRestarting) {
      return "restarting";
    }

    if (lastOverloadSnapshot && Date.now() - lastOverloadSnapshotAt <= Math.max(30_000, OVERLOAD_LOG_COOLDOWN_MS * 4)) {
      return lastOverloadSnapshot.state || "overloaded";
    }

    return "overloaded";
  }

  function isHardOverloadState() {
    const state = getCurrentPolicyState();
    return state === "critical" || state === "restarting";
  }

  function canSpendPageSoftPass(req, client) {
    if (!USER_GRACE_ENABLED || !USER_PAGE_SOFT_PASS_ENABLED) {
      return false;
    }

    if (isLikelyAutomationUserAgent(req)) {
      return false;
    }

    if (client.requestTimes.length > CLIENT_MAX_REQUESTS_PER_WINDOW) {
      return false;
    }

    if (client.pageSoftPassTimes.length >= CLIENT_MAX_PAGE_SOFT_PASSES_PER_WINDOW) {
      return false;
    }

    if (client.rejectTimes.length >= CLIENT_MAX_REJECTS_BEFORE_COOLDOWN) {
      return false;
    }

    if (activeRequests.size >= CLIENT_MAX_ACTIVE_REQUESTS_FOR_SOFT_PASS) {
      return false;
    }

    return true;
  }

  function maybeCooldownClient(client, kind, reason) {
    if (client.cooldownUntil > Date.now()) {
      return;
    }

    if (client.rejectTimes.length >= CLIENT_MAX_REJECTS_BEFORE_COOLDOWN) {
      applyClientCooldown(client, reason || "too many overload rejects");
      return;
    }

    if ((kind === "heavy" || kind === "background") && client.heavyRejectTimes.length >= CLIENT_HEAVY_REJECTS_BEFORE_COOLDOWN) {
      applyClientCooldown(client, reason || "too many heavy overload rejects");
    }
  }

  function getAdmissionDecision(req, client, kind) {
    const state = getCurrentPolicyState();
    const now = Date.now();

    if (overloadRestarting || state === "restarting") {
      return {
        action: "reject",
        reason: "restarting",
        status: 503,
        retryAfter: CLIENT_RETRY_AFTER_SECONDS,
        message: "Server is recovering from high load. Please retry shortly."
      };
    }

    if (client.cooldownUntil > now) {
      return {
        action: "reject",
        reason: "client-overload-cooldown",
        status: 429,
        retryAfter: Math.ceil((client.cooldownUntil - now) / 1000),
        message: "Too many expensive requests during overload. Please retry shortly."
      };
    }

    if (state === "critical") {
      if (ALLOW_STATUS_DURING_SOFT_OVERLOAD && kind === "status") {
        return {
          action: "allow",
          reason: "status-critical-pass"
        };
      }

      return {
        action: "reject",
        reason: "critical-overload",
        status: 503,
        retryAfter: CLIENT_RETRY_AFTER_SECONDS,
        message: "Server is under heavy load. Please retry shortly."
      };
    }

    if (ALLOW_STATUS_DURING_SOFT_OVERLOAD && kind === "status") {
      return {
        action: "allow",
        reason: "status-soft-pass"
      };
    }

    if (ALLOW_STATIC_DURING_SOFT_OVERLOAD && kind === "static" && isSafeMethod(req)) {
      return {
        action: "allow",
        reason: "static-soft-pass"
      };
    }

    if (kind === "heavy") {
      return {
        action: "reject",
        reason: "heavy-shed-first",
        status: 503,
        retryAfter: CLIENT_RETRY_AFTER_SECONDS,
        message: "Server is busy. Please retry shortly."
      };
    }

    if (kind === "background") {
      return {
        action: "reject",
        reason: "background-shed-first",
        status: 503,
        retryAfter: CLIENT_RETRY_AFTER_SECONDS,
        message: "Server is busy. Please retry shortly."
      };
    }

    if (kind === "page" && canSpendPageSoftPass(req, client)) {
      return {
        action: "grace",
        reason: "page-grace"
      };
    }

    return {
      action: "reject",
      reason: "no-soft-pass-budget",
      status: 503,
      retryAfter: CLIENT_RETRY_AFTER_SECONDS,
      message: "Server is busy. Please retry shortly."
    };
  }

  function logAdmission(message, client) {
    const now = Date.now();

    if (now - lastPolicyLogAt < OVERLOAD_POLICY_LOG_COOLDOWN_MS) {
      return;
    }

    lastPolicyLogAt = now;

    console.error(
      "[POKE-overload-policy] " + message + " " +
      JSON.stringify({
        clients: overloadClients.size,
        activeRequests: activeRequests.size,
        state: getCurrentPolicyState(),
        client: client
          ? {
              requests: client.requestTimes.length,
              pageSoftPasses: client.pageSoftPassTimes.length,
              pageGracePasses: client.pageGracePassTimes.length,
              rejects: client.rejectTimes.length,
              heavyRejects: client.heavyRejectTimes.length,
              cooldownUntil: client.cooldownUntil,
              cooldownLevel: client.cooldownLevel,
              lastPath: client.lastPath,
              lastKind: client.lastKind,
              lastDecision: client.lastDecision
            }
          : null,
        stats: overloadStats
      })
    );
  }

  function rejectDuringOverload(req, res, client, kind, decision) {
    rememberDecision(client, "reject", kind);

    if (decision.reason === "restarting") {
      overloadStats.rejectedRestarting++;
    } else if (decision.reason === "critical-overload") {
      overloadStats.rejectedCritical++;
    } else if (decision.reason === "client-overload-cooldown") {
      overloadStats.rejectedCooldown++;
    } else if (decision.reason === "heavy-shed-first") {
      overloadStats.rejectedHeavy++;
    } else if (decision.reason === "background-shed-first") {
      overloadStats.rejectedBackground++;
    } else if (decision.reason === "normal-page-grace-expired") {
      overloadStats.rejectedGraceExpired++;
    } else if (decision.reason === "no-soft-pass-budget") {
      overloadStats.rejectedNoBudget++;
    } else {
      overloadStats.rejectedNoBudget++;
    }

    maybeCooldownClient(client, kind, decision.reason);
    logAdmission("rejected request during overload: " + decision.reason, client);

    res.set("Retry-After", String(decision.retryAfter || CLIENT_RETRY_AFTER_SECONDS));
    res.set("Cache-Control", "no-store");
    res.set("Connection", "close");
    res.set("X-Poke-Overload-Policy", decision.reason);
    return res.status(decision.status || 503).send(decision.message || "Server is busy. Please retry shortly.");
  }

  async function handlePageGrace(req, res, next, client, kind) {
    const jitter = USER_GRACE_JITTER_MS > 0
      ? Math.floor(Math.random() * USER_GRACE_JITTER_MS)
      : 0;

    const graceBudgetMs = Math.max(0, USER_GRACE_TOTAL_MS + jitter);
    const startedAt = performance.now();

    while (!res.headersSent && performance.now() - startedAt < graceBudgetMs) {
      if (overloadRestarting || isHardOverloadState()) {
        break;
      }

      if (!toobusy()) {
        rememberDecision(client, "page-grace-pass", kind);
        overloadStats.pageGracePassed++;
        return next();
      }

      await sleep(USER_GRACE_POLL_MS);
    }

    if (
      !res.headersSent &&
      USER_PAGE_SOFT_PASS_ENABLED &&
      !overloadRestarting &&
      !isHardOverloadState() &&
      canSpendPageSoftPass(req, client)
    ) {
      rememberDecision(client, "page-soft-pass", kind);
      overloadStats.pageSoftPassed++;
      logAdmission("soft-passed page request during overload", client);
      return next();
    }

    return rejectDuringOverload(req, res, client, kind, {
      action: "reject",
      reason: "normal-page-grace-expired",
      status: 503,
      retryAfter: CLIENT_RETRY_AFTER_SECONDS,
      message: "Server is busy. Please retry shortly."
    });
  }

  function shutdownToobusy() {
    if (typeof toobusy.shutdown !== "function") {
      return;
    }

    try {
      toobusy.shutdown();
    } catch (err) {
      console.error("[POKE-overload] failed to shutdown toobusy monitor", err);
    }
  }

  function beginOverloadRestart(currentLag, snapshot) {
    if (overloadRestarting) {
      return;
    }

    overloadRestarting = true;

    const reportPath = writeDiagnosticReport(snapshot);

    logOverload(
      "sustained critical event-loop lag, refusing new requests and restarting",
      {
        ...snapshot,
        restart: {
          exitGraceMs: RESTART_EXIT_GRACE_MS,
          retryAfterSeconds: CLIENT_RETRY_AFTER_SECONDS,
          diagnosticReport: reportPath
        }
      }
    );

    shutdownToobusy();

    const exitTimer = setTimeout(function () {
      console.error("[POKE-overload] exiting after sustained critical event-loop lag");
      process.exit(1);
    }, RESTART_EXIT_GRACE_MS);

    exitTimer.unref();
  }

  function requestActivityTracker(req, res, next) {
    const id = ++requestSequence;
    const key = getRequestKey(req);
    const startedAt = performance.now();

    if (activeRequests.size < REQUEST_TRACK_MAX_ACTIVE) {
      activeRequests.set(id, {
        id,
        key,
        startedAt
      });

      incrementMapCount(activeRequestCounts, key);
    }

    res.on("finish", function () {
      const finishedAt = performance.now();
      const durationMs = roundMs(finishedAt - startedAt);

      if (activeRequests.has(id)) {
        activeRequests.delete(id);
        decrementMapCount(activeRequestCounts, key);
      }

      if (durationMs >= REQUEST_SLOW_LOG_MS) {
        recentSlowRequests.push({
          key,
          statusCode: res.statusCode,
          durationMs
        });

        while (recentSlowRequests.length > REQUEST_TRACK_MAX_RECENT_SLOW) {
          recentSlowRequests.shift();
        }
      }
    });

    res.on("close", function () {
      if (activeRequests.has(id)) {
        activeRequests.delete(id);
        decrementMapCount(activeRequestCounts, key);
      }
    });

    next();
  }

  function overloadAdmissionMiddleware(req, res, next) {
    const client = getClientState(req);
    const kind = classifyRequest(req);

    rememberRequest(req, client, kind);

    if (overloadRestarting) {
      return rejectDuringOverload(req, res, client, kind, {
        action: "reject",
        reason: "restarting",
        status: 503,
        retryAfter: CLIENT_RETRY_AFTER_SECONDS,
        message: "Server is recovering from high load. Please retry shortly."
      });
    }

    if (!toobusy()) {
      overloadStats.allowedHealthy++;
      return next();
    }

    const decision = getAdmissionDecision(req, client, kind);

    if (decision.action === "allow") {
      if (kind === "status") {
        overloadStats.allowedStatus++;
      } else if (kind === "static") {
        overloadStats.allowedStatic++;
      }

      client.lastDecision = decision.reason;
      return next();
    }

    if (decision.action === "grace") {
      return handlePageGrace(req, res, next, client, kind).catch(next);
    }

    return rejectDuringOverload(req, res, client, kind, decision);
  }

  function handleShutdownSignal(signal) {
    overloadRestarting = true;
    shutdownToobusy();

    console.error("[POKE-overload] received " + signal + ", shutting down overload monitor");

    const signalExitTimer = setTimeout(function () {
      process.exit(0);
    }, 1000);

    signalExitTimer.unref();
  }

  toobusy.interval(OVERLOAD_CHECK_INTERVAL_MS);
  toobusy.maxLag(OVERLOAD_BASE_REJECT_LAG_MS);

  app.use(requestActivityTracker);
  app.use(overloadAdmissionMiddleware);

  app.get("/_pokeoverload/stats", function (req, res) {
    const state = getCurrentPolicyState();
    const limits = getLoopLimits();
    const now = Date.now();

    let clientsInCooldown = 0;
    let activeClients = 0;

    for (const [, client] of overloadClients) {
      pruneClientState(client, now);

      if (client.cooldownUntil > now) {
        clientsInCooldown++;
      }

      if (client.requestTimes.length > 0) {
        activeClients++;
      }
    }

    res.json({
      state,
      restarting: overloadRestarting,
      clients: {
        tracked: overloadClients.size,
        active: activeClients,
        cooldown: clientsInCooldown,
        window_ms: CLIENT_WINDOW_MS
      },
      requests: {
        active: activeRequests.size,
        top_active_routes: getTopMapEntries(activeRequestCounts, 10),
        oldest_active: getActiveRequestSummary(10),
        recent_slow: recentSlowRequests.slice(-10).reverse()
      },
      limits,
      policy: {
        user_grace_enabled: USER_GRACE_ENABLED,
        user_grace_ms: USER_GRACE_TOTAL_MS,
        user_grace_poll_ms: USER_GRACE_POLL_MS,
        user_page_soft_pass_enabled: USER_PAGE_SOFT_PASS_ENABLED,
        client_max_requests_per_window: CLIENT_MAX_REQUESTS_PER_WINDOW,
        client_max_page_soft_passes_per_window: CLIENT_MAX_PAGE_SOFT_PASSES_PER_WINDOW,
        client_max_rejects_before_cooldown: CLIENT_MAX_REJECTS_BEFORE_COOLDOWN,
        client_cooldown_ms: CLIENT_COOLDOWN_MS,
        client_cooldown_max_ms: CLIENT_COOLDOWN_MAX_MS
      },
      stats: overloadStats,
      last_snapshot: lastOverloadSnapshot
        ? {
            state: lastOverloadSnapshot.state,
            lag: lastOverloadSnapshot.lag,
            eventLoopDelay: lastOverloadSnapshot.eventLoopDelay,
            eventLoopUtilization: lastOverloadSnapshot.eventLoopUtilization,
            requests: lastOverloadSnapshot.requests
          }
        : null
    });
  });

  updateAdaptiveLoopLimits("startup");

  const adaptiveLimitTimer = setInterval(function () {
    updateAdaptiveLoopLimits("interval");
  }, LOOP_BASELINE_SAMPLE_INTERVAL_MS);

  adaptiveLimitTimer.unref();

  const clientCleanupTimer = setInterval(function () {
    const now = Date.now();
    const maxAge = CLIENT_WINDOW_MS * 3;

    for (const [key, client] of overloadClients) {
      pruneClientState(client, now);

      if (
        client.requestTimes.length === 0 &&
        client.pageSoftPassTimes.length === 0 &&
        client.pageGracePassTimes.length === 0 &&
        client.rejectTimes.length === 0 &&
        client.heavyRejectTimes.length === 0 &&
        client.cooldownUntil <= now &&
        now - client.lastSeen > maxAge
      ) {
        overloadClients.delete(key);
      }
    }
  }, CLIENT_STATE_CLEANUP_INTERVAL_MS);

  clientCleanupTimer.unref();

  toobusy.onLag(function (currentLag) {
    const now = Date.now();
    const snapshot = createOverloadSnapshot(currentLag);
    const critical = isCriticalLag(currentLag, snapshot);

    lastOverloadSnapshot = snapshot;
    lastOverloadSnapshotAt = now;

    if (now - lastLagLogAt >= OVERLOAD_LOG_COOLDOWN_MS || critical) {
      lastLagLogAt = now;
      logOverload("event-loop lag detected", snapshot);
    }

    if (!critical) {
      resetCriticalStrikesIfHealthy(currentLag, snapshot);
      loopDelay.reset();
      return;
    }

    const strikeCount = recordCriticalStrike();

    const strikeSnapshot = {
      ...snapshot,
      lag: {
        ...snapshot.lag,
        strikes: strikeCount
      }
    };

    const reportPath = writeDiagnosticReport(strikeSnapshot);
    const loggedStrikeSnapshot = {
      ...strikeSnapshot,
      diagnosticReport: reportPath
    };

    logOverload(
      "critical event-loop lag strike " + strikeCount + "/" + CRITICAL_STRIKES_TO_RESTART,
      loggedStrikeSnapshot
    );

    if (strikeCount >= CRITICAL_STRIKES_TO_RESTART) {
      beginOverloadRestart(currentLag, strikeSnapshot);
      return;
    }

    loopDelay.reset();
  });

  process.once("SIGTERM", function () {
    handleShutdownSignal("SIGTERM");
  });

  process.once("SIGINT", function () {
    handleShutdownSignal("SIGINT");
  });

  initlog(
    "[PokeOverloadShield] loaded - " +
    "rejectLag: " + OVERLOAD_BASE_REJECT_LAG_MS + "ms, " +
    "dynamicLimits: " + LOOP_DYNAMIC_LIMITS_ENABLED + ", " +
    "dynamicToobusy: " + LOOP_DYNAMIC_TOOBUSY_ENABLED + ", " +
    "pageGrace: " + USER_GRACE_TOTAL_MS + "ms, " +
    "clientWindow: " + CLIENT_WINDOW_MS + "ms, " +
    "cooldown: " + CLIENT_COOLDOWN_MS + "ms"
  );
})();
  
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