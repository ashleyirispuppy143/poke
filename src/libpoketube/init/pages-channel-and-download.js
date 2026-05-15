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

  app.get("/search", async (req, res) => {
    const query = req.query.query 
    const tab = req.query.tab;
    const { fetch } = await import("undici");

    var media_proxy = config.media_proxy;
 
    var uaos = req.useragent.os;
    var IsOldWindows;

    if (uaos == "Windows 7" && req.useragent.browser == "Firefox") {
      IsOldWindows = true;
    } else if (uaos == "Windows 8" && req.useragent.browser == "Firefox") {
      IsOldWindows = true;
    } else {
      IsOldWindows = false;
    }

if (typeof query === 'string') {
  const trimmedQuery = query.trim();
  let redirectUrl = null;

   const ytUrlMatch = trimmedQuery.match(/(?:youtube\.com\/watch\?.*v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);

    const prefixMatch = trimmedQuery.match(/^(channel|video|watch):([a-zA-Z0-9_\-@]+)$/);

  if (ytUrlMatch) {
     redirectUrl = `/watch?v=${ytUrlMatch[1]}`;
    
  } else if (prefixMatch) {
    const type = prefixMatch[1];  
    const id = prefixMatch[2];    

    if (type === 'channel') {
       redirectUrl = `/channel?id=${id}`;
      
    } else if ((type === 'video' || type === 'watch') && id.length === 11) {
       redirectUrl = `/watch?v=${id}`;
    }
  }

   if (redirectUrl) {
    return res.redirect(redirectUrl);
  }
}

    if (query && query.startsWith("!") && query.length > 2) {
      res.redirect("https://lite.duckduckgo.com/lite/?q=" + query);
    }

    if (query && query.startsWith("Hey ChatGPT,") && query.length > 2) {
      res.redirect("https://chatgpt.com/?q=" + query + "- sent using pokeAI features");
    }
    
if (!query) {
res.redirect("/home")
}

    let continuation = req.query.continuation || "";
    let date = req.query.date || "";
    let type = "video";
    let duration = req.query.duration || "";
    let sort = req.query.sort || "";

    try {
      const headers = {};

      let searchUrl;
      if (req.query.from === 'hashtag') {
        searchUrl = `${config.invapi}/hashtag/${query}?hl=en-gb`;
      } else {
        searchUrl = `${config.invapi}/search?q=${encodeURIComponent(query)}&page=${encodeURIComponent(continuation)}&date=${date}&type=${type}&duration=${duration}&sort=${sort}&hl=en-US&region=US`;
      }

      const xmlData = await fetch(searchUrl, {
        headers: {
          'User-Agent': config.useragent,
        },
      })
        .then((res) => res.text())
        .then((txt) => getJson(txt));

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
      console.log(`Error while searching for '${query}':`, error);
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

const CHANNEL_PAGE_CACHE_TTL = 3600000;
const CHANNEL_PAGE_CACHE_MAX = 1500;
const CHANNEL_FETCH_TIMEOUT_MS = 9000;

const channelPageCache = new Map();
const channelPageInFlight = new Map();
const channelUrlCache = new Map();
const channelUrlInFlight = new Map();
const channelPublishedCache = new Map();
const channelPublishedInFlight = new Map();

let undiciFetchPromise = null;

function getUndiciFetch() {
  if (!undiciFetchPromise) {
    undiciFetchPromise = import("undici").then(({ fetch }) => fetch);
  }

  return undiciFetchPromise;
}

function getTimedFetchOptions(options, timeoutMs) {
  const finalOptions = Object.assign({}, options || {});
  let cancel = null;

  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
    finalOptions.signal = AbortSignal.timeout(timeoutMs);
    return { options: finalOptions, cancel };
  }

  if (typeof AbortController !== "undefined") {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    finalOptions.signal = controller.signal;
    cancel = () => clearTimeout(timer);
  }

  return { options: finalOptions, cancel };
}

async function fetchTextWithTimeout(fetch, url, options, timeoutMs) {
  const timed = getTimedFetchOptions(options, timeoutMs);

  try {
    const response = await fetch(url, timed.options);
    const text = await response.text();

    return {
      ok: response.ok,
      status: response.status,
      text
    };
  } finally {
    if (typeof timed.cancel === "function") {
      timed.cancel();
    }
  }
}

function getMapCacheValue(map, key, ttl) {
  const item = map.get(key);

  if (!item) {
    return null;
  }

  if (Date.now() - item.timestamp >= ttl) {
    map.delete(key);
    return null;
  }

  map.delete(key);
  map.set(key, item);

  return item.value;
}

function setMapCacheValue(map, key, value, maxEntries) {
  map.set(key, {
    value,
    timestamp: Date.now()
  });

  while (map.size > maxEntries) {
    const oldestKey = map.keys().next().value;
    map.delete(oldestKey);
  }

  return value;
}

function getInFlightOrCreate(map, key, producer) {
  if (map.has(key)) {
    return map.get(key);
  }

  const promise = Promise.resolve()
    .then(producer)
    .finally(() => {
      map.delete(key);
    });

  map.set(key, promise);

  return promise;
}

function normalizeChannelId(rawId) {
  const firstValue = Array.isArray(rawId) ? rawId[0] : rawId;
  let id = String(firstValue || "").trim();

  if (id.endsWith("@youtube.com")) {
    id = id.slice(0, -"@youtube.com".length);
  }

  if (id.endsWith("@poketube.fun")) {
    id = id.slice(0, -"@poketube.fun".length);
  }

  return id;
}

function getChannelPageCacheKey(ID, sort_by, continuation) {
  return JSON.stringify({
    ID,
    sort_by,
    continuation
  });
}

function getUrlCacheKey(url) {
  return String(url || "");
}

function isFreshFetchFailure(id) {
  return fetchFailureCache[id] && Date.now() - fetchFailureCache[id] < FETCH_FAILURE_TTL;
}

async function fetchChannelPublishedJSON(fetch, id) {
  const cached = getMapCacheValue(channelPublishedCache, id, CHANNEL_PAGE_CACHE_TTL);

  if (cached) {
    return cached;
  }

  return getInFlightOrCreate(channelPublishedInFlight, id, async () => {
    if (isFreshFetchFailure(id)) {
      return { ID: id, published: " " };
    }

    try {
      const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(id)}`;

      const response = await fetchTextWithTimeout(
        fetch,
        url,
        {
          headers: {
            accept: "application/atom+xml"
          }
        },
        CHANNEL_FETCH_TIMEOUT_MS
      );

      if (response.status === 404) {
        fetchFailureCache[id] = Date.now();
        return { ID: id, published: " " };
      }

      if (!response.ok) {
        console.log(`HTTP ${response.status} for ${url}`);
        fetchFailureCache[id] = Date.now();
        return { ID: id, published: " " };
      }

      const match = response.text.match(/<feed[\s\S]*?<published>([^<]+)<\/published>/i);

      if (!match) {
        fetchFailureCache[id] = Date.now();
        return { ID: id, published: " " };
      }

      const iso = match[1].trim();
      const date = new Date(iso);

      if (Number.isNaN(date.getTime())) {
        fetchFailureCache[id] = Date.now();
        return { ID: id, published: " " };
      }

      const published = new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "UTC"
      }).format(date);

      delete fetchFailureCache[id];

      return setMapCacheValue(
        channelPublishedCache,
        id,
        {
          ID: id,
          published
        },
        CHANNEL_PAGE_CACHE_MAX
      );
    } catch (error) {
      console.log(`fetchChannelPublishedJSON failed for ${id}:`, error.message);
      fetchFailureCache[id] = Date.now();
      return { ID: id, published: " " };
    }
  });
}

async function getChannelData(fetch, url) {
  const key = getUrlCacheKey(url);
  const cached = getMapCacheValue(channelUrlCache, key, CHANNEL_PAGE_CACHE_TTL);

  if (cached !== null) {
    return cached;
  }

  return getInFlightOrCreate(channelUrlInFlight, key, async () => {
    try {
      const response = await fetchTextWithTimeout(
        fetch,
        url,
        {
          headers: {
            "User-Agent": config.useragent
          }
        },
        CHANNEL_FETCH_TIMEOUT_MS
      );

      if (!response.ok) {
        return null;
      }

      const parsed = getJson(response.text);

      if (parsed !== null && typeof parsed !== "undefined") {
        return setMapCacheValue(channelUrlCache, key, parsed, CHANNEL_PAGE_CACHE_MAX * 8);
      }

      return null;
    } catch (error) {
      return null;
    }
  });
}

async function getChannelBundle(fetch, ID, sort_by, continuation) {
  const apiUrl = config.invapi + "/channels/";
  const channelUrl = `${apiUrl}${ID}/${atob(ChannelTabs.videos)}?sort_by=${sort_by}${continuation}&h=${btoa(ChannelTabs.community)}`;
  const shortsUrl = `${apiUrl}${ID}/${atob(ChannelTabs.shorts)}?sort_by=${sort_by}${continuation}&h=${btoa(ChannelTabs.community)}`;
  const streamUrl = `${apiUrl}${ID}/${atob(ChannelTabs.streams)}?sort_by=${sort_by}${continuation}&h=${btoa(ChannelTabs.community)}`;
  const communityUrl = `${apiUrl}${ID}/${atob(ChannelTabs.community)}?hl=en-US&h=${ChannelTabs.community}`;
  const PlaylistUrl = `${apiUrl}${ID}/${atob(ChannelTabs.playlist)}?hl=en-US&h=${btoa(ChannelTabs.community)}`;
  const releasesUrl = `${apiUrl}${ID}/releases?hl=en-US&h=${btoa(ChannelTabs.community)}`;
  const channelINVUrl = `${apiUrl}${ID}/?h=${btoa(ChannelTabs.community)}`;

  const pageCacheKey = getChannelPageCacheKey(ID, sort_by, continuation);
  const cached = getMapCacheValue(channelPageCache, pageCacheKey, CHANNEL_PAGE_CACHE_TTL);

  if (cached) {
    return cached;
  }

  return getInFlightOrCreate(channelPageInFlight, pageCacheKey, async () => {
    const [
      createdAccountGetDate,
      tj,
      shorts,
      playlist,
      released,
      stream,
      c,
      cinv
    ] = await Promise.all([
      fetchChannelPublishedJSON(fetch, ID),
      getChannelData(fetch, channelUrl),
      getChannelData(fetch, shortsUrl),
      getChannelData(fetch, PlaylistUrl),
      getChannelData(fetch, releasesUrl),
      getChannelData(fetch, streamUrl),
      getChannelData(fetch, communityUrl),
      getChannelData(fetch, channelINVUrl)
    ]);

    return setMapCacheValue(
      channelPageCache,
      pageCacheKey,
      {
        createdAccountGetDate,
        tj,
        shorts,
        playlist,
        released,
        stream,
        c,
        cinv
      },
      CHANNEL_PAGE_CACHE_MAX
    );
  });
}

app.get("/channel/", async (req, res) => {
  const fetch = await getUndiciFetch();

  var media_proxy = config.media_proxy;

  if (req.useragent && req.useragent.source && req.useragent.source.includes("Pardus")) {
    media_proxy = "https://media-proxy.ashley0143.xyz";
  }

  var ID = normalizeChannelId(req.query.id);

  if (!ID) {
    return renderTemplate(res, req, "404.ejs");
  }

  const tab = req.query.tab;

  const continuation = req.query.continuation
    ? `&continuation=${req.query.continuation}`
    : "";

  const continuationl = req.query.continuationl
    ? `&continuation=${req.query.continuationl}`
    : "";

  const continuations = req.query.continuations
    ? `&continuation=${req.query.continuations}`
    : "";

  const sort_by = req.query.sort_by || "newest";
  const pronoun = "no pronouns :c";

  var {
    createdAccountGetDate,
    tj,
    shorts,
    playlist,
    released,
    stream,
    c,
    cinv
  } = await getChannelBundle(fetch, ID, sort_by, continuation);

  var bannedchannels = "";
  var bypassQuery = "";

  var bypassExists = req.query.bypass === bypassQuery;
  var tabExists = "tab" in req.query;
  var continuationExists = "continuation" in req.query;

  if (
    Array.isArray(bannedchannels) &&
    bannedchannels.some((channel) => channel === ID) &&
    !bypassExists &&
    !tabExists &&
    !continuationExists
  ) {
    cinv = {
      error: `this channel may include disinformation. If you still wanna view content <a href="/channel?id=${ID}&bypass=${bypassQuery}">click here</a> to bypass this restriction.`
    };
  }

  function getThumbnailUrl(video) {
    const thumbnails = Array.isArray(video && video.videoThumbnails)
      ? video.videoThumbnails
      : [];

    const maxresDefaultThumbnail = thumbnails.find(
      (thumbnail) => thumbnail.quality === "maxresdefault"
    );

    if (maxresDefaultThumbnail) {
      return `https://vid.puffyan.us/vi/${video.videoId}/maxresdefault.jpg`;
    }

    return `https://vid.puffyan.us/vi/${video.videoId}/hqdefault.jpg`;
  }

  const subscribers = convert(cinv?.subCount || 0);

  let ChannelFirstVideoObject = {
    subCountText: "0",
    authorVerified: false
  };

  return renderTemplate(res, req, "channel.ejs", {
    ID,
    tab,
    shorts,
    firstVideo: ChannelFirstVideoObject,
    j: "",
    dnoreplace: "",
    sort: sort_by,
    channelurlfixer,
    stream,
    tj,
    c,
    createdAccountGetDate,
    cinv,
    embedchannelsubsfeed: req.query.embedchannelsubsfeed,
    convert,
    turntomins,
    pronoun,
    media_proxy_url: media_proxy,
    getThumbnailUrl,
    continuation,
    released,
    wiki: "",
    getFirstLine,
    isMobile: req.useragent.isMobile,
    about: "",
    playlist,
    subs:
      typeof subscribers === "string"
        ? subscribers.replace("subscribers", "")
        : "None"
  });
});
  
};