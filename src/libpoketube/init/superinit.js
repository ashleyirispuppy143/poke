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
  { id: "video", name: "video pages", path: "../init/pages-video.js", desc: "where the magic moving pictures live" },
  { id: "redir", name: "redirects/old pages", path: "../init/pages-redir.js", desc: "the professional procrastinator that sends u elsewhere" },
  { id: "channel", name: "Download and channel pages", path: "../init/pages-channel-and-download.js", desc: "da place where people dump their cool stuff" },
  { id: "api", name: "api pages", path: "../init/pages-api.js", desc: "the secret robot handshake system" },
  { id: "telemetry", name: "telemetry [api/stats]", path: "../init/telemetry.js", desc: "counting your beans while u watch stuff" },
  { id: "static", name: "static pages", path: "../init/pages-static.js", desc: "boring pages that refuse to move an inch" },
  { id: "account", name: "account pages", path: "../init/pages-account.js", desc: "your digital identity crisis" },
  { id: "main", name: "main pages", path: "../init/pages-404-and-main.js", desc: "the glue holding this whole mess together" },
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
      for (const moduleInfo of MODULES_TO_LOAD) {
        const setting = MODULE_SETTINGS.find(s => s.moduleId === moduleInfo.id);
        const isEnabled = setting ? setting.enabled : true;

        const mandatory = ["main", "video", "channel", "static"];
        const suggested = ["redir", "api"];

        //  Refuse to boot if mandatory modules are disabled
        if (!isEnabled && mandatory.includes(moduleInfo.id)) {
          initlog(`[FATAL ERROR] You tried to disable ${moduleInfo.id} but Poke literally cannot exist without it.`);
          initlog(`[FATAL ERROR] Refusing to boot. Please enable ${moduleInfo.id} in your config and try again.`);
          process.exit(1); // Stop everything
        }

        // Log warning if recommended modules are disabled
        if (!isEnabled && suggested.includes(moduleInfo.id)) {
          initlog(`[WARNING] You disabled ${moduleInfo.id}. Users are going to have a very bad time and it is definitely not suggested.`);
        }

        if (isEnabled) {
          initlog(`Loading [${moduleInfo.id}] (enabled: ${isEnabled}) - ${moduleInfo.desc}`);
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