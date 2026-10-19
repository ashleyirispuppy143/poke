// in the beginning.... god made mrrprpmnaynayaynaynayanyuwuuuwmauwnwanwaumawp :p
 

 /**
 * @license
 * Video.js 8.x <http://videojs.com/>
 * Copyright Brightcove, Inc. <https://www.brightcove.com/>
 * Available under Apache License Version 2.0
 * <https://github.com/videojs/video.js/blob/main/LICENSE>
 *
 * Includes vtt.js <https://github.com/mozilla/vtt.js>
 * Available under Apache License Version 2.0
 * <https://github.com/mozilla/vtt.js/blob/main/LICENSE>
 * /////////////////////////////////////////////////////////////////////////////////////
 * credits:
 * 100% puppy made code! 0 slop guarenteed!
 * works amazing :3
 * this works, 100%! no issues..at all!!
 * UNDER GPL 3-OR-LATER license, but i think video.js istelf is Apache 2.0, so basically this code, the players code is gpl3, u get wha we mean :3
 * gay!
 * ///////////////////////////////////////////////////////////////////////////
 * "It takes a lot of hard work to make something simple." ~ Steve Jobs 
 */
 const SyncLevel = {
  driftSeconds: 0,
  driftMs: 0,
  synced: true,
  status: 'initializing',
  videoTime: 0,
  audioTime: 0,
  videoReadyState: 0,
  audioReadyState: 0,
  videoBufferAhead: 0,
  audioBufferAhead: 0,
  buffering: false,
  longVideoMode: false,
  highResMode: false,
  error: null,
  valueOf: function() {
    return this.driftMs;
  },
  toString: function() {
    return this.status + ' | drift: ' + this.driftMs + 'ms | synced: ' + this.synced + ' | vBuf: ' + this.videoBufferAhead + 's | aBuf: ' + this.audioBufferAhead + 's';
  }
};
window.SyncLevel = SyncLevel;

