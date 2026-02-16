const {  getRandomArbitrary } = require("../ptutils/libpt-coreutils.js");
const path = require("path");
const fs = require("node:fs");
const CleanCSS = require("clean-css");

const notice = "/* Licensed under GPL-3.0-or-later. This program comes with ABSOLUTELY NO WARRANTY. You may redistribute it under certain conditions; see <https://www.gnu.org/licenses/> for details. To view the original, unminified source code, append ?nomin=true to the URL (e.g. poketube.fun/css/poketube.css?nomin=true). */";

function getJson(str) {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}



module.exports = function (app, config, renderTemplate) {
  var html_location = "./css/";
  var location_pwa = "./pwa/";

app.get("/privacy", (req, res) => {
  res.redirect(301, "/policies/privacy");
});

app.get("/coc", (req, res) => {
  res.redirect(301, "/policies/code-of-conduct");
});

app.get("/code-of-conduct", (req, res) => {
  res.redirect(301, "/policies/code-of-conduct");
});

app.get("/terms-of-service", (req, res) => {
  res.redirect(301, "/policies/code-of-conduct");
});

const tosRedirects = [
  "/tos",
  "/terms",
  "/termsofservice",
  "/policies/terms",
  "/policies/tos",
  "/policies/termsofservice",
];

tosRedirects.forEach((path) => {
  app.get(path, (req, res) => res.redirect(301, "/policies/code-of-conduct"));
});


app.get("/policies/privacy", (req, res) => {
  if (req.hostname === "poketube.fun") {
    renderTemplate(res, req, "priv.ejs", {
      isMobile: req.useragent.isMobile,
    });
  } else {
    renderTemplate(res, req, "priv-custom.ejs");
  }
});

app.get("/policies/code-of-conduct", (req, res) => {
  renderTemplate(res, req, "coc.ejs");
});

app.get("/policies", (req, res) => {
  renderTemplate(res, req, "terms.ejs");
});
app.get("/request", (req, res) => {
  renderTemplate(res, req, "legal.ejs");
});

  app.get("/502", function (req, res) {
    renderTemplate(res, req, "502.ejs");
  });
 
app.get("/143", (req, res) => {
  const numberEasterEgg = getRandomArbitrary(0, 143);
  const { number, something } = req.query;

  const shouldRender =
    numberEasterEgg === 143 ||
    number === "143" ||
    something === "143";

  if (shouldRender) {
    return renderTemplate(res, req, "143.ejs", { something });
  }

  return res.redirect(`/?number=${numberEasterEgg}`);
});
// GET /weather — SSR + hydrates the same EJS for no-JS users.
// Query options:
//   ?q=Izmir            (free text place)
//   ?lat=38.42&lon=27.14 (coordinates)
//   ?units=metric|imperial
app.get("/weather", async (req, res) => {
  try {
    const q = (req.query.q || "").trim();
    const lat = req.query.lat ? Number(req.query.lat) : null;
    const lon = req.query.lon ? Number(req.query.lon) : null;
    const units = (req.query.units === "imperial") ? "imperial" : "metric";
    const tempUnit = units === "metric" ? "celsius" : "fahrenheit";
    const windUnit = units === "metric" ? "kmh" : "mph";

    // Resolve coordinates
    let place = { name: null, lat: null, lon: null };
    if (lat != null && lon != null) {
      place = { name: `${lat.toFixed(3)}, ${lon.toFixed(3)}`, lat, lon };
      // reverse geocode (best effort)
      try {
        const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`);
        if (r.ok) {
          const j = await r.json();
          place.name = (j.display_name || "").split(",").slice(0,2).join(", ") || place.name;
        }
      } catch {}
    } else if (q) {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&addressdetails=1&q=${encodeURIComponent(q)}`, { headers: { "Accept-Language": req.headers["accept-language"] || "en" }});
      const arr = r.ok ? await r.json() : [];
      if (!arr[0]) return renderTemplate(res, req, "weather.ejs", { ssr: { forceNoJS: true, name: "Not found" }});
      place = {
        name: (arr[0].display_name || "").split(",").slice(0,2).join(", "),
        lat: Number(arr[0].lat),
        lon: Number(arr[0].lon)
      };
    } else {
      // default: try to render minimal page with no data
      return renderTemplate(res, req, "weather.ejs", { ssr: { forceNoJS: true, name: "Choose a location" }});
    }

    // Fetch Open-Meteo
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", place.lat);
    url.searchParams.set("longitude", place.lon);
    url.searchParams.set("current","temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m,wind_direction_10m,pressure_msl");
    url.searchParams.set("hourly","temperature_2m,apparent_temperature,precipitation_probability,precipitation,weather_code,wind_speed_10m");
    url.searchParams.set("daily","weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max");
    url.searchParams.set("timezone","auto");
    url.searchParams.set("forecast_days","7");
    url.searchParams.set("temperature_unit", tempUnit);
    url.searchParams.set("windspeed_unit", windUnit);

    const wr = await fetch(url.toString());
    if (!wr.ok) throw new Error("weather fetch failed");
    const data = await wr.json();

    // Helpers to map WMO codes for SSR
    const codeText = (c)=>{
      if ([0].includes(c)) return "Clear sky";
      if ([1].includes(c)) return "Mostly clear";
      if ([2].includes(c)) return "Partly cloudy";
      if ([3].includes(c)) return "Overcast";
      if ([45,48].includes(c)) return "Fog";
      if ([51,53,55].includes(c)) return "Drizzle";
      if ([56,57].includes(c)) return "Freezing drizzle";
      if ([61,63,65].includes(c)) return "Rain";
      if ([66,67].includes(c)) return "Freezing rain";
      if ([71,73,75].includes(c)) return "Snow";
      if ([77].includes(c)) return "Snow grains";
      if ([80,81,82].includes(c)) return "Showers";
      if ([85,86].includes(c)) return "Snow showers";
      if ([95].includes(c)) return "Thunderstorm";
      if ([96,99].includes(c)) return "Storm & hail";
      return "—";
    };
    const codeIcon = (c,isDay)=>{
      if (c===0) return isDay ? "☀️" : "🌙";
      if ([1,2].includes(c)) return isDay ? "🌤️" : "☁️";
      if ([3].includes(c)) return "☁️";
      if ([45,48].includes(c)) return "🌫️";
      if ([51,53,55,80,81,82].includes(c)) return "🌦️";
      if ([61,63,65].includes(c)) return "🌧️";
      if ([66,67].includes(c)) return "🌧️❄️";
      if ([71,73,75,77,85,86].includes(c)) return "❄️";
      if ([95,96,99].includes(c)) return "⛈️";
      return "☁️";
    };

    const cur = data.current || {};
    const daily = data.daily || { time:[] };
    // Next-hour precip probability best-effort
    let popNext = null;
    try {
      const idx = (data.hourly?.time||[]).findIndex(t => Date.parse(t) > Date.now());
      popNext = data.hourly?.precipitation_probability?.[idx>=0?idx:0] ?? null;
    } catch {}

    // Prepare SSR payload
    const ssr = {
      forceNoJS: Boolean(req.query.nojs),
      name: place.name,
      lat: place.lat,
      lon: place.lon,
      windUnit,
      current: cur,
      daily: daily,
      icon: codeIcon(cur.weather_code, cur.is_day),
      desc: codeText(cur.weather_code),
      sunriseLocal: daily.sunrise ? new Date(daily.sunrise[0]).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) : "—",
      sunsetLocal: daily.sunset ? new Date(daily.sunset[0]).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) : "—",
      popNext,
      dailyIcons: (daily.weather_code||[]).map(c => codeIcon(c,1)),
      dailyTexts: (daily.weather_code||[]).map(c => codeText(c)),
      dailyLabels: (daily.time||[]).map(t => new Date(t).toLocaleDateString([], {weekday:'short',month:'short',day:'numeric'}))
    };

    // Render
    return renderTemplate(res, req, "weather.ejs", { ssr });
  } catch (err) {
    return renderTemplate(res, req, "weather.ejs", { ssr:{ forceNoJS:true, name:"Error loading weather" } });
  }
});


  app.get("/rewind", function (req, res) {
    renderTemplate(res, req, "rewind.ejs");
  });

 app.get("/piano", function (req, res) {
    res.redirect("/studio/piano")
  });

  app.get("/studio/piano", function (req, res) {
    renderTemplate(res, req, "piano.ejs");
  });

  app.get("/studio/drums", function (req, res) {
    renderTemplate(res, req, "drums.ejs");
  });

  app.get("/studio/strings", function (req, res) {
    renderTemplate(res, req, "strings.ejs");
  });

   app.get("/studio", function (req, res) {
    renderTemplate(res, req, "studio-landing.ejs");
  });

