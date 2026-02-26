/*

    PokeTube is an Free/Libre youtube front-end. this is our main file.
  
    Copyright (C) 2021-2024 POKETUBE (https://codeberg.org/ashleyirispuppy/poketube)
    
    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.
    
    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program. If not, see https://www.gnu.org/licenses/.
  */

(async function () {
  const {
    fetcher,
    core,
    wiki,
    musicInfo,
    modules,
    version,
    initlog,
    init,
  } = require("./src/libpoketube/libpoketube-initsys.js");
  const media_proxy = require("./src/libpoketube/libpoketube-video.js");
  const { sinit } = require("./src/libpoketube/init/superinit.js");
  const innertube = require("./src/libpoketube/libpoketube-youtubei-objects.json");
  const fs = require("fs");
  const config = require("./config.json");
  const u = await media_proxy();

  fs.readFile("ascii_txt.txt", "utf8", (err, data) => {
    if (err) {
      console.error("Error reading the file:", err);
      return;
    }

    // Log the ASCII art to the console
    console.log(data);
  });
  initlog("Loading...");
  initlog(
    "[Welcome] Welcome To Poke - The ultimate privacy app - :3 " +
      "Running " +
      `Node ${process.version} - V8 v${
        process.versions.v8
      } -  ${process.platform.replace("linux", "GNU/Linux")} ${
        process.arch
      } Server - libpt ${version}`
  );

  const {
    IsJsonString,
    convert,
    getFirstLine,
    capitalizeFirstLetter,
    turntomins,
    getRandomInt,
    getRandomArbitrary,
  } = require("./src/libpoketube/ptutils/libpt-coreutils.js");
  const { ieBlockMiddleware } = require("./src/libpoketube/ptutils/ie-blocker.js");
  initlog("Loaded libpt-coreutils");

  const templateDir = modules.path.resolve(
    `${process.cwd()}${modules.path.sep}html`
  );

  const sha384 = modules.hash;
  const rateLimit = require("express-rate-limit");

const limiter = rateLimit({
    windowMs: 30 * 1000, // 30 second window
    max: 200, // limit each IP to 200 requests per 30 seconds
});

  var app = modules.express();
  app.use(limiter);
  app.use(ieBlockMiddleware);
  initlog("Loaded express.js");
  app.engine("html", require("ejs").renderFile);
  app.use(modules.express.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded
  app.use(modules.useragent.express());
  app.use(modules.express.json()); // for parsing application/json
  app.enable("trust proxy");
  var toobusy = require("toobusy-js");

  const renderTemplate = async (res, req, template, data = {}) => {
    res.render(
      modules.path.resolve(`${templateDir}${modules.path.sep}${template}`),
      Object.assign(data)
    );
  };

  // Set check interval to a faster value. This will catch more latency spikes
  // but may cause the check to be too sensitive.
  toobusy.interval(110);

  toobusy.maxLag(3500);

  app.use(function (req, res, next) {
    if (toobusy()) {
      res.send(503, "I'm busy right now, sorry.");
    } else {
      next();
    }
  });

  toobusy.onLag(function (currentLag) {
    process.exit(1);
    console.log("Event loop lag detected! Latency: " + currentLag + "ms");
  });


  const initPokeTube = function () {
    sinit(app, config, renderTemplate);
    initlog("inited super init");
    init(app);
    initlog("inited app");
  };

  try {
    app.use(function (req, res, next) {
      res.header("Access-Control-Allow-Origin", "*");
      if (req.secure) {
        res.header(
          "Strict-Transport-Security",
          "max-age=31536000; includeSubDomains; preload"
        );
      }
      res.header("secure-poketube-instance", "1");

      // opt out of googles "FLOC" bullcrap :p See https://spreadprivacy.com/block-floc-with-duckduckgo/
      res.header("Permissions-Policy", "interest-cohort=()");
      res.header("software-name", "poke");
      next();
    });

    app.use(function (request, response, next) {
      if (config.enablealwayshttps && !request.secure) {
        if (
          !/^https:/i.test(
            request.headers["x-forwarded-proto"] || request.protocol
          )
        ) {
          return response.redirect(
            "https://" + request.headers.host + request.url
          );
        }
      }

      next();
    });

    app.use(function (req, res, next) {
 
      res.header(
        "X-PokeTube-Youtube-Client-Name",
        innertube.innertube.CONTEXT_CLIENT.INNERTUBE_CONTEXT_CLIENT_NAME
      );
      res.header(
        "Hey-there",
        "Do u wanna help poke? contributions are welcome :3 https://codeberg.org/ashleyirispuppy/poke"
      );
     
      res.header(
        "X-PokeTube-Youtube-Client-Version",
        innertube.innertube.CLIENT.clientVersion
      );
      res.header(
        "X-PokeTube-Client-name",
        innertube.innertube.CLIENT.projectClientName
      );
      res.header("X-PokeTube-Speeder", "3 seconds no cache, 280ms w/cache");
      res.header("X-HOSTNAME", req.hostname);
      if (req.url.match(/^\/(css|js|img|font)\/.+/)) {
        res.setHeader(
          "Cache-Control",
          "public, max-age=" + config.cacher_max_age
        ); // cache header
        res.setHeader("poketube-cacher", "STATIC_FILES");
      }

      const a = 890;

      if (!req.url.match(/^\/(css|js|img|font)\/.+/)) {
        res.setHeader("Cache-Control", "public, max-age=" + a); // cache header
        res.setHeader("poketube-cacher", "PAGE");
      }
      next();
    });

    initlog("[OK] Load headers");
  } catch {
    initlog("[FAILED] load headers");
  }

  try {
    app.get("/robots.txt", (req, res) => {
      res.sendFile(__dirname + "/robots.txt");
    });

    initlog("[OK] Load robots.txt");
  } catch {
    initlog("[FAILED] load robots.txt");
  }

  initPokeTube();
})();
