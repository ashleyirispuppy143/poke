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

var http = require("https");
var ping = require("ping");

const sha384 = modules.hash;

const splash = ["Woke!","Gay gay homosexaul gay!","free Palestine!","free software!","im... stuff!","frick capitalism!","still calling it twitter btw!","boop!","no way!","traaaa rightssss!","XD!","nya!","say gex!","ur valid :3","gay space communism!","has nothing to with pokemon!","A house of gold :3","doesnt have AI!","no web3!","keemstar is a bald ___!","No One calls it 'X'! ","Eat the rich!","Does Not include Nazis!","also try piped!","not alt-right!","coke zero > coke classic!","poke & chill!","can play HD!","also try invidious!","rms <3!","du hast","can u belive no one bought this?","reee","1.000.000€!","pika!","fsf.org","ssfffssfssfffaassssfsdf!","𝓯𝓻𝓮𝓪𝓴𝔂poke","they not like us!","to pimp a butterfly!","king kunta!","HUMBLE.","can you save my hds?","sahlo folina!","we come for you!","no chances!","dema dont control us!","i see your problem is, your proctologist","got both hands on your shoulder","while ur bottomless!","you should bounce bounce bounce man!","its lavish!","im vibin, vibin!","i would swim the paladin strait","hello clancy!","NO NOT ME,ITS FOR A FRIEND","im fairly local!","i dont wanna go like this!","east is up!","not done, josh dun!","your the judge, oh no!","I dont wanna backslide","welcome back to trench!","sai is propaganda!"," •|i|• Ø i+! ].[","stay alive! |-/","the few, the proud, the Emotional!","ill morph into someone else","still alive","follow the torches","i created this world!","to feel some control!","destory it if i want!","o7 keons","at least let me clean my room","100+ stars on gh!","let the vibe slide over me!","sip a capri sun like its don peregon","i love you alot!","BREACH OUT SEPT 12!","now even gayer!","its joever..","lesbiam,,,","poke!!!","discord.poketube.fun!","women are pretty!","men are handsome!","enbys are cute!","you are cute :3","read if cute!","this shit awesome!","ur pawsome!","i check the doors!","chcek the windows and","pull the blinds..","RAWFEAR","putting on a drum show!","welcome to breach!","i been this way...","i want to change...","FEDHKDHDGBK!","100% meow!","meows at u","hai i am gay","yay, GEX!","say gex..,,","wha if we um erm","awesome screen!","awesome camera!","long lasting battery life","stallmansupport.org!!!","does include nya~!!!","actually stable-ish! :3"];

