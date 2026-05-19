const { modules, version } = require("../libpoketube-initsys.js");

function getJson(str) {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

const pkg = require("../../../package.json");
const os = require('os');
const cnf = require("../../../config.json");
const ip2c = require("../../modules/ipapi");
const innertube = require("../libpoketube-youtubei-objects.json");

const { execSync } = require('child_process'); // DO NOT ABBRV THIS :SOB:
const fs = require('fs');

const verfull = "v26.UPDATE2";
const versmol = "v26.UPDATE2";
const branch = "dev/master";
const codename = "nudge";
const versionnumber = "261045";
const updatequote = "i created this world.....to feel some control...";

module.exports = function (app, config, renderTemplate) {

  const headers = {
    'User-Agent': config.useragent,  
  };

  // --- Unified Caching System ---
  class MediaCache {
    constructor(ttl, maxItems) {
      this.cache = new Map();
      this.activeFetches = new Map();
      this.ttl = ttl;
      this.maxItems = maxItems;

      // Run cleanup every 15 minutes
      setInterval(() => this.cleanup(), 15 * 60 * 1000);
    }

    cleanup() {
      const now = Date.now();
      for (const [key, value] of this.cache.entries()) {
        if (now - value.timestamp >= this.ttl) {
          this.cache.delete(key);
        }
      }
      
      if (this.cache.size > this.maxItems) {
        const entriesToDelete = this.cache.size - this.maxItems;
        let deleted = 0;
        for (const key of this.cache.keys()) {
          this.cache.delete(key);
          deleted++;
          if (deleted >= entriesToDelete) break;
        }
      }
    }

    async getOrFetch(key, fetchFn) {
      if (this.cache.has(key)) {
        return this.cache.get(key);
      }

      if (this.activeFetches.has(key)) {
        try {
          return await this.activeFetches.get(key);
        } catch (e) {
          // If the pending fetch fails, it will fall through and retry
        }
      }

      const requestPromise = fetchFn();
      this.activeFetches.set(key, requestPromise);

      try {
        const result = await requestPromise;
        this.cache.set(key, result);
        this.activeFetches.delete(key);
        return result;
      } catch (error) {
        this.activeFetches.delete(key);
        throw error;
      }
    }
  }

  // Renamed constants to camelCase to match the rest of the file
  const imageCacheTtl = 1000 * 60 * 60 * 24;
  const maxCachedImages = 50000;
  const avatarCacheTtl = 1000 * 60 * 60 * 24;
  const maxCachedAvatars = 50000;

  const thumbnailCache = new MediaCache(imageCacheTtl, maxCachedImages);
  const avatarManagerCache = new MediaCache(avatarCacheTtl, maxCachedAvatars);

  app.get("/vi/:v/:t", async function (req, res) {
    const { v, t } = req.params;
    const cacheKey = `${v}_${t}`;

    res.setHeader("Cache-Control", "public, max-age=2592000, immutable");

    try {
      const result = await thumbnailCache.getOrFetch(cacheKey, async () => {
        const url = `https://image-proxy.poketube.fun/proxy?url=https://i.ytimg.com/vi/${v}/${t}`;
        
        const response = await modules.fetch(url, {
          method: req.method,
          headers: headers,
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch image: ${response.status}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const contentType = response.headers.get("content-type") || "image/jpeg";

        return { buffer, contentType, timestamp: Date.now() };
      });

      res.setHeader("Content-Type", result.contentType);
      return res.send(result.buffer);
    } catch (error) {
      console.error(`Error loading thumbnail ${v}/${t}:`, error.message);
      return res.status(404).send("Image not found");
    }
  }); 

  app.get("/avatars/:v", async function (req, res) {
    const v = req.params.v;

    res.setHeader("Cache-Control", "public, max-age=2592000, immutable");

    try {
      const result = await avatarManagerCache.getOrFetch(v, async () => {
        const url = `https://image-proxy.poketube.fun/proxy?url=https://yt3.ggpht.com/${v}`;
        
        const response = await modules.fetch(url, {
          method: req.method,
          headers: headers,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const contentType = response.headers.get("content-type") || "image/jpeg";

        return { buffer, contentType, timestamp: Date.now() };
      });

      res.setHeader("Content-Type", result.contentType);
      return res.send(result.buffer);
    } catch (error) {
      return res.status(404).send("Image not found");
    }
  });
 
  app.get("/api/geo", async (req, res) => {
    try {
      let ip =
        req.headers["x-forwarded-for"]?.split(",")[0].trim() ||
        req.socket.remoteAddress;

      if (ip && ip.startsWith("::ffff:")) {
        ip = ip.slice(7);
      }

      if (!ip) {
        return res.status(400).json({ error: "No IP found" });
      }

      const response = await fetch(`https://ip2c.org/${ip}`);
      const text = await response.text();
      const parts = text.trim().split(";");

      const countryCode = parts[1] || "ZZ";

      res.setHeader("Content-Type", "application/json");
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.json({ countryCode });
    } catch (err) {
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.status(500).json({ countryCode: "ZZ", error: true, details: String(err) });
    }
  });



  app.get("/ggpht/:v", async function (req, res) {
    var url = `https://image-proxy.poketube.fun/proxy?url=https://yt3.ggpht.com/${req.params.v}`;

    let f = await modules.fetch(url + `?cachefixer=${btoa(Date.now())}`, {
      method: req.method,
      headers: headers,
    });

    f.body.pipe(res);
  });

  app.get("/s/player/:playerid/player_ias.vflset/en_US/base.js", async function (req, res) {
    var url = `https://www.youtube.com/s/player/${req.params.playerid}/player_ias.vflset/en_US/base.js`;

    let f = await modules.fetch(url + `?cachefixer=${btoa(Date.now())}`, {
      method: req.method,
      headers: headers,
    });

    f.body.pipe(res);
  });

  app.get("/api/nominatim/search", async (req, res) => {
    try {
      const url = new URL("https://nominatim.openstreetmap.org/search");
      for (const [key, value] of Object.entries(req.query)) {
        url.searchParams.set(key, value);
      }
      if (!url.searchParams.has("format")) url.searchParams.set("format", "json");

      const r = await fetch(url.toString(), {
        headers: { "Accept-Language": req.headers["accept-language"] || "en" }
      });
      const data = await r.json();
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch from nominatim" });
    }
  });

  app.get("/api/nominatim/reverse", async (req, res) => {
    try {
      const url = new URL("https://nominatim.openstreetmap.org/reverse");
      for (const [key, value] of Object.entries(req.query)) {
        url.searchParams.set(key, value);
      }
      if (!url.searchParams.has("format")) url.searchParams.set("format", "json");

      const r = await fetch(url.toString(), {
        headers: { "Accept-Language": req.headers["accept-language"] || "en" }
      });
      const data = await r.json();
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch from nominatim" });
    }
  });

  app.get("/avatars/ytc/:v", async function (req, res) {
    var url = `https://yt3.googleusercontent.com/ytc/${req.params.v.replace("ytc", "")}`;

    let f = await modules.fetch(url + `?cachefixer=${btoa(Date.now())}`, {
      method: req.method,
      headers: headers, 
    });

    f.body.pipe(res);
  });

  app.get("/api/video/download", async function (req, res) {
    var v = req.query.v;

    var q = "18";
    if (req.query.q) q = req.query.q;

    const url = `${config.videourl}/companion/latest_version?id=${v}&itag=${q}&local=true`;

    res.redirect(url);
  });

app.get("/api/getYoutubeUrl", async function (req, res) {
  var v = req.query.v;

  if (!v) {
    return res.status(400).send("No video ID??? how...");
  }

  const url = `https://youtube.com/watch?v=${v}`;

  const page = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Leaving to YouTube</title>
        <style>
            body {
                font-family: "Roboto", Arial, sans-serif;
                background-color: #0f0f0f; 
                color: #f1f1f1; 
                margin: 0;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                height: 100vh;
            }
            .container {
                display: flex;
                flex-direction: column;
                align-items: center;
                text-align: center;
                padding: 0 24px;
                max-width: 500px;
            }
            .tv-icon {
                width: 100px;
                height: 100px;
                fill: #aaaaaa;
                margin-bottom: 24px;
            }
            h1 {
                font-size: 24px;
                font-weight: 400;
                margin: 0 0 12px 0;
            }
            p {
                font-size: 16px;
                color: #aaaaaa; 
                margin: 0 0 32px 0;
                line-height: 1.4;
            }
            .buttons {
                display: flex;
                gap: 12px;
                align-items: center;
            }
            .btn {
                padding: 10px 16px;
                border-radius: 18px; 
                font-size: 14px;
                font-weight: 500;
                text-decoration: none;
                cursor: pointer;
                border: none;
                transition: background-color 0.2s;
            }
            .btn-primary {
                background-color: #f1f1f1;
                color: #0f0f0f;
            }
            .btn-primary:hover {
                background-color: #d9d9d9;
            }
            .btn-secondary {
                background-color: transparent;
                color: #3ea6ff;  
            }
            .btn-secondary:hover {
                background-color: rgba(62, 166, 255, 0.1);
            }
        </style>
    </head>
    <body>
        <div class="container">
            <svg class="tv-icon" viewBox="0 0 24 24">
                <path d="M21,3H3C1.89,3,1,3.89,1,5v12c0,1.1,0.89,2,2,2h5v2h8v-2h5c1.1,0,2-0.9,2-2V5C23,3.89,22.1,3,21,3z M21,17H3V5h18V17z M11,7h2v4h-2V7z M11,13h2v2h-2V13z"/>
            </svg>
            
            <h1>You're leaving poke :c</h1>
            <p>You are about to be redirected to youtube, which collects your data, tracks u and does all sorts of evil thingies... do u really wanna go to youtube?? </p>
            
            <div class="buttons">
                <button class="btn btn-secondary" onclick="window.history.back()">Stay Private</button>
                <a href="${url}" class="btn btn-primary">yeah...i really do..</a>
            </div>
        </div>
    </body>
    </html>
  `;

  res.send(page);
});  
  app.get("/api/subtitles", async (req, res) => {
    const { fetch } = await import("undici");

    const id = req.query.v;
    const l = req.query.h;

    try {
      let url = `${config.videourl}/companion/api/v1/captions/${id}?label=${l}`;

      res.send("they are currently broken... see https://github.com/iv-org/invidious/issues/5571");

    } catch {}
  });
  
  app.get("/api/weather", async (req, res) => {
    try {
      const url = new URL("https://api.open-meteo.com/v1/forecast");
      for (const [key, value] of Object.entries(req.query)) {
        url.searchParams.set(key, value);
      }

      const response = await fetch(url.toString());
      if (!response.ok) {
        return res.status(response.status).json({ error: "Upstream error" });
      }

      const data = await response.json();
      res.json(data);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Proxy error" });
    }
  });
  app.get("/api/getEngagementData", async (req, res) => {
  const { fetch } = await import("undici");
  const id = req.query.v;
  const view = req.query.view;
  let videoTitle = "Unknown Title";

  if (req.query.t) {
    try {
      videoTitle = Buffer.from(req.query.t, "base64").toString("utf-8");
    } catch (e) {}
  }

  if (view === 'gui' && videoTitle === "Unknown Title") {
    return res.status(400).json("pls gib base64 title via ?t= :3");
  }

  try {
    if (id) {
      const apiUrl = `https://ryd-proxy.kavin.rocks/votes/${id}&hash=d0550b6e28c8f93533a569c314d5b4e2`;
      const response = await fetch(apiUrl, {
        headers: typeof headers !== 'undefined' ? headers : {},
      });
      
      if (response.status === 400) {
        const error = await response.json();
        return res.status(400).send(error);
      }
      
      const engagement = await response.json();
      const likes = parseInt(engagement.likes) || 0;
      const dislikes = parseInt(engagement.dislikes) || 0;
      const views = parseInt(engagement.viewCount) || 0;
      const total = likes + dislikes;
      const likePercentage = total > 0 ? ((likes / total) * 100).toFixed(2) : 0;
      const dislikePercentage = total > 0 ? ((dislikes / total) * 100).toFixed(2) : 0;
      const ratingNum = parseFloat(engagement.rating) || 0;
      const starPercentage = (ratingNum / 5) * 100;
      
      const getLikePercentageColor = (percentage) => {
        if (percentage >= 80) return "green";
        else if (percentage >= 50) return "orange";
        else return "red";
      };
      
      const getDislikePercentageColor = (percentage) => {
        if (percentage >= 50) return "red";
        else if (percentage >= 20) return "orange";
        else return "green";
      };
      
      const likeColor = getLikePercentageColor(likePercentage);
      const dislikeColor = getDislikePercentageColor(dislikePercentage);
      
      const userScore = (
        parseFloat(likePercentage) -
        parseFloat(dislikePercentage) / 2
      ).toFixed(2);
      
      const getUserScoreLabel = (score) => {
        if (score >= 98) return "Masterpiece";
        else if (score >= 80) return "Overwhelmingly Positive";
        else if (score >= 60) return "Positive";
        else if (score >= 40) return "Mixed";
        else if (score >= 20) return "Negative";
        else return "Overwhelmingly Negative";
      };
      
      const userScoreLabel = getUserScoreLabel(userScore);
      
      const userScoreColor =
        userScore >= 98 ? "rainbow" :
        userScore >= 80 ? "green" :
        userScore >= 50 ? "orange" :
        "red";
        
      const respon = {
        view_count: views,
        like_count: likes,
        dislike_count: dislikes,
        YouTube_rating: engagement.rating,
        user_ReceptionScore: {
          label: userScoreLabel,
          score: userScore,
          color: userScoreColor,
        },
        display: {
          likeColor: likeColor,
          dislikeColor: dislikeColor,
          percentage: {
            likePercentage: `${likePercentage}%`,
            dislikePercentage: `${dislikePercentage}%`,
          },
        },
        raw_stats: engagement,
      };

      if (view === 'gui') {
        const svgStar = `<svg viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>`;
        const starsHTML = svgStar.repeat(5);

        const html = `
          <!DOCTYPE html>
          <html lang="en">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Engagement Stats</title>
            <style>
              @font-face {
                font-family: "PokeTube Flex";
                src: url("/static/robotoflex.ttf");
                font-style: normal;
                font-stretch: 1% 800%;
                font-display: swap;
              }
              
              * {
                box-sizing: border-box;
                margin: 0;
                padding: 0;
              }

              body { 
                font-family: "PokeTube Flex", Arial, sans-serif; 
                background-color: #0f0f0f;
                color: #f1f1f1; 
                display: flex; 
                justify-content: center; 
                align-items: center; 
                min-height: 100vh; 
                padding: 16px;
                font-variation-settings: "wdth" 120, "wght" 400;
              }
              
              .card { 
                background-color: #0f0f0f; 
                padding: 24px; 
                border: 1px solid #272727; 
                border-radius: 16px; 
                max-width: 640px; 
                width: 100%;
              }
              
              .thumbnail-container {
                position: relative;
                display: block;
                width: 100%;
                aspect-ratio: 16/9;
                border-radius: 12px;
                margin-bottom: 16px;
                overflow: hidden;
                cursor: pointer;
                border: 2px solid #000000;
              }
              
              .thumbnail {
                width: 100%;
                height: 100%;
                object-fit: cover;
                transition: filter 0.2s ease, transform 0.3s ease;
                display: block;
              }
              
              .play-button {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: 64px;
                height: 64px;
                background-color: rgba(0, 0, 0, 0.6);
                backdrop-filter: blur(4px);
                border-radius: 50%;
                display: flex;
                justify-content: center;
                align-items: center;
                opacity: 0;
                transition: opacity 0.2s ease, transform 0.2s ease;
              }
              
              .play-button svg {
                width: 32px;
                height: 32px;
                fill: #ffffff;
                margin-left: 4px;
              }
              
              .thumbnail-container:hover .thumbnail {
                filter: brightness(0.6);
                transform: scale(1.02);
              }
              
              .thumbnail-container:hover .play-button {
                opacity: 1;
                transform: translate(-50%, -50%) scale(1.05);
              }
              
              .video-title {
                font-size: clamp(1.3rem, 3vw, 1.6rem);
                font-weight: 800;
                margin-bottom: 6px;
                font-variation-settings: "wdth" 150, "wght" 800;
                line-height: 1.3;
                word-wrap: break-word;
                text-align: center;
              }
              
              .video-views {
                font-size: 1.05rem;
                color: #aaaaaa;
                margin-bottom: 16px;
                font-variation-settings: "wdth" 130, "wght" 500;
                text-align: center;
              }
              
              .pill { 
                display: flex; 
                align-items: center; 
                background: #272727; 
                border-radius: 20px; 
                padding: 0 16px; 
                height: 40px; 
                width: max-content; 
                margin: 0 auto 16px auto;
                font-variation-settings: "wdth" 130, "wght" 600;
              }
              
              .pill-section { 
                display: flex; 
                align-items: center; 
                gap: 8px; 
                font-size: 15px; 
                font-weight: 600; 
                color: #f1f1f1; 
              }
              
              .divider { 
                width: 1px; 
                height: 24px; 
                background-color: #3f3f3f; 
                margin: 0 16px; 
              }
              
              .ratio-bar { 
                width: 100%; 
                height: 4px; 
                background-color: #cc0000;
                border-radius: 4px; 
                overflow: hidden; 
                display: flex; 
                margin-bottom: 20px; 
              }
              
              .ratio-like { 
                width: ${likePercentage}%; 
                background-color: #2ba640; 
                height: 100%; 
                border-radius: 4px; 
              }
              
              .reception { 
                background: #1a1a1a; 
                border: 1px solid #272727;
                padding: 16px; 
                border-radius: 12px; 
                margin-bottom: 16px; 
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 12px;
              }

              .reception-header {
                text-align: center;
              }
              
              .reception-title { 
                font-size: 13px; 
                color: #aaaaaa; 
                text-transform: uppercase; 
                letter-spacing: 0.8px; 
                margin-bottom: 6px; 
                font-variation-settings: "wdth" 140, "wght" 700;
              }
              
              .score-label { 
                font-size: 24px; 
                font-weight: bold; 
                font-variation-settings: "wdth" 150, "wght" 800;
              }

              .reception-stats {
                display: flex;
                justify-content: space-evenly;
                align-items: center;
                width: 100%;
                background: #111111;
                padding: 12px;
                border-radius: 8px;
                border: 1px solid #222;
              }
              
              .score-number { 
                font-size: 16px; 
                color: #aaaaaa; 
                font-variation-settings: "wdth" 125, "wght" 600;
              }
              
              .star-container {
                display: flex;
                align-items: center;
                gap: 10px;
              }
              
              /* Exact Fractional SVG Stars */
              .star-rating-wrapper {
                position: relative;
                display: flex;
                width: 120px; /* 5 stars * 24px */
                height: 24px;
              }
              
              .stars-bg, .stars-fg {
                display: flex;
                position: absolute;
                top: 0;
                left: 0;
                height: 100%;
              }

              .stars-bg svg {
                width: 24px;
                height: 24px;
                fill: #333333;
              }
              
              .stars-fg {
                overflow: hidden;
                width: ${starPercentage}%; /* Exact clipping */
              }

              .stars-fg div {
                display: flex;
                width: 120px; /* Force to full 5-star width inside the clipped div */
              }
              
              .stars-fg svg {
                width: 24px;
                height: 24px;
                fill: #f1c40f;
                filter: drop-shadow(0px 0px 4px rgba(241, 196, 15, 0.4));
                flex-shrink: 0;
              }
              
              .rating-text {
                font-size: 18px;
                font-weight: bold;
                color: #f1f1f1;
                font-variation-settings: "wdth" 140, "wght" 800;
              }

              .green { color: #2ba640; }
              .orange { color: #f57c00; }
              .red { color: #cc0000; }
              
              .rainbow { 
                  background: linear-gradient(90deg, #ff6b6b, #feca57, #1dd1a1, #5f27cd, #ff9ff3);
                  -webkit-background-clip: text;
                  -webkit-text-fill-color: transparent;
                  animation: rainbow-anim 3s linear infinite;
                  background-size: 200% 100%;
                  text-shadow: 0px 0px 10px rgba(255, 255, 255, 0.15);
              }
              
              @keyframes rainbow-anim { 
                0% { background-position: 100% 0; } 
                100% { background-position: -100% 0; } 
              }
              
              .info-section {
                margin-top: 16px;
                font-size: 13px;
                color: #aaaaaa;
                text-align: center;
                line-height: 1.6;
                font-variation-settings: "wdth" 130, "wght" 500;
              }
              
              .info-section a {
                color: #3ea6ff;
                text-decoration: none;
                font-variation-settings: "wdth" 130, "wght" 600;
                transition: color 0.2s ease;
              }
              
              .info-section a:hover {
                text-decoration: underline;
                color: #6ebcff;
              }
              
              details { 
                font-size: 13px; 
                color: #aaa; 
                background: #181818; 
                padding: 12px; 
                border-radius: 8px; 
                border: 1px solid #272727; 
                font-variation-settings: "wdth" 120, "wght" 500; 
                margin-bottom: 8px; 
                transition: background 0.2s ease;
              }
              
              details:hover { 
                background: #1f1f1f; 
              }
              
              summary { 
                cursor: pointer; 
                user-select: none; 
                font-weight: 600; 
                outline: none; 
                font-variation-settings: "wdth" 135, "wght" 700; 
                margin-bottom: 4px; 
              }
              
              details p { 
                margin-top: 8px; 
                line-height: 1.5; 
                color: #ccc; 
              }
              
              pre { 
                overflow-x: auto; 
                color: #e1e1e1; 
                margin-top: 10px; 
                font-family: monospace; 
                font-variation-settings: normal; 
                background: #121212; 
                padding: 10px; 
                border-radius: 6px;
                border: 1px solid #272727;
              }
              
              pre::-webkit-scrollbar {
                height: 6px;
              }
              
              pre::-webkit-scrollbar-thumb {
                background: #444;
                border-radius: 3px;
              }
              
              pre::-webkit-scrollbar-track {
                background: #121212;
              }
            </style>
          </head>
          <body>
            <div class="card">
              <a href="/watch?v=${id}" class="thumbnail-container">
                <img src="https://i.ytimg.com/vi/${id}/hqdefault.jpg" onerror="this.src='https://i.ytimg.com/vi/${id}/default.jpg'" class="thumbnail" alt="Video Thumbnail" />
                <div class="play-button">
                  <svg viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z"></path>
                  </svg>
                </div>
              </a>
              
              <h1 class="video-title">${videoTitle}</h1>
              <div class="video-views">${views.toLocaleString()} views</div>
              
              <div class="pill">
                <div class="pill-section">
                  👍 ${likes.toLocaleString()}
                </div>
                <div class="divider"></div>
                <div class="pill-section">
                  👎 ${dislikes.toLocaleString()}
                </div>
              </div>
              
              <div class="ratio-bar">
                <div class="ratio-like"></div>
              </div>
              
              <div class="reception">
                <div class="reception-header">
                  <div class="reception-title">Community Reception</div>
                  <div class="score-label ${userScoreColor}">${userScoreLabel}</div>
                </div>
                <div class="reception-stats">
                  <div class="score-number">Score: <span class="${userScoreColor}">${userScore}</span></div>
                  <div class="star-container" title="${ratingNum} out of 5">
                    <div class="star-rating-wrapper">
                      <div class="stars-bg">
                        ${starsHTML}
                      </div>
                      <div class="stars-fg">
                        <div>
                          ${starsHTML}
                        </div>
                      </div>
                    </div>
                    <div class="rating-text">${ratingNum.toFixed(1)}</div>
                  </div>
                </div>
              </div>

              <details>
                <summary>ℹ️ About this data</summary>
                <p>These stats are pulled entirely from the Return YouTube Dislike (RYD) API. RYD provides estimations for dislikes based on their extension users and historical data. They do not provide other video metadata like the title natively, which is why it must be passed manually.</p>
              </details>

              <details>
                <summary>🤓 Nerd Stats (Raw JSON)</summary>
                <pre><code>${JSON.stringify(respon, null, 2)}</code></pre>
              </details>

              <div class="info-section">
                Data is fetched from <a href="https://www.returnyoutubedislike.com/" target="_blank">Return YouTube Dislike</a>.<br>
                Consider <a href="https://www.returnyoutubedislike.com/donate" target="_blank">donating</a> to help them out!
              </div>
            </div>
          </body>
          </html>
        `;
        return res.send(html);
      }

      res.send(respon);
    } else {
      res.status(400).json("pls gib ID :3");
    }
  } catch (error) {
    res.status(500).json("whoops (error 500) >~<");
  }
});
   app.get("/feeds/videos.xml", async (req, res) => {
  const channelId = req.query.channel_id;
  const playlistId = req.query.playlist_id;

   const sendError = (status) => {
     const safeUrl = req.originalUrl.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    
    const errorHtml = `<!DOCTYPE html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="initial-scale=1, minimum-scale=1, width=device-width"><title>Error ${status}</title><style>*{margin:0;padding:0}html,code{font:15px/22px arial,sans-serif}html{background:#121212;color:#e0e0e0;padding:15px}body{margin:7% auto 0;max-width:390px;min-height:180px;padding:30px 0 15px}*>body{background:url(//www.google.com/images/errors/robot.png) 100% 5px no-repeat;padding-right:205px}p{margin:11px 0 22px;overflow:hidden}ins{color:#aaa;text-decoration:none}a img{border:0;height:54px}@media screen and (max-width:772px){body{background:none;margin-top:0;max-width:none;padding-right:0}}</style><a href="/"><img src="https://poketube.fun/static/logo-poke.svg" alt="Poke Logo"></a><p><b>${status}.</b> <ins>That’s an error.</ins><p>The requested URL <code>${safeUrl}</code> resulted in an error. <ins>That’s all we know.</ins></html>`;
    
    res.status(status).type('html').send(errorHtml);
  };

  if (!channelId && !playlistId) {
    return sendError(400); 
  }

  const url = channelId
    ? `https://youtube.com/feeds/videos.xml?channel_id=${channelId}`
    : `https://youtube.com/feeds/videos.xml?playlist_id=${playlistId}`;

  try {
    let f = await modules.fetch(url, {
      method: req.method,
      headers: headers, 
    });

     if (!f.ok) {
      return sendError(f.status);
    }

    res.set('Content-Type', 'application/xml');
    f.body.pipe(res);
    
  } catch (error) {
    console.error("Error fetching YouTube feed:", error);
    sendError(500);  
  }
});

  app.get("/api/manifest/dash/id/:id", async (req, res) => {
    const id = req.params.id;

    let url = `https://invid-api.poketube.fun/bHj665PpYhUdPWuKPfZuQGoX/api/manifest/dash/id/${id}`;

    let f = await modules.fetch(url, {
      method: req.method,
      headers: headers, 
    });

    f.body.pipe(res);
  });

app.get("/api/redirect", async (req, res) => {
  const u = req.query.u;

  if (!u || typeof u !== "string") {
    return res.redirect("/");
  }

  let red_url;

  try {
     red_url = Buffer.from(u, "base64").toString("utf-8");
  } catch (error) {
    // Catch any malformed Base64 strings so they don't crash the server
    return res.redirect("/");
  }

  if (!red_url) {
    return res.redirect("/");
  }

  res.redirect(red_url + "?f=" + u);
});

  app.get("/api", async (req, res) => {
    res.redirect("/api/version.json");
  });

  app.get("/api/v1", async (req, res) => {
    res.redirect("https://invid-api.poketube.fun/api/v1/stats");
  });

  app.get("/api/version.json", async (req, res) => {
    let latestCommitHash = null;

    function getLatestCommitHash() {
      try {
        const out = execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "pipe"] })
          .toString()
          .trim();
        return out || null;
      } catch {
        return null;
      }
    }

    function readOsRelease() {
      try {
        const text = fs.readFileSync("/etc/os-release", "utf8");
        const map = {};
        for (const line of text.split("\n")) {
          const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
          if (!m) continue;
          let v = m[2];
          if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
            v = v.slice(1, -1);
          }
          map[m[1]] = v;
        }
        return {
          id: map.ID || null,
          id_like: map.ID_LIKE || null,
          version_id: map.VERSION_ID || null,
          name: map.NAME || null,
          pretty_name: map.PRETTY_NAME || null,
        };
      } catch {
        return null;
      }
    }

    const osr = readOsRelease();

    const cpus = os.cpus() || [];
    const totalMemoryGB = os.totalmem() / (1024 ** 3);
    const freeMemoryGB = os.freemem() / (1024 ** 3);

    const roundedTotalGB = totalMemoryGB.toFixed(2);
    const roundedFreeGB = freeMemoryGB.toFixed(2);

    const loadavg = os.loadavg();
    const uptimeSeconds = Math.floor(os.uptime());

    let platform = os.platform();
    if (platform === 'linux') platform = 'gnu/linux';

    const kernelRelease = os.release();
    const arch = os.arch();
    const hostname = os.hostname();
    const cpuModel = cpus[0]?.model || "Unknown CPU";
    const cpuCount = cpus.length;

    latestCommitHash = getLatestCommitHash();

    let invidious = null;
    try {
      const invTxt = await modules
        .fetch(cnf.invapi + "/stats", { headers })
        .then(r => r.text());
      invidious = getJson(invTxt);
    } catch {
      invidious = null;
    }

    const { useragent, ...configWithoutUA } = cnf;

    const response = {
      pt_version: {
        version: versmol,
        version_full: verfull,
        commit: latestCommitHash,
      },
      branch,
      updatequote,
      vernum: versionnumber,
      codename,
       system: {
        os_name: osr?.pretty_name || osr?.name || (platform === "linux" ? "GNU/Linux" : os.type()),
        distro: osr ? {
          pretty_name: osr.pretty_name,
          name: osr.name,
          id: osr.id,
          id_like: osr.id_like,
          version_id: osr.version_id,
        } : null,
        platform,           
        kernel_release: kernelRelease,
        arch,
        hostname,
        ram_total: `${roundedTotalGB} GB`,
        ram_free: `${roundedFreeGB} GB`,
        cpu: cpuModel,
        cpu_cores: cpuCount,
        loadavg: {
          "1m": Number(loadavg[0]?.toFixed(2) || 0),
          "5m": Number(loadavg[1]?.toFixed(2) || 0),
          "15m": Number(loadavg[2]?.toFixed(2) || 0),
        },
        uptime_seconds: uptimeSeconds,
      },
      packages: {
        libpt: version,
        node: process.version,
        v8: process.versions.v8,
      },
      invidious,
      innertube,
      flac: { 
        poketube_normalize_volume: "26.034.34",
      },
      process: process.versions,
      dependencies: pkg.dependencies,
      poketubeapicode: (() => {
        const invVer = invidious?.software?.version || "0";
        return btoa(String(Date.now()) + String(invVer));
      })(),
    };

    res.json(response);
  });

    app.get("/api/innertube.json", async (req, res) => {
      res.json(innertube)
});

  app.get("/api/instances.json", async (req, res) => {
    const { fetch } = await import("undici");

    try {
      const url = `https://raw.githubusercontent.com/ashley0143/poke/main/instances.json`;

      let f = await fetch(url, {
        headers: headers, 
      })
        .then((res) => res.text())
        .then((json) => JSON.parse(json));

      res.json(f);
    } catch {
      res.json("error while fetching instances");
    }
  });
};

module.exports.api = versionnumber;