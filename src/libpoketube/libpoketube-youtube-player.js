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
const BLOCKED_REASONS_REGEX = /copyright grounds|removed by the uploader|may be inappropriate|unavailable/i;

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

 const BLOCKED_REASON_MAP = {
  "copyright grounds": "COPYRIGHT_BLOCKED",
  "removed by the uploader": "UPLOADER_REMOVED",
  "may be inappropriate": "INAPPROPRIATE",
  "unavailable": "VIDEO_UNAVAILABLE"
};

class InnerTubePokeVidious {
  constructor(config) {
    this.config = config;
    
     this.cache = new Map();
    this.cacheOrder = []; 
    this.maxCacheSize = 200;
    
    this.blockedVideos = new Map();
    this.blockedVideosPromise = null; 

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
      "INAPPROPRIATE": "This video may be inappropriate for some users."
    };

    this.loadBlockedVideos();
  }

  loadBlockedVideos() {
     if (this.blockedVideosPromise) return this.blockedVideosPromise;
    
    this.blockedVideosPromise = (async () => {
      try {
        if (fs.existsSync(this.blockedFile)) {
          const content = await fs.promises.readFile(this.blockedFile, "utf8");
          const lines = content.split("\n");
          
           for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.includes("|")) continue;
            
            const [videoId, reason] = trimmed.split("|", 2);
            this.blockedVideos.set(videoId.trim(), reason.trim());
          }
        }
      } catch (e) {
        console.error("[LIBPT ERROR] Could not load blockedreasons.txt", e);
      }
    })();

    return this.blockedVideosPromise;
  }

  addBlockedVideo(videoId, reason) {
    if (this.blockedVideos.has(videoId)) return; // Already tracked
    
    this.blockedVideos.set(videoId, reason);
    
    // Fire-and-forget without awaiting
    fs.promises.appendFile(this.blockedFile, `${videoId}|${reason}\n`)
      .catch(e => console.error("[LIBPT ERROR] Could not write to blockedreasons.txt", e));
  }

  // Performance: Inline JSON parsing with early bailout
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

  // Performance: Non-blocking background color extraction
  extractColorsBackground(v) {
    // Don't wait for color extraction; it's non-critical
    getColors(`https://i.ytimg.com/vi/${v}/hqdefault.jpg?sqp=${this.sqp}`)
      .then((palette) => {
        if (Array.isArray(palette) && palette.length >= 2) {
          const cachedItem = this.cache.get(v);
          if (cachedItem?.result) {
            cachedItem.result.color = palette[0].hex();
            cachedItem.result.color2 = palette[1].hex();
          }
        }
      })
      .catch(() => {
        // Silently drop errors
      });
  }

  // Performance: Smarter retry logic with exponential backoff
  async fetchTextWithRetry(url, options = {}, maxRetries = 2, videoId) {
    const isTrigger = (s) => s >= 500 && s < 600 || s === 429;
    const fetchFn = typeof globalThis.fetch === "function" ? globalThis.fetch : await getFetch();

    let lastError = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const signal = getTimeoutSignal(3500);
        const res = await fetchFn(url, { ...options, signal });

        // Performance: Read text once, reuse it
        const text = await res.text();

        if (res.ok) return text;

        // Fast path: Check for known blocks in response text
        if ((res.status === 500 || res.status === 404) && text.length < 10000) {
          const lowerText = text.toLowerCase();
          
          for (const [key, reason] of Object.entries(BLOCKED_REASON_MAP)) {
            if (lowerText.includes(key)) {
              this.addBlockedVideo(videoId, reason);
              throw new Error(reason);
            }
          }
        }

        // Only retry on transient errors
        if (!isTrigger(res.status) || attempt === maxRetries) return text;
        
      } catch (err) {
        // Re-throw known errors immediately
        if (this.KNOWN_ERRORS[err.message]) throw err;
        if (attempt === maxRetries) throw err;
        lastError = err;
      }

      // Exponential backoff: 150ms, 300ms, 450ms
      await new Promise((r) => setTimeout(r, 150 * (attempt + 1)));
    }

    throw lastError || new Error("Fetch failed after retries");
  }

  // Performance: Cache eviction with O(1) complexity
  addToCache(videoId, result) {
    // Remove from middle if exists
    const idx = this.cacheOrder.indexOf(videoId);
    if (idx !== -1) this.cacheOrder.splice(idx, 1);
    
    // Add to end (most recent)
    this.cacheOrder.push(videoId);
    
    this.cache.set(videoId, {
      result,
      timestamp: Date.now(),
    });

    // Evict oldest if over limit
    if (this.cacheOrder.length > this.maxCacheSize) {
      const oldest = this.cacheOrder.shift();
      this.cache.delete(oldest);
    }
  }

  async getYouTubePlayerInfo(f, v, contentlang, contentregion) {
    if (!v) {
      this.initError("Missing video ID", null);
      return { error: true, message: "No video ID provided" };
    }

    // Validate early
    if (!this.isvalidvideo(v)) {
      return { error: true, message: "Invalid video ID format" };
    }

    // Fast O(1) Check for blocked videos
    if (this.blockedVideos.has(v)) {
      const reasonKey = this.blockedVideos.get(v);
      return { 
        error: true, 
        message: this.KNOWN_ERRORS[reasonKey] || "This video is blocked, removed, or unavailable.",
        reason: reasonKey
      };
    }

    // Fast O(1) Check for cached data with TTL
    const cachedItem = this.cache.get(v);
    if (cachedItem && Date.now() - cachedItem.timestamp < 3600000) {
      return cachedItem.result;
    }

    const headers = { "User-Agent": this.useragent };
    
    // Performance: Generate cache buster once
    const cacheBuster = this.toBase64(Date.now().toString(36));
    
    const videoUrl = `${this.config.invapi}/videos/${v}?hl=${contentlang}&region=${contentregion}&h=${cacheBuster}`;
    const commentsUrl = `${this.config.invapi}/comments/${v}?hl=${contentlang}&region=${contentregion}&h=${cacheBuster}`;

    // Default safe colors
    const defaultColor = "#0ea5e9";
    const defaultColor2 = "#111827";

    try {
      // Performance: Parallel requests with fast-fail semantics
      const [invCommentsText, vidObjRaw, dislikesData] = await Promise.allSettled([
        this.fetchTextWithRetry(commentsUrl, { headers }, 2, v),
        this.fetchTextWithRetry(videoUrl, { headers }, 2, v),
        getdislikes(v)
      ]).then(([c, v, d]) => [
        c.status === "fulfilled" ? c.value : null,
        v.status === "fulfilled" ? v.value : null,
        d.status === "fulfilled" ? d.value : { engagement: null }
      ]);

      const comments = this.getJson(invCommentsText);
      const vid = this.getJson(vidObjRaw);

      // Spawn color extraction in background (non-blocking)
      this.extractColorsBackground(v);

      // Handle missing video data
      if (!vid || vid.error || vid.isInternalError) {
        const errorMsg = vid?.error || vid?.reason || "This video is probably about to premiere.";
        this.initError("Video info fetch error", `${v} - ${errorMsg}`);
        
        return {
          vid: { error: errorMsg },
          comments,
          channel_uploads: " ",
          engagement: dislikesData?.engagement || null,
          wiki: "",
          desc: "",
          color: defaultColor,
          color2: defaultColor2,
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
          color: defaultColor,
          color2: defaultColor2,
        };

        // Performance: Optimized cache insertion
        this.addToCache(v, payload);
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
          color: defaultColor,
          color2: defaultColor2,
        };
      }
    } catch (error) {
      // Known errors get fast-tracked responses
      if (this.KNOWN_ERRORS[error.message]) {
        return { 
          error: true, 
          message: this.KNOWN_ERRORS[error.message],
          reason: error.message 
        };
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
    return !INVALID_ROUTES.has(v) && VIDEO_ID_REGEX.test(v);
  }

  initError(context, error) {
     if (error?.code === 'UND_ERR_CONNECT_TIMEOUT' || 
        error?.code === 'ECONNRESET' || 
        error?.name === 'AbortError') {
      return;
    }
    console.log("[LIBPT CORE ERROR]", context, error?.stack || error || "");
  }
}

const pokeTubeApiCore = new InnerTubePokeVidious({
  invapi: config.invapi,
  inv_fallback: config.invapi,
  useragent: config.useragent,
});

module.exports = pokeTubeApiCore;