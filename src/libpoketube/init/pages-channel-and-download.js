const {
  fetcher,
  core,
  wiki,
  musicInfo,
  modules,
  version,
  initlog,
  init,
} = require("../libpoketube-initsys.js");
const { curly } = require("node-libcurl");

const {
  IsJsonString,
  convert,
  getFirstLine,
  capitalizeFirstLetter,
  turntomins,
  getRandomInt,
  getRandomArbitrary,
} = require("../ptutils/libpt-coreutils.js");

const sha384 = modules.hash;

const serverGeneration = Date.now().toString(36);
let currentEpoch = Date.now();

/**
 * Parses a string to JSON, returns null if parsing fails.
 * @param {string} str - The input string to be parsed as JSON.
 * @returns {Object|null} - The parsed JSON object or null if parsing fails.
 */
function getJson(str) {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

/**
 * Object representing base64-encoded values for channel tabs.
 * @typedef {Object} ChannelTabs
 * @property {string} community - Base64-encoded value for the community tab.
 * @property {string} shorts - Base64-encoded value for the shorts tab.
 * @property {string} videos - Base64-encoded value for the videos tab.
 * @property {string} streams - Base64-encoded value for the streams tab.
 */

const ChannelTabs = {
  community: "Y29tbXVuaXR5",
  shorts: "c2hvcnRz",
  videos: "dmlkZW9z",
  streams: "c3RyZWFtcw==",
  channels: "Y2hhbm5lbHM=",
  store: "c3RvcmU=",
  released: "cmVsZWFzZXM=",
  playlist: "cGxheWxpc3Rz",
};

module.exports = function (app, config, renderTemplate) {
  app.get("/download", async (req, res) => {
    try {
      const v = req.query.v;
      if (!v) res.redirect("/");
      const thumbnailUrl = `https://i.ytimg.com/vi/${v}/maxresdefault.jpg`;
      const colors = await modules.getColors(thumbnailUrl);
      const color = colors[0].hex();

      renderTemplate(res, req, "download.ejs", {
        v,
        color,
        isMobile: req.useragent.isMobile,
      });
    } catch (error) {
      res.redirect("/");
    }
  });

  app.get("/old/watch", async function (req, res) {
    var v = req.query.v;
    var e = req.query.e;
    if (!v) res.redirect("/");

    res.redirect(`/watch?v=${v}`);
  });

  app.get("/api/getchanneltabs", async function (req, res) {
    res.json(ChannelTabs);
  });
  
const searchCache = new Map();
  const activeSearchTasks = new Map();
  const searchRateLimitCache = new Map();

  const SEARCH_CACHE_TTL = 1800000;
  const SEARCH_RATE_LIMIT_WINDOW = 60000;
  const SEARCH_MAX_REQUESTS = 40;

  setInterval(() => {
    const now = Date.now();
    for (const [key, value] of searchCache.entries()) {
      if (now - value.timestamp >= SEARCH_CACHE_TTL) searchCache.delete(key);
    }
    for (const [ip, data] of searchRateLimitCache.entries()) {
      if (now - data.firstRequest > SEARCH_RATE_LIMIT_WINDOW) searchRateLimitCache.delete(ip);
    }
  }, 10 * 60 * 1000);

  app.get("/search", async (req, res) => {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const nowTime = Date.now();
    const requestEpoch = currentEpoch;
    const userRateInfo = searchRateLimitCache.get(ip) || { count: 0, firstRequest: nowTime };

    if (nowTime - userRateInfo.firstRequest > SEARCH_RATE_LIMIT_WINDOW) {
      userRateInfo.count = 1;
      userRateInfo.firstRequest = nowTime;
    } else {
      userRateInfo.count++;
      if (userRateInfo.count > SEARCH_MAX_REQUESTS) {
        return res.status(429).send("Too Many Requests");
      }
    }
    searchRateLimitCache.set(ip, userRateInfo);

    const { fetch } = await import("undici");
    const query = req.query.query;
    const tab = req.query.tab || "";
    var media_proxy = config.media_proxy;
    var uaos = req.useragent.os;
    var IsOldWindows = false;

    if (
      (uaos == "Windows 7" && req.useragent.browser == "Firefox") ||
      (uaos == "Windows 8" && req.useragent.browser == "Firefox")
    ) {
      IsOldWindows = true;
    }

    if (typeof query === "string") {
      const trimmedQuery = query.trim();
      let redirectUrl = null;

      const ytUrlMatch = trimmedQuery.match(/(?:youtube\.com\/watch\?.*v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
      const prefixMatch = trimmedQuery.match(/^(channel|video|watch):([a-zA-Z0-9_\-@]+)$/);

      if (ytUrlMatch) {
        redirectUrl = `/watch?v=${ytUrlMatch[1]}`;
      } else if (prefixMatch) {
        const type = prefixMatch[1];
        const id = prefixMatch[2];

        if (type === "channel") {
          redirectUrl = `/channel?id=${id}`;
        } else if ((type === "video" || type === "watch") && id.length === 11) {
          redirectUrl = `/watch?v=${id}`;
        }
      }

      if (redirectUrl) {
        return res.redirect(redirectUrl);
      }
    }

    if (query && query.startsWith("!") && query.length > 2) {
      return res.redirect("https://lite.duckduckgo.com/lite/?q=" + query);
    }

    if (query && query.startsWith("Hey ChatGPT,") && query.length > 2) {
      return res.redirect("https://chatgpt.com/?q=" + query + "- sent using pokeAI features");
    }

    if (!query) {
      return res.redirect("/home");
    }

    if (query === "DEBUG_SEARCHERROR_YOUSHOULDNTUSETHIS_THISISONLYFORTESTING_DONT_TRY_TO_USE_THIS_SUPER_SECRET_LONG_STRING_1234567890_NO_ONE_WILL_EVER_TYPE_THIS_EXACT_COMBINATION") {
      const htmlErrorPage = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Search Failed</title>
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
                <h2>Search Failed</h2>
                <div class="error-details">Error here</div>
                <a href="/" class="btn">Go Home</a>
            </div>
        </body>
        </html>
      `;
      return res.status(500).send(htmlErrorPage);
    }

    let continuation = req.query.continuation || "";
    let date = req.query.date || "";
    let type = req.query.type || "all";
    let duration = req.query.duration || "";
    let sort = req.query.sort || "";
    let from = req.query.from || "";

    const cacheKey = `${query}_${continuation}_${date}_${type}_${duration}_${sort}_${tab}_${from}`;

    const sendRenderedResponse = (xmlData) => {
      renderTemplate(res, req, "search.ejs", {
        invresults: xmlData,
        turntomins, 
        date,
        type,
        duration,
        sort,
        IsOldWindows,
        tab,
        continuation,
        media_proxy_url: media_proxy,
        results: "",
        q: query,
        summary: "",
      });
    };

    if (searchCache.has(cacheKey)) {
      const cached = searchCache.get(cacheKey);
      if (Date.now() - cached.timestamp < SEARCH_CACHE_TTL) {
        return sendRenderedResponse(cached.data);
      }
      searchCache.delete(cacheKey);
    }

    if (activeSearchTasks.has(cacheKey)) {
      try {
        const cachedData = await activeSearchTasks.get(cacheKey);
        if (currentEpoch !== requestEpoch) throw new Error("REQUEST_DROPPED");
        return sendRenderedResponse(cachedData);
      } catch (e) {
        if (e.message === "REQUEST_DROPPED") return res.status(499).send("Request dropped by server.");
      }
    }

    let searchUrl;
    if (from === "hashtag") {
      searchUrl = `${config.invapi}/hashtag/${query}?hl=en-gb&g=${serverGeneration}`;
    } else {
      searchUrl = `${config.invapi}/search?q=${encodeURIComponent(query)}&page=${encodeURIComponent(continuation)}&date=${date}&type=${type}&duration=${duration}&sort=${sort}&hl=en-US&region=US&g=${serverGeneration}`;
    }

    const executeFetch = async (fetchUrl) => {
      if (currentEpoch !== requestEpoch) throw new Error("REQUEST_DROPPED");
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      try {
        const response = await fetch(fetchUrl, {
          headers: {
            "User-Agent": config.useragent,
          },
          signal: controller.signal,
        });

        if (currentEpoch !== requestEpoch) throw new Error("REQUEST_DROPPED");

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const txt = await response.text();
        const parsedData = getJson(txt); 

        if (currentEpoch !== requestEpoch) throw new Error("REQUEST_DROPPED");

        if (!parsedData) {
          throw new Error("Parse failed");
        }

        return parsedData;
      } finally {
        clearTimeout(timeoutId);
      }
    };

    const performSearchProcess = async () => {
      let xmlData = null;
      let lastError = null;

      try {
        xmlData = await executeFetch(searchUrl);
      } catch (err1) {
        if (err1.message === "REQUEST_DROPPED") throw err1;
        lastError = err1;
        
        try {
          xmlData = await executeFetch(searchUrl);
        } catch (err2) {
          if (err2.message === "REQUEST_DROPPED") throw err2;
          lastError = err2;
          
          try {
            const modifiedQuery = query + "+";
            let modifiedSearchUrl;
            
            if (from === "hashtag") {
              modifiedSearchUrl = `${config.invapi}/hashtag/${modifiedQuery}?hl=en-gb&g=${serverGeneration}`;
            } else {
              modifiedSearchUrl = `${config.invapi}/search?q=${encodeURIComponent(modifiedQuery)}&page=${encodeURIComponent(continuation)}&date=${date}&type=${type}&duration=${duration}&sort=${sort}&hl=en-US&region=US&g=${serverGeneration}`;
            }
            
            xmlData = await executeFetch(modifiedSearchUrl);
          } catch (err3) {
            lastError = err3;
            throw lastError;
          }
        }
      }
      return xmlData;
    };

    const requestPromise = performSearchProcess();
    activeSearchTasks.set(cacheKey, requestPromise);

    try {
      const xmlData = await requestPromise;
      if (currentEpoch !== requestEpoch) throw new Error("REQUEST_DROPPED");

      searchCache.set(cacheKey, { data: xmlData, timestamp: Date.now() });
      activeSearchTasks.delete(cacheKey);
      
      return sendRenderedResponse(xmlData);
    } catch (error) {
      activeSearchTasks.delete(cacheKey);

      if (error && error.message === "REQUEST_DROPPED") {
        return res.status(499).send("Request cancelled by server.");
      }
      
      const errorStack = error ? (error.stack || error.message || String(error)) : "Unknown Error occurred during fetch operations.";
      
      const htmlErrorPage = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Search Failed</title>
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
                <h2>Search Failed</h2>
                <div class="error-details">${errorStack}</div>
                <a href="/" class="btn">Go Home</a>
            </div>
        </body>
        </html>
      `;
      
      res.status(500).send(htmlErrorPage);
    }
  });
  
  app.get("/im-feeling-lucky", function (req, res) {
    res.send("WIP");
  });

  let homeCache = { data: null, timestamp: 0 };
  let activeHomeFetch = null;
  const HOME_CACHE_TTL = 15 * 60 * 1000;

  app.get("/home", async (req, res) => {
    const now = Date.now();
    const isMobile = req.useragent?.isMobile || false;
    const requestEpoch = currentEpoch;

    if (homeCache.data && now - homeCache.timestamp < HOME_CACHE_TTL) {
      return renderTemplate(res, req, "home.ejs", { 
        inv: homeCache.data, 
        turntomins, 
        isMobile 
      });
    }

    if (activeHomeFetch) {
      try {
        const inv = await activeHomeFetch;
        if (currentEpoch !== requestEpoch) throw new Error("REQUEST_DROPPED");
        return renderTemplate(res, req, "home.ejs", { inv, turntomins, isMobile });
      } catch (e) {
        if (e.message === "REQUEST_DROPPED") return res.status(499).send("Request dropped by server.");
      }
    }

    const fetchHomeData = async () => {
      if (currentEpoch !== requestEpoch) throw new Error("REQUEST_DROPPED");
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      try {
        const response = await fetch(`${config.invapi}/trending?type=Gaming&hl=en-US&region=US&g=${serverGeneration}`, {
          headers: { "User-Agent": config.useragent },
          signal: controller.signal
        });

        if (currentEpoch !== requestEpoch) throw new Error("REQUEST_DROPPED");

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const text = await response.text();
        const inv = getJson(text);

        if (currentEpoch !== requestEpoch) throw new Error("REQUEST_DROPPED");
        if (!inv) throw new Error("Parse failed");

        return inv;
      } finally {
        clearTimeout(timeoutId);
      }
    };

    activeHomeFetch = fetchHomeData();

    try {
      const inv = await activeHomeFetch;
      if (currentEpoch !== requestEpoch) throw new Error("REQUEST_DROPPED");
      
      homeCache.data = inv;
      homeCache.timestamp = Date.now();
      activeHomeFetch = null;

      return renderTemplate(res, req, "home.ejs", { inv, turntomins, isMobile });
    } catch (error) {
      activeHomeFetch = null;
      if (error && error.message === "REQUEST_DROPPED") {
        return res.status(499).send("Request cancelled by server.");
      }
      
      const fallbackData = homeCache.data || [];
      return renderTemplate(res, req, "home.ejs", { 
        inv: fallbackData, 
        turntomins, 
        isMobile 
      });
    }
  });

  function channelurlfixer(text) {
    const regex = /<a\s+href="\/channel\/([^"]+)"/g;
    const updatedDescription = text.replace(regex, '<a href="/channel?id=$1"');
    return updatedDescription;
  }

  const channelCache = new Map();
  const fetchFailureCache = new Map();
  const activeRequests = new Map();
  const rateLimitCache = new Map();

  const FETCH_FAILURE_TTL = 3600000;
  const CACHE_TTL = 3600000;
  const RATE_LIMIT_WINDOW = 60000;
  const MAX_REQUESTS_PER_WINDOW = 40;

  let undiciFetch;

  setInterval(() => {
    const now = Date.now();
    for (const [key, value] of channelCache.entries()) {
      if (now - value.timestamp >= CACHE_TTL) channelCache.delete(key);
    }
    for (const [key, timestamp] of fetchFailureCache.entries()) {
      if (now - timestamp >= FETCH_FAILURE_TTL) fetchFailureCache.delete(key);
    }
    for (const [ip, data] of rateLimitCache.entries()) {
      if (now - data.firstRequest > RATE_LIMIT_WINDOW) rateLimitCache.delete(ip);
    }
  }, 10 * 60 * 1000);

  app.get("/channel/", async (req, res) => {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const nowTime = Date.now();
    const requestEpoch = currentEpoch;
    const userRateInfo = rateLimitCache.get(ip) || { count: 0, firstRequest: nowTime };

    if (nowTime - userRateInfo.firstRequest > RATE_LIMIT_WINDOW) {
      userRateInfo.count = 1;
      userRateInfo.firstRequest = nowTime;
    } else {
      userRateInfo.count++;
      if (userRateInfo.count > MAX_REQUESTS_PER_WINDOW) {
        return res.status(429).send("Too Many Requests");
      }
    }
    rateLimitCache.set(ip, userRateInfo);

    if (!undiciFetch) {
      const undici = await import("undici");
      undiciFetch = undici.fetch;
    }

    const fetch = undiciFetch;

    let media_proxy = config.media_proxy;
    if (req.useragent?.source?.includes("Pardus")) {
      media_proxy = "https://media-proxy.ashley0143.xyz";
    }

    let ID = req.query.id;
    if (!ID) {
      return renderTemplate(res, req, "404.ejs");
    }

    if (ID.endsWith("@youtube.com")) {
      ID = ID.slice(0, -12);
    } else if (ID.endsWith("@poketube.fun")) {
      ID = ID.slice(0, -13);
    }

    const tab = req.query.tab;
    const continuation = req.query.continuation || req.query.continuationl || req.query.continuations || "";
    const continuationParam = continuation ? `&continuation=${continuation}` : "";
    const sort_by = req.query.sort_by || "newest";

    const cacheKey = `${ID}_${sort_by}_${continuation}`;
    const now = Date.now();

    function getThumbnailUrl(video) {
      const maxres = video?.videoThumbnails?.find(t => t.quality === "maxresdefault");
      if (maxres) {
        return `https://vid.puffyan.us/vi/${video.videoId}/maxresdefault.jpg`;
      }
      return `https://vid.puffyan.us/vi/${video.videoId}/hqdefault.jpg`;
    }

    const sendRenderedResponse = (cachedData) => {
      const subsCached = convert(cachedData.cinv?.subCount || 0);
      return renderTemplate(res, req, "channel.ejs", {
        ID,
        tab,
        shorts: cachedData.shorts,
        firstVideo: { subCountText: "0", authorVerified: false },
        j: "",
        dnoreplace: "",
        sort: sort_by,
        channelurlfixer,
        stream: cachedData.stream,
        tj: cachedData.tj,
        c: cachedData.c,
        createdAccountGetDate: cachedData.createdAccountGetDate,
        cinv: cachedData.cinv,
        embedchannelsubsfeed: req.query.embedchannelsubsfeed,
        convert,
        turntomins,
        pronoun: "no pronouns :c",
        media_proxy_url: media_proxy,
        getThumbnailUrl,
        continuation,
        released: cachedData.released,
        wiki: "",
        getFirstLine,
        isMobile: req.useragent?.isMobile,
        about: "",
        playlist: cachedData.playlist,
        subs: typeof subsCached === "string" ? subsCached.replace("subscribers", "").trim() : "None"
      });
    };

    if (channelCache.has(cacheKey)) {
      const cached = channelCache.get(cacheKey);
      if (now - cached.timestamp < CACHE_TTL) {
        return sendRenderedResponse(cached.data);
      }
      channelCache.delete(cacheKey);
    }

    if (activeRequests.has(cacheKey)) {
      try {
        const cachedData = await activeRequests.get(cacheKey);
        if (currentEpoch !== requestEpoch) throw new Error("REQUEST_DROPPED");
        return sendRenderedResponse(cachedData);
      } catch (e) {
        if (e.message === "REQUEST_DROPPED") return res.status(499).send("Request dropped by server.");
      }
    }

    const fetchChannelData = async () => {
      async function fetchChannelPublishedJSON(id) {
        if (fetchFailureCache.has(id) && (Date.now() - fetchFailureCache.get(id)) < FETCH_FAILURE_TTL) {
          return { ID: id, published: " " };
        }

        try {
          if (currentEpoch !== requestEpoch) throw new Error("REQUEST_DROPPED");
          const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(id)}&g=${serverGeneration}`;
          const response = await fetch(url, { headers: { accept: "application/atom+xml" } });

          if (currentEpoch !== requestEpoch) throw new Error("REQUEST_DROPPED");

          if (!response.ok) {
            fetchFailureCache.set(id, Date.now());
            return { ID: id, published: " " };
          }

          const xml = await response.text();
          const match = xml.match(/<feed[\s\S]*?<published>([^<]+)<\/published>/i);

          if (!match) {
            fetchFailureCache.set(id, Date.now());
            return { ID: id, published: " " };
          }

          const date = new Date(match[1].trim());
          if (Number.isNaN(date.getTime())) {
            fetchFailureCache.set(id, Date.now());
            return { ID: id, published: " " };
          }

          fetchFailureCache.delete(id);
          return {
            ID: id,
            published: new Intl.DateTimeFormat("en-GB", {
              day: "numeric",
              month: "long",
              year: "numeric",
              timeZone: "UTC"
            }).format(date)
          };
        } catch (e) {
          if (e.message === "REQUEST_DROPPED") throw e;
          fetchFailureCache.set(id, Date.now());
          return { ID: id, published: " " };
        }
      }

      const getChannelData = async (url) => {
        try {
          if (currentEpoch !== requestEpoch) throw new Error("REQUEST_DROPPED");
          const response = await fetch(url, { headers: { "User-Agent": config.useragent } });
          if (currentEpoch !== requestEpoch) throw new Error("REQUEST_DROPPED");
          if (!response.ok) return null;
          const txt = await response.text();
          return getJson(txt);
        } catch (e) {
          if (e.message === "REQUEST_DROPPED") throw e;
          return null;
        }
      };

      const apiUrl = config.invapi + "/channels/";
      const btoaCommunity = btoa(ChannelTabs.community);
      const channelUrl = `${apiUrl}${ID}/${atob(ChannelTabs.videos)}?sort_by=${sort_by}${continuationParam}&h=${btoaCommunity}&g=${serverGeneration}`;
      const shortsUrl = `${apiUrl}${ID}/${atob(ChannelTabs.shorts)}?sort_by=${sort_by}${continuationParam}&h=${btoaCommunity}&g=${serverGeneration}`;
      const streamUrl = `${apiUrl}${ID}/${atob(ChannelTabs.streams)}?sort_by=${sort_by}${continuationParam}&h=${btoaCommunity}&g=${serverGeneration}`;
      const communityUrl = `${apiUrl}${ID}/${atob(ChannelTabs.community)}?hl=en-US&h=${ChannelTabs.community}&g=${serverGeneration}`;
      const PlaylistUrl = `${apiUrl}${ID}/${atob(ChannelTabs.playlist)}?hl=en-US&h=${btoaCommunity}&g=${serverGeneration}`;
      const releasesUrl = `${apiUrl}${ID}/releases?hl=en-US&h=${btoaCommunity}&g=${serverGeneration}`;
      const channelINVUrl = `${apiUrl}${ID}/?h=${btoaCommunity}&g=${serverGeneration}`;

      let [
        createdAccountGetDate,
        cinv
      ] = await Promise.all([
        fetchChannelPublishedJSON(ID),
        getChannelData(channelINVUrl)
      ]);

      const bannedchannels = [];
      const bypassQuery = "bypass";

      const isBlockedChannel =
        bannedchannels.includes(ID) &&
        req.query.bypass !== bypassQuery &&
        !("tab" in req.query) &&
        !("continuation" in req.query);

      let tj = " ";
      let shorts = " ";
      let playlist = " ";
      let released = " ";
      let stream = " ";
      let c = " ";

      if (isBlockedChannel) {
        cinv = {
          error: `this channel may include disinformation. If you still wanna view content <a href="/channel?id=${ID}&bypass=${bypassQuery}">click here</a> to bypass this restriction.`
        };
      } else {
        const tabs = Array.isArray(cinv?.tabs)
          ? new Set(cinv.tabs.map(tabName => String(tabName).toLowerCase()))
          : null;

        const hasTab = (...tabNames) => {
          if (!tabs) return true;
          return tabNames.some(tabName => tabs.has(String(tabName).toLowerCase()));
        };

        [
          tj,
          shorts,
          playlist,
          released,
          stream,
          c
        ] = await Promise.all([
          hasTab("videos") ? getChannelData(channelUrl) : " ",
          hasTab("shorts") ? getChannelData(shortsUrl) : " ",
          hasTab("playlists", "playlist") ? getChannelData(PlaylistUrl) : " ",
          hasTab("releases", "release") ? getChannelData(releasesUrl) : " ",
          hasTab("live", "streams", "stream") ? getChannelData(streamUrl) : " ",
          hasTab("posts", "community") ? getChannelData(communityUrl) : " "
        ]);
      }

      if (currentEpoch !== requestEpoch) throw new Error("REQUEST_DROPPED");

      return { tj, shorts, stream, c, cinv, released, playlist, createdAccountGetDate };
    };

    const requestPromise = fetchChannelData();
    activeRequests.set(cacheKey, requestPromise);

    try {
      const data = await requestPromise;
      if (currentEpoch !== requestEpoch) throw new Error("REQUEST_DROPPED");

      channelCache.set(cacheKey, { data, timestamp: Date.now() });
      activeRequests.delete(cacheKey);

      return sendRenderedResponse(data);
    } catch (error) {
      activeRequests.delete(cacheKey);
      if (error && error.message === "REQUEST_DROPPED") {
        return res.status(499).send("Request cancelled by server.");
      }
      throw error;
    }
  });

};