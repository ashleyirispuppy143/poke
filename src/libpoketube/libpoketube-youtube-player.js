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

let fetchPromise = null;
const getFetch = () => {
  if (typeof globalThis.fetch === "function") return globalThis.fetch;
  if (!fetchPromise) fetchPromise = import("undici").then((mod) => mod.fetch);
  return fetchPromise;
};

const getTimeoutSignal = (ms) => {
  if (typeof AbortSignal.timeout === "function") {
    return AbortSignal.timeout(ms);
  }
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ms);
  if (timeoutId.unref) timeoutId.unref();
  return controller.signal;
};

class LRUCache {
  constructor(maxSize = 500) {
    this.maxSize = maxSize;
    this.cache = new Map();
    this.timestamps = new Map();
    this.accessCounts = new Map();
    this.ttl = 3600000;
  }

  set(key, value) {
    if (this.cache.has(key)) this.cache.delete(key);

    this.cache.set(key, value);
    this.timestamps.set(key, Date.now());
    this.accessCounts.set(key, 0);

    if (this.cache.size > this.maxSize) {
      let minAccess = Infinity;
      let lruKey = null;

      for (const [k, count] of this.accessCounts.entries()) {
        const age = Date.now() - this.timestamps.get(k);
        const score = count / (age / 1000 + 1);

        if (score < minAccess) {
          minAccess = score;
          lruKey = k;
        }
      }

      if (lruKey) {
        this.cache.delete(lruKey);
        this.timestamps.delete(lruKey);
        this.accessCounts.delete(lruKey);
      }
    }
  }

  get(key) {
    if (!this.cache.has(key)) return null;

    if (Date.now() - this.timestamps.get(key) > this.ttl) {
      this.cache.delete(key);
      this.timestamps.delete(key);
      this.accessCounts.delete(key);
      return null;
    }

    this.accessCounts.set(key, (this.accessCounts.get(key) || 0) + 1);
    return this.cache.get(key);
  }

  has(key) {
    if (!this.cache.has(key)) return false;
    if (Date.now() - this.timestamps.get(key) > this.ttl) {
      this.cache.delete(key);
      this.timestamps.delete(key);
      this.accessCounts.delete(key);
      return false;
    }
    return true;
  }

  clear() {
    this.cache.clear();
    this.timestamps.clear();
    this.accessCounts.clear();
  }

  size() {
    return this.cache.size;
  }
}

class InnerTubePokeVidious {
  constructor(config) {
    this.config = config;

    this.cache = new LRUCache(500);
    this.colorCache = new Map();
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
    this.sqp = "-oaymwEbCKgBEF5IVfKriqkDDggBFQAAiEIYAXABwAEG&rs=AOn4CLBy_x4UUHLNDZtJtH0PXeQGoRFTgw";
    this.blockedFile = "blockedreasons.txt";

    this.KNOWN_ERRORS = {
      "COPYRIGHT_BLOCKED": "This video contains content from a copyright holder who has blocked it.",
      "UPLOADER_REMOVED": "This video has been removed by the uploader.",
      "VIDEO_UNAVAILABLE": "Video unavailable.",
      "INAPPROPRIATE": "This video may be inappropriate for some users.",
      "GEO_BLOCKED": "The uploader has not made this video available in your country."
    };

    this.pendingRequests = new Map();

    this.loadBlockedVideos();
  }

  loadBlockedVideos() {
    if (this.blockPromise) return this.blockPromise;

    this.blockPromise = (async () => {
      try {
        if (fs.existsSync(this.blockedFile)) {
          const content = await fs.promises.readFile(this.blockedFile, "utf8");
          content.split("\n").forEach((line) => {
            const trimmed = line.trim();
            if (trimmed && trimmed.includes("|")) {
              const [videoId, reason] = trimmed.split("|", 2);
              this.blockedVideos.set(videoId.trim(), reason.trim());
            }
          });
        }
      } catch (e) {
        console.error("[LIBPT ERROR] Could not load blockedreasons.txt", e);
      }
    })();

    return this.blockPromise;
  }

