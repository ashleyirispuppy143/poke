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

const cluster = require("cluster");
const os = require("os");

const numCPUs = os.cpus().length;
const ENABLE_CLUSTER = numCPUs >= 3;

const WORKER_COUNT = Math.max(1, numCPUs - 1);

const logPrefix = ENABLE_CLUSTER 
  ? (cluster.isPrimary ? "[Primary]" : `[Worker ${cluster.worker.id}]`) 
  : "[Server]";

['log', 'error', 'warn', 'info'].forEach(method => {
  const original = console[method];
  console[method] = (...args) => original(logPrefix, ...args);
});

if (ENABLE_CLUSTER && cluster.isPrimary) {
  console.log(`Booting manager on PID ${process.pid}`);
  console.log(`Detected ${numCPUs} cores. Spawning ${WORKER_COUNT} workers to reserve system overhead...`);

  for (let i = 0; i < WORKER_COUNT; i++) {
    cluster.fork();
  }

  cluster.on("exit", (worker, code, signal) => {
    console.error(`Worker ${worker.process.pid} terminated (Code: ${code}). Respawning new instance...`);
    cluster.fork();
  });

} else {

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
    const net = require("net");
    const crypto = require("crypto");
    const config = require("./config.json");
    const u = await media_proxy();

    (function GlobalServerOptimizer() {
      process.on('uncaughtException', (err) => {
        if (err.code === 'ECONNRESET' || err.code === 'EPIPE' || err.code === 'ETIMEDOUT') return;
        console.error('[OPTIMIZER] Uncaught Exception caught safely:', err.message);
      });
      
      process.on('unhandledRejection', (reason) => {
        console.error('[OPTIMIZER] Unhandled Rejection caught safely:', reason);
      });

      setInterval(() => {
        const memMb = process.memoryUsage().heapUsed / 1024 / 1024;
        if (memMb > 450 && typeof global.gc === 'function') {
          console.error(`[OPTIMIZER] Memory threshold reached (${memMb.toFixed(1)}MB). Forcing Garbage Collection.`);
          global.gc();
        }
      }, 45000).unref();

       const CPU_HISTORY_SIZE = 5;
      const cpuHistory = [];
      let lastCpu = process.cpuUsage();
      let lastCheck = Date.now();
      let consecutiveCriticalSpikes = 0;

      setInterval(() => {
        const now = Date.now();
        const diffCpu = process.cpuUsage(lastCpu);
        const diffTimeMs = now - lastCheck;

        const totalCpuMs = (diffCpu.user + diffCpu.system) / 1000;
        const cpuPercent = (totalCpuMs / diffTimeMs) * 100;

        cpuHistory.push(cpuPercent);
        if (cpuHistory.length > CPU_HISTORY_SIZE) {
          cpuHistory.shift();
        }

        const avgCpu = cpuHistory.reduce((a, b) => a + b, 0) / cpuHistory.length;

         if (cpuPercent > 95) {
          consecutiveCriticalSpikes++;
          if (consecutiveCriticalSpikes >= 2) {
            console.error(`[CRITICAL] Worker ${process.pid} exceeded 95% CPU threshold. Terminating to preserve system stability.`);
            process.exit(1);
          }
        } else {
          consecutiveCriticalSpikes = 0;
        }

         if (cpuHistory.length === CPU_HISTORY_SIZE && avgCpu > 85) {
          console.error(`[CRITICAL] Worker ${process.pid} sustained ${avgCpu.toFixed(1)}% CPU usage. Terminating to preserve system stability.`);
          process.exit(1);
        } else if (avgCpu > 75) {
          console.warn(`[WARNING] Worker CPU usage elevated: ${avgCpu.toFixed(1)}% average.`);
        }

        lastCpu = process.cpuUsage();
        lastCheck = now;
      }, 2000).unref();

    })();

    if (!ENABLE_CLUSTER || cluster.worker.id === 1) {
      fs.readFile("ascii_txt.txt", "utf8", (err, data) => {
        if (err) {
          console.error("Error reading ascii file:", err);
          return;
        }
        console.log("\n" + data);
      });
    }

    initlog("Loading initialization sequence...");
    initlog(
      `[Welcome] Welcome To Poke, where you can LIBERATE THE WEB! - :3 ` +
        `Running Node ${process.version} - V8 v${process.versions.v8} - ` +
        `${process.platform.replace("linux", "GNU/Linux")} ${process.arch} Server - libpt ${version}`
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

    app.use((req, res, next) => {
      req.setTimeout(25000, () => {
        req.socket.destroy();
      });
      res.setTimeout(25000, () => {
        res.socket.destroy();
      });
      next();
    });

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
      const str = String(ip || "");
      return str.startsWith("::ffff:") ? str.substring(7) : str;
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
        app.set("trust proxy", true);
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
        app.set("trust proxy", true);
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

        if (headerScore >= 3) {
          app.set("trust proxy", true);
          initlog("[POKE-trust-proxy] confirmed proxy on first request (score: " + headerScore + ")");
          logProxyHeaders(req);
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
          app.set("trust proxy", true);
          initlog("[POKE-trust-proxy] periodic re-check found proxy (score: " + freshScore + ")");
        }
      }, 60_000).unref();
    })();

    (function PokeResourceGuard() {
      const { monitorEventLoopDelay, performance } = require("perf_hooks");
      
      const guardSalt = crypto.randomBytes(16).toString("hex");
      function anonymizeIP(ip) {
        if (!ip) return "unknown";
        return "anon-" + crypto.createHash("sha256").update(ip + guardSalt).digest("hex").slice(0, 8);
      }

      let isGuardActive = false;
      let consecutiveCriticalSpikes = 0;

      const eldHistogram = monitorEventLoopDelay({ resolution: 20 });
      eldHistogram.enable();

      const resourceConfig = {
        system: {
          sampleMs: 1000,
          eventLoop: { warmMs: 1000, stressedMs: 3000, criticalMs: 5000 },
          warmCpuRatio: 10.00, stressedCpuRatio: 15.00, criticalCpuRatio: 20.00,
          warmRssRatio: 0.95, stressedRssRatio: 0.98, criticalRssRatio: 0.99,
          warmHeapRatio: 0.90, stressedHeapRatio: 0.95, criticalHeapRatio: 0.98
        },
        client: {
          windowMs: 30000, maxClientStates: 75000, cleanupMs: 60000,
          absoluteRequestsPerSecond: 1000, absoluteRequestsPerWindow: 10000, absoluteCostPerWindow: 30000,
          noisyRequestsWarm: 2000, noisyCostWarm: 6000,
          noisyRequestsStressed: 1000, noisyCostStressed: 4000,
          noisyRequestsCritical: 500, noisyCostCritical: 2000,
          pageSoftPassesPerWindow: 200,
          maxHeavyRequestsWarm: 1000, maxHeavyRequestsStressed: 500, maxHeavyRequestsCritical: 200,
          cooldownBaseMs: 5000, cooldownMaxMs: 60000, cooldownDecayMs: 30000
        },
        requestCost: { status: 0.01, static: 0.05, page: 0.5, other: 1, background: 2, heavy: 3 },
        admission: { retryAfterHealthyAbuseSeconds: 10, retryAfterWarmSeconds: 8, retryAfterStressedSeconds: 5, retryAfterCriticalSeconds: 3 },
        logging: { stateCooldownMs: 30000, rejectCooldownMs: 5000, slowRequestMs: 5000, maxRecentSlow: 30, maxTopRoutes: 12 }
      };

      const BOT_MEGA_REGEX = /googlebot|bingbot|slurp|duckduckbot|baiduspider|yandexbot|sogou|exabot|facebot|ia_archiver|archive\.org_bot|qwantify|seznambot|mojeekbot|petalsearch|applebot|discordbot|telegrambot|twitterbot|whatsapp|slackbot|linkedinbot|mastodon|pleroma|misskey|akkoma|lemmy|kbin|pixelfed|gotosocial|uptimerobot|pingdom|statuscake|site24x7|hetrixtools|freshping|cloudflare|cloudfront|fastly|feedfetcher|feedly|newsblur|tiny\s?tiny\s?rss|miniflux|researchscan|censys|semrush|ahrefs/i;

      const REGEX_OBJ_ID = /[a-f0-9]{24}/g;
      const REGEX_HEX = /[a-f0-9]{32,}/g;
      const REGEX_UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/g;
      const REGEX_NUM = /\/\d{3,}(?=\/|$)/g;
      const REGEX_ID = /\/[a-z0-9_-]{11}(?=\/|$)/g;

      const EXACT_STATUS_ROUTES = new Set(["/robots.txt", "/favicon.ico", "/_pokeresource/stats", "/_poketraffic/stats", "/_pokestopskids/stats", "/_pokeoverload/stats", "/health", "/traffic"]);
      const EXACT_IGNORED_ROUTES = new Set(["/api/nexus", "/api/stats", "/health", "/traffic"]);
      const EXACT_PAGE_ROUTES = new Set(["/", "/home", "/watch", "/search", "/hashtag"]);

      const GUARD_MESSAGES = [
        "Server is busy. Please retry shortly.",
        "Poke is protecting itself from heavy traffic. Please retry shortly.",
        "Too many expensive requests right now. Please slow down a bit.",
        "The server is under pressure. Please try again in a moment."
      ];

      let resourceState = {
        state: "healthy", score: 0, since: Date.now(), sampledAt: Date.now(), reason: "startup",
        eventLoop: { p99Ms: 0, meanMs: 0 },
        cpu: { ratio: 0, percent: 0, userMs: 0, systemMs: 0, totalMs: 0, elapsedMs: 0 },
        memory: { rssMb: 0, heapUsedMb: 0, heapTotalMb: 0, externalMb: 0, arrayBuffersMb: 0, rssRatio: 0, heapRatio: 0, effectiveTotalMb: 0, systemFreeMb: 0, systemTotalMb: 0, constrainedMb: 0 },
        requests: { rps: 0, active: 0, kinds: {} },
        pressureReasons: []
      };

      let lastStateLogAt = 0;
      let lastRejectLogAt = 0;
      let currentSecondRequests = 0;
      let currentSecondKindCounts = new Map();
      let currentSecondRouteCounts = new Map();
      
      let allTimeRouteCounts = new Map();
      let totalGlobalRequests = 0;
      let trackingStartTime = Date.now();
      const STATS_FILE_PATH = 'popularpaths.json';

      try {
        if (fs.existsSync(STATS_FILE_PATH)) {
          const fileData = fs.readFileSync(STATS_FILE_PATH, 'utf8');
          const parsedData = JSON.parse(fileData);
          totalGlobalRequests = parsedData.totalRequests || 0;
          if (parsedData.trackingStartTime) trackingStartTime = parsedData.trackingStartTime;
          if (parsedData.routes) {
            for (const [key, val] of Object.entries(parsedData.routes)) allTimeRouteCounts.set(key, val);
          }
          if (!ENABLE_CLUSTER || cluster.worker.id === 1) {
            initlog(`[POKE-resource] Loaded previous traffic stats: ${totalGlobalRequests} total global requests.`);
          }
        }
      } catch (err) {
        console.error("[POKE-resource] Could not load popularpaths.json:", err.message);
      }

      setInterval(() => {
        if (allTimeRouteCounts.size > 5000) {
          const sorted = Array.from(allTimeRouteCounts.entries()).sort((a,b) => b[1] - a[1]);
          allTimeRouteCounts = new Map(sorted.slice(0, 4000));
        }

        if (!ENABLE_CLUSTER || cluster.worker.id === 1) {
          const routesObj = {};
          for (const [k, v] of allTimeRouteCounts.entries()) routesObj[k] = v;
          const outData = { trackingStartTime, totalRequests: totalGlobalRequests, routes: routesObj };
          fs.writeFile(STATS_FILE_PATH, JSON.stringify(outData, null, 2), (err) => {
            if (err) console.error("[POKE-resource] Failed to save popularpaths.json:", err.message);
          });
        }
      }, 60000).unref();

      let lastSampleAt = performance.now();
      let lastCpuUsage = process.cpuUsage();

      let requestSequence = 0;
      const activeRequests = new Map();
      const activeRequestCounts = new Map();
      const recentSlowRequests = [];
      const clientStates = new Map(); 

      const guardStats = {
        allowedHealthy: 0, allowedWarm: 0, allowedStressed: 0, allowedCritical: 0,
        allowedStatus: 0, allowedStatic: 0, allowedPage: 0, allowedHeavy: 0,
        rejectedAbuse: 0, rejectedCooldown: 0, rejectedWarm: 0, rejectedStressed: 0, rejectedCritical: 0,
        cooldownsIssued: 0
      };

      function bytesToMb(bytes) { return Math.round(bytes / 1024 / 1024); }
      function roundMs(value) { return !Number.isFinite(value) ? 0 : Math.round(value * 100) / 100; }
      function roundRatio(value) { return !Number.isFinite(value) ? 0 : Math.round(value * 10000) / 10000; }
      function formatPercent(value) { return !Number.isFinite(value) ? "0%" : (value * 100).toFixed(2) + "%"; }

      function getEffectiveMemoryLimit() {
        if (typeof process.constrainedMemory === "function") {
          try {
            const constrained = process.constrainedMemory();
            if (Number.isFinite(constrained) && constrained > 0) return constrained;
          } catch {}
        }
        return os.totalmem();
      }

      function getConstrainedMemoryMb() {
        if (typeof process.constrainedMemory !== "function") return 0;
        try {
          const constrained = process.constrainedMemory();
          if (Number.isFinite(constrained) && constrained > 0) return bytesToMb(constrained);
        } catch {}
        return 0;
      }

      function getRequestPath(req) {
        if (req._parsed_path_cache) return req._parsed_path_cache;
        const url = req.originalUrl || req.url || "/";
        const qIdx = url.indexOf("?");
        const p = (qIdx === -1 ? url : url.substring(0, qIdx)).toLowerCase();
        req._parsed_path_cache = p;
        return p;
      }

      function isAvatarRoutePath(pathname) { return pathname === "/avatars" || pathname.startsWith("/avatars/"); }

      function isIgnoredRoute(req) {
        const path = getRequestPath(req);
        if (EXACT_IGNORED_ROUTES.has(path)) return true;
        if (path.startsWith("/static/") || path.startsWith("/css/")) return true;
        return isAvatarRoutePath(path);
      }

      function normalizePathname(pathname) {
        if (pathname.startsWith('/avatars/')) return '/avatars/';
        if (pathname.startsWith('/vi/')) return '/vi/';
        if (pathname.startsWith('/ggpht/')) return '/ggpht/';
        if (pathname.startsWith('/sb/')) return '/sb/';
        if (pathname.startsWith('/storyboard')) return '/storyboard';
        if (pathname.startsWith('/videoplayback')) return '/videoplayback';
        if (pathname.startsWith('/hashtag/')) return '/hashtag/';
        
        return pathname
          .replace(REGEX_OBJ_ID, ":objectId")
          .replace(REGEX_HEX, ":hex")
          .replace(REGEX_UUID, ":uuid")
          .replace(REGEX_NUM, "/:number")
          .replace(REGEX_ID, "/:id");
      }

      function getRequestKey(req) { return req.method + " " + normalizePathname(getRequestPath(req)); }

      function incrementMapCount(map, key, amount) { map.set(key, (map.get(key) || 0) + (amount || 1)); }

      function decrementMapCount(map, key) {
        const nextValue = (map.get(key) || 0) - 1;
        if (nextValue <= 0) { map.delete(key); return; }
        map.set(key, nextValue);
      }

      function getTopMapEntries(map, limit) {
        return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, limit).map(entry => ({ key: entry[0], count: entry[1] }));
      }

      function getActiveRequestSummary(limit) {
        const now = Date.now();
        return Array.from(activeRequests.values())
          .map(req => ({ id: req.id, key: req.key, kind: req.kind, ageMs: now - req.startedAt }))
          .sort((a, b) => b.ageMs - a.ageMs).slice(0, limit);
      }

      function isKnownBot(ua) { return !ua ? false : BOT_MEGA_REGEX.test(ua); }
      function isSafeMethod(req) { return req.method === "GET" || req.method === "HEAD"; }

      function isStaticRequest(req) {
        const pathname = getRequestPath(req);
        if (pathname.startsWith("/css/") || pathname.startsWith("/js/") || pathname.startsWith("/img/") || pathname.startsWith("/font/") || pathname.startsWith("/static/")) return true;
        if (pathname === "/favicon.ico" || pathname === "/manifest.json" || pathname === "/robots.txt") return true;
        return /\.(css|js|mjs|png|jpg|jpeg|webp|gif|svg|ico|woff|woff2|ttf|otf|map|txt)$/.test(pathname);
      }

      function isStatusRequest(req) {
        const pathname = getRequestPath(req);
        if (EXACT_STATUS_ROUTES.has(pathname)) return true;
        return pathname.startsWith("/health/");
      }

      function isHeavyRequest(req) {
        const pathname = getRequestPath(req);
        if (!isSafeMethod(req)) return true;
        if (isAvatarRoutePath(pathname)) return false;
        return (
          pathname.startsWith("/api/") || pathname.startsWith("/proxy/") || pathname.startsWith("/videoplayback") ||
          pathname.startsWith("/vi/") || pathname.startsWith("/ggpht/") || pathname.startsWith("/storyboard") ||
          pathname.startsWith("/sb/") || pathname.startsWith("/manifest") || pathname.startsWith("/channel_uploads") || pathname.startsWith("/music")
        );
      }

      function isBackgroundRequest(req) {
        const accept = String(req.headers.accept || "").toLowerCase();
        const secFetchDest = String(req.headers["sec-fetch-dest"] || "").toLowerCase();
        const secFetchMode = String(req.headers["sec-fetch-mode"] || "").toLowerCase();
        if (!isSafeMethod(req)) return true;
        if (accept.includes("application/json") && !accept.includes("text/html")) return true;
        if (secFetchDest === "empty" && secFetchMode === "cors") return true;
        return false;
      }

      function isPageNavigation(req) {
        const pathname = getRequestPath(req);
        const accept = String(req.headers.accept || "").toLowerCase();
        const secFetchDest = String(req.headers["sec-fetch-dest"] || "").toLowerCase();
        const secFetchMode = String(req.headers["sec-fetch-mode"] || "").toLowerCase();

        if (!isSafeMethod(req)) return false;
        if (isStaticRequest(req) || isHeavyRequest(req) || isBackgroundRequest(req)) return false;
        
        if (EXACT_PAGE_ROUTES.has(pathname)) return true;
        if (pathname.startsWith("/watch/") || pathname.startsWith("/search/") || pathname.startsWith("/channel/") || pathname.startsWith("/user/") || pathname.startsWith("/playlist")) return true;
        if (accept.includes("text/html")) return true;
        if (secFetchDest === "document" || secFetchMode === "navigate") return true;
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
        if (isKnownBot(req.headers["user-agent"])) cost = cost * 0.5;
        if (isCloudflareIP(cleanIP(req.socket.remoteAddress || ""))) cost = cost * 0.85;
        return cost;
      }

      function getClientKey(req) { return cleanIP(req.ip || req.socket.remoteAddress || "unknown"); }

      function updateClientWindow(client, now) {
        const WINDOW_MS = resourceConfig.client.windowMs;
        const currentStart = Math.floor(now / WINDOW_MS) * WINDOW_MS;

        if (client.windowStart !== currentStart) {
          const diff = currentStart - client.windowStart;
          if (diff === WINDOW_MS) {
            client.previous = { ...client.current };
          } else {
            client.previous = { total: 0, cost: 0, heavy: 0, page: 0, rejects: 0, softPass: 0 };
          }
          client.current = { total: 0, cost: 0, heavy: 0, page: 0, rejects: 0, softPass: 0 };
          client.windowStart = currentStart;
        }
      }

      function getMetric(client, metric, now) {
        updateClientWindow(client, now);
        const WINDOW_MS = resourceConfig.client.windowMs;
        const weight = Math.max(0, 1 - ((now - client.windowStart) / WINDOW_MS));
        return client.current[metric] + (client.previous[metric] * weight);
      }

      function evictClientStateIfNeeded() {
        if (clientStates.size >= resourceConfig.client.maxClientStates) {
          const keysToEvict = Math.max(1, Math.floor(resourceConfig.client.maxClientStates * 0.1));
          let evicted = 0;
          for (const oldKey of clientStates.keys()) {
            clientStates.delete(oldKey);
            if (++evicted >= keysToEvict) break;
          }
        }
      }

      function getClientState(req, now) {
        const key = getClientKey(req);
        let client = clientStates.get(key);

        if (client) {
          clientStates.delete(key);
          clientStates.set(key, client);
        } else {
          evictClientStateIfNeeded();
          client = {
            key, firstSeen: now, lastSeen: now, cooldownUntil: 0, cooldownLevel: 0, lastCooldownAt: 0,
            trustedBot: false, currentSec: Math.floor(now / 1000), currentSecCount: 0,
            windowStart: Math.floor(now / resourceConfig.client.windowMs) * resourceConfig.client.windowMs,
            current: { total: 0, cost: 0, heavy: 0, page: 0, rejects: 0, softPass: 0 },
            previous: { total: 0, cost: 0, heavy: 0, page: 0, rejects: 0, softPass: 0 }
          };
          clientStates.set(key, client);
        }

        client.lastSeen = now;
        if (client.cooldownUntil > 0 && client.cooldownUntil <= now) client.cooldownUntil = 0;
        if (client.cooldownLevel > 0 && now - client.lastCooldownAt > resourceConfig.client.cooldownDecayMs) {
          client.cooldownLevel = Math.max(0, client.cooldownLevel - 1);
          client.lastCooldownAt = now;
        }
        return client;
      }

      function rememberClientRequest(req, client, kind, cost, now) {
        client.lastSeen = now;
        const ua = req.headers["user-agent"];
        client.trustedBot = isKnownBot(ua ? String(ua).substring(0, 160) : "");

        const sec = Math.floor(now / 1000);
        if (client.currentSec !== sec) {
            client.currentSec = sec;
            client.currentSecCount = 0;
        }
        client.currentSecCount++;

        updateClientWindow(client, now);
        client.current.total++;
        client.current.cost += cost;

        if (kind === "heavy" || kind === "background") client.current.heavy++;
        if (kind === "page") client.current.page++;
      }

      function rememberDecision(client, decision, now) {
        updateClientWindow(client, now);
        if (decision === "reject") client.current.rejects++;
        if (decision === "page-soft-pass") client.current.softPass++;
      }

      function getClientPressure(client, now) {
        return (getMetric(client, "total", now) + (client.currentSecCount * 3) + (getMetric(client, "heavy", now) * 4) + (getMetric(client, "rejects", now) * 8) + getMetric(client, "cost", now));
      }

      function getNoisyLimits(state) {
        if (state === "critical") return { requests: resourceConfig.client.noisyRequestsCritical, cost: resourceConfig.client.noisyCostCritical };
        if (state === "stressed") return { requests: resourceConfig.client.noisyRequestsStressed, cost: resourceConfig.client.noisyCostStressed };
        return { requests: resourceConfig.client.noisyRequestsWarm, cost: resourceConfig.client.noisyCostWarm };
      }

      function getHeavyLimit(state) {
        if (state === "critical") return resourceConfig.client.maxHeavyRequestsCritical;
        if (state === "stressed") return resourceConfig.client.maxHeavyRequestsStressed;
        return resourceConfig.client.maxHeavyRequestsWarm;
      }

      function clientIsAbsoluteAbuse(client, now) {
        return (client.currentSecCount >= resourceConfig.client.absoluteRequestsPerSecond || getMetric(client, "total", now) >= resourceConfig.client.absoluteRequestsPerWindow || getMetric(client, "cost", now) >= resourceConfig.client.absoluteCostPerWindow);
      }

      function clientIsNoisy(client, state, now) {
        const limits = getNoisyLimits(state);
        return (getMetric(client, "total", now) >= limits.requests || getMetric(client, "cost", now) >= limits.cost || getClientPressure(client, now) >= limits.cost * 1.5);
      }

      function applyClientCooldown(client, reason, now) {
        client.cooldownLevel++;
        client.lastCooldownAt = now;

        const cooldownMs = Math.min(resourceConfig.client.cooldownMaxMs, resourceConfig.client.cooldownBaseMs * Math.pow(2, Math.max(0, client.cooldownLevel - 1)));
        client.cooldownUntil = now + cooldownMs;
        guardStats.cooldownsIssued++;

        console.error(
          "[POKE-resource] client cooldown " +
          JSON.stringify({
            reason, cooldownMs, cooldownLevel: client.cooldownLevel,
            client: {
              ip: anonymizeIP(client.key),
              requests: Math.round(getMetric(client, "total", now)),
              oneSecondRequests: client.currentSecCount,
              heavyRequests: Math.round(getMetric(client, "heavy", now)),
              rejects: Math.round(getMetric(client, "rejects", now)),
              cost: Math.round(getMetric(client, "cost", now) * 100) / 100,
              pressure: Math.round(getClientPressure(client, now) * 100) / 100
            }
          })
        );
      }

      function sampleCpuAndMemory(reason) {
        const now = Date.now();
        const currentPerf = performance.now();
        const elapsedMs = Math.max(1, currentPerf - lastSampleAt);

        const newCpuUsage = process.cpuUsage();
        const cpuDelta = process.cpuUsage(lastCpuUsage);
        lastCpuUsage = newCpuUsage;
        lastSampleAt = currentPerf;

        const cpuUserMs = cpuDelta.user / 1000;
        const cpuSystemMs = cpuDelta.system / 1000;
        const cpuTotalMs = cpuUserMs + cpuSystemMs;
        const cpuRatio = cpuTotalMs / elapsedMs;

        const eldP99 = eldHistogram.percentile(99) / 1e6;
        const eldMean = eldHistogram.mean / 1e6;
        eldHistogram.reset();

        const memory = process.memoryUsage();
        const effectiveTotal = getEffectiveMemoryLimit();
        const rssRatio = effectiveTotal > 0 ? memory.rss / effectiveTotal : 0;
        const heapRatio = effectiveTotal > 0 ? memory.heapUsed / effectiveTotal : 0;

        const kinds = {};
        for (const [kind, count] of currentSecondKindCounts) kinds[kind] = count;

        const snapshot = {
          state: resourceState.state, score: resourceState.score, since: resourceState.since, sampledAt: now, reason: reason || "interval",
          eventLoop: { p99Ms: roundMs(eldP99), meanMs: roundMs(eldMean) },
          cpu: { ratio: roundRatio(cpuRatio), percent: roundRatio(cpuRatio * 100), userMs: roundMs(cpuUserMs), systemMs: roundMs(cpuSystemMs), totalMs: roundMs(cpuTotalMs), elapsedMs: roundMs(elapsedMs) },
          memory: {
            rssMb: bytesToMb(memory.rss), heapUsedMb: bytesToMb(memory.heapUsed), heapTotalMb: bytesToMb(memory.heapTotal),
            externalMb: bytesToMb(memory.external), arrayBuffersMb: bytesToMb(memory.arrayBuffers || 0), rssRatio: roundRatio(rssRatio),
            heapRatio: roundRatio(heapRatio), effectiveTotalMb: bytesToMb(effectiveTotal), systemFreeMb: bytesToMb(os.freemem()), systemTotalMb: bytesToMb(os.totalmem()), constrainedMb: getConstrainedMemoryMb()
          },
          requests: { rps: currentSecondRequests, active: activeRequests.size, kinds },
          topRoutes: getTopMapEntries(currentSecondRouteCounts, resourceConfig.logging.maxTopRoutes), pressureReasons: []
        };

        const pressure = classifyResourcePressure(snapshot);
        snapshot.state = pressure.state;
        snapshot.score = pressure.score;
        snapshot.pressureReasons = pressure.reasons;
        snapshot.since = snapshot.state !== resourceState.state ? now : resourceState.since;

        const shouldLog = now - lastStateLogAt >= resourceConfig.logging.stateCooldownMs;

        resourceState = snapshot;
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
          if (value >= critical) { score += 4; hasCritical = true; reasons.push(name + "=" + value + unit + " critical>=" + critical + unit); return; }
          if (value >= stressed) { score += 2; reasons.push(name + "=" + value + unit + " stressed>=" + stressed + unit); return; }
          if (value >= warm) { score += 1; reasons.push(name + "=" + value + unit + " warm>=" + warm + unit); }
        }

        addPressure("eventLoop", snapshot.eventLoop.p99Ms, cfg.eventLoop.warmMs, cfg.eventLoop.stressedMs, cfg.eventLoop.criticalMs, "ms");
        addPressure("cpu", snapshot.cpu.ratio, cfg.warmCpuRatio, cfg.stressedCpuRatio, cfg.criticalCpuRatio, "");
        addPressure("rssMemory", snapshot.memory.rssRatio, cfg.warmRssRatio, cfg.stressedRssRatio, cfg.criticalRssRatio, "");
        addPressure("heapMemory", snapshot.memory.heapRatio, cfg.warmHeapRatio, cfg.stressedHeapRatio, cfg.criticalHeapRatio, "");

        if (hasCritical || score >= 7) consecutiveCriticalSpikes++; else consecutiveCriticalSpikes = Math.max(0, consecutiveCriticalSpikes - 1);

        if (consecutiveCriticalSpikes >= 5) return { state: "critical", score, reasons };
        if (score >= 4 || consecutiveCriticalSpikes > 0) return { state: "stressed", score, reasons };
        if (score >= 2) return { state: "warm", score, reasons };
        return { state: "healthy", score, reasons };
      }

      function logResourceState() {
        if (resourceState.state === "healthy") {
          console.error(`[POKE-resource] healthy`);
          return;
        }
        let msg = `[POKE-resource] not healthy (${resourceState.state})`;
        const details = [];
        if (resourceState.pressureReasons && resourceState.pressureReasons.length > 0) details.push("System Limits Reached: " + resourceState.pressureReasons.join(", "));
        if (resourceState.topRoutes && resourceState.topRoutes.length > 0) {
          const topRoute = resourceState.topRoutes[0];
          if (topRoute.count > 15) details.push("Too many requests in " + topRoute.key + " right now (" + topRoute.count + " requests in one second)");
          const topPaths = resourceState.topRoutes.slice(0, 4).map(r => r.count + "x " + r.key).join(", ");
          details.push("Heavy paths right now: [" + topPaths + "]");
        }
        if (details.length > 0) msg += " -> Reasons: " + details.join(" | ");
        console.error(msg);
      }

      function logReject(req, client, kind, reason, status, now) {
        if (now - lastRejectLogAt < resourceConfig.logging.rejectCooldownMs) return;
        lastRejectLogAt = now;

        console.error(
          "[POKE-resource] rejected " +
          JSON.stringify({
            reason, status, state: resourceState.state, score: resourceState.score,
            kind, ip: anonymizeIP(client.key),
            client: { requests: Math.round(getMetric(client, "total", now)), oneSecondRequests: client.currentSecCount, heavyRequests: Math.round(getMetric(client, "heavy", now)), pageRequests: Math.round(getMetric(client, "page", now)), rejects: Math.round(getMetric(client, "rejects", now)), cost: Math.round(getMetric(client, "cost", now) * 100) / 100, pressure: Math.round(getClientPressure(client, now) * 100) / 100, cooldownUntil: client.cooldownUntil },
            system: { eventLoop: resourceState.eventLoop, cpu: resourceState.cpu, memory: resourceState.memory }
          })
        );
      }

      function getRandomGuardMessage() { return GUARD_MESSAGES[Math.floor(Math.random() * GUARD_MESSAGES.length)]; }
      function setResourceHeaders(res, decision) { res.set("X-Poke-Resource-Guard", resourceState.state); res.set("X-Poke-Resource-Decision", decision); }

      function getRetryAfterForState(state) {
        if (state === "critical") return resourceConfig.admission.retryAfterCriticalSeconds;
        if (state === "stressed") return resourceConfig.admission.retryAfterStressedSeconds;
        if (state === "warm") return resourceConfig.admission.retryAfterWarmSeconds;
        return resourceConfig.admission.retryAfterHealthyAbuseSeconds;
      }

      function sendGuardReject(req, res, client, kind, options, now) {
        rememberDecision(client, "reject", now);
        const status = options.status || 503;
        const retryAfter = options.retryAfter || resourceConfig.admission.retryAfterStressedSeconds;
        const reason = options.reason || "resource-pressure";

        if (reason === "client-cooldown") guardStats.rejectedCooldown++;
        else if (reason === "absolute-abuse") guardStats.rejectedAbuse++;
        else if (resourceState.state === "critical") guardStats.rejectedCritical++;
        else if (resourceState.state === "stressed") guardStats.rejectedStressed++;
        else guardStats.rejectedWarm++;

        logReject(req, client, kind, reason, status, now);

        res.set("Retry-After", String(retryAfter)); res.set("Cache-Control", "no-store"); res.set("Connection", "close"); res.set("X-Poke-Resource-Guard", resourceState.state); res.set("X-Poke-Resource-Reason", reason);
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

      function getAdmissionDecision(req, client, kind, now) {
        const state = resourceState.state;
        if (state === "healthy") return { action: "allow", reason: "healthy" };

        const noisy = clientIsNoisy(client, state, now);
        const absoluteAbuse = clientIsAbsoluteAbuse(client, now);

        if (client.cooldownUntil > now) return { action: "reject", reason: "client-cooldown", status: 429, retryAfter: Math.ceil((client.cooldownUntil - now) / 1000), message: "Too many expensive requests. Please retry shortly." };
        if (absoluteAbuse) return { action: "cooldown-reject", reason: "absolute-abuse", status: 429, retryAfter: resourceConfig.admission.retryAfterHealthyAbuseSeconds, message: "Too many requests. Please slow down a bit." };

        if (kind === "status") return { action: "allow", reason: "status-pass" };
        if (kind === "static") return { action: "allow", reason: "static-pass" };

        if (state === "warm") {
          if ((kind === "heavy" || kind === "background") && noisy && getMetric(client, "heavy", now) > getHeavyLimit(state)) return { action: "reject", reason: "warm-noisy-expensive-client", status: 429, retryAfter: getRetryAfterForState(state), message: "Too many expensive requests. Please retry shortly." };
          return { action: "allow", reason: "warm-pass" };
        }

        if (state === "stressed") return { action: "allow", reason: "stressed-pass-as-normal" };

        if (state === "critical") {
          if (kind === "page") {
            if (!noisy && getMetric(client, "softPass", now) < resourceConfig.client.pageSoftPassesPerWindow) return { action: "allow-soft-page", reason: "critical-page-soft-pass" };
            return { action: "reject", reason: "critical-noisy-page-client", status: 503, retryAfter: getRetryAfterForState(state), message: "Server is under heavy load. Please retry shortly." };
          }
          if (kind === "other" && !noisy) return { action: "allow", reason: "critical-small-other-pass" };
          return { action: "reject", reason: "critical-shed", status: 503, retryAfter: getRetryAfterForState(state), message: "Server is under heavy load. Please retry shortly." };
        }

        return { action: "allow", reason: "default-pass" };
      }

      function requestActivityTracker(req, res, next) {
        if (!isGuardActive) return next();
        if (isIgnoredRoute(req)) return next();

        const id = ++requestSequence;
        const key = getRequestKey(req);
        const kind = classifyRequest(req);
        const startedAt = Date.now();

        activeRequests.set(id, { id, key, kind, startedAt });
        
        if (!isStatusRequest(req)) {
          totalGlobalRequests++;
          incrementMapCount(activeRequestCounts, key);
          incrementMapCount(currentSecondRouteCounts, key);
          incrementMapCount(allTimeRouteCounts, key);
        }

        res.on("finish", function () {
          const finishedAt = Date.now();
          const durationMs = finishedAt - startedAt;

          if (activeRequests.has(id)) {
            activeRequests.delete(id);
            if (!isStatusRequest(req)) decrementMapCount(activeRequestCounts, key);
          }

          if (durationMs >= resourceConfig.logging.slowRequestMs) {
            recentSlowRequests.push({ key, kind, statusCode: res.statusCode, durationMs });
            while (recentSlowRequests.length > resourceConfig.logging.maxRecentSlow) recentSlowRequests.shift();
          }
        });

        res.on("close", function () {
          if (activeRequests.has(id)) {
            activeRequests.delete(id);
            if (!isStatusRequest(req)) decrementMapCount(activeRequestCounts, key);
          }
        });

        next();
      }

      function resourceAdmissionMiddleware(req, res, next) {
        if (!isGuardActive) return next();
        if (isIgnoredRoute(req)) return next();

        const now = Date.now();
        const kind = classifyRequest(req);
        const cost = getKindCost(kind, req);
        const client = getClientState(req, now);

        rememberClientRequest(req, client, kind, cost, now);

        currentSecondRequests++;
        incrementMapCount(currentSecondKindCounts, kind);

        const decision = getAdmissionDecision(req, client, kind, now);

        if (decision.action === "allow") { allowRequest(res, kind, decision.reason); return next(); }
        if (decision.action === "allow-soft-page") { rememberDecision(client, "page-soft-pass", now); allowRequest(res, kind, decision.reason); return next(); }
        if (decision.action === "cooldown-reject") { applyClientCooldown(client, decision.reason, now); return sendGuardReject(req, res, client, kind, decision, now); }

        if (decision.action === "reject" && (decision.reason === "stressed-expensive-shed" || decision.reason === "critical-shed") && (kind === "heavy" || kind === "background") && getMetric(client, "heavy", now) >= getHeavyLimit(resourceState.state)) {
          applyClientCooldown(client, decision.reason, now);
        }

        return sendGuardReject(req, res, client, kind, decision, now);
      }

      function cleanupClients() {
        const now = Date.now();
        const maxAge = resourceConfig.client.windowMs * 3;
        for (const [key, client] of clientStates) {
          if (getMetric(client, "total", now) === 0 && client.currentSecCount === 0 && client.cooldownUntil <= now && now - client.lastSeen > maxAge) clientStates.delete(key);
        }
      }

      function countClientStates() {
        const now = Date.now();
        let active = 0, cooldown = 0, noisy = 0;
        for (const [, client] of clientStates) {
          if (getMetric(client, "total", now) > 0) active++;
          if (client.cooldownUntil > now) cooldown++;
          if (clientIsNoisy(client, resourceState.state, now)) noisy++;
        }
        return { tracked: clientStates.size, active, cooldown, noisy };
      }

      let cachedStats = null;
      let cachedStatsTime = 0;
      const STATS_TTL_MS = 1500;

      function getResourceStats() {
        const now = Date.now();
        if (cachedStats && now - cachedStatsTime < STATS_TTL_MS) return cachedStats;

        cachedStats = {
          guard: "PokeResourceGuard V4 FastMode", state: resourceState, clients: countClientStates(),
          active_requests: {
            total: activeRequests.size, total_global_requests: totalGlobalRequests, tracking_start_time: trackingStartTime,
            by_route: getTopMapEntries(currentSecondRouteCounts, resourceConfig.logging.maxTopRoutes),
            all_time_top_routes: getTopMapEntries(allTimeRouteCounts, 12),
            oldest: getActiveRequestSummary(resourceConfig.logging.maxTopRoutes),
            recent_slow: recentSlowRequests.slice(-resourceConfig.logging.maxRecentSlow).reverse()
          },
          stats: guardStats, config: { system: resourceConfig.system, client: resourceConfig.client, admission: resourceConfig.admission, request_cost: resourceConfig.requestCost }
        };
        
        cachedStatsTime = now;
        return cachedStats;
      }

      function sendResourceStats(req, res) {
        if (!isGuardActive) return res.status(503).json({ message: "Guard is initializing, please wait..." });
        res.json(getResourceStats());
      }

      const HEALTH_CSS = `
@font-face { font-family: "PokeTube Flex"; src: url("/static/robotoflex.ttf"); font-style: normal; font-stretch: 1% 800%; font-display: swap; }
:root{color-scheme:dark} body{color:#fff;background:#1c1b22;margin:0;font-family:system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,"Noto Sans",sans-serif;}
a{color:#0ab7f0;text-decoration:none;transition:color 0.2s;} a:hover{color:#00c0ff;text-decoration:underline;}
.app{max-width:1100px;margin:0 auto;padding:24px;} h1,h2,h3,.tab-btn,.hero-label,.route-rank{font-family:"PokeTube Flex",system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,"Noto Sans",sans-serif;}
h1,h2{font-stretch:extra-expanded;letter-spacing:-0.5px;} h1{font-weight:900;font-size:2.2rem;margin-top:0;margin-bottom:4px;}
h2{margin-top:32px;border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:8px;} p,li,code,pre{line-height:1.6;}
hr{border:0;border-top:1px solid rgba(255,255,255,0.1);margin:32px 0;} .logo{float:right;margin:.3em 0 1em 2em;max-width:130px;}
.header-container{display:flex;justify-content:space-between;align-items:flex-end;flex-wrap:wrap;margin-bottom:24px;gap:16px;}
.tabs{display:inline-flex;background:#15141a;border-radius:24px;padding:4px;border:1px solid rgba(255,255,255,0.05);flex-wrap:wrap;gap:2px;}
.tab-btn{background:transparent;color:#aaa;border:none;padding:8px 20px;border-radius:20px;cursor:pointer;font-weight:700;font-size:0.95rem;transition:all 0.3s ease;outline:none;display:inline-block;line-height:1.2;}
.tab-btn:hover:not(.active){color:#fff;text-decoration:none;} .tab-btn.active{background:#0ab7f0;color:#1c1b22;box-shadow:0 2px 8px rgba(10,183,240,0.3);}
.hero-stat{padding:16px 0 32px 0;text-align:center;} .hero-label{font-size:1.1rem;color:#aaa;margin-top:8px;text-transform:uppercase;letter-spacing:2px;}
.hero-num{font-size:4rem;font-weight:900;color:#0ab7f0;margin:10px 0;line-height:1;} .privacy-badge{display:inline-flex;align-items:center;color:#4caf50;padding:6px 12px;border-radius:10px;font-size:0.9rem;font-weight:bold;margin-bottom:16px;}
.stat-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:16px;margin-top:16px;}
.stat-box{background:#2a2930;border-radius:12px;padding:16px;margin:0;display:flex;flex-direction:column;justify-content:center;align-items:flex-start;border:1px solid rgba(255,255,255,0.05);}
.stat-num{font-size:1.6rem;color:#0ab7f0;display:block;font-weight:bold;text-transform:capitalize;} .stat-label{font-size:.9rem;color:#aaa;display:block;margin-top:4px;}
.green{color:#4caf50} .orange{color:#ff9800} .red{color:#f44336} code,pre{background:#2a2930;padding:2px 6px;border-radius:4px;}
pre{overflow:auto;padding:14px;border:1px solid #333;} .banner{padding:16px 20px;border-radius:12px;background:#2a2930;border:1px solid rgba(255,255,255,0.05);transition:border-left 0.3s ease;}
.banner.green{border-left:5px solid #4caf50} .banner.orange{border-left:5px solid #ff9800} .banner.red{border-left:5px solid #f44336}
.small{color:#bbb;font-size:.95rem;font-family:system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,"Noto Sans",sans-serif;}
.explanation{font-size:1.05rem;color:#ddd;background:#2a2930;padding:20px;border-radius:12px;border-left:4px solid #0ab7f0;margin-bottom:24px;}
summary{font-size:1.2rem;cursor:pointer;color:#0ab7f0;user-select:none;margin-bottom:12px;font-weight:bold;transition:color 0.2s;font-family:"PokeTube Flex",system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,"Noto Sans",sans-serif;}
.route-list{display:flex;flex-direction:column;gap:12px;margin-top:16px;} .route-item{background:#25242b;border-radius:12px;padding:16px 20px;display:flex;justify-content:space-between;align-items:center;border:1px solid rgba(255,255,255,0.05);position:relative;overflow:hidden;}
.route-bar{position:absolute;left:0;top:0;bottom:0;background:linear-gradient(90deg,rgba(10,183,240,0.05) 0%,rgba(10,183,240,0.15) 100%);z-index:1;transition:width 0.6s cubic-bezier(0.22,1,0.36,1);}
.route-info{display:flex;align-items:center;gap:12px;z-index:2;} .route-rank{font-size:0.85rem;font-weight:900;color:#1c1b22;background:#0ab7f0;width:28px;height:28px;border-radius:50%;display:flex;justify-content:center;align-items:center;}
.route-name{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:1.05rem;color:#eee;padding:4px 8px;border-radius:6px;background:rgba(255,255,255,0.05);letter-spacing:-0.2px;}
.route-count{font-size:1.15rem;font-weight:900;color:#fff;z-index:2;background:rgba(0,0,0,0.3);padding:6px 14px;border-radius:20px;border:1px solid rgba(255,255,255,0.1);}
@media (max-width:640px){.hero-num{font-size:3rem} .route-item{align-items:flex-start;gap:12px;flex-direction:column} .route-count{align-self:flex-end}}
`;

      function formatRouteCount(c) {
        if (c === 67) return '67 <span style="font-size:0.85em; color:#aaa; font-weight:normal;">(really)</span>';
        if (c === 69) return '69 <span style="font-size:0.85em; color:#aaa; font-weight:normal;">(haha nice)</span>';
        if (c === 420) return '<span style="color:#4caf50;">420 <span style="font-size:0.85em; font-weight:normal;">(some weed everyday!)</span></span>';
        return Number(c || 0).toLocaleString();
      }

      function renderRouteList(topRoutes) {
        if (!topRoutes || topRoutes.length === 0) return `<div class="route-item" style="justify-content:center;color:#aaa;">Nothing big yet, Poke is still gathering cozy little traffic stats.</div>`;
        const maxCount = Math.max(1, topRoutes[0].count || 1);
        return topRoutes.map((r, i) => {
          const pct = ((r.count || 0) / maxCount) * 100;
          return `<div class="route-item"><div class="route-bar" style="width: ${pct}%"></div><div class="route-info"><span class="route-rank">#${i + 1}</span><span class="route-name">${String(r.key || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</span></div><span class="route-count">${formatRouteCount(r.count)}</span></div>`;
        }).join("");
      }

      let cachedHealthHtml = null;
      let cachedHealthTime = 0;

      function sendAntiddosPage(req, res) {
        if (!isGuardActive) return res.status(503).send("Poke is waking up the guard, please refresh in a moment.");
        const now = Date.now();
        if (cachedHealthHtml && now - cachedHealthTime < STATS_TTL_MS) return res.send(cachedHealthHtml);
        
        const stats = getResourceStats();
        const stateClass = stats.state.state === "healthy" ? "green" : stats.state.state === "warm" ? "orange" : stats.state.state === "stressed" ? "orange" : "red";

        cachedHealthHtml = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Poke Server Health</title><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="/favicon.ico"><style>${HEALTH_CSS}</style></head><body><div class="app"><noscript><div class="banner orange" style="margin-bottom:24px;"><b>JavaScript is disabled:</b> this is a static little snapshot of Poke's server mood. Refresh the page whenever you want fresh numbers.</div></noscript><img class="logo" src="/css/logo-poke.svg" alt="Poke logo"><div class="header-container"><div><h1>Poke Server Health</h1><p class="small" style="margin-top:0;">Live server Health!!!</p></div><div class="tabs"><a class="tab-btn active" href="/health">Server Vitals</a><a class="tab-btn" href="/traffic">Requests</a><a class="tab-btn" href="/api/stats?view=gui">Anonymous Stats</a></div></div><div id="banner-container" class="banner ${stateClass}"><b>Current Status:</b> <span id="banner-state" class="${stateClass}" style="font-size:1.2rem;text-transform:capitalize;">${stats.state.state}</span><br><span id="banner-subtext" class="small" style="display:inline-block;margin-top:8px;">Load Score: ${stats.state.score} &bull; Process Delay: ${stats.state.eventLoop.p99Ms}ms &bull; CPU: ${stats.state.cpu.percent}% &bull; Memory: ${formatPercent(stats.state.memory.rssRatio)}</span></div><h2>What is this page?</h2><div class="explanation">This is Poke checking in on itself so everything stays fast and comfy. It watches CPU, memory, request pressure, and process delay in real time, then uses that info to keep the site feeling smooth. <br><br>If traffic suddenly gets wild, Poke gently shields the server and tries to keep normal video watching flowing first. Basically, this page is the little heartbeat monitor for the whole instance!!</div><h2>Live Server Vitals!!</h2><div class="stat-grid"><div class="stat-box"><span id="stat-state" class="stat-num ${stateClass}">${stats.state.state}</span><span class="stat-label">Health Mood</span></div><div class="stat-box"><span id="stat-p99" class="stat-num">${stats.state.eventLoop.p99Ms}ms</span><span class="stat-label">Process Delay</span></div><div class="stat-box"><span id="stat-cpu" class="stat-num">${stats.state.cpu.percent}%</span><span class="stat-label">CPU Busy Level</span></div><div class="stat-box"><span id="stat-rss" class="stat-num">${stats.state.memory.rssMb}MB</span><span class="stat-label">Memory Used</span></div><div class="stat-box"><span id="stat-rps" class="stat-num">${stats.state.requests.rps}</span><span class="stat-label">Requests Right Now</span></div><div class="stat-box"><span id="stat-tracked" class="stat-num">${stats.clients.tracked}</span><span class="stat-label">Active Visitors</span></div><div class="stat-box"><span id="stat-cooldown" class="stat-num">${stats.clients.cooldown}</span><span class="stat-label">Noisy Clients Cooling Down</span></div><div class="stat-box"><span id="stat-score" class="stat-num">${stats.state.score}</span><span class="stat-label">Pressure Score</span></div></div><hr><details><summary>View Nerdy Stats, Raw Data, and APIs</summary><h3>Why Poke feels this way</h3><pre id="pre-reasons">${stats.state.pressureReasons.length ? stats.state.pressureReasons.join("\n") : "No pressure reasons right now. Poke is feeling good."}</pre><h3>Request Mix This Second</h3><pre id="pre-mix">${JSON.stringify(stats.state.requests.kinds, null, 2)}</pre><h3>API Endpoints</h3><p>Want the raw numbers too? They live at: <code><a href="/_pokeresource/stats">/_pokeresource/stats</a></code></p></details><hr><p class="small">powered by poke. <a href="/">go back to watching videos</a></p></div><script>document.addEventListener("DOMContentLoaded", function() { const fetchStats = async function() { try { const res = await fetch("/_pokeresource/stats"); if (!res.ok) return; const data = await res.json(); const state = data.state.state; let stateClass = "green"; if (state === "warm" || state === "stressed") stateClass = "orange"; if (state === "critical") stateClass = "red"; document.getElementById("banner-container").className = "banner " + stateClass; document.getElementById("banner-state").className = stateClass; document.getElementById("banner-state").innerText = state; const rssRatio = (data.state.memory.rssRatio * 100).toFixed(2) + "%"; document.getElementById("banner-subtext").innerHTML = "Load Score: " + data.state.score + " &bull; Process Delay: " + data.state.eventLoop.p99Ms + "ms &bull; CPU: " + data.state.cpu.percent + "% &bull; Memory: " + rssRatio; document.getElementById("stat-state").className = "stat-num " + stateClass; document.getElementById("stat-state").innerText = state; document.getElementById("stat-p99").innerText = data.state.eventLoop.p99Ms + "ms"; document.getElementById("stat-cpu").innerText = data.state.cpu.percent + "%"; document.getElementById("stat-rss").innerText = data.state.memory.rssMb + "MB"; document.getElementById("stat-rps").innerText = data.state.requests.rps; document.getElementById("stat-tracked").innerText = data.clients.tracked; document.getElementById("stat-cooldown").innerText = data.clients.cooldown; document.getElementById("stat-score").innerText = data.state.score; document.getElementById("pre-reasons").innerText = data.state.pressureReasons.length ? data.state.pressureReasons.join("\\n") : "No pressure reasons right now. Poke is feeling good."; document.getElementById("pre-mix").innerText = JSON.stringify(data.state.requests.kinds, null, 2); } catch (err) {} }; setInterval(fetchStats, 1000); });</script></body></html>`;
        cachedHealthTime = now;
        res.send(cachedHealthHtml);
      }

      let cachedTrafficHtml = null;
      let cachedTrafficTime = 0;

      function sendTrafficPage(req, res) {
        if (!isGuardActive) return res.status(503).send("Poke is waking up the guard, please refresh in a moment.");
        const now = Date.now();
        if (cachedTrafficHtml && now - cachedTrafficTime < STATS_TTL_MS) return res.send(cachedTrafficHtml);

        const stats = getResourceStats();
        const routesHtml = renderRouteList(stats.active_requests.all_time_top_routes);

        cachedTrafficHtml = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Poke Traffic Stats</title><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="/favicon.ico"><style>${HEALTH_CSS}</style></head><body><div class="app"><noscript><div class="banner orange" style="margin-bottom:24px;"><b>JavaScript is disabled:</b> this is a static snapshot of Poke's anonymous traffic stats. Refresh whenever you want the newest totals! </div></noscript><img class="logo" src="/css/logo-poke.svg" alt="Poke logo"><div class="header-container"><div><h1>Poke Traffic Stats</h1><p class="small" style="margin-top:0;">ALLLL off the popular paths!!</p></div><div class="tabs"><a class="tab-btn" href="/health">Server Vitals</a><a class="tab-btn active" href="/traffic">Requests</a><a class="tab-btn" href="/api/stats?view=gui">Anonymous Stats</a></div></div><div class="hero-stat"><div class="privacy-badge"><svg style="width:16px;height:16px;margin-right:6px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>100% Anonymous & Private</div><div class="hero-label">Total Global Requests Processed</div><div id="hero-total" class="hero-num">${stats.active_requests.total_global_requests.toLocaleString()}</div><div class="small" style="color:#888;font-size:1rem;">Poke started counting these anonymous totals on: <span id="tracking-start">${new Date(stats.active_requests.tracking_start_time).toLocaleDateString()}</span></div></div><h2>Most Popular Destinations!!</h2><p class="small">The most heavily trafficked areas of Poke calculated since records began!!</p><div id="route-list-container" class="route-list">${routesHtml}</div><hr><p class="small">powered by poke. <a href="/health">view server health</a> or <a href="/">go back to watching videos</a></p></div><script>document.addEventListener("DOMContentLoaded", function() { const formatRouteCount = function(c) { if (c === 67) return '67 <span style="font-size:0.85em; color:#aaa; font-weight:normal;">(really)</span>'; if (c === 69) return '69 <span style="font-size:0.85em; color:#aaa; font-weight:normal;">(haha nice)</span>'; if (c === 420) return '<span style="color:#4caf50;">420 <span style="font-size:0.85em; font-weight:normal;">(some weed everyday!)</span></span>'; return Number(c || 0).toLocaleString(); }; const escapeHtml = function(value) { return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }; const fetchStats = async function() { try { const res = await fetch("/_pokeresource/stats"); if (!res.ok) return; const data = await res.json(); document.getElementById("hero-total").innerText = data.active_requests.total_global_requests.toLocaleString(); document.getElementById("tracking-start").innerText = new Date(data.active_requests.tracking_start_time).toLocaleDateString(); const topRoutes = data.active_requests.all_time_top_routes; if (topRoutes && topRoutes.length > 0) { const maxCount = topRoutes[0].count || 1; const routeHtml = topRoutes.map(function(r, i) { const pct = ((r.count || 0) / maxCount) * 100; return '<div class="route-item">' + '<div class="route-bar" style="width: ' + pct + '%"></div>' + '<div class="route-info">' + '<span class="route-rank">#' + (i + 1) + '</span>' + '<span class="route-name">' + escapeHtml(r.key) + '</span>' + '</div>' + '<span class="route-count">' + formatRouteCount(r.count) + '</span>' + '</div>'; }).join(""); document.getElementById("route-list-container").innerHTML = routeHtml; } } catch (err) {} }; setInterval(fetchStats, 1000); });</script></body></html>`;
        cachedTrafficTime = now;
        res.send(cachedTrafficHtml);
      }

      app.use(requestActivityTracker);
      app.use(resourceAdmissionMiddleware);

      app.get("/_pokeresource/stats", sendResourceStats);
      app.get("/_poketraffic/stats", sendResourceStats);
      app.get("/_pokestopskids/stats", sendResourceStats);
      app.get("/_pokeoverload/stats", sendResourceStats);
      app.get("/health", sendAntiddosPage);
      app.get("/traffic", sendTrafficPage);
      app.get("/_antiddos*", (req, res) => res.redirect("/health"));

      setTimeout(() => {
        isGuardActive = true;
        initlog(`[PokeResourceGuard] is now ACTIVE after 30ms boot delay.`);
        sampleCpuAndMemory("startup");

        const sampleTimer = setInterval(function () {
          sampleCpuAndMemory("interval");
        }, resourceConfig.system.sampleMs);
        sampleTimer.unref();

        const cleanupTimer = setInterval(cleanupClients, resourceConfig.client.cleanupMs);
        cleanupTimer.unref();
        
        initlog(
          `[PokeResourceGuard] loaded - EventLoop/CPU/memory optimized shedder, ` +
          `EL p99 warm/stressed/critical: ` + resourceConfig.system.eventLoop.warmMs + `/` + resourceConfig.system.eventLoop.stressedMs + `/` + resourceConfig.system.eventLoop.criticalMs
        );
      }, 30);

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

          if (res.destroyed) return;
          if (res.writableEnded) return;

          if (res.headersSent) {
            try {
              res.write("\n");
              return res.end();
            } catch (writeErr) {
              console.error("[POKE-render] could not write render error after headers were sent:", writeErr.message);
              return;
            }
          }

          return res.status(500).send("Internal server error");
        }

        if (res.destroyed) return;
        if (res.writableEnded) return;

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
          if (!/^https:/i.test(request.headers["x-forwarded-proto"] || request.protocol)) {
            return response.redirect("https://" + request.headers.host + request.url);
          }
        }
        next();
      });

      app.use(function (req, res, next) {
        res.header("X-PokeTube-Youtube-Client-Name", innertube.innertube.CONTEXT_CLIENT.INNERTUBE_CONTEXT_CLIENT_NAME);
        res.header("Hey-there", "Do u wanna help poke? join us :3 https://codeberg.org/ashleyirispuppy/poke");
        res.header("X-PokeTube-Youtube-Client-Version", innertube.innertube.CLIENT.clientVersion);
        res.header("X-PokeTube-Client-name", innertube.innertube.CLIENT.projectClientName);
        res.header("X-PokeTube-Speeder", "3 seconds no cache, 280ms w/cache");
        res.header("X-HOSTNAME", req.hostname);
        
        if (req.url.match(/^\/(css|js|img|font)\/.+/)) {
          res.setHeader("Cache-Control", "public, max-age=" + config.cacher_max_age);
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
       if (err.code === 'ECONNRESET' || err.code === 'ECONNABORTED' || err.code === 'EPIPE' || err.code === 'UND_ERR_CONNECT_TIMEOUT') {
         if (!res.headersSent) {
            res.status(500).end();
         }
         return;
      }

      console.error("[POKE-error]", req.method, req.originalUrl, ":", err.message);
      if (process.env.NODE_ENV !== "production") {
        console.error(err.stack);
      }

      if (res.destroyed || res.writableEnded) return;
      if (res.headersSent) return next(err);

      res.status(500).send("Something went wrong. Please try again.");
    });
  })();

}