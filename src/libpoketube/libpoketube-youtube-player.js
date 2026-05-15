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

const VIDEO_CACHE_TTL_MS = 3600000;
const VIDEO_STALE_TTL_MS = 21600000;
const COMMENTS_CACHE_TTL_MS = 60000;
const DISLIKE_CACHE_TTL_MS = 600000;
const COLOR_CACHE_TTL_MS = 3600000;
const BLOCKED_CACHE_TTL_MS = 86400000;

const VIDEO_INFO_TIMEOUT_MS = 5200;
const COMMENTS_TIMEOUT_MS = 1700;
const COLOR_FETCH_TIMEOUT_MS = 1200;
const COLOR_EXTRACT_TIMEOUT_MS = 900;
const DISLIKE_TIMEOUT_MS = 1800;

const VIDEO_INFO_RETRIES = 1;
const COMMENTS_RETRIES = 0;

const MAX_VIDEO_INFO_BYTES = 3 * 1024 * 1024;
const MAX_COMMENTS_BYTES = 2 * 1024 * 1024;
const MAX_THUMBNAIL_BYTES = 512 * 1024;

const MAX_VIDEO_CACHE_SIZE = 2000;
const MAX_COMMENTS_CACHE_SIZE = 2000;
const MAX_DISLIKE_CACHE_SIZE = 2000;
const MAX_COLOR_CACHE_SIZE = 2000;
const MAX_BLOCKED_CACHE_SIZE = 20000;
const MAX_IN_FLIGHT_SIZE = 1000;

const UNDICI_CONNECTIONS = 64;
const UNDICI_PIPELINING = 1;
const UNDICI_CONNECT_TIMEOUT_MS = 2500;
const UNDICI_HEADERS_TIMEOUT_MS = 5500;
const UNDICI_BODY_TIMEOUT_MS = 5500;
const UNDICI_KEEP_ALIVE_TIMEOUT_MS = 10000;
const UNDICI_KEEP_ALIVE_MAX_TIMEOUT_MS = 30000;

const DEFAULT_COLORS = {
  color: "#0ea5e9",
  color2: "#111827"
};

const KNOWN_ERROR_MESSAGES = {
  COPYRIGHT_BLOCKED: "This video contains content from a copyright holder who has blocked it.",
  UPLOADER_REMOVED: "This video has been removed by the uploader.",
  VIDEO_UNAVAILABLE: "Video unavailable.",
  INAPPROPRIATE: "This video may be inappropriate for some users."
};

const RETRYABLE_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504]);

class InnerTubePokeVidious {
  constructor(config) {
    this.config = config;

    this.cache = new Map();
    this.commentsCache = new Map();
    this.dislikeCache = new Map();
    this.colorCache = new Map();

    this.inFlight = new Map();
    this.commentsInFlight = new Map();
    this.dislikeInFlight = new Map();
    this.colorInFlight = new Map();
    this.blockedLookupCache = new Map();

    this.MAX_CACHE_SIZE = MAX_VIDEO_CACHE_SIZE;

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
    this.sqp = "-oaymwEbCKgBEF5IVfKriqkDDggBFQAAiEIYAXABwAEG&rs=AOn4CLBy_x4UUHLNDZtJtH0PXeQGoRFTgw";

    this.blockedFile = "blockedreasons.txt";
    this.blockedVideos = new Map();

    this._undiciPromise = null;
    this._requestFn = null;
    this._agent = null;

    this.loadBlockedVideos();
  }

