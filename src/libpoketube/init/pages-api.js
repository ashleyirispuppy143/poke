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

const verfull = "v25.2705-luna-MAJOR_UPDATE-stable-dev-nonLTS-git-MTc0NTcwNjc4MA==";
const versmol = "v25.2705-luna";
const branch = "dev/master";
const codename = "luna";
const versionnumber = "294";
const relaseunixdate = "MTc0NTcwNjc4MA==";
const updatequote = "i created this world.....to feel some control...";

module.exports = function (app, config, renderTemplate) {

  const headers = {
    'User-Agent': config.useragent,  
  };

  app.get("/vi/:v/:t", async function (req, res) {
    var url = `https://i.ytimg.com/vi/${req.params.v}/${req.params.t}`;

    let f = await modules.fetch(url + `?cachefixer=${btoa(Date.now())}`, {
      method: req.method,
      headers: headers,
    });

    f.body.pipe(res);
  });

  app.get("/avatars/:v", async function (req, res) {
    var url = `https://yt3.ggpht.com/${req.params.v}`;

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
    var url = `https://yt3.ggpht.com/${req.params.v}`;

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
    const id = req.query.channel_id;

    let url = `https://youtube.com/feeds/videos.xml?channel_id=${id}`;

    let f = await modules.fetch(url, {
      method: req.method,
      headers: headers,
    });

    f.body.pipe(res);
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
      relaseunixdate,
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
        poketube_flac: "1.2a",
        apple_musickit: "1.2.3",
        poketube_normalize_volume: "1.2.23-yt",
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
