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

const VIDEO_ID_REGEX = /^[a-zA-Z0-9_-]{11}$/;
const INVALID_ROUTES = new Set(["assets", "cdn-cgi", "404"]);
const DEFAULT_COLORS = Object.freeze({ color: "#0ea5e9", color2: "#111827" });

const CACHE_TTL = Object.freeze({
  video: 45 * 60 * 1000,
  videoStale: 6 * 60 * 60 * 1000,
  comments: 5 * 60 * 1000,
  commentsStale: 30 * 60 * 1000,
  dislikes: 15 * 60 * 1000,
  dislikesStale: 2 * 60 * 60 * 1000,
  colors: 24 * 60 * 60 * 1000,
  colorsStale: 7 * 24 * 60 * 60 * 1000,
  transientError: 15 * 1000,
  premiere: 15 * 1000,
  partial: 90 * 1000,
  partialStale: 8 * 60 * 1000
});

const CACHE_LIMITS = Object.freeze({
  videos: 1000,
  comments: 1000,
  dislikes: 3000,
  colors: 3000,
  errors: 1000
});

const FETCH_TIMEOUTS = Object.freeze({
  video: [1200, 1900, 2900, 4200],
  comments: [650, 1000, 1600],
  thumbnailGet: [700, 1100, 1800],
  colorExtraction: 1200,
  softComments: 750,
  softDislikes: 650,
  softColors: 450
});

const RETRY_CONFIG = Object.freeze({
  videoAttempts: 4,
  commentsAttempts: 3,
  thumbnailAttempts: 3,
  videoBackgroundBaseDelay: 1200,
  videoBackgroundMaxDelay: 60 * 1000,
  colorBackgroundBaseDelay: 900,
  colorBackgroundMaxDelay: 45 * 1000,
  commentsBackgroundBaseDelay: 1500,
  commentsBackgroundMaxDelay: 45 * 1000
});

let cachedFetch = null;

const getFetch = async () => {
  if (cachedFetch) return cachedFetch;

  if (typeof globalThis.fetch === "function") {
    cachedFetch = globalThis.fetch.bind(globalThis);
    return cachedFetch;
  }

  const undici = await import("undici");
  cachedFetch = undici.fetch;
  return cachedFetch;
};

getFetch().catch(() => {});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const unrefTimer = (timer) => {
  if (timer && typeof timer.unref === "function") timer.unref();
  return timer;
};

const createTimeoutSignal = (ms) => {
  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
    return AbortSignal.timeout(ms);
  }

  const controller = new AbortController();
  const timeoutId = unrefTimer(setTimeout(() => controller.abort(), ms));

  return controller.signal;
};