(function() {
  'use strict';

  const qs = new URLSearchParams(window.location.search);
  const qua = qs.get("quality") || "";

  var config = {
    minPlayBuffer: 0.12,
    minResumeBuffer: 0.35,
    longVideoThresholdSec: 600,
    ultraLongVideoThresholdSec: 1800,
    longMinPlayBuffer: 0.35,
    longMinResumeBuffer: 0.85,
    highResMinPlayBuffer: 0.45,
    highResMinResumeBuffer: 1.15,
    endTolerance: 0.45,
    alignThreshold: 0.045,
    driftTolerance: 0.18,
    heavyDriftTolerance: 0.26,
    hardSeekDrift: 0.65,
    heavyHardSeekDrift: 0.95,
    syncCooldownMs: 3500,
    watchdogMs: 320,
    tickMs: 65,
    seekTimeoutMs: 2500,
    longSeekTimeoutMs: 5500,
    highResSeekTimeoutMs: 6500,
    startupProtectionMs: 5500
  };

  window.Alabaster = {
    active: false,
    muxedMode: false,
    audioOnly: false,
    testErrorActive: false,
    onAudioOnlyChange: null,
    _showErrorUI: null,
    _hideErrorUI: null,
    _showLoopedIndicator: null,
    _hideLoopedIndicator: null,
    setAudioOnly: function(active) {
      this.audioOnly = Boolean(active);
      if (typeof this.onAudioOnlyChange === 'function') {
        this.onAudioOnlyChange(this.audioOnly);
      }
    },
    EnableTestErrorUi: function(subtitleMessage, headlineTitle) {
      this.testErrorActive = true;
      var titleText = headlineTitle || 'Video unavailable';
      var subText = subtitleMessage || 'An error occurred while loading the media streams. Please try again later.';
      SyncLevel.error = 'ALABASTER_TEST_ERR';
      SyncLevel.status = 'error-test-ui';
      if (typeof this._showErrorUI === 'function') {
        this._showErrorUI(subText, titleText, true);
      }
      return 'Alabaster test error UI enabled';
    },
    DisableTestUI: function() {
      this.testErrorActive = false;
      SyncLevel.error = null;
      if (typeof this._hideErrorUI === 'function') {
        this._hideErrorUI();
      }
      if (typeof this._hideLoopedIndicator === 'function') {
        this._hideLoopedIndicator();
      }
      return 'Alabaster test error UI disabled';
    },
    DisableTestErrorUi: function() {
      return this.DisableTestUI();
    }
  };

  var compat = {
    now: function() {
      return Date.now();
    },
    raf: function(fn) {
      return (window.requestAnimationFrame || function(cb) { return setTimeout(cb, 16); })(fn);
    },
    getMeta: function(selector) {
      var el = document.querySelector(selector);
      return (el && el.content) ? el.content.trim() : '';
    },
    isTouchLayout: function() {
      var coarse = window.matchMedia && window.matchMedia('(hover: none) and (pointer: coarse)').matches;
      return Boolean(coarse);
    },
    isAutoplayBlockedByPolicy: function() {
      try {
        if (navigator.getAutoplayPolicy) {
          var policy = navigator.getAutoplayPolicy('mediaelement');
          if (policy === 'disallowed' || policy === 'allowed-muted') return true;
        }
      } catch (_) {}
      return false;
    },
    proxyThumbnailUrl: function(rawUrl) {
      if (!rawUrl || typeof rawUrl !== 'string') return '';
      var trimmed = rawUrl.trim();
      if (!trimmed) return '';
      var proxyBase = window.proxyurl;
      if (!proxyBase) return trimmed;
      if (trimmed.indexOf(proxyBase) === 0) return trimmed;
      try {
        var parsed = new URL(trimmed, window.location.href);
        var host = (parsed.hostname || '').toLowerCase();
        if (host.indexOf('ytimg.com') !== -1 || host.indexOf('ytimage') !== -1 || host.indexOf('ggpht.com') !== -1 || host.indexOf('googleusercontent.com') !== -1) {
          return proxyBase + encodeURIComponent(parsed.href);
        }
        return parsed.href;
      } catch (_) {
        if (trimmed.indexOf('i.ytimg') !== -1 || trimmed.indexOf('i.ytimage') !== -1) {
          return proxyBase + encodeURIComponent(trimmed);
        }
        return trimmed;
      }
    },
    lockPitch: function(media) {
      var keys = ['preservesPitch', 'mozPreservesPitch', 'webkitPreservesPitch'];
      for (var i = 0; i < keys.length; i++) {
        if (keys[i] in media) media[keys[i]] = true;
      }
    },
    safePlay: function(playFn) {
      try {
        var p = playFn();
        if (p && typeof p.catch === 'function') p.catch(function() {});
        return p;
      } catch (_) {
        return null;
      }
    },
    formatClock: function(seconds) {
      if (isNaN(seconds) || seconds < 0 || !isFinite(seconds)) return '0:00';
      var s = Math.floor(seconds);
      var hrs = Math.floor(s / 3600);
      var mins = Math.floor((s % 3600) / 60);
      var secs = s % 60;
      var padSecs = secs < 10 ? '0' + secs : String(secs);
      if (hrs > 0) {
        var padMins = mins < 10 ? '0' + mins : String(mins);
        return hrs + ':' + padMins + ':' + padSecs;
      }
      return mins + ':' + padSecs;
    },
    onSeekSettled: function(media, callback, timeoutMs) {
      var finished = false;
      var timer = 0;
      var check = function() {
        if (finished) return;
        if (!media.seeking && (media.readyState >= 2 || bufferMonitor.ahead(media) >= 0.1)) {
          done();
        }
      };
      var done = function() {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        media.removeEventListener('seeked', check, false);
        media.removeEventListener('canplay', check, false);
        media.removeEventListener('canplaythrough', check, false);
        media.removeEventListener('loadeddata', check, false);
        callback();
      };
      if (!media.seeking && (media.readyState >= 2 || bufferMonitor.ahead(media) >= 0.1)) {
        done();
        return function() {};
      }
      timer = setTimeout(done, timeoutMs || config.seekTimeoutMs);
      media.addEventListener('seeked', check, false);
      media.addEventListener('canplay', check, false);
      media.addEventListener('canplaythrough', check, false);
      media.addEventListener('loadeddata', check, false);
      return function() {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        media.removeEventListener('seeked', check, false);
        media.removeEventListener('canplay', check, false);
        media.removeEventListener('canplaythrough', check, false);
        media.removeEventListener('loadeddata', check, false);
      };
    }
  };

  var metadataParser = (function() {
    var skin = '(?:\\uFE0F|\\uD83C[\\uDFFB-\\uDFFF])*';
    var count = '[\\d][\\d.,]*[KMBTkmbt]?';
    var divider = '[|\\s\\u2022\\u00B7\\u2013\\u2014-]+';
    var up = '\\uD83D\\uDC4D' + skin + '\\s*' + count;
    var down = '\\uD83D\\uDC4E' + skin + '\\s*' + count;
    var views = '(?:' + divider + '\\uD83D\\uDCC8' + skin + '\\s*' + count + '(?:\\s*(?:Views?|Watch(?:e[sd])?|Plays?))?)?';
    var age = '(?:' + divider + '(?:\\uD83D[\\uDDD3\\uDCC5\\uDCC6\\uDDD2])' + skin + '\\s*\\d+\\s*(?:second|minute|hour|day|week|month|year)s?\\s*ago)?';
    var pattern = new RegExp(up + divider + down + views + age, 'i');

    return {
      read: function() {
        var title = compat.getMeta('meta[name="title"]') || compat.getMeta('meta[property="og:title"]') || document.title || '';
        var desc = compat.getMeta('meta[name="twitter:description"]') || compat.getMeta('meta[property="og:description"]') || compat.getMeta('meta[name="description"]') || '';
        var rawThumb = compat.getMeta('meta[property="og:image"]') || compat.getMeta('meta[name="og:image"]') || compat.getMeta('meta[name="twitter:image"]') || '';
        var proxiedThumb = compat.proxyThumbnailUrl(rawThumb);
        var author = (typeof window.authorchannelname === 'string' && window.authorchannelname.trim()) ? window.authorchannelname.trim() : '';
        var matched = desc.match(pattern);
        var stats = matched ? matched[0].replace(/\s*\|\s*/g, ' | ').replace(/\s+/g, ' ').trim() : '';
        return {
          title: title.trim(),
          description: stats,
          artworkUrl: proxiedThumb,
          author: author
        };
      }
    };
  })();

  function SetAlabasterUI(player, onRetryCallback) {
    var info = metadataParser.read();

    if (info.artworkUrl && typeof player.poster === 'function' && !player.poster()) {
      player.poster(info.artworkUrl);
    }

    player.ready(function() {
      var existingTitleBar = player.getChild('TitleBar');
      if (!existingTitleBar && player.addChild) {
        existingTitleBar = player.addChild('TitleBar', {
          title: info.title,
          description: info.description
        });
      }
      if (existingTitleBar && typeof existingTitleBar.update === 'function') {
        existingTitleBar.update({ title: info.title, description: info.description });
      }

      var rootEl = player.el && player.el();
      if (rootEl && !rootEl.querySelector('.vjs-title-bar')) {
        var fallbackBar = document.createElement('div');
        fallbackBar.className = 'vjs-title-bar';
        var tEl = document.createElement('div');
        tEl.className = 'vjs-title-bar-title';
        tEl.textContent = info.title;
        var dEl = document.createElement('div');
        dEl.className = 'vjs-title-bar-description';
        dEl.textContent = info.description;
        if (!info.description) dEl.classList.add('vjs-hidden');
        fallbackBar.appendChild(tEl);
        fallbackBar.appendChild(dEl);
        rootEl.appendChild(fallbackBar);
      }

      var loopInd = document.getElementById('loopedIndicator');
      if (loopInd) {
        if (rootEl && loopInd.parentNode !== rootEl) {
          rootEl.appendChild(loopInd);
        }
        loopInd.style.cssText = 'position:absolute;bottom:80px;left:50%;transform:translateX(-50%);background:rgba(15,15,15,0.9);color:#fff;padding:14px 20px;border-radius:12px;z-index:40;display:none;align-items:center;flex-direction:column;font-family:"poketube flex","PokeTube Flex",-apple-system,sans-serif;font-size:13px;pointer-events:auto;text-align:center;box-shadow:0 8px 24px rgba(0,0,0,0.6);border:1px solid rgba(255,255,255,0.08);max-width:42em;';
        loopInd.innerHTML = '<span style="color:#bbb;line-height:1.4;">The video is taking a long time to buffer. Try refreshing the page to fix this issue.</span>';
        window.Alabaster._showLoopedIndicator = function() {
          loopInd.style.display = 'flex';
        };
        window.Alabaster._hideLoopedIndicator = function() {
          loopInd.style.display = 'none';
        };
      }

      if (rootEl && !rootEl.querySelector('.vjs-alabaster-error-overlay')) {
        var errOverlay = document.createElement('div');
        errOverlay.className = 'vjs-alabaster-error-overlay';
        errOverlay.style.cssText = 'position:absolute;inset:0;z-index:45;display:none;align-items:center;justify-content:center;padding:5% 8%;box-sizing:border-box;background:radial-gradient(circle at 73% 50%, rgba(168, 28, 240, 0.24) 0%, rgba(255, 42, 133, 0.08) 28%, rgba(15, 15, 15, 0.98) 65%), #0f0f0f;color:#fff;user-select:none;pointer-events:auto;font-family:"poketube flex","PokeTube Flex",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;';

        var layoutWrap = document.createElement('div');
        layoutWrap.style.cssText = 'display:flex;flex-direction:row;align-items:center;justify-content:space-between;width:100%;max-width:720px;gap:32px;flex-wrap:wrap;';

        var leftCol = document.createElement('div');
        leftCol.style.cssText = 'flex:1 1 260px;display:flex;flex-direction:column;align-items:flex-start;justify-content:center;text-align:left;gap:10px;';

        var errHeadline = document.createElement('div');
        errHeadline.style.cssText = 'font-size:clamp(20px, 3vw, 28px);font-weight:700;line-height:1.2;color:#ffffff;letter-spacing:-0.2px;margin:0;';
        errHeadline.textContent = 'Video unavailable';

        var errSubText = document.createElement('div');
        errSubText.style.cssText = 'font-size:clamp(13px, 1.6vw, 15px);font-weight:400;line-height:1.45;color:#aaaaaa;max-width:380px;margin:0;';
        errSubText.textContent = 'An error occurred while loading the media streams. Please try again later.';

        var btnWrap = document.createElement('div');
        btnWrap.style.cssText = 'display:flex;flex-direction:row;align-items:center;margin-top:8px;gap:12px;';

        var retryBtn = document.createElement('button');
        retryBtn.type = 'button';
        retryBtn.style.cssText = 'padding:8px 18px;border-radius:999px;border:1px solid rgba(255,255,255,0.18);background:rgba(255,255,255,0.1);color:#fff;font-size:13px;font-weight:600;cursor:pointer;transition:background 0.15s ease;';
        retryBtn.textContent = 'Retry';
        retryBtn.addEventListener('mouseenter', function() { retryBtn.style.background = 'rgba(255,255,255,0.2)'; });
        retryBtn.addEventListener('mouseleave', function() { retryBtn.style.background = 'rgba(255,255,255,0.1)'; });
        retryBtn.addEventListener('click', function(evt) {
          evt.stopPropagation();
          if (window.Alabaster.testErrorActive) {
            window.Alabaster.DisableTestUI();
            return;
          }
          errOverlay.style.display = 'none';
          if (typeof onRetryCallback === 'function') {
            onRetryCallback();
          }
        });

        var reportBtn = document.createElement('a');
        reportBtn.href = 'https://codeberg.org/ashleyirispuppy/poke/issues/new?template=issue_template%2fplayer-bug.yml';
        reportBtn.target = '_blank';
        reportBtn.style.cssText = 'padding:8px 18px;border-radius:999px;border:1px solid rgba(255,255,255,0.18);background:transparent;color:#fff;font-size:13px;font-weight:600;cursor:pointer;text-decoration:none;display:inline-block;transition:background 0.15s ease;';
        reportBtn.textContent = 'Report the issue';
        reportBtn.addEventListener('mouseenter', function() { reportBtn.style.background = 'rgba(255,255,255,0.1)'; });
        reportBtn.addEventListener('mouseleave', function() { reportBtn.style.background = 'transparent'; });

        btnWrap.appendChild(retryBtn);
        btnWrap.appendChild(reportBtn);

        leftCol.appendChild(errHeadline);
        leftCol.appendChild(errSubText);
        leftCol.appendChild(btnWrap);

        var rightCol = document.createElement('div');
        rightCol.style.cssText = 'flex:0 0 auto;display:flex;align-items:center;justify-content:center;margin:0 auto;';
        rightCol.innerHTML = [
          '<svg width="180" height="180" viewBox="0 0 180 180" fill="none" xmlns="http://www.w3.org/2000/svg" style="width:clamp(110px, 18vw, 170px);height:auto;overflow:visible;">',
          '  <defs>',
          '    <linearGradient id="alabasterSimpleIGrad" x1="0%" y1="0%" x2="100%" y2="100%">',
          '      <stop offset="0%" stop-color="#ff5e97"/>',
          '      <stop offset="50%" stop-color="#a31aff"/>',
          '      <stop offset="100%" stop-color="#ff2a85"/>',
          '    </linearGradient>',
          '  </defs>',
          '  <circle cx="90" cy="90" r="75" fill="rgba(255,255,255,0.06)"/>',
          '  <circle cx="90" cy="52" r="12" fill="url(#alabasterSimpleIGrad)"/>',
          '  <rect x="78" y="76" width="24" height="62" rx="12" fill="url(#alabasterSimpleIGrad)"/>',
          '</svg>'
        ].join('');

        layoutWrap.appendChild(leftCol);
        layoutWrap.appendChild(rightCol);
        errOverlay.appendChild(layoutWrap);
        rootEl.appendChild(errOverlay);

        window.Alabaster._showErrorUI = function(subMsg, headlineMsg) {
          errHeadline.textContent = headlineMsg || 'Video unavailable';
          errSubText.textContent = subMsg || 'An error occurred while loading the media streams. Please try again later.';
          errOverlay.style.display = 'flex';
        };

        window.Alabaster._hideErrorUI = function() {
          errOverlay.style.display = 'none';
        };
      }

      var syncFullscreenTitleBarVisibility = function() {
        if (!rootEl) return;
        var isFs = Boolean(
          (typeof player.isFullscreen === 'function' && player.isFullscreen()) ||
          document.fullscreenElement ||
          document.webkitFullscreenElement ||
          rootEl.classList.contains('vjs-fullscreen')
        );
        var titleBars = rootEl.querySelectorAll('.vjs-title-bar, .vjs-title-bar-title, .vjs-title-bar-description');
        for (var i = 0; i < titleBars.length; i++) {
          var node = titleBars[i];
          if (!isFs) {
            node.style.setProperty('display', 'none', 'important');
            node.style.setProperty('visibility', 'hidden', 'important');
            node.style.setProperty('opacity', '0', 'important');
          } else {
            node.style.removeProperty('display');
            node.style.removeProperty('visibility');
            node.style.removeProperty('opacity');
            if (node.classList.contains('vjs-title-bar-description') && !info.description) {
              node.style.setProperty('display', 'none', 'important');
            }
          }
        }
      };

      syncFullscreenTitleBarVisibility();
      player.on('fullscreenchange', syncFullscreenTitleBarVisibility);
      document.addEventListener('fullscreenchange', syncFullscreenTitleBarVisibility, false);
      document.addEventListener('webkitfullscreenchange', syncFullscreenTitleBarVisibility, false);

      player.on('dispose', function() {
        document.removeEventListener('fullscreenchange', syncFullscreenTitleBarVisibility, false);
        document.removeEventListener('webkitfullscreenchange', syncFullscreenTitleBarVisibility, false);
      });

      var bar = player.controlBar;
      if (!bar) return;

      var barEl = bar.el && bar.el();
      if (barEl && !barEl.querySelector('.vjs-player-time-toggle')) {
        var timeBtn = document.createElement('button');
        timeBtn.type = 'button';
        timeBtn.className = 'vjs-button vjs-control vjs-player-time-toggle';
        var textSpan = document.createElement('span');
        textSpan.className = 'vjs-control-text';
        textSpan.textContent = '-0:00 / 0:00';
        timeBtn.appendChild(textSpan);

        var showCurrentMode = false;
        var refreshTimeLabel = function() {
          var dur = player.duration() || 0;
          var cur = player.currentTime() || 0;
          var rem = Math.max(0, dur - cur);
          if (showCurrentMode) {
            textSpan.textContent = compat.formatClock(cur) + ' / ' + compat.formatClock(dur);
          } else {
            textSpan.textContent = '-' + compat.formatClock(rem) + ' / ' + compat.formatClock(dur);
          }
        };

        timeBtn.addEventListener('click', function() {
          showCurrentMode = !showCurrentMode;
          refreshTimeLabel();
        });

        player.on('timeupdate', refreshTimeLabel);
        player.on('loadedmetadata', refreshTimeLabel);
        player.on('durationchange', refreshTimeLabel);
        barEl.appendChild(timeBtn);
      }
    });
  }

  function createBackgroundShield() {
    var wakeLock = null;
    var webLockRelease = null;

    return {
      activate: function() {
        if (navigator.wakeLock && !wakeLock && !document.hidden) {
          navigator.wakeLock.request('screen').then(function(sentinel) {
            wakeLock = sentinel;
            sentinel.addEventListener('release', function() { wakeLock = null; });
          }).catch(function() {});
        }

        if (navigator.locks && !webLockRelease) {
          navigator.locks.request('vjs_alabaster_playback_lock', function() {
            return new Promise(function(resolve) { webLockRelease = resolve; });
          }).catch(function() {});
        }
      },
      deactivate: function() {
        if (wakeLock) {
          wakeLock.release().catch(function() {});
          wakeLock = null;
        }
        if (webLockRelease) {
          webLockRelease();
          webLockRelease = null;
        }
      },
      teardown: function() {
        this.deactivate();
      }
    };
  }

  var bufferMonitor = {
    aheadAt: function(media, targetTime) {
      var ranges = media.buffered;
      if (!ranges || ranges.length === 0) return 0;
      var t = targetTime;
      var count = ranges.length;
      var matchedEnd = -1;

      for (var i = 0; i < count; i++) {
        var start = ranges.start(i);
        var end = ranges.end(i);
        if (t >= start - 0.35 && t <= end + 0.05) {
          matchedEnd = end;
          for (var j = i + 1; j < count; j++) {
            if (ranges.start(j) <= matchedEnd + 0.35) {
              matchedEnd = Math.max(matchedEnd, ranges.end(j));
            } else {
              break;
            }
          }
          break;
        }
      }

      if (matchedEnd !== -1) {
        return Math.max(0, matchedEnd - t);
      }
      return 0;
    },
    ahead: function(media, targetTime) {
      return this.aheadAt(media, targetTime !== undefined ? targetTime : media.currentTime);
    },
    isTimeBuffered: function(media, targetTime, minLeadAfter) {
      var lead = minLeadAfter !== undefined ? minLeadAfter : 0.15;
      return this.aheadAt(media, targetTime) >= lead;
    },
    isNearEnd: function(media, targetTime) {
      var dur = media.duration;
      var t = targetTime !== undefined ? targetTime : media.currentTime;
      return Boolean(dur && isFinite(dur) && dur > 0 && (dur - t <= config.endTolerance));
    },
    canPlayCleanly: function(media, requiredLead, timeBufferingMs, targetTime) {
      if (media.seeking) return false;
      if (media.ended) return true;
      var rState = media.readyState;
      if (this.isNearEnd(media, targetTime) && rState >= 2) return true;

      var lead = this.ahead(media, targetTime);
      if (rState < 2) return false;

      if (rState >= 4 && lead >= requiredLead * 0.6) return true;

      var dynamicLead = requiredLead;
      if (timeBufferingMs > 3500) {
        dynamicLead = Math.min(0.08, requiredLead);
      } else if (timeBufferingMs > 1600) {
        dynamicLead = Math.max(0.12, requiredLead * 0.45);
      }

      if (rState >= 3 && lead >= dynamicLead) return true;
      if (rState === 2 && lead >= Math.max(dynamicLead, 0.2)) return true;

      return false;
    }
  };

  function getValidAudioSrc(audioEl) {
    if (!audioEl) return '';
    var direct = audioEl.currentSrc || audioEl.getAttribute('src') || '';
    if (direct.trim()) return direct.trim();
    var source = audioEl.querySelector('source');
    return source ? (source.src || source.getAttribute('src') || '').trim() : '';
  }

  function initAlabasterPlayer() {
    var rawVideo = document.querySelector('video.video-js, video');
    var rawAudio = document.querySelector('audio');
    if (!rawVideo || !window.videojs) return;

    var wantsAutoplay = Boolean(
      rawVideo.autoplay ||
      rawVideo.hasAttribute('autoplay') ||
      (rawAudio && (rawAudio.autoplay || rawAudio.hasAttribute('autoplay'))) ||
      rawVideo.getAttribute('data-setup') && rawVideo.getAttribute('data-setup').indexOf('"autoplay":true') !== -1
    );

    rawVideo.autoplay = false;
    rawVideo.removeAttribute('autoplay');
    try { rawVideo.pause(); } catch (_) {}

    if (rawAudio) {
      rawAudio.autoplay = false;
      rawAudio.removeAttribute('autoplay');
      try { rawAudio.pause(); } catch (_) {}
    }

    var player = window.videojs(rawVideo);
    if (!player) return;

    if (typeof player.autoplay === 'function' && player.autoplay()) {
      wantsAutoplay = true;
      player.autoplay(false);
    }

    var isMuxedMedium = qua.toLowerCase() === 'medium';
    var hasSeparateAudio = Boolean(getValidAudioSrc(rawAudio));

    if (isMuxedMedium || !hasSeparateAudio) {
      SetAlabasterUI(player, function() {
        player.load();
        player.play();
      });
      window.Alabaster.muxedMode = true;
      SyncLevel.status = 'muxed-single-stream';
      if (rawAudio) {
        try {
          rawAudio.pause();
          rawAudio.removeAttribute('src');
        } catch (_) {}
      }

      player.ready(function() {
        var rootEl = player.el && player.el();
        var videoEl = (rootEl && rootEl.querySelector('video')) || rawVideo;
        videoEl.addEventListener('click', function() {
          if (videoEl.paused) videoEl.play();
          else videoEl.pause();
        });

        if (wantsAutoplay) {
          if (compat.isAutoplayBlockedByPolicy() && !videoEl.muted) {
            try { videoEl.pause(); } catch (_) {}
            player.removeClass('vjs-playing');
            player.addClass('vjs-paused');
            player.trigger('pause');
          } else {
            try {
              var p = player.play();
              if (p && typeof p.catch === 'function') {
                p.catch(function(err) {
                  if (err && err.name === 'NotAllowedError') {
                    try { videoEl.pause(); } catch (_) {}
                    player.removeClass('vjs-playing');
                    player.addClass('vjs-paused');
                    player.trigger('pause');
                  }
                });
              }
            } catch (_) {}
          }
        }
      });
      return;
    }

    player.ready(function() {
      var rootEl = player.el && player.el();
      var videoEl = (rootEl && rootEl.querySelector('video')) || rawVideo;
      var audioEl = rawAudio;
      if (!videoEl || videoEl._alabasterAttached) return;
      videoEl._alabasterAttached = true;
      window.Alabaster.active = true;

      videoEl.autoplay = false;
      videoEl.removeAttribute('autoplay');
      audioEl.autoplay = false;
      audioEl.removeAttribute('autoplay');
      videoEl.preload = 'auto';
      audioEl.preload = 'auto';
      videoEl.playsInline = true;
      videoEl.setAttribute('playsinline', '');
      videoEl.setAttribute('webkit-playsinline', '');
      audioEl.playsInline = true;
      audioEl.setAttribute('playsinline', '');
      videoEl.disableRemotePlayback = true;
      audioEl.disableRemotePlayback = true;
      compat.lockPitch(videoEl);
      compat.lockPitch(audioEl);

      var nativeVideoPlay = HTMLMediaElement.prototype.play.bind(videoEl);
      var nativeVideoPause = HTMLMediaElement.prototype.pause.bind(videoEl);
      var nativeAudioPlay = HTMLMediaElement.prototype.play.bind(audioEl);
      var nativeAudioPause = HTMLMediaElement.prototype.pause.bind(audioEl);

      var timeDesc = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'currentTime');
      var nativeGetVTime = timeDesc && timeDesc.get ? timeDesc.get.bind(videoEl) : function() { return videoEl.currentTime; };
      var nativeSetVTime = timeDesc && timeDesc.set ? timeDesc.set.bind(videoEl) : function(v) { videoEl.currentTime = v; };
      var nativeGetATime = timeDesc && timeDesc.get ? timeDesc.get.bind(audioEl) : function() { return audioEl.currentTime; };
      var nativeSetATime = timeDesc && timeDesc.set ? timeDesc.set.bind(audioEl) : function(v) { audioEl.currentTime = v; };

      var pausedDesc = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'paused');
      var nativeGetVPaused = pausedDesc && pausedDesc.get ? pausedDesc.get.bind(videoEl) : function() { return false; };
      var nativeGetAPaused = pausedDesc && pausedDesc.get ? pausedDesc.get.bind(audioEl) : function() { return false; };

      try { nativeVideoPause(); } catch (_) {}
      try { nativeAudioPause(); } catch (_) {}

      var shield = createBackgroundShield();
      var registeredEvents = [];

      var state = {
        wantPlaying: false,
        userSeeking: false,
        internalVideoSeeking: false,
        internalAudioSeeking: false,
        liveSnapUntil: 0,
        seekTarget: 0,
        savedMasterTime: 0,
        frozenDisplayTime: 0,
        bufferStartTime: 0,
        buffering: false,
        launchingPlay: false,
        playGraceUntil: 0,
        startupShieldUntil: compat.now() + config.startupProtectionMs,
        explicitPauseTokenUntil: 0,
        awaitingGestureUnlock: false,
        tabWakeUntil: 0,
        lastHiddenSyncAt: 0,
        hidden: Boolean(document.hidden),
        hasStartedPlayback: false,
        internalDepth: 0,
        sequence: 0,
        lastCorrectionAt: 0,
        driftCount: 0,
        vStallSince: 0,
        aStallSince: 0,
        prevVideoTime: -1,
        prevAudioTime: -1,
        watchdogTimer: 0,
        tickTimer: 0,
        cancelSeekWait: null,
        seekStartTime: 0,
        lastTapAt: 0,
        lastMetaFingerprint: '',
        errorCount: 0,
        freezeToken: 0,
        isFrozen: false
      };

      var bufferPctEl = null;
      if (rootEl) {
        bufferPctEl = rootEl.querySelector('.vjs-buffer-percentage');
        if (!bufferPctEl) {
          bufferPctEl = document.createElement('div');
          bufferPctEl.className = 'vjs-buffer-percentage';
          bufferPctEl.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%, -50%);color:#fff;font-size:14px;font-weight:bold;z-index:41;display:none;pointer-events:none;text-shadow:0 1px 3px rgba(0,0,0,0.8);font-family:sans-serif;';
          rootEl.appendChild(bufferPctEl);
        }
      }

      SetAlabasterUI(player, function() {
        var resumePos = state.savedMasterTime || 0;
        state.errorCount = 0;
        SyncLevel.error = null;
        state.startupShieldUntil = compat.now() + config.startupProtectionMs;
        runInternal(function() {
          videoEl.load();
          audioEl.load();
          if (resumePos > 0.1) {
            state.internalVideoSeeking = true;
            state.internalAudioSeeking = true;
            nativeSetVTime(resumePos);
            nativeSetATime(resumePos);
          }
        });
        videoEl.play();
      });

      function isLongVideo() {
        var dur = videoEl.duration || audioEl.duration || 0;
        return Boolean(dur && isFinite(dur) && dur >= config.longVideoThresholdSec);
      }

      function isUltraLongVideo() {
        var dur = videoEl.duration || audioEl.duration || 0;
        return Boolean(dur && isFinite(dur) && dur >= config.ultraLongVideoThresholdSec);
      }

      function isHighResVideo() {
        var vw = videoEl.videoWidth || 0;
        var vh = videoEl.videoHeight || 0;
        if (vw >= 1920 || vh >= 1080) return true;
        var qLower = qua.toLowerCase();
        return qLower.indexOf('2160') !== -1 || qLower.indexOf('1440') !== -1 || qLower.indexOf('4k') !== -1 || qLower.indexOf('2k') !== -1 || qLower.indexOf('hd2160') !== -1 || qLower.indexOf('hd1440') !== -1;
      }

      function isHeavyStream() {
        return isHighResVideo() || isLongVideo();
      }

      function getMinPlayBuffer() {
        if (isHighResVideo()) return config.highResMinPlayBuffer;
        if (isUltraLongVideo()) return config.longMinPlayBuffer * 1.25;
        if (isLongVideo()) return config.longMinPlayBuffer;
        return config.minPlayBuffer;
      }

      function getMinResumeBuffer() {
        if (isHighResVideo()) return config.highResMinResumeBuffer;
        if (isUltraLongVideo()) return config.longMinResumeBuffer * 1.3;
        if (isLongVideo()) return config.longMinResumeBuffer;
        return config.minResumeBuffer;
      }

      function getSeekTimeout() {
        if (isHighResVideo()) return config.highResSeekTimeoutMs;
        if (isLongVideo()) return config.longSeekTimeoutMs;
        return config.seekTimeoutMs;
      }

      function getDriftTolerance() {
        return isHeavyStream() ? config.heavyDriftTolerance : config.driftTolerance;
      }

      function getHardSeekDriftThreshold() {
        return isHeavyStream() ? config.heavyHardSeekDrift : config.hardSeekDrift;
      }

      function isVideoBypassed() {
        return Boolean(window.Alabaster.audioOnly);
      }

      function isTabWaking() {
        return compat.now() < state.tabWakeUntil;
      }

      function isLiveSnapping() {
        return compat.now() < state.liveSnapUntil;
      }

      function isInPlayGrace() {
        return compat.now() < state.playGraceUntil;
      }

      function isInStartupProtection() {
        return compat.now() < state.startupShieldUntil;
      }

      function hasExplicitUserPauseIntent() {
        return compat.now() < state.explicitPauseTokenUntil;
      }

      function isPlaybackCompleted() {
        if (audioEl.ended || videoEl.ended) return true;
        var aDur = audioEl.duration;
        var aCur = nativeGetATime();
        if (aDur && isFinite(aDur) && aDur > 0 && aCur >= aDur - 0.15 && nativeGetAPaused()) {
          return true;
        }
        return false;
      }

      function runInternal(action) {
        state.internalDepth++;
        try {
          return action();
        } finally {
          state.internalDepth--;
        }
      }

      function setVideoTimeInternally(seconds) {
        state.internalVideoSeeking = true;
        runInternal(function() {
          nativeSetVTime(seconds);
        });
      }

      function snapVideoToAudioLive(targetSeconds) {
        state.internalVideoSeeking = true;
        state.liveSnapUntil = compat.now() + 450;
        runInternal(function() {
          nativeSetVTime(targetSeconds);
        });
      }

      function setAudioTimeInternally(seconds) {
        state.internalAudioSeeking = true;
        state.savedMasterTime = seconds;
        runInternal(function() {
          nativeSetATime(seconds);
        });
      }

      function pauseVideoOnly() {
        runInternal(function() {
          if (!nativeGetVPaused()) {
            try { nativeVideoPause(); } catch (_) {}
          }
        });
      }

      function pauseAudioOnly() {
        runInternal(function() {
          if (!nativeGetAPaused()) {
            try { nativeAudioPause(); } catch (_) {}
          }
        });
      }

      function applyBlockedAutoplayPauseState() {
        state.wantPlaying = false;
        state.awaitingGestureUnlock = false;
        state.startupShieldUntil = 0;
        state.launchingPlay = false;
        setBufferSpinner(false);
        clearWatchdog();
        clearPendingWait();
        freezeBothStreams({ alignToAnchor: true });
        shield.deactivate();
        player.removeClass('vjs-playing');
        player.removeClass('vjs-waiting');
        player.removeClass('vjs-seeking');
        player.addClass('vjs-paused');
        player.trigger('pause');
        if (navigator.mediaSession) navigator.mediaSession.playbackState = 'paused';
      }

      function getMasterAnchorTime() {
        if (state.userSeeking) return state.seekTarget;
        var aCur = nativeGetATime();
        var vCur = nativeGetVTime();
        var best = Math.max(aCur || 0, state.savedMasterTime || 0);
        if (best > 0.02) {
          if (aCur > 0.02 && Math.abs(aCur - state.savedMasterTime) < 2.5) {
            state.savedMasterTime = aCur;
            return aCur;
          }
          return best;
        }
        return vCur || 0;
      }

      if (timeDesc && timeDesc.get && timeDesc.set) {
        Object.defineProperty(videoEl, 'currentTime', {
          configurable: true,
          enumerable: true,
          get: function() {
            if (state.userSeeking) return state.seekTarget;
            if (state.buffering && state.frozenDisplayTime > 0) return state.frozenDisplayTime;
            var master = getMasterAnchorTime();
            if (state.wantPlaying || state.hidden || isTabWaking() || isVideoBypassed()) {
              if (master > 0.02) return master;
            }
            return master > 0.02 ? master : nativeGetVTime();
          },
          set: function(val) {
            var target = Number(val);
            if (isNaN(target)) return;
            if (state.internalDepth > 0) {
              nativeSetVTime(target);
              return;
            }
            beginExternalUserSeek(target);
          }
        });
      }

      if (pausedDesc && pausedDesc.get) {
        Object.defineProperty(videoEl, 'paused', {
          configurable: true,
          enumerable: true,
          get: function() {
            if (state.internalDepth > 0) return nativeGetVPaused();
            return !state.wantPlaying;
          }
        });
      }

      window.Alabaster.onAudioOnlyChange = function(active) {
        player[active ? 'addClass' : 'removeClass']('vjs-audio-only-mode');
        if (active) {
          clearPendingWait();
          clearWatchdog();
          setBufferSpinner(false);
          runInternal(function() {
            if (!nativeGetVPaused()) nativeVideoPause();
            if (state.wantPlaying && nativeGetAPaused()) {
              compat.safePlay(nativeAudioPlay);
            }
          });
        } else {
          if (isPlaybackCompleted()) {
            onStreamEnded();
            return;
          }
          state.tabWakeUntil = compat.now() + 900;
          var master = getMasterAnchorTime();
          if (Math.abs(nativeGetVTime() - master) > config.alignThreshold) {
            setVideoTimeInternally(master);
          }
          if (state.wantPlaying) {
            syncPlaybackState();
          }
        }
      };

      function listen(target, eventNames, callback, useCapture) {
        var list = Array.isArray(eventNames) ? eventNames : [eventNames];
        var capture = Boolean(useCapture);
        for (var i = 0; i < list.length; i++) {
          target.addEventListener(list[i], callback, capture);
          registeredEvents.push({ target: target, type: list[i], fn: callback, capture: capture });
        }
      }

      function markExplicitUserPause(evt) {
        if (evt && !evt.isTrusted) return;
        state.explicitPauseTokenUntil = compat.now() + 650;
        state.startupShieldUntil = 0;
      }

      if (rootEl) {
        listen(rootEl, ['pointerdown', 'touchstart', 'mousedown', 'click'], function(evt) {
          if (!evt || !evt.isTrusted) return;
          var path = evt.composedPath ? evt.composedPath() : [];
          if (!path.length && evt.target) {
            var curr = evt.target;
            while (curr) {
              path.push(curr);
              curr = curr.parentNode;
            }
          }
          for (var i = 0; i < path.length; i++) {
            var el = path[i];
            if (!el || !el.tagName) break;
            var className = typeof el.className === 'string' ? el.className : '';
            if (
              className.indexOf('vjs-play-control') !== -1 ||
              className.indexOf('vjs-big-play-button') !== -1
            ) {
              if (state.wantPlaying) markExplicitUserPause(evt);
              break;
            }
          }
        }, true);
      }

      listen(document, 'keydown', function(evt) {
        if (!evt || !evt.isTrusted) return;
        var activeTag = document.activeElement && document.activeElement.tagName ? document.activeElement.tagName.toLowerCase() : '';
        if (activeTag === 'input' || activeTag === 'textarea' || (document.activeElement && document.activeElement.isContentEditable)) {
          return;
        }
        if (evt.code === 'Space' || evt.key === ' ' || evt.key === 'k' || evt.key === 'K') {
          if (state.wantPlaying) {
            markExplicitUserPause(evt);
          }
        }
      }, true);

      var unlockOnFirstGesture = function(evt) {
        if (!evt || !evt.isTrusted) return;
        shield.activate();
      };
      listen(document, ['pointerdown', 'touchstart', 'keydown'], unlockOnFirstGesture, true);

      function getAuthoritativeTime() {
        return getMasterAnchorTime();
      }

      function clearPendingWait() {
        if (state.cancelSeekWait) {
          state.cancelSeekWait();
          state.cancelSeekWait = null;
        }
      }

      function clearWatchdog() {
        if (!state.watchdogTimer) return;
        clearTimeout(state.watchdogTimer);
        state.watchdogTimer = 0;
      }

      function setBufferSpinner(active) {
        var next = Boolean(active);
        if (next && !state.buffering) {
          state.frozenDisplayTime = getAuthoritativeTime();
          state.bufferStartTime = compat.now();
        } else if (!next) {
          state.frozenDisplayTime = 0;
          state.bufferStartTime = 0;
          if (window.Alabaster._hideLoopedIndicator) {
            window.Alabaster._hideLoopedIndicator();
          }
        }
        state.buffering = next;
        if (next) {
          player.addClass('vjs-waiting');
        } else {
          player.removeClass('vjs-waiting');
          player.removeClass('vjs-seeking');
          if (bufferPctEl) bufferPctEl.style.display = 'none';
        }
      }

      function freezeBothStreams(options) {
        var opts = options || {};
        state.freezeToken++;
        state.sequence++;
        state.launchingPlay = false;
        state.isFrozen = true;
        state.liveSnapUntil = 0;
        state.vStallSince = 0;
        state.aStallSince = 0;
        clearPendingWait();

        runInternal(function() {
          var anchor = getMasterAnchorTime();

          var baseRate = player.playbackRate() || 1;
          if (videoEl.playbackRate !== baseRate) videoEl.playbackRate = baseRate;
          if (audioEl.playbackRate !== baseRate) audioEl.playbackRate = baseRate;

          if (!nativeGetAPaused()) {
            try { nativeAudioPause(); } catch (_) {}
          }
          if (!nativeGetVPaused()) {
            try { nativeVideoPause(); } catch (_) {}
          }

          if (opts.alignToAnchor && !state.userSeeking && anchor > 0.02) {
            if (!isVideoBypassed() && !state.hidden && !videoEl.seeking && Math.abs(nativeGetVTime() - anchor) > config.alignThreshold) {
              state.internalVideoSeeking = true;
              try { nativeSetVTime(anchor); } catch (_) {}
            }
            if (!audioEl.seeking && Math.abs(nativeGetATime() - anchor) > config.alignThreshold) {
              state.internalAudioSeeking = true;
              try { nativeSetATime(anchor); } catch (_) {}
            }
          }
        });
      }

      function enforceRateAndVolume() {
        var baseRate = player.playbackRate() || 1;
        if (videoEl.playbackRate !== baseRate) {
          videoEl.playbackRate = baseRate;
        }
        if (audioEl.playbackRate !== baseRate) {
          audioEl.playbackRate = baseRate;
        }
        if (videoEl.defaultPlaybackRate !== baseRate) videoEl.defaultPlaybackRate = baseRate;
        if (audioEl.defaultPlaybackRate !== baseRate) audioEl.defaultPlaybackRate = baseRate;
        if (audioEl.volume !== videoEl.volume) audioEl.volume = videoEl.volume;
        if (audioEl.muted !== videoEl.muted) audioEl.muted = videoEl.muted;
      }

      function updateMediaSessionMetadata() {
        if (!navigator.mediaSession || typeof window.MediaMetadata !== 'function') return;
        try {
          var info = metadataParser.read();
          var authorName = (typeof window.authorchannelname === 'string' && window.authorchannelname.trim()) ? window.authorchannelname.trim() : info.author;
          var fingerprint = (info.title || '') + '|' + (authorName || '') + '|' + (info.artworkUrl || '');
          if (fingerprint === state.lastMetaFingerprint && navigator.mediaSession.metadata) {
            return;
          }
          state.lastMetaFingerprint = fingerprint;
          var artworkList = [];
          if (info.artworkUrl) {
            artworkList = [{ src: info.artworkUrl, sizes: '512x512', type: 'image/jpeg' }];
          }
          navigator.mediaSession.metadata = new window.MediaMetadata({
            title: info.title || document.title || '',
            artist: authorName || '',
            album: info.description || '',
            artwork: artworkList
          });
        } catch (_) {}
      }

      function updateMediaSessionPosition() {
        if (!navigator.mediaSession || typeof navigator.mediaSession.setPositionState !== 'function') return;
        try {
          var dur = videoEl.duration || audioEl.duration || 0;
          var pos = getAuthoritativeTime();
          var rate = player.playbackRate() || 1;
          if (dur > 0 && isFinite(dur) && pos >= 0 && pos <= dur) {
            navigator.mediaSession.setPositionState({
              duration: dur,
              playbackRate: rate,
              position: pos
            });
          }
        } catch (_) {}
      }

      function updateSyncTelemetry() {
        var vCur = nativeGetVTime() || 0;
        var aCur = nativeGetATime() || 0;
        var dSec = Math.abs(vCur - aCur);
        var dMs = Math.round(dSec * 1000);
        SyncLevel.videoTime = Number(vCur.toFixed(3));
        SyncLevel.audioTime = Number(aCur.toFixed(3));
        SyncLevel.videoReadyState = videoEl.readyState;
        SyncLevel.audioReadyState = audioEl.readyState;
        SyncLevel.videoBufferAhead = Number(bufferMonitor.ahead(videoEl, vCur).toFixed(2));
        SyncLevel.audioBufferAhead = Number(bufferMonitor.ahead(audioEl, aCur).toFixed(2));
        SyncLevel.driftSeconds = Number(dSec.toFixed(4));
        SyncLevel.driftMs = dMs;
        SyncLevel.buffering = Boolean(state.buffering);
        SyncLevel.longVideoMode = isLongVideo();
        SyncLevel.highResMode = isHighResVideo();
        SyncLevel.synced = (isVideoBypassed() || state.hidden) ? true : (dSec <= getDriftTolerance());
        if (window.Alabaster.testErrorActive) {
          SyncLevel.status = 'error-test-ui';
        } else if (state.userSeeking) {
          SyncLevel.status = 'seeking';
        } else if (state.buffering) {
          SyncLevel.status = 'buffering-locked';
        } else if (!state.wantPlaying) {
          SyncLevel.status = 'paused';
        } else if (isVideoBypassed() || state.hidden) {
          SyncLevel.status = 'background-audio';
        } else {
          SyncLevel.status = SyncLevel.synced ? 'playing-synced' : 'correcting-drift';
        }
      }

      function handleMediaError(sourceName, mediaEl) {
        if (window.Alabaster.testErrorActive) return;
        var err = mediaEl && mediaEl.error;
        if (!err) return;
        state.errorCount++;
        var codeStr = sourceName + '_ERR_CODE_' + (err.code || 0);
        SyncLevel.error = codeStr;
        freezeBothStreams();
        if (state.errorCount <= 3) {
          var resumeAt = state.savedMasterTime || 0;
          setTimeout(function() {
            if (!state.wantPlaying) return;
            runInternal(function() {
              try {
                mediaEl.load();
                if (resumeAt > 0.1) mediaEl.currentTime = resumeAt;
              } catch (_) {}
            });
            syncPlaybackState();
          }, 600 * state.errorCount);
          return;
        }
        state.wantPlaying = false;
        freezeBothStreams();
        setBufferSpinner(false);
        if (typeof window.Alabaster._showErrorUI === 'function') {
          window.Alabaster._showErrorUI('An error occurred while loading the ' + sourceName.toLowerCase() + ' stream (' + codeStr + ').', 'Video unavailable');
        }
      }

      listen(videoEl, 'error', function() { handleMediaError('VIDEO', videoEl); }, false);
      listen(audioEl, 'error', function() { handleMediaError('AUDIO', audioEl); }, false);

      function armNetworkWatchdog() {
        clearWatchdog();
        state.watchdogTimer = setTimeout(function() {
          state.watchdogTimer = 0;
          if (!state.wantPlaying) return;

          if (isPlaybackCompleted()) {
            onStreamEnded();
            return;
          }

          if (state.userSeeking) {
            if ((!isVideoBypassed() && !state.hidden && videoEl.seeking) || audioEl.seeking) {
              armNetworkWatchdog();
              return;
            }
            completeUserSeek();
            return;
          }

          var timeBuf = state.buffering ? (compat.now() - state.bufferStartTime) : 0;
          var needed = state.buffering ? getMinResumeBuffer() : getMinPlayBuffer();
          var vReady = isVideoBypassed() || (state.hidden && state.hasStartedPlayback) || bufferMonitor.canPlayCleanly(videoEl, needed, timeBuf, nativeGetVTime());
          var aReady = bufferMonitor.canPlayCleanly(audioEl, needed, timeBuf, nativeGetATime());

          if (vReady && aReady) {
            startLockstepPlayback();
            return;
          }

          syncPlaybackState();
          if (state.buffering && state.wantPlaying) armNetworkWatchdog();
        }, config.watchdogMs);
      }

      function startLockstepPlayback() {
        var currentSeq = ++state.sequence;
        clearPendingWait();

        if (!state.wantPlaying || state.userSeeking) return;

        if (isPlaybackCompleted()) {
          onStreamEnded();
          return;
        }

        enforceRateAndVolume();

        if (isVideoBypassed()) {
          state.isFrozen = false;
          setBufferSpinner(false);
          clearWatchdog();
          runInternal(function() {
            if (!nativeGetVPaused()) nativeVideoPause();
            if (nativeGetAPaused() && !audioEl.ended) {
              var pA = nativeAudioPlay();
              if (pA && typeof pA.then === 'function') {
                pA.then(function() {
                  state.hasStartedPlayback = true;
                  updateMediaSessionMetadata();
                  updateMediaSessionPosition();
                  player.addClass('vjs-playing');
                  player.removeClass('vjs-paused');
                  player.trigger('play');
                  player.trigger('playing');
                  if (navigator.mediaSession) navigator.mediaSession.playbackState = 'playing';
                }).catch(function(err) {
                  if (err && err.name === 'NotAllowedError') {
                    applyBlockedAutoplayPauseState();
                  }
                });
              }
            } else if (!nativeGetAPaused()) {
              state.hasStartedPlayback = true;
              if (navigator.mediaSession) navigator.mediaSession.playbackState = 'playing';
            }
          });
          shield.activate();
          return;
        }

        if (state.hidden) {
          var timeBufHidden = state.buffering ? (compat.now() - state.bufferStartTime) : 0;
          var neededHidden = state.buffering ? getMinResumeBuffer() : getMinPlayBuffer();
          var vReadyHidden = state.hasStartedPlayback || bufferMonitor.canPlayCleanly(videoEl, neededHidden, timeBufHidden, nativeGetVTime());
          var aReadyHidden = bufferMonitor.canPlayCleanly(audioEl, neededHidden, timeBufHidden, nativeGetATime());
          if (!vReadyHidden || !aReadyHidden) {
            setBufferSpinner(true);
            freezeBothStreams();
            armNetworkWatchdog();
            return;
          }
          state.isFrozen = false;
          setBufferSpinner(false);
          clearWatchdog();
          runInternal(function() {
            if (nativeGetAPaused() && !audioEl.ended) {
              var pAHidden = nativeAudioPlay();
              if (pAHidden && typeof pAHidden.then === 'function') {
                pAHidden.then(function() {
                  state.hasStartedPlayback = true;
                  updateMediaSessionMetadata();
                  updateMediaSessionPosition();
                  player.addClass('vjs-playing');
                  player.removeClass('vjs-paused');
                  player.trigger('play');
                  player.trigger('playing');
                  if (navigator.mediaSession) navigator.mediaSession.playbackState = 'playing';
                }).catch(function(err) {
                  if (err && err.name === 'NotAllowedError') {
                    applyBlockedAutoplayPauseState();
                  }
                });
              }
            } else if (!nativeGetAPaused()) {
              state.hasStartedPlayback = true;
              if (navigator.mediaSession) navigator.mediaSession.playbackState = 'playing';
            }
          });
          shield.activate();
          return;
        }

        var masterAnchor = getMasterAnchorTime();
        var aCurNow = nativeGetATime();
        var vCurNow = nativeGetVTime();

        if (masterAnchor > 0.05 && Math.abs(aCurNow - masterAnchor) > 0.25 && !audioEl.seeking) {
          freezeBothStreams();
          setBufferSpinner(true);
          state.cancelSeekWait = compat.onSeekSettled(audioEl, function() {
            state.cancelSeekWait = null;
            state.internalAudioSeeking = false;
            syncPlaybackState();
          }, getSeekTimeout());
          setAudioTimeInternally(masterAnchor);
          return;
        }

        var targetSyncTime = Math.max(aCurNow, masterAnchor);
        if (Math.abs(vCurNow - targetSyncTime) > (isHeavyStream() ? 0.22 : 0.09)) {
          freezeBothStreams();
          setBufferSpinner(true);
          state.cancelSeekWait = compat.onSeekSettled(videoEl, function() {
            state.cancelSeekWait = null;
            state.internalVideoSeeking = false;
            syncPlaybackState();
          }, getSeekTimeout());
          setVideoTimeInternally(targetSyncTime);
          return;
        }

        if (videoEl.seeking || audioEl.seeking) {
          setBufferSpinner(true);
          freezeBothStreams();
          var waitMedia = videoEl.seeking ? videoEl : audioEl;
          state.cancelSeekWait = compat.onSeekSettled(waitMedia, function() {
            state.cancelSeekWait = null;
            state.internalVideoSeeking = false;
            state.internalAudioSeeking = false;
            syncPlaybackState();
          }, getSeekTimeout());
          return;
        }

        var timeBuf = state.buffering ? (compat.now() - state.bufferStartTime) : 0;
        var neededLead = state.buffering ? getMinResumeBuffer() : getMinPlayBuffer();
        if (!bufferMonitor.canPlayCleanly(videoEl, neededLead, timeBuf, nativeGetVTime()) || !bufferMonitor.canPlayCleanly(audioEl, neededLead, timeBuf, nativeGetATime())) {
          setBufferSpinner(true);
          freezeBothStreams();
          armNetworkWatchdog();
          return;
        }

        if (!nativeGetAPaused() && !nativeGetVPaused() && !videoEl.seeking && !audioEl.seeking) {
          var liveAudioNow = nativeGetATime();
          var liveDiff = Math.abs(nativeGetVTime() - liveAudioNow);
          if (liveDiff > getDriftTolerance()) {
            if (bufferMonitor.isTimeBuffered(videoEl, liveAudioNow, 0.2)) {
              snapVideoToAudioLive(liveAudioNow);
              state.lastCorrectionAt = compat.now();
            } else if (liveDiff > getHardSeekDriftThreshold()) {
              freezeBothStreams();
              state.cancelSeekWait = compat.onSeekSettled(videoEl, function() {
                state.cancelSeekWait = null;
                state.internalVideoSeeking = false;
                startLockstepPlayback();
              }, getSeekTimeout());
              setVideoTimeInternally(liveAudioNow);
              state.lastCorrectionAt = compat.now();
              return;
            }
          }
          state.hasStartedPlayback = true;
          state.isFrozen = false;
          setBufferSpinner(false);
          clearWatchdog();
          shield.activate();
          if (navigator.mediaSession) navigator.mediaSession.playbackState = 'playing';
          return;
        }

        var fireSimultaneousPlay = function() {
          if (currentSeq !== state.sequence || !state.wantPlaying || state.userSeeking) return;

          if (isPlaybackCompleted()) {
            onStreamEnded();
            return;
          }

          if (!isVideoBypassed() && !state.hidden && (videoEl.readyState < 2 || videoEl.seeking || audioEl.readyState < 2 || audioEl.seeking)) {
            setBufferSpinner(true);
            freezeBothStreams();
            armNetworkWatchdog();
            return;
          }

          state.launchingPlay = true;
          state.isFrozen = false;
          state.playGraceUntil = compat.now() + (isHeavyStream() ? 2200 : 1500);
          state.vStallSince = 0;
          state.aStallSince = 0;
          setBufferSpinner(false);
          clearWatchdog();

          runInternal(function() {
            enforceRateAndVolume();

            if (!nativeGetAPaused()) {
              try { nativeAudioPause(); } catch (_) {}
            }
            if (!nativeGetVPaused()) {
              try { nativeVideoPause(); } catch (_) {}
            }

            var aSync = getMasterAnchorTime();
            var vSync = nativeGetVTime();
            if (!videoEl.seeking && !audioEl.seeking && Math.abs(vSync - aSync) > 0.03 && bufferMonitor.isTimeBuffered(videoEl, aSync, 0.1)) {
              state.internalVideoSeeking = true;
              state.liveSnapUntil = compat.now() + 450;
              nativeSetVTime(aSync);
            }

            var pV = nativeVideoPlay();
            var pA = nativeAudioPlay();

            var launchTimer = setTimeout(function() {
              if (currentSeq === state.sequence && state.launchingPlay) {
                state.launchingPlay = false;
                if (!isVideoBypassed() && !state.hidden && (nativeGetVPaused() || nativeGetAPaused() || videoEl.seeking || audioEl.seeking || videoEl.readyState < 2 || audioEl.readyState < 2)) {
                  freezeBothStreams();
                }
                syncPlaybackState();
              }
            }, 3200);

            if (window.Promise && pV && pA) {
              Promise.all([pV, pA]).then(function() {
                if (currentSeq === state.sequence) {
                  clearTimeout(launchTimer);
                  state.launchingPlay = false;
                  if (!isVideoBypassed() && !state.hidden && (nativeGetVPaused() || nativeGetAPaused() || (videoEl.seeking && !isLiveSnapping()) || audioEl.seeking || videoEl.readyState < 2 || audioEl.readyState < 2)) {
                    setBufferSpinner(true);
                    freezeBothStreams();
                    armNetworkWatchdog();
                    return;
                  }
                  var postPlayA = nativeGetATime();
                  var postPlayV = nativeGetVTime();
                  if (!isVideoBypassed() && !state.hidden && Math.abs(postPlayV - postPlayA) > 0.08 && bufferMonitor.isTimeBuffered(videoEl, postPlayA, 0.1)) {
                    snapVideoToAudioLive(postPlayA);
                  }
                  state.hasStartedPlayback = true;
                  state.awaitingGestureUnlock = false;
                  state.playGraceUntil = compat.now() + (isHeavyStream() ? 1800 : 1200);
                  setBufferSpinner(false);
                  clearWatchdog();
                  state.lastCorrectionAt = compat.now();
                  state.driftCount = 0;
                  state.vStallSince = 0;
                  state.aStallSince = 0;
                  shield.activate();
                  updateMediaSessionMetadata();
                  updateMediaSessionPosition();
                  player.addClass('vjs-playing');
                  player.removeClass('vjs-paused');
                  player.trigger('play');
                  player.trigger('playing');
                  if (navigator.mediaSession) navigator.mediaSession.playbackState = 'playing';
                }
              }).catch(function(err) {
                if (currentSeq === state.sequence) {
                  clearTimeout(launchTimer);
                  state.launchingPlay = false;
                  var errName = err && err.name;
                  if (errName === 'NotAllowedError') {
                    applyBlockedAutoplayPauseState();
                  } else if (errName !== 'AbortError') {
                    freezeBothStreams();
                    setBufferSpinner(true);
                    armNetworkWatchdog();
                  }
                }
              });
            } else {
              clearTimeout(launchTimer);
              state.launchingPlay = false;
              setBufferSpinner(false);
              clearWatchdog();
            }
          });
        };

        fireSimultaneousPlay();
      }

      function syncPlaybackState() {
        if (!state.wantPlaying) {
          setBufferSpinner(false);
          clearWatchdog();
          freezeBothStreams({ alignToAnchor: true });
          shield.deactivate();
          return;
        }

        if (isPlaybackCompleted()) {
          onStreamEnded();
          return;
        }

        if (state.userSeeking) {
          setBufferSpinner(true);
          freezeBothStreams();
          armNetworkWatchdog();
          return;
        }

        var timeBuf = state.buffering ? (compat.now() - state.bufferStartTime) : 0;
        var neededLead = state.buffering ? getMinResumeBuffer() : getMinPlayBuffer();

        if (isVideoBypassed()) {
          if (bufferMonitor.canPlayCleanly(audioEl, neededLead, timeBuf, nativeGetATime())) {
            state.isFrozen = false;
            setBufferSpinner(false);
            clearWatchdog();
            enforceRateAndVolume();
            if (nativeGetAPaused() && !audioEl.seeking && !audioEl.ended) {
              runInternal(function() {
                var pA = nativeAudioPlay();
                if (pA && typeof pA.then === 'function') {
                  pA.then(function() {
                    state.hasStartedPlayback = true;
                    updateMediaSessionMetadata();
                    updateMediaSessionPosition();
                    player.addClass('vjs-playing');
                    player.removeClass('vjs-paused');
                    player.trigger('play');
                    player.trigger('playing');
                    if (navigator.mediaSession) navigator.mediaSession.playbackState = 'playing';
                  }).catch(function(err) {
                    if (err && err.name === 'NotAllowedError') {
                      applyBlockedAutoplayPauseState();
                    }
                  });
                }
              });
            } else if (!nativeGetAPaused()) {
              state.hasStartedPlayback = true;
              if (navigator.mediaSession) navigator.mediaSession.playbackState = 'playing';
            }
          } else {
            setBufferSpinner(true);
            freezeBothStreams();
            armNetworkWatchdog();
          }
          return;
        }

        var audioReady = bufferMonitor.canPlayCleanly(audioEl, neededLead, timeBuf, nativeGetATime());
        var videoReady = (state.hidden && state.hasStartedPlayback) || bufferMonitor.canPlayCleanly(videoEl, neededLead, timeBuf, nativeGetVTime());

        if (!audioReady || !videoReady) {
          setBufferSpinner(true);
          freezeBothStreams();
          armNetworkWatchdog();
          return;
        }

        clearWatchdog();
        state.vStallSince = 0;
        state.aStallSince = 0;
        startLockstepPlayback();
      }

      function beginExternalUserSeek(targetTime) {
        var clamped = Math.max(0, Number(targetTime) || 0);
        state.userSeeking = true;
        state.internalVideoSeeking = false;
        state.internalAudioSeeking = false;
        state.launchingPlay = false;
        state.seekTarget = clamped;
        state.savedMasterTime = clamped;
        state.frozenDisplayTime = clamped;
        state.sequence++;
        state.seekStartTime = compat.now();
        clearPendingWait();
        clearWatchdog();
        setBufferSpinner(true);
        player.addClass('vjs-seeking');

        freezeBothStreams();
        runInternal(function() {
          if (!isVideoBypassed() && !state.hidden) {
            state.internalVideoSeeking = true;
            nativeSetVTime(clamped);
          }
          state.internalAudioSeeking = true;
          nativeSetATime(clamped);
        });

        armNetworkWatchdog();
        compat.raf(completeUserSeek);
      }

      function completeUserSeek() {
        if (!state.userSeeking) return;
        if ((!isVideoBypassed() && !state.hidden && videoEl.seeking) || audioEl.seeking) {
          setBufferSpinner(true);
          freezeBothStreams();
          return;
        }

        var aNow = nativeGetATime();
        var vNow = nativeGetVTime();
        var dest = state.seekTarget;
        var timeSinceSeek = compat.now() - state.seekStartTime;
        var maxWait = getSeekTimeout();

        if (Math.abs(aNow - dest) > 0.75 && timeSinceSeek < maxWait) {
          if (audioEl.readyState >= 1 && !audioEl.seeking && timeSinceSeek < 500) {
            setAudioTimeInternally(dest);
          }
          armNetworkWatchdog();
          return;
        }

        if (!isVideoBypassed() && !state.hidden && Math.abs(vNow - dest) > 0.75 && timeSinceSeek < maxWait) {
          if (videoEl.readyState >= 1 && !videoEl.seeking && timeSinceSeek < 500) {
            setVideoTimeInternally(dest);
          }
          armNetworkWatchdog();
          return;
        }

        var finalAnchor = Math.abs(aNow - dest) <= 1.8 ? aNow : dest;
        if (!isVideoBypassed() && !state.hidden && Math.abs(vNow - finalAnchor) > 0.25) {
          setVideoTimeInternally(finalAnchor);
        }

        state.savedMasterTime = finalAnchor;
        state.frozenDisplayTime = finalAnchor;
        state.userSeeking = false;
        state.internalVideoSeeking = false;
        state.internalAudioSeeking = false;
        state.driftCount = 0;
        state.vStallSince = 0;
        state.aStallSince = 0;
        state.seekStartTime = 0;
        clearPendingWait();

        if (!state.wantPlaying) {
          setBufferSpinner(false);
          clearWatchdog();
          return;
        }

        syncPlaybackState();
      }

      videoEl.play = function() {
        if (state.internalDepth > 0) return nativeVideoPlay();
        if (window.Alabaster.testErrorActive) window.Alabaster.DisableTestUI();
        if (!state.wantPlaying) {
          state.startupShieldUntil = compat.now() + config.startupProtectionMs;
        }
        if (isPlaybackCompleted()) {
          state.savedMasterTime = 0;
          setAudioTimeInternally(0);
          setVideoTimeInternally(0);
        }
        state.wantPlaying = true;
        state.userSeeking = false;
        setBufferSpinner(false);
        shield.activate();
        updateMediaSessionMetadata();
        updateMediaSessionPosition();
        player.addClass('vjs-playing');
        player.removeClass('vjs-paused');
        player.trigger('play');
        if (navigator.mediaSession) navigator.mediaSession.playbackState = 'playing';
        syncPlaybackState();
        return window.Promise ? Promise.resolve() : undefined;
      };

      videoEl.pause = function() {
        if (state.internalDepth > 0) return nativeVideoPause();
        if ((state.hidden || document.hidden || isTabWaking()) && !hasExplicitUserPauseIntent()) {
          state.hidden = Boolean(document.hidden);
          return;
        }
        if (!isPlaybackCompleted() && !videoEl.error && !audioEl.error) {
          if ((isInStartupProtection() || isInPlayGrace()) && !hasExplicitUserPauseIntent()) {
            return;
          }
        }
        state.explicitPauseTokenUntil = 0;
        state.wantPlaying = false;
        state.sequence++;
        var master = getAuthoritativeTime();
        syncPlaybackState();
        player.removeClass('vjs-playing');
        player.addClass('vjs-paused');
        player.trigger('pause');
        updateMediaSessionPosition();
        if (navigator.mediaSession) navigator.mediaSession.playbackState = 'paused';
        if (!window.Alabaster.audioOnly && !state.hidden && !isPlaybackCompleted() && Math.abs(nativeGetVTime() - master) > config.alignThreshold) {
          setVideoTimeInternally(master);
        }
      };

      listen(videoEl, 'touchend', function(evt) {
        if (!compat.isTouchLayout()) return;
        evt.preventDefault();
        evt.stopImmediatePropagation();

        var now = compat.now();
        if (now - state.lastTapAt < 280) {
          state.lastTapAt = 0;
          if (state.wantPlaying) {
            markExplicitUserPause(evt);
            videoEl.pause();
          } else {
            videoEl.play();
          }
          return;
        }
        state.lastTapAt = now;
        if (typeof player.userActive === 'function') {
          var currentlyActive = Boolean(player.userActive());
          player.userActive(!currentlyActive);
        }
      }, true);

      listen(videoEl, 'click', function(evt) {
        evt.preventDefault();
        evt.stopImmediatePropagation();
        if (compat.isTouchLayout()) {
          return;
        }
        if (state.wantPlaying) {
          markExplicitUserPause(evt);
          videoEl.pause();
        } else {
          videoEl.play();
        }
      }, true);

      listen(videoEl, 'pause', function(evt) {
        if (!isVideoBypassed() && !state.hidden && !isTabWaking() && !isLiveSnapping() && !nativeGetAPaused()) {
          pauseAudioOnly();
        }
        if (state.internalDepth > 0 && state.wantPlaying) {
          evt.stopImmediatePropagation();
          return;
        }
        if (!state.wantPlaying || isPlaybackCompleted()) return;

        evt.stopImmediatePropagation();
        state.hidden = Boolean(document.hidden);
        if (!state.buffering && !state.userSeeking && !state.cancelSeekWait && !state.launchingPlay && !isVideoBypassed() && !state.hidden) {
          syncPlaybackState();
        }
      }, true);

      listen(videoEl, 'play', function() {
        if (isVideoBypassed() || state.hidden) {
          if (isVideoBypassed()) pauseVideoOnly();
          return;
        }
        if (!state.wantPlaying || state.buffering || state.userSeeking || (!state.launchingPlay && nativeGetAPaused()) || audioEl.seeking || audioEl.readyState < 2) {
          pauseVideoOnly();
        }
      }, true);

      listen(audioEl, 'play', function() {
        if (isVideoBypassed()) return;
        if (state.hidden) {
          if (!state.wantPlaying || state.buffering || state.userSeeking || (!state.hasStartedPlayback && videoEl.readyState < 2) || audioEl.readyState < 2) {
            pauseAudioOnly();
          }
          return;
        }
        if (!state.wantPlaying || state.buffering || state.userSeeking || (!state.launchingPlay && nativeGetVPaused()) || (videoEl.seeking && !isLiveSnapping() && !isTabWaking()) || videoEl.readyState < 2) {
          pauseAudioOnly();
        }
      }, true);

      listen(videoEl, 'seeking', function() {
        if (state.internalDepth > 0 || state.internalVideoSeeking || isLiveSnapping() || isVideoBypassed() || state.hidden || isTabWaking() || state.userSeeking) {
          return;
        }
        var vTarget = nativeGetVTime();
        var master = getMasterAnchorTime();
        if (vTarget < 0.05 && master > 0.5) {
          setVideoTimeInternally(master);
          return;
        }
        if (!nativeGetAPaused()) {
          pauseAudioOnly();
        }
        beginExternalUserSeek(vTarget);
      }, false);

      listen(videoEl, 'seeked', function() {
        if (state.internalVideoSeeking) {
          state.internalVideoSeeking = false;
        }
        if (isLiveSnapping()) {
          state.liveSnapUntil = 0;
          return;
        }
        if (state.userSeeking) {
          completeUserSeek();
        } else if (state.wantPlaying && !isTabWaking() && !state.cancelSeekWait) {
          syncPlaybackState();
        }
      }, false);

      listen(audioEl, 'seeked', function() {
        if (state.internalAudioSeeking) {
          state.internalAudioSeeking = false;
        }
        if (state.userSeeking) {
          completeUserSeek();
        } else if (state.wantPlaying && !isTabWaking() && !state.cancelSeekWait) {
          syncPlaybackState();
        }
      }, false);

      listen(audioEl, 'timeupdate', function() {
        if (!isVideoBypassed() && !state.hidden && !isTabWaking() && !isLiveSnapping()) {
          if (!state.wantPlaying || state.buffering || state.userSeeking || nativeGetVPaused() || videoEl.seeking || videoEl.readyState < 2) {
            pauseAudioOnly();
            return;
          }
        }
        if (state.userSeeking || state.buffering) return;
        var aCur = nativeGetATime();
        if (aCur > 0.05) {
          state.savedMasterTime = aCur;
          state.hasStartedPlayback = true;
        }
        updateMediaSessionPosition();
        if (isVideoBypassed() || state.hidden) {
          player.trigger('timeupdate');
          if (isPlaybackCompleted()) {
            onStreamEnded();
          }
        }
      }, false);

      listen(videoEl, ['waiting', 'stalled'], function() {
        if (isVideoBypassed() || state.hidden || isTabWaking() || isLiveSnapping() || isInPlayGrace() || !state.wantPlaying || state.userSeeking || isPlaybackCompleted()) return;
        if (videoEl.readyState < 2 || bufferMonitor.ahead(videoEl, nativeGetVTime()) < 0.05) {
          setBufferSpinner(true);
          freezeBothStreams();
          armNetworkWatchdog();
        }
      }, false);

      listen(audioEl, ['waiting', 'stalled'], function() {
        if (isInPlayGrace() || !state.wantPlaying || state.userSeeking || isPlaybackCompleted()) return;
        if (audioEl.readyState < 2 || bufferMonitor.ahead(audioEl, nativeGetATime()) < 0.05) {
          setBufferSpinner(true);
          freezeBothStreams();
          armNetworkWatchdog();
        }
      }, false);

      var onDataBuffered = function() {
        if (!state.wantPlaying || isPlaybackCompleted()) return;
        if (state.userSeeking) return completeUserSeek();
        if (state.cancelSeekWait || state.launchingPlay) return;
        if (state.buffering || (!isVideoBypassed() && !state.hidden && nativeGetVPaused()) || nativeGetAPaused()) {
          syncPlaybackState();
        }
      };

      listen(videoEl, ['canplay', 'canplaythrough', 'playing', 'progress', 'loadeddata'], onDataBuffered, false);
      listen(audioEl, ['canplay', 'canplaythrough', 'playing', 'progress', 'loadeddata'], onDataBuffered, false);
      listen(videoEl, 'loadedmetadata', function() {
        updateMediaSessionMetadata();
        onDataBuffered();
      }, false);
      listen(audioEl, 'loadedmetadata', function() {
        updateMediaSessionMetadata();
        onDataBuffered();
      }, false);

      player.on('volumechange', enforceRateAndVolume);
      player.on('ratechange', function() {
        enforceRateAndVolume();
        updateMediaSessionPosition();
        if (!state.wantPlaying || state.userSeeking || state.buffering || isVideoBypassed() || state.hidden) return;
        var vNow = nativeGetVTime();
        var aNow = nativeGetATime();
        if (Math.abs(vNow - aNow) > getDriftTolerance()) {
          snapVideoToAudioLive(aNow);
          state.lastCorrectionAt = compat.now();
        }
      });

      var onStreamEnded = function() {
        var loopEnabled = Boolean(player.loop() || videoEl.loop || videoEl.hasAttribute('loop'));
        clearPendingWait();
        clearWatchdog();
        setBufferSpinner(false);
        state.userSeeking = false;
        state.internalVideoSeeking = false;
        state.internalAudioSeeking = false;
        state.launchingPlay = false;

        if (!loopEnabled) {
          state.wantPlaying = false;
          state.savedMasterTime = 0;
          freezeBothStreams({ alignToAnchor: false });
          shield.deactivate();
          var endDur = videoEl.duration || audioEl.duration || 0;
          if (endDur > 0 && isFinite(endDur) && !window.Alabaster.audioOnly) {
            runInternal(function() {
              if (Math.abs(nativeGetVTime() - endDur) > 0.1) {
                state.internalVideoSeeking = true;
                try { nativeSetVTime(endDur); } catch (_) {}
              }
            });
          }
          player.removeClass('vjs-playing');
          player.removeClass('vjs-waiting');
          player.removeClass('vjs-seeking');
          player.addClass('vjs-paused');
          player.addClass('vjs-ended');
          player.trigger('pause');
          player.trigger('ended');
          if (navigator.mediaSession) navigator.mediaSession.playbackState = 'none';
          return;
        }
        state.wantPlaying = true;
        state.savedMasterTime = 0;
        setAudioTimeInternally(0);
        setVideoTimeInternally(0);
        syncPlaybackState();
      };

      listen(videoEl, 'ended', onStreamEnded, false);
      listen(audioEl, 'ended', onStreamEnded, false);

      var loopWatcher = null;
      if (window.MutationObserver) {
        loopWatcher = new MutationObserver(function() {
          audioEl.loop = Boolean(videoEl.loop || videoEl.hasAttribute('loop'));
        });
        loopWatcher.observe(videoEl, { attributes: true, attributeFilter: ['loop'] });
      }
      audioEl.loop = Boolean(videoEl.loop || videoEl.hasAttribute('loop'));

      var handleTabVisibility = function() {
        var currentlyHidden = Boolean(document.hidden);
        if (currentlyHidden === state.hidden) return;
        state.hidden = currentlyHidden;

        if (currentlyHidden) {
          var aCur = nativeGetATime();
          if (aCur > 0.05) state.savedMasterTime = aCur;
          if (state.wantPlaying && !state.userSeeking && !isPlaybackCompleted() && !state.buffering && audioEl.readyState >= 2 && (state.hasStartedPlayback || videoEl.readyState >= 2)) {
            shield.activate();
            runInternal(function() {
              if (nativeGetAPaused()) compat.safePlay(nativeAudioPlay);
            });
          }
          return;
        }

        state.vStallSince = 0;
        state.aStallSince = 0;
        state.driftCount = 0;

        if (isPlaybackCompleted()) {
          onStreamEnded();
          return;
        }

        if (window.Alabaster.audioOnly) return;

        var master = getMasterAnchorTime();

        if (!state.wantPlaying) {
          setBufferSpinner(false);
          clearWatchdog();
          clearPendingWait();
          if (Math.abs(nativeGetVTime() - master) > config.alignThreshold) {
            setVideoTimeInternally(master);
          }
          return;
        }

        state.tabWakeUntil = compat.now() + 900;
        state.lastCorrectionAt = compat.now();
        shield.activate();

        if (Math.abs(nativeGetVTime() - master) > 0.12) {
          if (bufferMonitor.isTimeBuffered(videoEl, master, 0.2) && !nativeGetAPaused()) {
            snapVideoToAudioLive(master);
            runInternal(function() {
              if (nativeGetVPaused()) compat.safePlay(nativeVideoPlay);
            });
            return;
          }
          freezeBothStreams();
          setBufferSpinner(true);
          state.cancelSeekWait = compat.onSeekSettled(videoEl, function() {
            state.cancelSeekWait = null;
            state.internalVideoSeeking = false;
            syncPlaybackState();
          }, getSeekTimeout());
          setVideoTimeInternally(master);
          return;
        }

        syncPlaybackState();
      };

      listen(document, 'visibilitychange', handleTabVisibility, false);
      listen(window, 'pagehide', function() {
        var aCur = nativeGetATime();
        if (aCur > 0.05) state.savedMasterTime = aCur;
        state.hidden = true;
      }, false);
      listen(window, 'pageshow', function() {
        if (document.hidden !== state.hidden) handleTabVisibility();
      }, false);

      state.tickTimer = setInterval(function() {
        var now = compat.now();
        updateSyncTelemetry();

        if (state.wantPlaying && isPlaybackCompleted()) {
          onStreamEnded();
          return;
        }

        var timeBuf = state.buffering ? (now - state.bufferStartTime) : 0;

        if (state.buffering && state.bufferStartTime > 0) {
          var dur = videoEl.duration || audioEl.duration || 0;
          if (dur > 1200 && timeBuf > 120000 && window.Alabaster._showLoopedIndicator) {
            window.Alabaster._showLoopedIndicator();
          }
        }

        if (state.buffering && bufferPctEl) {
          var needed = getMinResumeBuffer();
          if (timeBuf > 3500) needed = Math.min(0.08, needed);
          else if (timeBuf > 1600) needed = Math.max(0.12, needed * 0.45);

          var aLead = bufferMonitor.ahead(audioEl, nativeGetATime());
          var vLead = bufferMonitor.ahead(videoEl, nativeGetVTime());
          var minLead = isVideoBypassed() ? aLead : Math.min(aLead, vLead);

          var pct = Math.floor((minLead / needed) * 100);
          if (isNaN(pct) || !isFinite(pct) || pct < 0) pct = 0;
          if (pct > 99 || minLead >= needed) pct = 99;

          bufferPctEl.textContent = pct + '%';
          bufferPctEl.style.display = 'block';
        } else if (bufferPctEl) {
          bufferPctEl.style.display = 'none';
        }

        if (!state.wantPlaying) {
          if (state.buffering) setBufferSpinner(false);
          if (!nativeGetVPaused()) pauseVideoOnly();
          if (!nativeGetAPaused()) pauseAudioOnly();
          return;
        }

        enforceRateAndVolume();

        var vPaused = nativeGetVPaused();
        var aPaused = nativeGetAPaused();
        var liveAudio = nativeGetATime();

        if (isLiveSnapping()) {
          if (vPaused && videoEl.readyState >= 2 && !videoEl.seeking) {
            runInternal(function() { compat.safePlay(nativeVideoPlay); });
          }
          if (aPaused && audioEl.readyState >= 2 && !audioEl.seeking) {
            runInternal(function() { compat.safePlay(nativeAudioPlay); });
          }
          return;
        }

        if (!isVideoBypassed() && !state.hidden) {
          if (vPaused || videoEl.seeking || videoEl.readyState < 2) {
            if (!aPaused) pauseAudioOnly();
          }
          if (aPaused || audioEl.seeking || audioEl.readyState < 2) {
            if (!vPaused) pauseVideoOnly();
          }
        }

        if (!state.userSeeking && !state.buffering && !audioEl.seeking && !aPaused && liveAudio > 0.05) {
          state.savedMasterTime = liveAudio;
          state.hasStartedPlayback = true;
        }

        if (state.userSeeking) {
          freezeBothStreams();
          if ((!isVideoBypassed() && !state.hidden && videoEl.seeking) || audioEl.seeking) {
            return;
          }
          completeUserSeek();
          return;
        }

        if (state.launchingPlay || state.cancelSeekWait) {
          if (!isVideoBypassed() && !state.hidden) {
            if ((vPaused || videoEl.seeking || videoEl.readyState < 2) && !aPaused) {
              pauseAudioOnly();
            }
            if ((aPaused || audioEl.seeking || audioEl.readyState < 2) && !vPaused) {
              pauseVideoOnly();
            }
          }
          return;
        }

        if (isVideoBypassed()) {
          if (aPaused && !audioEl.ended && !audioEl.seeking && audioEl.readyState >= 2) {
            setBufferSpinner(false);
            runInternal(function() { compat.safePlay(nativeAudioPlay); });
          }
          return;
        }

        if (state.hidden) {
          if (state.buffering) {
            syncPlaybackState();
            return;
          }
          var aAheadHidden = bufferMonitor.ahead(audioEl, liveAudio);
          var audioStarvedHidden = !bufferMonitor.isNearEnd(audioEl, liveAudio) && (audioEl.readyState < 2 || audioEl.seeking || aAheadHidden < 0.02);
          if (audioStarvedHidden) {
            setBufferSpinner(true);
            freezeBothStreams();
            armNetworkWatchdog();
            return;
          }
          if (aPaused && !audioEl.ended && !audioEl.seeking && audioEl.readyState >= 2 && (state.hasStartedPlayback || videoEl.readyState >= 2)) {
            setBufferSpinner(false);
            runInternal(function() {
              var pAHiddenTick = nativeAudioPlay();
              if (pAHiddenTick && typeof pAHiddenTick.then === 'function') {
                pAHiddenTick.then(function() {
                  state.hasStartedPlayback = true;
                  if (navigator.mediaSession) navigator.mediaSession.playbackState = 'playing';
                }).catch(function() {});
              }
            });
          }
          return;
        }

        if (state.buffering) {
          if (!aPaused || !vPaused) freezeBothStreams();
          syncPlaybackState();
          return;
        }

        var vNow = nativeGetVTime();
        var aNow = liveAudio;

        var vAhead = bufferMonitor.ahead(videoEl, vNow);
        var aAhead = bufferMonitor.ahead(audioEl, aNow);

        var videoStarved = !bufferMonitor.isNearEnd(videoEl, vNow) && (videoEl.readyState < 2 || videoEl.seeking || vAhead < 0.02);
        var audioStarved = !bufferMonitor.isNearEnd(audioEl, aNow) && (audioEl.readyState < 2 || audioEl.seeking || aAhead < 0.02);

        if (videoStarved || audioStarved) {
          setBufferSpinner(true);
          freezeBothStreams();
          armNetworkWatchdog();
          return;
        }

        if (vPaused || aPaused) {
          if (!aPaused) pauseAudioOnly();
          if (!vPaused) pauseVideoOnly();
          syncPlaybackState();
          return;
        }

        var inGrace = isInPlayGrace();
        var vNotMoving = !videoEl.ended && Math.abs(vNow - state.prevVideoTime) < 0.0005;
        var aNotMoving = !audioEl.ended && Math.abs(aNow - state.prevAudioTime) < 0.0005;

        if (vNotMoving) {
          if (!state.vStallSince) state.vStallSince = now;
        } else {
          state.vStallSince = 0;
        }

        if (aNotMoving) {
          if (!state.aStallSince) state.aStallSince = now;
        } else {
          state.aStallSince = 0;
        }

        var vStalledDur = state.vStallSince ? (now - state.vStallSince) : 0;
        var aStalledDur = state.aStallSince ? (now - state.aStallSince) : 0;

        if (!inGrace) {
          var stallLimitMs = isHeavyStream() ? 750 : 500;

          if (vStalledDur >= 220 && vAhead < 0.15) {
            pauseAudioOnly();
          }
          if (aStalledDur >= 220 && aAhead < 0.15) {
            pauseVideoOnly();
          }

          if ((vStalledDur >= stallLimitMs && (videoEl.readyState < 2 || vAhead < 0.2)) ||
              (aStalledDur >= stallLimitMs && (audioEl.readyState < 2 || aAhead < 0.2))) {
            state.vStallSince = 0;
            state.aStallSince = 0;
            setBufferSpinner(true);
            freezeBothStreams();
            armNetworkWatchdog();
            return;
          }
        } else {
          var graceStallLimitMs = isHeavyStream() ? 1200 : 800;
          if ((vStalledDur >= graceStallLimitMs && !vPaused) || 
              (aStalledDur >= graceStallLimitMs && !aPaused)) {
            state.vStallSince = 0;
            state.aStallSince = 0;
            setBufferSpinner(true);
            freezeBothStreams();
            armNetworkWatchdog();
            return;
          }
        }

        state.prevVideoTime = vNow;
        state.prevAudioTime = aNow;

        if (videoEl.seeking || audioEl.seeking) {
          freezeBothStreams();
          return;
        }

        if (videoEl.ended || audioEl.ended || bufferMonitor.isNearEnd(videoEl, vNow) || bufferMonitor.isNearEnd(audioEl, aNow)) {
          state.driftCount = 0;
          return;
        }

        var absDrift = Math.abs(aNow - vNow);
        var tolerance = getDriftTolerance();

        if (absDrift <= tolerance) {
          state.driftCount = 0;
          return;
        }

        state.driftCount++;
        var cooldownPassed = (now - state.lastCorrectionAt) > config.syncCooldownMs;
        var hardLimit = getHardSeekDriftThreshold();

        var shouldCorrect = false;
        if (inGrace) {
          if (absDrift >= hardLimit * 1.2) {
            shouldCorrect = true;
          }
        } else {
          if ((state.driftCount >= 5 || absDrift >= hardLimit) && cooldownPassed) {
            shouldCorrect = true;
          }
        }

        if (shouldCorrect) {
          state.driftCount = 0;
          state.lastCorrectionAt = now;

          if (bufferMonitor.isTimeBuffered(videoEl, aNow, 0.25) && absDrift < hardLimit && !inGrace) {
            snapVideoToAudioLive(aNow);
            return;
          }

          freezeBothStreams();
          setBufferSpinner(true);
          state.cancelSeekWait = compat.onSeekSettled(videoEl, function() {
            state.cancelSeekWait = null;
            state.internalVideoSeeking = false;
            syncPlaybackState();
          }, getSeekTimeout());
          setVideoTimeInternally(aNow);
        }
      }, config.tickMs);

      updateMediaSessionMetadata();

      if (navigator.mediaSession && typeof navigator.mediaSession.setActionHandler === 'function') {
        var sessionHandlers = {
          play: function() {
            videoEl.play();
          },
          pause: function() {
            markExplicitUserPause({ isTrusted: true });
            videoEl.pause();
          },
          stop: function() {
            markExplicitUserPause({ isTrusted: true });
            videoEl.pause();
          },
          seekto: function(details) {
            if (!details || details.seekTime == null) return;
            beginExternalUserSeek(details.seekTime);
          },
          seekbackward: function(details) {
            var step = (details && details.seekOffset) || 10;
            beginExternalUserSeek(Math.max(0, getAuthoritativeTime() - step));
          },
          seekforward: function(details) {
            var step = (details && details.seekOffset) || 10;
            var dur = videoEl.duration || audioEl.duration || Infinity;
            beginExternalUserSeek(Math.min(dur, getAuthoritativeTime() + step));
          }
        };
        Object.keys(sessionHandlers).forEach(function(act) {
          try { navigator.mediaSession.setActionHandler(act, sessionHandlers[act]); } catch (_) {}
        });
      }

      if (wantsAutoplay) {
        if (compat.isAutoplayBlockedByPolicy() && !videoEl.muted) {
          applyBlockedAutoplayPauseState();
        } else {
          state.wantPlaying = true;
          state.startupShieldUntil = compat.now() + config.startupProtectionMs;
          player.addClass('vjs-playing');
          player.removeClass('vjs-paused');
          syncPlaybackState();
        }
      }

      player.on('dispose', function() {
        for (var i = 0; i < registeredEvents.length; i++) {
          var ev = registeredEvents[i];
          ev.target.removeEventListener(ev.type, ev.fn, ev.capture);
        }
        registeredEvents.length = 0;
        if (loopWatcher) loopWatcher.disconnect();
        clearWatchdog();
        clearPendingWait();
        shield.teardown();
        if (state.tickTimer) clearInterval(state.tickTimer);
        videoEl._alabasterAttached = false;
        window.Alabaster.active = false;
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAlabasterPlayer);
  } else {
    initAlabasterPlayer();
  }
})();

