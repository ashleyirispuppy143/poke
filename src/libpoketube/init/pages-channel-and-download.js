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

const SEARCH_FETCH_TIMEOUT_MS = 4500;
const SEARCH_CONNECT_TIMEOUT_MS = 3500;
const SEARCH_HEADERS_TIMEOUT_MS = 4500;
const SEARCH_BODY_TIMEOUT_MS = 4500;
const SEARCH_MAX_RESPONSE_BYTES = 3 * 1024 * 1024;
const SEARCH_QUERY_MAX_LENGTH = 500;
const SEARCH_INFLIGHT_MAX = 250;
const SEARCH_LOG_COOLDOWN_MS = 30000;

let searchUndiciPromise = null;
let searchAgent = null;

const searchInFlight = new Map();
const searchLogCooldown = new Map();

function getSearchUndici() {
  if (!searchUndiciPromise) {
    searchUndiciPromise = import("undici").then((undici) => {
      if (!searchAgent) {
        searchAgent = new undici.Agent({
          connections: 16,
          connectTimeout: SEARCH_CONNECT_TIMEOUT_MS,
          headersTimeout: SEARCH_HEADERS_TIMEOUT_MS,
          bodyTimeout: SEARCH_BODY_TIMEOUT_MS,
          keepAliveTimeout: 10000,
          keepAliveMaxTimeout: 30000
        });
      }

      return {
        request: undici.request,
        agent: searchAgent
      };
    });
  }

  return searchUndiciPromise;
}

function getSingleQueryValue(value) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function getQueryStringValue(value) {
  const singleValue = getSingleQueryValue(value);

  if (typeof singleValue !== "string") {
    return "";
  }

  return singleValue;
}

function clampSearchQuery(query) {
  const text = String(query || "").trim();

  if (!text) {
    return "";
  }

  if (text.length > SEARCH_QUERY_MAX_LENGTH) {
    return text.slice(0, SEARCH_QUERY_MAX_LENGTH);
  }

  return text;
}

function getSearchParam(value) {
  const singleValue = getSingleQueryValue(value);

  if (typeof singleValue === "undefined" || singleValue === null) {
    return "";
  }

  return String(singleValue);
}

function getIsOldWindowsFirefox(req) {
  const uaos = req.useragent && req.useragent.os ? req.useragent.os : "";
  const browser = req.useragent && req.useragent.browser ? req.useragent.browser : "";

  return (
    browser === "Firefox" &&
    (uaos === "Windows 7" || uaos === "Windows 8")
  );
}

