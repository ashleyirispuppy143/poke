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
 * Object representing base64-encoded protobuf values for channel tabs.
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
    const query = req.query.query ? req.query.query.replace("ohio", "things to do in ohio") : '';
    const tab = req.query.tab;
    const { fetch } = await import("undici");

    var media_proxy = config.media_proxy;

    if (req.useragent.source.includes("Pardus")) {
      var media_proxy = "https://media-proxy.ashley0143.xyz";
    }
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
      return res.redirect("/");
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
        searchUrl = `${config.invapi}/search?q=${encodeURIComponent(query)}&page=${encodeURIComponent(continuation)}&date=${date}&type=${type}&duration=${duration}&sort=${sort}&hl=en+gb`;
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


  app.get("/channel/", async (req, res) => {
    const { fetch } = await import("undici");
    try {
      var media_proxy = config.media_proxy;

      if (req.useragent.source.includes("Pardus")) {
        var media_proxy = "https://media-proxy.ashley0143.xyz";
      }

      var ID = req.query.id;

      if (ID.endsWith("@youtube.com")) {
        ID = ID.slice(0, -"@youtube.com".length);
      }

      if (ID.endsWith("@poketube.fun")) {
        ID = ID.slice(0, -"@poketube.fun".length);
      }

      const tab = req.query.tab;
      const cache = {};

async function fetchChannelPublishedJSON(id) {
  const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(id)}`;
  const res = await fetch(url, { headers: { accept: "application/atom+xml" } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);

  const xml = await res.text();
  const match = xml.match(/<feed[\s\S]*?<published>([^<]+)<\/published>/i);
  if (!match) throw new Error("feed <published> not found");

  const iso = match[1].trim();
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) throw new Error(`invalid date: ${iso}`);

  const published = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC"
  }).format(date);

  return { ID: id, published };
}

const createdAccountGetDate = await fetchChannelPublishedJSON(ID);

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

      const getChannelData = async (url) => {
        try {
          return await fetch(url, {
            headers: {
              'User-Agent': config.useragent,
            },
          })
            .then((res) => res.text())
            .then((txt) => getJson(txt));
        } catch (error) {
          return null;
        }
      };

      const apiUrl = config.invapi + "/channels/";
      const channelUrl = `${apiUrl}${ID}/${atob(
        ChannelTabs.videos
      )}?sort_by=${sort_by}${continuation}&h=yeahyeahy`;

      const shortsUrl = `${apiUrl}${ID}/${atob(
        ChannelTabs.shorts
      )}?sort_by=${sort_by}${continuation}&h=yeah`;

      const streamUrl = `${apiUrl}${ID}/${atob(
        ChannelTabs.streams
      )}?sort_by=${sort_by}${continuation}&h=yee`;

      const communityUrl = `${apiUrl}${ID}/${atob(
        ChannelTabs.community
      )}?hl=en-US&h=ye`;

      const PlaylistUrl = `${apiUrl}${ID}/${atob(
        ChannelTabs.playlist
      )}?hl=en-US&h=ye`;

   const releasesUrl = `${apiUrl}${ID}/releases?hl=en-US&h=y`;

      const channelINVUrl = `${apiUrl}${ID}/?h=ye`;

      const pronoun = "no pronouns :c";

      

      var [tj, shorts, playlist, released, stream, c, cinv] = await Promise.all([
        getChannelData(channelUrl),
        getChannelData(shortsUrl),
        getChannelData(PlaylistUrl),
        getChannelData(releasesUrl),
        getChannelData(streamUrl),
        getChannelData(communityUrl),
        getChannelData(channelINVUrl),
      ]);

      var bannedchannels = ["UC1okSIA8UEY8OqvtjGHFvzA", "UClsVg5LkK2COQRo1mVS4taA", "UCIr4vkCsn0tdTW2xZ1jRG1g"];
      var bypassQuery = "cG9rZXR1YmVjaGFubmVsYnlwYXNzbG9scGVvcGxldGhpbmt0aGlzaXNjZW5zb3JzaGlwLTQ1OTBh";

      var bypassExists = req.query.bypass === bypassQuery;
      var tabExists = 'tab' in req.query;
      var continuationExists = 'continuation' in req.query;

      if (bannedchannels.some(channel => channel === ID) && !bypassExists && !tabExists && !continuationExists) {
        var cinv = {
          error: `this channel may include disinformation. If you still wanna view content <a href="/channel?id=${ID}&bypass=${bypassQuery}">click here</a> to bypass this restriction.`
        };
      }

      function getThumbnailUrl(video) {
        const maxresDefaultThumbnail = video.videoThumbnails.find(
          (thumbnail) => thumbnail.quality === "maxresdefault"
        );

        if (maxresDefaultThumbnail) {
          return `https://vid.puffyan.us/vi/${video.videoId}/maxresdefault.jpg`;
        } else {
          return `https://vid.puffyan.us/vi/${video.videoId}/hqdefault.jpg`;
        }
      }

      cache[ID] = {
        result: {
          tj,
          shorts,
          stream,
          c,
          cinv,
        released,
        },
        timestamp: Date.now(),
      };

      if (cache[ID] && Date.now() - cache[ID].timestamp < 3600000) {
        var { tj, shorts, stream, c } = cache[ID].result;
      }

      const subscribers = convert(cinv?.subCount || 0);
    
 
      let ChannelFirstVideoObject = {
        subCountText: "0",
        authorVerified: false,
      };

      renderTemplate(res, req, "channel.ejs", {
        ID,
        tab,
        shorts,
        firstVideo: ChannelFirstVideoObject,
        j: "",
        dnoreplace:"",
        sort: sort_by,
        channelurlfixer,
        stream,
        tj,
        c,
        createdAccountGetDate,
        cinv,
        embedchannelsubsfeed:req.query.embedchannelsubsfeed,
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
        about:"",
        playlist,
        subs: typeof subscribers === "string"
          ? subscribers.replace("subscribers", "")
          : "None",
       });
    } catch (error) {
      console.error("Failed to render channel page:", error);
      res.redirect("/");
    }
  });
};
