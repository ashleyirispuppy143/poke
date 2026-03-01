// in the beginning.... god made mrrprpmnaynayaynaynayanyuwuuuwmauwnwanwaumawp :p
var _yt_player = videojs;

var versionclient = "youtube.player.web_20250917_22_RC00"

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
 */ 
document.addEventListener("DOMContentLoaded", () => {
  // ─── Video.js init ────────────────────────────────────────────────────────────
  const video = videojs("video", {
    controls: true,
    autoplay: true,
    preload: "auto",
    errorDisplay: false,
  });

  const qs       = new URLSearchParams(window.location.search);
  const qua      = qs.get("quality") || "";
  const vidKey   = qs.get("v")       || "";
  const videoEl  = document.getElementById("video");
  const audio    = document.getElementById("aud");

  try { videoEl.setAttribute("playsinline", "");        } catch {}
  try { videoEl.setAttribute("webkit-playsinline", ""); } catch {}

  // ─── Platform detection ───────────────────────────────────────────────────────
  const platform = (() => {
    try {
      const isFirefox = (() => {
        try { return CSS.supports("-moz-orient", "horizontal"); } catch { return false; }
      })();
      const isChromium = (() => {
        if (isFirefox) return false;
        try {
          return typeof window.chrome !== "undefined" && window.chrome !== null &&
            CSS.supports("overflow", "overlay");
        } catch { return false; }
      })();
      const isIosWebKit = (() => {
        if (isFirefox) return false;
        try { return typeof GestureEvent !== "undefined" && navigator.maxTouchPoints > 1; }
        catch { return false; }
      })();
      const mobile = (() => {
        try {
          if (typeof navigator.userAgentData?.mobile === "boolean")
            return navigator.userAgentData.mobile;
        } catch {}
        try {
          return navigator.maxTouchPoints > 0 &&
            window.matchMedia("(pointer: coarse)").matches;
        } catch {}
        return false;
      })();
      return {
        mobile:              !!mobile,
        ios:                 !!isIosWebKit,
        android:             !!(isChromium && mobile && !isIosWebKit),
        isFirefox:           !!isFirefox,
        isChromium:          !!isChromium,
        iosWebKitLike:       !!isIosWebKit,
        problemMobileBrowser:!!((isChromium && mobile) || isIosWebKit),
        desktopChromiumLike: !!(isChromium && !mobile),
        chromiumOnlyBrowser: !!isChromium,
        useBgControllerRetry:!isFirefox && (isChromium || isIosWebKit),
      };
    } catch {
      return {
        mobile:false,ios:false,android:false,isFirefox:false,isChromium:false,
        iosWebKitLike:false,problemMobileBrowser:false,desktopChromiumLike:false,
        chromiumOnlyBrowser:false,useBgControllerRetry:false,
      };
    }
  })();

  // ─── Audio source / coupled-mode ─────────────────────────────────────────────
  const pickAudioSrc = () => {
    if (!audio) return null;
    const s = audio.getAttribute?.("src");
    if (s) return s;
    const child = audio.querySelector?.("source");
    if (child?.getAttribute?.("src")) return child.getAttribute("src");
    return audio.currentSrc || null;
  };
  const hasExternalAudio = !!audio && audio.tagName === "AUDIO" && !!pickAudioSrc();
  const coupledMode      = hasExternalAudio && qua !== "medium";

  // Strip loop attributes (we handle looping ourselves)
  try { videoEl.loop = false; videoEl.removeAttribute?.("loop"); } catch {}
  try { if (audio) { audio.loop = false; audio.removeAttribute?.("loop"); } } catch {}

  // ─── Tiny utilities ───────────────────────────────────────────────────────────
  const now     = () => performance.now();
  const clamp   = (v, lo, hi) => Math.max(lo, Math.min(hi, Number(v) || 0));
  const clamp01 = v => clamp(v, 0, 1);

  function isLoopDesired() {
    return !!videoEl.loop || videoEl.hasAttribute("loop") ||
      qs.get("loop") === "1" || qs.get("loop") === "true" || window.forceLoop === true;
  }
  function wantsAutoplay() {
    try { const q=(qs.get("autoplay")||"").toLowerCase(); if(q==="1"||q==="true"||q==="yes") return true; } catch {}
    try { if (window.forceAutoplay === true) return true; } catch {}
    try { if (videoEl?.autoplay || videoEl?.hasAttribute?.("autoplay")) return true; } catch {}
    try {
      if (typeof video.autoplay === "function") {
        const a = video.autoplay();
        if (a === true || a === "play" || a === "muted" || a === "any") return true;
      }
    } catch {}
    return false;
  }

  // ─── Video.js element accessors ──────────────────────────────────────────────
  let _cachedInnerEl = null;
  function getVideoEl() {
    try { if (videoEl && typeof videoEl.play === "function") return videoEl; } catch {}
    try {
      if (_cachedInnerEl && typeof _cachedInnerEl.play === "function") return _cachedInnerEl;
      const inner = video?.el?.()?.querySelector?.("video");
      if (inner) { _cachedInnerEl = inner; return inner; }
    } catch {}
    return videoEl;
  }
  function isVideoPaused() {
    try { if (typeof video.paused === "function") return !!video.paused(); } catch {}
    try { return !!(getVideoEl()?.paused); } catch {}
    return true;
  }
  function getVideoReadyState() {
    try { return Number(getVideoEl()?.readyState || 0); } catch {}
    return 0;
  }
  function getVideoTime() {
    try { const t = Number(video.currentTime()); return isFinite(t) ? t : 0; } catch {}
    try { const t = Number(videoEl.currentTime);  return isFinite(t) ? t : 0; } catch {}
    return 0;
  }
  function getVideoDuration() {
    try { const d = Number(video.duration()); return isFinite(d) && d > 0 ? d : 0; } catch {}
    return 0;
  }
  function getVideoRate() {
    try { const r = Number(video.playbackRate()); return isFinite(r) && r > 0 ? r : 1; } catch {}
    return 1;
  }
  function getVideoMuted() {
    try { if (typeof video.muted === "function") return !!video.muted(); } catch {}
    try { return !!videoEl.muted; } catch {}
    return false;
  }
  function getVideoVolume() {
    try { if (typeof video.volume === "function") return clamp01(video.volume()); } catch {}
    try { return clamp01(videoEl.volume); } catch {}
    return 1;
  }
  function doSetVideoTime(t) {
    if (!isFinite(t) || t < 0) return;
    try { video.currentTime(t); } catch {}
    try { videoEl.currentTime = t; } catch {}
    try { const v = getVideoEl(); if (v && v !== videoEl) v.currentTime = t; } catch {}
  }
  function doSetAudioTime(t) {
    if (!audio || !isFinite(t) || t < 0) return;
    try { audio.currentTime = t; } catch {}
  }

  // ─── Buffer helpers ───────────────────────────────────────────────────────────
  const HAVE_FUTURE_DATA  = 3;
  const HAVE_ENOUGH_DATA  = 4;
  const MIN_BUF_AHEAD_SEC = 0.15;
  const BUF_EPS           = 0.3;

  function bufferedAheadSec(media, t) {
    try {
      const br = media.buffered;
      if (!br || br.length === 0 || !isFinite(t)) return 0;
      for (let i = 0; i < br.length; i++) {
        if (t >= br.start(i) - BUF_EPS && t <= br.end(i) + BUF_EPS)
          return Math.max(0, br.end(i) - t);
      }
    } catch {}
    return 0;
  }
  function mediaCanPlay(media, t) {
    if (!media || !isFinite(t)) return false;
    try {
      const rs = Number(media.readyState || 0);
      if (rs >= HAVE_ENOUGH_DATA) return true;
      if (rs >= HAVE_FUTURE_DATA && bufferedAheadSec(media, t) >= 0.05) return true;
      return bufferedAheadSec(media, t) >= MIN_BUF_AHEAD_SEC;
    } catch { return false; }
  }
  function bothCanPlay(t) {
    const v = getVideoEl();
    if (!coupledMode) return mediaCanPlay(v, t);
    return mediaCanPlay(v, t) && mediaCanPlay(audio, t);
  }
  function audioHasAnyData(t) {
    if (!coupledMode || !audio) return true;
    try { return Number(audio.readyState || 0) >= 2 || bufferedAheadSec(audio, t) > 0; }
    catch { return false; }
  }

  // ─── State ───────────────────────────────────────────────────────────────────
  const S = {
    // ── Single source of truth ──
    wantsPlay: false,

    // ── Lifecycle ──
    startupPhase:        true,
    startupPrimed:       !coupledMode,
    startupKickDone:     false,
    startupKickInFlight: false,
    firstPlayCommitted:  false,
    audioEverStarted:    false,
    primeStartedAt:      now(),

    // ── Buffering ──
    bufferHold:   false,
    videoWaiting: false,

    // ── Seeking ──
    seeking:         false,
    seekWantedPlay:  false,

    // ── Mute tracking ──
    userMutedVideo: false,
    userMutedAudio: false,

    // ── Gain (smooth, no WebAudioContext) ──
    currentGain: 0,
    gainRafId:   null,

    // ── Sync ──
    syncTimer:      null,
    syncActive:     false,
    softSeekActive: false,
    driftHistory:   [],
    fastSyncUntil:  0,

    // ── In-flight guards ──
    playOpInFlight:   false,
    playGuardUntil:   0,
    audioPlayInFlight:null,

    // ── User-intent windows ──
    userPlayUntil:  0,
    userPauseUntil: 0,

    // ── Background ──
    bgHiddenSince:  0,
    bgBaseVT:       0,
    bgBaseRate:     1,
    bgWasPlaying:   false,
    resumeOnVisible:false,

    // ── Timers ──
    bufferResumeTimer:  null,
    seekFinalizeTimer:  null,
    startupRetryTimer:  null,
    bgRetryTimer:       null,

    // ── Media session ──
    lastKnownVT:          0,
    lastKnownVTts:        0,
    mediaPositionNextAt:  0,
    mediaSessionSerial:   0,

    // ── Loop ──
    suppressEndedUntil: 0,

    // ── Mobile video repair ──
    videoRepairCooldown: 0,
    videoRepairing:      false,
    _lastCheckedVT:      0,
    _lastCheckedVTts:    0,

    // ── Restart ──
    restarting: false,
  };

  // ─── TitleBar (fullscreen overlay) ───────────────────────────────────────────
  video.ready(() => {
    const metaTitle = document.querySelector('meta[name="title"]')?.content || "";
    const metaDesc  = document.querySelector('meta[name="twitter:description"]')?.content || "";
    let stats = "";
    const match = metaDesc.match(/👍\s*[^|]+\|\s*👎\s*[^|]+\|\s*📈\s*[^💬]+/);
    if (match) {
      stats = match[0]
        .replace(/👍/g, "👍")
        .replace(/👎/g, "• 👎")
        .replace(/📈/g, "• 📈")
        .replace(/\s*\|\s*/g, "   ");
    }
    const createTitleBar = () => {
      if (!video.getChild("TitleBar")) {
        const tb = video.addChild("TitleBar");
        tb.update({ title: metaTitle, description: stats });
      }
    };
    const removeTitleBar = () => {
      const ex = video.getChild("TitleBar");
      if (ex) video.removeChild(ex);
    };
    const onFsChange = () => {
      (document.fullscreenElement || document.webkitFullscreenElement)
        ? createTitleBar() : removeTitleBar();
    };
    document.addEventListener("fullscreenchange",       onFsChange, { passive: true });
    document.addEventListener("webkitfullscreenchange", onFsChange, { passive: true });
    onFsChange();
  });

  // ─── Gain management (pure volume ramp, NO new AudioContext) ─────────────────
  function getTargetGain() {
    if (!coupledMode || !audio) return 0;
    if (S.userMutedVideo || getVideoMuted()) return 0;
    if (S.userMutedAudio)                   return 0;
    return getVideoVolume();
  }
  function setGainNow(g) {
    S.currentGain = clamp01(g);
    if (audio) { try { audio.volume = S.currentGain; } catch {} }
  }
  function cancelGainRamp() {
    if (S.gainRafId) { cancelAnimationFrame(S.gainRafId); S.gainRafId = null; }
  }
  function rampGain(toGain, durationMs = 30) {
    return new Promise(resolve => {
      cancelGainRamp();
      const from = S.currentGain;
      const to   = clamp01(toGain);
      if (!audio || Math.abs(from - to) < 0.002 || durationMs <= 0) {
        setGainNow(to);
        resolve();
        return;
      }
      const start = now();
      const step = () => {
        const t      = Math.min(1, (now() - start) / durationMs);
        const eased  = t * t * (3 - 2 * t); // smoothstep
        setGainNow(from + (to - from) * eased);
        if (t < 1) { S.gainRafId = requestAnimationFrame(step); }
        else        { S.gainRafId = null; resolve(); }
      };
      S.gainRafId = requestAnimationFrame(step);
    });
  }
  function rampGainToTarget(ms = 40) {
    return rampGain(getTargetGain(), ms);
  }
  // Watchdog: restore gain if it got stuck at 0 while playing
  function ensureGainCorrect() {
    if (!coupledMode || !audio || S.softSeekActive) return;
    if (!S.wantsPlay || audio.paused || isVideoPaused()) return;
    const tg = getTargetGain();
    if (tg > 0.01 && S.currentGain < tg * 0.5 && S.gainRafId === null) {
      rampGain(tg, 120);
    }
  }

  // ─── Raw play/pause primitives ────────────────────────────────────────────────
  function execVideoPlay() {
    let p = null;
    try { p = video.play(); } catch {}
    if (!p || typeof p.then !== "function") {
      try { const v = getVideoEl(); if (v) p = v.play(); } catch {}
    }
    return Promise.resolve(p).catch(() => {});
  }
  function execVideoPause() {
    try { video.pause(); } catch {}
    try { const v = getVideoEl(); if (v && !v.paused) v.pause(); } catch {}
  }
  async function execAudioPlay() {
    if (!coupledMode || !audio || typeof audio.play !== "function") return false;
    if (S.audioPlayInFlight) {
      try { await S.audioPlayInFlight; } catch {}
      return !audio.paused;
    }
    try {
      const p = audio.play();
      S.audioPlayInFlight = Promise.resolve(p);
      await S.audioPlayInFlight;
    } catch { /* NotAllowedError / AbortError */ }
    finally  { S.audioPlayInFlight = null; }
    return !audio.paused;
  }
  function execAudioPause() {
    if (!coupledMode || !audio) return;
    try { if (!audio.paused) audio.pause(); } catch {}
  }

  // ─── commitFirstPlay ─────────────────────────────────────────────────────────
  function commitFirstPlay() {
    if (!S.firstPlayCommitted) {
      S.firstPlayCommitted = true;
      setTimeout(() => { S.startupPhase = false; }, 800);
    }
  }

  // ─── playBothTogether  (the single "start playback" entry point) ──────────────
  async function playBothTogether(opts = {}) {
    const { force = false } = opts;

    if (!S.wantsPlay && !force)              return false;
    if (S.restarting || S.seeking)           return false;
    if (now() < S.playGuardUntil && !force)  return false;
    if (S.playOpInFlight)                    return false;

    S.playOpInFlight  = true;
    S.playGuardUntil  = now() + 1200;

    try {
      // ── Non-coupled simple path ──
      if (!coupledMode) {
        await execVideoPlay();
        const ok = !isVideoPaused();
        if (ok) {
          commitFirstPlay();
          setFastSync(1200);
          updateMSPS();
        }
        return ok;
      }

      // ── Coupled path ──
      const vt = getVideoTime();
      const at = isFinite(Number(audio.currentTime)) ? Number(audio.currentTime) : vt;

      // Fast-path: both already playing and in sync → just restore gain
      if (!isVideoPaused() && !audio.paused && Math.abs(vt - at) < 0.12) {
        await rampGainToTarget(30);
        commitFirstPlay();
        setFastSync(800);
        updateMSPS();
        return true;
      }

      // Align audio exactly to video BEFORE starting either stream
      // (fixes initial desync completely)
      if (Math.abs(at - vt) > 0.05) {
        doSetAudioTime(vt);
        // Give the seek a frame to register
        await new Promise(r => setTimeout(r, 16));
      }

      // Buffer gate (skip on startup before audioEverStarted to avoid deadlock)
      if (S.audioEverStarted && !bothCanPlay(vt)) {
        S.bufferHold = true;
        armBufferResume();
        return false;
      }

      // Silence audio BEFORE play to prevent pop
      cancelGainRamp();
      setGainNow(0);

      // If audio is playing but video isn't, stop audio before re-syncing
      if (!audio.paused && isVideoPaused()) {
        execAudioPause();
        await new Promise(r => setTimeout(r, 10));
      }

      // Play video first
      await execVideoPlay();
      if (isVideoPaused()) { setGainNow(0); return false; }

      // Play audio (always aligned above)
      if (audio.paused) {
        const audioOk = await execAudioPlay();
        if (!audioOk) {
          // Audio blocked (e.g. NotAllowedError) — pause video too and retry
          execVideoPause();
          setGainNow(0);
          _schedulePlayRetry(350);
          return false;
        }
        S.audioEverStarted = true;
      }

      // Ramp gain up smoothly (no pop on start)
      await rampGainToTarget(40);

      commitFirstPlay();
      setFastSync(1500);
      S.driftHistory = [];
      updateMSPS();
      return true;

    } finally {
      S.playOpInFlight = false;
    }
  }

  function _schedulePlayRetry(delay = 300) {
    setTimeout(() => {
      if (S.wantsPlay && !S.seeking && !S.restarting && !S.playOpInFlight) {
        playBothTogether().catch(() => {});
      }
    }, delay);
  }

  // ─── pauseBothTogether ────────────────────────────────────────────────────────
  async function pauseBothTogether() {
    cancelSyncLoop();
    if (coupledMode && audio && !audio.paused) {
      await rampGain(0, 22);
      execAudioPause();
    }
    if (!isVideoPaused()) execVideoPause();
    setGainNow(0);
    clearBufferResumeTimer();
    updateMSPS();
  }

  // ─── Soft audio seek  (drift correction with pop-free gain ramp) ──────────────
  // NEVER changes playbackRate. Uses gain → seek → gain to prevent
  // audible clicks and quality artifacts.
  async function softSeekAudio(targetTime) {
    if (!coupledMode || !audio || S.softSeekActive) return;
    S.softSeekActive = true;
    try {
      const prevGain = S.currentGain;
      await rampGain(0, 18);
      doSetAudioTime(targetTime);
      await new Promise(r => setTimeout(r, 14));
      if (S.wantsPlay && !isVideoPaused()) {
        await rampGain(prevGain > 0.001 ? getTargetGain() : 0, 26);
      }
    } finally {
      S.softSeekActive = false;
    }
  }

  // ─── Buffer resume ────────────────────────────────────────────────────────────
  function clearBufferResumeTimer() {
    if (S.bufferResumeTimer) { clearTimeout(S.bufferResumeTimer); S.bufferResumeTimer = null; }
  }
  function armBufferResume(timeoutMs = 12000) {
    clearBufferResumeTimer();
    const vEl = getVideoEl();
    let cleaned = false;

    const tryResume = () => {
      if (!S.wantsPlay || S.restarting || S.seeking || cleaned) return;
      const vt2 = getVideoTime();
      if (!bothCanPlay(vt2)) return;
      S.bufferHold = false;
      cleanup();
      playBothTogether({ force: true }).catch(() => {});
    };

    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      clearBufferResumeTimer();
      try { vEl.removeEventListener("canplay",  tryResume); } catch {}
      try { vEl.removeEventListener("playing",  tryResume); } catch {}
      try { if (audio) audio.removeEventListener("canplay", tryResume); } catch {}
    };

    try { vEl.addEventListener("canplay",  tryResume, { passive: true }); } catch {}
    try { vEl.addEventListener("playing",  tryResume, { passive: true }); } catch {}
    try { if (audio) audio.addEventListener("canplay", tryResume, { passive: true }); } catch {}

    // Polling fallback (every 250 ms)
    const poll = () => {
      if (cleaned) return;
      tryResume();
      if (!cleaned) S.bufferResumeTimer = setTimeout(poll, 250);
    };
    S.bufferResumeTimer = setTimeout(poll, 100);

    // Hard timeout: forcibly unlock so we can never get stuck
    setTimeout(() => {
      if (cleaned) return;
      cleanup();
      if (S.bufferHold) {
        S.bufferHold = false;
        if (S.wantsPlay) {
          const vt3 = getVideoTime();
          if (bothCanPlay(vt3)) playBothTogether({ force: true }).catch(() => {});
          else scheduleSync(0);
        }
      }
    }, Math.max(2000, timeoutMs));
  }

  // ─── Sync loop ────────────────────────────────────────────────────────────────
  const SYNC_FAST   = 120;
  const SYNC_PLAY   = 500;
  const SYNC_IDLE   = 1400;

  // Drift thresholds — NO rate changes ever.
  // Only soft-seek (gain → seek → gain) is used.
  const DRIFT_SOFT = 0.15;   // 150 ms — correct if persistent
  const DRIFT_HARD = 1.8;    // 1.8 s  — correct immediately
  const DRIFT_IGNORE = 0.08; // <80 ms — imperceptible, ignore
  const DRIFT_PERSIST = 3;   // cycles before acting on soft drift

  function setFastSync(ms = 1500) {
    S.fastSyncUntil = Math.max(S.fastSyncUntil, now() + ms);
  }
  function getSyncDelay() {
    if (now() < S.fastSyncUntil || S.bufferHold || S.seeking || S.videoWaiting)
      return SYNC_FAST;
    return S.wantsPlay ? SYNC_PLAY : SYNC_IDLE;
  }
  function cancelSyncLoop() {
    if (S.syncTimer) { clearTimeout(S.syncTimer); S.syncTimer = null; }
  }
  function scheduleSync(delay = null) {
    cancelSyncLoop();
    const d = delay !== null ? Math.max(0, delay) : getSyncDelay();
    S.syncTimer = setTimeout(() => { S.syncTimer = null; runSync(); }, d);
  }
  function runSync() {
    if (S.syncActive) { scheduleSync(); return; }
    S.syncActive = true;
    doSync().catch(() => {}).finally(() => { S.syncActive = false; scheduleSync(); });
  }

  async function doSync() {
    if (S.restarting || S.seeking) return;

    const vt     = getVideoTime();
    const hidden = document.visibilityState === "hidden";

    // Track last known good position during normal playback
    if (!isVideoPaused() && isFinite(vt) && vt > 0.1) {
      S.lastKnownVT   = vt;
      S.lastKnownVTts = now();
    }

    // ── Background (Chromium / WebKit): record position, don't issue commands ──
    // The browser throttles background tabs; issuing play/pause makes it worse.
    if (hidden && platform.useBgControllerRetry && S.wantsPlay) {
      if (!S.bgWasPlaying) {
        S.bgWasPlaying  = true;
        S.bgHiddenSince = now();
        S.bgBaseVT      = vt;
        S.bgBaseRate    = getVideoRate();
      }
      return; // Let the browser handle the tab freely while hidden
    }

    // ── Simple (non-coupled) path ──
    if (!coupledMode) {
      if (S.wantsPlay && isVideoPaused())  await execVideoPlay().catch(() => {});
      else if (!S.wantsPlay && !isVideoPaused()) execVideoPause();
      return;
    }

    const at      = isFinite(Number(audio.currentTime)) ? Number(audio.currentTime) : vt;
    const vPaused = isVideoPaused();
    const aPaused = !!audio.paused;
    const vRS     = getVideoReadyState();
    const vWait   = S.videoWaiting || vRS < HAVE_FUTURE_DATA;

    // ── Buffer stall detection ──
    if (S.wantsPlay && !S.bufferHold) {
      if (vWait && S.audioEverStarted) {
        // Video is stalling — gently pause audio so it doesn't race ahead
        if (!aPaused) {
          await rampGain(0, 20);
          execAudioPause();
          doSetAudioTime(vt);
        }
        S.bufferHold = true;
        armBufferResume();
        return;
      }
    }

    // ── Waiting for buffer to fill ──
    if (S.bufferHold) {
      const vt2 = getVideoTime();
      if (bothCanPlay(vt2)) {
        S.bufferHold = false;
        clearBufferResumeTimer();
        if (S.wantsPlay) await playBothTogether({ force: true }).catch(() => {});
      }
      return;
    }

    // ── Not playing ──
    if (!S.wantsPlay) {
      if (!vPaused) execVideoPause();
      if (!aPaused) { await rampGain(0, 18); execAudioPause(); }
      return;
    }

    // ── Should be playing ──

    if (vPaused && aPaused) {
      // Both paused — restart
      if (now() >= S.playGuardUntil && !S.playOpInFlight)
        await playBothTogether().catch(() => {});
      return;
    }

    if (vPaused && !aPaused) {
      // Audio running but video paused — stop audio and retry
      await rampGain(0, 15);
      execAudioPause();
      doSetAudioTime(getVideoTime());
      if (now() >= S.playGuardUntil && !S.playOpInFlight && !vWait)
        await playBothTogether().catch(() => {});
      return;
    }

    if (!vPaused && aPaused) {
      // Video running but audio paused — start audio
      if (now() >= S.playGuardUntil && !S.playOpInFlight) {
        const vtNow = getVideoTime();
        doSetAudioTime(vtNow);
        setGainNow(0);
        const ok = await execAudioPlay();
        if (ok) {
          S.audioEverStarted = true;
          await rampGainToTarget(35);
        }
      }
      return;
    }

    // ── Both playing — drift correction (NO rate changes, soft seek only) ──
    if (!S.softSeekActive && isFinite(vt) && isFinite(at)) {
      const drift    = vt - at;
      const absDrift = Math.abs(drift);

      if (absDrift > DRIFT_HARD) {
        // Large drift: immediate soft seek
        S.driftHistory = [];
        await softSeekAudio(vt);
        setFastSync(800);

      } else if (absDrift > DRIFT_SOFT) {
        // Moderate drift: only act if it persists across multiple sync cycles.
        // This prevents reacting to momentary read jitter.
        S.driftHistory.push(drift);
        if (S.driftHistory.length > DRIFT_PERSIST + 1) S.driftHistory.shift();

        if (S.driftHistory.length >= DRIFT_PERSIST) {
          const sameDir = S.driftHistory.every(d => (d > 0) === (drift > 0));
          const allBig  = S.driftHistory.every(d => Math.abs(d) > DRIFT_SOFT * 0.6);
          if (sameDir && allBig) {
            S.driftHistory = [];
            await softSeekAudio(vt);
            setFastSync(600);
          }
        }

      } else if (absDrift <= DRIFT_IGNORE) {
        // In sync — reset history
        S.driftHistory = [];
      }
      // Between DRIFT_IGNORE and DRIFT_SOFT: do nothing, watch for persistence
    }

    // Gain watchdog (restores audio if it got silenced by a bug)
    ensureGainCorrect();

    // Media session position update
    maybeUpdateMSPosition(vt);

    // Mobile video-stuck repair
    checkVideoStuck(vt);
  }

  // ─── Mobile: detect and repair stuck video ────────────────────────────────────
  function checkVideoStuck(vt) {
    if (!platform.problemMobileBrowser)      return;
    if (!S.wantsPlay || isVideoPaused())     return;
    if (S.videoRepairing || S.seeking)       return;
    if (now() < S.videoRepairCooldown)       return;
    if (getVideoReadyState() < HAVE_FUTURE_DATA) return;

    const elapsed = now() - (S._lastCheckedVTts || 0);
    if (Math.abs(vt - S._lastCheckedVT) < 0.001 && elapsed > 3000) {
      // Video hasn't advanced in 3 s despite buffer being ready — repair
      S.videoRepairing     = true;
      S.videoRepairCooldown = now() + 4000;
      const t = vt;
      setGainNow(0);
      execAudioPause();
      execVideoPause();
      setTimeout(async () => {
        try {
          doSetVideoTime(Math.max(0, t + 0.001));
          await execVideoPlay();
          if (!isVideoPaused()) {
            doSetAudioTime(getVideoTime());
            setGainNow(0);
            const ok = await execAudioPlay();
            if (ok) { S.audioEverStarted = true; await rampGainToTarget(35); }
          }
        } finally { S.videoRepairing = false; }
      }, 80);
    } else if (Math.abs(vt - S._lastCheckedVT) >= 0.001) {
      S._lastCheckedVT  = vt;
      S._lastCheckedVTts = now();
    }
  }

  // ─── Seek finalization ────────────────────────────────────────────────────────
  function scheduleSeekFinalize(delay = 0) {
    if (S.seekFinalizeTimer) { clearTimeout(S.seekFinalizeTimer); S.seekFinalizeTimer = null; }
    S.seekFinalizeTimer = setTimeout(() => {
      S.seekFinalizeTimer = null;
      finalizeSeek().catch(() => {});
    }, delay);
  }

  async function finalizeSeek() {
    if (!S.seeking) return;

    const vEl = getVideoEl();
    const vt  = getVideoTime();

    // Wait for readiness
    const waitReady = (media, ms = 3000) => new Promise(r => {
      let done = false;
      const fin   = ok => { if (done) return; done = true; clearTimeout(to); r(ok); };
      const check = () => { if (Number(media.readyState || 0) >= HAVE_FUTURE_DATA) fin(true); };
      const to    = setTimeout(() => fin(false), ms);
      media.addEventListener("canplay", check, { once: true, passive: true });
      media.addEventListener("seeked",  check, { once: true, passive: true });
      check();
    });

    if (coupledMode) {
      doSetAudioTime(vt);
      await Promise.all([waitReady(vEl, 3500), waitReady(audio, 3500)]);
    } else {
      await waitReady(vEl, 3500);
    }

    if (!S.seeking) return; // was cleared by another event
    S.seeking      = false;
    S.driftHistory = [];

    if (!S.seekWantedPlay || !S.wantsPlay) {
      execVideoPause();
      execAudioPause();
      setGainNow(0);
      scheduleSync(0);
      return;
    }

    const vt2 = getVideoTime();
    if (coupledMode) doSetAudioTime(vt2);
    setGainNow(0);
    await playBothTogether({ force: true }).catch(() => {});
    setFastSync(2000);
    scheduleSync(0);
  }

  // ─── Background resume ────────────────────────────────────────────────────────
  function estimateBgPosition() {
    if (!S.bgHiddenSince) return NaN;
    const elapsed = Math.max(0, (now() - S.bgHiddenSince) / 1000);
    const rate    = S.bgBaseRate > 0 ? S.bgBaseRate : 1;
    return S.bgBaseVT + elapsed * rate;
  }

  async function resumeFromBackground() {
    if (!S.wantsPlay || S.restarting || S.seeking) return;

    const currentVT  = getVideoTime();
    const currentAT  = coupledMode && audio ? Number(audio.currentTime) : NaN;
    const expectedVT = estimateBgPosition();

    // Choose the best resume position.
    // Android media controls often reset currentTime to 0 — detect that and
    // restore to our last-known-good position or the extrapolated bg position.
    let resumeAt = currentVT;
    if (isFinite(expectedVT) && expectedVT > 0.5) {
      const bothReset = currentVT < 0.5 && (!isFinite(currentAT) || currentAT < 0.5);
      if (bothReset) resumeAt = expectedVT;
    }
    if (coupledMode && isFinite(currentAT) && currentAT > currentVT + 0.8) {
      resumeAt = currentAT; // audio kept playing in background
    }
    const dur = getVideoDuration();
    if (dur > 0) resumeAt = Math.min(resumeAt, Math.max(0, dur - 0.25));

    // Seek if position jumped significantly
    const needsSeek =
      Math.abs(resumeAt - currentVT) > 0.8 ||
      (coupledMode && isFinite(currentAT) && Math.abs(resumeAt - currentAT) > 0.8);

    if (needsSeek) {
      setGainNow(0);
      doSetVideoTime(resumeAt);
      if (coupledMode) doSetAudioTime(resumeAt);
      await new Promise(r => setTimeout(r, 50));
    } else if (coupledMode && isFinite(currentAT) && Math.abs(currentAT - currentVT) > 0.15) {
      // Small desync after bg: soft-seek audio
      setGainNow(0);
      doSetAudioTime(currentVT);
      await new Promise(r => setTimeout(r, 14));
    }

    S.bgWasPlaying   = false;
    S.resumeOnVisible = false;
    S.driftHistory   = [];

    await playBothTogether({ force: true }).catch(() => {});
    setFastSync(2000);
    scheduleSync(0);
  }

  // ─── Media Session ────────────────────────────────────────────────────────────
  function updateMSPS() {
    if (!("mediaSession" in navigator)) return;
    try { navigator.mediaSession.playbackState = S.wantsPlay ? "playing" : "paused"; } catch {}
  }
  function maybeUpdateMSPosition(vt) {
    if (!("mediaSession" in navigator) || !navigator.mediaSession.setPositionState) return;
    if (now() < S.mediaPositionNextAt) return;
    S.mediaPositionNextAt = now() + 1000;
    try {
      navigator.mediaSession.setPositionState({
        duration:     getVideoDuration() || 0,
        playbackRate: getVideoRate(),
        position:     Math.max(0, isFinite(vt) ? vt : 0),
      });
    } catch {}
  }

  function setupMediaSession() {
    if (!("mediaSession" in navigator)) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title:   document.title || "Video",
        artist:  typeof authorchannelname !== "undefined" ? authorchannelname : "",
        artwork: vidKey ? [
          { src: `https://i.ytimg.com/vi/${vidKey}/default.jpg`,    sizes: "120x90",   type: "image/jpeg" },
          { src: `https://i.ytimg.com/vi/${vidKey}/mqdefault.jpg`,  sizes: "320x180",  type: "image/jpeg" },
          { src: `https://i.ytimg.com/vi/${vidKey}/hqdefault.jpg`,  sizes: "480x360",  type: "image/jpeg" },
          { src: `https://i.ytimg.com/vi/${vidKey}/maxresdefault.jpg`, sizes: "1280x720", type: "image/jpeg" },
        ] : [],
      });
    } catch {}

    updateMSPS();

    // ── pause / stop ──
    const handleMSPause = () => {
      S.wantsPlay      = false;
      S.userPauseUntil = now() + 3000;
      S.userPlayUntil  = 0;
      S.bufferHold     = false;
      clearBufferResumeTimer();
      cancelSyncLoop();
      pauseBothTogether().catch(() => {});
    };

    // ── play ──
    // Works from lock screen / notification shade / Android media controls.
    const handleMSPlay = () => {
      const serial     = ++S.mediaSessionSerial;
      S.wantsPlay      = true;
      S.userPlayUntil  = now() + 2500;
      S.userPauseUntil = 0;
      S.bgWasPlaying   = false;
      S.resumeOnVisible = false;
      updateMSPS();

      // Restore position if Android reset currentTime to 0
      const cVT = getVideoTime();
      const cAT = coupledMode && audio ? Number(audio.currentTime) : cVT;
      const saved = S.lastKnownVT;
      const needsRestore = saved > 0.5 && cVT < 0.5 && cAT < 0.5;
      if (needsRestore) {
        setGainNow(0);
        doSetVideoTime(saved);
        if (coupledMode) doSetAudioTime(saved);
      } else if (coupledMode && isFinite(cVT) && isFinite(cAT) && Math.abs(cAT - cVT) > 0.5) {
        setGainNow(0);
        doSetAudioTime(cVT);
      }

      setFastSync(2500);

      // Small async gap so seek registers before we try to play
      setTimeout(() => {
        if (serial !== S.mediaSessionSerial || !S.wantsPlay) return;
        playBothTogether({ force: true }).catch(() => {});
        scheduleSync(0);
      }, 20);
    };

    try {
      navigator.mediaSession.setActionHandler("play",  handleMSPlay);
      navigator.mediaSession.setActionHandler("pause", handleMSPause);
      try { navigator.mediaSession.setActionHandler("stop", handleMSPause); } catch {}

      // Seek actions — important on Android (seekbar in notification)
      navigator.mediaSession.setActionHandler("seekforward", d => {
        const inc = Number(d?.seekOffset) || 10;
        const t   = Math.min((getVideoTime() || 0) + inc, getVideoDuration() || 0);
        video.currentTime(t);
      });
      navigator.mediaSession.setActionHandler("seekbackward", d => {
        const dec = Number(d?.seekOffset) || 10;
        const t   = Math.max((getVideoTime() || 0) - dec, 0);
        video.currentTime(t);
      });
      navigator.mediaSession.setActionHandler("seekto", d => {
        if (!d || typeof d.seekTime !== "number") return;
        const t = clamp(d.seekTime, 0, getVideoDuration() || 0);
        video.currentTime(t);
      });
    } catch {}
  }

  // ─── User intent detection (clicks / keyboard) ───────────────────────────────
  function setupUserIntentDetection() {
    const root = video?.el?.() || videoEl || document;

    const isPlayCtrl = el => {
      try { return !!el?.closest?.(".vjs-play-control, .vjs-big-play-button"); }
      catch { return false; }
    };
    const isTechSurface = el => {
      try {
        if (!el) return false;
        if (el.closest?.(".vjs-control-bar, .vjs-menu, .vjs-slider, .vjs-control")) return false;
        return !!el.closest?.(".vjs-tech, video");
      } catch { return false; }
    };
    const isPrimaryActivation = e => {
      try {
        if (e.type === "pointerdown" && e.isPrimary === false) return false;
        if ((e.type === "pointerdown" || e.type === "mousedown") &&
            typeof e.button === "number" && e.button !== 0) return false;
      } catch {}
      return true;
    };

    let pendingTogglePaused = null;

    const onPressStart = e => {
      if (document.visibilityState !== "visible") return;
      if (!isPrimaryActivation(e)) return;
      if (isPlayCtrl(e.target)) {
        pendingTogglePaused = null;
        if (isVideoPaused()) onUserPlay(); else onUserPause();
        return;
      }
      pendingTogglePaused = isTechSurface(e.target) ? isVideoPaused() : null;
    };
    const onClick = e => {
      if (document.visibilityState !== "visible") return;
      if (isPlayCtrl(e.target))   { pendingTogglePaused = null; return; }
      if (!isTechSurface(e.target)){ pendingTogglePaused = null; return; }
      const wasPaused = pendingTogglePaused;
      pendingTogglePaused = null;
      if (typeof wasPaused !== "boolean") return;
      requestAnimationFrame(() => {
        if (wasPaused  && !isVideoPaused()) onUserPlay();
        if (!wasPaused && isVideoPaused())  onUserPause();
      });
    };
    const onKeyDown = e => {
      if (document.visibilityState !== "visible") return;
      const code = e.code || e.key || "";
      if (code === "Space" || code === "KeyK" || code === "MediaPlayPause") {
        if (isVideoPaused()) onUserPlay(); else onUserPause();
      } else if (code === "MediaPause" || code === "MediaStop") {
        onUserPause();
      }
    };

    try {
      if ("PointerEvent" in window)
        root.addEventListener("pointerdown", onPressStart, { capture: true, passive: true });
      else {
        root.addEventListener("mousedown",  onPressStart, { capture: true, passive: true });
        root.addEventListener("touchstart", onPressStart, { capture: true, passive: true });
      }
    } catch {}
    try { root.addEventListener("click",   onClick,   { capture: true, passive: true }); } catch {}
    try { document.addEventListener("keydown", onKeyDown, true); } catch {}
  }

  function onUserPlay() {
    S.wantsPlay      = true;
    S.userPlayUntil  = now() + 2000;
    S.userPauseUntil = 0;
    S.bufferHold     = false;
    updateMSPS();
    setFastSync(2000);
    playBothTogether().catch(() => {});
    scheduleSync(0);
  }
  function onUserPause() {
    S.wantsPlay      = false;
    S.userPauseUntil = now() + 2500;
    S.userPlayUntil  = 0;
    S.bufferHold     = false;
    updateMSPS();
    pauseBothTogether().catch(() => {});
  }

  // ─── Video.js event bindings ──────────────────────────────────────────────────
  function bindVideoEvents() {

    // play
    video.on("play", () => {
      if (S.restarting) return;

      const autoplayGrace = wantsAutoplay() && !S.firstPlayCommitted;

      // Spurious play while user intended pause
      if (!S.wantsPlay && !autoplayGrace && now() < S.userPauseUntil) {
        execVideoPause();
        return;
      }

      if (!S.startupPrimed && coupledMode) {
        maybePrimeStartup();
        if (!S.startupPrimed) { scheduleSync(0); return; }
      }

      if (!S.wantsPlay) S.wantsPlay = true;
      setFastSync(2000);
      updateMSPS();

      if (!S.seeking && !S.bufferHold)
        playBothTogether().catch(() => {});
    });

    // pause
    video.on("pause", () => {
      if (S.restarting) return;
      if (S.seeking)    return; // seeking temporarily pauses video
      if (S.playOpInFlight) return; // we issued play, suppress transient pause

      // Startup autoplay grace
      if (wantsAutoplay() && !S.firstPlayCommitted) {
        maybePrimeStartup();
        scheduleStartupKick();
        return;
      }

      // Background pause on Chromium/WebKit — do NOT treat as user pause
      if (document.visibilityState === "hidden" && platform.useBgControllerRetry && S.wantsPlay) {
        S.resumeOnVisible = true;
        if (!S.bgWasPlaying) {
          S.bgWasPlaying  = true;
          S.bgHiddenSince = now();
          S.bgBaseVT      = getVideoTime();
          S.bgBaseRate    = getVideoRate();
        }
        return;
      }

      // Transient pause during our own fast-sync window
      if (now() < S.fastSyncUntil && S.wantsPlay) return;
      if (now() < S.playGuardUntil && S.wantsPlay) return;

      // A play intent is still active (e.g. autoplay just fired) — retry
      if (S.wantsPlay && now() < S.userPlayUntil) {
        _schedulePlayRetry(120);
        return;
      }

      // Genuine pause
      S.wantsPlay = false;
      pauseBothTogether().catch(() => {});
      updateMSPS();
    });

    // waiting (buffering)
    video.on("waiting", () => {
      S.videoWaiting = true;
      if (!S.wantsPlay || S.restarting) return;
      if (!S.startupPrimed) return;
      // Don't enter bufferHold immediately — let doSync confirm after a cycle
      setFastSync(500);
      scheduleSync(0);
    });

    // playing (resumed from buffer)
    video.on("playing", () => {
      S.videoWaiting = false;
      const vt = getVideoTime();
      if (vt > S.lastKnownVT) { S.lastKnownVT = vt; S.lastKnownVTts = now(); }

      if (!S.wantsPlay && !wantsAutoplay()) { execVideoPause(); return; }
      if (!S.wantsPlay && wantsAutoplay() && !S.firstPlayCommitted) {
        S.wantsPlay = true;
        updateMSPS();
      }

      if (S.bufferHold) { S.bufferHold = false; clearBufferResumeTimer(); }

      setFastSync(1500);
      if (coupledMode && S.wantsPlay && !S.seeking && !S.playOpInFlight)
        playBothTogether().catch(() => {});
      else
        scheduleSync(0);
    });

    // seeking
    video.on("seeking", () => {
      if (S.restarting) return;
      S.seeking        = true;
      S.seekWantedPlay = S.wantsPlay;
      S.bufferHold     = false;
      S.driftHistory   = [];
      clearBufferResumeTimer();
      cancelSyncLoop();

      // Silence and pause both streams during seek (pop-free)
      rampGain(0, 14).then(() => {
        execAudioPause();
        execVideoPause();
        const t = getVideoTime();
        if (isFinite(t)) doSetAudioTime(t);
      });

      setFastSync(2200);
      scheduleSeekFinalize(0);
    });

    // seeked
    video.on("seeked", () => {
      if (S.restarting) return;
      const t = getVideoTime();
      if (isFinite(t)) doSetAudioTime(t);
      S.driftHistory = [];
      scheduleSeekFinalize(0);
    });

    // ended
    video.on("ended", () => {
      if (S.restarting) return;
      if (now() < S.suppressEndedUntil) return;
      if (isLoopDesired()) restartLoop().catch(() => {});
      else {
        S.wantsPlay = false;
        pauseBothTogether().catch(() => {});
        updateMSPS();
      }
    });

    // ratechange — sync audio base rate to video (NOT for drift correction)
    video.on("ratechange", () => {
      if (!coupledMode || !audio) return;
      try {
        const r = getVideoRate();
        if (Math.abs((audio.playbackRate || 1) - r) > 0.005) audio.playbackRate = r;
      } catch {}
    });

    // volumechange
    video.on("volumechange", () => {
      S.userMutedVideo = getVideoMuted();
      const tg = getTargetGain();
      if (!S.wantsPlay || isVideoPaused()) setGainNow(tg);
      else rampGain(tg, 60);
    });
  }

  // ─── Audio element event bindings ─────────────────────────────────────────────
  function bindAudioEvents() {
    if (!coupledMode || !audio) return;

    audio.addEventListener("play", () => {
      if (S.audioPlayInFlight) return; // started by us
      if (!S.wantsPlay || isVideoPaused()) {
        try { audio.pause(); } catch {}
        return;
      }
      S.audioEverStarted = true;
    }, { passive: true });

    audio.addEventListener("pause", () => {
      if (S.audioPlayInFlight) return; // transient during our own play call
      if (!S.wantsPlay) return;
      if (S.seeking || S.restarting || S.softSeekActive) return;
      if (document.visibilityState === "hidden" && platform.useBgControllerRetry) {
        S.resumeOnVisible = true;
        return;
      }
      // Audio paused unexpectedly while video is running → trigger sync
      if (!isVideoPaused() && !S.bufferHold) {
        setFastSync(400);
        scheduleSync(0);
      }
    }, { passive: true });

    audio.addEventListener("ended", () => {
      if (S.restarting) return;
      if (now() < S.suppressEndedUntil) return;
      if (isLoopDesired()) restartLoop().catch(() => {});
      else {
        S.wantsPlay = false;
        pauseBothTogether().catch(() => {});
        updateMSPS();
      }
    }, { passive: true });

    const onAudioReady = () => {
      maybePrimeStartup();
      if (S.bufferHold && S.wantsPlay) scheduleSync(0);
    };
    audio.addEventListener("canplay",        onAudioReady, { passive: true });
    audio.addEventListener("canplaythrough", onAudioReady, { passive: true });
    audio.addEventListener("loadeddata",     onAudioReady, { passive: true });

    audio.addEventListener("volumechange", () => {
      S.userMutedAudio = !!audio.muted;
    }, { passive: true });
  }

  // ─── Video element readiness events ──────────────────────────────────────────
  function bindVideoElEvents() {
    const onReady = () => {
      S.videoWaiting = false;
      maybePrimeStartup();
      if ((S.bufferHold || S.videoWaiting) && S.wantsPlay) scheduleSync(0);
    };
    videoEl.addEventListener("canplay",        onReady, { passive: true });
    videoEl.addEventListener("canplaythrough", onReady, { passive: true });
    videoEl.addEventListener("loadeddata",     onReady, { passive: true });
  }

  // ─── Startup priming ─────────────────────────────────────────────────────────
  function maybePrimeStartup() {
    if (!coupledMode || S.startupPrimed || S.restarting) return;

    const t     = getVideoTime();
    const vEl   = getVideoEl();
    const vReady = Number(vEl.readyState || 0) >= 2 || bufferedAheadSec(vEl, t) > 0;
    const aReady = audioHasAnyData(t);

    if (!vReady || !aReady) { S.bufferHold = true; return; }

    S.startupPrimed = true;
    S.bufferHold    = false;

    // Align audio to video exactly at startup (fixes initial desync)
    const at = isFinite(Number(audio.currentTime)) ? Number(audio.currentTime) : t;
    if (Math.abs(at - t) > 0.05) doSetAudioTime(t);

    scheduleStartupKick();
  }

  function scheduleStartupKick() {
    if (!coupledMode) return;
    if (S.startupKickDone || S.startupKickInFlight) return;
    if (!S.startupPrimed) return;
    if (!wantsAutoplay() && !S.wantsPlay) return;

    S.startupKickInFlight = true;
    setTimeout(async () => {
      try {
        if (!S.startupPrimed) return;
        S.wantsPlay = true;
        updateMSPS();
        setFastSync(2500);
        const ok = await playBothTogether({ force: true });
        if (ok) S.startupKickDone = true;
        else    scheduleStartupRetry(0);
      } finally {
        S.startupKickInFlight = false;
      }
    }, 0);
  }

  function scheduleStartupRetry(count = 0) {
    if (S.startupKickDone || S.startupKickInFlight) return;
    if (count >= 6) return;
    const delays = [350, 750, 1300, 2000, 3000, 4500];
    if (S.startupRetryTimer) clearTimeout(S.startupRetryTimer);
    S.startupRetryTimer = setTimeout(async () => {
      S.startupRetryTimer = null;
      if (S.startupKickDone || S.startupKickInFlight) return;
      if (!S.wantsPlay && !wantsAutoplay()) return;

      maybePrimeStartup();
      if (!S.startupPrimed) { scheduleStartupRetry(count + 1); return; }

      S.startupKickInFlight = true;
      try {
        S.wantsPlay = true;
        updateMSPS();
        setFastSync(2000);
        const ok = await playBothTogether({ force: true });
        if (ok) S.startupKickDone = true;
        else    scheduleStartupRetry(count + 1);
      } finally {
        S.startupKickInFlight = false;
      }
    }, delays[count] || 4500);
  }

  // ─── Loop restart ─────────────────────────────────────────────────────────────
  async function restartLoop() {
    if (S.restarting) return;
    S.restarting = true;
    try {
      cancelSyncLoop();
      clearBufferResumeTimer();
      S.suppressEndedUntil = now() + 1500;
      await rampGain(0, 20);
      execAudioPause();
      execVideoPause();
      setGainNow(0);
      doSetVideoTime(0);
      if (coupledMode) doSetAudioTime(0);
      S.wantsPlay    = true;
      S.bufferHold   = false;
      S.driftHistory = [];
      await new Promise(r => setTimeout(r, 50));
      await playBothTogether({ force: true });
      setFastSync(2000);
      scheduleSync(0);
    } finally {
      S.restarting = false;
    }
  }

  // ─── Visibility lifecycle ─────────────────────────────────────────────────────
  function setupVisibility() {
    try {
      document.addEventListener("freeze", () => {
        if (!platform.useBgControllerRetry || !S.wantsPlay) return;
        S.bgWasPlaying  = true;
        S.bgHiddenSince = now();
        S.bgBaseVT      = getVideoTime();
        S.bgBaseRate    = getVideoRate();
        S.resumeOnVisible = true;
        cancelSyncLoop();
      }, { passive: true, capture: true });

      document.addEventListener("resume", () => {
        if (!platform.useBgControllerRetry) return;
        if (document.visibilityState === "visible" && S.wantsPlay)
          resumeFromBackground().catch(() => {});
      }, { passive: true, capture: true });

      window.addEventListener("pageshow", e => {
        if (!platform.useBgControllerRetry) return;
        if (e?.persisted && S.wantsPlay) resumeFromBackground().catch(() => {});
      }, { passive: true, capture: true });
    } catch {}

    window.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        // ── Returning to tab ──
        if (S.wantsPlay) {
          if (platform.useBgControllerRetry && (S.bgWasPlaying || S.resumeOnVisible)) {
            resumeFromBackground().catch(() => {});
          } else {
            S.resumeOnVisible = false;
            setFastSync(800);
            scheduleSync(0);
          }
        }
      } else {
        // ── Going to background ──
        // Save position immediately
        S.lastKnownVT   = getVideoTime();
        S.lastKnownVTts = now();

        if (platform.useBgControllerRetry && S.wantsPlay) {
          // Do NOT pause — just record the entry state.
          // The sync loop gates on visibility so no commands will be issued.
          S.bgWasPlaying   = true;
          S.bgHiddenSince  = now();
          S.bgBaseVT       = S.lastKnownVT;
          S.bgBaseRate     = getVideoRate();
          S.resumeOnVisible = true;
        }

        if (S.bgRetryTimer) { clearTimeout(S.bgRetryTimer); S.bgRetryTimer = null; }
      }
    }, { passive: true, capture: true });

    window.addEventListener("beforeunload", () => {
      cancelSyncLoop();
      clearBufferResumeTimer();
      if (S.seekFinalizeTimer) { clearTimeout(S.seekFinalizeTimer); S.seekFinalizeTimer = null; }
      if (S.startupRetryTimer){ clearTimeout(S.startupRetryTimer); S.startupRetryTimer = null; }
      if (S.bgRetryTimer)     { clearTimeout(S.bgRetryTimer);      S.bgRetryTimer = null; }
    });
  }

  // ─── Wire everything up ───────────────────────────────────────────────────────
  setupUserIntentDetection();
  setupMediaSession();
  bindVideoEvents();
  bindAudioEvents();
  bindVideoElEvents();
  setupVisibility();

  if (coupledMode && audio) {
    try { audio.preload = "auto"; audio.load(); } catch {}

    // Startup primers: fire maybePrimeStartup as soon as either stream has data
    const bindStartupOnce = (el, type) => {
      const fn = () => {
        maybePrimeStartup();
        if (S.startupPrimed) try { el.removeEventListener(type, fn); } catch {}
      };
      try { el.addEventListener(type, fn, { passive: true }); } catch {}
    };
    ["loadeddata", "loadedmetadata", "canplay"].forEach(t => {
      bindStartupOnce(audio,   t);
      bindStartupOnce(videoEl, t);
    });
  }

  // Kick the sync loop
  scheduleSync(0);
}); 
document.addEventListener('keydown', function(event) {
     const active = document.activeElement;
    if (active && (active.tagName.toLowerCase() === 'input' || active.tagName.toLowerCase() === 'textarea')) {
        return;
    }

    if (event.ctrlKey || event.shiftKey || event.altKey || event.metaKey) {
        return;
    }

    const videoElement = document.querySelector('.video-js');
    if (!videoElement) return;
    const player = videojs(videoElement);

    switch (event.key.toLowerCase()) {
        case 'f':
            if (!player.isFullscreen()) {
                player.requestFullscreen();
            } else {
                player.exitFullscreen();
            }
            break;
        case ' ':
        case 'k':
            event.preventDefault();
            if (player.paused()) {
                player.play();
            } else {
                player.pause();
            }
            break;
        case 'm':
            player.muted(!player.muted());
            break;
        case 'arrowright':
        case 'l':
            player.currentTime(player.currentTime() + 10);
            break;
        case 'arrowleft':
        case 'j':
            player.currentTime(player.currentTime() - 10);
            break;
        case 'arrowup':
            event.preventDefault();
            player.volume(Math.min(1, player.volume() + 0.1));
            break;
        case 'arrowdown':
            event.preventDefault();
            player.volume(Math.max(0, player.volume() - 0.1));
            break;
    }
});

 // https://codeberg.org/ashleyirispuppy/poke/src/branch/main/src/libpoketube/libpoketube-youtubei-objects.json


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
  ANDROID_USER_AGENT:  "com.google.android.youtube/20.20.41 (Linux; U; Android 16; en_US; SM-S908E Build/TP1A.220624.014) gzip",
  ANDROID_SDK_VERSION: 36,
  ANDROID_VERSION: "16",

  ANDROID_TS_APP_VERSION: "1.9",
  ANDROID_TS_USER_AGENT:
    "com.google.android.youtube/1.9 (Linux; U; Android 1; US) gzip",

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
      version: "2.20250909.02.00",
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
const hey = " please dont use the above player base stuff!! tyyyyyyyy <3 "
const youtubeobjects = "https://codeberg.org/ashleyirispuppy/poke/raw/branch/main/src/libpoketube/libpoketube-youtubei-objects.json"
const watchURl = "https://youtube.com/watch"
const base_player = "https://www.youtube.com/s/player/0004de42/player_ias.vflset/en_US/base.js";
const base_player_poketube = "https://poketube.fun/s/player/0004de42/player_ias.vflset/en_US/base.js";

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
 const customVideoJsUI = document.createElement("style");