function getSearchRedirect(query) {
  if (typeof query !== "string") {
    return null;
  }

  const trimmedQuery = query.trim();

  if (!trimmedQuery) {
    return null;
  }

  const ytUrlMatch = trimmedQuery.match(/(?:youtube\.com\/watch\?.*v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  const prefixMatch = trimmedQuery.match(/^(channel|video|watch):([a-zA-Z0-9_\-@]+)$/);

  if (ytUrlMatch) {
    return `/watch?v=${encodeURIComponent(ytUrlMatch[1])}`;
  }

  if (prefixMatch) {
    const type = prefixMatch[1];
    const id = prefixMatch[2];

    if (type === "channel") {
      return `/channel?id=${encodeURIComponent(id)}`;
    }

    if ((type === "video" || type === "watch") && id.length === 11) {
      return `/watch?v=${encodeURIComponent(id)}`;
    }
  }

  return null;
}

function buildSearchUrl(req, query, continuation, date, type, duration, sort) {
  if (req.query.from === "hashtag") {
    return `${config.invapi}/hashtag/${encodeURIComponent(query)}?hl=en-gb`;
  }

  const params = new URLSearchParams();

  params.set("q", query);
  params.set("page", continuation);
  params.set("date", date);
  params.set("type", type);
  params.set("duration", duration);
  params.set("sort", sort);
  params.set("hl", "en-US");
  params.set("region", "US");

  return `${config.invapi}/search?${params.toString()}`;
}

function createSearchAbortSignal(timeoutMs) {
  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
    return {
      signal: AbortSignal.timeout(timeoutMs),
      cancel: null
    };
  }

  if (typeof AbortController !== "undefined") {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    return {
      signal: controller.signal,
      cancel: () => clearTimeout(timer)
    };
  }

  return {
    signal: undefined,
    cancel: null
  };
}

function isSearchTimeoutError(error) {
  if (!error) {
    return false;
  }

  const cause = error.cause || {};

  return (
    error.name === "AbortError" ||
    error.name === "TimeoutError" ||
    error.code === "ABORT_ERR" ||
    error.code === "UND_ERR_CONNECT_TIMEOUT" ||
    error.code === "UND_ERR_HEADERS_TIMEOUT" ||
    error.code === "UND_ERR_BODY_TIMEOUT" ||
    cause.name === "AbortError" ||
    cause.name === "TimeoutError" ||
    cause.code === "ABORT_ERR" ||
    cause.code === "UND_ERR_CONNECT_TIMEOUT" ||
    cause.code === "UND_ERR_HEADERS_TIMEOUT" ||
    cause.code === "UND_ERR_BODY_TIMEOUT"
  );
}

function logSearchErrorOnce(key, message) {
  const now = Date.now();
  const lastLogAt = searchLogCooldown.get(key) || 0;

  if (now - lastLogAt < SEARCH_LOG_COOLDOWN_MS) {
    return;
  }

  searchLogCooldown.set(key, now);

  if (searchLogCooldown.size > 1000) {
    const oldestKey = searchLogCooldown.keys().next().value;
    searchLogCooldown.delete(oldestKey);
  }

  console.log(message);
}

async function readSearchBodyText(body, maxBytes) {
  const chunks = [];
  let totalBytes = 0;

  for await (const chunk of body) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);

    totalBytes += buffer.length;

    if (totalBytes > maxBytes) {
      if (body && typeof body.destroy === "function") {
        body.destroy();
      }

      const error = new Error("Search response was too large");
      error.code = "POKE_SEARCH_RESPONSE_TOO_LARGE";
      throw error;
    }

    chunks.push(buffer);
  }

  return Buffer.concat(chunks, totalBytes).toString("utf8");
}

async function requestSearchText(url) {
  const { request, agent } = await getSearchUndici();
  const abort = createSearchAbortSignal(SEARCH_FETCH_TIMEOUT_MS);

  try {
    const response = await request(url, {
      method: "GET",
      dispatcher: agent,
      signal: abort.signal,
      headersTimeout: SEARCH_HEADERS_TIMEOUT_MS,
      bodyTimeout: SEARCH_BODY_TIMEOUT_MS,
      headers: {
        "User-Agent": config.useragent,
        "Accept": "application/json,text/plain,*/*"
      }
    });

    if (response.statusCode < 200 || response.statusCode >= 300) {
      if (response.body && typeof response.body.destroy === "function") {
        response.body.destroy();
      }

      const error = new Error(`Search upstream returned HTTP ${response.statusCode}`);
      error.code = "POKE_SEARCH_UPSTREAM_HTTP";
      error.statusCode = response.statusCode;
      throw error;
    }

    const contentLength = Number(response.headers["content-length"] || 0);

    if (Number.isFinite(contentLength) && contentLength > SEARCH_MAX_RESPONSE_BYTES) {
      if (response.body && typeof response.body.destroy === "function") {
        response.body.destroy();
      }

      const error = new Error("Search response content-length was too large");
      error.code = "POKE_SEARCH_RESPONSE_TOO_LARGE";
      throw error;
    }

    return await readSearchBodyText(response.body, SEARCH_MAX_RESPONSE_BYTES);
  } finally {
    if (typeof abort.cancel === "function") {
      abort.cancel();
    }
  }
}

function getSearchInFlightKey(url) {
  return String(url || "");
}