  async getHttpClient() {
    if (this._requestFn && this._agent) {
      return {
        request: this._requestFn,
        agent: this._agent
      };
    }

    if (!this._undiciPromise) {
      this._undiciPromise = import("undici").then((undici) => {
        this._requestFn = undici.request;
        this._agent = new undici.Agent({
          connections: UNDICI_CONNECTIONS,
          pipelining: UNDICI_PIPELINING,
          connectTimeout: UNDICI_CONNECT_TIMEOUT_MS,
          headersTimeout: UNDICI_HEADERS_TIMEOUT_MS,
          bodyTimeout: UNDICI_BODY_TIMEOUT_MS,
          keepAliveTimeout: UNDICI_KEEP_ALIVE_TIMEOUT_MS,
          keepAliveMaxTimeout: UNDICI_KEEP_ALIVE_MAX_TIMEOUT_MS
        });

        return {
          request: this._requestFn,
          agent: this._agent
        };
      });
    }

    return this._undiciPromise;
  }

  async getFetch() {
    if (globalThis.fetch) {
      return globalThis.fetch;
    }

    const { fetch } = await import("undici");
    return fetch;
  }

  loadBlockedVideos() {
    try {
      if (!fs.existsSync(this.blockedFile)) {
        return;
      }

      const content = fs.readFileSync(this.blockedFile, "utf8");
      const lines = content.split(/\r?\n/);

      for (const line of lines) {
        const trimmed = line.trim();

        if (!trimmed) {
          continue;
        }

        const separatorIndex = trimmed.indexOf("|");

        if (separatorIndex === -1) {
          continue;
        }

        const videoId = trimmed.slice(0, separatorIndex).trim();
        const reason = trimmed.slice(separatorIndex + 1).trim();

        if (this.isvalidvideo(videoId) && reason) {
          this.blockedVideos.set(videoId, reason);
        }
      }
    } catch (error) {
      console.error("[LIBPT ERROR] Could not load blockedreasons.txt", error);
    }
  }

  addBlockedVideo(videoId, reason) {
    if (!this.isvalidvideo(videoId)) {
      return;
    }

    if (!reason) {
      return;
    }

    if (this.blockedVideos.has(videoId)) {
      return;
    }

    this.blockedVideos.set(videoId, reason);

    while (this.blockedVideos.size > MAX_BLOCKED_CACHE_SIZE) {
      const oldestKey = this.blockedVideos.keys().next().value;
      this.blockedVideos.delete(oldestKey);
    }

    fs.appendFile(this.blockedFile, `${videoId}|${reason}\n`, (err) => {
      if (err) {
        console.error("[LIBPT ERROR] Could not write to blockedreasons.txt", err);
      }
    });
  }

  getJson(str) {
    try {
      return JSON.parse(str);
    } catch {
      return null;
    }
  }

  checkUnexistingObject(obj) {
    return !!(obj && typeof obj === "object" && "authorId" in obj);
  }

  toBase64(str) {
    return Buffer.from(String(str)).toString("base64");
  }

  encodeParam(value, fallback) {
    const text = String(value || fallback || "").trim();

    if (!text) {
      return "";
    }

    return encodeURIComponent(text);
  }

  getInvApiBase() {
    return String(this.config.invapi || "").replace(/\/+$/, "");
  }

  getVideoCacheKey(v) {
    return String(v || "");
  }

  getCommentsCacheKey(v, contentlang, contentregion) {
    return [
      String(v || ""),
      String(contentlang || "en-US"),
      String(contentregion || "US")
    ].join("|");
  }

  getCacheEntry(map, key, ttlMs) {
    if (!map.has(key)) {
      return {
        hit: false,
        stale: false,
        result: null
      };
    }

    const cached = map.get(key);
    const age = Date.now() - cached.timestamp;

    if (age >= ttlMs) {
      return {
        hit: false,
        stale: true,
        result: cached.result,
        age
      };
    }

    map.delete(key);
    map.set(key, cached);

    return {
      hit: true,
      stale: false,
      result: cached.result,
      age
    };
  }

  getStaleCacheEntry(map, key, maxAgeMs) {
    if (!map.has(key)) {
      return {
        hit: false,
        result: null
      };
    }

    const cached = map.get(key);
    const age = Date.now() - cached.timestamp;

    if (age >= maxAgeMs) {
      map.delete(key);

      return {
        hit: false,
        result: null
      };
    }

    map.delete(key);
    map.set(key, cached);

    return {
      hit: true,
      result: cached.result,
      age
    };
  }