customVideoJsUI.innerHTML = `
 

:root{
  /* Brand */
  --poke-accent-1: #ff0045;
  --poke-accent-2: #ff0e55;
  --poke-accent-3: #ff1d79;

   --glass-bg: rgba(20, 20, 20, 0.38);
  --glass-bg-hover: rgba(20, 20, 20, 0.46);
  --glass-border: rgba(255, 255, 255, 0.22);
  --glass-border-strong: rgba(255, 255, 255, 0.30);
  --glass-shadow: 0 10px 30px rgba(0,0,0,0.32), inset 0 0 0 1px rgba(255,255,255,0.10);

   --scene-contrast-wash: rgba(0,0,0,0.10);

  /* Text */
  --ui-text: rgba(255,255,255,0.96);
  --ui-text-soft: rgba(255,255,255,0.86);
  --ui-text-shadow: 0 1px 2px rgba(0,0,0,0.65);
  --ui-text-outline: 0 0 1px rgba(0,0,0,0.70);

  /* Radii */
  --r-outer: 16px;
  --r-pill: 999px;
  --r-bubble: 1em;

  /* Sizes */
  --btn: 38px;
  --btn-mobile: 34px;
  --bar-bottom: 12px;
  --bar-bottom-mobile: 10px;
}

/* Keep the whole player rounded */
.video-js,
.video-js .vjs-tech,
.video-js .vjs-poster,
.video-js .vjs-poster img{
  border-radius: var(--r-outer) !important;
}

/* Title bar container */
.vjs-title-bar{
  background: none !important;
  border-radius: var(--r-outer);
  overflow: hidden;
}

/* Title text readability on bright frames */
.vjs-title-bar-title{
  font-family: "PokeTube Flex", sans-serif !important;
  font-stretch: ultra-expanded;
  font-weight: 1000;
  font-size: 1.5em;
  color: var(--ui-text) !important;
  text-shadow: var(--ui-text-shadow);
  -webkit-text-stroke: 0.35px rgba(0,0,0,0.35);
}

/* Description bubble: more readable on white frames */
.vjs-title-bar-description{
  width: fit-content;
  border-radius: var(--r-bubble);
  padding: 1em;

  font-family: "PokeTube Flex", "poketube flex", sans-serif;
  font-weight: 600;
  font-stretch: semi-expanded;

  color: var(--ui-text);
  text-shadow: var(--ui-text-shadow);
  filter: drop-shadow(0 8px 22px rgba(0,0,0,0.25));

  /* layered glass + wash for bright scenes */
  background:
    linear-gradient(180deg, rgba(255,255,255,0.12), rgba(255,255,255,0.06)),
    linear-gradient(180deg, var(--scene-contrast-wash), var(--scene-contrast-wash)),
    var(--glass-bg);
  border: 1px solid var(--glass-border);
  -webkit-backdrop-filter: blur(14px) saturate(170%);
  backdrop-filter: blur(14px) saturate(170%);
}

/* Control bar placement */
.video-js .vjs-control-bar{
  bottom: var(--bar-bottom) !important;
}

/* Control bar glass container */
.vjs-control-bar{
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  display: flex !important;
  align-items: center !important;

  gap: 2px;
  padding: 6px 10px;
  border-radius: var(--r-outer);

  /* A faint wash behind the whole bar to survive white frames */
  background:
    linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0.05)),
    linear-gradient(180deg, var(--scene-contrast-wash), var(--scene-contrast-wash)) !important;

  -webkit-backdrop-filter: blur(12px) saturate(160%);
  backdrop-filter: blur(12px) saturate(160%);
  border: 1px solid rgba(255,255,255,0.12) !important;
  box-shadow: 0 12px 34px rgba(0,0,0,0.26) !important;
}

/* Buttons */
.vjs-control-bar .vjs-button{
  width: var(--btn);
  height: var(--btn);
  min-width: var(--btn);
  border-radius: 50%;

  /* Slightly darker glass base so it reads on white frames */
  background:
    linear-gradient(180deg, rgba(255,255,255,0.18), rgba(255,255,255,0.08)),
    linear-gradient(180deg, var(--scene-contrast-wash), var(--scene-contrast-wash)),
    var(--glass-bg);

  -webkit-backdrop-filter: blur(12px) saturate(160%);
  backdrop-filter: blur(12px) saturate(160%);

  border: 1px solid var(--glass-border);
  box-shadow: var(--glass-shadow);

  display: inline-flex;
  align-items: center;
  justify-content: center;

  margin: 0 6px;
  transition: transform 0.12s ease, box-shadow 0.2s ease, background 0.2s ease, border-color 0.2s ease;
  vertical-align: middle;
}

.vjs-control-bar .vjs-button:hover{
  background:
    linear-gradient(180deg, rgba(255,255,255,0.24), rgba(255,255,255,0.12)),
    linear-gradient(180deg, rgba(0,0,0,0.12), rgba(0,0,0,0.12)),
    var(--glass-bg-hover);

  border-color: var(--glass-border-strong);
  box-shadow: 0 12px 32px rgba(0,0,0,0.36), inset 0 0 0 1px rgba(255,255,255,0.16);
  transform: translateY(-1px);
}

.vjs-control-bar .vjs-button:active{
  transform: translateY(0);
}

.vjs-control-bar .vjs-button:focus-visible{
  outline: none;
  box-shadow:
    0 0 0 3px rgba(255,0,90,0.35),
    inset 0 0 0 1px rgba(255,255,255,0.20),
    0 12px 34px rgba(0,0,0,0.32);
  border-color: rgba(255,255,255,0.30);
}

/* Icons: keep them readable on white frames */
.vjs-control-bar .vjs-icon-placeholder:before{
  font-size: 18px;
  line-height: var(--btn);
  color: var(--ui-text);
  text-shadow: var(--ui-text-shadow);
  filter: drop-shadow(var(--ui-text-outline));
}

/* Time text pills */
.vjs-current-time,
.vjs-duration,
.vjs-remaining-time,
.vjs-time-divider{
  background: transparent;
  padding: 0 8px;
  border-radius: var(--r-pill);
  box-shadow: none;
  margin: 0;

  height: var(--btn);
  line-height: 1;

  display: inline-flex;
  align-items: center;

  color: var(--ui-text-soft) !important;
  text-shadow: var(--ui-text-shadow);
}

/* Ensure remaining time / fullscreen control doesn't add its own background */
.vjs-fullscreen-control,
.vjs-remaining-time{
  background-color: transparent !important;
}

/* Progress control layout */
.vjs-progress-control{
  flex: 1 1 auto;
  display: flex !important;
  align-items: center !important;
  margin: 0 6px;
  padding: 0;
  height: var(--btn);
}

/* Progress bar glass track */
.vjs-progress-control .vjs-progress-holder{
  height: 8px !important;
  border-radius: var(--r-pill) !important;
  background: transparent !important;
  border: none;
  box-shadow: none;
  position: relative;
  margin: 0;
  width: 100%;
  overflow: hidden;
}

/* Track surface (stronger contrast for white scenes) */
.vjs-progress-control .vjs-progress-holder::before{
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;

  background:
    linear-gradient(180deg, rgba(255,255,255,0.18), rgba(255,255,255,0.08)),
    linear-gradient(180deg, rgba(0,0,0,0.14), rgba(0,0,0,0.14)),
    rgba(20,20,20,0.34);

  -webkit-backdrop-filter: blur(12px) saturate(160%);
  backdrop-filter: blur(12px) saturate(160%);

  border: 1px solid rgba(255,255,255,0.18);
  box-shadow: 0 8px 24px rgba(0,0,0,0.25), inset 0 0 0 1px rgba(255,255,255,0.10);
  pointer-events: none;
}

/* Load + play layers */
.vjs-progress-control .vjs-load-progress,
.vjs-progress-control .vjs-play-progress{
  position: relative;
  z-index: 1;
  border-radius: inherit !important;
}

.vjs-progress-control .vjs-play-progress,
.vjs-play-progress{
  background-image: linear-gradient(to right, var(--poke-accent-1), var(--poke-accent-2), var(--poke-accent-3)) !important;
}

/* Scrubber handle */
.vjs-progress-control .vjs-slider-handle{
  width: 14px !important;
  height: 14px !important;
  border-radius: 50% !important;

  background: rgba(255,255,255,0.95) !important;
  border: 1px solid rgba(255,255,255,0.95);

  box-shadow:
    0 8px 20px rgba(0,0,0,0.35),
    0 0 0 3px rgba(255,0,90,0.22);

  top: -4px !important;
  z-index: 2;
}

/* Volume panel */
.vjs-volume-panel{
  gap: 8px;
  align-items: center !important;
  padding: 0;
  height: var(--btn);
}

/* Volume track: make it readable on white frames too */
.vjs-volume-bar{
  height: 6px !important;
  border-radius: var(--r-pill) !important;
  background:
    linear-gradient(180deg, rgba(255,255,255,0.14), rgba(255,255,255,0.06)),
    linear-gradient(180deg, rgba(0,0,0,0.18), rgba(0,0,0,0.18)),
    rgba(18,18,18,0.40) !important;

  border: 1px solid rgba(255,255,255,0.16);
  box-shadow: 0 8px 20px rgba(0,0,0,0.20);
  position: relative;
  overflow: hidden;
}

.vjs-volume-level{
  border-radius: inherit !important;
  background-image: linear-gradient(to right, var(--poke-accent-1), var(--poke-accent-3)) !important;
}

.vjs-volume-bar .vjs-slider-handle{
  width: 12px !important;
  height: 12px !important;
  border-radius: 50% !important;

  background: rgba(255,255,255,0.95) !important;
  border: 1px solid rgba(255,255,255,0.95);

  top: -3px !important;

  box-shadow:
    0 6px 16px rgba(0,0,0,0.28),
    0 0 0 3px rgba(255,0,90,0.20);
}

/* Mobile tweaks */
@media (max-width: 640px){
  .video-js .vjs-control-bar{
    bottom: var(--bar-bottom-mobile) !important;
  }

  .vjs-control-bar{
    gap: 8px;
    padding: 6px 8px;
  }

  .vjs-control-bar .vjs-button{
    width: var(--btn-mobile);
    height: var(--btn-mobile);
    min-width: var(--btn-mobile);
  }

  .vjs-control-bar .vjs-icon-placeholder:before{
    font-size: 16px;
    line-height: var(--btn-mobile);
  }

  .vjs-current-time,
  .vjs-duration,
  .vjs-remaining-time,
  .vjs-time-divider{
    height: var(--btn-mobile);
  }

  .vjs-progress-control{
    height: var(--btn-mobile);
  }

  .vjs-progress-control .vjs-slider-handle{
    width: 12px !important;
    height: 12px !important;
    top: -3px !important;
  }
}

/* If backdrop-filter isn't supported, fall back to solid-ish surfaces */
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))){
  .vjs-control-bar,
  .vjs-control-bar .vjs-button,
  .vjs-title-bar-description,
  .vjs-progress-control .vjs-progress-holder::before,
  .vjs-volume-bar{
    -webkit-backdrop-filter: none !important;
    backdrop-filter: none !important;
    background: rgba(18,18,18,0.72) !important;
    border-color: rgba(255,255,255,0.18) !important;
  }
}
`;
document.head.appendChild(customVideoJsUI);


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
	styles.textContent = `
	.vjs-control-bar {
		z-index: 21;
	}
	`;
	document.body.append(styles);
}