(function () {
  'use strict';

  const SEEK_STEP     = 10;   // seconds for j/l/arrow keys
  const SEEK_STEP_BIG = 30;   // seconds for J/L (shift held)
  const VOLUME_STEP   = 0.1;
  const SPEED_STEP    = 0.25;
  const SPEED_MIN     = 0.25;
  const SPEED_MAX     = 3;

  const EDITABLE_SELECTOR = [
    'input:not([type="button"]):not([type="checkbox"]):not([type="color"])'
      + ':not([type="file"]):not([type="hidden"]):not([type="image"])'
      + ':not([type="radio"]):not([type="range"]):not([type="reset"])'
      + ':not([type="submit"])',
    'textarea',
    'select',
    '[contenteditable=""]',
    '[contenteditable="true"]',
    '[role="textbox"]',
    '[role="searchbox"]',
    '[role="combobox"]',
    '[role="spinbutton"]',
  ].join(',');

  function isEditableEl(el) {
    if (!el || el === document.body || el === document.documentElement) return false;
    if (el.isContentEditable) return true;
    return el.matches(EDITABLE_SELECTOR) || !!el.closest(EDITABLE_SELECTOR);
  }

  // every possible way an element could be focused.
  function isUserTyping(e) {
    if (isEditableEl(e.target)) return true;
    if (isEditableEl(document.activeElement)) return true;

    const focused = document.querySelector(':focus');
    if (focused && isEditableEl(focused)) return true;

    if (e.target && e.target.closest && e.target.closest('form')) return true;

    return false;
  }

  function getPlayer() {
    if (typeof videojs === 'undefined') return null;
    const el = document.querySelector('.video-js');
    if (!el) return null;
    try {
      return videojs.getPlayer(el) || videojs(el);
    } catch {
      return null;
    }
  }

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const round1 = (v) => Math.round(v * 10) / 10;

  function seekBy(player, delta) {
    const dur = player.duration();
    if (!dur || !isFinite(dur)) return;
    player.currentTime(clamp(player.currentTime() + delta, 0, dur));
  }

  function adjustVolume(player, delta) {
    if (delta > 0 && player.muted()) player.muted(false);
    const next = clamp(round1(player.volume() + delta), 0, 1);
    player.volume(next);
    if (next === 0) player.muted(true);
  }

  function adjustSpeed(player, delta) {
    const next = clamp(round1(player.playbackRate() + delta), SPEED_MIN, SPEED_MAX);
    player.playbackRate(next);
  }

  function seekToPercent(player, pct) {
    const dur = player.duration();
    if (!dur || !isFinite(dur)) return;
    player.currentTime(dur * (pct / 100));
  }

  function togglePlay(player) {
    player.paused() ? player.play() : player.pause();
  }

  function toggleFullscreen(player) {
    player.isFullscreen() ? player.exitFullscreen() : player.requestFullscreen();
  }

  function toggleMute(player) {
    player.muted(!player.muted());
  }

  // Shift variants use uppercase key names.
  const KEY_MAP = {
    // Play / pause
    'k':          (p) => { togglePlay(p); return true; },
    ' ':          (p) => { 
       if (document.activeElement) document.activeElement.blur(); 
      togglePlay(p); 
      return true; 
    },

    // Fullscreen
    'f':          (p) => { toggleFullscreen(p); return true; },

    // Mute
    'm':          (p) => { toggleMute(p); return true; },

    // Seeking (10 s / 30 s with Shift)
    'arrowright':  (p) => { seekBy(p,  SEEK_STEP); return true; },
    'arrowleft':   (p) => { seekBy(p, -SEEK_STEP); return true; },
    'l':           (p) => { seekBy(p,  SEEK_STEP); return true; },
    'j':           (p) => { seekBy(p, -SEEK_STEP); return true; },
    'L':           (p) => { seekBy(p,  SEEK_STEP_BIG); return true; },
    'J':           (p) => { seekBy(p, -SEEK_STEP_BIG); return true; },

    // Volume
    'arrowup':     (p) => { adjustVolume(p,  VOLUME_STEP); return true; },
    'arrowdown':   (p) => { adjustVolume(p, -VOLUME_STEP); return true; },

    // Playback speed
    '>':           (p) => { adjustSpeed(p,  SPEED_STEP); return true; },
    '<':           (p) => { adjustSpeed(p, -SPEED_STEP); return true; },

    // Number keys → seek to 0%–90%
    '0': (p) => { seekToPercent(p,  0); return true; },
    '1': (p) => { seekToPercent(p, 10); return true; },
    '2': (p) => { seekToPercent(p, 20); return true; },
    '3': (p) => { seekToPercent(p, 30); return true; },
    '4': (p) => { seekToPercent(p, 40); return true; },
    '5': (p) => { seekToPercent(p, 50); return true; },
    '6': (p) => { seekToPercent(p, 60); return true; },
    '7': (p) => { seekToPercent(p, 70); return true; },
    '8': (p) => { seekToPercent(p, 80); return true; },
    '9': (p) => { seekToPercent(p, 90); return true; },

    // Home / End
    'home': (p) => { seekToPercent(p,   0); return true; },
    'end':  (p) => { seekToPercent(p, 100); return true; },
  };

  // ── Main listener ───────────────────────────────────────────────────────
  document.addEventListener('keydown', function (e) {
    // Bail on modifier combos, IME composition, or already-handled events
    if (e.defaultPrevented) return;
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    if (e.isComposing || e.keyCode === 229) return;

    if (isUserTyping(e)) return;

    const player = getPlayer();
    if (!player) return;

    // Shift-sensitive key: use raw `event.key` for >/</J/L,
    // lowercase for everything else.
    const raw = e.key;
    const key = raw.length === 1 && !e.shiftKey ? raw.toLowerCase() : raw;

    // Lookup. Try shift-sensitive first (raw), then normalized.
    const handler = KEY_MAP[raw] || KEY_MAP[key.toLowerCase()];
    if (handler && handler(player, e)) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);  
})();

// https://codeberg.org/ashleyirispuppy/poke/src/branch/main/src/libpoketube/libpoketube-youtubei-objects.json

var _boobs = "boobs"

 const FORMATS = {
    "5": { ext: "flv", width: 400, height: 240, acodec: "mp3", abr: 64, vcodec: "h263" },
    "6": { ext: "flv", width: 450, height: 270, acodec: "mp3", abr: 64, vcodec: "h263" },
    "13": { ext: "3gp", acodec: "aac", vcodec: "mp4v" },
    "17": { ext: "3gp", width: 176, height: 144, acodec: "aac", abr: 24, vcodec: "mp4v" },
    "18": { ext: "mp4", width: 640, height: 360, acodec: "aac", abr: 96, vcodec: "h264" },
    "34": { ext: "flv", width: 640, height: 360, acodec: "aac", abr: 128, vcodec: "h264" },
    "35": { ext: "flv", width: 854, height: 480, acodec: "aac", abr: 128, vcodec: "h264" },
    "36": { ext: "3gp", width: 320, acodec: "aac", vcodec: "mp4v" },
    "37": { ext: "mp4", width: 1920, height: 1080, acodec: "aac", abr: 192, vcodec: "h264" },
    "38": { ext: "mp4", width: 4096, height: 3072, acodec: "aac", abr: 192, vcodec: "h264" },
    "43": { ext: "webm", width: 640, height: 360, acodec: "vorbis", abr: 128, vcodec: "vp8" },
    "44": { ext: "webm", width: 854, height: 480, acodec: "vorbis", abr: 128, vcodec: "vp8" },
    "45": { ext: "webm", width: 1280, height: 720, acodec: "vorbis", abr: 192, vcodec: "vp8" },
    "46": { ext: "webm", width: 1920, height: 1080, acodec: "vorbis", abr: 192, vcodec: "vp8" },
    "59": { ext: "mp4", width: 854, height: 480, acodec: "aac", abr: 128, vcodec: "h264" },
    "78": { ext: "mp4", width: 854, height: 480, acodec: "aac", abr: 128, vcodec: "h264" },
    
    // 3D videos
    "82": { ext: "mp4", height: 360, format: "3D", acodec: "aac", abr: 128, vcodec: "h264" },
    "83": { ext: "mp4", height: 480, format: "3D", acodec: "aac", abr: 128, vcodec: "h264" },
    "84": { ext: "mp4", height: 720, format: "3D", acodec: "aac", abr: 192, vcodec: "h264" },
    "85": { ext: "mp4", height: 1080, format: "3D", acodec: "aac", abr: 192, vcodec: "h264" },
    "100": { ext: "webm", height: 360, format: "3D", acodec: "vorbis", abr: 128, vcodec: "vp8" },
    "101": { ext: "webm", height: 480, format: "3D", acodec: "vorbis", abr: 192, vcodec: "vp8" },
    "102": { ext: "webm", height: 720, format: "3D", acodec: "vorbis", abr: 192, vcodec: "vp8" },

    // Apple HTTP Live Streaming
    "91": { ext: "mp4", height: 144, format: "HLS", acodec: "aac", abr: 48, vcodec: "h264" },
    "92": { ext: "mp4", height: 240, format: "HLS", acodec: "aac", abr: 48, vcodec: "h264" },
    "93": { ext: "mp4", height: 360, format: "HLS", acodec: "aac", abr: 128, vcodec: "h264" },
    "94": { ext: "mp4", height: 480, format: "HLS", acodec: "aac", abr: 128, vcodec: "h264" },
    "95": { ext: "mp4", height: 720, format: "HLS", acodec: "aac", abr: 256, vcodec: "h264" },
    "96": { ext: "mp4", height: 1080, format: "HLS", acodec: "aac", abr: 256, vcodec: "h264" },
    "132": { ext: "mp4", height: 240, format: "HLS", acodec: "aac", abr: 48, vcodec: "h264" },
    "151": { ext: "mp4", height: 72, format: "HLS", acodec: "aac", abr: 24, vcodec: "h264" },

    // DASH mp4 video
    "133": { ext: "mp4", height: 240, format: "DASH video", vcodec: "h264" },
    "134": { ext: "mp4", height: 360, format: "DASH video", vcodec: "h264" },
    "135": { ext: "mp4", height: 480, format: "DASH video", vcodec: "h264" },
    "136": { ext: "mp4", height: 720, format: "DASH video", vcodec: "h264" },
    "137": { ext: "mp4", height: 1080, format: "DASH video", vcodec: "h264" },
    "138": { ext: "mp4", format: "DASH video", vcodec: "h264" }, // Height can vary
    "160": { ext: "mp4", height: 144, format: "DASH video", vcodec: "h264" },
    "212": { ext: "mp4", height: 480, format: "DASH video", vcodec: "h264" },
    "264": { ext: "mp4", height: 1440, format: "DASH video", vcodec: "h264" },
    "298": { ext: "mp4", height: 720, format: "DASH video", vcodec: "h264", fps: 60 },
    "299": { ext: "mp4", height: 1080, format: "DASH video", vcodec: "h264", fps: 60 },
    "266": { ext: "mp4", height: 2160, format: "DASH video", vcodec: "h264" },

    // Dash mp4 audio
    "139": { ext: "m4a", format: "DASH audio", acodec: "aac", abr: 48, container: "m4a_dash" },
    "140": { ext: "m4a", format: "DASH audio", acodec: "aac", abr: 128, container: "m4a_dash" },
    "141": { ext: "m4a", format: "DASH audio", acodec: "aac", abr: 256, container: "m4a_dash" },
    "256": { ext: "m4a", format: "DASH audio", acodec: "aac", container: "m4a_dash" },
    "258": { ext: "m4a", format: "DASH audio", acodec: "aac", container: "m4a_dash" },
    "325": { ext: "m4a", format: "DASH audio", acodec: "dtse", container: "m4a_dash" },
    "328": { ext: "m4a", format: "DASH audio", acodec: "ec-3", container: "m4a_dash" },

    // Dash webm
    "167": { ext: "webm", height: 360, width: 640, vcodec: "vp9", acodec: "vorbis" },
    "171": { ext: "webm", height: 480, width: 854, vcodec: "vp9", acodec: "vorbis" },
    "172": { ext: "webm", height: 720, width: 1280, vcodec: "vp9", acodec: "vorbis" },
    "248": { ext: "webm", height: 1080, width: 1920, vcodec: "vp9", acodec: "vorbis" },
    "249": { ext: "webm", height: 1440, width: 2560, vcodec: "vp9", acodec: "vorbis" },
    "250": { ext: "webm", height: 2160, width: 3840, vcodec: "vp9", acodec: "vorbis" },

    // Extra formats
    "264": { ext: "mp4", height: 1440, vcodec: "h264" }
};



// youtube client stuff 
 const YoutubeAPI = {
  DEFAULT_API_KEY: "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8",
  ANDROID_API_KEY: "AIzaSyA8eiZmM1FaDVjRy-df2KTyQ_vz_yYM39w",

  ANDROID_APP_VERSION: "20.20.41",
  ANDROID_USER_AGENT:
    "com.google.android.youtube/20.20.41 (Linux; U; Android 16; en_US; SM-S908E Build/TP1A.220624.014) gzip",
  ANDROID_SDK_VERSION: 36,
  ANDROID_VERSION: "16",

  ANDROID_TS_APP_VERSION: "1.9",
  ANDROID_TS_USER_AGENT:
    "com.google.android.youtube/1.9 (Linux; U; Android 16; US) gzip",

  IOS_APP_VERSION: "20.11.6",
  IOS_USER_AGENT:
    "com.google.ios.youtube/20.11.6 (iPhone14,5; U; CPU iOS 18_5 like Mac OS X;)",
  IOS_VERSION: "18.5.0.22F76",

  WINDOWS_VERSION: "10.0",

  ClientType: {
    web: "Web",
    web_embedded_player: "WebEmbeddedPlayer",
    web_mobile: "WebMobile",
    web_screen_embed: "WebScreenEmbed",
    android: "Android",
    android_embedded_player: "AndroidEmbeddedPlayer",
    android_screen_embed: "AndroidScreenEmbed",
    android_test_suite: "AndroidTestSuite",
    ios: "IOS",
    ios_embedded: "IOSEmbedded",
    ios_music: "IOSMusic",
    tv_html5: "TvHtml5",
    tv_html5_screen_embed: "TvHtml5ScreenEmbed"
  },

  HARDCODED_CLIENTS: {
    // Web
    web: {
      name: "WEB",
      name_proto: "1",
      version: "2.20250917.02.00",
      api_key: "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8",
      screen: "WATCH_FULL_SCREEN",
      os_name: "Windows",
      os_version: "10.0",
      platform: "DESKTOP"
    },
    web_embedded_player: {
      name: "WEB_EMBEDDED_PLAYER",
      name_proto: "56",
      version: "1.20250907.01.00",
      api_key: "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8",
      screen: "EMBED",
      os_name: "Windows",
      os_version: "10.0",
      platform: "DESKTOP"
    },
    web_mobile: {
      name: "MWEB",
      name_proto: "2",
      version: "2.20250909.02.00",
      api_key: "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8",
      os_name: "Android",
      os_version: "16",
      platform: "MOBILE"
    },
    web_screen_embed: {
      name: "WEB",
      name_proto: "1",
      version: "2.20250917.02.00",
      api_key: "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8",
      screen: "EMBED",
      os_name: "Windows",
      os_version: "10.0",
      platform: "DESKTOP"
    },

    // Android
    android: {
      name: "ANDROID",
      name_proto: "3",
      version: "20.20.41",
      api_key: "AIzaSyA8eiZmM1FaDVjRy-df2KTyQ_vz_yYM39w",
      android_sdk_version: 36,
      user_agent:
        "com.google.android.youtube/20.20.41 (Linux; U; Android 16; en_US; SM-S908E Build/TP1A.220624.014) gzip",
      os_name: "Android",
      os_version: "16",
      platform: "MOBILE"
    },
    android_embedded_player: {
      name: "ANDROID_EMBEDDED_PLAYER",
      name_proto: "55",
      version: "20.20.41",
      api_key: "AIzaSyCjc_pVEDi4qsv5MtC2dMXzpIaDoRFLsxw"
    },
    android_screen_embed: {
      name: "ANDROID",
      name_proto: "3",
      version: "20.20.41",
      api_key: "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8",
      screen: "EMBED",
      android_sdk_version: 36,
      user_agent:
        "com.google.android.youtube/20.20.41 (Linux; U; Android 16; en_US; SM-S908E Build/TP1A.220624.014) gzip",
      os_name: "Android",
      os_version: "16",
      platform: "MOBILE"
    },
    android_test_suite: {
      name: "ANDROID_TESTSUITE",
      name_proto: "30",
      version: "1.9",
      api_key: "AIzaSyA8eiZmM1FaDVjRy-df2KTyQ_vz_yYM39w",
      android_sdk_version: 36,
      user_agent:
        "com.google.android.youtube/1.9 (Linux; U; Android 16; US) gzip",
      os_name: "Android",
      os_version: "16",
      platform: "MOBILE"
    },

    // iOS
    ios: {
      name: "IOS",
      name_proto: "5",
      version: "20.11.6",
      api_key: "AIzaSyB-63vPrdThhKuerbB2N_l7Kwwcxj6yUAc",
      user_agent:
        "com.google.ios.youtube/20.11.6 (iPhone14,5; U; CPU iOS 18_5 like Mac OS X;)",
      device_make: "Apple",
      device_model: "iPhone14,5",
      os_name: "iPhone",
      os_version: "18.5.0.22F76",
      platform: "MOBILE"
    },
    ios_embedded: {
      name: "IOS_MESSAGES_EXTENSION",
      name_proto: "66",
      version: "20.11.6",
      api_key: "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8",
      user_agent:
        "com.google.ios.youtube/20.11.6 (iPhone14,5; U; CPU iOS 18_5 like Mac OS X;)",
      device_make: "Apple",
      device_model: "iPhone14,5",
      os_name: "iPhone",
      os_version: "18.5.0.22F76",
      platform: "MOBILE"
    },
    ios_music: {
      name: "IOS_MUSIC",
      name_proto: "26",
      version: "7.14",
      api_key: "AIzaSyBAETezhkwP0ZWA02RsqT1zu78Fpt0bC_s",
      user_agent:
        "com.google.ios.youtubemusic/7.14 (iPhone14,5; U; CPU iOS 17_6 like Mac OS X;)",
      device_make: "Apple",
      device_model: "iPhone14,5",
      os_name: "iPhone",
      os_version: "18.5.0.22F76",
      platform: "MOBILE"
    },

    // TV
    tv_html5: {
      name: "TVHTML5",
      name_proto: "7",
      version: "7.20250219.14.00",
      api_key: "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8"
    },
    tv_html5_screen_embed: {
      name: "TVHTML5_SIMPLY_EMBEDDED_PLAYER",
      name_proto: "85",
      version: "2.0",
      api_key: "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8",
      screen: "EMBED"
    }
  },

  DEFAULT_CLIENT_CONFIG: {
    client_type: "web",
    region: "US"
  }
};



// player base 
const base_player_old_old = "https://www.youtube.com/s/player/a87a9450/player_ias.vflset/en_US/base.js"
const base_player_old = "https://www.youtube.com/s/player/2d24ba15/player_ias.vflset/en_US/base.js";
const base_player_broken = "https://www.youtube.com/s/player/6740c111/player_ias.vflset/en_US/base.js";
const base_player_old_old_old_old_old = "https://www.youtube.com/s/player/0004de42/player_ias.vflset/en_US/base.js";

const hey = " please dont use the above player base stuff!! tyyyyyyyy <3 "
const youtubeobjects = "https://codeberg.org/ashleyirispuppy/poke/raw/branch/main/src/libpoketube/libpoketube-youtubei-objects.json"
const watchURl = "https://youtube.com/watch"
const base_player = "https://www.youtube.com/s/player/140dafda/player_ias.vflset/en_US/base.js";
const base_player_poketube = "https://poketube.fun/s/player/140dafda/player_ias.vflset/en_US/base.js";

function extractPlayerData(playerUrl) {
    const segments = playerUrl.split('/');
    const domain = segments[2];
    const version = segments[segments.length - 2];
    const fileName = segments[segments.length - 1];
    const key = generateKey(domain, version, fileName);

    return {
        domain,
        version,
        fileName,
        key,
        timestamp: Date.now(),
    };
}

function generateKey(domain, version, fileName) {
    const rawString = `${domain}|${version}|${fileName}|${Date.now()}`;
    return Array.from(rawString)
        .map((char) => char.charCodeAt(0) * 3)
        .reduce((acc, val) => (acc + val) % 997, 1)
        .toString(36);
}

function initializePlayer(data) {
    const context = createPlayerContext(data.key, data.version);
    const frameData = calculateFrames(data.timestamp, data.fileName);

    const playerObject = {
        context,
        frameData,
        ready: false,
    };

    if (validatePlayerObject(playerObject)) {
        playerObject.ready = true;
    }

    return playerObject;
}

function createPlayerContext(key, version) {
    const contextMap = new Map();
    const modifiers = key.length + version.length;

    contextMap.set("encryptionLevel", modifiers % 5);
    contextMap.set("versionHash", Array.from(version).reduce((acc, char) => acc + char.charCodeAt(0), 0));
    contextMap.set("keyWeight", key.split('').reduce((acc, char) => acc * char.charCodeAt(0), 1));

    return contextMap;
}

function calculateFrames(timestamp, fileName) {
    const base = fileName.split('_').length + timestamp.toString().length;
    const frameCount = base % 128 + 10;

    return Array.from({ length: frameCount }, (_, index) => ({
        frame: index,
        delay: (timestamp % (index + 1)) + 20,
    }));
}

function validatePlayerObject(player) {
    const { context, frameData } = player;
    const frameHash = frameData.reduce((acc, frame) => acc + frame.frame * frame.delay, 0);
    const contextHash = Array.from(context.values()).reduce((acc, value) => acc + value, 0);

    return (frameHash + contextHash) % 13 === 0;
}

const extractedData = extractPlayerData(base_player_poketube);
const initializedPlayer = initializePlayer(extractedData);

const POKEPLAYEROBJECTS = {
  base_player_old_old: "https://www.youtube.com/s/player/a87a9450/player_ias.vflset/en_US/base.js",
  base_player_old: "https://www.youtube.com/s/player/2d24ba15/player_ias.vflset/en_US/base.js",
  base_player_broken: "https://www.youtube.com/s/player/6740c111/player_ias.vflset/en_US/base.js",
  base_player: "https://www.youtube.com/s/player/0004de42/player_ias.vflset/en_US/base.js",
  base_player_poketube: "https://poketube.fun/s/player/0004de42/player_ias.vflset/en_US/base.js",
  youtubeobjects: "https://codeberg.org/ashleyirispuppy/poke/raw/branch/main/src/libpoketube/libpoketube-youtubei-objects.json",
  watchURL: "https://youtube.com/watch",
  youtube_home: "https://www.youtube.com/",
  youtube_trending: "https://www.youtube.com/feed/trending",
  youtube_music: "https://music.youtube.com/",
  youtube_shorts: "https://www.youtube.com/shorts/",
  youtube_subscriptions: "https://www.youtube.com/feed/subscriptions",
  youtube_api_v1: "https://www.youtube.com/youtubei/v1/player",
  youtube_embed: "https://www.youtube.com/embed/",
  youtube_channel: "https://www.youtube.com/channel/",
  youtube_search: "https://www.youtube.com/results?search_query=",
  youtube_feed: "https://www.youtube.com/feeds/videos.xml?channel_id="
};

try {
  console.log("[POKE PLAYER] initializing player configuration...");

  for (const [name, url] of Object.entries(POKEPLAYEROBJECTS)) {
    if (!url.startsWith("http")) {
      console.log(`[POKE PLAYER] skipped ${name}`);
      continue;
    }

    if (name === "base_player") {
      const id = (url.match(/player\/([^/]+)/) || [])[1] || "unknown";
      console.log(`[POKE PLAYER] USING PLAYER [${id}]`);
    } else {
      console.log(`[POKE PLAYER] loaded ${name}`);
    }
  }

  console.log("[POKE PLAYER] all URLs registered successfully!");
} catch (err) {
  console.error("[POKE PLAYER] initialization error:", err.message);
}



// custom video.js ui for POKE PLAYER 
// if u dont want it, u can use DisableCustomPlayerUI localstroage variable :3
// No LLMs, AIs or anything like that was used in the making of the custom ui, it was done by all hard work :D
let shouldUseCustomVideoJsUI = true;

try {
  shouldUseCustomVideoJsUI = localStorage.getItem("DisableCustomPlayerUI") === null;
} catch (error) {
  shouldUseCustomVideoJsUI = true;
}

if (shouldUseCustomVideoJsUI) {
  const customVideoJsUI = document.createElement("style");

  customVideoJsUI.innerHTML = `:root{--poke-custom-player-accent-1:#ff0033;--poke-custom-player-accent-2:#ff0a45;--poke-custom-player-accent-3:#ff1d79;--poke-custom-player-radius:16px;--poke-custom-player-text:rgba(255,255,255,.98);--poke-custom-player-text-soft:rgba(255,255,255,.86);--poke-custom-player-track:rgba(255,255,255,.34);--poke-custom-player-loaded:rgba(255,255,255,.48);--poke-custom-player-volume-track:rgba(255,255,255,.18);--poke-custom-player-volume-level:rgba(255,255,255,.98);--poke-custom-player-button-bg:rgba(0,0,0,.48);--poke-custom-player-button-bg-hover:rgba(0,0,0,.64);--poke-custom-player-button-border:rgba(255,255,255,.08);--poke-custom-player-button-border-hover:rgba(255,255,255,.14);--poke-custom-player-button-shadow:0 8px 22px rgba(0,0,0,.34);--poke-custom-player-title-bg:rgba(0,0,0,.58);--poke-custom-player-title-bg-hover:rgba(0,0,0,.7);--poke-custom-player-title-border:rgba(255,255,255,.1);--poke-custom-player-title-border-hover:rgba(255,255,255,.16);--poke-custom-player-title-shadow:0 8px 22px rgba(0,0,0,.34);--poke-custom-player-title-wash:rgba(0,0,0,.1);--poke-custom-player-control-height:92px;--poke-custom-player-control-height-mobile:78px;--poke-custom-player-button-size:42px;--poke-custom-player-button-size-mobile:36px;--poke-custom-player-progress-left:38px;--poke-custom-player-progress-right:38px;--poke-custom-player-progress-top:16px;--poke-custom-player-description-bottom:calc(var(--poke-custom-player-control-height) - var(--poke-custom-player-progress-top) + 10px);--poke-custom-player-description-bottom-mobile:calc(var(--poke-custom-player-control-height-mobile) - var(--poke-custom-player-progress-top) + 8px)}.video-js,.video-js *{font-family:"poketube flex","PokeTube Flex",sans-serif!important}.video-js .vjs-icon-placeholder,.video-js .vjs-icon-placeholder:before,.video-js .vjs-button>.vjs-icon-placeholder,.video-js .vjs-button>.vjs-icon-placeholder:before,.video-js .vjs-big-play-button .vjs-icon-placeholder,.video-js .vjs-big-play-button .vjs-icon-placeholder:before,.video-js [class^="vjs-icon-"],.video-js [class^="vjs-icon-"]:before,.video-js [class*=" vjs-icon-"],.video-js [class*=" vjs-icon-"]:before{font-family:VideoJS!important;font-weight:400!important;font-style:normal!important}.video-js,.video-js .vjs-poster,.video-js .vjs-poster img,.video-js .vjs-tech{border-radius:var(--poke-custom-player-radius)!important}.video-js.vjs-fullscreen,.video-js.vjs-fullscreen .vjs-poster,.video-js.vjs-fullscreen .vjs-poster img,.video-js.vjs-fullscreen .vjs-tech,.video-js.vjs-fullscreen .vjs-control-bar,.video-js:fullscreen,.video-js:fullscreen .vjs-poster,.video-js:fullscreen .vjs-poster img,.video-js:fullscreen .vjs-tech,.video-js:fullscreen .vjs-control-bar,.video-js:-webkit-full-screen,.video-js:-webkit-full-screen .vjs-poster,.video-js:-webkit-full-screen .vjs-poster img,.video-js:-webkit-full-screen .vjs-tech,.video-js:-webkit-full-screen .vjs-control-bar{border-radius:0!important}.video-js{overflow:hidden!important;background:#000!important}.video-js .vjs-title-bar,.video-js .vjs-title-bar.vjs-hidden{position:absolute!important;inset:0!important;z-index:8!important;display:block!important;visibility:visible!important;width:auto!important;height:auto!important;padding:0!important;margin:0!important;background:0 0!important;background-color:transparent!important;background-image:none!important;border:0!important;border-radius:var(--poke-custom-player-radius)!important;box-shadow:none!important;pointer-events:none!important;opacity:1!important;transform:none!important;transition:opacity .24s ease,transform .24s ease,visibility 0s linear 0s!important}.video-js.vjs-fullscreen .vjs-title-bar,.video-js:fullscreen .vjs-title-bar,.video-js:-webkit-full-screen .vjs-title-bar{border-radius:0!important}.video-js.vjs-user-inactive.vjs-playing .vjs-title-bar,.video-js.vjs-user-inactive.vjs-playing .vjs-title-bar.vjs-hidden{opacity:0!important;visibility:hidden!important;transform:translateY(-8px)!important;transition:opacity .24s ease,transform .24s ease,visibility 0s linear .24s!important}.video-js.vjs-user-active .vjs-title-bar,.video-js.vjs-user-active .vjs-title-bar.vjs-hidden,.video-js.vjs-paused .vjs-title-bar,.video-js.vjs-paused .vjs-title-bar.vjs-hidden,.video-js.vjs-ended .vjs-title-bar,.video-js.vjs-ended .vjs-title-bar.vjs-hidden{opacity:1!important;visibility:visible!important;transform:translateY(0)!important;transition:opacity .18s ease,transform .18s ease,visibility 0s linear 0s!important}.video-js .vjs-title-bar-title,.video-js .vjs-title-bar-title.vjs-hidden{position:absolute!important;top:18px!important;left:22px!important;display:block!important;visibility:visible!important;width:fit-content!important;max-width:min(82%,920px)!important;margin:0!important;padding:0!important;background:0 0!important;background-color:transparent!important;background-image:none!important;border:0!important;box-shadow:none!important;color:var(--poke-custom-player-text)!important;font-size:1.5em!important;font-weight:1000!important;font-stretch:ultra-expanded!important;line-height:1.08!important;text-shadow:0 1px 2px rgba(0,0,0,.72)!important;-webkit-text-stroke:.35px rgba(0,0,0,.35)!important;white-space:normal!important;overflow:visible!important;text-overflow:clip!important;opacity:1!important}.video-js .vjs-title-bar-description,.video-js .vjs-title-bar-description.vjs-hidden{position:absolute!important;right:var(--poke-custom-player-progress-right)!important;bottom:var(--poke-custom-player-description-bottom)!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;visibility:visible!important;width:fit-content!important;max-width:min(56%,680px)!important;min-height:42px!important;margin:0!important;padding:.78em 1.08em!important;border-radius:999px!important;color:var(--poke-custom-player-text)!important;font-size:.95em!important;font-weight:790!important;font-stretch:semi-expanded!important;line-height:1.24!important;text-shadow:0 1px 2px rgba(0,0,0,.86)!important;background:var(--poke-custom-player-title-bg)!important;background-color:var(--poke-custom-player-title-bg)!important;background-image:none!important;border:1px solid var(--poke-custom-player-title-border)!important;box-shadow:var(--poke-custom-player-title-shadow)!important;-webkit-backdrop-filter:blur(12px) saturate(160%)!important;backdrop-filter:blur(12px) saturate(160%)!important;filter:none!important;white-space:normal!important;overflow:visible!important;text-overflow:clip!important;opacity:1!important;pointer-events:none!important}.video-js .vjs-title-bar-description:hover{background:var(--poke-custom-player-title-bg-hover)!important;background-color:var(--poke-custom-player-title-bg-hover)!important;border-color:var(--poke-custom-player-title-border-hover)!important}.video-js .vjs-control-bar{position:absolute!important;left:0!important;right:0!important;bottom:0!important;width:100%!important;height:var(--poke-custom-player-control-height)!important;display:flex!important;align-items:flex-end!important;gap:8px!important;padding:38px 28px 14px!important;box-sizing:border-box!important;background:0 0!important;background-color:transparent!important;background-image:none!important;border:0!important;border-radius:0 0 var(--poke-custom-player-radius) var(--poke-custom-player-radius)!important;box-shadow:none!important;-webkit-backdrop-filter:none!important;backdrop-filter:none!important;opacity:1!important;transform:none!important;pointer-events:auto!important}.video-js.vjs-fullscreen .vjs-control-bar,.video-js:fullscreen .vjs-control-bar,.video-js:-webkit-full-screen .vjs-control-bar{border-radius:0!important}.video-js.vjs-user-inactive.vjs-playing .vjs-control-bar{opacity:0!important;transform:translateY(10px)!important;transition:opacity .24s ease,transform .24s ease!important}.video-js.vjs-user-active .vjs-control-bar,.video-js.vjs-paused .vjs-control-bar,.video-js.vjs-ended .vjs-control-bar{opacity:1!important;transform:translateY(0)!important;transition:opacity .18s ease,transform .18s ease!important}.video-js .vjs-control{width:var(--poke-custom-player-button-size)!important;height:var(--poke-custom-player-button-size)!important;min-width:var(--poke-custom-player-button-size)!important;margin:0!important;padding:0!important;border:0!important;border-radius:50%!important;background:0 0!important;background-color:transparent!important;background-image:none!important;box-shadow:none!important;-webkit-backdrop-filter:none!important;backdrop-filter:none!important;color:var(--poke-custom-player-text)!important;text-shadow:0 1px 2px rgba(0,0,0,.86)!important;transition:background-color .14s ease,transform .12s ease,opacity .14s ease,border-color .14s ease!important}.video-js .vjs-button,.video-js .vjs-picture-in-picture-control,.video-js .vjs-subs-caps-button,.video-js .vjs-audio-button,.video-js .vjs-playback-rate,.video-js .vjs-chapters-button,.video-js .vjs-descriptions-button,.video-js .vjs-captions-button,.video-js .vjs-quality-selector,.video-js .vjs-quality-menu-wrapper,.video-js .vjs-menu-button,.video-js .vjs-fullscreen-control{width:var(--poke-custom-player-button-size)!important;height:var(--poke-custom-player-button-size)!important;min-width:var(--poke-custom-player-button-size)!important;cursor:pointer!important;border-radius:50%!important;background:var(--poke-custom-player-button-bg)!important;background-color:var(--poke-custom-player-button-bg)!important;background-image:none!important;border:1px solid var(--poke-custom-player-button-border)!important;box-shadow:var(--poke-custom-player-button-shadow)!important}.video-js .vjs-button:hover,.video-js .vjs-picture-in-picture-control:hover,.video-js .vjs-subs-caps-button:hover,.video-js .vjs-audio-button:hover,.video-js .vjs-playback-rate:hover,.video-js .vjs-chapters-button:hover,.video-js .vjs-descriptions-button:hover,.video-js .vjs-captions-button:hover,.video-js .vjs-quality-selector:hover,.video-js .vjs-quality-menu-wrapper:hover,.video-js .vjs-menu-button:hover,.video-js .vjs-fullscreen-control:hover{background:var(--poke-custom-player-button-bg-hover)!important;background-color:var(--poke-custom-player-button-bg-hover)!important;background-image:none!important;border-color:var(--poke-custom-player-button-border-hover)!important}.video-js .vjs-button:active{transform:scale(.94)!important}.video-js .vjs-button:focus,.video-js .vjs-button:focus-visible{outline:0!important}.video-js .vjs-button:focus-visible{background:var(--poke-custom-player-button-bg-hover)!important;background-color:var(--poke-custom-player-button-bg-hover)!important;box-shadow:0 0 0 3px rgba(255,0,70,.24),var(--poke-custom-player-button-shadow)!important}.video-js .vjs-control .vjs-icon-placeholder:before,.video-js .vjs-button>.vjs-icon-placeholder:before{position:static!important;display:block!important;width:100%!important;height:100%!important;font-family:VideoJS!important;font-weight:400!important;font-style:normal!important;font-size:24px!important;line-height:var(--poke-custom-player-button-size)!important;color:var(--poke-custom-player-text)!important;text-align:center!important;text-shadow:0 1px 2px rgba(0,0,0,.9)!important}.video-js .vjs-play-control{order:10!important;margin-right:6px!important}.video-js .vjs-play-control .vjs-icon-placeholder:before{font-family:VideoJS!important;font-size:28px!important}.video-js .vjs-volume-panel{order:20!important;width:auto!important;min-width:var(--poke-custom-player-button-size)!important;height:var(--poke-custom-player-button-size)!important;display:flex!important;align-items:center!important;gap:0!important;margin:0!important;padding:0!important;border-radius:999px!important;background:0 0!important;background-color:transparent!important;background-image:none!important;border:0!important;box-shadow:none!important;overflow:visible!important}.video-js .vjs-volume-panel:hover,.video-js .vjs-volume-panel:focus-within{background:var(--poke-custom-player-button-bg)!important;background-color:var(--poke-custom-player-button-bg)!important;border:1px solid var(--poke-custom-player-button-border)!important;box-shadow:var(--poke-custom-player-button-shadow)!important}.video-js .vjs-volume-panel .vjs-mute-control{width:var(--poke-custom-player-button-size)!important;height:var(--poke-custom-player-button-size)!important;min-width:var(--poke-custom-player-button-size)!important;margin:0!important;border-radius:50%!important;background:var(--poke-custom-player-button-bg)!important;background-color:var(--poke-custom-player-button-bg)!important;background-image:none!important;border:1px solid var(--poke-custom-player-button-border)!important;box-shadow:var(--poke-custom-player-button-shadow)!important}.video-js .vjs-volume-panel:hover .vjs-mute-control,.video-js .vjs-volume-panel:focus-within .vjs-mute-control{background:0 0!important;background-color:transparent!important;border-color:transparent!important;box-shadow:none!important}.video-js .vjs-volume-control,.video-js .vjs-volume-control.vjs-control,.video-js .vjs-volume-horizontal{width:0!important;min-width:0!important;height:var(--poke-custom-player-button-size)!important;opacity:0!important;overflow:hidden!important;display:flex!important;align-items:center!important;margin:0!important;padding:0!important;border-radius:999px!important;background:0 0!important;background-color:transparent!important;background-image:none!important;border:0!important;box-shadow:none!important;transition:width .18s ease,min-width .18s ease,opacity .18s ease!important}.video-js .vjs-volume-panel:hover .vjs-volume-control,.video-js .vjs-volume-panel:focus-within .vjs-volume-control,.video-js .vjs-volume-panel:hover .vjs-volume-control.vjs-control,.video-js .vjs-volume-panel:focus-within .vjs-volume-control.vjs-control,.video-js .vjs-volume-panel:hover .vjs-volume-horizontal,.video-js .vjs-volume-panel:focus-within .vjs-volume-horizontal{width:82px!important;min-width:82px!important;opacity:1!important}.video-js .vjs-volume-control .vjs-mouse-display,.video-js .vjs-volume-control .vjs-time-tooltip,.video-js .vjs-volume-control .vjs-volume-tooltip,.video-js .vjs-volume-control.vjs-control .vjs-mouse-display,.video-js .vjs-volume-control.vjs-control .vjs-time-tooltip,.video-js .vjs-volume-control.vjs-control .vjs-volume-tooltip,.video-js .vjs-volume-horizontal .vjs-mouse-display,.video-js .vjs-volume-horizontal .vjs-time-tooltip,.video-js .vjs-volume-horizontal .vjs-volume-tooltip,.video-js .vjs-volume-bar .vjs-mouse-display,.video-js .vjs-volume-bar .vjs-time-tooltip,.video-js .vjs-volume-bar .vjs-volume-tooltip,.video-js .vjs-volume-bar.vjs-slider .vjs-mouse-display,.video-js .vjs-volume-bar.vjs-slider .vjs-time-tooltip,.video-js .vjs-volume-bar.vjs-slider .vjs-volume-tooltip,.video-js .vjs-volume-bar.vjs-slider-horizontal .vjs-mouse-display,.video-js .vjs-volume-bar.vjs-slider-horizontal .vjs-time-tooltip,.video-js .vjs-volume-bar.vjs-slider-horizontal .vjs-volume-tooltip,.video-js .vjs-volume-control .vjs-slider-bar .vjs-mouse-display,.video-js .vjs-volume-control .vjs-slider-bar .vjs-time-tooltip,.video-js .vjs-volume-control .vjs-slider-bar .vjs-volume-tooltip,.video-js .vjs-volume-panel .vjs-mouse-display,.video-js .vjs-volume-panel .vjs-time-tooltip,.video-js .vjs-volume-panel .vjs-volume-tooltip{display:none!important;visibility:hidden!important;opacity:0!important;width:0!important;height:0!important;pointer-events:none!important}.video-js .vjs-volume-bar,.video-js .vjs-volume-bar.vjs-slider,.video-js .vjs-volume-bar.vjs-slider-horizontal{position:relative!important;width:66px!important;height:5px!important;margin:0 12px 0 2px!important;border-radius:999px!important;background:var(--poke-custom-player-volume-track)!important;background-color:var(--poke-custom-player-volume-track)!important;background-image:none!important;border:0!important;box-shadow:inset 0 0 0 1px rgba(255,255,255,.06),0 1px 5px rgba(0,0,0,.42)!important;overflow:visible!important}.video-js .vjs-volume-bar:before,.video-js .vjs-volume-bar:after,.video-js .vjs-volume-bar.vjs-slider:before,.video-js .vjs-volume-bar.vjs-slider:after{display:none!important;content:none!important}.video-js .vjs-volume-level,.video-js .vjs-volume-bar .vjs-volume-level,.video-js .vjs-volume-bar.vjs-slider-horizontal .vjs-volume-level{position:absolute!important;display:block!important;visibility:visible!important;opacity:1!important;left:0!important;top:0!important;bottom:auto!important;height:5px!important;min-width:3px!important;border-radius:999px!important;background:var(--poke-custom-player-volume-level)!important;background-color:var(--poke-custom-player-volume-level)!important;background-image:none!important;box-shadow:0 0 0 1px rgba(255,255,255,.1),0 1px 5px rgba(0,0,0,.42)!important;z-index:2!important;overflow:visible!important}.video-js .vjs-volume-level:before,.video-js .vjs-volume-bar .vjs-volume-level:before,.video-js .vjs-volume-bar.vjs-slider-horizontal .vjs-volume-level:before{content:""!important;position:absolute!important;display:block!important;visibility:visible!important;opacity:1!important;right:-7px!important;top:50%!important;width:14px!important;height:14px!important;margin-top:-7px!important;border-radius:50%!important;background:var(--poke-custom-player-volume-level)!important;background-color:var(--poke-custom-player-volume-level)!important;background-image:none!important;box-shadow:0 0 0 1px rgba(255,255,255,.2),0 2px 6px rgba(0,0,0,.55)!important;z-index:3!important}.video-js .vjs-volume-level .vjs-control-text,.video-js .vjs-volume-bar .vjs-volume-level .vjs-control-text{display:none!important}.video-js .vjs-control-bar .vjs-button.vjs-player-time-toggle,.video-js .vjs-control-bar .vjs-player-time-toggle{order:30!important;width:auto!important;min-width:0!important;height:var(--poke-custom-player-button-size)!important;padding:0 13px!important;margin:0 7px 0 -1px!important;border:1px solid var(--poke-custom-player-button-border)!important;border-radius:999px!important;background:var(--poke-custom-player-button-bg)!important;background-color:var(--poke-custom-player-button-bg)!important;background-image:none!important;box-shadow:var(--poke-custom-player-button-shadow)!important;color:var(--poke-custom-player-text)!important;font-family:"poketube flex","PokeTube Flex",sans-serif!important;font-size:14px!important;font-weight:700!important;line-height:1!important;text-shadow:0 1px 2px rgba(0,0,0,.9)!important;transform:none!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;white-space:nowrap!important}.video-js .vjs-control-bar .vjs-button.vjs-player-time-toggle:hover,.video-js .vjs-control-bar .vjs-player-time-toggle:hover{background:var(--poke-custom-player-button-bg-hover)!important;background-color:var(--poke-custom-player-button-bg-hover)!important;border-color:var(--poke-custom-player-button-border-hover)!important;color:var(--poke-custom-player-text)!important;transform:none!important}.video-js .vjs-control-bar .vjs-button.vjs-player-time-toggle:active,.video-js .vjs-control-bar .vjs-player-time-toggle:active{transform:scale(.98)!important}.video-js .vjs-control-bar .vjs-button.vjs-player-time-toggle .vjs-icon-placeholder,.video-js .vjs-control-bar .vjs-player-time-toggle .vjs-icon-placeholder{display:none!important}.video-js .vjs-control-bar .vjs-button.vjs-player-time-toggle:before,.video-js .vjs-control-bar .vjs-button.vjs-player-time-toggle:after,.video-js .vjs-control-bar .vjs-player-time-toggle:before,.video-js .vjs-control-bar .vjs-player-time-toggle:after{display:none!important;content:none!important}.video-js .vjs-control-bar .vjs-button.vjs-player-time-toggle .vjs-control-text,.video-js .vjs-control-bar .vjs-player-time-toggle .vjs-control-text{position:static!important;width:auto!important;height:auto!important;clip:auto!important;clip-path:none!important;overflow:visible!important;white-space:nowrap!important;margin:0!important;padding:0!important;border:0!important;color:inherit!important;font:inherit!important}.video-js .vjs-progress-control{position:absolute!important;left:var(--poke-custom-player-progress-left)!important;right:var(--poke-custom-player-progress-right)!important;top:var(--poke-custom-player-progress-top)!important;width:auto!important;height:18px!important;min-width:0!important;display:flex!important;align-items:center!important;margin:0!important;padding:0!important;cursor:pointer!important;touch-action:none!important;z-index:5!important;background:0 0!important;background-color:transparent!important;background-image:none!important;border:0!important;box-shadow:none!important}.video-js .vjs-progress-control:hover{height:22px!important;top:calc(var(--poke-custom-player-progress-top) - 2px)!important}.video-js .vjs-progress-control .vjs-progress-holder{width:100%!important;height:4px!important;margin:0!important;border-radius:999px!important;background:var(--poke-custom-player-track)!important;background-color:var(--poke-custom-player-track)!important;background-image:none!important;border:0!important;box-shadow:0 1px 4px rgba(0,0,0,.34)!important;overflow:visible!important;transition:height .12s ease!important}.video-js .vjs-progress-control:hover .vjs-progress-holder{height:6px!important}.video-js .vjs-progress-control .vjs-progress-holder:before,.video-js .vjs-progress-control .vjs-progress-holder:after{display:none!important;content:none!important}.video-js .vjs-load-progress{height:100%!important;border-radius:999px!important;background:var(--poke-custom-player-loaded)!important;background-color:var(--poke-custom-player-loaded)!important;background-image:none!important}.video-js .vjs-load-progress div{height:100%!important;border-radius:999px!important;background:var(--poke-custom-player-loaded)!important;background-color:var(--poke-custom-player-loaded)!important;background-image:none!important}.video-js .vjs-play-progress{height:100%!important;border-radius:999px!important;background:linear-gradient(to right,var(--poke-custom-player-accent-1),var(--poke-custom-player-accent-2),var(--poke-custom-player-accent-3))!important}.video-js .vjs-play-progress:before{content:""!important;position:absolute!important;right:-6px!important;top:50%!important;width:13px!important;height:13px!important;margin-top:-6.5px!important;border-radius:50%!important;background:var(--poke-custom-player-accent-2)!important;box-shadow:0 0 0 1px rgba(255,0,51,.2),0 1px 6px rgba(0,0,0,.45)!important;opacity:0!important;transform:scale(.72)!important;transition:opacity .12s ease,transform .12s ease!important}.video-js .vjs-progress-control:hover .vjs-play-progress:before,.video-js.vjs-seeking .vjs-play-progress:before{opacity:1!important;transform:scale(1)!important}.video-js .vjs-progress-control .vjs-slider-handle{display:none!important}.video-js .vjs-progress-control .vjs-mouse-display,.video-js .vjs-progress-control .vjs-time-tooltip,.video-js .vjs-play-progress .vjs-time-tooltip{font-family:"poketube flex","PokeTube Flex",sans-serif!important}.video-js .vjs-progress-control .vjs-mouse-display .vjs-time-tooltip,.video-js .vjs-play-progress .vjs-time-tooltip{bottom:22px!important;padding:5px 8px!important;border-radius:4px!important;background:rgba(20,20,20,.96)!important;color:var(--poke-custom-player-text)!important;font-family:"poketube flex","PokeTube Flex",sans-serif!important;font-size:12px!important;font-weight:700!important;line-height:1!important;text-shadow:none!important}.video-js .vjs-control-text,.video-js .vjs-current-time,.video-js .vjs-duration,.video-js .vjs-time-divider,.video-js .vjs-current-time-display,.video-js .vjs-duration-display,.video-js .vjs-remaining-time-display{font-family:"poketube flex","PokeTube Flex",sans-serif!important}.video-js .vjs-current-time,.video-js .vjs-duration,.video-js .vjs-time-divider,.video-js .vjs-current-time-display,.video-js .vjs-duration-display{display:none!important}.video-js .vjs-remaining-time{display:none!important}.video-js .vjs-time-control{width:auto!important;min-width:0!important;height:var(--poke-custom-player-button-size)!important;align-items:center!important;justify-content:center!important;padding:0!important;margin:0!important;background:0 0!important;background-color:transparent!important;background-image:none!important;border:0!important;border-radius:0!important;box-shadow:none!important;color:var(--poke-custom-player-text)!important;font-family:"poketube flex","PokeTube Flex",sans-serif!important;font-size:14px!important;font-weight:700!important;line-height:1!important;text-shadow:0 1px 2px rgba(0,0,0,.9)!important}.video-js .vjs-spacer{order:800!important;display:block!important;flex:1 1 auto!important}.video-js .vjs-picture-in-picture-control,.video-js .vjs-subs-caps-button,.video-js .vjs-audio-button,.video-js .vjs-playback-rate,.video-js .vjs-chapters-button,.video-js .vjs-descriptions-button,.video-js .vjs-captions-button,.video-js .vjs-quality-selector,.video-js .vjs-quality-menu-wrapper,.video-js .vjs-menu-button{order:900!important}.video-js .vjs-menu-button-popup .vjs-menu{bottom:48px!important}.video-js .vjs-menu-content{border-radius:10px!important;background:rgba(28,28,28,.96)!important;color:var(--poke-custom-player-text)!important;font-family:"poketube flex","PokeTube Flex",sans-serif!important;box-shadow:0 8px 28px rgba(0,0,0,.55)!important;overflow:hidden!important}.video-js .vjs-menu li{color:var(--poke-custom-player-text)!important;font-family:"poketube flex","PokeTube Flex",sans-serif!important;font-size:13px!important;font-weight:650!important;text-transform:none!important}.video-js .vjs-menu li.vjs-selected,.video-js .vjs-menu li:hover{background:rgba(255,255,255,.16)!important}.video-js .vjs-big-play-button{width:72px!important;height:52px!important;margin-left:-36px!important;margin-top:-26px!important;border:0!important;border-radius:14px!important;background:rgba(0,0,0,.72)!important;box-shadow:none!important;color:var(--poke-custom-player-text)!important;transition:background-color .15s ease,transform .12s ease!important}.video-js:hover .vjs-big-play-button,.video-js .vjs-big-play-button:focus{background:rgba(0,0,0,.86)!important;border:0!important;box-shadow:none!important}.video-js .vjs-big-play-button:active{transform:scale(.96)!important}.video-js .vjs-big-play-button .vjs-icon-placeholder:before{font-family:VideoJS!important;font-size:42px!important;line-height:52px!important;color:var(--poke-custom-player-text)!important}.video-js .vjs-fullscreen-control{order:950!important}@supports not ((backdrop-filter:blur(1px)) or (-webkit-backdrop-filter:blur(1px))){.video-js .vjs-title-bar-description{-webkit-backdrop-filter:none!important;backdrop-filter:none!important;background:rgba(18,18,18,.72)!important;border-color:rgba(255,255,255,.18)!important}}@media (max-width:640px){:root{--poke-custom-player-progress-left:14px;--poke-custom-player-progress-right:14px;--poke-custom-player-progress-top:14px}.video-js .vjs-title-bar-title{top:14px!important;left:14px!important;max-width:92%!important;font-size:1.12em!important}.video-js .vjs-title-bar-description{right:var(--poke-custom-player-progress-right)!important;bottom:var(--poke-custom-player-description-bottom-mobile)!important;max-width:min(76%,460px)!important;min-height:36px!important;padding:.62em .9em!important;font-size:.8em!important}.video-js .vjs-control-bar{height:var(--poke-custom-player-control-height-mobile)!important;gap:6px!important;padding:34px 12px 9px!important}.video-js .vjs-control,.video-js .vjs-button,.video-js .vjs-volume-panel .vjs-mute-control,.video-js .vjs-picture-in-picture-control,.video-js .vjs-subs-caps-button,.video-js .vjs-audio-button,.video-js .vjs-playback-rate,.video-js .vjs-chapters-button,.video-js .vjs-descriptions-button,.video-js .vjs-captions-button,.video-js .vjs-quality-selector,.video-js .vjs-quality-menu-wrapper,.video-js .vjs-menu-button,.video-js .vjs-fullscreen-control{width:var(--poke-custom-player-button-size-mobile)!important;height:var(--poke-custom-player-button-size-mobile)!important;min-width:var(--poke-custom-player-button-size-mobile)!important}.video-js .vjs-control .vjs-icon-placeholder:before,.video-js .vjs-button>.vjs-icon-placeholder:before{font-family:VideoJS!important;font-size:20px!important;line-height:var(--poke-custom-player-button-size-mobile)!important}.video-js .vjs-play-control{order:10!important;margin-right:4px!important}.video-js .vjs-play-control .vjs-icon-placeholder:before{font-family:VideoJS!important;font-size:24px!important}.video-js .vjs-volume-panel{order:20!important;min-width:var(--poke-custom-player-button-size-mobile)!important;height:var(--poke-custom-player-button-size-mobile)!important;margin-right:0!important}.video-js .vjs-volume-panel .vjs-mute-control{width:var(--poke-custom-player-button-size-mobile)!important;height:var(--poke-custom-player-button-size-mobile)!important;min-width:var(--poke-custom-player-button-size-mobile)!important}.video-js .vjs-volume-control,.video-js .vjs-volume-control.vjs-control,.video-js .vjs-volume-horizontal{display:none!important}.video-js .vjs-control-bar .vjs-button.vjs-player-time-toggle,.video-js .vjs-control-bar .vjs-player-time-toggle{order:30!important;height:var(--poke-custom-player-button-size-mobile)!important;padding:0 10px!important;margin:0 6px 0 -1px!important;font-size:12px!important}.video-js .vjs-progress-control{left:var(--poke-custom-player-progress-left)!important;right:var(--poke-custom-player-progress-right)!important;top:var(--poke-custom-player-progress-top)!important}.video-js .vjs-progress-control:hover{top:calc(var(--poke-custom-player-progress-top) - 2px)!important}.video-js .vjs-time-control{height:var(--poke-custom-player-button-size-mobile)!important;font-size:12px!important}.video-js .vjs-picture-in-picture-control,.video-js .vjs-subs-caps-button,.video-js .vjs-audio-button,.video-js .vjs-playback-rate,.video-js .vjs-chapters-button,.video-js .vjs-descriptions-button,.video-js .vjs-captions-button{display:none!important}}`;

  document.head.appendChild(customVideoJsUI);
}

window.pokePlayer = {
    ver:`21-6740c111-vjs-${videojs.VERSION}`,
    canHasAmbientMode:true,
    videoID:new URLSearchParams(window.location.search).get('v'),
    supported_itag_list:["22","136", "140", "298", "18", "400", "401", "313", "271"],
    formats:["SD", "HD", "4K", "2K", "UHD", "FHD"],
	YoutubeAPI,
    clientVideoPlayerID:"0004de42",
}


/* video js plugins */









/*  github: https://github.com/afrmtbl/videojs-youtube-annotations */

class AnnotationParser {
	static get defaultAppearanceAttributes() {
		return {
			bgColor: 0xFFFFFF,
			bgOpacity: 0.80,
			fgColor: 0,
			textSize: 3.15
		};
	}

	static get attributeMap() {
		return {
			type: "tp",
			style: "s",
			x: "x",
			y: "y",
			width: "w",
			height: "h",

			sx: "sx",
			sy: "sy",

			timeStart: "ts",
			timeEnd: "te",
			text: "t",

			actionType: "at",
			actionUrl: "au",
			actionUrlTarget: "aut",
			actionSeconds: "as",

			bgOpacity: "bgo",
			bgColor: "bgc",
			fgColor: "fgc",
			textSize: "txsz"
		};
	}

	/* AR ANNOTATION FORMAT */
	deserializeAnnotation(serializedAnnotation) {
		const map = this.constructor.attributeMap;
		const attributes = serializedAnnotation.split(",");
		const annotation = {};
		for (const attribute of attributes) {
			const [ key, value ] = attribute.split("=");
			const mappedKey = this.getKeyByValue(map, key);

			let finalValue = "";

			if (["text", "actionType", "actionUrl", "actionUrlTarget", "type", "style"].indexOf(mappedKey) > -1) {
				finalValue = decodeURIComponent(value);
			}
			else {
				finalValue = parseFloat(value, 10);
			}
			annotation[mappedKey] = finalValue;
		}
		return annotation;
	}
	serializeAnnotation(annotation) {
		const map = this.constructor.attributeMap;
		let serialized = "";
		for (const key in annotation) {
			const mappedKey = map[key];
			if ((["text", "actionType", "actionUrl", "actionUrlTarget"].indexOf(key) > -1) && mappedKey && annotation.hasOwnProperty(key)) {
				let text = encodeURIComponent(annotation[key]);
				serialized += `${mappedKey}=${text},`;
			}
			else if ((["text", "actionType", "actionUrl", "actionUrlTarget"].indexOf("key") === -1) && mappedKey && annotation.hasOwnProperty(key)) {
				serialized += `${mappedKey}=${annotation[key]},`;
			}
		}
		// remove trailing comma
		return serialized.substring(0, serialized.length - 1);
	}

	deserializeAnnotationList(serializedAnnotationString) {
		const serializedAnnotations = serializedAnnotationString.split(";");
		serializedAnnotations.length = serializedAnnotations.length - 1;
		const annotations = [];
		for (const annotation of serializedAnnotations) {
			annotations.push(this.deserializeAnnotation(annotation));
		}
		return annotations;
	}
	serializeAnnotationList(annotations) {
		let serialized = "";
		for (const annotation of annotations) {
			serialized += this.serializeAnnotation(annotation) + ";";
		}
		return serialized;
	}

	/* PARSING YOUTUBE'S ANNOTATION FORMAT */
	xmlToDom(xml) {
		const parser = new DOMParser();
		const dom = parser.parseFromString(xml, "application/xml");
		return dom;
	}
	getAnnotationsFromXml(xml) {
		const dom = this.xmlToDom(xml);
		return dom.getElementsByTagName("annotation");
	}
	parseYoutubeAnnotationList(annotationElements) {
		const annotations = [];
		for (const el of annotationElements) {
			const parsedAnnotation = this.parseYoutubeAnnotation(el);
			if (parsedAnnotation) annotations.push(parsedAnnotation);
		}
		return annotations;
	}
	parseYoutubeAnnotation(annotationElement) {
		const base = annotationElement;
		const attributes = this.getAttributesFromBase(base);
		if (!attributes.type || attributes.type === "pause") return null;

		const text = this.getTextFromBase(base);
		const action = this.getActionFromBase(base);

		const backgroundShape = this.getBackgroundShapeFromBase(base);
		if (!backgroundShape) return null;
		const timeStart = backgroundShape.timeRange.start;
		const timeEnd = backgroundShape.timeRange.end;

		if (isNaN(timeStart) || isNaN(timeEnd) || timeStart === null || timeEnd === null) {
			return null;
		}

		const appearance = this.getAppearanceFromBase(base);

		// properties the renderer needs
		let annotation = {
			// possible values: text, highlight, pause, branding
			type: attributes.type,
			// x, y, width, and height as percent of video size
			x: backgroundShape.x, 
			y: backgroundShape.y, 
			width: backgroundShape.width, 
			height: backgroundShape.height,
			// what time the annotation is shown in seconds
			timeStart,
			timeEnd
		};
		// properties the renderer can work without
		if (attributes.style) annotation.style = attributes.style;
		if (text) annotation.text = text;
		if (action) annotation = Object.assign(action, annotation);
		if (appearance) annotation = Object.assign(appearance, annotation);

		if (backgroundShape.hasOwnProperty("sx")) annotation.sx = backgroundShape.sx;
		if (backgroundShape.hasOwnProperty("sy")) annotation.sy = backgroundShape.sy;

		return annotation;
	}
	getBackgroundShapeFromBase(base) {
		const movingRegion = base.getElementsByTagName("movingRegion")[0];
		if (!movingRegion) return null;
		const regionType = movingRegion.getAttribute("type");

		const regions = movingRegion.getElementsByTagName(`${regionType}Region`);
		const timeRange = this.extractRegionTime(regions);

		const shape = {
			type: regionType,
			x: parseFloat(regions[0].getAttribute("x"), 10),
			y: parseFloat(regions[0].getAttribute("y"), 10),
			width: parseFloat(regions[0].getAttribute("w"), 10),
			height: parseFloat(regions[0].getAttribute("h"), 10),
			timeRange
		}

		const sx = regions[0].getAttribute("sx");
		const sy = regions[0].getAttribute("sy");

		if (sx) shape.sx = parseFloat(sx, 10);
		if (sy) shape.sy = parseFloat(sy, 10);
		
		return shape;
	}
	getAttributesFromBase(base) {
		const attributes = {};
		attributes.type = base.getAttribute("type");
		attributes.style = base.getAttribute("style");
		return attributes;
	}
	getTextFromBase(base) {
		const textElement = base.getElementsByTagName("TEXT")[0];
		if (textElement) return textElement.textContent;
	}
	getActionFromBase(base) {
		const actionElement = base.getElementsByTagName("action")[0];
		if (!actionElement) return null;
		const typeAttr = actionElement.getAttribute("type");

		const urlElement = actionElement.getElementsByTagName("url")[0];
		if (!urlElement) return null;
		const actionUrlTarget = urlElement.getAttribute("target");
		const href = urlElement.getAttribute("value");
		// only allow links to youtube
		// can be changed in the future
		if (href.startsWith("https://www.youtube.com/")) {
			const url = new URL(href);
			const srcVid = url.searchParams.get("src_vid");
			const toVid = url.searchParams.get("v");

			return this.linkOrTimestamp(url, srcVid, toVid, actionUrlTarget);
		}
	}
	linkOrTimestamp(url, srcVid, toVid, actionUrlTarget) {
		// check if it's a link to a new video
		// or just a timestamp
		if (srcVid && toVid && srcVid === toVid) {
			let seconds = 0;
			const hash = url.hash;
			if (hash && hash.startsWith("#t=")) {
				const timeString = url.hash.split("#t=")[1];
				seconds = this.timeStringToSeconds(timeString);
			}
			return {actionType: "time", actionSeconds: seconds}
		}
		else {
			return {actionType: "url", actionUrl: url.href, actionUrlTarget};
		}
	}
	getAppearanceFromBase(base) {
		const appearanceElement = base.getElementsByTagName("appearance")[0];
		const styles = this.constructor.defaultAppearanceAttributes;

		if (appearanceElement) {
			const bgOpacity = appearanceElement.getAttribute("bgAlpha");
			const bgColor = appearanceElement.getAttribute("bgColor");
			const fgColor = appearanceElement.getAttribute("fgColor");
			const textSize = appearanceElement.getAttribute("textSize");
			// not yet sure what to do with effects 
			// const effects = appearanceElement.getAttribute("effects");

			// 0.00 to 1.00
			if (bgOpacity) styles.bgOpacity = parseFloat(bgOpacity, 10);
			// 0 to 256 ** 3
			if (bgColor) styles.bgColor = parseInt(bgColor, 10);
			if (fgColor) styles.fgColor = parseInt(fgColor, 10);
			// 0.00 to 100.00?
			if (textSize) styles.textSize = parseFloat(textSize, 10);
		}

		return styles;
	}

	/* helper functions */
	extractRegionTime(regions) {
		let timeStart = regions[0].getAttribute("t");
		timeStart = this.hmsToSeconds(timeStart);

		let timeEnd = regions[regions.length - 1].getAttribute("t");
		timeEnd = this.hmsToSeconds(timeEnd);

		return {start: timeStart, end: timeEnd}
	}
	// https://stackoverflow.com/a/9640417/10817894
	hmsToSeconds(hms) {
	    let p = hms.split(":");
	    let s = 0;
	    let m = 1;

	    while (p.length > 0) {
	        s += m * parseFloat(p.pop(), 10);
	        m *= 60;
	    }
	    return s;
	}
	timeStringToSeconds(time) {
		let seconds = 0;

		const h = time.split("h");
	  	const m = (h[1] || time).split("m");
	  	const s = (m[1] || time).split("s");
		  
	  	if (h[0] && h.length === 2) seconds += parseInt(h[0], 10) * 60 * 60;
	  	if (m[0] && m.length === 2) seconds += parseInt(m[0], 10) * 60;
	  	if (s[0] && s.length === 2) seconds += parseInt(s[0], 10);

		return seconds;
	}
	getKeyByValue(obj, value) {
		for (const key in obj) {
			if (obj.hasOwnProperty(key)) {
				if (obj[key] === value) {
					return key;
				}
			}
		}
	}
}
class AnnotationRenderer {
	constructor(annotations, container, playerOptions, updateInterval = 1000) {
		if (!annotations) throw new Error("Annotation objects must be provided");
		if (!container) throw new Error("An element to contain the annotations must be provided");

		if (playerOptions && playerOptions.getVideoTime && playerOptions.seekTo) {
			this.playerOptions = playerOptions;
		}
		else {
			console.info("AnnotationRenderer is running without a player. The update method will need to be called manually.");
		}

		this.annotations = annotations;
		this.container = container;

		this.annotationsContainer = document.createElement("div");
		this.annotationsContainer.classList.add("__cxt-ar-annotations-container__");
		this.annotationsContainer.setAttribute("data-layer", "4");
		this.annotationsContainer.addEventListener("click", e => {
			this.annotationClickHandler(e);
		});
		this.container.prepend(this.annotationsContainer);

		this.createAnnotationElements();

		// in case the dom already loaded
		this.updateAllAnnotationSizes();
		window.addEventListener("DOMContentLoaded", e => {
			this.updateAllAnnotationSizes();
		});

		this.updateInterval = updateInterval;
		this.updateIntervalId = null;
	}
	changeAnnotationData(annotations) {
		this.stop();
		this.removeAnnotationElements();
		this.annotations = annotations;
		this.createAnnotationElements();
		this.start();
	}
	createAnnotationElements() {
		for (const annotation of this.annotations) {
			const el = document.createElement("div");
			el.classList.add("__cxt-ar-annotation__");

			annotation.__element = el;
			el.__annotation = annotation;

			// close button
			const closeButton = this.createCloseElement();
			closeButton.addEventListener("click", e => {
				el.setAttribute("hidden", "");
				el.setAttribute("data-ar-closed", "");
				if (el.__annotation.__speechBubble) {
					const speechBubble = el.__annotation.__speechBubble;
					speechBubble.style.display = "none";
				}
			});
			el.append(closeButton);

			if (annotation.text) {
				const textNode = document.createElement("span");
				textNode.textContent = annotation.text;
				el.append(textNode);
				el.setAttribute("data-ar-has-text", "");
			}

			if (annotation.style === "speech") {
				const containerDimensions = this.container.getBoundingClientRect();
				const speechX = this.percentToPixels(containerDimensions.width, annotation.x);
				const speechY = this.percentToPixels(containerDimensions.height, annotation.y);

				const speechWidth = this.percentToPixels(containerDimensions.width, annotation.width);
				const speechHeight = this.percentToPixels(containerDimensions.height, annotation.height);

				const speechPointX = this.percentToPixels(containerDimensions.width, annotation.sx);
				const speechPointY = this.percentToPixels(containerDimensions.height, annotation.sy);

				const bubbleColor = this.getFinalAnnotationColor(annotation, false);
				const bubble = this.createSvgSpeechBubble(speechX, speechY, speechWidth, speechHeight, speechPointX, speechPointY, bubbleColor, annotation.__element);
				bubble.style.display = "none";
				bubble.style.overflow = "visible";
				el.style.pointerEvents = "none";
				bubble.__annotationEl = el;
				annotation.__speechBubble = bubble;

				const path = bubble.getElementsByTagName("path")[0];
				path.addEventListener("mouseover", () => {
					closeButton.style.display = "block";
					// path.style.cursor = "pointer";
					closeButton.style.cursor = "pointer";
					path.setAttribute("fill", this.getFinalAnnotationColor(annotation, true));
				});
				path.addEventListener("mouseout", e => {
					if (!e.relatedTarget.classList.contains("__cxt-ar-annotation-close__")) {
						closeButton.style.display ="none";
						// path.style.cursor = "default";
						closeButton.style.cursor = "default";
						path.setAttribute("fill", this.getFinalAnnotationColor(annotation, false));
					}
				});

				closeButton.addEventListener("mouseleave", () => {
					closeButton.style.display = "none";
					path.style.cursor = "default";
					closeButton.style.cursor = "default";
					path.setAttribute("fill", this.getFinalAnnotationColor(annotation, false));
				});

				el.prepend(bubble);
			}
			else if (annotation.type === "highlight") {
				el.style.backgroundColor = "";
				el.style.border = `2.5px solid ${this.getFinalAnnotationColor(annotation, false)}`;
				if (annotation.actionType === "url")
					el.style.cursor = "pointer";
			}
			else if (annotation.style !== "title") {
				el.style.backgroundColor = this.getFinalAnnotationColor(annotation);
				el.addEventListener("mouseenter", () => {
					el.style.backgroundColor = this.getFinalAnnotationColor(annotation, true);
				});
				el.addEventListener("mouseleave", () => {
					el.style.backgroundColor = this.getFinalAnnotationColor(annotation, false);
				});
				if (annotation.actionType === "url")
					el.style.cursor = "pointer";
			}

			el.style.color = `#${this.decimalToHex(annotation.fgColor)}`;

			el.setAttribute("data-ar-type", annotation.type);
			el.setAttribute("hidden", "");
			this.annotationsContainer.append(el);
		}
	}
	createCloseElement() {
		const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
		svg.setAttribute("viewBox", "0 0 100 100")
		svg.classList.add("__cxt-ar-annotation-close__");

		const path = document.createElementNS(svg.namespaceURI, "path");
		path.setAttribute("d", "M25 25 L 75 75 M 75 25 L 25 75");
		path.setAttribute("stroke", "#bbb");
		path.setAttribute("stroke-width", 10)
		path.setAttribute("x", 5);
		path.setAttribute("y", 5);

		const circle = document.createElementNS(svg.namespaceURI, "circle");
		circle.setAttribute("cx", 50);
		circle.setAttribute("cy", 50);
		circle.setAttribute("r", 50);

		svg.append(circle, path);
		return svg;
	}
	createSvgSpeechBubble(x, y, width, height, pointX, pointY, color = "white", element, svg) {

		const horizontalBaseStartMultiplier = 0.17379070765180116;
		const horizontalBaseEndMultiplier = 0.14896346370154384;

		const verticalBaseStartMultiplier = 0.12;
		const verticalBaseEndMultiplier = 0.3;

		let path;

		if (!svg) {
			svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
			svg.classList.add("__cxt-ar-annotation-speech-bubble__");

			path = document.createElementNS("http://www.w3.org/2000/svg", "path");
			path.setAttribute("fill", color);
			svg.append(path);
		}
		else {
			path = svg.children[0];
		}

		svg.style.position = "absolute";
		svg.setAttribute("width", "100%");
		svg.setAttribute("height", "100%");
		svg.style.left = "0";
		svg.style.top = "0";

		let positionStart;

		let baseStartX = 0;
		let baseStartY = 0;

		let baseEndX = 0;
		let baseEndY = 0;

		let pointFinalX = pointX;
		let pointFinalY = pointY;

		let commentRectPath;
		const pospad = 20;

		let textWidth = 0;
		let textHeight = 0;
		let textX = 0;
		let textY = 0;

		let textElement;
		let closeElement;

		if (element) {
			textElement = element.getElementsByTagName("span")[0];
			closeElement = element.getElementsByClassName("__cxt-ar-annotation-close__")[0];
		}

		if (pointX > ((x + width) - (width / 2)) && pointY > y + height) {
			positionStart = "br";
			baseStartX = width - ((width * horizontalBaseStartMultiplier) * 2);
			baseEndX = baseStartX + (width * horizontalBaseEndMultiplier);
			baseStartY = height;
			baseEndY = height;

			pointFinalX = pointX - x;
			pointFinalY = pointY - y;
			element.style.height = pointY - y;
			commentRectPath = `L${width} ${height} L${width} 0 L0 0 L0 ${baseStartY} L${baseStartX} ${baseStartY}`;
			if (textElement) {
				textWidth = width;
				textHeight = height;
				textX = 0;
				textY = 0;
			}
		}
		else if (pointX < ((x + width) - (width / 2)) && pointY > y + height) {
			positionStart = "bl";
			baseStartX = width * horizontalBaseStartMultiplier;
			baseEndX = baseStartX + (width * horizontalBaseEndMultiplier);
			baseStartY = height;
			baseEndY = height;

			pointFinalX = pointX - x;
			pointFinalY = pointY - y;
			element.style.height = `${pointY - y}px`;
			commentRectPath = `L${width} ${height} L${width} 0 L0 0 L0 ${baseStartY} L${baseStartX} ${baseStartY}`;
			if (textElement) {
				textWidth = width;
				textHeight = height;
				textX = 0;
				textY = 0;
			}
		}
		else if (pointX > ((x + width) - (width / 2)) && pointY < (y - pospad)) {
			positionStart = "tr";
			baseStartX = width - ((width * horizontalBaseStartMultiplier) * 2);
			baseEndX = baseStartX + (width * horizontalBaseEndMultiplier);

			const yOffset = y - pointY;
			baseStartY = yOffset;
			baseEndY = yOffset;
			element.style.top = y - yOffset + "px";
			element.style.height = height + yOffset + "px";

			pointFinalX = pointX - x;
			pointFinalY = 0;
			commentRectPath = `L${width} ${yOffset} L${width} ${height + yOffset} L0 ${height + yOffset} L0 ${yOffset} L${baseStartX} ${baseStartY}`;
			if (textElement) {
				textWidth = width;
				textHeight = height;
				textX = 0;
				textY = yOffset;
			}
		}
		else if (pointX < ((x + width) - (width / 2)) && pointY < y) {
			positionStart = "tl";
			baseStartX = width * horizontalBaseStartMultiplier;
			baseEndX = baseStartX + (width * horizontalBaseEndMultiplier);

			const yOffset = y - pointY;
			baseStartY = yOffset;
			baseEndY = yOffset;
			element.style.top = y - yOffset + "px";
			element.style.height = height + yOffset + "px";

			pointFinalX = pointX - x;
			pointFinalY = 0;
			commentRectPath = `L${width} ${yOffset} L${width} ${height + yOffset} L0 ${height + yOffset} L0 ${yOffset} L${baseStartX} ${baseStartY}`;

			if (textElement) {
				textWidth = width;
				textHeight = height;
				textX = 0;
				textY = yOffset;
			}
		}
		else if (pointX > (x + width) && pointY > (y - pospad) && pointY < ((y + height) - pospad)) {
			positionStart = "r";

			const xOffset = pointX - (x + width);

			baseStartX = width;
			baseEndX = width;

			element.style.width = width + xOffset + "px";

			baseStartY = height * verticalBaseStartMultiplier;
			baseEndY = baseStartY + (height * verticalBaseEndMultiplier);

			pointFinalX = width + xOffset;
			pointFinalY = pointY - y;
			commentRectPath = `L${baseStartX} ${height} L0 ${height} L0 0 L${baseStartX} 0 L${baseStartX} ${baseStartY}`;
			if (textElement) {
				textWidth = width;
				textHeight = height;
				textX = 0;
				textY = 0;
			}
		}
		else if (pointX < x && pointY > y && pointY < (y + height)) {
			positionStart = "l";

			const xOffset = x - pointX;

			baseStartX = xOffset;
			baseEndX = xOffset;

			element.style.left = x - xOffset + "px";
			element.style.width = width + xOffset + "px";

			baseStartY = height * verticalBaseStartMultiplier;
			baseEndY = baseStartY + (height * verticalBaseEndMultiplier);

			pointFinalX = 0;
			pointFinalY = pointY - y;
			commentRectPath = `L${baseStartX} ${height} L${width + baseStartX} ${height} L${width + baseStartX} 0 L${baseStartX} 0 L${baseStartX} ${baseStartY}`;
			if (textElement) {
				textWidth = width;
				textHeight = height;
				textX = xOffset;
				textY = 0;
			}
		}
		else {
			return svg;
		}

		if (textElement) {
			textElement.style.left = textX + "px";
			textElement.style.top = textY + "px";
			textElement.style.width = textWidth + "px";
			textElement.style.height = textHeight + "px";
		}
		if (closeElement) {
			const closeSize = parseFloat(this.annotationsContainer.style.getPropertyValue("--annotation-close-size"), 10);
			if (closeSize) {
				closeElement.style.left = ((textX + textWidth) + (closeSize / -1.8)) + "px";
				closeElement.style.top = (textY + (closeSize / -1.8)) + "px";
			}
		}

		const pathData = `M${baseStartX} ${baseStartY} L${pointFinalX} ${pointFinalY} L${baseEndX} ${baseEndY} ${commentRectPath}`;
		path.setAttribute("d", pathData);

		return svg;
	}
	getFinalAnnotationColor(annotation, hover = false) {
		const alphaHex = hover ? (0xE6).toString(16) : Math.floor((annotation.bgOpacity * 255)).toString(16);
		if (!isNaN(annotation.bgColor)) {
			const bgColorHex = this.decimalToHex(annotation.bgColor);

			const backgroundColor = `#${bgColorHex}${alphaHex}`;
			return backgroundColor;
		}
	}
	removeAnnotationElements() {
		for (const annotation of this.annotations) {
			annotation.__element.remove();
		}
	}
	update(videoTime) {
		for (const annotation of this.annotations) {
			const el = annotation.__element;
			if (el.hasAttribute("data-ar-closed")) continue;
			const start = annotation.timeStart;
			const end = annotation.timeEnd;

			if (el.hasAttribute("hidden") && (videoTime >= start && videoTime < end)) {
				el.removeAttribute("hidden");
				if (annotation.style === "speech" && annotation.__speechBubble) {
					annotation.__speechBubble.style.display = "block";
				}
			}
			else if (!el.hasAttribute("hidden") && (videoTime < start || videoTime > end)) {
				el.setAttribute("hidden", "");
				if (annotation.style === "speech" && annotation.__speechBubble) {
					annotation.__speechBubble.style.display = "none";
				}
			}
		}
	}
	start() {
		if (!this.playerOptions) throw new Error("playerOptions must be provided to use the start method");

		const videoTime = this.playerOptions.getVideoTime();
		if (!this.updateIntervalId) {
			this.update(videoTime);
			this.updateIntervalId = setInterval(() => {
				const videoTime = this.playerOptions.getVideoTime();
				this.update(videoTime);
				window.dispatchEvent(new CustomEvent("__ar_renderer_start"));
			}, this.updateInterval);
		}
	}
	stop() {
		if (!this.playerOptions) throw new Error("playerOptions must be provided to use the stop method");

		const videoTime = this.playerOptions.getVideoTime();
		if (this.updateIntervalId) {
			this.update(videoTime);
			clearInterval(this.updateIntervalId);
			this.updateIntervalId = null;
			window.dispatchEvent(new CustomEvent("__ar_renderer_stop"));
		}
	}

	updateAnnotationTextSize(annotation, containerHeight) {
		if (annotation.textSize) {
			const textSize = (annotation.textSize / 100) * containerHeight;
			annotation.__element.style.fontSize = `${textSize}px`;
		}
	}
	updateTextSize() {
		const containerHeight = this.container.getBoundingClientRect().height;
		// should be run when the video resizes
		for (const annotation of this.annotations) {
			this.updateAnnotationTextSize(annotation, containerHeight);
		}
	}
	updateCloseSize(containerHeight) {
		if (!containerHeight) containerHeight = this.container.getBoundingClientRect().height;
		const multiplier = 0.0423;
		this.annotationsContainer.style.setProperty("--annotation-close-size", `${containerHeight * multiplier}px`);
	}
	updateAnnotationDimensions(annotations, videoWidth, videoHeight) {
		const playerWidth = this.container.getBoundingClientRect().width;
		const playerHeight = this.container.getBoundingClientRect().height;

		const widthDivider = playerWidth / videoWidth;
		const heightDivider = playerHeight / videoHeight;

		let scaledVideoWidth = playerWidth;
		let scaledVideoHeight = playerHeight;

		if (widthDivider % 1 !== 0 || heightDivider % 1 !== 0) {
			// vertical bars
			if (widthDivider > heightDivider) {
				scaledVideoWidth = (playerHeight / videoHeight) * videoWidth;
				scaledVideoHeight = playerHeight;
			}
			// horizontal bars
			else if (heightDivider > widthDivider) {
				scaledVideoWidth = playerWidth;
				scaledVideoHeight = (playerWidth / videoWidth) * videoHeight;
			}
		}

		const verticalBlackBarWidth = (playerWidth - scaledVideoWidth) / 2;
		const horizontalBlackBarHeight = (playerHeight - scaledVideoHeight) / 2;

		const widthOffsetPercent = (verticalBlackBarWidth / playerWidth * 100);
		const heightOffsetPercent = (horizontalBlackBarHeight / playerHeight * 100);

		const widthMultiplier = (scaledVideoWidth / playerWidth);
		const heightMultiplier = (scaledVideoHeight / playerHeight);

		for (const annotation of annotations) {
			const el = annotation.__element;

			let ax = widthOffsetPercent + (annotation.x * widthMultiplier);
			let ay = heightOffsetPercent + (annotation.y * heightMultiplier);
			let aw = annotation.width * widthMultiplier;
			let ah = annotation.height * heightMultiplier;

			el.style.left = `${ax}%`;
			el.style.top = `${ay}%`;

			el.style.width = `${aw}%`;
			el.style.height = `${ah}%`;

			let horizontalPadding = scaledVideoWidth * 0.008;
			let verticalPadding = scaledVideoHeight * 0.008;

			if (annotation.style === "speech" && annotation.text) {
				const pel = annotation.__element.getElementsByTagName("span")[0];
				horizontalPadding *= 2;
				verticalPadding *= 2;

				pel.style.paddingLeft = horizontalPadding + "px";
				pel.style.paddingRight = horizontalPadding + "px";
				pel.style.paddingBottom = verticalPadding + "px";
				pel.style.paddingTop = verticalPadding + "px";
			}
			else if (annotation.style !== "speech") {
				el.style.paddingLeft = horizontalPadding + "px";
				el.style.paddingRight = horizontalPadding + "px";
				el.style.paddingBottom = verticalPadding + "px";
				el.style.paddingTop = verticalPadding + "px";
			}

			if (annotation.__speechBubble) {
				const asx = this.percentToPixels(playerWidth, ax);
				const asy = this.percentToPixels(playerHeight, ay);
				const asw = this.percentToPixels(playerWidth, aw);
				const ash = this.percentToPixels(playerHeight, ah);

				let sx = widthOffsetPercent + (annotation.sx * widthMultiplier);
				let sy = heightOffsetPercent + (annotation.sy * heightMultiplier);
				sx = this.percentToPixels(playerWidth, sx);
				sy = this.percentToPixels(playerHeight, sy);

				this.createSvgSpeechBubble(asx, asy, asw, ash, sx, sy, null, annotation.__element, annotation.__speechBubble);
			}

			this.updateAnnotationTextSize(annotation, scaledVideoHeight);
			this.updateCloseSize(scaledVideoHeight);
		}
	}

	updateAllAnnotationSizes() {
		if (this.playerOptions && this.playerOptions.getOriginalVideoWidth && this.playerOptions.getOriginalVideoHeight) {
			const videoWidth = this.playerOptions.getOriginalVideoWidth();
			const videoHeight = this.playerOptions.getOriginalVideoHeight();
			this.updateAnnotationDimensions(this.annotations, videoWidth, videoHeight);
		}
		else {
			const playerWidth = this.container.getBoundingClientRect().width;
			const playerHeight = this.container.getBoundingClientRect().height;
			this.updateAnnotationDimensions(this.annotations, playerWidth, playerHeight);
		}
	}

	hideAll() {
		for (const annotation of this.annotations) {
			annotation.__element.setAttribute("hidden", "");
		}
	}
	annotationClickHandler(e) {
		let annotationElement = e.target;
		// if we click on annotation text instead of the actual annotation element
		if (!annotationElement.matches(".__cxt-ar-annotation__") && !annotationElement.closest(".__cxt-ar-annotation-close__")) {
			annotationElement = annotationElement.closest(".__cxt-ar-annotation__");
			if (!annotationElement) return null;
		} 
		let annotationData = annotationElement.__annotation;

		if (!annotationElement || !annotationData) return;

		if (annotationData.actionType === "time") {
			const seconds = annotationData.actionSeconds;
			if (this.playerOptions) {
				this.playerOptions.seekTo(seconds);
				const videoTime = this.playerOptions.getVideoTime();
				this.update(videoTime);
			}
			window.dispatchEvent(new CustomEvent("__ar_seek_to", {detail: {seconds}}));
		}
		else if (annotationData.actionType === "url") {
			const data = {url: annotationData.actionUrl, target: annotationData.actionUrlTarget || "current"};

			const timeHash = this.extractTimeHash(new URL(data.url));
			if (timeHash && timeHash.hasOwnProperty("seconds")) {
				data.seconds = timeHash.seconds;
			}
			window.dispatchEvent(new CustomEvent("__ar_annotation_click", {detail: data}));
		}
	}

	setUpdateInterval(ms) {
		this.updateInterval = ms;
		this.stop();
		this.start();
	}
	// https://stackoverflow.com/a/3689638/10817894
	decimalToHex(dec) {
		let hex = dec.toString(16);
		hex = "000000".substr(0, 6 - hex.length) + hex; 
		return hex;
	}
	extractTimeHash(url) {
		if (!url) throw new Error("A URL must be provided");
		const hash = url.hash;

		if (hash && hash.startsWith("#t=")) {
			const timeString = url.hash.split("#t=")[1];
			const seconds = this.timeStringToSeconds(timeString);
			return {seconds};
		}
		else {
			return false;
		}
	}
	timeStringToSeconds(time) {
		let seconds = 0;

		const h = time.split("h");
	  	const m = (h[1] || time).split("m");
	  	const s = (m[1] || time).split("s");
		  
	  	if (h[0] && h.length === 2) seconds += parseInt(h[0], 10) * 60 * 60;
	  	if (m[0] && m.length === 2) seconds += parseInt(m[0], 10) * 60;
	  	if (s[0] && s.length === 2) seconds += parseInt(s[0], 10);

		return seconds;
	}
	percentToPixels(a, b) {
		return a * b / 100;
	}
}
function youtubeAnnotationsPlugin(options) {
	if (!options.annotationXml) throw new Error("Annotation data must be provided");
	if (!options.videoContainer) throw new Error("A video container to overlay the data on must be provided");

	const player = this;

	const xml = options.annotationXml;
	const parser = new AnnotationParser();
	const annotationElements = parser.getAnnotationsFromXml(xml);
	const annotations = parser.parseYoutubeAnnotationList(annotationElements);

	const videoContainer = options.videoContainer;

	const playerOptions = {
		getVideoTime() {
			return player.currentTime();
		},
		seekTo(seconds) {
			player.currentTime(seconds);
		},
		getOriginalVideoWidth() {
			return player.videoWidth();
		},
		getOriginalVideoHeight() {
			return player.videoHeight();
		}
	};

	raiseControls();
	const renderer = new AnnotationRenderer(annotations, videoContainer, playerOptions, options.updateInterval);
	setupEventListeners(player, renderer);
	renderer.start();
}

function setupEventListeners(player, renderer) {
	if (!player) throw new Error("A video player must be provided");
	// should be throttled for performance
	player.on("playerresize", e => {
		renderer.updateAllAnnotationSizes(renderer.annotations);
	});
	// Trigger resize since the video can have different dimensions than player
	player.one("loadedmetadata", e => {
		renderer.updateAllAnnotationSizes(renderer.annotations);
	});

	player.on("pause", e => {
		renderer.stop();
	});
	player.on("play", e => {
		renderer.start();
	});
	player.on("seeking", e => {
		renderer.update();
	});
	player.on("seeked", e => {
		renderer.update();
	});
}

function raiseControls() {
	const styles = document.createElement("style");
	styles.textContent = `.vjs-control-bar {z-index: 21;}`;
	document.body.append(styles);
}