  addBlockedVideo(videoId, reason) {
    if (!videoId || !reason) return;

    if (!this.blockedVideos.has(videoId)) {
      this.blockedVideos.set(videoId, reason);
      fs.promises.appendFile(this.blockedFile, `${videoId}|${reason}\n`)
        .catch(e => console.error("[LIBPT ERROR] Could not write to blockedreasons.txt", e));
    }
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
    if (lowerText.includes("copyright") || lowerText.includes("blocked")) return "COPYRIGHT_BLOCKED";
    if (lowerText.includes("removed by the uploader")) return "UPLOADER_REMOVED";
    if (lowerText.includes("inappropriate")) return "INAPPROPRIATE";
    if (lowerText.includes("unavailable")) return "VIDEO_UNAVAILABLE";

    return null;
  }

  async fetchColorsWithFallback(v) {
    if (this.colorCache.has(v)) return this.colorCache.get(v);

    const urls = [
      `https://i.ytimg.com/vi/${v}/maxresdefault.jpg?sqp=${this.sqp}`,
      `https://i.ytimg.com/vi/${v}/sddefault.jpg?sqp=${this.sqp}`,
      `https://i.ytimg.com/vi/${v}/hqdefault.jpg?sqp=${this.sqp}`,
    ];

    const fetchFn = typeof globalThis.fetch === "function" ? globalThis.fetch : await getFetch();

    for (const url of urls) {
      try {
        // Fast-fail: Check if the image exists using a lightweight HEAD request
        const headRes = await fetchFn(url, { method: 'HEAD', signal: getTimeoutSignal(1500) });
        if (!headRes.ok) continue;

        // If it exists, extract colors
        const palette = await getColors(url);
        if (Array.isArray(palette) && palette.length >= 2) {
          const result = { color: palette[0].hex(), color2: palette[1].hex() };
          this.colorCache.set(v, result);
          return result;
        }
      } catch (e) {
        // Ignore and move to next URL
      }
    }

    return { color: "#0ea5e9", color2: "#111827" }; // Default fallback
  }

  extractColorsBackground(v) {
    if (this.colorCache.has(v)) return;

    this.fetchColorsWithFallback(v)
      .then(colors => {
        const cached = this.cache.get(v);
        if (cached) {
          cached.color = colors.color;
          cached.color2 = colors.color2;
        }
      })
      .catch(() => {});
  }

  async fetchTextWithRetry(url, options = {}, maxRetries = 2, videoId) {
    const isTrigger = (s) => (s >= 500 && s < 600) || s === 429;
    const fetchFn = typeof globalThis.fetch === "function" ? globalThis.fetch : await getFetch();
    let lastError = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const signal = getTimeoutSignal(2500);
        const res = await fetchFn(url, { ...options, signal });
        const text = await res.text();

        if (res.ok) return text;

        if (text.length < 10000) {
          const reason = this.detectKnownError(text);
          if (reason) {
            this.addBlockedVideo(videoId, reason);
            throw new Error(reason);
          }
        }

        if (!isTrigger(res.status) || attempt === maxRetries) return text;
      } catch (err) {
        if (this.KNOWN_ERRORS[err.message]) throw err;
        if (attempt === maxRetries) throw err;
        lastError = err;
      }

