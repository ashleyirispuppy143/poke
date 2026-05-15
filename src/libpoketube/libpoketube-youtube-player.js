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
    
    this.cache = new Map();
    this.inFlight = new Map();
    this.MAX_CACHE_SIZE = 2000;

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
    
    this._fetchFn = null; 

    this.loadBlockedVideos();
  }

  async getFetch() {
    if (this._fetchFn) return this._fetchFn;
    if (globalThis.fetch) {
      this._fetchFn = globalThis.fetch;
    } else {
      const { fetch } = await import("undici");
      this._fetchFn = fetch;
    }
    return this._fetchFn;
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
      fs.appendFile(this.blockedFile, `${videoId}|${reason}\n`, (err) => {
        if (err) console.error("[LIBPT ERROR] Could not write to blockedreasons.txt", err);
      });
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
    return obj && "authorId" in obj;
  }

  toBase64(str) {
    return Buffer.from(String(str)).toString("base64");
  }

  _setCache(v, dataObj) {
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(v, { result: dataObj, timestamp: Date.now() });
  }

  async _fetchWithRetry(url, options = {}, maxRetries = 2, timeoutMs = 2000) {
    const fetchFn = await this.getFetch();
    const RETRYABLE = new Set([429, 500, 502, 503, 504]);
    let delayMs = 250;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(new Error("Fetch attempt timed out")), timeoutMs);

      try {
        const res = await fetchFn(url, { ...options, signal: controller.signal });
        clearTimeout(timer);

        if (res.ok) return res;

        if (res.status === 500 || res.status === 404) {
          const text = await res.clone().text().catch(() => "");
          if (res.status === 500 && text.includes("who has blocked it on copyright grounds")) throw new Error("COPYRIGHT_BLOCKED");
          if (res.status === 500 && text.includes("This video has been removed by the uploader")) throw new Error("UPLOADER_REMOVED");
          if (res.status === 500 && text.includes("This video may be inappropriate for some users")) throw new Error("INAPPROPRIATE");
          if (res.status === 404 && text.includes("Video unavailable")) throw new Error("VIDEO_UNAVAILABLE");
        }

        if (!RETRYABLE.has(res.status) || attempt === maxRetries) {
          return res; 
        }

      } catch (err) {
        clearTimeout(timer);
        if (["COPYRIGHT_BLOCKED", "UPLOADER_REMOVED", "VIDEO_UNAVAILABLE", "INAPPROPRIATE"].includes(err.message)) {
          throw err;
        }
        if (attempt === maxRetries) throw err;
      }

      await new Promise((r) => setTimeout(r, delayMs));
      delayMs = Math.min(1000, delayMs * 1.5); 
    }
  }

  async _fetchVideoInfo(url, headers, v) {
    try {
      const r = await this._fetchWithRetry(url, { headers }, 2, 2000); // Strict 3 tries total (0, 1, 2)
      if (!r.ok) throw new Error(`HTTP Error ${r.status}`);

      const text = await r.text();
      const parsed = this.getJson(text);

      if (parsed === null) return null;
      if (this.checkUnexistingObject(parsed) || parsed.error) return parsed;
      
      return null;
    } catch (err) {
      if (["COPYRIGHT_BLOCKED", "UPLOADER_REMOVED", "VIDEO_UNAVAILABLE", "INAPPROPRIATE"].includes(err.message)) {
        this.addBlockedVideo(v, err.message);
        throw err;
      }
      this.initError("Video info fetch failed", err);
      return { isInternalError: true, reason: err.message || err.toString() };
    }
  }

  async getYouTubePlayerInfo(f, v, contentlang, contentregion) {
    if (!v) {
      this.initError("Missing video ID", null);
      return { error: true, message: "No video ID provided" };
    }

    const knownErrors = {
      "COPYRIGHT_BLOCKED": "This video contains content from a copyright holder who has blocked it.",
      "UPLOADER_REMOVED": "This video has been removed by the uploader.",
      "VIDEO_UNAVAILABLE": "Video unavailable.",
      "INAPPROPRIATE": "This video may be inappropriate for some users."
    };

    if (this.blockedVideos.has(v)) {
      const reasonKey = this.blockedVideos.get(v);
      return { 
        error: true, 
        message: knownErrors[reasonKey] || "This video is blocked, removed, or unavailable.",
        reason: reasonKey
      };
    }

    const cached = this.cache.get(v);
    if (cached && Date.now() - cached.timestamp < 3600000) {
      return cached.result;
    }

    // Request coalescing: Prevent multiple identical requests hitting the API at the exact same time
    if (this.inFlight.has(v)) {
      return this.inFlight.get(v);
    }

    const requestPromise = this._processVideoData(v, contentlang, contentregion, knownErrors);
    this.inFlight.set(v, requestPromise);

    try {
      const result = await requestPromise;
      return result;
    } finally {
      this.inFlight.delete(v);
    }
  }

  async _processVideoData(v, contentlang, contentregion, knownErrors) {
    const headers = { "User-Agent": this.useragent };
    const videoUrl = `${this.config.invapi}/videos/${v}?hl=${contentlang}&region=${contentregion}&h=${this.toBase64(Date.now())}`;

    try {
      const [comments, vidObj, dislikesData, colorData] = await Promise.all([
        this._fetchWithRetry(`${config.invapi}/comments/${v}?hl=${contentlang}&region=${contentregion}&h=${this.toBase64(Date.now())}`, { headers }, 1, 1500)
          .then((res) => res.text())
          .then((text) => this.getJson(text))
          .catch(() => null),

        this._fetchVideoInfo(videoUrl, headers, v),

        getdislikes(v).catch((err) => {
          this.initError("Dislike API error", err);
          return { engagement: null };
        }),

        getColors(`https://i.ytimg.com/vi/${v}/hqdefault.jpg?sqp=${this.sqp}`)
          .then((palette) => {
            if (Array.isArray(palette) && palette[0] && palette[1]) {
              return { color: palette[0].hex(), color2: palette[1].hex() };
            }
            throw new Error("Missing Palette");
          })
          .catch((err) => {
            this.initError("Thumbnail color extraction error", err);
            return { color: "#0ea5e9", color2: "#111827" }; 
          })
      ]);

      if (!vidObj || vidObj.error || vidObj.isInternalError) {
        const errorMsg = vidObj?.error || vidObj?.reason || "This video is probably about to premiere.";
        this.initError("Video info error", `${v} - ${errorMsg}`);
        
        return {
          vid: { error: errorMsg },
          comments,
          channel_uploads: " ",
          engagement: dislikesData.engagement,
          wiki: "",
          desc: "",
          color: colorData.color,
          color2: colorData.color2,
        };
      }

      const returnPayload = {
        vid: vidObj,
        comments,
        channel_uploads: " ",
        engagement: dislikesData.engagement,
        wiki: "",
        desc: "",
        color: colorData.color,
        color2: colorData.color2,
      };

      if (this.checkUnexistingObject(vidObj)) {
        this._setCache(v, returnPayload);
        return returnPayload;
      } else {
        this.initError(vidObj, `ID: ${v}`);
        returnPayload.vid = vidObj || { error: "Incomplete data returned." };
        return returnPayload;
      }
      
    } catch (error) {
      if (knownErrors[error.message]) {
        return { 
          error: true, 
          message: knownErrors[error.message],
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
    if (v != "assets" && v != "cdn-cgi" && v != "404") {
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