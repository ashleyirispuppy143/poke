/**
 * Poke is a Free/Libre YouTube front-end!
 *
 * This file was originally distributed under the GNU Lesser General Public
 * License (LGPL-3.0-or-later). Starting from commit 88a8acbac2, it has been
 * relicensed and is now distributed under the GNU General Public License
 * (GPL-3.0-or-later), which is the license used by the Poke project.
 *
 * See the GNU GPL license text here:
 * https://www.gnu.org/licenses/gpl-3.0.txt
 *
 * Please do not remove this notice when redistributing this file!
 */

const getdislikes = require("../libpoketube/libpoketube-dislikes.js");
const getColors = require("get-image-colors");
const config = require("../../config.json");
const fs = require("fs");

class InnerTubePokeVidious {
  constructor(config) {
    this.config = config;

    this.finalCache = new Map();
    this.videoCache = new Map();
    this.commentsCache = new Map();
    this.dislikesCache = new Map();
    this.colorsCache = new Map();
    this.cache = this.finalCache;

    this.inflight = new Map();
    this.fetchPromise = null;

    this.language = "hl=en-US";
    this.param = "2AMB";
    this.param_legacy = "CgIIAdgDAQ%3D%3D";
    this.apikey = "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8";
    this.ANDROID_API_KEY = "AIzaSyA8eiZmM1FaDVjRy-df2KTyQ_vz_yYM39w";
    this.ANDROID_APP_VERSION = "21.03.36";
    this.ANDROID_VERSION = "16";
    this.useragent = config.useragent;
    this.INNERTUBE_CONTEXT_CLIENT_VERSION = "1";
    this.region = "region=US";
    this.sqp =
      "-oaymwEbCKgBEF5IVfKriqkDDggBFQAAiEIYAXABwAEG&rs=AOn4CLBy_x4UUHLNDZtJtH0PXeQGoRFTgw";

    this.blockedFile = "blockedreasons.txt";
    this.blockedVideos = new Map();

    this.knownErrors = {
      COPYRIGHT_BLOCKED:
        "This video contains content from a copyright holder who has blocked it.",
      UPLOADER_REMOVED: "This video has been removed by the uploader.",
      VIDEO_UNAVAILABLE: "Video unavailable.",
      INAPPROPRIATE: "This video may be inappropriate for some users.",
    };

    this.defaultColors = {
      color: "#0ea5e9",
      color2: "#111827",
    };

    this.ttl = {
      final: 45 * 60 * 1000,
      video: 60 * 60 * 1000,
      comments: 3 * 60 * 1000,
      dislikes: 4 * 60 * 1000,
      colors: 24 * 60 * 60 * 1000,
      negative: 10 * 1000,
    };

    this.staleTtl = {
      final: 6 * 60 * 60 * 1000,
      video: 8 * 60 * 60 * 1000,
      comments: 45 * 60 * 1000,
      dislikes: 60 * 60 * 1000,
      colors: 7 * 24 * 60 * 60 * 1000,
    };

    this.maxCacheItems = 3000;
    this.maxInflightItems = 500;

    this.breakers = {
      video: this.createCircuitBreaker("video", {
        failuresToOpen: 12,
        cooldownMs: 5000,
        halfOpenMax: 3,
      }),
      comments: this.createCircuitBreaker("comments", {
        failuresToOpen: 8,
        cooldownMs: 10000,
        halfOpenMax: 1,
      }),
      dislikes: this.createCircuitBreaker("dislikes", {
        failuresToOpen: 8,
        cooldownMs: 12000,
        halfOpenMax: 1,
      }),
      thumbnails: this.createCircuitBreaker("thumbnails", {
        failuresToOpen: 8,
        cooldownMs: 12000,
        halfOpenMax: 1,
      }),
    };

    this.limits = {
      full: this.createLimit("full", {
        concurrency: 28,
        maxQueue: 96,
        maxQueueWaitMs: 1800,
      }),
      video: this.createLimit("video", {
        concurrency: 10,
        maxQueue: 48,
        maxQueueWaitMs: 1600,
      }),
      comments: this.createLimit("comments", {
        concurrency: 4,
        maxQueue: 24,
        maxQueueWaitMs: 1200,
      }),
      dislikes: this.createLimit("dislikes", {
        concurrency: 3,
        maxQueue: 20,
        maxQueueWaitMs: 1200,
      }),
      colors: this.createLimit("colors", {
        concurrency: 2,
        maxQueue: 16,
        maxQueueWaitMs: 1200,
      }),
    };

    this.loadBlockedVideos();
  }

