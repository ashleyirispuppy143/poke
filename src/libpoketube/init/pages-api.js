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

const verfull = "v26.00";
const versmol = "v26.00";
const branch = "dev/master";
const codename = "poke-chan";
const versionnumber = "2600";
const updatequote = "i created this world.....to feel some control...";

module.exports = function (app, config, renderTemplate) {

  const headers = {
    'User-Agent': config.useragent,  
  };

  app.get("/vi/:v/:t", async function (req, res) {
    var url = `https://image-proxy.poketube.fun/proxy?url=https://i.ytimg.com/vi/${req.params.v}/${req.params.t}`;

    let f = await modules.fetch(url + `?cachefixer=${btoa(Date.now())}`, {
      method: req.method,
      headers: headers,
    });

    f.body.pipe(res);
  });

  app.get("/avatars/:v", async function (req, res) {
    var url = `https://image-proxy.poketube.fun/proxy?url=https://yt3.ggpht.com/${req.params.v}`;

    let f = await modules.fetch(url + `?cachefixer=${btoa(Date.now())}`, {
      method: req.method,
      headers: headers,
    });

    f.body.pipe(res);
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

app.get("/api/yturl", async function (req, res) {
  var v = req.query.v;

  if (!v) {
    return res.status(400).send("No video ID provided.");
  }

  const url = `https://youtube.com/watch?v=${v}`;

  const modernPage = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>External Link Warning</title>
        <style>
            :root {
                --bg-dark: #0a0a0c;
                --text-main: #ffffff;
                --text-muted: #a1a1aa;
                --yt-red: #ff0000;
                --yt-red-hover: #cc0000;
                --border-color: #27272a;
            }
            
            * {
                box-sizing: border-box;
                margin: 0;
                padding: 0;
            }

            body {
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                background-color: var(--bg-dark);
                color: var(--text-main);
                display: flex;
                min-height: 100vh;
                overflow-x: hidden;
            }

            /* Split Layout */
            .content-side {
                flex: 1;
                display: flex;
                flex-direction: column;
                justify-content: center;
                padding: 8% 12%;
                z-index: 10;
                background: linear-gradient(90deg, #0a0a0c 80%, transparent 100%);
            }

            .visual-side {
                flex: 1;
                display: flex;
                justify-content: center;
                align-items: center;
                position: relative;
                background-color: #050505;
                overflow: hidden;
            }

            /* Ambient Glow Effect */
            .glow {
                position: absolute;
                width: 600px;
                height: 600px;
                background: radial-gradient(circle, rgba(255,0,0,0.15) 0%, rgba(0,0,0,0) 70%);
                border-radius: 50%;
                animation: pulse 4s infinite alternate;
            }

            /* Typography */
            .badge {
                display: inline-block;
                padding: 6px 12px;
                background-color: rgba(255, 255, 255, 0.1);
                border-radius: 20px;
                font-size: 0.85rem;
                font-weight: 600;
                letter-spacing: 1px;
                text-transform: uppercase;
                margin-bottom: 2rem;
                color: var(--text-muted);
                width: fit-content;
                border: 1px solid var(--border-color);
            }

            h1 {
                font-size: 3.5rem;
                line-height: 1.1;
                margin-bottom: 1.5rem;
                font-weight: 700;
                letter-spacing: -1px;
            }

            p {
                font-size: 1.15rem;
                color: var(--text-muted);
                line-height: 1.6;
                margin-bottom: 3rem;
                max-width: 500px;
            }

            /* Buttons */
            .action-group {
                display: flex;
                gap: 1rem;
                flex-wrap: wrap;
            }

            .btn {
                padding: 14px 28px;
                border-radius: 8px;
                font-size: 1rem;
                font-weight: 600;
                cursor: pointer;
                text-decoration: none;
                transition: all 0.2s ease;
                display: inline-flex;
                align-items: center;
                justify-content: center;
            }

            .btn-proceed {
                background-color: var(--yt-red);
                color: white;
                border: none;
                box-shadow: 0 4px 14px rgba(255, 0, 0, 0.3);
            }

            .btn-proceed:hover {
                background-color: var(--yt-red-hover);
                transform: translateY(-2px);
                box-shadow: 0 6px 20px rgba(255, 0, 0, 0.4);
            }

            .btn-back {
                background-color: transparent;
                color: var(--text-main);
                border: 1px solid var(--border-color);
            }

            .btn-back:hover {
                background-color: rgba(255, 255, 255, 0.05);
                border-color: var(--text-muted);
            }

            /* Giant decorative icon */
            .giant-icon {
                width: 250px;
                height: 250px;
                fill: #ffffff;
                opacity: 0.05;
                z-index: 2;
                transform: scale(1);
                transition: transform 0.3s ease;
            }

            /* Animations */
            @keyframes pulse {
                0% { transform: scale(0.95); opacity: 0.7; }
                100% { transform: scale(1.05); opacity: 1; }
            }

            /* Responsive Design for Mobile */
            @media (max-width: 900px) {
                body {
                    flex-direction: column;
                }
                .content-side {
                    padding: 2rem;
                    align-items: center;
                    text-align: center;
                    background: none;
                }
                .visual-side {
                    display: none; /* Hide visual side on small screens to save space */
                }
                h1 {
                    font-size: 2.5rem;
                }
                .action-group {
                    justify-content: center;
                    width: 100%;
                }
                .btn {
                    width: 100%;
                }
            }
        </style>
    </head>
    <body>
        <div class="content-side">
            <div class="badge">Security Notice</div>
            <h1>Leaving<br>Our Platform</h1>
            <p>
                You are about to be redirected to <strong>YouTube</strong>. External websites have their own privacy policies, tracking methods, and terms of service that differ from ours.
            </p>
            <div class="action-group">
                <button class="btn btn-back" onclick="window.history.back()">Stay Here</button>
                
                <a href="${url}" class="btn btn-proceed">Continue to YouTube</a>
            </div>
        </div>
        
        <div class="visual-side">
            <div class="glow"></div>
            <svg class="giant-icon" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" focusable="false">
                <g><path d="M21.58,7.19C21.35,6.33 20.67,5.65 19.81,5.42C18.25,5 12,5 12,5C12,5 5.75,5 4.19,5.42C3.33,5.65 2.65,6.33 2.42,7.19C2,8.75 2,12 2,12C2,12 2,15.25 2.42,16.81C2.65,17.67 3.33,18.35 4.19,18.58C5.75,19 12,19 12,19C12,19 18.25,19 19.81,18.58C20.67,18.35 21.35,17.67 21.58,16.81C22,15.25 22,12 22,12C22,12 22,8.75 21.58,7.19ZM10,15V9L15.2,12L10,15Z"></path></g>
            </svg>
        </div>
    </body>
    </html>
  `;

  res.send(modernPage);
});
  
  app.get("/api/subtitles", async (req, res) => {
    const { fetch } = await import("undici");

    const id = req.query.v;
    const l = req.query.h;

    try {
      let url = `${config.videourl}/companion/api/v1/captions/${id}?label=${l}`;

      res.send("j");

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

    try {
      if (id) {
        const apiUrl = `https://ryd-proxy.kavin.rocks/votes/${id}&hash=d0550b6e28c8f93533a569c314d5b4e2`;

        const response = await fetch(apiUrl, {
          headers: headers,
        });

        if (response.status === 400) {
          const error = await response.json();
          return res.status(400).send(error);
        }

        const engagement = await response.json();

        const likes = parseInt(engagement.likes) || 0;
        const dislikes = parseInt(engagement.dislikes) || 0;
        const total = likes + dislikes;

        const likePercentage = total > 0 ? ((likes / total) * 100).toFixed(2) : 0;
        const dislikePercentage = total > 0 ? ((dislikes / total) * 100).toFixed(2) : 0;

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
          if (score >= 98) return "Masterpiece Video";
          else if (score >= 80) return "Overwhelmingly Positive";
          else if (score >= 60) return "Positive";
          else if (score >= 40) return "Mixed";
          else if (score >= 20) return "Negative";
          else return "Overwhelmingly Negative";
        };

        const userScoreLabel = getUserScoreLabel(userScore);
        const userScoreColor =
          userScore >= 80 ? "green" :
          userScore >= 50 ? "orange" :
          "red";

        const respon = {
          like_count: likes,
          dislike_count: dislikes,
          rating: engagement.rating,
          userScore: {
            label: userScoreLabel,
            score: userScore,
            color: userScoreColor,
          },
          engagement: {
            likeColor: likeColor,
            dislikeColor: dislikeColor,
            percentage: {
              likePercentage: `${likePercentage}%`,
              dislikePercentage: `${dislikePercentage}%`,
            },
          },
          ReturnYouTubeDislikesApiRawResponse: engagement,
        };

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
    const red_url = atob(req.query.u);

    if (!red_url) {
      res.redirect("/");
    }

    res.redirect(red_url + "?f=" + req.query.u);
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
