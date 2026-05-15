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

// see https://developers.google.com/youtube/v3/docs/channels/
const ChannelTabs = {
  community: "Y29tbXVuaXR5",
  shorts: "c2hvcnRz",
  videos: "dmlkZW9z",
  streams: "c3RyZWFtcw==", // or "live"
  channels: "Y2hhbm5lbHM=",
  store: "c3RvcmU=",
  released: "cmVsZWFzZXM=",
  playlist: "cGxheWxpc3Rz",
};

/**
 * Cache for failed fetchChannelPublishedJSON requests.
 * Stores channel IDs that failed, so we don't retry for 1 hour.
 * Key: channel ID, Value: timestamp of when the failure was recorded.
 */
const fetchFailureCache = {};
const FETCH_FAILURE_TTL = 60 * 60 * 1000; // 1 hour in ms

module.exports = function (app, config, renderTemplate) {
  app.get("/download", async (req, res) => {
    try {
      const v = req.query.v;

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
  
const ActiveSearchRequests = new Map();

app.get("/search", async (req, res) => {
  const { fetch } = await import("undici");
  const query = req.query.query;
  const tab = req.query.tab;
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

  let continuation = req.query.continuation || "";
  let date = req.query.date || "";
  let type = "video";
  let duration = req.query.duration || "";
  let sort = req.query.sort || "";

  let searchUrl;
  if (req.query.from === "hashtag") {
    searchUrl = `${config.invapi}/hashtag/${query}?hl=en-gb`;
  } else {
    searchUrl = `${config.invapi}/search?q=${encodeURIComponent(query)}&page=${encodeURIComponent(continuation)}&date=${date}&type=${type}&duration=${duration}&sort=${sort}&hl=en-US&region=US`;
  }

  try {
    let xmlData;

    if (ActiveSearchRequests.has(searchUrl)) {
      xmlData = await ActiveSearchRequests.get(searchUrl);
    } else {
      const fetchPromise = (async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        try {
          const response = await fetch(searchUrl, {
            headers: {
              "User-Agent": config.useragent,
            },
            signal: controller.signal,
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }

          const txt = await response.text();
          const parsedData = getJson(txt);

          if (!parsedData) {
            throw new Error("Parse failed");
          }

          return parsedData;
        } finally {
          clearTimeout(timeoutId);
        }
      })();

      ActiveSearchRequests.set(searchUrl, fetchPromise);

      try {
        xmlData = await fetchPromise;
      } finally {
        ActiveSearchRequests.delete(searchUrl);
      }
    }

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
    
  } catch (error) {
    if (error.name !== 'AbortError' && error.code !== 'UND_ERR_CONNECT_TIMEOUT') {
      console.log(`Error searching '${query}':`, error.message);
    }
    res.redirect("/");
  }
});
  
  app.get("/im-feeling-lucky", function (req, res) {
    res.send("WIP");
  });

  app.get("/home", async (req, res) => {
const invtrend = await fetch(`${config.invapi}/trending?type=Gaming&hl=en-US&region=US`, {
    headers: { "User-Agent": config.useragent },
});

  const inv = getJson(await invtrend.text());
  renderTemplate(res, req, "home.ejs", { inv, turntomins, isMobile: req.useragent.isMobile,});
});

  
  app.get("/web", async (req, res) => {
    res.redirect("/");
  });

function channelurlfixer(text) {
  // Create a regular expression to match <a> tags with href containing "/channel/"
  const regex = /<a\s+href="\/channel\/([^"]+)"/g;
  // Replace matching <a> tags with the modified href attribute
  const updatedDescription = text.replace(regex, '<a href="/channel?id=$1"');
  return updatedDescription;
}
const { fetch, Agent } = require("undici");
const undiciAgent = new Agent({ keepAliveTimeout: 10, keepAliveMaxTimeout: 10 });

const GlobalChannelCache = new Map();
const InFlightRequests = new Map();
const fetchFailureCache = new Map();

const FETCH_FAILURE_TTL = 60000;
const CHANNEL_CACHE_TTL = 3600000;
const MAX_CACHE_SIZE = 300;

function getCleanID(id) {
    if (!id) return null;
    return id.replace(/@(youtube\.com|poketube\.fun)$/, "");
}

app.get("/channel/", async (req, res) => {
    const rawID = req.query.id;
    const sanitizedID = getCleanID(rawID);

    if (!sanitizedID) {
        return renderTemplate(res, req, "404.ejs");
    }

    const tab = req.query.tab || "videos";
    const sort_by = req.query.sort_by || "newest";
    const continuation = req.query.continuation ? `&continuation=${req.query.continuation}` : "";

    const cached = GlobalChannelCache.get(sanitizedID);
    if (cached && (Date.now() - cached.timestamp < CHANNEL_CACHE_TTL)) {
        return renderChannelPage(res, req, sanitizedID, tab, sort_by, continuation, cached.result);
    }

    if (InFlightRequests.has(sanitizedID)) {
        try {
            const sharedResult = await InFlightRequests.get(sanitizedID);
            return renderChannelPage(res, req, sanitizedID, tab, sort_by, continuation, sharedResult);
        } catch (e) {
        }
    }

    const fetchPromise = (async () => {
        const apiUrl = config.invapi + "/channels/";
        const commHash = btoa(ChannelTabs.community);
        
        const safeFetch = async (url) => {
            try {
                const response = await fetch(url, { 
                    dispatcher: undiciAgent,
                    headers: { "User-Agent": config.useragent },
                    signal: AbortSignal.timeout(6000) 
                });
                if (!response.ok) return null;
                const txt = await response.text();
                return typeof getJson === 'function' ? getJson(txt) : JSON.parse(txt);
            } catch (e) { return null; }
        };

        const fetchRSS = async (id) => {
            if (fetchFailureCache.has(id) && (Date.now() - fetchFailureCache.get(id) < FETCH_FAILURE_TTL)) {
                return { ID: id, published: " " };
            }
            try {
                const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(id)}`;
                const rssRes = await fetch(rssUrl, { dispatcher: undiciAgent, signal: AbortSignal.timeout(4000) });
                if (!rssRes.ok) throw new Error();
                const xml = await rssRes.text();
                const match = xml.match(/<published>([^<]+)<\/published>/);
                const date = match ? new Date(match[1]) : new Date();
                return { 
                    ID: id, 
                    published: new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" }).format(date) 
                };
            } catch (e) {
                fetchFailureCache.set(id, Date.now());
                return { ID: id, published: " " };
            }
        };

        const [createdAccountGetDate, tj, shorts, playlist, released, stream, c, cinv] = await Promise.all([
            fetchRSS(sanitizedID),
            safeFetch(`${apiUrl}${sanitizedID}/${atob(ChannelTabs.videos)}?sort_by=${sort_by}${continuation}&h=${commHash}`),
            safeFetch(`${apiUrl}${sanitizedID}/${atob(ChannelTabs.shorts)}?sort_by=${sort_by}${continuation}&h=${commHash}`),
            safeFetch(`${apiUrl}${sanitizedID}/${atob(ChannelTabs.playlist)}?hl=en-US&h=${commHash}`),
            safeFetch(`${apiUrl}${sanitizedID}/releases?hl=en-US&h=${commHash}`),
            safeFetch(`${apiUrl}${sanitizedID}/${atob(ChannelTabs.streams)}?sort_by=${sort_by}${continuation}&h=${commHash}`),
            safeFetch(`${apiUrl}${sanitizedID}/${atob(ChannelTabs.community)}?hl=en-US&h=${commHash}`),
            safeFetch(`${apiUrl}${sanitizedID}/?h=${commHash}`)
        ]);

        const finalData = { createdAccountGetDate, tj, shorts, playlist, released, stream, c, cinv };
        
        GlobalChannelCache.set(sanitizedID, { result: finalData, timestamp: Date.now() });
        
        if (GlobalChannelCache.size > MAX_CACHE_SIZE) {
            const oldestKey = GlobalChannelCache.keys().next().value;
            GlobalChannelCache.delete(oldestKey);
        }

        return finalData;
    })();

    InFlightRequests.set(sanitizedID, fetchPromise);

    try {
        const result = await fetchPromise;
        renderChannelPage(res, req, sanitizedID, tab, sort_by, continuation, result);
    } catch (err) {
        res.status(500).send("Channel Load Error");
    } finally {
        InFlightRequests.delete(sanitizedID);
    }
});

function renderChannelPage(res, req, ID, tab, sort, continuation, data) {
    const { tj, shorts, playlist, released, stream, c, cinv, createdAccountGetDate } = data;

    let proxy = config.media_proxy;
    if (req.useragent.source.includes("Pardus")) {
        proxy = "https://media-proxy.ashley0143.xyz";
    }

    let displayInfo = cinv;
    const banned = [""];
    if (banned.includes(ID) && !req.query.bypass) {
        displayInfo = { error: `Potential disinformation. <a href="/channel?id=${ID}&bypass=true">Bypass</a>` };
    }

    const subCount = cinv?.subCount || 0;
    const formattedSubs = typeof convert === 'function' ? convert(subCount).replace("subscribers", "").trim() : subCount;

    const getThumb = (v) => {
        const isMax = v.videoThumbnails?.some(t => t.quality === "maxresdefault");
        return isMax ? `https://vid.puffyan.us/vi/${v.videoId}/maxresdefault.jpg` : `https://vid.puffyan.us/vi/${v.videoId}/hqdefault.jpg`;
    };

    renderTemplate(res, req, "channel.ejs", {
        ID, tab, shorts, tj, c, stream, playlist, released, cinv: displayInfo,
        createdAccountGetDate,
        firstVideo: { subCountText: "0", authorVerified: false },
        sort,
        channelurlfixer: typeof channelurlfixer !== 'undefined' ? channelurlfixer : (u)=>u,
        embedchannelsubsfeed: req.query.embedchannelsubsfeed,
        convert: typeof convert !== 'undefined' ? convert : (n)=>n,
        turntomins: typeof turntomins !== 'undefined' ? turntomins : (s)=>s,
        pronoun: "no pronouns :c",
        media_proxy_url: proxy,
        getThumbnailUrl: getThumb,
        continuation,
        wiki: "",
        getFirstLine: typeof getFirstLine !== 'undefined' ? getFirstLine : (t)=>t,
        isMobile: req.useragent.isMobile,
        about: cinv?.description || "",
        subs: formattedSubs
    });
}
  
};