function getSearchInFlightOrCreate(key, producer) {
  if (searchInFlight.has(key)) {
    return searchInFlight.get(key);
  }

  if (searchInFlight.size >= SEARCH_INFLIGHT_MAX) {
    const error = new Error("Too many active search requests");
    error.code = "POKE_SEARCH_TOO_MANY_INFLIGHT";
    return Promise.reject(error);
  }

  const promise = Promise.resolve()
    .then(producer)
    .finally(() => {
      searchInFlight.delete(key);
    });

  searchInFlight.set(key, promise);

  return promise;
}

async function getFreshSearchResults(searchUrl) {
  const key = getSearchInFlightKey(searchUrl);

  return getSearchInFlightOrCreate(key, async () => {
    const text = await requestSearchText(searchUrl);
    return getJson(text);
  });
}

app.get("/search", async (req, res) => {
  const rawQuery = getQueryStringValue(req.query.query);
  const query = clampSearchQuery(rawQuery);
  const tab = req.query.tab;

  var media_proxy = config.media_proxy;

  const IsOldWindows = getIsOldWindowsFirefox(req);

  if (!query) {
    return res.redirect("/home");
  }

  const redirectUrl = getSearchRedirect(query);

  if (redirectUrl) {
    return res.redirect(redirectUrl);
  }

  if (query.startsWith("!") && query.length > 2) {
    return res.redirect("https://lite.duckduckgo.com/lite/?q=" + encodeURIComponent(query));
  }

  if (query.startsWith("Hey ChatGPT,") && query.length > 2) {
    return res.redirect("https://chatgpt.com/?q=" + encodeURIComponent(query + " - sent using pokeAI features"));
  }

  let continuation = getSearchParam(req.query.continuation);
  let date = getSearchParam(req.query.date);
  let type = "video";
  let duration = getSearchParam(req.query.duration);
  let sort = getSearchParam(req.query.sort);

  const searchUrl = buildSearchUrl(req, query, continuation, date, type, duration, sort);

  try {
    const xmlData = await getFreshSearchResults(searchUrl);

    return renderTemplate(res, req, "search.ejs", {
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
      summary: ""
    });
  } catch (error) {
    if (isSearchTimeoutError(error)) {
      logSearchErrorOnce(
        `timeout:${searchUrl}`,
        `[POKE-search] upstream timeout while searching for '${query}'`
      );
    } else {
      logSearchErrorOnce(
        `error:${error.code || error.name || "unknown"}:${searchUrl}`,
        `[POKE-search] upstream error while searching for '${query}': ${error.message}`
      );
    }

    return renderTemplate(res, req, "search.ejs", {
      invresults: null,
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
      summary: ""
    });
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
const CHANNEL_PUBLISHED_CACHE_TTL = 3600000;
const CHANNEL_URL_CACHE_TTL = 1800000;
const CHANNEL_URL_FAILURE_TTL = 45000;
const CHANNEL_LOG_COOLDOWN_TTL = 30000;
const CHANNEL_CACHE_MAX = 1500;
const CHANNEL_URL_CACHE_MAX = CHANNEL_CACHE_MAX * 8;
const CHANNEL_URL_FETCH_TIMEOUT_MS = 5500;
const CHANNEL_FEED_FETCH_TIMEOUT_MS = 4000;

class PokeTimedCache {
  constructor(maxEntries, defaultTtlMs) {
    this.maxEntries = maxEntries;
    this.defaultTtlMs = defaultTtlMs;
    this.items = new Map();
  }

  get(key) {
    const item = this.items.get(key);

    if (!item) {
      return undefined;
    }

    if (Date.now() >= item.expiresAt) {
      this.items.delete(key);
      return undefined;
    }

    this.items.delete(key);
    this.items.set(key, item);

    return item.value;
  }

  set(key, value, ttlMs) {
    const ttl = Number.isFinite(ttlMs) && ttlMs > 0 ? ttlMs : this.defaultTtlMs;

    this.items.set(key, {
      value,
      expiresAt: Date.now() + ttl
    });

    this.trim();

    return value;
  }

  delete(key) {
    this.items.delete(key);
  }

  has(key) {
    return this.get(key) !== undefined;
  }

  trim() {
    while (this.items.size > this.maxEntries) {
      const oldestKey = this.items.keys().next().value;
      this.items.delete(oldestKey);
    }
  }
}

class PokeSingleFlight {
  constructor() {
    this.pending = new Map();
  }

  run(key, task) {
    if (this.pending.has(key)) {
      return this.pending.get(key);
    }

    const promise = Promise.resolve()
      .then(task)
      .finally(() => {
        this.pending.delete(key);
      });

    this.pending.set(key, promise);
    return promise;
  }
}

const channelUrlCache = new PokeTimedCache(CHANNEL_URL_CACHE_MAX, CHANNEL_URL_CACHE_TTL);
const channelUrlFailureCache = new PokeTimedCache(CHANNEL_URL_CACHE_MAX, CHANNEL_URL_FAILURE_TTL);
const channelPublishedCache = new PokeTimedCache(CHANNEL_CACHE_MAX, CHANNEL_PUBLISHED_CACHE_TTL);
const channelLogCooldown = new PokeTimedCache(2000, CHANNEL_LOG_COOLDOWN_TTL);

const channelUrlInFlight = new PokeSingleFlight();
const channelPublishedInFlight = new PokeSingleFlight();
const channelBundleInFlight = new PokeSingleFlight();

let undiciFetchPromise = null;

function getUndiciFetch() {
  if (!undiciFetchPromise) {
    undiciFetchPromise = import("undici").then(({ fetch }) => fetch);
  }

  return undiciFetchPromise;
}

function getPublishedFailureCache() {
  if (typeof fetchFailureCache !== "undefined" && fetchFailureCache) {
    return fetchFailureCache;
  }

  if (!globalThis.__pokeChannelPublishedFailureCache) {
    globalThis.__pokeChannelPublishedFailureCache = Object.create(null);
  }

  return globalThis.__pokeChannelPublishedFailureCache;
}

function getPublishedFailureTtl() {
  if (typeof FETCH_FAILURE_TTL !== "undefined" && Number.isFinite(FETCH_FAILURE_TTL)) {
    return FETCH_FAILURE_TTL;
  }

  return CHANNEL_URL_FAILURE_TTL;
}

function isFreshPublishedFailure(id) {
  const cache = getPublishedFailureCache();
  const failedAt = cache[id];

  return Number.isFinite(failedAt) && Date.now() - failedAt < getPublishedFailureTtl();
}

function rememberPublishedFailure(id) {
  const cache = getPublishedFailureCache();
  cache[id] = Date.now();
}

function forgetPublishedFailure(id) {
  const cache = getPublishedFailureCache();
  delete cache[id];
}

function logChannelIssue(key, message) {
  if (channelLogCooldown.has(key)) {
    return;
  }

  channelLogCooldown.set(key, true);
  console.log(message);
}

function createTimeoutSignal(timeoutMs) {
  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
    return {
      signal: AbortSignal.timeout(timeoutMs),
      cancel: null
    };
  }

  if (typeof AbortController !== "undefined") {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    return {
      signal: controller.signal,
      cancel: () => clearTimeout(timer)
    };
  }

  return {
    signal: undefined,
    cancel: null
  };
}

function isTimeoutError(error) {
  if (!error) {
    return false;
  }

  return (
    error.name === "AbortError" ||
    error.name === "TimeoutError" ||
    error.code === "ABORT_ERR" ||
    error.code === "UND_ERR_HEADERS_TIMEOUT" ||
    error.code === "UND_ERR_BODY_TIMEOUT" ||
    error.code === "UND_ERR_CONNECT_TIMEOUT"
  );
}

async function fetchTextFast(fetch, url, headers, timeoutMs) {
  const timeout = createTimeoutSignal(timeoutMs);
  const options = {
    headers
  };

  if (timeout.signal) {
    options.signal = timeout.signal;
  }

  try {
    const response = await fetch(url, options);

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        text: "",
        timedOut: false,
        error: null
      };
    }

    return {
      ok: true,
      status: response.status,
      text: await response.text(),
      timedOut: false,
      error: null
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      text: "",
      timedOut: isTimeoutError(error),
      error
    };
  } finally {
    if (typeof timeout.cancel === "function") {
      timeout.cancel();
    }
  }
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

function getSingleQueryValue(value) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function getContinuationParam(value) {
  const raw = getSingleQueryValue(value);
  const text = String(raw || "").trim();

  if (!text) {
    return "";
  }

  return `&continuation=${encodeURIComponent(text)}`;
}

function getSortByValue(value) {
  const raw = getSingleQueryValue(value);
  const text = String(raw || "").trim();

  return text || "newest";
}

function getUrlCacheKey(url) {
  return String(url || "");
}

function makeChannelUrls(ID, sort_by, continuation) {
  const apiUrl = config.invapi + "/channels/";

  return {
    videos: `${apiUrl}${ID}/${atob(ChannelTabs.videos)}?sort_by=${encodeURIComponent(sort_by)}${continuation}&h=${btoa(ChannelTabs.community)}`,
    shorts: `${apiUrl}${ID}/${atob(ChannelTabs.shorts)}?sort_by=${encodeURIComponent(sort_by)}${continuation}&h=${btoa(ChannelTabs.community)}`,
    streams: `${apiUrl}${ID}/${atob(ChannelTabs.streams)}?sort_by=${encodeURIComponent(sort_by)}${continuation}&h=${btoa(ChannelTabs.community)}`,
    community: `${apiUrl}${ID}/${atob(ChannelTabs.community)}?hl=en-US&h=${ChannelTabs.community}`,
    playlist: `${apiUrl}${ID}/${atob(ChannelTabs.playlist)}?hl=en-US&h=${btoa(ChannelTabs.community)}`,
    releases: `${apiUrl}${ID}/releases?hl=en-US&h=${btoa(ChannelTabs.community)}`,
    info: `${apiUrl}${ID}/?h=${btoa(ChannelTabs.community)}`
  };
}

async function fetchChannelPublishedJSON(fetch, id) {
  const cached = channelPublishedCache.get(id);

  if (cached !== undefined) {
    return cached;
  }

  return channelPublishedInFlight.run(id, async () => {
    if (isFreshPublishedFailure(id)) {
      return {
        ID: id,
        published: " "
      };
    }

    const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(id)}`;

    const response = await fetchTextFast(
      fetch,
      url,
      {
        accept: "application/atom+xml"
      },
      CHANNEL_FEED_FETCH_TIMEOUT_MS
    );

    if (!response.ok) {
      rememberPublishedFailure(id);

      if (response.timedOut) {
        logChannelIssue(`published-timeout:${id}`, `fetchChannelPublishedJSON timed out for ${id}`);
      } else if (response.status) {
        logChannelIssue(`published-http:${id}:${response.status}`, `HTTP ${response.status} for ${url}`);
      } else if (response.error) {
        logChannelIssue(`published-error:${id}`, `fetchChannelPublishedJSON failed for ${id}: ${response.error.message}`);
      }

      return {
        ID: id,
        published: " "
      };
    }

    const match = response.text.match(/<feed[\s\S]*?<published>([^<]+)<\/published>/i);

    if (!match) {
      rememberPublishedFailure(id);

      return {
        ID: id,
        published: " "
      };
    }

    const iso = match[1].trim();
    const date = new Date(iso);

    if (Number.isNaN(date.getTime())) {
      rememberPublishedFailure(id);

      return {
        ID: id,
        published: " "
      };
    }

    const published = new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC"
    }).format(date);

    const value = {
      ID: id,
      published
    };

    forgetPublishedFailure(id);
    channelPublishedCache.set(id, value, CHANNEL_PUBLISHED_CACHE_TTL);

    return value;
  });
}

async function fetchChannelJson(fetch, name, url) {
  const key = getUrlCacheKey(url);
  const cached = channelUrlCache.get(key);

  if (cached !== undefined) {
    return cached;
  }

  if (channelUrlFailureCache.has(key)) {
    return null;
  }

  return channelUrlInFlight.run(key, async () => {
    const secondCached = channelUrlCache.get(key);

    if (secondCached !== undefined) {
      return secondCached;
    }

    if (channelUrlFailureCache.has(key)) {
      return null;
    }

    const response = await fetchTextFast(
      fetch,
      url,
      {
        "User-Agent": config.useragent
      },
      CHANNEL_URL_FETCH_TIMEOUT_MS
    );

    if (!response.ok) {
      channelUrlFailureCache.set(key, true, CHANNEL_URL_FAILURE_TTL);

      if (response.timedOut) {
        logChannelIssue(`url-timeout:${name}:${key}`, `channel ${name} fetch timed out`);
      } else if (response.status) {
        logChannelIssue(`url-http:${name}:${response.status}:${key}`, `channel ${name} fetch returned HTTP ${response.status}`);
      } else if (response.error) {
        logChannelIssue(`url-error:${name}:${key}`, `channel ${name} fetch failed: ${response.error.message}`);
      }

      return null;
    }

    try {
      const parsed = getJson(response.text);

      if (parsed === null || typeof parsed === "undefined") {
        channelUrlFailureCache.set(key, true, CHANNEL_URL_FAILURE_TTL);
        return null;
      }

      channelUrlFailureCache.delete(key);
      channelUrlCache.set(key, parsed, CHANNEL_URL_CACHE_TTL);

      return parsed;
    } catch (error) {
      channelUrlFailureCache.set(key, true, CHANNEL_URL_FAILURE_TTL);
      logChannelIssue(`json-error:${name}:${key}`, `channel ${name} JSON parse failed: ${error.message}`);
      return null;
    }
  });
}

function getChannelBundleKey(ID, sort_by, continuation) {
  return JSON.stringify({
    ID,
    sort_by,
    continuation
  });
}

async function getChannelBundle(fetch, ID, sort_by, continuation) {
  const key = getChannelBundleKey(ID, sort_by, continuation);
  const urls = makeChannelUrls(ID, sort_by, continuation);

  return channelBundleInFlight.run(key, async () => {
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
      fetchChannelJson(fetch, "videos", urls.videos),
      fetchChannelJson(fetch, "shorts", urls.shorts),
      fetchChannelJson(fetch, "playlist", urls.playlist),
      fetchChannelJson(fetch, "releases", urls.releases),
      fetchChannelJson(fetch, "streams", urls.streams),
      fetchChannelJson(fetch, "community", urls.community),
      fetchChannelJson(fetch, "info", urls.info)
    ]);

    return {
      createdAccountGetDate,
      tj,
      shorts,
      playlist,
      released,
      stream,
      c,
      cinv
    };
  });
}

function getChannelThumbnailUrl(video) {
  const videoId = video && video.videoId ? video.videoId : "";
  const thumbnails = Array.isArray(video && video.videoThumbnails)
    ? video.videoThumbnails
    : [];

  const maxresDefaultThumbnail = thumbnails.find(
    (thumbnail) => thumbnail && thumbnail.quality === "maxresdefault"
  );

  if (maxresDefaultThumbnail) {
    return `https://vid.puffyan.us/vi/${videoId}/maxresdefault.jpg`;
  }

  return `https://vid.puffyan.us/vi/${videoId}/hqdefault.jpg`;
}

app.get("/channel/", async (req, res, next) => {
  try {
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

    const continuation = getContinuationParam(req.query.continuation);
    const continuationl = getContinuationParam(req.query.continuationl);
    const continuations = getContinuationParam(req.query.continuations);
    const sort_by = getSortByValue(req.query.sort_by);
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
      getThumbnailUrl: getChannelThumbnailUrl,
      continuation,
      released,
      wiki: "",
      getFirstLine,
      isMobile: !!(req.useragent && req.useragent.isMobile),
      about: "",
      playlist,
      subs:
        typeof subscribers === "string"
          ? subscribers.replace("subscribers", "")
          : "None"
    });
  } catch (error) {
    return next(error);
  }
});
  
};