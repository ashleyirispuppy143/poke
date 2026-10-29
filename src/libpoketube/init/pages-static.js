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

/**
 * Returns a random integer between min (inclusive) and max (inclusive).
 */
function getWholeRandom(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
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
app.get("/pride", (req, res) => {
  renderTemplate(res, req, "pride.ejs");
});
app.get("/policies", (req, res) => {
  renderTemplate(res, req, "terms.ejs");
});
app.get("/legal-yada-yada", (req, res) => {
res.redirect("/policies")
});
  app.get("/legal-jibber-jabber", (req, res) => {
res.redirect("/policies")
  });
app.get("/request", (req, res) => {
  renderTemplate(res, req, "legal.ejs");
});

  app.get("/502", function (req, res) {
    renderTemplate(res, req, "502.ejs");
  });

  app.get("/player-settings", (req, res) => {
  renderTemplate(res, req, "playerconfig.ejs");
});
 
app.get("/143", (req, res) => {
  const numberEasterEgg = getWholeRandom(1, 143);

  const { number, something } = req.query;

  const shouldRender =
    numberEasterEgg === 143 ||
    number === "143" ||
    something === "143";

  if (shouldRender) {
    return renderTemplate(res, req, "143.ejs", { something });
  }

  return res.redirect(`/home`);
});
  
function formatAirQualitySummary(aqData) {
  if (!aqData || !aqData.current) return null;
  const cur = aqData.current;

  const usAqi = cur.us_aqi ?? null;
  const euAqi = cur.european_aqi ?? null;

  let aqiLabel = "Unknown";
  if (usAqi !== null) {
    if (usAqi <= 50) aqiLabel = "Good";
    else if (usAqi <= 100) aqiLabel = "Moderate";
    else if (usAqi <= 150) aqiLabel = "Unhealthy for Sensitive Groups";
    else if (usAqi <= 200) aqiLabel = "Unhealthy";
    else if (usAqi <= 300) aqiLabel = "Very Unhealthy";
    else aqiLabel = "Hazardous";
  }

  const pollenTypes = [
    { key: "alder_pollen", name: "Alder", value: cur.alder_pollen ?? null },
    { key: "birch_pollen", name: "Birch", value: cur.birch_pollen ?? null },
    { key: "grass_pollen", name: "Grass", value: cur.grass_pollen ?? null },
    { key: "mugwort_pollen", name: "Mugwort", value: cur.mugwort_pollen ?? null },
    { key: "olive_pollen", name: "Olive", value: cur.olive_pollen ?? null },
    { key: "ragweed_pollen", name: "Ragweed", value: cur.ragweed_pollen ?? null }
  ];

  const validPollens = pollenTypes.filter(p => p.value !== null && !Number.isNaN(Number(p.value)));
  let maxPollen = null;
  let dominantPollen = null;

  if (validPollens.length > 0) {
    dominantPollen = validPollens.reduce((max, item) => (item.value > max.value ? item : max), validPollens[0]);
    maxPollen = dominantPollen.value;
  }

  let pollenLevel = "Unavailable";
  if (maxPollen !== null) {
    if (maxPollen === 0) pollenLevel = "None";
    else if (maxPollen <= 10) pollenLevel = "Low";
    else if (maxPollen <= 50) pollenLevel = "Moderate";
    else if (maxPollen <= 200) pollenLevel = "High";
    else pollenLevel = "Very High";
  }

  return {
    usAqi,
    euAqi,
    aqiLabel,
    pm25: cur.pm2_5 ?? null,
    pm10: cur.pm10 ?? null,
    no2: cur.nitrogen_dioxide ?? null,
    o3: cur.ozone ?? null,
    so2: cur.sulphur_dioxide ?? null,
    co: cur.carbon_monoxide ?? null,
    dust: cur.dust ?? null,
    pollenLevel,
    maxPollen,
    dominantPollen: dominantPollen && dominantPollen.value > 0 ? dominantPollen.name : null,
    pollenBreakdown: {
      alder: cur.alder_pollen ?? null,
      birch: cur.birch_pollen ?? null,
      grass: cur.grass_pollen ?? null,
      mugwort: cur.mugwort_pollen ?? null,
      olive: cur.olive_pollen ?? null,
      ragweed: cur.ragweed_pollen ?? null
    },
    hourly: aqData.hourly || null
  };
}

function formatMarineSummary(marineData, units = "metric") {
  if (!marineData || !marineData.current) return null;
  const cur = marineData.current;
  const daily = marineData.daily || {};
  const hourly = marineData.hourly || {};

  const waveHeight = cur.wave_height ?? null;
  const seaTemp = cur.sea_surface_temperature ?? null;
  const swellHeight = cur.swell_wave_height ?? null;
  const currentVelocity = cur.ocean_current_velocity ?? null;

  const hasValidHourlyWave = Array.isArray(hourly.wave_height) && hourly.wave_height.some(v => v !== null && !Number.isNaN(Number(v)));
  const hasSeaAccess =
    (waveHeight !== null && !Number.isNaN(Number(waveHeight))) ||
    (seaTemp !== null && !Number.isNaN(Number(seaTemp))) ||
    (swellHeight !== null && !Number.isNaN(Number(swellHeight))) ||
    hasValidHourlyWave;

  if (!hasSeaAccess) {
    return { hasSeaAccess: false };
  }

  const isImp = units === "imperial";
  const waveHeightMeters = waveHeight !== null ? (isImp ? waveHeight * 0.3048 : waveHeight) : null;

  let seaStateLabel = "Calm";
  if (waveHeightMeters !== null) {
    if (waveHeightMeters < 0.1) seaStateLabel = "Calm (Glassy)";
    else if (waveHeightMeters < 0.5) seaStateLabel = "Smooth";
    else if (waveHeightMeters < 1.25) seaStateLabel = "Slight";
    else if (waveHeightMeters < 2.5) seaStateLabel = "Moderate";
    else if (waveHeightMeters < 4.0) seaStateLabel = "Rough";
    else if (waveHeightMeters < 6.0) seaStateLabel = "Very Rough";
    else seaStateLabel = "High Seas";
  }

  return {
    hasSeaAccess: true,
    seaStateLabel,
    waveHeight,
    waveDirection: cur.wave_direction ?? null,
    wavePeriod: cur.wave_period ?? null,
    windWaveHeight: cur.wind_wave_height ?? null,
    windWaveDirection: cur.wind_wave_direction ?? null,
    windWavePeriod: cur.wind_wave_period ?? null,
    swellWaveHeight: swellHeight,
    swellWaveDirection: cur.swell_wave_direction ?? null,
    swellWavePeriod: cur.swell_wave_period ?? null,
    oceanCurrentVelocity: currentVelocity,
    oceanCurrentDirection: cur.ocean_current_direction ?? null,
    seaSurfaceTemperature: seaTemp,
    dailyWaveMax: daily.wave_height_max?.[0] ?? null,
    dailyDirectionDominant: daily.wave_direction_dominant?.[0] ?? null,
    dailyPeriodMax: daily.wave_period_max?.[0] ?? null,
    hourly: {
      time: hourly.time || [],
      wave_height: hourly.wave_height || [],
      wave_direction: hourly.wave_direction || [],
      wave_period: hourly.wave_period || [],
      sea_surface_temperature: hourly.sea_surface_temperature || []
    }
  };
}

app.get("/api/air-quality", async (req, res) => {
  try {
    const lat = req.query.latitude ?? req.query.lat;
    const lon = req.query.longitude ?? req.query.lon;
    if (lat === undefined || lon === undefined) {
      return res.status(400).json({ error: "Missing latitude or longitude" });
    }

    const aqUrl = new URL("https://air-quality-api.open-meteo.com/v1/air-quality");
    aqUrl.searchParams.set("latitude", lat);
    aqUrl.searchParams.set("longitude", lon);
    aqUrl.searchParams.set(
      "current",
      "us_aqi,european_aqi,pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone,dust,uv_index,alder_pollen,birch_pollen,grass_pollen,mugwort_pollen,olive_pollen,ragweed_pollen"
    );
    aqUrl.searchParams.set(
      "hourly",
      "us_aqi,european_aqi,pm2_5,pm10,alder_pollen,birch_pollen,grass_pollen,mugwort_pollen,olive_pollen,ragweed_pollen"
    );
    aqUrl.searchParams.set("timezone", "auto");
    aqUrl.searchParams.set("forecast_days", "3");

    const r = await fetch(aqUrl.toString());
    if (!r.ok) throw new Error("air quality fetch failed");
    const rawAq = await r.json();

    return res.json({
      ...rawAq,
      summary: formatAirQualitySummary(rawAq)
    });
  } catch (err) {
    return res.status(502).json({ error: "Failed to fetch air quality data" });
  }
});

app.get("/api/marine", async (req, res) => {
  try {
    const lat = req.query.latitude ?? req.query.lat;
    const lon = req.query.longitude ?? req.query.lon;
    if (lat === undefined || lon === undefined) {
      return res.status(400).json({ error: "Missing latitude or longitude" });
    }

    const units = req.query.units === "imperial" ? "imperial" : "metric";
    const tempUnit = units === "imperial" ? "fahrenheit" : "celsius";
    const lengthUnit = units === "imperial" ? "imperial" : "metric";

    const marineUrl = new URL("https://marine-api.open-meteo.com/v1/marine");
    marineUrl.searchParams.set("latitude", lat);
    marineUrl.searchParams.set("longitude", lon);
    marineUrl.searchParams.set(
      "current",
      "wave_height,wave_direction,wave_period,wind_wave_height,wind_wave_direction,wind_wave_period,swell_wave_height,swell_wave_direction,swell_wave_period,ocean_current_velocity,ocean_current_direction,sea_surface_temperature"
    );
    marineUrl.searchParams.set(
      "hourly",
      "wave_height,wave_direction,wave_period,swell_wave_height,ocean_current_velocity,sea_surface_temperature"
    );
    marineUrl.searchParams.set(
      "daily",
      "wave_height_max,wave_direction_dominant,wave_period_max,swell_wave_height_max"
    );
    marineUrl.searchParams.set("timezone", "auto");
    marineUrl.searchParams.set("forecast_days", "7");
    marineUrl.searchParams.set("temperature_unit", tempUnit);
    marineUrl.searchParams.set("length_unit", lengthUnit);

    const r = await fetch(marineUrl.toString());
    if (!r.ok) {
      return res.json({ summary: { hasSeaAccess: false } });
    }
    const rawMarine = await r.json();

    return res.json({
      ...rawMarine,
      summary: formatMarineSummary(rawMarine, units)
    });
  } catch (err) {
    return res.json({ summary: { hasSeaAccess: false } });
  }
});

app.get("/weather", async (req, res) => {
  try {
    const q = (req.query.q || "").trim();
    const rawLat = req.query.lat !== undefined && req.query.lat !== "" ? Number(req.query.lat) : null;
    const rawLon = req.query.lon !== undefined && req.query.lon !== "" ? Number(req.query.lon) : null;
    const lat = rawLat !== null && !Number.isNaN(rawLat) ? rawLat : null;
    const lon = rawLon !== null && !Number.isNaN(rawLon) ? rawLon : null;
    const units = req.query.units === "imperial" ? "imperial" : "metric";
    const tempUnit = units === "metric" ? "celsius" : "fahrenheit";
    const windUnit = units === "metric" ? "kmh" : "mph";
    const windUnitLabel = units === "metric" ? "km/h" : "mph";
    const lengthUnit = units === "metric" ? "metric" : "imperial";
    const tf = req.query.tf === "12h" ? "12h" : "24h";
    const anon = req.query.anon === "1" || req.query.anon === "true";
    const theme = req.query.theme === "light" ? "light" : "dark";

    const nominatimHeaders = {
      "Accept-Language": req.headers["accept-language"] || "en",
      "User-Agent": "PokeWeather/1.0 (https://initiative.poketube.fun)"
    };

    let place = { name: null, lat: null, lon: null };

    const coordMatch = q.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);

    if (lat != null && lon != null) {
      place = { name: (req.query.name || "").trim() || `${lat.toFixed(3)}, ${lon.toFixed(3)}`, lat, lon };
      if (!req.query.name) {
        try {
          const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`, {
            headers: nominatimHeaders
          });
          if (r.ok) {
            const j = await r.json();
            place.name = (j.display_name || "").split(",").slice(0, 2).map(s => s.trim()).join(", ") || place.name;
          }
        } catch {}
      }
    } else if (coordMatch) {
      const parsedLat = Number(coordMatch[1]);
      const parsedLon = Number(coordMatch[2]);
      place = { name: `${parsedLat.toFixed(3)}, ${parsedLon.toFixed(3)}`, lat: parsedLat, lon: parsedLon };
      try {
        const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${parsedLat}&lon=${parsedLon}`, {
          headers: nominatimHeaders
        });
        if (r.ok) {
          const j = await r.json();
          place.name = (j.display_name || "").split(",").slice(0, 2).map(s => s.trim()).join(", ") || place.name;
        }
      } catch {}
    } else if (q) {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&addressdetails=1&q=${encodeURIComponent(q)}`, {
        headers: nominatimHeaders
      });
      const arr = r.ok ? await r.json() : [];
      if (!arr[0]) {
        return renderTemplate(res, req, "weather.ejs", {
          ssr: { forceNoJS: true, name: "Not found", units, tf, anon, theme }
        });
      }
      place = {
        name: (arr[0].display_name || "").split(",").slice(0, 2).map(s => s.trim()).join(", "),
        lat: Number(arr[0].lat),
        lon: Number(arr[0].lon)
      };
    } else {
      return renderTemplate(res, req, "weather.ejs", {
        ssr: { forceNoJS: true, name: "Choose a location", units, tf, anon, theme }
      });
    }

    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", place.lat);
    url.searchParams.set("longitude", place.lon);
    url.searchParams.set("current", "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m,wind_direction_10m,pressure_msl");
    url.searchParams.set("hourly", "temperature_2m,apparent_temperature,precipitation_probability,precipitation,weather_code,wind_speed_10m");
    url.searchParams.set("daily", "weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max");
    url.searchParams.set("timezone", "auto");
    url.searchParams.set("forecast_days", "7");
    url.searchParams.set("temperature_unit", tempUnit);
    url.searchParams.set("windspeed_unit", windUnit);

    const aqUrl = new URL("https://air-quality-api.open-meteo.com/v1/air-quality");
    aqUrl.searchParams.set("latitude", place.lat);
    aqUrl.searchParams.set("longitude", place.lon);
    aqUrl.searchParams.set(
      "current",
      "us_aqi,european_aqi,pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone,dust,uv_index,alder_pollen,birch_pollen,grass_pollen,mugwort_pollen,olive_pollen,ragweed_pollen"
    );
    aqUrl.searchParams.set(
      "hourly",
      "us_aqi,european_aqi,pm2_5,pm10,alder_pollen,birch_pollen,grass_pollen,mugwort_pollen,olive_pollen,ragweed_pollen"
    );
    aqUrl.searchParams.set("timezone", "auto");
    aqUrl.searchParams.set("forecast_days", "3");

    const marineUrl = new URL("https://marine-api.open-meteo.com/v1/marine");
    marineUrl.searchParams.set("latitude", place.lat);
    marineUrl.searchParams.set("longitude", place.lon);
    marineUrl.searchParams.set(
      "current",
      "wave_height,wave_direction,wave_period,wind_wave_height,wind_wave_direction,wind_wave_period,swell_wave_height,swell_wave_direction,swell_wave_period,ocean_current_velocity,ocean_current_direction,sea_surface_temperature"
    );
    marineUrl.searchParams.set(
      "hourly",
      "wave_height,wave_direction,wave_period,swell_wave_height,ocean_current_velocity,sea_surface_temperature"
    );
    marineUrl.searchParams.set(
      "daily",
      "wave_height_max,wave_direction_dominant,wave_period_max,swell_wave_height_max"
    );
    marineUrl.searchParams.set("timezone", "auto");
    marineUrl.searchParams.set("forecast_days", "7");
    marineUrl.searchParams.set("temperature_unit", tempUnit);
    marineUrl.searchParams.set("length_unit", lengthUnit);

    const [wr, aqr, mr] = await Promise.all([
      fetch(url.toString()),
      fetch(aqUrl.toString()).catch(() => null),
      fetch(marineUrl.toString()).catch(() => null)
    ]);

    if (!wr.ok) throw new Error("weather fetch failed");
    const data = await wr.json();

    let airQuality = null;
    if (aqr && aqr.ok) {
      try {
        const aqJson = await aqr.json();
        airQuality = formatAirQualitySummary(aqJson);
      } catch {}
    }

    let marine = null;
    if (mr && mr.ok) {
      try {
        const marineJson = await mr.json();
        marine = formatMarineSummary(marineJson, units);
      } catch {}
    }

    const codeText = (c) => {
      if ([0].includes(c)) return "Clear sky";
      if ([1].includes(c)) return "Mostly clear";
      if ([2].includes(c)) return "Partly cloudy";
      if ([3].includes(c)) return "Overcast";
      if ([45, 48].includes(c)) return "Fog";
      if ([51, 53, 55].includes(c)) return "Drizzle";
      if ([56, 57].includes(c)) return "Freezing drizzle";
      if ([61, 63, 65].includes(c)) return "Rain";
      if ([66, 67].includes(c)) return "Freezing rain";
      if ([71, 73, 75].includes(c)) return "Snow";
      if ([77].includes(c)) return "Snow grains";
      if ([80, 81, 82].includes(c)) return "Showers";
      if ([85, 86].includes(c)) return "Snow showers";
      if ([95].includes(c)) return "Thunderstorm";
      if ([96, 99].includes(c)) return "Storm & hail";
      return "-";
    };

    const codeIcon = (c, isDay) => {
      if (c === 0) return isDay ? "☀️" : "🌙";
      if ([1, 2].includes(c)) return isDay ? "🌤️" : "☁️";
      if ([3].includes(c)) return "☁️";
      if ([45, 48].includes(c)) return "🌫️";
      if ([51, 53, 55, 80, 81, 82].includes(c)) return "🌦️";
      if ([61, 63, 65].includes(c)) return "🌧️";
      if ([66, 67].includes(c)) return "🌧️❄️";
      if ([71, 73, 75, 77, 85, 86].includes(c)) return "❄️";
      if ([95, 96, 99].includes(c)) return "⛈️";
      return "☁️";
    };

    const cur = data.current || {};
    const daily = data.daily || { time: [] };
    const hourly = data.hourly || { time: [] };

    let popNext = null;
    try {
      const idx = (hourly.time || []).findIndex(t => Date.parse(t) > Date.now());
      popNext = hourly.precipitation_probability?.[idx >= 0 ? idx : 0] ?? null;
    } catch {}

    const use12Hr = tf === "12h";
    const timeOpts = { hour: "2-digit", minute: "2-digit", hour12: use12Hr, hourCycle: use12Hr ? "h12" : "h23" };

    const ssr = {
      forceNoJS: Boolean(req.query.nojs),
      name: place.name,
      lat: place.lat,
      lon: place.lon,
      units,
      windUnit: windUnitLabel,
      tf,
      anon,
      theme,
      timezone: data.timezone,
      utc_offset_seconds: data.utc_offset_seconds,
      current: cur,
      daily: daily,
      hourly: hourly,
      airQuality,
      marine,
      icon: codeIcon(cur.weather_code, cur.is_day),
      desc: codeText(cur.weather_code),
      sunriseLocal: daily.sunrise?.[0] ? new Date(daily.sunrise[0]).toLocaleTimeString([], timeOpts) : "-",
      sunsetLocal: daily.sunset?.[0] ? new Date(daily.sunset[0]).toLocaleTimeString([], timeOpts) : "-",
      popNext,
      dailyIcons: (daily.weather_code || []).map(c => codeIcon(c, 1)),
      dailyTexts: (daily.weather_code || []).map(c => codeText(c)),
      dailyLabels: (daily.time || []).map((t, i) => i === 0 ? "Today" : new Date(t).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" }))
    };

    return renderTemplate(res, req, "weather.ejs", { ssr });
  } catch (err) {
    return renderTemplate(res, req, "weather.ejs", {
      ssr: { forceNoJS: true, name: "Error loading weather" }
    });
  }
});
  
app.get("/notepad", function (req, res) {
    renderTemplate(res, req, "pokepad.ejs");
  });

app.get("/translate", async function (req, res) {
  const text = req.query.input;
  const from = req.query.from_language || "auto";
  const to = req.query.to_language || "en";

  let translatedText = "";
  let pronunciation = "";
  let definitions = {};
  let translations = {};
  let detectedSourceLanguage = from;

  if (text) {
    try {
      const { fetch } = await import("undici");

      const endpoint = "https://translate.google.com/_/TranslateWebserverUi/data/batchexecute?rpcids=MkEWBc&rt=c";
      const reqJSON = [[text, from, to, true], [null]];
      const reqPayload = [[["MkEWBc", JSON.stringify(reqJSON), null, "generic"]]];
      const body = "f.req=" + encodeURIComponent(JSON.stringify(reqPayload));

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded;charset=utf-8"
        },
        body
      });

      const responseText = await response.text();
      const match = responseText.match(/\n\d+\n(.*)\n\d+\n/);

      if (match?.[1]) {
        const raw = JSON.parse(match[1]);
        const data = raw?.[0]?.[2];

        if (data) {
          const json_ = JSON.parse(data);

          const variant = json_?.[1]?.[0]?.[0];
          if (Array.isArray(variant)) {
            if (Array.isArray(variant[5])) {
              for (const segment of variant[5]) {
                if (segment?.[2] === true && translatedText !== "") {
                  translatedText += " ";
                }
                if (segment?.[0]) {
                  translatedText += segment[0];
                }
              }
            } else if (variant[0] != null) {
              translatedText = variant[0];
            }
          }

          if (json_?.[0]?.[2] != null) detectedSourceLanguage = json_[0][2];
          if (json_?.[1]?.[0]?.[0]?.[1] != null) pronunciation = json_[1][0][0][1];

          const defGroups = json_?.[3]?.[1]?.[0];
          if (Array.isArray(defGroups)) {
            for (const group of defGroups) {
              if (Array.isArray(group) && group.length > 0) {
                const defType = group[0] ?? "unknown";
                definitions[defType] = [];

                if (Array.isArray(group[1])) {
                  for (const defBox of group[1]) {
                    const entry = {};
                    if (defBox?.[4]?.[0]?.[0] != null) entry.dictionary = defBox[4][0][0];
                    if (defBox?.[0] != null) entry.definition = defBox[0];
                    if (defBox?.[1] != null) entry.use_in_sentence = defBox[1];

                    if (Array.isArray(defBox?.[5])) {
                      const synonymsMap = {};
                      for (const synBox of defBox[5]) {
                        const synType = synBox?.[1]?.[0]?.[0] ?? "";
                        if (Array.isArray(synBox?.[0])) {
                          synonymsMap[synType] = synBox[0].map(w => w?.[0]).filter(Boolean);
                        }
                      }
                      entry.synonyms = synonymsMap;
                    }
                    definitions[defType].push(entry);
                  }
                }
              }
            }
          }

          const transBox = json_?.[3]?.[5]?.[0];
          if (Array.isArray(transBox)) {
            for (const box of transBox) {
              if (Array.isArray(box) && box.length > 0) {
                const transType = box[0] ?? "unknown";
                translations[transType] = {};

                if (Array.isArray(box[1])) {
                  for (const item of box[1]) {
                    const name = item?.[0];
                    if (name != null) {
                      translations[transType][name] = {};
                      if (item?.[3] != null) {
                        let freq = String(Math.trunc(Number(item[3])));
                        if (freq === "3") freq = "1";
                        else if (freq === "1") freq = "3";

                        translations[transType][name].frequency = `${freq}/3`;
                        translations[transType][name].words = Array.isArray(item[2]) ? item[2] : [];
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    } catch (err) {
      console.error("Translation error:", err);
    }
  }

  renderTemplate(res, req, "translate.ejs", {
    translation: translatedText,
    text: req.query.input || "enter text here",
    from_language: req.query.from_language,
    to_language: req.query.to_language,
    isMobile: req.useragent?.isMobile,
    pronunciation,
    definitions,
    translations,
    detected_language: detectedSourceLanguage === "auto" ? "" : detectedSourceLanguage
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
  req.app.locals.playlistRateLimits = req.app.locals.playlistRateLimits || new Map();
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const nowTime = Date.now();
  const userRateInfo = req.app.locals.playlistRateLimits.get(ip) || { count: 0, firstRequest: nowTime };

  if (nowTime - userRateInfo.firstRequest > 60000) {
    userRateInfo.count = 1;
    userRateInfo.firstRequest = nowTime;
  } else {
    userRateInfo.count++;
    if (userRateInfo.count > 40) {
      return res.status(429).send("Too Many Requests");
    }
  }
  req.app.locals.playlistRateLimits.set(ip, userRateInfo);

  if (req.app.locals.playlistRateLimits.size > 10000) {
    req.app.locals.playlistRateLimits.clear();
  }

  if (!req.query.list) return res.redirect("/");
  if (req.useragent && req.useragent.isMobile) return res.redirect("/");

  const mediaproxy = config.media_proxy;

  let p = null;
  let lastError = null;
  let attempts = 0;

  while (attempts < 3) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const playlist = await fetch(`${config.invapi}/playlists/${req.query.list}?hl=en-us`, {
        headers: typeof headers !== 'undefined' ? headers : {},
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!playlist.ok) {
        throw new Error(`HTTP ${playlist.status}`);
      }

      const text = await playlist.text();
      p = getJson(text);
      
      if (p) break;
    } catch (error) {
      lastError = error;
      
       if (error.message === "HTTP 404") {
        break;
      }
      
      attempts++;
    }
  }

  if (!p) {
     if (lastError && lastError.message === "HTTP 404") {
      return res.redirect("/home");
    }

    const errorStack = lastError ? (lastError.stack || lastError.message || String(lastError)) : "Failed to load playlist after retries.";
    const htmlErrorPage = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Playlist Error</title>
          <style>
              body { margin: 0; font-family: Roboto, Arial, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; text-align: center; background-color: #000000; color: #ffffff; padding: 20px; box-sizing: border-box; }
              .error-container { display: flex; flex-direction: column; align-items: center; max-width: 600px; width: 100%; }
              h2 { font-weight: 400; font-size: 28px; margin-bottom: 16px; margin-top: 0; }
              .error-details { font-size: 14px; color: #aaaaaa; white-space: pre-wrap; word-wrap: break-word; margin-bottom: 24px; font-family: inherit; }
              .btn { background-color: #ffffff; color: #000000; padding: 0 20px; height: 36px; line-height: 36px; border-radius: 18px; text-decoration: none; font-size: 14px; font-weight: 500; transition: background-color 0.2s; }
              .btn:hover { background-color: #e5e5e5; }
          </style>
      </head>
      <body>
          <div class="error-container">
              <h2>Playlist Failed</h2>
              <div class="error-details">${errorStack}</div>
              <a href="/" class="btn">Go Home</a>
          </div>
      </body>
      </html>
    `;
    return res.status(500).send(htmlErrorPage);
  }

  renderTemplate(res, req, "playlist.ejs", { p, mediaproxy });
});


  app.get("/license", function (req, res) {
    renderTemplate(res, req, "license.ejs");
  });

app.get("/gifs", async function (req, res) {
    const query = req.query.q || "";
    const pos = req.query.pos || "";
    const mediaproxy = `${config.media_proxy}/proxy?url=`;
    const API_KEY = "3Z0688EVWYKH";
    const LIMIT = 30;
    const searchAliases = { "yaoi": "boys kissing anime" };
    const apiQuery = searchAliases[query.toLowerCase().trim()] || query;
    
    let apiUrl = apiQuery 
        ? `https://g.tenor.com/v1/search?q=${encodeURIComponent(apiQuery)}&key=${API_KEY}&limit=${LIMIT}` 
        : `https://g.tenor.com/v1/trending?key=${API_KEY}&limit=${LIMIT}`;
    
    if (pos) apiUrl += `&pos=${pos}`;

    try {
        const [gifsRes, catsRes] = await Promise.all([
            fetch(apiUrl),
            fetch(`https://g.tenor.com/v1/categories?key=${API_KEY}`)
        ]);
        
        const gifsData = await gifsRes.json();
        const catsData = await catsRes.json();
        
        const results = gifsData.results || [];
        const next = gifsData.next || "";
        const categories = (catsData.tags || []).slice(0, 15).map(t => t.searchterm);

        renderTemplate(res, req, "gifs.ejs", { mediaproxy, results, categories, query, next });
    } catch (error) {
        renderTemplate(res, req, "gifs.ejs", { mediaproxy, results: [], categories: [], query, next: "" });
    }
});

app.get("/api/tenor", async function (req, res) {
    try {
        const endpoint = req.query.endpoint || "search";
        const API_KEY = "3Z0688EVWYKH";
        const searchAliases = { "yaoi": "boys kissing anime" };
        
        const url = new URL(`https://g.tenor.com/v1/${endpoint}`);
        for (const [key, value] of Object.entries(req.query)) {
            if (key !== "endpoint" && key !== "q") {
                url.searchParams.append(key, value);
            }
        }
        
        if (req.query.q) {
            const apiQuery = searchAliases[req.query.q.toLowerCase().trim()] || req.query.q;
            url.searchParams.append("q", apiQuery);
        }
        
        if (!url.searchParams.has("key")) {
            url.searchParams.append("key", API_KEY);
        }
        
        const response = await fetch(url);
        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: "API Error" });
    }
});
  


  app.get("/map", function (req, res) {
    renderTemplate(res, req, "map.ejs");
  });

  app.get("/credits", function (req, res) {
    renderTemplate(res, req, "want-you-gone.ejs");
  });

  app.get("/settings", function (req, res) {
   res.redirect(301, "/player-settings");

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
  const requestedId = req.params.id;
  const fileId = requestedId === "yt-ukraine.svg" ? "poke-icon-logo.svg" : requestedId;
  const filePath = path.join(cssDir, fileId);

  if (!fs.existsSync(filePath)) {
    res.status(404);
    return renderTemplate(res, req, "404.ejs", {
	isMobile:req.useragent?.isMobile,
	});
    return;
  }

  if (fileId.endsWith(".js")) {
    res.redirect("/static/" + fileId);
    return;
  }

  if (fileId.endsWith(".css") && !req.query.nomin) {
    const css = fs.readFileSync(filePath, "utf8");
    const minimizedCss = new CleanCSS().minify(css).styles;

    res.header("Content-Type", "text/css");
    res.send(
      notice + " " + minimizedCss.replace(/https:\/\/p\.poketube\.fun\//g, config.p_url + "/")
    );
    return;
  }

  res.sendFile(fileId, { root: cssDir });
});
  
app.get("/game-hub", function (req, res) {
  var gameslist = ["pong", "tic-tac-toe", "sudoku", "snake", "breakout", "minesweeper", "match3"];
  var requestedGame = req.query.game;

  if (req.query.game && !gameslist.includes(requestedGame)) {
  return renderTemplate(res, req, "404.ejs", {
	          isMobile:req.useragent?.isMobile,
	        });
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
            `// Includes app.js and custom-css.js. Source code can be found for these two files in https://codeberg.org/ashleyirispuppy/poke/src/branch/main/css/` +
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
            `// Source code can be found in: https://codeberg.org/ashleyirispuppy/poke/src/branch/main/css/${id}` +
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