  createLimit(name, options) {
    const concurrency = Math.max(1, options.concurrency || 1);
    const maxQueue = Math.max(0, options.maxQueue || 0);
    const maxQueueWaitMs = Math.max(1, options.maxQueueWaitMs || 1000);

    let active = 0;
    const queue = [];

    const runNext = () => {
      while (active < concurrency && queue.length > 0) {
        const item = queue.shift();

        if (!item) return;

        if (item.timer) {
          clearTimeout(item.timer);
          item.timer = null;
        }

        if (item.settled) {
          continue;
        }

        item.settled = true;
        active++;

        Promise.resolve()
          .then(item.fn)
          .then(item.resolve, item.reject)
          .finally(() => {
            active--;
            runNext();
          });
      }
    };

    return (fn) =>
      new Promise((resolve, reject) => {
        if (active < concurrency) {
          active++;

          Promise.resolve()
            .then(fn)
            .then(resolve, reject)
            .finally(() => {
              active--;
              runNext();
            });

          return;
        }

        if (queue.length >= maxQueue) {
          reject(new Error(`${name} queue is full`));
          return;
        }

        const item = {
          fn,
          resolve,
          reject,
          settled: false,
          timer: null,
        };

        item.timer = setTimeout(() => {
          if (item.settled) return;

          item.settled = true;

          const index = queue.indexOf(item);
          if (index !== -1) {
            queue.splice(index, 1);
          }

          reject(new Error(`${name} queue wait timed out`));
        }, maxQueueWaitMs);

        queue.push(item);
      });
  }

  createCircuitBreaker(name, options) {
    return {
      name,
      failures: 0,
      openedUntil: 0,
      halfOpenActive: 0,
      failuresToOpen: Math.max(1, options.failuresToOpen || 8),
      cooldownMs: Math.max(1000, options.cooldownMs || 10000),
      halfOpenMax: Math.max(1, options.halfOpenMax || 1),
    };
  }

  canUseBreaker(breaker) {
    const now = Date.now();

    if (breaker.openedUntil <= now) {
      if (breaker.openedUntil !== 0 && breaker.halfOpenActive >= breaker.halfOpenMax) {
        return false;
      }

      return true;
    }

    return false;
  }

  async withBreaker(breaker, fn) {
    if (!this.canUseBreaker(breaker)) {
      throw new Error(`${breaker.name} circuit open`);
    }

    const halfOpen = breaker.openedUntil !== 0 && breaker.openedUntil <= Date.now();

    if (halfOpen) {
      breaker.halfOpenActive++;
    }

    try {
      const result = await fn();
      breaker.failures = 0;
      breaker.openedUntil = 0;
      return result;
    } catch (err) {
      if (!this.isKnownError(err)) {
        breaker.failures++;

        if (breaker.failures >= breaker.failuresToOpen) {
          breaker.openedUntil = Date.now() + breaker.cooldownMs;
        }
      }

      throw err;
    } finally {
      if (halfOpen) {
        breaker.halfOpenActive = Math.max(0, breaker.halfOpenActive - 1);
      }
    }
  }