      await new Promise((r) => setTimeout(r, 50 * (attempt + 1)));
    }

    throw lastError || new Error("Fetch failed after retries");
  }

  isvalidvideo(v) {
    return !INVALID_ROUTES.has(v) && VIDEO_ID_REGEX.test(v);
  }

  initError(context, error) {
    if (error && (error.code === 'UND_ERR_CONNECT_TIMEOUT' || error.code === 'ECONNRESET' || error.name === 'AbortError')) return;
    console.log("[LIBPT CORE ERROR]", context, error?.stack || error || "");
  }

  async getYouTubePlayerInfo(f, v, contentlang, contentregion) {
    if (!v) {
      this.initError("Missing video ID", null);
      return { error: true, message: "No video ID provided" };
    }

    if (!this.isvalidvideo(v)) return { error: true, message: "Invalid video ID format" };

    const cacheKey = `${v}-${contentlang}-${contentregion}`;
    if (this.pendingRequests.has(cacheKey)) return this.pendingRequests.get(cacheKey);

    if (this.blockedVideos.has(v)) {
      const reasonKey = this.blockedVideos.get(v);
      return { error: true, message: this.KNOWN_ERRORS[reasonKey] || "This video is blocked, removed, or unavailable.", reason: reasonKey };
    }

    const cached = this.cache.get(cacheKey);
    if (cached) {
      this.extractColorsBackground(v);
      return cached;
    }

    const promise = this._fetchVideoData(v, contentlang, contentregion, cacheKey);
    this.pendingRequests.set(cacheKey, promise);

    promise.finally(() => this.pendingRequests.delete(cacheKey));
    return promise;
  }

  async _fetchVideoData(v, contentlang, contentregion, cacheKey) {
    const headers = { "User-Agent": this.useragent };
    const cacheBuster = this.toBase64(Date.now().toString(36));

    const videoUrl = `${this.config.invapi}/videos/${v}?hl=${contentlang}&region=${contentregion}&h=${cacheBuster}`;
    const commentsUrl = `${this.config.invapi}/comments/${v}?hl=${contentlang}&region=${contentregion}&h=${cacheBuster}`;

    try {
      // Fire off background tasks concurrently to optimize speed
      const commentsPromise = this.fetchTextWithRetry(commentsUrl, { headers }, 2, v).catch(() => null);
      const dislikesPromise = getdislikes(v).catch(() => ({ engagement: null }));
      const colorsPromise = this.fetchColorsWithFallback(v).catch(() => ({ color: "#0ea5e9", color2: "#111827" }));

      // Helper to fetch and parse the video
      const attemptVideoFetch = async () => {
        const raw = await this.fetchTextWithRetry(videoUrl, { headers }, 2, v);
        const parsed = this.getJson(raw);
        let errorMsg = null;
        if (!parsed || parsed.error || parsed.isInternalError) {
            errorMsg = parsed?.error || parsed?.reason || "This video is probably about to premiere.";
        }
        return { raw, parsed, errorMsg };
      };

      let vData = await attemptVideoFetch();

      // Premiere Logic: Check and Retry exactly once
      const isPremiereError = (msg) => msg && (msg === "This video is probably about to premiere." || msg.toLowerCase().includes("premiere"));

      if (isPremiereError(vData.errorMsg)) {
        await new Promise(r => setTimeout(r, 300)); // Brief pause before retry to let backend update
        vData = await attemptVideoFetch(); // Retry exactly once
        
        if (isPremiereError(vData.errorMsg)) {
           return {
              error: true,
              message: "Could not fetch: This video is probably about to premiere.",
              reason: "PREMIERE"
           };
        }
      }

      // Await parallel background fetching promises now that the core video fetch check is done
      const [invCommentsText, dislikesData, colors] = await Promise.all([commentsPromise, dislikesPromise, colorsPromise]);

      const comments = this.getJson(invCommentsText);
      const vid = vData.parsed;

      // Handle standard video errors
      if (vData.errorMsg) {
        const reason = this.detectKnownError(vData.errorMsg);
        if (reason) {
          this.addBlockedVideo(v, reason);
          return { error: true, message: this.KNOWN_ERRORS[reason], reason };
        }

        this.initError("Video info fetch error", `${v} - ${vData.errorMsg}`);

        return {
          vid: { error: vData.errorMsg },
          comments,
          channel_uploads: " ",
          engagement: dislikesData?.engagement || null,
          wiki: "",
          desc: "",
          color: colors.color,
          color2: colors.color2,
        };
      }

      if (this.checkUnexistingObject(vid)) {
        const payload = {
          vid,
          comments,
          channel_uploads: " ",
          engagement: dislikesData?.engagement || null,
          wiki: "",
          desc: "",
          color: colors.color,
          color2: colors.color2,
        };

        this.cache.set(cacheKey, payload);
        this.colorCache.set(v, { color: colors.color, color2: colors.color2 });
        return payload;
      } else {
        this.initError(vid, `ID: ${v}`);
        return {
          vid: vid || { error: "Incomplete data returned." },
          comments,
          channel_uploads: " ",
          engagement: dislikesData?.engagement || null,
          wiki: "",
          desc: "",
          color: colors.color,
          color2: colors.color2,
        };
      }
    } catch (error) {
      if (this.KNOWN_ERRORS[error.message]) {
        return { error: true, message: this.KNOWN_ERRORS[error.message], reason: error.message };
      }

      this.initError(`Error getting video ${v}`, error);
      return { error: true, message: error.message || "An unexpected error occurred qwq", reason: "UNKNOWN_ERROR" };
    }
  }
}

const pokeTubeApiCore = new InnerTubePokeVidious({
  invapi: config.invapi,
  inv_fallback: config.invapi,
  useragent: config.useragent,
});

module.exports = pokeTubeApiCore;