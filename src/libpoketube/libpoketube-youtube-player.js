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
  if (timeoutId.unref) timeoutId.unref(); // Prevent timer from keeping the process alive
  return controller.signal;
};

class InnerTubePokeVidious {
  constructor(config) {
    this.config = config;
    
    this.cache = new Map();
    this.blockedVideos = new Map();

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
    try {
      if (fs.existsSync(this.blockedFile)) {
        const content = fs.readFileSync(this.blockedFile, "utf8");
        content.split("\n").forEach((line) => {
          const trimmed = line.trim();
          if (trimmed && trimmed.includes("|")) {
            const [videoId, reason] = trimmed.split("|");
            this.blockedVideos.set(videoId, reason);
          }
        });
      }
    } catch (e) {
      console.error("[LIBPT ERROR] Could not load blockedreasons.txt", e);
    }
  }

  addBlockedVideo(videoId, reason) {
    if (!this.blockedVideos.has(videoId)) {
      this.blockedVideos.set(videoId, reason);
      // Fire-and-forget async write prevents blocking the main event loop
      fs.promises.appendFile(this.blockedFile, `${videoId}|${reason}\n`)
        .catch(e => console.error("[LIBPT ERROR] Could not write to blockedreasons.txt", e));
    }
  }

  getJson(str) {
    if (!str) return null; // Fast path out
    try {
      return JSON.parse(str);
    } catch {
      return null;
    }
  }

  checkUnexistingObject(obj) {
    return obj && "authorId" in obj;
  }

  toBase64(str) {
    if (typeof btoa !== "undefined") return btoa(str);
    return Buffer.from(String(str)).toString("base64");
  }

  extractColorsBackground(v) {
    getColors(`https://i.ytimg.com/vi/${v}/hqdefault.jpg?sqp=${this.sqp}`)
      .then((palette) => {
        if (Array.isArray(palette) && palette.length >= 2) {
          const cachedItem = this.cache.get(v);
          if (cachedItem && cachedItem.result) {
            cachedItem.result.color = palette[0].hex();
            cachedItem.result.color2 = palette[1].hex();
          }
        }
      })
      .catch(() => {
        // Silently drop image extraction errors without crashing
      });
  }

  async fetchTextWithRetry(url, options = {}, maxRetries = 2, videoId) {
    const isTrigger = (s) => (s === 500 || s === 502 || s === 503 || s === 504 || s === 429);
    const fetchFn = typeof globalThis.fetch === "function" ? globalThis.fetch : await getFetch();

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const signal = getTimeoutSignal(3500);
        const res = await fetchFn(url, { ...options, signal });
        const text = await res.text();

        if (res.ok) return text;

        // Verify unrecoverable API-side blocks directly from text 
        // to save massive overhead avoiding Response.clone()
        if (res.status === 500 || res.status === 404) {
          if (res.status === 500) {
            if (text.includes("who has blocked it on copyright grounds")) {
              this.addBlockedVideo(videoId, "COPYRIGHT_BLOCKED");
              throw new Error("COPYRIGHT_BLOCKED");
            }
            if (text.includes("This video has been removed by the uploader")) {
              this.addBlockedVideo(videoId, "UPLOADER_REMOVED");
              throw new Error("UPLOADER_REMOVED");
            }
            if (text.includes("This video may be inappropriate for some users")) {
              this.addBlockedVideo(videoId, "INAPPROPRIATE");
              throw new Error("INAPPROPRIATE");
            }
          }
          if (res.status === 404 && text.includes("Video unavailable")) {
            this.addBlockedVideo(videoId, "VIDEO_UNAVAILABLE");
            throw new Error("VIDEO_UNAVAILABLE");
          }
        }

        if (!isTrigger(res.status) || attempt === maxRetries) return text;
        
      } catch (err) {
        if (this.KNOWN_ERRORS[err.message]) throw err;
        if (attempt === maxRetries) throw err;
      }

      // Extremely fast linear backoff loop
      await new Promise((r) => setTimeout(r, 150 * (attempt + 1)));
    }
  }

  async getYouTubePlayerInfo(f, v, contentlang, contentregion) {
    if (!v) {
      this.initError("Missing video ID", null);
      return { error: true, message: "No video ID provided" };
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

    // Fast O(1) Check for cached data
    const cachedItem = this.cache.get(v);
    if (cachedItem && Date.now() - cachedItem.timestamp < 3600000) {
      return cachedItem.result;
    }

    const headers = { "User-Agent": this.useragent };
    
    // Convert to Base36 to generate a much shorter string before encoding it. Done only ONCE.
    const cacheBuster = this.toBase64(Date.now().toString(36)); 
    
    const videoUrl = `${this.config.invapi}/videos/${v}?hl=${contentlang}&region=${contentregion}&h=${cacheBuster}`;
    const commentsUrl = `${this.config.invapi}/comments/${v}?hl=${contentlang}&region=${contentregion}&h=${cacheBuster}`;

    try {
      // Execute blazing fast network fetches in parallel
      const [invCommentsText, vidObjRaw, dislikesData] = await Promise.all([
        // 1. Comments
        this.fetchTextWithRetry(commentsUrl, { headers }, 2, v).catch(() => null),

        // 2. Video Info
        (async () => {
          try {
            const text = await this.fetchTextWithRetry(videoUrl, { headers }, 2, v);
            if (!text) return null;
            const parsed = this.getJson(text);
            
            if (parsed && (this.checkUnexistingObject(parsed) || parsed.error)) {
              return parsed;
            }
            return null;
          } catch (err) {
            if (this.KNOWN_ERRORS[err.message]) throw err;
            return { isInternalError: true, reason: err.message };
          }
        })(),

        // 3. Dislikes
        getdislikes(v).catch(() => ({ engagement: null }))
      ]);

      const comments = this.getJson(invCommentsText);
      const vid = vidObjRaw;

      // Spawn extractors blindly in the background
      this.extractColorsBackground(v);

      // Default safe colors
      const defaultColor = "#0ea5e9";
      const defaultColor2 = "#111827";

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

        this.cache.set(v, {
          result: payload,
          timestamp: Date.now(),
        });

        // O(1) map eviction (Map.keys() returns in insertion order, so the first is the oldest)
        if (this.cache.size > 200) {
          const oldestKey = this.cache.keys().next().value;
          this.cache.delete(oldestKey);
        }

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
    if (v === "assets" || v === "cdn-cgi" || v === "404") return false;
    // Removed capture groups () as it is an unnecessary extraction slowing the regex engine
    return /^[a-zA-Z0-9_-]{11}$/.test(v);
  }

  initError(context, error) {
    if (error && (error.code === 'UND_ERR_CONNECT_TIMEOUT' || error.code === 'ECONNRESET' || error.name === 'AbortError')) return;
    console.log("[LIBPT CORE ERROR]", context, error?.stack || error || "");
  }
}

const pokeTubeApiCore = new InnerTubePokeVidious({
  invapi: config.invapi,
  inv_fallback: config.invapi,
  useragent: config.useragent,
});

module.exports = pokeTubeApiCore;