app.get("/notepad", function (req, res) {
    renderTemplate(res, req, "pokepad.ejs");
  });

  app.get("/translate", async function (req, res) {
    const { fetch } = await import("undici");

    const api_url = "https://simplytranslate.org/api/translate";

     const translationResponse = await fetch(
      `${api_url}?from=${req.query.from_language}&to=${req.query.to_language}&text=${req.query.input}&engine=google`
    );

     const translationData = await translationResponse.json();

     const translatedText = translationData.translated_text;

     renderTemplate(res, req, "translate.ejs", {
      translation: translatedText,
      text: req.query.input || "enter text here",
      from_language: req.query.from_language,
      to_language: req.query.to_language,
      isMobile: req.useragent.isMobile,
    });
  });

  app.get("/domains", function (req, res) {
    renderTemplate(res, req, "domains.ejs");
  });

  app.get("/apps", function (req, res) {
    renderTemplate(res, req, "apps.ejs");
  });

  const headers = { "User-Agent": config.useragent };

app.get("/playlist", async function (req, res) {
  if (!req.query.list) res.redirect("/");
  if (req.useragent.isMobile) res.redirect("/");
  const playlist = await fetch(`${config.invapi}/playlists/${req.query.list}?hl=en-us`, { headers });
  const p = getJson(await playlist.text());
  var mediaproxy = config.media_proxy;
  if (req.useragent.source.includes("Pardus")) {
    mediaproxy = "https://media-proxy.ashley0143.xyz";
  }
  renderTemplate(res, req, "playlist.ejs", { p, mediaproxy });
});



  app.get("/license", function (req, res) {
    renderTemplate(res, req, "license.ejs");
  });

  app.get("/map", function (req, res) {
    renderTemplate(res, req, "map.ejs");
  });

  app.get("/credits", function (req, res) {
    renderTemplate(res, req, "want-you-gone.ejs");
  });

  app.get("/settings", function (req, res) {
    renderTemplate(res, req, "content-settings.ejs");
  });


 function gregorianToIslamic(gDate) {
  const jd = Math.floor((gDate - new Date(1970, 0, 1)) / (24 * 60 * 60 * 1000)) + 2440588;
  const islamicYear = Math.floor((30 * (jd - 1948440) + 10646) / 10631);
  return islamicYear;
}

 function gregorianToPersian(gDate) {
  const persianEpoch = 226895; // Julian Day of Persian Epoch
  const jd = Math.floor((gDate - new Date(1970, 0, 1)) / (24 * 60 * 60 * 1000)) + 2440588;
  const persianYear = Math.floor((jd - persianEpoch) / 365.2421985) + 1;
  return persianYear;
}

