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
  const video = videojs("video", {
    controls: true,
    autoplay: true,
    preload: "auto",
    errorDisplay: false
  });
  const qs = new URLSearchParams(window.location.search);
  const qua = qs.get("quality") || "";
  const vidKey = qs.get("v") || "";
  const videoEl = document.getElementById("video");
  const audio = document.getElementById("aud");

  try {
    videoEl.setAttribute("playsinline", "");
    videoEl.setAttribute("webkit-playsinline", "");
  } catch {}

  // ─── Audio context for pop-free fading ───────────────────────────────────
  let audioCtx = null;
  let gainNode = null;
  let audioSourceNode = null;
  let audioContextConnected = false;

  function ensureAudioContext() {
    if (!audio || audioCtx) return;
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      gainNode = audioCtx.createGain();
      gainNode.connect(audioCtx.destination);
    } catch {
      audioCtx = null;
      gainNode = null;
    }
  }

  function connectAudioToContext() {
    if (!audioCtx || !gainNode || !audio || audioContextConnected) return;
    try {
      audioSourceNode = audioCtx.createMediaElementSource(audio);
      audioSourceNode.connect(gainNode);
      audioContextConnected = true;
    } catch {
      audioContextConnected = false;
    }
  }

  // Smooth gain change to prevent pops. duration in seconds.
  function rampGain(targetValue, durationSec = 0.04) {
    if (!gainNode || !audioCtx) {
      // fallback: direct volume
      if (audio) try { audio.volume = Math.max(0, Math.min(1, targetValue)); } catch {}
      return;
    }
    try {
      const t = audioCtx.currentTime;
      gainNode.gain.cancelScheduledValues(t);
      gainNode.gain.setValueAtTime(gainNode.gain.value, t);
      gainNode.gain.linearRampToValueAtTime(Math.max(0, Math.min(1, targetValue)), t + durationSec);
    } catch {
      if (audio) try { audio.volume = Math.max(0, Math.min(1, targetValue)); } catch {}
    }
  }

  function resumeAudioContext() {
    if (!audioCtx) return;
    try {
      if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
    } catch {}
  }

  // ─── Platform detection ───────────────────────────────────────────────────
  const platform = (() => {
    try {
      const isFirefox = (() => {
        try { return CSS.supports("-moz-orient", "horizontal"); } catch { return false; }
      })();
      const isChromium = (() => {
        if (isFirefox) return false;
        try {
          const hasChrome = typeof window.chrome !== "undefined" && window.chrome !== null;
          const hasChromeCSS = CSS.supports("overflow", "overlay");
          return hasChrome && hasChromeCSS;
        } catch { return false; }
      })();
      const isIosWebKit = (() => {
        if (isFirefox) return false;
        try {
          return typeof GestureEvent !== "undefined" && navigator.maxTouchPoints > 1;
        } catch { return false; }
      })();
      const mobile = (() => {
        try {
          if (typeof navigator.userAgentData?.mobile === "boolean") return navigator.userAgentData.mobile;
        } catch {}
        try { return navigator.maxTouchPoints > 0 && window.matchMedia("(pointer: coarse)").matches; } catch {}
        return false;
      })();
      const chromiumOnlyBrowser = isChromium;
      const problemMobileBrowser = (isChromium && mobile) || isIosWebKit;
      const useBgControllerRetry = !isFirefox && (isChromium || isIosWebKit);
      return {
        mobile: !!mobile, ios: !!isIosWebKit,
        android: !!(isChromium && mobile && !isIosWebKit),
        isFirefox: !!isFirefox, isChromium: !!isChromium,
        androidChromium: !!(isChromium && mobile && !isIosWebKit),
        iosWebKitLike: !!isIosWebKit,
        problemMobileBrowser: !!problemMobileBrowser,
        desktopChromiumLike: !!(isChromium && !mobile),
        chromiumOnlyBrowser: !!chromiumOnlyBrowser,
        useBgControllerRetry: !!useBgControllerRetry
      };
    } catch {
      return {
        mobile: false, ios: false, android: false, isFirefox: false,
        isChromium: false, androidChromium: false, iosWebKitLike: false,
        problemMobileBrowser: false, desktopChromiumLike: false,
        chromiumOnlyBrowser: false, useBgControllerRetry: false
      };
    }
  })();

  // ─── Inner video element helpers ──────────────────────────────────────────
  let cachedInnerVideoEl = null;
  function getPlayableVideoEl() {
    try { if (videoEl && typeof videoEl.play === "function") return videoEl; } catch {}
    try {
      if (cachedInnerVideoEl && typeof cachedInnerVideoEl.play === "function") return cachedInnerVideoEl;
      const inner = video?.el?.()?.querySelector?.("video");
      if (inner && typeof inner.play === "function") { cachedInnerVideoEl = inner; return inner; }
    } catch {}
    return null;
  }
  function getVideoNode() { return getPlayableVideoEl() || videoEl; }
  function getVideoPaused() {
    try { if (typeof video.paused === "function") return !!video.paused(); } catch {}
    try { return !!getVideoNode().paused; } catch {}
    return true;
  }
  function getVideoReadyState() {
    try { return Number(getVideoNode().readyState || 0); } catch {}
    return 0;
  }

  // ─── Audio source / mode setup ────────────────────────────────────────────
  const pickAudioSrc = () => {
    const s = audio?.getAttribute?.("src");
    if (s) return s;
    const child = audio?.querySelector?.("source");
    if (child?.getAttribute?.("src")) return child.getAttribute("src");
    if (audio?.currentSrc) return audio.currentSrc;
    return null;
  };
  const hasExternalAudio = !!audio && audio.tagName === "AUDIO" && !!pickAudioSrc();
  const coupledMode = hasExternalAudio && qua !== "medium";

  try { videoEl.loop = false; videoEl.removeAttribute?.("loop"); } catch {}
  try { if (audio) { audio.loop = false; audio.removeAttribute?.("loop"); } } catch {}

  function isLoopDesired() {
    return !!videoEl.loop || videoEl.hasAttribute("loop") ||
      qs.get("loop") === "1" || qs.get("loop") === "true" || window.forceLoop === true;
  }

  // ─── Constants ────────────────────────────────────────────────────────────
  const EPS = 1.0;
  const HAVE_FUTURE_DATA = 3;
  const HAVE_ENOUGH_DATA = 4;
  const STRICT_BUFFER_AHEAD_SEC = 0.18;
  const STARTUP_BUFFER_AHEAD_SEC = 0.9;
  // Sync thresholds — never adjust playback rate, use time-nudge instead
  const SNAP_DRIFT = 0.5;      // hard snap if drift > this
  const CORRECT_DRIFT = 0.12;  // soft-correct drift if > this
  const BIG_DRIFT = 1.5;
  const BG_SILENT_SNAP_THRESHOLD = 0.5;
  // How many consecutive sync cycles drift must be present before we correct
  const DRIFT_PERSIST_CYCLES = 4;

  const clamp01 = v => Math.max(0, Math.min(1, Number(v)));
  function now() { return performance.now(); }

  // ─── State ────────────────────────────────────────────────────────────────
  const state = {
    intendedPlaying: false,
    restarting: false,
    syncing: false,
    seeking: false,
    seekWantedPlaying: false,
    startupPhase: true,
    startupPrimed: !coupledMode,
    startupKickDone: false,
    startupKickInFlight: false,
    firstPlayCommitted: false,
    firstSeekDone: false,
    audioEverStarted: false,
    userMutedVideo: false,
    userMutedAudio: false,
    strictBufferHold: false,
    strictBufferReason: "",
    strictBufferHoldFrames: 0,
    videoWaiting: false,
    suppressEndedUntil: 0,
    isProgrammaticVideoPlay: false,
    isProgrammaticVideoPause: false,
    isProgrammaticAudioPlay: false,
    isProgrammaticAudioPause: false,
    audioEventsSquelchedUntil: 0,
    audioPlayInFlight: null,
    audioPlayUntil: 0,
    audioPauseUntil: 0,
    startupAudioHoldUntil: 0,
    userPauseUntil: 0,
    userPauseLockUntil: 0,
    userPlayUntil: 0,
    mediaForcedPauseUntil: 0,
    pauseEventGuardUntil: 0,
    mediaPlayTxnUntil: 0,
    mediaPauseTxnUntil: 0,
    mediaLockUntil: 0,
    hiddenMediaPlayUntil: 0,
    chromiumAudioStartLockUntil: 0,
    chromiumPauseGuardUntil: 0,
    chromiumBgSettlingUntil: 0,
    lastMediaAction: "",
    lastMediaActionTs: 0,
    syncTimer: null,
    syncScheduledAt: 0,
    fastSyncUntil: 0,
    bgResumeRetryTimer: null,
    resumeAfterBufferTimer: null,
    mediaSessionActionSerial: 0,
    mediaPositionNextAt: 0,
    bgHiddenSince: 0,
    bgHiddenBaseVT: 0,
    bgHiddenBaseAT: 0,
    bgHiddenBaseRate: 1,
    bgHiddenWasPlaying: false,
    resumeOnVisible: false,
    bgAutoResumeSuppressed: false,
    bgCatchUpToken: 0,
    bgCatchUpCooldownUntil: 0,
    seekFinalizeTimer: null,
    lastAT: 0,
    audioLastProgressTs: 0,
    lastVT: 0,
    lastVTts: 0,
    audioKickCooldownUntil: 0,
    videoRepairing: false,
    videoRepairCooldownUntil: 0,
    hardPauseVerifySerial: 0,
    startupPrimeStartedAt: performance.now(),
    silentBgSync: false,
    lastKnownGoodVT: 0,
    lastKnownGoodVTts: 0,
    startupAutoplayRetryTimer: null,
    startupAutoplayRetryCount: 0,
    // Drift tracking — NO rate adjustments, only time-nudge
    driftStableFrames: 0,
    lastDrift: 0,
    bgTransitionInProgress: false,
    // For startup desync prevention: track if audio was aligned at start
    startupAudioAligned: false,
    // Loop-breaker: track last corrective action timestamp to prevent feedback
    lastCorrectiveActionTs: 0,
    inPlayPauseLoop: false,
    playPauseLoopCount: 0,
    playPauseLoopResetTimer: null,
  };

  // ─── Title bar (fullscreen) ───────────────────────────────────────────────
  video.ready(() => {
    const metaTitle = document.querySelector('meta[name="title"]')?.content || "";
    const metaDesc = document.querySelector('meta[name="twitter:description"]')?.content || "";
    let stats = "";
    const match = metaDesc.match(/👍\s*[^|]+\|\s*👎\s*[^|]+\|\s*📈\s*[^💬]+/);
    if (match) {
      stats = match[0]
        .replace(/👍/g, "👍").replace(/👎/g, "• 👎")
        .replace(/📈/g, "• 📈").replace(/\s*\|\s*/g, "   ");
    }
    const createTitleBar = () => {
      const existing = video.getChild("TitleBar");
      if (!existing) {
        const titleBar = video.addChild("TitleBar");
        titleBar.update({ title: metaTitle, description: stats });
      }
    };
    const removeTitleBar = () => {
      const existing = video.getChild("TitleBar");
      if (existing) video.removeChild(existing);
    };
    const onFullscreenChange = () => {
      const fs = document.fullscreenElement || document.webkitFullscreenElement;
      if (fs) createTitleBar(); else removeTitleBar();
    };
    document.addEventListener("fullscreenchange", onFullscreenChange, { passive: true });
    document.addEventListener("webkitfullscreenchange", onFullscreenChange, { passive: true });
    onFullscreenChange();
  });

  // ─── Timing helpers ───────────────────────────────────────────────────────
  function markMediaAction(type) { state.lastMediaAction = type; state.lastMediaActionTs = now(); }
  function mediaActionRecently(type, ms = 1200) {
    return state.lastMediaAction === type && (now() - state.lastMediaActionTs) < ms;
  }
  function setFastSync(ms = 1200) {
    state.fastSyncUntil = Math.max(state.fastSyncUntil, now() + Math.max(0, Number(ms) || 0));
    scheduleSync(0);
  }
  function fastSyncActive() { return now() < state.fastSyncUntil; }
  function setPauseEventGuard(ms = 1000) {
    state.pauseEventGuardUntil = Math.max(state.pauseEventGuardUntil, now() + Math.max(0, Number(ms) || 0));
  }
  function shouldIgnorePauseEvents() { return now() < state.pauseEventGuardUntil; }
  function setMediaPlayTxn(ms = 1400) {
    state.mediaPlayTxnUntil = Math.max(state.mediaPlayTxnUntil, now() + Math.max(0, Number(ms) || 0));
    state.mediaLockUntil = Math.max(state.mediaLockUntil, now() + Math.min(ms, 900));
  }
  function setMediaPauseTxn(ms = 1000) {
    state.mediaPauseTxnUntil = Math.max(state.mediaPauseTxnUntil, now() + Math.max(0, Number(ms) || 0));
    state.mediaLockUntil = Math.max(state.mediaLockUntil, now() + Math.min(ms, 800));
  }
  function mediaPlayTxnActive() { return now() < state.mediaPlayTxnUntil; }
  function mediaPauseTxnActive() { return now() < state.mediaPauseTxnUntil; }
  function mediaActionLocked() { return now() < state.mediaLockUntil; }
  function inMediaTxnWindow() { return mediaActionLocked() || mediaPlayTxnActive() || mediaPauseTxnActive(); }
  function setMediaSessionForcedPause(ms = 2600) {
    state.mediaForcedPauseUntil = Math.max(state.mediaForcedPauseUntil, now() + Math.max(0, Number(ms) || 0));
  }
  function clearMediaSessionForcedPause() { state.mediaForcedPauseUntil = 0; }
  function mediaSessionForcedPauseActive() { return now() < state.mediaForcedPauseUntil; }

  function markUserPauseIntent(ms = 1800) {
    const until = now() + Math.max(0, Number(ms) || 0);
    state.userPauseUntil = Math.max(state.userPauseUntil, until);
    state.userPauseLockUntil = Math.max(state.userPauseLockUntil, until + 300);
    state.userPlayUntil = 0;
    state.intendedPlaying = false;
    updateMediaSessionPlaybackState();
    if (platform.chromiumOnlyBrowser) {
      state.chromiumPauseGuardUntil = Math.max(state.chromiumPauseGuardUntil, until + 250);
      state.chromiumAudioStartLockUntil = Math.max(state.chromiumAudioStartLockUntil, until + 450);
      state.chromiumBgSettlingUntil = Math.max(state.chromiumBgSettlingUntil, until + 200);
    }
  }
  function markUserPlayIntent(ms = 1800) {
    const until = now() + Math.max(0, Number(ms) || 0);
    state.userPlayUntil = Math.max(state.userPlayUntil, until);
    state.userPauseUntil = 0;
    state.userPauseLockUntil = 0;
    clearMediaSessionForcedPause();
    state.intendedPlaying = true;
    markMediaAction("play");
    setFastSync(1800);
    updateMediaSessionPlaybackState();
    state.audioPauseUntil = 0;
    state.audioPlayUntil = 0;
    state.startupAudioHoldUntil = 0;
    if (platform.chromiumOnlyBrowser) {
      state.chromiumPauseGuardUntil = 0;
      state.chromiumBgSettlingUntil = 0;
      state.chromiumAudioStartLockUntil = Math.max(state.chromiumAudioStartLockUntil, now() + 120);
    }
  }
  function userPauseIntentActive() { return now() < state.userPauseUntil; }
  function userPauseLockActive() { return now() < state.userPauseLockUntil; }
  function userPlayIntentActive() { return now() < state.userPlayUntil; }
  function setHiddenMediaSessionPlay(ms = 5000) {
    if (!platform.chromiumOnlyBrowser) return;
    state.hiddenMediaPlayUntil = Math.max(state.hiddenMediaPlayUntil, now() + Math.max(0, Number(ms) || 0));
  }
  function hiddenMediaSessionPlayActive() {
    return platform.chromiumOnlyBrowser && now() < state.hiddenMediaPlayUntil;
  }
  function clearHiddenMediaSessionPlay() { state.hiddenMediaPlayUntil = 0; }
  function chromiumPauseGuardActive() {
    return platform.chromiumOnlyBrowser && !state.silentBgSync && now() < state.chromiumPauseGuardUntil;
  }
  function chromiumAudioStartLocked() {
    return platform.chromiumOnlyBrowser && !state.silentBgSync && now() < state.chromiumAudioStartLockUntil;
  }
  function chromiumBgSettlingActive() {
    return platform.chromiumOnlyBrowser && now() < state.chromiumBgSettlingUntil;
  }
  function setStartupAudioHold(ms = 450) {
    state.startupAudioHoldUntil = Math.max(state.startupAudioHoldUntil, now() + Math.max(0, Number(ms) || 0));
  }
  function startupAudioHoldActive() { return now() < state.startupAudioHoldUntil; }
  function squelchAudioEvents(ms = 450) {
    state.audioEventsSquelchedUntil = now() + Math.max(0, Number(ms) || 0);
  }
  function audioEventsSquelched() { return now() < state.audioEventsSquelchedUntil; }
  function shouldTreatVisiblePauseAsUserPause() {
    return document.visibilityState === "visible" && (userPauseIntentActive() || userPauseLockActive());
  }
  function shouldIgnorePauseAsTransient() {
    if (mediaSessionForcedPauseActive()) return false;
    if (shouldTreatVisiblePauseAsUserPause()) return false;
    if (state.silentBgSync) return true;
    const hidden = document.visibilityState === "hidden";
    if (!hidden) {
      if (fastSyncActive()) return true;
      if (state.isProgrammaticVideoPlay || state.isProgrammaticAudioPlay) return true;
      if (now() < state.audioPlayUntil) return true;
      if (mediaActionRecently("play", 260)) return true;
      return false;
    }
    if (inMediaTxnWindow()) return true;
    if (now() < state.audioPlayUntil) return true;
    if (mediaActionRecently("play", 2200)) return true;
    if (shouldIgnorePauseEvents()) return true;
    return false;
  }

  // ─── Loop-break detection ─────────────────────────────────────────────────
  // Prevents rapid play/pause feedback loops that can lock up playback.
  function recordCorrectiveAction() {
    const t = now();
    if (t - state.lastCorrectiveActionTs < 400) {
      state.playPauseLoopCount++;
    } else {
      state.playPauseLoopCount = 0;
    }
    state.lastCorrectiveActionTs = t;
    if (state.playPauseLoopCount > 6) {
      state.inPlayPauseLoop = true;
      if (state.playPauseLoopResetTimer) clearTimeout(state.playPauseLoopResetTimer);
      state.playPauseLoopResetTimer = setTimeout(() => {
        state.inPlayPauseLoop = false;
        state.playPauseLoopCount = 0;
        state.playPauseLoopResetTimer = null;
        // Force a clean resync after loop-break timeout
        if (state.intendedPlaying) {
          resetDriftTracking();
          setFastSync(1200);
          scheduleSync(100);
        }
      }, 2500);
    }
  }
  function inLoopBreak() { return state.inPlayPauseLoop; }

  // ─── Volume / mute helpers ────────────────────────────────────────────────
  function getVideoMutedState() {
    try { if (typeof video.muted === "function") return !!video.muted(); } catch {}
    try { return !!getVideoNode().muted; } catch {}
    return false;
  }
  function setVideoMutedState(val) {
    try { if (typeof video.muted === "function") video.muted(!!val); } catch {}
    try { getVideoNode().muted = !!val; } catch {}
    try { videoEl.muted = !!val; } catch {}
  }
  function targetVolFromVideo() {
    const vVol = clamp01(typeof video.volume === "function" ? video.volume() : (videoEl.volume ?? 1));
    const vMuted = !!(typeof video.muted === "function" ? video.muted() : videoEl.muted);
    return (vMuted || state.userMutedVideo) ? 0 : vVol;
  }
  function updateAudioGainImmediate() {
    if (!audio) return;
    const target = clamp01(targetVolFromVideo());
    if (gainNode && audioCtx) {
      rampGain(target, 0.02);
    } else {
      try { audio.volume = target; } catch {}
    }
  }
  function forceUnmuteForPlaybackIfAllowed() {
    if (!state.intendedPlaying) return;
    try { if (!state.userMutedVideo && getVideoMutedState()) setVideoMutedState(false); } catch {}
    try { if (audio && !state.userMutedAudio && audio.muted) audio.muted = false; } catch {}
  }

  // Pop-free fade helpers using Web Audio API
  async function fadeOutAudio(ms = 40) {
    if (!gainNode || !audioCtx) {
      if (audio) try { audio.volume = 0; } catch {}
      return;
    }
    resumeAudioContext();
    try {
      const t = audioCtx.currentTime;
      gainNode.gain.cancelScheduledValues(t);
      gainNode.gain.setValueAtTime(gainNode.gain.value, t);
      gainNode.gain.linearRampToValueAtTime(0, t + ms / 1000);
    } catch {}
    await new Promise(r => setTimeout(r, ms + 5));
  }

  async function fadeInAudio(targetVol, ms = 40) {
    if (!gainNode || !audioCtx) {
      if (audio) try { audio.volume = clamp01(targetVol); } catch {}
      return;
    }
    resumeAudioContext();
    try {
      const t = audioCtx.currentTime;
      gainNode.gain.cancelScheduledValues(t);
      gainNode.gain.setValueAtTime(0, t);
      gainNode.gain.linearRampToValueAtTime(clamp01(targetVol), t + ms / 1000);
    } catch {}
    await new Promise(r => setTimeout(r, ms + 5));
  }

  async function softUnmuteAudio(ms = 60) {
    if (!audio) return;
    const target = clamp01(targetVolFromVideo());
    if (document.visibilityState === "hidden" || ms <= 0) {
      updateAudioGainImmediate();
      return;
    }
    if (gainNode && audioCtx) {
      resumeAudioContext();
      rampGain(target, ms / 1000);
    } else {
      const from = clamp01(audio.volume);
      if (Math.abs(target - from) < 0.001) return;
      const start = now();
      await new Promise(resolve => {
        const step = () => {
          const t = Math.min(1, (now() - start) / ms);
          try { audio.volume = clamp01(from + (target - from) * t); } catch {}
          if (t < 1) requestAnimationFrame(step); else resolve();
        };
        requestAnimationFrame(step);
      });
    }
  }

  // ─── Drift tracking reset ─────────────────────────────────────────────────
  function resetDriftTracking() {
    state.driftStableFrames = 0;
    state.lastDrift = 0;
  }

  // CRITICAL: Never touch audio.playbackRate for sync. We only use
  // audio.currentTime nudges and the video's own playback rate.
  function ensureAudioPlaybackRate() {
    if (!audio) return;
    try {
      const baseRate = Number(video.playbackRate?.()) || 1;
      if (Math.abs((audio.playbackRate || 1) - baseRate) > 0.001) {
        audio.playbackRate = baseRate;
      }
    } catch {}
  }

  // ─── Time manipulation ────────────────────────────────────────────────────
  function safeSetCT(media, t) {
    try { if (media && isFinite(t) && t >= 0) media.currentTime = t; } catch {}
  }
  function safeSetVideoTime(t) {
    try { if (isFinite(t) && t >= 0) video.currentTime(t); } catch {}
    try { safeSetCT(videoEl, t); } catch {}
    try { const v = getVideoNode(); if (v && v !== videoEl) safeSetCT(v, t); } catch {}
  }

  // ─── Buffered range helpers ───────────────────────────────────────────────
  function timeInBuffered(media, t) {
    try {
      const br = media.buffered;
      if (!br || br.length === 0 || !isFinite(t)) return false;
      for (let i = 0; i < br.length; i++) {
        if (t >= br.start(i) - EPS && t <= br.end(i) + EPS) return true;
      }
    } catch {}
    return false;
  }
  function bufferedAhead(media, t) {
    try {
      const br = media.buffered;
      if (!br || br.length === 0 || !isFinite(t)) return 0;
      for (let i = 0; i < br.length; i++) {
        const s = br.start(i) - EPS;
        const e = br.end(i) + EPS;
        if (t >= s && t <= e) return Math.max(0, e - t);
      }
    } catch {}
    return 0;
  }
  function canPlaySmoothAt(media, t, minAhead = STRICT_BUFFER_AHEAD_SEC) {
    try {
      if (!media || !isFinite(t)) return false;
      const rs = Number(media.readyState || 0);
      const ahead = bufferedAhead(media, t);
      if (rs >= HAVE_ENOUGH_DATA) return true;
      if (rs >= HAVE_FUTURE_DATA && ahead >= Math.min(0.08, minAhead)) return true;
      if (t < 0.5 && rs >= 2 && ahead >= Math.min(0.08, minAhead)) return true;
      return ahead >= minAhead;
    } catch { return false; }
  }
  function canPlayAt(media, t) {
    try {
      if (!media || !isFinite(t)) return false;
      const rs = Number(media.readyState || 0);
      if (rs >= 3) return true;
      if (t < 0.5 && rs >= 2) return true;
      return timeInBuffered(media, t);
    } catch { return false; }
  }
  function canStartAudioAt(t) {
    if (!coupledMode || !audio) return false;
    try {
      const rs = Number(audio.readyState || 0);
      if (rs >= 2) return true;
      return canPlayAt(audio, t);
    } catch { return false; }
  }
  function bothPlayableAt(t) {
    if (!coupledMode) return true;
    const v = getVideoNode();
    return canPlaySmoothAt(v, t, STRICT_BUFFER_AHEAD_SEC) && canPlaySmoothAt(audio, t, STRICT_BUFFER_AHEAD_SEC);
  }
  function bothStartupBufferedAt(t) {
    if (!coupledMode) return true;
    const v = getVideoNode();
    return canPlaySmoothAt(v, t, STARTUP_BUFFER_AHEAD_SEC) && canPlaySmoothAt(audio, t, STARTUP_BUFFER_AHEAD_SEC);
  }

  // ─── Audio start blocker ──────────────────────────────────────────────────
  function shouldBlockNewAudioStart() {
    if (!coupledMode) return false;
    if (!state.intendedPlaying || userPauseLockActive() || mediaSessionForcedPauseActive()) return true;
    const allowHiddenBootstrap =
      (document.visibilityState === "hidden" && hiddenMediaSessionPlayActive()) ||
      state.silentBgSync;
    if (document.visibilityState === "hidden" && !allowHiddenBootstrap) return true;
    if (chromiumPauseGuardActive() && !allowHiddenBootstrap) return true;
    if (chromiumAudioStartLocked() && !allowHiddenBootstrap) return true;
    if (chromiumBgSettlingActive() && getVideoPaused() && !allowHiddenBootstrap) return true;
    if (!allowHiddenBootstrap) {
      if (getVideoPaused()) return true;
      if (state.videoWaiting) return true;
      const rs = getVideoReadyState();
      if (!fastSyncActive() && rs < 2) return true;
    }
    return false;
  }

  // ─── Media Session ────────────────────────────────────────────────────────
  function updateMediaSessionPlaybackState() {
    if (!("mediaSession" in navigator)) return;
    try { navigator.mediaSession.playbackState = state.intendedPlaying ? "playing" : "paused"; } catch {}
  }
  function maybeUpdateMediaSessionPosition(vt) {
    if (!("mediaSession" in navigator) || !navigator.mediaSession.setPositionState) return;
    if (now() < state.mediaPositionNextAt) return;
    state.mediaPositionNextAt = now() + 1000;
    try {
      navigator.mediaSession.setPositionState({
        duration: Number(video.duration()) || 0,
        playbackRate: Number(video.playbackRate()) || 1,
        position: vt
      });
    } catch {}
  }

  // ─── Position tracking ────────────────────────────────────────────────────
  function updateLastKnownGoodVT() {
    try {
      const vt = Number(video.currentTime());
      if (isFinite(vt) && vt > 0.1) {
        state.lastKnownGoodVT = vt;
        state.lastKnownGoodVTts = now();
      }
    } catch {}
  }
  function getBestResumePosition() {
    try {
      const vt = Number(video.currentTime());
      const at = coupledMode && audio ? Number(audio.currentTime) : NaN;
      const bothAtStart = (vt < 0.5) && (!isFinite(at) || at < 0.5);
      const hasSaved = state.lastKnownGoodVT > 0.5 && (now() - state.lastKnownGoodVTts) < 30000;
      if (bothAtStart && hasSaved) return state.lastKnownGoodVT;
      if (isFinite(at) && at > 0.5 && (!isFinite(vt) || at > vt + 0.3)) return at;
      if (isFinite(vt) && vt > 0) return vt;
      if (isFinite(at) && at > 0) return at;
      return state.lastKnownGoodVT || 0;
    } catch { return state.lastKnownGoodVT || 0; }
  }

  // ─── Programmatic play/pause primitives ───────────────────────────────────
  function execProgrammaticVideoPause() {
    state.isProgrammaticVideoPause = true;
    try { video.pause(); } catch {}
    try { const v = getVideoNode(); if (v && v !== videoEl && !v.paused) v.pause(); } catch {}
    setTimeout(() => { state.isProgrammaticVideoPause = false; }, 300);
  }
  function execProgrammaticVideoPlay() {
    state.isProgrammaticVideoPlay = true;
    try {
      let p = null;
      try { p = video.play(); } catch {}
      if (!p) { try { const v = getVideoNode(); if (v) p = v.play(); } catch {} }
      Promise.resolve(p).finally(() => {
        setTimeout(() => { state.isProgrammaticVideoPlay = false; }, 300);
      });
      return p;
    } catch (e) { state.isProgrammaticVideoPlay = false; throw e; }
  }

  // Pop-free audio pause: fade out then pause
  function execProgrammaticAudioPause(ms = 320, fadeDuration = 30) {
    if (!coupledMode || !audio) return;
    const until = now() + Math.max(180, Number(ms) || 0);
    state.audioPauseUntil = Math.max(state.audioPauseUntil, until);
    state.audioPlayUntil = Math.max(state.audioPlayUntil, now() + 120);
    state.isProgrammaticAudioPause = true;
    squelchAudioEvents(ms);
    ensureAudioPlaybackRate();
    resetDriftTracking();

    const doPause = () => {
      try { if (!audio.paused) audio.pause(); } catch {}
    };

    if (!audio.paused && (gainNode && audioCtx)) {
      // Fade out before pausing to eliminate pop
      fadeOutAudio(fadeDuration).then(doPause).catch(doPause);
    } else {
      doPause();
    }

    setTimeout(() => { state.isProgrammaticAudioPause = false; }, 300);
  }

  async function execProgrammaticAudioPlay(opts = {}) {
    const { squelchMs = 320, minGapMs = 120, force = false } = opts;
    if (!coupledMode || !audio || typeof audio.play !== "function") return false;
    if (!force && !audio.paused) return true;
    if (shouldBlockNewAudioStart()) return false;
    const t = now();
    if (!force && t < state.audioPauseUntil) return !audio.paused;
    if (!force && t < state.audioPlayUntil) return !audio.paused;
    if (state.audioPlayInFlight) {
      try { await state.audioPlayInFlight; } catch {}
      return !audio.paused;
    }
    state.audioPlayUntil = t + Math.max(0, Number(minGapMs) || 0);
    state.audioPauseUntil = 0;
    state.isProgrammaticAudioPlay = true;
    ensureAudioPlaybackRate();
    resetDriftTracking();

    // Ensure gain is at 0 before play so there's no pop on start
    if (gainNode && audioCtx) {
      try {
        resumeAudioContext();
        const ct = audioCtx.currentTime;
        gainNode.gain.cancelScheduledValues(ct);
        gainNode.gain.setValueAtTime(0, ct);
      } catch {}
    } else {
      try { audio.volume = 0; } catch {}
    }

    try {
      squelchAudioEvents(squelchMs);
      const p = audio.play();
      state.audioPlayInFlight = Promise.resolve(p);
      state.audioPlayUntil = Math.max(state.audioPlayUntil, now() + Math.max(240, squelchMs));
      await state.audioPlayInFlight;

      if (shouldBlockNewAudioStart()) {
        squelchAudioEvents(220);
        try { audio.pause(); } catch {}
        return false;
      }

      // Fade in after play succeeds to avoid pop
      const targetVol = clamp01(targetVolFromVideo());
      if (!audio.paused) {
        fadeInAudio(targetVol, 30).catch(() => { updateAudioGainImmediate(); });
        state.audioEverStarted = true;
      }
      return !audio.paused;
    } finally {
      state.audioPlayInFlight = null;
      setTimeout(() => { state.isProgrammaticAudioPlay = false; }, 300);
    }
  }

  async function ensureUnmutedIfNotUserMuted() {
    if (state.startupPhase) {
      if (state.intendedPlaying) forceUnmuteForPlaybackIfAllowed();
      updateAudioGainImmediate();
      return;
    }
    await softUnmuteAudio(80);
  }

  async function softAlignAudioTo(t) {
    if (!coupledMode) return;
    safeSetCT(audio, t);
    if (state.intendedPlaying) updateAudioGainImmediate();
  }

  // ─── Timer clearers ───────────────────────────────────────────────────────
  function clearResumeAfterBufferTimer() {
    if (state.resumeAfterBufferTimer) { clearTimeout(state.resumeAfterBufferTimer); state.resumeAfterBufferTimer = null; }
  }
  function clearBgResumeRetryTimer() {
    if (state.bgResumeRetryTimer) { clearTimeout(state.bgResumeRetryTimer); state.bgResumeRetryTimer = null; }
  }
  function clearSeekSyncFinalizeTimer() {
    if (state.seekFinalizeTimer) { clearTimeout(state.seekFinalizeTimer); state.seekFinalizeTimer = null; }
  }
  function clearStartupAutoplayRetryTimer() {
    if (state.startupAutoplayRetryTimer) { clearTimeout(state.startupAutoplayRetryTimer); state.startupAutoplayRetryTimer = null; }
  }
  function cancelBackgroundResumeState() {
    state.resumeOnVisible = false;
    state.bgAutoResumeSuppressed = false;
    state.bgHiddenWasPlaying = false;
    state.bgHiddenSince = 0;
    clearBgResumeRetryTimer();
  }
  function clearSyncLoop() {
    if (state.syncTimer) { clearTimeout(state.syncTimer); state.syncTimer = null; }
    state.syncScheduledAt = 0;
  }

  // ─── Sync scheduler ───────────────────────────────────────────────────────
  function scheduleSync(minDelay = null) {
    let delay;
    if (typeof minDelay === "number") {
      delay = Math.max(0, minDelay);
    } else if (document.visibilityState === "hidden") {
      delay = platform.useBgControllerRetry ? 900 : 1200;
    } else if (fastSyncActive() || state.syncing || state.seeking || state.videoWaiting || state.strictBufferHold) {
      delay = 160;
    } else if (state.intendedPlaying) {
      delay = 520;
    } else {
      delay = 1000;
    }
    const targetAt = now() + delay;
    if (state.syncTimer && state.syncScheduledAt <= targetAt) return;
    if (state.syncTimer) clearTimeout(state.syncTimer);
    state.syncScheduledAt = targetAt;
    state.syncTimer = setTimeout(runSync, delay);
  }

  // ─── Kick helpers ─────────────────────────────────────────────────────────
  // Audio kick: realign audio time to video time and restart playback.
  // Does a fade-out/fade-in around the seek to prevent pops.
  async function kickAudio() {
    if (!coupledMode) return;
    if (inLoopBreak()) return;
    try {
      const vt = Number(video.currentTime());
      const at = Number(audio.currentTime);
      const target = isFinite(vt) ? vt : (isFinite(at) ? at : 0);

      recordCorrectiveAction();

      // Fade out before seek
      if (!audio.paused && gainNode && audioCtx) await fadeOutAudio(25);

      execProgrammaticAudioPause(420, 0); // already faded, no re-fade
      safeSetCT(audio, target);
      ensureAudioPlaybackRate();
      resetDriftTracking();

      await new Promise(r => setTimeout(r, 30));

      if (state.intendedPlaying && !getVideoPaused() && !userPauseLockActive() && !shouldBlockNewAudioStart()) {
        await execProgrammaticAudioPlay({ squelchMs: 420, force: true, minGapMs: 0 }).catch(() => false);
        updateAudioGainImmediate();
      }
    } catch {}
  }

  async function kickVideo() {
    if (state.videoRepairing) return;
    if (now() < state.videoRepairCooldownUntil) return;
    if (inLoopBreak()) return;
    state.videoRepairing = true;
    state.videoRepairCooldownUntil = now() + 3000;
    try {
      const v = getVideoNode();
      const t = Number(video.currentTime()) || 0;
      execProgrammaticAudioPause(700);
      execProgrammaticVideoPause();
      const nudge = Math.max(0, t + 0.001);
      try { safeSetCT(videoEl, nudge); if (v && v !== videoEl) safeSetCT(v, nudge); } catch {}
      await new Promise(r => setTimeout(r, 80));
      try { await Promise.resolve(execProgrammaticVideoPlay()); } catch {}
      if (!getVideoPaused()) {
        const vt = Number(video.currentTime()) || t;
        safeSetCT(audio, vt);
        if (!shouldBlockNewAudioStart()) {
          await execProgrammaticAudioPlay({ squelchMs: 700, force: true, minGapMs: 0 }).catch(() => false);
        }
        updateAudioGainImmediate();
      }
    } finally { state.videoRepairing = false; }
  }

  function scheduleBgResumeRetry(delay = 320) {
    if (!platform.useBgControllerRetry) return;
    if (mediaSessionForcedPauseActive()) return;
    if (document.visibilityState === "hidden") return;
    if (userPauseLockActive()) return;
    clearBgResumeRetryTimer();
    state.bgResumeRetryTimer = setTimeout(() => {
      if (!state.intendedPlaying || state.restarting || state.seeking || state.syncing) return;
      if (document.visibilityState !== "visible") return;
      if (userPauseLockActive()) return;
      playTogether().catch(() => {});
    }, delay);
  }

  function waitForReadyStateOrCanPlay(media, minRS = 3, timeoutMs = 2500) {
    return new Promise(resolve => {
      let done = false, to = null;
      const finish = ok => {
        if (done) return; done = true;
        try { if (to) clearTimeout(to); } catch {}
        ["canplay", "canplaythrough", "loadeddata", "seeked"].forEach(ev => {
          try { media.removeEventListener(ev, onEvt); } catch {}
        });
        resolve(!!ok);
      };
      const onEvt = () => {
        try { if (Number(media.readyState || 0) >= minRS) finish(true); } catch {}
      };
      try { if (Number(media.readyState || 0) >= minRS) return resolve(true); } catch {}
      ["canplay", "canplaythrough", "loadeddata", "seeked"].forEach(ev => {
        try { media.addEventListener(ev, onEvt, { once: true, passive: true }); } catch {}
      });
      to = setTimeout(() => finish(false), timeoutMs);
    });
  }

  // ─── Background entry/exit ────────────────────────────────────────────────
  function noteBackgroundEntry() {
    if (!coupledMode || !platform.useBgControllerRetry) return;
    state.bgHiddenSince = now();
    if (!state.intendedPlaying) { state.bgHiddenWasPlaying = false; return; }
    state.bgHiddenWasPlaying = true;
    try { state.bgHiddenBaseVT = Number(video.currentTime()) || 0; } catch { state.bgHiddenBaseVT = 0; }
    try { state.bgHiddenBaseAT = Number(audio.currentTime) || state.bgHiddenBaseVT; } catch { state.bgHiddenBaseAT = state.bgHiddenBaseVT; }
    try { state.bgHiddenBaseRate = Number(video.playbackRate()) || 1; } catch { state.bgHiddenBaseRate = 1; }
  }
  function estimateExpectedTimeFromBg(t = now()) {
    if (!state.bgHiddenSince) return NaN;
    const base = isFinite(state.bgHiddenBaseVT) ? state.bgHiddenBaseVT : 0;
    const rate = isFinite(state.bgHiddenBaseRate) && state.bgHiddenBaseRate > 0 ? state.bgHiddenBaseRate : 1;
    const elapsed = Math.max(0, (t - state.bgHiddenSince) / 1000);
    return base + elapsed * rate;
  }

  // ─── Silent background catch-up ───────────────────────────────────────────
  async function silentBgCatchUp() {
    if (!coupledMode) return;
    if (!state.intendedPlaying || state.restarting || state.seeking) return;
    if (mediaSessionForcedPauseActive() || userPauseLockActive()) return;

    state.silentBgSync = true;
    try {
      const vt = Number(video.currentTime());
      const at = Number(audio.currentTime);
      const vPaused = getVideoPaused();
      const aPaused = !!audio.paused;
      const dur = Number(video.duration()) || 0;
      const clampTime = t => (dur > 0 ? Math.min(t, Math.max(0, dur - 0.25)) : Math.max(0, t));

      if (!aPaused && isFinite(at)) {
        const target = clampTime(at);
        if (vPaused) {
          squelchAudioEvents(400);
          safeSetVideoTime(target);
          try { const p = execProgrammaticVideoPlay(); if (p && p.then) await p; } catch {}
          if (getVideoPaused()) {
            squelchAudioEvents(300);
            safeSetCT(audio, isFinite(vt) ? clampTime(vt) : target);
          } else { updateAudioGainImmediate(); }
        } else if (isFinite(vt) && Math.abs(at - vt) > BG_SILENT_SNAP_THRESHOLD) {
          squelchAudioEvents(200);
          safeSetVideoTime(target);
        }
        return;
      }
      if (!vPaused && isFinite(vt) && aPaused) {
        const target = clampTime(vt);
        squelchAudioEvents(600);
        safeSetCT(audio, target);
        try { await execProgrammaticAudioPlay({ squelchMs: 500, force: true, minGapMs: 0 }); } catch {}
        updateAudioGainImmediate();
        return;
      }
      if (vPaused && aPaused) {
        let target = estimateExpectedTimeFromBg(now());
        if (!isFinite(target) || target < 0) target = isFinite(at) ? at : (isFinite(vt) ? vt : 0);
        target = clampTime(target);
        squelchAudioEvents(600);
        safeSetVideoTime(target);
        safeSetCT(audio, target);
        try { const p = execProgrammaticVideoPlay(); if (p && p.then) await p; } catch {}
        if (!getVideoPaused()) {
          try { await execProgrammaticAudioPlay({ squelchMs: 500, force: true, minGapMs: 0 }); } catch {}
          updateAudioGainImmediate();
        } else {
          try { await execProgrammaticAudioPlay({ squelchMs: 400, force: true, minGapMs: 0 }); } catch {}
          updateAudioGainImmediate();
          state.strictBufferHold = true;
          state.strictBufferReason = "bg-resume-buffer";
          armResumeAfterBuffer(7000);
        }
        return;
      }
    } finally {
      state.silentBgSync = false;
      state.bgHiddenWasPlaying = false;
      state.resumeOnVisible = false;
      ensureAudioPlaybackRate();
      resetDriftTracking();
      setFastSync(1200);
      scheduleSync(0);
    }
  }

  async function softResumeAfterBgSeek(target, token) {
    const v = getVideoNode();
    try {
      if (platform.chromiumOnlyBrowser) {
        state.chromiumBgSettlingUntil = Math.max(state.chromiumBgSettlingUntil, now() + 900);
        state.chromiumAudioStartLockUntil = Math.max(state.chromiumAudioStartLockUntil, now() + 520);
      }
      squelchAudioEvents(800);
      safeSetVideoTime(target);
      safeSetCT(audio, target);
      ensureAudioPlaybackRate();
      resetDriftTracking();

      await Promise.allSettled([
        waitForReadyStateOrCanPlay(v, 2, 1800),
        waitForReadyStateOrCanPlay(audio, 2, 1800)
      ]);
      if (token !== state.bgCatchUpToken) return false;
      if (userPauseLockActive()) return false;

      const vReady = canPlayAt(v, target) || Number(v.readyState || 0) >= 2;
      const aReady = canStartAudioAt(target) || Number(audio.readyState || 0) >= 2;
      if (!(vReady && aReady)) {
        state.strictBufferHold = true;
        state.strictBufferReason = "bg-resume-buffer";
        armResumeAfterBuffer(7000);
        return false;
      }
      let vp = null, ap = null;
      if (getVideoPaused()) { try { vp = execProgrammaticVideoPlay(); } catch {} }
      if (audio.paused && !shouldBlockNewAudioStart()) {
        try { ap = execProgrammaticAudioPlay({ squelchMs: 500, minGapMs: 0, force: true }); } catch {}
      }
      await Promise.allSettled([vp, ap]);
      if (userPauseLockActive()) return false;
      forceUnmuteForPlaybackIfAllowed();
      updateAudioGainImmediate();
      setFastSync(1800);
      scheduleSync(0);
      return !getVideoPaused();
    } catch { return false; }
  }

  async function seamlessBgCatchUp() {
    if (!coupledMode || !platform.useBgControllerRetry) return;
    if ((!state.bgHiddenWasPlaying && !state.resumeOnVisible) || !state.intendedPlaying) return;
    if (state.restarting || state.seeking || state.syncing) return;
    if (mediaSessionForcedPauseActive() || userPauseLockActive()) return;
    if (now() < state.bgCatchUpCooldownUntil) return;
    state.bgCatchUpCooldownUntil = now() + 260;
    const token = ++state.bgCatchUpToken;

    let vtNow = NaN, atNow = NaN, vPausedNow = true, aPausedNow = true;
    try { vtNow = Number(video.currentTime()); } catch {}
    try { atNow = Number(audio.currentTime); } catch {}
    try { vPausedNow = getVideoPaused(); } catch {}
    try { aPausedNow = !!audio.paused; } catch {}

    if (!aPausedNow && isFinite(atNow)) {
      let target = atNow;
      const dur = Number(video.duration()) || 0;
      if (dur > 0) target = Math.min(target, Math.max(0, dur - 0.25));
      state.bgHiddenWasPlaying = false;
      state.resumeOnVisible = false;
      if (!isFinite(vtNow) || Math.abs(target - vtNow) > BG_SILENT_SNAP_THRESHOLD || vPausedNow) {
        if (!vPausedNow) {
          squelchAudioEvents(200);
          safeSetVideoTime(target);
        } else {
          squelchAudioEvents(600);
          safeSetVideoTime(target);
          if (!inMediaTxnWindow()) {
            try { await Promise.resolve(execProgrammaticVideoPlay()); } catch {}
          }
        }
      }
      setFastSync(1600);
      scheduleSync(0);
      return;
    }

    let expected = estimateExpectedTimeFromBg(now());
    if (!isFinite(expected) || expected < 0) expected = isFinite(vtNow) ? vtNow : 0;
    const dur2 = Number(video.duration()) || 0;
    if (dur2 > 0) expected = Math.min(expected, Math.max(0, dur2 - 0.25));
    await softResumeAfterBgSeek(expected, token);
    state.bgHiddenWasPlaying = false;
    state.resumeOnVisible = false;
    setFastSync(2200);
    scheduleSync(0);
  }

  // ─── Buffer resumption ────────────────────────────────────────────────────
  function armResumeAfterBuffer(timeoutMs = 7000) {
    if (!coupledMode) return;
    if (!state.intendedPlaying || state.restarting || state.seeking || state.syncing) return;
    if (mediaSessionForcedPauseActive()) return;
    clearResumeAfterBufferTimer();
    const v = getVideoNode();
    let cleaned = false, pollTimer = null;
    const cleanup = () => {
      if (cleaned) return; cleaned = true;
      if (pollTimer) { clearTimeout(pollTimer); pollTimer = null; }
      ["canplay", "playing"].forEach(ev => {
        try { v.removeEventListener(ev, onReady); } catch {}
        try { audio.removeEventListener(ev, onReady); } catch {}
      });
    };
    const tryKick = () => {
      if (!state.intendedPlaying || state.restarting || state.seeking || state.syncing) { cleanup(); return; }
      if (mediaSessionForcedPauseActive() || userPauseLockActive()) { cleanup(); return; }
      const vt = Number(video.currentTime());
      if (!isFinite(vt) || !bothPlayableAt(vt)) return;
      state.strictBufferHold = false;
      state.strictBufferReason = "";
      state.strictBufferHoldFrames = 0;
      setFastSync(1200);
      cleanup();
      if (!inMediaTxnWindow()) playTogether().catch(() => {});
      else scheduleSync(160);
    };
    const onReady = () => { requestAnimationFrame(tryKick); };
    ["canplay", "playing"].forEach(ev => {
      try { v.addEventListener(ev, onReady, { passive: true }); } catch {}
      try { audio.addEventListener(ev, onReady, { passive: true }); } catch {}
    });
    const poll = () => {
      if (cleaned) return;
      tryKick();
      if (!cleaned) pollTimer = setTimeout(poll, 250);
    };
    pollTimer = setTimeout(poll, 100);
    state.resumeAfterBufferTimer = setTimeout(() => {
      cleanup();
      state.resumeAfterBufferTimer = null;
      if (state.intendedPlaying && !state.restarting && !state.seeking && !userPauseLockActive()) {
        const vt = Number(video.currentTime());
        if (isFinite(vt) && bothPlayableAt(vt)) {
          state.strictBufferHold = false;
          state.strictBufferReason = "";
          state.strictBufferHoldFrames = 0;
          playTogether().catch(() => {});
        }
      }
    }, Math.max(1200, Number(timeoutMs) || 0));
  }

  function clearPendingPlayResumesForPause() {
    clearHiddenMediaSessionPlay();
    clearBgResumeRetryTimer();
    clearResumeAfterBufferTimer();
    cancelBackgroundResumeState();
    state.strictBufferHold = false;
    state.strictBufferReason = "";
    state.strictBufferHoldFrames = 0;
    state.startupAudioHoldUntil = 0;
    state.audioPlayUntil = Math.max(state.audioPlayUntil, now() + 220);
    setPauseEventGuard(1200);
    setMediaPauseTxn(1200);
    if (platform.chromiumOnlyBrowser) {
      state.chromiumPauseGuardUntil = Math.max(state.chromiumPauseGuardUntil, now() + 1650);
      state.chromiumAudioStartLockUntil = Math.max(state.chromiumAudioStartLockUntil, now() + 1850);
      state.chromiumBgSettlingUntil = Math.max(state.chromiumBgSettlingUntil, now() + 1200);
    }
  }

  function queueHardPauseVerification(msList = [0, 90, 220, 420, 760]) {
    const serial = ++state.hardPauseVerifySerial;
    for (const delay of msList) {
      setTimeout(() => {
        if (serial !== state.hardPauseVerifySerial) return;
        if (state.intendedPlaying || userPlayIntentActive()) return;
        try { if (!getVideoPaused()) execProgrammaticVideoPause(); } catch {}
        try { if (coupledMode && !audio.paused) execProgrammaticAudioPause(320); } catch {}
        clearSyncLoop();
      }, delay);
    }
  }

  function pauseHard() {
    clearHiddenMediaSessionPlay();
    clearBgResumeRetryTimer();
    clearResumeAfterBufferTimer();
    execProgrammaticVideoPause();
    if (coupledMode) execProgrammaticAudioPause(700);
    clearSyncLoop();
    if (!state.intendedPlaying) queueHardPauseVerification();
  }

  function pauseTogether() {
    state.intendedPlaying = false;
    state.strictBufferHold = false;
    state.strictBufferReason = "";
    state.strictBufferHoldFrames = 0;
    updateMediaSessionPlaybackState();
    if (!state.syncing && !state.seeking) pauseHard();
    else queueHardPauseVerification();
  }

  // ─── Core playTogether ────────────────────────────────────────────────────
  async function playTogether() {
    if (!coupledMode) {
      if (getVideoPaused()) {
        try { await Promise.resolve(execProgrammaticVideoPlay()); } catch {}
      }
      state.intendedPlaying = !getVideoPaused();
      updateMediaSessionPlaybackState();
      setFastSync(1200);
      scheduleSync(0);
      return;
    }
    if (state.syncing || state.restarting) return;
    if (mediaSessionForcedPauseActive()) return;
    if (userPauseLockActive()) return;
    if (inLoopBreak()) return;

    state.syncing = true;
    setFastSync(2000);
    try {
      if (!state.intendedPlaying) return;
      const vtStart = Number(video.currentTime()) || 0;

      // Startup: ensure audio is at same position as video BEFORE play
      if (state.startupPhase && !state.startupPrimed) {
        safeSetCT(audio, vtStart);
        ensureAudioPlaybackRate();
      } else if (!state.startupAudioAligned) {
        // First play: hard-align audio to video time
        const at = Number(audio.currentTime);
        if (!isFinite(at) || Math.abs(at - vtStart) > 0.05) {
          safeSetCT(audio, vtStart);
        }
        state.startupAudioAligned = true;
        ensureAudioPlaybackRate();
        resetDriftTracking();
      }

      forceUnmuteForPlaybackIfAllowed();
      updateAudioGainImmediate();

      if ((state.startupPrimed || state.audioEverStarted) && !bothPlayableAt(vtStart)) {
        state.strictBufferHold = true;
        state.strictBufferReason = "strict-play-gate";
        execProgrammaticVideoPause();
        execProgrammaticAudioPause(420);
        safeSetCT(audio, vtStart);
        armResumeAfterBuffer(8000);
        return;
      }

      state.strictBufferHold = false;
      state.strictBufferReason = "";
      state.strictBufferHoldFrames = 0;

      // Align audio time to video time before playing
      const vt = Number(video.currentTime());
      const at = Number(audio.currentTime);
      if (isFinite(vt) && isFinite(at) && Math.abs(at - vt) > 0.1) {
        safeSetCT(audio, vt);
        ensureAudioPlaybackRate();
        resetDriftTracking();
      }

      let videoOk = true, audioOk = true;
      if (getVideoPaused()) {
        try {
          const p = execProgrammaticVideoPlay();
          if (p && p.then) await p;
          videoOk = !getVideoPaused();
        } catch { videoOk = false; }
      }
      if (videoOk) { forceUnmuteForPlaybackIfAllowed(); updateAudioGainImmediate(); }
      if (!state.intendedPlaying || userPauseLockActive()) return;

      if (audio.paused) {
        const vNow = Number(video.currentTime()) || 0;
        const canKickFirstAudio = !state.audioEverStarted && canStartAudioAt(vNow);
        const shouldHoldAudio =
          state.strictBufferHold ||
          shouldBlockNewAudioStart() ||
          (document.visibilityState === "visible" && state.videoWaiting && state.startupPhase && !state.audioEverStarted);

        if (shouldHoldAudio) {
          audioOk = true;
          if (state.videoWaiting) armResumeAfterBuffer(8000);
        } else if (!canKickFirstAudio && startupAudioHoldActive()) {
          audioOk = true;
        } else {
          // Ensure audio is perfectly aligned before play
          safeSetCT(audio, vNow);
          ensureAudioPlaybackRate();
          resetDriftTracking();
          audioOk = await execProgrammaticAudioPlay({
            squelchMs: canKickFirstAudio ? 260 : 320,
            minGapMs: canKickFirstAudio ? 0 : 100,
            force: !!canKickFirstAudio
          });
        }
      }

      if (!audioOk && videoOk && state.intendedPlaying && !getVideoPaused() && !state.strictBufferHold) {
        const vNow = Number(video.currentTime()) || 0;
        if (!shouldBlockNewAudioStart() && canStartAudioAt(vNow) && !state.videoWaiting) {
          safeSetCT(audio, vNow);
          ensureAudioPlaybackRate();
          resetDriftTracking();
          audioOk = await execProgrammaticAudioPlay({ squelchMs: 360, force: true, minGapMs: 0 });
        } else if (state.videoWaiting) {
          armResumeAfterBuffer(8000);
        }
      }

      if (!state.intendedPlaying || userPauseLockActive()) return;

      if (!videoOk && !audioOk) {
        if (document.visibilityState === "hidden" && platform.useBgControllerRetry) {
          scheduleBgResumeRetry(300);
        } else {
          state.intendedPlaying = false;
          pauseHard();
          updateMediaSessionPlaybackState();
          return;
        }
      } else if (!videoOk && audioOk && document.visibilityState !== "hidden") {
        execProgrammaticAudioPause(400);
      }

      const vp = getVideoPaused();
      const ap = !!audio.paused;
      if (!vp && ap && !state.strictBufferHold && !state.videoWaiting) {
        const cur = Number(video.currentTime()) || 0;
        if (!shouldBlockNewAudioStart() && canStartAudioAt(cur)) {
          safeSetCT(audio, cur);
          ensureAudioPlaybackRate();
          resetDriftTracking();
          const audioStarted = await execProgrammaticAudioPlay({ squelchMs: 280, force: true, minGapMs: 0 }).catch(() => false);
          if (!audioStarted && !state.strictBufferHold && !state.videoWaiting && !shouldBlockNewAudioStart()) {
            execProgrammaticVideoPause();
          }
        } else if (!shouldBlockNewAudioStart()) {
          execProgrammaticVideoPause();
          armResumeAfterBuffer(8000);
        }
      }
      if (vp && !ap) { execProgrammaticAudioPause(420); }

      updateAudioGainImmediate();
      if (!state.firstPlayCommitted) {
        state.firstPlayCommitted = true;
        setTimeout(() => { state.startupPhase = false; }, 800);
      }
      updateMediaSessionPlaybackState();
      scheduleSync(0);
    } finally { state.syncing = false; }
  }

  // ─── Seek finalization ────────────────────────────────────────────────────
  async function finalizeSeekSync() {
    if (!coupledMode) {
      state.seeking = false;
      state.firstSeekDone = true;
      setFastSync(1800);
      scheduleSync(0);
      return;
    }
    if (state.restarting || !state.seeking) return;
    const v = getVideoNode();
    const vt = Number(video.currentTime());
    if (isFinite(vt)) safeSetCT(audio, vt);
    ensureAudioPlaybackRate();
    resetDriftTracking();

    execProgrammaticVideoPause();
    execProgrammaticAudioPause(420);

    const [vReady, aReady] = await Promise.all([
      waitForReadyStateOrCanPlay(v, 3, 2200),
      waitForReadyStateOrCanPlay(audio, 3, 2200)
    ]);
    if (!state.seeking) return;
    state.seeking = false;
    state.firstSeekDone = true;
    state.audioPlayUntil = 0;
    state.audioPauseUntil = 0;

    if (!state.seekWantedPlaying || !state.intendedPlaying || mediaSessionForcedPauseActive()) {
      execProgrammaticVideoPause();
      execProgrammaticAudioPause(420);
      return;
    }
    if (!(vReady && aReady)) {
      const vtCheck = Number(video.currentTime());
      const alreadyReady = isFinite(vtCheck) && bothPlayableAt(vtCheck);
      if (!alreadyReady) {
        state.strictBufferHold = true;
        state.strictBufferReason = "seek-buffer";
        armResumeAfterBuffer(8000);
        return;
      }
    }
    state.strictBufferHold = false;
    state.strictBufferReason = "";
    state.strictBufferHoldFrames = 0;
    await ensureUnmutedIfNotUserMuted().catch(() => {});
    const vt2 = Number(video.currentTime());
    if (isFinite(vt2)) {
      safeSetCT(audio, vt2);
      ensureAudioPlaybackRate();
      resetDriftTracking();
    }
    setFastSync(2200);
    playTogether().catch(() => {});
  }

  function scheduleSeekFinalize(delay = 0) {
    clearSeekSyncFinalizeTimer();
    state.seekFinalizeTimer = setTimeout(() => {
      state.seekFinalizeTimer = null;
      finalizeSeekSync().catch(() => {});
    }, delay);
  }

  // ─── Autoplay / startup ───────────────────────────────────────────────────
  function wantsStartupAutoplay() {
    try {
      const q = (qs.get("autoplay") || "").toLowerCase();
      if (q === "1" || q === "true" || q === "yes") return true;
    } catch {}
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
  function startupAutoplayPauseGraceActive() {
    return wantsStartupAutoplay() && !state.firstPlayCommitted &&
      (now() - state.startupPrimeStartedAt) < 3600;
  }
  function startupBufferReadyLoose() {
    if (!coupledMode) return true;
    const t0 = Number(video.currentTime()) || 0;
    const vNode = getVideoNode();
    const vOk = Number(vNode.readyState || 0) >= 2 || canPlayAt(vNode, t0);
    const aOk = canStartAudioAt(t0);
    return vOk && aOk;
  }

  function scheduleStartupAutoplayKick() {
    if (!coupledMode) return;
    if (state.startupKickDone || state.startupKickInFlight) return;
    if (!state.startupPrimed) return;
    if (!wantsStartupAutoplay() && !state.intendedPlaying) return;
    if (mediaSessionForcedPauseActive()) return;
    state.startupKickInFlight = true;
    setTimeout(async () => {
      try {
        if (!state.startupPrimed || mediaSessionForcedPauseActive()) return;
        clearMediaSessionForcedPause();
        state.intendedPlaying = true;
        state.strictBufferHold = false;
        state.strictBufferReason = "";
        state.strictBufferHoldFrames = 0;
        updateMediaSessionPlaybackState();
        setPauseEventGuard(1400);
        setMediaPlayTxn(1800);
        setFastSync(2200);

        // Hard-align audio to video at startup
        const vt = Number(video.currentTime()) || 0;
        safeSetCT(audio, vt);
        ensureAudioPlaybackRate();
        resetDriftTracking();
        state.startupAudioAligned = true;

        try {
          const vp = execProgrammaticVideoPlay();
          if (vp && vp.then) await vp;
        } catch {}
        if (getVideoPaused()) return;
        await playTogether().catch(() => {});
        if (!getVideoPaused()) {
          state.startupKickDone = true;
        } else {
          scheduleStartupAutoplayRetry();
        }
      } finally { state.startupKickInFlight = false; }
    }, 0);
  }

  function scheduleStartupAutoplayRetry() {
    if (state.startupKickDone || state.startupKickInFlight) return;
    if (!state.intendedPlaying && !wantsStartupAutoplay()) return;
    if (mediaSessionForcedPauseActive() || userPauseLockActive()) return;
    clearStartupAutoplayRetryTimer();
    const count = state.startupAutoplayRetryCount;
    if (count >= 5) return;
    const delays = [300, 600, 1000, 1500, 2200];
    const delay = delays[count] || 2200;
    state.startupAutoplayRetryCount++;
    state.startupAutoplayRetryTimer = setTimeout(async () => {
      state.startupAutoplayRetryTimer = null;
      if (state.startupKickDone || state.startupKickInFlight) return;
      if (!state.intendedPlaying && !wantsStartupAutoplay()) return;
      if (mediaSessionForcedPauseActive() || userPauseLockActive()) return;
      if (!startupBufferReadyLoose()) { scheduleStartupAutoplayRetry(); return; }
      state.startupKickInFlight = true;
      try {
        clearMediaSessionForcedPause();
        state.intendedPlaying = true;
        state.strictBufferHold = false;
        state.strictBufferReason = "";
        state.strictBufferHoldFrames = 0;
        state.startupPrimed = true;
        updateMediaSessionPlaybackState();
        setPauseEventGuard(1400);
        setMediaPlayTxn(1800);
        setFastSync(2200);

        const t0 = Number(video.currentTime()) || 0;
        safeSetCT(audio, t0);
        ensureAudioPlaybackRate();
        resetDriftTracking();
        state.startupAudioAligned = true;

        try { const vp = execProgrammaticVideoPlay(); if (vp && vp.then) await vp; } catch {}
        if (!getVideoPaused()) await playTogether().catch(() => {});
        if (!getVideoPaused()) { state.startupKickDone = true; }
        else scheduleStartupAutoplayRetry();
      } finally { state.startupKickInFlight = false; }
    }, delay);
  }

  function maybePrimeStartup() {
    if (!coupledMode) return;
    if (state.restarting || state.startupPrimed) return;
    const t0 = Number(video.currentTime()) || 0;
    const primeWait = now() - state.startupPrimeStartedAt;
    if (!bothStartupBufferedAt(t0)) {
      const looseReady = canPlayAt(getVideoNode(), t0) && canStartAudioAt(t0);
      if (!(looseReady && primeWait > 1400)) {
        state.strictBufferHold = true;
        state.strictBufferReason = "startup-buffer";
        return;
      }
    }
    state.startupPrimed = true;
    state.strictBufferHold = false;
    state.strictBufferReason = "";
    state.strictBufferHoldFrames = 0;
    state.firstSeekDone = true;

    // Hard-align audio to video at startup prime
    const t = Number(video.currentTime());
    if (isFinite(t)) {
      safeSetCT(audio, t);
      ensureAudioPlaybackRate();
      resetDriftTracking();
      state.startupAudioAligned = true;
    }
    updateAudioGainImmediate();
    scheduleStartupAutoplayKick();
    setTimeout(() => { if (!state.firstPlayCommitted) state.startupPhase = false; }, 2500);
  }

  // ─── Buffer hold evaluation ───────────────────────────────────────────────
  function evaluateBufferHoldNeed(vt) {
    if (!state.intendedPlaying || state.seeking || state.syncing) return false;
    if (!state.audioEverStarted && state.startupPhase) return false;
    const vNode = getVideoNode();
    const vNeedsBuffer = state.videoWaiting || !canPlaySmoothAt(vNode, vt, STRICT_BUFFER_AHEAD_SEC);
    const aNeedsBuffer = !canPlaySmoothAt(audio, vt, STRICT_BUFFER_AHEAD_SEC);
    if (vNeedsBuffer || aNeedsBuffer) {
      state.strictBufferHoldFrames = (state.strictBufferHoldFrames || 0) + 1;
      if (state.videoWaiting || state.strictBufferHoldFrames >= 2) return true;
      return false;
    } else {
      state.strictBufferHoldFrames = 0;
      return false;
    }
  }

  // ─── Main sync loop ───────────────────────────────────────────────────────
  async function runSync() {
    state.syncTimer = null;
    state.syncScheduledAt = 0;

    if (!coupledMode) {
      if (state.intendedPlaying && getVideoPaused() && !userPauseLockActive() && !mediaSessionForcedPauseActive()) {
        try { await Promise.resolve(execProgrammaticVideoPlay()); } catch {}
      }
      scheduleSync();
      return;
    }
    if (state.restarting) { scheduleSync(); return; }

    const vt = Number(video.currentTime());
    const at = Number(audio.currentTime);
    if (!isFinite(vt) || !isFinite(at)) { scheduleSync(); return; }

    if (state.intendedPlaying && !getVideoPaused() && vt > 0.1) updateLastKnownGoodVT();

    const hidden = document.visibilityState === "hidden";

    // On Chromium/WebKit hidden tabs, don't issue pause commands —
    // just mark for resume and wait until tab becomes visible.
    if (hidden && platform.useBgControllerRetry && state.intendedPlaying && !mediaSessionForcedPauseActive()) {
      state.resumeOnVisible = true;
      if (!state.bgHiddenSince) noteBackgroundEntry();
      scheduleSync();
      return;
    }

    if (state.intendedPlaying && !state.seeking && !state.syncing) {
      const needsHold = evaluateBufferHoldNeed(vt);
      if (needsHold && !state.strictBufferHold) {
        state.strictBufferHold = true;
        state.strictBufferReason = state.videoWaiting ? "video-waiting" : (
          !canPlaySmoothAt(getVideoNode(), vt, STRICT_BUFFER_AHEAD_SEC) ? "video" : "audio"
        );
        if (!getVideoPaused()) execProgrammaticVideoPause();
        if (!audio.paused) {
          // Fade out before pause to avoid pop
          fadeOutAudio(20).then(() => {
            execProgrammaticAudioPause(420, 0);
            safeSetCT(audio, vt);
          }).catch(() => {
            execProgrammaticAudioPause(420);
            safeSetCT(audio, vt);
          });
        }
        ensureAudioPlaybackRate();
        resetDriftTracking();
        armResumeAfterBuffer(8000);
      } else if (!needsHold && state.strictBufferHold) {
        state.strictBufferHold = false;
        state.strictBufferReason = "";
        state.strictBufferHoldFrames = 0;
        ensureAudioPlaybackRate();
        resetDriftTracking();
        setFastSync(900);
      }
    }

    const vPaused = getVideoPaused();
    const aPaused = !!audio.paused;
    const vWaiting = getVideoReadyState() < 3 || state.videoWaiting;

    if (state.intendedPlaying && !state.restarting && !state.seeking && !state.syncing) {
      if (state.strictBufferHold) {
        if (!vPaused) execProgrammaticVideoPause();
        if (!aPaused) {
          execProgrammaticAudioPause(300);
          safeSetCT(audio, vt);
        }
      } else if (vWaiting && (state.audioEverStarted || !canStartAudioAt(vt))) {
        if (!aPaused) {
          execProgrammaticAudioPause(260);
          safeSetCT(audio, vt);
        }
      } else if (!vPaused && aPaused) {
        if (!shouldBlockNewAudioStart()) {
          if (!state.audioEverStarted && canStartAudioAt(vt)) {
            safeSetCT(audio, vt);
            ensureAudioPlaybackRate();
            resetDriftTracking();
            execProgrammaticAudioPlay({ squelchMs: 260, minGapMs: 0, force: true }).catch(() => false);
          } else if (!startupAudioHoldActive()) {
            safeSetCT(audio, vt);
            ensureAudioPlaybackRate();
            resetDriftTracking();
            execProgrammaticAudioPlay({ squelchMs: 300, minGapMs: 100 }).catch(() => false);
          }
        }
      } else if (vPaused && !aPaused) {
        execProgrammaticAudioPause(260);
        if (state.intendedPlaying && !vWaiting && !state.strictBufferHold) {
          if (!(platform.useBgControllerRetry && hidden)) {
            if (!inMediaTxnWindow() && !userPauseLockActive() && !chromiumPauseGuardActive()) {
              if (!inLoopBreak()) playTogether().catch(() => {});
            }
          } else { scheduleBgResumeRetry(320); }
        }
      } else if (vPaused && aPaused) {
        if (!vWaiting && !state.strictBufferHold && !userPauseLockActive() && !chromiumPauseGuardActive()) {
          if (!(platform.useBgControllerRetry && hidden)) {
            if (!inMediaTxnWindow() && !inLoopBreak()) playTogether().catch(() => {});
          } else { scheduleBgResumeRetry(320); }
        }
      } else {
        // Both playing — DRIFT CORRECTION
        // NEVER adjust audio.playbackRate. Only nudge audio.currentTime
        // if drift is persistent and significant.
        const drift = vt - at;
        const absDrift = Math.abs(drift);

        if (absDrift > BIG_DRIFT) {
          // Very large drift — hard snap audio time to video time
          // Fade out, seek, fade in to prevent pop
          fadeOutAudio(20).then(() => {
            safeSetCT(audio, vt);
            ensureAudioPlaybackRate();
            resetDriftTracking();
            if (!audio.paused) fadeInAudio(clamp01(targetVolFromVideo()), 20).catch(() => {});
          }).catch(() => {
            safeSetCT(audio, vt);
            ensureAudioPlaybackRate();
            resetDriftTracking();
          });
          setFastSync(1200);
        } else if (absDrift > SNAP_DRIFT) {
          // Moderate drift — snap, but only if confirmed persistent
          const sameDir = (drift > 0) === (state.lastDrift > 0);
          if (sameDir) state.driftStableFrames = (state.driftStableFrames || 0) + 1;
          else state.driftStableFrames = 0;
          state.lastDrift = drift;

          if (state.driftStableFrames >= DRIFT_PERSIST_CYCLES) {
            // Persistent moderate drift — do a time nudge (NOT rate change)
            fadeOutAudio(15).then(() => {
              safeSetCT(audio, vt);
              ensureAudioPlaybackRate();
              resetDriftTracking();
              if (!audio.paused) fadeInAudio(clamp01(targetVolFromVideo()), 15).catch(() => {});
            }).catch(() => {
              safeSetCT(audio, vt);
              ensureAudioPlaybackRate();
              resetDriftTracking();
            });
            setFastSync(800);
          }
        } else if (absDrift > CORRECT_DRIFT) {
          // Small persistent drift — track but don't correct yet unless confirmed
          const sameDir = (drift > 0) === (state.lastDrift > 0);
          if (sameDir) state.driftStableFrames = (state.driftStableFrames || 0) + 1;
          else state.driftStableFrames = 0;
          state.lastDrift = drift;

          if (state.driftStableFrames >= DRIFT_PERSIST_CYCLES + 2) {
            // Very persistently small drift — micro time nudge, very gently
            // to avoid any audible artifact
            fadeOutAudio(12).then(() => {
              // nudge audio time by only half the drift
              const newAt = Number(audio.currentTime);
              if (isFinite(newAt)) safeSetCT(audio, newAt + drift * 0.5);
              ensureAudioPlaybackRate();
              resetDriftTracking();
              if (!audio.paused) fadeInAudio(clamp01(targetVolFromVideo()), 12).catch(() => {});
            }).catch(() => {
              const newAt = Number(audio.currentTime);
              if (isFinite(newAt)) safeSetCT(audio, newAt + drift * 0.5);
              ensureAudioPlaybackRate();
              resetDriftTracking();
            });
          }
        } else {
          // In sync — ensure playback rate is at baseline
          ensureAudioPlaybackRate();
          if (absDrift < 0.02) resetDriftTracking();
        }
      }
    } else if (!state.intendedPlaying && !state.restarting && !state.seeking && !state.syncing) {
      if (!vPaused) execProgrammaticVideoPause();
      if (!aPaused) execProgrammaticAudioPause(260);
    }

    maybeUpdateMediaSessionPosition(vt);

    // Stalled audio detection
    if (!aPaused && state.intendedPlaying) {
      if (Math.abs(at - state.lastAT) > 0.002) {
        state.lastAT = at;
        state.audioLastProgressTs = now();
      } else {
        if (!state.audioLastProgressTs) state.audioLastProgressTs = now();
        const canKickAudio =
          !vWaiting && !hidden && !state.seeking && !state.syncing &&
          !mediaActionLocked() && !state.strictBufferHold &&
          now() >= state.audioKickCooldownUntil && !userPauseLockActive() &&
          !shouldBlockNewAudioStart() && !inLoopBreak();
        if (canKickAudio && (now() - state.audioLastProgressTs) > 2600) {
          state.audioKickCooldownUntil = now() + 2800;
          kickAudio().catch(() => {});
          state.audioLastProgressTs = now();
        }
      }
    } else {
      state.lastAT = at;
      state.audioLastProgressTs = now();
    }

    // Stalled video detection (mobile Chromium)
    if (state.intendedPlaying && !vPaused) {
      if (Math.abs(vt - state.lastVT) < 0.001) {
        const shouldRepair =
          (now() - state.lastVTts) > 2600 && !state.videoRepairing &&
          !vWaiting && getVideoReadyState() >= 2 &&
          !state.strictBufferHold && !userPauseLockActive() && !inLoopBreak();
        if (shouldRepair && platform.problemMobileBrowser && document.visibilityState === "visible") {
          kickVideo().catch(() => {});
          state.lastVTts = now();
        }
      } else { state.lastVT = vt; state.lastVTts = now(); }
    } else { state.lastVT = vt; state.lastVTts = now(); }

    // Ensure audio isn't silently muted
    if (state.intendedPlaying && !aPaused && !state.userMutedVideo && !state.userMutedAudio) {
      try { if (audio.muted) audio.muted = false; } catch {}
      const targetVol = clamp01(targetVolFromVideo());
      if (!gainNode || !audioCtx) {
        if (audio.volume <= 0.001) softUnmuteAudio(120).catch(() => {});
      } else {
        try {
          if (gainNode.gain.value <= 0.001) rampGain(targetVol, 0.1);
        } catch {}
      }
    }

    scheduleSync();
  }

  // ─── User intent detection ────────────────────────────────────────────────
  function setupUserPauseIntentDetection() {
    const root = video?.el?.() || videoEl || document;
    let pendingTechTogglePausedState = null;
    const getTargetEl = target => {
      try { return target && target.nodeType === 1 ? target : null; } catch {} return null;
    };
    const isPrimaryActivation = event => {
      try {
        if (event?.type === "pointerdown") {
          if (event.isPrimary === false) return false;
          if (event.pointerType === "mouse" && typeof event.button === "number" && event.button !== 0) return false;
        } else if (event?.type === "mousedown") {
          if (typeof event.button === "number" && event.button !== 0) return false;
        }
      } catch {}
      return true;
    };
    const isPlayControlTarget = target => {
      try { const el = getTargetEl(target); return !!el?.closest?.(".vjs-play-control, .vjs-big-play-button"); } catch {}
      return false;
    };
    const isTechSurfaceTarget = target => {
      try {
        const el = getTargetEl(target);
        if (!el) return false;
        if (el.closest?.(".vjs-control-bar, .vjs-menu, .vjs-menu-content, .vjs-slider, .vjs-control")) return false;
        return !!el.closest?.(".vjs-tech, video");
      } catch {}
      return false;
    };
    const onPressStart = event => {
      if (document.visibilityState !== "visible") return;
      if (!isPrimaryActivation(event)) return;
      if (isPlayControlTarget(event.target)) {
        pendingTechTogglePausedState = null;
        if (getVideoPaused()) { markUserPlayIntent(); }
        else { markUserPauseIntent(); clearPendingPlayResumesForPause(); }
        return;
      }
      if (isTechSurfaceTarget(event.target)) {
        pendingTechTogglePausedState = getVideoPaused();
        return;
      }
      pendingTechTogglePausedState = null;
    };
    const onClick = event => {
      if (document.visibilityState !== "visible") return;
      if (isPlayControlTarget(event.target)) { pendingTechTogglePausedState = null; return; }
      if (!isTechSurfaceTarget(event.target)) { pendingTechTogglePausedState = null; return; }
      const wasPaused = pendingTechTogglePausedState;
      pendingTechTogglePausedState = null;
      if (typeof wasPaused !== "boolean") return;
      requestAnimationFrame(() => {
        const paused = getVideoPaused();
        if (wasPaused && !paused) markUserPlayIntent(900);
        else if (!wasPaused && paused) { markUserPauseIntent(900); clearPendingPlayResumesForPause(); }
      });
    };
    const onKeyDown = event => {
      if (document.visibilityState !== "visible") return;
      const code = event.code || event.key || "";
      if (code === "Space" || code === "KeyK" || code === "MediaPlayPause") {
        if (getVideoPaused()) markUserPlayIntent();
        else { markUserPauseIntent(); clearPendingPlayResumesForPause(); }
      } else if (code === "MediaPause" || code === "MediaStop") {
        markUserPauseIntent();
        clearPendingPlayResumesForPause();
      }
    };
    try {
      if ("PointerEvent" in window) {
        root.addEventListener("pointerdown", onPressStart, { capture: true, passive: true });
      } else {
        root.addEventListener("mousedown", onPressStart, { capture: true, passive: true });
        root.addEventListener("touchstart", onPressStart, { capture: true, passive: true });
      }
    } catch {}
    try { root.addEventListener("click", onClick, { capture: true, passive: true }); } catch {}
    try { document.addEventListener("keydown", onKeyDown, true); } catch {}
  }

  // ─── Media Session ────────────────────────────────────────────────────────
  function setupMediaSession() {
    if (!("mediaSession" in navigator)) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: document.title || "Video",
        artist: typeof authorchannelname !== "undefined" ? authorchannelname : "",
        artwork: vidKey ? [
          { src: `https://i.ytimg.com/vi/${vidKey}/default.jpg`, sizes: "120x90", type: "image/jpeg" },
          { src: `https://i.ytimg.com/vi/${vidKey}/mqdefault.jpg`, sizes: "320x180", type: "image/jpeg" },
          { src: `https://i.ytimg.com/vi/${vidKey}/hqdefault.jpg`, sizes: "480x360", type: "image/jpeg" },
          { src: `https://i.ytimg.com/vi/${vidKey}/maxresdefault.jpg`, sizes: "1280x720", type: "image/jpeg" }
        ] : []
      });
    } catch {}
    updateMediaSessionPlaybackState();

    const handlePauseLike = () => {
      markMediaAction("pause");
      setMediaSessionForcedPause(3200);
      markUserPauseIntent(2800);
      clearPendingPlayResumesForPause();
      setPauseEventGuard(2200);
      setMediaPauseTxn(2200);
      state.intendedPlaying = false;
      state.strictBufferHold = false;
      state.strictBufferReason = "";
      state.strictBufferHoldFrames = 0;
      state.startupAudioHoldUntil = 0;
      state.syncing = false;
      state.resumeOnVisible = false;
      clearHiddenMediaSessionPlay();
      cancelBackgroundResumeState();
      updateMediaSessionPlaybackState();
      pauseHard();
    };

    try {
      navigator.mediaSession.setActionHandler("play", () => {
        const serial = ++state.mediaSessionActionSerial;
        clearMediaSessionForcedPause();

        // Allow playback even when hidden (media controls in notification bar)
        if (document.visibilityState === "hidden") setHiddenMediaSessionPlay(5000);
        else clearHiddenMediaSessionPlay();

        markMediaAction("play");
        markUserPlayIntent(1400);
        state.intendedPlaying = true;
        updateMediaSessionPlaybackState();
        setPauseEventGuard(2200);
        setMediaPlayTxn(2200);
        setFastSync(2400);
        state.audioPauseUntil = 0;
        state.audioPlayUntil = 0;
        state.startupAudioHoldUntil = 0;

        const resumePos = getBestResumePosition();
        const currentVT = (() => { try { return Number(video.currentTime()); } catch { return 0; } })();
        const currentAT = coupledMode ? (() => { try { return Number(audio.currentTime); } catch { return 0; } })() : resumePos;

        const needsSeek = resumePos > 0.5 && (
          currentVT < 0.5 || currentAT < 0.5 || Math.abs(resumePos - currentVT) > 1.0
        );

        if (needsSeek) {
          squelchAudioEvents(600);
          safeSetVideoTime(resumePos);
          if (coupledMode) safeSetCT(audio, resumePos);
        } else if (coupledMode && isFinite(currentVT) && isFinite(currentAT) && Math.abs(currentAT - currentVT) > 0.3) {
          squelchAudioEvents(400);
          safeSetCT(audio, currentVT);
        }

        ensureAudioPlaybackRate();
        resetDriftTracking();

        let playPromise = null, audioPromise = null;
        try { playPromise = execProgrammaticVideoPlay(); } catch {}
        if (coupledMode && hiddenMediaSessionPlayActive()) {
          try {
            audioPromise = execProgrammaticAudioPlay({ squelchMs: 520, minGapMs: 0, force: true });
          } catch {}
        }

        Promise.allSettled([playPromise, audioPromise]).finally(() => {
          if (serial !== state.mediaSessionActionSerial) return;
          // Use requestAnimationFrame for immediate response, no artificial delay
          requestAnimationFrame(() => {
            if (serial !== state.mediaSessionActionSerial) return;
            if (!state.intendedPlaying || userPauseLockActive()) return;
            playTogether().catch(() => {});
          });
        });
      });

      navigator.mediaSession.setActionHandler("pause", handlePauseLike);
      try { navigator.mediaSession.setActionHandler("stop", handlePauseLike); } catch {}

      navigator.mediaSession.setActionHandler("seekforward", d => {
        const inc = Number(d?.seekOffset) || 10;
        const newTime = Math.min((video.currentTime() || 0) + inc, Number(video.duration()) || 0);
        video.currentTime(newTime);
        // Also seek audio for Android seekbar support
        if (coupledMode) safeSetCT(audio, newTime);
      });
      navigator.mediaSession.setActionHandler("seekbackward", d => {
        const dec = Number(d?.seekOffset) || 10;
        const newTime = Math.max((video.currentTime() || 0) - dec, 0);
        video.currentTime(newTime);
        if (coupledMode) safeSetCT(audio, newTime);
      });
      navigator.mediaSession.setActionHandler("seekto", d => {
        if (!d || typeof d.seekTime !== "number") return;
        const newTime = Math.max(0, Math.min(Number(video.duration()) || 0, d.seekTime));
        video.currentTime(newTime);
        // Critical for Android Chrome seekbar: also seek audio element
        if (coupledMode) {
          squelchAudioEvents(400);
          safeSetCT(audio, newTime);
        }
      });
    } catch {}
  }

  // ─── Media event bindings ─────────────────────────────────────────────────
  function bindCommonMediaEvents() {
    video.on("ratechange", () => {
      if (!coupledMode) return;
      try {
        // Keep audio rate in sync with video rate — but this is the ONLY
        // place we change audio.playbackRate. Never change it for drift correction.
        ensureAudioPlaybackRate();
        resetDriftTracking();
      } catch {}
    });

    video.on("play", () => {
      if (state.restarting || state.isProgrammaticVideoPlay) return;
      if ((!state.intendedPlaying || userPauseLockActive() || mediaSessionForcedPauseActive()) &&
          !userPlayIntentActive() && !state.startupKickInFlight && !wantsStartupAutoplay()) {
        execProgrammaticVideoPause();
        return;
      }
      clearMediaSessionForcedPause();
      state.intendedPlaying = true;
      markMediaAction("play");
      setFastSync(1800);
      forceUnmuteForPlaybackIfAllowed();
      updateAudioGainImmediate();
      updateMediaSessionPlaybackState();
      if (userPlayIntentActive()) state.userPlayUntil = 0;
      if (!state.startupPrimed && coupledMode) {
        maybePrimeStartup();
        scheduleSync(0);
        return;
      }
      playTogether().catch(() => {});
    });

    video.on("pause", () => {
      if (state.restarting || state.isProgrammaticVideoPause) return;
      if (state.seeking) return;
      if (shouldTreatVisiblePauseAsUserPause()) {
        state.intendedPlaying = false;
        updateMediaSessionPlaybackState();
        pauseHard();
        return;
      }
      if (shouldIgnorePauseAsTransient()) {
        if (state.intendedPlaying && document.visibilityState === "hidden" && platform.useBgControllerRetry) {
          state.resumeOnVisible = true;
        }
        return;
      }
      if (startupAutoplayPauseGraceActive()) {
        maybePrimeStartup();
        scheduleStartupAutoplayKick();
        return;
      }
      if (mediaSessionForcedPauseActive()) return;
      if (document.visibilityState === "hidden" && state.intendedPlaying && platform.useBgControllerRetry) {
        noteBackgroundEntry();
        state.resumeOnVisible = true;
        return;
      }
      pauseTogether();
    });

    video.on("waiting", () => {
      state.videoWaiting = true;
      if (!state.intendedPlaying || state.restarting) return;
      if (!state.startupPrimed || state.startupKickInFlight || (state.startupPhase && !state.firstPlayCommitted)) return;
      if (document.visibilityState === "hidden" && platform.useBgControllerRetry) {
        state.resumeOnVisible = true;
        return;
      }
      // Don't immediately enter buffer hold — let evaluateBufferHoldNeed confirm it
      scheduleSync(0);
    });

    video.on("playing", () => {
      state.videoWaiting = false;
      state.startupAudioHoldUntil = 0;
      if ((!state.intendedPlaying || userPauseLockActive() || mediaSessionForcedPauseActive()) && !userPlayIntentActive()) {
        if (wantsStartupAutoplay() || (now() - state.startupPrimeStartedAt) < 2200) {
          clearMediaSessionForcedPause();
          state.intendedPlaying = true;
          markMediaAction("play");
          updateMediaSessionPlaybackState();
        } else {
          execProgrammaticVideoPause();
          return;
        }
      }
      updateLastKnownGoodVT();
      if (platform.chromiumOnlyBrowser) {
        state.chromiumAudioStartLockUntil = 0;
        state.chromiumBgSettlingUntil = Math.max(state.chromiumBgSettlingUntil, now() + 320);
      }
      setFastSync(1600);
      if (coupledMode && state.intendedPlaying && audio.paused &&
          !state.seeking && !state.syncing && !state.strictBufferHold && !shouldBlockNewAudioStart()) {
        playTogether().catch(() => {});
      } else {
        scheduleSync(0);
      }
    });

    if (!coupledMode) return;

    const onAudioPlay = () => {
      if (audioEventsSquelched() || state.restarting || state.isProgrammaticAudioPlay || state.isProgrammaticVideoPlay) return;
      if (now() < state.audioPlayUntil || now() < state.audioPauseUntil) return;
      if ((!state.intendedPlaying || userPauseLockActive() || mediaSessionForcedPauseActive() || shouldBlockNewAudioStart()) && !userPlayIntentActive()) {
        squelchAudioEvents(220);
        try { audio.pause(); } catch {}
        return;
      }
      state.audioEverStarted = true;
      clearMediaSessionForcedPause();
      state.intendedPlaying = true;
      markMediaAction("play");
      setFastSync(1600);
      forceUnmuteForPlaybackIfAllowed();
      updateAudioGainImmediate();
      updateMediaSessionPlaybackState();
      if (!state.startupPrimed) { maybePrimeStartup(); scheduleSync(0); return; }
      if (!state.syncing && !state.seeking && getVideoPaused()) playTogether().catch(() => {});
      else scheduleSync(0);
    };

    const onAudioPause = () => {
      if (audioEventsSquelched() || state.restarting || state.isProgrammaticAudioPause || state.isProgrammaticVideoPause) return;
      if (now() < state.audioPauseUntil || now() < state.audioPlayUntil) return;
      if (state.seeking || state.silentBgSync) return;
      if (shouldTreatVisiblePauseAsUserPause()) {
        state.intendedPlaying = false;
        updateMediaSessionPlaybackState();
        pauseHard();
        return;
      }
      if (shouldIgnorePauseAsTransient()) {
        if (state.intendedPlaying && document.visibilityState === "hidden" && platform.useBgControllerRetry) {
          state.resumeOnVisible = true;
        }
        return;
      }
      if (startupAutoplayPauseGraceActive()) {
        maybePrimeStartup();
        scheduleStartupAutoplayKick();
        return;
      }
      if (mediaSessionForcedPauseActive()) return;
      if (document.visibilityState === "hidden" && state.intendedPlaying && platform.useBgControllerRetry) {
        noteBackgroundEntry();
        state.resumeOnVisible = true;
        return;
      }
      pauseTogether();
    };

    const onReadyish = () => {
      maybePrimeStartup();
      if (!state.intendedPlaying || state.restarting || state.seeking) return;
      if (mediaSessionForcedPauseActive()) return;
      const t = Number(video.currentTime());
      if (bothPlayableAt(t) || (!state.audioEverStarted && canStartAudioAt(t))) {
        if (!inMediaTxnWindow() && document.visibilityState === "visible") scheduleSync(0);
      }
    };

    audio.addEventListener("play", onAudioPlay, { passive: true });
    audio.addEventListener("pause", onAudioPause, { passive: true });

    audio.addEventListener("seeking", () => {
      if (state.restarting || !state.seeking) return;
      execProgrammaticVideoPause();
      execProgrammaticAudioPause(300);
    }, { passive: true });

    audio.addEventListener("seeked", () => {
      if (state.restarting || !state.seeking) return;
      ensureAudioPlaybackRate();
      resetDriftTracking();
      scheduleSeekFinalize(0);
    }, { passive: true });

    audio.addEventListener("ended", () => {
      if (state.restarting) return;
      if (now() < state.suppressEndedUntil) return;
      if (isLoopDesired()) restartLoop().catch(() => {});
      else pauseTogether();
    }, { passive: true });

    audio.addEventListener("canplay", onReadyish, { passive: true });
    audio.addEventListener("canplaythrough", onReadyish, { passive: true });
    audio.addEventListener("loadeddata", onReadyish, { passive: true });

    videoEl.addEventListener("canplay", () => { state.videoWaiting = false; onReadyish(); }, { passive: true });
    videoEl.addEventListener("canplaythrough", onReadyish, { passive: true });
    videoEl.addEventListener("loadeddata", onReadyish, { passive: true });

    video.on("seeking", () => {
      if (state.restarting) return;
      state.strictBufferHold = false;
      state.strictBufferReason = "";
      state.strictBufferHoldFrames = 0;
      state.seeking = true;
      state.seekWantedPlaying = state.intendedPlaying;
      clearSeekSyncFinalizeTimer();
      const seekTime = Number(video.currentTime());
      execProgrammaticVideoPause();
      execProgrammaticAudioPause(320);
      if (isFinite(seekTime)) {
        squelchAudioEvents(420);
        safeSetCT(audio, seekTime);
      }
      ensureAudioPlaybackRate();
      resetDriftTracking();
      setFastSync(2200);
      scheduleSync(0);
    });

    video.on("seeked", () => {
      if (state.restarting) return;
      const newTime = Number(video.currentTime());
      squelchAudioEvents(420);
      safeSetCT(audio, newTime);
      ensureAudioPlaybackRate();
      resetDriftTracking();
      scheduleSeekFinalize(0);
    });

    video.on("ended", () => {
      if (state.restarting) return;
      if (now() < state.suppressEndedUntil) return;
      if (isLoopDesired()) restartLoop().catch(() => {});
      else pauseTogether();
    });
  }

  // ─── Loop restart ─────────────────────────────────────────────────────────
  async function restartLoop() {
    if (state.restarting) return;
    state.restarting = true;
    try {
      clearSyncLoop();
      pauseHard();
      const startAt = 0;
      state.suppressEndedUntil = now() + 1000;
      safeSetCT(videoEl, startAt);
      if (coupledMode) await softAlignAudioTo(startAt);
      ensureAudioPlaybackRate();
      resetDriftTracking();
      state.startupAudioAligned = false; // will be re-aligned on next play
      state.intendedPlaying = true;
      markMediaAction("play");
      setFastSync(2000);
      forceUnmuteForPlaybackIfAllowed();
      updateAudioGainImmediate();
      updateMediaSessionPlaybackState();
      await ensureUnmutedIfNotUserMuted();
      await new Promise(r => requestAnimationFrame(r));
      await playTogether();
    } finally { state.restarting = false; }
  }

  // ─── Visibility lifecycle ─────────────────────────────────────────────────
  function setupVisibilityLifecycle() {
    try {
      document.addEventListener("freeze", () => {
        if (!platform.useBgControllerRetry) return;
        if (state.intendedPlaying) {
          noteBackgroundEntry();
          state.resumeOnVisible = true;
          clearSyncLoop();
        }
      }, { passive: true, capture: true });
      document.addEventListener("resume", () => {
        if (!platform.useBgControllerRetry) return;
        if (document.visibilityState === "visible" && state.intendedPlaying) {
          silentBgCatchUp().catch(() => {});
        }
      }, { passive: true, capture: true });
    } catch {}

    try {
      window.addEventListener("pageshow", e => {
        if (!platform.useBgControllerRetry) return;
        if (e && e.persisted && state.intendedPlaying) silentBgCatchUp().catch(() => {});
      }, { passive: true, capture: true });
    } catch {}

    window.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        clearHiddenMediaSessionPlay();
        state.bgAutoResumeSuppressed = false;
        state.startupAudioHoldUntil = 0;
        state.bgTransitionInProgress = false;

        if (platform.chromiumOnlyBrowser) {
          state.chromiumBgSettlingUntil = Math.max(state.chromiumBgSettlingUntil, now() + 600);
          state.chromiumAudioStartLockUntil = Math.max(state.chromiumAudioStartLockUntil, now() + 300);
        }

        // Resume AudioContext if suspended (required on some browsers)
        resumeAudioContext();

        if (state.intendedPlaying) {
          if (platform.useBgControllerRetry) {
            if (state.bgHiddenWasPlaying || state.resumeOnVisible) {
              // Use seamless catch-up for Chromium/WebKit — avoids visible pause/play
              seamlessBgCatchUp().catch(() => {});
            } else {
              silentBgCatchUp().catch(() => {});
            }
          } else {
            state.resumeOnVisible = false;
            state.bgHiddenWasPlaying = false;
            setFastSync(600);
            scheduleSync(0);
          }
        }
      } else {
        // Going to background
        updateLastKnownGoodVT();
        state.bgTransitionInProgress = true;

        if (platform.useBgControllerRetry) {
          // Don't issue any pause commands on background entry.
          // Just record position and let the browser handle it.
          noteBackgroundEntry();
          state.bgAutoResumeSuppressed = true;
          if (state.intendedPlaying) state.resumeOnVisible = true;
        } else {
          state.bgAutoResumeSuppressed = false;
          state.resumeOnVisible = false;
          state.bgHiddenWasPlaying = false;
        }
      }
    }, { passive: true, capture: true });

    window.addEventListener("beforeunload", () => {
      clearBgResumeRetryTimer();
      clearResumeAfterBufferTimer();
      clearSeekSyncFinalizeTimer();
      clearStartupAutoplayRetryTimer();
      clearSyncLoop();
    });
  }

  // ─── Init ─────────────────────────────────────────────────────────────────
  setupUserPauseIntentDetection();
  setupMediaSession();
  bindCommonMediaEvents();
  setupVisibilityLifecycle();

  // Setup Web Audio API for pop-free audio control
  if (coupledMode && audio) {
    try {
      ensureAudioContext();
      // Defer connection until first user interaction (required by browser autoplay policy)
      const connectOnInteraction = () => {
        resumeAudioContext();
        connectAudioToContext();
        document.removeEventListener("click", connectOnInteraction);
        document.removeEventListener("touchstart", connectOnInteraction);
        document.removeEventListener("keydown", connectOnInteraction);
      };
      document.addEventListener("click", connectOnInteraction, { once: true, passive: true });
      document.addEventListener("touchstart", connectOnInteraction, { once: true, passive: true });
      document.addEventListener("keydown", connectOnInteraction, { once: true, passive: true });
      // Also try immediate connection (works if page already had interaction)
      connectAudioToContext();
    } catch {}
  }

  if (coupledMode) {
    try { audio.preload = "auto"; audio.load(); } catch {}

    const maybeStart = () => maybePrimeStartup();
    const bindStartupOnce = (el, type) => {
      const fn = () => {
        if (state.startupPrimed) { try { el.removeEventListener(type, fn); } catch {} return; }
        maybeStart();
        if (state.startupPrimed) { try { el.removeEventListener(type, fn); } catch {} }
      };
      try { el.addEventListener(type, fn, { passive: true }); } catch {}
    };
    bindStartupOnce(audio, "loadeddata");
    bindStartupOnce(audio, "loadedmetadata");
    bindStartupOnce(audio, "canplay");
    bindStartupOnce(videoEl, "loadeddata");
    bindStartupOnce(videoEl, "loadedmetadata");
    bindStartupOnce(videoEl, "canplay");
  }

  video.on("volumechange", () => {
    updateAudioGainImmediate();
    state.userMutedVideo = !!video.muted();
  });

  if (coupledMode) {
    try {
      audio.addEventListener("volumechange", () => {
        state.userMutedAudio = !!audio.muted;
      }, { passive: true });
    } catch {}
  }

  if (!coupledMode) {
    try {
      video.on("play", () => {
        if ((!state.intendedPlaying || userPauseLockActive() || mediaSessionForcedPauseActive()) &&
            !userPlayIntentActive() && !wantsStartupAutoplay()) {
          execProgrammaticVideoPause();
          return;
        }
        if (userPlayIntentActive()) state.userPlayUntil = 0;
        state.intendedPlaying = true;
        updateMediaSessionPlaybackState();
      });
      video.on("pause", () => {
        if (startupAutoplayPauseGraceActive()) return;
        if (shouldTreatVisiblePauseAsUserPause()) {
          state.intendedPlaying = false;
          updateMediaSessionPlaybackState();
          pauseHard();
          return;
        }
        state.intendedPlaying = false;
        updateMediaSessionPlaybackState();
        queueHardPauseVerification();
      });
    } catch {}
  }

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