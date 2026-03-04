/*

    PokeTube is a Free/Libre youtube front-end !
    
    Copyright (C) 2021-2025 Poke
 
    This file is Licensed under LGPL-3.0-or-later. Poketube itself is GPL, Only this file is LGPL.
    
    see a copy here: https://www.gnu.org/licenses/lgpl-3.0.txt
    
    please dont remove this comment while sharing this code.
    
*/

const fetcher = require("../libpoketube/libpoketube-dislikes.js");
const core = require("../libpoketube/libpoketube-youtube-player.js");
const INNERTUBE = require("../libpoketube/libpoketube-youtube-player.js");
const musicInfo = require("music-info");
const wiki = require("wikipedia");
const config = require("../../config.json")
const fetch = require("node-fetch");
const toJson = require("xml2json").toJson;
const express = require("express");
const useragent = require("express-useragent");
const path = require("path");
const hash = require("js-sha512").sha384;
const moment = require("moment");
const getColors = require("get-image-colors");

/**
 * Logs a message to the console with a specific prefix
 *
 * @param {string} args - The message to wood (get it log wood im so funny)
 */
function initlog(args) {
  console.log("[LIBPT INTSYS] " + args);
}

/**
 * Initializes the application and starts listening on the specified port or something idk aaaaa help me
 *
 * @param {object} app - The express application
 * @param {string} [port=config.server_port] - The port to listen on
 */
function init(app, port) {
  if (!port) port = config.server_port;
  try {
    app.listen(port, () => {
      initlog("Loading poke: success!" + " on port " + port);
    });
  } catch (err) {
    initlog("Loading poke: error", err);
  }

}


module.exports = {
  /**
   * The fetcher module
   * @type {object}
   */
  fetcher,
  
  /**
   * The core module
   * @type {object}
   */
  core,
  INNERTUBE,
  
  /**
   * The musicInfo module
   * @type {object}
   */
  musicInfo,
  
  /**
   * The wiki module
   * @type {object}
   */
  wiki,
  
  /**
   * Logs a message to the console with a specific prefix
   * @type {Function}
   */
  initlog,
  
  /**
   * Initializes the application and starts listening on the specified port
   * @type {Function}
   */
  init,
  
  /**
   * The version of the LIB-Poke module
   * @type {string}
   */
  version: "libpoketube-04.03.2026-21a06bce72-git",
  
  /**
   * The external modules used by PokeTube
   * @type {object}
   */
  modules: {
    /**
     * The fetch module 
     * @type {object}
     */
    fetch,
    
    /**
     * The toJson module
     * @type {Function}
     */
    toJson,
    
    /**
     * The express module
     * @type {object}
     */
    express,
    
    /**
     * The useragent module
     * @type {object}
     */
    useragent,
    
    /**
     * The path module
     * @type {object}
     */
    path,
    
    /**
     * The hash module
     * @type {Function}
     */
    hash,
    
    /**
     * The moment module
     * @type {object}
     */
    moment,
    
    /**
     * The getColors module
     * @type {Function}
     */
    getColors,
  }
};
