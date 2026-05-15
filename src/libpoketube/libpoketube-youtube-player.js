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

    if (this.blockedVideos.has(v)) {
      const reasonKey = this.blockedVideos.get(v);
      return { 
        error: true, 
        message: knownErrors[reasonKey] || "This video is blocked, removed, or unavailable.",
        reason: reasonKey
      };
    }

    if (this.cache[v] && Date.now() - this.cache[v].timestamp < 3600000) {
      return this.cache[v].result;
    }

    const headers = {
      "User-Agent": this.useragent,
    };

    const fetchWithRetry = async (url, options = {}, maxRetryTime = 2500) => {
      let lastError;

      const isTrigger = (s) => (s === 500 || s === 502);
      const RETRYABLE = new Set([429, 500, 502, 503, 504]);
      const MIN_DELAY_MS = 150;
      const BASE_DELAY_MS = 250;
      const MAX_DELAY_MS = 1500;  
      const JITTER_FACTOR = 3;
      const PER_TRY_TIMEOUT_MS = 2000;
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const parseRetryAfter = (hdr) => {
        if (!hdr) return null;
        const s = String(hdr).trim();
        const delta = Number(s);
        if (Number.isFinite(delta)) return Math.max(0, (delta * 1000) | 0);
        const when = Date.parse(s);
        if (!Number.isNaN(when)) return Math.max(0, when - Date.now());
        return null;
      };

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

      let res;
      try {
        res = await fetch(url, {
          ...options,
          headers: {
            ...options?.headers,
            ...headers,
          },
        });
      } catch (err) {
        this?.initError?.(`Fetch error for ${url}`, err);
        throw err;
      }

      if (res.ok) return res;
      await checkUnrecoverableErrors(res);
      if (!isTrigger(res.status)) return res;

      const retryStart = Date.now();
      let delayMs = BASE_DELAY_MS;
      let attempt = 1;
      const callerSignal = options?.signal || null;

      const attemptWithTimeout = async (timeoutMs) => {
        const controller = new AbortController();
        const timer = setTimeout(
          () => controller.abort(new Error("Fetch attempt timed out")),
          timeoutMs > 0 ? timeoutMs : 1
        );
        const onCallerAbort = () =>
          controller.abort(callerSignal?.reason || new Error("Aborted by caller"));
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
            headers: {
              ...options?.headers,
              ...headers,
            },
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timer);
          if (callerSignal) callerSignal.removeEventListener("abort", onCallerAbort);
        }
      };

      while (true) {
        const elapsed = Date.now() - retryStart;
        const remaining = maxRetryTime - elapsed;
        if (remaining <= 0) {
          throw new Error(`Fetch failed for ${url} after ${maxRetryTime}ms`);
        }
        const perTryTimeout = Math.min(PER_TRY_TIMEOUT_MS, Math.max(100, remaining - 50));

        try {
          const r = await attemptWithTimeout(perTryTimeout);
          if (r.ok) return r;

          await checkUnrecoverableErrors(r);

          if (!RETRYABLE.has(r.status)) {
            return r;
          }

          const retryAfterMs = parseRetryAfter(r.headers.get("Retry-After"));
          let waitMs;
          if (retryAfterMs != null) {
            waitMs = Math.max(MIN_DELAY_MS, Math.min(retryAfterMs, Math.max(0, remaining - 10)));
          } else {
            const next = Math.min(MAX_DELAY_MS, Math.random() * delayMs * JITTER_FACTOR);
            delayMs = next < MIN_DELAY_MS ? MIN_DELAY_MS : next;
            waitMs = Math.min(delayMs, Math.max(0, remaining - 10));
          }

          if (waitMs <= 0) {
            throw new Error(`Fetch failed for ${url} after ${maxRetryTime}ms (window depleted)`);
          }

          this?.initError?.(`Retrying fetch for ${url}`, r.status);
          attempt++;
          await sleep(waitMs);
          continue;
        } catch (err) {
          if (callerSignal && callerSignal.aborted) throw err;
          // Re-throw our custom errors so it bubbles up to break everything gracefully
          if (["COPYRIGHT_BLOCKED", "UPLOADER_REMOVED", "VIDEO_UNAVAILABLE", "INAPPROPRIATE"].includes(err.message)) throw err;

          lastError = err;
          const remaining2 = maxRetryTime - (Date.now() - retryStart);
          if (remaining2 <= 0) throw lastError;

          const next = Math.min(MAX_DELAY_MS, Math.random() * delayMs * JITTER_FACTOR);
          delayMs = next < MIN_DELAY_MS ? MIN_DELAY_MS : next;
          const waitMs = Math.min(delayMs, Math.max(0, remaining2 - 10));
          if (waitMs <= 0) throw lastError;

          this?.initError?.(`Fetch error for ${url}`, err);
          attempt++;
          await sleep(waitMs);
          continue;
        }
      }
    };

    // build the video info URL — cache-busted with current timestamp
    const videoUrl = `${this.config.invapi}/videos/${v}?hl=${contentlang}&region=${contentregion}&h=${this.toBase64(Date.now())}`;

    try {
      // PERF: Execute all fetches in parallel using Promise.all
      const [invComments, vidObj, dislikesData, colorData] = await Promise.all([
        // 1. Comments
        fetchWithRetry(
          `${config.invapi}/comments/${v}?hl=${contentlang}&region=${contentregion}&h=${this.toBase64(
            Date.now()
          )}`
        ).then((res) => res?.text()),

        // 2. Video Info
        (async () => {
          let fetchError = null;
          const MAX_ATTEMPTS = 3;
          for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
            try {
              const r = await fetchWithRetry(videoUrl, {}, 2000);
              if (!r.ok) throw new Error(`HTTP Error ${r.status}`);

              const text = await r.text();
              try {
                const parsed = JSON.parse(text);
                
                if (parsed === null) {
                  return null;
                }

                if (this.checkUnexistingObject(parsed)) {
                  return parsed; // SUCCESS
                }
                
                // If it contains an error property from the API, return it immediately
                if (parsed && parsed.error) {
                   return parsed;
                }

                // If valid JSON but missing expected data (like authorId), stop at 1 attempt
                return null;
              } catch (parseErr) {
                // parse failed, loop and retry
              }
            } catch (err) {
              if (["COPYRIGHT_BLOCKED", "UPLOADER_REMOVED", "VIDEO_UNAVAILABLE", "INAPPROPRIATE"].includes(err.message)) throw err;
              fetchError = err;
            }
          }

          if (fetchError) {
            this.initError("All video info fetch attempts failed", fetchError);
            return { isInternalError: true, reason: fetchError.message || fetchError.toString() };
          }
          return null;
        })(),

        // 3. Dislikes
        (async () => {
          try {
            return await getdislikes(v);
          } catch (err) {
            this.initError("Dislike API error", err);
            return { engagement: null };
          }
        })(),

        // 4. Thumbnail color palette
        (async () => {
          try {
            const palette = await getColors(
              `https://i.ytimg.com/vi/${v}/hqdefault.jpg?sqp=${this.sqp}`
            );
            if (Array.isArray(palette) && palette[0] && palette[1]) {
              return { color: palette[0].hex(), color2: palette[1].hex() };
            }
          } catch (err) {
            this.initError("Thumbnail color extraction error", err);
          }
          return { color: "#0ea5e9", color2: "#111827" }; // Defaults
        })()
      ]);

      const comments = this.getJson(invComments);
      const vid = vidObj;

      // Check for specific API errors or fetch failures. 
      // Do NOT return `error: true` here so it bypasses the error page and renders `watch.ejs`.
      if (!vid || vid.error || vid.isInternalError) {
        const errorMsg = vid?.error || vid?.reason || "This video is probably about to premiere.";

        this.initError("Video info fetch error", `${v} - ${errorMsg}`);
        
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

      if (this.checkUnexistingObject(vid)) {
        this.cache[v] = {
          result: {
            vid,
            comments,
            channel_uploads: " ",
            engagement: dislikesData.engagement,
            wiki: "",
            desc: "",
            color: colorData.color,
            color2: colorData.color2,
          },
          timestamp: Date.now(),
        };

        return this.cache[v].result;
      } else {
        this.initError(vid, `ID: ${v}`);
        
        // Also removed error: true here to ensure watch.ejs renders
        return {
          vid: vid || { error: "Incomplete data returned." },
          comments,
          channel_uploads: " ",
          engagement: dislikesData.engagement,
          wiki: "",
          desc: "",
          color: colorData.color,
          color2: colorData.color2,
        };
      }
    } catch (error) {
      // If it's a known unrecoverable error, return the pretty message (triggers the custom UI)
      if (knownErrors[error.message]) {
        return { 
          error: true, 
          message: knownErrors[error.message],
          reason: error.message 
        };
      }

      // If it's an unknown catastrophic error, report the actual error message.
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