  getCacheValue(map, key, ttlMs) {
    const cached = this.getCacheEntry(map, key, ttlMs);
    return cached.hit ? cached.result : null;
  }

  setCacheValue(map, key, result, maxSize) {
    map.set(key, {
      result,
      timestamp: Date.now()
    });

    while (map.size > maxSize) {
      const oldestKey = map.keys().next().value;
      map.delete(oldestKey);
    }

    return result;
  }

  _setCache(v, dataObj) {
    return this.setCacheValue(this.cache, this.getVideoCacheKey(v), dataObj, this.MAX_CACHE_SIZE);
  }

  getInFlightOrCreate(map, key, producer) {
    if (map.has(key)) {
      return map.get(key);
    }

    if (map.size >= MAX_IN_FLIGHT_SIZE) {
      const error = new Error("Too many in-flight video requests");
      error.code = "POKE_TOO_MANY_IN_FLIGHT";
      return Promise.reject(error);
    }

    const promise = Promise.resolve()
      .then(producer)
      .finally(() => {
        map.delete(key);
      });

    map.set(key, promise);
    return promise;
  }

  createAbortSignal(timeoutMs) {
    if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
      return {
        signal: AbortSignal.timeout(timeoutMs),
        cancel: null
      };
    }

    if (typeof AbortController !== "undefined") {
      const controller = new AbortController();
      const timer = setTimeout(() => {
        try {
          controller.abort(new Error("Request timed out"));
        } catch {
          controller.abort();
        }
      }, timeoutMs);

      if (typeof timer.unref === "function") {
        timer.unref();
      }

      return {
        signal: controller.signal,
        cancel: () => clearTimeout(timer)
      };
    }