app.get('/calendar', (req, res) => {
  // Get the date from query or default to today
  const queryDate = req.query.date ? new Date(req.query.date) : new Date();

  // Extract the year and month from the date
  const year = queryDate.getFullYear();
  const month = queryDate.getMonth(); // 0 (January) to 11 (December)

  const monthOffset = parseInt(req.query.month) || 0; 
  const newDate = new Date(year, month + monthOffset, 1); 
  const newYear = newDate.getFullYear();
  const newMonth = newDate.getMonth();

  const firstDay = new Date(newYear, newMonth, 1);
  const firstDayWeekday = firstDay.getDay(); // Day of the week (0-6)

  const days = Array.from({ length: 42 }, (_, i) => {
    const day = new Date(newYear, newMonth, i - firstDayWeekday + 1);
    return (day.getMonth() === newMonth) ? day : null;
  });

  const islamicYear = gregorianToIslamic(newDate);
  const persianYear = gregorianToPersian(newDate);

  renderTemplate(res, req, "calendar.ejs", {
     year: newYear,
    islamicYear,
    persianYear,
    currentDate: newDate,
    days,
    month: newMonth,
    queryDate,
  });
});


  app.get("/offline", function (req, res) {
    res.sendFile("offline.html", { root: location_pwa });
  });

  app.get("/manifest.json", function (req, res) {
    res.sendFile("manifest.json", { root: location_pwa });
  });

  app.get("/customize", function (req, res) {
    const tab = req.query.tab;

    renderTemplate(res, req, "custom-css.ejs", {
      tab,
    });
  });

  const cssDir = "./css/";

  app.get("/favicon.ico", function (req, res) {
    res.sendFile("favicon-new.ico", { root: cssDir });
  });
  app.get("/bg-full.webm", function (req, res) {
    res.sendFile("bg-full.webm", { root: cssDir });
  });
  app.get("/bg-720.webm", function (req, res) {
    res.sendFile("bg-720.webm", { root: cssDir });
  });
  app.get("/bg-480.webm", function (req, res) {
    res.sendFile("bg-480.webm", { root: cssDir });
  });

  app.get("/css/:id", (req, res) => {
    const filePath = path.join(cssDir, req.params.id);
    if (!fs.existsSync(filePath)) {
      res.status(404)
      renderTemplate(res, req, "404.ejs", { });
      return;
    }
    if (req.params.id.endsWith(".css") && !req.query.nomin) {
      // Minimize the CSS file
      const css = fs.readFileSync(filePath, "utf8");
      const minimizedCss = new CleanCSS().minify(css).styles;
      // Serve the minimized CSS file
      res.header("Content-Type", "text/css");
     res.send(
  notice + " " + minimizedCss.replace(/https:\/\/p\.poketube\.fun\//g, config.p_url + "/")
);
    } else {
      // Serve the original file
      res.sendFile(req.params.id, { root: html_location });
    }

    if (req.params.id.endsWith(".js")) {
      res.redirect("/static/" + req.params.id);
    }
  });

app.get("/game-hub", function (req, res) {
  var gameslist = ["pong", "tic-tac-toe", "sudoku", "snake", "breakout", "minesweeper"];
  var requestedGame = req.query.game;

  if (req.query.game && !gameslist.includes(requestedGame)) {
    return renderTemplate(res, req, "404.ejs");
  }

  renderTemplate(res, req, "gamehub.ejs", {
    game: requestedGame,
  });
});


  app.get("/static/:id", (req, res) => {
    const id = req.params.id;

    if (id.endsWith(".css")) {
      res.redirect("/css/" + id);
    } else if (id.endsWith(".js")) {
      if (id.endsWith(".bundle.js")) {
        const jsFiles = ["app.js", "custom-css.js"];
        const combinedContent = jsFiles
          .map((fileName) => {
            const filePath = path.join(html_location, fileName);
            return fs.existsSync(filePath)
              ? fs.readFileSync(filePath, "utf-8")
              : "";
          })
          .join("\n" + "\n");

        const minimizedJs = require("uglify-js").minify(combinedContent).code;

        res.header("Content-Type", "text/javascript");
        res.send(
          "// @license magnet:?xt=urn:btih:1f739d935676111cfff4b4693e3816e664797050&dn=gpl-3.0.txt GPL-3.0-or-later" +
            `\n` +
            `// Includes app.js and custom-css.js. Source code can be found for these two files in https://codeberg.org/ashley/poke/src/branch/main/css/` +
            `\n` +
            minimizedJs +
            `\n` +
            "// @license-end"
        );
      } else {
        const filePath = path.join(html_location, id);

        if (!fs.existsSync(filePath)) {
          res.status(404)
          renderTemplate(res, req, "404.ejs", { });
          return;
        }

        const js = fs.readFileSync(filePath, "utf8");
        const minimizedJs = require("uglify-js").minify(js).code;

        res.header("Content-Type", "text/javascript");
        res.send(
          "// @license magnet:?xt=urn:btih:1f739d935676111cfff4b4693e3816e664797050&dn=gpl-3.0.txt GPL-3.0-or-later" +
            `\n` +
            `// Source code can be found in: https://codeberg.org/ashley/poke/src/branch/main/css/${id}` +
            `\n` +
            minimizedJs +
            `\n` +
            "// @license-end"
        );
      }
    } else {
      res.sendFile(id, { root: html_location });
    }
  });
};
