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
  const net = require("net");
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
   * Shared IP helpers.
   */
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
   * PokeResponseGuard
   *
   * This catches accidental double responses without turning the request into
   * a forever-hanging socket.
   *
   * Important detail: write and writeHead are allowed to be followed by end.
   * That keeps streaming responses working while still blocking send-after-send.
   */
  (function PokeResponseGuard() {
    const RESPONSE_GUARD_TIMEOUT_MS = 120000;
    const DUPLICATE_STACK_LINES = 8;

    app.use(function pokeResponseGuard(req, res, next) {
      const originalSend = res.send.bind(res);
      const originalJson = res.json.bind(res);
      const originalRedirect = res.redirect.bind(res);
      const originalRender = res.render.bind(res);
      const originalEnd = res.end.bind(res);
      const originalWrite = res.write.bind(res);
      const originalWriteHead = res.writeHead.bind(res);

      let firstCommit = null;
      let duplicateCount = 0;
      let finished = false;
      let closed = false;
      let commitDepth = 0;
      let fallbackScheduled = false;

      const startedAt = Date.now();

      function nowAgeMs() {
        return Date.now() - startedAt;
      }

      function cleanStack(stack) {
        return String(stack || "")
          .split("\n")
          .slice(2, 2 + DUPLICATE_STACK_LINES)
          .map(function (line) {
            return line.trim();
          })
          .join(" | ");
      }

      function getCommitStack() {
        return cleanStack(new Error().stack);
      }

      function requestLabel() {
        return req.method + " " + (req.originalUrl || req.url || "/");
      }

      function responseDone() {
        return finished || closed || res.writableEnded || res.destroyed;
      }

      function logDuplicate(method) {
        duplicateCount++;

        const logBody = {
          request: requestLabel(),
          duplicateMethod: method,
          duplicateCount,
          ageMs: nowAgeMs(),
          statusCode: res.statusCode,
          headersSent: res.headersSent,
          writableEnded: res.writableEnded,
          destroyed: res.destroyed,
          firstCommit,
          duplicateStack: getCommitStack()
        };

        console.error("[POKE-response-guard] duplicate response blocked " + JSON.stringify(logBody));
      }

      function canWriteMore(method) {
        if (commitDepth > 0) {
          return true;
        }

        if (responseDone()) {
          logDuplicate(method);
          return false;
        }

        if (method === "write") {
          if (!firstCommit) {
            firstCommit = {
              method: "write",
              at: Date.now(),
              ageMs: nowAgeMs(),
              statusCode: res.statusCode,
              stack: getCommitStack()
            };
          }
          return true;
        }

        if (method === "writeHead") {
          if (res.headersSent) {
            logDuplicate(method);
            return false;
          }

          if (!firstCommit) {
            firstCommit = {
              method: "writeHead",
              at: Date.now(),
              ageMs: nowAgeMs(),
              statusCode: res.statusCode,
              stack: getCommitStack()
            };
          }

          return true;
        }

        if (method === "end") {
          if (!firstCommit) {
            firstCommit = {
              method: "end",
              at: Date.now(),
              ageMs: nowAgeMs(),
              statusCode: res.statusCode,
              stack: getCommitStack()
            };
            return true;
          }

          if (firstCommit.method === "write" || firstCommit.method === "writeHead") {
            return true;
          }

          logDuplicate(method);
          return false;
        }

        if (res.headersSent) {
          logDuplicate(method);
          return false;
        }

        if (firstCommit) {
          logDuplicate(method);
          scheduleNoHangFallback(method);
          return false;
        }

        firstCommit = {
          method,
          at: Date.now(),
          ageMs: nowAgeMs(),
          statusCode: res.statusCode,
          stack: getCommitStack()
        };

        return true;
      }

      function rollbackCommitIfNothingWasSent(method, err) {
        if (!res.headersSent && !responseDone() && firstCommit && firstCommit.method === method) {
          firstCommit = null;
        }

        console.error(
          "[POKE-response-guard] " +
          method +
          " threw before response was committed on " +
          requestLabel() +
          ": " +
          (err && err.message ? err.message : err)
        );
      }

      function scheduleNoHangFallback(method) {
        if (fallbackScheduled) {
          return;
        }

        fallbackScheduled = true;

        setImmediate(function () {
          if (res.headersSent || responseDone()) {
            return;
          }

          try {
            res.statusCode = 500;
            res.setHeader("Cache-Control", "no-store");
            res.setHeader("Connection", "close");
            originalEnd("Internal server error");
            console.error(
              "[POKE-response-guard] forced fallback response after duplicate " +
              method +
              " on " +
              requestLabel()
            );
          } catch (err) {
            console.error(
              "[POKE-response-guard] fallback failed on " +
              requestLabel() +
              ": " +
              (err && err.message ? err.message : err)
            );

            try {
              if (req.socket && !req.socket.destroyed) {
                req.socket.destroy();
              }
            } catch {}
          }
        });
      }

      const timeout = setTimeout(function () {
        if (res.headersSent || responseDone()) {
          return;
        }

        console.error(
          "[POKE-response-guard] request had no response after " +
          RESPONSE_GUARD_TIMEOUT_MS +
          "ms, forcing 504 on " +
          requestLabel()
        );

        try {
          res.statusCode = 504;
          res.setHeader("Cache-Control", "no-store");
          res.setHeader("Connection", "close");
          originalEnd("Gateway timeout");
        } catch (err) {
          console.error(
            "[POKE-response-guard] timeout fallback failed on " +
            requestLabel() +
            ": " +
            (err && err.message ? err.message : err)
          );

          try {
            if (req.socket && !req.socket.destroyed) {
              req.socket.destroy();
            }
          } catch {}
        }
      }, RESPONSE_GUARD_TIMEOUT_MS);

      timeout.unref();

      res.on("finish", function () {
        finished = true;
        clearTimeout(timeout);

        if (duplicateCount > 0) {
          console.error(
            "[POKE-response-guard] request finished after duplicate response attempt " +
            JSON.stringify({
              request: requestLabel(),
              ageMs: nowAgeMs(),
              statusCode: res.statusCode,
              duplicateCount,
              firstCommit
            })
          );
        }
      });

      res.on("close", function () {
        closed = true;
        clearTimeout(timeout);
      });

      res.writeHead = function (...args) {
        if (!canWriteMore("writeHead")) {
          return res;
        }

        try {
          commitDepth++;
          return originalWriteHead(...args);
        } catch (err) {
          rollbackCommitIfNothingWasSent("writeHead", err);
          throw err;
        } finally {
          commitDepth--;
        }
      };

      res.write = function (...args) {
        if (!canWriteMore("write")) {
          return false;
        }

        try {
          commitDepth++;
          return originalWrite(...args);
        } catch (err) {
          rollbackCommitIfNothingWasSent("write", err);
          throw err;
        } finally {
          commitDepth--;
        }
      };

      res.end = function (...args) {
        if (!canWriteMore("end")) {
          return res;
        }

        try {
          commitDepth++;
          return originalEnd(...args);
        } catch (err) {
          rollbackCommitIfNothingWasSent("end", err);
          throw err;
        } finally {
          commitDepth--;
        }
      };

      res.send = function (...args) {
        if (!canWriteMore("send")) {
          return res;
        }

        try {
          commitDepth++;
          return originalSend(...args);
        } catch (err) {
          rollbackCommitIfNothingWasSent("send", err);
          throw err;
        } finally {
          commitDepth--;
        }
      };

      res.json = function (...args) {
        if (!canWriteMore("json")) {
          return res;
        }

        try {
          commitDepth++;
          return originalJson(...args);
        } catch (err) {
          rollbackCommitIfNothingWasSent("json", err);
          throw err;
        } finally {
          commitDepth--;
        }
      };

      res.redirect = function (...args) {
        if (!canWriteMore("redirect")) {
          return res;
        }

        try {
          commitDepth++;
          return originalRedirect(...args);
        } catch (err) {
          rollbackCommitIfNothingWasSent("redirect", err);
          throw err;
        } finally {
          commitDepth--;
        }
      };

      res.render = function (view, data, callback) {
        if (res.headersSent || responseDone()) {
          logDuplicate("render");
          return;
        }

        if (typeof data === "function") {
          callback = data;
          data = {};
        }

        if (typeof callback === "function") {
          return originalRender(view, data || {}, function (err, html) {
            return callback(err, html);
          });
        }

        return originalRender(view, data || {}, function (err, html) {
          if (err) {
            console.error(
              "[POKE-response-guard] render failed on " +
              requestLabel() +
              " view=" +
              view +
              ": " +
              (err && err.message ? err.message : err)
            );

            if (!res.headersSent && !responseDone()) {
              return res.status(500).send("Internal server error");
            }

            return;
          }

          if (!res.headersSent && !responseDone()) {
            return res.send(html);
          }

          logDuplicate("render-callback-send");
        });
      };

      next();
    });

    initlog("[POKE-response-guard] loaded");
  })();

  /*
   * PokeTrafficGuard
   *
   * A pressure-aware traffic guard.
   *
   * Main behavior:
   * - healthy server: almost everything passes
   * - warm server: log and watch, shed only very noisy expensive clients
   * - stressed server: protect expensive API, proxy, media, and background work first
   * - critical server: allow status/static, protect page navigation where possible, shed expensive work
   *
   * It does not try to punish normal users for clicking around quickly.
   * It only gets strict when the process is actually showing pressure.
   */
  (function PokeTrafficGuard() {
    const trafficConfig = {
      system: {
        sampleMs: 1000,
        eventLoopResolutionMs: 20,

        warmP99LagMs: 120,
        stressedP99LagMs: 350,
        criticalP99LagMs: 1200,

        warmMeanLagMs: 60,
        stressedMeanLagMs: 180,
        criticalMeanLagMs: 600,

        warmEventLoopUse: 0.78,
        stressedEventLoopUse: 0.90,
        criticalEventLoopUse: 0.97,

        warmCpuUse: 0.85,
        stressedCpuUse: 1.15,
        criticalCpuUse: 1.75,

        warmRps: 600,
        stressedRps: 1400,
        criticalRps: 3000,

        warmActiveRequests: 250,
        stressedActiveRequests: 650,
        criticalActiveRequests: 1400,

        warmMemoryRssRatio: 0.82,
        stressedMemoryRssRatio: 0.90,
        criticalMemoryRssRatio: 0.96
      },

      client: {
        windowMs: 30000,
        oneSecondMs: 1000,
        maxClientStates: 75000,
        cleanupMs: 60000,

        absoluteRequestsPerSecond: 90,
        absoluteRequestsPerWindow: 500,
        absoluteCostPerWindow: 1800,

        noisyRequestsWarm: 180,
        noisyCostWarm: 700,
        noisyRequestsStressed: 90,
        noisyCostStressed: 300,
        noisyRequestsCritical: 35,
        noisyCostCritical: 120,

        pageSoftPassesPerWindow: 10,

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
        pageGraceMs: 700,
        pageGracePollMs: 70,
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

    let trafficState = {
      state: "healthy",
      score: 0,
      since: Date.now(),
      sampledAt: Date.now(),
      reason: "startup",
      rps: 0,
      activeRequests: 0,
      loop: {
        p50Ms: 0,
        p90Ms: 0,
        p99Ms: 0,
        meanMs: 0,
        maxMs: 0,
        utilization: 0
      },
      cpu: {
        ratio: 0,
        userMs: 0,
        systemMs: 0,
        totalMs: 0
      },
      memory: {
        rssMb: 0,
        heapUsedMb: 0,
        heapTotalMb: 0,
        rssRatio: 0
      },
      system: {
        loadavg: [],
        freeMemoryMb: 0,
        totalMemoryMb: 0
      },
      kinds: {},
      pressureReasons: []
    };

    let lastStateLogAt = 0;
    let lastRejectLogAt = 0;
    let currentSecondRequests = 0;
    let currentSecondKindCounts = new Map();
    let currentSecondRouteCounts = new Map();

    let lastSampleAt = performance.now();
    let lastCpuUsage = process.cpuUsage();
    let lastEventLoopUtilization = performance.eventLoopUtilization();

    let requestSequence = 0;
    const activeRequests = new Map();
    const activeRequestCounts = new Map();
    const recentSlowRequests = [];
    const clientStates = new Map();

    const loopDelay = monitorEventLoopDelay({
      resolution: trafficConfig.system.eventLoopResolutionMs
    });
    loopDelay.enable();

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
      pageGracePassed: 0,
      cooldownsIssued: 0
    };

    function bytesToMb(bytes) {
      return Math.round(bytes / 1024 / 1024);
    }

    function nsToMs(ns) {
      if (!Number.isFinite(ns) || ns <= 0 || ns > 3_600_000_000_000) {
        return 0;
      }

      return Math.round((ns / 1_000_000) * 100) / 100;
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
      const now = performance.now();

      return Array.from(activeRequests.values())
        .map(function (request) {
          return {
            id: request.id,
            key: request.key,
            kind: request.kind,
            ageMs: roundMs(now - request.startedAt)
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
      let cost = trafficConfig.requestCost[kind] || trafficConfig.requestCost.other;

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
      const oldest = now - trafficConfig.client.windowMs;
      const oneSecondOldest = now - trafficConfig.client.oneSecondMs;

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

      if (client.cooldownLevel > 0 && now - client.lastCooldownAt > trafficConfig.client.cooldownDecayMs) {
        client.cooldownLevel = Math.max(0, client.cooldownLevel - 1);
        client.lastCooldownAt = now;
      }

      client.costWindow = client.costEntries.reduce(function (total, entry) {
        return total + entry.cost;
      }, 0);
    }

    function evictClientStateIfNeeded() {
      if (clientStates.size < trafficConfig.client.maxClientStates) {
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
          requests: trafficConfig.client.noisyRequestsCritical,
          cost: trafficConfig.client.noisyCostCritical
        };
      }

      if (state === "stressed") {
        return {
          requests: trafficConfig.client.noisyRequestsStressed,
          cost: trafficConfig.client.noisyCostStressed
        };
      }

      return {
        requests: trafficConfig.client.noisyRequestsWarm,
        cost: trafficConfig.client.noisyCostWarm
      };
    }

    function clientIsAbsoluteAbuse(client) {
      return (
        client.oneSecondRequestTimes.length >= trafficConfig.client.absoluteRequestsPerSecond ||
        client.requestTimes.length >= trafficConfig.client.absoluteRequestsPerWindow ||
        client.costWindow >= trafficConfig.client.absoluteCostPerWindow
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
        trafficConfig.client.cooldownMaxMs,
        trafficConfig.client.cooldownBaseMs * Math.pow(2, Math.max(0, client.cooldownLevel - 1))
      );

      client.cooldownUntil = now + cooldownMs;
      guardStats.cooldownsIssued++;

      console.error(
        "[POKE-traffic] client cooldown " +
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

    function getLoopDelaySnapshot() {
      return {
        p50Ms: nsToMs(loopDelay.percentile(50)),
        p90Ms: nsToMs(loopDelay.percentile(90)),
        p99Ms: nsToMs(loopDelay.percentile(99)),
        meanMs: nsToMs(loopDelay.mean),
        maxMs: nsToMs(loopDelay.max)
      };
    }

    function classifySystemPressure(snapshot) {
      const cfg = trafficConfig.system;
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

      addPressure("loopP99", snapshot.loop.p99Ms, cfg.warmP99LagMs, cfg.stressedP99LagMs, cfg.criticalP99LagMs, "ms");
      addPressure("loopMean", snapshot.loop.meanMs, cfg.warmMeanLagMs, cfg.stressedMeanLagMs, cfg.criticalMeanLagMs, "ms");
      addPressure("eventLoopUse", snapshot.loop.utilization, cfg.warmEventLoopUse, cfg.stressedEventLoopUse, cfg.criticalEventLoopUse, "");
      addPressure("cpu", snapshot.cpu.ratio, cfg.warmCpuUse, cfg.stressedCpuUse, cfg.criticalCpuUse, "");
      addPressure("rps", snapshot.rps, cfg.warmRps, cfg.stressedRps, cfg.criticalRps, "");
      addPressure("activeRequests", snapshot.activeRequests, cfg.warmActiveRequests, cfg.stressedActiveRequests, cfg.criticalActiveRequests, "");
      addPressure("rssMemory", snapshot.memory.rssRatio, cfg.warmMemoryRssRatio, cfg.stressedMemoryRssRatio, cfg.criticalMemoryRssRatio, "");

      if (hasCritical || score >= 8) {
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

    function sampleTrafficState(reason) {
      const now = Date.now();
      const nowPerf = performance.now();
      const elapsedMs = Math.max(1, nowPerf - lastSampleAt);

      const cpuDelta = process.cpuUsage(lastCpuUsage);
      lastCpuUsage = process.cpuUsage();

      const eluDelta = performance.eventLoopUtilization(lastEventLoopUtilization);
      lastEventLoopUtilization = performance.eventLoopUtilization();

      const delaySnapshot = getLoopDelaySnapshot();
      loopDelay.reset();

      const memory = process.memoryUsage();
      const totalMemory = os.totalmem();
      const rssRatio = totalMemory > 0 ? memory.rss / totalMemory : 0;

      const cpuUserMs = cpuDelta.user / 1000;
      const cpuSystemMs = cpuDelta.system / 1000;
      const cpuTotalMs = cpuUserMs + cpuSystemMs;
      const cpuRatio = cpuTotalMs / elapsedMs;

      const kinds = {};
      for (const [kind, count] of currentSecondKindCounts) {
        kinds[kind] = count;
      }

      const routeCounts = getTopMapEntries(currentSecondRouteCounts, trafficConfig.logging.maxTopRoutes);

      const snapshot = {
        state: trafficState.state,
        score: trafficState.score,
        since: trafficState.since,
        sampledAt: now,
        reason: reason || "interval",
        rps: currentSecondRequests,
        activeRequests: activeRequests.size,
        loop: {
          p50Ms: delaySnapshot.p50Ms,
          p90Ms: delaySnapshot.p90Ms,
          p99Ms: delaySnapshot.p99Ms,
          meanMs: delaySnapshot.meanMs,
          maxMs: delaySnapshot.maxMs,
          utilization: roundRatio(eluDelta.utilization)
        },
        cpu: {
          ratio: roundRatio(cpuRatio),
          userMs: roundMs(cpuUserMs),
          systemMs: roundMs(cpuSystemMs),
          totalMs: roundMs(cpuTotalMs)
        },
        memory: {
          rssMb: bytesToMb(memory.rss),
          heapUsedMb: bytesToMb(memory.heapUsed),
          heapTotalMb: bytesToMb(memory.heapTotal),
          rssRatio: roundRatio(rssRatio)
        },
        system: {
          loadavg: os.loadavg().map(roundMs),
          freeMemoryMb: bytesToMb(os.freemem()),
          totalMemoryMb: bytesToMb(totalMemory)
        },
        kinds,
        topRoutes: routeCounts,
        pressureReasons: []
      };

      const pressure = classifySystemPressure(snapshot);
      snapshot.state = pressure.state;
      snapshot.score = pressure.score;
      snapshot.pressureReasons = pressure.reasons;

      if (snapshot.state !== trafficState.state) {
        snapshot.since = now;
      } else {
        snapshot.since = trafficState.since;
      }

      const shouldLog =
        snapshot.state !== trafficState.state ||
        (snapshot.state !== "healthy" && now - lastStateLogAt >= trafficConfig.logging.stateCooldownMs);

      trafficState = snapshot;
      lastSampleAt = nowPerf;
      currentSecondRequests = 0;
      currentSecondKindCounts = new Map();
      currentSecondRouteCounts = new Map();

      if (shouldLog) {
        lastStateLogAt = now;
        logTrafficState("state sample");
      }
    }

    function logTrafficState(message) {
      console.error(
        "[POKE-traffic] " +
        message +
        " " +
        JSON.stringify({
          state: trafficState.state,
          score: trafficState.score,
          rps: trafficState.rps,
          active: trafficState.activeRequests,
          loop: trafficState.loop,
          cpu: trafficState.cpu,
          memory: trafficState.memory,
          kinds: trafficState.kinds,
          reasons: trafficState.pressureReasons,
          topRoutes: trafficState.topRoutes
        })
      );
    }

    function logReject(req, client, kind, reason, status) {
      const now = Date.now();

      if (now - lastRejectLogAt < trafficConfig.logging.rejectCooldownMs) {
        return;
      }

      lastRejectLogAt = now;

      console.error(
        "[POKE-traffic] rejected " +
        JSON.stringify({
          reason,
          status,
          state: trafficState.state,
          score: trafficState.score,
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
            rps: trafficState.rps,
            active: trafficState.activeRequests,
            loopP99Ms: trafficState.loop.p99Ms,
            eventLoopUse: trafficState.loop.utilization,
            cpu: trafficState.cpu.ratio,
            memoryRssRatio: trafficState.memory.rssRatio
          }
        })
      );
    }

    function getRandomGuardMessage() {
      return GUARD_MESSAGES[Math.floor(Math.random() * GUARD_MESSAGES.length)];
    }

    function setTrafficHeaders(res, decision) {
      res.set("X-Poke-Traffic-Guard", trafficState.state);
      res.set("X-Poke-Traffic-Decision", decision);
    }

    function sendGuardReject(req, res, client, kind, options) {
      rememberDecision(client, "reject");

      const status = options.status || 503;
      const retryAfter = options.retryAfter || trafficConfig.admission.retryAfterStressedSeconds;
      const reason = options.reason || "traffic-pressure";

      if (reason === "client-cooldown") {
        guardStats.rejectedCooldown++;
      } else if (reason === "absolute-abuse") {
        guardStats.rejectedAbuse++;
      } else if (trafficState.state === "critical") {
        guardStats.rejectedCritical++;
      } else if (trafficState.state === "stressed") {
        guardStats.rejectedStressed++;
      } else {
        guardStats.rejectedWarm++;
      }

      logReject(req, client, kind, reason, status);

      res.set("Retry-After", String(retryAfter));
      res.set("Cache-Control", "no-store");
      res.set("Connection", "close");
      res.set("X-Poke-Traffic-Guard", trafficState.state);
      res.set("X-Poke-Traffic-Reason", reason);
      return res.status(status).send(options.message || getRandomGuardMessage());
    }

    function getRetryAfterForState(state) {
      if (state === "critical") return trafficConfig.admission.retryAfterCriticalSeconds;
      if (state === "stressed") return trafficConfig.admission.retryAfterStressedSeconds;
      if (state === "warm") return trafficConfig.admission.retryAfterWarmSeconds;
      return trafficConfig.admission.retryAfterHealthyAbuseSeconds;
    }

    function allowRequest(res, kind, decision) {
      if (trafficState.state === "healthy") guardStats.allowedHealthy++;
      if (trafficState.state === "warm") guardStats.allowedWarm++;
      if (trafficState.state === "stressed") guardStats.allowedStressed++;
      if (trafficState.state === "critical") guardStats.allowedCritical++;

      if (kind === "status") guardStats.allowedStatus++;
      if (kind === "static") guardStats.allowedStatic++;
      if (kind === "page") guardStats.allowedPage++;
      if (kind === "heavy" || kind === "background") guardStats.allowedHeavy++;

      setTrafficHeaders(res, decision || "allow");
    }

    function getAdmissionDecision(req, client, kind) {
      const state = trafficState.state;
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
          retryAfter: trafficConfig.admission.retryAfterHealthyAbuseSeconds,
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
        if (state === "critical" && trafficState.activeRequests >= trafficConfig.system.criticalActiveRequests) {
          return {
            action: "reject",
            reason: "critical-static-shed",
            status: 503,
            retryAfter: getRetryAfterForState(state),
            message: "Server is under heavy load. Please retry shortly."
          };
        }

        return {
          action: "allow",
          reason: "static-pass"
        };
      }

      if (state === "warm") {
        if ((kind === "heavy" || kind === "background") && noisy) {
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
        if (kind === "page" && !noisy) {
          return {
            action: "allow",
            reason: "stressed-page-pass"
          };
        }

        if (kind === "page" && noisy) {
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
            client.heavyTimes.length <= 8 &&
            trafficState.activeRequests < trafficConfig.system.stressedActiveRequests;

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
        if (kind === "page" && !noisy && client.pageSoftPassTimes.length < trafficConfig.client.pageSoftPassesPerWindow) {
          return {
            action: "page-grace",
            reason: "critical-page-grace"
          };
        }

        if (kind === "other" && !noisy && trafficState.activeRequests < trafficConfig.system.criticalActiveRequests * 0.75) {
          return {
            action: "allow",
            reason: "critical-small-other-pass"
          };
        }

        return {
          action: "reject",
          reason: "critical-shed",
          status: kind === "page" ? 503 : 503,
          retryAfter: getRetryAfterForState(state),
          message: "Server is under heavy load. Please retry shortly."
        };
      }

      return {
        action: "allow",
        reason: "default-pass"
      };
    }

    function sleep(ms) {
      return new Promise(function (resolve) {
        setTimeout(resolve, ms);
      });
    }

    async function handlePageGrace(req, res, next, client, kind, decision) {
      const startedAt = performance.now();

      while (!res.headersSent && !res.writableEnded && !res.destroyed) {
        if (trafficState.state !== "critical") {
          rememberDecision(client, "page-soft-pass");
          guardStats.pageGracePassed++;
          allowRequest(res, kind, "page-grace-recovered");
          return next();
        }

        if (performance.now() - startedAt >= trafficConfig.admission.pageGraceMs) {
          break;
        }

        await sleep(trafficConfig.admission.pageGracePollMs);
      }

      if (
        !res.headersSent &&
        !res.writableEnded &&
        !res.destroyed &&
        trafficState.activeRequests < trafficConfig.system.criticalActiveRequests * 0.5 &&
        !clientIsNoisy(client, "critical")
      ) {
        rememberDecision(client, "page-soft-pass");
        guardStats.pageGracePassed++;
        allowRequest(res, kind, "critical-page-soft-pass");
        return next();
      }

      return sendGuardReject(req, res, client, kind, {
        reason: decision.reason,
        status: 503,
        retryAfter: getRetryAfterForState("critical"),
        message: "Server is under heavy load. Please retry shortly."
      });
    }

    function requestActivityTracker(req, res, next) {
      const id = ++requestSequence;
      const key = getRequestKey(req);
      const kind = classifyRequest(req);
      const startedAt = performance.now();

      activeRequests.set(id, {
        id,
        key,
        kind,
        startedAt
      });

      incrementMapCount(activeRequestCounts, key);

      res.on("finish", function () {
        const finishedAt = performance.now();
        const durationMs = roundMs(finishedAt - startedAt);

        if (activeRequests.has(id)) {
          activeRequests.delete(id);
          decrementMapCount(activeRequestCounts, key);
        }

        if (durationMs >= trafficConfig.logging.slowRequestMs) {
          recentSlowRequests.push({
            key,
            kind,
            statusCode: res.statusCode,
            durationMs
          });

          while (recentSlowRequests.length > trafficConfig.logging.maxRecentSlow) {
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

    function trafficAdmissionMiddleware(req, res, next) {
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

      if (decision.action === "page-grace") {
        return handlePageGrace(req, res, next, client, kind, decision).catch(next);
      }

      if (decision.action === "cooldown-reject") {
        applyClientCooldown(client, decision.reason);
        return sendGuardReject(req, res, client, kind, decision);
      }

      if (
        decision.action === "reject" &&
        (decision.reason === "stressed-expensive-shed" || decision.reason === "critical-shed") &&
        (kind === "heavy" || kind === "background") &&
        client.heavyTimes.length >= trafficConfig.client.maxHeavyRejectsBeforeCooldown
      ) {
        applyClientCooldown(client, decision.reason);
      }

      return sendGuardReject(req, res, client, kind, decision);
    }

    function cleanupClients() {
      const now = Date.now();
      const maxAge = trafficConfig.client.windowMs * 3;

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
        if (clientIsNoisy(client, trafficState.state)) noisy++;
      }

      return {
        tracked: clientStates.size,
        active,
        cooldown,
        noisy
      };
    }

    function getTrafficStats() {
      return {
        guard: "PokeTrafficGuard",
        state: trafficState,
        clients: countClientStates(),
        active_requests: {
          total: activeRequests.size,
          by_route: getTopMapEntries(activeRequestCounts, trafficConfig.logging.maxTopRoutes),
          oldest: getActiveRequestSummary(trafficConfig.logging.maxTopRoutes),
          recent_slow: recentSlowRequests.slice(-trafficConfig.logging.maxRecentSlow).reverse()
        },
        stats: guardStats,
        config: {
          system: trafficConfig.system,
          client: trafficConfig.client,
          admission: trafficConfig.admission,
          request_cost: trafficConfig.requestCost
        }
      };
    }

    function sendTrafficStats(req, res) {
      res.json(getTrafficStats());
    }

    function sendAntiddosPage(req, res) {
      const stats = getTrafficStats();
      const stateClass = stats.state.state === "healthy" ? "green" :
        stats.state.state === "warm" ? "orange" :
        stats.state.state === "stressed" ? "orange" :
        "red";

      res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>PokeTrafficGuard - Poke Traffic Protection</title>
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

<h1>PokeTrafficGuard</h1>
<p class="small">poke's pressure-aware anti-DDoS and overload protection</p>

<div class="banner ${stateClass}">
  <b>Current state:</b> <span class="${stateClass}">${stats.state.state}</span>
  <br>
  <span class="small">Score: ${stats.state.score}. RPS: ${stats.state.rps}. Active requests: ${stats.state.activeRequests}.</span>
</div>

<h2>what changed</h2>
<p>
  This guard does not block normal users just because they made a few requests quickly.
  It first checks whether the server is actually under pressure. It looks at event-loop
  delay, event-loop utilization, CPU usage, active requests, requests per second, and
  memory pressure. When the server is healthy, almost everything passes.
</p>

<p>
  When the server is stressed, expensive work gets shed first: API, proxy, media,
  manifest, storyboard, and background requests. Page navigations and static files
  are protected as much as possible, because those matter most for user experience.
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
    <span class="stat-num">${stats.state.rps}</span>
    <span class="stat-label">requests/sec</span>
  </div>
  <div class="stat-box">
    <span class="stat-num">${stats.state.activeRequests}</span>
    <span class="stat-label">active requests</span>
  </div>
  <div class="stat-box">
    <span class="stat-num">${stats.state.loop.p99Ms}ms</span>
    <span class="stat-label">loop p99</span>
  </div>
  <div class="stat-box">
    <span class="stat-num">${formatPercent(stats.state.loop.utilization)}</span>
    <span class="stat-label">event loop use</span>
  </div>
  <div class="stat-box">
    <span class="stat-num">${formatPercent(stats.state.cpu.ratio)}</span>
    <span class="stat-label">cpu use</span>
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

<h2>pressure reasons</h2>
<pre>${stats.state.pressureReasons.length ? stats.state.pressureReasons.join("\n") : "none"}</pre>

<h2>request mix</h2>
<pre>${JSON.stringify(stats.state.kinds, null, 2)}</pre>

<h2>top active routes</h2>
<pre>${JSON.stringify(stats.active_requests.by_route, null, 2)}</pre>

<h2>recent slow requests</h2>
<pre>${JSON.stringify(stats.active_requests.recent_slow, null, 2)}</pre>

<h2>api</h2>
<p>
  JSON stats:
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
    app.use(trafficAdmissionMiddleware);

    app.get("/_poketraffic/stats", sendTrafficStats);
    app.get("/_pokestopskids/stats", sendTrafficStats);
    app.get("/_pokeoverload/stats", sendTrafficStats);
    app.get("/_antiddos*", sendAntiddosPage);

    sampleTrafficState("startup");

    const sampleTimer = setInterval(function () {
      sampleTrafficState("interval");
    }, trafficConfig.system.sampleMs);
    sampleTimer.unref();

    const cleanupTimer = setInterval(cleanupClients, trafficConfig.client.cleanupMs);
    cleanupTimer.unref();

    process.once("SIGTERM", function () {
      try {
        loopDelay.disable();
      } catch {}
    });

    process.once("SIGINT", function () {
      try {
        loopDelay.disable();
      } catch {}
    });

    initlog(
      "[PokeTrafficGuard] loaded - " +
      "healthy-first, pressure-aware, " +
      "p99 warm/stressed/critical: " +
      trafficConfig.system.warmP99LagMs + "/" +
      trafficConfig.system.stressedP99LagMs + "/" +
      trafficConfig.system.criticalP99LagMs + "ms, " +
      "rps warm/stressed/critical: " +
      trafficConfig.system.warmRps + "/" +
      trafficConfig.system.stressedRps + "/" +
      trafficConfig.system.criticalRps
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
    if (res.headersSent || res.writableEnded || res.destroyed) {
      console.error("[POKE-render] response already committed, skipping:", template);
      return;
    }

    const templatePath = modules.path.resolve(`${templateDir}${modules.path.sep}${template}`);

    res.render(templatePath, Object.assign(data), function (err, html) {
      if (err) {
        console.error("[POKE-render] error on", template, ":", err.message);
        if (!res.headersSent && !res.writableEnded && !res.destroyed) {
          res.status(500).send("Internal server error");
        }
        return;
      }

      if (!res.headersSent && !res.writableEnded && !res.destroyed) {
        res.send(html);
      }
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
    if (!res.headersSent && !res.writableEnded && !res.destroyed) {
      res.status(500).send("Something went wrong. Please try again.");
    }
  });
})();