const withSoftTimeout = async (promise, fallback, ms) => {
  let timeoutId = null;

  const timeoutPromise = new Promise((resolve) => {
    timeoutId = unrefTimer(setTimeout(() => resolve(fallback), ms));
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

const normalizeCachePart = (value, fallback) => {
  const normalized = String(value || fallback || "").trim();
  return normalized || fallback;
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const getAttemptTimeout = (profile, attempt) => {
  const timeouts = FETCH_TIMEOUTS[profile] || FETCH_TIMEOUTS.video;

  if (Array.isArray(timeouts)) {
    return timeouts[Math.min(attempt, timeouts.length - 1)];
  }

  return timeouts;
};

const createRetryDelay = (attempt, baseDelay, maxDelay) => {
  const exponential = baseDelay * Math.pow(1.7, clamp(attempt, 0, 12));
  const jitter = Math.floor(Math.random() * Math.min(750, baseDelay));
  return Math.min(Math.floor(exponential + jitter), maxDelay);
};

const firstFulfilled = (promises) => {
  return new Promise((resolve, reject) => {
    let rejected = 0;
    let lastError = null;

    if (!promises.length) {
      reject(new Error("No promises were provided"));
      return;
    }

    for (const promise of promises) {
      Promise.resolve(promise)
        .then(resolve)
        .catch((error) => {
          rejected++;
          lastError = error;

          if (rejected === promises.length) {
            reject(lastError || new Error("All promises rejected"));
          }
        });
    }
  });
};

class FastTTLCache {
  constructor({ maxSize = 500, ttl = 60 * 60 * 1000, staleTtl = 0, name = "cache" } = {}) {
    this.maxSize = maxSize;
    this.defaultTtl = ttl;
    this.defaultStaleTtl = staleTtl;
    this.name = name;
    this.items = new Map();
    this.hits = 0;
    this.misses = 0;
    this.staleHits = 0;
    this.evictions = 0;
    this.sets = 0;
    this.deletes = 0;
    this.lastPrune = Date.now();
  }

  now() {
    return Date.now();
  }

  size() {
    return this.items.size;
  }

  set(key, value, options = {}) {
    const now = this.now();
    const ttl = Number.isFinite(options.ttl) ? options.ttl : this.defaultTtl;
    const staleTtl = Number.isFinite(options.staleTtl) ? options.staleTtl : this.defaultStaleTtl;

    if (ttl <= 0 && staleTtl <= 0) return false;

    if (this.items.has(key)) this.items.delete(key);

    this.items.set(key, {
      value,
      createdAt: now,
      touchedAt: now,
      expiresAt: now + Math.max(ttl, 0),
      staleExpiresAt: now + Math.max(ttl, 0) + Math.max(staleTtl, 0),
      hits: 0
    });

    this.sets++;

    if (this.items.size > this.maxSize) this.evictOverflow();
    if (now - this.lastPrune > 60 * 1000) this.pruneExpired();

    return true;
  }

  get(key) {
    const entry = this.getEntry(key, { allowStale: false });
    return entry ? entry.value : null;
  }

  getStale(key) {
    const entry = this.getEntry(key, { allowStale: true });
    return entry ? entry.value : null;
  }

  getEntry(key, { allowStale = false, touch = true } = {}) {
    const entry = this.items.get(key);

    if (!entry) {
      this.misses++;
      return null;
    }

    const now = this.now();

    if (now > entry.staleExpiresAt) {
      this.items.delete(key);
      this.misses++;
      this.deletes++;
      return null;
    }

    const isFresh = now <= entry.expiresAt;

    if (!isFresh && !allowStale) {
      this.misses++;
      return null;
    }

    entry.hits++;
    entry.touchedAt = now;

    if (touch) {
      this.items.delete(key);
      this.items.set(key, entry);
    }

    if (isFresh) {
      this.hits++;
    } else {
      this.staleHits++;
    }

    return {
      key,
      value: entry.value,
      state: isFresh ? "fresh" : "stale",
      createdAt: entry.createdAt,
      touchedAt: entry.touchedAt,
      expiresAt: entry.expiresAt,
      staleExpiresAt: entry.staleExpiresAt,
      hits: entry.hits
    };
  }

  has(key) {
    return Boolean(this.getEntry(key, { allowStale: false, touch: false }));
  }

  update(key, updater) {
    const entry = this.items.get(key);

    if (!entry) return null;

    const now = this.now();

    if (now > entry.staleExpiresAt) {
      this.items.delete(key);
      this.deletes++;
      return null;
    }

    entry.value = updater(entry.value);
    entry.touchedAt = now;

    this.items.delete(key);
    this.items.set(key, entry);

    return entry.value;
  }

  delete(key) {
    const deleted = this.items.delete(key);
    if (deleted) this.deletes++;
    return deleted;
  }

  clear() {
    this.items.clear();
  }

  pruneExpired() {
    const now = this.now();
    let removed = 0;

    for (const [key, entry] of this.items.entries()) {
      if (now > entry.staleExpiresAt) {
        this.items.delete(key);
        removed++;
      }
    }

    this.lastPrune = now;
    this.deletes += removed;
    return removed;
  }

  evictOverflow() {
    while (this.items.size > this.maxSize) {
      const key = this.items.keys().next().value;
      if (key === undefined) break;
      this.items.delete(key);
      this.evictions++;
    }
  }

  stats() {
    return {
      name: this.name,
      size: this.items.size,
      maxSize: this.maxSize,
      hits: this.hits,
      staleHits: this.staleHits,
      misses: this.misses,
      sets: this.sets,
      deletes: this.deletes,
      evictions: this.evictions
    };
  }
}

class InnerTubePokeVidious {
  constructor(config) {
    this.config = config;

    this.videoCache = new FastTTLCache({
      name: "videos",
      maxSize: CACHE_LIMITS.videos,
      ttl: CACHE_TTL.video,
      staleTtl: CACHE_TTL.videoStale
    });

    this.commentCache = new FastTTLCache({
      name: "comments",
      maxSize: CACHE_LIMITS.comments,
      ttl: CACHE_TTL.comments,
      staleTtl: CACHE_TTL.commentsStale
    });

    this.dislikeCache = new FastTTLCache({
      name: "dislikes",
      maxSize: CACHE_LIMITS.dislikes,
      ttl: CACHE_TTL.dislikes,
      staleTtl: CACHE_TTL.dislikesStale
    });

    this.colorCache = new FastTTLCache({
      name: "colors",
      maxSize: CACHE_LIMITS.colors,
      ttl: CACHE_TTL.colors,
      staleTtl: CACHE_TTL.colorsStale
    });

    this.errorCache = new FastTTLCache({
      name: "errors",
      maxSize: CACHE_LIMITS.errors,
      ttl: CACHE_TTL.transientError,
      staleTtl: 0
    });

    this.blockedVideos = new Map();
    this.blockPromise = null;

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
    this.blockedFile = "blockedreasons.txt";

    this.KNOWN_ERRORS = {
      COPYRIGHT_BLOCKED: "This video contains content from a copyright holder who has blocked it.",
      UPLOADER_REMOVED: "This video has been removed by the uploader.",
      VIDEO_UNAVAILABLE: "Video unavailable.",
      INAPPROPRIATE: "This video may be inappropriate for some users.",
      GEO_BLOCKED: "The uploader has not made this video available in your country."
    };

    this.pendingRequests = new Map();
    this.pendingComments = new Map();
    this.pendingDislikes = new Map();
    this.pendingColors = new Map();
    this.videoKeysById = new Map();

    this.videoRetryTimers = new Map();
    this.videoRetryAttempts = new Map();
    this.colorRetryTimers = new Map();
    this.colorRetryAttempts = new Map();
    this.commentRetryTimers = new Map();
    this.commentRetryAttempts = new Map();

    this.loadBlockedVideos();
  }

  loadBlockedVideos() {
    if (this.blockPromise) return this.blockPromise;

    this.blockPromise = (async () => {
      try {
        if (!fs.existsSync(this.blockedFile)) return;

        const content = await fs.promises.readFile(this.blockedFile, "utf8");

        for (const line of content.split("\n")) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.includes("|")) continue;

          const [videoId, reason] = trimmed.split("|", 2);
          const cleanVideoId = videoId.trim();
          const cleanReason = reason.trim();

          if (this.isvalidvideo(cleanVideoId) && cleanReason) {
            this.blockedVideos.set(cleanVideoId, cleanReason);
          }
        }
      } catch (error) {
        console.error("[LIBPT ERROR] Could not load blockedreasons.txt", this.safeLogError(error));
      }
    })();

    return this.blockPromise;
  }

  addBlockedVideo(videoId, reason) {
    if (!this.isvalidvideo(videoId) || !reason) return;
    if (this.blockedVideos.has(videoId)) return;

    this.blockedVideos.set(videoId, reason);

    fs.promises.appendFile(this.blockedFile, `${videoId}|${reason}\n`)
      .catch((error) => console.error("[LIBPT ERROR] Could not write to blockedreasons.txt", this.safeLogError(error)));
  }

  getJson(str) {
    if (!str || typeof str !== "string") return null;

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
    if (typeof btoa !== "undefined") return btoa(str);
    return Buffer.from(String(str)).toString("base64");
  }

  detectKnownError(text) {
    if (!text || typeof text !== "string") return null;

    const lowerText = text.toLowerCase();

    if (lowerText.includes("not made this video available in your country")) return "GEO_BLOCKED";
    if (lowerText.includes("removed by the uploader")) return "UPLOADER_REMOVED";
    if (lowerText.includes("inappropriate")) return "INAPPROPRIATE";
    if (lowerText.includes("copyright") || lowerText.includes("blocked")) return "COPYRIGHT_BLOCKED";
    if (lowerText.includes("unavailable")) return "VIDEO_UNAVAILABLE";

    return null;
  }

  isAbortLike(error) {
    const message = String(error?.message || "").toLowerCase();

    return Boolean(
      error && (
        error.code === "UND_ERR_CONNECT_TIMEOUT" ||
        error.code === "UND_ERR_HEADERS_TIMEOUT" ||
        error.code === "UND_ERR_BODY_TIMEOUT" ||
        error.code === "ECONNRESET" ||
        error.code === "ETIMEDOUT" ||
        error.name === "AbortError" ||
        error.name === "TimeoutError" ||
        message.includes("aborted") ||
        message.includes("timeout") ||
        message.includes("timed out")
      )
    );
  }

  isRetryableStatus(status) {
    return status === 408 || status === 425 || status === 429 || (status >= 500 && status < 600);
  }

  isRetryableError(error) {
    if (!error) return false;
    if (this.KNOWN_ERRORS[error.message]) return false;
    if (this.isAbortLike(error)) return true;

    const code = String(error.code || "");
    return code === "ECONNRESET" ||
      code === "ENOTFOUND" ||
      code === "EAI_AGAIN" ||
      code === "ECONNREFUSED" ||
      code === "ENETUNREACH" ||
      code === "EPIPE";
  }

  safeLogError(error) {
    if (!error) return "";
    if (this.isAbortLike(error)) return error.name || "Timeout";
    return error?.stack || error?.message || error;
  }

  publicErrorMessage(error) {
    if (this.isAbortLike(error)) {
      return "The video service took too long to respond, but Poke is retrying in the background.";
    }

    const message = String(error?.message || "").trim();

    if (!message || message.toLowerCase().includes("operation was aborted")) {
      return "The video service did not respond in time, but Poke is retrying in the background.";
    }

    return message;
  }

  initError(context, error) {
    if (this.isAbortLike(error)) return;
    console.log("[LIBPT CORE ERROR]", context, this.safeLogError(error));
  }

  isvalidvideo(v) {
    return !INVALID_ROUTES.has(v) && VIDEO_ID_REGEX.test(v);
  }

  getContentLanguage(contentlang) {
    return normalizeCachePart(contentlang, "en-US").replace(/^hl=/i, "");
  }

  getContentRegion(contentregion) {
    return normalizeCachePart(contentregion, "US").replace(/^region=/i, "");
  }

  createVideoCacheKey(videoId, contentlang, contentregion) {
    return `video:${videoId}:hl:${contentlang}:region:${contentregion}`;
  }

  createCommentsCacheKey(videoId, contentlang, contentregion) {
    return `comments:${videoId}:hl:${contentlang}:region:${contentregion}`;
  }

  rememberVideoCacheKey(videoId, cacheKey) {
    let keys = this.videoKeysById.get(videoId);

    if (!keys) {
      keys = new Set();
      this.videoKeysById.set(videoId, keys);
    }

    keys.add(cacheKey);
  }

  getCachePolicy(payload) {
    if (!payload || typeof payload !== "object") {
      return { ttl: CACHE_TTL.transientError, staleTtl: 0 };
    }

    if (payload.error && payload.reason === "PREMIERE") {
      return { ttl: CACHE_TTL.premiere, staleTtl: 0 };
    }

    if (payload.error) {
      return { ttl: CACHE_TTL.transientError, staleTtl: 0 };
    }

    if (payload.vid && payload.vid.error) {
      return { ttl: CACHE_TTL.partial, staleTtl: CACHE_TTL.partialStale };
    }

    return { ttl: CACHE_TTL.video, staleTtl: CACHE_TTL.videoStale };
  }

  setVideoCache(videoId, cacheKey, payload) {
    const policy = this.getCachePolicy(payload);
    this.videoCache.set(cacheKey, payload, policy);
    this.rememberVideoCacheKey(videoId, cacheKey);
  }

  patchCachedVideoColors(videoId, colors) {
    const keys = this.videoKeysById.get(videoId);
    if (!keys || !colors) return;

    for (const key of keys) {
      const updated = this.videoCache.update(key, (payload) => {
        if (!payload || typeof payload !== "object") return payload;
        return { ...payload, color: colors.color, color2: colors.color2 };
      });

      if (!updated) keys.delete(key);
    }

    if (keys.size === 0) this.videoKeysById.delete(videoId);
  }

  async dedupe(map, key, fn) {
    if (map.has(key)) return map.get(key);

    const promise = (async () => fn())();
    map.set(key, promise);

    try {
      return await promise;
    } finally {
      map.delete(key);
    }
  }

  async fetchTextWithRetry(url, options = {}, retries = 2, videoId, profile = "video") {
    const fetchFn = await getFetch();
    let lastError = null;
    let lastText = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const signal = createTimeoutSignal(getAttemptTimeout(profile, attempt));
        const res = await fetchFn(url, { ...options, signal });
        const text = await res.text();

        if (res.ok) return text;

        lastText = text;

        if (text.length < 10000) {
          const reason = this.detectKnownError(text);

          if (reason) {
            this.addBlockedVideo(videoId, reason);
            throw new Error(reason);
          }
        }

        if (!this.isRetryableStatus(res.status)) return text;

        lastError = new Error(`HTTP ${res.status}`);
      } catch (error) {
        if (this.KNOWN_ERRORS[error.message]) throw error;

        lastError = error;

        if (!this.isRetryableError(error) && attempt >= 1) {
          throw error;
        }
      }

      if (attempt < retries) {
        await sleep(createRetryDelay(attempt, 45, 350));
      }
    }

    if (lastText) return lastText;
    throw lastError || new Error("Fetch failed after retries");
  }

  createThumbnailUrl(host, videoId, filename) {
    return `https://${host}/vi/${videoId}/${filename}`;
  }

  getThumbnailCandidateBatches(videoId, host) {
    return [
      [
        this.createThumbnailUrl(host, videoId, "hqdefault.jpg"),
        this.createThumbnailUrl(host, videoId, "mqdefault.jpg")
      ],
      [
        this.createThumbnailUrl(host, videoId, "sddefault.jpg"),
        this.createThumbnailUrl(host, videoId, "default.jpg")
      ],
      [
        this.createThumbnailUrl(host, videoId, "maxresdefault.jpg")
      ]
    ];
  }

  async fetchThumbnailBuffer(url, attempt = 0) {
    const fetchFn = await getFetch();

    const res = await fetchFn(url, {
      method: "GET",
      headers: {
        "User-Agent": this.useragent,
        "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8"
      },
      signal: createTimeoutSignal(getAttemptTimeout("thumbnailGet", attempt))
    });

    if (!res.ok) {
      throw new Error(`Thumbnail request failed with status ${res.status}`);
    }

    const contentType = String(res.headers.get("content-type") || "image/jpeg").split(";")[0].trim().toLowerCase();

    if (!contentType.startsWith("image/") && contentType !== "application/octet-stream") {
      throw new Error(`Thumbnail response was not an image: ${contentType}`);
    }

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (!buffer.length) {
      throw new Error("Thumbnail response was empty");
    }

    return {
      url,
      buffer,
      mimeType: contentType === "application/octet-stream" ? "image/jpeg" : contentType
    };
  }

  async fetchBestThumbnailFromHost(videoId, host) {
    const batches = this.getThumbnailCandidateBatches(videoId, host);
    let lastError = null;

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      try {
        return await firstFulfilled(
          batches[batchIndex].map((url) => this.fetchThumbnailBuffer(url, batchIndex))
        );
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError || new Error(`No thumbnail could be fetched from ${host}`);
  }

  async getPaletteFromThumbnail(thumbnail) {
    const palette = await withSoftTimeout(
      getColors(thumbnail.buffer, thumbnail.mimeType),
      null,
      FETCH_TIMEOUTS.colorExtraction
    );

    if (Array.isArray(palette) && palette.length >= 2) {
      return {
        color: palette[0].hex(),
        color2: palette[1].hex()
      };
    }

    if (Array.isArray(palette) && palette.length === 1) {
      return {
        color: palette[0].hex(),
        color2: palette[0].hex()
      };
    }

    throw new Error("No usable colors found in thumbnail");
  }

  async loadColorsFromNetwork(videoId) {
    const hosts = ["vid.puffyan.us", "i.ytimg.com"];
    let lastError = null;

    for (const host of hosts) {
      try {
        const thumbnail = await this.fetchBestThumbnailFromHost(videoId, host);
        return await this.getPaletteFromThumbnail(thumbnail);
      } catch (error) {
        lastError = error;
        this.initError(`Thumbnail color fetch failed for ${videoId} on ${host}`, error);
      }
    }

    throw lastError || new Error("Could not extract thumbnail colors");
  }

  scheduleColorRetry(videoId) {
    if (!this.isvalidvideo(videoId)) return;
    if (this.colorRetryTimers.has(videoId)) return;
    if (this.pendingColors.has(videoId)) return;

    const attempt = this.colorRetryAttempts.get(videoId) || 0;
    const delay = createRetryDelay(
      attempt,
      RETRY_CONFIG.colorBackgroundBaseDelay,
      RETRY_CONFIG.colorBackgroundMaxDelay
    );

    const timer = unrefTimer(setTimeout(async () => {
      this.colorRetryTimers.delete(videoId);

      try {
        const colors = await this.loadColorsFromNetwork(videoId);

        this.colorCache.set(videoId, colors, {
          ttl: CACHE_TTL.colors,
          staleTtl: CACHE_TTL.colorsStale
        });

        this.patchCachedVideoColors(videoId, colors);
        this.colorRetryAttempts.delete(videoId);
      } catch {
        this.colorRetryAttempts.set(videoId, attempt + 1);
        this.scheduleColorRetry(videoId);
      }
    }, delay));

    this.colorRetryTimers.set(videoId, timer);
  }

  async refreshColors(videoId) {
    return this.dedupe(this.pendingColors, videoId, async () => {
      try {
        const colors = await this.loadColorsFromNetwork(videoId);

        this.colorCache.set(videoId, colors, {
          ttl: CACHE_TTL.colors,
          staleTtl: CACHE_TTL.colorsStale
        });

        this.patchCachedVideoColors(videoId, colors);
        this.colorRetryAttempts.delete(videoId);

        return colors;
      } catch (error) {
        this.initError(`Could not extract thumbnail colors for ${videoId}`, error);
        this.scheduleColorRetry(videoId);
        return DEFAULT_COLORS;
      }
    });
  }

  async getColorsForVideo(videoId) {
    const entry = this.colorCache.getEntry(videoId, { allowStale: true });

    if (entry) {
      if (entry.state === "stale") this.refreshColors(videoId).catch(() => {});
      return entry.value;
    }

    const colorPromise = this.refreshColors(videoId);
    return withSoftTimeout(colorPromise, DEFAULT_COLORS, FETCH_TIMEOUTS.softColors);
  }

  extractColorsBackground(videoId) {
    this.refreshColors(videoId).catch(() => {
      this.scheduleColorRetry(videoId);
    });
  }

  async getComments(videoId, contentlang, contentregion, headers) {
    const cacheKey = this.createCommentsCacheKey(videoId, contentlang, contentregion);
    const entry = this.commentCache.getEntry(cacheKey, { allowStale: true });

    if (entry) {
      if (entry.state === "stale") {
        this.refreshComments(videoId, contentlang, contentregion, headers).catch(() => {
          this.scheduleCommentsRetry(videoId, contentlang, contentregion, headers);
        });
      }

      return entry.value;
    }

    const promise = this.refreshComments(videoId, contentlang, contentregion, headers);
    return withSoftTimeout(promise, null, FETCH_TIMEOUTS.softComments);
  }

  scheduleCommentsRetry(videoId, contentlang, contentregion, headers) {
    const cacheKey = this.createCommentsCacheKey(videoId, contentlang, contentregion);

    if (this.commentRetryTimers.has(cacheKey)) return;
    if (this.pendingComments.has(cacheKey)) return;

    const attempt = this.commentRetryAttempts.get(cacheKey) || 0;
    const delay = createRetryDelay(
      attempt,
      RETRY_CONFIG.commentsBackgroundBaseDelay,
      RETRY_CONFIG.commentsBackgroundMaxDelay
    );

    const timer = unrefTimer(setTimeout(async () => {
      this.commentRetryTimers.delete(cacheKey);

      try {
        await this.refreshComments(videoId, contentlang, contentregion, headers);
        this.commentRetryAttempts.delete(cacheKey);
      } catch {
        this.commentRetryAttempts.set(cacheKey, attempt + 1);
        this.scheduleCommentsRetry(videoId, contentlang, contentregion, headers);
      }
    }, delay));

    this.commentRetryTimers.set(cacheKey, timer);
  }

  async refreshComments(videoId, contentlang, contentregion, headers) {
    const cacheKey = this.createCommentsCacheKey(videoId, contentlang, contentregion);

    return this.dedupe(this.pendingComments, cacheKey, async () => {
      try {
        const cacheBuster = this.toBase64(Date.now().toString(36));
        const commentsUrl = `${this.config.invapi}/comments/${videoId}?hl=${encodeURIComponent(contentlang)}&region=${encodeURIComponent(contentregion)}&h=${encodeURIComponent(cacheBuster)}`;
        const raw = await this.fetchTextWithRetry(
          commentsUrl,
          { headers },
          RETRY_CONFIG.commentsAttempts - 1,
          videoId,
          "comments"
        );

        const parsed = this.getJson(raw);

        this.commentCache.set(cacheKey, parsed, {
          ttl: CACHE_TTL.comments,
          staleTtl: CACHE_TTL.commentsStale
        });

        this.commentRetryAttempts.delete(cacheKey);

        return parsed;
      } catch (error) {
        this.scheduleCommentsRetry(videoId, contentlang, contentregion, headers);
        throw error;
      }
    });
  }

  async getDislikes(videoId) {
    const entry = this.dislikeCache.getEntry(videoId, { allowStale: true });

    if (entry) {
      if (entry.state === "stale") this.refreshDislikes(videoId).catch(() => {});
      return entry.value;
    }

    const promise = this.refreshDislikes(videoId);
    return withSoftTimeout(promise, { engagement: null }, FETCH_TIMEOUTS.softDislikes);
  }

  async refreshDislikes(videoId) {
    return this.dedupe(this.pendingDislikes, videoId, async () => {
      const data = await getdislikes(videoId).catch(() => ({ engagement: null }));
      const payload = data && typeof data === "object" ? data : { engagement: null };

      this.dislikeCache.set(videoId, payload, {
        ttl: CACHE_TTL.dislikes,
        staleTtl: CACHE_TTL.dislikesStale
      });

      return payload;
    });
  }

  async getYouTubePlayerInfo(f, v, contentlang, contentregion) {
    if (!v) {
      this.initError("Missing video ID", null);
      return { error: true, message: "No video ID provided" };
    }

    if (!this.isvalidvideo(v)) {
      return { error: true, message: "Invalid video ID format" };
    }

    const cleanLang = this.getContentLanguage(contentlang);
    const cleanRegion = this.getContentRegion(contentregion);
    const cacheKey = this.createVideoCacheKey(v, cleanLang, cleanRegion);

    await this.loadBlockedVideos();

    if (this.blockedVideos.has(v)) {
      const reasonKey = this.blockedVideos.get(v);

      return {
        error: true,
        message: this.KNOWN_ERRORS[reasonKey] || "This video is blocked, removed, or unavailable.",
        reason: reasonKey
      };
    }

    const cached = this.videoCache.getEntry(cacheKey, { allowStale: true });

    if (cached) {
      if (cached.state === "stale") {
        this.refreshVideoDataInBackground(v, cleanLang, cleanRegion, cacheKey);
      }

      return cached.value;
    }

    const cachedError = this.errorCache.get(cacheKey);

    if (cachedError) {
      this.scheduleVideoRetry(v, cleanLang, cleanRegion, cacheKey);
      return cachedError;
    }

    return this.dedupe(this.pendingRequests, cacheKey, async () => {
      const payload = await this._fetchVideoData(v, cleanLang, cleanRegion, cacheKey);
      this.setVideoCache(v, cacheKey, payload);

      if (payload && payload.error) {
        const policy = this.getCachePolicy(payload);
        this.errorCache.set(cacheKey, payload, { ttl: policy.ttl, staleTtl: 0 });

        if (payload.reason === "UNKNOWN_ERROR") {
          this.scheduleVideoRetry(v, cleanLang, cleanRegion, cacheKey);
        }
      }

      if (payload && payload.vid && payload.vid.error) {
        this.scheduleVideoRetry(v, cleanLang, cleanRegion, cacheKey);
      }

      return payload;
    });
  }

  scheduleVideoRetry(videoId, contentlang, contentregion, cacheKey) {
    if (!this.isvalidvideo(videoId)) return;
    if (this.videoRetryTimers.has(cacheKey)) return;
    if (this.pendingRequests.has(cacheKey)) return;
    if (this.blockedVideos.has(videoId)) return;

    const attempt = this.videoRetryAttempts.get(cacheKey) || 0;
    const delay = createRetryDelay(
      attempt,
      RETRY_CONFIG.videoBackgroundBaseDelay,
      RETRY_CONFIG.videoBackgroundMaxDelay
    );

    const timer = unrefTimer(setTimeout(async () => {
      this.videoRetryTimers.delete(cacheKey);

      try {
        const payload = await this._fetchVideoData(videoId, contentlang, contentregion, cacheKey, {
          backgroundRetry: true
        });

        this.setVideoCache(videoId, cacheKey, payload);

        if (payload && payload.error && payload.reason === "UNKNOWN_ERROR") {
          this.videoRetryAttempts.set(cacheKey, attempt + 1);
          this.scheduleVideoRetry(videoId, contentlang, contentregion, cacheKey);
          return;
        }

        if (payload && payload.vid && payload.vid.error) {
          this.videoRetryAttempts.set(cacheKey, attempt + 1);
          this.scheduleVideoRetry(videoId, contentlang, contentregion, cacheKey);
          return;
        }

        this.videoRetryAttempts.delete(cacheKey);
      } catch {
        this.videoRetryAttempts.set(cacheKey, attempt + 1);
        this.scheduleVideoRetry(videoId, contentlang, contentregion, cacheKey);
      }
    }, delay));

    this.videoRetryTimers.set(cacheKey, timer);
  }

  refreshVideoDataInBackground(videoId, contentlang, contentregion, cacheKey) {
    if (this.pendingRequests.has(cacheKey)) return;

    const promise = (async () => {
      try {
        const payload = await this._fetchVideoData(videoId, contentlang, contentregion, cacheKey, {
          backgroundRetry: true
        });

        this.setVideoCache(videoId, cacheKey, payload);

        if (payload && payload.error && payload.reason === "UNKNOWN_ERROR") {
          this.scheduleVideoRetry(videoId, contentlang, contentregion, cacheKey);
        }

        if (payload && payload.vid && payload.vid.error) {
          this.scheduleVideoRetry(videoId, contentlang, contentregion, cacheKey);
        }
      } catch (error) {
        this.initError(`Background refresh failed for ${videoId}`, error);
        this.scheduleVideoRetry(videoId, contentlang, contentregion, cacheKey);
      } finally {
        this.pendingRequests.delete(cacheKey);
      }
    })();

    this.pendingRequests.set(cacheKey, promise);
  }

  async _fetchVideoData(videoId, contentlang, contentregion, cacheKey, options = {}) {
    const headers = { "User-Agent": this.useragent };
    const cacheBuster = this.toBase64(Date.now().toString(36));
    const videoUrl = `${this.config.invapi}/videos/${videoId}?hl=${encodeURIComponent(contentlang)}&region=${encodeURIComponent(contentregion)}&h=${encodeURIComponent(cacheBuster)}`;

    try {
      const commentsPromise = this.getComments(videoId, contentlang, contentregion, headers);
      const dislikesPromise = this.getDislikes(videoId);
      const colorsPromise = this.getColorsForVideo(videoId);

      const attemptVideoFetch = async () => {
        const raw = await this.fetchTextWithRetry(
          videoUrl,
          { headers },
          RETRY_CONFIG.videoAttempts - 1,
          videoId,
          "video"
        );

        const parsed = this.getJson(raw);
        let errorMsg = null;

        if (!parsed || parsed.error || parsed.isInternalError) {
          errorMsg = parsed?.error || parsed?.reason || "This video is probably about to premiere.";
        }

        return { raw, parsed, errorMsg };
      };

      let videoData = await attemptVideoFetch();

      const isPremiereError = (message) => {
        return message && (
          message === "This video is probably about to premiere." ||
          String(message).toLowerCase().includes("premiere")
        );
      };

      if (isPremiereError(videoData.errorMsg)) {
        await sleep(220);
        videoData = await attemptVideoFetch();

        if (isPremiereError(videoData.errorMsg)) {
          return {
            error: true,
            message: "Could not fetch: This video is probably about to premiere.",
            reason: "PREMIERE"
          };
        }
      }

      const [comments, dislikesData, colors] = await Promise.all([
        withSoftTimeout(commentsPromise, null, FETCH_TIMEOUTS.softComments),
        withSoftTimeout(dislikesPromise, { engagement: null }, FETCH_TIMEOUTS.softDislikes),
        withSoftTimeout(colorsPromise, DEFAULT_COLORS, FETCH_TIMEOUTS.softColors)
      ]);

      const vid = videoData.parsed;
      const engagement = dislikesData?.engagement || null;
      const safeColors = colors && typeof colors === "object" ? colors : DEFAULT_COLORS;

      if (videoData.errorMsg) {
        const reason = this.detectKnownError(videoData.errorMsg);

        if (reason) {
          this.addBlockedVideo(videoId, reason);

          return {
            error: true,
            message: this.KNOWN_ERRORS[reason],
            reason
          };
        }

        this.initError("Video info fetch error", `${videoId} - ${videoData.errorMsg}`);

        return {
          vid: { error: videoData.errorMsg },
          comments,
          channel_uploads: " ",
          engagement,
          wiki: "",
          desc: "",
          color: safeColors.color,
          color2: safeColors.color2
        };
      }

      if (this.checkUnexistingObject(vid)) {
        return {
          vid,
          comments,
          channel_uploads: " ",
          engagement,
          wiki: "",
          desc: "",
          color: safeColors.color,
          color2: safeColors.color2
        };
      }

      this.initError(vid, `ID: ${videoId}`);

      return {
        vid: vid || { error: "Incomplete data returned." },
        comments,
        channel_uploads: " ",
        engagement,
        wiki: "",
        desc: "",
        color: safeColors.color,
        color2: safeColors.color2
      };
    } catch (error) {
      if (this.KNOWN_ERRORS[error.message]) {
        return {
          error: true,
          message: this.KNOWN_ERRORS[error.message],
          reason: error.message
        };
      }

      const stale = this.videoCache.getStale(cacheKey);

      if (stale) {
        if (!options.backgroundRetry) {
          this.scheduleVideoRetry(videoId, contentlang, contentregion, cacheKey);
        }

        return stale;
      }

      this.initError(`Error getting video ${videoId}`, error);

      if (!options.backgroundRetry) {
        this.scheduleVideoRetry(videoId, contentlang, contentregion, cacheKey);
      }

      return {
        error: true,
        message: this.publicErrorMessage(error),
        reason: "UNKNOWN_ERROR"
      };
    }
  }

  getCacheStats() {
    return {
      videos: this.videoCache.stats(),
      comments: this.commentCache.stats(),
      dislikes: this.dislikeCache.stats(),
      colors: this.colorCache.stats(),
      errors: this.errorCache.stats(),
      pending: {
        videos: this.pendingRequests.size,
        comments: this.pendingComments.size,
        dislikes: this.pendingDislikes.size,
        colors: this.pendingColors.size
      },
      retries: {
        videos: this.videoRetryTimers.size,
        comments: this.commentRetryTimers.size,
        colors: this.colorRetryTimers.size
      },
      blockedVideos: this.blockedVideos.size
    };
  }

  clearRetryTimers() {
    for (const timer of this.videoRetryTimers.values()) clearTimeout(timer);
    for (const timer of this.colorRetryTimers.values()) clearTimeout(timer);
    for (const timer of this.commentRetryTimers.values()) clearTimeout(timer);

    this.videoRetryTimers.clear();
    this.videoRetryAttempts.clear();
    this.colorRetryTimers.clear();
    this.colorRetryAttempts.clear();
    this.commentRetryTimers.clear();
    this.commentRetryAttempts.clear();
  }

  clearCaches() {
    this.videoCache.clear();
    this.commentCache.clear();
    this.dislikeCache.clear();
    this.colorCache.clear();
    this.errorCache.clear();
    this.videoKeysById.clear();
    this.clearRetryTimers();
  }
}

const pokeTubeApiCore = new InnerTubePokeVidious({
  invapi: config.invapi,
  inv_fallback: config.invapi,
  useragent: config.useragent
});

module.exports = pokeTubeApiCore;