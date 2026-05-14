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

  const dotenvPath = path.resolve(process.cwd(), ".env");

  try {
    fs.accessSync(dotenvPath, fs.constants.F_OK);
    try {
      require("dotenv").config({ path: dotenvPath });
      initlog("[POKE-trust-proxy] found .env, loaded it");
    } catch (e) {
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

  function checkUserOverride() {
    const val = (process.env.TRUST_PROXY || "").toLowerCase().trim();
    if (!val) return null;

    if (val === "true" || val === "1" || val === "yes") return "force-on";
    if (val === "false" || val === "0" || val === "no") return "force-off";

    const num = parseInt(val, 10);
    if (!isNaN(num) && num > 0) return num;

    return val;
  }

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
    initlog("[POKE-trust-proxy] auto-enabled (confidence: " + totalConfidence + ")");
    return;
  }

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
      app.set("trust proxy", buildTrustFunction());
      initlog("[POKE-trust-proxy] confirmed proxy on first request (score: " + headerScore + ")");
      logProxyHeaders(req);
    } else if (headerScore >= 3 && !remoteIsPrivate) {
      app.set("trust proxy", false);
      initlog("[POKE-trust-proxy] proxy headers from public ip " + remoteAddr + ", ignoring");
    } else {
      app.set("trust proxy", false);
      initlog("[POKE-trust-proxy] no proxy headers, disabled");
    }

    next();
  });

  setInterval(() => {
    const freshEnv = detectEnvSignals();
    const freshFs = detectFilesystemSignals();
    const freshScore = freshEnv.length * 3 + freshFs.length * 2;

    if (freshScore >= 2 && !probeComplete) {
      app.set("trust proxy", buildTrustFunction());
      initlog("[POKE-trust-proxy] periodic re-check found proxy (score: " + freshScore + ")");
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

  const KNOWN_BOT_PATTERNS = [
    /googlebot/i, /bingbot/i, /slurp/i, /duckduckbot/i,
    /baiduspider/i, /yandexbot/i, /sogou/i, /exabot/i,
    /facebot/i, /ia_archiver/i, /archive\.org_bot/i,
    /qwantify/i, /seznambot/i, /mojeekbot/i,
    /petalsearch/i, /applebot/i,
    /discordbot/i, /telegrambot/i, /twitterbot/i,
    /whatsapp/i, /slackbot/i, /linkedinbot/i,
    /mastodon/i, /pleroma/i, /misskey/i, /akkoma/i,
    /lemmy/i, /kbin/i, /pixelfed/i, /gotosocial/i,
    /uptimerobot/i, /pingdom/i, /statuscake/i,
    /site24x7/i, /hetrixtools/i, /freshping/i,
    /cloudflare/i, /cloudfront/i, /fastly/i,
    /feedfetcher/i, /feedly/i, /newsblur/i,
    /tiny\s?tiny\s?rss/i, /miniflux/i,
    /researchscan/i, /censys/i, /semrush/i, /ahrefs/i,
  ];

  function isKnownBot(ua) {
    if (!ua) return false;
    return KNOWN_BOT_PATTERNS.some(p => p.test(ua));
  }

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

  const ipData = new Map();

  let globalRequestsLastSecond = 0;
  let globalRequestsThisSecond = 0;
  let siegeMode = false;
  let siegeStartedAt = 0;
  let lastSecondTick = Date.now();

  const BURST_LIMIT = 50;
  const SUSTAINED_LIMIT = 200;
  const SUSTAINED_WINDOW = 10000;
  const BAN_BASE_MS = 30000;
  const BAN_MAX_MS = 600000;
  const STRIKE_DECAY_MS = 300000;
  const CLEANUP_INTERVAL = 60000;
  const MAX_TRACKED_IPS = 50000;

  const WATCH_BURST_LIMIT = 20;
  const WATCH_SUSTAINED_LIMIT = 80;

  const TIMING_VARIANCE_THRESHOLD = 5;
  const TIMING_MIN_SAMPLES = 15;

  const SIEGE_THRESHOLD = 2000;
  const SIEGE_COOLDOWN_MS = 30000;

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
        ts: [],
        watchTs: [],
        intervals: [],
        banned: false,
        banExpires: 0,
        strikes: 0,
        lastStrike: 0,
        reasons: [],
        wasSkid: false,
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
    const maskedIp = ip.replace(/\.\d+\.\d+$/, ".xxx.xxx");
    
    initlog(
      `[PokeStopSkids] banned ${maskedIp} for ${Math.round(duration / 1000)}s ` +
      `(${reasonStr}, strike #${data.strikes})`
    );
  }

  function checkTimingPattern(data) {
    const intervals = data.intervals;
    if (intervals.length < TIMING_MIN_SAMPLES) return null;

    const recent = intervals.slice(-30);
    const mean = recent.reduce((a, b) => a + b, 0) / recent.length;
    const variance = recent.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / recent.length;
    const stdev = Math.sqrt(variance);

    if (stdev < TIMING_VARIANCE_THRESHOLD && mean < 500) {
      return "robotic timing (stdev: " + stdev.toFixed(1) + "ms, avg: " + mean.toFixed(0) + "ms)";
    }

    return null;
  }

  function checkAbuse(data, now, isWatch) {
    const ts = data.ts;
    const reasons = [];

    if (ts.length > 0) {
      const gap = now - ts[ts.length - 1];
      data.intervals.push(gap);
      if (data.intervals.length > 50) data.intervals.shift();
    }

    ts.push(now);

    while (ts.length > 0 && ts[0] < now - SUSTAINED_WINDOW) {
      ts.shift();
    }

    const oneSecAgo = now - 1000;
    let burstCount = 0;
    for (let i = ts.length - 1; i >= 0; i--) {
      if (ts[i] >= oneSecAgo) burstCount++;
      else break;
    }
    if (burstCount >= BURST_LIMIT) {
      reasons.push("burst (" + burstCount + " req/1s)");
    }

    if (ts.length >= SUSTAINED_LIMIT) {
      reasons.push("sustained (" + ts.length + " req/10s)");
    }

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

    const timingResult = checkTimingPattern(data);
    if (timingResult) {
      data.wasSkid = true;
      reasons.push(timingResult);
    }

    return reasons.length > 0 ? reasons : null;
  }

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

  app.use(function PokeStopSkids(req, res, next) {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const ua = req.headers["user-agent"] || "";
    const now = Date.now();
    const isWatch = req.path === "/watch" || req.path.startsWith("/watch?");

    globalRequestsThisSecond++;

    const rawIP = (req.socket.remoteAddress || "").replace("::ffff:", "");
    if (isCloudflareIP(rawIP)) return next();

    if (isKnownBot(ua)) return next();

    if (siegeMode) {
      const existing = ipData.get(ip);
      if (existing && existing.ts.length > 20) {
        if (!existing.banned) {
          banIP(existing, ip, ["active during siege mode"]);
          existing.wasSkid = true;
        }
        res.set("Retry-After", "60");
        return res.status(503).send(getSkidMessage());
      }

      if (existing && existing.ts.length > BURST_LIMIT / 2) {
        if (!existing.banned) {
          banIP(existing, ip, ["exceeded siege limits"]);
        }
        res.set("Retry-After", "60");
        return res.status(503).send(getSkidMessage());
      }
    }

    const data = getIPData(ip);

    if (isBanned(data)) {
      const retryAfter = Math.ceil((data.banExpires - now) / 1000);
      res.set("Retry-After", String(retryAfter));
      if (data.wasSkid || data.strikes >= 3) {
        return res.status(429).send(getSkidMessage());
      }
      return res.status(429).send(
        "Too many requests. Try again in " + retryAfter + " seconds."
      );
    }

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
 * This is the nicer overload layer.
 *
 * It uses toobusy-js as the fast event-loop lag signal, then adds Node core
 * diagnostics and a defensive admission policy:
 *
 * - cheap static/status requests survive soft overload
 * - page navigations get a short grace wait
 * - page navigations can spend a small soft-pass budget
 * - media, API, proxy, and background requests are shed first
 * - noisy clients get an overload-only cooldown
 * - critical lag still protects the process with hard rejects and restart
 */
(function PokeOverloadShield() {
  const shieldConfig = {
    loop: {
      pollMs: 110,
      rejectLagMs: 2500,
      warnFloorMs: 750,
      warnCapMs: 2500,
      rejectCapMs: 6000,
      criticalFloorMs: 7500,
      criticalCapMs: 30000,
      criticalP99FloorMs: 5000,
      criticalP99CapMs: 20000,
      dynamicLimits: true,
      dynamicToobusyMaxLag: false,
      baselineSampleMs: 15000,
      baselineMinMs: 10,
      baselineMaxHealthyMs: 1000,
      baselineAlpha: 0.22,
      warnMultiplier: 20,
      rejectMultiplier: 45,
      criticalMultiplier: 120,
      criticalP99Multiplier: 80,
      busyUtilization: 0.92,
      criticalUtilization: 0.98
    },
    strikes: {
      neededForRestart: 3,
      windowMs: 30000
    },
    logging: {
      lagCooldownMs: 5000,
      policyCooldownMs: 15000,
      reportCooldownMs: 60000,
      json: false,
      reportDir: nodePath.join(process.cwd(), "reports"),
      reports: true
    },
    restart: {
      exitGraceMs: 10000,
      retryAfterSeconds: 15
    },
    requests: {
      slowMs: 3000,
      maxActiveTracked: 1000,
      maxRecentSlow: 20
    },
    userPass: {
      enabled: true,
      pageSoftPass: true,
      graceMs: 1400,
      gracePollMs: 140,
      graceJitterMs: 180
    },
    clients: {
      windowMs: 30000,
      maxRequestsPerWindow: 45,
      maxPageSoftPassesPerWindow: 6,
      maxRejectsBeforeCooldown: 4,
      maxHeavyRejectsBeforeCooldown: 3,
      maxActiveRequestsForSoftPass: 800,
      cooldownMs: 60000,
      maxCooldownMs: 600000,
      cleanupMs: 60000
    },
    allow: {
      statusDuringOverload: true,
      staticDuringSoftOverload: true
    }
  };

  shieldConfig.loop.criticalFloorMs = Math.max(
    shieldConfig.loop.criticalFloorMs,
    shieldConfig.loop.rejectLagMs * 3
  );

  shieldConfig.loop.criticalP99FloorMs = Math.max(
    shieldConfig.loop.criticalP99FloorMs,
    shieldConfig.loop.rejectLagMs * 2
  );

  let criticalStrikeTimes = [];
  let lastLagLogAt = 0;
  let lastPolicyLogAt = 0;
  let lastReportAt = 0;
  let shieldRestarting = false;

  let requestSequence = 0;
  const activeRequests = new Map();
  const activeRequestCounts = new Map();
  const recentSlowRequests = [];

  const clientStates = new Map();
  let lastLagSnapshot = null;
  let lastLagSnapshotAt = 0;

  const shieldStats = {
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

  const adaptiveLimits = {
    enabled: shieldConfig.loop.dynamicLimits,
    dynamicToobusy: shieldConfig.loop.dynamicToobusyMaxLag,
    samples: 0,
    baselineMs: 0,
    baselineP90Ms: 0,
    baselineP99Ms: 0,
    lastSampleP90Ms: 0,
    lastSampleP99Ms: 0,
    lastSampleMeanMs: 0,
    lastSampleMaxMs: 0,
    lastUpdatedAt: 0,
    warnMs: shieldConfig.loop.warnFloorMs,
    rejectMs: shieldConfig.loop.rejectLagMs,
    criticalMs: shieldConfig.loop.criticalFloorMs,
    criticalP99Ms: shieldConfig.loop.criticalP99FloorMs
  };

  const loopDelay = monitorEventLoopDelay({ resolution: 20 });
  const baselineDelay = monitorEventLoopDelay({ resolution: 20 });

  loopDelay.enable();
  baselineDelay.enable();

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

  function getBaselineDelaySnapshot() {
    return {
      minMs: nsToMs(baselineDelay.min),
      meanMs: nsToMs(baselineDelay.mean),
      maxMs: nsToMs(baselineDelay.max),
      stddevMs: nsToMs(baselineDelay.stddev),
      p50Ms: nsToMs(baselineDelay.percentile(50)),
      p90Ms: nsToMs(baselineDelay.percentile(90)),
      p99Ms: nsToMs(baselineDelay.percentile(99))
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
      dynamic: adaptiveLimits.enabled,
      dynamicToobusy: adaptiveLimits.dynamicToobusy,
      samples: adaptiveLimits.samples,
      baselineMs: adaptiveLimits.baselineMs,
      baselineP90Ms: adaptiveLimits.baselineP90Ms,
      baselineP99Ms: adaptiveLimits.baselineP99Ms,
      lastSampleP90Ms: adaptiveLimits.lastSampleP90Ms,
      lastSampleP99Ms: adaptiveLimits.lastSampleP99Ms,
      lastSampleMeanMs: adaptiveLimits.lastSampleMeanMs,
      lastSampleMaxMs: adaptiveLimits.lastSampleMaxMs,
      lastUpdatedAt: adaptiveLimits.lastUpdatedAt,
      warnMs: adaptiveLimits.warnMs,
      rejectMs: adaptiveLimits.rejectMs,
      criticalMs: adaptiveLimits.criticalMs,
      criticalP99Ms: adaptiveLimits.criticalP99Ms,
      busyUtilization: shieldConfig.loop.busyUtilization,
      criticalUtilization: shieldConfig.loop.criticalUtilization
    };
  }

  function updateToobusyRejectLag() {
    if (!shieldConfig.loop.dynamicToobusyMaxLag) {
      return;
    }

    try {
      toobusy.maxLag(adaptiveLimits.rejectMs);
    } catch (err) {
      console.error("[POKE-overload] failed to update toobusy maxLag:", err.message);
    }
  }

  function updateAdaptiveLoopLimits(reason) {
    if (!shieldConfig.loop.dynamicLimits) {
      baselineDelay.reset();
      return;
    }

    const sample = getBaselineDelaySnapshot();
    const candidateMs = Math.max(
      shieldConfig.loop.baselineMinMs,
      sample.p90Ms,
      sample.p99Ms,
      sample.meanMs * 3
    );

    adaptiveLimits.lastSampleP90Ms = sample.p90Ms;
    adaptiveLimits.lastSampleP99Ms = sample.p99Ms;
    adaptiveLimits.lastSampleMeanMs = sample.meanMs;
    adaptiveLimits.lastSampleMaxMs = sample.maxMs;
    adaptiveLimits.lastUpdatedAt = Date.now();

    const usefulSample =
      Number.isFinite(candidateMs) &&
      candidateMs > 0 &&
      candidateMs <= shieldConfig.loop.baselineMaxHealthyMs;

    if (!usefulSample) {
      baselineDelay.reset();
      return;
    }

    adaptiveLimits.samples++;

    if (adaptiveLimits.baselineMs <= 0) {
      adaptiveLimits.baselineMs = candidateMs;
      adaptiveLimits.baselineP90Ms = Math.max(shieldConfig.loop.baselineMinMs, sample.p90Ms);
      adaptiveLimits.baselineP99Ms = Math.max(shieldConfig.loop.baselineMinMs, sample.p99Ms);
    } else {
      adaptiveLimits.baselineMs =
        (adaptiveLimits.baselineMs * (1 - shieldConfig.loop.baselineAlpha)) +
        (candidateMs * shieldConfig.loop.baselineAlpha);

      adaptiveLimits.baselineP90Ms =
        (adaptiveLimits.baselineP90Ms * (1 - shieldConfig.loop.baselineAlpha)) +
        (Math.max(shieldConfig.loop.baselineMinMs, sample.p90Ms) * shieldConfig.loop.baselineAlpha);

      adaptiveLimits.baselineP99Ms =
        (adaptiveLimits.baselineP99Ms * (1 - shieldConfig.loop.baselineAlpha)) +
        (Math.max(shieldConfig.loop.baselineMinMs, sample.p99Ms) * shieldConfig.loop.baselineAlpha);
    }

    const baseline = Math.max(shieldConfig.loop.baselineMinMs, adaptiveLimits.baselineMs);
    const proposedWarnMs = baseline * shieldConfig.loop.warnMultiplier;
    const proposedRejectMs = baseline * shieldConfig.loop.rejectMultiplier;
    const proposedCriticalMs = Math.max(proposedRejectMs * 3, baseline * shieldConfig.loop.criticalMultiplier);
    const proposedCriticalP99Ms = Math.max(proposedRejectMs * 2, baseline * shieldConfig.loop.criticalP99Multiplier);

    adaptiveLimits.warnMs = roundMs(clampNumber(
      proposedWarnMs,
      shieldConfig.loop.warnFloorMs,
      shieldConfig.loop.warnCapMs
    ));

    adaptiveLimits.rejectMs = Math.round(clampNumber(
      proposedRejectMs,
      shieldConfig.loop.rejectLagMs,
      shieldConfig.loop.rejectCapMs
    ));

    adaptiveLimits.criticalMs = Math.round(clampNumber(
      proposedCriticalMs,
      shieldConfig.loop.criticalFloorMs,
      shieldConfig.loop.criticalCapMs
    ));

    adaptiveLimits.criticalP99Ms = Math.round(clampNumber(
      proposedCriticalP99Ms,
      shieldConfig.loop.criticalP99FloorMs,
      shieldConfig.loop.criticalP99CapMs
    ));

    updateToobusyRejectLag();
    baselineDelay.reset();

    if (reason === "startup") {
      logPolicy("adaptive limits initialized", null);
    }
  }

  function getLagState(currentLagMs, delaySnapshot, utilizationSnapshot) {
    const limits = getLoopLimits();
    const p99LagMs = delaySnapshot.p99Ms;
    const maxLagMs = delaySnapshot.maxMs;
    const utilization = utilizationSnapshot.utilization;

    if (shieldRestarting) {
      return "restarting";
    }

    if (
      currentLagMs >= limits.criticalMs ||
      p99LagMs >= limits.criticalP99Ms ||
      (utilization >= limits.criticalUtilization && currentLagMs >= limits.rejectMs)
    ) {
      return "critical";
    }

    if (
      currentLagMs >= limits.rejectMs ||
      p99LagMs >= limits.rejectMs ||
      maxLagMs >= limits.criticalMs ||
      utilization >= limits.busyUtilization
    ) {
      return "busy";
    }

    if (
      currentLagMs >= limits.warnMs ||
      p99LagMs >= limits.warnMs ||
      maxLagMs >= limits.warnMs
    ) {
      return "warm";
    }

    return "healthy";
  }

  function createLagSnapshot(currentLag, extra) {
    const currentLagMs = roundMs(currentLag);
    const memory = process.memoryUsage();
    const delaySnapshot = getLoopDelaySnapshot();
    const utilizationSnapshot = getEventLoopUtilizationSnapshot();
    const cpuSnapshot = getCpuUsageSnapshot();
    const limits = getLoopLimits();
    const state = getLagState(currentLagMs, delaySnapshot, utilizationSnapshot);

    return {
      reason: "event_loop_lag",
      state,
      source: {
        detector: "toobusy-js",
        note: "event-loop polling was delayed; exact blocking function cannot be recovered from this callback alone"
      },
      lag: {
        currentMs: currentLagMs,
        warnMs: limits.warnMs,
        rejectMs: limits.rejectMs,
        baseRejectMs: shieldConfig.loop.rejectLagMs,
        dynamicToobusyEnabled: limits.dynamicToobusy,
        criticalMs: limits.criticalMs,
        criticalP99Ms: limits.criticalP99Ms,
        criticalUtilization: limits.criticalUtilization,
        strikes: criticalStrikeTimes.length,
        strikeWindowMs: shieldConfig.strikes.windowMs
      },
      adaptiveLimits: limits,
      eventLoopDelay: delaySnapshot,
      eventLoopUtilization: utilizationSnapshot,
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
        clients: clientStates.size,
        userGraceEnabled: shieldConfig.userPass.enabled,
        userGraceMs: shieldConfig.userPass.graceMs,
        pageSoftPassEnabled: shieldConfig.userPass.pageSoftPass,
        stats: { ...shieldStats }
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

  function getLagHints(snapshot) {
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

  function formatLagPretty(message, snapshot) {
    const lines = [];
    const lag = snapshot.lag;
    const limits = snapshot.adaptiveLimits;
    const delay = snapshot.eventLoopDelay;
    const utilization = snapshot.eventLoopUtilization;
    const cpu = snapshot.cpu;
    const memory = snapshot.memory;
    const proc = snapshot.process;
    const system = snapshot.system;
    const hints = getLagHints(snapshot);

    lines.push("[POKE-overload] " + message);
    lines.push("  state: " + snapshot.state);
    lines.push(
      "  lag: current=" + lag.currentMs + "ms" +
      " warn=" + lag.warnMs + "ms" +
      " reject=" + lag.rejectMs + "ms" +
      " critical=" + lag.criticalMs + "ms" +
      " criticalP99=" + lag.criticalP99Ms + "ms" +
      " strikes=" + lag.strikes + "/" + shieldConfig.strikes.neededForRestart
    );
    lines.push(
      "  adaptive: enabled=" + limits.dynamic +
      " samples=" + limits.samples +
      " baseline=" + roundMs(limits.baselineMs) + "ms" +
      " p90=" + roundMs(limits.baselineP90Ms) + "ms" +
      " p99=" + roundMs(limits.baselineP99Ms) + "ms"
    );
    lines.push(
      "  last sample: p90=" + limits.lastSampleP90Ms + "ms" +
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
      "  event loop use: " + formatPercent(utilization.utilization) +
      " active=" + formatDuration(utilization.activeMs) +
      " idle=" + formatDuration(utilization.idleMs)
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
    lines.push("  clues:");
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

    return lines.join("\n");
  }

  function logLag(message, snapshot) {
    if (shieldConfig.logging.json) {
      console.error("[POKE-overload] " + message + " " + JSON.stringify(snapshot));
      return;
    }

    console.error(formatLagPretty(message, snapshot));
  }

  function getClientLogView(client) {
    if (!client) {
      return null;
    }

    return {
      requests: client.requestTimes.length,
      pageSoftPasses: client.pageSoftPassTimes.length,
      pageGracePasses: client.pageGracePassTimes.length,
      rejects: client.rejectTimes.length,
      heavyRejects: client.heavyRejectTimes.length,
      cooldownUntil: client.cooldownUntil,
      cooldownLevel: client.cooldownLevel,
      lastPath: client.lastPath,
      lastKind: client.lastKind,
      lastDecision: client.lastDecision,
      pressure: getClientPressure(client)
    };
  }

  function logPolicy(message, client, extra) {
    const now = Date.now();

    if (now - lastPolicyLogAt < shieldConfig.logging.policyCooldownMs) {
      return;
    }

    lastPolicyLogAt = now;

    console.error(
      "[POKE-overload-policy] " +
      JSON.stringify({
        message,
        state: getCurrentShieldState(),
        clients: clientStates.size,
        activeRequests: activeRequests.size,
        client: getClientLogView(client),
        stats: shieldStats,
        ...extra
      })
    );
  }

  function shouldWriteDiagnosticReport() {
    if (!shieldConfig.logging.reports) {
      return false;
    }

    if (!process.report || typeof process.report.writeReport !== "function") {
      return false;
    }

    const now = Date.now();

    if (now - lastReportAt < shieldConfig.logging.reportCooldownMs) {
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
      fs.mkdirSync(shieldConfig.logging.reportDir, { recursive: true });

      const filename = nodePath.join(
        shieldConfig.logging.reportDir,
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
      return now - time <= shieldConfig.strikes.windowMs;
    });

    criticalStrikeTimes.push(now);

    return criticalStrikeTimes.length;
  }

  function resetCriticalStrikesIfHealthy(currentLag, snapshot) {
    const limits = getLoopLimits();

    if (currentLag >= limits.rejectMs) {
      return;
    }

    if (snapshot.eventLoopDelay.p99Ms >= limits.rejectMs) {
      return;
    }

    if (snapshot.eventLoopUtilization.utilization >= shieldConfig.loop.busyUtilization) {
      return;
    }

    criticalStrikeTimes = [];
  }

  function isCriticalLag(currentLag, snapshot) {
    const limits = getLoopLimits();

    return (
      currentLag >= limits.criticalMs ||
      snapshot.eventLoopDelay.p99Ms >= limits.criticalP99Ms ||
      (
        snapshot.eventLoopUtilization.utilization >= limits.criticalUtilization &&
        currentLag >= limits.rejectMs
      )
    );
  }

  function getClientKey(req) {
    return String(req.ip || req.socket.remoteAddress || "unknown").replace("::ffff:", "");
  }

  function pruneClientState(client, now) {
    const oldest = now - shieldConfig.clients.windowMs;

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
    let client = clientStates.get(key);

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
      clientStates.set(key, client);
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

  function getClientPressure(client) {
    return (
      client.requestTimes.length +
      client.rejectTimes.length * 5 +
      client.heavyRejectTimes.length * 7 +
      client.pageSoftPassTimes.length * 2
    );
  }

  function applyClientCooldown(client, reason) {
    const now = Date.now();

    client.cooldownLevel++;
    const cooldownMs = Math.min(
      shieldConfig.clients.maxCooldownMs,
      shieldConfig.clients.cooldownMs * Math.pow(2, Math.max(0, client.cooldownLevel - 1))
    );

    client.cooldownUntil = now + cooldownMs;
    shieldStats.cooldownsIssued++;

    console.error(
      "[POKE-overload-policy] " +
      JSON.stringify({
        message: "cooldown issued",
        reason,
        cooldownMs,
        cooldownLevel: client.cooldownLevel,
        client: getClientLogView(client)
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

  function getCurrentShieldState() {
    if (shieldRestarting) {
      return "restarting";
    }

    if (lastLagSnapshot && Date.now() - lastLagSnapshotAt <= Math.max(30000, shieldConfig.logging.lagCooldownMs * 4)) {
      return lastLagSnapshot.state || "busy";
    }

    return "busy";
  }

  function isHardShieldState() {
    const state = getCurrentShieldState();
    return state === "critical" || state === "restarting";
  }

  function canSpendPageSoftPass(req, client) {
    if (!shieldConfig.userPass.enabled || !shieldConfig.userPass.pageSoftPass) {
      return false;
    }

    if (isLikelyAutomationUserAgent(req)) {
      return false;
    }

    if (client.requestTimes.length > shieldConfig.clients.maxRequestsPerWindow) {
      return false;
    }

    if (client.pageSoftPassTimes.length >= shieldConfig.clients.maxPageSoftPassesPerWindow) {
      return false;
    }

    if (client.rejectTimes.length >= shieldConfig.clients.maxRejectsBeforeCooldown) {
      return false;
    }

    if (activeRequests.size >= shieldConfig.clients.maxActiveRequestsForSoftPass) {
      return false;
    }

    return true;
  }

  function maybeCooldownClient(client, kind, reason) {
    if (client.cooldownUntil > Date.now()) {
      return;
    }

    if (client.rejectTimes.length >= shieldConfig.clients.maxRejectsBeforeCooldown) {
      applyClientCooldown(client, reason || "too many overload rejects");
      return;
    }

    if ((kind === "heavy" || kind === "background") && client.heavyRejectTimes.length >= shieldConfig.clients.maxHeavyRejectsBeforeCooldown) {
      applyClientCooldown(client, reason || "too many heavy overload rejects");
      return;
    }

    if (getClientPressure(client) >= 70) {
      applyClientCooldown(client, reason || "client pressure too high during overload");
    }
  }

  function getAdmissionDecision(req, client, kind) {
    const state = getCurrentShieldState();
    const now = Date.now();

    if (shieldRestarting || state === "restarting") {
      return {
        action: "reject",
        reason: "restarting",
        status: 503,
        retryAfter: shieldConfig.restart.retryAfterSeconds,
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
      if (shieldConfig.allow.statusDuringOverload && kind === "status") {
        return {
          action: "allow",
          reason: "status-critical-pass"
        };
      }

      return {
        action: "reject",
        reason: "critical-overload",
        status: 503,
        retryAfter: shieldConfig.restart.retryAfterSeconds,
        message: "Server is under heavy load. Please retry shortly."
      };
    }

    if (shieldConfig.allow.statusDuringOverload && kind === "status") {
      return {
        action: "allow",
        reason: "status-soft-pass"
      };
    }

    if (shieldConfig.allow.staticDuringSoftOverload && kind === "static" && isSafeMethod(req)) {
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
        retryAfter: shieldConfig.restart.retryAfterSeconds,
        message: "Server is busy. Please retry shortly."
      };
    }

    if (kind === "background") {
      return {
        action: "reject",
        reason: "background-shed-first",
        status: 503,
        retryAfter: shieldConfig.restart.retryAfterSeconds,
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
      retryAfter: shieldConfig.restart.retryAfterSeconds,
      message: "Server is busy. Please retry shortly."
    };
  }

  function rejectDuringOverload(req, res, client, kind, decision) {
    rememberDecision(client, "reject", kind);

    if (decision.reason === "restarting") {
      shieldStats.rejectedRestarting++;
    } else if (decision.reason === "critical-overload") {
      shieldStats.rejectedCritical++;
    } else if (decision.reason === "client-overload-cooldown") {
      shieldStats.rejectedCooldown++;
    } else if (decision.reason === "heavy-shed-first") {
      shieldStats.rejectedHeavy++;
    } else if (decision.reason === "background-shed-first") {
      shieldStats.rejectedBackground++;
    } else if (decision.reason === "normal-page-grace-expired") {
      shieldStats.rejectedGraceExpired++;
    } else if (decision.reason === "no-soft-pass-budget") {
      shieldStats.rejectedNoBudget++;
    } else {
      shieldStats.rejectedNoBudget++;
    }

    maybeCooldownClient(client, kind, decision.reason);
    logPolicy("rejected request during overload", client, {
      reason: decision.reason,
      kind,
      path: getRequestPath(req)
    });

    res.set("Retry-After", String(decision.retryAfter || shieldConfig.restart.retryAfterSeconds));
    res.set("Cache-Control", "no-store");
    res.set("Connection", "close");
    res.set("X-Poke-Overload-Policy", decision.reason);
    return res.status(decision.status || 503).send(decision.message || "Server is busy. Please retry shortly.");
  }

  async function handlePageGrace(req, res, next, client, kind) {
    const jitter = shieldConfig.userPass.graceJitterMs > 0
      ? Math.floor(Math.random() * shieldConfig.userPass.graceJitterMs)
      : 0;

    const graceBudgetMs = Math.max(0, shieldConfig.userPass.graceMs + jitter);
    const startedAt = performance.now();

    while (!res.headersSent && performance.now() - startedAt < graceBudgetMs) {
      if (shieldRestarting || isHardShieldState()) {
        break;
      }

      if (!toobusy()) {
        rememberDecision(client, "page-grace-pass", kind);
        shieldStats.pageGracePassed++;
        return next();
      }

      await sleep(shieldConfig.userPass.gracePollMs);
    }

    if (
      !res.headersSent &&
      shieldConfig.userPass.pageSoftPass &&
      !shieldRestarting &&
      !isHardShieldState() &&
      canSpendPageSoftPass(req, client)
    ) {
      rememberDecision(client, "page-soft-pass", kind);
      shieldStats.pageSoftPassed++;
      logPolicy("soft-passed page request during overload", client, {
        path: getRequestPath(req)
      });
      return next();
    }

    return rejectDuringOverload(req, res, client, kind, {
      action: "reject",
      reason: "normal-page-grace-expired",
      status: 503,
      retryAfter: shieldConfig.restart.retryAfterSeconds,
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
    if (shieldRestarting) {
      return;
    }

    shieldRestarting = true;

    const reportPath = writeDiagnosticReport(snapshot);

    logLag(
      "sustained critical event-loop lag, refusing new requests and restarting",
      {
        ...snapshot,
        restart: {
          exitGraceMs: shieldConfig.restart.exitGraceMs,
          retryAfterSeconds: shieldConfig.restart.retryAfterSeconds,
          diagnosticReport: reportPath
        }
      }
    );

    shutdownToobusy();

    const exitTimer = setTimeout(function () {
      console.error("[POKE-overload] exiting after sustained critical event-loop lag");
      process.exit(1);
    }, shieldConfig.restart.exitGraceMs);

    exitTimer.unref();
  }

  function requestActivityTracker(req, res, next) {
    const id = ++requestSequence;
    const key = getRequestKey(req);
    const startedAt = performance.now();

    if (activeRequests.size < shieldConfig.requests.maxActiveTracked) {
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

      if (durationMs >= shieldConfig.requests.slowMs) {
        recentSlowRequests.push({
          key,
          statusCode: res.statusCode,
          durationMs
        });

        while (recentSlowRequests.length > shieldConfig.requests.maxRecentSlow) {
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

    if (shieldRestarting) {
      return rejectDuringOverload(req, res, client, kind, {
        action: "reject",
        reason: "restarting",
        status: 503,
        retryAfter: shieldConfig.restart.retryAfterSeconds,
        message: "Server is recovering from high load. Please retry shortly."
      });
    }

    if (!toobusy()) {
      shieldStats.allowedHealthy++;
      return next();
    }

    const decision = getAdmissionDecision(req, client, kind);

    if (decision.action === "allow") {
      if (kind === "status") {
        shieldStats.allowedStatus++;
      } else if (kind === "static") {
        shieldStats.allowedStatic++;
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
    shieldRestarting = true;
    shutdownToobusy();

    console.error("[POKE-overload] received " + signal + ", shutting down overload monitor");

    const signalExitTimer = setTimeout(function () {
      process.exit(0);
    }, 1000);

    signalExitTimer.unref();
  }

  toobusy.interval(shieldConfig.loop.pollMs);
  toobusy.maxLag(shieldConfig.loop.rejectLagMs);

  app.use(requestActivityTracker);
  app.use(overloadAdmissionMiddleware);

  app.get("/_pokeoverload/stats", function (req, res) {
    const state = getCurrentShieldState();
    const limits = getLoopLimits();
    const now = Date.now();

    let clientsInCooldown = 0;
    let activeClients = 0;

    for (const [, client] of clientStates) {
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
      restarting: shieldRestarting,
      clients: {
        tracked: clientStates.size,
        active: activeClients,
        cooldown: clientsInCooldown,
        window_ms: shieldConfig.clients.windowMs
      },
      requests: {
        active: activeRequests.size,
        top_active_routes: getTopMapEntries(activeRequestCounts, 10),
        oldest_active: getActiveRequestSummary(10),
        recent_slow: recentSlowRequests.slice(-10).reverse()
      },
      limits,
      policy: {
        user_grace_enabled: shieldConfig.userPass.enabled,
        user_grace_ms: shieldConfig.userPass.graceMs,
        user_grace_poll_ms: shieldConfig.userPass.gracePollMs,
        user_page_soft_pass_enabled: shieldConfig.userPass.pageSoftPass,
        client_max_requests_per_window: shieldConfig.clients.maxRequestsPerWindow,
        client_max_page_soft_passes_per_window: shieldConfig.clients.maxPageSoftPassesPerWindow,
        client_max_rejects_before_cooldown: shieldConfig.clients.maxRejectsBeforeCooldown,
        client_max_heavy_rejects_before_cooldown: shieldConfig.clients.maxHeavyRejectsBeforeCooldown,
        client_cooldown_ms: shieldConfig.clients.cooldownMs,
        client_cooldown_max_ms: shieldConfig.clients.maxCooldownMs
      },
      stats: shieldStats,
      last_snapshot: lastLagSnapshot
        ? {
            state: lastLagSnapshot.state,
            lag: lastLagSnapshot.lag,
            eventLoopDelay: lastLagSnapshot.eventLoopDelay,
            eventLoopUtilization: lastLagSnapshot.eventLoopUtilization,
            requests: lastLagSnapshot.requests
          }
        : null
    });
  });

  updateAdaptiveLoopLimits("startup");

  const adaptiveLimitTimer = setInterval(function () {
    updateAdaptiveLoopLimits("interval");
  }, shieldConfig.loop.baselineSampleMs);

  adaptiveLimitTimer.unref();

  const clientCleanupTimer = setInterval(function () {
    const now = Date.now();
    const maxAge = shieldConfig.clients.windowMs * 3;

    for (const [key, client] of clientStates) {
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
        clientStates.delete(key);
      }
    }
  }, shieldConfig.clients.cleanupMs);

  clientCleanupTimer.unref();

  toobusy.onLag(function (currentLag) {
    const now = Date.now();
    const snapshot = createLagSnapshot(currentLag);
    const critical = isCriticalLag(currentLag, snapshot);

    lastLagSnapshot = snapshot;
    lastLagSnapshotAt = now;

    if (now - lastLagLogAt >= shieldConfig.logging.lagCooldownMs || critical) {
      lastLagLogAt = now;
      logLag("event-loop lag detected", snapshot);
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

    logLag(
      "critical event-loop lag strike " + strikeCount + "/" + shieldConfig.strikes.neededForRestart,
      loggedStrikeSnapshot
    );

    if (strikeCount >= shieldConfig.strikes.neededForRestart) {
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
    "rejectLag: " + shieldConfig.loop.rejectLagMs + "ms, " +
    "dynamicLimits: " + shieldConfig.loop.dynamicLimits + ", " +
    "dynamicToobusy: " + shieldConfig.loop.dynamicToobusyMaxLag + ", " +
    "pageGrace: " + shieldConfig.userPass.graceMs + "ms, " +
    "clientWindow: " + shieldConfig.clients.windowMs + "ms, " +
    "cooldown: " + shieldConfig.clients.cooldownMs + "ms"
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
        );
        res.setHeader("poketube-cacher", "STATIC_FILES");
      }
      const a = 890;
      if (!req.url.match(/^\/(css|js|img|font)\/.+/)) {
        res.setHeader("Cache-Control", "public, max-age=" + a);
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

  initPokeTube();

  app.use(function pokeErrorHandler(err, req, res, next) {
    console.error("[POKE-error]", req.method, req.originalUrl, ":", err.message);
    if (process.env.NODE_ENV !== "production") {
      console.error(err.stack);
    }
    if (!res.headersSent) {
      res.status(500).send("Something went wrong. Please try again.");
    }
  });
})();