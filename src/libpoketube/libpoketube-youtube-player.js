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
    this.cache = {};
    this.language = "hl=en-US";
    this.param = "2AMB";
    this.param_legacy = "CgIIAdgDAQ%3D%3D";
    this.apikey = "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8";
    this.ANDROID_API_KEY = "AIzaSyA8eiZmM1FaDVjRy-df2KTyQ_vz_yYM39w";
    this.ANDROID_APP_VERSION = "21.03.36";
    this.ANDROID_VERSION = "16";
    this.useragent = config.useragent
    this.INNERTUBE_CONTEXT_CLIENT_VERSION = "1";
    this.region = "region=US";
    this.sqp =
      "-oaymwEbCKgBEF5IVfKriqkDDggBFQAAiEIYAXABwAEG&rs=AOn4CLBy_x4UUHLNDZtJtH0PXeQGoRFTgw";
    this.blockedFile = "blockedreasons.txt";
    this.blockedVideos = new Map();
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
      try {
        fs.appendFileSync(this.blockedFile, videoId + "|" + reason + "\n");
      } catch (e) {
        console.error("[LIBPT ERROR] Could not write to blockedreasons.txt", e);
      }
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

  // safe base64 helper so btoa isn't required in Node
  toBase64(str) {
    if (typeof btoa !== "undefined") return btoa(str);
    return Buffer.from(String(str)).toString("base64");
  }

  // Async task to extract colors without blocking the main event loop
  extractColorsBackground(v) {
    getColors(`https://i.ytimg.com/vi/${v}/hqdefault.jpg?sqp=${this.sqp}`)
      .then((palette) => {
        if (Array.isArray(palette) && palette[0] && palette[1]) {
          // If the video is in cache, silently update the colors for the NEXT request
          if (this.cache[v] && this.cache[v].result) {
            this.cache[v].result.color = palette[0].hex();
            this.cache[v].result.color2 = palette[1].hex();
          }
        }
      })
      .catch(() => {
        // Silently drop image extraction errors
      });
  }

  async getYouTubePlayerInfo(f, v, contentlang, contentregion) {
    const { fetch } = await import("undici");

    const knownErrors = {
      "COPYRIGHT_BLOCKED": "This video contains content from a copyright holder who has blocked it.",
      "UPLOADER_REMOVED": "This video has been removed by the uploader.",
      "VIDEO_UNAVAILABLE": "Video unavailable.",
      "INAPPROPRIATE": "This video may be inappropriate for some users."
    };

    if (!v) {
      this.initError("Missing video ID", null);
      return { error: true, message: "No video ID provided" };
    }

    // Fast O(1) Check for blocked videos
    if (this.blockedVideos.has(v)) {
      const reasonKey = this.blockedVideos.get(v);
      return { 
        error: true, 
        message: knownErrors[reasonKey] || "This video is blocked, removed, or unavailable.",
        reason: reasonKey
      };
    }

    // Fast O(1) Check for cached data
    if (this.cache[v] && Date.now() - this.cache[v].timestamp < 3600000) {
      return this.cache[v].result;
    }

    const headers = {
      "User-Agent": this.useragent,
    };

    // Optimized linear-backoff retry fetcher
    const fetchWithRetry = async (url, options = {}, maxRetries = 2) => {
      const isTrigger = (s) => (s === 500 || s === 502 || s === 503 || s === 504 || s === 429);
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      
      const checkUnrecoverableErrors = async (resp) => {
        if (resp.status === 500 || resp.status === 404) {
          try {
            const clone = resp.clone();
            const text = await clone.text();
            
            if (resp.status === 500 && text.includes("who has blocked it on copyright grounds")) {
              this.addBlockedVideo(v, "COPYRIGHT_BLOCKED");
              throw new Error("COPYRIGHT_BLOCKED");
            }
            if (resp.status === 500 && text.includes("This video has been removed by the uploader")) {
              this.addBlockedVideo(v, "UPLOADER_REMOVED");
              throw new Error("UPLOADER_REMOVED");
            }
            if (resp.status === 500 && text.includes("This video may be inappropriate for some users")) {
              this.addBlockedVideo(v, "INAPPROPRIATE");
              throw new Error("INAPPROPRIATE");
            }
            if (resp.status === 404 && text.includes("Video unavailable")) {
              this.addBlockedVideo(v, "VIDEO_UNAVAILABLE");
              throw new Error("VIDEO_UNAVAILABLE");
            }
          } catch (err) {
            if (["COPYRIGHT_BLOCKED", "UPLOADER_REMOVED", "VIDEO_UNAVAILABLE", "INAPPROPRIATE"].includes(err.message)) {
              throw err;
            }
          }
        }
      };

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 3500); // 3.5s strict timeout

          const res = await fetch(url, {
            ...options,
            headers: { ...options?.headers, ...headers },
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);

          if (res.ok) return res;
          await checkUnrecoverableErrors(res);
          
          if (!isTrigger(res.status) || attempt === maxRetries) return res;
          
          // Fast linear backoff (150ms, 300ms)
          await sleep(150 * (attempt + 1)); 
        } catch (err) {
          if (["COPYRIGHT_BLOCKED", "UPLOADER_REMOVED", "VIDEO_UNAVAILABLE", "INAPPROPRIATE"].includes(err.message)) throw err;
          if (attempt === maxRetries) throw err;
          await sleep(150 * (attempt + 1));
        }
      }
    };

    // build the video info URL — cache-busted with current timestamp
    const videoUrl = `${this.config.invapi}/videos/${v}?hl=${contentlang}&region=${contentregion}&h=${this.toBase64(Date.now())}`;

    try {
      // Execute fast network fetches in parallel
      const [invComments, vidObj, dislikesData] = await Promise.all([
        // 1. Comments
        fetchWithRetry(`${config.invapi}/comments/${v}?hl=${contentlang}&region=${contentregion}&h=${this.toBase64(Date.now())}`)
          .then((res) => res?.text())
          .catch(() => null),

        // 2. Video Info
        (async () => {
          try {
            const r = await fetchWithRetry(videoUrl);
            if (!r || !r.ok) return null;
            const text = await r.text();
            const parsed = this.getJson(text);
            if (parsed && (this.checkUnexistingObject(parsed) || parsed.error)) {
              return parsed;
            }
            return null;
          } catch (err) {
            if (["COPYRIGHT_BLOCKED", "UPLOADER_REMOVED", "VIDEO_UNAVAILABLE", "INAPPROPRIATE"].includes(err.message)) throw err;
            return { isInternalError: true, reason: err.message };
          }
        })(),

        // 3. Dislikes
        getdislikes(v).catch(() => ({ engagement: null }))
      ]);

      const comments = this.getJson(invComments);
      const vid = vidObj;

      // Extract colors silently in the background
      this.extractColorsBackground(v);

      // Default safe colors to render instantly
      const defaultColor = "#0ea5e9";
      const defaultColor2 = "#111827";

      // Check for specific API errors or fetch failures
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
        this.cache[v] = {
          result: {
            vid,
            comments,
            channel_uploads: " ",
            engagement: dislikesData?.engagement || null,
            wiki: "",
            desc: "",
            color: defaultColor,
            color2: defaultColor2,
          },
          timestamp: Date.now(),
        };

        // Cache size management
        if (Object.keys(this.cache).length > 200) {
          const firstKey = Object.keys(this.cache)[0];
          delete this.cache[firstKey];
        }

        return this.cache[v].result;
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
    // Prevent unhandled promise rejection spam from clogging console
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