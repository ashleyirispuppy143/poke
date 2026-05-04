const { initlog, modules } = require("../libpoketube-initsys.js");
const { api: currentApiVersion } = require("../init/pages-api.js");

const UNSUPPORTED_BROWSER_HTML = `<!DOCTYPE html><html><head><title>Browser is not supported :p</title><style>body{margin-left:auto;margin-right:auto;display:flex;max-width:43em;font-family:sans-serif;}</style></head><body><h1>Heyo :3</h1><br><p style="margin-top:4em;margin-left:-7.4em;">hoi - poke does and <b>will not work</b> on Internet Explorer :p<br>if u wanna use poke try using Firefox (firefox.com) or Chromium :3<br>love u :3</p></body></html>`;

// --- MODULE CONFIGURATION ---
// Change true to false here to disable a specific module :3
const MODULE_SETTINGS = [
  { moduleId: "video", enabled: true },
  { moduleId: "redir", enabled: true },
  { moduleId: "channel", enabled: true },
  { moduleId: "api", enabled: true },
  { moduleId: "telemetry", enabled: true },
  { moduleId: "static", enabled: true },
  { moduleId: "account", enabled: true },
  { moduleId: "main", enabled: true },
];

const MODULES_TO_LOAD = [
  { id: "video", name: "video pages", path: "../init/pages-video.js" },
  { id: "redir", name: "redirects/old pages", path: "../init/pages-redir.js" },
  { id: "channel", name: "Download and channel pages", path: "../init/pages-channel-and-download.js" },
  { id: "api", name: "api pages", path: "../init/pages-api.js" },
  { id: "telemetry", name: "telemetry [api/stats]", path: "../init/telemetry.js" },
  { id: "static", name: "static pages", path: "../init/pages-static.js" },
  { id: "account", name: "account pages", path: "../init/pages-account.js" },
  { id: "main", name: "main pages", path: "../init/pages-404-and-main.js" },
];

function blockIEMiddleware(req, res, next) {
  const userAgent = req.useragent?.source || "";
  if (userAgent.includes('MSIE') || userAgent.includes('Trident')) {
    return res.status(400).send(UNSUPPORTED_BROWSER_HTML);
  }
  next();
}

function startUpdateDaemon() {
  const UPDATE_INTERVAL_MS = 24 * 60 * 60 * 1000; 

  setInterval(async () => {
    try {
      const url = `https://poketube.fun/api/version.json?v=3`;
      const res = await modules.fetch(url);
      const data = await res.json(); 

      if (data.vernum === currentApiVersion) {
        console.log("[UPDATE DAEMON] PokeTube is up to date!");
      } else {
        console.warn("[UPDATE DAEMON] PokeTube is out of date! Please re-clone the poketube repo :p");
      }
    } catch (err) {
      console.error("[UPDATE DAEMON] Failed to check for updates:", err.message);
    }
  }, UPDATE_INTERVAL_MS);
}

function init(app, config, rendertemplate) {
  let isReady = false;

  initlog("wait a few mins... pt on timeout rn");

  app.use(blockIEMiddleware);

  app.use((req, res, next) => {
    if (!isReady) {
      return res.status(503).send("PokeTube is starting up... please refresh in a moment.");
    }
    next();
  });

  setTimeout(() => {
    initlog("Starting superinit");
    initlog("[START] Load pages");

    if (Math.random() < 0.5) {
      initlog("https://poketube.fun/watch?v=lpiB2wMc49g");
    }

    try {
      // Dynamically load page modules
      for (const moduleInfo of MODULES_TO_LOAD) {
        // Find the setting for this module
        const setting = MODULE_SETTINGS.find(s => s.moduleId === moduleInfo.id);
        
        // If the setting is missing, we assume true. Otherwise, check the 'enabled' flag.
        const isEnabled = setting ? setting.enabled : true;

        if (isEnabled) {
          initlog(`Loading ${moduleInfo.name}`);
          require(moduleInfo.path)(app, config, rendertemplate);
          initlog(`Loaded ${moduleInfo.name}`);
        } else {
          initlog(`Skipping ${moduleInfo.name} (Disabled in config)`);
        }
      }

      initlog("[OK] Load pages");
      initlog("Loaded pages - initing poketube finished :3");

      isReady = true;

      // startUpdateDaemon();

    } catch (err) {
      initlog(`[POKE SEGFAULT] Load pages \n${err.stack || err}`);
      console.error(err);
    }
  }, 100);
}

module.exports = {
  sinit: init,
};