    return {
      signal: undefined,
      cancel: null
    };
  }

  sleep(ms) {
    return new Promise((resolve) => {
      const timer = setTimeout(resolve, ms);

      if (typeof timer.unref === "function") {
        timer.unref();
      }
    });
  }

  async readBodyBufferLimited(body, maxBytes) {
    const chunks = [];
    let totalBytes = 0;

    for await (const chunk of body) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      totalBytes += buffer.length;

      if (totalBytes > maxBytes) {
        this.destroyBody(body);

        const error = new Error("Response body too large");
        error.code = "POKE_RESPONSE_TOO_LARGE";
        throw error;
      }

      chunks.push(buffer);
    }

    return Buffer.concat(chunks, totalBytes);
  }

  async readBodyTextLimited(body, maxBytes) {
    const buffer = await this.readBodyBufferLimited(body, maxBytes);
    return buffer.toString("utf8");
  }

  destroyBody(body) {
    if (body && typeof body.destroy === "function") {
      body.destroy();
    }
  }

  isKnownUnavailableError(error) {
    return !!(error && KNOWN_ERROR_MESSAGES[error.message]);
  }

  isTimeoutError(error) {
    if (!error) {
      return false;
    }

    const cause = error.cause || {};

    return (
      error.name === "AbortError" ||
      error.name === "TimeoutError" ||
      error.code === "ABORT_ERR" ||
      error.code === "POKE_TIMEOUT" ||
      error.code === "UND_ERR_CONNECT_TIMEOUT" ||
      error.code === "UND_ERR_HEADERS_TIMEOUT" ||
      error.code === "UND_ERR_BODY_TIMEOUT" ||
      cause.name === "AbortError" ||
      cause.name === "TimeoutError" ||
      cause.code === "ABORT_ERR" ||
      cause.code === "POKE_TIMEOUT" ||
      cause.code === "UND_ERR_CONNECT_TIMEOUT" ||
      cause.code === "UND_ERR_HEADERS_TIMEOUT" ||
      cause.code === "UND_ERR_BODY_TIMEOUT"
    );
  }

  detectKnownVideoError(statusCode, text) {
    const bodyText = String(text || "").toLowerCase();

    if (statusCode === 500 && bodyText.includes("who has blocked it on copyright grounds")) {
      return "COPYRIGHT_BLOCKED";
    }

    if (statusCode === 500 && bodyText.includes("this video has been removed by the uploader")) {
      return "UPLOADER_REMOVED";
    }

    if (statusCode === 500 && bodyText.includes("this video may be inappropriate for some users")) {
      return "INAPPROPRIATE";
    }

    if (statusCode === 404 && bodyText.includes("video unavailable")) {
      return "VIDEO_UNAVAILABLE";
    }

    return null;
  }

  normalizeRequestHeaders(headers) {
    return Object.assign(
      {
        "User-Agent": this.useragent,
        "Accept": "application/json,text/plain,*/*",
        "Accept-Encoding": "gzip, deflate, br"
      },
      headers || {}
    );
  }

  async requestRaw(url, options = {}) {
    const {
      headers = {},
      timeoutMs = VIDEO_INFO_TIMEOUT_MS,
      maxBytes = MAX_VIDEO_INFO_BYTES,
      asBuffer = false
    } = options;

    const { request, agent } = await this.getHttpClient();
    const abort = this.createAbortSignal(timeoutMs);

    try {
      const response = await request(url, {
        method: "GET",
        dispatcher: agent,
        signal: abort.signal,
        headersTimeout: timeoutMs,
        bodyTimeout: timeoutMs,
        headers: this.normalizeRequestHeaders(headers),
        maxRedirections: 2
      });

      const body = asBuffer
        ? await this.readBodyBufferLimited(response.body, maxBytes)
        : await this.readBodyTextLimited(response.body, maxBytes);

      return {
        ok: response.statusCode >= 200 && response.statusCode < 300,
        status: response.statusCode,
        headers: response.headers || {},
        body
      };
    } finally {
      if (typeof abort.cancel === "function") {
        abort.cancel();
      }
    }
  }

  async requestText(url, options = {}) {
    const response = await this.requestRaw(
      url,
      Object.assign({}, options, {
        asBuffer: false
      })
    );

    return {
      ok: response.ok,
      status: response.status,
      headers: response.headers,
      text: response.body
    };
  }

  async requestBuffer(url, options = {}) {
    const response = await this.requestRaw(
      url,
      Object.assign({}, options, {
        asBuffer: true
      })
    );

    return {
      ok: response.ok,
      status: response.status,
      headers: response.headers,
      buffer: response.body
    };
  }

  async _fetchWithRetry(url, options = {}, maxRetries = 1, timeoutMs = VIDEO_INFO_TIMEOUT_MS, maxBytes = MAX_VIDEO_INFO_BYTES) {
    let delayMs = 150;
    let lastError = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.requestText(url, {
          headers: options.headers || {},
          timeoutMs,
          maxBytes
        });

        if (response.ok) {
          return response;
        }

        const knownError = this.detectKnownVideoError(response.status, response.text);

        if (knownError) {
          throw new Error(knownError);
        }

        if (!RETRYABLE_STATUS_CODES.has(response.status) || attempt === maxRetries) {
          return response;
        }
      } catch (error) {
        if (this.isKnownUnavailableError(error)) {
          throw error;
        }

        lastError = error;

        if (attempt === maxRetries) {
          throw error;
        }
      }

      await this.sleep(delayMs);
      delayMs = Math.min(700, Math.round(delayMs * 1.7));
    }

    throw lastError || new Error("Request failed");
  }

  async _fetchJson(url, headers, options = {}) {
    const maxRetries = Number.isFinite(options.maxRetries) ? options.maxRetries : 0;
    const timeoutMs = Number.isFinite(options.timeoutMs) ? options.timeoutMs : VIDEO_INFO_TIMEOUT_MS;
    const maxBytes = Number.isFinite(options.maxBytes) ? options.maxBytes : MAX_VIDEO_INFO_BYTES;

    const response = await this._fetchWithRetry(url, { headers }, maxRetries, timeoutMs, maxBytes);

    if (!response.ok) {
      return null;
    }

    return this.getJson(response.text);
  }

  async _fetchVideoInfo(url, headers, v) {
    try {
      const response = await this._fetchWithRetry(
        url,
        { headers },
        VIDEO_INFO_RETRIES,
        VIDEO_INFO_TIMEOUT_MS,
        MAX_VIDEO_INFO_BYTES
      );

      if (!response.ok) {
        throw new Error(`HTTP Error ${response.status}`);
      }

      const parsed = this.getJson(response.text);

      if (parsed === null) {
        return null;
      }

      if (this.checkUnexistingObject(parsed) || parsed.error) {
        return parsed;
      }

      return null;
    } catch (error) {
      if (this.isKnownUnavailableError(error)) {
        this.addBlockedVideo(v, error.message);
        throw error;
      }

      this.initError("Video info fetch failed", error);

      return {
        isInternalError: true,
        reason: error.message || String(error)
      };
    }
  }

  async getDislikesSafe(v) {
    const cached = this.getCacheEntry(this.dislikeCache, v, DISLIKE_CACHE_TTL_MS);

    if (cached.hit) {
      return cached.result;
    }

    return this.getInFlightOrCreate(this.dislikeInFlight, v, async () => {
      const result = await this.withTimeout(
        getdislikes(v),
        DISLIKE_TIMEOUT_MS,
        "dislike api timed out"
      ).catch((error) => {
        this.initError("Dislike API error", error);
        return { engagement: null };
      });

      return this.setCacheValue(
        this.dislikeCache,
        v,
        result || { engagement: null },
        MAX_DISLIKE_CACHE_SIZE
      );
    });
  }

  async getCommentsSafe(v, contentlang, contentregion, headers, cacheNonce) {
    const cacheKey = this.getCommentsCacheKey(v, contentlang, contentregion);
    const cached = this.getCacheEntry(this.commentsCache, cacheKey, COMMENTS_CACHE_TTL_MS);

    if (cached.hit) {
      return cached.result;
    }

    return this.getInFlightOrCreate(this.commentsInFlight, cacheKey, async () => {
      const commentsUrl = `${this.getInvApiBase()}/comments/${encodeURIComponent(v)}?hl=${this.encodeParam(contentlang, "en-US")}&region=${this.encodeParam(contentregion, "US")}&h=${encodeURIComponent(cacheNonce)}`;

      const result = await this._fetchJson(commentsUrl, headers, {
        maxRetries: COMMENTS_RETRIES,
        timeoutMs: COMMENTS_TIMEOUT_MS,
        maxBytes: MAX_COMMENTS_BYTES
      }).catch(() => null);

      return this.setCacheValue(
        this.commentsCache,
        cacheKey,
        result,
        MAX_COMMENTS_CACHE_SIZE
      );
    });
  }

  async getColorData(v) {
    const cached = this.getCacheEntry(this.colorCache, v, COLOR_CACHE_TTL_MS);

    if (cached.hit) {
      return cached.result;
    }

    return this.getInFlightOrCreate(this.colorInFlight, v, async () => {
      const thumbnailUrl = `https://i.ytimg.com/vi/${encodeURIComponent(v)}/hqdefault.jpg?sqp=${encodeURIComponent(this.sqp)}`;

      try {
        const thumbnail = await this.requestBuffer(thumbnailUrl, {
          headers: {
            "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8"
          },
          timeoutMs: COLOR_FETCH_TIMEOUT_MS,
          maxBytes: MAX_THUMBNAIL_BYTES
        });

        if (!thumbnail.ok || !thumbnail.buffer || !thumbnail.buffer.length) {
          throw new Error(`Thumbnail HTTP Error ${thumbnail.status}`);
        }

        const palette = await this.withTimeout(
          getColors(thumbnail.buffer, "image/jpeg"),
          COLOR_EXTRACT_TIMEOUT_MS,
          "thumbnail color extraction timed out"
        );

        if (Array.isArray(palette) && palette[0] && palette[1]) {
          return this.setCacheValue(
            this.colorCache,
            v,
            {
              color: palette[0].hex(),
              color2: palette[1].hex()
            },
            MAX_COLOR_CACHE_SIZE
          );
        }

        throw new Error("Missing Palette");
      } catch (error) {
        this.initError("Thumbnail color extraction error", error);

        return this.setCacheValue(
          this.colorCache,
          v,
          DEFAULT_COLORS,
          MAX_COLOR_CACHE_SIZE
        );
      }
    });
  }

  withTimeout(promise, timeoutMs, message) {
    let timer = null;

    const timeoutPromise = new Promise((resolve, reject) => {
      timer = setTimeout(() => {
        const error = new Error(message || "Timed out");
        error.code = "POKE_TIMEOUT";
        reject(error);
      }, timeoutMs);

      if (typeof timer.unref === "function") {
        timer.unref();
      }
    });

    return Promise.race([
      Promise.resolve(promise),
      timeoutPromise
    ]).finally(() => {
      if (timer) {
        clearTimeout(timer);
      }
    });
  }

  getBlockedVideoResponse(v) {
    const cached = this.getCacheEntry(this.blockedLookupCache, v, BLOCKED_CACHE_TTL_MS);

    if (cached.hit) {
      return cached.result;
    }

    if (!this.blockedVideos.has(v)) {
      return null;
    }

    const reasonKey = this.blockedVideos.get(v);
    const response = {
      error: true,
      message: KNOWN_ERROR_MESSAGES[reasonKey] || "This video is blocked, removed, or unavailable.",
      reason: reasonKey
    };

    return this.setCacheValue(
      this.blockedLookupCache,
      v,
      response,
      MAX_BLOCKED_CACHE_SIZE
    );
  }

  refreshVideoDataInBackground(v, contentlang, contentregion) {
    const key = this.getVideoCacheKey(v);

    if (this.inFlight.has(key)) {
      return;
    }

    this.getInFlightOrCreate(this.inFlight, key, async () => {
      return this._processVideoData(v, contentlang, contentregion);
    }).catch((error) => {
      this.initError(`Background refresh failed for video ${v}`, error);
    });
  }

  async getYouTubePlayerInfo(f, v, contentlang, contentregion) {
    if (!v) {
      this.initError("Missing video ID", null);
      return {
        error: true,
        message: "No video ID provided"
      };
    }

    if (!this.isvalidvideo(v)) {
      this.initError("Invalid video ID", v);
      return {
        error: true,
        message: "Invalid video ID",
        reason: "INVALID_VIDEO_ID"
      };
    }

    const blocked = this.getBlockedVideoResponse(v);

    if (blocked) {
      return blocked;
    }

    const key = this.getVideoCacheKey(v);
    const fresh = this.getCacheEntry(this.cache, key, VIDEO_CACHE_TTL_MS);

    if (fresh.hit) {
      return fresh.result;
    }

    const stale = this.getStaleCacheEntry(this.cache, key, VIDEO_STALE_TTL_MS);

    if (stale.hit) {
      this.refreshVideoDataInBackground(v, contentlang, contentregion);
      return stale.result;
    }

    return this.getInFlightOrCreate(this.inFlight, key, async () => {
      return this._processVideoData(v, contentlang, contentregion);
    });
  }

  async _processVideoData(v, contentlang, contentregion) {
    const headers = {
      "User-Agent": this.useragent,
      "Accept": "application/json,text/plain,*/*"
    };

    const safeLang = this.encodeParam(contentlang, "en-US");
    const safeRegion = this.encodeParam(contentregion, "US");
    const cacheNonce = this.toBase64(Date.now());

    const videoUrl = `${this.getInvApiBase()}/videos/${encodeURIComponent(v)}?hl=${safeLang}&region=${safeRegion}&h=${encodeURIComponent(cacheNonce)}`;

    const commentsPromise = this.getCommentsSafe(v, contentlang, contentregion, headers, cacheNonce);
    const dislikesPromise = this.getDislikesSafe(v);
    const colorPromise = this.getColorData(v);

    try {
      const vidObj = await this._fetchVideoInfo(videoUrl, headers, v);

      const [
        commentsResult,
        dislikesResult,
        colorResult
      ] = await Promise.allSettled([
        commentsPromise,
        dislikesPromise,
        colorPromise
      ]);

      const comments = commentsResult.status === "fulfilled" ? commentsResult.value : null;
      const dislikesData = dislikesResult.status === "fulfilled" && dislikesResult.value
        ? dislikesResult.value
        : { engagement: null };
      const colorData = colorResult.status === "fulfilled" && colorResult.value
        ? colorResult.value
        : DEFAULT_COLORS;

      if (!vidObj || vidObj.error || vidObj.isInternalError) {
        const stale = this.getStaleCacheEntry(this.cache, this.getVideoCacheKey(v), VIDEO_STALE_TTL_MS);

        if (stale.hit) {
          return stale.result;
        }

        const errorMsg = vidObj && (vidObj.error || vidObj.reason)
          ? (vidObj.error || vidObj.reason)
          : "This video is probably about to premiere.";

        this.initError("Video info error", `${v} - ${errorMsg}`);

        return {
          vid: {
            error: errorMsg
          },
          comments,
          channel_uploads: " ",
          engagement: dislikesData ? dislikesData.engagement : null,
          wiki: "",
          desc: "",
          color: colorData.color,
          color2: colorData.color2
        };
      }

      const returnPayload = {
        vid: vidObj,
        comments,
        channel_uploads: " ",
        engagement: dislikesData ? dislikesData.engagement : null,
        wiki: "",
        desc: "",
        color: colorData.color,
        color2: colorData.color2
      };

      if (this.checkUnexistingObject(vidObj)) {
        this._setCache(v, returnPayload);
        return returnPayload;
      }

      this.initError(vidObj, `ID: ${v}`);

      returnPayload.vid = vidObj || {
        error: "Incomplete data returned."
      };

      return returnPayload;
    } catch (error) {
      await Promise.allSettled([
        commentsPromise,
        dislikesPromise,
        colorPromise
      ]);

      if (KNOWN_ERROR_MESSAGES[error.message]) {
        return {
          error: true,
          message: KNOWN_ERROR_MESSAGES[error.message],
          reason: error.message
        };
      }

      const stale = this.getStaleCacheEntry(this.cache, this.getVideoCacheKey(v), VIDEO_STALE_TTL_MS);

      if (stale.hit) {
        return stale.result;
      }

      this.initError(`Error getting video ${v}`, error);

      return {
        error: true,
        message: error.message || "An unexpected error occurred qwq",
        reason: "UNKNOWN_ERROR"
      };
    }
  }

  isvalidvideo(v) {
    if (v !== "assets" && v !== "cdn-cgi" && v !== "404") {
      return /^([a-zA-Z0-9_-]{11})$/.test(v);
    }

    return false;
  }

  initError(context, error) {
    const printableError = error && error.stack
      ? error.stack
      : error || "";

    console.log("[LIBPT CORE ERROR]", context, printableError);
  }
}

const pokeTubeApiCore = new InnerTubePokeVidious({
  invapi: config.invapi,
  inv_fallback: config.invapi,
  useragent: config.useragent
});

module.exports = pokeTubeApiCore;