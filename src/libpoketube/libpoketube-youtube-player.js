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
      final: 60 * 60 * 1000,
      video: 60 * 60 * 1000,
      comments: 5 * 60 * 1000,
      dislikes: 5 * 60 * 1000,
      colors: 24 * 60 * 60 * 1000,
    };

    this.staleTtl = {
      final: 3 * 60 * 60 * 1000,
      video: 3 * 60 * 60 * 1000,
      comments: 30 * 60 * 1000,
      dislikes: 30 * 60 * 1000,
      colors: 7 * 24 * 60 * 60 * 1000,
    };

    this.maxCacheItems = 2500;

    this.limits = {
      video: this.createLimit(6),
      comments: this.createLimit(4),
      dislikes: this.createLimit(3),
      colors: this.createLimit(2),
    };

    this.loadBlockedVideos();
  }

  createLimit(max) {
    let active = 0;
    const queue = [];

    const runNext = () => {
      if (active >= max) return;

      const item = queue.shift();
      if (!item) return;

      active++;

      Promise.resolve()
        .then(item.fn)
        .then(item.resolve, item.reject)
        .finally(() => {
          active--;
          runNext();
        });
    };

    return (fn) =>
      new Promise((resolve, reject) => {
        queue.push({ fn, resolve, reject });
        runNext();
      });
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

  getCacheBustToken(bucketMs = 5 * 60 * 1000) {
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
    if (fresh.hit) return fresh.value;

    return this.getOrCreateInFlight(inflightKey, async () => {
      const freshAgain = this.getCache(cache, key);
      if (freshAgain.hit) return freshAgain.value;

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

        this.initError(options.label || `Cached task failed: ${key}`, err);

        const stale = this.getCache(cache, key, { stale: true });
        if (stale.hit) return stale.value;

        if (Object.prototype.hasOwnProperty.call(options, "fallback")) {
          const fallbackValue =
            typeof options.fallback === "function"
              ? options.fallback(err)
              : options.fallback;

          if (options.cacheFallbackTtl && options.cacheFallbackTtl > 0) {
            this.setCache(
              cache,
              key,
              fallbackValue,
              options.cacheFallbackTtl,
              options.cacheFallbackTtl
            );
          }

          return fallbackValue;
        }

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
    };
  }

  async fetchOnceWithTimeout(fetch, url, options = {}, timeoutMs = 2000) {
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
    if (resp.status !== 500 && resp.status !== 404) return;

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
    const RETRYABLE = new Set([429, 500, 502, 503, 504]);
    const MIN_DELAY_MS = 150;
    const BASE_DELAY_MS = 250;
    const MAX_DELAY_MS = 1500;
    const JITTER_FACTOR = 3;

    const maxRetryTime =
      typeof settings.maxRetryTime === "number" ? settings.maxRetryTime : 2500;
    const perTryTimeoutMs =
      typeof settings.perTryTimeoutMs === "number"
        ? settings.perTryTimeoutMs
        : 1800;

    const startedAt = Date.now();
    let delayMs = BASE_DELAY_MS;
    let lastError = null;
    let attempt = 0;

    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    while (true) {
      attempt++;

      const elapsed = Date.now() - startedAt;
      const remaining = maxRetryTime - elapsed;

      if (remaining <= 0) {
        throw (
          lastError ||
          new Error(`Fetch failed for ${url} after ${maxRetryTime}ms`)
        );
      }

      const timeoutMs = Math.min(
        perTryTimeoutMs,
        Math.max(100, remaining - 50)
      );

      let retryAfterMs = null;

      try {
        const res = await this.fetchOnceWithTimeout(
          fetch,
          url,
          options,
          timeoutMs
        );

        if (res.ok) {
          return res;
        }

        await this.checkUnrecoverableErrors(res, settings.videoId);

        if (!RETRYABLE.has(res.status)) {
          return res;
        }

        retryAfterMs = this.parseRetryAfter(res.headers.get("Retry-After"));
        lastError = new Error(`HTTP Error ${res.status}`);
      } catch (err) {
        if (this.isKnownError(err)) {
          throw err;
        }

        if (options.signal && options.signal.aborted) {
          throw err;
        }

        lastError = err;
      }

      const remainingAfterAttempt = maxRetryTime - (Date.now() - startedAt);

      if (remainingAfterAttempt <= 0) {
        throw (
          lastError ||
          new Error(`Fetch failed for ${url} after ${maxRetryTime}ms`)
        );
      }

      let waitMs;

      if (retryAfterMs != null) {
        waitMs = Math.max(
          MIN_DELAY_MS,
          Math.min(retryAfterMs, Math.max(0, remainingAfterAttempt - 10))
        );
      } else {
        const nextDelay = Math.min(
          MAX_DELAY_MS,
          Math.max(MIN_DELAY_MS, Math.random() * delayMs * JITTER_FACTOR)
        );

        delayMs = nextDelay;
        waitMs = Math.min(nextDelay, Math.max(0, remainingAfterAttempt - 10));
      }

      if (waitMs <= 0) {
        throw (
          lastError ||
          new Error(
            `Fetch failed for ${url} after ${maxRetryTime}ms (window depleted)`
          )
        );
      }

      if (attempt > 1) {
        this.initError(`Retrying fetch for ${url}`, lastError);
      }

      await sleep(waitMs);
    }
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
        this.limits.comments(async () => {
          const res = await this.fetchWithRetry(fetch, url, {}, {
            videoId: v,
            maxRetryTime: 2200,
            perTryTimeoutMs: 1400,
          });

          const text = await res.text();
          return this.getJson(text);
        }),
      {
        label: `Comments fetch failed for ${v}`,
        fallback: null,
        cacheFallbackTtl: 15 * 1000,
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
        this.limits.video(async () => {
          let fetchError = null;
          const maxAttempts = 2;

          for (let attempt = 0; attempt < maxAttempts; attempt++) {
            try {
              const res = await this.fetchWithRetry(fetch, url, {}, {
                videoId: v,
                maxRetryTime: 2500,
                perTryTimeoutMs: 1700,
              });

              if (!res.ok) {
                throw new Error(`HTTP Error ${res.status}`);
              }

              const text = await res.text();
              const parsed = JSON.parse(text);

              if (parsed === null) {
                return null;
              }

              if (this.checkUnexistingObject(parsed)) {
                return parsed;
              }

              if (parsed && parsed.error) {
                return parsed;
              }

              return null;
            } catch (err) {
              if (this.isKnownError(err)) {
                throw err;
              }

              fetchError = err;
            }
          }

          if (fetchError) {
            this.initError("All video info fetch attempts failed", fetchError);

            return {
              isInternalError: true,
              reason: fetchError.message || fetchError.toString(),
            };
          }

          return null;
        }),
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
        this.limits.dislikes(async () => {
          const data = await getdislikes(v);

          if (
            data &&
            Object.prototype.hasOwnProperty.call(data, "engagement")
          ) {
            return data;
          }

          return {
            engagement: null,
          };
        }),
      {
        label: `Dislike API error for ${v}`,
        fallback: {
          engagement: null,
        },
        cacheFallbackTtl: 15 * 1000,
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
        this.limits.colors(async () => {
          const thumbnailUrl = `https://i.ytimg.com/vi/${v}/hqdefault.jpg?sqp=${this.sqp}`;

          const res = await this.fetchWithRetry(fetch, thumbnailUrl, {}, {
            videoId: v,
            maxRetryTime: 2200,
            perTryTimeoutMs: 1400,
          });

          if (!res.ok) {
            throw new Error(`Thumbnail HTTP Error ${res.status}`);
          }

          const buffer = Buffer.from(await res.arrayBuffer());
          const palette = await getColors(buffer, "image/jpeg");

          if (Array.isArray(palette) && palette[0] && palette[1]) {
            return {
              color: palette[0].hex(),
              color2: palette[1].hex(),
            };
          }

          return this.defaultColors;
        }),
      {
        label: `Thumbnail color extraction error for ${v}`,
        fallback: this.defaultColors,
        cacheFallbackTtl: 30 * 1000,
        shouldCache: (value) => value && value.color && value.color2,
      }
    );
  }

  buildWatchResult(vid, comments, dislikesData, colorData) {
    const colors = colorData || this.defaultColors;

    return {
      vid,
      comments,
      channel_uploads: " ",
      engagement: dislikesData ? dislikesData.engagement : null,
      wiki: "",
      desc: "",
      color: colors.color,
      color2: colors.color2,
    };
  }

  async getYouTubePlayerInfo(f, v, contentlang, contentregion) {
    if (!v) {
      this.initError("Missing video ID", null);

      return {
        error: true,
        message: "No video ID provided",
      };
    }

    if (this.blockedVideos.has(v)) {
      const reasonKey = this.blockedVideos.get(v);

      return {
        error: true,
        message:
          this.knownErrors[reasonKey] ||
          "This video is blocked, removed, or unavailable.",
        reason: reasonKey,
      };
    }

    const key = this.makeWatchKey(v, contentlang, contentregion);
    const cached = this.getCache(this.finalCache, key);

    if (cached.hit) {
      return cached.value;
    }

    return this.getOrCreateInFlight(`full:${key}`, async () => {
      const fetch = await this.getFetch();

      try {
        const [comments, vidObj, dislikesData, colorData] = await Promise.all([
          this.getRequiredComments(fetch, v, contentlang, contentregion),
          this.getRequiredVideoInfo(fetch, v, contentlang, contentregion),
          this.getRequiredDislikes(v),
          this.getRequiredThumbnailColors(fetch, v),
        ]);

        const vid = vidObj;

        if (!vid || vid.error || vid.isInternalError) {
          const errorMsg =
            (vid && (vid.error || vid.reason)) ||
            "This video is probably about to premiere.";

          this.initError("Video info fetch error", `${v} - ${errorMsg}`);

          return this.buildWatchResult(
            {
              error: errorMsg,
            },
            comments,
            dislikesData,
            colorData
          );
        }

        if (this.checkUnexistingObject(vid)) {
          const result = this.buildWatchResult(
            vid,
            comments,
            dislikesData,
            colorData
          );

          this.setCache(
            this.finalCache,
            key,
            result,
            this.ttl.final,
            this.staleTtl.final
          );

          return result;
        }

        this.initError(vid, `ID: ${v}`);

        return this.buildWatchResult(
          vid || {
            error: "Incomplete data returned.",
          },
          comments,
          dislikesData,
          colorData
        );
      } catch (error) {
        if (this.knownErrors[error.message]) {
          return {
            error: true,
            message: this.knownErrors[error.message],
            reason: error.message,
          };
        }

        const stale = this.getCache(this.finalCache, key, { stale: true });
        if (stale.hit) {
          this.initError(`Serving stale video result for ${v}`, error);
          return stale.value;
        }

        this.initError(`Error getting video ${v}`, error);

        return {
          error: true,
          message: error.message || "An unexpected error occurred qwq",
          reason: "UNKNOWN_ERROR",
        };
      }
    });
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