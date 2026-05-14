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
   process.on("unhandledRejection", (reason, promise) => {
    console.error("[POKE-error] Unhandled Rejection at:", promise, "reason:", reason);
    if (reason && reason.code === "UND_ERR_CONNECT_TIMEOUT") {
      console.error("[POKE-error] Blocked server crash from Undici ConnectTimeoutError.");
    }
  });

  process.on("uncaughtException", (err) => {
    console.error("[POKE-error] Uncaught Exception:", err);
    if (err && err.code === "UND_ERR_CONNECT_TIMEOUT") {
      console.error("[POKE-error] Blocked server crash from Undici ConnectTimeoutError.");
    }
  });
 
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
  const net = require("net");
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
    const parsedBits = parseInt(bits, 10);
    if (!Number.isFinite(parsedBits) || parsedBits < 0 || parsedBits > 32) return false;
    const mask = parsedBits === 0 ? 0 : ~(2 ** (32 - parsedBits) - 1) >>> 0;
    return (ipToLong(ip) & mask) === (ipToLong(subnet) & mask);
  }

  function cleanIP(ip) {
    return String(ip || "").replace("::ffff:", "");
  }

  function isCloudflareIP(ip) {
    const clean = cleanIP(ip);
    if (!net.isIPv4(clean)) return false;
    return CLOUDFLARE_V4.some(cidr => cidrContains(cidr, clean));
  }

  function isPrivateIP(ip) {
    const clean = cleanIP(ip);

    if (net.isIPv6(clean)) {
      return /^(::1|fe80:|fc00:|fd00:)/i.test(clean);
    }

    if (!net.isIPv4(clean)) return false;

    return (
      cidrContains("10.0.0.0/8", clean) ||
      cidrContains("172.16.0.0/12", clean) ||
      cidrContains("192.168.0.0/16", clean) ||
      cidrContains("127.0.0.0/8", clean) ||
      cidrContains("169.254.0.0/16", clean)
    );
  }

  function maskIP(ip) {
    const clean = cleanIP(ip);

    if (net.isIPv4(clean)) {
      return clean.replace(/\.\d+\.\d+$/, ".xxx.xxx");
    }

    if (net.isIPv6(clean)) {
      const parts = clean.split(":");
      return parts.slice(0, 3).join(":") + ":xxxx:xxxx:xxxx:xxxx";
    }

    return "unknown";
  }

  /*
   * poke trust proxy auto-config
   *
   * this has to run BEFORE anything that touches req.ip.
   *
   * it trusts private/local reverse proxies and cloudflare edge IPs only.
   * direct public clients cannot spoof x-forwarded-for because their TCP peer
   * address will not be trusted.
   */
  (function configureTrustProxy() {
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

      for (const [name] of Object.entries(ifaces)) {
        if (containerIfacePattern.test(name)) {
          signals.push({ iface: name, type: "container-interface" });
        }
      }
      return signals;
    }

    function isTrustedProxyIP(ip) {
      return isPrivateIP(ip) || isCloudflareIP(ip);
    }

    function buildTrustFunction() {
      return function pokeTrustProxy(addr) {
        return isTrustedProxyIP(addr);
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
      initlog("[POKE-trust-proxy] force-enabled via TRUST_PROXY=true");
      return;
    }

    if (typeof override === "number") {
      app.set("trust proxy", override);
      initlog("[POKE-trust-proxy] hop count set via TRUST_PROXY=" + override);
      return;
    }

    if (typeof override === "string") {
      app.set("trust proxy", override);
      initlog("[POKE-trust-proxy] custom trust proxy value set via TRUST_PROXY=" + override);
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

      const remoteAddr = cleanIP(req.socket.remoteAddress || "");
      const remoteIsTrustedProxy = isTrustedProxyIP(remoteAddr);

      if (headerScore >= 3 && remoteIsTrustedProxy) {
        app.set("trust proxy", buildTrustFunction());
        initlog("[POKE-trust-proxy] confirmed proxy on first request (score: " + headerScore + ")");
        logProxyHeaders(req);
      } else if (headerScore >= 3 && !remoteIsTrustedProxy) {
        app.set("trust proxy", false);
        initlog("[POKE-trust-proxy] proxy headers from untrusted ip " + maskIP(remoteAddr) + ", ignoring");
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
   * PokeResourceGuard
   *
   * This only samples CPU and memory. No event-loop delay, no latency probing,
   * no ping-style checks.
   *
   * It is intentionally user-first:
   * - healthy: allow everything except extreme per-client abuse
   * - warm: allow almost everything, only slow down noisy expensive clients
   * - stressed: protect pages/static/status first, shed expensive noisy work
   * - critical: keep status/static/pages alive, reject expensive/background work
   *
   * All per-client data is in-memory and short-lived.
   */
  (function PokeResourceGuard() {
    const resourceConfig = {
      system: {
        sampleMs: 1000,

        warmCpuRatio: 0.75,
        stressedCpuRatio: 1.05,
        criticalCpuRatio: 1.55,

        warmRssRatio: 0.70,
        stressedRssRatio: 0.82,
        criticalRssRatio: 0.92,

        warmHeapRatio: 0.55,
        stressedHeapRatio: 0.70,
        criticalHeapRatio: 0.85
      },

      client: {
        windowMs: 30000,
        oneSecondMs: 1000,
        maxClientStates: 75000,
        cleanupMs: 60000,

        absoluteRequestsPerSecond: 160,
        absoluteRequestsPerWindow: 1200,
        absoluteCostPerWindow: 6000,

        noisyRequestsWarm: 350,
        noisyCostWarm: 1400,

        noisyRequestsStressed: 160,
        noisyCostStressed: 650,

        noisyRequestsCritical: 70,
        noisyCostCritical: 280,

        pageSoftPassesPerWindow: 20,

        maxHeavyRequestsWarm: 80,
        maxHeavyRequestsStressed: 25,
        maxHeavyRequestsCritical: 8,

        cooldownBaseMs: 30000,
        cooldownMaxMs: 600000,
        cooldownDecayMs: 300000
      },

      requestCost: {
        status: 0.05,
        static: 0.10,
        page: 1,
        other: 1.5,
        background: 4,
        heavy: 10
      },

      admission: {
        retryAfterHealthyAbuseSeconds: 20,
        retryAfterWarmSeconds: 10,
        retryAfterStressedSeconds: 8,
        retryAfterCriticalSeconds: 5
      },

      logging: {
        stateCooldownMs: 30000,
        rejectCooldownMs: 5000,
        slowRequestMs: 3000,
        maxRecentSlow: 30,
        maxTopRoutes: 12
      }
    };

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

    const GUARD_MESSAGES = [
      "Server is busy. Please retry shortly.",
      "Poke is protecting itself from heavy traffic. Please retry shortly.",
      "Too many expensive requests right now. Please slow down a bit.",
      "The server is under pressure. Please try again in a moment."
    ];

    let resourceState = {
      state: "healthy",
      score: 0,
      since: Date.now(),
      sampledAt: Date.now(),
      reason: "startup",
      cpu: {
        ratio: 0,
        percent: 0,
        userMs: 0,
        systemMs: 0,
        totalMs: 0,
        elapsedMs: 0
      },
      memory: {
        rssMb: 0,
        heapUsedMb: 0,
        heapTotalMb: 0,
        externalMb: 0,
        arrayBuffersMb: 0,
        rssRatio: 0,
        heapRatio: 0,
        effectiveTotalMb: 0,
        systemFreeMb: 0,
        systemTotalMb: 0,
        constrainedMb: 0
      },
      requests: {
        rps: 0,
        active: 0,
        kinds: {}
      },
      pressureReasons: []
    };

    let lastStateLogAt = 0;
    let lastRejectLogAt = 0;
    let currentSecondRequests = 0;
    let currentSecondKindCounts = new Map();
    let currentSecondRouteCounts = new Map();

    let lastSampleAt = Date.now();
    let lastCpuUsage = process.cpuUsage();

    let requestSequence = 0;
    const activeRequests = new Map();
    const activeRequestCounts = new Map();
    const recentSlowRequests = [];
    const clientStates = new Map();

    const guardStats = {
      allowedHealthy: 0,
      allowedWarm: 0,
      allowedStressed: 0,
      allowedCritical: 0,
      allowedStatus: 0,
      allowedStatic: 0,
      allowedPage: 0,
      allowedHeavy: 0,
      rejectedAbuse: 0,
      rejectedCooldown: 0,
      rejectedWarm: 0,
      rejectedStressed: 0,
      rejectedCritical: 0,
      cooldownsIssued: 0
    };

    function bytesToMb(bytes) {
      return Math.round(bytes / 1024 / 1024);
    }

    function roundMs(value) {
      if (!Number.isFinite(value)) return 0;
      return Math.round(value * 100) / 100;
    }

    function roundRatio(value) {
      if (!Number.isFinite(value)) return 0;
      return Math.round(value * 10000) / 10000;
    }

    function formatPercent(value) {
      if (!Number.isFinite(value)) return "0%";
      return (value * 100).toFixed(2) + "%";
    }

    function getEffectiveMemoryLimit() {
      if (typeof process.constrainedMemory === "function") {
        try {
          const constrained = process.constrainedMemory();
          if (Number.isFinite(constrained) && constrained > 0) {
            return constrained;
          }
        } catch {}
      }

      return os.totalmem();
    }

    function getConstrainedMemoryMb() {
      if (typeof process.constrainedMemory !== "function") {
        return 0;
      }

      try {
        const constrained = process.constrainedMemory();
        if (Number.isFinite(constrained) && constrained > 0) {
          return bytesToMb(constrained);
        }
      } catch {}

      return 0;
    }

    function getRequestPath(req) {
      const url = req.originalUrl || req.url || "/";
      return (url.split("?")[0] || "/").toLowerCase();
    }

    function normalizePathname(pathname) {
      return String(pathname || "/")
        .replace(/[a-f0-9]{24}/gi, ":objectId")
        .replace(/[a-f0-9]{32,}/gi, ":hex")
        .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi, ":uuid")
        .replace(/\/\d{3,}(?=\/|$)/g, "/:number")
        .replace(/\/[A-Za-z0-9_-]{11}(?=\/|$)/g, "/:id");
    }

    function getRequestKey(req) {
      return req.method + " " + normalizePathname(getRequestPath(req));
    }

    function incrementMapCount(map, key, amount) {
      map.set(key, (map.get(key) || 0) + (amount || 1));
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
      const now = Date.now();

      return Array.from(activeRequests.values())
        .map(function (request) {
          return {
            id: request.id,
            key: request.key,
            kind: request.kind,
            ageMs: now - request.startedAt
          };
        })
        .sort(function (a, b) {
          return b.ageMs - a.ageMs;
        })
        .slice(0, limit);
    }

    function isKnownBot(ua) {
      if (!ua) return false;
      return KNOWN_BOT_PATTERNS.some(pattern => pattern.test(ua));
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
        pathname === "/_pokeresource/stats" ||
        pathname === "/_poketraffic/stats" ||
        pathname === "/_pokestopskids/stats" ||
        pathname === "/_pokeoverload/stats" ||
        pathname === "/_antiddos" ||
        pathname.startsWith("/_antiddos/")
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
        pathname === "/home" ||
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
      if (isStatusRequest(req)) return "status";
      if (isStaticRequest(req)) return "static";
      if (isHeavyRequest(req)) return "heavy";
      if (isBackgroundRequest(req)) return "background";
      if (isPageNavigation(req)) return "page";
      return "other";
    }

    function getKindCost(kind, req) {
      let cost = resourceConfig.requestCost[kind] || resourceConfig.requestCost.other;

      const ua = String(req.headers["user-agent"] || "");
      if (isKnownBot(ua)) {
        cost = cost * 0.5;
      }

      const rawIP = cleanIP(req.socket.remoteAddress || "");
      if (isCloudflareIP(rawIP)) {
        cost = cost * 0.85;
      }

      return cost;
    }

    function getClientKey(req) {
      return cleanIP(req.ip || req.socket.remoteAddress || "unknown");
    }

    function pruneClientState(client, now) {
      const oldest = now - resourceConfig.client.windowMs;
      const oneSecondOldest = now - resourceConfig.client.oneSecondMs;

      while (client.requestTimes.length > 0 && client.requestTimes[0] < oldest) {
        client.requestTimes.shift();
      }

      while (client.oneSecondRequestTimes.length > 0 && client.oneSecondRequestTimes[0] < oneSecondOldest) {
        client.oneSecondRequestTimes.shift();
      }

      while (client.heavyTimes.length > 0 && client.heavyTimes[0] < oldest) {
        client.heavyTimes.shift();
      }

      while (client.pageTimes.length > 0 && client.pageTimes[0] < oldest) {
        client.pageTimes.shift();
      }

      while (client.rejectTimes.length > 0 && client.rejectTimes[0] < oldest) {
        client.rejectTimes.shift();
      }

      while (client.pageSoftPassTimes.length > 0 && client.pageSoftPassTimes[0] < oldest) {
        client.pageSoftPassTimes.shift();
      }

      while (client.costEntries.length > 0 && client.costEntries[0].at < oldest) {
        client.costEntries.shift();
      }

      if (client.cooldownUntil > 0 && client.cooldownUntil <= now) {
        client.cooldownUntil = 0;
      }

      if (client.cooldownLevel > 0 && now - client.lastCooldownAt > resourceConfig.client.cooldownDecayMs) {
        client.cooldownLevel = Math.max(0, client.cooldownLevel - 1);
        client.lastCooldownAt = now;
      }

      client.costWindow = client.costEntries.reduce(function (total, entry) {
        return total + entry.cost;
      }, 0);
    }

    function evictClientStateIfNeeded() {
      if (clientStates.size < resourceConfig.client.maxClientStates) {
        return;
      }

      let oldestKey = null;
      let oldestSeen = Infinity;

      for (const [key, client] of clientStates) {
        if (client.cooldownUntil > Date.now()) {
          continue;
        }

        if (client.lastSeen < oldestSeen) {
          oldestSeen = client.lastSeen;
          oldestKey = key;
        }
      }

      if (oldestKey) {
        clientStates.delete(oldestKey);
      }
    }

    function getClientState(req) {
      const key = getClientKey(req);
      const now = Date.now();

      let client = clientStates.get(key);

      if (!client) {
        evictClientStateIfNeeded();

        client = {
          key,
          firstSeen: now,
          lastSeen: now,
          requestTimes: [],
          oneSecondRequestTimes: [],
          heavyTimes: [],
          pageTimes: [],
          rejectTimes: [],
          pageSoftPassTimes: [],
          costEntries: [],
          costWindow: 0,
          cooldownUntil: 0,
          cooldownLevel: 0,
          lastCooldownAt: 0,
          lastPath: "",
          lastKind: "",
          lastDecision: "",
          lastUserAgent: "",
          trustedBot: false
        };

        clientStates.set(key, client);
      }

      client.lastSeen = now;
      pruneClientState(client, now);
      return client;
    }

    function rememberClientRequest(req, client, kind, cost) {
      const now = Date.now();

      client.lastSeen = now;
      client.lastPath = getRequestPath(req);
      client.lastKind = kind;
      client.lastUserAgent = String(req.headers["user-agent"] || "").slice(0, 160);
      client.trustedBot = isKnownBot(client.lastUserAgent);

      client.requestTimes.push(now);
      client.oneSecondRequestTimes.push(now);
      client.costEntries.push({ at: now, cost });

      if (kind === "heavy" || kind === "background") {
        client.heavyTimes.push(now);
      }

      if (kind === "page") {
        client.pageTimes.push(now);
      }

      pruneClientState(client, now);
    }

    function rememberDecision(client, decision) {
      const now = Date.now();

      client.lastDecision = decision;

      if (decision === "reject") {
        client.rejectTimes.push(now);
      }

      if (decision === "page-soft-pass") {
        client.pageSoftPassTimes.push(now);
      }

      pruneClientState(client, now);
    }

    function getClientPressure(client) {
      return (
        client.requestTimes.length +
        client.oneSecondRequestTimes.length * 3 +
        client.heavyTimes.length * 4 +
        client.rejectTimes.length * 8 +
        client.costWindow
      );
    }

    function getNoisyLimits(state) {
      if (state === "critical") {
        return {
          requests: resourceConfig.client.noisyRequestsCritical,
          cost: resourceConfig.client.noisyCostCritical
        };
      }

      if (state === "stressed") {
        return {
          requests: resourceConfig.client.noisyRequestsStressed,
          cost: resourceConfig.client.noisyCostStressed
        };
      }

      return {
        requests: resourceConfig.client.noisyRequestsWarm,
        cost: resourceConfig.client.noisyCostWarm
      };
    }

    function getHeavyLimit(state) {
      if (state === "critical") return resourceConfig.client.maxHeavyRequestsCritical;
      if (state === "stressed") return resourceConfig.client.maxHeavyRequestsStressed;
      return resourceConfig.client.maxHeavyRequestsWarm;
    }

    function clientIsAbsoluteAbuse(client) {
      return (
        client.oneSecondRequestTimes.length >= resourceConfig.client.absoluteRequestsPerSecond ||
        client.requestTimes.length >= resourceConfig.client.absoluteRequestsPerWindow ||
        client.costWindow >= resourceConfig.client.absoluteCostPerWindow
      );
    }

    function clientIsNoisy(client, state) {
      const limits = getNoisyLimits(state);

      return (
        client.requestTimes.length >= limits.requests ||
        client.costWindow >= limits.cost ||
        getClientPressure(client) >= limits.cost * 1.5
      );
    }

    function applyClientCooldown(client, reason) {
      const now = Date.now();

      client.cooldownLevel++;
      client.lastCooldownAt = now;

      const cooldownMs = Math.min(
        resourceConfig.client.cooldownMaxMs,
        resourceConfig.client.cooldownBaseMs * Math.pow(2, Math.max(0, client.cooldownLevel - 1))
      );

      client.cooldownUntil = now + cooldownMs;
      guardStats.cooldownsIssued++;

      console.error(
        "[POKE-resource] client cooldown " +
        JSON.stringify({
          reason,
          cooldownMs,
          cooldownLevel: client.cooldownLevel,
          client: {
            ip: maskIP(client.key),
            requests: client.requestTimes.length,
            oneSecondRequests: client.oneSecondRequestTimes.length,
            heavyRequests: client.heavyTimes.length,
            rejects: client.rejectTimes.length,
            cost: Math.round(client.costWindow * 100) / 100,
            lastPath: client.lastPath,
            lastKind: client.lastKind,
            pressure: Math.round(getClientPressure(client) * 100) / 100
          }
        })
      );
    }

    function sampleCpuAndMemory(reason) {
      const now = Date.now();
      const elapsedMs = Math.max(1, now - lastSampleAt);

      const cpuDelta = process.cpuUsage(lastCpuUsage);
      lastCpuUsage = process.cpuUsage();

      const cpuUserMs = cpuDelta.user / 1000;
      const cpuSystemMs = cpuDelta.system / 1000;
      const cpuTotalMs = cpuUserMs + cpuSystemMs;
      const cpuRatio = cpuTotalMs / elapsedMs;

      const memory = process.memoryUsage();
      const effectiveTotal = getEffectiveMemoryLimit();
      const rssRatio = effectiveTotal > 0 ? memory.rss / effectiveTotal : 0;
      const heapRatio = effectiveTotal > 0 ? memory.heapUsed / effectiveTotal : 0;

      const kinds = {};
      for (const [kind, count] of currentSecondKindCounts) {
        kinds[kind] = count;
      }

      const snapshot = {
        state: resourceState.state,
        score: resourceState.score,
        since: resourceState.since,
        sampledAt: now,
        reason: reason || "interval",
        cpu: {
          ratio: roundRatio(cpuRatio),
          percent: roundRatio(cpuRatio * 100),
          userMs: roundMs(cpuUserMs),
          systemMs: roundMs(cpuSystemMs),
          totalMs: roundMs(cpuTotalMs),
          elapsedMs: roundMs(elapsedMs)
        },
        memory: {
          rssMb: bytesToMb(memory.rss),
          heapUsedMb: bytesToMb(memory.heapUsed),
          heapTotalMb: bytesToMb(memory.heapTotal),
          externalMb: bytesToMb(memory.external),
          arrayBuffersMb: bytesToMb(memory.arrayBuffers || 0),
          rssRatio: roundRatio(rssRatio),
          heapRatio: roundRatio(heapRatio),
          effectiveTotalMb: bytesToMb(effectiveTotal),
          systemFreeMb: bytesToMb(os.freemem()),
          systemTotalMb: bytesToMb(os.totalmem()),
          constrainedMb: getConstrainedMemoryMb()
        },
        requests: {
          rps: currentSecondRequests,
          active: activeRequests.size,
          kinds
        },
        topRoutes: getTopMapEntries(currentSecondRouteCounts, resourceConfig.logging.maxTopRoutes),
        pressureReasons: []
      };

      const pressure = classifyResourcePressure(snapshot);
      snapshot.state = pressure.state;
      snapshot.score = pressure.score;
      snapshot.pressureReasons = pressure.reasons;

      if (snapshot.state !== resourceState.state) {
        snapshot.since = now;
      } else {
        snapshot.since = resourceState.since;
      }

      const shouldLog = now - lastStateLogAt >= resourceConfig.logging.stateCooldownMs;

      resourceState = snapshot;
      lastSampleAt = now;
      currentSecondRequests = 0;
      currentSecondKindCounts = new Map();
      currentSecondRouteCounts = new Map();

      if (shouldLog) {
        lastStateLogAt = now;
        logResourceState();
      }
    }

    function classifyResourcePressure(snapshot) {
      const cfg = resourceConfig.system;
      const reasons = [];
      let score = 0;
      let hasCritical = false;

      function addPressure(name, value, warm, stressed, critical, unit) {
        if (value >= critical) {
          score += 4;
          hasCritical = true;
          reasons.push(name + "=" + value + unit + " critical>=" + critical + unit);
          return;
        }

        if (value >= stressed) {
          score += 2;
          reasons.push(name + "=" + value + unit + " stressed>=" + stressed + unit);
          return;
        }

        if (value >= warm) {
          score += 1;
          reasons.push(name + "=" + value + unit + " warm>=" + warm + unit);
        }
      }

      addPressure(
        "cpu",
        snapshot.cpu.ratio,
        cfg.warmCpuRatio,
        cfg.stressedCpuRatio,
        cfg.criticalCpuRatio,
        ""
      );

      addPressure(
        "rssMemory",
        snapshot.memory.rssRatio,
        cfg.warmRssRatio,
        cfg.stressedRssRatio,
        cfg.criticalRssRatio,
        ""
      );

      addPressure(
        "heapMemory",
        snapshot.memory.heapRatio,
        cfg.warmHeapRatio,
        cfg.stressedHeapRatio,
        cfg.criticalHeapRatio,
        ""
      );

      if (hasCritical || score >= 7) {
        return { state: "critical", score, reasons };
      }

      if (score >= 4) {
        return { state: "stressed", score, reasons };
      }

      if (score >= 2) {
        return { state: "warm", score, reasons };
      }

      return { state: "healthy", score, reasons };
    }

    function logResourceState() {
      if (resourceState.state === "healthy") {
        console.error("[POKE-resource] healthy");
        return;
      }

      console.error("[POKE-resource] not healthy (" + resourceState.state + ")");
    }

    function logReject(req, client, kind, reason, status) {
      const now = Date.now();

      if (now - lastRejectLogAt < resourceConfig.logging.rejectCooldownMs) {
        return;
      }

      lastRejectLogAt = now;

      console.error(
        "[POKE-resource] rejected " +
        JSON.stringify({
          reason,
          status,
          state: resourceState.state,
          score: resourceState.score,
          path: getRequestPath(req),
          kind,
          ip: maskIP(client.key),
          client: {
            requests: client.requestTimes.length,
            oneSecondRequests: client.oneSecondRequestTimes.length,
            heavyRequests: client.heavyTimes.length,
            pageRequests: client.pageTimes.length,
            rejects: client.rejectTimes.length,
            cost: Math.round(client.costWindow * 100) / 100,
            pressure: Math.round(getClientPressure(client) * 100) / 100,
            cooldownUntil: client.cooldownUntil
          },
          system: {
            cpu: resourceState.cpu,
            memory: resourceState.memory
          }
        })
      );
    }

    function getRandomGuardMessage() {
      return GUARD_MESSAGES[Math.floor(Math.random() * GUARD_MESSAGES.length)];
    }

    function setResourceHeaders(res, decision) {
      res.set("X-Poke-Resource-Guard", resourceState.state);
      res.set("X-Poke-Resource-Decision", decision);
    }

    function getRetryAfterForState(state) {
      if (state === "critical") return resourceConfig.admission.retryAfterCriticalSeconds;
      if (state === "stressed") return resourceConfig.admission.retryAfterStressedSeconds;
      if (state === "warm") return resourceConfig.admission.retryAfterWarmSeconds;
      return resourceConfig.admission.retryAfterHealthyAbuseSeconds;
    }

    function sendGuardReject(req, res, client, kind, options) {
      rememberDecision(client, "reject");

      const status = options.status || 503;
      const retryAfter = options.retryAfter || resourceConfig.admission.retryAfterStressedSeconds;
      const reason = options.reason || "resource-pressure";

      if (reason === "client-cooldown") {
        guardStats.rejectedCooldown++;
      } else if (reason === "absolute-abuse") {
        guardStats.rejectedAbuse++;
      } else if (resourceState.state === "critical") {
        guardStats.rejectedCritical++;
      } else if (resourceState.state === "stressed") {
        guardStats.rejectedStressed++;
      } else {
        guardStats.rejectedWarm++;
      }

      logReject(req, client, kind, reason, status);

      res.set("Retry-After", String(retryAfter));
      res.set("Cache-Control", "no-store");
      res.set("Connection", "close");
      res.set("X-Poke-Resource-Guard", resourceState.state);
      res.set("X-Poke-Resource-Reason", reason);
      return res.status(status).send(options.message || getRandomGuardMessage());
    }

    function allowRequest(res, kind, decision) {
      if (resourceState.state === "healthy") guardStats.allowedHealthy++;
      if (resourceState.state === "warm") guardStats.allowedWarm++;
      if (resourceState.state === "stressed") guardStats.allowedStressed++;
      if (resourceState.state === "critical") guardStats.allowedCritical++;

      if (kind === "status") guardStats.allowedStatus++;
      if (kind === "static") guardStats.allowedStatic++;
      if (kind === "page") guardStats.allowedPage++;
      if (kind === "heavy" || kind === "background") guardStats.allowedHeavy++;

      setResourceHeaders(res, decision || "allow");
    }

    function getAdmissionDecision(req, client, kind) {
      const state = resourceState.state;
      const noisy = clientIsNoisy(client, state);
      const absoluteAbuse = clientIsAbsoluteAbuse(client);
      const now = Date.now();

      if (client.cooldownUntil > now) {
        return {
          action: "reject",
          reason: "client-cooldown",
          status: 429,
          retryAfter: Math.ceil((client.cooldownUntil - now) / 1000),
          message: "Too many expensive requests. Please retry shortly."
        };
      }

      if (absoluteAbuse) {
        return {
          action: "cooldown-reject",
          reason: "absolute-abuse",
          status: 429,
          retryAfter: resourceConfig.admission.retryAfterHealthyAbuseSeconds,
          message: "Too many requests. Please slow down a bit."
        };
      }

      if (state === "healthy") {
        return {
          action: "allow",
          reason: "healthy"
        };
      }

      if (kind === "status") {
        return {
          action: "allow",
          reason: "status-pass"
        };
      }

      if (kind === "static") {
        return {
          action: "allow",
          reason: "static-pass"
        };
      }

      if (state === "warm") {
        if ((kind === "heavy" || kind === "background") && noisy && client.heavyTimes.length > getHeavyLimit(state)) {
          return {
            action: "reject",
            reason: "warm-noisy-expensive-client",
            status: 429,
            retryAfter: getRetryAfterForState(state),
            message: "Too many expensive requests. Please retry shortly."
          };
        }

        return {
          action: "allow",
          reason: "warm-pass"
        };
      }

      if (state === "stressed") {
        if (kind === "page") {
          if (!noisy || client.pageSoftPassTimes.length < resourceConfig.client.pageSoftPassesPerWindow) {
            return {
              action: "allow-soft-page",
              reason: "stressed-page-pass"
            };
          }

          return {
            action: "reject",
            reason: "stressed-noisy-page-client",
            status: 429,
            retryAfter: getRetryAfterForState(state),
            message: "Too many page requests. Please retry shortly."
          };
        }

        if (kind === "heavy" || kind === "background") {
          const expensiveButAcceptable =
            !noisy &&
            client.heavyTimes.length <= getHeavyLimit(state);

          if (expensiveButAcceptable) {
            return {
              action: "allow",
              reason: "stressed-expensive-small-client-pass"
            };
          }

          return {
            action: "reject",
            reason: "stressed-expensive-shed",
            status: 503,
            retryAfter: getRetryAfterForState(state),
            message: "Server is busy. Please retry shortly."
          };
        }

        if (!noisy) {
          return {
            action: "allow",
            reason: "stressed-other-pass"
          };
        }

        return {
          action: "reject",
          reason: "stressed-noisy-client",
          status: 429,
          retryAfter: getRetryAfterForState(state),
          message: "Too many requests. Please retry shortly."
        };
      }

      if (state === "critical") {
        if (kind === "page") {
          if (!noisy && client.pageSoftPassTimes.length < resourceConfig.client.pageSoftPassesPerWindow) {
            return {
              action: "allow-soft-page",
              reason: "critical-page-soft-pass"
            };
          }

          return {
            action: "reject",
            reason: "critical-noisy-page-client",
            status: 503,
            retryAfter: getRetryAfterForState(state),
            message: "Server is under heavy load. Please retry shortly."
          };
        }

        if (kind === "other" && !noisy) {
          return {
            action: "allow",
            reason: "critical-small-other-pass"
          };
        }

        return {
          action: "reject",
          reason: "critical-shed",
          status: 503,
          retryAfter: getRetryAfterForState(state),
          message: "Server is under heavy load. Please retry shortly."
        };
      }

      return {
        action: "allow",
        reason: "default-pass"
      };
    }

    function requestActivityTracker(req, res, next) {
      const id = ++requestSequence;
      const key = getRequestKey(req);
      const kind = classifyRequest(req);
      const startedAt = Date.now();

      activeRequests.set(id, {
        id,
        key,
        kind,
        startedAt
      });

      incrementMapCount(activeRequestCounts, key);

      res.on("finish", function () {
        const finishedAt = Date.now();
        const durationMs = finishedAt - startedAt;

        if (activeRequests.has(id)) {
          activeRequests.delete(id);
          decrementMapCount(activeRequestCounts, key);
        }

        if (durationMs >= resourceConfig.logging.slowRequestMs) {
          recentSlowRequests.push({
            key,
            kind,
            statusCode: res.statusCode,
            durationMs
          });

          while (recentSlowRequests.length > resourceConfig.logging.maxRecentSlow) {
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

    function resourceAdmissionMiddleware(req, res, next) {
      const kind = classifyRequest(req);
      const cost = getKindCost(kind, req);
      const client = getClientState(req);

      rememberClientRequest(req, client, kind, cost);

      currentSecondRequests++;
      incrementMapCount(currentSecondKindCounts, kind);
      incrementMapCount(currentSecondRouteCounts, getRequestKey(req));

      const decision = getAdmissionDecision(req, client, kind);

      if (decision.action === "allow") {
        allowRequest(res, kind, decision.reason);
        return next();
      }

      if (decision.action === "allow-soft-page") {
        rememberDecision(client, "page-soft-pass");
        allowRequest(res, kind, decision.reason);
        return next();
      }

      if (decision.action === "cooldown-reject") {
        applyClientCooldown(client, decision.reason);
        return sendGuardReject(req, res, client, kind, decision);
      }

      if (
        decision.action === "reject" &&
        (decision.reason === "stressed-expensive-shed" || decision.reason === "critical-shed") &&
        (kind === "heavy" || kind === "background") &&
        client.heavyTimes.length >= getHeavyLimit(resourceState.state)
      ) {
        applyClientCooldown(client, decision.reason);
      }

      return sendGuardReject(req, res, client, kind, decision);
    }

    function cleanupClients() {
      const now = Date.now();
      const maxAge = resourceConfig.client.windowMs * 3;

      for (const [key, client] of clientStates) {
        pruneClientState(client, now);

        if (
          client.requestTimes.length === 0 &&
          client.oneSecondRequestTimes.length === 0 &&
          client.heavyTimes.length === 0 &&
          client.pageTimes.length === 0 &&
          client.rejectTimes.length === 0 &&
          client.costEntries.length === 0 &&
          client.cooldownUntil <= now &&
          now - client.lastSeen > maxAge
        ) {
          clientStates.delete(key);
        }
      }
    }

    function countClientStates() {
      const now = Date.now();
      let active = 0;
      let cooldown = 0;
      let noisy = 0;

      for (const [, client] of clientStates) {
        pruneClientState(client, now);

        if (client.requestTimes.length > 0) active++;
        if (client.cooldownUntil > now) cooldown++;
        if (clientIsNoisy(client, resourceState.state)) noisy++;
      }

      return {
        tracked: clientStates.size,
        active,
        cooldown,
        noisy
      };
    }

    function getResourceStats() {
      return {
        guard: "PokeResourceGuard",
        state: resourceState,
        clients: countClientStates(),
        active_requests: {
          total: activeRequests.size,
          by_route: getTopMapEntries(activeRequestCounts, resourceConfig.logging.maxTopRoutes),
          oldest: getActiveRequestSummary(resourceConfig.logging.maxTopRoutes),
          recent_slow: recentSlowRequests.slice(-resourceConfig.logging.maxRecentSlow).reverse()
        },
        stats: guardStats,
        config: {
          system: resourceConfig.system,
          client: resourceConfig.client,
          admission: resourceConfig.admission,
          request_cost: resourceConfig.requestCost
        }
      };
    }

    function sendResourceStats(req, res) {
      res.json(getResourceStats());
    }

    function sendAntiddosPage(req, res) {
      const stats = getResourceStats();
      const stateClass = stats.state.state === "healthy" ? "green" :
        stats.state.state === "warm" ? "orange" :
        stats.state.state === "stressed" ? "orange" :
        "red";

      res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>PokeResourceGuard - Poke Resource Protection</title>
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
body{
  color:#fff;
  background:#1c1b22;
  margin:0;
}
a{color:#0ab7f0}
:visited{color:#00c0ff}
.app{
  max-width:1100px;
  margin:0 auto;
  padding:24px;
}
h1,h2{
  font-family:"PokeTube Flex",system-ui,sans-serif;
  font-stretch:extra-expanded;
}
h1{
  font-weight:1000;
  font-stretch:ultra-expanded;
  margin-top:0;
}
h2{
  margin-top:28px;
}
p,li,code,pre{
  font-family:system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,"Noto Sans",sans-serif;
  line-height:1.6;
}
hr{
  border:0;
  border-top:1px solid #333;
  margin:28px 0;
}
.logo{
  float:right;
  margin:.3em 0 1em 2em;
  max-width:130px;
}
.stat-box{
  display:inline-block;
  background:#2a2930;
  border-radius:8px;
  padding:12px 18px;
  margin:6px 8px 6px 0;
  min-width:130px;
}
.stat-num{
  font-size:1.35rem;
  color:#0ab7f0;
  display:block;
}
.stat-label{
  font-size:.85rem;
  color:#aaa;
  display:block;
}
.green{color:#4caf50}
.orange{color:#ff9800}
.red{color:#f44336}
code,pre{
  background:#2a2930;
  padding:2px 6px;
  border-radius:4px;
}
pre{
  overflow:auto;
  padding:14px;
}
.banner{
  padding:12px 16px;
  border-radius:8px;
  background:#2a2930;
}
.banner.green{border-left:5px solid #4caf50}
.banner.orange{border-left:5px solid #ff9800}
.banner.red{border-left:5px solid #f44336}
.small{color:#bbb;font-size:.95rem}
</style>
</head>
<body>
<div class="app">
<img class="logo" src="/css/logo-poke.svg" alt="Poke logo">

<h1>PokeResourceGuard</h1>
<p class="small">poke's CPU and memory based traffic protection</p>

<div class="banner ${stateClass}">
  <b>Current state:</b> <span class="${stateClass}">${stats.state.state}</span>
  <br>
  <span class="small">Score: ${stats.state.score}. CPU: ${stats.state.cpu.percent}%. RSS: ${formatPercent(stats.state.memory.rssRatio)}. Heap: ${formatPercent(stats.state.memory.heapRatio)}.</span>
</div>

<h2>what this does</h2>
<p>
  PokeResourceGuard only checks CPU and memory pressure. It does not use event-loop delay,
  latency probes, ping-style checks, or browser fingerprinting. When CPU and memory are fine,
  normal users pass through.
</p>

<p>
  When the server is under real resource pressure, expensive work gets reduced first:
  API, proxy, media, manifest, storyboard, and background requests. Page navigations,
  static files, and status pages get priority so the normal user experience stays usable.
</p>

<h2>live stats</h2>
<div>
  <div class="stat-box">
    <span class="stat-num ${stateClass}">${stats.state.state}</span>
    <span class="stat-label">state</span>
  </div>
  <div class="stat-box">
    <span class="stat-num">${stats.state.score}</span>
    <span class="stat-label">pressure score</span>
  </div>
  <div class="stat-box">
    <span class="stat-num">${stats.state.cpu.percent}%</span>
    <span class="stat-label">process CPU</span>
  </div>
  <div class="stat-box">
    <span class="stat-num">${stats.state.memory.rssMb}MB</span>
    <span class="stat-label">RSS memory</span>
  </div>
  <div class="stat-box">
    <span class="stat-num">${formatPercent(stats.state.memory.rssRatio)}</span>
    <span class="stat-label">RSS ratio</span>
  </div>
  <div class="stat-box">
    <span class="stat-num">${stats.state.memory.heapUsedMb}MB</span>
    <span class="stat-label">heap used</span>
  </div>
  <div class="stat-box">
    <span class="stat-num">${formatPercent(stats.state.memory.heapRatio)}</span>
    <span class="stat-label">heap ratio</span>
  </div>
  <div class="stat-box">
    <span class="stat-num">${stats.state.requests.rps}</span>
    <span class="stat-label">requests/sec</span>
  </div>
  <div class="stat-box">
    <span class="stat-num">${stats.clients.tracked}</span>
    <span class="stat-label">tracked clients</span>
  </div>
  <div class="stat-box">
    <span class="stat-num">${stats.clients.cooldown}</span>
    <span class="stat-label">cooldowns</span>
  </div>
</div>

<h2>memory details</h2>
<pre>${JSON.stringify(stats.state.memory, null, 2)}</pre>

<h2>cpu details</h2>
<pre>${JSON.stringify(stats.state.cpu, null, 2)}</pre>

<h2>pressure reasons</h2>
<pre>${stats.state.pressureReasons.length ? stats.state.pressureReasons.join("\n") : "none"}</pre>

<h2>request mix</h2>
<pre>${JSON.stringify(stats.state.requests.kinds, null, 2)}</pre>

<h2>top routes this sample</h2>
<pre>${JSON.stringify(stats.state.topRoutes, null, 2)}</pre>

<h2>recent slow requests</h2>
<pre>${JSON.stringify(stats.active_requests.recent_slow, null, 2)}</pre>

<h2>api</h2>
<p>
  JSON stats:
  <code><a href="/_pokeresource/stats">/_pokeresource/stats</a></code>,
  <code><a href="/_poketraffic/stats">/_poketraffic/stats</a></code>,
  <code><a href="/_pokestopskids/stats">/_pokestopskids/stats</a></code>,
  <code><a href="/_pokeoverload/stats">/_pokeoverload/stats</a></code>
</p>

<h2>privacy</h2>
<p>
  This system stores short-lived per-IP counters in memory only. Logs mask IPs.
  It does not fingerprint browsers, require JavaScript, require cookies, or track users across sessions.
</p>

<hr>

<p class="small">
  powered by poke. <a href="/">go back to watching videos</a>
</p>

</div>
</body>
</html>`);
    }

    app.use(requestActivityTracker);
    app.use(resourceAdmissionMiddleware);

    app.get("/_pokeresource/stats", sendResourceStats);
    app.get("/_poketraffic/stats", sendResourceStats);
    app.get("/_pokestopskids/stats", sendResourceStats);
    app.get("/_pokeoverload/stats", sendResourceStats);
    app.get("/_antiddos*", sendAntiddosPage);

    sampleCpuAndMemory("startup");

    const sampleTimer = setInterval(function () {
      sampleCpuAndMemory("interval");
    }, resourceConfig.system.sampleMs);
    sampleTimer.unref();

    const cleanupTimer = setInterval(cleanupClients, resourceConfig.client.cleanupMs);
    cleanupTimer.unref();

    initlog(
      "[PokeResourceGuard] loaded - CPU/memory only, " +
      "cpu warm/stressed/critical: " +
      resourceConfig.system.warmCpuRatio + "/" +
      resourceConfig.system.stressedCpuRatio + "/" +
      resourceConfig.system.criticalCpuRatio + ", " +
      "rss warm/stressed/critical: " +
      resourceConfig.system.warmRssRatio + "/" +
      resourceConfig.system.stressedRssRatio + "/" +
      resourceConfig.system.criticalRssRatio
    );
  })();

  app.use(ieBlockMiddleware);
  initlog("Loaded express.js");

  app.engine("html", require("ejs").renderFile);
  initlog("Loaded EJS");
  app.use(modules.express.urlencoded({ extended: true }));
  app.use(modules.useragent.express());
  app.use(modules.express.json());

  const renderTemplate = async (res, req, template, data = {}) => {
    const templatePath = modules.path.resolve(`${templateDir}${modules.path.sep}${template}`);

    res.render(templatePath, Object.assign(data), function (err, html) {
      if (err) {
        console.error("[POKE-render] error on", template, ":", err.message);

        if (res.destroyed) {
          return;
        }

        if (res.writableEnded) {
          return;
        }

        if (res.headersSent) {
          try {
            res.write("\n<!-- Poke render error: " + String(template).replace(/-->/g, "--&gt;") + " -->");
            return res.end();
          } catch (writeErr) {
            console.error("[POKE-render] could not write render error after headers were sent:", writeErr.message);
            return;
          }
        }

        return res.status(500).send("Internal server error");
      }

      if (res.destroyed) {
        return;
      }

      if (res.writableEnded) {
        return;
      }

      if (res.headersSent) {
        try {
          res.write(html);
          return res.end();
        } catch (writeErr) {
          console.error("[POKE-render] could not write rendered html after headers were sent:", writeErr.message);
          return;
        }
      }

      return res.send(html);
    });
  };

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

    if (res.destroyed || res.writableEnded) {
      return;
    }

    if (res.headersSent) {
      return next(err);
    }

    res.status(500).send("Something went wrong. Please try again.");
  });
})();