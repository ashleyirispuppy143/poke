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

class TurboCacheSystem {
  constructor(maxSize = 500) {
    this.data = new Map();
    this.timestamps = new Map();
    this.accessCount = new Map();
    this.maxSize = maxSize;
    this.ttl = 3600000;
  }

  get(key) {
    if (!this.data.has(key)) return null;
    
    const now = Date.now();
    if (now - this.timestamps.get(key) > this.ttl) {
      this.data.delete(key);
      this.timestamps.delete(key);
      this.accessCount.delete(key);
      return null;
    }

    this.accessCount.set(key, (this.accessCount.get(key) || 0) + 1);
    return this.data.get(key);
  }

  set(key, value) {
    if (this.data.size >= this.maxSize) {
      let minAccess = Infinity;
      let lruKey = null;

      for (const [k, count] of this.accessCount.entries()) {
        if (count < minAccess) {
          minAccess = count;
          lruKey = k;
        }
      }

      if (lruKey) {
        this.data.delete(lruKey);
        this.timestamps.delete(lruKey);
        this.accessCount.delete(lruKey);
      }
    }

    this.data.set(key, value);
    this.timestamps.set(key, Date.now());
    this.accessCount.set(key, 1);
  }

  clear() {
    this.data.clear();
    this.timestamps.clear();
    this.accessCount.clear();
  }

  size() {
    return this.data.size;
  }
}

class TurboColorCache {
  constructor() {
    this.colors = new Map();
    this.pending = new Map();
  }

  getSync(videoId) {
    return this.colors.get(videoId) || null;
  }

  async getAsync(videoId) {
    if (this.colors.has(videoId)) {
      return this.colors.get(videoId);
    }

    if (this.pending.has(videoId)) {
      return this.pending.get(videoId);
    }

    const promise = this.fetchColors(videoId);
    this.pending.set(videoId, promise);

    try {
      const colors = await promise;
      this.colors.set(videoId, colors);
      this.pending.delete(videoId);
      return colors;
    } catch (e) {
      this.pending.delete(videoId);
      return null;
    }
  }

  async fetchColors(videoId) {
    try {
      const palette = await getColors(
        `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`
      ).catch(() => 
        getColors(`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`)
      );

      if (Array.isArray(palette) && palette.length >= 2) {
        return {
          color: palette[0].hex(),
          color2: palette[1].hex()
        };
      }
      return null;
    } catch (e) {
      return null;
    }
  }
}

