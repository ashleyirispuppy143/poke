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

module.exports = function (app, config, renderTemplate) {

  app.get("/shorts/:id", (req, res) => {
    if (!req.params.id) {
      return res.redirect("/");
    }

    return res.redirect(`/watch?v=${req.params.id}&from=short`);
  });

  app.get("/v/:id", (req, res) => {
    if (!req.params.id) {
      return res.redirect("/");
    }

    return res.redirect(`/watch?v=${req.params.id}&from=v_url`);
  });

  app.get("/c/:id", (req, res) => {
    if (!req.params.id) {
      return res.redirect("/");
    }

    return res.redirect(`/channel?id=${req.params.id}&from=c_channel_url`);
  });

  app.get("/video/upload", (req, res) => {
    res.redirect("https://youtube.com/upload");
  });

  app.get("/discover", (req, res) => {
    res.redirect("/app");
  });

  app.get("/sex", (req, res) => {
    res.redirect("https://poketube.fun/watch?v=dQw4w9WgXcQ&e=f");
  });

  app.get("/gaming", (req, res) => {
    res.redirect("/app?tab=gaming");
  });

  app.get("/custom-theme", (req, res) => {
    res.redirect("/customize");
  });

  app.get("/results", (req, res) => {
    if (!req.query.search_query) {
      return res.redirect("/");
    }

    return res.redirect("/search?query=" + req.query.search_query);
  });
};