function getJson(str) {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

module.exports = function (app, config, renderTemplate) {
 app.get("/app", async function (req, res) {
  const { fetch } = await import("undici");

   const isMobile = req.useragent?.isMobile;
  const currentTab = req.query.tab;
   
if (isMobile && currentTab !== "search" && !req.query.mobilesearch) {
  return res.redirect("/app?tab=search");
}

  let tab = "";
  if (req.query.tab) {
    tab = `/?type=${capitalizeFirstLetter(req.query.tab)}`;
  }
 
const invtrend = await fetch(`${config.invapi}/trending${tab}`, {
    headers: { "User-Agent": config.useragent },
  });
  const t = getJson(await invtrend.text());

   
  const p = "";

  let j = { results: [], meta: {} };

  const normalizeSearchData = (data) => {
    if (!data) return { results: [] };
    if (Array.isArray(data)) return { results: data };
    if (Array.isArray(data.results))
      return { results: data.results, meta: data.meta || {} };
    if (Array.isArray(data.items))
      return { results: data.items, meta: data.meta || {} };
    if (Array.isArray(data.videos))
      return { results: data.videos, meta: data.meta || {} };
    return { results: [], meta: { note: "unrecognized search payload shape" } };
  };

  try {
    const query =
      (typeof req.query.mobilesearch === "string" &&
        req.query.mobilesearch.trim()) ??
      (typeof req.query.query === "string" && req.query.query.trim()) ??
      (typeof req.query.q === "string" && req.query.q.trim()) ??
      "";

    const continuation = (req.query.continuation ?? "1").toString();

    if (query) {
      const searchUrl = `${config.invapi}/search?q=${encodeURIComponent(
        query
      )}&type=video&page=${encodeURIComponent(continuation)}`;

      const r = await fetch(searchUrl, {
        headers: { "User-Agent": config.useragent },
      });

      if (!r.ok) {
        j = {
          results: [],
          error: true,
          meta: { status: r.status, statusText: r.statusText, url: searchUrl },
        };
        console.error("[mobilesearch] HTTP error", j.meta);
      } else {
        const ct = r.headers.get("content-type") || "";
        let data;

        if (ct.includes("application/json")) {
          data = await r.json();
        } else {
          const txt = await r.text();
          data = await Promise.resolve(getJson(txt));
        }

        j = normalizeSearchData(data);
      }
    } else {
      j = { results: [], error: true, meta: { reason: "missing query" } };
      console.warn(
        "[mobilesearch] Missing query parameter (mobilesearch/q/query)"
      );
    }

    j.meta = { ...(j.meta || {}), continuation };
  } catch (err) {
    j = {
      results: [],
      error: true,
      meta: {
        reason: "exception",
        message: String((err && err.message) || err),
      },
    };
    console.error("[mobilesearch] Exception:", err);
  }

  renderTemplate(res, req, "discover.ejs", {
    tab: req.query.tab,
    isMobile: req.useragent.isMobile,
    p,
    mobilesearch: req.query.mobilesearch,
    q: req.query.q,
    inv: t,
    turntomins,
    continuation: req.query.continuation,
    j,
  });
});

  
           

  app.get("/:v*?", async function (req, res) {
    const uaos = req.useragent.os;
    const random = splash[Math.floor(Math.random() * splash.length)];
    const browser = req.useragent.browser;
    const isOldWindows = (uaos === "Windows 7" || uaos === "Windows 8") &&browser === "Firefox";
    var proxyurl = config.p_url;
   
    const secure = ["poketube.fun", "localhost"].includes(req.hostname);
    const verify = ["poketube.fun", "poke.ashley0143.xyz", "localhost"].includes(
      req.hostname
    );


    const officialHost = "poketube.fun";
    const officialApi = config.invapi
 if (req.hostname !== officialHost && config.invapi === officialApi) {
    const message = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Configuration Error - PokeTube</title>
        <style>
          @font-face {  
            font-family: "PokeTube Flex";  
            src: url("/static/robotoflex.ttf");  
            font-style: normal;  
            font-stretch: 1% 800%;  
            font-display: swap;
          }

          body {
            background-color: #0f0f0f;
            color: #f1f1f1;
            font-family: "PokeTube Flex", Roboto, Arial, sans-serif;
            margin: 0;
            padding: 0;
            height: 100vh;
            display: flex;
            flex-direction: column;
          }

          /* Mock YouTube Header */
          .yt-header {
            height: 56px;
            padding: 0 16px;
            display: flex;
            align-items: center;
            position: fixed;
            top: 0;
            width: 100%;
            box-sizing: border-box;
            background-color: #0f0f0f;
          }

          .yt-logo {
            display: flex;
            align-items: center;
            text-decoration: none;
            outline: none;
          }

          .yt-logo img {
            height: 24px; /* Standard YouTube logo height */
            width: auto;
            display: block;
          }

          /* Main Error Content */
          .error-content {
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
            padding: 20px;
            margin-top: 56px; /* Offset for header */
          }

          .monkey-emoji {
            font-size: 72px;
            margin-bottom: 24px;
            user-select: none;
          }

          h1 { 
            color: #f1f1f1; 
            font-size: 24px; 
            font-weight: 400; 
            margin: 0 0 24px 0; 
          }
          
          p {
            color: #aaaaaa;
            font-size: 16px;
            line-height: 1.5;
            margin: 0 0 16px 0;
            max-width: 500px;
          }
          
          b {
            color: #f1f1f1;
            font-weight: 500;
          }
          
          code { 
            background: rgba(255, 255, 255, 0.1); 
            color: #f1f1f1; 
            padding: 2px 6px; 
            border-radius: 4px; 
            font-family: 'Courier New', Courier, monospace;
            font-size: 14px;
          }
          
          a {
            color: #3ea6ff;
            text-decoration: none;
          }
          
          a:hover { 
            text-decoration: underline; 
          }

          .footer-note {
            margin-top: 32px;
            font-size: 14px;
            color: #717171;
          }
        </style>
      </head>
      <body>
        
        <div class="yt-header">
          <a href="/" class="yt-logo" title="PokeTube Home">
            <img src="/css/logo-poke.svg" alt="PokeTube Logo">
          </a>
        </div>

        <div class="error-content">
           <h1>Configuration Error</h1>
          
          <p>
            It looks like you're using <code>Poke</code>'s own Invidious API endpoint
            for your custom instance.
          </p>
          
          <p>
            Please edit your <code>config.json</code> to match your own setup — using
            Poke’s shared API is kinda lame 😅 since it also rate-limits <b>poketube.fun</b>
            itself when too many people use it.
          </p>
          
          <p>
            Set up your own Invidious instance instead — it’s easy! <br>
            See the official setup guide: 
            <a href="https://docs.invidious.io" target="_blank">docs.invidious.io</a>
          </p>
          
          <p class="footer-note">
            Once you've updated <code>config.json</code>, restart your server and everything will work fine.
          </p>
        </div>

      </body>
      </html>
    `;

    return res.status(500).send(message);
  }     
  const rendermainpage = () => {
  // Check if skiplandingpage query exists AND is not something like 0/false/no/off
  const shouldSkip = ('skiplandingpage' in req.query) && !['0','false','no','off'].includes(String(req.query.skiplandingpage).toLowerCase());

  // If skiplandingpage is set OR user is on mobile redirect to /app
  return (shouldSkip || req.useragent.isMobile) ? res.redirect("/app") : renderTemplate(res, req, "landing.ejs", {
        secure,
        embedtype: req.query.embedtype,
        banner: config.banner,
        DisablePokeChan: req.query.DisablePokeChan,
        verify,
        isOldWindows,
        proxyurl,
        random,
      });
};

// Check if the route has a "v" parameter AND make sure it only contains letters/numbers
    if (req.params.v && /[a-zA-Z0-9]+/.test(req.params.v)) {
      const isvld = await core.isvalidvideo(req.params.v);
      if (isvld && req.params.v.length >= 10) {
        return res.redirect(`/watch?v=${req.params.v}`);
      } else {
        res.status(404);
        return renderTemplate(res, req, "404.ejs", {
          isOldWindows,
          random,
        });
      }
    }

    return rendermainpage();
  });
};