class InnerTubePokeVidious {
  constructor(config) {
    this.config = config;
    
    this.cache = new TurboCacheSystem(500);
    this.colorCache = new TurboColorCache();
    this.blockedVideos = new Map();
    this.blockedVideosLoaded = false;

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
    if (this.blockedVideosLoaded) return;
    
    fs.readFile(this.blockedFile, "utf8", (err, content) => {
      if (err) return;
      
      const lines = content.split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.includes("|")) continue;
        
        const [videoId, reason] = trimmed.split("|", 2);
        this.blockedVideos.set(videoId.trim(), reason.trim());
      }
      
      this.blockedVideosLoaded = true;
    });
  }

  addBlockedVideo(videoId, reason) {
    if (this.blockedVideos.has(videoId)) return;
    
    this.blockedVideos.set(videoId, reason);
    fs.appendFile(this.blockedFile, `${videoId}|${reason}\n`, () => {});
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

  async fetchTextWithRetry(url, options = {}, maxRetries = 1, videoId) {
    const fetchFn = typeof globalThis.fetch === "function" ? globalThis.fetch : await getFetch();

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const signal = getTimeoutSignal(2800);
        const res = await fetchFn(url, { ...options, signal });
        const text = await res.text();

        if (res.ok) return text;

        if ((res.status === 500 || res.status === 404) && text.length < 10000) {
          const lower = text.toLowerCase();
          
          if (lower.includes("copyright") && lower.includes("blocked")) {
            this.addBlockedVideo(videoId, "COPYRIGHT_BLOCKED");
            throw new Error("COPYRIGHT_BLOCKED");
          }
          if (lower.includes("removed by the uploader")) {
            this.addBlockedVideo(videoId, "UPLOADER_REMOVED");
            throw new Error("UPLOADER_REMOVED");
          }
          if (lower.includes("inappropriate")) {
            this.addBlockedVideo(videoId, "INAPPROPRIATE");
            throw new Error("INAPPROPRIATE");
          }
          if (lower.includes("unavailable")) {
            this.addBlockedVideo(videoId, "VIDEO_UNAVAILABLE");
            throw new Error("VIDEO_UNAVAILABLE");
          }
        }

        if (res.status < 500 && res.status !== 429) return text;
        
      } catch (err) {
        if (this.KNOWN_ERRORS[err.message]) throw err;
        if (attempt === maxRetries) throw err;
      }

      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 100 * (attempt + 1)));
      }
    }
  }

  async getYouTubePlayerInfo(f, v, contentlang, contentregion) {
    if (!v || !VIDEO_ID_REGEX.test(v) || INVALID_ROUTES.has(v)) {
      return { error: true, message: "Invalid video ID" };
    }

    if (this.blockedVideos.has(v)) {
      const reasonKey = this.blockedVideos.get(v);
      return { 
        error: true, 
        message: this.KNOWN_ERRORS[reasonKey] || "Video blocked/removed/unavailable",
        reason: reasonKey
      };
    }

    const cached = this.cache.get(v);
    if (cached) return cached;

    const headers = { "User-Agent": this.useragent };
    const cacheBuster = this.toBase64(Date.now().toString(36));
    
    const videoUrl = `${this.config.invapi}/videos/${v}?hl=${contentlang}&region=${contentregion}&h=${cacheBuster}`;
    const commentsUrl = `${this.config.invapi}/comments/${v}?hl=${contentlang}&region=${contentregion}&h=${cacheBuster}`;

    const defaultColor = "#0ea5e9";
    const defaultColor2 = "#111827";

    try {
      const colorPromise = this.colorCache.getAsync(v);

      const [c, vid, dislikesData, colors] = await Promise.all([
        this.fetchTextWithRetry(commentsUrl, { headers }, 1, v).catch(() => null),
        this.fetchTextWithRetry(videoUrl, { headers }, 1, v).catch(() => null),
        getdislikes(v).catch(() => ({ engagement: null })),
        colorPromise
      ]);

      const comments = this.getJson(c);
      const videoData = this.getJson(vid);

      if (!videoData || videoData.error || videoData.isInternalError) {
        const errorMsg = videoData?.error || videoData?.reason || "Premiere pending";
        this.initError("Video fetch error", `${v} - ${errorMsg}`);
        
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

      if (this.checkUnexistingObject(videoData)) {
        const payload = {
          vid: videoData,
          comments,
          channel_uploads: " ",
          engagement: dislikesData?.engagement || null,
          wiki: "",
          desc: "",
          color: colors?.color || defaultColor,
          color2: colors?.color2 || defaultColor2,
        };

        this.cache.set(v, payload);
        return payload;
      } else {
        this.initError(videoData, `ID: ${v}`);
        return {
          vid: videoData || { error: "Incomplete data" },
          comments,
          channel_uploads: " ",
          engagement: dislikesData?.engagement || null,
          wiki: "",
          desc: "",
          color: colors?.color || defaultColor,
          color2: colors?.color2 || defaultColor2,
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
        message: error.message || "Unexpected error",
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
    console.log("[LIBPT ERROR]", context, error?.stack || error || "");
  }
}

const pokeTubeApiCore = new InnerTubePokeVidious({
  invapi: config.invapi,
  inv_fallback: config.invapi,
  useragent: config.useragent,
});

module.exports = pokeTubeApiCore;