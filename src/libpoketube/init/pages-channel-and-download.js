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
  const channelCache = new Map();
const fetchFailureCache = new Map();
const FETCH_FAILURE_TTL = 3600000;
let undiciFetch;

app.get("/channel/", async (req, res) => {
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

  if (channelCache.has(cacheKey)) {
    const cached = channelCache.get(cacheKey);
    if (now - cached.timestamp < 3600000) {
      const subsCached = convert(cached.data.cinv?.subCount || 0);
      return renderTemplate(res, req, "channel.ejs", {
        ID,
        tab,
        shorts: cached.data.shorts,
        firstVideo: { subCountText: "0", authorVerified: false },
        j: "",
        dnoreplace: "",
        sort: sort_by,
        channelurlfixer,
        stream: cached.data.stream,
        tj: cached.data.tj,
        c: cached.data.c,
        createdAccountGetDate: cached.data.createdAccountGetDate,
        cinv: cached.data.cinv,
        embedchannelsubsfeed: req.query.embedchannelsubsfeed,
        convert,
        turntomins,
        pronoun: "no pronouns :c",
        media_proxy_url: media_proxy,
        getThumbnailUrl,
        continuation,
        released: cached.data.released,
        wiki: "",
        getFirstLine,
        isMobile: req.useragent?.isMobile,
        about: "",
        playlist: cached.data.playlist,
        subs: typeof subsCached === "string" ? subsCached.replace("subscribers", "").trim() : "None"
      });
    }
    channelCache.delete(cacheKey);
  }

  async function fetchChannelPublishedJSON(id) {
    if (fetchFailureCache.has(id) && (now - fetchFailureCache.get(id)) < FETCH_FAILURE_TTL) {
      return { ID: id, published: " " };
    }

    try {
      const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(id)}`;
      const response = await fetch(url, { headers: { accept: "application/atom+xml" } });

      if (!response.ok) {
        fetchFailureCache.set(id, now);
        return { ID: id, published: " " };
      }

      const xml = await response.text();
      const match = xml.match(/<feed[\s\S]*?<published>([^<]+)<\/published>/i);

      if (!match) {
        fetchFailureCache.set(id, now);
        return { ID: id, published: " " };
      }

      const date = new Date(match[1].trim());
      if (Number.isNaN(date.getTime())) {
        fetchFailureCache.set(id, now);
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
    } catch {
      fetchFailureCache.set(id, now);
      return { ID: id, published: " " };
    }
  }

  const getChannelData = async (url) => {
    try {
      const response = await fetch(url, { headers: { "User-Agent": config.useragent } });
      if (!response.ok) return null;
      const txt = await response.text();
      return getJson(txt);
    } catch {
      return null;
    }
  };

  const apiUrl = config.invapi + "/channels/";
  const btoaCommunity = btoa(ChannelTabs.community);
  const channelUrl = `${apiUrl}${ID}/${atob(ChannelTabs.videos)}?sort_by=${sort_by}${continuationParam}&h=${btoaCommunity}`;
  const shortsUrl = `${apiUrl}${ID}/${atob(ChannelTabs.shorts)}?sort_by=${sort_by}${continuationParam}&h=${btoaCommunity}`;
  const streamUrl = `${apiUrl}${ID}/${atob(ChannelTabs.streams)}?sort_by=${sort_by}${continuationParam}&h=${btoaCommunity}`;
  const communityUrl = `${apiUrl}${ID}/${atob(ChannelTabs.community)}?hl=en-US&h=${ChannelTabs.community}`;
  const PlaylistUrl = `${apiUrl}${ID}/${atob(ChannelTabs.playlist)}?hl=en-US&h=${btoaCommunity}`;
  const releasesUrl = `${apiUrl}${ID}/releases?hl=en-US&h=${btoaCommunity}`;
  const channelINVUrl = `${apiUrl}${ID}/?h=${btoaCommunity}`;

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

  channelCache.set(cacheKey, {
    data: { tj, shorts, stream, c, cinv, released, playlist, createdAccountGetDate },
    timestamp: now
  });

  const subscribers = convert(cinv?.subCount || 0);

  renderTemplate(res, req, "channel.ejs", {
    ID,
    tab,
    shorts,
    firstVideo: { subCountText: "0", authorVerified: false },
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
    pronoun: "no pronouns :c",
    media_proxy_url: media_proxy,
    getThumbnailUrl,
    continuation,
    released,
    wiki: "",
    getFirstLine,
    isMobile: req.useragent?.isMobile,
    about: "",
    playlist,
    subs: typeof subscribers === "string" ? subscribers.replace("subscribers", "").trim() : "None"
  });
});

  
};