  loadBlockedVideos() {
    try {
      if (!fs.existsSync(this.blockedFile)) return;

      const content = fs.readFileSync(this.blockedFile, "utf8");

      content.split("\n").forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed) return;

        const divider = trimmed.indexOf("|");
        if (divider === -1) return;

        const videoId = trimmed.slice(0, divider).trim();
        const reason = trimmed.slice(divider + 1).trim();

        if (videoId && reason) {
          this.blockedVideos.set(videoId, reason);
        }
      });
    } catch (e) {
      console.error("[LIBPT ERROR] Could not load blockedreasons.txt", e);
    }
  }

  addBlockedVideo(videoId, reason) {
    if (!videoId || !reason) return;
    if (this.blockedVideos.has(videoId)) return;

    this.blockedVideos.set(videoId, reason);

    try {
      fs.appendFileSync(this.blockedFile, videoId + "|" + reason + "\n");
    } catch (e) {
      console.error("[LIBPT ERROR] Could not write to blockedreasons.txt", e);
    }
  }

  getJson(str) {
    try {
      return JSON.parse(str);
    } catch {
      return null;
    }
  }

  checkUnexistingObject(obj) {
    return obj && typeof obj === "object" && "authorId" in obj;
  }

  toBase64(str) {
    if (typeof btoa !== "undefined") return btoa(String(str));
    return Buffer.from(String(str)).toString("base64");
  }

  getCacheBustToken(bucketMs = 15 * 60 * 1000) {
    return this.toBase64(Math.floor(Date.now() / bucketMs));
  }

  makeWatchKey(v, contentlang, contentregion) {
    return `${v}|${contentlang || "en-US"}|${contentregion || "US"}`;
  }

  makeApiUrl(path, v, contentlang, contentregion) {
    const lang = encodeURIComponent(contentlang || "en-US");
    const region = encodeURIComponent(contentregion || "US");
    const h = encodeURIComponent(this.getCacheBustToken());

    return `${this.config.invapi}/${path}/${v}?hl=${lang}&region=${region}&h=${h}`;
  }

  getCache(cache, key, opts = {}) {
    const entry = cache.get(key);
    if (!entry) return { hit: false, value: null };

    const ttl = opts.stale ? entry.staleTtl : entry.ttl;

    if (Date.now() - entry.timestamp > ttl) {
      return { hit: false, value: null };
    }

    return { hit: true, value: entry.value };
  }

  setCache(cache, key, value, ttl, staleTtl) {
    if (cache.size >= this.maxCacheItems) {
      const oldestKey = cache.keys().next().value;

      if (oldestKey !== undefined) {
        cache.delete(oldestKey);
      }
    }

    cache.set(key, {
      value,
      timestamp: Date.now(),
      ttl,
      staleTtl: staleTtl || ttl,
    });
  }

  getOrCreateInFlight(key, fn) {
    if (this.inflight.has(key)) {
      return this.inflight.get(key);
    }

    if (this.inflight.size >= this.maxInflightItems) {
      throw new Error("Too many active watch fetches");
    }

    const promise = Promise.resolve()
      .then(fn)
      .finally(() => {
        this.inflight.delete(key);
      });

    this.inflight.set(key, promise);
    return promise;
  }

  async cachedTask(cache, key, ttl, staleTtl, inflightKey, task, options = {}) {
    const fresh = this.getCache(cache, key);

    if (fresh.hit) {
      return fresh.value;
    }

    return this.getOrCreateInFlight(inflightKey, async () => {
      const freshAgain = this.getCache(cache, key);

      if (freshAgain.hit) {
        return freshAgain.value;
      }

      try {
        const value = await task();

        const shouldCache =
          typeof options.shouldCache === "function"
            ? options.shouldCache(value)
            : true;

        if (shouldCache) {
          this.setCache(cache, key, value, ttl, staleTtl);
        }

        return value;
      } catch (err) {
        if (this.isKnownError(err)) {
          throw err;
        }

        const stale = this.getCache(cache, key, { stale: true });

        if (stale.hit) {
          this.initError(options.label || `Serving stale cache for ${key}`, err);
          return stale.value;
        }

        this.initError(options.label || `Cached task failed: ${key}`, err);
        throw err;
      }
    });
  }

  async getFetch() {
    if (!this.fetchPromise) {
      this.fetchPromise = import("undici").then((mod) => mod.fetch);
    }

    return this.fetchPromise;
  }

  getRequestHeaders(extraHeaders = {}) {
    return {
      ...extraHeaders,
      "User-Agent": this.useragent,
      Accept: extraHeaders.Accept || "application/json,text/plain,*/*",
      Connection: "keep-alive",
    };
  }

  async fetchOnceWithTimeout(fetch, url, options = {}, timeoutMs = 2400) {
    const controller = new AbortController();
    const callerSignal = options.signal || null;

    const timer = setTimeout(() => {
      controller.abort(new Error(`Fetch timed out after ${timeoutMs}ms`));
    }, Math.max(1, timeoutMs));

    const onCallerAbort = () => {
      controller.abort(callerSignal.reason || new Error("Aborted by caller"));
    };

    if (callerSignal) {
      if (callerSignal.aborted) {
        controller.abort(callerSignal.reason || new Error("Aborted by caller"));
      } else {
        callerSignal.addEventListener("abort", onCallerAbort, { once: true });
      }
    }

    try {
      return await fetch(url, {
        ...options,
        headers: this.getRequestHeaders(options.headers || {}),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);

      if (callerSignal) {
        callerSignal.removeEventListener("abort", onCallerAbort);
      }
    }
  }

  parseRetryAfter(hdr) {
    if (!hdr) return null;

    const s = String(hdr).trim();
    const delta = Number(s);

    if (Number.isFinite(delta)) {
      return Math.max(0, (delta * 1000) | 0);
    }

    const when = Date.parse(s);

    if (!Number.isNaN(when)) {
      return Math.max(0, when - Date.now());
    }

    return null;
  }

  async checkUnrecoverableErrors(resp, videoId) {
    if (!videoId) return;
    if (resp.status !== 500 && resp.status !== 404 && resp.status !== 410) return;

    let text = "";

    try {
      text = await resp.clone().text();
    } catch {
      return;
    }

    const checks = [
      {
        status: 500,
        needle: "who has blocked it on copyright grounds",
        reason: "COPYRIGHT_BLOCKED",
      },
      {
        status: 500,
        needle: "This video has been removed by the uploader",
        reason: "UPLOADER_REMOVED",
      },
      {
        status: 500,
        needle: "This video may be inappropriate for some users",
        reason: "INAPPROPRIATE",
      },
      {
        status: 404,
        needle: "Video unavailable",
        reason: "VIDEO_UNAVAILABLE",
      },
      {
        status: 410,
        needle: "Video unavailable",
        reason: "VIDEO_UNAVAILABLE",
      },
    ];

    for (const check of checks) {
      if (resp.status === check.status && text.includes(check.needle)) {
        this.addBlockedVideo(videoId, check.reason);
        throw new Error(check.reason);
      }
    }
  }

  isKnownError(err) {
    return (
      err &&
      typeof err.message === "string" &&
      Object.prototype.hasOwnProperty.call(this.knownErrors, err.message)
    );
  }

  async fetchWithRetry(fetch, url, options = {}, settings = {}) {
    const retryable = new Set([408, 425, 429, 500, 502, 503, 504]);
    const maxRetryTime =
      typeof settings.maxRetryTime === "number" ? settings.maxRetryTime : 3600;
    const perTryTimeoutMs =
      typeof settings.perTryTimeoutMs === "number" ? settings.perTryTimeoutMs : 2200;
    const maxAttempts =
      typeof settings.maxAttempts === "number" ? settings.maxAttempts : 2;

    const startedAt = Date.now();
    let lastError = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const remaining = maxRetryTime - (Date.now() - startedAt);

      if (remaining <= 0) {
        break;
      }

      const timeoutMs = Math.min(perTryTimeoutMs, Math.max(250, remaining - 50));

      try {
        const res = await this.fetchOnceWithTimeout(fetch, url, options, timeoutMs);

        if (res.ok) {
          return res;
        }

        await this.checkUnrecoverableErrors(res, settings.videoId);

        if (!retryable.has(res.status)) {
          return res;
        }

        lastError = new Error(`HTTP Error ${res.status}`);

        const retryAfterMs = this.parseRetryAfter(res.headers.get("Retry-After"));
        const remainingAfterResponse = maxRetryTime - (Date.now() - startedAt);

        if (attempt >= maxAttempts || remainingAfterResponse <= 0) {
          break;
        }

        const waitMs =
          retryAfterMs != null
            ? Math.min(retryAfterMs, Math.max(0, remainingAfterResponse - 50))
            : Math.min(160 + Math.floor(Math.random() * 240), Math.max(0, remainingAfterResponse - 50));

        if (waitMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, waitMs));
        }
      } catch (err) {
        if (this.isKnownError(err)) {
          throw err;
        }

        if (options.signal && options.signal.aborted) {
          throw err;
        }

        lastError = err;

        const remainingAfterError = maxRetryTime - (Date.now() - startedAt);

        if (attempt >= maxAttempts || remainingAfterError <= 0) {
          break;
        }

        const waitMs = Math.min(
          140 + Math.floor(Math.random() * 220),
          Math.max(0, remainingAfterError - 50)
        );

        if (waitMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, waitMs));
        }
      }
    }

    throw lastError || new Error(`Fetch failed for ${url}`);
  }

  async getRequiredComments(fetch, v, contentlang, contentregion) {
    const key = this.makeWatchKey(v, contentlang, contentregion);
    const url = this.makeApiUrl("comments", v, contentlang, contentregion);

    return this.cachedTask(
      this.commentsCache,
      key,
      this.ttl.comments,
      this.staleTtl.comments,
      `comments:${key}`,
      async () =>
        this.limits.comments(() =>
          this.withBreaker(this.breakers.comments, async () => {
            const res = await this.fetchWithRetry(fetch, url, {}, {
              videoId: v,
              maxRetryTime: 2800,
              perTryTimeoutMs: 1800,
              maxAttempts: 2,
            });

            if (!res.ok) {
              throw new Error(`Comments HTTP Error ${res.status}`);
            }

            const text = await res.text();
            const parsed = this.getJson(text);

            if (parsed === null || parsed === undefined) {
              throw new Error("Comments JSON parse failed");
            }

            return parsed;
          })
        ),
      {
        label: `Comments fetch failed for ${v}`,
        shouldCache: (value) => value !== null && value !== undefined,
      }
    );
  }

  async getRequiredVideoInfo(fetch, v, contentlang, contentregion) {
    const key = this.makeWatchKey(v, contentlang, contentregion);
    const url = this.makeApiUrl("videos", v, contentlang, contentregion);

    return this.cachedTask(
      this.videoCache,
      key,
      this.ttl.video,
      this.staleTtl.video,
      `video:${key}`,
      async () =>
        this.limits.video(() =>
          this.withBreaker(this.breakers.video, async () => {
            const res = await this.fetchWithRetry(fetch, url, {}, {
              videoId: v,
              maxRetryTime: 4300,
              perTryTimeoutMs: 2600,
              maxAttempts: 2,
            });

            if (!res.ok) {
              throw new Error(`Video HTTP Error ${res.status}`);
            }

            const text = await res.text();

            let parsed;

            try {
              parsed = JSON.parse(text);
            } catch {
              throw new Error("Video JSON parse failed");
            }

            if (parsed && parsed.error) {
              return parsed;
            }

            if (!this.checkUnexistingObject(parsed)) {
              throw new Error("Video data incomplete");
            }

            return parsed;
          })
        ),
      {
        label: `Video info fetch failed for ${v}`,
        shouldCache: (value) => this.checkUnexistingObject(value),
      }
    );
  }

  async getRequiredDislikes(v) {
    const key = v;

    return this.cachedTask(
      this.dislikesCache,
      key,
      this.ttl.dislikes,
      this.staleTtl.dislikes,
      `dislikes:${key}`,
      async () =>
        this.limits.dislikes(() =>
          this.withBreaker(this.breakers.dislikes, async () => {
            const data = await this.withDeadline(
              getdislikes(v),
              2500,
              "Dislike API timed out"
            );

            if (!data || !Object.prototype.hasOwnProperty.call(data, "engagement")) {
              throw new Error("Dislike API returned incomplete data");
            }

            return data;
          })
        ),
      {
        label: `Dislike API error for ${v}`,
        shouldCache: (value) =>
          Boolean(value && Object.prototype.hasOwnProperty.call(value, "engagement")),
      }
    );
  }

  async getRequiredThumbnailColors(fetch, v) {
    const key = v;

    return this.cachedTask(
      this.colorsCache,
      key,
      this.ttl.colors,
      this.staleTtl.colors,
      `colors:${key}`,
      async () =>
        this.limits.colors(() =>
          this.withBreaker(this.breakers.thumbnails, async () => {
            const thumbnailUrl = `https://i.ytimg.com/vi/${v}/hqdefault.jpg?sqp=${this.sqp}`;

            const res = await this.fetchWithRetry(
              fetch,
              thumbnailUrl,
              {
                headers: {
                  Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
                },
              },
              {
                videoId: v,
                maxRetryTime: 2600,
                perTryTimeoutMs: 1700,
                maxAttempts: 2,
              }
            );

            if (!res.ok) {
              throw new Error(`Thumbnail HTTP Error ${res.status}`);
            }

            const buffer = Buffer.from(await res.arrayBuffer());

            if (!buffer.length) {
              throw new Error("Thumbnail response was empty");
            }

            const palette = await this.withDeadline(
              getColors(buffer, "image/jpeg"),
              1800,
              "Thumbnail color extraction timed out"
            );

            if (!Array.isArray(palette) || !palette[0] || !palette[1]) {
              throw new Error("Thumbnail color palette incomplete");
            }

            return {
              color: palette[0].hex(),
              color2: palette[1].hex(),
            };
          })
        ),
      {
        label: `Thumbnail color extraction error for ${v}`,
        shouldCache: (value) => Boolean(value && value.color && value.color2),
      }
    );
  }

  async settleSideTask(name, promise, fallback) {
    try {
      const value = await promise;

      return {
        ok: true,
        name,
        value,
      };
    } catch (error) {
      this.initError(`${name} side task failed`, error);

      return {
        ok: false,
        name,
        value: fallback,
        error,
      };
    }
  }

  withDeadline(promise, ms, message) {
    let timer = null;

    return Promise.race([
      Promise.resolve(promise),
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(message || `Operation timed out after ${ms}ms`));
        }, Math.max(1, ms));
      }),
    ]).finally(() => {
      if (timer) {
        clearTimeout(timer);
      }
    });
  }

  buildWatchResult(vid, comments, dislikesData, colorData) {
    const safeDislikes =
      dislikesData && Object.prototype.hasOwnProperty.call(dislikesData, "engagement")
        ? dislikesData
        : { engagement: null };

    const safeColors =
      colorData && colorData.color && colorData.color2
        ? colorData
        : this.defaultColors;

    return {
      vid,
      comments,
      channel_uploads: " ",
      engagement: safeDislikes.engagement,
      wiki: "",
      desc: "",
      color: safeColors.color,
      color2: safeColors.color2,
    };
  }

  buildErrorResult(message, reason) {
    return {
      error: true,
      message,
      reason,
    };
  }

  async getYouTubePlayerInfo(f, v, contentlang, contentregion) {
    if (!v) {
      this.initError("Missing video ID", null);

      return this.buildErrorResult("No video ID provided", "MISSING_VIDEO_ID");
    }

    if (!this.isvalidvideo(v)) {
      return this.buildErrorResult("Invalid video ID provided", "INVALID_VIDEO_ID");
    }

    if (this.blockedVideos.has(v)) {
      const reasonKey = this.blockedVideos.get(v);

      return this.buildErrorResult(
        this.knownErrors[reasonKey] || "This video is blocked, removed, or unavailable.",
        reasonKey
      );
    }

    const key = this.makeWatchKey(v, contentlang, contentregion);
    const cached = this.getCache(this.finalCache, key);

    if (cached.hit) {
      return cached.value;
    }

    return this.limits.full(() =>
      this.getOrCreateInFlight(`full:${key}`, async () => {
        const fetch = await this.getFetch();

        try {
          const result = await this.withDeadline(
            this.getFullWatchResult(fetch, v, contentlang, contentregion),
            7000,
            "Watch fetch timed out"
          );

          if (result && !result.error && this.isPlayableWatchResult(result)) {
            this.setCache(
              this.finalCache,
              key,
              result,
              this.ttl.final,
              this.staleTtl.final
            );
          }

          return result;
        } catch (error) {
          if (this.knownErrors[error.message]) {
            return this.buildErrorResult(this.knownErrors[error.message], error.message);
          }

          const stale = this.getCache(this.finalCache, key, { stale: true });

          if (stale.hit) {
            this.initError(`Serving stale full watch result for ${v}`, error);
            return stale.value;
          }

          this.initError(`Error getting video ${v}`, error);

          return this.buildErrorResult(
            "The video could not load right now. Please try again.",
            "WATCH_FETCH_FAILED"
          );
        }
      })
    ).catch((error) => {
      const stale = this.getCache(this.finalCache, key, { stale: true });

      if (stale.hit) {
        this.initError(`Serving stale full watch result for ${v}`, error);
        return stale.value;
      }

      this.initError(`Watch request rejected for ${v}`, error);

      return this.buildErrorResult(
        "The video could not load right now. Please try again.",
        "WATCH_OVERLOADED"
      );
    });
  }

  async getFullWatchResult(fetch, v, contentlang, contentregion) {
    const vid = await this.getRequiredVideoInfo(fetch, v, contentlang, contentregion);

    if (vid && vid.error) {
      return this.buildErrorResult(vid.error, "VIDEO_API_ERROR");
    }

    if (!this.checkUnexistingObject(vid)) {
      throw new Error("Video data incomplete");
    }

    const commentsPromise = this.settleSideTask(
      "comments",
      this.getRequiredComments(fetch, v, contentlang, contentregion),
      null
    );

    const dislikesPromise = this.settleSideTask(
      "dislikes",
      this.getRequiredDislikes(v),
      { engagement: null }
    );

    const colorsPromise = this.settleSideTask(
      "colors",
      this.getRequiredThumbnailColors(fetch, v),
      this.defaultColors
    );

    const [commentsResult, dislikesResult, colorsResult] = await Promise.all([
      commentsPromise,
      dislikesPromise,
      colorsPromise,
    ]);

    return this.buildWatchResult(
      vid,
      commentsResult.value,
      dislikesResult.value,
      colorsResult.value
    );
  }

  isPlayableWatchResult(result) {
    return Boolean(
      result &&
        !result.error &&
        this.checkUnexistingObject(result.vid) &&
        Object.prototype.hasOwnProperty.call(result, "comments") &&
        Object.prototype.hasOwnProperty.call(result, "engagement") &&
        result.color &&
        result.color2
    );
  }

  isvalidvideo(v) {
    if (v !== "assets" && v !== "cdn-cgi" && v !== "404") {
      return /^([a-zA-Z0-9_-]{11})$/.test(v);
    }

    return false;
  }

  initError(context, error) {
    console.log("[LIBPT CORE ERROR]", context, error?.stack || error || "");
  }
}

const pokeTubeApiCore = new InnerTubePokeVidious({
  invapi: config.invapi,
  inv_fallback: config.invapi,
  useragent: config.useragent,
});

module.exports = pokeTubeApiCore;