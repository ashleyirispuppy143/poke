// in the beginning.... god made mrrprpmnaynayaynaynayanyuwuuuwmauwnwanwaumawp :p
 
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
 * /////////////////////////////////////////////////////////////////////////////////////
 * credits:
 * thanks stackoverflow, Claude Opus 4.6, Codex, w3c schools, mdn and more for help in the code for poke player.
 * 100% puppy made code! 0 slop guarenteed!
 * also, legit fuck claude's weekly limit #antrophicdobetter #wokeai or something i have no idea,,,they are making claude have pronouns(???)
 * this works, 100%! no issues..at all!!
 * UNDER GPL 3-OR-LATER license, but i think video.js istelf is Apache 2.0, so basically this code, the players code is gpl3, u get wha we mean :3
 * gay!
 * ///////////////////////////////////////////////////////////////////////////
 * "It takes a lot of hard work to make something simple." ~ Steve Jobs 
 */

 
 
//////////////// THE PLAYER, START ////////////////////////
try {
  if (typeof window.__playerStartupZeroSuppressedUntil !== "number") {
    window.__playerStartupZeroSuppressedUntil = 0;
  }
  const _startupZeroSuppressed = () => {
    try { return Number(window.__playerStartupZeroSuppressedUntil) > performance.now(); } catch { return false; }
  };
  const _earlyVideo = document.getElementById("video");
  const _earlyAudio = document.getElementById("aud");
  if (_earlyVideo && !_startupZeroSuppressed()) { _earlyVideo.currentTime = 0; }
  if (_earlyAudio && !_startupZeroSuppressed()) { _earlyAudio.currentTime = 0; }
  if (_earlyAudio) {
    try { _earlyAudio.preload = "auto"; } catch {}
    try {
      const _earlyAudioSrc =
        (_earlyAudio.getAttribute?.("src") ||
        _earlyAudio.querySelector?.("source")?.getAttribute?.("src") ||
        "").trim();
      if (_earlyAudioSrc) _earlyAudio.load();
    } catch {}
  }
  // Also strip loop attribute early to prevent browser-native looping
  if (_earlyVideo) { _earlyVideo.removeAttribute("loop"); _earlyVideo.loop = false; }
  // Re-check on loadedmetadata (browser can move currentTime after our zero-set)
  const _earlyZero = (el) => {
    if (!el) return;
    const _handler = () => {
      if (_startupZeroSuppressed()) {
        el.removeEventListener("loadedmetadata", _handler);
        return;
      }
      try { if (el.currentTime > 0.5) el.currentTime = 0; } catch {}
      el.removeEventListener("loadedmetadata", _handler);
    };
    el.addEventListener("loadedmetadata", _handler, { passive: true, once: true });
  };
  _earlyZero(_earlyVideo);
  _earlyZero(_earlyAudio);
} catch {}

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

  let cachedInnerVideoEl = null;
  function getPlayableVideoEl() {
    try {
      if (videoEl && typeof videoEl.play === "function") return videoEl;
    } catch {}
    try {
      if (cachedInnerVideoEl && typeof cachedInnerVideoEl.play === "function") return cachedInnerVideoEl;
      const inner = video?.el?.()?.querySelector?.("video");
      if (inner && typeof inner.play === "function") {
        cachedInnerVideoEl = inner;
        return inner;
      }
    } catch {}
    return null;
  }
  function getVideoNode() {
    return getPlayableVideoEl() || videoEl;
  }
  function getVideoPaused() {
    try {
      if (typeof video.paused === "function") return !!video.paused();
    } catch {}
    try {
      return !!getVideoNode().paused;
    } catch {}
    return true;
  }
  function getVideoReadyState() {
    try {
      return Number(getVideoNode().readyState || 0);
    } catch {}
    return 0;
  }
  function getVideoPresentedFrameCount(vNode = null) {
    const v = vNode || getVideoNode();
    if (!v) return NaN;
    try {
      if (typeof v.getVideoPlaybackQuality === "function") {
        const q = v.getVideoPlaybackQuality();
        const frames = Number(q?.totalVideoFrames ?? q?.presentedFrames ?? q?.totalFrames);
        if (isFinite(frames) && frames >= 0) return frames;
      }
    } catch {}
    try {
      const wk = Number(v.webkitDecodedFrameCount);
      if (isFinite(wk) && wk >= 0) return wk;
    } catch {}
    try {
      const moz = Number(v.mozPresentedFrames);
      if (isFinite(moz) && moz >= 0) return moz;
    } catch {}
    return NaN;
  }
  const platform = (() => {
    try {
      const isFirefox = (() => {
        try { return CSS.supports("-moz-orient", "horizontal"); } catch { return false; }
      })();
      const isChromium = (() => {
        if (isFirefox) return false;
        try {
          const hasChrome = typeof window.chrome !== "undefined" && window.chrome !== null;
          // "overflow: overlay" was removed in Chromium 114+. Use multiple signals instead.
          const hasChromiumAPI = !!(window.chrome?.runtime || window.chrome?.csi || window.chrome?.loadTimes);
          const hasBlink = !!window.CSS?.highlights || (typeof CSS !== "undefined" && CSS.supports?.("color", "oklch(0% 0 0)"));
          return hasChrome || hasChromiumAPI || (hasBlink && !isFirefox);
        } catch { return false; }
      })();
      const isIosWebKit = (() => {
        // Firefox on iOS is actually WebKit (Apple mandates it), so don't skip it
        try {
          return (typeof GestureEvent !== "undefined" && navigator.maxTouchPoints > 1);
        } catch { return false; }
      })();
      const mobile = (() => {
        try {
          if (typeof navigator.userAgentData?.mobile === "boolean") {
            return navigator.userAgentData.mobile;
          }
        } catch {}
        try {
          return navigator.maxTouchPoints > 0 && window.matchMedia("(pointer: coarse)").matches;
        } catch {}
        return false;
      })();
      const chromiumOnlyBrowser = isChromium;
      const problemMobileBrowser = (isChromium && mobile) || isIosWebKit;
      const useBgControllerRetry = !isFirefox && (isChromium || isIosWebKit);
      return {
        mobile: !!mobile,
        ios: !!isIosWebKit,
        android: !!(isChromium && mobile && !isIosWebKit),
                    isFirefox: !!isFirefox,
                    isChromium: !!isChromium,
                    androidChromium: !!(isChromium && mobile && !isIosWebKit),
                    iosWebKitLike: !!isIosWebKit,
                    problemMobileBrowser: !!problemMobileBrowser,
                    desktopChromiumLike: !!(isChromium && !mobile),
                    chromiumOnlyBrowser: !!chromiumOnlyBrowser,
                    useBgControllerRetry: !!useBgControllerRetry
      };
    } catch {
      return {
        mobile: false, ios: false, android: false, isFirefox: false, isChromium: false,
        androidChromium: false, iosWebKitLike: false, problemMobileBrowser: false,
        desktopChromiumLike: false, chromiumOnlyBrowser: false, useBgControllerRetry: false
      };
    }
  })();
  const pickAudioSrc = () => {
    const s = audio?.getAttribute?.("src");
    if (s) return s;
    const child = audio?.querySelector?.("source");
    if (child?.getAttribute?.("src")) return child.getAttribute("src");
    if (audio?.currentSrc) return audio.currentSrc;
    return null;
  };
  const hasExternalAudio = !!audio && audio.tagName === "AUDIO" && !!pickAudioSrc();
  // isMuxedVideo: true when the video is a single muxed file (audio+video combine
  const isMuxedVideo = (() => {
    if (qua === "medium") return true;
    // Also detect quality=low, quality=sd, etc.
    const quaLower = qua.toLowerCase();
    if (quaLower === "low" || quaLower === "sd" || quaLower === "sd360" || quaLower === "sd480" ||
      quaLower === "360" || quaLower === "480" || quaLower === "360p" || quaLower === "480p") return true;
    try {
      // Helper: check if a label string indicates SD/muxed content
      const isSDLabel = (lbl) => {
        if (!lbl) return false;
        const l = lbl.toLowerCase().trim();
        return l === "sd360" || l === "sd480" ||
        l.startsWith("sd") ||
        l === "360p" || l === "480p" || l === "240p" || l === "144p" ||
        l.includes("360") || l.includes("480") || l.includes("240") || l.includes("144") ||
        l.includes("mux") || l.includes("muxed") || l === "low" || l === "medium";
      };

      // Check all <source> children of the video element for SD/muxed labels
      // First pass: only selected sources
      const sources = videoEl?.querySelectorAll?.("source") || [];
      let hasSelectedSource = false;
      for (const src of sources) {
        const selected = src.getAttribute("selected");
        if (selected === "true" || selected === "selected" || selected === "") {
          hasSelectedSource = true;
          if (isSDLabel(src.getAttribute("label") || src.getAttribute("res") ||
            src.getAttribute("data-quality") || src.getAttribute("data-label"))) return true;
        }
      }
      // Second pass: if no source has selected="true", check ALL sources
      // (some setups don't set selected attribute — if all sources are SD, it's muxed)
      if (!hasSelectedSource && sources.length > 0) {
        let allSD = true;
        for (const src of sources) {
          const lbl = src.getAttribute("label") || src.getAttribute("res") ||
          src.getAttribute("data-quality") || src.getAttribute("data-label") || "";
          if (lbl && !isSDLabel(lbl)) { allSD = false; break; }
          if (!lbl) { allSD = false; break; } // unknown label = can't assume SD
        }
        if (allSD && sources.length > 0) return true;
        // Also check the currently-active source (first source or src attribute)
        const activeSrc = videoEl.currentSrc || videoEl.getAttribute("src") || "";
        // URL-based detection: SD URLs often contain resolution markers
        if (activeSrc) {
          const urlLower = activeSrc.toLowerCase();
          if (/[/_.-](360p?|480p?|240p?|144p?|sd)[/_.-]/.test(urlLower)) return true;
          if (/quality[=_](medium|low|sd)/.test(urlLower)) return true;
        }
      }
      // Also check video.js sources API if available
      if (typeof video?.currentSources === "function") {
        const vjsSrcs = video.currentSources() || [];
        for (const s of vjsSrcs) {
          if (isSDLabel(s.label || s.res || "")) return true;
        }
      }
      // Check video.js currentSource label
      try {
        if (typeof video?.currentSource === "function") {
          const cs = video.currentSource();
          if (cs && isSDLabel(cs.label || cs.res || "")) return true;
        }
      } catch {}
      // Check if audio element has no real distinct source from the video.
      // If audio src === video src (same muxed file in both elements), or audio src is
      // empty/blank/missing, there is no separate audio stream to synchronize.
      if (audio) {
        const aSrc = (audio.getAttribute?.("src") || audio.currentSrc || "").trim();
        const vSrc = (videoEl?.getAttribute?.("src") || videoEl?.currentSrc || "").trim();
        // Empty, whitespace-only, or bare href (just the page URL) → no audio stream
        if (!aSrc || aSrc === "" || aSrc === window.location.href) return true;
        // Audio src is a blob: with no real content, or data: URI → likely placeholder
        if (aSrc.startsWith("blob:") && aSrc.length < 20) return true;
        if (aSrc.startsWith("data:")) return true;
        // Audio and video pointing at the same file → muxed
        if (aSrc && vSrc && aSrc === vSrc) return true;
        // Also check video.js current src
        try {
          const vjsVSrc = (typeof video?.currentSrc === "function" ? video.currentSrc() : video?.currentSrc || "");
          if (aSrc && vjsVSrc && aSrc === vjsVSrc) return true;
        } catch {}
        // Check if audio element is in error state already (src set but invalid)
        try {
          if (audio.error && audio.error.code) return true;
          if (audio.networkState === 3) return true; // NETWORK_NO_SOURCE
        } catch {}
      }
    } catch {}
    return false;
  })();
  let coupledMode = hasExternalAudio && !isMuxedVideo;
  // When audio element exists but has no source (e.g. quality=medium sets src=""),
  // silence and disable it immediately so it can never interfere with video playback,
  // audio focus/session, or event handling.
  if (!coupledMode && audio) {
    try { audio.muted = true; audio.volume = 0; } catch {}
    try { audio.preload = "none"; } catch {}
    // Ensure it can never accidentally play
    try { if (!audio.paused) audio.pause(); } catch {}
  }
  // --- loop: use native videoEl.loop as the source of truth.
  // Fix: some pages / Video.js configs set the "loop" attribute on the <video> tag
  // unintentionally. Strip it on startup so videos don't auto-restart unless
  // loop is explicitly set AFTER init by application code.
  // This preserves loop functionality for when it's actually wanted.
  try { videoEl.loop = false; } catch {}
  try { videoEl.removeAttribute("loop"); } catch {}
  // Also strip from Video.js inner element (it creates a new <video> inside its container)
  video.ready(() => {
    try {
      const inner = video.el()?.querySelector?.("video");
      if (inner && inner !== videoEl) {
        inner.loop = false;
        try { inner.removeAttribute("loop"); } catch {}
      }
    } catch {}
  });
  function isLoopDesired() {
    try { return videoEl.loop; } catch { return false; }
  }
  // THE ROOT CAUSE OF PHANTOM LOOPING:
  // Video.js's "autoplay: true" config causes it to call play() after ended.
  // The <video autoplay> attribute tells the BROWSER to restart after ended too.
  // Both of these restart the video even when loop=false. We must strip autoplay
  // from both Video.js config and the DOM element AFTER the first play commits,
  // and also intercept Video.js's internal autoplay() method.
  let _autoplayStripped = false;
  function stripAutoplayAfterFirstPlay() {
    if (_autoplayStripped) return;
    _autoplayStripped = true;
    // Remove the autoplay attribute from ALL video elements
    try { videoEl.removeAttribute("autoplay"); videoEl.autoplay = false; } catch {}
    try {
      const inner = video.el()?.querySelector?.("video");
      if (inner && inner !== videoEl) {
        inner.removeAttribute("autoplay");
        inner.autoplay = false;
      }
    } catch {}
    // Kill Video.js INTERNAL autoplay config — this is the #1 cause of phantom loops.
    // Video.js stores autoplay in options_ and checks it from handleTechReady_, techReady_,
    // and other internal methods. Just overriding the .autoplay() method is NOT enough —
    // Video.js bypasses it and reads options_ directly.
    try { if (video.options_) video.options_.autoplay = false; } catch {}
    try { if (video.autoplay_) video.autoplay_ = false; } catch {}
    try { if (video.options) video.options.autoplay = false; } catch {}
    // Kill on tech layer too
    try {
      const tech = video.tech_;
      if (tech) {
        try { if (tech.options_) tech.options_.autoplay = false; } catch {}
        try { if (tech.autoplay_) tech.autoplay_ = false; } catch {}
        try { const tel = tech.el_; if (tel) { tel.removeAttribute("autoplay"); tel.autoplay = false; } } catch {}
      }
    } catch {}
    // Override Video.js autoplay to return false after first play
    try {
      if (typeof video.autoplay === "function") {
        video.autoplay = function(val) {
          if (arguments.length === 0) return false;
          return false;
        };
      }
    } catch {}
    // Patch video.play() itself to block phantom restarts after ended
    try {
      const _origVjsPlay = video.play.bind(video);
      video.play = function() {
        if (state.endedNaturally && !state.restarting && !isLoopDesired()) {
          // endedNaturally should already be cleared by onUserPlay() from
          // onPressStart/markUserPlayIntent BEFORE this runs (capture phase).
          // If we're here with endedNaturally still true, it's a programmatic
          // call — block it unconditionally.
          return Promise.resolve();
        }
        return _origVjsPlay();
      };
    } catch {}
  }
  video.ready(() => {
    const metaTitle = document.querySelector('meta[name="title"]')?.content || "";
    const metaDesc = document.querySelector('meta[name="twitter:description"]')?.content || "";
    let stats = "";
    const statsMatch = metaDesc.match(/👍\s*[\d.KMB]+\s*(?:\|)?\s*👎\s*[\d.KMB]+\s*(?:\|)?\s*📈\s*[\d.KMB]+\s*(?:Views?)?/i);
    if (statsMatch) {
      stats = statsMatch[0].replace(/\s*\|\s*/g, " | ").trim();
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
        if (fs) createTitleBar();
        else removeTitleBar();
      };
        document.addEventListener("fullscreenchange", onFullscreenChange, { passive: true });
        document.addEventListener("webkitfullscreenchange", onFullscreenChange, { passive: true });
        onFullscreenChange();
  });

  const state = {
    intendedPlaying: false,
    playSessionId: 0,
    restarting: false,
    syncing: false,
    seeking: false,
    seekId: 0,
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
    strictBufferHoldConfirmed: false,
    videoWaiting: false,
    suppressEndedUntil: 0,
    isProgrammaticVideoPlay: false,
    isProgrammaticVideoPause: false,
    isProgrammaticAudioPlay: false,
    isProgrammaticAudioPause: false,
    audioEventsSquelchedUntil: 0,
    audioPlayInFlight: null,
    videoPlayInFlight: null,
    videoPlayUntil: 0,
    audioPlayGeneration: 0,
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
    bgCatchUpCooldownUntil: 0,
    bgResumeInFlight: false,
    seekResumeInFlight: false,
    seekResumeStartedAt: 0,
    seekFinalizeTimer: null,
    seekWatchdogTimer: null,
    lastAT: 0,
    audioLastProgressTs: 0,
    lastVT: 0,
    lastVTts: 0,
    audioKickCooldownUntil: 0,
    videoRepairing: false,
    videoRepairCooldownUntil: 0,
    hardPauseVerifySerial: 0,
    startupPrimeStartedAt: performance.now(),
    lastKnownGoodVT: 0,
    lastKnownGoodVTts: 0,
    startupAutoplayRetryTimer: null,
    startupAutoplayRetryCount: 0,
    driftStableFrames: 0,
    lastDrift: 0,
    bgTransitionInProgress: false,
    audioRateNudgeActive: false,
    audioRateNudgeUntil: 0,
    syncConvergenceCount: 0,
    lastSyncDrift: 0,
    backgroundPauseBlocked: false,
    mediaControlPending: false,
    initialSyncComplete: false,
    audioPopPreventUntil: 0,
    audioFading: false,
    audioFadeTarget: 1,
    audioLastPlayPauseTs: 0,
    initialSyncDone: false,
    bufferHoldIntendedPlaying: false,
    mediaSessionInitiatedPlay: false,
    hiddenPlayRequestUntil: 0,
    foregroundResumeBoostUntil: 0,
    pendingSeekTarget: null,
    nearZeroSeekAuthorizedUntil: 0,
    playRequestedDuringSeek: false,
    seekCompleted: false,
    seekKickAudioAllowedUntil: 0,
    seekAudioKickAt: 0,
    seekAudioMustStartUntil: 0,
    seekResumeWantedUntil: 0,
    seekStabilizeUntil: 0,
    audioVolumeBeforePause: 1,
    stateChangeCooldownUntil: 0,
    audioFadeCompleteUntil: 0,
    chromiumBgPauseBlockedUntil: 0,
    tabVisibilityChangeUntil: 0,
    audioGainSmoothUntil: 0,
    chromiumBgPauseBlockedUntilExtended: 0,
    visibilityTransitionActive: false,
    visibilityTransitionUntil: 0,
    lastVisibilityState: "visible",
    previousVisibilityState: "visible",
    bgPauseSuppressionCount: 0,
    bgPauseSuppressionResetAt: 0,
    mediaSessionPauseBlockedUntil: 0,
    rapidToggleDetected: false,
    rapidToggleUntil: 0,
    altTabTransitionActive: false,
    altTabTransitionUntil: 0,
    lastFocusLoss: 0,
    focusLossCount: 0,
    focusLossResetAt: 0,
    chromiumAutoPauseBlockedUntil: 0,
    chromiumPauseEventSuppressedUntil: 0,
    lastPauseEventTs: 0,
    pauseEventCount: 0,
    pauseEventResetAt: 0,
    visibilityStableUntil: 0,
    focusStableUntil: 0,
    mediaSessionOverrideActive: false,
    audioVolumeLocked: false,
    audioSafeMuteUntil: 0,
    seekAudioSyncPending: false,
    seekAudioSyncTime: 0,
    seekAudioSyncUntil: 0,
    bgPlaybackAllowed: true,
    startupBgRetryCount: 0,
    bgPlayAttempted: false,
    audioVolumeBeforeTimeChange: 1,
    audioZeroVolumeConfirmed: false,
    rapidPlayPauseCount: 0,
    rapidPlayPauseResetAt: 0,
    // Separate user-click spam tracker — only counts deliberate pointer/key events,
    // NOT background/auto play-pause events. Used for audio protection.
    userClickSpamCount: 0,
    userClickSpamWindowStart: 0,
    userClickSpamActive: false,
    userClickSpamUntil: 0,
    userToggleTxnUntil: 0,
    userToggleExpectedPlay: null,
    audioPlayAttemptCount: 0,
    audioPlayAttemptResetAt: 0,
    backgroundAutoplayTriggered: false,
    audioStartupPlayAttempted: false,
    audioStartupPlayRetries: 0,
    audioForcePlayTimer: null,
    wakeupTimer: null,
    startupZeroed: false,
    startupZeroSuppressedUntil: (() => {
      try { return Number(window.__playerStartupZeroSuppressedUntil) || 0; } catch { return 0; }
    })(),
    startupPlaySettleUntil: 0,
    startupPlaySettled: false,
    startupKickAttempts: 0,
    userGesturePauseIntent: false,
    pageFullyLoaded: document.readyState === "complete",
    bgAudioStartQueued: false,
    bbtabRetryTimer: null,
    bbtabRetryRafId: null,
    bbtabRetryCount: 0,
    bbtabAudioSyncTimer: null,
    bbtabVideoConfirmedAt: 0,
    bbtabAudioSyncDone: false,
    bbtabAudioFallbackDone: false,
    lastUserActionTime: 0,
    lastUserToggleType: "",
    lastUserToggleAt: 0,
    loopPreventionCooldownUntil: 0,
    seekCooldownUntil: 0,
    volumeSaveScheduled: false,
    lastBgReturnAt: 0,
    lastVisibleReturnHandledAt: 0,
    tabReturnGen: 0,
    tabReturnImmuneUntil: 0,
    tabReturnAudioMuted: false,
    tabReturnSettleTimer: null,
    foregroundReturnUserPlayUntil: 0,
    freshForegroundVideoFirstUntil: 0,
    freshForegroundVideoFirstArmedAt: 0,
    freshForegroundVideoFirstBaseVT: 0,
    freshForegroundVideoFirstBaseFrames: NaN,
    bgSuppressionSessionCount: 0,
    // Heartbeat & stall recovery
    heartbeatTimer: null,
    lastHeartbeatAt: 0,
    videoStallSince: 0,
    audioStallSince: 0,
    stallRecoveryUntil: 0,
    networkOnline: typeof navigator.onLine === "boolean" ? navigator.onLine : true,
    networkRecoverUntil: 0,
    audioContextUnlocked: false,
    mediaErrorCount: 0,
    mediaErrorCooldownUntil: 0,
    lastConsistencyCheckAt: 0,
    consistencyCheckPendingPlayUntil: 0,
    // Background silent time sync — prevents seek handler from firing during bg progress-bar sync
    bgSilentTimeSyncing: false,
    bgSilentTimeSyncTimer: null,
    // Timestamp when strictBufferHold last became true — used to force-clear stuck holds
    bufferHoldSince: 0,
    // Was audio paused because video entered a waiting/stall state?
    videoStallAudioPaused: false,
    // Timestamp when videoStallAudioPaused became true (for the stall watchdog)
    stallAudioPausedSince: 0,
    // Last time the stall watchdog ran
    lastStallWatchdogAt: 0,
    // After a video stall pauses audio, don't allow audio resume until this timestamp.
    // This prevents the rapid play/pause loop when video fires playing with thin buffer.
    stallAudioResumeHoldUntil: 0,
    // Short-lived hold armed by the first real visible waiting/stalled event so
    // audio cannot leak underneath video before the older stall flags fully settle.
    foregroundBufferAudioHoldUntil: 0,
    audioWaiting: false,
    audioStallVideoPaused: false,
    _stallVideoPauseTimer: null,
    audioPausedSince: 0,
    audioStartGraceUntil: 0,
    seekTargetTime: 0,
    videoSyncRetryTs: 0,
    // User intent presets — set immediately on pointer events,
    // consumed by play/pause handlers for bulletproof non-coupled/quality=medium support
    userPauseIntentPresetAt: 0,
    userPlayIntentPresetAt: 0,
    userSeekIntentUntil: 0,
    _stallAudioPauseTimer: null,
    seekBuffering: false,
    seekBufferResumeTimer: null,
    _allowAudioTimeWrite: false,
    _isMicroSeek: false,
    _lastMicroSeekAt: 0,
    _microSeekCount: 0,
    _playPauseTransitionUntil: 0,
    _lastSyncBackstopAt: 0,
    _seekPreVolume: null,
    _seekPostTimers: [],
    // Position saved on user pause — restored on play to prevent browser
    // keyframe adjustment from causing visible position jumps on play/pause/play.
    _pauseSavedPosition: -1,
    _pauseSavedAt: 0,
    // MakeSureUnintentionalLoopDoesntEverHappenAtALLManager state
    endedNaturally: false,
    endedAt: 0,
    endedLockUntil: 0,
    restartFromEndedUntil: 0,
    // Wakeup retry timer IDs — tracked for explicit cancellation to prevent timer leaks
    _wakeupRetryTimers: [],
    // Short-lived direct user play retries. These are foreground-only and exist to
    // keep a real play click from getting stranded behind slower recovery paths.
    _foregroundUserPlayRetryTimers: [],
    // Short-lived transition drift settle timers. These run after direct play/seek
    // transitions so we can finish alignment once both decoders are actually moving.
    _transitionDriftTimers: [],
    lastTransitionDriftRepairAt: 0,
    lastVideoPlayingAt: 0,
    _syncTabReturnKickDone: false
  };
  // Block micro-seeks during play/pause transitions. 500ms covers the full
  // decoder warmup window — the old 300ms allowed micro-seeks to land during
  // the transition, causing visible "scene flash" and "random seeks" on
  // every play/pause press. 500ms is still short enough that genuine freezes
  // (detected at >600ms stuck) get kicked promptly after the transition.
  const PLAY_PAUSE_MICRO_SEEK_BLOCK_MS = 300;
  const MICRO_SEEK_TOGGLE_SUPPRESS_MS = 400;
  const MICRO_SEEK_SEEK_SUPPRESS_MS = 600;

  // Audio play() gate — the single chokepoint for ALL audio playback.
  // Rule: audio NEVER plays in visible foreground unless video has decoded data.
  // 4s safety valve prevents stale flags from permanently blocking audio.
  if (audio && typeof audio.play === "function") {
    const _origAudioPlay = audio.play.bind(audio);
    audio.play = function() {
      // background tab: always let through (keepalive needs this)
      if (document.visibilityState === "hidden") return _origAudioPlay();

      const _gateVNode = getVideoNode();
      const _gateRS = _gateVNode ? Number(_gateVNode.readyState || 0) : 4;
      const _gateVisible = document.visibilityState === "visible";

      // seek kick window — short window after seeked where audio must start.
      // Don't require isProgrammaticAudioPlay — that flag races with the
      // audio.play() call so it's sometimes not yet set when this gate fires.
      // The timestamp check is sufficient.
      const inSeekKickWindow = now() < state.seekKickAudioAllowedUntil;

      // During active seeking, block unless in seek kick window
      if ((state.seeking || state.seekBuffering) && !inSeekKickWindow) return Promise.resolve();

      // STARTUP: first play hasn't happened yet, let audio through
      // (stall flags fire during initial buffering and would block startup)
      if (!state.firstPlayCommitted && state.intendedPlaying) return _origAudioPlay();

      // STARTUP SETTLE: for the first 15s after commit the decoder is still
      // warming up and readyState dips / transient stall flags do NOT
      // represent real audio-blocking conditions. Any audio re-start kicked
      // during this window (e.g. after a brief pause from the seeked handler
      // or the loop watchdog) MUST be allowed through — blocking here causes
      // audible silence gaps clustered at the start of playback. User pauses
      // disable startupSettleActive via userGesturePauseIntent so an explicit
      // pause still wins.
      if (startupSettleActive() && state.intendedPlaying &&
          !userPauseLockActive() && !mediaSessionForcedPauseActive()) {
        return _origAudioPlay();
      }

      // Block audio when video is confirmed stalled/buffering in visible foreground.
      // readyState can flicker between 2 and 3 during normal playback — DON'T
      // block audio on readyState alone. Only block when BOTH conditions are true:
      //   1. readyState < HAVE_FUTURE_DATA (video lacks decoded frames)
      //   2. Stall flags are set (video.on("waiting") confirmed a real stall)
      // This prevents audio from being killed during normal readyState jitter
      // while still catching real stalls immediately.
      if (_gateVisible && state.firstPlayCommitted && !inSeekKickWindow) {
        const _stallConfirmed = state.videoWaiting || state.videoStallAudioPaused;
        // Only block audio for SUSTAINED stalls (400ms+). Brief transient stalls
        // (<400ms) from normal keyframe decoding / segment boundaries set videoWaiting
        // momentarily. Blocking audio on these causes random audio cuts during
        // otherwise-smooth playback. videoStallAudioPaused is set by the deferred
        // 1200ms timer, so it already represents a confirmed sustained stall.
        const _stallSustained = state.videoStallAudioPaused ||
          (state.videoWaiting && state.videoStallSince > 0 && (now() - state.videoStallSince) > 400);
        if (_stallSustained && _gateRS < HAVE_FUTURE_DATA) {
          return Promise.resolve();
        }
        // Stall flags set but video has data — stale flags, clear them
        // Clear stale stall flags when video has data. Also force-clear if
        // stallAudioResumeHoldUntil has been set for >4s — prevents permanent
        // audio block from stale flags that never get cleared (feedback loop
        // between isForegroundVideoActuallyBuffering and stall flags).
        const _staleHold = state.stallAudioResumeHoldUntil > 0 &&
          (now() - state.stallAudioResumeHoldUntil + 400) > 4000;
        if ((_stallConfirmed && _gateRS >= HAVE_FUTURE_DATA && !isForegroundVideoActuallyBuffering()) || _staleHold) {
          state.videoWaiting = false;
          state.videoStallSince = 0;
          state.videoStallAudioPaused = false;
          state.stallAudioPausedSince = 0;
          state.stallAudioResumeHoldUntil = 0;
        }
        if (now() < state.stallAudioResumeHoldUntil && _gateRS < HAVE_FUTURE_DATA) {
          return Promise.resolve();
        }
        if (state.strictBufferHold && _gateRS < HAVE_FUTURE_DATA && !state.isProgrammaticAudioPlay) {
          return Promise.resolve();
        }
      }

      // safety valve: if stall flags have been stuck for 2s+, force-clear them.
      // Old value: 4s was too long — audio stays dead for 4 whole seconds.
      // 2s is enough to confirm a real stall recovery.
      const _gateStallAge = state.stallAudioPausedSince ? (now() - state.stallAudioPausedSince) : 0;
      if (_gateStallAge > 2000 && _gateRS >= HAVE_FUTURE_DATA) {
        state.videoStallAudioPaused = false;
        state.stallAudioResumeHoldUntil = 0;
        state.stallAudioPausedSince = 0;
        state.videoWaiting = false;
        state.videoStallSince = 0;
        clearForegroundBufferAudioHold();
      }

      // leading audio block for foreground play
      if (shouldBlockLeadingAudioForForegroundPlay()) return Promise.resolve();
      if (shouldHoldAudioForForegroundStall({ allowRecovery: true })) return Promise.resolve();

      // tab return / NMPBFN recovery: allow audio if video has data
      if ((isTabReturnImmune() || NotMakePlayBackFixingNoticable.isActive()) &&
          _gateRS >= HAVE_FUTURE_DATA && !state.videoWaiting && !state.videoStallAudioPaused) {
        return _origAudioPlay();
      }

      // video has data — let audio through
      if (_gateRS >= HAVE_FUTURE_DATA) return _origAudioPlay();

      // During seek kick window: allow audio start even if video readyState is low.
      // After seeking to an unbuffered position, readyState drops below HAVE_FUTURE_DATA
      // while buffering. Blocking audio here silences playback after seek — the main
      // cause of "audio cuts on seek". Both tracks were seeked to the same target so
      // it's safe to start audio as soon as video has at least HAVE_CURRENT_DATA.
      if (inSeekKickWindow && _gateRS >= HAVE_CURRENT_DATA) return _origAudioPlay();

      // no data and none of the bypass conditions matched — block
      return Promise.resolve();
    };
  }
  // Gate audio.currentTime — during seeking, only allow writes from seek handlers
  // (they set _allowAudioTimeWrite=true). Safety: if state.seeking stuck >10s, force-clear.
  if (audio) {
    state._allowAudioTimeWrite = false;
    state._seekStartedAt = 0;
    const _audioCtDesc = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, "currentTime");
    if (_audioCtDesc && _audioCtDesc.set) {
      const _origSet = _audioCtDesc.set;
      const _origGet = _audioCtDesc.get;
      Object.defineProperty(audio, "currentTime", {
        get() { return _origGet.call(this); },
                            set(v) {
                              // Gate 1: Block writes during seeking unless explicitly allowed
                              if ((state.seeking || state.seekBuffering) && !state._allowAudioTimeWrite) {
                                if (state._seekStartedAt > 0 && (performance.now() - state._seekStartedAt) > 10000) {
                                  state.seeking = false;
                                  state.seekBuffering = false;
                                  state.seekResumeInFlight = false;
                                  state.seekCompleted = true; state._seekStartedAt = 0;
                                } else {
                                  return;
                                }
                              }
                              // Gate 2: NEVER seek audio to near-0 when it's well into playback.
                              // This is the SINGLE definitive guard against the "audio restarts from
                              // beginning" bug. Every audio.currentTime write goes through here, so
                              // no code path can bypass this check.
                              const numV = Number(v);
                              if (numV < 0.5 && state.firstPlayCommitted && !state.restarting) {
                                const curAt = _origGet.call(this) || 0;
                                if (curAt > 1.0) {
                                  if (!isLoopDesired()) return;
                                }
                              }
                              // Gate 3: Block large backward seeks (>3s) unless user-initiated.
                              // Programmatic code (sync, bg catchup) sometimes computes stale
                              // positions and seeks audio backwards, causing audio to "disappear"
                              // or replay old content mid-playback.
                              if (state.firstPlayCommitted && !state.restarting && !state.seeking) {
                                const curAt3 = _origGet.call(this) || 0;
                                if (numV < curAt3 - 3.0 && curAt3 > 2.0 && !isLoopDesired()) {
                                  const userRecent3 = (now() - state.lastUserActionTime) < 2000;
                                  if (!userRecent3) return; // block stale backward seek
                                }
                              }
                              _origSet.call(this, v);
                            },
                            configurable: true
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // UNIFIED AUDIO KILL GUARD
  // ═══════════════════════════════════════════════════════════════════════
  // Every site that pauses audio MUST call this first. Returns false when
  // audio should NOT be paused (grace period, seek kick window, etc.) —
  // inconsistent guards across 90+ kill sites were the #1 cause of random
  // audio cuts. This is the single source of truth.
  //
  // A kill is only permitted when ALL of:
  //   - grace window has expired (playing/seeked/resume just happened)
  //   - seek kick window has expired (seeked just fired audio)
  //   - no seek resume is in flight
  //   - foreground video is genuinely stalled (not just readyState flicker)
  //
  // Callers pass { reason } for forensics and { bypassGrace: true } only
  // when the browser itself signaled a confirmed stall (waiting event with
  // readyState < HAVE_FUTURE_DATA that persisted past a short settling window).
  // Global audio-kill rate limiter. Even when every individual guard agrees
  // that audio should be paused, two independent kill paths firing within a
  // few hundred ms produce the "cut, resume, cut" artifact. A single global
  // cooldown across ALL kill sites eliminates this class of bug.
  let _lastGlobalAudioKillAt = 0;
  const GLOBAL_AUDIO_KILL_COOLDOWN_MS = 2500;

  function canKillAudio(opts) {
    opts = opts || {};
    if (!coupledMode || !audio) return false;
    // Global cooldown: never pause audio within 2.5s of the previous kill.
    // Any caller that passes { force: true } (only user actions / unmount)
    // bypasses this. Every *automatic* kill path respects it.
    if (!opts.force && now() - _lastGlobalAudioKillAt < GLOBAL_AUDIO_KILL_COOLDOWN_MS) return false;
    // Never kill in background — keepalive depends on audio staying alive.
    if (document.visibilityState === "hidden") return false;
    // Don't kill during active seek — seek handlers own audio state there.
    if (state.seeking || state.seekBuffering) return false;
    // Don't kill while seek recovery is still driving audio toward target.
    if (state.seekResumeInFlight) return false;
    // Seek kick window: the seeked handler armed this to let audio start.
    // Killing audio here creates the exact play-pause-play spam we're fighting.
    if (now() < state.seekKickAudioAllowedUntil) return false;
    // Startup settle window: in the first ~9s after commit the video
    // decoder has natural readyState dips that the buffer monitor, the
    // "waiting" handler, and the sync-loop stall detector all misread as
    // real stalls — they then pass bypassGrace:true and cut audio. The
    // result is audible cuts clustered at the start of playback. This is
    // unconditional (even bypassGrace respects it) because mid-playback
    // stalls set their own flags; startup is when decoder noise is loudest.
    if (now() < state.startupPlaySettleUntil) return false;
    // Grace window: playing / seeked / resume just armed audio. bypassGrace
    // is only for confirmed waiting events with sustained starvation.
    if (!opts.bypassGrace && now() < state.audioStartGraceUntil) return false;
    // Startup: let first play land.
    if (!state.firstPlayCommitted) return false;
    return true;
  }

  // Symmetric: is it OK to (re)start audio right now?
  // Callers must check this BEFORE calling execProgrammaticAudioPlay / audio.play
  // on their own kick timers. If this returns false, they should bail and
  // let the event-driven resume paths handle it instead.
  function canResumeAudio() {
    if (!coupledMode || !audio) return false;
    if (!state.intendedPlaying || state.endedNaturally || state.restarting) return false;
    if (state.seeking || state.seekBuffering) return false;
    if (userPauseLockActive() || mediaSessionForcedPauseActive()) return false;
    const vNode = getVideoNode();
    const vRS = vNode ? Number(vNode.readyState || 0) : 0;
    // Require genuine decoder data before resuming audio.
    if (vRS < HAVE_FUTURE_DATA) return false;
    // Don't race with a pending stall — let the recovery path drive.
    if (state.videoWaiting && vRS < HAVE_FUTURE_DATA) return false;
    return true;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // UNIFIED PLAY LOCK
  // ═══════════════════════════════════════════════════════════════════════
  // Single source of truth for "is a video play call in flight?". Every
  // timer-based play() kicker (INVARIANT 3, MSAOVDPUURWT, watchdog, sync
  // loop backstop, heartbeat consistency check, etc.) MUST call
  // tryAcquireVideoPlayLock() before calling execProgrammaticVideoPlay.
  //
  // The lock auto-releases after LOCK_HOLD_MS even if the play() promise
  // never resolves (dead promise paths). This eliminates the 5+ systems
  // that previously kicked play() simultaneously and caused the visible
  // play-pause-play-pause spam.
  const _PLAY_LOCK_HOLD_MS = 350; // was 800→500→350 — shorter lock lets seek recovery retries fire faster
  let _videoPlayLockUntil = 0;
  function tryAcquireVideoPlayLock() {
    const nowMs = now();
    if (nowMs < _videoPlayLockUntil) return false;
    if (state.isProgrammaticVideoPlay || state.videoPlayInFlight) return false;
    _videoPlayLockUntil = nowMs + _PLAY_LOCK_HOLD_MS;
    return true;
  }
  function releaseVideoPlayLock() {
    _videoPlayLockUntil = 0;
  }

  const BackgroundPlaybackManager = (() => {
    const PHASE = { STABLE_FG: 0, GOING_BG: 1, STABLE_BG: 2, RETURNING: 3 };
    let _phase = PHASE.STABLE_FG;
    let _phaseAt = 0;
    let _returnSessionId = 0;
    let _returnSuppressedUntil = 0;
    let _returnTimer = null;

    // Exponential backoff state
    let _bgResumeAttempts = 0;
    let _bgResumeBackoffUntil = 0;

    // "Stable playing" state: audio played cleanly for >2s before this pause
    let _stablePlayingSince = 0;
    let _wasStableBeforePause = false;

    const SPURIOUS_BURST_MS  = platform.chromiumOnlyBrowser ? 1200 : 500;
    const RETURN_SUPPRESS_MS = platform.chromiumOnlyBrowser ? 10000 : 5000;
    const BG_RESUME_BASE_MS  = 800;
    const BG_RESUME_MAX_MS   = 32000;

    function _backoffMs() {
      // 0s, 0.8s, 1.6s, 3.2s, 6.4s, 12.8s, 25.6s, 32s, 32s…
      if (_bgResumeAttempts === 0) return 0;
      return Math.min(BG_RESUME_BASE_MS * Math.pow(2, _bgResumeAttempts - 1), BG_RESUME_MAX_MS);
    }
    function _clearReturnTimer() {
      if (_returnTimer) { clearTimeout(_returnTimer); _returnTimer = null; }
    }

    // --- stable-audio tracking (called by heartbeat)
    function markAudioPlayingStable() {
      if (!_stablePlayingSince) _stablePlayingSince = now();
    }
    function markAudioNotPlaying() {
      _stablePlayingSince = 0;
    }
    function wasStableBeforeCurrentPause() { return _wasStableBeforePause; }

    // --- lifecycle hooks
    function onBecomeBackground() {
      if (_phase === PHASE.STABLE_BG) return;
      _clearReturnTimer();
      _phase = PHASE.GOING_BG;
      _phaseAt = now();
      _wasStableBeforePause = (_stablePlayingSince > 0 && (now() - _stablePlayingSince) > 2000);
      setTimeout(() => {
        if (_phase === PHASE.GOING_BG) { _phase = PHASE.STABLE_BG; _phaseAt = now(); }
      }, 200);
    }

    function onBecomeForeground() {
      _clearReturnTimer();
      _returnSessionId++;
      const mySession = _returnSessionId;
      _phase = PHASE.RETURNING;
      _phaseAt = now();
      _returnSuppressedUntil = now() + RETURN_SUPPRESS_MS;
      // Fresh foreground session → reset all backoff state
      _bgResumeAttempts = 0;
      _bgResumeBackoffUntil = 0;
      _stablePlayingSince = 0;
      _wasStableBeforePause = false;
      _returnTimer = setTimeout(() => {
        if (_returnSessionId !== mySession) return;
        _phase = PHASE.STABLE_FG;
        _phaseAt = now();
        _returnTimer = null;
      }, RETURN_SUPPRESS_MS + 300);
    }

    // --- state queries
    function isBackground() {
      return _phase === PHASE.STABLE_BG || _phase === PHASE.GOING_BG;
    }
    function isReturning() { return _phase === PHASE.RETURNING; }
    function isAnyTransition() {
      return _phase === PHASE.GOING_BG || _phase === PHASE.RETURNING;
    }

    // Primary gate: should ANY non-user-action pause event be suppressed?
    function shouldSuppressAutoPause() {
      if (_phase === PHASE.STABLE_BG || _phase === PHASE.GOING_BG) return true;
      if (now() < _returnSuppressedUntil) return true;
      return false;
    }

    // Is a very recent pointer/keyboard event active on the visible page?
    // Use explicit toggle intent, not generic user activity.
    function isUserPauseImmediate() {
      return document.visibilityState === 'visible' && userWantsPauseNow(2400);
    }
    function isUserPlayImmediate() {
      return document.visibilityState === 'visible' && userWantsPlayNow(2400);
    }

    // --- exponential backoff for background resume
    function canAttemptBgResume() {
      if (!isBackground()) return true;
      return now() >= _bgResumeBackoffUntil;
    }
    function trackBgResumeAttempt() {
      _bgResumeAttempts++;
      _bgResumeBackoffUntil = now() + _backoffMs();
    }
    function resetBgResumeBackoff() {
      _bgResumeAttempts = 0;
      _bgResumeBackoffUntil = 0;
    }

    function getPhaseLabel() {
      return ['STABLE_FG','GOING_BG','STABLE_BG','RETURNING'][_phase] || '?';
    }

    return {
      onBecomeBackground, onBecomeForeground,
      isBackground, isReturning, isAnyTransition,
      shouldSuppressAutoPause,
      isUserPauseImmediate, isUserPlayImmediate,
      canAttemptBgResume, trackBgResumeAttempt, resetBgResumeBackoff,
      markAudioPlayingStable, markAudioNotPlaying, wasStableBeforeCurrentPause,
      getPhaseLabel,
    };
  })();

  // --- BackgroundPlaybackManagerManager (BPMM)
  const BackgroundPlaybackManagerManager = (() => {
    let _oscillationCount = 0;
    let _oscillationWindowStart = 0;
    let _oscillationLockUntil = 0;
    let _bgPlayIntent = true;

    const OSCILLATION_WINDOW_MS = 10000; // 10s window
    const MAX_OSCILLATIONS = 5;          // 5 forced cycles → lock
    const OSCILLATION_LOCK_MS = 20000;   // 20s lock before retrying

    function _trackOscillation() {
      const nowTs = now();
      if ((nowTs - _oscillationWindowStart) > OSCILLATION_WINDOW_MS) {
        _oscillationCount = 0;
        _oscillationWindowStart = nowTs;
      }
      _oscillationCount++;
      if (_oscillationCount >= MAX_OSCILLATIONS) {
        _oscillationLockUntil = nowTs + OSCILLATION_LOCK_MS;
        _oscillationCount = 0;
        _oscillationWindowStart = nowTs;
        return true; // oscillating — lock it
      }
      return false;
    }

    // Should we attempt a background resume right now?
    function shouldAttemptBgResume() {
      if (!_bgPlayIntent) return false;
      if (now() < _oscillationLockUntil) return false;
      if (!BackgroundPlaybackManager.canAttemptBgResume()) return false;
      return true;
    }

    // Called when a browser-forced bg pause/resume cycle is detected
    function onBrowserForcedPause() {
      if (_trackOscillation()) {
        // Oscillating too fast — stop attempting bg resume
        _bgPlayIntent = false;
        return false; // caller should set resumeOnVisible instead
      }
      return true; // caller may still attempt resume (with BPM backoff)
    }

    // Called when background playback SUCCEEDS (both tracks actually playing)
    function onBgPlaySuccess() {
      _oscillationCount = 0;
      _oscillationWindowStart = 0;
      _oscillationLockUntil = 0;
      BackgroundPlaybackManager.resetBgResumeBackoff();
    }

    // Called on every foreground return — reset all oscillation state
    function onForegroundReturn() {
      _bgPlayIntent = true;
      _oscillationCount = 0;
      _oscillationWindowStart = 0;
      _oscillationLockUntil = 0;
    }

    function setBgPlayIntent(val) { _bgPlayIntent = !!val; }

    return {
      shouldAttemptBgResume, onBrowserForcedPause, onBgPlaySuccess, onForegroundReturn,
      setBgPlayIntent,
    };
  })();

  // --- Background Media Keepalive (Web Worker)
  // Web Workers are NOT throttled in background tabs (unlike setTimeout/setInterval).
  // This gives us reliable 200ms ticks to keep media alive even when Chromium
  // aggressively throttles the main thread. The worker is tiny — just a timer.
  // CPU cost is effectively zero: each tick is a single .paused check + early return.
  let _bgWorker = null;
  let _bgWorkerUrl = null;
  let _bgFallbackId = null; // setInterval fallback if Worker creation fails
  let _lastKeepalivePlayAt = 0;
  let _bgKeepaliveFailCount = 0;
  let _bgKeepaliveFailResetAt = 0;
  function _bgKeepaliveTick() {
    if (!state.intendedPlaying) return;
    // Never restart after ended — this was causing phantom loops
    if (state.endedNaturally) return;
    if (MakeSureUnintentionalLoopDoesntEverHappenAtALLManager.shouldBlockAutoRestart()) return;
    if (userPauseLockActive() || mediaSessionForcedPauseActive()) return;
    if (state.restarting || state.strictBufferHold) return;
    // In background, seeking/seekBuffering flags can get stuck because seeked events
    // don't fire. If the flag has been set for 5s+, it's stale — clear it.
    if (state.seeking && state._seekStartedAt > 0 && (performance.now() - state._seekStartedAt) > 5000) {
      state.seeking = false; state.seekBuffering = false; state._seekStartedAt = 0;
      state.seekResumeInFlight = false; state.seekCompleted = true;
      clearAudioPauseLocks();
    }
    if (state.seeking || state.seekBuffering) return;
    if (NotMakePlayBackFixingNoticable.isRecovering()) return;
    const isVisible = document.visibilityState !== "hidden";
    const isFocused = isWindowFocused();
    if (isVisible && isFocused && !isTabReturnImmune()) return;
    const t = now();
    // reset fail counter after 8s without failures
    if (t > _bgKeepaliveFailResetAt) _bgKeepaliveFailCount = 0;
    // backoff: visible=400ms, background ramps 300→500→800ms (capped)
    // Old ramp went up to 2000ms which was too slow — audio would stay dead for 2s
    // between recovery attempts, causing noticeable gaps in background playback.
    const backoffMs = isVisible ? 400 :
      _bgKeepaliveFailCount < 4 ? 300 :
      _bgKeepaliveFailCount < 10 ? 500 : 800;
    if (t - _lastKeepalivePlayAt < backoffMs) return;
    _lastKeepalivePlayAt = t;
    // in background, stall flags are stale (no playing/canplay events fire).
    // clear them so the audio.play() gate doesn't swallow our call.
    if (!isVisible) {
      state.videoWaiting = false;
      state.videoStallAudioPaused = false;
      state.stallAudioResumeHoldUntil = 0;
      state.stallAudioPausedSince = 0;
      state.videoStallSince = 0;
      state.foregroundBufferAudioHoldUntil = 0;
      state.isProgrammaticAudioPause = false;
      state.audioEventsSquelchedUntil = 0;
      state.audioPauseUntil = 0;
    }
    if (coupledMode && audio && audio.paused) {
      state.audioStartGraceUntil = Math.max(state.audioStartGraceUntil, now() + 800);
      try { audio.play().catch(() => {}); } catch {}
    }
    const vn = getVideoNode();
    try {
      if (vn && vn.paused) vn.play().catch(() => {});
    } catch {}
    // only count a fail if both tracks stayed paused
    const bothStillPaused = !!(vn && vn.paused) && !!(coupledMode && audio && audio.paused);
    if (bothStillPaused) {
      _bgKeepaliveFailCount++;
      _bgKeepaliveFailResetAt = t + 8000;
    }
  }
  function startBgAudioKeepalive() {
    if (_bgWorker || _bgFallbackId) return;
    _bgKeepaliveFailCount = 0;
    try {
      // 250ms tick rate
      const blob = new Blob(["setInterval(()=>postMessage(0),250)"], { type: "application/javascript" });
      _bgWorkerUrl = URL.createObjectURL(blob);
      _bgWorker = new Worker(_bgWorkerUrl);
      _bgWorker.onmessage = _bgKeepaliveTick;
    } catch {
      // Worker creation failed (CSP, old browser) — fall back to setInterval
      _bgFallbackId = setInterval(_bgKeepaliveTick, 500);
    }
  }
  function stopBgAudioKeepalive() {
    if (_bgWorker) {
      _bgWorker.terminate();
      _bgWorker = null;
    }
    if (_bgWorkerUrl) {
      try { URL.revokeObjectURL(_bgWorkerUrl); } catch {}
      _bgWorkerUrl = null;
    }
    if (_bgFallbackId) {
      clearInterval(_bgFallbackId);
      _bgFallbackId = null;
    }
  }

  // --- Capture-Phase Pause Guard
  // Registered ONCE on both video and audio elements. Fires BEFORE any other
  // pause listener (capture phase). During immunity (tab return / startup kick):
  //   1. Swallows the pause event completely (stopImmediatePropagation)
  //   2. Immediately calls play() on the element
  // This means NO other code sees the pause — no UI flicker, no state changes,
  // no competing resume logic. The pause never happened as far as the app knows.
  // Cost: one boolean check per pause event (~0 CPU).
  const _guardPlayTimes = new WeakMap();
  function _immunityPauseGuard(e) {
    if (!(state.tabReturnImmuneUntil > now())) return; // not immune — let normal handlers run
    if (userWantsPauseNow(2400)) return; // user pause must always win
    if (!state.intendedPlaying) return;
    // don't fight pause after ended, or the video phantom-loops.
    if (state.endedNaturally) return;
    // browser fires 'pause' BEFORE 'ended', so endedNaturally isn't set yet.
    // have to check currentTime vs duration ourselves — calling play() on an
    // ended video auto-seeks to 0 and restarts it.
    try {
      const _guardEl = e.target;
      if (_guardEl) {
        const _gCT = Number(_guardEl.currentTime) || 0;
        const _gDur = Number(_guardEl.duration) || 0;
        if (_gDur > 0.5 && _gCT >= _gDur - 0.5) return; // at the end — don't fight
      }
    } catch {}
    // In background, don't fight Chrome's auto-pause. Replaying here just causes
    // the play-pause-play-pause stutter loop. Let keepalive handle bg playback
    // at its own pace with proper backoff.
    if (document.visibilityState === "hidden") return;
    // For audio elements: don't counter-play if video lacks decoded data.
    // This prevents audio from restarting over a frozen/buffering video.
    // Video counter-play is fine — it triggers the decoder to start.
    if (coupledMode && audio && e.target === audio) {
      const _guardVN = getVideoNode();
      const _guardRS = _guardVN ? Number(_guardVN.readyState || 0) : 0;
      if (_guardRS < HAVE_FUTURE_DATA && state.firstPlayCommitted) return;
    }
    e.stopImmediatePropagation();
    const el = e.target;
    const t = now();
    const lastPlay = _guardPlayTimes.get(el) || 0;
    // During NMPBFN recovery, rate-limit video counter-plays to 500ms.
    // Each play() resets the decode pipeline. 150ms means ~13 resets in 2s.
    const minGap = NotMakePlayBackFixingNoticable.isRecovering() ? 500 : 150;
    if (t - lastPlay < minGap) return;
    _guardPlayTimes.set(el, t);
    try { el.play().catch(() => {}); } catch {}
  }
  let _immunityGuardsInstalled = false;
  function installImmunityPauseGuards() {
    if (_immunityGuardsInstalled) return;
    _immunityGuardsInstalled = true;
    try {
      const vn = getVideoNode();
      if (vn) vn.addEventListener("pause", _immunityPauseGuard, { capture: true });
      if (videoEl && videoEl !== vn) videoEl.addEventListener("pause", _immunityPauseGuard, { capture: true });
    } catch {}
    try {
      if (coupledMode && audio) audio.addEventListener("pause", _immunityPauseGuard, { capture: true });
    } catch {}
  }

  // --- DONTMAKEITDOUBLEPLAY
  // Patches audio.play() and video element .play() with deduplication.
  // Multiple systems (capture guard, Video.js pause handler, keepalive,
  // instantPlay, onAudioPause backup) all call play() during tab return.
  // Without dedup, the same element gets 2-4 play() calls within <50ms,
  // causing the audible "double play" stutter.
  //
  // How it works:
  // - Wraps .play() on audio and video elements at setup time
  // - If .play() was called on the same element within 300ms, returns
  //   the previous promise (no-op)
  // - If the element isn't paused, returns resolved (no-op)
  // - Otherwise calls the real .play() and caches the promise
  // - Zero CPU cost: one timestamp check per play() call
  const DONTMAKEITDOUBLEPLAY = (() => {
    const _lastPlayAt = new WeakMap();
    const _playPromises = new WeakMap();
    const _origPlay = new WeakMap();
    const _stormCount = new WeakMap();
    const _stormWindowStart = new WeakMap();
    const _stormSuppressUntil = new WeakMap();
    const DEDUP_MS = 350; // was 200 — too short, allowed double-play on rapid toggle
    const STORM_WINDOW_MS = 1800;
    const STORM_MAX_ATTEMPTS = 8;
    const STORM_SUPPRESS_MS = 900;

    function _makeWrapper(el) {
      const origPlay = el.play.bind(el);
      _origPlay.set(el, origPlay);
      el.play = function () {
        // Already playing — no-op
        if (!el.paused) {
          _stormCount.set(el, 0);
          _stormWindowStart.set(el, performance.now());
          return Promise.resolve();
        }
        const t = performance.now();
        const userDrivenPlay = userWantsPlayNow(2400) || userToggleExpectingPlay() || userPlayIntentActive();
        const suppressedUntil = _stormSuppressUntil.get(el) || 0;
        if (!userDrivenPlay && t < suppressedUntil) {
          return _playPromises.get(el) || Promise.resolve();
        }
        const last = _lastPlayAt.get(el) || 0;
        if (t - last < DEDUP_MS) {
          // Deduplicated — return the cached promise
          return _playPromises.get(el) || Promise.resolve();
        }
        let stormStart = _stormWindowStart.get(el) || 0;
        let stormCount = _stormCount.get(el) || 0;
        if (!stormStart || (t - stormStart) > STORM_WINDOW_MS) {
          stormStart = t;
          stormCount = 0;
        }
        stormCount++;
        _stormWindowStart.set(el, stormStart);
        _stormCount.set(el, stormCount);
        if (!userDrivenPlay && stormCount > STORM_MAX_ATTEMPTS) {
          _stormSuppressUntil.set(el, t + STORM_SUPPRESS_MS);
          _lastPlayAt.set(el, t);
          return _playPromises.get(el) || Promise.resolve();
        }
        _lastPlayAt.set(el, t);
        try {
          const p = origPlay();
          const safe = p ? p.catch(() => {}) : Promise.resolve();
          _playPromises.set(el, safe);
          return safe;
        } catch {
          return Promise.resolve();
        }
      };
    }

    function install() {
      // Patch audio element
      if (audio && typeof audio.play === 'function' && !_origPlay.has(audio)) {
        _makeWrapper(audio);
      }
      // Patch all video elements (Video.js may use inner <video>)
      try {
        const vn = getVideoNode();
        if (vn && typeof vn.play === 'function' && !_origPlay.has(vn)) {
          _makeWrapper(vn);
        }
        if (videoEl && videoEl !== vn && typeof videoEl.play === 'function' && !_origPlay.has(videoEl)) {
          _makeWrapper(videoEl);
        }
      } catch {}
    }

    // Force-reset the dedup timer for an element (e.g., after user click)
    function reset(el) {
      if (el) {
        _lastPlayAt.set(el, 0);
        _stormCount.set(el, 0);
        _stormWindowStart.set(el, performance.now());
        _stormSuppressUntil.set(el, 0);
      }
    }

    function resetAll() {
      if (audio) reset(audio);
      try { const vn = getVideoNode(); if (vn) reset(vn); } catch {}
      if (videoEl) reset(videoEl);
    }

    return { install, reset, resetAll };
  })();

  // --- NotMakePlayBackFixingNoticable (NMPBFN)
  // Single authority for background playback recovery. 4-phase state machine:
  // IDLE → GUARDING (bg) → RECOVERING (3s, warm-start play, block all) → SETTLING (8s, drift seek) → IDLE
  // User pause → abort() → IDLE. Watchdog monitors health every 500ms during recovery.
  //
  const NotMakePlayBackFixingNoticable = (() => {
    // --- Phase constants
    const PHASE_IDLE       = 0;
    const PHASE_GUARDING   = 1;
    const PHASE_RECOVERING = 2;
    const PHASE_SETTLING   = 3;

    // --- Timing constants
    const RECOVERY_DURATION_MS   = 250;   // How long RECOVERING phase lasts (was 500ms — still too slow)
    const SETTLING_DURATION_MS   = 400;   // How long SETTLING phase lasts (was 1000ms — 400ms is plenty)
    const DRIFT_CORRECTION_MIN   = 0.3;   // Only correct drift > 300ms
    const RETRY_INTERVALS        = [50, 120, 300]; // Progressive retry delays (faster for snappy tab return)
    const PLAY_CHECK_MS          = 100;   // How soon to verify play() worked

    // --- State
    let _phase       = PHASE_IDLE;
    let _phaseAt     = 0;
    let _bgEnteredAt = 0;     // Timestamp when we entered background (for bgDuration calc)
    let _snapshotVt  = 0;     // Video position when we went to background
    let _snapshotAt  = 0;     // Audio position when we went to background
    let _snapshotVol = 1;     // Audio volume when we went to background
    let _snapshotVideoVol = 1; // Video volume when we went to background
    let _recoveryGen = 0;     // Incremented each recovery — stale timers check this
    let _settleTimer = null;
    let _retryTimers = [];
    let _playAttempts = 0;
    let _lastRecoveryAt = 0;
    let _consecutiveFailures = 0;

    // -----------------------------------------------------------------------
    // PHASE 1: GUARDING — tab is going away
    // -----------------------------------------------------------------------
    function onGoBackground() {
      // Don't re-enter if already guarding
      if (_phase === PHASE_GUARDING) return;

      _phase = PHASE_GUARDING;
      _phaseAt = now();
      _bgEnteredAt = now(); // record when we went to background for warm-start calc

      // Snapshot current playback state so we can restore it perfectly
      _takeSnapshot();

      // Ensure immunity is active so capture guard catches browser pauses
      if (state.intendedPlaying) {
        state.tabReturnImmuneUntil = Math.max(state.tabReturnImmuneUntil, now() + RECOVERY_DURATION_MS);
      }
    }

    function _takeSnapshot() {
      try {
        _snapshotVt = Number(video.currentTime()) || 0;
      } catch { _snapshotVt = 0; }
      if (coupledMode && audio) {
        try { _snapshotAt = Number(audio.currentTime) || 0; } catch { _snapshotAt = 0; }
        try { _snapshotVol = audio.volume; } catch { _snapshotVol = 1; }
        try { _snapshotVideoVol = Number(video.volume()) || 1; } catch { _snapshotVideoVol = 1; }
      }
    }

    // -----------------------------------------------------------------------
    // PHASE 2: RECOVERING — tab just returned, resume playback
    // -----------------------------------------------------------------------
    function onReturn() {
      // never restart after ended — this was a big loop cause.
      if (state.endedNaturally) return;
      if (MakeSureUnintentionalLoopDoesntEverHappenAtALLManager.shouldBlockAutoRestart()) return;
      if (!state.intendedPlaying && !state.resumeOnVisible &&
        !(wantsStartupAutoplay() && !state.firstPlayCommitted) &&
        !state.startupPhase) return;

      // If already recovering from a very recent return (<500ms), skip
      if (_phase === PHASE_RECOVERING && (now() - _phaseAt) < 500) return;

      _phase = PHASE_RECOVERING;
      _phaseAt = now();
      _recoveryGen++;
      _playAttempts = 0;
      _lastRecoveryAt = now();
      const myGen = _recoveryGen;

      // Clear any old timers
      _clearAllTimers();

      // Set immunity for the recovery window
      state.tabReturnImmuneUntil = Math.max(state.tabReturnImmuneUntil, now() + RECOVERY_DURATION_MS + 300);

      // Reset play dedup so our play() calls go through
      DONTMAKEITDOUBLEPLAY.resetAll();

      // Reset rapid play/pause counters — browser-driven events during
      // recovery must not trigger loop detection
      state.rapidPlayPauseCount = 0;
      state.rapidPlayPauseResetAt = now();
      state.rapidToggleDetected = false;
      state.rapidToggleUntil = 0;
      state.loopPreventionCooldownUntil = 0;

      // Clear alt-tab transition flags
      state.altTabTransitionActive = false;
      state.altTabTransitionUntil = 0;

      clearAudioPauseLocks();
      // Only clear stall flags if video has data — otherwise video is genuinely
      // buffering and clearing these would let audio start during the stall.
      const _nmpbfnVNode = getVideoNode();
      const _nmpbfnRS = _nmpbfnVNode ? Number(_nmpbfnVNode.readyState || 0) : 0;
      if (_nmpbfnRS >= HAVE_FUTURE_DATA) {
        state.videoWaiting = false;
        state.videoStallSince = 0;
      }
      state.isProgrammaticVideoPause = false;
      state.audioPlayUntil = 0;
      state.audioPlayInFlight = null;
      // Clear buffer hold only if video has data
      if (_nmpbfnRS >= HAVE_FUTURE_DATA) clearBufferHold();

      // --- THE play. Exactly one video play + canplay wait for audio. ---
      _doSingleCleanPlay(myGen);

      // --- Start watchdog to monitor recovery health ---
      _startWatchdog(myGen);

      // NO retry timers. Repeated play() calls reset the video decode
      // pipeline, extending the freeze from ~500ms to 1-3s. The canplay
      // listener in _doSingleCleanPlay handles audio start. If video
      // never fires canplay, the 2.5s timeout in _doSingleCleanPlay
      // force-starts both tracks.

      // Settling is now triggered by _doSingleCleanPlay's canplay callback
      // (or its 2.5s timeout). Only use a fixed timer as a final safety net.
      _settleTimer = setTimeout(() => {
        if (_recoveryGen !== myGen) return;
        if (_phase === PHASE_RECOVERING) _enterSettling(myGen);
      }, 3000);
    }

    // Warm-start: on background recovery, play audio at vol 0, wait for decoder,
    // then micro-fade up. Masks the decode buffer refill gap. Skipped on fresh start.
    const WARM_START_DELAY_MS  = 50;
    const WARM_FADE_MS         = 40;
    const WARM_FADE_STEPS      = 5;
    let _warmFadeTimer = null;

    // Cleanup handle for canplay listener from _doSingleCleanPlay
    let _cleanPlayCleanup = null;

    function _doSingleCleanPlay(gen) {
      if (_recoveryGen !== gen) return;
      if (state.endedNaturally) return;
      if (MakeSureUnintentionalLoopDoesntEverHappenAtALLManager.shouldBlockAutoRestart()) return;
      _playAttempts++;
      if (state.startupPhase || wantsStartupAutoplay()) {
        state.intendedPlaying = true;
        state.bufferHoldIntendedPlaying = true;
      }
      DONTMAKEITDOUBLEPLAY.resetAll();

      // Clean up any previous canplay wait
      if (_cleanPlayCleanup) { try { _cleanPlayCleanup(); } catch {} _cleanPlayCleanup = null; }

      _bufMonStallFrames = 0;
      const _nPlay = HTMLMediaElement.prototype.play;
      const vn = getVideoNode();
      if (!vn) return;

      try {
        // Compositor flush moved to POST-PLAY: VCFM and PRFV detect frozen
        // frames after play() using RVFC/frame-count, then micro-seek only
        // if confirmed stuck. Pre-play micro-seeks caused the visible "bit of
        // a seek" on tab return because they fire while video is still paused.
        const vt = Number(vn.currentTime) || 0;
        const _nmpRS = Number(vn.readyState || 0);

        // Play VIDEO only. Do NOT play audio yet — video decoder needs to
        // recover first. Playing audio before video has data causes audio
        // over frozen frame. The canplay callback below starts audio.
        if (vn.paused && !state.endedNaturally) {
          try { _nPlay.call(vn).catch(() => {}); } catch {}
        }

        // Arm the compositor flush manager to verify that a video frame
        // actually reaches the screen. If the micro-seek + play() don't
        // unstick the compositor within 120ms, VCFM escalates with
        // additional flushes. This catches the case where readyState was
        // high but the compositor was still stuck.
        try { VideoCompositorFlushManager.arm(); } catch {}
        try { if (!state.userMutedVideo && getVideoMutedState()) setVideoMutedState(false); } catch {}

        // mute audio while video recovers — canplay fades it back up.
        // only zero out when audio is actually paused. if audio kept
        // running via keepalive, zeroing volume causes an audible dip
        // even on instant restore. old check was !vn.paused, but chrome
        // pauses video on tab hide so vn.paused=true on return even
        // when audio was fine. check audio directly.
        if (coupledMode && audio) {
          const _audioCurrentlyPlaying = !audio.paused;
          if (!_audioCurrentlyPlaying) {
            try { audio.volume = 0; } catch {}
          }
          try { if (audio.muted && !state.userMutedAudio) audio.muted = false; } catch {}
        }
      } catch {}

      // --- Wait for video decoder to have data, then start audio ---
      let _cpCleaned = false;
      let _cpPollTimer = null;
      const _cpCleanup = () => {
        if (_cpCleaned) return;
        _cpCleaned = true;
        _cleanPlayCleanup = null;
        try { vn.removeEventListener("canplay", _cpCheck); } catch {}
        try { vn.removeEventListener("canplaythrough", _cpCheck); } catch {}
        if (_cpPollTimer) { clearTimeout(_cpPollTimer); _cpPollTimer = null; }
      };
      _cleanPlayCleanup = _cpCleanup;

      const _cpStartAudio = () => {
        if (_recoveryGen !== gen || !state.intendedPlaying) return;
        _cpCleanup();
        if (!coupledMode || !audio) return;
        const targetVol = targetVolFromVideo();
        const currentVt = Number(vn.currentTime) || 0;
        const _cpAudioNow = Number(audio.currentTime) || 0;
        const _cpDrift = Math.abs(_cpAudioNow - currentVt);
        // Sync audio position to video — but skip the seek if audio is
        // already playing with a small drift (<0.3s). Writing currentTime
        // to a live audio element resets the decoder buffer and produces
        // an audible gap/click even when the seek distance is tiny.
        const _cpAudioAlreadyPlaying = !audio.paused;
        if (!_cpAudioAlreadyPlaying || _cpDrift > 0.3) {
          state._allowAudioTimeWrite = true;
          try { audio.currentTime = currentVt; } catch {}
          state._allowAudioTimeWrite = false;
        }
        // Set volume and play
        try { audio.volume = targetVol; } catch {}
        state.audioStartGraceUntil = Math.max(state.audioStartGraceUntil, now() + 800);
        if (audio.paused && !state.endedNaturally) {
          try { _nPlay.call(audio).catch(() => {}); } catch {}
        }
        state.audioEverStarted = true;
        // Clear stall flags — video confirmed ready
        state.videoWaiting = false;
        state.videoStallSince = 0;
        state.videoStallAudioPaused = false;
        state.stallAudioPausedSince = 0;
        state.stallAudioResumeHoldUntil = 0;
      };

      const _cpCheck = () => {
        if (_cpCleaned || _recoveryGen !== gen) return;
        if (Number(vn.readyState || 0) >= HAVE_FUTURE_DATA) {
          _cpStartAudio();
          // Now transition to SETTLING
          _enterSettling(gen);
        }
      };

      // Already ready? Start audio immediately
      if (Number(vn.readyState || 0) >= HAVE_FUTURE_DATA) {
        _cpStartAudio();
        setFastSync(1200);
        scheduleSync(0);
        return;
      }

      // Wait for canplay + poll every 50ms for fast detection
      try { vn.addEventListener("canplay", _cpCheck, { passive: true }); } catch {}
      try { vn.addEventListener("canplaythrough", _cpCheck, { passive: true }); } catch {}
      const _cpPoll = () => {
        if (_cpCleaned || _recoveryGen !== gen) return;
        _cpCheck();
        if (!_cpCleaned) _cpPollTimer = setTimeout(_cpPoll, 50);
      };
      _cpPollTimer = setTimeout(_cpPoll, 50);

      // Timeout: if video doesn't fire canplay in time, force-start audio.
      // The timeout is ADAPTIVE based on how long the tab was hidden:
      //   - Quick tab switch (<10s): 1.2s (decoder is warm, buffer intact)
      //   - Medium absence (10s-60s): 2.0s (decoder suspended, needs refill)
      //   - Long absence (>60s): 3.0s (decoder fully discarded, cold start)
      // This prevents the "audio plays over frozen video" bug after long
      // background sessions: the decoder genuinely needs more time to
      // produce the first frame from a cold start. Previously the fixed
      // 1.2s timeout was too aggressive for long backgrounds.
      const _bgDur = _bgEnteredAt > 0 ? (now() - _bgEnteredAt) : 0;
      // Faster timeouts for quick tab switches — decoder is warm, buffer intact.
      // 600ms for <10s bg is enough for Chromium to resume decode from warm cache.
      const _canplayTimeout = _bgDur > 60000 ? 2500 : (_bgDur > 10000 ? 1500 : 600);
      setTimeout(() => {
        if (_cpCleaned || _recoveryGen !== gen) return;
        _cpCleanup();
        _cpStartAudio();
        _enterSettling(gen);
      }, _canplayTimeout);

      setFastSync(1200);
      scheduleSync(0);
    }

    // Ultra-fast fade from 0 → targetVol. Uses requestAnimationFrame for
    // smooth steps (no setTimeout jitter). Total duration ~80ms.
    function _microFadeAudioUp(targetVol, gen) {
      if (!audio || _recoveryGen !== gen) return;
      // In background, setTimeout is throttled to ~1s per tick — snap volume
      // instead of a multi-second crawl that sounds broken when user returns.
      if (document.visibilityState === "hidden") {
        try { audio.volume = targetVol; } catch {}
        return;
      }
      let step = 0;
      const stepDelay = Math.max(1, Math.floor(WARM_FADE_MS / WARM_FADE_STEPS));
      function tick() {
        if (_recoveryGen !== gen || !state.intendedPlaying || !audio) return;
        // If tab went hidden during fade, snap to target
        if (document.visibilityState === "hidden") {
          try { audio.volume = targetVol; } catch {}
          return;
        }
        step++;
        const progress = Math.min(1, step / WARM_FADE_STEPS);
        const eased = progress * progress;
        try { audio.volume = targetVol * eased; } catch {}
        if (step < WARM_FADE_STEPS) {
          setTimeout(tick, stepDelay);
        }
      }
      tick();
    }

    // Verify play worked. If not, retry with reset.
    function _verifyAndRetryPlay(gen, attempt) {
      if (_recoveryGen !== gen) return;
      if (!state.intendedPlaying) return;

      const vn = getVideoNode();
      const videoPaused = vn ? vn.paused : true;
      const audioPaused = coupledMode && audio ? audio.paused : false;

      if (!videoPaused && !audioPaused) {
        // Both playing — recovery succeeded
        _consecutiveFailures = 0;
        return;
      }

      // Something is still paused. Clear any blocks and retry.
      state.isProgrammaticAudioPause = false;
      state.isProgrammaticVideoPause = false;
      state.audioPauseUntil = 0;
      state.audioPlayUntil = 0;
      state.audioEventsSquelchedUntil = 0;
      state.audioPlayInFlight = null;

      // Reset dedup so retry play goes through
      DONTMAKEITDOUBLEPLAY.resetAll();

      // Retry
      _doSingleCleanPlay(gen);

      // After last retry, if still failing, try a harder approach
      if (attempt >= RETRY_INTERVALS.length - 1) {
        setTimeout(() => {
          if (_recoveryGen !== gen) return;
          const vStillPaused = getVideoPaused();
          const aStillPaused = coupledMode && audio && audio.paused;
          if (vStillPaused || aStillPaused) {
            _consecutiveFailures++;
            // Hard reset: cancel all fades, clear all locks, force play
            cancelActiveFade();
            clearAudioPauseLocks();
            state.isProgrammaticVideoPause = false;
            clearBufferHold();
            state.audioPlayGeneration++;
            if (coupledMode && audio) {
              try { audio.volume = targetVolFromVideo(); } catch {}
              try { if (audio.muted) audio.muted = false; } catch {}
            }
            DONTMAKEITDOUBLEPLAY.resetAll();
            _doSingleCleanPlay(gen);
          }
        }, 500);
      }
    }

    // -----------------------------------------------------------------------
    // PHASE 3: SETTLING — playback resumed, let normal sync handle drift
    // -----------------------------------------------------------------------
    function _enterSettling(gen) {
      if (_recoveryGen !== gen) return;
      _phase = PHASE_SETTLING;
      _phaseAt = now();

      // No rate nudge — user finds speed changes audible. Instead, do one
      // quiet position correction if drift is large, then let the normal
      // sync loop handle the rest after settling ends.
      _doSettleDriftCorrection(gen);

      // After settling period, go idle and let normal sync take over
      _settleTimer = setTimeout(() => {
        if (_recoveryGen !== gen) return;
        _goIdle();
      }, SETTLING_DURATION_MS);
    }

    // One-time drift correction. Prefer seeking audio to video (no visible jump).
    // Only seek video if audio is significantly ahead AND video is paused/hidden.
    function _doSettleDriftCorrection(gen) {
      if (!coupledMode || !audio) return;
      try {
        const vt = Number(video.currentTime()) || 0;
        const at = Number(audio.currentTime) || 0;
        if (!isFinite(vt) || !isFinite(at)) return;
        const drift = Math.abs(at - vt);
        if (drift < 1.0) return; // Under 1s drift is fine — rate sync handles it
        if (at > vt && drift > 1.5 && document.visibilityState === "hidden") {
          // Audio far ahead + tab hidden — safe to move video (user can't see it)
          try { const _vn = getVideoNode(); if (_vn) _vn.currentTime = at; } catch {}
        } else if (at !== vt) {
          // Always prefer seeking audio to video position — no visible jump
          // Guard: never seek audio to near-0 if it's playing well into the track
          if (vt < 0.5 && state.firstPlayCommitted && !state.restarting && !isLoopDesired() && at > 2) return;
          safeSetAudioTime(vt);
        }
      } catch {}
    }

    // No-ops — rate nudge removed
    function _stopRateNudge() {
      state.audioRateNudgeActive = false;
      state.audioRateNudgeUntil = 0;
    }

    // -----------------------------------------------------------------------
    // IDLE — normal operation
    // -----------------------------------------------------------------------
    function _goIdle() {
      _phase = PHASE_IDLE;
      _phaseAt = now();
      _stopRateNudge();
      _clearAllTimers();
      _stopWatchdog();
    }

    // -----------------------------------------------------------------------
    // ABORT — user explicitly paused, or error recovery
    // -----------------------------------------------------------------------
    function abort() {
      _recoveryGen++;
      _stopRateNudge();
      _clearAllTimers();
      _stopWatchdog();
      _phase = PHASE_IDLE;
      _phaseAt = now();
    }

    // -----------------------------------------------------------------------
    // Timer management
    // -----------------------------------------------------------------------
    function _clearAllTimers() {
      if (_settleTimer) { clearTimeout(_settleTimer); _settleTimer = null; }
      if (_warmFadeTimer) { clearTimeout(_warmFadeTimer); _warmFadeTimer = null; }
      _retryTimers.forEach(t => clearTimeout(t));
      _retryTimers = [];
    }

    // WATCHDOG — runs every 500ms during recovery, self-heals 6 failure modes:
    // both paused, audio disconnected, video stalled, vol stuck at 0, audio frozen, phase stuck
    let _watchdogId = null;
    let _lastWatchdogAudioPos = 0;
    let _audioFrozenCount = 0;

    function _startWatchdog(gen) {
      _stopWatchdog();
      _lastWatchdogAudioPos = 0;
      _audioFrozenCount = 0;
      _watchdogId = setInterval(() => {
        if (_recoveryGen !== gen) { _stopWatchdog(); return; }
        if (!state.intendedPlaying) { _stopWatchdog(); return; }
        _watchdogTick(gen);
      }, 500);
    }

    function _stopWatchdog() {
      if (_watchdogId) { clearInterval(_watchdogId); _watchdogId = null; }
      _audioFrozenCount = 0;
    }

    function _watchdogTick(gen) {
      if (_recoveryGen !== gen) return;
      if (!state.intendedPlaying) return;

      const vn = getVideoNode();
      const videoPaused = vn ? vn.paused : true;
      const audioPaused = coupledMode && audio ? audio.paused : false;
      const audioVol = coupledMode && audio ? audio.volume : 1;

      // --- Check 1: Both paused — total failure. Force restart. ---
      if (videoPaused && audioPaused) {
        _consecutiveFailures++;
        _emergencyRestart(gen);
        return;
      }

      // --- Check 2: Audio paused but video playing — audio disconnected ---
      if (!videoPaused && audioPaused && coupledMode && audio) {
        clearAudioPauseLocks();
        state.audioPlayInFlight = null;
        DONTMAKEITDOUBLEPLAY.resetAll();
        try { audio.play().catch(() => {}); } catch {}
        setTimeout(() => {
          if (_recoveryGen !== gen || !state.intendedPlaying) return;
          if (!audio.paused && audio.volume < 0.01) _microFadeAudioUp(targetVolFromVideo(), gen);
        }, 150);
          return;
      }

      // --- Check 3: Video paused but audio playing — video stalled ---
      if (videoPaused && !audioPaused && vn && !state.endedNaturally) {
        try { vn.play().catch(() => {}); } catch {}
        return;
      }

      // --- Check 4: Audio volume stuck at 0 (warm fade failed or was killed) ---
      if (coupledMode && audio && !audioPaused && audioVol < 0.01 && _phase !== PHASE_RECOVERING) {
        // We're past recovery but volume is still 0 — fade was killed or never ran
        const targetVol = targetVolFromVideo();
        if (targetVol > 0.01) {
          _microFadeAudioUp(targetVol, gen);
        }
      }

      // --- Check 5: Audio position frozen (decoder stalled) ---
      // Only cut audio when we're CERTAIN the decoder is wedged: position
      // hasn't advanced for 6+ ticks (3s), audio.readyState indicates the
      // decoder has no buffered frames to play, AND canKillAudio agrees.
      // Previous 2s window + bare readyState-less check was cutting audio
      // on normal segment-boundary micro-stalls.
      if (coupledMode && audio && !audioPaused) {
        const currentPos = Number(audio.currentTime) || 0;
        if (_lastWatchdogAudioPos > 0 && Math.abs(currentPos - _lastWatchdogAudioPos) < 0.01) {
          _audioFrozenCount++;
          const _aRS = Number(audio.readyState || 0);
          const _decoderActuallyStarved = _aRS < HAVE_CURRENT_DATA;
          if (_audioFrozenCount >= 6 && _decoderActuallyStarved &&
              canKillAudio({ bypassGrace: true, reason: "recovery-frozen-audio" }) &&
              (now() - _lastGlobalAudioKillAt) >= GLOBAL_AUDIO_KILL_COOLDOWN_MS) {
            // Audio is "playing" but position isn't moving AND the decoder
            // has no data — real stall. Pause and re-play to force reset.
            _audioFrozenCount = 0;
            _lastGlobalAudioKillAt = now();
            try {
              audio.pause();
              audio.volume = 0;
            } catch {}
            setTimeout(() => {
              if (_recoveryGen !== gen || !state.intendedPlaying) return;
              try { audio.play().catch(() => {}); } catch {}
              setTimeout(() => {
                if (_recoveryGen !== gen || !state.intendedPlaying) return;
                _microFadeAudioUp(targetVolFromVideo(), gen);
              }, 150);
            }, 50);
            return;
          }
        } else {
          _audioFrozenCount = 0;
        }
        _lastWatchdogAudioPos = currentPos;
      }

      // --- Check 6: Phase stuck too long (state machine deadlock) ---
      const phaseAge = now() - _phaseAt;
      if (_phase === PHASE_RECOVERING && phaseAge > RECOVERY_DURATION_MS + 2000) {
        // Recovery should have transitioned to settling by now — force it
        _enterSettling(gen);
      } else if (_phase === PHASE_SETTLING && phaseAge > SETTLING_DURATION_MS + 2000) {
        // Settling should have gone idle by now — force it
        _goIdle();
      }
    }

    // Emergency restart — clear everything and force play from scratch
    function _emergencyRestart(gen) {
      if (_recoveryGen !== gen) return;

      clearAudioPauseLocks();
      state.isProgrammaticVideoPause = false;
      state.audioPlayUntil = 0;
      state.audioPlayInFlight = null;
      clearBufferHold();
      state.videoWaiting = false;
      cancelActiveFade();
      DONTMAKEITDOUBLEPLAY.resetAll();

      // Force play both — never after ended
      if (state.endedNaturally) return;
      const vn = getVideoNode();
      if (vn && vn.paused) {
        try { vn.play().catch(() => {}); } catch {}
      }
      if (coupledMode && audio) {
        try { audio.volume = 0; } catch {}
        if (audio.paused) {
          try { audio.play().catch(() => {}); } catch {}
        }
        // Fade up after decoder starts
        setTimeout(() => {
          if (_recoveryGen !== gen || !state.intendedPlaying) return;
          _microFadeAudioUp(targetVolFromVideo(), gen);
        }, 150);
      }
    }

    // -----------------------------------------------------------------------
    // Query functions — used by other systems to know when to back off
    // -----------------------------------------------------------------------
    function isRecovering()  { return _phase === PHASE_RECOVERING; }
    function isSettling()    { return _phase === PHASE_SETTLING; }
    function isGuarding()    { return _phase === PHASE_GUARDING; }
    function isActive()      { return _phase >= PHASE_RECOVERING; }

    // Should other systems block their seek/pause/volume operations?
    function shouldBlockSeek()    { return _phase === PHASE_RECOVERING; }
    function shouldBlockPause()   { return _phase === PHASE_RECOVERING; }
    function shouldBlockVolume()  { return _phase === PHASE_RECOVERING; }
    // Let sync run during both RECOVERING and SETTLING — sync is needed for
    // drift correction which is the #1 fix for "video plays late on tab return".
    // The sync loop already respects immunity and won't do harmful seeks.
    function shouldBlockSync()    { return false; }

    // How long since we started recovering?
    function recoveryAge() { return _phase >= PHASE_RECOVERING ? now() - _lastRecoveryAt : Infinity; }

    // Phase label for debugging
    function getPhaseLabel() { return ['IDLE','GUARDING','RECOVERING','SETTLING'][_phase] || '?'; }

    return {
      onGoBackground, onReturn, abort,
      isRecovering, isSettling, isGuarding, isActive,
      shouldBlockSeek, shouldBlockPause, shouldBlockVolume, shouldBlockSync,
      recoveryAge, getPhaseLabel,
    };
  })();

  // --- MakeSureAudioIsNotCuttingOrWeird (MSAINCOW)
  // Centralized audio health watchdog. Runs every 400ms when audio should be playing.
  // Detects and fixes: audio at wrong position, audio paused when shouldn't be,
  // audio volume wrong, audio muted unexpectedly, audio disconnected from video.
  // Single source of truth for "is audio healthy right now?"
  const MakeSureAudioIsNotCuttingOrWeird = (() => {
    let _timer = null;
    let _lastAudioPos = 0;
    let _lastCheckAt = 0;
    let _frozenCount = 0;
    const TICK_MS = 800; // was 500→600→800 — audio health doesn't need sub-second checks
    const MAX_DRIFT = 0.5;
    const FROZEN_THRESHOLD = 4; // ticks of no progress = frozen (3s)

  function _shouldRun() {
    if (!coupledMode || !audio || !state.intendedPlaying) return false;
    if (state.endedNaturally) return false;
    if (MakeSureUnintentionalLoopDoesntEverHappenAtALLManager.shouldBlockAutoRestart()) return false;
    if (state.seeking || state.seekBuffering || state.restarting) return false;
    if (state.strictBufferHold || state.videoWaiting || state.audioWaiting) return false;
    if (state.startupPhase) return false;
    if (startupSettleActive()) return false;
    if (NotMakePlayBackFixingNoticable.isRecovering()) return false;
    if (userPauseLockActive() || mediaSessionForcedPauseActive()) return false;
    if (isTabReturnImmune()) return false;
    return true;
  }

  function _tick() {
    _timer = null;
    if (!_shouldRun()) { _schedule(); return; }
    const t = now();
    const vt = (() => { try { return Number(video.currentTime()) || 0; } catch { return 0; } })();
    const at = Number(audio.currentTime) || 0;
    const vPaused = getVideoPaused();
    const aPaused = !!audio.paused;

    // Rule 1: Audio should not be paused when video is playing (and not buffering)
    // Also block during play/pause transition — kicking audio here during the
    // user's toggle creates audible "random play/pause" artifacts.
    if (!vPaused && aPaused && state.intendedPlaying && !state.videoStallAudioPaused &&
      !state.videoWaiting &&
      t > state.stallAudioResumeHoldUntil && t > state.audioPauseUntil &&
      t > state._playPauseTransitionUntil && !directUserToggleActive(600)) {
      // Only reset decoder position for significant drift (>0.3s). Small drift
      // from micro-seeks or play/pause transitions is handled by rate sync
      // without the audible pipeline-reset latency that safeSetAudioTime causes.
      if (Math.abs(at - vt) > 0.3) {
        safeSetAudioTime(vt);
      }
      execProgrammaticAudioPlay({ squelchMs: 200, force: true, minGapMs: 0 }).catch(() => {});
      _schedule(); return;
    }

      // Rule 2: Audio position should not be wildly off from video
      if (!vPaused && !aPaused && vt > 0.5) {
        const drift = Math.abs(at - vt);
        // Audio at position 0 while video is well into playback = restart bug
        if (at < 0.3 && vt > 1.0) {
          safeSetAudioTime(vt);
          _schedule(); return;
        }
        // Large drift > 2s — correct immediately via buffered fast path
        if (drift > 2.0) {
          const bufAhead = bufferedAhead(audio, vt);
          if (bufAhead > 0.1) {
            safeSetAudioTime(vt);
          }
          // If not buffered, let runSync handle it
        }
      }

      // Rule 3: Audio should not be frozen (position not advancing while playing)
      // Only fire when the decoder is ACTUALLY starved (readyState < HAVE_CURRENT_DATA).
      // A stopped position with decoder data means something else (paused rate,
      // visibility throttle, etc.) — not a decoder wedge. Previously this fired
      // on any frozen position and cut audio during normal playback.
      if (!aPaused && !vPaused) {
        if (Math.abs(at - _lastAudioPos) < 0.01 && (t - _lastCheckAt) > TICK_MS * 0.8) {
          _frozenCount++;
          const _aRSRule3 = Number(audio.readyState || 0);
          const _decoderStarved = _aRSRule3 < HAVE_CURRENT_DATA;
          if (_frozenCount >= FROZEN_THRESHOLD && _decoderStarved &&
              canKillAudio({ bypassGrace: true, reason: "MSAINCOW-frozen" })) {
            // Audio decoder is stuck AND actually has no data — restart it
            _frozenCount = 0;
            _lastGlobalAudioKillAt = t;
            state.isProgrammaticAudioPause = true;
            try { audio.pause(); } catch {}
            setTimeout(() => {
              state.isProgrammaticAudioPause = false;
              if (!state.intendedPlaying || state.seeking) return;
              safeSetAudioTime((() => { try { return Number(video.currentTime()) || 0; } catch { return 0; } })());
              execProgrammaticAudioPlay({ squelchMs: 200, force: true, minGapMs: 0 }).catch(() => {});
            }, 50);
            _schedule(); return;
          }
        } else {
          _frozenCount = 0;
        }
      } else {
        _frozenCount = 0;
      }

      // Rule 4: Audio volume should match target (when not fading/recovering)
      // Don't restore volume while video is buffering — audio should stay silent
      if (!aPaused && !state.audioFading && !NotMakePlayBackFixingNoticable.isActive() &&
        !state.videoWaiting && !state.videoStallAudioPaused) {
        const target = clamp01(targetVolFromVideo());
      if (target > 0 && audio.volume < 0.01 && !state.userMutedAudio) {
        softUnmuteAudio(100).catch(() => {});
      }
        }

        // Rule 5: Audio should not be muted when user hasn't muted
        if (!aPaused && audio.muted && !state.userMutedAudio && state.intendedPlaying) {
          try { audio.muted = false; } catch {}
        }

        // Rule 6: Detect stale mute flags — if playing, user didn't intend mute
        if (state.userMutedAudio && !vPaused && state.intendedPlaying &&
          !state.userMutedVideo && !getVideoMutedState()) {
          state.userMutedAudio = false;
        try { if (audio.muted) audio.muted = false; } catch {}
          }
          // Rule 7: Stale userMutedVideo — video playing but flagged as user-muted
          if (state.userMutedVideo && !vPaused && state.intendedPlaying && !getVideoMutedState()) {
            state.userMutedVideo = false;
          }

          // Rule 8: Video muted while playing but user didn't mute — force unmute
          if (!vPaused && state.intendedPlaying && getVideoMutedState() && !state.userMutedVideo) {
            try { setVideoMutedState(false); } catch {}
          }

          // Rule 9: Audio volume at 0 while video has volume — restore
          if (!aPaused && !vPaused && state.intendedPlaying && !state.audioFading) {
            const _tgt = clamp01(targetVolFromVideo());
            if (_tgt > 0.01 && audio.volume < 0.01 && !state.userMutedAudio) {
              try { audio.volume = _tgt; } catch {}
            }
          }

          _lastAudioPos = at;
          _lastCheckAt = t;
          _schedule();
  }

  function _schedule() {
    if (_timer) return;
    if (!coupledMode || !state.intendedPlaying) return;
    _timer = setTimeout(_tick, TICK_MS);
  }

  function start() { _frozenCount = 0; _lastAudioPos = 0; _lastCheckAt = now(); _schedule(); }
  function stop() { if (_timer) { clearTimeout(_timer); _timer = null; } _frozenCount = 0; }
  function reset() { stop(); _lastAudioPos = 0; _lastCheckAt = 0; }
  function onPlay() { start(); }
  function onPause() { stop(); }
  function onSeekStart() { stop(); _frozenCount = 0; }
  function onSeekEnd() { _lastAudioPos = Number(audio?.currentTime) || 0; _lastCheckAt = now(); start(); }

  return { start, stop, reset, onPlay, onPause, onSeekStart, onSeekEnd };
  })();

  // --- MakeSureAudioOrVideoDoesntPauseUnlessUserReallyWantsTo (MSAOVDPUURWT)
  // Last line of defense: if audio or video gets paused and there's zero evidence
  // the user wanted it, restart immediately. Runs as a passive check — doesn't block
  // or intercept events, just monitors state and fixes it after the fact.
  // Catches: OS audio session interruptions, browser memory pressure pauses,
  // random Chromium glitches, media focus loss, phantom pause events.
  const MakeSureAudioOrVideoDoesntPauseUnlessUserReallyWantsTo = (() => {
    let _timer = null;
    const TICK_MS = 900; // was 500→700→900 — phantom pause detection at ~1Hz is sufficient

    function _isUserPauseEvident() {
      // Did the user actually click/tap recently?
      if (userPauseLockActive()) return true;
      if (userPauseIntentActive()) return true;
      if (state.userPauseIntentPresetAt > 0 && (now() - state.userPauseIntentPresetAt) < 2000) return true;
      if (state.userGesturePauseIntent) return true;
      if (MediumQualityManager.intentPaused) return true;
      return false;
    }

    function _tick() {
      _timer = null;
      // CPU: don't re-schedule when not playing — start() is called on "playing" event
      if (!state.intendedPlaying) return;
      // never restart after ended — big loop cause.
      if (state.endedNaturally || MakeSureUnintentionalLoopDoesntEverHappenAtALLManager.shouldBlockAutoRestart()) { _schedule(); return; }
      if (state.seeking || state.seekBuffering || state.restarting || state.seekResumeInFlight) { _schedule(); return; }
      if (state.strictBufferHold || state.videoWaiting || state.videoStallAudioPaused) { _schedule(); return; }
      // Don't kick during seek stabilization — let the seek machinery finish
      if (state.seekStabilizeUntil && now() < state.seekStabilizeUntil) { _schedule(); return; }
      // Only back off during very early NMPBFN recovery (<120ms) when play() is in flight.
      // After that, MSAOVDPUURWT should actively restart paused media — that's its job.
      if (NotMakePlayBackFixingNoticable.isRecovering() && NotMakePlayBackFixingNoticable.recoveryAge() < 120) { _schedule(); return; }
      if (mediaSessionForcedPauseActive()) { _schedule(); return; }
      if (_isUserPauseEvident()) { _schedule(); return; }
      // Back off briefly during bgReturnGrace to let tab return systems settle.
      // Not the full 3000ms — just 800ms to avoid fighting NMPBFN / MVNFAPAAT.
      if (inBgReturnGrace() && state.lastBgReturnAt && (now() - state.lastBgReturnAt) < 800) { _schedule(); return; }

      const vPaused = getVideoPaused();
      const aPaused = coupledMode && audio ? !!audio.paused : false;
      const _msVNode = getVideoNode();
      const _msVRS = _msVNode ? Number(_msVNode.readyState || 0) : 4;

      // video paused but nobody asked for it — restart
      // Use unified play lock to prevent racing with INVARIANT 3, watchdog, etc.
      // Block during play/pause transition to avoid fighting user's toggle.
      if (vPaused && document.visibilityState === "visible" && _msVRS >= HAVE_FUTURE_DATA &&
          now() > state._playPauseTransitionUntil &&
          !directUserToggleActive(600) &&
          tryAcquireVideoPlayLock()) {
        DONTMAKEITDOUBLEPLAY.resetAll();
        execProgrammaticVideoPlay();
      }

      // audio paused but nobody asked for it — restart (foreground only)
      // Use unified canResumeAudio guard: centralized safety conditions.
      // Also block during play/pause transition to prevent this watchdog from
      // fighting with the user's intentional toggle (source of "random play/pauses").
      if (aPaused && canResumeAudio() &&
          !state.videoWaiting && !state.videoStallAudioPaused &&
          now() > state.stallAudioResumeHoldUntil && now() > state.audioPauseUntil &&
          now() > state._playPauseTransitionUntil &&
          !directUserToggleActive(600)) {
        // Clear any stale foreground buffer hold that might block our play call
        clearForegroundBufferAudioHold();
        const vt = (() => { try { return Number(video.currentTime()) || 0; } catch { return 0; } })();
        // Only seek audio if drift is significant — small drifts resolve naturally
        const _msAt = Number(audio.currentTime) || 0;
        if (Math.abs(_msAt - vt) > 0.4) safeSetAudioTime(vt);
        try { audio.volume = targetVolFromVideo(); } catch {}
        state.audioStartGraceUntil = Math.max(state.audioStartGraceUntil, now() + 500);
        execProgrammaticAudioPlay({ squelchMs: 200, force: true, minGapMs: 0 }).catch(() => {});
      }

      _schedule();
    }

    function _schedule() {
      if (_timer) return;
      _timer = setTimeout(_tick, TICK_MS);
    }

    function start() { _schedule(); }
    function stop() { if (_timer) { clearTimeout(_timer); _timer = null; } }

    return { start, stop };
  })();

  // ═══════════════════════════════════════════════════════════════════════
  // MakeVideoNotFreezeAfterPlaybackAfterAltTabHapenns — VideoSyncManager
  // ═══════════════════════════════════════════════════════════════════════
  // Video freeze detection and recovery. Two responsibilities:
  //
  //   1. RENDERER FREEZE DETECTION: Uses requestAnimationFrame (not timers)
  //      to detect frozen video at frame-level precision. If video.paused is
  //      false but currentTime hasn't advanced across 10+ rAF ticks AND
  //      readyState >= HAVE_FUTURE_DATA, the renderer is stuck on a stale
  //      GPU frame. Fix: micro-seek to flush the compositor, then re-play.
  //
  //   2. INTENT PRESERVATION: If intendedPlaying is true and video is stuck
  //      paused with data available, kick it. Audio resume is handled by
  //      MSAOVDPUURWT (500ms timer) — NOT here, to avoid 60fps oscillation.
  //
  // Audio stall detection is handled by the "waiting" event handler and
  // the sync loop backstop — NOT the rAF loop. Running audio management
  // at 60fps caused rapid play-pause oscillation when readyState flickered.
  //
  // Design: Dual-loop architecture.
  //   - A requestAnimationFrame loop for frame-accurate freeze detection
  //     (runs only when tab is visible and intendedPlaying).
  //   - A 200ms setTimeout fallback watchdog for cases where rAF is
  //     throttled (browser background tab, minimized window).
  //
  // This replaces the old timer-only MVNFAPAAT which used 250ms setTimeout
  // polling — too slow to catch single-frame stalls and subject to
  // browser timer throttling in background tabs.
  // ═══════════════════════════════════════════════════════════════════════
  const MakeVideoNotFreezeAfterPlaybackAfterAltTabHapenns = (() => {
    // --- private state (not accessible externally) ---
    let _rafId = null;
    let _watchdogTimer = null;
    let _lastVideoTime = -1;
    let _lastFrameCount = -1;
    let _frozenFrames = 0;        // consecutive rAF ticks where video didn't advance
    let _frozenSince = 0;
    let _lastRafTs = 0;
    let _running = false;
    let _tabReturnMicroSeekDone = false;
    let _preHideTime = -1;        // video.currentTime captured on visibilitychange→hidden
    let _preHideAudioTime = -1;   // audio.currentTime captured on hide
    let _wasPlayingBeforeHide = false;

    const SYNC_PRECISION = 0.1;   // max tolerable A/V drift in seconds
    // 3 consecutive rAF ticks (~240ms at 80ms interval) without frame
    // advancement before declaring stall. Was lowered to 2, but that
    // caused false positives during GC pauses and normal jank — the
    // micro-seek showed up as "random seeks during playback."
    const FROZEN_FRAME_THRESHOLD = 3;
    const WATCHDOG_MS = 400;      // fallback timer interval (was 200→300→400 — rAF is primary, this is backup only)
    const MICRO_SEEK_OFFSET = 0.01; // large enough for demuxer to treat as real seek
    // Don't re-kick (micro-seek) faster than this. Was 1000ms — too long,
    // causing visible 1+ second freezes after play/pause because the detector
    // couldn't fire a second kick after the first one didn't unstick the
    // compositor. 600ms still prevents GC/jank false positives while allowing
    // faster recovery from real compositor stalls.
    const STALL_KICK_COOLDOWN_MS = 350;
    // skip every other rAF tick to cut CPU. freeze detection at 30fps is
    // still fast enough to catch single-frame stalls (166ms window).
    // still rAF-based so it scales with monitor refresh.
    const RAF_SKIP_INTERVAL_MS = 80; // min gap between "big" ticks (~12Hz effective, catches freezes in ~250ms, cuts CPU further)
    let _lastKickAt = 0;
    let _lastBigTickAt = 0;

    // ------------------------------------------------------------------
    // BufferWatcher: compares video.buffered against currentTime to get
    // the real buffer health independent of readyState (which can lag).
    // ------------------------------------------------------------------
    function _getBufferAhead(el) {
      try {
        const t = Number(el.currentTime) || 0;
        const b = el.buffered;
        if (!b || b.length === 0) return 0;
        for (let i = 0; i < b.length; i++) {
          if (t >= b.start(i) - 0.01 && t <= b.end(i) + 0.01) {
            return Math.max(0, b.end(i) - t);
          }
        }
      } catch {}
      return 0;
    }

    // ------------------------------------------------------------------
    // The rAF-based heartbeat. Fires once per display frame (~16ms @60Hz).
    // This is the primary loop: frame-accurate, not subject to timer
    // throttling, and guaranteed to run in sync with the compositor.
    // ------------------------------------------------------------------
    function _rafTick(timestamp) {
      _rafId = null;
      if (!_running) return;

      // Always re-schedule first (ensures the loop continues even if we throw)
      _scheduleRaf();

      // skip the full work if less than RAF_SKIP_INTERVAL_MS has passed
      // since the last "big" tick. halves detection work on 60Hz without
      // losing sensitivity.
      const _rafNow = now();
      if (_rafNow - _lastBigTickAt < RAF_SKIP_INTERVAL_MS) return;
      _lastBigTickAt = _rafNow;

      // --- gate checks: skip enforcement in states where we shouldn't act ---
      if (!state.intendedPlaying || state.endedNaturally || state.restarting) return;
      if (state.seeking || state.seekBuffering) { _frozenFrames = 0; _frozenSince = 0; return; }
      if (document.visibilityState !== "visible" || !isWindowFocused()) return;
      if (userPauseLockActive() || mediaSessionForcedPauseActive()) return;
      if (!state.firstPlayCommitted) return;

      const vNode = getVideoNode();
      if (!vNode) return;

      const vRS = Number(vNode.readyState || 0);
      const vPaused = getVideoPaused();
      const aPaused = coupledMode && audio ? !!audio.paused : false;
      const vt = (() => { try { return Number(video.currentTime()) || 0; } catch { return 0; } })();
      const frameCount = getVideoPresentedFrameCount(vNode);
      const bufAhead = _getBufferAhead(vNode);

      // ════════════════════════════════════════════════════════════════
      // NOTE: Audio pause-on-starvation is handled by the "waiting" event
      // handler + sync loop backstop, NOT here. Running audio management
      // at 60fps caused rapid play-pause oscillation when readyState
      // flickered between 2 and 3. Event-based detection is authoritative.
      // ════════════════════════════════════════════════════════════════
      const videoStarving = vRS < HAVE_FUTURE_DATA;

      // ════════════════════════════════════════════════════════════════
      // INVARIANT 2: RENDERER FREEZE DETECTION (rAF-precision)
      // If video reports "playing" (paused=false) but currentTime AND
      // the decoded frame count are both frozen → the renderer is stuck
      // on a stale GPU surface. This happens after alt-tab because
      // Chromium caches the last composited frame in a texture.
      //
      // Fix strategy (the "Double-Nudge"):
      //   1. Micro-seek: video.currentTime += 0.001
      //      Forces the demuxer to flush and re-feed the decoder,
      //      which pushes a fresh frame to the compositor.
      //   2. Re-play inside the NEXT rAF after the micro-seek lands.
      //      This ensures the browser has a paint cycle ready.
      // ════════════════════════════════════════════════════════════════
      // Detect frozen compositor at HAVE_CURRENT_DATA too (not just HAVE_FUTURE_DATA).
      // After tab return, readyState can be HAVE_CURRENT_DATA (2) — the decoder has
      // one decoded frame but the compositor is stuck on a stale GPU texture. The old
      // code only checked >= HAVE_FUTURE_DATA, so it MISSED these freezes entirely,
      // causing "video appears frozen after tab return even though it says it's playing."
      if (!vPaused && vRS >= HAVE_CURRENT_DATA) {
        const timeAdvanced = Math.abs(vt - _lastVideoTime) > 0.0005;
        const framesAdvanced = isFinite(frameCount) && isFinite(_lastFrameCount)
          ? frameCount > _lastFrameCount
          : true; // if frame count unavailable, assume advancing

        if (!timeAdvanced && !framesAdvanced && _lastVideoTime >= 0) {
          _frozenFrames++;
          if (!_frozenSince) _frozenSince = now();

          // Use a higher threshold when readyState is low (HAVE_CURRENT_DATA)
          // to avoid false positives from genuine buffering. At HAVE_FUTURE_DATA,
          // the decoder has enough data — 3 ticks is enough to confirm freeze.
          // At HAVE_CURRENT_DATA, give the decoder more time (5 ticks ~400ms).
          const _effectiveThreshold = vRS >= HAVE_FUTURE_DATA
            ? FROZEN_FRAME_THRESHOLD
            : FROZEN_FRAME_THRESHOLD + 2;

          if (_frozenFrames >= _effectiveThreshold && (now() - _lastKickAt) > STALL_KICK_COOLDOWN_MS) {
            // Video is NOT paused but frames aren't advancing — stale compositor.
            // Micro-seek to flush the GPU surface, then re-play.
            // Use canDoCompositorFlush() — NOT canDoMicroSeek() — so compositor
            // flushes can fire during play/pause transitions. The old code blocked
            // for ~900ms, causing the "video freezes for a second after play/pause" bug.
            if (canDoCompositorFlush()) {
              _lastKickAt = now();
              _frozenFrames = 0;
              _frozenSince = 0;
              recordMicroSeek();
              // Use a FORWARD micro-seek (+0.001s). Forward seeks don't cause
              // keyframe flash because the decoder just decodes the next frame
              // from the current GOP position (no I-frame seek needed). Backward
              // seeks force the decoder to find the previous keyframe, which can
              // be 0.5-2s behind — causing a visible flash.
              // DO NOT use pause→play cycles — they cause the decoder to need
              // a full warm-up again, creating a WORSE multi-second freeze.
              state._isMicroSeek = true;
              try { vNode.currentTime = vt + 0.001; } catch {}
              setTimeout(() => { state._isMicroSeek = false; }, 200);
              DONTMAKEITDOUBLEPLAY.resetAll();
              if (getVideoPaused()) {
                const p = execProgrammaticVideoPlay();
                if (p && typeof p.catch === "function") p.catch(() => {});
              }
              // Arm VCFM to verify the frame actually rendered after our kick.
              try { VideoCompositorFlushManager.arm(); } catch {}
            }
          }
        } else {
          _frozenFrames = 0;
          _frozenSince = 0;
          // Frames ARE advancing — if videoWaiting or videoStallAudioPaused
          // are stale, clear them now. Without this, a transient stall sets
          // these flags and the "playing" event doesn't re-fire for non-paused
          // video, so the stale flags block audio.play() through the gate
          // indefinitely. Also clear stallAudioResumeHoldUntil and
          // foregroundBufferAudioHold since the stall is demonstrably over.
          if (vRS >= HAVE_CURRENT_DATA) {
            if (state.videoWaiting) {
              state.videoWaiting = false;
              state.videoStallSince = 0;
            }
            if (state.videoStallAudioPaused) {
              state.videoStallAudioPaused = false;
              state.stallAudioPausedSince = 0;
              state.stallAudioResumeHoldUntil = 0;
            }
          }
        }
      } else {
        _frozenFrames = 0;
        if (!vPaused && vRS < HAVE_CURRENT_DATA) {
          // Video is "playing" but fully starved — "waiting" event handler manages audio
        }
      }

      _lastVideoTime = vt;
      _lastFrameCount = isFinite(frameCount) ? frameCount : -1;

      // ════════════════════════════════════════════════════════════════
      // INVARIANT 3: INTENT PRESERVATION — KICK STUCK ELEMENTS
      // If we intend to play and an element is paused but has data, kick it.
      // But NEVER start audio unless video has HAVE_FUTURE_DATA.
      // ════════════════════════════════════════════════════════════════

      // 3a: Video is paused but has data and we want to play → kick video
      // Guard: tryAcquireVideoPlayLock prevents ALL kick systems from racing.
      // If another system already called play() within the last 800ms, skip.
      if (vPaused && vRS >= HAVE_FUTURE_DATA && !state.strictBufferHold &&
          !state.seeking && !state.seekBuffering && !state.seekResumeInFlight &&
          (now() - _lastKickAt) > STALL_KICK_COOLDOWN_MS &&
          tryAcquireVideoPlayLock()) {
        _lastKickAt = now();
        state.isProgrammaticVideoPause = false;
        DONTMAKEITDOUBLEPLAY.resetAll();
        const p = execProgrammaticVideoPlay();
        if (p && typeof p.catch === "function") p.catch(() => {});
      }

      // 3b: Audio resume is handled by MSAOVDPUURWT (500ms timer) and the
      //     sync loop — NOT here. Running audio kicks at 60fps caused rapid
      //     play-pause oscillation. The 500ms timer provides natural debounce.
    }

    // ------------------------------------------------------------------
    // Watchdog: 200ms setTimeout fallback for when rAF is throttled.
    // Runs the same invariant checks but at lower frequency. This catches
    // cases where the tab is "visible" but rAF isn't firing (e.g. window
    // is minimized on some OSes, or rAF is deprioritized).
    // ------------------------------------------------------------------
    function _watchdogTick() {
      _watchdogTimer = null;
      if (!_running) return;
      _scheduleWatchdog();

      // Delegate to the same logic as rAF tick (with a fake timestamp)
      // The rAF loop handles the frame-accurate work; watchdog handles
      // the "is everything stuck?" coarse check.
      if (!state.intendedPlaying || state.endedNaturally) return;
      if (document.visibilityState !== "visible") return;
      if (!state.firstPlayCommitted) return;

      const vNode = getVideoNode();
      if (!vNode) return;
      const vRS = Number(vNode.readyState || 0);
      const vPaused = getVideoPaused();
      const aPaused = coupledMode && audio ? !!audio.paused : false;

      // Watchdog-specific: detect "video has data but nothing is playing"
      // Same unified lock used by INVARIANT 3 — if any other system already
      // called play() in the last 800ms, skip. This was the biggest source
      // of play-pause spam: rAF loop, watchdog, sync loop, heartbeat, and
      // MSAOVDPUURWT all independently kicking play() within the same tick.
      if (vPaused && !state.seeking && !state.seekBuffering && !state.restarting &&
          vRS >= HAVE_FUTURE_DATA && !state.strictBufferHold &&
          !state.seekResumeInFlight &&
          !userPauseLockActive() && !mediaSessionForcedPauseActive() &&
          (now() - _lastKickAt) > STALL_KICK_COOLDOWN_MS &&
          tryAcquireVideoPlayLock()) {
        _lastKickAt = now();
        state.isProgrammaticVideoPause = false;
        DONTMAKEITDOUBLEPLAY.resetAll();
        const p = execProgrammaticVideoPlay();
        if (p && typeof p.catch === "function") p.catch(() => {});
        // Audio resume is handled by MSAOVDPUURWT — not here.
      }
      // Audio stall detection handled by "waiting" event handler + sync loop.
      // Running it here at 200ms caused fighting with resume systems.
    }

    // ------------------------------------------------------------------
    // Tab visibility transition handlers (called from visibilitychange)
    // ------------------------------------------------------------------

    // runs right before the tab hides. grabs the playback position so we can
    // do a hard resync on return.
    function onTabHide() {
      const vNode = getVideoNode();
      const _vt = vNode ? (Number(vNode.currentTime) || 0) : -1;
      const _at = (coupledMode && audio) ? (Number(audio.currentTime) || 0) : -1;

      // video position = ground truth for "where the user was watching".
      // audio can run ahead in coupled bg playback (it keeps going while
      // the browser throttles video). taking Math.max(vt, at) caused the
      // "continues from a random place" bug: audio 5s ahead → _preHideTime
      // becomes audio's position, and on return we jump video forward to a
      // place the user never actually watched.
      //
      // priority: video first, audio only as fallback.
      if (_vt > 0.1) {
        _preHideTime = _vt;
      } else if (_at > 0.1) {
        _preHideTime = _at;
      } else {
        _preHideTime = -1;
      }
      _preHideAudioTime = _at;
      _wasPlayingBeforeHide = state.intendedPlaying && !getVideoPaused();
      _tabReturnMicroSeekDone = false;
      // Refresh lastKnownGoodVT using video position. Use assignment (not max)
      // because lastKnownGoodVT may have been advanced by background playback
      // to a position past where the user was actually watching. _preHideTime
      // is the user's real position — it must be authoritative.
      if (_preHideTime > 0) {
        state.lastKnownGoodVT = _preHideTime;
        state.lastKnownGoodVTts = now();
      }
    }

    // Called when the tab becomes visible again.
    // Strategy: seek to current position (flushes stale compositor frame),
    // then play immediately. Don't wait for canplay/rAF — just play.
    // The browser shows native buffering if needed, which is way better
    // than a frozen frame with no indication of what's happening.
    //
    // Why this works: Chromium caches the last composited video frame as a
    // GPU texture when backgrounding. Seeking (even to the same position)
    // forces the decoder to produce a fresh frame, flushing the stale texture.
    // The seek offset is 0.01s — small enough to be invisible but large
    // enough that the decoder treats it as a real seek (0.001 was sometimes
    // ignored by the demuxer as a no-op).
    let _tabReturnPollTimer = null;
    function onTabReturn() {
      if (state.endedNaturally) return;
      if (_tabReturnMicroSeekDone) return;
      _tabReturnMicroSeekDone = true;
      if (_tabReturnPollTimer) { clearInterval(_tabReturnPollTimer); _tabReturnPollTimer = null; }

      const vNode = getVideoNode();
      if (!vNode) return;

      // If both video and audio are already playing, skip ALL recovery.
      // The VCFM will verify the compositor is healthy. Doing seeks and
      // play() calls here when media is already running causes the visible
      // "play-pause-play" stutter on tab return.
      const _trBothPlaying = !vNode.paused && (!coupledMode || (audio && !audio.paused));
      if (_trBothPlaying && state.intendedPlaying) return;

      const vRS = Number(vNode.readyState || 0);
      const currentVt = Number(vNode.currentTime || 0);

      // video sometimes jumps to 0 / a random spot on tab return. stop that.
      //
      // ground truth is _preHideTime — that's where the user was actually
      // watching. everything else is secondary: currentVt (bg playback that
      // advanced), audio.currentTime (audio kept running), lastKnownGoodVT
      // (last confirmed spot).
      //
      // old code did Math.max() over all of them. if audio ran ahead in the
      // background, video would jump forward to a place the user never saw.
      //
      // new rule: prefer _preHideTime. fall back to currentVt. only overshoot
      // forward to audio.currentTime if the gap is small (<5s) — that
      // matches natural bg advancement, not a runaway audio clock.
      const _lastGood = Number(state.lastKnownGoodVT) || 0;
      let _primaryTarget = -1;
      if (_preHideTime >= 0 && isFinite(_preHideTime) && _preHideTime > 0.2) {
        _primaryTarget = _preHideTime;
      } else if (_lastGood > 0.2) {
        _primaryTarget = _lastGood;
      } else if (isFinite(currentVt) && currentVt > 0.2) {
        _primaryTarget = currentVt;
      }

      // DO NOT override _primaryTarget with currentVt or audio.currentTime.
      // The old code took Math.max / allowed forward-override, which meant
      // if video or audio continued playing in background (browsers do this),
      // we'd seek to whatever advanced position they reached — NOT where the
      // user was actually watching. _preHideTime is the ground truth.
      //
      // The only valid "forward override" is if _primaryTarget is invalid/zero
      // and currentVt has some data — but that's already handled above.

      const targetTime = _primaryTarget > 0 ? _primaryTarget : currentVt;

      // Resync video to the user's ACTUAL position (_preHideTime / targetTime).
      // Two cases:
      //   A. Video is BEHIND target (browser suspended video in bg) → seek forward.
      //   B. Video is AHEAD of target (browser kept video playing in bg) → seek
      //      backward. The user was on a different tab and couldn't see any of the
      //      content that played. Leaving video at the advanced position causes the
      //      "video forwards a bit on play/pause after tab return" bug.
      //      Cap backward seeks at 60s — larger gaps likely mean the user intentionally
      //      left video playing in background and expects it to continue.
      let didForwardResync = false;
      const _videoAheadOfTarget = isFinite(currentVt) && currentVt > targetTime + 0.5;
      const _videoBehindTarget = isFinite(currentVt) && currentVt < targetTime - 1.5;
      const _needsResync = targetTime > 0.5 && (
        (_videoBehindTarget && Math.abs(currentVt - targetTime) < 300) ||
        (_videoAheadOfTarget && (currentVt - targetTime) > 8 && (currentVt - targetTime) < 120)
      );
      if (_needsResync) {
        state._isMicroSeek = true;
        didForwardResync = true;
        try { vNode.currentTime = targetTime; } catch {}
        if (coupledMode && audio) {
          state._allowAudioTimeWrite = true;
          try { audio.currentTime = targetTime; } catch {}
          state._allowAudioTimeWrite = false;
        }
      } else if (coupledMode && audio) {
        // Video doesn't need a seek. Sync audio to wherever video actually IS
        // (currentVt), not to _preHideTime. If video played forward in bg,
        // audio should play from video's current position, not jump back.
        // Only sync when drift is meaningful.
        try {
          const _syncAudioTo = (isFinite(currentVt) && currentVt > 0.2) ? currentVt
            : (targetTime > 0.1 ? targetTime : 0);
          if (_syncAudioTo > 0.1) {
            const _tabAt = Number(audio.currentTime) || 0;
            const _tabDrift = Math.abs(_tabAt - _syncAudioTo);
            if (_tabDrift > 0.5) {
              state._allowAudioTimeWrite = true;
              try { audio.currentTime = _syncAudioTo; } catch {}
              state._allowAudioTimeWrite = false;
            }
          }
        } catch {}
      }

      // Only do the eager compositor-flush micro-seek when we already had to
      // hard-resync position or the decoder is still genuinely suspended.
      // Otherwise let VCFM verify a real frame before we touch currentTime.
      const shouldForceFlush = didForwardResync || vRS < HAVE_CURRENT_DATA || currentVt < 0.1;
      if (shouldForceFlush) {
        // Mark as micro-seek so seeking/seeked handlers ignore this recovery.
        state._isMicroSeek = true;

        // Seek to flush the stale compositor frame. Use +0.01 offset — large enough
        // for the demuxer to treat it as a real seek, small enough to be invisible.
        // Use the SAFE targetTime — never fall back to currentVt if it would be 0.
        const seekTarget = targetTime > 0 ? targetTime : currentVt;
        // Additional guard: if seekTarget is 0 and we KNOW audio is well into the
        // track (audio.currentTime > 1), prefer audio time over letting video reset.
        let _finalSeekTarget = seekTarget;
        if (_finalSeekTarget < 0.5 && coupledMode && audio) {
          try {
            const _at2 = Number(audio.currentTime) || 0;
            if (_at2 > 1.0) _finalSeekTarget = _at2;
          } catch {}
        }
        const _flushTarget = _finalSeekTarget + 0.001;
        let _flushVideoDuration = 0;
        try { _flushVideoDuration = Number(vNode.duration) || 0; } catch {}
        const _flushSafe =
          _finalSeekTarget >= 0.5 &&
          _flushTarget >= 0 &&
          (_flushVideoDuration <= 0 || _flushTarget < _flushVideoDuration - 0.5);
        if (_flushSafe && canDoMicroSeek()) {
          recordMicroSeek();
          try { vNode.currentTime = _flushTarget; } catch {}
        }

        // Clear micro-seek flag after a short delay
        setTimeout(() => { state._isMicroSeek = false; }, 200);
      } else {
        state._isMicroSeek = false;
      }

      // Arm VCFM to verify a frame actually reaches the compositor.
      // If the seek+play didn't unstick it, VCFM escalates automatically.
      try { VideoCompositorFlushManager.arm(); } catch {}

      // Grace period for audio so the buffer monitor / waiting handler don't
      // kill audio during the first 600ms after tab return. Tab return is a
      // well-known time for audio cuts because readyState briefly drops.
      state.audioStartGraceUntil = Math.max(state.audioStartGraceUntil, now() + 600);

      // If user had paused before hiding, position correction above is enough — skip play/retry.
      if (!state.intendedPlaying) return;

      // Play immediately — don't wait for canplay or rAF.
      // If readyState is low, the browser will buffer naturally and fire "playing"
      // when ready. This is much better than showing a frozen frame for 1-3s.
      if (_wasPlayingBeforeHide) {
        DONTMAKEITDOUBLEPLAY.resetAll();
        if (vNode.paused) {
          try { HTMLMediaElement.prototype.play.call(vNode).catch(() => {}); } catch {}
        }
        // Also explicitly restart audio if it got paused during background.
        // The audio.play gate will let it through because we just set
        // audioStartGraceUntil and we're transitioning from hidden to visible.
        if (coupledMode && audio && audio.paused) {
          try { audio.play().catch(() => {}); } catch {}
        }
      }

      // If readyState is very low (decoder fully suspended), set up a simple
      // retry: check every 100ms, and if video is still frozen after 300ms,
      // do a harder kick (pause → seek → play). Give up after 2s.
      if (vRS < HAVE_CURRENT_DATA) {
        let _retryCount = 0;
        _tabReturnPollTimer = setInterval(() => {
          _retryCount++;
          if (!state.intendedPlaying || state.endedNaturally || document.visibilityState !== "visible") {
            clearInterval(_tabReturnPollTimer); _tabReturnPollTimer = null;
            return;
          }
          const rs = Number(vNode.readyState || 0);
          if (rs >= HAVE_FUTURE_DATA) {
            // decoder recovered — we're good
            clearInterval(_tabReturnPollTimer); _tabReturnPollTimer = null;
            return;
          }
          // At 300ms: harder kick — re-seek + play. Do NOT pause first.
          // Pausing before the seek causes: freeze-frame → seek flash → play,
          // which is the visible "flash of a scene / video shake" the user reports.
          // Just re-seek and play() — the seek itself replaces the current frame.
          if (_retryCount === 3 && !NotMakePlayBackFixingNoticable.isRecovering()) {
            const _curAtRetry = Number(vNode.currentTime) || 0;
            let _retryDur = 0;
            try { _retryDur = Number(vNode.duration) || 0; } catch {}
            const _retrySafeSeek =
              _finalSeekTarget >= 0.5 &&
              _finalSeekTarget >= _curAtRetry - 0.001 &&
              (_retryDur <= 0 || _finalSeekTarget < _retryDur - 0.5);
            if (_retrySafeSeek && canDoMicroSeek()) {
              recordMicroSeek();
              state._isMicroSeek = true;
              try { vNode.currentTime = _finalSeekTarget; } catch {}
              setTimeout(() => { state._isMicroSeek = false; }, 200);
            }
            DONTMAKEITDOUBLEPLAY.resetAll();
            try { HTMLMediaElement.prototype.play.call(vNode).catch(() => {}); } catch {}
          }
          // Give up after 2s — the rAF freeze detector takes over
          if (_retryCount >= 20) {
            clearInterval(_tabReturnPollTimer); _tabReturnPollTimer = null;
            if (vNode.paused && state.intendedPlaying) {
              DONTMAKEITDOUBLEPLAY.resetAll();
              try { HTMLMediaElement.prototype.play.call(vNode).catch(() => {}); } catch {}
            }
          }
        }, 100);
      }

      // Reset freeze detection state
      _frozenFrames = 0;
      _frozenSince = 0;
      _lastVideoTime = -1;
      _lastFrameCount = -1;
    }

    // ------------------------------------------------------------------
    // Scheduling
    // ------------------------------------------------------------------
    function _scheduleRaf() {
      if (_rafId !== null || !_running) return;
      _rafId = requestAnimationFrame(_rafTick);
    }

    function _scheduleWatchdog() {
      if (_watchdogTimer !== null || !_running) return;
      _watchdogTimer = setTimeout(_watchdogTick, WATCHDOG_MS);
    }

    // ------------------------------------------------------------------
    // Lifecycle
    // ------------------------------------------------------------------
    function start() {
      _running = true;
      _scheduleRaf();
      _scheduleWatchdog();
    }

    function stop() {
      _running = false;
      if (_rafId !== null) { cancelAnimationFrame(_rafId); _rafId = null; }
      if (_watchdogTimer !== null) { clearTimeout(_watchdogTimer); _watchdogTimer = null; }
    }

    function reset() {
      _lastVideoTime = -1;
      _lastFrameCount = -1;
      _frozenFrames = 0;
      _frozenSince = 0;
      _lastKickAt = 0;
      _tabReturnMicroSeekDone = false;
    }

    // destroy() — for SPA teardown. Nullifies references to prevent leaks.
    function destroy() {
      stop();
      if (_tabReturnPollTimer) { clearInterval(_tabReturnPollTimer); _tabReturnPollTimer = null; }
      _preHideTime = -1;
      _preHideAudioTime = -1;
      _wasPlayingBeforeHide = false;
    }

    // Reset the kick cooldown so the freeze detector can act immediately
    // after user play intent (rapid play/pause needs instant detection).
    function resetKickCooldown() { _lastKickAt = 0; _frozenFrames = 0; _frozenSince = 0; }

    return { start, stop, reset, destroy, onTabHide, onTabReturn, resetKickCooldown };
  })();

  // Backward-compatible alias: existing callsites use the single-n spelling
  const MakeVideoNotFreezeAfterPlaybackAfterAltTabHapens = MakeVideoNotFreezeAfterPlaybackAfterAltTabHapenns;

  // ═══════════════════════════════════════════════════════════════════════
  // VideoCompositorFlushManager (VCFM)
  // Detects stale GPU compositor texture (video says playing but frame frozen)
  // using RVFC + frame-count fallback. Arms on tab return / user play.
  // Micro-seeks to flush compositor if no frame renders within deadline.
  // ═══════════════════════════════════════════════════════════════════════
  const VideoCompositorFlushManager = (() => {
    const RVFC_AVAILABLE = typeof HTMLVideoElement !== "undefined" &&
      typeof HTMLVideoElement.prototype.requestVideoFrameCallback === "function";

    let _armed = false;
    let _armedAt = 0;
    let _flushAttempts = 0;
    let _deadlineTimer = null;
    let _rvfcResolved = false;
    let _lastFrameRenderedAt = 0;   // last confirmed frame render (RVFC)
    let _lastFlushAt = 0;
    let _armGen = 0;                // incremented each arm() — stale callbacks check this
    let _startFrameCount = -1;      // frame count at arm-time (fallback path)

    const MAX_FLUSH_ATTEMPTS = 5;
    const FRAME_DEADLINE_MS = 280;   // if no frame in 280ms after play, flush (was 350 — faster detection without false positives)
    const FLUSH_COOLDOWN_MS = 120;   // min gap between flush attempts (was 200 — faster retries for stuck compositor)
    const RECHECK_DELAY_MS = 40;     // delay before re-arming after a flush (was 60)

    function arm() {
      const vn = getVideoNode();
      if (!vn) return;
      _armGen++;
      _armed = true;
      _armedAt = now();
      _flushAttempts = 0;
      _rvfcResolved = false;
      _startFrameCount = getVideoPresentedFrameCount(vn);
      _scheduleFrameCheck(_armGen);
    }

    function disarm() {
      _armed = false;
      _armGen++;
      if (_deadlineTimer) { clearTimeout(_deadlineTimer); _deadlineTimer = null; }
    }

    function _scheduleFrameCheck(gen) {
      if (!_armed || gen !== _armGen) return;
      if (_deadlineTimer) { clearTimeout(_deadlineTimer); _deadlineTimer = null; }

      const vn = getVideoNode();
      if (!vn) { _armed = false; return; }

      // Don't check if video is paused — compositor only updates when playing
      if (vn.paused) {
        // Re-check after a short delay in case play() is in flight
        _deadlineTimer = setTimeout(() => {
          _deadlineTimer = null;
          if (gen !== _armGen || !_armed) return;
          const vn2 = getVideoNode();
          if (vn2 && !vn2.paused) _scheduleFrameCheck(gen);
          else _armed = false;
        }, 250);
        return;
      }

      _rvfcResolved = false;

      // Primary path: requestVideoFrameCallback
      if (RVFC_AVAILABLE) {
        try {
          vn.requestVideoFrameCallback((_nowTs, _metadata) => {
            if (gen !== _armGen) return; // stale
            _rvfcResolved = true;
            _lastFrameRenderedAt = now();
            _armed = false;
            if (_deadlineTimer) { clearTimeout(_deadlineTimer); _deadlineTimer = null; }
          });
        } catch {
          // RVFC failed — fall through to frame-count fallback
        }
      }

      // Deadline: if no frame renders in FRAME_DEADLINE_MS, flush
      _deadlineTimer = setTimeout(() => {
        _deadlineTimer = null;
        if (gen !== _armGen || !_armed) return;
        if (_rvfcResolved) return; // RVFC already confirmed

        // Fallback check: did frame count advance?
        const vn3 = getVideoNode();
        if (vn3) {
          const currentFrames = getVideoPresentedFrameCount(vn3);
          if (isFinite(_startFrameCount) && isFinite(currentFrames) &&
              currentFrames > _startFrameCount + 0.5) {
            _lastFrameRenderedAt = now();
            _armed = false;
            return; // frames advancing — compositor is healthy
          }
        }

        // No frame rendered — flush compositor
        _doFlush(gen);
      }, FRAME_DEADLINE_MS);
    }

    function _doFlush(gen) {
      if (!_armed || gen !== _armGen) return;
      if (_flushAttempts >= MAX_FLUSH_ATTEMPTS) {
        // Exhausted attempts — last-resort: pause-seek-play cycle
        _lastResortFlush(gen);
        _armed = false;
        return;
      }
      if ((now() - _lastFlushAt) < FLUSH_COOLDOWN_MS) {
        // Too soon — retry after cooldown
        setTimeout(() => _doFlush(gen), FLUSH_COOLDOWN_MS);
        return;
      }

      _flushAttempts++;
      _lastFlushAt = now();

      const vn = getVideoNode();
      if (!vn || vn.paused) { _armed = false; return; }

      const vt = Number(vn.currentTime) || 0;
      if (vt <= 0) { _armed = false; return; }

      // Forward micro-seek (+0.001s) to flush the stale GPU texture.
      // Forward seeks don't cause keyframe flash (decoder continues from
      // current GOP). DO NOT use pause→play — it causes decoder warm-up
      // delay that creates a worse multi-second freeze.
      // Use canDoCompositorFlush() — lighter check that allows flushes during
      // play/pause transitions (when compositor is most likely stuck).
      if (!canDoCompositorFlush()) {
        setTimeout(() => _doFlush(gen), COMPOSITOR_FLUSH_MIN_GAP_MS);
        return;
      }
      recordMicroSeek();
      state._isMicroSeek = true;
      try { vn.currentTime = vt + 0.001; } catch {}
      setTimeout(() => { state._isMicroSeek = false; }, 150);

      // Re-arm: schedule another RVFC check to verify the flush worked
      _startFrameCount = getVideoPresentedFrameCount(vn);
      setTimeout(() => {
        if (gen !== _armGen || !_armed) return;
        _rvfcResolved = false;
        _scheduleFrameCheck(gen);
      }, RECHECK_DELAY_MS);
    }

    // Last resort: if micro-seeks didn't unstick the compositor, do a
    // full pause→seek→play cycle. This is heavier but virtually guaranteed
    // to flush the compositor on all browsers.
    function _lastResortFlush(gen) {
      const vn = getVideoNode();
      if (!vn) return;
      const vt = Number(vn.currentTime) || 0;
      if (vt <= 0) return;
    // Use canDoCompositorFlush (40ms block) instead of canDoMicroSeek (400ms)
      // so last-resort fires quickly after play/pause.
      if (!canDoCompositorFlush()) return;
      recordMicroSeek();
      const _nPlay = HTMLMediaElement.prototype.play;

      state._isMicroSeek = true;
      try { vn.pause(); } catch {}
      // Forward micro-seek (+0.001) instead of backward to avoid keyframe flash.
      try { vn.currentTime = vt + 0.001; } catch {}
      DONTMAKEITDOUBLEPLAY.resetAll();
      // Use rAF to wait for the compositor to process the seek before playing.
      // This ensures the fresh frame is available when play() resumes rendering.
      requestAnimationFrame(() => {
        if (gen !== _armGen) return;
        try { _nPlay.call(vn).catch(() => {}); } catch {}
        state._isMicroSeek = false;
        _lastFrameRenderedAt = now();
      });
      setTimeout(() => { state._isMicroSeek = false; }, 300);
    }

    // Query: has a frame been confirmed within the last `ms` milliseconds?
    function isFrameRecent(ms = 500) {
      return _lastFrameRenderedAt > 0 && (now() - _lastFrameRenderedAt) < ms;
    }

    // Query: is the manager actively waiting for a frame?
    function isWaitingForFrame() {
      return _armed && !_rvfcResolved;
    }

    function getLastFrameAt() { return _lastFrameRenderedAt; }

    return { arm, disarm, isFrameRecent, isWaitingForFrame, getLastFrameAt };
  })();

  // ═══════════════════════════════════════════════════════════════════════
  // PlayResumeFrameVerifier (PRFV)
  // RVFC-based check after every play() resume. Detects compositor freeze
  // without micro-seeking during transition. Only acts after guard expires.
  // ═══════════════════════════════════════════════════════════════════════
  const PlayResumeFrameVerifier = (() => {
    const RVFC_OK = typeof HTMLVideoElement !== "undefined" &&
      typeof HTMLVideoElement.prototype.requestVideoFrameCallback === "function";

    let _gen = 0;
    let _timer = null;
    let _resolved = false;
    let _attempts = 0;
    const MAX_ATTEMPTS = 4;
    const FRAME_WAIT_MS = 180;       // time to wait for RVFC before acting (was 250→180 — faster freeze detection, matches playTogether RVFC kick timing)
    const RECHECK_MS = 120;          // time to wait after micro-seek for RVFC (was 150→120)

    function arm() {
      const vn = getVideoNode();
      if (!vn || vn.paused) return;
      _gen++;
      _resolved = false;
      _attempts = 0;
      _scheduleCheck(_gen);
    }

    function disarm() {
      _gen++;
      _resolved = true;
      if (_timer) { clearTimeout(_timer); _timer = null; }
    }

    function _scheduleCheck(gen) {
      if (_timer) { clearTimeout(_timer); _timer = null; }
      const vn = getVideoNode();
      if (!vn || vn.paused) return;

      _resolved = false;

      // Register RVFC — if a frame renders, we're good
      if (RVFC_OK) {
        try {
          vn.requestVideoFrameCallback(() => {
            if (gen !== _gen) return;
            _resolved = true;
            if (_timer) { clearTimeout(_timer); _timer = null; }
          });
        } catch {}
      }

      // Fallback: frame count comparison
      let startFrames = -1;
      try {
        const q = vn.getVideoPlaybackQuality && vn.getVideoPlaybackQuality();
        if (q) startFrames = q.totalVideoFrames;
      } catch {}

      // Intermediate frame count check at 150ms — catches most normal plays
      // early without waiting for the full 500ms deadline. On a normal play,
      // frames start advancing within 50-200ms. This prevents false positives
      // that would otherwise cause micro-seeks on every play/pause.
      let _earlyCheckTimer = setTimeout(() => {
        if (gen !== _gen || _resolved) return;
        if (isFinite(startFrames) && startFrames >= 0) {
          try {
            const _vn = getVideoNode();
            const _q = _vn && _vn.getVideoPlaybackQuality && _vn.getVideoPlaybackQuality();
            if (_q && _q.totalVideoFrames > startFrames) {
              _resolved = true;
              if (_timer) { clearTimeout(_timer); _timer = null; }
            }
          } catch {}
        }
      }, 150);

      // Deadline: if no frame in FRAME_WAIT_MS, compositor may be stuck
      _timer = setTimeout(() => {
        _timer = null;
        clearTimeout(_earlyCheckTimer);
        if (gen !== _gen || _resolved) return;

        // Check frame count fallback
        if (isFinite(startFrames) && startFrames >= 0) {
          try {
            const vn2 = getVideoNode();
            const q2 = vn2 && vn2.getVideoPlaybackQuality && vn2.getVideoPlaybackQuality();
            if (q2 && q2.totalVideoFrames > startFrames) {
              _resolved = true;
              return; // frames advancing — healthy
            }
          } catch {}
        }

        // Video is paused now? User paused during the check — abort
        const vn3 = getVideoNode();
        if (!vn3 || vn3.paused || !state.intendedPlaying) return;

        // Compositor stuck — try a micro-seek (respecting transition guard)
        if (_attempts >= MAX_ATTEMPTS) {
          // Exhausted — last resort: pause→seek→play
          _lastResortFix(gen);
          return;
        }
        _attempts++;

        // Fire compositor flush immediately — don't wait for transition guard.
        // canDoCompositorFlush() allows flushes during play/pause transitions,
        // which is exactly when the compositor is most likely stuck.
        _timer = setTimeout(() => {
          _timer = null;
          if (gen !== _gen || _resolved) return;
          const vn4 = getVideoNode();
          if (!vn4 || vn4.paused || !state.intendedPlaying) return;

          // Forward micro-seek (+0.001s) to flush compositor. Forward seeks
          // don't cause keyframe flash (decoder stays in current GOP).
          const vt = Number(vn4.currentTime) || 0;
          if (vt > 0.2 && canDoCompositorFlush()) {
            recordMicroSeek();
            state._isMicroSeek = true;
            try { vn4.currentTime = vt + 0.001; } catch {}
            setTimeout(() => { state._isMicroSeek = false; }, 200);
          }

          // Re-check after micro-seek
          setTimeout(() => {
            if (gen !== _gen) return;
            _scheduleCheck(gen);
          }, RECHECK_MS);
        }, 30);
      }, FRAME_WAIT_MS);
    }

    function _lastResortFix(gen) {
      const vn = getVideoNode();
      if (!vn || gen !== _gen) return;
      const vt = Number(vn.currentTime) || 0;
      if (vt <= 0.2) return;
      // Use canDoCompositorFlush (40ms block) not canDoMicroSeek (400ms block)
      // so last-resort fires quickly after play/pause transition.
      if (!canDoCompositorFlush()) return;
      recordMicroSeek();

      // Full pause→seek→play cycle — guaranteed to flush all browsers
      state._isMicroSeek = true;
      try { vn.pause(); } catch {}
      setTimeout(() => {
        if (gen !== _gen) { state._isMicroSeek = false; return; }
        const vn2 = getVideoNode();
        if (!vn2 || !state.intendedPlaying) { state._isMicroSeek = false; return; }
        const vt2 = Number(vn2.currentTime) || 0;
        // Use FORWARD micro-seek (+0.001) instead of backward (-0.01).
        // Backward seeks trigger the decoder to seek to the nearest I-frame
        // which can be 0.5-2s away, causing a visible "flash" of the wrong
        // frame. Forward seeks decode the next P/B-frame from the current
        // position — no keyframe flash.
        try { vn2.currentTime = vt2 + 0.001; } catch {}
        setTimeout(() => {
          state._isMicroSeek = false;
          if (gen !== _gen) return;
          const vn3 = getVideoNode();
          if (vn3 && vn3.paused && state.intendedPlaying) {
            try { vn3.play().catch(() => {}); } catch {}
          }
        }, 50);
      }, 30);
    }

    return { arm, disarm };
  })();

  // NuclearFreezeWatchdog (NFW)
  // Hard last resort: if video is "playing" but frames haven't advanced in
  // 500ms, ALL gentler systems failed. Pause → forward seek +0.1s → play.
  // Fires once per 2.5s to avoid loops.
  const NuclearFreezeWatchdog = (() => {
    let _timer = null;
    let _lastFrameCount = -1;
    let _lastFrameCheckAt = 0;
    let _lastNuclearAt = 0;
    const CHECK_MS = 500;     // was 700 — detect stuck compositor faster for rare play/pause freezes
    const COOLDOWN_MS = 2500; // was 3000 — allow re-kicks sooner after failed fix

    function _tick() {
      _timer = null;
      if (!state.intendedPlaying) return;
      if (document.visibilityState !== "visible") { _schedule(); return; }
      if (state.seeking || state.seekBuffering || state.restarting) { _schedule(); return; }
      if (state.endedNaturally) return;
      // Don't fire during the immediate play/pause transition — the decoder
      // needs time to warm up. But DON'T wait the full directUserToggleActive
      // window — that delays the nuclear fix too long, causing visible freezes
      // after play/pause. 200ms is enough for the decoder to start producing
      // frames; if it hasn't by then, the compositor is genuinely stuck.
      if (now() < state._playPauseTransitionUntil || directUserToggleActive(200)) { _schedule(); return; }

      const vn = getVideoNode();
      if (!vn || vn.paused) { _schedule(); return; }

      const fc = getVideoPresentedFrameCount(vn);
      const vt = Number(vn.currentTime) || 0;

      if (_lastFrameCheckAt > 0 && isFinite(fc) && isFinite(_lastFrameCount)) {
        const elapsed = now() - _lastFrameCheckAt;
        const framesAdvanced = fc > _lastFrameCount;
        const timeAdvanced = Math.abs(vt - (state._nfwLastVT || 0)) > 0.01;

        if (!framesAdvanced && !timeAdvanced && elapsed >= CHECK_MS * 0.9 &&
            (now() - _lastNuclearAt) > COOLDOWN_MS) {
          // NUCLEAR: video says playing, but nothing is moving. Force fix.
          // First try a lightweight RVFC micro-seek before the heavy pause→seek→play.
          // This catches most compositor stalls without the visible pause.
          _lastNuclearAt = now();
          const _nfwLightVT = Number(vn.currentTime) || 0;
          if (_nfwLightVT > 0.02 && canDoCompositorFlush()) {
            recordMicroSeek();
            state._isMicroSeek = true;
            try { vn.currentTime = _nfwLightVT + 0.001; } catch {}
            setTimeout(() => { state._isMicroSeek = false; }, 150);
            try { VideoCompositorFlushManager.arm(); } catch {}
            // If light flush doesn't work, the NEXT tick will escalate to heavy fix.
            // Reset frame counters so we detect the ongoing freeze.
            _lastFrameCount = -1;
            _lastFrameCheckAt = 0;
            // Schedule a heavy-fix fallback in case the light flush didn't work
            const _nfwHeavyTimer = setTimeout(() => {
              if (!state.intendedPlaying || state.seeking || state.seekBuffering) return;
              const _hfVN = getVideoNode();
              if (!_hfVN || _hfVN.paused) return;
              const _hfFC = getVideoPresentedFrameCount(_hfVN);
              const _hfVT = Number(_hfVN.currentTime) || 0;
              // Check if frames advanced after our light flush
              if (isFinite(_hfFC) && isFinite(fc) && _hfFC > fc) return; // fixed
              if (Math.abs(_hfVT - _nfwLightVT) > 0.05) return; // time advanced, fixed
              // Still stuck — do the heavy pause→seek→play
              state._isMicroSeek = true;
              state.isProgrammaticVideoPause = true;
              try { _hfVN.pause(); } catch {}
              setTimeout(() => {
                state.isProgrammaticVideoPause = false;
                if (!state.intendedPlaying) { state._isMicroSeek = false; return; }
                const vn3 = getVideoNode();
                if (!vn3) { state._isMicroSeek = false; return; }
                const curVT = Number(vn3.currentTime) || 0;
                try { vn3.currentTime = curVT + 0.1; } catch {}
                setTimeout(() => {
                  state._isMicroSeek = false;
                  if (!state.intendedPlaying) return;
                  DONTMAKEITDOUBLEPLAY.resetAll();
                  const p = execProgrammaticVideoPlay();
                  if (p && typeof p.catch === "function") p.catch(() => {});
                  if (coupledMode && audio) {
                    const newVT = Number(getVideoNode()?.currentTime) || 0;
                    if (Math.abs(Number(audio.currentTime) - newVT) > 0.3) {
                      state._allowAudioTimeWrite = true;
                      try { audio.currentTime = newVT; } catch {}
                      state._allowAudioTimeWrite = false;
                    }
                    if (audio.paused && !shouldBlockNewAudioStart()) {
                      execProgrammaticAudioPlay({ squelchMs: 200, force: true, minGapMs: 0 }).catch(() => {});
                    }
                  }
                }, 50);
              }, 30);
            }, 500);
          } else {
            // canDoCompositorFlush blocked — fall back to heavy fix directly
            state._isMicroSeek = true;
            state.isProgrammaticVideoPause = true;
            try { vn.pause(); } catch {}
            setTimeout(() => {
              state.isProgrammaticVideoPause = false;
              if (!state.intendedPlaying) { state._isMicroSeek = false; return; }
              const vn2 = getVideoNode();
              if (!vn2) { state._isMicroSeek = false; return; }
              const curVT = Number(vn2.currentTime) || 0;
              try { vn2.currentTime = curVT + 0.1; } catch {}
              setTimeout(() => {
                state._isMicroSeek = false;
                if (!state.intendedPlaying) return;
                DONTMAKEITDOUBLEPLAY.resetAll();
                const p = execProgrammaticVideoPlay();
                if (p && typeof p.catch === "function") p.catch(() => {});
                if (coupledMode && audio) {
                  const newVT = Number(getVideoNode()?.currentTime) || 0;
                  if (Math.abs(Number(audio.currentTime) - newVT) > 0.3) {
                    state._allowAudioTimeWrite = true;
                    try { audio.currentTime = newVT; } catch {}
                    state._allowAudioTimeWrite = false;
                  }
                  if (audio.paused && !shouldBlockNewAudioStart()) {
                    execProgrammaticAudioPlay({ squelchMs: 200, force: true, minGapMs: 0 }).catch(() => {});
                  }
                }
              }, 50);
            }, 30);
          }
        }
      }

      _lastFrameCount = isFinite(fc) ? fc : -1;
      _lastFrameCheckAt = now();
      state._nfwLastVT = vt;
      _schedule();
    }

    function _schedule() {
      if (_timer) return;
      _timer = setTimeout(_tick, CHECK_MS);
    }

    function start() { _schedule(); }
    function stop() { if (_timer) { clearTimeout(_timer); _timer = null; } }
    function reset() {
      _lastFrameCount = -1;
      _lastFrameCheckAt = 0;
    }

    return { start, stop, reset };
  })();

  // --- VisibilityGuard (VG)
  const VisibilityGuard = (() => {
    let _suppressUntil   = 0;
    let _tabHiddenAt     = 0;
    let _tabVisibleAt    = 0;
    let _lastPlayCalledAt = 0;

    // How long to suppress non-user pauses after each event type.
    const HIDE_SUPPRESS_MS       = 400;
    const SHOW_GRACE_MS          = 8000;
    const POST_PLAY_SUPPRESS_MS  = 3000;

    function _extend(ms) {
      _suppressUntil = Math.max(_suppressUntil, performance.now() + ms);
    }

    // Called the moment the page becomes hidden (visibilitychange → hidden OR blur)
    function onTabHide() {
      _tabHiddenAt = performance.now();
      _extend(HIDE_SUPPRESS_MS);
    }

    // Called the moment the page becomes visible (visibilitychange → visible OR focus)
    function onTabShow() {
      _tabVisibleAt = performance.now();
      _extend(SHOW_GRACE_MS);
    }

    // Called every time our own code issues a play() call.
    // Prevents the browser's "I paused because autoplay policy" response from
    // immediately killing intendedPlaying after we just set it.
    function onPlayCalled() {
      _lastPlayCalledAt = performance.now();
      _extend(POST_PLAY_SUPPRESS_MS);
    }

    // Called only when user explicitly pauses (markUserPauseIntent, MediaSession pause).
    // Clears suppression so the user's intent is respected immediately.
    function onUserPause() {
      _suppressUntil = 0;
    }

    // Primary gate: should we ignore this non-user-initiated pause event?
    function shouldSuppress() {
      return performance.now() < _suppressUntil;
    }

    // Is the page currently in a tab-return grace window?
    function isInReturnGrace() {
      return _tabVisibleAt > 0 && (performance.now() - _tabVisibleAt) < SHOW_GRACE_MS;
    }

    // Explicit extend (e.g. for BFCache restore or device wakeup)
    function extendMs(ms) { _extend(ms); }

    function getTabHiddenAt()  { return _tabHiddenAt;  }
    function getTabVisibleAt() { return _tabVisibleAt; }

    return {
      onTabHide, onTabShow, onPlayCalled, onUserPause,
      shouldSuppress, isInReturnGrace, extendMs,
      getTabHiddenAt, getTabVisibleAt,
    };
  })();



  // --- MediumQualityManager
  const MediumQualityManager = (() => {
    const enabled = !coupledMode;

    let _intentPaused = false;  // true = user wants video stopped
    let _lastUserPauseAt = 0;
    let _lastUserPlayAt = 0;
    let _pauseSerial = 0;       // incremented on every user pause, used to detect stale resumes

    const INTENT_WINDOW_MS = 120000; // 2min -- effectively sticky until user plays again

    function markUserPaused() {
      if (!enabled) return;
      _intentPaused = true;
      _lastUserPauseAt = performance.now();
      _pauseSerial++;
    }

    function markUserPlayed() {
      if (!enabled) return;
      _intentPaused = false;
      _lastUserPlayAt = performance.now();
    }

    // True when user has explicitly paused within the last INTENT_WINDOW_MS.
    // Used to block automatic resumes (runSync watchdog, "playing" event override, etc).
    function userRecentlyPaused() {
      return _intentPaused && (performance.now() - _lastUserPauseAt) < INTENT_WINDOW_MS;
    }

    // True when user has explicitly played within the last INTENT_WINDOW_MS.
    // Used to block automatic pause-coercion from background/transition guards.
    function userRecentlyPlayed() {
      return !_intentPaused && (performance.now() - _lastUserPlayAt) < INTENT_WINDOW_MS;
    }

    // Primary guard: should any automatic video resume be blocked right now?
    // Call this before execProgrammaticVideoPlay() or setting intendedPlaying=true
    // in response to non-user events in non-coupled mode.
    function shouldBlockAutoResume() {
      if (!enabled) return false;
      return userRecentlyPaused();
    }

    // Has the pause intent expired? Used by runSync to know when it's safe to
    // try restarting a stalled video (e.g. network recovery after a long stall).
    function intentExpired() {
      if (!enabled) return true;
      if (!_intentPaused) return true;
      return (performance.now() - _lastUserPauseAt) >= INTENT_WINDOW_MS;
    }

    function getPauseSerial() { return _pauseSerial; }

    return {
      get enabled() { return enabled; },
                                markUserPaused,
                                markUserPlayed,
                                userRecentlyPaused,
                                userRecentlyPlayed,
                                shouldBlockAutoResume,
                                intentExpired,
                                getPauseSerial,
                                get intentPaused() { return _intentPaused; },
    };
  })();


  // --- PlaybackStabilityManager
  const PlaybackStabilityManager = (() => {
    let _lastCorrectionAt = 0;
    let _correctionCount = 0;
    let _correctionWindowStart = 0;
    let _lastCheckedVT = -1;
    let _lastCheckedVTAt = 0;
    let _frozenSince = 0;          // when video appears frozen (position stuck)
  let _lastAutoResumeSuppressedAt = 0;

  const CORRECTION_COOLDOWN_MS = 1200;  // minimum gap between corrections
  const MAX_CORRECTIONS_IN_WINDOW = 4;  // max corrections per 10s window
  const CORRECTION_WINDOW_MS = 10000;
  const FROZEN_THRESHOLD_MS = 4000;     // video stuck at same position for 4s = frozen
  const FROZEN_THRESHOLD_POS = 0.05;    // position change < 0.05s = frozen

  function _canCorrect() {
    if ((performance.now() - _lastCorrectionAt) < CORRECTION_COOLDOWN_MS) return false;
    const n = performance.now();
    if ((n - _correctionWindowStart) > CORRECTION_WINDOW_MS) {
      _correctionCount = 0;
      _correctionWindowStart = n;
    }
    return _correctionCount < MAX_CORRECTIONS_IN_WINDOW;
  }

  function _markCorrection() {
    _lastCorrectionAt = performance.now();
    const n = performance.now();
    if ((n - _correctionWindowStart) > CORRECTION_WINDOW_MS) {
      _correctionCount = 0;
      _correctionWindowStart = n;
    }
    _correctionCount++;
  }

  // Called from heartbeat. Checks actual vs intended state and corrects if safe.
  function check(stateRef, getVideoPausedFn, execPlayFn, execPauseFn) {
    if (!stateRef || !getVideoPausedFn) return;
    try {
      const n = performance.now();
      // Tab-return immunity: skip all corrections during the immune window
      if (stateRef.tabReturnImmuneUntil > n) return;
      const videoPaused = getVideoPausedFn();
      const intending = stateRef.intendedPlaying;
      const isHidden = document.visibilityState === "hidden";
      const inGrace = (n - stateRef.lastBgReturnAt) < 8000;
      const isSeeking = stateRef.seeking || stateRef.syncing || stateRef.restarting;
      const isInFlight = stateRef.bgResumeInFlight || stateRef.seekResumeInFlight;

      // Track frozen playback (position not advancing despite intendedPlaying)
      try {
        if (!coupledMode && intending && !videoPaused && !isHidden && !isSeeking) {
          let vt = 0;
          try { vt = Number(stateRef.lastVT || 0); } catch {}
          if (Math.abs(vt - _lastCheckedVT) < FROZEN_THRESHOLD_POS && _lastCheckedVT >= 0) {
            if (!_frozenSince) _frozenSince = n;
          } else {
            _frozenSince = 0;
            _lastCheckedVT = vt;
            _lastCheckedVTAt = n;
          }
        } else {
          _frozenSince = 0;
        }
      } catch {}

      // Correction 1: Video should be playing but is unexpectedly paused
      if (intending && videoPaused && !isHidden && !inGrace && !isSeeking && !isInFlight) {
        // Check all blocking conditions before attempting a correction
        const noUserPause = !stateRef.userPauseUntil || n >= stateRef.userPauseUntil;
        const noMediumBlock = !MediumQualityManager.shouldBlockAutoResume();
        const noMediaForced = !stateRef.mediaForcedPauseUntil || n >= stateRef.mediaForcedPauseUntil;
        const notInStartupHold = !stateRef.strictBufferHold;

        if (noUserPause && noMediumBlock && noMediaForced && notInStartupHold && _canCorrect()) {
          try { execPlayFn && execPlayFn(); } catch {}
          _markCorrection();
        }
      }

      // Correction 2: Video should be paused but is unexpectedly playing
      if (!intending && !videoPaused && !isSeeking &&
        !stateRef.isProgrammaticVideoPlay && !isInFlight) {
        // Only correct if we're confident this isn't a transient/buffering resume
        const notInTxn = n >= (stateRef.mediaLockUntil || 0);
      const notInStartupGrace = stateRef.firstPlayCommitted;
      if (notInTxn && notInStartupGrace && _canCorrect()) {
        try { execPauseFn && execPauseFn(); } catch {}
        _markCorrection();
      }
        }

        // Correction 3: Detect if autoplay keep-alive is fighting a user pause (non-coupled)
        if (!coupledMode && !intending && !videoPaused && !isSeeking) {
          _lastAutoResumeSuppressedAt = n;
        }
    } catch {}
  }

  function getLastCorrectionAge() {
    return performance.now() - _lastCorrectionAt;
  }

  function isFrozen() {
    return _frozenSince > 0 && (performance.now() - _frozenSince) > FROZEN_THRESHOLD_MS;
  }

  function resetFrozen() { _frozenSince = 0; }

  function onUserAction() {
    // Reset oscillation counters on deliberate user interaction
    _correctionCount = 0;
    _correctionWindowStart = 0;
  }

  return {
    check,
    isFrozen,
    resetFrozen,
    onUserAction,
    getLastCorrectionAge,
  };
  })();


  // --- BringBackToTabManager (BBTM)
  const BringBackToTabManager = (() => {
    // How long to hold the lock after a tab-return event.
    // 3500ms covers Chromium's longest observed spurious-pause burst (~800ms)
    // with a generous safety margin for slow machines and Firefox.
    const LOCK_DURATION_MS = 3500;

    // After video is confirmed playing, how long to continue absorbing late
    // spurious pauses. Runs CONCURRENTLY with the main lock — does not replace it.
    const POST_PLAY_SETTLE_MS = 2000;

    let _lockUntil           = 0;
    let _postPlaySettleUntil = 0;
    let _returnTs            = 0;  // timestamp of the most recent tab-return event
    let _videoConfirmedAt    = 0;  // when video was first confirmed playing this return
    let _lateArrivalCount    = 0;  // how many pause events arrived after video confirmed

    function isLocked() {
      return now() < _lockUntil || now() < _postPlaySettleUntil;
    }

    // Called the instant the tab becomes visible.
    function onTabReturn() {
      _returnTs            = now();
      _lockUntil           = now() + LOCK_DURATION_MS;
      _postPlaySettleUntil = 0;
      _videoConfirmedAt    = 0;
      _lateArrivalCount    = 0;
    }

    // Called once the video is confirmed playing after a return.
    // v2: does NOT drain _lockUntil — main lock runs to natural expiry.
    // Only sets _postPlaySettleUntil as an ADDITIONAL protection layer.
    function onVideoConfirmedPlaying() {
      if (_returnTs === 0) return; // not in a return sequence
      if (!_videoConfirmedAt) _videoConfirmedAt = now();
      // Post-play settle window starts from confirmation time, runs 2s
      _postPlaySettleUntil = Math.max(_postPlaySettleUntil, now() + POST_PLAY_SETTLE_MS);
      // Main lock stays: _lockUntil is NOT drained here (v2 change)
    }

    // Called each time a pause event is suppressed after video was already confirmed.
    // Adaptively extends both windows so late-arriving pauses keep getting absorbed.
    function onLateArrivedPause() {
      _lateArrivalCount++;
      if (_lateArrivalCount <= 8) {
        _lockUntil           = Math.max(_lockUntil,           now() + 400);
        _postPlaySettleUntil = Math.max(_postPlaySettleUntil, now() + 600);
      }
    }

    // Called when the user explicitly pauses — cancel immediately so their
    // pause isn't swallowed.
    function onUserPause() {
      _lockUntil           = 0;
      _postPlaySettleUntil = 0;
      _returnTs            = 0;
      _videoConfirmedAt    = 0;
      _lateArrivalCount    = 0;
    }

    // Extend both windows by ms (e.g. when audio is still catching up).
    function extendLock(ms) {
      if (_returnTs === 0) return;
      _lockUntil           = Math.max(_lockUntil,           now() + ms);
      _postPlaySettleUntil = Math.max(_postPlaySettleUntil, now() + ms);
    }

    // Hard cancel (e.g. page unload, error recovery).
    function cancelLock() {
      _lockUntil           = 0;
      _postPlaySettleUntil = 0;
      _returnTs            = 0;
      _videoConfirmedAt    = 0;
      _lateArrivalCount    = 0;
    }

    // How long ago (ms) was the last tab return? Used by retry loop.
    function timeSinceReturn() {
      return _returnTs > 0 ? (now() - _returnTs) : Infinity;
    }

    function isVideoConfirmed()    { return _videoConfirmedAt > 0; }
    function getLateArrivalCount() { return _lateArrivalCount; }

    return {
      isLocked, onTabReturn, onVideoConfirmedPlaying, onLateArrivedPause,
      onUserPause, cancelLock, extendLock, timeSinceReturn,
      isVideoConfirmed, getLateArrivalCount,
    };
  })();


  // --- QuantumReturnOrchestrator (QRO)
  const QuantumReturnOrchestrator = (() => {
    let _snapshot          = null;  // {ts, vPos, aPos, wasPlaying}
    let _returnTs          = 0;     // when we last returned to foreground
    let _preemptiveFired   = false; // did preemptive play() fire this return?
    let _bgPlayConfirmed   = false; // bg playback confirmed still running on return
    let _audioPreAligned   = false; // did we pre-align audio before play()?

    // --- background entry
    // Snapshot state the instant the page hides. Called from visibilitychange
    // hidden branch AND from the blur handler for maximum coverage.
    function snapshotState() {
      try {
        const vPos = (() => { try { return Number(video.currentTime()) || 0; } catch { return 0; } })();
        const aPos = (coupledMode && audio) ? (Number(audio.currentTime) || vPos) : null;
        _snapshot = {
          ts:         performance.now(),
                                     vPos,
                                     aPos,
                                     wasPlaying: state.intendedPlaying,
        };
      } catch {}
    }

    // --- foreground return: pre-emptive play
    function preemptivePlay() {
      if (!state.intendedPlaying) return;
      if (state.endedNaturally) return;
      if (MakeSureUnintentionalLoopDoesntEverHappenAtALLManager.shouldBlockAutoRestart()) return;
      _returnTs        = performance.now();
      _preemptiveFired = false;
      _audioPreAligned = false;
      _bgPlayConfirmed = false;

      try {
        const vn = getVideoNode();
        if (vn && typeof vn.play === 'function') {
          vn.play().catch(() => {});
          _preemptiveFired = true;
        }
        if (coupledMode && audio && !state.tabReturnAudioMuted && !isTabReturnImmune() && !NotMakePlayBackFixingNoticable.shouldBlockSeek()) {
          try {
            const vt = Number(video.currentTime()) || 0;
            // Never seek audio near 0 when it's playing well into the track
            if (isFinite(vt) && Math.abs((audio.currentTime || 0) - vt) > 1.0 &&
              !(vt < 0.5 && state.firstPlayCommitted && !state.restarting && !isLoopDesired() && (Number(audio.currentTime) || 0) > 2)) {
              audio.currentTime = vt;
            _audioPreAligned = true;
              }
          } catch {}
          if (audio.paused) {
            cancelActiveFade();
            audio.play().catch(() => {});
          }
        }
      } catch {}
    }

    // --- continuity assessment
    // Called by the retry loop on first success tick. Determines whether
    // background playback was alive (position advanced) or killed.
    function assessContinuity() {
      if (!_snapshot) return;
      try {
        const vNow    = (() => { try { return Number(video.currentTime()); } catch { return NaN; } })();
        const elapsed = (performance.now() - _snapshot.ts) / 1000;
        // If video is significantly ahead of where it was when we went BG,
        // background playback was running (rare but possible on some platforms).
        if (isFinite(vNow) && (vNow - _snapshot.vPos) > (elapsed * 0.5)) {
          _bgPlayConfirmed = true;
        }
      } catch {}
    }

    function getSnapshot()        { return _snapshot; }
    function getReturnAge()       { return _returnTs ? (performance.now() - _returnTs) : Infinity; }
    function wasBgPlayConfirmed() { return _bgPlayConfirmed; }
    function wasPreemptiveFired() { return _preemptiveFired; }

    return {
      snapshotState, preemptivePlay, assessContinuity,
      getSnapshot, getReturnAge, wasBgPlayConfirmed, wasPreemptiveFired,
    };
  })();




  // ═══════════════════════════════════════════════════════════════════════════
  const UltraStabilizer = (() => {
    // --- shared nano-clock
    const _now = () => performance.now();

    // --- 1. AudioVideoLockstepGuard (AVLG)
    const AVLG = (() => {
      let _videoHasPlayed    = false; // video fired "playing" at least once
      let _audioHasPlayed    = false; // audio fired "playing" at least once
      let _lockReleasedAt    = 0;     // when the startup lock was lifted
      let _startupLockActive = true;  // stays true until video plays or timeout
      let _videoStallCount   = 0;
      let _audioStallCount   = 0;
      let _audioBlockLog     = 0;     // how many times we blocked audio (debug)

    // The lock is released when video plays OR after 12s (failsafe)
    const STARTUP_LOCK_TIMEOUT_MS = 3000;
    const _startTs = _now();

    function _maybeReleaseLock() {
      if (!_startupLockActive) return;
      if (_videoHasPlayed) {
        _startupLockActive = false;
        _lockReleasedAt = _now();
      } else if ((_now() - _startTs) > STARTUP_LOCK_TIMEOUT_MS) {
        // Failsafe: release after timeout to not block forever
        _startupLockActive = false;
        _lockReleasedAt = _now();
      } else {
        // Early release: if video element has enough data to play (readyState ≥ 3),
        // release the lock even if "playing" hasn't fired yet. The "playing" event
        // can be delayed by browser internals, but readyState is a direct indicator
        // that the video is ready to go.
        try {
          const vn = getVideoNode();
          if (vn && Number(vn.readyState || 0) >= 3) {
            _videoHasPlayed = true;
            _startupLockActive = false;
            _lockReleasedAt = _now();
          }
        } catch {}
      }
    }

    function onVideoPlaying() {
      _videoHasPlayed = true;
      _videoStallCount = 0;
      _maybeReleaseLock();
    }

    function onAudioPlaying() {
      _audioHasPlayed = true;
      _audioStallCount = 0;
    }

    function onVideoStall() { _videoStallCount++; }
    function onAudioStall() { _audioStallCount++; }

    // Primary gate: return true → caller must NOT play audio right now
    function shouldBlockAudio() {
      _maybeReleaseLock();
      if (!_startupLockActive) return false;
      if (!coupledMode) return false; // only matters in coupled A/V mode
      if (_videoHasPlayed) return false;
      // Once first play committed (user clicked play), never block audio
      if (state.firstPlayCommitted) return false;
      // Video not yet playing → block audio
      _audioBlockLog++;
      return true;
    }

    function isVideoConfirmedPlaying() { return _videoHasPlayed; }
    function isAudioConfirmedPlaying() { return _audioHasPlayed; }
    function getAudioBlockCount()      { return _audioBlockLog;   }
    function isStartupLockActive()     { return _startupLockActive; }

    // Force-release for edge cases (e.g. muxed mode toggle)
    function forceRelease() { _startupLockActive = false; _lockReleasedAt = _now(); }

    return {
      onVideoPlaying, onAudioPlaying, onVideoStall, onAudioStall,
      shouldBlockAudio, isVideoConfirmedPlaying, isAudioConfirmedPlaying,
      getAudioBlockCount, isStartupLockActive, forceRelease,
    };
    })();

    // --- 2. StartupSequencer
    // State machine that tracks the startup phase with strict ordering.
    // Phases: COLD → VIDEO_LOADING → VIDEO_READY → VIDEO_PLAYING → BOTH_COMMITTED → STABLE
    const StartupSequencer = (() => {
      const PHASE = {
        COLD: 0, VIDEO_LOADING: 1, VIDEO_READY: 2,
        VIDEO_PLAYING: 3, BOTH_COMMITTED: 4, STABLE: 5,
      };
      let _phase = PHASE.COLD;
      let _phaseAt = _now();
      let _videoReadyStateAtStart = 0;
      let _audioReadyStateAtStart = 0;
      let _videoPlayedAt  = 0;
      let _audioPlayedAt  = 0;
      let _bothCommittedAt = 0;
      let _stableAt        = 0;
      const STABILITY_WINDOW_MS = 500; // both must play for 500ms to reach STABLE

      function _advance(newPhase) {
        if (newPhase > _phase) { _phase = newPhase; _phaseAt = _now(); }
      }

      function onVideoLoading()  { _advance(PHASE.VIDEO_LOADING); }
      function onVideoReady()    {
        _videoReadyStateAtStart = (() => { try { return Number(getVideoNode().readyState || 0); } catch { return 0; } })();
        _advance(PHASE.VIDEO_READY);
      }
      function onVideoPlaying()  {
        _videoPlayedAt = _now();
        _advance(PHASE.VIDEO_PLAYING);
        // Once video plays, audio is permitted — immediately try to advance
        if (_audioPlayedAt > 0) _checkBothCommitted();
      }
      function onAudioPlaying()  {
        _audioPlayedAt = _now();
        _checkBothCommitted();
      }
      function _checkBothCommitted() {
        if (!coupledMode) { _advance(PHASE.BOTH_COMMITTED); return; }
        if (_videoPlayedAt > 0 && _audioPlayedAt > 0) {
          _bothCommittedAt = _now();
          _advance(PHASE.BOTH_COMMITTED);
        }
      }

      // Called from periodic tick
      function tick() {
        if (_phase === PHASE.BOTH_COMMITTED && (_now() - _bothCommittedAt) > STABILITY_WINDOW_MS) {
          _stableAt = _now();
          _advance(PHASE.STABLE);
        }
        // Failsafe: after 15s always mark stable
        if (_phase < PHASE.STABLE && (_now() - _phaseAt) > 15000) {
          _advance(PHASE.STABLE);
        }
      }

      function shouldBlockAudioAtStartup() {
        if (!coupledMode) return false;
        // Once first play committed, never block audio via startup gates
        if (state.firstPlayCommitted) return false;
        // Timeout: stop blocking after 1.5s — if video hasn't fired "playing"
        // by then, audio should start anyway. Blocking longer makes audio feel
        // "broken" on slow connections or heavy pages where video decode is delayed.
        if (_phaseAt > 0 && (_now() - _phaseAt) > 1500) return false;
        // Block audio if video has not yet fired "playing"
        return _phase < PHASE.VIDEO_PLAYING;
      }

      function isStable()          { return _phase >= PHASE.STABLE; }
      function isBothCommitted()   { return _phase >= PHASE.BOTH_COMMITTED; }
      function getPhaseLabel()     {
        return ['COLD','VIDEO_LOADING','VIDEO_READY','VIDEO_PLAYING','BOTH_COMMITTED','STABLE'][_phase] || '?';
      }
      function getPhaseAge()       { return _now() - _phaseAt; }

      return {
        onVideoLoading, onVideoReady, onVideoPlaying, onAudioPlaying,
        tick, shouldBlockAudioAtStartup, isStable, isBothCommitted,
        getPhaseLabel, getPhaseAge,
      };
    })();

    // --- 3. BufferHealthMonitor
    // Every tick, measures buffered-seconds-ahead for video and audio.
    // Maintains a rolling 8-sample window; calculates health score 0-100.
    const BufferHealthMonitor = (() => {
      const WINDOW = 8;
      const _vBuf = new Array(WINDOW).fill(0);
      const _aBuf = new Array(WINDOW).fill(0);
      let _idx = 0;
      let _videoScore = 100;
      let _audioScore = 100;
      let _lastCheckAt = 0;
      const CHECK_INTERVAL_MS = 600;

      function _bufferedAheadVideo() {
        try {
          const vNode = getVideoNode();
          const ct = Number(vNode.currentTime || 0);
          const tb = vNode.buffered;
          let best = 0;
          for (let i = 0; i < tb.length; i++) {
            if (tb.start(i) <= ct + 0.1) best = Math.max(best, tb.end(i) - ct);
          }
          return best;
        } catch { return 0; }
      }

      function _bufferedAheadAudio() {
        if (!coupledMode || !audio) return 999;
        try {
          const ct = Number(audio.currentTime || 0);
          const tb = audio.buffered;
          let best = 0;
          for (let i = 0; i < tb.length; i++) {
            if (tb.start(i) <= ct + 0.1) best = Math.max(best, tb.end(i) - ct);
          }
          return best;
        } catch { return 0; }
      }

      function _scoreFromSamples(samples) {
        const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
        const recent = samples.slice(-3).reduce((a, b) => a + b, 0) / 3;
        // 0→0, 0.5→40, 2→80, 5→100
        const avgScore = Math.min(100, avg * 20);
        const recentScore = Math.min(100, recent * 20);
        return Math.round(avgScore * 0.4 + recentScore * 0.6);
      }

      function tick() {
        if ((_now() - _lastCheckAt) < CHECK_INTERVAL_MS) return;
        _lastCheckAt = _now();
        _vBuf[_idx % WINDOW] = _bufferedAheadVideo();
        _aBuf[_idx % WINDOW] = _bufferedAheadAudio();
        _idx++;
        _videoScore = _scoreFromSamples(_vBuf);
        _audioScore = _scoreFromSamples(_aBuf);
      }

      function getVideoScore()    { return _videoScore; }
      function getAudioScore()    { return _audioScore; }
      function getCombinedScore() { return Math.min(_videoScore, coupledMode ? _audioScore : 100); }
      function isHealthy()        { return getCombinedScore() >= 40; }
      function getVideoAheadSec() { return _vBuf[(_idx - 1 + WINDOW) % WINDOW]; }
      function getAudioAheadSec() { return _aBuf[(_idx - 1 + WINDOW) % WINDOW]; }

      return { tick, getVideoScore, getAudioScore, getCombinedScore, isHealthy, getVideoAheadSec, getAudioAheadSec };
    })();

    // --- 4. DriftSupervisor
    // Second-layer drift detection on top of runSync. Runs at high frequency
    // and catches edge cases the main sync loop misses.
    const DriftSupervisor = (() => {
      const HISTORY_LEN = 12;
      const _driftHistory = new Array(HISTORY_LEN).fill(0);
      let _dIdx           = 0;
      let _lastCheckAt    = 0;
      let _currentDriftMs = 0;
      let _runawayCount   = 0;   // consecutive checks where drift is growing
      let _criticalCount  = 0;   // consecutive checks where drift > critical threshold
      let _correctionCount = 0;
      let _lastCorrectionAt = 0;
      const CHECK_INTERVAL_MS    = 500;  // was 300 — reduced CPU on slow devices
      const CRITICAL_DRIFT_MS    = 400;  // 400ms A/V drift = critical
      const RUNAWAY_THRESHOLD    = 5;    // 5 consecutive growing-drift checks = runaway
      const CRITICAL_THRESHOLD   = 3;    // 3 consecutive critical checks = correct
      const CORRECTION_COOLDOWN  = 2000; // min ms between UltraStabilizer drift corrections

      function tick() {
        if (!coupledMode || !audio) return;
        if ((_now() - _lastCheckAt) < CHECK_INTERVAL_MS) return;
        _lastCheckAt = _now();

        let driftMs = 0;
        try {
          const vt = Number(video.currentTime()) || 0;
          const at = Number(audio.currentTime) || 0;
          driftMs = Math.abs(at - vt) * 1000;
        } catch { return; }

        const prev = _driftHistory[(_dIdx - 1 + HISTORY_LEN) % HISTORY_LEN];
        _driftHistory[_dIdx % HISTORY_LEN] = driftMs;
        _dIdx++;
        _currentDriftMs = driftMs;

        // Runaway detection: drift increasing monotonically
        if (driftMs > prev && prev > 100) _runawayCount++;
        else _runawayCount = 0;

        // Critical accumulation
        if (driftMs > CRITICAL_DRIFT_MS) _criticalCount++;
        else _criticalCount = Math.max(0, _criticalCount - 1);

        // Auto-correct: if drift is critical AND stable (not already correcting)
        if (_criticalCount >= CRITICAL_THRESHOLD && (_now() - _lastCorrectionAt) > CORRECTION_COOLDOWN) {
          _attemptCorrection();
        }
      }

      function _attemptCorrection() {
        try {
          // Only correct during stable foreground playback
          if (document.visibilityState !== "visible") return;
          if (!state.intendedPlaying) return;
          if (state.seeking || state.syncing || state.restarting) return;
          if (BringBackToTabManager.isLocked()) return;
          const vt = Number(video.currentTime()) || 0;
          const at = Number(audio.currentTime) || 0;
          if (Math.abs(at - vt) > 0.3) {
            // safeSetAudioTime is a function declaration and is hoisted
            safeSetAudioTime(vt);
            _correctionCount++;
            _lastCorrectionAt = _now();
            _criticalCount = 0;
          }
        } catch {}
      }

      function getDriftMs()      { return _currentDriftMs; }
      function isDriftCritical() { return _criticalCount >= CRITICAL_THRESHOLD; }
      function isDriftRunaway()  { return _runawayCount >= RUNAWAY_THRESHOLD; }
      function getAvgDriftMs() {
        return _driftHistory.reduce((a, b) => a + b, 0) / HISTORY_LEN;
      }

      return { tick, getDriftMs, isDriftCritical, isDriftRunaway, getAvgDriftMs };
    })();

    // --- 5. StallRecoveryEngine
    const StallRecoveryEngine = (() => {
      let _videoPosSamples   = [];
      let _audioTimeSamples  = [];
      let _videoStallSince   = 0;
      let _audioStallSince   = 0;
      let _lastRecoveryAt    = 0;
      let _recoveryAttempts  = 0;
      let _inRecovery        = false;
      let _lastSampleAt      = 0;

      const SAMPLE_INTERVAL_MS  = 800;
      const VIDEO_STALL_MS      = 3500;
      const AUDIO_STALL_MS      = 3000;
      const RECOVERY_COOLDOWN   = 6000;
      const MAX_ATTEMPTS        = 4;
      const SAMPLE_WINDOW       = 5;

      function _samplePositions() {
        if ((_now() - _lastSampleAt) < SAMPLE_INTERVAL_MS) return;
        _lastSampleAt = _now();
        try {
          const vt = Number(video.currentTime()) || 0;
          _videoPosSamples.push({ t: _now(), pos: vt });
          if (_videoPosSamples.length > SAMPLE_WINDOW) _videoPosSamples.shift();
        } catch {}
        if (coupledMode && audio) {
          try {
            const at = Number(audio.currentTime) || 0;
            _audioTimeSamples.push({ t: _now(), pos: at });
            if (_audioTimeSamples.length > SAMPLE_WINDOW) _audioTimeSamples.shift();
          } catch {}
        }
      }

      function _isVideoPositionFrozen() {
        if (_videoPosSamples.length < 3) return false;
        const oldest = _videoPosSamples[0];
        const newest = _videoPosSamples[_videoPosSamples.length - 1];
        const elapsed = newest.t - oldest.t;
        const moved   = Math.abs(newest.pos - oldest.pos);
        return elapsed > VIDEO_STALL_MS && moved < 0.08;
      }

      function _isAudioTimeFrozen() {
        if (!coupledMode || _audioTimeSamples.length < 3) return false;
        const oldest = _audioTimeSamples[0];
        const newest = _audioTimeSamples[_audioTimeSamples.length - 1];
        const elapsed = newest.t - oldest.t;
        const moved   = Math.abs(newest.pos - oldest.pos);
        return elapsed > AUDIO_STALL_MS && moved < 0.08;
      }

      function tick() {
        _samplePositions();
        // Watchdog: if _inRecovery has been stuck for >3s, force-clear it
        if (_inRecovery && (_now() - _lastRecoveryAt) > 3000) _inRecovery = false;
        if (!state.intendedPlaying || _inRecovery) return;
        if ((_now() - _lastRecoveryAt) < RECOVERY_COOLDOWN) return;
        if (state.seeking || state.syncing || state.strictBufferHold) return;
        if (document.visibilityState === "hidden") return;

        const videoPaused = getVideoPaused();

        // If video is playing normally, reset attempt counter so stall
        // recovery stays available across the full session
        if (!videoPaused && !_isVideoPositionFrozen() && _recoveryAttempts > 0) {
          if ((_now() - _lastRecoveryAt) > 15000) {
            _recoveryAttempts = 0;
          }
        }

        // Video freeze: video supposedly playing but position frozen
        if (!videoPaused && _isVideoPositionFrozen()) {
          if (!_videoStallSince) _videoStallSince = _now();
          if ((_now() - _videoStallSince) > VIDEO_STALL_MS) {
            _triggerVideoRecovery("freeze");
            return;
          }
        } else {
          _videoStallSince = 0;
        }

        // Audio silence stall: audio playing but currentTime not advancing
        if (coupledMode && audio && !audio.paused && _isAudioTimeFrozen()) {
          if (!_audioStallSince) _audioStallSince = _now();
          if ((_now() - _audioStallSince) > AUDIO_STALL_MS) {
            _triggerAudioRecovery("time-freeze");
            return;
          }
        } else {
          _audioStallSince = 0;
        }
      }

      function _triggerVideoRecovery(reason) {
        if (_recoveryAttempts >= MAX_ATTEMPTS) return;
        if (!state.intendedPlaying) return;
        if (seekStabilizeActive() || state.seekResumeInFlight || now() < state.seekCooldownUntil) return;
        _inRecovery = true;
        _recoveryAttempts++;
        _lastRecoveryAt = _now();
        _videoPosSamples = [];
        _audioTimeSamples = [];
        try {
          // Stage 1: just re-issue play. Do not do tiny seeks here:
          // they show up as visible/random jumps after user seeks.
          execProgrammaticVideoPlay();
          setTimeout(() => {
            _inRecovery = false;
            if (seekStabilizeActive() || state.seekResumeInFlight || now() < state.seekCooldownUntil) return;
            if (getVideoPaused() && state.intendedPlaying) {
              try { execProgrammaticVideoPlay(); } catch {}
            }
          }, 1200);
        } catch { _inRecovery = false; }
      }

      function _triggerAudioRecovery(reason) {
        if (!coupledMode || !audio) return;
        _inRecovery = true;
        _recoveryAttempts++;
        _lastRecoveryAt = _now();
        _audioTimeSamples = [];
        try {
          const vt = Number(video.currentTime()) || 0;
          safeSetAudioTime(vt);
          execProgrammaticAudioPlay({ force: true, squelchMs: 250, minGapMs: 0 }).catch(() => {});
          setTimeout(() => { _inRecovery = false; }, 1500);
        } catch { _inRecovery = false; }
      }

      function onSeekStart() { _videoPosSamples = []; _audioTimeSamples = []; _videoStallSince = 0; _audioStallSince = 0; }
      function onRecovery()  { _inRecovery = false; _videoPosSamples = []; _audioTimeSamples = []; }
      function resetAttempts() { _recoveryAttempts = 0; }

      return { tick, onSeekStart, onRecovery, resetAttempts };
    })();

    // --- 6. AudioContextReviver
    // Keeps the Web Audio API context in 'running' state. A suspended context
    // causes audio to silently stop on some browsers/OS combos.
    const AudioContextReviver = (() => {
      let _ctx = null;
      let _lastReviveAt = 0;
      let _reviveCount = 0;
      const REVIVE_COOLDOWN_MS = 3000;

      function _findContext() {
        if (_ctx) return _ctx;
        try {
          // Try to find or create an AudioContext
          if (typeof AudioContext !== "undefined") {
            _ctx = new AudioContext();
          } else if (typeof webkitAudioContext !== "undefined") {
            _ctx = new webkitAudioContext(); // eslint-disable-line new-cap
          }
        } catch {}
        return _ctx;
      }

      function revive() {
        if ((_now() - _lastReviveAt) < REVIVE_COOLDOWN_MS) return;
        const ctx = _findContext();
        if (!ctx) return;
        if (ctx.state === "suspended") {
          ctx.resume().then(() => {
            _lastReviveAt = _now();
            _reviveCount++;
          }).catch(() => {});
        }
      }

      function onUserGesture() {
        // User gestures are the only reliable way to unlock AudioContext
        const ctx = _findContext();
        if (!ctx) return;
        if (ctx.state !== "running") {
          ctx.resume().catch(() => {});
          _lastReviveAt = _now();
        }
      }

      function tick() {
        if (!coupledMode || !audio) return;
        if (!state.intendedPlaying) return;
        revive();
      }

      function getState() {
        const ctx = _ctx;
        return ctx ? ctx.state : "no-context";
      }

      return { revive, onUserGesture, tick, getState };
    })();

    // --- 7. PositionFreezeDetector
    // Maintains a sample history of video playback position. Detects when the
    // position is stuck at the same value for too long while supposedly playing.
    const PositionFreezeDetector = (() => {
      const SAMPLES = 6;
      let _positions    = new Array(SAMPLES).fill(-1);
      let _timestamps   = new Array(SAMPLES).fill(0);
      let _idx          = 0;
      let _frozenSince  = 0;
      let _lastSampleAt = 0;

      const SAMPLE_MS       = 1000;   // sample every 1s
      const FREEZE_POS_DELTA = 0.05; // < 0.05s movement = frozen
      const FREEZE_CONFIRM_MS = 5000; // 5s of no movement = confirmed freeze

      function sample() {
        if ((_now() - _lastSampleAt) < SAMPLE_MS) return;
        _lastSampleAt = _now();
        try {
          const pos = Number(video.currentTime()) || 0;
          _positions[_idx % SAMPLES]  = pos;
          _timestamps[_idx % SAMPLES] = _now();
          _idx++;
        } catch {}
      }

      function isFrozen() {
        if (!state.intendedPlaying || getVideoPaused()) return false;
        if (state.seeking || state.syncing || state.strictBufferHold) return false;
        if (document.visibilityState === "hidden") return false;
        if (_idx < SAMPLES) return false; // not enough samples
        const oldest = _positions[_idx % SAMPLES];
        const newest = _positions[(_idx - 1 + SAMPLES) % SAMPLES];
        if (oldest < 0 || newest < 0) return false;
        const timeDelta = _timestamps[(_idx - 1 + SAMPLES) % SAMPLES] - _timestamps[_idx % SAMPLES];
        const posDelta  = Math.abs(newest - oldest);
        if (posDelta < FREEZE_POS_DELTA && timeDelta > FREEZE_CONFIRM_MS) {
          if (!_frozenSince) _frozenSince = _now();
          return (_now() - _frozenSince) > FREEZE_CONFIRM_MS;
        }
        _frozenSince = 0;
        return false;
      }

      function getFrozenDurationMs() {
        return _frozenSince > 0 ? (_now() - _frozenSince) : 0;
      }

      function onSeekStart() {
        _positions.fill(-1);
        _timestamps.fill(0);
        _idx = 0;
        _frozenSince = 0;
      }

      function tick() { sample(); }

      return { tick, isFrozen, getFrozenDurationMs, onSeekStart };
    })();

    // --- 8. AudioSilenceGuard
    const AudioSilenceGuard = (() => {
      let _lastAT         = -1;
      let _lastATAt       = 0;
      let _silentSince    = 0;
      let _silenceFixed   = 0;
      let _checkCount     = 0;
      let _lastCheckAt    = 0;
      const CHECK_MS      = 2500;
      const SILENT_CONF_MS = 5000; // must be silent for 5s to trigger action

      function tick() {
        if (!coupledMode || !audio) return;
        if ((_now() - _lastCheckAt) < CHECK_MS) return;
        _lastCheckAt = _now();
        _checkCount++;

        if (!state.intendedPlaying || audio.paused) {
          _silentSince = 0;
          _lastAT = -1;
          return;
        }

        const at = Number(audio.currentTime) || 0;

        // Case 1: volume is zero or muted despite intending to play
        // Don't restore volume while video is buffering
        if (coupledMode && !audio.muted && audio.volume < 0.02 &&
          !state.videoWaiting && !state.videoStallAudioPaused) {
          softUnmuteAudio(100).catch(() => {});
        _silenceFixed++;
        return;
          }

          // Case 2: currentTime not advancing despite audio.paused=false
          if (_lastAT >= 0 && at > 0) {
            const timeDelta = _now() - _lastATAt;
            const posDelta  = Math.abs(at - _lastAT);
            const expectedDelta = timeDelta / 1000;
            if (posDelta < expectedDelta * 0.1 && timeDelta > CHECK_MS * 0.8) {
              // Audio "playing" but time not advancing → ghost audio
              if (!_silentSince) _silentSince = _now();
              if ((_now() - _silentSince) > SILENT_CONF_MS) {
                _fixSilence();
              }
            } else {
              _silentSince = 0;
            }
          }
          _lastAT   = at;
          _lastATAt = _now();
      }

      function _fixSilence() {
        _silentSince = 0;
        if (!coupledMode || !audio || !state.intendedPlaying) return;
        // Only intervene if canKillAudio agrees AND the decoder is genuinely
        // starved. A "silent but not advancing" state with buffered data is
        // usually audio waiting for the video to catch up — the sync loop
        // handles that without cutting audio.
        const _aRSSilence = Number(audio.readyState || 0);
        if (_aRSSilence >= HAVE_CURRENT_DATA) return;
        if (!canKillAudio({ bypassGrace: true, reason: "silence-guard" })) return;
        _silenceFixed++;
        _lastGlobalAudioKillAt = _now();
        try {
          const vt = Number(video.currentTime()) || 0;
          squelchAudioEvents(600);
          safeSetAudioTime(vt);
          audio.pause();
          setTimeout(() => {
            if (!state.intendedPlaying) return;
            execProgrammaticAudioPlay({ force: true, squelchMs: 600, minGapMs: 0 }).catch(() => {});
          }, 200);
        } catch {}
      }

      function isDetectedSilent() {
        return _silentSince > 0 && (_now() - _silentSince) > SILENT_CONF_MS;
      }

      function getFixCount() { return _silenceFixed; }

      return { tick, isDetectedSilent, getFixCount };
    })();

    // --- 9. ReadyStateWatcher
    // Tracks readyState for both streams and detects unexpected drops
    // (e.g. from HAVE_ENOUGH_DATA down to HAVE_METADATA or lower during playback).
    const ReadyStateWatcher = (() => {
      let _lastVRS         = 0;
      let _lastARS         = 0;
      let _vrsDrop         = false;
      let _arsDrop         = false;
      let _vrsDropAt       = 0;
      let _arsDropAt       = 0;
      let _vrsDropCount    = 0;
      let _arsDropCount    = 0;
      let _lastCheckAt     = 0;
      const CHECK_MS       = 400;
      const DROP_RECOVER_MS = 3000;

      function tick() {
        if ((_now() - _lastCheckAt) < CHECK_MS) return;
        _lastCheckAt = _now();

        try {
          const vrs = Number(getVideoNode().readyState || 0);
          if (_lastVRS >= 3 && vrs < 2 && !state.seeking) {
            _vrsDrop = true;
            _vrsDropAt = _now();
            _vrsDropCount++;
          } else if (vrs >= 3 && _vrsDrop) {
            _vrsDrop = false;
          }
          _lastVRS = vrs;
        } catch {}

        if (coupledMode && audio) {
          try {
            const ars = Number(audio.readyState || 0);
            if (_lastARS >= 3 && ars < 2 && !audio.paused) {
              _arsDrop = true;
              _arsDropAt = _now();
              _arsDropCount++;
              // Immediately pause audio if video is fine — don't play with partial buffer
              if (!getVideoPaused() && state.intendedPlaying && !state.strictBufferHold) {
                execProgrammaticAudioPause(800);
                armResumeAfterBuffer(8000);
              }
            } else if (ars >= 3 && _arsDrop) {
              _arsDrop = false;
            }
            _lastARS = ars;
          } catch {}
        }

        // Auto-clear stale drop flags
        if (_vrsDrop && (_now() - _vrsDropAt) > DROP_RECOVER_MS) _vrsDrop = false;
        if (_arsDrop && (_now() - _arsDropAt) > DROP_RECOVER_MS) _arsDrop = false;
      }

      function hasVideoRsDrop()  { return _vrsDrop; }
      function hasAudioRsDrop()  { return _arsDrop; }
      function getVideoRS()      { return _lastVRS; }
      function getAudioRS()      { return _lastARS; }
      function getVrsDropCount() { return _vrsDropCount; }
      function getArsDropCount() { return _arsDropCount; }

      return { tick, hasVideoRsDrop, hasAudioRsDrop, getVideoRS, getAudioRS, getVrsDropCount, getArsDropCount };
    })();

    // --- 10. PlaybackRateGuard
    // Enforces that video.playbackRate === 1.0 unless the player explicitly
    // changed it (e.g. audio rate nudge). Silent rate drift causes A/V desync.
    const PlaybackRateGuard = (() => {
      let _lastCheckAt   = 0;
      let _correctionCount = 0;
      let _lastCorrectionAt = 0;
      const CHECK_MS         = 2000;
      const RATE_TOLERANCE   = 0.005;
      const CORRECTION_COOLDOWN = 3000;

      function tick() {
        if ((_now() - _lastCheckAt) < CHECK_MS) return;
        _lastCheckAt = _now();
        if (state.audioRateNudgeActive) return; // player intentionally adjusting rate
        if (state.seeking || state.syncing) return;
        if ((_now() - _lastCorrectionAt) < CORRECTION_COOLDOWN) return;
        try {
          const vNode = getVideoNode();
          const rate = Number(vNode.playbackRate);
          if (isFinite(rate) && Math.abs(rate - 1.0) > RATE_TOLERANCE) {
            vNode.playbackRate = 1.0;
            try { video.playbackRate(1.0); } catch {}
            _correctionCount++;
            _lastCorrectionAt = _now();
          }
        } catch {}
        // Also enforce audio rate if it drifted
        if (coupledMode && audio && !state.audioRateNudgeActive) {
          try {
            const aRate = Number(audio.playbackRate);
            if (isFinite(aRate) && Math.abs(aRate - 1.0) > RATE_TOLERANCE) {
              audio.playbackRate = 1.0;
              _correctionCount++;
            }
          } catch {}
        }
      }

      function getCorrectionCount() { return _correctionCount; }

      return { tick, getCorrectionCount };
    })();

    // --- 11. NetworkRecoveryHandler
    // Handles online/offline transitions and triggers smart recovery.
    const NetworkRecoveryHandler = (() => {
      let _offlineSince   = 0;
      let _backOnlineAt   = 0;
      let _offlineCount   = 0;
      let _recoveryTimer  = null;

      function onOffline() {
        _offlineSince = _now();
        _offlineCount++;
        // Clear any pending retry timers — no point retrying while offline
        if (_recoveryTimer) { clearTimeout(_recoveryTimer); _recoveryTimer = null; }
      }

      function onOnline() {
        _backOnlineAt = _now();
        const offlineDuration = _offlineSince > 0 ? (_now() - _offlineSince) : 0;
        _offlineSince = 0;

        // Network-caused stalls aren't the browser's fault — reset oscillation
        // locks so background resume attempts aren't blocked.
        try { BackgroundPlaybackManagerManager.onForegroundReturn(); } catch {}

        // Don't immediately retry — give network 500ms to stabilize
        const retryDelay = offlineDuration > 5000 ? 1200 : 500;
        if (_recoveryTimer) clearTimeout(_recoveryTimer);
        _recoveryTimer = setTimeout(() => {
          _recoveryTimer = null;
          if (!state.intendedPlaying) return;
          state.networkRecoverUntil = _now() + 8000;
          // Trigger a full sync after network recovery
          try { scheduleSync(0); } catch {}
          // If video is stalled, arm buffer recovery
          if (getVideoPaused() && !state.strictBufferHold) {
            try { armResumeAfterBuffer(10000); } catch {}
          }
          // If we're in the background with intendedPlaying, try to resume
          if (document.visibilityState === "hidden" && state.intendedPlaying) {
            state.bgCatchUpCooldownUntil = 0;
            try { seamlessBgCatchUp().catch(() => {}); } catch {}
          }
        }, retryDelay);
      }

      function isOffline()     { return _offlineSince > 0; }
      function getOfflineCount() { return _offlineCount; }
      function getOfflineDurationMs() { return _offlineSince > 0 ? (_now() - _offlineSince) : 0; }

      return { onOffline, onOnline, isOffline, getOfflineCount, getOfflineDurationMs };
    })();

    // --- 12. GhostAudioKiller
    const GhostAudioKiller = (() => {
      let _ghostDetectedAt = 0;
      let _killCount       = 0;
      let _lastCheckAt     = 0;
      const CHECK_MS           = 1500;
      const CONFIRM_MS         = 600;  // must see ghost for 600ms before acting

      function tick() {
        if (!coupledMode || !audio) return;
        if ((_now() - _lastCheckAt) < CHECK_MS) return;
        _lastCheckAt = _now();

        if (!state.intendedPlaying) return;
        if (state.seeking || state.syncing || state.restarting) return;
        if (BringBackToTabManager.isLocked()) return;
        if (document.visibilityState === "hidden" || !isWindowFocused()) return;
        if (isVisibilityTransitionActive()) return;
        if (inBgReturnGrace()) return;

        const vPaused = getVideoPaused();
        const aPaused = !!audio.paused;

        // Ghost: audio playing but video paused in stable foreground
        if (!aPaused && vPaused) {
          if (!_ghostDetectedAt) { _ghostDetectedAt = _now(); return; }
          if ((_now() - _ghostDetectedAt) > CONFIRM_MS) {
            _killGhostAudio();
          }
        } else {
          _ghostDetectedAt = 0;
        }
      }

      function _killGhostAudio() {
        _ghostDetectedAt = 0;
        _killCount++;
        try { execProgrammaticAudioPause(500); } catch {}
        // Also try to re-start both together
        setTimeout(() => {
          if (!state.intendedPlaying) return;
          try { scheduleSync(0); } catch {}
        }, 300);
      }

      function getKillCount() { return _killCount; }

      return { tick, getKillCount };
    })();

    // --- 13. HealthScoreTracker
    // Aggregates all subsystem signals into a 0-100 health score.
    // Triggers escalating interventions when score drops.
    const HealthScoreTracker = (() => {
      let _score           = 100;
      let _lastScore       = 100;
      let _scoreAt         = 0;
      let _interventions   = 0;
      let _lastInterventionAt = 0;
      const INTERVENTION_COOLDOWN = 8000;

      function compute() {
        let score = 100;

        // Buffer health (30% weight)
        const bufScore = BufferHealthMonitor.getCombinedScore();
        score -= (100 - bufScore) * 0.30;

        // Drift (20% weight)
        const driftMs = DriftSupervisor.getDriftMs();
        if (driftMs > 200)  score -= 10;
        if (driftMs > 500)  score -= 15;
        if (driftMs > 1000) score -= 20;
        if (DriftSupervisor.isDriftRunaway()) score -= 15;

        // Position freeze (20% weight)
        if (PositionFreezeDetector.isFrozen()) score -= 25;

        // ReadyState drops (15% weight)
        if (ReadyStateWatcher.hasVideoRsDrop()) score -= 10;
        if (ReadyStateWatcher.hasAudioRsDrop()) score -= 10;

        // Network (15% weight)
        if (NetworkRecoveryHandler.isOffline()) score -= 20;

        // Silence guard
        if (AudioSilenceGuard.isDetectedSilent()) score -= 20;

        _lastScore = _score;
        _score = Math.max(0, Math.min(100, Math.round(score)));
        _scoreAt = _now();
        return _score;
      }

      function tick() {
        compute();
        _maybeIntervene();
      }

      function _maybeIntervene() {
        if ((_now() - _lastInterventionAt) < INTERVENTION_COOLDOWN) return;
        if (!state.intendedPlaying || state.seeking || state.syncing) return;
        if (document.visibilityState === "hidden") return;

        if (_score < 20) {
          // Critical: trigger full sync
          _interventions++;
          _lastInterventionAt = _now();
          try { scheduleSync(0); } catch {}
          try { setFastSync(2000); } catch {}
        } else if (_score < 40) {
          // Poor: trigger sync
          _interventions++;
          _lastInterventionAt = _now();
          try { scheduleSync(100); } catch {}
        }
      }

      function getScore()          { return _score; }
      function getLastScore()      { return _lastScore; }
      function getInterventions()  { return _interventions; }
      function isHealthy()         { return _score >= 60; }
      function isCritical()        { return _score < 20; }

      return { tick, getScore, getLastScore, getInterventions, isHealthy, isCritical };
    })();

    // --- 14. MicroSyncScheduler
    const MicroSyncScheduler = (() => {
      let _lastFireAt  = 0;
      let _pendingRaf  = null;
      let _fastUntil   = 0;

      const HEALTHY_INTERVAL_MS  = 4000;
      const DRIFT_INTERVAL_MS    = 500;
      const CRITICAL_INTERVAL_MS = 200;
      const POST_TAB_FAST_MS     = 2500;

      function tick() {
        if (!coupledMode) return; // non-coupled mode managed by existing heartbeat
        if (!state.intendedPlaying) return;

        const score = HealthScoreTracker.getScore();
        const drift = DriftSupervisor.getDriftMs();

        let interval = HEALTHY_INTERVAL_MS;
        if (drift > 300 || score < 40) interval = DRIFT_INTERVAL_MS;
        if (score < 20)                interval = CRITICAL_INTERVAL_MS;
        if (_now() < _fastUntil)       interval = Math.min(interval, DRIFT_INTERVAL_MS);

        if ((_now() - _lastFireAt) >= interval) {
          _lastFireAt = _now();
          try { scheduleSync(0); } catch {}
        }
      }

      function onTabReturn() {
        _fastUntil = _now() + POST_TAB_FAST_MS;
      }

      return { tick, onTabReturn };
    })();

    // ════════════════════════════════════════════════════════════════════════
    function onVideoPlaying() {
      AVLG.onVideoPlaying();
      StartupSequencer.onVideoPlaying();
    }
    function onAudioPlaying() {
      AVLG.onAudioPlaying();
      StartupSequencer.onAudioPlaying();
    }
    function onVideoStall() {
      AVLG.onVideoStall();
      StallRecoveryEngine.onRecovery(); // reset samples on stall event
    }
    function onAudioStall() {
      AVLG.onAudioStall();
    }
    function onSeekStart() {
      StallRecoveryEngine.onSeekStart();
      PositionFreezeDetector.onSeekStart();
    }
    function onSeekEnd() {
      StallRecoveryEngine.onSeekStart(); // fresh samples after seek
      PositionFreezeDetector.onSeekStart();
    }
    function onVisibilityChange(isVisible) {
      if (isVisible) {
        AudioContextReviver.revive();
        MicroSyncScheduler.onTabReturn();
        StartupSequencer.tick();
      }
    }
    function onUserAction() {
      AudioContextReviver.onUserGesture();
      StallRecoveryEngine.resetAttempts();
    }
    function onNetworkOnline()  { NetworkRecoveryHandler.onOnline();  }
    function onNetworkOffline() { NetworkRecoveryHandler.onOffline(); }

    // --- heartbeat tick (called every ~1.5s from setupHeartbeat)
    function tick() {
      try { BufferHealthMonitor.tick(); }   catch {}
      try { DriftSupervisor.tick(); }       catch {}
      try { StallRecoveryEngine.tick(); }   catch {}
      try { AudioContextReviver.tick(); }   catch {}
      try { PositionFreezeDetector.tick(); } catch {}
      try { AudioSilenceGuard.tick(); }     catch {}
      try { ReadyStateWatcher.tick(); }     catch {}
      try { PlaybackRateGuard.tick(); }     catch {}
      try { GhostAudioKiller.tick(); }      catch {}
      try { HealthScoreTracker.tick(); }    catch {}
      try { MicroSyncScheduler.tick(); }    catch {}
      try { StartupSequencer.tick(); }      catch {}
    }

    // --- fast tick (called every ~200ms during active sync / fast mode)
    function fastTick() {
      try { DriftSupervisor.tick(); }       catch {}
      try { ReadyStateWatcher.tick(); }     catch {}
      try { BufferHealthMonitor.tick(); }   catch {}
    }

    // --- primary gates (safe to call from any event handler)
    function shouldBlockAudioAtStartup() {
      // Gate 1: AVLG — video must have played at least once
      if (AVLG.shouldBlockAudio()) return true;
      // Gate 2: StartupSequencer — video must be in VIDEO_PLAYING phase
      if (StartupSequencer.shouldBlockAudioAtStartup()) return true;
      return false;
    }

    function isAudioSilent()    { return AudioSilenceGuard.isDetectedSilent(); }
    function isVideoFrozen()    { return PositionFreezeDetector.isFrozen(); }
    function getHealthScore()   { return HealthScoreTracker.getScore(); }
    function isHealthy()        { return HealthScoreTracker.isHealthy(); }
    function getDriftMs()       { return DriftSupervisor.getDriftMs(); }
    function getBufferScore()   { return BufferHealthMonitor.getCombinedScore(); }
    function getStartupPhase()  { return StartupSequencer.getPhaseLabel(); }
    function isStartupStable()  { return StartupSequencer.isStable(); }
    function isOffline()        { return NetworkRecoveryHandler.isOffline(); }

    // --- startup: mark video/audio as fully loaded and ready
    function notifyVideoLoadeddata()   { StartupSequencer.onVideoReady(); }
    function notifyVideoLoading()      { StartupSequencer.onVideoLoading(); }
    function forceStartupRelease()     { AVLG.forceRelease(); }

    return {
      // Event hooks
      onVideoPlaying, onAudioPlaying,
      onVideoStall, onAudioStall,
      onSeekStart, onSeekEnd,
      onVisibilityChange, onUserAction,
      onNetworkOnline, onNetworkOffline,
      // Ticks
      tick, fastTick,
      // Gates
      shouldBlockAudioAtStartup,
      isAudioSilent, isVideoFrozen,
      // Metrics
      getHealthScore, isHealthy, getDriftMs, getBufferScore,
      getStartupPhase, isStartupStable, isOffline,
      // Startup helpers
      notifyVideoLoadeddata, notifyVideoLoading, forceStartupRelease,
    };
  })();


  const EPS = 1.0;
const HAVE_METADATA = 1;
const HAVE_CURRENT_DATA = 2;
const HAVE_FUTURE_DATA = 3;
const HAVE_ENOUGH_DATA = 4;
  const STRICT_BUFFER_AHEAD_SEC = 0.25;
  const STARTUP_BUFFER_AHEAD_SEC = 1.0;
  const MICRO_DRIFT = 0.15;  // was 0.08 — too sensitive, caused constant rate changes
  const BIG_DRIFT = 1.5;
  const BIG_DRIFT_BACKGROUND = 6.0;
  const MAX_RATE_NUDGE = 0.003;
  const DRIFT_PERSIST_CYCLES = 3;
  const AUDIO_FADE_DURATION_MS = 60;
  const AUDIO_SAFE_FADE_DURATION_MS = 80;
  const MIN_PLAY_PAUSE_GAP_MS = 90;
  const SEEK_READY_TIMEOUT_MS = 700;
  const SEEK_WATCHDOG_MS = 8000; // max time to wait for seeked event before force-finalizing (was 4500 — too short for slow connections/large seeks)
  const STATE_CHANGE_COOLDOWN_MS = 55;
  const USER_TOGGLE_TXN_FAST_MS = 750;
  const USER_PLAY_INTENT_FAST_MS = 900;
  const USER_PAUSE_INTENT_FAST_MS = 850;
  const USER_PAUSE_LOCK_EXTRA_MS = 180;
  const USER_MEDIA_PLAY_TXN_FAST_MS = 480;
  const USER_MEDIA_PAUSE_TXN_FAST_MS = 420;
  const USER_PROGRAMMATIC_FLAG_CLEAR_MS = 120;
  const USER_EXPLICIT_PAUSE_FADE_MS = 16;
  const USER_GESTURE_PAUSE_HOLD_MS = 650;
  const CHROMIUM_BG_PAUSE_BLOCK_MS = 6000;
  const TAB_VISIBILITY_STABLE_MS = 900;
  const VISIBILITY_TRANSITION_MS = 450;
  const MAX_BG_PAUSE_SUPPRESSIONS = 200;
  const ALT_TAB_TRANSITION_MS = 500;
  const FOCUS_LOSS_RESET_MS = 12000;
  const CHROMIUM_PAUSE_EVENT_SUPPRESS_MS = 2600;
  const PAUSE_EVENT_RESET_MS = 15000;
  const MAX_PAUSE_EVENTS_BEFORE_BLOCK = 3;
  const AUDIO_POP_PREVENT_MS = 200;
  const SEEK_AUDIO_SYNC_DELAY_MS = 150;
  const SEEK_AUDIO_RESUME_DELAY_MS = 100;
  const RAPID_PLAY_PAUSE_WINDOW_MS = 2000;
  // Increased from 10→20: spurious play/pause events fire during tab switches, buffering, seeks.
  const MAX_RAPID_PLAY_PAUSE = 20;
  // User-initiated spam detection — separate from the loop detector which counts all events.
  // Only pointer/keyboard events count toward this. Audio protection only fires for genuine spam.
  const USER_SPAM_CLICK_WINDOW_MS = 1200;  // window to count user clicks in
  const USER_SPAM_CLICK_THRESHOLD = 5;     // ≥5 user clicks in 1.2s = spam
  const USER_SPAM_ACTIVE_MS = 1500;        // how long spam state stays active after threshold
  const MAX_AUDIO_PLAY_ATTEMPTS = 8;
  const AUDIO_PLAY_ATTEMPT_RESET_MS = 5000;
  const AUDIO_STARTUP_PLAY_RETRY_MS = 300;
  const MAX_AUDIO_STARTUP_RETRIES = 20;
  // Bumped from 1500→9000→15000: the browser decoder has natural readyState
  // dips for the first 10-15 seconds after first play as segments buffer and
  // the pipeline warms up. Users still reported audio cuts clustered in the
  // first ~15s at 9s, so the window had to be widened to cover the full
  // decoder-warmup envelope. 15s comfortably covers slow-network warm-up
  // without meaningfully delaying legitimate mid-playback stall recovery
  // (mid-playback stalls set their own flags/timestamps and don't depend on
  // this window). Note: user pauses bypass this via userGesturePauseIntent
  // (startupSettleActive returns false when that flag is set).
  const STARTUP_SETTLE_MS = 15000;
  const LOOP_DETECTION_WINDOW_MS = 2000;
  // Increased from 6→14: 6 events fires too easily during tab switches / buffering states.
  // 14 is still well below any real infinite loop scenario.
  const MAX_LOOP_EVENTS = 18;
  const LOOP_COOLDOWN_MS = 2500;
  const BG_RETURN_GRACE_MS = 3000;
  const TAB_RETURN_AUDIO_RETRY_DELAY_MS = 300;
  const BG_RETURN_WAKEUP_DELAY_CHROMIUM_MS = 180;
  const BG_RETURN_WAKEUP_DELAY_OTHER_MS = 300;
  const BG_RESUME_MIN_DELAY_CHROMIUM_MS = 160;
  // If strictBufferHold stays active this long but media is actually ready, force-clear it
  const BUFFER_HOLD_MAX_MS = 20000;
  const HEARTBEAT_INTERVAL_MS = 2000;
  const AUDIO_STALL_TIMEOUT_MS = 4500;
  const VIDEO_STALL_TIMEOUT_MS = 4500;
  const WAKE_DETECT_THRESHOLD_MS = 8000;
  const CONSISTENCY_CHECK_MIN_INTERVAL_MS = 4000;
  const STALL_RECOVERY_COOLDOWN_MS = 5000;
  // How long (ms) to hold audio paused after a video stall before allowing any resume.
  // 200ms is enough to prevent re-triggering while giving the browser time to stabilize.
  const MIN_STALL_AUDIO_RESUME_MS = 200;
  // Minimum readyState the VIDEO element must report before audio can resume after a stall.
  // HAVE_FUTURE_DATA (3) means the browser has decoded enough to play for at least a moment.
  // We do NOT use bufferedAhead here — readyState is more reliable and faster to become true.
  const MIN_STALL_VIDEO_RS = 3; // HAVE_FUTURE_DATA
  // If videoStallAudioPaused has been set for this long but video is playing fine, force-clear.
  const STALL_WATCHDOG_MS = 5000;
  // How often to run the stall-state watchdog check in the heartbeat
  const STALL_WATCHDOG_CHECK_INTERVAL_MS = 2000;
  const AUDIO_STUCK_RESTART_MS = 2500;
  const AUDIO_STUCK_HARD_MS = 3000;
  const SEEK_FINALIZE_DELAY_MS = 500;

  const clamp01 = v => Math.max(0, Math.min(1, Number(v)));

  function clearStartupAutoplayRetryTimer() {
    if (state.startupAutoplayRetryTimer) {
      clearTimeout(state.startupAutoplayRetryTimer);
      state.startupAutoplayRetryTimer = null;
    }
  }

  function commitStartupFromActivePlayback() {
    const vn = getVideoNode();
    const videoPlaying = !!(vn && !vn.paused);
    const audioPlaying = coupledMode ? !!(audio && !audio.paused) : true;
    if (!videoPlaying || !audioPlaying) return false;

    state.intendedPlaying = true;
    state.bufferHoldIntendedPlaying = true;
    state.firstPlayCommitted = true;
    state.startupKickDone = true;
    state.startupKickInFlight = false;
    state.startupPrimed = true;
    state.startupPlaySettleUntil = Math.max(state.startupPlaySettleUntil, now() + STARTUP_SETTLE_MS);
    state.startupPhase = false;
    if (coupledMode) state.audioEverStarted = true;
    clearStartupAutoplayRetryTimer();
    clearAudioForcePlayTimer();
    return true;
  }

  function commitStartupFromResolvedPlaybackPosition(position, opts = {}) {
    const resolvedPosition = Number(position);
    if (!isFinite(resolvedPosition) || resolvedPosition < 0.35) return false;

    const recentSeek =
      !!opts.fromSeek ||
      state.seeking ||
      seekRecoveryActive(1200) ||
      userSeekIntentActive() ||
      (isFinite(Number(state.seekTargetTime)) && Number(state.seekTargetTime) > 0.35) ||
      (state.pendingSeekTarget != null && Number(state.pendingSeekTarget) > 0.35);
    if (!recentSeek) return false;

    state.intendedPlaying = true;
    state.bufferHoldIntendedPlaying = true;
    state.firstPlayCommitted = true;
    state.startupKickDone = true;
    state.startupKickInFlight = false;
    state.startupPrimed = true;
    state.startupPlaySettleUntil = Math.max(state.startupPlaySettleUntil, now() + STARTUP_SETTLE_MS);
    state.startupPhase = false;
    state.startupPlaySettled = true;
    if (!coupledMode || (audio && !audio.paused)) state.audioEverStarted = true;
    suppressStartupZero(Math.max(15000, (opts && opts.suppressMs) || 0));
    clearStartupAutoplayRetryTimer();
    clearAudioForcePlayTimer();
    return true;
  }

  const VOLUME_STORAGE_KEY = "videoPlayerVolume";
  const MUTED_STORAGE_KEY = "videoPlayerMuted";
  function loadSavedVolume() {
    try {
      const savedVol = localStorage.getItem(VOLUME_STORAGE_KEY);
      if (savedVol !== null) {
        const vol = parseFloat(savedVol);
        if (!isNaN(vol) && vol >= 0 && vol <= 1) {
          video.volume(vol);
        }
      }
      const savedMuted = localStorage.getItem(MUTED_STORAGE_KEY);
      if (savedMuted !== null) {
        const muted = savedMuted === "true";
        video.muted(muted);
      }
    } catch {}
  }
  function saveVolume() {
    if (state.volumeSaveScheduled) return;
    state.volumeSaveScheduled = true;
    setTimeout(() => {
      try {
        localStorage.setItem(VOLUME_STORAGE_KEY, String(video.volume()));
        localStorage.setItem(MUTED_STORAGE_KEY, String(video.muted()));
      } catch {}
      state.volumeSaveScheduled = false;
    }, 200);
  }

  function isHiddenBackground() {
    return document.visibilityState === "hidden";
  }

  function inBgReturnGrace() {
    return (now() - state.lastBgReturnAt) < BG_RETURN_GRACE_MS;
  }

  if (!state.pageFullyLoaded) {
    window.addEventListener("load", () => {
      state.pageFullyLoaded = true;
      // If startup already succeeded OR media is already playing, skip all
      // startup machinery. Re-running it causes a redundant audio seek
      // (audible skip) and play-pause-play stutter.
      const _loadVNode = getVideoNode();
      const _loadVideoPlaying = _loadVNode && !_loadVNode.paused;
      const _loadAudioPlaying = coupledMode && audio && !audio.paused;
      const _loadVideoHasData = _loadVNode && Number(_loadVNode.readyState || 0) >= 2;
      const _loadStartupCommitted = commitStartupFromActivePlayback();
      if (state.firstPlayCommitted || _loadStartupCommitted || _loadVideoPlaying ||
          state.startupKickInFlight || state.startupKickDone ||
          (state.audioEverStarted && _loadAudioPlaying) ||
          (_loadVideoPlaying && !coupledMode) ||
          state.intendedPlaying) {
        if (_loadVideoPlaying) {
          state.intendedPlaying = true;
          state.bufferHoldIntendedPlaying = true;
        }
        if (state.startupPhase && state.firstPlayCommitted) {
          setTimeout(() => { state.startupPhase = false; }, 500);
        }
        clearStartupAutoplayRetryTimer();
        clearAudioForcePlayTimer();
        state.startupKickInFlight = false;
        // if video's playing but audio isn't (coupled mode), force-start audio
        // with a sync + retry. this is the window.load backstop for when the
        // EARLY AUDIO STARTUP retry chain never caught up.
        if (coupledMode && _loadVideoPlaying && !_loadAudioPlaying && audio &&
            state.intendedPlaying && !state.seeking &&
            !userPauseLockActive() && !mediaSessionForcedPauseActive()) {
          // Sync audio position to video before starting
          const _loadVt = (() => { try { return Number(video.currentTime()) || 0; } catch { return 0; } })();
          const _loadAt = Number(audio.currentTime) || 0;
          if (isFinite(_loadVt) && Math.abs(_loadAt - _loadVt) > 0.3) {
            state._allowAudioTimeWrite = true;
            try { audio.currentTime = _loadVt; } catch {}
            state._allowAudioTimeWrite = false;
          }
          state.audioStartGraceUntil = Math.max(state.audioStartGraceUntil, now() + 1200);
          const _loadVol = targetVolFromVideo();
          try { audio.volume = _loadVol; } catch {}
          const _loadPlaySession = state.playSessionId;
          execProgrammaticAudioPlay({ squelchMs: 250, force: true, minGapMs: 0 })
            .then(ok => { if (ok) state.audioEverStarted = true; })
            .catch(() => {});
          // Retry at 200ms and 600ms if first attempt fails (audio element may
          // still be loading even at window.load time for large audio files)
          [200, 600].forEach(delay => {
            setTimeout(() => {
              if (state.playSessionId !== _loadPlaySession) return;
              if (!state.intendedPlaying || !coupledMode || !audio) return;
              if (!audio.paused) { state.audioEverStarted = true; return; }
              const _retryVt = (() => { try { return Number(video.currentTime()) || 0; } catch { return 0; } })();
              state._allowAudioTimeWrite = true;
              try { audio.currentTime = _retryVt; } catch {}
              state._allowAudioTimeWrite = false;
              try { audio.volume = targetVolFromVideo(); } catch {}
              state.audioStartGraceUntil = Math.max(state.audioStartGraceUntil, now() + 600);
              execProgrammaticAudioPlay({ squelchMs: 200, force: true, minGapMs: 0 })
                .then(ok => { if (ok) state.audioEverStarted = true; })
                .catch(() => {});
            }, delay);
          });
        }
        return;
      }
      if (coupledMode && state.startupPhase && !state.startupPrimed) {
        maybePrimeStartup();
        if (state.startupPrimed) {
          scheduleStartupAutoplayKick();
        } else {
          scheduleStartupAutoplayRetry();
        }
        forceAudioStartupPlay();
      } else if (coupledMode && state.startupPhase && state.startupPrimed && !state.startupKickDone && !state.firstPlayCommitted) {
        scheduleStartupAutoplayKick();
        forceAudioStartupPlay();
      } else if (!coupledMode && wantsStartupAutoplay()) {
        scheduleSync(0);
      }
    }, { once: true, passive: true });
  }

  function pageLoadedForAutoplay() {
    // Allow autoplay once DOM is interactive (don't wait for window.load
    // which blocks on images/stylesheets and can delay startup by seconds).
    // This code runs inside DOMContentLoaded, so DOM is always ready.
    return state.pageFullyLoaded || document.readyState !== "loading";
  }
  function isWindowFocused() {
    try { return typeof document.hasFocus === "function" ? document.hasFocus() : true; } catch { return true; }
  }

  function now() { return performance.now(); }
  function isTabReturnImmune() { return state.tabReturnImmuneUntil > now(); }

  // --- tab-return audio freeze
  // On tab return: DON'T mute. Instead, freeze audio so retry shots can't
  // re-seek it (which causes echo). Audio keeps playing at current volume.
  // After 400ms, do ONE position sync if needed.
  function beginTabReturnAudioMute() {
    if (!coupledMode || !audio) return;
    if (state.tabReturnSettleTimer) clearTimeout(state.tabReturnSettleTimer);
    state.tabReturnAudioMuted = false;
    // In the foreground, never move visible video to chase audio. That creates
    // the exact "video waits and catches up" feel we want to avoid. Keep video
    // as the timeline owner and pull audio back if drift exists.
    try {
      const vt = Number(video.currentTime()) || 0;
      const at = Number(audio.currentTime) || 0;
      if (isFinite(vt) && isFinite(at) && Math.abs(at - vt) > 0.3) {
        safeSetAudioTime(vt);
      }
    } catch {}
    // Resume audio immediately — let the browser handle decode buffer naturally.
    // Don't seek or manipulate currentTime — that adds latency and glitches.
    if (audio.paused && state.intendedPlaying) {
      try { audio.play().catch(() => {}); } catch {}
    }
  }

  function cancelTabReturnAudioMute() {
    if (state.tabReturnSettleTimer) {
      clearTimeout(state.tabReturnSettleTimer);
      state.tabReturnSettleTimer = null;
    }
    state.tabReturnAudioMuted = false;
  }

  // --- pause intercept + event-level suppression
  // Two layers of protection during tab-return immunity:
  // 1. Replace .pause() with a no-op so no code can pause the video
  // 2. Capture "pause" events on the element and swallow them + re-play,
  //    so browser-internal pauses (not via .pause()) also get caught
  let _pauseInterceptActive = false;
  let _origVideoPause = null;
  let _origAudioPause = null;
  let _origVjsPause = null;
  let _pauseInterceptTimer = null;
  let _pauseEventSuppressor = null;
  let _audioPauseEventSuppressor = null;
  let _playLockRafId = null;
  let _playLockTimer = null;

  // Capturing listener on the video element that eats pause events during immunity.
  // This fires before video.js's own listener, so video.js never sees the pause.
  function _videoPauseEventSuppressor(e) {
    if (!(state.tabReturnImmuneUntil > now())) return; // not immune, let it through
    if (state.userPauseIntentPresetAt > 0 && (now() - state.userPauseIntentPresetAt) < 2000) return; // user pause
    // don't fight the natural end-of-video pause. 'pause' fires before
    // 'ended' so endedNaturally isn't set yet — have to check currentTime
    // vs duration. if we call play() on an ended video it auto-seeks to 0
    // and restarts, which is the phantom-loop bug.
    if (state.endedNaturally) return;
    try {
      const _suppVN = e.target || getVideoNode();
      if (_suppVN) {
        const _suppCT = Number(_suppVN.currentTime) || 0;
        const _suppDur = Number(_suppVN.duration) || 0;
        if (_suppDur > 0.5 && _suppCT >= _suppDur - 0.5) return; // at the end — let it pause naturally
      }
    } catch {}
    // Swallow the event — no other listener sees it (including video.js)
    e.stopImmediatePropagation();
    e.stopPropagation();
    // Synchronous counter-play to minimize visible freeze to zero frames.
    // Because this runs in the capture phase, play() fires before the browser
    // has a chance to render a paused frame.
    try {
      const vn = getVideoNode();
      if (vn && vn.paused) vn.play().catch(() => {});
      // Also hit the other element if they differ
      if (videoEl && videoEl !== vn && videoEl.paused) videoEl.play().catch(() => {});
    } catch {}
  }

  function _audioEventPauseSuppressor(e) {
    if (!(state.tabReturnImmuneUntil > now())) return;
    if (state.userPauseIntentPresetAt > 0 && (now() - state.userPauseIntentPresetAt) < 2000) return;
    if (state.endedNaturally) return;
    try {
      const _aVN = getVideoNode();
      if (_aVN) {
        const _aCT = Number(_aVN.currentTime) || 0;
        const _aDur = Number(_aVN.duration) || 0;
        if (_aDur > 0.5 && _aCT >= _aDur - 0.5) return;
        // Don't swallow audio pause when video lacks data. The pause was
        // likely intentional (stall detection paused audio because video
        // is buffering). Swallowing it lets the rAF play-lock restart audio.
        const _aRS = Number(_aVN.readyState || 0);
        if (_aRS < HAVE_FUTURE_DATA && state.firstPlayCommitted) return;
      }
    } catch {}
    e.stopImmediatePropagation();
  }

  // rAF play-lock: if the browser pauses video/audio during tab return,
  // counter-play once per rendered frame for 800ms. Only uses rAF — no
  // aggressive sub-frame intervals, no seeking, no volume manipulation.
  // Just play() if paused — let the browser resume naturally.
  let _playLockLastPlayAt = 0; // debounce play() calls within play-lock
  function _startPlayLock() {
    _stopPlayLock();
    const startTime = now();
    const lockDuration = 800;
    _playLockLastPlayAt = 0;

    const rafPump = () => {
      _playLockRafId = null;
      if (state.userPauseIntentPresetAt > 0 && (now() - state.userPauseIntentPresetAt) < 2000) return;
      if (now() - startTime > lockDuration || !(state.tabReturnImmuneUntil > now())) return;
      // Never fight pause after video ended or at end of video
      if (state.endedNaturally) return;
      if (state.intendedPlaying) {
        try {
          const vn = getVideoNode();
          // check if we're at the end before play() — play() on an ended
          // video auto-seeks to 0 and phantom-loops.
          const _plCT = vn ? (Number(vn.currentTime) || 0) : 0;
          const _plDur = vn ? (Number(vn.duration) || 0) : 0;
          if (_plDur > 0.5 && _plCT >= _plDur - 0.5) return;
          // debounce play() to max one per 100ms. calling it every rAF
          // (16ms) fires 50 play/playing events in 800ms, each cascading
          // through video.js into audio kicks, volume writes, state flips.
          // that's the "play-pause-play" storm you see on alt-tab return.
          const _plNow = now();
          if ((_plNow - _playLockLastPlayAt) >= 100) {
            _playLockLastPlayAt = _plNow;
            if (vn && vn.paused) vn.play().catch(() => {});
            if (videoEl && videoEl !== vn && videoEl.paused) videoEl.play().catch(() => {});
            // Only restart audio if video has decoded data. Otherwise we get
            // audio playing over a frozen video frame during tab return.
            const _plRS = vn ? Number(vn.readyState || 0) : 0;
            if (coupledMode && audio && audio.paused && _plRS >= HAVE_FUTURE_DATA) audio.play().catch(() => {});
          }
        } catch {}
      }
      _playLockRafId = requestAnimationFrame(rafPump);
    };
    _playLockRafId = requestAnimationFrame(rafPump);
  }

  function _stopPlayLock() {
    if (_playLockRafId) { cancelAnimationFrame(_playLockRafId); _playLockRafId = null; }
    if (_playLockTimer) { clearTimeout(_playLockTimer); _playLockTimer = null; }
  }

  function engagePauseIntercept() {
    if (_pauseInterceptActive) return;
    _pauseInterceptActive = true;

    // Layer 1: replace .pause() with no-op on native elements
    const vn = getVideoNode();
    if (vn) {
      _origVideoPause = vn.pause.bind(vn);
      vn.pause = function() {
        if (state.userPauseIntentPresetAt > 0 && (now() - state.userPauseIntentPresetAt) < 2000) {
          return _origVideoPause();
        }
      };
    }
    // Also intercept video.js wrapper's pause method
    if (video && typeof video.pause === 'function' && !_origVjsPause) {
      _origVjsPause = video.pause.bind(video);
      video.pause = function() {
        if (state.userPauseIntentPresetAt > 0 && (now() - state.userPauseIntentPresetAt) < 2000) {
          return _origVjsPause();
        }
      };
    }
    if (coupledMode && audio) {
      _origAudioPause = audio.pause.bind(audio);
      audio.pause = function() {
        if (state.userPauseIntentPresetAt > 0 && (now() - state.userPauseIntentPresetAt) < 2000) {
          return _origAudioPause();
        }
      };
    }

    // Layer 2: capture pause events on the elements and swallow them
    if (vn && !_pauseEventSuppressor) {
      _pauseEventSuppressor = _videoPauseEventSuppressor;
      vn.addEventListener('pause', _pauseEventSuppressor, { capture: true });
      // Also attach to videoEl if it's different
      if (videoEl && videoEl !== vn) {
        videoEl.addEventListener('pause', _pauseEventSuppressor, { capture: true });
      }
    }
    if (coupledMode && audio && !_audioPauseEventSuppressor) {
      _audioPauseEventSuppressor = _audioEventPauseSuppressor;
      audio.addEventListener('pause', _audioPauseEventSuppressor, { capture: true });
    }

    // Layer 3: rAF play-lock for the first 600ms — keeps play() firing every frame
    if (state.intendedPlaying) _startPlayLock();

    // Auto-disengage after immunity expires
    if (_pauseInterceptTimer) clearTimeout(_pauseInterceptTimer);
    _pauseInterceptTimer = setTimeout(disengagePauseIntercept, 2000);
  }

  function disengagePauseIntercept() {
    if (!_pauseInterceptActive) return;
    _pauseInterceptActive = false;
    if (_pauseInterceptTimer) { clearTimeout(_pauseInterceptTimer); _pauseInterceptTimer = null; }
    _stopPlayLock();

    // Restore saved .pause() references (not prototype — video.js may have its own override)
    const vn = getVideoNode();
    if (vn && _origVideoPause) {
      try { vn.pause = _origVideoPause; } catch {}
    }
    if (audio && _origAudioPause) {
      try { audio.pause = _origAudioPause; } catch {}
    }
    if (_origVjsPause) {
      try { video.pause = _origVjsPause; } catch {}
      _origVjsPause = null;
    }
    _origVideoPause = null;
    _origAudioPause = null;

    // Remove event-level suppressors
    if (_pauseEventSuppressor) {
      try {
        if (vn) vn.removeEventListener('pause', _pauseEventSuppressor, { capture: true });
        if (videoEl && videoEl !== vn) videoEl.removeEventListener('pause', _pauseEventSuppressor, { capture: true });
      } catch {}
      _pauseEventSuppressor = null;
    }
    if (_audioPauseEventSuppressor) {
      try { if (audio) audio.removeEventListener('pause', _audioPauseEventSuppressor, { capture: true }); } catch {}
      _audioPauseEventSuppressor = null;
    }
  }

  // --- smooth tab welcome-back management
  // Consolidates the tab-return smoothness logic that was previously spread
  // across the visibilitychange, focus, and blur handlers. Each handler still
  // does its own platform-specific or manager-specific work, but delegates
  // the shared "make playback seamless across tab switches" bookkeeping here.
  const SmoothTabWelcomeBackManagement = {
    _lastReturnAt: 0,

    // Called when the tab becomes active again (from visibilitychange→visible
    // or from the focus event). Sets up immunity, intercepts pause, starts
    // audio sync, and kicks off the bring-back-to-tab retry machinery.
    // Deduplicates: if called twice within ~220ms (focus + visibilitychange),
    // the second call only refreshes immunity without re-firing retries.
    onTabReturn() {
      const callTs = now();
      const pageActuallyVisible = document.visibilityState === "visible";
      // focus can fire while the page is still hidden. Ignore that call so the
      // real visibilitychange→visible return doesn't get deduped away.
      if (!pageActuallyVisible) {
        if (this.shouldResume()) state.resumeOnVisible = true;
        return;
      }

      const timeSinceLast = callTs - this._lastReturnAt;
      this._lastReturnAt = callTs;
      state.tabReturnGen++;

      // Hidden play request path: if play was requested while the tab was in
      // background, force a foreground kick immediately on return.
      if (shouldForceForegroundResume()) {
        forceForegroundResumeNow("tab-return");
        return;
      }

      // ALWAYS engage pause intercept on tab return — even if both tracks are
      // playing. Chromium fires async pause events 50-200ms after visibility
      // change, which create the visible "play-pause-play" at start/end.
      // This blocks those pauses before they reach the UI.
      if (this.shouldResume() || state.intendedPlaying) {
        engagePauseIntercept();
      }

      // If both tracks are already playing, don't do anything — no play() calls,
      // no NMPBFN recovery, no wakeup retries, no aggressive kicks. This is the
      // key fix for "tab switch causes play-pause-play when video is already
      // playing." MUST come BEFORE shouldAggressiveKick to prevent unnecessary
      // startBringBackRetry/executeSeamlessWakeup when media is healthy.
      const videoPlaying = !getVideoPaused();
      const audioPlaying = !coupledMode || (audio && !audio.paused);
      if (videoPlaying && audioPlaying && document.visibilityState === "visible") {
        state.rapidPlayPauseCount = 0;
        state.rapidPlayPauseResetAt = now();
        state.altTabTransitionActive = false;
        state.altTabTransitionUntil = 0;
        state.resumeOnVisible = false;
        state.bgHiddenWasPlaying = false;
        // Even though both tracks report "playing", the video compositor may
        // still be showing a stale GPU texture. Arm VCFM to verify a real
        // frame rendered — if not, it will force-flush the compositor.
        try { VideoCompositorFlushManager.arm(); } catch {}
        return;
      }

      const shouldResumeNow = this.shouldResume() && !state.endedNaturally;
      const playbackHealthy = playbackHealthyForReturn();
      const shouldAggressiveKick = shouldResumeNow &&
        (!playbackHealthy ||
         state.resumeOnVisible ||
         state.bgHiddenWasPlaying ||
         hiddenPlayPendingActive() ||
         foregroundResumeBoostActive());
      if (shouldAggressiveKick) {
        try { startBringBackRetry(); } catch {}
        try { executeSeamlessWakeup(); } catch {}
      }

      if (shouldResumeNow) {
        state.tabReturnImmuneUntil = Math.max(state.tabReturnImmuneUntil, now() + 2000);
        // Swallow browser auto-pause bursts right after tab return.
        // Without this, first alt-tab can visibly do play->pause->play.
        engagePauseIntercept();
      }

      state.rapidPlayPauseCount = 0;
      state.rapidPlayPauseResetAt = now();
      state.rapidToggleDetected = false;
      state.rapidToggleUntil = 0;
      state.loopPreventionCooldownUntil = 0;
      state.altTabTransitionActive = false;
      state.altTabTransitionUntil = 0;

      // Only trigger NMPBFN recovery when the page is actually visible.
      // focus fires before visibilitychange on most browsers — at that point
      // document.visibilityState is still "hidden" and play() calls fail.
      // The visibilitychange handler (which always fires after focus) is the
      // reliable trigger. Dedup window is 80ms to allow focus+visibilitychange
      // to coalesce but not block a real second attempt.
      const isDuplicate = timeSinceLast < 220;

      // every tab-return path has to respect ended state or the video will
      // phantom-loop when you switch tabs.
      const _endedBlock = state.endedNaturally ||
        MakeSureUnintentionalLoopDoesntEverHappenAtALLManager.shouldBlockAutoRestart();

      if (shouldResumeNow && pageActuallyVisible && !isDuplicate && !_endedBlock) {
        // Check if this is a lightweight alt-tab (visibilityState never went hidden).
        // Alt-tab: blur→focus with page staying "visible" the whole time.
        // Full tab switch: visibilitychange→hidden then visibilitychange→visible.
        // For alt-tab, media is usually still playing or was only briefly paused.
        // No warm-start / volume zeroing needed — just a quick nudge.
        // use previousVisibilityState — lastVisibilityState is already overwritten
        // to "visible" by the visibilitychange handler before we get here.
        // for focus-fires-first browsers: lastVisibilityState is still "hidden"
        // from the earlier visibilitychange→hidden. both paths covered.
        const _wasRealTabSwitch = (state.previousVisibilityState === "hidden") ||
          (state.lastVisibilityState === "hidden") ||
          (now() - (state.visibilityTransitionUntil - VISIBILITY_TRANSITION_MS)) < 500;

        if (_wasRealTabSwitch) {
          // Actual tab switch — full NMPBFN recovery with all the machinery
          NotMakePlayBackFixingNoticable.onReturn();
        } else {
          // Alt-tab or window blur/focus — lightweight recovery. Just make sure
          // both elements are playing at the right volume. No vol=0, no fade, no fuss.
          // Use native play() to bypass all wrappers for max speed.
          // NEVER restart after ended — this was an unguarded native play() path.
          if (state.endedNaturally) return;
          // Engage pause intercept so browser's auto-pause on alt-tab return
          // is blocked. Without this, the browser fires pause → user sees video
          // stop → then our counter-play kicks in 100-200ms later = visible
          // "pauses and then starts playing a bit later" glitch.
          engagePauseIntercept();
          const _nativePlayAT = HTMLMediaElement.prototype.play;
          const _atVN = getVideoNode();
          // Only call play() if actually paused. Calling play() on a playing
          // element fires play/playing events that cascade into audio kicks,
          // volume writes, and visible play-pause-play spam on tab switch.
          if (_atVN && _atVN.paused) {
            DONTMAKEITDOUBLEPLAY.resetAll();
            try { _nativePlayAT.call(_atVN).catch(() => {}); } catch {}
          }
          // Arm VCFM even for lightweight alt-tab returns — compositor
          // can be stale even on short background sessions.
          try { VideoCompositorFlushManager.arm(); } catch {}
          if (coupledMode && audio) {
            const _atTargetVol = targetVolFromVideo();
            const _atVRS = _atVN ? Number(_atVN.readyState || 0) : 4;
            const _atVT = (() => { try { return Number(video.currentTime()); } catch { return 0; } })();
            const _atAT = Number(audio.currentTime) || 0;
            const _atDrift = isFinite(_atVT) ? Math.abs(_atAT - _atVT) : 0;
            // Sync audio position to video BEFORE resuming play. If audio paused
            // behind where video currentTime now is, resuming from old position
            // replays already-heard content. Keep muted until sync + play settle.
            if (audio.paused && isFinite(_atVT) && _atVT > 0.1 && _atDrift > 0.2) {
              try { audio.volume = 0; } catch {}
              state._allowAudioTimeWrite = true;
              try { audio.currentTime = _atVT; } catch {}
              state._allowAudioTimeWrite = false;
            } else if (Math.abs(audio.volume - _atTargetVol) > 0.03) {
              try { audio.volume = _atTargetVol; } catch {}
            }
            if (audio.paused && _atVRS >= HAVE_CURRENT_DATA) {
              state.audioStartGraceUntil = Math.max(state.audioStartGraceUntil, now() + 800);
              try { _nativePlayAT.call(audio).catch(() => {}); } catch {}
            }
            // Restore volume shortly after play — long enough for any audio decoder
            // flush from the position write to settle inaudibly.
            setTimeout(() => {
              if (!coupledMode || !audio) return;
              const _atVT2 = (() => { try { return Number(video.currentTime()); } catch { return 0; } })();
              const _atAT2 = Number(audio.currentTime) || 0;
              if (isFinite(_atVT2) && _atVT2 > 0.1 && Math.abs(_atAT2 - _atVT2) > 1.2) {
                state._allowAudioTimeWrite = true;
                try { audio.currentTime = _atVT2; } catch {}
                state._allowAudioTimeWrite = false;
                if (audio.paused) {
                  state.audioStartGraceUntil = Math.max(state.audioStartGraceUntil, now() + 600);
                  try { _nativePlayAT.call(audio).catch(() => {}); } catch {}
                }
              }
              try { audio.volume = _atTargetVol; } catch {}
            }, 60);
          }
        }
      }
    },

    // Called when the tab goes away (from blur or visibilitychange→hidden).
    // Cancels in-flight tab-return work and snapshots state for QRO.
    onTabLeave() {
      state.tabReturnGen++;
      // Don't clear immunity here — the hidden handler sets it right after
      // this call to protect against browser auto-pause. Clearing it first
      // creates a race where pause events slip through unguarded.
      disengagePauseIntercept();
      cancelTabReturnAudioMute();
      this.clearTimers();
      try { QuantumReturnOrchestrator.snapshotState(); } catch {}
    },

    // Called from markUserPauseIntent — the user deliberately paused, so we
    // drop all tab-return smoothness machinery immediately.
    onUserPause() {
      state.tabReturnImmuneUntil = 0;
      disengagePauseIntercept();
      cancelTabReturnAudioMute();
      NotMakePlayBackFixingNoticable.abort();
    },

    // True while the tab-return immunity window is still open
    isImmune() {
      return now() < state.tabReturnImmuneUntil;
    },

    // Decides whether we should treat this tab-return as one where playback
    // needs to resume: either the user left while playing, or startup
    // autoplay hasn't committed yet.
    shouldResume() {
      return state.intendedPlaying ||
      state.resumeOnVisible ||
      state.bgHiddenWasPlaying ||
      hiddenPlayPendingActive() ||
      state.mediaSessionInitiatedPlay ||
      (!state.firstPlayCommitted && wantsStartupAutoplay()) ||
      (state.startupPhase && wantsStartupAutoplay());
    },

    // Fires play() on both video and audio immediately using native play().
    // Pure play — no seeking, no currentTime writes, no volume changes.
    // Uses HTMLMediaElement.prototype.play to bypass all wrappers/gates.
    // Any seek (even zero-delta buffer flush) creates a tiny silence gap
    // that sounds like "play pause play". Just resume from wherever the
    // decoder left off. The sync loop handles drift after immunity expires.
    instantPlay() {
      // NEVER restart after ended
      if (state.endedNaturally) return;
      try {
        const _nIP = HTMLMediaElement.prototype.play;
        const _vn = getVideoNode();
        const _ipVPlaying = _vn && !_vn.paused;
        const _ipAPlaying = !coupledMode || (audio && !audio.paused);
        // If both tracks are already playing, skip entirely — calling play()
        // on playing elements fires events that cascade into audio re-kicks.
        if (_ipVPlaying && _ipAPlaying) return;
        if (_vn && _vn.paused) { try { _nIP.call(_vn).catch(() => {}); } catch {} }
        if (coupledMode && audio && audio.paused) {
          // Set audio grace so buffer monitor doesn't immediately kill audio
          // after tab return during the transient readyState dip.
          state.audioStartGraceUntil = Math.max(state.audioStartGraceUntil, now() + 1200);
          try { _nIP.call(audio).catch(() => {}); } catch {};
        }
      } catch {}
    },

    // Cancels all bring-back-to-tab and wakeup timers
    clearTimers() {
      if (state.bbtabRetryRafId) { cancelAnimationFrame(state.bbtabRetryRafId); state.bbtabRetryRafId = null; }
      if (state.bbtabRetryTimer) { clearTimeout(state.bbtabRetryTimer); state.bbtabRetryTimer = null; }
      if (state.bbtabAudioSyncTimer) { clearTimeout(state.bbtabAudioSyncTimer); state.bbtabAudioSyncTimer = null; }
      if (state.wakeupTimer) { clearTimeout(state.wakeupTimer); state.wakeupTimer = null; }
    },

    // Full reset — clears timers and all tab-return state
    clearAll() {
      this.clearTimers();
      state.tabReturnImmuneUntil = 0;
      disengagePauseIntercept();
      cancelTabReturnAudioMute();
    }
  };

  function markMediaAction(type) {
    state.lastMediaAction = type;
    state.lastMediaActionTs = now();
  }
  function noteUserToggle(type) {
    if (type !== "play" && type !== "pause") return;
    state.lastUserToggleType = type;
    state.lastUserToggleAt = now();
  }
  function userToggleRecently(type, ms = 1800) {
    if (state.lastUserToggleType !== type) return false;
    return (now() - state.lastUserToggleAt) < Math.max(0, Number(ms) || 0);
  }
  function userWantsPlayNow(ms = 2200) {
    const windowMs = Math.max(0, Number(ms) || 0);
    return userPlayIntentActive() ||
      ((state.userPlayIntentPresetAt > 0) && ((now() - state.userPlayIntentPresetAt) < windowMs)) ||
      userToggleRecently("play", windowMs);
  }
  function userWantsPauseNow(ms = 2200) {
    const windowMs = Math.max(0, Number(ms) || 0);
    return userPauseIntentActive() ||
      userPauseLockActive() ||
      ((state.userPauseIntentPresetAt > 0) && ((now() - state.userPauseIntentPresetAt) < windowMs)) ||
      userToggleRecently("pause", windowMs) ||
      !!state.userGesturePauseIntent;
  }
  function directUserToggleActive(windowMs = 950) {
    const win = Math.max(0, Number(windowMs) || 0);
    return userWantsPlayNow(win) || userWantsPauseNow(win) || userToggleExpectingPlay() || userToggleExpectingPause();
  }
  function shouldTreatUpcomingPlayAsFreshForegroundStart() {
    if (document.visibilityState !== "visible" || !isWindowFocused()) return false;
    if (now() < state.foregroundReturnUserPlayUntil &&
        !state.restarting &&
        !state.seeking &&
        !state.seekBuffering) return true;
    if (state.resumeOnVisible || state.bgHiddenWasPlaying) return false;
    if (hiddenPlayPendingActive() || foregroundResumeBoostActive() || state.mediaSessionInitiatedPlay) return false;
    const recentlyReturnedToForeground =
      state.lastBgReturnAt > 0 &&
      (now() - state.lastBgReturnAt) < 8000;
    return (
      recentlyReturnedToForeground ||
      inBgReturnGrace() ||
      isVisibilityTransitionActive() ||
      !isVisibilityStable() ||
      !isFocusStable() ||
      now() < state.tabVisibilityChangeUntil
    );
  }
  function armForegroundReturnUserPlay(ms = 45000) {
    state.foregroundReturnUserPlayUntil = Math.max(
      state.foregroundReturnUserPlayUntil,
      now() + Math.max(1500, Number(ms) || 0)
    );
  }
  function clearForegroundReturnUserPlay() {
    state.foregroundReturnUserPlayUntil = 0;
  }
  function clearFreshForegroundReturnGatesForUserPlay() {
    if (!shouldTreatUpcomingPlayAsFreshForegroundStart()) return false;
    clearForegroundReturnUserPlay();
    state.lastBgReturnAt = 0;
    state.visibilityTransitionActive = false;
    state.visibilityTransitionUntil = 0;
    state.visibilityStableUntil = 0;
    state.focusStableUntil = 0;
    state.tabVisibilityChangeUntil = 0;
    state.altTabTransitionActive = false;
    state.altTabTransitionUntil = 0;
    return true;
  }
  function clearFreshForegroundVideoFirst() {
    state.freshForegroundVideoFirstUntil = 0;
    state.freshForegroundVideoFirstArmedAt = 0;
    state.freshForegroundVideoFirstBaseVT = 0;
    state.freshForegroundVideoFirstBaseFrames = NaN;
  }
  function armFreshForegroundVideoFirst(baseVt = NaN, ms = 6500) {
    const vt = isFinite(baseVt) ? Number(baseVt) : (() => { try { return Number(video.currentTime()) || 0; } catch { return 0; } })();
    const baseFrames = getVideoPresentedFrameCount();
    state.freshForegroundVideoFirstBaseVT = isFinite(vt) ? vt : 0;
    state.freshForegroundVideoFirstBaseFrames = isFinite(baseFrames) ? Number(baseFrames) : NaN;
    state.freshForegroundVideoFirstArmedAt = now();
    state.freshForegroundVideoFirstUntil = Math.max(
      state.freshForegroundVideoFirstUntil,
      state.freshForegroundVideoFirstArmedAt + Math.max(1800, Number(ms) || 0)
    );
  }
  function foregroundVideoMadeVisibleProgress(baseVt = NaN, minDelta = 0.08) {
    if (document.visibilityState !== "visible" || !isWindowFocused()) return false;
    const frameNow = getVideoPresentedFrameCount();
    const baseFrames = Number(state.freshForegroundVideoFirstBaseFrames);
    if (isFinite(frameNow)) {
      if (isFinite(baseFrames) && frameNow > (baseFrames + 0.5)) return true;
      if (!isFinite(baseFrames) && frameNow > 0.5) return true;
    }
    const vtNow = (() => { try { return Number(video.currentTime()) || 0; } catch { return NaN; } })();
    if (!isFinite(vtNow)) return false;
    const base = isFinite(baseVt) ? Number(baseVt) : Number(state.freshForegroundVideoFirstBaseVT);
    const delta = Math.max(0.05, Number(minDelta) || 0);
    if (!isFinite(base)) return vtNow > delta;
    return vtNow > (base + delta);
  }
  function freshForegroundVideoProgressPending(minDelta = 0.08) {
    if (now() >= state.freshForegroundVideoFirstUntil) return false;
    if (document.visibilityState !== "visible" || !isWindowFocused()) return false;
    if (!state.intendedPlaying || state.restarting || state.seeking || state.seekBuffering) return false;
    return !foregroundVideoMadeVisibleProgress(Number(state.freshForegroundVideoFirstBaseVT), minDelta);
  }
  function freshForegroundVideoFirstPending() {
    if (now() >= state.freshForegroundVideoFirstUntil) return false;
    if (document.visibilityState !== "visible" || !isWindowFocused()) return false;
    if (!state.intendedPlaying || state.restarting || state.seeking || state.seekBuffering) return false;
    if (freshForegroundVideoProgressPending()) return true;
    return !directUserVideoPlaybackHealthy(
      Number(state.freshForegroundVideoFirstBaseVT) || 0,
      Number(state.freshForegroundVideoFirstArmedAt) || 0,
      true
    );
  }
  function shouldKeepForegroundReturnVideoFirst() {
    if (document.visibilityState !== "visible" || !isWindowFocused()) return false;
    if (!state.intendedPlaying || state.restarting || state.seeking || state.seekBuffering) return false;
    // During bg return grace, skip video-first gating — decoder needs warmup time
    // and blocking audio/arming buffer holds just makes the freeze worse.
    if (inBgReturnGrace()) return false;
    if (freshForegroundVideoFirstPending()) return true;
    if (now() < state.foregroundReturnUserPlayUntil &&
        (directUserToggleActive(1200) || userWantsPlayNow(1500) || userToggleExpectingPlay())) {
      return true;
    }
    // was 10s, now 3s. 10s held audio for ten whole seconds after tab
    // return while video "proved" it was rendering — user saw video
    // "playing" with no audio and a frozen frame (the "waits for
    // something" bug). 3s is enough warmup; past that, push audio through.
    const recentlyReturnedToForeground =
      state.lastBgReturnAt > 0 &&
      (now() - state.lastBgReturnAt) < 3000;
    if (!recentlyReturnedToForeground) return false;
    return (
      directUserToggleActive(1200) ||
      userWantsPlayNow(1500) ||
      userToggleExpectingPlay()
    );
  }
  function shouldRequireVisibleVideoLeadForDirectUserPlay() {
    // DISABLED: This system blocked both audio AND video on every user play,
    // waiting for video to produce frames before allowing anything to start.
    // Since video needs 100-500ms to decode the first frame after play(),
    // this caused a visible freeze on every play press. The sync loop handles
    // any A/V drift that occurs from starting both simultaneously.
    return false;
  }
  function shouldRequireVisibleVideoHealthForForegroundPlay() {
    // DISABLED: This entire system blocked both audio and video playback until
    // video proved it was producing frames (via directUserVideoPlaybackHealthy).
    // Since video needs 100-500ms to decode the first frame after play(), this
    // caused a visible freeze on every play, tab return, and recovery. The sync
    // loop and stall detection handle A/V coordination properly without this gate.
    return false;
  }
  function shouldBlockLeadingAudioForForegroundPlay() {
    if (document.visibilityState !== "visible" || !isWindowFocused()) return false;
    if (!state.intendedPlaying || state.restarting || state.seeking || state.seekBuffering) return false;
    if (!coupledMode || !audio) return false;
    // Never block audio during the post-seek kick window — readyState temporarily
    // drops after seek and this gate would delay audio start by seconds.
    if (state.seekKickAudioAllowedUntil > 0 && now() < state.seekKickAudioAllowedUntil) return false;
    const requireVisibleVideoHealth =
      shouldKeepForegroundReturnVideoFirst() ||
      shouldRequireVisibleVideoHealthForForegroundPlay();
    if (!requireVisibleVideoHealth) return false;
    const healthBaseVt =
      isFinite(Number(state.freshForegroundVideoFirstBaseVT))
        ? Number(state.freshForegroundVideoFirstBaseVT)
        : (() => { try { return Number(video.currentTime()) || 0; } catch { return 0; } })();
    const healthArmedAt =
      Number(state.freshForegroundVideoFirstArmedAt) ||
      Number(state.lastUserToggleAt) ||
      0;
    return getVideoPaused() || !directUserVideoPlaybackHealthy(healthBaseVt, healthArmedAt, true);
  }
  function shouldBlockLeadingAudioForForegroundReturn() {
    return shouldKeepForegroundReturnVideoFirst() && shouldBlockLeadingAudioForForegroundPlay();
  }
  function mediaActionRecently(type, ms = 1200) {
    return state.lastMediaAction === type && (now() - state.lastMediaActionTs) < ms;
  }
  function setFastSync(ms = 1200) {
    state.fastSyncUntil = Math.max(state.fastSyncUntil, now() + Math.max(0, Number(ms) || 0));
    scheduleSync(0);
  }
  function fastSyncActive() { return now() < state.fastSyncUntil; }
  function clearBufferHold() {
    state.strictBufferHold = false;
    state.bufferHoldSince = 0;
    state.strictBufferReason = "";
    state.strictBufferHoldFrames = 0;
    state.strictBufferHoldConfirmed = false;
  }
  function clearAudioPauseLocks() {
    state.isProgrammaticAudioPause = false;
    state.videoStallAudioPaused = false;
    state.stallAudioResumeHoldUntil = 0;
    state.stallAudioPausedSince = 0;
    state.audioPauseUntil = 0;
    state.audioEventsSquelchedUntil = 0;
    state.audioPausedSince = 0;
  }
  function clearTrackedWakeupRetryTimers() {
    if (!state._wakeupRetryTimers.length) return;
    state._wakeupRetryTimers.forEach(t => clearTimeout(t));
    state._wakeupRetryTimers = [];
  }
  function trackWakeupRetryTimer(tid) {
    if (tid != null) state._wakeupRetryTimers.push(tid);
    return tid;
  }
  function untrackWakeupRetryTimer(tid) {
    const idx = state._wakeupRetryTimers.indexOf(tid);
    if (idx !== -1) state._wakeupRetryTimers.splice(idx, 1);
  }
  function clearForegroundUserPlayRetryTimers() {
    if (!state._foregroundUserPlayRetryTimers.length) return;
    state._foregroundUserPlayRetryTimers.forEach(t => clearTimeout(t));
    state._foregroundUserPlayRetryTimers = [];
  }
  function trackForegroundUserPlayRetryTimer(tid) {
    if (tid != null) state._foregroundUserPlayRetryTimers.push(tid);
    return tid;
  }
  function untrackForegroundUserPlayRetryTimer(tid) {
    const idx = state._foregroundUserPlayRetryTimers.indexOf(tid);
    if (idx !== -1) state._foregroundUserPlayRetryTimers.splice(idx, 1);
  }
  function clearTransitionDriftTimers() {
    if (!state._transitionDriftTimers.length) return;
    state._transitionDriftTimers.forEach(t => clearTimeout(t));
    state._transitionDriftTimers = [];
  }
  function trackTransitionDriftTimer(tid) {
    if (tid != null) state._transitionDriftTimers.push(tid);
    return tid;
  }
  function untrackTransitionDriftTimer(tid) {
    const idx = state._transitionDriftTimers.indexOf(tid);
    if (idx !== -1) state._transitionDriftTimers.splice(idx, 1);
  }
  function attemptTransitionDriftRepair(opts = {}) {
    const { threshold = 0.6, resumeIfPaused = false, allowSeekRecovery = false } = opts || {};
    if (!coupledMode || !audio || _errorOverlayShown) return false;
    if (document.visibilityState !== "visible" || !isWindowFocused()) return false;
    if (!state.intendedPlaying || state.restarting) return false;
    if (userPauseLockActive() || mediaSessionForcedPauseActive()) return false;
    if (state.strictBufferHold || state.videoStallAudioPaused) return false;
    if (state.seeking || state.seekBuffering) return false;
    if (!allowSeekRecovery && (seekRecoveryActive(140) || seekStabilizeActive(140))) return false;
    if (isForegroundVideoActuallyBuffering()) return false;
    if (getVideoPaused()) return false;

    const vt = (() => { try { return Number(video.currentTime()) || 0; } catch { return NaN; } })();
    const at = Number(audio.currentTime) || 0;
    if (!isFinite(vt) || !isFinite(at)) return false;

    const drift = Math.abs(at - vt);
    const needsResume = resumeIfPaused && audio.paused;
    // Always check drift — even when audio needs resume. The old code skipped
    // this when needsResume was true, hard-seeking audio on every play/pause
    // toggle even for 0.01s drift (the audible "skip" on play press).
    // If drift is tiny, just resume audio without seeking.
    if (drift <= (needsResume ? 0.3 : Math.max(0.8, Number(threshold) || 0))) {
      if (needsResume && state.intendedPlaying && !shouldBlockNewAudioStart()) {
        execProgrammaticAudioPlay({ squelchMs: 120, force: true, minGapMs: 0 }).catch(() => {});
        setFastSync(1000);
        scheduleSync(0);
        return true;
      }
      return false;
    }

    const wouldRestart =
      vt < 0.5 &&
      at > 1.0 &&
      state.firstPlayCommitted &&
      !state.restarting &&
      !isLoopDesired();
    if (wouldRestart) return false;

    const vrs = getVideoReadyState();
    if (state.videoWaiting && vrs < HAVE_FUTURE_DATA) return false;

    if (!audio.paused) {
      const audioReady = Number(audio.readyState || 0) >= HAVE_CURRENT_DATA;
      const audioBuffered = bufferedAhead(audio, vt) > 0.08;
      if (!audioReady && !audioBuffered) return false;
    }

    const nowPerf = performance.now();
    const minGap = allowSeekRecovery ? 100 : 140;
    if ((nowPerf - (Number(state.lastTransitionDriftRepairAt) || 0)) < minGap) return false;
    state.lastTransitionDriftRepairAt = nowPerf;

    state._allowAudioTimeWrite = true;
    try { audio.currentTime = vt; } catch {}
    state._allowAudioTimeWrite = false;
    resetAudioPlaybackRate();

    if (resumeIfPaused && audio.paused && state.intendedPlaying && !shouldBlockNewAudioStart()) {
      execProgrammaticAudioPlay({
        squelchMs: allowSeekRecovery ? 140 : 120,
        force: true,
        minGapMs: 0
      }).catch(() => {});
    }

    setFastSync(1000);
    scheduleSync(0);
    return true;
  }
  function armTransitionDriftSettleForPlay(playSession = state.playSessionId) {
    if (!coupledMode || !audio) return;
    clearTransitionDriftTimers();
    // Use a high threshold (1.5s) for play/pause transitions. After a quick
    // pause→play cycle, video and audio positions are nearly identical — the
    // old 0.8s threshold triggered hard audio seeks on tiny drift from decoder
    // jitter, causing an audible "skip" on every play press. 1.5s ensures only
    // genuinely desynchronized playback gets corrected. The rate-sync system
    // handles sub-1.5s drift smoothly without any audible disruption.
    [140, 320, 620, 980].forEach(delay => {
      const tid = trackTransitionDriftTimer(setTimeout(() => {
        untrackTransitionDriftTimer(tid);
        if (state.playSessionId !== playSession) return;
        if (!state.intendedPlaying || state.restarting || state.seeking || state.seekBuffering) return;
        attemptTransitionDriftRepair({ threshold: 1.5, resumeIfPaused: true, allowSeekRecovery: false });
      }, delay));
    });
  }
  function armTransitionDriftSettleForSeek(seekId, playSession = state.playSessionId) {
    if (!coupledMode || !audio) return;
    clearTransitionDriftTimers();
    [120, 260, 520, 900, 1400].forEach(delay => {
      const tid = trackTransitionDriftTimer(setTimeout(() => {
        untrackTransitionDriftTimer(tid);
        if (state.seekId !== seekId || state.playSessionId !== playSession) return;
        if (!state.intendedPlaying || state.restarting || state.seekBuffering) return;
        if (!shouldResumeAfterSeek() && !state.playRequestedDuringSeek) return;
        attemptTransitionDriftRepair({ threshold: 0.8, resumeIfPaused: true, allowSeekRecovery: true });
      }, delay));
    });
  }
  function directUserVideoPlaybackHealthy(baseVt = NaN, armedAt = 0, requireProgress = false) {
    if (document.visibilityState !== "visible" || !isWindowFocused()) return false;
    if (getVideoPaused()) return false;
    const vNode = getVideoNode();
    const vrs = vNode ? Number(vNode.readyState || 0) : 0;
    if (state.videoWaiting && vrs < HAVE_FUTURE_DATA) return false;
    const forwardProgress = foregroundVideoMadeVisibleProgress(baseVt, requireProgress ? 0.08 : 0.03);
    if (forwardProgress && vrs >= HAVE_CURRENT_DATA) return true;
    if (requireProgress) return false;
    if (armedAt > 0 && state.lastVideoPlayingAt >= (armedAt - 25) && vrs >= HAVE_CURRENT_DATA) return true;
    return vrs >= HAVE_FUTURE_DATA && !state.videoWaiting && armedAt > 0 && (now() - armedAt) > 150;
  }
  function startForegroundUserPlayRetry() {
    clearForegroundUserPlayRetryTimers();
    if (document.visibilityState !== "visible" || !isWindowFocused()) return;
    if (!state.intendedPlaying || state.restarting || state.seeking || state.seekBuffering) return;
    if (mediaSessionForcedPauseActive() || userPauseLockActive() || userWantsPauseNow(1000)) return;
    // During bg return grace, don't arm long retry chains — just kick play directly
    if (inBgReturnGrace()) {
      const _nPlay = HTMLMediaElement.prototype.play;
      const _vn = getVideoNode();
      if (_vn && _vn.paused) try { _nPlay.call(_vn).catch(() => {}); } catch {}
      return;
    }

    const playSession = state.playSessionId;
    const armedAt = now();
    const recentReturnAtStart = shouldTreatUpcomingPlayAsFreshForegroundStart();
    const directForegroundLeadAtStart = shouldRequireVisibleVideoLeadForDirectUserPlay();
    const requireVisibleLeadAtStart = recentReturnAtStart || directForegroundLeadAtStart;
    if (recentReturnAtStart) clearFreshForegroundReturnGatesForUserPlay();
    const baseVt = (() => { try { return Number(video.currentTime()) || 0; } catch { return 0; } })();
    if (requireVisibleLeadAtStart) {
      armFreshForegroundVideoFirst(baseVt, recentReturnAtStart ? 6500 : 3200);
    }
    else clearFreshForegroundVideoFirst();
    const kick = () => {
      if (state.playSessionId !== playSession) { clearForegroundUserPlayRetryTimers(); return; }
      if (!state.intendedPlaying || state.restarting || state.seeking || state.seekBuffering) {
        clearForegroundUserPlayRetryTimers();
        return;
      }
      if (document.visibilityState !== "visible" || !isWindowFocused()) {
        clearForegroundUserPlayRetryTimers();
        return;
      }
      if (mediaSessionForcedPauseActive() || userPauseLockActive() || userWantsPauseNow(1200)) {
        clearForegroundUserPlayRetryTimers();
        return;
      }
      if (directUserVideoPlaybackHealthy(baseVt, armedAt, requireVisibleLeadAtStart)) {
        clearFreshForegroundVideoFirst();
        clearForegroundUserPlayRetryTimers();
        if (coupledMode && audio && audio.paused && state.intendedPlaying &&
            !state.strictBufferHold && !state.videoWaiting &&
            !shouldHoldAudioForForegroundStall({ allowRecovery: false }) &&
            !shouldBlockNewAudioStart()) {
          const settledVt = (() => { try { return Number(video.currentTime()) || 0; } catch { return 0; } })();
          safeSetAudioTime(settledVt);
          state.audioStartGraceUntil = Math.max(state.audioStartGraceUntil, now() + 600);
          execProgrammaticAudioPlay({ squelchMs: 120, force: true, minGapMs: 0 }).catch(() => {});
        }
        return;
      }

      // Clear stale foreground hold state before retrying. A real visible user
      // play should not wait behind old buffer/return bookkeeping.
      // But only clear stall flags if video has data — if readyState is low,
      // video is genuinely buffering and audio must not start.
      const _sfuprVNode = getVideoNode();
      const _sfuprRS = _sfuprVNode ? Number(_sfuprVNode.readyState || 0) : 0;
      if (_sfuprRS >= HAVE_FUTURE_DATA) {
        clearBufferHold();
        state.videoWaiting = false;
        state.videoStallSince = 0;
        state.videoStallAudioPaused = false;
        state.stallAudioPausedSince = 0;
        state.stallAudioResumeHoldUntil = 0;
      }
      VisibilityGuard.onPlayCalled();
      try { execProgrammaticVideoPlay({ force: true, minGapMs: 0 }); } catch {}
      setFastSync(1400);
      scheduleSync(0);
    };

    const retryDelays = recentReturnAtStart
      ? [0, 70, 180, 320, 520, 850, 1250, 1700, 2350, 3200, 4300, 5600]
      : requireVisibleLeadAtStart
        ? [0, 70, 180, 320, 520, 850, 1250, 1700, 2350, 3200]
      : [0, 70, 180, 320, 520, 850, 1250];
    retryDelays.forEach(delay => {
      const tid = trackForegroundUserPlayRetryTimer(setTimeout(() => {
        untrackForegroundUserPlayRetryTimer(tid);
        kick();
      }, delay));
    });
  }
  function isConfirmedForegroundVideoStall(minAgeMs = 450) {
    if (!coupledMode || !audio) return false;
    if (!state.intendedPlaying || state.restarting) return false;
    if (!state.videoWaiting || state.seeking || state.seekBuffering || state.seekResumeInFlight) return false;
    if (!state.firstPlayCommitted) return false;
    if (document.visibilityState === "hidden") return false;
    // Grace period: only skip stall detection if videoWaiting is NOT set.
    // If the browser fired "waiting" (hardware signal), trust it over grace.
    // The old logic silenced ALL stall detection during grace (600-1500ms),
    // letting audio play while video was genuinely stalling.
    if (now() < state.audioStartGraceUntil && !state.videoWaiting) return false;
    const vNode = getVideoNode();
    const vRS = vNode ? Number(vNode.readyState || 0) : 4;
    if (vRS >= HAVE_FUTURE_DATA) return false;
    const stallAge = state.videoStallSince ? (now() - state.videoStallSince) : 0;
    return stallAge >= Math.max(0, Number(minAgeMs) || 0);
  }
  function isForegroundVideoActuallyBuffering() {
    if (!coupledMode || !audio) return false;
    if (!state.firstPlayCommitted || !state.intendedPlaying || state.restarting) return false;
    if (state.seeking || state.seekBuffering || state.seekResumeInFlight) return false;
    if (document.visibilityState !== "visible" || !isWindowFocused()) return false;
    // During the post-seek audio kick window, the seeked handler's retry chain
    // is managing audio resume. Don't report "buffering" based on stale stall
    // flags — the seek just reset all positions and readyState is recovering.
    if (now() < state.seekKickAudioAllowedUntil) return false;
    // During a direct user play action, don't report buffering from stale flags.
    // The user just pressed play; video is being kicked. Stall flags from before
    // the play intent shouldn't block audio — video will recover.
    if (userWantsPlayNow(1200) || directUserToggleActive(1200)) return false;

    const vNode = getVideoNode();
    const vRS = vNode ? Number(vNode.readyState || 0) : 4;
    // If readyState confirms video genuinely lacks data, report buffering even
    // during tab return or NMPBFN recovery. readyState is a hardware signal.
    // Only bypass for transient states where readyState is already sufficient.
    if (isTabReturnImmune() || NotMakePlayBackFixingNoticable.isActive()) {
      if (vRS < HAVE_FUTURE_DATA && state.videoWaiting) return true;
      return false;
    }
    const vPaused = getVideoPaused();
    const vtNow = (() => { try { return Number(video.currentTime()) || 0; } catch { return 0; } })();
    const lastVt = Number(state.lastVT) || 0;
    const frozenVisiblePlayback =
      !vPaused &&
      vtNow > 0.05 &&
      state.lastVTts > 0 &&
      (now() - state.lastVTts) > 220 &&
      Math.abs(vtNow - lastVt) < 0.001 &&
      vRS < HAVE_FUTURE_DATA;
    const stallFlagsActive =
      state.videoWaiting ||
      state.videoStallAudioPaused ||
      state.strictBufferHold ||
      now() < state.stallAudioResumeHoldUntil;
    // Require stall to have persisted at least 400ms before reporting buffering.
    // Brief transient stalls (<400ms) from segment boundaries or keyframe decoding
    // set videoWaiting momentarily. Reporting "buffering" for these causes random
    // audio cuts during otherwise smooth playback.
    const _stallPersisted = state.videoStallSince > 0 && (now() - state.videoStallSince) > 400;
    if (stallFlagsActive && _stallPersisted && (vPaused || vRS < HAVE_FUTURE_DATA)) return true;
    // For very short stalls (<400ms), only report buffering if readyState is very low
    if (stallFlagsActive && !_stallPersisted && vRS < HAVE_CURRENT_DATA) return true;
    if (state.videoStallSince > 0 && (now() - state.videoStallSince) > 600 && vRS < HAVE_CURRENT_DATA) return true;
    if (frozenVisiblePlayback) return true;
    return false;
  }
  function shouldPauseAudioImmediatelyForForegroundVideoBuffer() {
    if (!coupledMode || !audio || audio.paused) return false;
    if (!state.intendedPlaying || state.restarting) return false;
    if (state.seeking || state.seekBuffering || state.seekResumeInFlight) return false;
    if (!state.firstPlayCommitted) return false;
    if (document.visibilityState !== "visible" || !isWindowFocused()) return false;
    // Only skip tab-return/NMPBFN if video actually has data. If video is
    // genuinely starved (readyState < HAVE_FUTURE_DATA), audio must still pause
    // regardless of immunity — the user hears audio over a frozen video otherwise.
    if (isTabReturnImmune() || NotMakePlayBackFixingNoticable.isActive()) {
      const _spVNode = getVideoNode();
      const _spRS = _spVNode ? Number(_spVNode.readyState || 0) : 4;
      if (_spRS >= HAVE_FUTURE_DATA) return false;
    }
    return isForegroundVideoActuallyBuffering();
  }
  function getPreferredPlaybackSyncTarget(opts = {}) {
    const { preferAudio = false, allowNearZero = false } = opts || {};
    const vt = (() => { try { return Number(video.currentTime()) || 0; } catch { return NaN; } })();
    const at = coupledMode && audio ? (Number(audio.currentTime) || 0) : NaN;
    const lastGoodVT = Number(state.lastKnownGoodVT) || 0;
    const bgAT = Number(state.bgHiddenBaseAT) || 0;
    const bgVT = Number(state.bgHiddenBaseVT) || 0;
    const ordered = preferAudio
      ? [at, vt, lastGoodVT, bgAT, bgVT]
      : [vt, at, lastGoodVT, bgVT, bgAT];

    for (const candidate of ordered) {
      if (!isFinite(candidate) || candidate < 0) continue;
      if (allowNearZero || candidate > 0.08 || !state.firstPlayCommitted) return candidate;
    }
    for (const candidate of ordered) {
      if (isFinite(candidate) && candidate >= 0) return candidate;
    }
    return 0;
  }
  function shouldAllowVisibleReturnSyncSeek() {
    if (shouldKeepForegroundReturnVideoFirst()) return false;
    if (document.visibilityState === "visible" && isWindowFocused()) return false;
    return (
      isHiddenBackground() ||
      inBgReturnGrace() ||
      hiddenPlayPendingActive() ||
      foregroundResumeBoostActive() ||
      state.resumeOnVisible ||
      state.bgHiddenWasPlaying ||
      state.bgResumeInFlight
    );
  }
  function shouldForcePauseAudioForForegroundVideoBufferEvent() {
    if (!coupledMode || !audio) return false;
    if (!state.intendedPlaying || state.restarting) return false;
    if (!state.firstPlayCommitted) return false;
    if (state.seeking || state.seekBuffering || state.seekResumeInFlight) return false;
    if (document.visibilityState !== "visible" || !isWindowFocused()) return false;
    // DO NOT bypass for tab-return immunity or NMPBFN recovery.
    // If the browser fires "waiting" in visible foreground, video is genuinely
    // out of data regardless of what recovery system is active. Audio must pause.
    return true;
  }
  function armForegroundBufferAudioHold(ms = MIN_STALL_AUDIO_RESUME_MS) {
    const holdUntil = now() + Math.max(0, Number(ms) || 0);
    state.foregroundBufferAudioHoldUntil = Math.max(state.foregroundBufferAudioHoldUntil, holdUntil);
    return state.foregroundBufferAudioHoldUntil;
  }
  function clearForegroundBufferAudioHold() {
    state.foregroundBufferAudioHoldUntil = 0;
  }
  function foregroundBufferAudioHoldActive() {
    return now() < state.foregroundBufferAudioHoldUntil;
  }
  // Internal cooldown so callers can't pile kills on top of each other.
  // 1500ms is long enough that the recovery (seeked/waiting/playing) events
  // have time to clear the stall flag before a second kill is allowed.
  let _lastStallKillAt = 0;
  const STALL_KILL_COOLDOWN_MS = 3000; // was 1500→3000: give stalls more time to resolve before killing audio
  // Audio position recorded at the moment of stall-pause. Used by resume
  // paths to prevent seeking audio BACKWARD (which causes audible repeat).
  // If audio was at position 45.2s when we paused it for a stall, and video
  // catches up to 44.8s, the old code would seek audio to 44.8s — replaying
  // 0.4s of content. Now we clamp: never seek audio behind _stallPauseAudioPos.
  let _stallPauseAudioPos = -1;
  function getStallPauseAudioPos() { return _stallPauseAudioPos; }

  function pauseAudioForConfirmedVideoStall(holdMs = MIN_STALL_AUDIO_RESUME_MS) {
    if (!coupledMode || !audio || audio.paused) return false;
    // STARTUP SETTLE: the decoder's natural readyState dips during the first
    // 15s after commit look identical to a real stall from the outside —
    // waiting handler fires, readyState < HAVE_FUTURE_DATA, etc. Killing
    // audio on those dips is the primary cause of "audio cuts for the first
    // 15s" artifacts. User pauses bypass this (startupSettleActive respects
    // userGesturePauseIntent) so an explicit pause still stops audio instantly.
    if (startupSettleActive()) return false;
    // Reject if we just killed audio for a stall very recently — stops rapid
    // cut loops when the browser oscillates between "waiting" and "playing".
    const nowMs = now();
    if ((nowMs - _lastStallKillAt) < STALL_KILL_COOLDOWN_MS) return false;
    // Never kill during the seek kick window — seeked handler owns audio there.
    if (nowMs < state.seekKickAudioAllowedUntil) return false;
    if (state.seekResumeInFlight || state.seeking || state.seekBuffering) return false;
    // don't cut audio right after the user pressed play. they expect
    // instant sound; stall flags from decoder warmup shouldn't block it.
    // 800ms window — just the immediate post-click period.
    if (userWantsPlayNow(800) || directUserToggleActive(800)) return false;
    _lastStallKillAt = nowMs;
    _lastGlobalAudioKillAt = nowMs;
    const holdUntil = nowMs + Math.max(0, Number(holdMs) || 0);
    state.videoStallAudioPaused = true;
    state.stallAudioPausedSince = state.stallAudioPausedSince || nowMs;
    state.audioPausedSince = 0;
    state.stallAudioResumeHoldUntil = Math.max(state.stallAudioResumeHoldUntil, holdUntil);
    state.foregroundBufferAudioHoldUntil = Math.max(state.foregroundBufferAudioHoldUntil, holdUntil);
    state.bufferHoldIntendedPlaying = state.intendedPlaying;
    cancelActiveFade();
    if (state._stallAudioPauseTimer) {
      clearTimeout(state._stallAudioPauseTimer);
      state._stallAudioPauseTimer = null;
    }
    // Record audio position BEFORE pausing. On resume, we clamp seeks to
    // never go backward past this position — prevents the "audio repeats
    // during buffering" bug where audio was seeked back to video's position.
    try { _stallPauseAudioPos = Number(audio.currentTime) || -1; } catch { _stallPauseAudioPos = -1; }
    state.isProgrammaticAudioPause = true;
    squelchAudioEvents(400);
    state.audioPauseUntil = Math.max(state.audioPauseUntil, nowMs + 400);
    try { audio.volume = 0; } catch {}
    try { audio.pause(); } catch {}
    setTimeout(() => { state.isProgrammaticAudioPause = false; }, 150);
    return true;
  }
  function shouldHoldAudioForForegroundStall(opts = {}) {
    if (!coupledMode || !audio) return false;
    if (!state.firstPlayCommitted || !state.intendedPlaying || state.restarting) return false;
    if (state.seeking || state.seekBuffering || state.seekResumeInFlight) return false;
    if (document.visibilityState !== "visible" || !isWindowFocused()) return false;
    // During the seek kick window, the seeked handler's retry chain owns audio.
    // Don't hold audio here — it fights the retry chain and causes late audio.
    if (now() < state.seekKickAudioAllowedUntil) return false;
    // During a direct user play action, don't hold audio for stale stall flags.
    // The user clicked play and expects immediate response. Stall flags from
    // before the play intent are stale — video is being kicked to play too.
    if (userWantsPlayNow(1500) || directUserToggleActive(1500)) return false;
    if (foregroundBufferAudioHoldActive()) return true;
    if (isForegroundVideoActuallyBuffering()) return true;

    const allowRecovery = !!opts.allowRecovery;
    const recovering = foregroundRecoveryActive(250);

    const vNode = getVideoNode();
    const vRS = vNode ? Number(vNode.readyState || 0) : 4;
    const vPaused = getVideoPaused();
    const stallFlagsActive =
      state.videoWaiting ||
      state.videoStallAudioPaused ||
      state.strictBufferHold ||
      now() < state.stallAudioResumeHoldUntil;
    // Only block audio when video genuinely lacks data — readyState is authoritative.
    // Stall flags without readyState confirmation are stale (video recovered but
    // flags weren't cleared due to a race). Video's "playing" event clears flags,
    // but if it hasn't fired yet, readyState tells us the truth.
    if (vRS >= HAVE_FUTURE_DATA) {
      // Video has data — stall flags are stale, clear them all
      if (state.videoWaiting) { state.videoWaiting = false; state.videoStallSince = 0; }
      if (state.videoStallAudioPaused) { state.videoStallAudioPaused = false; state.stallAudioPausedSince = 0; state.stallAudioResumeHoldUntil = 0; }
      clearForegroundBufferAudioHold();
      return false;
    }
    // Video lacks data — block audio if any stall flag is set
    if (stallFlagsActive) return true;
    if (vRS < HAVE_CURRENT_DATA && state.videoStallSince > 0) return true;
    return false;
  }
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
  function markUserSeekIntent(ms = 2600) {
    const until = now() + Math.max(0, Number(ms) || 0);
    state.userSeekIntentUntil = Math.max(state.userSeekIntentUntil, until);
    suppressStartupZero(15000);
    state.lastUserActionTime = now();
  }
  function userSeekIntentActive() { return now() < state.userSeekIntentUntil; }
  function startupZeroSuppressed() {
    const globalUntil = (() => {
      try { return Number(window.__playerStartupZeroSuppressedUntil) || 0; } catch { return 0; }
    })();
    if (globalUntil > state.startupZeroSuppressedUntil) {
      state.startupZeroSuppressedUntil = globalUntil;
    }
    return now() < state.startupZeroSuppressedUntil;
  }
  function suppressStartupZero(ms = 15000) {
    const until = now() + Math.max(1000, Number(ms) || 0);
    state.startupZeroSuppressedUntil = Math.max(state.startupZeroSuppressedUntil, until);
    try {
      const globalUntil = Number(window.__playerStartupZeroSuppressedUntil) || 0;
      if (until > globalUntil) window.__playerStartupZeroSuppressedUntil = until;
    } catch {}
  }
  function restartFromEndedGuardActive() { return now() < state.restartFromEndedUntil; }
  function authorizeNearZeroSeek(ms = 2400) {
    state.nearZeroSeekAuthorizedUntil = Math.max(
      state.nearZeroSeekAuthorizedUntil,
      now() + Math.max(0, Number(ms) || 0)
    );
  }
  function nearZeroSeekAuthorized(target = NaN) {
    const t = Number(target);
    if (!isFinite(t) || t >= 0.8) return true;
    if (!state.firstPlayCommitted) return true;
    if (state.restarting || isLoopDesired() || restartFromEndedGuardActive()) return true;
    if (now() < state.nearZeroSeekAuthorizedUntil) return true;
    const pending = Number(state.pendingSeekTarget);
    if (state.pendingSeekTarget != null && isFinite(pending) && pending < 0.8) return true;
    return false;
  }
  function armSeekResumeIntent(ms = 7000) {
    const until = now() + Math.max(0, Number(ms) || 0);
    state.seekResumeWantedUntil = Math.max(state.seekResumeWantedUntil, until);
  }
  function clearSeekResumeIntent() {
    state.seekWantedPlaying = false;
    state.seekResumeWantedUntil = 0;
  }
  function shouldResumeAfterSeek() {
    if (state.restarting || state.endedNaturally) return false;
    if (mediaSessionForcedPauseActive() || userPauseLockActive() || userPauseIntentActive()) return false;
    if (state.userPauseIntentPresetAt > 0 && (now() - state.userPauseIntentPresetAt) < 2200) return false;
    if (state.seekWantedPlaying) return true;
    return now() < state.seekResumeWantedUntil;
  }
  function seekStabilizeActive(tailMs = 0) {
    const tail = Math.max(0, Number(tailMs) || 0);
    return now() < (state.seekStabilizeUntil + tail);
  }
  function beginUserToggleTxn(wantPlay, ms = USER_TOGGLE_TXN_FAST_MS) {
    const until = now() + Math.max(0, Number(ms) || 0);
    state.userToggleExpectedPlay = !!wantPlay;
    state.userToggleTxnUntil = Math.max(state.userToggleTxnUntil, until);
  }
  function clearUserToggleTxn() {
    state.userToggleTxnUntil = 0;
    state.userToggleExpectedPlay = null;
  }
  function userToggleTxnActive() {
    return typeof state.userToggleExpectedPlay === "boolean" && now() < state.userToggleTxnUntil;
  }
  function userToggleExpectingPlay() {
    return userToggleTxnActive() && state.userToggleExpectedPlay === true;
  }
  function userToggleExpectingPause() {
    return userToggleTxnActive() && state.userToggleExpectedPlay === false;
  }
  function seekRecoveryActive(windowMs = 0) {
    const t = now();
    const tail = Math.max(0, Number(windowMs) || 0);
    return (
      state.seekResumeInFlight ||
      state.seeking ||
      state.seekBuffering ||
      state.seekKickAudioAllowedUntil > t ||
      state.seekAudioMustStartUntil > (t - tail) ||
      userSeekIntentActive()
    );
  }

  function markUserPauseIntent(ms = USER_PAUSE_INTENT_FAST_MS) {
    const intentMs = Math.max(350, Number(ms) || USER_PAUSE_INTENT_FAST_MS);
    const txnMs = Math.max(USER_TOGGLE_TXN_FAST_MS, Math.min(intentMs, 1200));
    VisibilityGuard.onUserPause();
    SmoothTabWelcomeBackManagement.onUserPause();
    noteUserToggle("pause");
    beginUserToggleTxn(false, txnMs);
    clearSeekResumeIntent();
    clearForegroundUserPlayRetryTimers();
    clearTransitionDriftTimers();
    clearFreshForegroundVideoFirst();
    clearForegroundReturnUserPlay();
    state.userPauseIntentPresetAt = now();
    state.userPlayIntentPresetAt = 0;
    state.audioStartGraceUntil = 0;
    // Block micro-seeks through the full pause transition. The shorter 200ms
    // window still let recovery nudges land during normal pause settle, which
    // showed up as tiny random seeks and brief frozen-frame flashes.
    state._playPauseTransitionUntil = Math.max(
      state._playPauseTransitionUntil,
      now() + PLAY_PAUSE_MICRO_SEEK_BLOCK_MS
    );
    state.userGesturePauseIntent = true;
    state.firstPlayCommitted = true;
    state.startupKickDone = true;
    state.startupPhase = false;
    state.playSessionId = (state.playSessionId || 0) + 1;
    MediumQualityManager.markUserPaused(); // MQM: record authoritative user pause intent
    PlaybackStabilityManager.onUserAction();
    try { UltraStabilizer.onUserAction(); } catch {}
    BringBackToTabManager.onUserPause(); // cancel any tab-return lock — user is in control
    clearStartupAutoplayRetryTimer();
    state.lastUserActionTime = now();
    state.bgSuppressionSessionCount = 0;
    state.bgPauseSuppressionCount = 0;

    cancelActiveFade();
    // snapshot the current video position on user pause — this is the
    // user's real spot. getBestResumePosition and tab-return recovery
    // use it to resume from the right place instead of drifting.
    // also save it for play/pause/play restoration. the browser can
    // snap currentTime to a keyframe (0.5-2s forward) on play, and
    // we restore the saved position to stop that visible jump.
    try {
      const _pauseVT = Number(video.currentTime()) || 0;
      if (_pauseVT > 0.1) {
        state.lastKnownGoodVT = _pauseVT;
        state.lastKnownGoodVTts = now();
        state._pauseSavedPosition = _pauseVT;
        state._pauseSavedAt = now();
      }
    } catch {}
    // Disarm VCFM on pause — no point checking compositor when paused.
    // Also prevents stale VCFM arms from firing micro-seeks after pause.
    try { VideoCompositorFlushManager.disarm(); } catch {}
    // Disarm PRFV on pause — prevents stale frame checks from micro-seeking
    try { PlayResumeFrameVerifier.disarm(); } catch {}
    state.audioPlayGeneration++;
    // SAFETY NET: directly pause audio here. The video pause event handler
    // has 15+ early-exit paths (seeking, seekBuffering, tab return immunity,
    // etc.) that can skip pauseHard(). If any of them fires, audio keeps
    // playing while video is paused — the #1 user-reported pause bug.
    // Pausing audio here (50-100ms before video visually pauses) is
    // imperceptible and guarantees audio always stops on user pause.
    //
    // Use a 40ms deferred pause so that rapid play/pause/play (<40ms) can
    // cancel it before audio actually stops — prevents the audible audio cut
    // on fast toggles. The timer ID is stored so markUserPlayIntent can cancel.
    if (coupledMode && audio && !audio.paused) {
      if (state._deferredAudioPauseTimer) clearTimeout(state._deferredAudioPauseTimer);
      state._deferredAudioPauseTimer = setTimeout(() => {
        state._deferredAudioPauseTimer = null;
        // Re-check: if user already hit play, don't pause audio
        if (state.intendedPlaying) return;
        state.isProgrammaticAudioPause = true;
        squelchAudioEvents(200);
        try { audio.pause(); } catch {}
        setTimeout(() => { state.isProgrammaticAudioPause = false; }, 200);
      }, 40);
    }
    state.rapidPlayPauseCount = 0;
    state.rapidPlayPauseResetAt = now();
    state.rapidToggleDetected = false;
    state.rapidToggleUntil = 0;
    state.loopPreventionCooldownUntil = 0;

    setTimeout(() => { state.userGesturePauseIntent = false; }, Math.min(USER_GESTURE_PAUSE_HOLD_MS, intentMs));
    const until = now() + intentMs;
    state.userPauseUntil = Math.max(state.userPauseUntil, until);
    state.userPauseLockUntil = Math.max(state.userPauseLockUntil, until + USER_PAUSE_LOCK_EXTRA_MS);
    state.userPlayUntil = 0;
    state.intendedPlaying = false;
    state.bufferHoldIntendedPlaying = false;
    state.startupPlaySettled = true;
    updateMediaSessionPlaybackState();
    if (platform.chromiumOnlyBrowser) {
      state.chromiumPauseGuardUntil = Math.max(state.chromiumPauseGuardUntil, until + 180);
      state.chromiumAudioStartLockUntil = Math.max(state.chromiumAudioStartLockUntil, until + 260);
      state.chromiumBgSettlingUntil = Math.max(state.chromiumBgSettlingUntil, until + 140);
    }
  }

  function markUserPlayIntent(ms = USER_PLAY_INTENT_FAST_MS, opts = {}) {
    const intentMs = Math.max(400, Number(ms) || USER_PLAY_INTENT_FAST_MS);
    const txnMs = Math.max(USER_TOGGLE_TXN_FAST_MS, Math.min(intentMs, 1200));
    const skipImmediateAudioKick = !!(opts && opts.skipImmediateAudioKick);
    noteUserToggle("play");
    beginUserToggleTxn(true, txnMs);
    // Snapshot the pause-intent timestamp BEFORE we clear it below — the long-
    // pause VCFM re-arm check at line ~6685 needs the pre-clear value to decide
    // whether this play is resuming from a long pause. Without the snapshot,
    // the check below read the already-cleared 0 and never armed VCFM, which
    // combined with the tab-return-play path below to leave the compositor
    // holding a stale frame on "pause → tab out → return → play" ("frozen
    // video while YT status says playing" bug).
    const _pauseIntentPresetAtSnapshot = Number(state.userPauseIntentPresetAt) || 0;
    state.userPlayIntentPresetAt = now(); // reinforce preset
    state.userPauseIntentPresetAt = 0;    // clear opposite
    state.lastUserActionTime = now();
    // Reset freeze detector cooldown so it can act immediately after this play.
    // Without this, rapid play/pause leaves the compositor stuck because the
    // 1200ms cooldown from a previous kick blocks detection of new freezes.
    try { MakeVideoNotFreezeAfterPlaybackAfterAltTabHapenns.resetKickCooldown(); } catch {}
    // Keep micro-seek recovery out of the direct user play window. The old
    // 200ms guard was short enough that normal decoder warmup still triggered
    // a visible one-frame freeze/micro-seek cycle on play->pause->play.
    state._playPauseTransitionUntil = Math.max(
      state._playPauseTransitionUntil,
      now() + PLAY_PAUSE_MICRO_SEEK_BLOCK_MS
    );
    state.bgSuppressionSessionCount = 0;
    state.bgPauseSuppressionCount = 0;
    state.rapidPlayPauseCount = 0;
    state.rapidToggleDetected = false;
    state.rapidToggleUntil = 0;
    state.loopPreventionCooldownUntil = 0;
    // Clear any stale counter so loop detection doesn't trip from
    // leftover programmatic events before the user's explicit play.
    state.rapidPlayPauseResetAt = now();
    // clear the ended lock so user can restart playback. without this,
    // keyboard play (Space/K) after an ended video was blocked because
    // onUserPlay() never got called on the keyboard path.
    MakeSureUnintentionalLoopDoesntEverHappenAtALLManager.onUserPlay();
    DONTMAKEITDOUBLEPLAY.resetAll();
    clearAudioPauseLocks();
    // Cancel deferred audio pause from markUserPauseIntent — user hit play
    // before the 40ms timer fired, so audio should never stop.
    if (state._deferredAudioPauseTimer) {
      clearTimeout(state._deferredAudioPauseTimer);
      state._deferredAudioPauseTimer = null;
    }
    // Clear any active squelch so audio.play() can go through immediately
    state.audioEventsSquelchedUntil = 0;
    state.isProgrammaticAudioPause = false;
    // User clicked play — clear any stale mute flags from programmatic pause
    if (state.userMutedAudio && audio && !audio.muted) state.userMutedAudio = false;
    if (state.userMutedVideo && !getVideoMutedState()) state.userMutedVideo = false;
    MediumQualityManager.markUserPlayed();
    PlaybackStabilityManager.onUserAction();
    try { UltraStabilizer.onUserAction(); } catch {}
    const until = now() + intentMs;
    state.userPlayUntil = Math.max(state.userPlayUntil, until);
    state.userPauseUntil = 0;
    state.userPauseLockUntil = 0;
    clearMediaSessionForcedPause();
    state.intendedPlaying = true;
    state.bufferHoldIntendedPlaying = true;
    state.firstPlayCommitted = true;
    state.startupKickDone = true;
    state.startupPhase = false;
    state.playSessionId = (state.playSessionId || 0) + 1;
    state.startupPlaySettleUntil = now() + STARTUP_SETTLE_MS;
    clearStartupAutoplayRetryTimer();
    markMediaAction("play");
    setFastSync(1800);
    setMediaPlayTxn(Math.max(USER_MEDIA_PLAY_TXN_FAST_MS, Math.min(900, Math.floor(intentMs * 0.55))));
    state.videoPlayUntil = 0;
    state.videoPlayInFlight = null;
    clearTransitionDriftTimers();
    updateMediaSessionPlaybackState();
    // For long pauses (>5s), schedule a delayed VCFM arm AFTER the play transition
    // settles. This avoids micro-seeks during the play/pause transition that the
    // user perceives as "random seeks." The 400ms delay ensures play() has resolved
    // and the decoder has started producing frames before we check.
    // Uses the pre-clear snapshot captured above — the in-place
    // state.userPauseIntentPresetAt was zeroed earlier in this function, so
    // reading it here would always be 0 (stale-snapshot bug).
    if (_pauseIntentPresetAtSnapshot > 0 && (now() - _pauseIntentPresetAtSnapshot) > 5000) {
      setTimeout(() => {
        if (state.intendedPlaying && !getVideoPaused()) {
          try { VideoCompositorFlushManager.arm(); } catch {}
        }
      }, 400);
    }
    // TAB-RETURN-PLAY GUARD: When the user plays within ~5s of returning to a
    // backgrounded tab (classic "pause → tab out → return → press play"), the
    // GPU compositor is holding a stale frame and the audio decoder may briefly
    // drop readyState below 2 as playback resumes. Without this guard:
    //   1. onAudioWaiting fires, schedules a 300ms video pause (audioStallVideoPaused=true),
    //      because tabReturnImmuneUntil was never set for the pause-pre-tab-out path
    //      (SmoothTabWelcomeBackManagement.shouldResume() returned false when the user
    //      was paused), so the immunity gate doesn't suppress the pause.
    //   2. The compositor never gets kicked because VCFM armed on tab-return
    //      disarmed itself once it saw the video still paused 250ms later.
    // Result: video stays visually frozen on the stale tab-return frame while the
    // media element reports playing.
    // Fix: On user play within the post-tab-return window, re-establish immunity
    // + audio grace so onAudioWaiting doesn't fight us, and re-arm VCFM/PRFV so
    // the compositor gets flushed once real frames arrive.
    if (state.lastBgReturnAt > 0 && (now() - state.lastBgReturnAt) < 5000) {
      state.tabReturnImmuneUntil = Math.max(state.tabReturnImmuneUntil, now() + 1500);
      state.audioStartGraceUntil = Math.max(state.audioStartGraceUntil, now() + 900);
      try { VideoCompositorFlushManager.arm(); } catch {}
      try { PlayResumeFrameVerifier.arm(); } catch {}
    }
    state.audioPlayUntil = 0;
    state.startupAudioHoldUntil = 0;
    cancelActiveFade();
    // restore the saved pause position on play resume, so the browser's
    // keyframe-snap doesn't jump us forward visibly. play() can snap
    // currentTime to the nearest keyframe (0.5-2s offset is normal).
    // pre-seeking to the saved spot BEFORE play() forces the decoder
    // to resume from the exact pause point.
    // Remove forced seeking back to _pauseSavedPosition on user play, as it
    // triggers an explicit browser seek (buffering + visible pause) that manifests
    // as "seeks a bit" on play. The native browser keyframe resume is much smoother.
    if (state._pauseSavedPosition > 0 && (now() - state._pauseSavedAt) < 60000) {
      state._pauseSavedPosition = -1;
      state._pauseSavedAt = 0;
    }
    if (platform.chromiumOnlyBrowser) {
      state.chromiumPauseGuardUntil = 0;
      state.chromiumBgSettlingUntil = 0;
      state.chromiumAudioStartLockUntil = Math.max(state.chromiumAudioStartLockUntil, now() + 70);
    }
    // Kick video immediately on real foreground play intent instead of waiting for
    // playTogether/sync bookkeeping to get around to it. This removes the "late play"
    // feeling when another internal path is still in flight.
    if (document.visibilityState === "visible" &&
        !state.seeking && !state.seekBuffering && !state.restarting &&
        !mediaSessionForcedPauseActive() && !userPauseLockActive()) {
      startForegroundUserPlayRetry();
    }
    // Immediately kick audio — don't wait for the play event → playTogether chain.
    // The video.on("play") event fires asynchronously after Video.js processes the
    // click, adding 50-200ms of perceived delay. By starting audio here, it begins
    // at the same time as video. playTogether() will see audio already playing and
    // skip the audio section (no double-play).
    if (!skipImmediateAudioKick && coupledMode && audio && audio.paused && !shouldKeepForegroundReturnVideoFirst()) {
      const targetTime = getPreferredPlaybackSyncTarget({
        preferAudio: false,
        allowNearZero: !state.firstPlayCommitted
      });
      const currentAt = Number(audio.currentTime) || 0;
      const wouldRestartNearZero =
        targetTime < 0.5 &&
        currentAt > 0.9 &&
        state.firstPlayCommitted &&
        !nearZeroSeekAuthorized(targetTime) &&
        !state.restarting &&
        !isLoopDesired();
      // Sync audio to the best known playback position before playing.
      if (isFinite(targetTime) && !wouldRestartNearZero && Math.abs(currentAt - targetTime) > 0.8) {
        try { audio.currentTime = targetTime; } catch {}
      }
      try { if (audio.muted && !state.userMutedAudio) audio.muted = false; } catch {}
      try {
        const vol = targetVolFromVideo();
        // Always restore volume — instant pause zeroes it
        if (vol > 0 && audio.volume < vol * 0.95) audio.volume = vol;
      } catch {}
      try { audio.play().catch(() => {}); } catch {}
      state.audioEverStarted = true;
    }
  }
  function userPauseIntentActive() { return now() < state.userPauseUntil; }
  function userPauseLockActive() { return now() < state.userPauseLockUntil; }
  function userPlayIntentActive() { return now() < state.userPlayUntil; }
  function setHiddenMediaSessionPlay(ms = 5000) {
    if (!platform.chromiumOnlyBrowser) return;
    state.hiddenMediaPlayUntil = Math.max(state.hiddenMediaPlayUntil, now() + Math.max(0, Number(ms) || 0));
  }
  function hiddenMediaSessionPlayActive() { return platform.chromiumOnlyBrowser && now() < state.hiddenMediaPlayUntil; }
  function clearHiddenMediaSessionPlay() { state.hiddenMediaPlayUntil = 0; }
  function hiddenPlayPendingActive() { return now() < state.hiddenPlayRequestUntil; }
  function foregroundResumeBoostActive() { return now() < state.foregroundResumeBoostUntil; }
  function armHiddenPlayPending(ms = 45000) {
    const dur = Math.max(1000, Number(ms) || 0);
    const until = now() + dur;
    state.hiddenPlayRequestUntil = Math.max(state.hiddenPlayRequestUntil, until);
    state.foregroundResumeBoostUntil = Math.max(state.foregroundResumeBoostUntil, now() + Math.min(dur, 12000));
    state.mediaSessionInitiatedPlay = true;
    state.resumeOnVisible = true;
    state.bgHiddenWasPlaying = true;
    setHiddenMediaSessionPlay(Math.max(5000, Math.min(dur, 30000)));
    if (platform.useBgControllerRetry) noteBackgroundEntry();
  }
  function clearHiddenPlayPending() {
    state.hiddenPlayRequestUntil = 0;
    state.foregroundResumeBoostUntil = 0;
    state.mediaSessionInitiatedPlay = false;
    clearHiddenMediaSessionPlay();
  }
  function hasPlaybackProgressFromBackground(minDelta = 0.05) {
    if (!state.bgHiddenSince) return true;
    const bgAge = now() - Number(state.bgHiddenSince || 0);
    if (bgAge < 350) return true;
    const vt = (() => { try { return Number(video.currentTime()) || 0; } catch { return 0; } })();
    const baseVt = Number(state.bgHiddenBaseVT || 0);
    const vMoved = Math.abs(vt - baseVt);
    if (!coupledMode || !audio) return vMoved > minDelta;
    const at = Number(audio.currentTime) || 0;
    const baseAt = Number(state.bgHiddenBaseAT || 0);
    const aMoved = Math.abs(at - baseAt);
    return vMoved > minDelta || aMoved > minDelta;
  }
  function playbackHealthyForReturn() {
    if (document.visibilityState !== "visible" || !isWindowFocused()) return false;
    if (getVideoPaused()) return false;
    const vrs = getVideoReadyState();
    if (vrs < HAVE_CURRENT_DATA) return false;
    if (freshForegroundVideoProgressPending(0.08)) return false;
    if (coupledMode && audio) {
      if (audio.paused) return false;
      const ars = Number(audio.readyState || 0);
      if (ars < HAVE_CURRENT_DATA && vrs < HAVE_FUTURE_DATA) return false;
    }
    if (!hasPlaybackProgressFromBackground(0.05) &&
      (state.resumeOnVisible || state.bgHiddenWasPlaying || state.intendedPlaying || hiddenPlayPendingActive())) {
      return false;
    }
    return true;
  }
  function foregroundRecoveryActive(tailMs = 0) {
    const t = now();
    const tail = Math.max(0, Number(tailMs) || 0);
    return (
      isTabReturnImmune() ||
      inBgReturnGrace() ||
      foregroundResumeBoostActive() ||
      hiddenPlayPendingActive() ||
      hiddenMediaSessionPlayActive() ||
      state.mediaSessionInitiatedPlay ||
      state.resumeOnVisible ||
      state.bgHiddenWasPlaying ||
      state.bgResumeInFlight ||
      state.wakeupTimer != null ||
      state.bbtabRetryTimer != null ||
      state.bbtabRetryRafId != null ||
      state.bbtabAudioSyncTimer != null ||
      state.lastBgReturnAt > 0 && (t - state.lastBgReturnAt) < (800 + tail)
    );
  }
  function shouldForceForegroundResume() {
    if (document.visibilityState !== "visible" || !isWindowFocused()) return false;
    if (state.endedNaturally) return false;
    if (MakeSureUnintentionalLoopDoesntEverHappenAtALLManager.shouldBlockAutoRestart()) return false;
    if (userPauseLockActive() || mediaSessionForcedPauseActive() || userWantsPauseNow(2400)) return false;
    const pendingHiddenPlay =
      hiddenPlayPendingActive() ||
      foregroundResumeBoostActive() ||
      hiddenMediaSessionPlayActive() ||
      state.mediaSessionInitiatedPlay;
    if (!pendingHiddenPlay) return false;
    return state.intendedPlaying || state.resumeOnVisible || state.bgHiddenWasPlaying;
  }
  function forceForegroundResumeNow(reason = "foreground-resume") {
    if (!shouldForceForegroundResume()) return false;
    if (!state.intendedPlaying && (state.resumeOnVisible || state.bgHiddenWasPlaying)) {
      state.intendedPlaying = true;
      state.bufferHoldIntendedPlaying = true;
    }
    if (!state.intendedPlaying) return false;

    state.foregroundResumeBoostUntil = Math.max(state.foregroundResumeBoostUntil, now() + 2600);
    state.hiddenPlayRequestUntil = Math.max(state.hiddenPlayRequestUntil, now() + 1200);
    state.resumeOnVisible = false;
    state.bgHiddenWasPlaying = false;
    state.tabReturnImmuneUntil = Math.max(state.tabReturnImmuneUntil, now() + 2200);
    // Only clear stall flags if video has data — protect against audio-during-buffering
    const _ffrVNode = getVideoNode();
    const _ffrRS = _ffrVNode ? Number(_ffrVNode.readyState || 0) : 0;
    if (_ffrRS >= HAVE_FUTURE_DATA) {
      state.videoWaiting = false;
      state.videoStallAudioPaused = false;
      state.stallAudioPausedSince = 0;
      state.stallAudioResumeHoldUntil = 0;
      state.videoStallSince = 0;
    }
    state.audioPlayInFlight = null;
    state.audioPlayUntil = 0;
    state.audioPauseUntil = 0;
    state.startupAudioHoldUntil = 0;
    clearAudioPauseLocks();
    cancelActiveFade();
    setPauseEventGuard(1800);
    setMediaPlayTxn(1800);
    updateMediaSessionPlaybackState();
    try { engagePauseIntercept(); } catch {}
    try { BringBackToTabManager.onTabReturn(); } catch {}
    try { if (typeof DONTMAKEITDOUBLEPLAY !== "undefined") DONTMAKEITDOUBLEPLAY.resetAll(); } catch {}
    try { if (typeof VisibilityGuard !== "undefined") VisibilityGuard.onPlayCalled(); } catch {}
    try {
      const vn = getVideoNode();
      if (vn && vn.paused && typeof vn.play === "function") vn.play().catch(() => {});
    } catch {}
    if (coupledMode && audio) {
      const vt = (() => { try { return Number(video.currentTime()) || 0; } catch { return 0; } })();
      const at = Number(audio.currentTime) || 0;
      if (isFinite(vt) && isFinite(at) && Math.abs(at - vt) > 0.35) {
        safeSetAudioTime(vt);
      }
      try { audio.volume = targetVolFromVideo(); } catch {}
      if (audio.paused && !state.isProgrammaticAudioPause) {
        state.audioStartGraceUntil = Math.max(state.audioStartGraceUntil, now() + 500);
        execProgrammaticAudioPlay({ squelchMs: 0, force: true, minGapMs: 0 }).catch(() => {});
      }
    }
    setFastSync(2200);
    scheduleSync(0);
    try { startBringBackRetry(); } catch {}
    try { executeSeamlessWakeup(); } catch {}
    return true;
  }
  function finalizeForegroundReturnRecovery() {
    if (!playbackHealthyForReturn()) return false;
    state.resumeOnVisible = false;
    state.bgHiddenWasPlaying = false;
    // Only clear stall flags if video has enough data for smooth playback
    const _ffrrVNode = getVideoNode();
    const _ffrrRS = _ffrrVNode ? Number(_ffrrVNode.readyState || 0) : 0;
    if (_ffrrRS >= HAVE_FUTURE_DATA) {
      state.videoWaiting = false;
      state.videoStallAudioPaused = false;
      state.stallAudioPausedSince = 0;
      state.stallAudioResumeHoldUntil = 0;
      state.videoStallSince = 0;
      clearBufferHold();
    }
    clearAudioPauseLocks();
    clearHiddenPlayPending();
    clearTrackedWakeupRetryTimers();
    try { SmoothTabWelcomeBackManagement.clearTimers(); } catch {}
    try { BringBackToTabManager.onVideoConfirmedPlaying(); } catch {}
    return true;
  }
  function chromiumPauseGuardActive() { return platform.chromiumOnlyBrowser && now() < state.chromiumPauseGuardUntil; }
  function chromiumAudioStartLocked() {
    // Don't lock audio start during first play — it causes late audio at startup.
    // The lock is only needed to prevent spurious autoplay on background tabs AFTER
    // the first play has already committed.
    if (!state.audioEverStarted) return false;
    return platform.chromiumOnlyBrowser && now() < state.chromiumAudioStartLockUntil;
  }
  function chromiumBgSettlingActive() { return platform.chromiumOnlyBrowser && now() < state.chromiumBgSettlingUntil; }
  function chromiumBgPauseBlocked() {
    if (!platform.chromiumOnlyBrowser) return false;
    if (state.startupPhase && !state.firstPlayCommitted) return false;
    return now() < state.chromiumBgPauseBlockedUntil ||
    now() < state.chromiumBgPauseBlockedUntilExtended ||
    now() < state.chromiumAutoPauseBlockedUntil;
  }
  function setChromiumBgPauseBlock(ms = CHROMIUM_BG_PAUSE_BLOCK_MS) {
    if (!platform.chromiumOnlyBrowser) return;
    state.chromiumBgPauseBlockedUntil = Math.max(state.chromiumBgPauseBlockedUntil, now() + ms);
    state.chromiumBgPauseBlockedUntilExtended = Math.max(state.chromiumBgPauseBlockedUntilExtended, now() + (ms * 1.5));
  }
  function setChromiumAutoPauseBlock(ms = 8000) {
    if (!platform.chromiumOnlyBrowser) return;
    state.chromiumAutoPauseBlockedUntil = Math.max(state.chromiumAutoPauseBlockedUntil, now() + ms);
  }
  function setChromiumPauseEventSuppress(ms = CHROMIUM_PAUSE_EVENT_SUPPRESS_MS) {
    if (!platform.chromiumOnlyBrowser) return;
    state.chromiumPauseEventSuppressedUntil = Math.max(state.chromiumPauseEventSuppressedUntil, now() + ms);
  }
  function chromiumPauseEventSuppressed() { return platform.chromiumOnlyBrowser && now() < state.chromiumPauseEventSuppressedUntil; }

  // Was comparing `now() > state.pauseEventResetAt` which is nearly always true since it starts at 0
  function trackPauseEvent() {
    state.lastPauseEventTs = now();
    if ((now() - state.pauseEventResetAt) > PAUSE_EVENT_RESET_MS) {
      state.pauseEventCount = 0;
      state.pauseEventResetAt = now();
    }
    state.pauseEventCount++;
    if (state.pauseEventCount >= MAX_PAUSE_EVENTS_BEFORE_BLOCK) {
      setChromiumPauseEventSuppress(CHROMIUM_PAUSE_EVENT_SUPPRESS_MS);
      state.pauseEventCount = 0;
      state.pauseEventResetAt = now();
    }
  }
  function shouldBlockPauseEvent() {
    if (chromiumPauseEventSuppressed()) return true;
    if (state.pauseEventCount >= MAX_PAUSE_EVENTS_BEFORE_BLOCK) return true;
    return false;
  }
  function setStartupAudioHold(ms = 100) {
    state.startupAudioHoldUntil = Math.max(state.startupAudioHoldUntil, now() + Math.max(0, Number(ms) || 0));
  }
  function startupAudioHoldActive() { return now() < state.startupAudioHoldUntil; }
  function squelchAudioEvents(ms = 450) {
    state.audioEventsSquelchedUntil = now() + Math.max(0, Number(ms) || 0);
  }
  function audioEventsSquelched() { return now() < state.audioEventsSquelchedUntil; }
  function isVisibilityTransitionActive() {
    return state.visibilityTransitionActive ||
    now() < state.visibilityTransitionUntil ||
    state.altTabTransitionActive ||
    now() < state.altTabTransitionUntil;
  }
  function isAltTabTransitionActive() { return state.altTabTransitionActive || now() < state.altTabTransitionUntil; }
  function isVisibilityStable() { return now() >= state.visibilityStableUntil; }
  function isFocusStable() { return now() >= state.focusStableUntil; }
  function shouldTreatVisiblePauseAsUserPause() {
    return document.visibilityState === "visible" && userWantsPauseNow(2400);
  }

  function startupSettleActive() {
    if (state.startupPlaySettled) return false;
    if (state.userGesturePauseIntent) return false;
    return now() < state.startupPlaySettleUntil;
  }

  function incrementRapidPlayPause() {
    if (state.seeking || state.seekBuffering) return;
    if (state.seekResumeInFlight || state.bgResumeInFlight) return;
    // Don't count during seek stabilization — post-seek play/pause events are expected
    if (state.seekStabilizeUntil && now() < state.seekStabilizeUntil) return;
    if (state.seekCooldownUntil && now() < state.seekCooldownUntil) return;
    if (state.tabReturnImmuneUntil > now()) return;
    if (inBgReturnGrace() || document.visibilityState === "hidden" || !isWindowFocused()) return;
    if (!state.firstPlayCommitted) return;
    // Don't count during startup settle — internal play-pause is normal during init
    if (startupSettleActive()) return;
    const nowTs = now();
    if ((nowTs - state.rapidPlayPauseResetAt) > RAPID_PLAY_PAUSE_WINDOW_MS) {
      state.rapidPlayPauseCount = 0;
      state.rapidPlayPauseResetAt = nowTs;
    }
    state.rapidPlayPauseCount++;
  }

  // detectLoop no longer fires during seek/sync operations to prevent false positives
  function detectLoop() {
    if (state.seeking || state.syncing || state.restarting || state.seekBuffering) return false;
    if (state.seekResumeInFlight || state.bgResumeInFlight) return false;
    // Don't fire during seek stabilization — post-seek play/pause events are expected
    if (state.seekStabilizeUntil && now() < state.seekStabilizeUntil) return false;
    if (state.seekCooldownUntil && now() < state.seekCooldownUntil) return false;
    if (!state.firstPlayCommitted) return false;
    if (inBgReturnGrace()) return false;
    if (document.visibilityState === "hidden" || !isWindowFocused()) return false;
    // Never fire during tab-return or startup immunity
    if (state.tabReturnImmuneUntil > now()) return false;
    // user-action bypass has to come before the cooldown check. if it
    // doesn't, once the cooldown fires the user is locked out of play/pause
    // for the whole period — the "can't play" bug.
    if ((now() - state.lastUserActionTime) < 2500) return false;
    if (userWantsPlayNow(2000) || userWantsPauseNow(2000)) return false;
    if (directUserToggleActive(2000)) return false;
    if (now() < state.loopPreventionCooldownUntil) return true;
    if (state.rapidPlayPauseCount >= MAX_LOOP_EVENTS) {
      state.loopPreventionCooldownUntil = now() + LOOP_COOLDOWN_MS;
      return true;
    }
    return false;
  }

  // =========================================================================
  // MakeSureUnintentionalLoopDoesntEverHappenAtALLManager
  // =========================================================================
  // Catches ALL scenarios where the video restarts from the beginning when it
  // shouldn't — browser-native loop, phantom seeks to 0, ended→play races,
  // sync machinery accidentally restarting, etc. This is the final safety net.
  const MakeSureUnintentionalLoopDoesntEverHappenAtALLManager = (() => {
    function onEnded() {
      state.endedNaturally = true;
      state.endedAt = now();
      state.intendedPlaying = false;
      state.bufferHoldIntendedPlaying = false;
      state.resumeOnVisible = false;
      state.bgHiddenWasPlaying = false;
      // strip autoplay off video.js AND the DOM attribute so nothing
      // auto-restarts after ended. both the video.js config and the
      // <video autoplay> attr will re-call play() on their own, even
      // with loop=false.
      stripAutoplayAfterFirstPlay();
    }

    // call this before any auto-play/resume to see if it should be blocked.
    // does NOT auto-expire — only onUserPlay() clears it.
    // old version cleared endedNaturally after 8s, which let stale play()
    // calls from 25+ other code paths restart the video. that was the
    // root cause of the loop.
    function shouldBlockAutoRestart() {
      return !!state.endedNaturally;
    }

    // User explicitly clicks play → clear the ended lock
    function onUserPlay() {
      const recentlyEnded = state.endedNaturally || (state.endedAt > 0 && (now() - state.endedAt) < 15000);
      state.endedNaturally = false;
      state.endedAt = 0;
      state.endedLockUntil = 0;
      if (recentlyEnded) {
        state.restartFromEndedUntil = Math.max(state.restartFromEndedUntil, now() + 2600);
        state.audioStartGraceUntil = Math.max(state.audioStartGraceUntil, now() + 500);
        state.userPauseIntentPresetAt = 0;
        clearMediaSessionForcedPause();
      }
    }

    // Checks if video is at/near 0 and nobody asked for it (phantom restart)
    // Rate-limited: max 2 reverts per 10 seconds. If detection keeps triggering,
    // it's a false positive — let the seek through instead of looping.
    let _phantomRevertCount = 0;
    let _phantomRevertWindowStart = 0;
    function isPhantomRestart(videoTime) {
      if (!state.firstPlayCommitted) return false;
      if (state.restarting || state.seeking) return false;
      if (isLoopDesired()) return false;
      if (videoTime > 2.0) return false;

      // Rate limiter: if we've already reverted 2+ times in the last 10s,
      // stop reverting. The detection is wrong — let the seek through.
      const _prNow = now();
      if (_phantomRevertWindowStart && (_prNow - _phantomRevertWindowStart) > 10000) {
        _phantomRevertCount = 0;
        _phantomRevertWindowStart = 0;
      }
      if (_phantomRevertCount >= 2) return false;

      // video is near 0 after we were well into playback
      if (state.endedNaturally) {
        if (!_phantomRevertWindowStart) _phantomRevertWindowStart = _prNow;
        _phantomRevertCount++;
        return true;
      }
      const lastGood = state.lastKnownGoodVT || 0;
      if (!nearZeroSeekAuthorized(videoTime) && lastGood > 0.9 && videoTime < 0.8) {
        // big backward jump nobody asked for
        const userRecent = (_prNow - state.lastUserActionTime) < 1500;
        const userPlay = state.userPlayIntentPresetAt > 0 && (_prNow - state.userPlayIntentPresetAt) < 2000;
        const programmatic = state.pendingSeekTarget != null;
        if (!userRecent && !userPlay && !programmatic) {
          if (!_phantomRevertWindowStart) _phantomRevertWindowStart = _prNow;
          _phantomRevertCount++;
          return true;
        }
      }
      return false;
    }

    // Periodic tick — if video somehow restarted, kill it.
    // endedNaturally persists until user explicitly clears it via onUserPlay().
    function tick() {
      if (!state.endedNaturally) return;
      const vn = getVideoNode();
      if (!vn) return;
      const vt = Number(vn.currentTime) || 0;
      // video is playing from near 0 after it ended — kill it
      if (vt < 5.0 && !vn.paused && !state.restarting && !isLoopDesired()) {
        try { vn.pause(); } catch {}
        if (coupledMode && audio && !audio.paused) {
          try { audio.pause(); } catch {}
        }
        state.intendedPlaying = false;
        state.bufferHoldIntendedPlaying = false;
        state.resumeOnVisible = false;
      }
    }

    return { onEnded, shouldBlockAutoRestart, onUserPlay, isPhantomRestart, tick };
  })();

  function shouldIgnorePauseAsTransient() {
    if (mediaSessionForcedPauseActive()) return false;
    if (userWantsPauseNow(2400)) return false;
    if (detectLoop()) return true;
    if (inBgReturnGrace()) return true;
    if (foregroundRecoveryActive(300)) return true;

    if (
      document.visibilityState === "visible" &&
      isWindowFocused() &&
      isVisibilityStable() &&
      isFocusStable() &&
      !state.isProgrammaticVideoPause &&
      !state.isProgrammaticAudioPause &&
      !state.seeking &&
      !state.syncing &&
      !inBgReturnGrace() &&
      now() >= state.tabVisibilityChangeUntil
    ) {
      return false;
    }

    if (startupSettleActive()) return true;
    if (document.visibilityState === "hidden") return true;
    if (!isWindowFocused()) return true;
    if (isVisibilityTransitionActive()) return true;
    if (isAltTabTransitionActive()) return true;
    if (!isVisibilityStable()) return true;
    if (!isFocusStable()) return true;
    if (now() < state.tabVisibilityChangeUntil) return true;
    if (shouldBlockPauseEvent()) return true;
    if (chromiumPauseEventSuppressed()) return true;
    if (platform.chromiumOnlyBrowser && chromiumBgPauseBlocked()) return true;
    if (fastSyncActive()) return true;
    if (state.isProgrammaticVideoPlay || state.isProgrammaticAudioPlay) return true;
    if (now() < state.audioPlayUntil) return true;
    if (mediaActionRecently("play", 260)) return true;
    if (state.rapidToggleDetected && now() < state.rapidToggleUntil) return true;
    if (inMediaTxnWindow()) return true;
    if (mediaActionRecently("play", 2200)) return true;
    if (shouldIgnorePauseEvents()) return true;
    if (platform.chromiumOnlyBrowser) {
      // Was comparing `now() > state.bgPauseSuppressionResetAt` which is nearly always true
      if ((now() - state.bgPauseSuppressionResetAt) > 10000) {
        state.bgPauseSuppressionCount = 0;
        state.bgPauseSuppressionResetAt = now();
      }
      state.bgPauseSuppressionCount++;
      if (state.bgPauseSuppressionCount <= MAX_BG_PAUSE_SUPPRESSIONS) return true;
    }
    return false;
  }

  function enforceAudioPlayback(force = false) {
    if (!coupledMode || !audio) return;
    if (!state.intendedPlaying) return;
    if (MakeSureUnintentionalLoopDoesntEverHappenAtALLManager.shouldBlockAutoRestart()) return;
    if (userPauseLockActive() || mediaSessionForcedPauseActive()) return;
    if (state.seeking || state.restarting || state.syncing) return;
    // only block if video is actually starved (check readyState, not just flags)
    const _enfVNode = getVideoNode();
    const _enfRS = _enfVNode ? Number(_enfVNode.readyState || 0) : 4;
    if ((state.videoWaiting || state.videoStallAudioPaused) && _enfRS < HAVE_FUTURE_DATA) return;
    // video has data, stall flags are stale
    if (_enfRS >= HAVE_FUTURE_DATA && (state.videoWaiting || state.videoStallAudioPaused)) {
      state.videoWaiting = false;
      state.videoStallAudioPaused = false;
      state.stallAudioPausedSince = 0;
      state.stallAudioResumeHoldUntil = 0;
      state.videoStallSince = 0;
    }
    const vPaused = getVideoPaused();
    const aPaused = !!audio.paused;
    if (!vPaused && !aPaused) { state.audioPausedSince = 0; return; }
    if (!vPaused && aPaused) {
      if (!state.audioPausedSince) state.audioPausedSince = now();
      const stuckMs = now() - state.audioPausedSince;
      const hardBypass = force || stuckMs > AUDIO_STUCK_HARD_MS;
      // Reduced from 2500ms → 1000ms: audio stuck for 1s with video playing
      // is already audible. React faster to avoid silent-video segments.
      const softBypass = stuckMs > Math.min(AUDIO_STUCK_RESTART_MS, 1000);
      if (!hardBypass && !softBypass) return;
      if (!hardBypass && state.strictBufferHold) return;
      if (!hardBypass && state.videoWaiting) return;
      const vtNow = Number(video.currentTime()) || 0;
      const vNode = getVideoNode();
      const bufAhead = bufferedAhead(vNode, vtNow);
      const vRS = Number(vNode.readyState || 0);
      const visibleForeground =
        document.visibilityState === "visible" &&
        isWindowFocused();
      if (visibleForeground && !videoReadyForAudioResume(vtNow)) return;
      if (!hardBypass && bufAhead < 0.5) return; // require 0.5s buffer ahead
      if (!hardBypass && vRS < MIN_STALL_VIDEO_RS) return;
      state.isProgrammaticAudioPause = false;
      state.videoStallAudioPaused = false;
      state.stallAudioResumeHoldUntil = 0;
      state.audioPauseUntil = 0;
      state.stallAudioPausedSince = 0;
      if (hardBypass) state.audioEventsSquelchedUntil = 0;
      safeSetAudioTime(vtNow);
      // Set target volume immediately — video has been playing for 1s+, no fade needed
      try { audio.volume = targetVolFromVideo(); } catch {}
      execProgrammaticAudioPlay({ squelchMs: 200, force: true, minGapMs: 0 })
      .then(ok => {
        if (ok) {
          state.audioPausedSince = 0;
          // Ensure volume is correct after play resolves
          updateAudioGainImmediate(true);
        } else if (hardBypass && !getVideoPaused() && state.intendedPlaying) {
          // Audio can't start even with hard bypass — pause video to
          // maintain A/V contract. armResumeAfterBuffer restarts both.
          execProgrammaticVideoPause();
          armResumeAfterBuffer(6000);
        }
      })
      .catch(() => {});
    }
  }


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
  let activeVolumeFade = null;
  function cancelActiveFade(clearFadingFlag = true) {
    if (activeVolumeFade) {
      cancelAnimationFrame(activeVolumeFade);
      activeVolumeFade = null;
    }
    if (clearFadingFlag) state.audioFading = false;
  }

  function fadeAndPauseAudio(fadeMs, onDone) {
    if (!audio) { if (onDone) onDone(); return; }
    if (audio.paused || audio.volume < 0.015) {
      try { if (!audio.paused) audio.pause(); } catch {}
      if (onDone) onDone();
      return;
    }
    cancelActiveFade();
    const duration = Math.max(10, Number(fadeMs) || AUDIO_FADE_DURATION_MS);
    // CPU optimization: for very short fades, skip rAF loop — just set directly
    if (duration <= 20) {
      try { audio.volume = 0; audio.pause(); } catch {}
      if (onDone) onDone();
      return;
    }
    const startVol = clamp01(audio.volume);
    const startTs = performance.now();
    const step = () => {
      const rawT = Math.min(1, (performance.now() - startTs) / duration);
      const easeT = 0.5 * (1 - Math.cos(Math.PI * rawT));
      try { audio.volume = Math.max(0, startVol * (1 - easeT)); } catch {}
      if (rawT < 1) {
        activeVolumeFade = requestAnimationFrame(step);
      } else {
        activeVolumeFade = null;
        try { audio.volume = 0; audio.pause(); } catch {}
        if (onDone) onDone();
      }
    };
    activeVolumeFade = requestAnimationFrame(step);
  }

  async function doVolumeFade(targetVol, ms = AUDIO_SAFE_FADE_DURATION_MS) {
    if (!audio) return;
    cancelActiveFade(false); // cancel previous animation but keep audioFading=true
    const from = clamp01(audio.volume);
    const target = clamp01(targetVol);
    if (document.visibilityState === "hidden" || ms <= 0 || Math.abs(target - from) < 0.001 || audio.paused) {
      try { audio.volume = target; } catch {}
      return;
    }
    const start = now();
    state.audioFading = true;
    return new Promise(resolve => {
      const step = () => {
        if (audio.paused) {
          try { audio.volume = target; } catch {}
          activeVolumeFade = null;
          state.audioFading = false;
          state.audioFadeCompleteUntil = now() + AUDIO_POP_PREVENT_MS;
          resolve();
          return;
        }
        const rawT = Math.min(1, (now() - start) / ms);
        const easeT = 0.5 * (1 - Math.cos(Math.PI * rawT));
        const val = from + (target - from) * easeT;
        try { audio.volume = clamp01(val); } catch {}
        if (rawT < 1) {
          activeVolumeFade = requestAnimationFrame(step);
        } else {
          activeVolumeFade = null;
          state.audioFading = false;
          state.audioFadeCompleteUntil = now() + AUDIO_POP_PREVENT_MS;
          resolve();
        }
      };
      activeVolumeFade = requestAnimationFrame(step);
    });
  }

  async function softUnmuteAudio(ms = AUDIO_SAFE_FADE_DURATION_MS) {
    if (!audio) return;
    const target = targetVolFromVideo();
    if (Math.abs(clamp01(audio.volume) - target) < 0.02 && !state.audioFading) return;
    state.audioFading = true;
    try { await doVolumeFade(target, ms); } catch {}
    state.audioFading = false;
  }

  async function fadeAudioOut(ms = AUDIO_SAFE_FADE_DURATION_MS) {
    if (!audio) return;
    state.audioFading = true;
    state.audioVolumeBeforePause = clamp01(audio.volume);
    try { await doVolumeFade(0, ms); } catch {}
    state.audioFading = false;
    state.audioFadeCompleteUntil = now() + AUDIO_POP_PREVENT_MS;
  }

  async function fadeAudioIn(ms = AUDIO_SAFE_FADE_DURATION_MS) {
    if (!audio) return;
    state.audioFading = true;
    await doVolumeFade(targetVolFromVideo(), ms);
    state.audioFading = false;
    state.audioFadeCompleteUntil = now() + AUDIO_POP_PREVENT_MS;
  }

  let _updatingGain = false;
  function updateAudioGainImmediate(force) {
    if (!audio || _updatingGain) return;
    if (!force && state.audioFading) return;
    if (!force && NotMakePlayBackFixingNoticable.isActive()) return;
    _updatingGain = true;
    try {
      const target = clamp01(targetVolFromVideo());
      if (Math.abs(audio.volume - target) < 0.01) { _updatingGain = false; return; }
      if (!force && inBgReturnGrace() && audio.volume < target - 0.05) {
        audio.volume = clamp01(audio.volume + Math.min(target - audio.volume, 0.12));
      } else {
        audio.volume = target;
      }
    } catch {}
    _updatingGain = false;
  }

  function forceUnmuteForPlaybackIfAllowed() {
    if (!state.intendedPlaying) return;
    // Clear stale programmatic mute flags before checking
    if (state.userMutedVideo && !getVideoMutedState()) state.userMutedVideo = false;
    if (state.userMutedAudio && audio && !audio.muted) state.userMutedAudio = false;
    try { if (!state.userMutedVideo && getVideoMutedState()) setVideoMutedState(false); } catch {}
    try { if (audio && !state.userMutedAudio && audio.muted) audio.muted = false; } catch {}
  }

  function checkRapidPlayPause() {
    // NOTE: This function is called from audio play path.
    if (state.userClickSpamActive && now() < state.userClickSpamUntil) {
      return true;
    }
    state.userClickSpamActive = false;
    return false;
  }

  // Track a deliberate user play/pause click for spam detection.
  // Call this from onPressStart / onKeyDown (NOT from event handlers for background events).
  function trackUserClickForSpam() {
    const nowTs = now();
    if ((nowTs - state.userClickSpamWindowStart) > USER_SPAM_CLICK_WINDOW_MS) {
      state.userClickSpamCount = 0;
      state.userClickSpamWindowStart = nowTs;
    }
    state.userClickSpamCount++;
    if (state.userClickSpamCount >= USER_SPAM_CLICK_THRESHOLD) {
      state.userClickSpamActive = true;
      state.userClickSpamUntil = nowTs + USER_SPAM_ACTIVE_MS;
      state.userClickSpamCount = 0;
      state.userClickSpamWindowStart = nowTs;
      return true;
    }
    return false;
  }

  // --- play/pause toggle debounce (YouTube-style spam protection)
  // When user spams the play/pause button, we don't immediately execute
  // every toggle. Instead: each click cancels the pending action and starts
  // a short timer. Only the LAST click in a rapid burst actually executes.
  // This prevents state thrashing, audio pops, and glitchy play-pause loops.
  let _toggleDebounceTimer = null;
  let _toggleDebounceCount = 0;
  let _toggleDebounceWindowStart = 0;
  const TOGGLE_DEBOUNCE_WINDOW_MS = 1000; // 1-second window
  const TOGGLE_DEBOUNCE_THRESHOLD = 30;   // 30+ clicks in 1s = extreme spam only
  const TOGGLE_DEBOUNCE_DELAY_MS = 200;   // wait 200ms for spam to settle

  function isToggleSpamming() {
    const elapsed = now() - _toggleDebounceWindowStart;
    if (elapsed > TOGGLE_DEBOUNCE_WINDOW_MS) {
      _toggleDebounceCount = 0;
      _toggleDebounceWindowStart = now();
    }
    return _toggleDebounceCount >= TOGGLE_DEBOUNCE_THRESHOLD;
  }

  function trackToggleClick() {
    const elapsed = now() - _toggleDebounceWindowStart;
    if (elapsed > TOGGLE_DEBOUNCE_WINDOW_MS) {
      _toggleDebounceCount = 0;
      _toggleDebounceWindowStart = now();
    }
    _toggleDebounceCount++;
  }

  // Debounced toggle: schedules the actual play or pause to run after a
  // short delay. If the user clicks again before the delay expires, the
  // previous pending action is cancelled and replaced with the new one.
  // wantPlay: true = play, false = pause
  // immediate: if true, skip debounce (used for first/second click)
  function debouncedToggle(wantPlay, immediate) {
    if (_toggleDebounceTimer) {
      clearTimeout(_toggleDebounceTimer);
      _toggleDebounceTimer = null;
    }

    const doAction = () => {
      _toggleDebounceTimer = null;
      if (wantPlay) {
        // Reset audio state that may have been trashed by rapid pause/play spam.
        // Without this, audio can get stuck muted or paused after spam settles.
        state.isProgrammaticAudioPause = false;
        state.audioPlayGeneration++;
        state.audioPausedSince = 0;
        state.audioPauseUntil = 0;
        state.videoStallAudioPaused = false;
        state.stallAudioPausedSince = 0;
        cancelActiveFade();
        markUserPlayIntent(USER_PLAY_INTENT_FAST_MS);
        playTogether().catch(() => {});
        // Belt: after a short settle, force audio to play if video is playing
        if (coupledMode && audio) {
          setTimeout(() => {
            if (!state.intendedPlaying) return;
            if (!getVideoPaused() && audio.paused) {
              const vt = Number(video.currentTime()) || 0;
              if (isFinite(vt)) safeSetAudioTime(vt);
              audio.play().catch(() => {});
            }
            // Restore volume in case it's stuck at 0
            const tv = targetVolFromVideo();
            if (audio.volume < tv - 0.05) {
              softUnmuteAudio(80).catch(() => {});
            }
          }, 150);
        }
      } else {
        markUserPauseIntent(USER_PAUSE_INTENT_FAST_MS);
        clearPendingPlayResumesForPause();
        pauseTogether();
      }
    };

    if (immediate) {
      doAction();
    } else {
      _toggleDebounceTimer = setTimeout(doAction, TOGGLE_DEBOUNCE_DELAY_MS);
    }
  }

  function checkAudioPlayAttempt() {
    const nowTs = now();
    if ((nowTs - state.audioPlayAttemptResetAt) > AUDIO_PLAY_ATTEMPT_RESET_MS) {
      state.audioPlayAttemptCount = 0;
      state.audioPlayAttemptResetAt = nowTs;
    }
    state.audioPlayAttemptCount++;
    if (state.audioPlayAttemptCount >= MAX_AUDIO_PLAY_ATTEMPTS) {
      return false;
    }
    return true;
  }

  function safeSetCT(media, t) {
    try {
      if (media && isFinite(t) && t >= 0) media.currentTime = t;
    } catch {}
  }

  // Global micro-seek rate limiter. Prevents multiple systems from piling up
  // micro-seeks (VCFM, heartbeat freeze detector, sync loop tab-return kick,
  // tab-return compositor flush) which the user perceives as "random seeks."
  // Returns true if a micro-seek is allowed right now. Minimum 500ms between
  // micro-seeks, max 3 per 5 seconds in foreground playback.
  const MICRO_SEEK_MIN_GAP_MS = 400; // was 800 — reduced so compositor-fix systems (VCFM, PRFV, NFW, MVNFAPAAT, playTogether kick) don't exhaust the budget competing with each other
  const COMPOSITOR_FLUSH_MIN_GAP_MS = 80; // lighter rate limit for confirmed compositor flushes (was 100 — even faster for play/pause freeze recovery)
  const MICRO_SEEK_WINDOW_MS = 5000;
  const MICRO_SEEK_MAX_IN_WINDOW = 4; // was 2 — 5 compositor-fix systems share this budget, 2 was too small
  function canDoMicroSeek() {
    const t = now();
    // no micro-seeks during a play/pause transition — user sees them as
    // "random seeks" and they can flash wrong keyframes.
    if (t < state._playPauseTransitionUntil) return false;
    // Also stay out of the broader direct user toggle window. Recovery systems
    // competing with a deliberate click/keypress are the main source of the
    // audible/visible play-pause-play artifacts.
    if (userToggleTxnActive() || directUserToggleActive(MICRO_SEEK_TOGGLE_SUPPRESS_MS)) return false;
    // Explicit seeks own the timeline for a short settle window; micro-seeks in
    // that period move the target away from where the user just asked to go.
    if (
      userSeekIntentActive() ||
      state.pendingSeekTarget != null ||
      state.seeking ||
      state.seekBuffering ||
      state.seekResumeInFlight ||
      seekRecoveryActive(MICRO_SEEK_SEEK_SUPPRESS_MS)
    ) return false;
    if (t - state._lastMicroSeekAt < MICRO_SEEK_MIN_GAP_MS) return false;
    // Block micro-seeks when video is paused in foreground — nothing to flush
    // when the compositor isn't running. Only allow during tab return recovery.
    if (document.visibilityState === "visible" && getVideoPaused() &&
        !isTabReturnImmune() && !NotMakePlayBackFixingNoticable.isActive() &&
        !inBgReturnGrace()) return false;
    // In foreground with healthy playback, limit rate
    if (document.visibilityState === "visible" && !getVideoPaused() && state.intendedPlaying) {
      if (state._microSeekCount >= MICRO_SEEK_MAX_IN_WINDOW &&
          t - state._lastMicroSeekAt < MICRO_SEEK_WINDOW_MS) return false;
    }
    return true;
  }
  function canDoConfirmedRecoveryMicroSeek() {
    const t = now();
    // Still respect the immediate play/pause transition guard so we never
    // seek during the click itself, but once that settles allow confirmed
    // compositor-recovery paths to act even if the user toggle window is
    // still open.
    if (t < state._playPauseTransitionUntil) return false;
    if (
      userSeekIntentActive() ||
      state.pendingSeekTarget != null ||
      state.seeking ||
      state.seekBuffering ||
      state.seekResumeInFlight ||
      seekRecoveryActive(MICRO_SEEK_SEEK_SUPPRESS_MS)
    ) return false;
    if (t - state._lastMicroSeekAt < MICRO_SEEK_MIN_GAP_MS) return false;
    if (document.visibilityState === "visible" && getVideoPaused() &&
        !isTabReturnImmune() && !NotMakePlayBackFixingNoticable.isActive() &&
        !inBgReturnGrace()) return false;
    if (document.visibilityState === "visible" && !getVideoPaused() && state.intendedPlaying) {
      if (state._microSeekCount >= MICRO_SEEK_MAX_IN_WINDOW &&
          t - state._lastMicroSeekAt < MICRO_SEEK_WINDOW_MS) return false;
    }
    return true;
  }
  // Lightweight check for CONFIRMED compositor-stuck paths (RVFC kick,
  // VCFM flush, PRFV fix, RAF freeze detector). These paths have already
  // verified the compositor is stuck (no frame rendered). Unlike canDoMicroSeek(),
  // this does NOT block during play/pause transitions — that's exactly when
  // compositor flushes are most needed. The +0.001 forward micro-seek is
  // invisible to the user and marked _isMicroSeek so seeking/seeked handlers skip.
  //
  // WHY THIS EXISTS: canDoMicroSeek() blocks for 500ms (_playPauseTransitionUntil)
  // + 900ms (directUserToggleActive). This means ALL compositor fix systems were
  // blocked for ~900ms after every play/pause — causing the "video freezes for
  // about a second after play/pause" bug. The user sees paused=false but stale frame.
  function canDoCompositorFlush() {
    // Block during active seeks — micro-seek would interfere with seek resolution
    if (state.seeking || state.seekBuffering || state.seekResumeInFlight) return false;
    if (userSeekIntentActive() || state.pendingSeekTarget != null) return false;
    // only block compositor flushes for 40ms into the transition — long
    // enough for the decoder to start, then allow a flush if it's frozen.
    // old 300ms block was too long and hid real freezes.
    if (now() < state._playPauseTransitionUntil - (PLAY_PAUSE_MICRO_SEEK_BLOCK_MS - 40)) return false;
    // Block when video is paused — no point flushing paused compositor
    if (document.visibilityState === "visible" && getVideoPaused() &&
        !isTabReturnImmune() && !NotMakePlayBackFixingNoticable.isActive() &&
        !inBgReturnGrace()) return false;
    // Lighter rate limit — compositor flushes can retry faster
    if (now() - state._lastMicroSeekAt < COMPOSITOR_FLUSH_MIN_GAP_MS) return false;
    return true;
  }
  function recordMicroSeek() {
    const t = now();
    if (t - state._lastMicroSeekAt > MICRO_SEEK_WINDOW_MS) state._microSeekCount = 0;
    state._lastMicroSeekAt = t;
    state._microSeekCount++;
  }

  let _lastSafeSeekAt = 0;
  let _audioFirstPlayedAt = 0;
  function shouldBlockStableForegroundAudioSeek(target, minDiff = 1.0) {
    if (!coupledMode || !audio) return false;
    if (!state.firstPlayCommitted || !state.intendedPlaying) return false;
    if (document.visibilityState !== "visible" || !isWindowFocused()) return false;
    if (isVisibilityTransitionActive() || isAltTabTransitionActive()) return false;
    if (audio.paused || getVideoPaused()) return false;
    if (state.restarting || state.seeking || state.seekBuffering || state.seekResumeInFlight) return false;
    if (state.pendingSeekTarget != null || userSeekIntentActive()) return false;
    if (state.strictBufferHold || state.videoWaiting || state.videoStallAudioPaused ||
        now() < state.stallAudioResumeHoldUntil) return false;
    if (foregroundRecoveryActive(350) || inBgReturnGrace() || hiddenPlayPendingActive() ||
        state.resumeOnVisible || state.bgHiddenWasPlaying || state.bgResumeInFlight) return false;
    if (directUserToggleActive(1400) || userPlayIntentActive() || userPauseIntentActive() || userToggleTxnActive()) {
      return true;
    }
    const currentPos = Number(audio.currentTime) || 0;
    const targetPos = Number(target);
    if (!isFinite(targetPos)) return false;
    return Math.abs(currentPos - targetPos) < Math.max(0.6, Number(minDiff) || 0);
  }
  function safeSetAudioTime(t) {
    if (!audio) return;
    // During very early NMPBFN recovery (<120ms), block seeks — play() calls
    // are still in flight and seeking would flush the decode buffer.
    // After that, ALLOW seeks — they're needed for drift correction on tab return.
    // The old code blocked all seeks during immunity (2s+) which caused
    // "video plays late" because audio/video drift was never corrected.
    if (NotMakePlayBackFixingNoticable.isRecovering() && NotMakePlayBackFixingNoticable.recoveryAge() < 120 && state.firstPlayCommitted) return;
    // never seek while the error overlay is showing
    if (_errorOverlayShown) return;
    try {
      if (isFinite(t) && t >= 0) {
        if (shouldBlockStableForegroundAudioSeek(t, 0.95)) return;
        // never seek audio backward to near 0 when it's already playing ahead
        if (t < 0.5 && state.firstPlayCommitted && !state.restarting && !isLoopDesired()) {
          const currentAt = Number(audio.currentTime) || 0;
          if (currentAt > 0.5) return;
        }
        const currentPos = Number(audio.currentTime) || 0;
        const timeDiff = Math.abs(currentPos - t);
        // Block backward seeks > 1.5s unless user-initiated or during restart.
        // This catches programmatic code that accidentally syncs audio to a stale
        // video position, causing audio to jump back mid-playback.
        const isBackward = t < currentPos - 0.1;
        if (isBackward && (currentPos - t) > 1.5 && state.firstPlayCommitted &&
            !state.restarting && !state.seeking && !isLoopDesired()) {
          const userRecent = (now() - state.lastUserActionTime) < 1500;
          if (!userRecent) return;
        }

        // During seek kick window, use relaxed guards so audio syncs to the
        // new video position quickly. Normal thresholds (0.8s, 700ms debounce)
        // prevent correction after seek, causing "audio plays late after seek."
        const _inSeekKick = state.seekKickAudioAllowedUntil > 0 && now() < state.seekKickAudioAllowedUntil;

        // if audio is currently playing and we're in the first few seconds of
        // playback, only seek for large drift (>0.8s). small drift at startup
        // is normal — decoders initialize at different speeds. the sync loop
        // corrects it via rate nudging without any audible skip.
        // Exception: after a seek, always correct position regardless of playback age.
        //
        // Detection is belt-and-suspenders: the time-based signal
        // (_audioFirstPlayedAt) relies on the audio `playing` event firing,
        // but squelchAudioEvents / DONTMAKEITDOUBLEPLAY / audioEventsSquelchedUntil
        // frequently eat that event, leaving the timestamp at 0 and the guard
        // dead. Fall back to audio position (<5s into the track) as a second
        // signal so the protection still applies when the event was missed.
        const _aEarlyCT = Number(audio.currentTime) || 0;
        const _earlyByTime = _audioFirstPlayedAt > 0 &&
          (performance.now() - _audioFirstPlayedAt) < 5000;
        const _earlyByPos = _aEarlyCT > 0.1 && _aEarlyCT < 5.0;
        const inEarlyPlayback = !audio.paused && (_earlyByTime || _earlyByPos);
        if (inEarlyPlayback && timeDiff < 1.0 && !_inSeekKick) return;

        const isStartup = state.startupPhase || !state.firstPlayCommitted;
        const threshold = _inSeekKick ? 0.15 : (isStartup ? 1.0 : 0.8);
        if (timeDiff <= threshold) return;

        const _now = performance.now();
        const debounce = _inSeekKick ? 100 : (isStartup ? 500 : 700);
        if ((_now - _lastSafeSeekAt) < debounce) return;
        _lastSafeSeekAt = _now;

        // ANTI-REPEAT GUARD: if audio was paused due to a video stall, never
        // seek it backward past the position it was at when paused. Otherwise
        // we replay audio content the user already heard — the "audio repeats
        // during buffering" bug. Instead, clamp to max(t, stallPausePos).
        // Only active when videoStallAudioPaused is set (= we're in stall recovery).
        let _safeT = t;
        const _spPos = getStallPauseAudioPos();
        if (_spPos > 0 && state.videoStallAudioPaused && _safeT < _spPos - 0.05) {
          // Don't seek backward past stall position — would replay content
          _safeT = _spPos;
        }
        audio.currentTime = _safeT;
      }
    } catch {}
  }

  async function quietSeekAudio(t) {
    if (!audio || !coupledMode) return;
    // During very early NMPBFN recovery (<120ms), block seeks — play() is in flight.
    if (NotMakePlayBackFixingNoticable.isRecovering() && NotMakePlayBackFixingNoticable.recoveryAge() < 120 && state.firstPlayCommitted) return;
    if (_errorOverlayShown) return;
    try {
      if (!isFinite(t) || t < 0) return;
      if (shouldBlockStableForegroundAudioSeek(t, 1.1)) return;
      const timeDiff = Math.abs((audio.currentTime || 0) - t);
      // 1.5s threshold — drift under 1.5s is imperceptible and handled by rate sync.
      // Previous thresholds (0.5s, 0.35s, 0.8s) caused random small audio seeks
      // during normal playback, which users hear as glitches/pops.
      if (timeDiff <= 1.5) return;

      const wasPlaying = !audio.paused;

      // Fast path: target already buffered → seek without pausing
      const targetBuffered = bufferedAhead(audio, t) > 0.1;
      if (wasPlaying && targetBuffered) { safeSetAudioTime(t); return; }
      // Also fast-path if audio is paused but target is buffered — just seek + play
      if (!wasPlaying && targetBuffered && state.intendedPlaying) {
        safeSetAudioTime(t);
        execProgrammaticAudioPlay({ squelchMs: 200, force: true, minGapMs: 0 }).catch(() => {});
        return;
      }

      if (wasPlaying) {
        await doVolumeFade(0, 60);
        // Pause to flush decode buffer (prevents "repeat last 0.5s" artifact)
        state.isProgrammaticAudioPause = true;
        try { audio.pause(); } catch {}
        setTimeout(() => { state.isProgrammaticAudioPause = false; }, 150);
      } else {
        cancelActiveFade();
      }

      safeSetAudioTime(t);

      if (wasPlaying && state.intendedPlaying) {
        await new Promise(r => setTimeout(r, 25));
        if (!state.intendedPlaying) return;
        if (userPauseLockActive() || mediaSessionForcedPauseActive()) return;
        state.isProgrammaticAudioPause = false;
        state.isProgrammaticAudioPlay = true;
        try {
          const p = audio.play();
          if (p && p.catch) p.catch(() => {});
          setTimeout(() => { state.isProgrammaticAudioPlay = false; }, 200);
        } catch {
          state.isProgrammaticAudioPlay = false;
        }
        softUnmuteAudio(120).catch(() => {});
        // Multi-stage safety net for stuck audio after quiet seek
        const _qsSession = state.playSessionId;
        [150, 400, 800].forEach(_qsDelay => {
          setTimeout(() => {
            if (_qsSession !== state.playSessionId || !state.intendedPlaying) return;
            if (!audio.paused || getVideoPaused() || state.seeking) return;
            if (userPauseLockActive() || mediaSessionForcedPauseActive()) return;
            state.isProgrammaticAudioPause = false;
            state.audioEventsSquelchedUntil = 0;
            state.audioPauseUntil = 0;
            const _vt = Number(video.currentTime()) || 0;
            if (_vt > 0.5 || !state.firstPlayCommitted) safeSetAudioTime(_vt);
            execProgrammaticAudioPlay({ squelchMs: 200, force: true, minGapMs: 0 }).catch(() => {});
            softUnmuteAudio(100).catch(() => {});
          }, _qsDelay);
        });
      }
    } catch {}
  }

  function resetAudioPlaybackRate() {
    if (!audio) return;
    try {
      const baseRate = Number(video.playbackRate()) || 1;
      if (Math.abs((audio.playbackRate || baseRate) - baseRate) > 0.0001) {
        audio.playbackRate = baseRate;
      }
    } catch {}
    state.driftStableFrames = 0;
    state.lastDrift = 0;
    state.audioRateNudgeActive = false;
    state.audioRateNudgeUntil = 0;
    state.syncConvergenceCount = 0;
    state.lastSyncDrift = 0;
  }

  function enforcePlaybackRateSync() {
    if (!coupledMode || !audio) return;
    if (state.audioRateNudgeActive && now() < state.audioRateNudgeUntil) return;
    try {
      const targetRate = Number(video.playbackRate()) || 1;
      const currentRate = Number(audio.playbackRate) || 1;
      if (Math.abs(currentRate - targetRate) > 0.0005) {
        audio.playbackRate = targetRate;
      }
    } catch {}
  }

  function safeSetVideoTime(t, opts = {}) {
    if (!isFinite(t) || t < 0) return;
    const explicitSeek =
      !!opts.force ||
      state.restarting ||
      state.seeking ||
      state.seekBuffering ||
      userSeekIntentActive() ||
      state.pendingSeekTarget != null;
    const visibleForeground =
      document.visibilityState === "visible" &&
      isWindowFocused() &&
      !isVisibilityTransitionActive() &&
      !isAltTabTransitionActive();
    const realTimelineOwner =
      state.restarting ||
      state.seeking ||
      state.seekBuffering ||
      userSeekIntentActive() ||
      state.pendingSeekTarget != null;
    if (shouldKeepForegroundReturnVideoFirst() && visibleForeground && !realTimelineOwner) {
      return;
    }
    if (!explicitSeek && state.firstPlayCommitted && visibleForeground && !foregroundRecoveryActive(250)) {
      return;
    }
    // Block large backward seeks on video unless user-initiated or restarting.
    // This prevents programmatic code from jumping video backward visibly.
    const curVT = (() => { try { return Number(video.currentTime()) || 0; } catch { return 0; } })();
    if (t < 0.5 && state.firstPlayCommitted && !nearZeroSeekAuthorized(t) &&
        !state.restarting && !state.seeking && !isLoopDesired() && curVT > 0.9) {
      return;
    }
    if (t < curVT - 2.0 && state.firstPlayCommitted && !state.restarting && !state.seeking && !isLoopDesired()) {
      const userRecent = explicitSeek || (now() - state.lastUserActionTime) < 2000;
      if (!userRecent) return;
    }
    try { video.currentTime(t); } catch {}
    try { safeSetCT(videoEl, t); } catch {}
    try {
      const v = getVideoNode();
      if (v && v !== videoEl) safeSetCT(v, t);
    } catch {}
  }

  // Silently update video.currentTime to match audio position when in the backgro
  function bgSilentSyncVideoTime(t) {
    if (!isFinite(t) || t < 0) return;
    if (shouldKeepForegroundReturnVideoFirst() || shouldRequireVisibleVideoHealthForForegroundPlay()) return;
    // never seek video while the user is looking. this is bg-sync only
    // (updating the progress bar). visible OR focused both count — during
    // alt-tab the window can briefly lose focus while still visible. either
    // way the user sees the jump, and this is the #1 source of "random
    // seeks". also block during tab-return grace: first 500ms the page is
    // visible but audio may be way ahead from bg playback, so syncing
    // video to audio yanks it forward visibly.
    if (document.visibilityState === "visible" || isWindowFocused()) {
      return;
    }
    if (inBgReturnGrace() || BringBackToTabManager.isLocked()) return;
    // Never silently sync video to 0 after first play (unless looping)
    if (t < 0.5 && state.firstPlayCommitted && !nearZeroSeekAuthorized(t) && !state.restarting && !isLoopDesired()) {
      const vt = Number(videoEl.currentTime) || 0;
      if (vt > 0.9) return;
    }
    try {
      const vt = Number(videoEl.currentTime) || 0;
      if (Math.abs(vt - t) < 0.12) return;
      // Don't move video BACKWARD in background sync unless drift is huge.
      // Audio can be temporarily behind video when it just started a new
      // buffer fetch — nudging video back creates visible "random seek back"
      // on tab return since the user sees the older position.
      if (t < vt - 0.2 && (vt - t) < 2.5 && state.firstPlayCommitted && !state.restarting) {
        return;
      }
      // Don't move video more than 5s forward in background — audio can run ahead
      // due to browser throttling video decode, and syncing to that position causes
      // "seeking first part" on tab return when lastKnownGoodVT was the user's
      // real position but video gets moved far ahead.
      if (t > vt + 5.0 && state.firstPlayCommitted && !state.restarting) {
        return;
      }
      // Cancel any pending clear so we don't accidentally clear while a new sync is pending
      if (state.bgSilentTimeSyncTimer) {
        clearTimeout(state.bgSilentTimeSyncTimer);
        state.bgSilentTimeSyncTimer = null;
      }
      state.bgSilentTimeSyncing = true;
      videoEl.currentTime = t;
      try {
        const v = getVideoNode();
        if (v && v !== videoEl) v.currentTime = t;
      } catch {}
      // don't update lastKnownGoodVT here. this syncs video to audio in
      // the background, but audio can run way ahead of where the user
      // actually was. pinning lastKnownGoodVT to audio's position would
      // make tab-return resume from the future.
      // lastKnownGoodVT is owned by: onTabHide (real user position),
      // updateLastKnownGoodVT (live foreground video), and seek events.
    } catch {}
    // Clear flag after generous delay — seek events are asynchronous
    state.bgSilentTimeSyncTimer = setTimeout(() => {
      state.bgSilentTimeSyncing = false;
      state.bgSilentTimeSyncTimer = null;
    }, 500);
  }

  function timeInBuffered(media, t) {
    try {
      const br = media.buffered;
      if (!br || br.length === 0 || !isFinite(t)) return false;
      for (let i = 0; i < br.length; i++) {
        const s = br.start(i) - EPS;
        const e = br.end(i) + EPS;
        if (t >= s && t <= e) return true;
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
      if (rs >= HAVE_FUTURE_DATA && ahead >= Math.min(0.10, minAhead)) return true;
      if (t < 0.5 && rs >= 2 && ahead >= Math.min(0.10, minAhead)) return true;
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
  function videoReadyForAudioResume(t = NaN) {
    const vNode = getVideoNode();
    if (!vNode) return false;
    const target = isFinite(Number(t))
      ? Number(t)
      : (() => { try { return Number(video.currentTime()) || 0; } catch { return 0; } })();
    const vRS = Number(vNode.readyState || 0);
    if (vRS < MIN_STALL_VIDEO_RS) return false;
    const visibleForeground =
      document.visibilityState === "visible" &&
      isWindowFocused();
    if (visibleForeground) {
      if (isForegroundVideoActuallyBuffering()) return false;
      const vtNow = (() => { try { return Number(video.currentTime()) || 0; } catch { return target; } })();
      const lastVt = Number(state.lastVT) || 0;
      const frozenAfterStall =
        (state.videoWaiting || state.videoStallAudioPaused || foregroundBufferAudioHoldActive()) &&
        state.lastVTts > 0 &&
        (now() - state.lastVTts) > 600 &&  // was 220→600: less twitchy — 220ms caused false positives during normal keyframe decoding
        Math.abs(vtNow - lastVt) < 0.001;
      if (frozenAfterStall) return false;
      // Use a low threshold (0.05s) so audio isn't blocked just because the
      // buffer is slightly thin. The previous 0.12s was too conservative —
      // it caused random audio cuts when video had data but the buffer read
      // came in slightly under the threshold.
      if (!canPlaySmoothAt(vNode, target, 0.05) && bufferedAhead(vNode, target) < 0.05) return false;
      return true;
    }
    return canPlayAt(vNode, target);
  }

  function shouldBlockNewAudioStart() {
    if (!coupledMode) return false;
    if (state.seeking || state.seekBuffering) return true;
    if (!state.intendedPlaying || userPauseLockActive() || mediaSessionForcedPauseActive()) return true;
    if (shouldHoldAudioForForegroundStall({ allowRecovery: false })) return true;
    // During post-seek recovery, let audio starts through immediately.
    if ((state.seekResumeInFlight || state.seekAudioMustStartUntil > now()) && state.intendedPlaying) return false;
    // During tab-return grace/immunity/NMPBFN recovery, don't block audio unless
    // the visible foreground player is still in a real stall/buffer state.
    if (inBgReturnGrace() || BringBackToTabManager.isLocked() || isTabReturnImmune() || NotMakePlayBackFixingNoticable.isActive()) {
      return shouldHoldAudioForForegroundStall({ allowRecovery: true });
    }

    // During startup, don't block audio just because video is paused —
    // both are being kicked together and video may be a frame behind.
    if (state.startupPhase && !state.firstPlayCommitted) return false;
    if (state.startupKickInFlight) return false;

    // Only block if video is TRULY paused (not just momentarily during a programmatic
    // operation). Check isProgrammaticVideoPlay/Pause flags to avoid false blocks.
    // Also don't block during recent user actions or video play in-flight — video.play()
    // can take 50-200ms to resolve, during which getVideoPaused() still returns true.
    // Extend user action window to 3s to prevent audio from being blocked while
    // video.play() promise is still resolving after a user toggle.
    if (getVideoPaused() && !isHiddenBackground() &&
        !state.isProgrammaticVideoPlay && !state.isProgrammaticVideoPause &&
        !state.seekResumeInFlight && !state.videoPlayInFlight &&
        (now() - state.lastUserActionTime) > 3000) return true;

    // These checks must run BEFORE the bgPlaybackAllowed early-return (bgPlaybackAllowed is always true).
    // Block audio when video is actively buffering/stalled — but with a safety timeout.
    // If these flags have been stuck for >8s, something went wrong; force-clear them
    // to prevent permanent audio disconnection.
    const _sbVNode = getVideoNode();
    const _sbRS = _sbVNode ? Number(_sbVNode.readyState || 0) : 4;
    const stallAge = state.videoStallSince ? (now() - state.videoStallSince) : 0;
    if (stallAge > 3000) {
      // Only clear a long-lived stall once video has actually recovered.
      // Otherwise we'd let audio leak underneath a real visible buffer.
      if (isForegroundVideoActuallyBuffering() || _sbRS < HAVE_FUTURE_DATA) return true;
      state.videoWaiting = false;
      state.videoStallAudioPaused = false;
      state.stallAudioResumeHoldUntil = 0;
      state.stallAudioPausedSince = 0;
      state.videoStallSince = 0;
      clearForegroundBufferAudioHold();
    } else {
      // if audio just started (grace period), only block it when video is truly starved.
      if (now() < state.audioStartGraceUntil && _sbRS >= HAVE_FUTURE_DATA) {
        // video has data, don't block
      } else {
        if (state.videoWaiting && _sbRS < HAVE_FUTURE_DATA) return true;
        if (state.videoStallAudioPaused && _sbRS < HAVE_FUTURE_DATA) return true;
        if (now() < state.stallAudioResumeHoldUntil && _sbRS < HAVE_FUTURE_DATA) return true;
      }
    }

    if (state.audioPausedSince > 0 && (now() - state.audioPausedSince) > AUDIO_STUCK_HARD_MS) return false;
    if (state.bgPlaybackAllowed) return false;
    const allowHiddenBootstrap =
    (document.visibilityState === "hidden" &&
      (hiddenPlayPendingActive() || hiddenMediaSessionPlayActive() || state.mediaSessionInitiatedPlay));
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

  function updateMediaSessionPlaybackState() {
    if (!("mediaSession" in navigator)) return;
    try {
      navigator.mediaSession.playbackState = state.intendedPlaying ? "playing" : "paused";
    } catch {}
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
      // _pauseSavedPosition first — that's the exact spot the user paused.
      // more reliable than audio.currentTime, which drifts during bg play.
      if (state._pauseSavedPosition > 0.1 && (now() - state._pauseSavedAt) < 300000) {
        return state._pauseSavedPosition;
      }
      const vt = Number(video.currentTime());
      const at = coupledMode && audio ? Number(audio.currentTime) : NaN;
      const bothAtStart = (vt < 0.5) && (!isFinite(at) || at < 0.5);
      // Extend freshness window to 2 minutes — lastKnownGoodVT is the user's real
      // position captured at tab hide time. It doesn't expire after 5s — the user's
      // "where was I watching" is valid until they explicitly seek elsewhere.
      const hasSaved = state.lastKnownGoodVT > 0.5 && (now() - state.lastKnownGoodVTts) < 120000 && bothAtStart;
      if (hasSaved) return state.lastKnownGoodVT;
      // only trust audio's position when it's clearly ahead AND we were
      // actually playing in the background (intendedPlaying). otherwise
      // audio can drift ahead from buffering jitter even while paused,
      // and we'd resume from the wrong place.
      if (isFinite(at) && at > 0.5 && (!isFinite(vt) || at > vt + 2.0) && state.intendedPlaying) return at;
      if (isFinite(vt) && vt > 0) return vt;
      if (isFinite(at) && at > 0) return at;
      return 0;
    } catch {
      return 0;
    }
  }

  function execProgrammaticVideoPause() {
    // Hard lockout: during immunity or NMPBFN recovery, never programmatically
    // pause video. The capture-phase guard handles any browser pauses.
    if ((isTabReturnImmune() || NotMakePlayBackFixingNoticable.shouldBlockPause()) && state.intendedPlaying &&
      !(state.userPauseIntentPresetAt > 0 && (now() - state.userPauseIntentPresetAt) < 2000)) return;
    state.isProgrammaticVideoPause = true;
    try { video.pause(); } catch {}
    try { videoEl.pause(); } catch {}
    try {
      const v = getVideoNode();
      if (v && v !== videoEl && !v.paused) v.pause();
    } catch {}
    try {
      const inner = video?.el?.()?.querySelector?.("video");
      if (inner && !inner.paused) inner.pause();
    } catch {}
    const releaseMs = directUserToggleActive() ? USER_PROGRAMMATIC_FLAG_CLEAR_MS : 250;
    setTimeout(() => { state.isProgrammaticVideoPause = false; }, releaseMs);
  }

  function execProgrammaticVideoPlay(opts = {}) {
    const { force = false, minGapMs = null } = opts || {};
    if (_errorOverlayShown) return;
    // Never restart after ended. User play clears endedNaturally first.
    if (state.endedNaturally && !state.restarting && !isLoopDesired()) return;
    var userImmediate = !!directUserToggleActive();
    var resolvedMinGapMs = Math.max(0, Number(minGapMs != null ? minGapMs : (userImmediate ? 80 : 180)) || 0);
    const nowTs = now();
    if (!force && state.videoPlayInFlight) return state.videoPlayInFlight;
    if (!force && nowTs < state.videoPlayUntil) return Promise.resolve();
    if (!force && !getVideoPaused()) return Promise.resolve();
    state.videoPlayUntil = nowTs + resolvedMinGapMs;
    VisibilityGuard.onPlayCalled(); // VG: suppress spurious pause after our play()
    state.isProgrammaticVideoPlay = true;
    _bufMonStallFrames = 0;  // reset stale stall count
    try {
      let p = null;
      const vNode = getVideoNode();
      // Prefer native element play() first so DONTMAKEITDOUBLEPLAY wrapper can dedupe.
      if (vNode && typeof vNode.play === "function") {
        try { p = vNode.play(); } catch {}
      }
      if (!p) {
        try { p = video.play(); } catch {}
      }
      if (!p && videoEl && videoEl !== vNode && typeof videoEl.play === "function") {
        try { p = videoEl.play(); } catch {}
      }

      const finish = () => {
        const releaseMs = userImmediate ? USER_PROGRAMMATIC_FLAG_CLEAR_MS : 250;
        setTimeout(() => { state.isProgrammaticVideoPlay = false; }, releaseMs);
      };
      const wrapped = Promise.resolve(p).catch((err) => {
        // Chromium autoplay policy: if play() fails because video is unmuted,
        // mute it and retry (in coupled mode, audio comes from separate element)
        if (coupledMode && err && err.name === "NotAllowedError") {
          try { setVideoMutedState(true); } catch {}
          try {
            const vn = getVideoNode();
            const p2 = vn ? vn.play() : video.play();
            if (p2 && p2.catch) p2.catch(() => {});
          } catch {}
        }
        throw err;
      }).finally(() => {
        if (state.videoPlayInFlight === wrapped) state.videoPlayInFlight = null;
        finish();
      });
      state.videoPlayInFlight = wrapped;
      // Safety timeout: clear flags if promise never resolves. Some browsers
      // swallow play() promises when the tab is backgrounded, leaving
      // isProgrammaticVideoPlay=true forever → play/pause becomes unresponsive
      // AND tryAcquireVideoPlayLock (line ~898) refuses every new attempt.
      // 3000 was too long — a user who hits play during that window sees
      // nothing happen. 1500 covers realistic foreground play() resolves
      // (~800ms worst case) without leaving the flag pinned.
      const _playFlightSafety = setTimeout(() => {
        if (state.videoPlayInFlight === wrapped) state.videoPlayInFlight = null;
        state.isProgrammaticVideoPlay = false;
      }, 1500);
      wrapped.finally(() => clearTimeout(_playFlightSafety));
      return wrapped.catch(() => {});
    } catch (e) {
      state.isProgrammaticVideoPlay = false;
      state.videoPlayInFlight = null;
      throw e;
    }
  }

  async function execProgrammaticAudioPause(ms = 500) {
    if (!coupledMode || !audio) return;
    // STARTUP SETTLE: during the first 15s after commit, readyState dips and
    // transient stall flags are decoder warm-up, not real pause triggers.
    // Silently drop programmatic pauses that are firing on those conditions.
    // User pauses are immune: startupSettleActive respects userGesturePauseIntent
    // and pauseTogether pauses audio directly (not via this function).
    if (startupSettleActive()) return;
    // During immunity or NMPBFN recovery, don't pause audio for non-buffering reasons.
    // BUT: if video is genuinely buffering (readyState < HAVE_FUTURE_DATA), audio
    // MUST pause regardless of immunity. The anti-ghost invariant overrides everything.
    const _epapVNode = getVideoNode();
    const _epapRS = _epapVNode ? Number(_epapVNode.readyState || 0) : 4;
    const _epapGenuineBuffer = _epapRS < HAVE_FUTURE_DATA && state.firstPlayCommitted &&
      document.visibilityState === "visible";
    if (!_epapGenuineBuffer &&
        (isTabReturnImmune() || NotMakePlayBackFixingNoticable.shouldBlockPause()) && state.intendedPlaying &&
        !(state.userPauseIntentPresetAt > 0 && (now() - state.userPauseIntentPresetAt) < 2000)) return;
    const userImmediate = directUserToggleActive();
    const until = now() + Math.max(userImmediate ? 120 : 300, Number(ms) || 0);
    state.audioPauseUntil = Math.max(state.audioPauseUntil, until);
    state.audioPlayUntil = Math.max(state.audioPlayUntil, now() + (userImmediate ? 120 : 250));
    state.isProgrammaticAudioPause = true;
    state.audioPlayGeneration++;

    try { squelchAudioEvents(ms); } catch {}
    try { resetAudioPlaybackRate(); } catch {}

    if (userImmediate) {
      // Instant pause for direct user action — zero latency
      cancelActiveFade();
      try { audio.volume = 0; } catch {}
      try { audio.pause(); } catch {}
    } else if (!audio.paused && audio.volume > 0.015) {
      await doVolumeFade(0, AUDIO_FADE_DURATION_MS);
      cancelActiveFade();
      try { audio.pause(); } catch {}
    } else {
      cancelActiveFade();
      try { audio.pause(); } catch {}
    }

    setTimeout(() => { state.isProgrammaticAudioPause = false; }, userImmediate ? USER_PROGRAMMATIC_FLAG_CLEAR_MS : 200);
  }

  async function execProgrammaticAudioPlay(opts = {}) {
    const { squelchMs = 500, minGapMs = null, force = false } = opts;
    if (!coupledMode || !audio || typeof audio.play !== "function") return false;
    // Error overlay active — playback is dead, don't start anything
    if (_errorOverlayShown) return false;
    var userImmediate = !!directUserToggleActive();
    var resolvedMinGapMs = Math.max(0, Number(minGapMs != null ? minGapMs : (userImmediate ? 120 : 300)) || 0);

    // Never start audio during seeking or seek-buffering by default.
    // Exception: forced short post-seek kick window (armed by video "seeked")
    // so audio can resume immediately when seek landed cleanly.
    const inSeekKickWindow =
      force &&
      now() < state.seekKickAudioAllowedUntil;
    if ((state.seeking || state.seekBuffering) && !inSeekKickWindow) return false;

    const _epVNode = getVideoNode();
    const _epRS = _epVNode ? Number(_epVNode.readyState || 0) : 4;
    const _epVisibleForeground =
      document.visibilityState === "visible" &&
      isWindowFocused();
    const _epTime = (() => { try { return Number(video.currentTime()) || 0; } catch { return 0; } })();
    const _epDirectUserResume =
      userImmediate ||
      directUserToggleActive(MICRO_SEEK_TOGGLE_SUPPRESS_MS) ||
      userWantsPlayNow(MICRO_SEEK_TOGGLE_SUPPRESS_MS) ||
      userToggleExpectingPlay();
    const _epActuallyBuffering =
      _epVisibleForeground &&
      isForegroundVideoActuallyBuffering();
    const _epNeedsStableVideo =
      _epVisibleForeground &&
      state.firstPlayCommitted &&
      (
        state.videoWaiting ||
        state.videoStallAudioPaused ||
        state.strictBufferHold ||
        foregroundBufferAudioHoldActive() ||
        // Only treat videoStallSince as a block when video *actually* lacks
        // data right now. If the flag is stale (set during a past stall but
        // not cleared because the stall resolved without going through the
        // normal clear path), we must not block audio indefinitely.
        (state.videoStallSince > 0 && (now() - state.videoStallSince) > 400 && _epRS < HAVE_FUTURE_DATA)
      );
    if (shouldBlockLeadingAudioForForegroundPlay()) {
      return false;
    }
    if (!force && _epNeedsStableVideo && !_epDirectUserResume && !videoReadyForAudioResume(_epTime)) return false;
    // forced audio bypass is allowed EXCEPT when video is actually starved
    // in visible foreground — otherwise audio plays over a frozen/buffering
    // video on tab return and NMPBFN recovery.
    // but not during the seek kick window — post-seek, video briefly loses
    // readyState and may have videoWaiting set, but it's about to recover
    // and audio needs to start immediately.
    const _epGenuinelyStarved = _epVisibleForeground && state.firstPlayCommitted &&
      _epRS < HAVE_FUTURE_DATA && (state.videoWaiting || state.videoStallAudioPaused) &&
      !inSeekKickWindow;
    const _forceBufferBypass =
      force && !_epGenuinelyStarved &&
      (
        document.visibilityState === "hidden" ||
        inSeekKickWindow ||
        (state.startupPhase && !state.firstPlayCommitted) ||
        isTabReturnImmune() ||
        inBgReturnGrace() ||
        NotMakePlayBackFixingNoticable.isActive()
      );
    if (shouldHoldAudioForForegroundStall({ allowRecovery: _forceBufferBypass })) return false;

    // Hard block: Don't start audio in visible foreground when video doesn't have
    // enough data to play (readyState < HAVE_FUTURE_DATA). Exception: during
    // seek resume when video readyState is at least HAVE_CURRENT_DATA (1) —
    // readyState briefly dips after seek but audio can start once video has
    // at least some decoded data. The old code bypassed this entirely during
    // seek resume, causing "audio plays while video is buffering."
    const _epInSeekResume = state.seekResumeInFlight ||
      (state.seekKickAudioAllowedUntil > 0 && now() < state.seekKickAudioAllowedUntil);
    const _epAllowCurrentDataResume =
      (_epInSeekResume && _epRS >= HAVE_CURRENT_DATA) ||
      (_epDirectUserResume && _epRS >= HAVE_CURRENT_DATA && !_epActuallyBuffering);
    if (_epVisibleForeground && state.firstPlayCommitted &&
        _epRS < HAVE_FUTURE_DATA && !_epAllowCurrentDataResume) {
      return false;
    }
    // skip if video is genuinely buffering (readyState < 3)
    if ((state.videoWaiting || state.videoStallAudioPaused ||
         (state.strictBufferHold && state.firstPlayCommitted) ||
         now() < state.stallAudioResumeHoldUntil) &&
        _epRS < HAVE_FUTURE_DATA && !_forceBufferBypass) {
      return false;
    }
    if (state.videoWaiting && _epRS >= HAVE_FUTURE_DATA) {
      state.videoWaiting = false; // stale
      state.videoStallSince = 0;
    }

    // Don't start audio if video is paused — unless force is set (user play,
    // tab return, etc.) or we're in a recent user action window where video
    // play() might still be resolving.
    if (getVideoPaused() && !isHiddenBackground() && !force &&
      (now() - state.lastUserActionTime) > 2000) return false;

    // Cancel any active volume fade before attempting to play.
    if (force) {
      cancelActiveFade();
      state.isProgrammaticAudioPause = false;
    }

    const myGeneration = state.audioPlayGeneration;
    const mySession = state.playSessionId;

    if (!force && checkRapidPlayPause()) return !audio.paused;
    if (!force && !checkAudioPlayAttempt()) return !audio.paused;
    if (!force && !audio.paused) return true;

    const timeSinceLastPlayPause = now() - state.audioLastPlayPauseTs;
    if (!force && timeSinceLastPlayPause < MIN_PLAY_PAUSE_GAP_MS) {
      if (!audio.paused) softUnmuteAudio(80).catch(() => {});
      return !audio.paused;
    }
    if (now() < state.stateChangeCooldownUntil && !force) return !audio.paused;
    if (now() < state.audioFadeCompleteUntil && !force) return !audio.paused;
    if (!force && shouldBlockNewAudioStart()) return false;
    const t = now();
    if (!force && t < state.audioPauseUntil) return !audio.paused;
    if (!force && t < state.audioPlayUntil) return !audio.paused;
    if (state.audioPlayInFlight) {
      const inFlight = state.audioPlayInFlight;
      if (!force) {
        try { await inFlight; } catch {}
        return !audio.paused;
      }
      // Forced resume paths used to stack another play() on top of an already
      // running audio.play() promise. That caused audible cut/restart glitches
      // on rapid play-pause-play and during post-seek recovery.
      try {
        await Promise.race([
          Promise.resolve(inFlight).catch(() => {}),
          new Promise(resolve => setTimeout(resolve, 180))
        ]);
      } catch {}
      if (!audio.paused) return true;
    }
    state.audioPlayUntil = t + resolvedMinGapMs;
    state.audioPauseUntil = 0;
    state.isProgrammaticAudioPlay = true;
    resetAudioPlaybackRate();
    try {
      squelchAudioEvents(squelchMs);

      const audioActuallyPaused = audio.paused;
      const isUserPlay = (now() - state.lastUserActionTime) < 2000;
      if (audioActuallyPaused) {
        cancelActiveFade();
      }

      const p = audio.play();
      // Race audio.play() against a 4s timeout -- some browsers hang the play() promise
      // indefinitely (e.g. network stall during autoplay), which would block all future audio starts.
      const playTimeout = new Promise((_, rej) => setTimeout(() => rej(new Error("audio-play-timeout")), 4000));
      state.audioPlayInFlight = Promise.race([Promise.resolve(p), playTimeout]);
      const playFloorMs = (force || userImmediate) ? 120 : 400;
      state.audioPlayUntil = Math.max(state.audioPlayUntil, now() + Math.max(playFloorMs, squelchMs));
      state.audioLastPlayPauseTs = now();
      state.stateChangeCooldownUntil = now() + ((force || userImmediate) ? Math.min(STATE_CHANGE_COOLDOWN_MS, 40) : STATE_CHANGE_COOLDOWN_MS);

      // For user-initiated plays, set volume instantly — no fade.
      // For programmatic plays (background recovery etc.), use a short fade.
      if (isUserPlay || force) {
        updateAudioGainImmediate(true);
      } else if (audioActuallyPaused) {
        fadeAudioIn(AUDIO_SAFE_FADE_DURATION_MS).catch(() => {});
      } else {
        updateAudioGainImmediate();
      }

      try {
        await state.audioPlayInFlight;
      } catch {
        updateAudioGainImmediate();
        return false;
      }

      // Check session after await — but be lenient with generation changes.
      // Generation can change during stalls (waiting handler increments it), but if
      // audio is now playing and intendedPlaying is still true, don't kill it —
      // that would disconnect audio permanently after a brief video stall.
      if (!state.intendedPlaying || mySession !== state.playSessionId) {
        try { squelchAudioEvents(400); audio.pause(); } catch {}
        return false;
      }
      // Only kill on generation mismatch if audio ISN'T successfully playing
      if (state.audioPlayGeneration !== myGeneration && audio.paused) {
        return false;
      }

      if ((!force && shouldBlockNewAudioStart()) || userPauseLockActive()) {
        try { squelchAudioEvents(350); } catch {}
        try { audio.pause(); } catch {}
        return false;
      }

      if (!audio.paused) state.audioEverStarted = true;
      return !audio.paused;
    } finally {
      state.audioPlayInFlight = null;
      setTimeout(() => { state.isProgrammaticAudioPlay = false; }, userImmediate ? USER_PROGRAMMATIC_FLAG_CLEAR_MS : 250);
    }
  }

  async function ensureUnmutedIfNotUserMuted() {
    if (state.startupPhase) {
      if (state.intendedPlaying) forceUnmuteForPlaybackIfAllowed();
      updateAudioGainImmediate();
      return;
    }
    await softUnmuteAudio(AUDIO_SAFE_FADE_DURATION_MS);
  }

  async function softAlignAudioTo(t) {
    if (!coupledMode) return;
    await quietSeekAudio(t);
  }

  function clearResumeAfterBufferTimer() {
    if (state.resumeAfterBufferTimer) {
      clearTimeout(state.resumeAfterBufferTimer);
      state.resumeAfterBufferTimer = null;
    }
  }

  function clearBgResumeRetryTimer() {
    if (state.bgResumeRetryTimer) {
      clearTimeout(state.bgResumeRetryTimer);
      state.bgResumeRetryTimer = null;
    }
  }

  function clearSeekSyncFinalizeTimer() {
    if (state.seekFinalizeTimer) {
      clearTimeout(state.seekFinalizeTimer);
      state.seekFinalizeTimer = null;
    }
  }
  function clearSeekWatchdog() {
    if (state.seekWatchdogTimer) {
      clearTimeout(state.seekWatchdogTimer);
      state.seekWatchdogTimer = null;
    }
  }
  let _seekAudioReadyKickCleanup = null;
  function clearSeekAudioReadyKick() {
    if (_seekAudioReadyKickCleanup) {
      try { _seekAudioReadyKickCleanup(); } catch {}
      _seekAudioReadyKickCleanup = null;
    }
  }
  function armSeekAudioReadyKick(seekId = state.seekId, timeoutMs = 2600) {
    if (!coupledMode || !audio) return;
    clearSeekAudioReadyKick();

    const targetSeekId = Number(seekId);
    let finished = false;
    const timers = [];
    const cleanup = () => {
      if (finished) return;
      finished = true;
      timers.forEach(t => clearTimeout(t));
      try { audio.removeEventListener("canplay", onReady); } catch {}
      try { audio.removeEventListener("canplaythrough", onReady); } catch {}
      try { audio.removeEventListener("loadeddata", onReady); } catch {}
      try { audio.removeEventListener("progress", onReady); } catch {}
      try { audio.removeEventListener("playing", onPlaying); } catch {}
      if (_seekAudioReadyKickCleanup === cleanup) _seekAudioReadyKickCleanup = null;
    };
    const onPlaying = () => { cleanup(); };
    const tryKick = () => {
      if (finished) return;
      if (targetSeekId !== state.seekId) { cleanup(); return; }
      if (!state.intendedPlaying || state.endedNaturally || state.restarting) { cleanup(); return; }
      if (userPauseLockActive() || mediaSessionForcedPauseActive()) { cleanup(); return; }
      if (!audio.paused) { cleanup(); return; }

      const inSeekKickWindow = now() < state.seekKickAudioAllowedUntil;
      if ((state.seeking || state.seekBuffering) && !inSeekKickWindow) return;

      const vNode = getVideoNode();
      const vRS = vNode ? Number(vNode.readyState || 0) : 4;
      const aRS = Number(audio.readyState || 0);
      if (document.visibilityState === "visible" &&
          isWindowFocused() &&
          !inSeekKickWindow &&
          aRS < HAVE_CURRENT_DATA &&
          vRS < HAVE_CURRENT_DATA) {
        return;
      }

      // don't start audio while video is genuinely buffering — old code
      // cleared videoWaiting unconditionally then kicked audio with force,
      // bypassing the readyState guard. that's what caused "audio plays
      // while video is buffering." only clear stale flags if video really
      // has data; otherwise skip and let the next retry handle it.
      if (vRS < HAVE_FUTURE_DATA && document.visibilityState === "visible") {
        return;
      }
      const vt = Number(video.currentTime()) || 0;
      clearAudioPauseLocks();
      if (vRS >= HAVE_FUTURE_DATA) {
        state.videoWaiting = false;
        state.videoStallAudioPaused = false;
        state.stallAudioPausedSince = 0;
        state.stallAudioResumeHoldUntil = 0;
      }
      state.audioPauseUntil = 0;
      state.audioEventsSquelchedUntil = 0;
      state.audioStartGraceUntil = Math.max(state.audioStartGraceUntil, now() + 600);
      safeSetAudioTime(vt);
      execProgrammaticAudioPlay({ squelchMs: 100, force: true, minGapMs: 0 })
        .then(ok => {
          if (ok || !audio.paused) cleanup();
        })
        .catch(() => {});
    };
    const onReady = () => { setTimeout(tryKick, 0); };

    try { audio.addEventListener("canplay", onReady, { passive: true }); } catch {}
    try { audio.addEventListener("canplaythrough", onReady, { passive: true }); } catch {}
    try { audio.addEventListener("loadeddata", onReady, { passive: true }); } catch {}
    try { audio.addEventListener("progress", onReady, { passive: true }); } catch {}
    try { audio.addEventListener("playing", onPlaying, { passive: true }); } catch {}

    [0, 45, 95, 170, 280, 420, 650, 950].forEach(delay => {
      timers.push(setTimeout(tryKick, delay));
    });
    timers.push(setTimeout(cleanup, Math.max(500, Number(timeoutMs) || 0)));
    _seekAudioReadyKickCleanup = cleanup;
  }

  function cancelBackgroundResumeState() {
    state.resumeOnVisible = false;
    state.bgAutoResumeSuppressed = false;
    state.bgHiddenWasPlaying = false;
    state.bgHiddenSince = 0;
    clearHiddenPlayPending();
    clearBgResumeRetryTimer();
  }

  function clearSyncLoop() {
    if (state.syncTimer) {
      clearTimeout(state.syncTimer);
      state.syncTimer = null;
    }
    state.syncScheduledAt = 0;
  }

  function scheduleSync(minDelay = null) {
    let delay;
    if (typeof minDelay === "number") {
      delay = Math.max(16, minDelay); // floor at 16ms (one frame) to reduce timer churn
    } else if (document.visibilityState === "hidden") {
      delay = platform.useBgControllerRetry ? 1200 : 1500;
    } else if (fastSyncActive() || state.syncing || state.seeking || state.videoWaiting || state.strictBufferHold) {
      delay = 200;
    } else if (state.intendedPlaying) {
      delay = 800; // was 500 — reduced CPU while still catching drift
    } else {
      delay = 1500; // was 1000 — paused state needs even less monitoring
    }
    const targetAt = now() + delay;
    if (state.syncTimer && state.syncScheduledAt <= targetAt) return;
    if (state.syncTimer) clearTimeout(state.syncTimer);
    state.syncScheduledAt = targetAt;
    state.syncTimer = setTimeout(runSync, delay);
  }

  async function kickAudio() {
    if (!coupledMode) return;
    if ((isTabReturnImmune() || NotMakePlayBackFixingNoticable.isActive()) && state.intendedPlaying) return;
    try {
      const vt = Number(video.currentTime());
      const at = Number(audio.currentTime);
      const target = isFinite(vt) ? vt : (isFinite(at) ? at : 0);
      await execProgrammaticAudioPause(350);
      safeSetAudioTime(target);
      await new Promise(r => setTimeout(r, 30));
      if (state.intendedPlaying && !getVideoPaused() && !userPauseLockActive() && !shouldBlockNewAudioStart()) {
        resetAudioPlaybackRate();
        await execProgrammaticAudioPlay({ squelchMs: 600, force: true, minGapMs: 0 }).catch(() => false);
        softUnmuteAudio(AUDIO_SAFE_FADE_DURATION_MS).catch(() => {});
      }
    } catch {}
  }

  async function kickVideo() {
    if (state.videoRepairing) return;
    if (now() < state.videoRepairCooldownUntil) return;
    if (!state.intendedPlaying) return;
    if (seekStabilizeActive() || state.seekResumeInFlight || now() < state.seekCooldownUntil) return;
    // Don't kick video while user is actively watching and video is playing fine.
    // Never do a tiny+nudge seek here: it creates visible random jumps.
    const _kvNode = getVideoNode();
    if (_kvNode && !_kvNode.paused && Number(_kvNode.readyState || 0) >= 3) return;
    state.videoRepairing = true;
    state.videoRepairCooldownUntil = now() + 4000;
    try {
      const v = getVideoNode();
      const t = Number(video.currentTime()) || 0;
      execProgrammaticAudioPause(900);
      execProgrammaticVideoPause();
      const nudge = Math.max(0, t);
      try {
        safeSetCT(videoEl, nudge);
        if (v && v !== videoEl) safeSetCT(v, nudge);
      } catch {}
      await new Promise(r => setTimeout(r, 50));
      try { await Promise.resolve(execProgrammaticVideoPlay()); } catch {}
      if (!getVideoPaused()) {
        const vt = Number(video.currentTime()) || t;
        safeSetAudioTime(vt);
        if (!shouldBlockNewAudioStart()) {
          await execProgrammaticAudioPlay({ squelchMs: 900, force: true, minGapMs: 0 }).catch(() => false);
        }
        softUnmuteAudio(AUDIO_SAFE_FADE_DURATION_MS).catch(() => {});
      }
    } finally {
      state.videoRepairing = false;
    }
  }

  function scheduleBgResumeRetry(delay = 400) {
    if (!platform.useBgControllerRetry) return;
    if (state.endedNaturally) return;
    if (mediaSessionForcedPauseActive()) return;
    if (userPauseLockActive()) return;
    // During immunity or NMPBFN recovery, the recovery system handles everything.
    if ((isTabReturnImmune() || NotMakePlayBackFixingNoticable.isRecovering()) && state.intendedPlaying) return;
    // Don't schedule bgResumeRetry if the wakeup timer is already pending —
    // competing resume attempts cause the visible play→pause stutter on tab return.
    if (state.wakeupTimer) return;
    // BPMM gate: if oscillation circuit-breaker is active, don't schedule retry
    // (we'll resume on foreground return instead)
    if (!BackgroundPlaybackManagerManager.shouldAttemptBgResume()) {
      if (state.intendedPlaying) state.resumeOnVisible = true;
      return;
    }
    clearBgResumeRetryTimer();
    // On Chromium tab return, enforce a minimum delay matching the spurious-pause burst window.
    // Attempting resume before this window expires causes a visible play→pause→play stutter.
    let effectiveDelay = delay;
    if (platform.chromiumOnlyBrowser && inBgReturnGrace()) {
      effectiveDelay = Math.max(delay, BG_RESUME_MIN_DELAY_CHROMIUM_MS);
    }
    state.bgResumeRetryTimer = setTimeout(() => {
      if (!state.intendedPlaying || state.restarting || state.seeking || state.syncing) return;
      if (userPauseLockActive()) return;
      if (isHiddenBackground()) {
        state.resumeOnVisible = true;
        return;
      }
      playTogether().catch(() => {});
    }, effectiveDelay);
  }

  function waitForReadyStateOrCanPlay(media, minRS = 3, timeoutMs = 2500) {
    return new Promise(resolve => {
      let done = false;
      let to = null;
      const finish = ok => {
        if (done) return;
        done = true;
        try { if (to) clearTimeout(to); } catch {}
        try { media.removeEventListener("canplay", onEvt); } catch {}
        try { media.removeEventListener("canplaythrough", onEvt); } catch {}
        try { media.removeEventListener("loadeddata", onEvt); } catch {}
        try { media.removeEventListener("seeked", onEvt); } catch {}
        resolve(!!ok);
      };
      const onEvt = () => {
        try { if (Number(media.readyState || 0) >= minRS) finish(true); } catch {}
      };
      try { if (Number(media.readyState || 0) >= minRS) return resolve(true); } catch {}
      try { media.addEventListener("canplay", onEvt, { once: true, passive: true }); } catch {}
      try { media.addEventListener("canplaythrough", onEvt, { once: true, passive: true }); } catch {}
      try { media.addEventListener("loadeddata", onEvt, { once: true, passive: true }); } catch {}
      try { media.addEventListener("seeked", onEvt, { once: true, passive: true }); } catch {}
      to = setTimeout(() => finish(false), timeoutMs);
    });
  }

  function noteBackgroundEntry() {
    if (!coupledMode || !platform.useBgControllerRetry) return;
    state.bgHiddenSince = now();
    if (!state.intendedPlaying) {
      state.bgHiddenWasPlaying = false;
      return;
    }
    state.bgHiddenWasPlaying = true;
    try { state.bgHiddenBaseVT = Number(video.currentTime()) || 0; } catch { state.bgHiddenBaseVT = 0; }
    try { state.bgHiddenBaseAT = Number(audio.currentTime) || state.bgHiddenBaseVT; } catch { state.bgHiddenBaseAT = state.bgHiddenBaseVT; }
    try { state.bgHiddenBaseRate = Number(video.playbackRate()) || 1; } catch { state.bgHiddenBaseRate = 1; }
    // Save lastKnownGoodVT precisely when going to background
    updateLastKnownGoodVT();
  }

  async function seamlessBgCatchUp() {
    if (!coupledMode || !platform.useBgControllerRetry) return;
    if (!state.intendedPlaying) return;
    if (state.endedNaturally) return;
    if (MakeSureUnintentionalLoopDoesntEverHappenAtALLManager.shouldBlockAutoRestart()) return;
    if (isTabReturnImmune() || NotMakePlayBackFixingNoticable.isActive()) return;
    if (state.restarting || state.seeking || state.syncing) return;
    if (mediaSessionForcedPauseActive() || userPauseLockActive()) return;
    if (now() < state.bgCatchUpCooldownUntil) return;
    if (state.bgResumeInFlight) return;
    if (!state.firstPlayCommitted && wantsStartupAutoplay() &&
      (state.startupAutoplayRetryTimer || state.startupKickInFlight)) {
      return;
      }
      state.bgResumeInFlight = true;
    state.bgCatchUpCooldownUntil = now() + 50; // minimal cooldown for fastest bg recovery

    const mySession = state.playSessionId;

    try {
      const atNow = Number(audio.currentTime);
      const vtNow = Number(video.currentTime());
      const aPausedNow = !!audio.paused;
      const vPausedNow = getVideoPaused();

      // Abort if session changed while we were getting times
      if (mySession !== state.playSessionId || !state.intendedPlaying) return;

      if (!aPausedNow && !vPausedNow && isFinite(atNow) && isFinite(vtNow)) {
        // Both playing — just let the sync loop handle drift. No seeks needed.
        // Seeking here causes the visible "skip forward" on tab return.
        state.bgHiddenWasPlaying = false;
        state.resumeOnVisible = false;
        setFastSync(1000);
        scheduleSync(0);
        return;
      }

      if (!aPausedNow && isFinite(atNow)) {
        if (mySession !== state.playSessionId || !state.intendedPlaying) return;
        const inBg = isHiddenBackground();
        if (inBg && isFinite(vtNow) && Math.abs(vtNow - atNow) > 0.12) {
          // Background only: silently update video time to keep progress bar in sync.
          bgSilentSyncVideoTime(atNow);
        }
        // Foreground: do NOT seek video to audio position — it causes visible skip.
        // Just restart video from its current position, sync loop handles drift.
        if (!inBg && vPausedNow && !state.isProgrammaticVideoPlay) {
          execProgrammaticVideoPlay();
        }
        state.bgHiddenWasPlaying = false;
        state.resumeOnVisible = false;
        setFastSync(1000);
        scheduleSync(0);
        return;
      }

      if (mySession !== state.playSessionId || !state.intendedPlaying) return;

      // Both paused — this is the main tab-return resume case.
      // Determine best resume position: prefer _pauseSavedPosition (exact pause point),
      // then lastKnownGoodVT, then video, then audio. The old code preferred
      // audio.currentTime which could be far ahead from bg playback — causing the
      // "plays from wrong place on tab return" bug.
      const bestPos = (() => {
        // prefer _pauseSavedPosition — the exact spot the user paused at.
        // stays fresh 5 min so long tab-away sessions still work.
        if (state._pauseSavedPosition > 0.1 && (now() - state._pauseSavedAt) < 300000) {
          return state._pauseSavedPosition;
        }
        if (state.lastKnownGoodVT > 0.5) return state.lastKnownGoodVT;
        if (isFinite(vtNow) && vtNow > 0.5) return vtNow;
        if (isFinite(atNow) && atNow > 0.5) return atNow;
        return 0;
      })();

      state.bgHiddenWasPlaying = false;
      state.resumeOnVisible = false;

      // Seek video forward to bestPos only when it's BEHIND (browser suspended
      // video in background). If video is AHEAD of bestPos — background playback
      // continued naturally — don't seek it back. Update bestPos to vtNow so
      // audio is aligned to video's actual current position.
      const resumePos = (isFinite(vtNow) && vtNow > bestPos) ? vtNow : bestPos;
      if (resumePos > 0.1) {
        // Only seek video forward if it fell behind
        if (isFinite(vtNow) && vtNow < resumePos - 1.5) {
          state._isMicroSeek = true;
          try { getVideoNode().currentTime = resumePos; } catch {}
          setTimeout(() => { state._isMicroSeek = false; }, 200);
        }
        // Sync audio to resumePos (wherever video actually is)
        if (coupledMode && audio && isFinite(atNow) && Math.abs(atNow - resumePos) > 0.5) {
          state._allowAudioTimeWrite = true;
          try { audio.currentTime = resumePos; } catch {}
          state._allowAudioTimeWrite = false;
        }
      }

      if (!state.firstPlayCommitted && wantsStartupAutoplay()) {
        forceZeroBeforeFirstPlay();
      }

      // BPMM gate: prevents play→pause→play oscillation in background.
      // Uses exponential backoff + oscillation circuit-breaker.
      if (!BackgroundPlaybackManagerManager.shouldAttemptBgResume()) {
        state.resumeOnVisible = true;
        return;
      }
      BackgroundPlaybackManager.trackBgResumeAttempt();
      // Fire-and-forget — do NOT await. Awaiting playTogether() here blocks
      // seamlessBgCatchUp, causing the visible freeze on tab return.
      // skipBufferGate: after a long background, video readyState is low and
      // blockOnBuffer would pause both tracks → buffer hold → 1-3s freeze.
      playTogether({ skipBufferGate: true }).catch(() => {});
      if (mySession !== state.playSessionId || !state.intendedPlaying) return;

      // Track success: if both tracks are now playing, reset backoff
      if (coupledMode) {
        if (state.intendedPlaying && !getVideoPaused() && audio && !audio.paused) {
          BackgroundPlaybackManagerManager.onBgPlaySuccess();
        } else if (!getVideoPaused() || (audio && !audio.paused)) {
          // Partial success — at least one track playing, don't backoff hard
        } else {
          // Complete failure — try play again instead of a huge buffer hold.
          // Buffer holds of 15s freeze the video for the user. Just retry.
          BackgroundPlaybackManagerManager.onBrowserForcedPause();
          if (state.intendedPlaying) {
            DONTMAKEITDOUBLEPLAY.resetAll();
            const _nativePlay = HTMLMediaElement.prototype.play;
            const _vn = getVideoNode();
            if (_vn && _vn.paused) try { _nativePlay.call(_vn).catch(() => {}); } catch {}
            if (coupledMode && audio && audio.paused) try { _nativePlay.call(audio).catch(() => {}); } catch {}
          }
        }
      } else if (!getVideoPaused() && state.intendedPlaying) {
        BackgroundPlaybackManagerManager.onBgPlaySuccess();
      } else if (state.intendedPlaying) {
        // Non-coupled failure — retry play instead of 15s buffer hold
        DONTMAKEITDOUBLEPLAY.resetAll();
        const _nativePlay = HTMLMediaElement.prototype.play;
        const _vn = getVideoNode();
        if (_vn && _vn.paused) try { _nativePlay.call(_vn).catch(() => {}); } catch {}
      }
    } finally {
      state.bgResumeInFlight = false;
    }
  }

  // Cancel any active non-coupled buffer wait from a previous armResumeAfterBuffer call
  let _ncBufferWaitCleanup = null;
  function armResumeAfterBuffer(timeoutMs = 9000) {
    // During tab return, cap timeout at 2s — 10-15s buffer holds freeze the UI.
    // The video decoder just needs a moment to wake up, not a 15-second nap.
    if (inBgReturnGrace() || isTabReturnImmune()) {
      timeoutMs = Math.min(timeoutMs, 2000);
    }
    if (!coupledMode) {
      // Cancel previous non-coupled buffer wait to prevent listener leaks
      if (_ncBufferWaitCleanup) { try { _ncBufferWaitCleanup(); } catch {} _ncBufferWaitCleanup = null; }
      if (!state.intendedPlaying || state.restarting || state.seeking) return;
      const vNode = getVideoNode();
      if (!vNode) return;
      let ncDone = false;
      const ncResume = () => {
        if (ncDone) return;
        ncDone = true;
        _ncBufferWaitCleanup = null;
        try { vNode.removeEventListener("canplay", ncCheck); } catch {}
        try { vNode.removeEventListener("canplaythrough", ncCheck); } catch {}
        try { clearTimeout(ncTimeout); } catch {}
        try { clearInterval(ncPoll); } catch {}
        if (!state.intendedPlaying || state.restarting || state.seeking) return;
        clearBufferHold();
        if (getVideoPaused()) execProgrammaticVideoPlay();
      };
        _ncBufferWaitCleanup = ncResume; // store so next call can cancel us
        const ncCheck = () => {
          if (Number(vNode.readyState || 0) >= HAVE_FUTURE_DATA) ncResume();
        };
          if (Number(vNode.readyState || 0) >= HAVE_FUTURE_DATA) { ncResume(); return; }
          try { vNode.addEventListener("canplay", ncCheck, { passive: true }); } catch {}
          try { vNode.addEventListener("canplaythrough", ncCheck, { passive: true }); } catch {}
          const ncPoll = setInterval(ncCheck, 500);
          const ncTimeout = setTimeout(ncResume, timeoutMs);
          return;
    }
    if (!state.intendedPlaying || state.restarting || state.seeking || state.syncing) return;
    if (mediaSessionForcedPauseActive()) return;
    clearResumeAfterBufferTimer();
    const v = getVideoNode();
    let cleaned = false;
    let pollTimer = null;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      if (pollTimer) { clearTimeout(pollTimer); pollTimer = null; }
      try { v.removeEventListener("canplay", onReady); } catch {}
      try { v.removeEventListener("playing", onReady); } catch {}
      try { audio.removeEventListener("canplay", onReady); } catch {}
      try { audio.removeEventListener("playing", onReady); } catch {}
    };
    const tryKick = () => {
      if (!state.intendedPlaying || state.restarting || state.seeking || state.syncing) {
        cleanup(); return;
      }
      if (mediaSessionForcedPauseActive() || userPauseLockActive()) {
        cleanup(); return;
      }
      // stall hold active but video has data? clear it, it's stale.
      // STRICT check: require readyState >= HAVE_FUTURE_DATA AND videoWaiting cleared.
      // The old check (videoReadyForAudioResume) was too lenient and cleared flags
      // while video was still genuinely buffering, letting audio play during stalls.
      if (now() < state.stallAudioResumeHoldUntil) {
        const _arbVNode = getVideoNode();
        const _arbRS = _arbVNode ? Number(_arbVNode.readyState || 0) : 0;
        if (!state.videoWaiting && _arbRS >= HAVE_FUTURE_DATA && !getVideoPaused()) {
          state.stallAudioResumeHoldUntil = 0;
          state.videoStallAudioPaused = false;
          state.stallAudioPausedSince = 0;
          clearForegroundBufferAudioHold();
        } else {
          return;
        }
      }

      const vtNow = Number(video.currentTime());
      const atNow = Number(audio.currentTime);
      const checkTime = Math.max(vtNow, atNow || 0);
      const inBg = document.visibilityState === "hidden" || !isWindowFocused();
      const vNode = getVideoNode();
      const _arbRS2 = vNode ? Number(vNode.readyState || 0) : 0;
      const ready = inBg
      ? (canPlayAt(vNode, checkTime) && canPlayAt(audio, checkTime))
      : (!state.videoWaiting && _arbRS2 >= HAVE_FUTURE_DATA && bothPlayableAt(checkTime));
      if (!ready) return;
      clearBufferHold();
      clearForegroundBufferAudioHold();
      // Clear stall-pause state so shouldBlockNewAudioStart() allows audio through
      state.videoStallAudioPaused = false;
      state.stallAudioPausedSince = 0;
      state.stallAudioResumeHoldUntil = 0;
      setFastSync(1600);
      cleanup();
      // Skip the blockOnBuffer gate — we JUST confirmed media is ready.
      // Without this, playTogether re-checks bothPlayableAt() which can
      // re-arm strictBufferHold, creating an infinite buffer-hold loop.
      if (!inMediaTxnWindow()) playTogether({ skipBufferGate: true }).catch(() => {});
      else scheduleSync(200);
    };
      const onReady = () => { requestAnimationFrame(tryKick); };
      try { v.addEventListener("canplay", onReady, { passive: true }); } catch {}
      try { v.addEventListener("playing", onReady, { passive: true }); } catch {}
      try { audio.addEventListener("canplay", onReady, { passive: true }); } catch {}
      try { audio.addEventListener("playing", onReady, { passive: true }); } catch {}
      const poll = () => {
        if (cleaned) return;
        tryKick();
        // Use a much longer poll interval in background — polling aggressively
        // triggers rapid play→pause→play oscillation when the browser keeps
        // auto-pausing. canplay/playing events fire anyway when media is ready.
        const pollInterval = isHiddenBackground() ? 2000 : 350;
        if (!cleaned) pollTimer = setTimeout(poll, pollInterval);
      };
        pollTimer = setTimeout(poll, isHiddenBackground() ? 1500 : 200);
        state.resumeAfterBufferTimer = setTimeout(() => {
          cleanup();
          state.resumeAfterBufferTimer = null;
          if (state.intendedPlaying && !state.restarting && !state.seeking && !userPauseLockActive()) {
            const vtNow = Number(video.currentTime());
            const atNow = coupledMode && audio ? Number(audio.currentTime) : vtNow;
            const checkTime = Math.max(vtNow, atNow || 0);
            const inBg2 = document.visibilityState === "hidden" || !isWindowFocused();
            const videoNode = getVideoNode();
            const videoReady = inBg2
              ? canPlayAt(videoNode, checkTime)
              : videoReadyForAudioResume(checkTime);
            const rdy = inBg2
            ? (canPlayAt(videoNode, checkTime) && (!coupledMode || canPlayAt(audio, checkTime)))
            : (videoReady && bothPlayableAt(checkTime));
            // Force-clear buffer hold on timeout if video reports ready (audio may lag behind)
            if (rdy || videoReady) {
              clearBufferHold();
              clearForegroundBufferAudioHold();
              state.videoStallAudioPaused = false;
              state.stallAudioPausedSince = 0;
              state.stallAudioResumeHoldUntil = 0;
              playTogether({ skipBufferGate: true }).catch(() => {});
            }
          }
        }, Math.max(2000, Number(timeoutMs) || 0));
  }

  function clearPendingPlayResumesForPause() {
    const userImmediate = directUserToggleActive(1000) || userWantsPauseNow(1000);
    state.userPlayIntentPresetAt = 0;  // cancel any pending play preset
    state.restartFromEndedUntil = 0;
    state.seekAudioMustStartUntil = 0;
    clearFreshForegroundVideoFirst();
    clearForegroundUserPlayRetryTimers();
    clearTransitionDriftTimers();
    clearSeekAudioReadyKick();
    clearSeekResumeIntent();
    cancelActiveFade();
    state.audioPlayGeneration++;

    clearHiddenPlayPending();
    clearBgResumeRetryTimer();
    clearResumeAfterBufferTimer();
    cancelBackgroundResumeState();
    clearBufferHold();
    // Clear stall-pause state — user explicitly paused, so these locks no longer apply
    state.videoStallAudioPaused = false;
    state.stallAudioPausedSince = 0;
    state.stallAudioResumeHoldUntil = 0;
    state.startupAudioHoldUntil = 0;
    state.audioPlayUntil = Math.max(state.audioPlayUntil, now() + (userImmediate ? 140 : 400));
    setPauseEventGuard(userImmediate ? 700 : 1600);
    setMediaPauseTxn(userImmediate ? USER_MEDIA_PAUSE_TXN_FAST_MS : 1600);
    if (platform.chromiumOnlyBrowser) {
      state.chromiumPauseGuardUntil = Math.max(state.chromiumPauseGuardUntil, now() + (userImmediate ? 800 : 2000));
      state.chromiumAudioStartLockUntil = Math.max(state.chromiumAudioStartLockUntil, now() + (userImmediate ? 950 : 2200));
      state.chromiumBgSettlingUntil = Math.max(state.chromiumBgSettlingUntil, now() + (userImmediate ? 700 : 1600));
    }
  }

  function queueHardPauseVerification(msList = [0, 120, 300, 600, 1000]) {
    const serial = ++state.hardPauseVerifySerial;
    for (const delay of msList) {
      setTimeout(() => {
        if (serial !== state.hardPauseVerifySerial) return;
        if (state.intendedPlaying || userPlayIntentActive()) return;
        if (startupSettleActive()) return;
        try { if (!getVideoPaused()) execProgrammaticVideoPause(); } catch {}
        try { if (coupledMode && !audio.paused) execProgrammaticAudioPause(500); } catch {}
        clearSyncLoop();
      }, delay);
    }
  }

  function pauseHard() {
    const immediateUserPause = directUserToggleActive(1000) || userWantsPauseNow(1000) || userToggleExpectingPause();
    const pauseFadeMs = immediateUserPause ? USER_EXPLICIT_PAUSE_FADE_MS : AUDIO_FADE_DURATION_MS;
    const flagReleaseMs = immediateUserPause ? USER_PROGRAMMATIC_FLAG_CLEAR_MS : 250;
    // Cancel deferred audio pause — pauseHard will handle audio directly
    if (state._deferredAudioPauseTimer) {
      clearTimeout(state._deferredAudioPauseTimer);
      state._deferredAudioPauseTimer = null;
    }
    state.userPauseIntentPresetAt = 0;
    state.restartFromEndedUntil = 0;
    state.seekAudioMustStartUntil = 0;
    clearSeekResumeIntent();
    clearForegroundUserPlayRetryTimers();
    clearTransitionDriftTimers();
    clearFreshForegroundVideoFirst();
    disengagePauseIntercept();
    clearSeekBuffering();
    clearHiddenPlayPending();
    clearBgResumeRetryTimer();
    clearResumeAfterBufferTimer();
    try { MakeSureAudioOrVideoDoesntPauseUnlessUserReallyWantsTo.stop(); } catch {}
    try { NuclearFreezeWatchdog.stop(); } catch {}

    state.isProgrammaticVideoPause = true;
    try { video.pause(); } catch {}
    try { videoEl.pause(); } catch {}
    try {
      const v = getVideoNode();
      if (v && v !== videoEl && !v.paused) v.pause();
    } catch {}
    try {
      const inner = video?.el?.()?.querySelector?.("video");
      if (inner && !inner.paused) inner.pause();
    } catch {}
    setTimeout(() => { state.isProgrammaticVideoPause = false; }, flagReleaseMs);

    if (coupledMode && audio) {
      state.audioPauseUntil = Math.max(state.audioPauseUntil, now() + (immediateUserPause ? 120 : 300));
      state.audioPlayUntil = Math.max(state.audioPlayUntil, now() + (immediateUserPause ? 120 : 250));
      state.audioPlayGeneration++;
      state.isProgrammaticAudioPause = true;

      if (immediateUserPause) {
        // INSTANT pause for user actions — no fade, no async delay.
        // The old 16ms fade + async callback added perceptible latency that
        // the user heard as a 0.1s audio tail after pressing pause.
        cancelActiveFade();
        try { audio.volume = 0; } catch {}
        try { audio.pause(); } catch {}
        setTimeout(() => {
          state.isProgrammaticAudioPause = false;
          // Restore volume for next play (volume is set by play path)
        }, USER_PROGRAMMATIC_FLAG_CLEAR_MS);
      } else if (!audio.paused && audio.volume > 0.015) {
        // Programmatic pause: short fade to avoid pop
        const pauseSession = state.playSessionId;
        fadeAndPauseAudio(pauseFadeMs, () => {
          if (state.playSessionId !== pauseSession || state.intendedPlaying) {
            setTimeout(() => { state.isProgrammaticAudioPause = false; }, Math.min(100, flagReleaseMs));
            return;
          }
          setTimeout(() => { state.isProgrammaticAudioPause = false; }, 200);
        });
      } else {
        cancelActiveFade();
        try { audio.pause(); } catch {}
        setTimeout(() => { state.isProgrammaticAudioPause = false; }, 150);
      }
    } else if (!coupledMode && audio && !audio.paused) {
      // Non-coupled mode (e.g. quality=medium): audio element exists but has no source.
      // Keep it permanently silent — it must never play anything.
      try { audio.muted = true; audio.volume = 0; audio.pause(); } catch {}
    }

    clearSyncLoop();
    if (!state.intendedPlaying) queueHardPauseVerification();
  }

  function pauseTogether() {
    if (detectLoop()) {
      state.intendedPlaying = false;
      pauseHard();
      return;
    }
    // Allow immediate user actions through startupSettle gate
    const _immediateAction = BackgroundPlaybackManager.isUserPauseImmediate();
    if (startupSettleActive() && !_immediateAction && !userPauseIntentActive() && !mediaSessionForcedPauseActive()) return;
    state.intendedPlaying = false;
    state.bufferHoldIntendedPlaying = false;
    state.resumeOnVisible = false;
    state.bgHiddenWasPlaying = false;
    state.tabReturnImmuneUntil = 0;
    disengagePauseIntercept();
    clearBufferHold();
    state.playSessionId = (state.playSessionId || 0) + 1;
    updateMediaSessionPlaybackState();
    if (!state.syncing && !state.seeking) pauseHard();
    else queueHardPauseVerification();
  }

  // Always seek both tracks to 0 before first play, unconditionally.
  // The browser can pre-buffer a background tab's video at a non-zero position;
  // the old "give up if vt > 0.5" logic caused autoplay to start mid-video.
  function forceZeroBeforeFirstPlay() {
    // Never after play has started
    if (state.firstPlayCommitted || startupZeroSuppressed()) return;
    // Allow re-runs — browser can move currentTime forward via keyframe buffering
    // after our first zero-set. Re-zeroing is harmless and prevents mid-video starts.
    state.startupZeroed = true;
    state._isMicroSeek = true;
    try { video.currentTime(0); } catch {}
    try {
      safeSetCT(videoEl, 0);
      const v = getVideoNode();
      if (v && v !== videoEl) safeSetCT(v, 0);
    } catch {}
    if (coupledMode && audio) {
      try { audio.currentTime = 0; } catch {}
    }
    state.lastKnownGoodVT = 0;
    state.lastKnownGoodVTts = now();
    setTimeout(() => { state._isMicroSeek = false; }, 250);
  }

  function ensureStartupZeroed() { forceZeroBeforeFirstPlay(); }

  async function playTogether(opts = {}) {
    const _skipBufferGate = !!opts.skipBufferGate;
    // Error overlay active — all playback is dead
    if (_errorOverlayShown) return;
    // Never restart after ended. onUserPlay() (called from capture-phase
    // click/keyboard handlers) clears endedNaturally BEFORE this runs.
    // If endedNaturally is still true here, it's a programmatic call — block it.
    if (state.endedNaturally && !state.restarting && !isLoopDesired()) return;
    state.userPlayIntentPresetAt = 0;
    // Never trigger loop detection during tab-return immunity
    if (!(state.tabReturnImmuneUntil > now()) && detectLoop()) {
      state.intendedPlaying = false;
      pauseHard();
      return;
    }

    if (!coupledMode) {
      if (!state.intendedPlaying && state.firstPlayCommitted) return;
      if (MediumQualityManager.intentPaused && state.firstPlayCommitted) {
        if (!getVideoPaused()) execProgrammaticVideoPause();
        state.intendedPlaying = false;
        updateMediaSessionPlaybackState();
        return;
      }
      if (getVideoPaused()) {
        try { await Promise.resolve(execProgrammaticVideoPlay()); } catch {}
      }
      state.intendedPlaying = !getVideoPaused();
      updateMediaSessionPlaybackState();
      setFastSync(1600);
      scheduleSync(0);
      return;
    }
    if (state.syncing || state.restarting) return;
    if (mediaSessionForcedPauseActive()) return;
    if (userPauseLockActive()) return;

    const mySession = state.playSessionId;
    state.syncing = true;
    setFastSync(1600);
    try {
      if (!state.intendedPlaying || mySession !== state.playSessionId) return;

      if (!state.firstPlayCommitted && wantsStartupAutoplay()) {
        forceZeroBeforeFirstPlay();
      }

      // if the browser moved currentTime forward during keyframe buffering,
      // yank it back to 0. forceZeroBeforeFirstPlay set ct=0 but async
      // buffering can move it to a keyframe at 1-2s.
      //
      // only do this before firstPlayCommitted. startupPhase stays true for
      // 500-800ms AFTER commit, so using that gate would rewind a playing
      // video → visible "start → seek-back → play" glitch.
      //
      // also require the video to be paused — never rewind something that's
      // currently playing.
      if (!state.firstPlayCommitted && !startupZeroSuppressed() && getVideoPaused() && !state.startupZeroed) {
        // Only re-zero if forceZeroBeforeFirstPlay hasn't run yet.
        // Re-zeroing after it already ran causes a visible seek-back glitch.
        const _preVt = Number(video.currentTime()) || 0;
        if (_preVt > 0.5) {
          try { video.currentTime(0); } catch {}
          try { videoEl.currentTime = 0; } catch {}
          try { const _vn = getVideoNode(); if (_vn && _vn !== videoEl) _vn.currentTime = 0; } catch {}
          if (coupledMode && audio) { try { audio.currentTime = 0; } catch {} }
        }
      }

      const vtStart = Number(video.currentTime()) || 0;

      // only seek audio if it's not primed yet AND audio position is actually wrong.
      // if audio is already playing in sync, seeking causes an audible skip.
      if (state.startupPhase && !state.startupPrimed && vtStart > 0.8) {
        const _ptAt = Number(audio.currentTime) || 0;
        if (Math.abs(_ptAt - vtStart) > 1.0 || (audio.paused && Math.abs(_ptAt - vtStart) > 0.5)) {
          safeSetAudioTime(vtStart);
        }
      }
      forceUnmuteForPlaybackIfAllowed();
      const inBackground = document.visibilityState === "hidden" || !isWindowFocused();
      // On tab return, don't apply strict buffer gate — video was playing in background and has buffer
      const bypassBufferForBgReturn = inBgReturnGrace();
      // Don't pause-to-buffer during startup — it creates a visible play-pause.
      // Let the browser buffer naturally while playing; the video will stall
      // briefly if needed, which is less jarring than an explicit pause+resume.
      const isStartupKick = state.startupPhase || !state.firstPlayCommitted;
      const isRecentUserPlay = userWantsPlayNow(2400) || userSeekIntentActive();
      const blockOnBuffer =
      !_skipBufferGate &&
      !isStartupKick &&
      !isRecentUserPlay &&
      !bypassBufferForBgReturn &&
      !inBackground &&
      !startupSettleActive() &&
      (state.startupPrimed || state.audioEverStarted) &&
      (state.audioEverStarted ? !bothPlayableAt(vtStart) : !canPlaySmoothAt(getVideoNode(), vtStart, STRICT_BUFFER_AHEAD_SEC));
      if (blockOnBuffer) {
        state.strictBufferHold = true;
        if (!state.bufferHoldSince) state.bufferHoldSince = now();
        state.strictBufferReason = "strict-play-gate";
        state.bufferHoldIntendedPlaying = state.intendedPlaying;
        execProgrammaticVideoPause();
        execProgrammaticAudioPause(350);
        await quietSeekAudio(vtStart);
        armResumeAfterBuffer(10000);
        return;
      }
      clearBufferHold();
      const vt = Number(video.currentTime());
      const at = Number(audio.currentTime);
      const directVisibleVideoLead = shouldRequireVisibleVideoLeadForDirectUserPlay();
      const freshVideoFirst = shouldKeepForegroundReturnVideoFirst();
      const requireVisibleVideoHealth =
        shouldRequireVisibleVideoHealthForForegroundPlay() ||
        directVisibleVideoLead;

      const inBgDrift = document.visibilityState === "hidden" || !isWindowFocused() || inBgReturnGrace();
      const recentDirectToggle =
        directUserToggleActive(1400) ||
        userPlayIntentActive() ||
        userPauseIntentActive() ||
        userToggleTxnActive();
      let earlyUserVideoKick = null;
      if (recentDirectToggle && getVideoPaused()) {
        try { earlyUserVideoKick = execProgrammaticVideoPlay({ force: true, minGapMs: 0 }); } catch {}
        // Arm compositor flush: when user presses play after returning from
        // background, the video decoder may need time to produce the first
        // frame. VCFM detects if the compositor is showing a stale GPU
        // texture and force-flushes it with micro-seeks. Without this,
        // video appears frozen for 1-5s while audio plays normally.
        // Only do compositor flush for GENUINE tab returns (within 5s), not every
        // play/pause for 30 seconds. The old 30s window caused "random seeks" on
        // every play/pause toggle for half a minute after returning to the tab.
        const _ptGenuineTabReturn = shouldTreatUpcomingPlayAsFreshForegroundStart() ||
          inBgReturnGrace() || isTabReturnImmune();
        if (_ptGenuineTabReturn) {
          // Don't do preemptive micro-seeks here — they cause visible "random seek"
          // on play/pause. Instead, just arm VCFM which uses RVFC (no-seek) to
          // verify compositor health. If RVFC confirms freeze, VCFM will do ONE
          // controlled micro-seek after the play/pause transition settles.
          try { VideoCompositorFlushManager.arm(); } catch {}
        }
      }
      const shouldDeferAudioAlignmentForVideoLead =
        document.visibilityState === "visible" &&
        isWindowFocused() &&
        requireVisibleVideoHealth;
      // Align audio to video position. During startup and background returns,
      // sync on medium drift — both elements may be at arbitrary positions.
      // For mid-playback play/pause, only hard-sync on large drift (>1.5s).
      // The 0.15s old threshold caused decoder resets on every startup even
      // for tiny drift, adding 100-300ms of audio pipeline latency before
      // sound could start. 0.4s is still very small and the sync loop handles
      // anything under that via rate correction without a decoder flush.
      const _isStartupOrBgSync = state.startupPhase || !state.firstPlayCommitted ||
        !state.audioEverStarted || inBgReturnGrace() || isTabReturnImmune();
      const _syncThreshold = _isStartupOrBgSync ? 0.3 : 1.5;
      if (!shouldDeferAudioAlignmentForVideoLead &&
          isFinite(vt) &&
          isFinite(at) &&
          Math.abs(at - vt) > _syncThreshold) {
        if (audio.paused || _isStartupOrBgSync) {
          state._allowAudioTimeWrite = true;
          try { audio.currentTime = vt; } catch {}
          state._allowAudioTimeWrite = false;
        }
      }

      // Re-check after await
      if (!state.intendedPlaying || mySession !== state.playSessionId) return;

      let videoOk = true;
      let audioOk = true;
      let vPlayP = earlyUserVideoKick;
      let aPlayP = null;

      if (getVideoPaused() && !vPlayP) {
        // NOTE: Do NOT micro-seek here to "flush the compositor." Pre-play
        // micro-seeks (even 0.001s backward) cause TWO artifacts:
        //   1. "video randomly seeks" — the browser fires seeking/seeked events
        //   2. "frozen frame from future" — the seek itself triggers the decoder
        //      to briefly show the nearest keyframe (which can be 0.5-2s ahead)
        //      before settling on the seek target.
        // Instead, rely on the RAF freeze detector (INVARIANT 2) which only
        // micro-seeks when frames are CONFIRMED frozen (not advancing). The
        // reduced 200ms transition block lets it kick faster than the old 400ms.
        try {
          vPlayP = execProgrammaticVideoPlay();
        } catch {}
      }

      if (coupledMode && audio && audio.paused) {
        const vNow = Number(video.currentTime()) || 0;
        const aNow = Number(audio.currentTime) || 0;
        const avDrift = Math.abs(aNow - vNow);
        const canKickFirstAudio = !state.audioEverStarted && canStartAudioAt(vNow);
        const inStartupKickFlow = state.startupKickInFlight || isTabReturnImmune();
        const isRecentUserAction = userWantsPlayNow(2400) || userSeekIntentActive();
        const isDirectUserToggle = directUserToggleActive(2800) || userToggleExpectingPlay();
        // Skip all audio hold gates for user-initiated plays AND startup autoplay —
        // audio must start immediately. The gates exist for mid-playback scenarios
        // (stall recovery, tab return) not initial startup. Holding audio during
        // startup is the root cause of "audio plays really late."
        const isStartupAutoplay = state.startupPhase || !state.firstPlayCommitted || state.startupKickInFlight;
        // Clear stale videoWaiting before checking — if readyState confirms video has
        // data, videoWaiting is from a past stall that resolved. Without this, a quick
        // play/pause/play gets blocked by a stale flag and video "waits for something."
        const _ptVNode = getVideoNode();
        const _ptRS = _ptVNode ? Number(_ptVNode.readyState || 0) : 4;
        if (state.videoWaiting && _ptRS >= HAVE_FUTURE_DATA) {
          state.videoWaiting = false;
          state.videoStallSince = 0;
        }
        const shouldHoldAudio = !isRecentUserAction && !isStartupAutoplay && !isDirectUserToggle && (
          state.strictBufferHold ||
          shouldBlockNewAudioStart() ||
          (!inStartupKickFlow && UltraStabilizer.shouldBlockAudioAtStartup()) ||
          (document.visibilityState === "visible" && state.videoWaiting));

        if (requireVisibleVideoHealth && !isDirectUserToggle && !isRecentUserAction) {
          // Fresh user play right after tab return: keep audio from getting ahead
          // of a decoder/pipeline that is still waking the video path back up.
          // EXCEPTION: direct user play toggle always starts audio immediately —
          // the user clicked play and expects instant response, not a frozen wait.
        } else if (shouldHoldAudio) {
          if (state.videoWaiting) armResumeAfterBuffer(10000);
        } else if (!isRecentUserAction && !canKickFirstAudio && startupAudioHoldActive()) {
          // hold
        } else {
          // Only hard-resync on user toggles when drift is genuinely large (>1.5s)
          // or when a seek just happened. For play/pause toggles, decoders pause at
          // nearly identical positions — the old 0.8s threshold triggered hard audio
          // seeks from decoder jitter, causing an audible "skip" every time.
          // Sub-1.5s drift is handled smoothly by the rate sync system.
          if (isRecentUserAction && isFinite(vNow) && vNow >= 0 && (avDrift > 1.5 || userSeekIntentActive())) {
            state._allowAudioTimeWrite = true;
            try { audio.currentTime = vNow; } catch {}
            state._allowAudioTimeWrite = false;
          } else if (avDrift > 1.5) {
            // Only seek for large drift. Small drift (<1.5s) from play/pause
            // toggle is normal — rate sync handles it without audible artifact.
            // The old safeSetAudioTime call here triggered seeks for 0.8s drift,
            // causing the audio "repeat" glitch on every play/pause cycle.
            safeSetAudioTime(vNow);
          }
          aPlayP = execProgrammaticAudioPlay({
            // Use minimal squelch so audio starts simultaneously with video.
            // 80ms is enough to let the play() call settle without audible artifacts.
            squelchMs: canKickFirstAudio ? 80 : 80,
            minGapMs: 0,
            force: true
          });
        }
      } else if (coupledMode && audio && !audio.paused) {
        if (!state.audioFading) {
          const targetVol = targetVolFromVideo();
          if (Math.abs(audio.volume - targetVol) > 0.02) {
            softUnmuteAudio(AUDIO_SAFE_FADE_DURATION_MS).catch(() => {});
          }
        }
      }

      if (vPlayP && vPlayP.then) await vPlayP.catch(() => {});
      if (requireVisibleVideoHealth) {
        const healthBaseVt =
          isFinite(Number(state.freshForegroundVideoFirstBaseVT))
            ? Number(state.freshForegroundVideoFirstBaseVT)
            : (isFinite(vtStart) ? vtStart : 0);
        const healthArmedAt =
          Number(state.freshForegroundVideoFirstArmedAt) ||
          Number(state.lastUserToggleAt) ||
          0;
        videoOk = directUserVideoPlaybackHealthy(healthBaseVt, healthArmedAt, true);
      } else {
        videoOk = !getVideoPaused();
      }

      if (!state.intendedPlaying || userPauseLockActive() || mySession !== state.playSessionId) {
        if (!getVideoPaused()) execProgrammaticVideoPause();
        if (coupledMode && !audio.paused) execProgrammaticAudioPause(100);
        return;
      }

      if (aPlayP) {
        audioOk = await aPlayP.catch(() => false);
      } else {
        audioOk = coupledMode ? !audio.paused : true;
      }

      if (!state.intendedPlaying || userPauseLockActive() || mySession !== state.playSessionId) {
        if (!getVideoPaused()) execProgrammaticVideoPause();
        if (coupledMode && !audio.paused) execProgrammaticAudioPause(100);
        return;
      }

      if (videoOk) {
        forceUnmuteForPlaybackIfAllowed();
        if (coupledMode && audio && (audio.paused || audio.volume < 0.05)) {
          softUnmuteAudio(AUDIO_SAFE_FADE_DURATION_MS).catch(() => {});
        }
        if (recentDirectToggle && document.visibilityState === "visible" && isWindowFocused()) {
          armTransitionDriftSettleForPlay(mySession);
        }
      }

      if (!videoOk && !audioOk) {
        if ((requireVisibleVideoHealth || shouldKeepForegroundReturnVideoFirst()) && !inBgReturnGrace()) {
          startForegroundUserPlayRetry();
          if (!state.strictBufferHold) armResumeAfterBuffer(5000);
        } else if (inBgReturnGrace() && state.intendedPlaying) {
          // Tab return: both failed, just retry play directly instead of long buffer holds
          const _nPlay = HTMLMediaElement.prototype.play;
          const _vn = getVideoNode();
          setTimeout(() => {
            if (!state.intendedPlaying) return;
            if (_vn && _vn.paused) try { _nPlay.call(_vn).catch(() => {}); } catch {}
            if (coupledMode && audio && audio.paused) try { _nPlay.call(audio).catch(() => {}); } catch {}
          }, 200);
        } else if (isHiddenBackground() && state.intendedPlaying) {
          state.resumeOnVisible = true;
        } else if (!state.firstPlayCommitted || (state.startupPhase && !state.audioEverStarted)) {
          // --- startup guard for dual-fail
          armResumeAfterBuffer(8000);
        } else if (state.intendedPlaying && (inBgReturnGrace() || state.seeking || state.seekBuffering || state.networkRecoverUntil > now())) {
          // Transient failure during tab return, seek, or network recovery — don't kill intendedPlaying,
          // arm buffer recovery instead so playback retries automatically.
          armResumeAfterBuffer(5000);
        } else {
          state.intendedPlaying = false;
          state.playSessionId = (state.playSessionId || 0) + 1;
          pauseHard();
          updateMediaSessionPlaybackState();
        }
        return;
      } else if (!videoOk && audioOk) {
        if (requireVisibleVideoHealth || shouldKeepForegroundReturnVideoFirst()) {
          // During tab return, do NOT pause audio or arm long buffer holds —
          // just retry video. The decoder needs warmup time, not a full restart.
          if (inBgReturnGrace()) {
            const _retSess = mySession;
            setTimeout(() => {
              if (!state.intendedPlaying || _retSess !== state.playSessionId) return;
              if (!getVideoPaused()) return;
              execProgrammaticVideoPlay();
            }, 150);
            return;
          }
          execProgrammaticAudioPause(120);
          startForegroundUserPlayRetry();
          if (!state.strictBufferHold) armResumeAfterBuffer(5000);
          return;
        }
        if (isHiddenBackground() && state.bgPlaybackAllowed) {
          // ok — audio-only background playback is allowed
        } else if (inBgReturnGrace() && !isHiddenBackground()) {
          // Tab return: audio is going, video just needs a moment — retry video instead of stopping audio
          const retrySession = mySession;
          setTimeout(() => {
            if (!state.intendedPlaying || retrySession !== state.playSessionId) return;
            if (!getVideoPaused()) return;
            execProgrammaticVideoPlay();
          }, TAB_RETURN_AUDIO_RETRY_DELAY_MS);
        } else if (state.startupPhase || !state.audioEverStarted) {
          // During startup: keep intendedPlaying=true. Audio started but video failed —
          // pause audio and arm buffer retry. The startup mechanism handles the restart.
          // Setting intendedPlaying=false here creates the visible first-30s oscillation.
          execProgrammaticAudioPause(350);
          armResumeAfterBuffer(8000);
        } else if (document.visibilityState !== "hidden" && isWindowFocused()) {
          execProgrammaticAudioPause(350);
          state.intendedPlaying = false;
          state.playSessionId = (state.playSessionId || 0) + 1;
          updateMediaSessionPlaybackState();
        } else if (coupledMode) {
          execProgrammaticAudioPause(350);
          if (state.intendedPlaying) state.resumeOnVisible = true;
        }
      } else if (videoOk && !audioOk) {
        if (freshForegroundVideoFirstPending()) {
          return;
        }
        if (coupledMode && isHiddenBackground() && state.intendedPlaying) {
          state.resumeOnVisible = true;
        }
      }

      const vp = getVideoPaused();
      const ap = !!audio.paused;
      if (!vp && ap && !state.strictBufferHold && !state.videoWaiting && !freshForegroundVideoFirstPending()) {
        const cur = Number(video.currentTime()) || 0;
        if (!shouldBlockNewAudioStart() && canStartAudioAt(cur)) {
          safeSetAudioTime(cur);
          const audioStarted = await execProgrammaticAudioPlay({ squelchMs: 450, force: true, minGapMs: 0 }).catch(() => false);

          if (!state.intendedPlaying || userPauseLockActive() || mySession !== state.playSessionId) {
            if (!getVideoPaused()) execProgrammaticVideoPause();
            if (coupledMode && !audio.paused) execProgrammaticAudioPause(100);
            return;
          }

          if (!audioStarted && !state.strictBufferHold && !state.videoWaiting && !shouldBlockNewAudioStart()) {
            if (coupledMode) {
              if (inBgReturnGrace() && !isHiddenBackground()) {
                // Tab return: video is playing fine — just retry audio after a brief delay
                // Never pause video or abandon intendedPlaying during bg return grace
                const retrySession = mySession;
                setTimeout(() => {
                  if (!state.intendedPlaying || retrySession !== state.playSessionId) return;
                  if (getVideoPaused()) return;
                  execProgrammaticAudioPlay({ force: true, squelchMs: 500, minGapMs: 0 }).catch(() => {});
                  softUnmuteAudio(AUDIO_SAFE_FADE_DURATION_MS).catch(() => {});
                }, TAB_RETURN_AUDIO_RETRY_DELAY_MS);
              } else if (state.startupPhase || !state.audioEverStarted) {
                // Audio failed to start — wait for buffer, don't reset position
                armResumeAfterBuffer(8000);
              } else {
                execProgrammaticVideoPause();
                if (isHiddenBackground()) {
                  state.resumeOnVisible = true;
                } else {
                  state.intendedPlaying = false;
                  state.playSessionId = (state.playSessionId || 0) + 1;
                  updateMediaSessionPlaybackState();
                }
              }
            } else if (document.visibilityState !== "hidden" && isWindowFocused()) {
              execProgrammaticVideoPause();
              state.intendedPlaying = false;
              state.playSessionId = (state.playSessionId || 0) + 1;
              updateMediaSessionPlaybackState();
            }
          }
        } else if (!shouldBlockNewAudioStart()) {
          if (coupledMode) {
            if (isHiddenBackground()) {
              state.resumeOnVisible = true;
            } else {
              armResumeAfterBuffer(10000);
            }
          } else if (document.visibilityState !== "hidden" && isWindowFocused()) {
            execProgrammaticVideoPause();
            armResumeAfterBuffer(10000);
          }
        }
      }
      if (vp && !ap) {
        if (requireVisibleVideoHealth || shouldKeepForegroundReturnVideoFirst()) {
          execProgrammaticAudioPause(120);
          if (state.intendedPlaying) startForegroundUserPlayRetry();
        } else if (document.visibilityState === "hidden" || !isWindowFocused() || isVisibilityTransitionActive() || isAltTabTransitionActive()) {
          // Background / transition: video paused but audio still playing.
          // Silently update video.currentTime so the progress bar stays correct,
          // without triggering full seek machinery (which can deadlock in background).
          bgSilentSyncVideoTime(Number(audio.currentTime));
        } else {
          // Foreground stable: video paused but audio playing is not allowed — pause audio.
          execProgrammaticAudioPause(350);
        }
      }
      if (!state.audioFading && audio.volume < 0.05 && !audio.paused) {
        softUnmuteAudio(AUDIO_SAFE_FADE_DURATION_MS).catch(() => {});
      }
      if (!state.firstPlayCommitted) {
        if (!getVideoPaused() && (!coupledMode || !audio.paused)) {
          state.startupKickDone = true;
          state.firstPlayCommitted = true;
          clearStartupAutoplayRetryTimer();
          setTimeout(() => { state.startupPhase = false; }, 800);
          setTimeout(() => { state.startupPlaySettled = true; }, STARTUP_SETTLE_MS);
        }
      }
      updateMediaSessionPlaybackState();
      scheduleSync(0);
    } finally {
      state.syncing = false;
    }
  }

  function clearSeekBuffering() {
    state.seekBuffering = false;
    if (state.seekBufferResumeTimer) {
      clearTimeout(state.seekBufferResumeTimer);
      state.seekBufferResumeTimer = null;
    }
  }

  function startSeekBufferWait(forCoupled) {
    const wantedPlaying = shouldResumeAfterSeek();
    if (!wantedPlaying) return false;
    state.intendedPlaying = true;
    state.bufferHoldIntendedPlaying = true;
    const fastUserSeek = userSeekIntentActive() || (state.seekAudioMustStartUntil > now());

    const vNode = getVideoNode();
    const vRS = Number(vNode?.readyState || 0);

    // Check if VIDEO is buffered at seek position (audio handles its own buffering)
    const seekPos = Number(video.currentTime()) || 0;
    let videoBuffered = false;
    try {
      const buf = vNode.buffered;
      for (let i = 0; i < buf.length; i++) {
        if (buf.start(i) <= seekPos + 0.2 && buf.end(i) > seekPos) { videoBuffered = true; break; }
      }
    } catch {}

    // Video buffered → no need to wait (audio syncs via playTogether)
    if (videoBuffered) return false;
    if (vRS >= HAVE_CURRENT_DATA) return false;

    // Enter seek-buffering state
    state.seekBuffering = true;
    state.strictBufferHold = true;
    if (!state.bufferHoldSince) state.bufferHoldSince = now();
    state.strictBufferReason = forCoupled ? "seek-buffer" : "seek-buffer-nc";
    state.bufferHoldIntendedPlaying = true;
    state.loopPreventionCooldownUntil = now() + 8000;

    let done = false;
    const resume = () => {
      if (done) return;
      done = true;
      try { vNode.removeEventListener("canplay", onReady); } catch {}
      try { vNode.removeEventListener("canplaythrough", onReady); } catch {}
      try { vNode.removeEventListener("playing", onReady); } catch {}
      try { vNode.removeEventListener("progress", onReady); } catch {}
      try { clearTimeout(fallbackTimer); } catch {}
      try { clearInterval(pollTimer); } catch {}
      state.seekBuffering = false;
      state.seekBufferResumeTimer = null;
      clearBufferHold();
      if (state.restarting) return;
      if (!shouldResumeAfterSeek()) return;
      state.intendedPlaying = true;
      state.bufferHoldIntendedPlaying = true;
      state.seekStabilizeUntil = Math.max(state.seekStabilizeUntil, now() + 1500);
      const _resumePos = Number(video.currentTime()) || 0;
      const _resumeRs = Number(vNode?.readyState || 0);
      const _resumePlayable = _resumeRs >= HAVE_CURRENT_DATA || canPlayAt(vNode, _resumePos);
      if (!_resumePlayable) {
        // Fallback fired before media was truly ready. Keep an active buffer-resume
        // watchdog so playback still starts automatically once buffering completes.
        armResumeAfterBuffer(12000);
      }
      // Final audio sync before resume — skip during tab-return immunity to avoid replay
      if (coupledMode && audio && !isTabReturnImmune() && !NotMakePlayBackFixingNoticable.shouldBlockSeek()) {
        const _vt = Number(video.currentTime()) || 0;
        const _at = Number(audio.currentTime) || 0;
        // Never seek audio backward to near 0 when it's playing into the track
        const _wouldRestart = _vt < 0.5 && _at > 0.5 && state.firstPlayCommitted && !state.restarting && !isLoopDesired();
        if (isFinite(_vt) && !_wouldRestart) {
          try { audio.currentTime = _vt; } catch {}
        }
      }
      if (forCoupled) {
        state.seekResumeInFlight = true;
        state.seekResumeStartedAt = now();
        state.videoWaiting = false;
        state.videoStallAudioPaused = false;
        state.stallAudioPausedSince = 0;
        state.stallAudioResumeHoldUntil = 0;
        state.audioPauseUntil = 0;
        state.audioEventsSquelchedUntil = 0;
        state.isProgrammaticAudioPause = false;
        // Resume seek as soon as video becomes minimally playable.
        // Directly kick both tracks first (low latency), then run playTogether
        // as a fast follow-up aligner.
        if (getVideoPaused()) execProgrammaticVideoPlay();
        if (audio) {
          const _sVt = Number(video.currentTime()) || 0;
          if (isFinite(_sVt)) safeSetAudioTime(_sVt);
          try { audio.volume = targetVolFromVideo(); } catch {}
          state.audioStartGraceUntil = Math.max(state.audioStartGraceUntil, now() + 500);
          execProgrammaticAudioPlay({ squelchMs: 140, force: true, minGapMs: 0 }).catch(() => {});
          armSeekAudioReadyKick(state.seekId, 2800);
        }
        setTimeout(() => {
          if (!state.intendedPlaying || state.restarting || state.seeking) return;
          playTogether().catch(() => {});
        }, 80);
        setTimeout(() => { state.seekResumeInFlight = false; }, 600);
      } else {
        state.isProgrammaticVideoPlay = true;
        try { video.play(); } catch {}
        try { videoEl.play(); } catch {}
        try {
          const inner = video?.el?.()?.querySelector?.("video");
          if (inner) inner.play().catch(() => {});
        } catch {}
        setTimeout(() => { state.isProgrammaticVideoPlay = false; }, 250);
        updateMediaSessionPlaybackState();
      }
      setTimeout(() => {
        if (!state.seeking && !state.seekBuffering && !state.restarting) {
          clearSeekResumeIntent();
        }
      }, 2600);
    };
    const onReady = () => {
      const rs = Number(vNode?.readyState || 0);
      if (rs >= HAVE_CURRENT_DATA) resume();
    };
      try { vNode.addEventListener("canplay", onReady, { passive: true }); } catch {}
      try { vNode.addEventListener("canplaythrough", onReady, { passive: true }); } catch {}
      try { vNode.addEventListener("playing", onReady, { passive: true }); } catch {}
      // Also listen for progress/timeupdate events as buffer-ready signals
      try { vNode.addEventListener("progress", onReady, { passive: true }); } catch {}
      const pollTimer = setInterval(() => {
        if (done) { clearInterval(pollTimer); return; }
        const rs = Number(vNode?.readyState || 0);
        let vBuf = false;
        try {
          const pos = Number(video.currentTime()) || 0;
          const buf = vNode.buffered;
          for (let i = 0; i < buf.length; i++) {
            if (buf.start(i) <= pos + 0.1 && buf.end(i) >= pos + 0.2) { vBuf = true; break; }
          }
        } catch {}
        if (rs >= HAVE_CURRENT_DATA || vBuf) resume();
      }, fastUserSeek ? 80 : 150);
        const fallbackTimer = setTimeout(resume, fastUserSeek ? 700 : 1200);
        state.seekBufferResumeTimer = fallbackTimer;
        return true;
  }

  async function finalizeSeekSync(currentSeekId) {
    if (!coupledMode) {
      if (state.seekId !== currentSeekId) return;
      const wantedPlaying = shouldResumeAfterSeek();
      if (wantedPlaying) {
        state.intendedPlaying = true;
        state.bufferHoldIntendedPlaying = true;
      } else {
        clearSeekResumeIntent();
      }

      // Bridge seeking→seekBuffering with zero gap so no events leak through
      if (wantedPlaying) {
        state.seekBuffering = true;
        state.strictBufferHold = true;
        state.bufferHoldIntendedPlaying = true;
      }

      state.seeking = false;
      state.firstSeekDone = true;
      state.pendingSeekTarget = null;
      state.seekTargetTime = 0;
      state.seekCompleted = true; state._seekStartedAt = 0;
      state.seekCooldownUntil = now() + 200;
      setFastSync(1500);

      if (wantedPlaying) {
        if (startSeekBufferWait(false)) return;
        // Buffer already ready — clear seek buffering and resume
        state.seekBuffering = false;
        clearBufferHold();
        state.isProgrammaticVideoPlay = true;
        try { video.play(); } catch {}
        try { videoEl.play(); } catch {}
        try {
          const inner = video?.el?.()?.querySelector?.("video");
          if (inner && inner !== videoEl) inner.play().catch(() => {});
        } catch {}
        setTimeout(() => { state.isProgrammaticVideoPlay = false; }, 250);
      }
      scheduleSync(0);
      return;
    }
    if (state.restarting || !state.seeking || state.seekId !== currentSeekId) return;

    const v = getVideoNode();
    const vtAtFinalize = Number(video.currentTime());

    // sync audio to video's landing position. but don't fight small drift —
    // seeking audio flushes its decoder, which sounds like a cut. if audio
    // is already close (within 0.3s) and playing, leave it; the sync loop
    // will nudge it via playbackRate without an audible glitch.
    // also never yank audio back to ~0 when it's legitimately well into
    // the track.
    if (isFinite(vtAtFinalize) && coupledMode && audio) {
      const atCurrent = Number(audio.currentTime) || 0;
      const wouldRestart = vtAtFinalize < 0.5 && atCurrent > 1.0 && state.firstPlayCommitted && !state.restarting && !isLoopDesired();
      const _drift = Math.abs(atCurrent - vtAtFinalize);
      // bigger threshold when audio is already playing (cut is audible).
      // tighter threshold when audio is paused (no audible cut, and we
      // want it to start at the right spot).
      const _threshold = audio.paused ? 0.1 : 0.3;
      // DIRECTIONAL: only rewind playing audio if it's actually behind video.
      // Rewinding when audio is AHEAD of video = "plays same part twice" bug.
      const _audioBehindVideo = atCurrent < vtAtFinalize;
      const _shouldWrite = !wouldRestart && _drift > _threshold &&
        (audio.paused || _audioBehindVideo);
      // The seeked handler owns the short retry chain and updates
      // _lastSafeSeekAt every time it writes audio.currentTime. If it wrote
      // in the last 350ms, another write here races with its decoder flush
      // and manifests as a brief audio cut / replay. Skip and let the
      // retry chain keep audio pinned.
      const _finalizeNow = performance.now();
      const _recentSeekedWrite = (_finalizeNow - _lastSafeSeekAt) < 350;
      if (_shouldWrite && !_recentSeekedWrite) {
        _lastSafeSeekAt = _finalizeNow;
        state._allowAudioTimeWrite = true;
        try { audio.currentTime = vtAtFinalize; } catch {}
        state._allowAudioTimeWrite = false;
        const _fSeekId = state.seekId;
        setTimeout(() => {
          if (state.seekId !== _fSeekId && state.seeking) return;
          const _at = Number(audio.currentTime) || 0;
          // compare against CURRENT video time — vtAtFinalize is 60ms stale.
          const _vtNow = (() => { try { return Number(video.currentTime()) || 0; } catch { return vtAtFinalize; } })();
          const _wouldRestart2 = _vtNow < 0.5 && _at > 1.0 && state.firstPlayCommitted && !state.restarting && !isLoopDesired();
          // directional: only pin if audio is behind video (forward write).
          const _recheckBehind = _at < _vtNow;
          if (!_wouldRestart2 && Math.abs(_at - _vtNow) > 0.35 && (audio.paused || _recheckBehind)) {
            state._allowAudioTimeWrite = true;
            try { audio.currentTime = _vtNow; } catch {}
            state._allowAudioTimeWrite = false;
          }
        }, 60);
      }
    }

    if (!shouldResumeAfterSeek()) {
      clearSeekAudioReadyKick();
      clearSeekResumeIntent();
      execProgrammaticVideoPause();
      execProgrammaticAudioPause(350);
      if (state.seekId === currentSeekId) {
        state.seeking = false;
        state.firstSeekDone = true;
        state.seekCompleted = true; state._seekStartedAt = 0;
        state.audioPlayUntil = 0;
        state.audioPauseUntil = 0;
        state.pendingSeekTarget = null;
        state.seekTargetTime = 0;
        state.seekCooldownUntil = now() + 200;
      }
      return;
    }

    // Fast path: both tracks buffered → skip readyState wait, resume instantly
    const vtCheck0 = Number(video.currentTime());
    const fastBuffered = isFinite(vtCheck0) && (
      bothPlayableAt(vtCheck0) ||
      (timeInBuffered(v, vtCheck0) && (!audio || timeInBuffered(audio, vtCheck0)))
    );

    let vReady = fastBuffered, aReady = fastBuffered;
    if (!fastBuffered) {
      // Wait for video readyState first — don't block video on audio buffering.
      // Audio will start independently as soon as it's ready.
      vReady = await waitForReadyStateOrCanPlay(v, HAVE_CURRENT_DATA, SEEK_READY_TIMEOUT_MS);
      // Quick check audio — if already ready, great; if not, don't block video
      try { aReady = Number(audio.readyState || 0) >= HAVE_CURRENT_DATA; } catch { aReady = false; }
    }

    if (!state.seeking || state.seekId !== currentSeekId) return;
    if (state.pendingSeekTarget != null) state.pendingSeekTarget = null;
    state.seekTargetTime = 0;

    if (!shouldResumeAfterSeek() || mediaSessionForcedPauseActive()) {
      clearSeekAudioReadyKick();
      clearSeekResumeIntent();
      execProgrammaticVideoPause();
      execProgrammaticAudioPause(350);
      if (state.seekId === currentSeekId) {
        state.seeking = false;
        state.firstSeekDone = true;
        state.seekCompleted = true; state._seekStartedAt = 0;
        state.audioPlayUntil = 0;
        state.audioPauseUntil = 0;
        state.seekCooldownUntil = now() + 200;
      }
      return;
    }

    if (!vReady) {
      const vtCheck = Number(video.currentTime());
      // If video is playable at the seek target, don't enter seekBuffering.
      // Audio can recover independently via immediate kick + retries.
      const videoReadyNow = isFinite(vtCheck) && canPlayAt(getVideoNode(), vtCheck);
      if (!videoReadyNow) {
        // Set seekBuffering BEFORE clearing seeking — no gap for events to sneak through
        state.seekBuffering = true;
        state.strictBufferHold = true;
        state.bufferHoldIntendedPlaying = true;
        if (state.seekId === currentSeekId) {
          state.seeking = false;
          state.firstSeekDone = true;
          state.seekCompleted = true; state._seekStartedAt = 0;
          state.seekCooldownUntil = now() + 200;
        }
        if (startSeekBufferWait(true)) return;
        // startSeekBufferWait returned false = video already buffered. Clear and resume.
        state.seekBuffering = false;
        clearBufferHold();
        // Fall through to normal resume below
      }
    }

    clearBufferHold();

    // Final position sync before resuming — bypass gate but guard near-0 restart
    // Only sync if drift is significant (>0.15s). The 0.05s threshold before caused
    // audio decode buffer flushes on tiny drift, producing audible glitches on seek.
    // DIRECTIONAL: only write when audio is paused OR audio is behind video.
    // Rewinding playing audio (audio ahead of video) is the "same part twice" bug.
    const vt2 = Number(video.currentTime());
    if (isFinite(vt2) && coupledMode && audio) {
      const at2 = Number(audio.currentTime) || 0;
      const _fsWouldRestart = vt2 < 0.5 && at2 > 1.0 && state.firstPlayCommitted && !state.restarting && !isLoopDesired();
      const _fsBehind = at2 < vt2; // audio is behind video → safe to push forward
      if (!_fsWouldRestart && Math.abs(at2 - vt2) > 0.15 && (audio.paused || _fsBehind)) {
        state._allowAudioTimeWrite = true;
        try { audio.currentTime = vt2; } catch {}
        state._allowAudioTimeWrite = false;
      }
    }

    if (state.seekId !== currentSeekId) return;

    state.seekCooldownUntil = now() + 200;
    setFastSync(1800);

    if (state.seekId === currentSeekId) {
      state.seeking = false;
      state.firstSeekDone = true;
      state.seekCompleted = true; state._seekStartedAt = 0;
      state.audioPlayUntil = 0;
      state.audioPauseUntil = 0;
    }

    state.seekResumeInFlight = true;
    state.seekResumeStartedAt = now();
    try {
      if (state.playRequestedDuringSeek || shouldResumeAfterSeek()) {
        state.intendedPlaying = true;
        state.bufferHoldIntendedPlaying = true;
        state.playRequestedDuringSeek = false;
        state.seekWantedPlaying = false;
        state.seekResumeWantedUntil = 0;
        state.seekStabilizeUntil = Math.max(state.seekStabilizeUntil, now() + 1800);
        state.videoWaiting = false;
        clearAudioPauseLocks();
        state.audioPlayGeneration++;
        clearBufferHold();
        state.audioPlayUntil = 0;
        state.startupAudioHoldUntil = 0;
        state.stateChangeCooldownUntil = 0;
        state.audioFadeCompleteUntil = 0;
        cancelActiveFade();
        await ensureUnmutedIfNotUserMuted().catch(() => {});

        // Start video only if not already kicked by seeked handler.
        // tryAcquireVideoPlayLock prevents double-play races that manifest
        // as the "play-pause-play-pause spam after seek" the user reported.
        if (getVideoPaused() && tryAcquireVideoPlayLock()) execProgrammaticVideoPlay();

        // sync audio position and play at full volume right away
        if (coupledMode && audio) {
          const _seekVt = Number(video.currentTime()) || 0;
          const _atNow = Number(audio.currentTime) || 0;
          const _recentSeekKick = state.seekAudioKickAt > 0 && (now() - state.seekAudioKickAt) < 2200;
          const _audioReadyish = Number(audio.readyState || 0) >= HAVE_CURRENT_DATA;
          const _alignedDrift = isFinite(_seekVt) ? Math.abs(_atNow - _seekVt) : 0;

          // seek = clean slate, wipe all stall flags
          state.videoWaiting = false;
          state.videoStallAudioPaused = false;
          state.stallAudioPausedSince = 0;
          state.stallAudioResumeHoldUntil = 0;
          state.videoStallSince = 0;
          clearAudioPauseLocks();
          const _seekTargetVol = targetVolFromVideo();
          try { audio.volume = _seekTargetVol; } catch {}
          state.seekKickAudioAllowedUntil = Math.max(state.seekKickAudioAllowedUntil, now() + 5500);
          state.seekAudioMustStartUntil = Math.max(state.seekAudioMustStartUntil, now() + 6000);
          // grace period so buffer monitor doesn't immediately kill this
          state.audioStartGraceUntil = Math.max(state.audioStartGraceUntil, now() + 600);

          // if the seeked handler already kicked audio recently, don't do our
          // own pause+re-seek+replay dance on top of it. that was the root
          // cause of "play pause play pause spam after seek" — finalize
          // would pause audio that seeked just started, flush the decoder,
          // and replay. trust seeked's retry chain; only write time + play
          // here on the cold path.
          if (_recentSeekKick) {
            // Trust the seeked retry chain. Only correct large drifts.
            if (isFinite(_seekVt) && _alignedDrift > 1.2) {
              state._allowAudioTimeWrite = true;
              try { audio.currentTime = _seekVt; } catch {}
              state._allowAudioTimeWrite = false;
            }
            state.audioEverStarted = true;
            armSeekAudioReadyKick(currentSeekId, _audioReadyish ? 4200 : 6000);
          } else {
            // Cold path: seeked didn't kick (rare — usually audio was kept
            // running through seek, or the retry chain was suppressed).
            // Do the full sync + play.
            if (isFinite(_seekVt) && _alignedDrift > 0.18) {
              state._allowAudioTimeWrite = true;
              try { audio.currentTime = _seekVt; } catch {}
              state._allowAudioTimeWrite = false;
            }
            state.seekAudioKickAt = now();
            armSeekAudioReadyKick(currentSeekId, _audioReadyish ? 4200 : 6000);
            execProgrammaticAudioPlay({ squelchMs: 180, force: true, minGapMs: 0 })
              .then(ok => { if (ok) { try { audio.volume = _seekTargetVol; } catch {} } })
              .catch(() => {});
          }
        }
        armTransitionDriftSettleForSeek(currentSeekId, state.playSessionId);
      }
      // Post-seek backstop retries. The seeked handler owns the short-window
      // retry chain (60/250/600ms). finalize's retries are LONG-TAIL ONLY —
      // they catch cases where the seeked chain failed entirely (e.g. audio
      // buffer still loading at 600ms, so all 3 kicks were no-ops because
      // readyState was too low). Starting at 1200ms means we don't compete
      // with the seeked chain in the sensitive first 600ms.
      // DO NOT clear state._seekPostTimers here — the seeked handler pushed
      // its own retry chain into that array. Clearing would cancel them.
      const _seekGuaranteeSession = state.playSessionId;
      [1200, 1900, 2800, 4000, 5400].forEach(delay => {
        const tid = setTimeout(() => {
          if (state.playSessionId !== _seekGuaranteeSession) return;
          if (!state.intendedPlaying || state.seeking || state.restarting) return;
          if (!coupledMode || !audio) return;
          if (userPauseLockActive() || mediaSessionForcedPauseActive()) return;
          const vt = Number(video.currentTime()) || 0;
          // both playing? just fix drift if needed
          if (!audio.paused && !getVideoPaused() && isFinite(vt)) {
            const drift = Math.abs((Number(audio.currentTime) || 0) - vt);
            // Only correct noticeable drift (>0.25s). Smaller drift is
            // imperceptible and seeking for it flushes the audio decode buffer,
            // causing the audible glitch/pop on seek.
            if (drift > 0.25) {
              const _sgAt = Number(audio.currentTime) || 0;
              const _sgWouldRestart = vt < 0.5 && _sgAt > 1.0 && state.firstPlayCommitted && !state.restarting && !isLoopDesired();
              if (!_sgWouldRestart) {
                const _bufAhead = bufferedAhead(audio, vt);
                if (_bufAhead > 0.1) {
                  safeSetAudioTime(vt);
                }
              }
            }
            return;
          }
          // audio paused but video playing — rescue it
          if (!audio.paused || getVideoPaused()) return;
          clearAudioPauseLocks();
          state._allowAudioTimeWrite = true;
          try { if (isFinite(vt)) audio.currentTime = vt; } catch {}
          state._allowAudioTimeWrite = false;
          const _sgVol = targetVolFromVideo();
          try { audio.volume = _sgVol; } catch {}
          state.seekAudioMustStartUntil = Math.max(state.seekAudioMustStartUntil, now() + 1600);
          armSeekAudioReadyKick(currentSeekId, 2600);
          state.audioStartGraceUntil = Math.max(state.audioStartGraceUntil, now() + 600);
          execProgrammaticAudioPlay({ squelchMs: 250, force: true, minGapMs: 0 })
          .catch(() => {});
        }, delay);
        state._seekPostTimers.push(tid);
      });
      scheduleSync(0);
    } finally {
      // Don't clear seekResumeInFlight synchronously — the video "waiting" event
      // often fires 50-200ms after seek finalize because the decoder needs to refill.
      // If we clear the flag now, the waiting handler kills audio immediately (play-pause).
      // 800ms is enough for the decoder to stabilize while not blocking other
      // audio recovery paths too long (was 1200ms).
      setTimeout(() => { state.seekResumeInFlight = false; }, 800);
      try { MakeSureAudioIsNotCuttingOrWeird.onSeekEnd(); } catch {}
    }
  }

  function scheduleSeekFinalize(delay = 0, seekId) {
    clearSeekSyncFinalizeTimer();
    state.seekFinalizeTimer = setTimeout(() => {
      state.seekFinalizeTimer = null;
      finalizeSeekSync(seekId).catch(() => {});
    }, delay);
  }

  // Cache the initial autoplay desire BEFORE we strip it
  let _cachedWantsAutoplay = null;
  function wantsStartupAutoplay() {
    // Once computed, cache permanently — stripping autoplay later must NOT
    // change this result or the tab-return handler will fail to restart.
    if (_cachedWantsAutoplay !== null) return _cachedWantsAutoplay;
    try {
      const q = (qs.get("autoplay") || "").toLowerCase();
      if (q === "1" || q === "true" || q === "yes") { _cachedWantsAutoplay = true; return true; }
    } catch {}
    try { if (window.forceAutoplay === true) { _cachedWantsAutoplay = true; return true; } } catch {}
    try { if (videoEl?.autoplay || videoEl?.hasAttribute?.("autoplay")) { _cachedWantsAutoplay = true; return true; } } catch {}
    try {
      if (typeof video.autoplay === "function") {
        const a = video.autoplay();
        if (a === true || a === "play" || a === "muted" || a === "any") { _cachedWantsAutoplay = true; return true; }
      }
    } catch {}
    // Also check options_ directly (in case autoplay() was already overridden)
    try { if (video.options_ && video.options_.autoplay) { _cachedWantsAutoplay = true; return true; } } catch {}
    _cachedWantsAutoplay = false;
    return false;
  }

  function startupAutoplayPauseGraceActive() {
    return wantsStartupAutoplay() &&
    !state.firstPlayCommitted &&
    (now() - state.startupPrimeStartedAt) < 4000;
  }

  function startupBufferReadyLoose() {
    if (!coupledMode) return true;
    if (document.visibilityState === "hidden" || !isWindowFocused()) return true;
    const t0 = Number(video.currentTime()) || 0;
    const vNode = getVideoNode();
    const vOk = Number(vNode.readyState || 0) >= 2 || canPlayAt(vNode, t0);
    // Do not require audio readyState — user wants audio to start as early
    // as video can, not for startup to wait until audio has buffered.
    // The "playing" event early-audio retry chain (+ forceAudioStartupPlay)
    // takes care of firing audio.play() as soon as audio decodes.
    return vOk;
  }

  function bothReadyForStartupKick() {
    if (!coupledMode) return true;
    if (document.visibilityState === "hidden" || !isWindowFocused()) return true;
    const vNode = getVideoNode();
    const vRS = Number(vNode.readyState || 0);
    if (vRS < 2) return false;
    // Do NOT wait for audio readyState: user wants audio to start as early
    // as video, not video waiting for audio. If audio isn't yet ready it
    // will be kicked into play and will start as soon as it decodes —
    // any short silent-video window is unavoidable when the audio track
    // simply hasn't arrived yet, but we never hold back video.
    return true;
  }

  function scheduleStartupAutoplayKick() {
    if (!coupledMode) return;
    if (state.startupKickDone || state.startupKickInFlight || state.firstPlayCommitted) return;
    // On tab return, auto-prime if not already primed
    if (!state.startupPrimed) {
      if (document.visibilityState === "visible" && wantsStartupAutoplay()) {
        state.startupPrimed = true;
      } else {
        return;
      }
    }
    if (!wantsStartupAutoplay() && !state.intendedPlaying) return;
    if (mediaSessionForcedPauseActive()) return;
    if (state.bgResumeInFlight) return;
    // both already playing? commit startup right here, skip the kick entirely.
    // re-calling playTogether when media is already running causes redundant seeks.
    const _skVN = getVideoNode();
    if (_skVN && !_skVN.paused && audio && !audio.paused) {
      state.startupKickDone = true;
      state.firstPlayCommitted = true;
      state.intendedPlaying = true;
      state.audioEverStarted = true;
      setTimeout(() => { state.startupPhase = false; }, 500);
      return;
    }

    state.startupKickInFlight = true;
    clearStartupAutoplayRetryTimer();
    setTimeout(async () => {
      try {
        if (!state.startupPrimed || mediaSessionForcedPauseActive() || state.firstPlayCommitted) return;

        // In background, Chrome will just kill any play() we fire. Don't churn —
        // flag for resume on tab return and retry slowly.
        if (document.visibilityState === "hidden") {
          state.resumeOnVisible = true;
          state.intendedPlaying = true;
          state.bufferHoldIntendedPlaying = true;
          state.startupKickInFlight = false;
          scheduleStartupAutoplayRetry();
          return;
        }

        if (!bothReadyForStartupKick()) {
          state.startupKickInFlight = false;
          scheduleStartupAutoplayRetry();
          return;
        }

        clearMediaSessionForcedPause();
        state.intendedPlaying = true;
        state.bufferHoldIntendedPlaying = true;
        clearBufferHold();
        state.tabReturnImmuneUntil = Math.max(state.tabReturnImmuneUntil, now() + 2000);
        updateMediaSessionPlaybackState();
        setPauseEventGuard(1200);
        setMediaPlayTxn(1500);
        setFastSync(1800);

        state.startupPlaySettleUntil = now() + STARTUP_SETTLE_MS;
        state.startupPlaySettled = false;

        forceZeroBeforeFirstPlay();

        await playTogether().catch(() => {});

        const isEffectivelyPaused = coupledMode ? (getVideoPaused() && !!audio.paused) : getVideoPaused();

        if (isEffectivelyPaused) {
          if (!state.strictBufferHold) {
            state.resumeOnVisible = false;
            scheduleStartupAutoplayRetry();
          }
          return;
        }

        state.startupKickDone = true;
        if (!state.firstPlayCommitted) {
          state.firstPlayCommitted = true;
          setTimeout(() => { state.startupPhase = false; }, 800);
        }
        state.startupPlaySettleUntil = now() + STARTUP_SETTLE_MS;
      } finally {
        state.startupKickInFlight = false;
      }
    }, 0);
  }

  function scheduleStartupAutoplayRetry() {
    if (state.startupKickDone || state.startupKickInFlight || state.firstPlayCommitted) return;
    if (!state.intendedPlaying && !wantsStartupAutoplay()) return;
    if (mediaSessionForcedPauseActive() || userPauseLockActive()) return;

    clearStartupAutoplayRetryTimer();
    const count = state.startupAutoplayRetryCount;
    if (count >= 40) return;
    // Cap index at array length to avoid undefined delay falling through to || 5000 wrong index
    const delays = [80, 150, 300, 500, 800, 1200, 1500, 2000, 2500, 3000, 3000, 3000, 3000, 3000];
    const delay = delays[Math.min(count, delays.length - 1)];
    state.startupAutoplayRetryCount++;
    state.startupAutoplayRetryTimer = setTimeout(async () => {
      state.startupAutoplayRetryTimer = null;
      if (state.startupKickDone || state.startupKickInFlight || state.firstPlayCommitted) return;
      if (!state.intendedPlaying && !wantsStartupAutoplay()) return;
      if (mediaSessionForcedPauseActive() || userPauseLockActive()) return;
      if (state.bgResumeInFlight) {
        scheduleStartupAutoplayRetry();
        return;
      }

      const hasLooseBuffer = startupBufferReadyLoose();

      if (!hasLooseBuffer) {
        scheduleStartupAutoplayRetry();
        return;
      }
      // If we just returned to the tab (tab is visible, retry count was reset),
      // always reset the startupPrimed state to allow kick to fire immediately.
      if (document.visibilityState === "visible" && !state.startupPrimed) {
        maybePrimeStartup();
        if (!state.startupPrimed) {
          scheduleStartupAutoplayRetry();
          return;
        }
      }
      state.startupKickInFlight = true;
      try {
        clearMediaSessionForcedPause();
        state.intendedPlaying = true;
        state.bufferHoldIntendedPlaying = true;
        clearBufferHold();
        state.startupPrimed = true;
        state.tabReturnImmuneUntil = Math.max(state.tabReturnImmuneUntil, now() + 2000);
        if (!coupledMode) MediumQualityManager.markUserPlayed();
        updateMediaSessionPlaybackState();
        setPauseEventGuard(1200);
        setMediaPlayTxn(1500);
        setFastSync(1800);

        state.startupPlaySettleUntil = now() + STARTUP_SETTLE_MS;
        state.startupPlaySettled = false;

        forceZeroBeforeFirstPlay();

        await playTogether().catch(() => {});

        const isEffectivelyPaused = coupledMode ? (getVideoPaused() && !!audio.paused) : getVideoPaused();

        if (isEffectivelyPaused) {
          if (!state.strictBufferHold) {
            state.resumeOnVisible = false;
            scheduleStartupAutoplayRetry();
          }
          return;
        }

        state.startupKickDone = true;
        if (!state.firstPlayCommitted) {
          state.firstPlayCommitted = true;
          setTimeout(() => { state.startupPhase = false; }, 800);
        }
        state.startupPlaySettleUntil = now() + STARTUP_SETTLE_MS;
      } finally {
        state.startupKickInFlight = false;
      }
    }, delay);
  }

  function maybePrimeStartup() {
    if (!coupledMode) return;
    if (state.restarting || state.startupPrimed) return;
    // if both elements are already playing, just commit startup — no priming needed.
    // calling playTogether/seeking audio when it's already running causes skips.
    if (state.audioEverStarted && audio && !audio.paused && !getVideoPaused()) {
      state.startupPrimed = true;
      clearBufferHold();
      state.firstSeekDone = true;
      if (!state.startupKickDone) state.startupKickDone = true;
      if (!state.firstPlayCommitted) {
        state.firstPlayCommitted = true;
        state.intendedPlaying = true;
      }
      setTimeout(() => { state.startupPhase = false; }, 500);
      return;
    }
    const t0 = Number(video.currentTime()) || 0;
    const primeWait = now() - state.startupPrimeStartedAt;
    const inBg = document.visibilityState === "hidden" || !isWindowFocused();
    const vNode = getVideoNode();
    const videoAlreadyPlaying = vNode && !vNode.paused;
    // If video is already playing (autoplay succeeded), skip buffer check — just prime.
    // Otherwise, wait for video to have enough data (but cap at 2.5s).
    if (!videoAlreadyPlaying && !canPlayAt(vNode, t0) && !inBg && primeWait < 2500) {
      state.strictBufferHold = true;
      if (!state.bufferHoldSince) state.bufferHoldSince = now();
      state.strictBufferReason = "startup-buffer";
      return;
    }
    state.startupPrimed = true;
    clearBufferHold();
    state.firstSeekDone = true;
    const t = Number(video.currentTime());
    const at = Number(audio.currentTime);
    // only sync audio position if it's actually off — don't seek if already in sync.
    // seeking while audio is playing causes an audible skip.
    const audioPlaying = audio && !audio.paused;
    if (isFinite(t) && isFinite(at) && Math.abs(at - t) > 0.4) {
      safeSetAudioTime(t);
    } else if (audioPlaying && Math.abs(at - t) <= 0.4) {
      // audio already in sync and playing — don't touch it
    }
    // if audio is already at target volume, don't fade (causes a dip)
    const _primeTargetVol = targetVolFromVideo();
    if (!audioPlaying || audio.volume < _primeTargetVol * 0.5) {
      softUnmuteAudio(AUDIO_SAFE_FADE_DURATION_MS).catch(() => {});
    }
    if (bothReadyForStartupKick()) {
      scheduleStartupAutoplayKick();
    } else {
      scheduleStartupAutoplayRetry();
    }
    setTimeout(() => {
      if (!state.firstPlayCommitted) state.startupPhase = false;
    }, 3500);
  }

  function evaluateBufferHoldNeed(vt, at) {
    if (!state.intendedPlaying || state.seeking || state.seekBuffering || state.syncing) return false;
    if (!state.audioEverStarted && state.startupPhase) return false;
    if (startupSettleActive()) return false;
    // Don't arm buffer hold during tab return — video just needs a moment
    // to wake up. Pausing here causes the visible freeze on tab return.
    // MVNFAPAAT handles the case where video genuinely can't play.
    if (inBgReturnGrace() || isTabReturnImmune()) return false;
    // never enter buffer hold within 5s of first play commit — page-load
    // resource contention causes transient low readyState that resolves itself.
    // pausing during this window creates the visible play-pause-play stutter.
    if (state.firstPlayCommitted && state.startupPlaySettleUntil > 0 &&
        (now() - state.startupPlaySettleUntil + STARTUP_SETTLE_MS) < 5000) return false;
    // Don't trigger buffer hold right after a seek — let the browser buffer naturally
    if (now() < state.seekCooldownUntil) return false;
    if (document.visibilityState === "hidden" || !isWindowFocused()) return false;
    const checkTime = Math.max(vt, at || 0);
    const vNode = getVideoNode();
    const aNeedsBuffer = !canPlaySmoothAt(audio, checkTime, STRICT_BUFFER_AHEAD_SEC);
    const vLacksData = !canPlaySmoothAt(vNode, checkTime, STRICT_BUFFER_AHEAD_SEC);
    const isSuspended = getVideoPaused();
    const vNeedsBuffer = vLacksData || (!isSuspended && state.videoWaiting);
    if (vNeedsBuffer || aNeedsBuffer) {
      state.strictBufferHoldFrames = (state.strictBufferHoldFrames || 0) + 1;
      // Raised from 2 → 4 consecutive low-buffer sync frames before triggering.
      // At ~200ms sync interval, 4 frames = ~800ms of sustained low buffer.
      // Segment-boundary dips last 50-300ms and don't need a buffer hold —
      // the old threshold of 2 (≈400ms) was cutting audio at segment crossings.
      if (state.strictBufferHoldFrames >= 4) {
        state.strictBufferHoldConfirmed = true;
        return true;
      }
      return false;
    } else {
      state.strictBufferHoldFrames = 0;
      state.strictBufferHoldConfirmed = false;
      return false;
    }
  }

  async function runSync() {
    state.syncTimer = null;
    state.syncScheduledAt = 0;
    // Error overlay active — don't sync anything, media is dead
    if (_errorOverlayShown) return;
    enforcePlaybackRateSync();
    // Anti-loop tick — catch phantom restarts every sync cycle
    try { MakeSureUnintentionalLoopDoesntEverHappenAtALLManager.tick(); } catch {}

    // Safety: unstick seeking if stuck >5s (was 8s — too long, caused audio death)
    if ((state.seeking || state.seekBuffering) && state._seekStartedAt > 0 &&
      (performance.now() - state._seekStartedAt) > 5000) {
      state.seeking = false;
    state.seekBuffering = false;
    state.seekResumeInFlight = false;
    state.seekCompleted = true; state._seekStartedAt = 0;
    // Also clear stall flags that may have been set during the stuck seek
    state.videoWaiting = false;
    state.videoStallSince = 0;
    state.videoStallAudioPaused = false;
    state.stallAudioPausedSince = 0;
    state.stallAudioResumeHoldUntil = 0;
    clearAudioPauseLocks();
      }

      // Tab-return: DON'T skip sync entirely. The sync loop is the only system
      // that can detect "video playing but frozen" and restart it. Blocking sync
      // for the full 2s immunity window causes 1-3s freezes after returning from
      // a long background. Instead, run sync in LIMITED MODE: skip drift-correction
      // seeks (those would fight NMPBFN recovery) but still do health monitoring
      // and play kicks. The skipDrift flag below handles this.
      const _syncInTabReturnImmunity = (isTabReturnImmune() || NotMakePlayBackFixingNoticable.shouldBlockSync()) &&
        state.intendedPlaying && state.firstPlayCommitted;

        // PAGE-LOAD GATE: defer sync during early loading, but only if we haven't
        // committed a play yet. Once firstPlayCommitted, always run sync so audio
        // can start alongside video (prevents the "video plays, audio comes later" gap).
        if (!pageLoadedForAutoplay() && !state.firstPlayCommitted && !state.intendedPlaying && !wantsStartupAutoplay()) {
          scheduleSync();
          return;
        }

        if (!coupledMode) {
          // Keep audio silent in non-coupled mode
          if (audio && !audio.paused) {
            try { audio.muted = true; audio.volume = 0; audio.pause(); } catch {}
          }
          // MQM enforcement -- if user paused, force video paused and stop sync
          if (MediumQualityManager.intentPaused && state.firstPlayCommitted) {
            if (!getVideoPaused()) execProgrammaticVideoPause();
            state.intendedPlaying = false;
            scheduleSync();
            return;
          }
          // Non-coupled: if intendedPlaying but video somehow stopped, restart it.
          // Guards: don't restart during user-initiated pauses, background transitions,
          // or when a seek/sync operation is in flight.
          if (state.intendedPlaying && getVideoPaused() &&
            !state.seekBuffering && !state.seeking &&
            !userPauseLockActive() && !userPauseIntentActive() &&
            !mediaSessionForcedPauseActive() &&
            !BackgroundPlaybackManager.shouldSuppressAutoPause() &&
            !MediumQualityManager.shouldBlockAutoResume() &&
            state.userPauseIntentPresetAt === 0 &&
            !state.userGesturePauseIntent) {
            // Triple-guard for non-coupled auto-resume
            if (!MediumQualityManager.intentPaused &&
              (now() - state.lastUserActionTime) > 2000) {
              try { await Promise.resolve(execProgrammaticVideoPlay()); } catch {}
              }
            }
            scheduleSync();
            return;
        }
        if (state.restarting) {
          scheduleSync(); return;
        }
        // stale stall flag cleanup: if videoWaiting / videoStallAudioPaused
        // have been stuck for too long but video now has data, they're
        // leftovers from a past stall. dozens of paths gate audio.play()
        // on these, so a stuck flag = permanent audio death. the "playing"
        // event should clear them, but video can stall without pausing,
        // so the event may never fire.
        // timeout is 2s — 4s was long enough to be audible as silence.
        if (state.intendedPlaying && !state.seeking && !state.seekBuffering) {
          const _staleVNode = getVideoNode();
          const _staleRS = _staleVNode ? Number(_staleVNode.readyState || 0) : 0;
          if (_staleRS >= HAVE_FUTURE_DATA) {
            if (state.videoWaiting && state.videoStallSince > 0 && (now() - state.videoStallSince) > 2000) {
              state.videoWaiting = false;
              state.videoStallSince = 0;
            }
            if (state.videoStallAudioPaused && state.stallAudioPausedSince > 0 && (now() - state.stallAudioPausedSince) > 2000) {
              state.videoStallAudioPaused = false;
              state.stallAudioPausedSince = 0;
              state.stallAudioResumeHoldUntil = 0;
            }
            // also clear the foreground buffer hold when video has data —
            // otherwise foregroundBufferAudioHoldUntil hangs on from a past
            // stall and blocks audio for the whole hold period after video
            // recovered.
            if (foregroundBufferAudioHoldActive()) {
              clearForegroundBufferAudioHold();
            }
          }
        }
        // CPU FAST PATH: if both tracks are playing with small drift in foreground,
        // skip all the expensive checks. This covers 95%+ of sync ticks during
        // healthy playback and avoids ~20 function calls per tick.
        const vtRaw = Number(video.currentTime());
        const atRaw = Number(audio.currentTime);
        if (!isFinite(vtRaw) || !isFinite(atRaw)) {
          scheduleSync(); return;
        }
        // CPU FAST PATH: both tracks playing, small drift, foreground, no flags
        {
          const _fpVP = getVideoPaused();
          const _fpAP = !!audio.paused;
          if (!_fpVP && !_fpAP && state.intendedPlaying && state.firstPlayCommitted &&
              !state.seeking && !state.seekBuffering && !state.syncing &&
              !state.videoWaiting && !state.videoStallAudioPaused &&
              !_syncInTabReturnImmunity &&
              document.visibilityState === "visible" && isWindowFocused() &&
              Math.abs(vtRaw - atRaw) < 0.8) {
            // Everything healthy — just update lastKnownGoodVT and reschedule.
            // The 0.8s threshold (down from 1.0) matches the rate sync drift
            // range so the fast path fires more often during normal playback.
            if (vtRaw > 0.1) updateLastKnownGoodVT();
            scheduleSync(); return;
          }
        }
        let vt = vtRaw;
        let at = atRaw;
        const vPaused = getVideoPaused();
        const aPaused = !!audio.paused;

        // Audio must never play when video is paused (except during tab-return
        // immunity, recent user actions, programmatic play transitions, NMPBFN
        // recovery, or the first 2s after a play request).
        //
        // old code killed audio on any momentary video pause, including
        // programmatic transitions (video.play() resolving, playTogether
        // coordination, etc). video can be "paused" for 50-200ms during
        // normal play/seek/resume, so this caused random audio cuts. the
        // guards below skip all those transient states.
        if (!BringBackToTabManager.isLocked() && !state.seekBuffering && !(state.tabReturnImmuneUntil > now())) {
          const _syncAudioKillSafe =
            !state.isProgrammaticVideoPlay &&
            !state.videoPlayInFlight &&
            !state.isProgrammaticVideoPause &&
            !NotMakePlayBackFixingNoticable.isActive() &&
            !state.seekResumeInFlight &&
            !inBgReturnGrace() &&
            !foregroundRecoveryActive(500) &&
            (now() - state.lastUserActionTime) > 2000 &&
            !VideoCompositorFlushManager.isWaitingForFrame();
          if (_syncAudioKillSafe) {
            if (!aPaused && vPaused && !isHiddenBackground() && !state.intendedPlaying) {
              execProgrammaticAudioPause(100);
            } else if (!aPaused && vPaused && !isHiddenBackground() &&
              !state.strictBufferHold && !state.videoWaiting &&
              !state.seeking && !state.syncing &&
              !state.bgPlaybackAllowed) {
              execProgrammaticAudioPause(100);
            }
          }
        }

        const inBgDrift = document.visibilityState === "hidden" || !isWindowFocused() || inBgReturnGrace();
        // inBgReturnGrace: suppress all drift-correction seeks for 8s after tab return so the
        // wakeup timer (seamlessBgCatchUp) can handle position sync without racing runSync.
        const skipDrift = now() < state.seekCooldownUntil || _syncInTabReturnImmunity;

        if (!vPaused && vt > 0 && getVideoReadyState() >= HAVE_CURRENT_DATA) {
          // Video is playing with data — clear stale waiting flag
          state.videoWaiting = false;
        }

        // TAB RETURN RECOVERY: If video is "playing" (paused=false) but readyState
        // is low during tab return, the decoder is stale and showing a frozen GPU
        // frame. Kick it with a seek to its current position to force the decoder
        // pipeline to restart. This is the primary fix for the 1-3s freeze.
        if (_syncInTabReturnImmunity && !vPaused && state.intendedPlaying &&
            !NotMakePlayBackFixingNoticable.isRecovering()) {
          // Skip decoder kicks during NMPBFN recovery — it already micro-seeked
          // once. Additional seeks reset the decode pipeline and extend the freeze.
          // Also only do this ONCE per tab return — repeated micro-seeks cause
          // visible jitter/shaking that the user perceives as "random seeks".
          const _trVNode = getVideoNode();
          const _trRS = _trVNode ? Number(_trVNode.readyState || 0) : 4;
          // Forward micro-seek — stays in current GOP, no keyframe flash.
          if (_trRS < HAVE_CURRENT_DATA && vt > 0 && !state._syncTabReturnKickDone && canDoMicroSeek()) {
            state._syncTabReturnKickDone = true;
            recordMicroSeek();
            state._isMicroSeek = true;
            try { _trVNode.currentTime = vt + 0.001; } catch {}
            setTimeout(() => { state._isMicroSeek = false; }, 150);
          }
        }

        // Guard with !state.startupKickInFlight so this path never races with
        if (state.intendedPlaying && !vPaused && vt > 0.5) {
          if (!state.firstPlayCommitted && !state.startupKickInFlight) {
            state.firstPlayCommitted = true;
            state.startupKickDone = true;
            state.startupPlaySettleUntil = now() + STARTUP_SETTLE_MS;
            clearStartupAutoplayRetryTimer();
            setTimeout(() => { state.startupPhase = false; }, 800);
          }
        }

        if (state.intendedPlaying && !state.restarting && !state.seeking && !state.syncing && !skipDrift && !state.seekResumeInFlight && !state.seekBuffering) {
          if (state.audioEverStarted && !audio.paused && !inBgDrift && !state.startupPhase) {
            const _syncDrift = Math.abs(at - vt);
            // only correct large drift (>1.5s). Drift under 1.5s is handled by the
            // playback rate nudge system smoothly and invisibly. Previous thresholds
            // (0.35s, 0.8s) caused constant audio seeks during normal playback,
            // which the user perceives as "random seeks" and audio glitches.
            if (_syncDrift > 1.5) {
              await quietSeekAudio(vt);
              at = vt;
            }
          }
        }
        if (state.intendedPlaying && !getVideoPaused() && vt > 0.1 &&
            document.visibilityState === "visible") {
          updateLastKnownGoodVT();
        }

        if (state.intendedPlaying && !audio.paused && !state.userMutedVideo && !state.userMutedAudio) {
          try { if (audio.muted) audio.muted = false; } catch {}
          if (!state.audioFading && !NotMakePlayBackFixingNoticable.isActive()) {
            const target = clamp01(targetVolFromVideo());
            if (audio.volume < 0.05 && target > 0.05) {
              softUnmuteAudio(200).catch(() => {});
            } else if (Math.abs(audio.volume - target) > 0.05) {
              updateAudioGainImmediate();
            }
          }
        }

        const needsHold = evaluateBufferHoldNeed(vt, at);
        if (needsHold && !state.strictBufferHold) {
          state.strictBufferHold = true;
          if (!state.bufferHoldSince) state.bufferHoldSince = now();
          state.strictBufferReason = "buffer-starved";
          state.bufferHoldSince = now();
          state.bufferHoldIntendedPlaying = state.intendedPlaying;
          if (!getVideoPaused()) execProgrammaticVideoPause();
          if (!audio.paused) execProgrammaticAudioPause(350);
          resetAudioPlaybackRate();
          armResumeAfterBuffer(10000);
        } else if (!needsHold && state.strictBufferHold) {
          clearBufferHold();
          resetAudioPlaybackRate();
          setFastSync(1200);
        }
        const isTransientState = document.visibilityState === "hidden" ||
        !isWindowFocused() ||
        isVisibilityTransitionActive() ||
        isAltTabTransitionActive() ||
        (platform.chromiumOnlyBrowser && chromiumBgPauseBlocked());

        if (state.intendedPlaying && !state.restarting && !state.seeking && !state.seekBuffering && !state.syncing &&
          !MakeSureUnintentionalLoopDoesntEverHappenAtALLManager.shouldBlockAutoRestart()) {
          if (state.strictBufferHold) {
            if (!vPaused) execProgrammaticVideoPause();
            if (!aPaused) execProgrammaticAudioPause(500);
          } else if (isTransientState) {
            if (vPaused && aPaused) {
              if (isHiddenBackground()) {
                if (!state.resumeOnVisible) {
                  state.resumeOnVisible = true;
                }
                if (state.firstPlayCommitted && state.startupKickDone && !state.bgResumeInFlight &&
                  BackgroundPlaybackManagerManager.shouldAttemptBgResume()) {
                  seamlessBgCatchUp().catch(() => {});
                  }
              } else {
                // Don't schedule a bgResumeRetry if executeSeamlessWakeup is already pending —
                // competing resume attempts produce the visible play→pause stutter on tab return.
                // The wakeup timer handles it with the correct platform delay.
                if (!state.bgResumeInFlight && !state.wakeupTimer) {
                  // Notify BPMM of possible browser-forced pause in transition state
                  if (BackgroundPlaybackManager.isAnyTransition() && !inBgReturnGrace()) {
                    BackgroundPlaybackManagerManager.onBrowserForcedPause();
                  }
                  scheduleBgResumeRetry(inBgReturnGrace() ? BG_RESUME_MIN_DELAY_CHROMIUM_MS : 400);
                }
              }
            } else if (vPaused && !aPaused) {
              // Audio is playing but video is paused in background/transition.
              if (isHiddenBackground()) {
                // Silent sync: update video.currentTime without triggering seek machinery
                bgSilentSyncVideoTime(at);
                // Also try to restart the video in background (may fail, that's OK)
                if (!state.bgResumeInFlight && !state.isProgrammaticVideoPlay && !state.seeking) {
                  // Don't spam — only try if video is significantly behind audio
                  if (Math.abs(at - vt) > 1.0) {
                    execProgrammaticVideoPlay();
                  }
                }
              } else {
                // Tab is being restored (altTab/focus transition) — DON'T seek video
                // here. bgSilentSyncVideoTime causes visible random jumps. Let the
                // normal sync loop handle drift after the transition settles.
                if (!state.bgResumeInFlight) {
                  scheduleBgResumeRetry(inBgReturnGrace() ? 80 : 200);
                }
              }
            } else if (!vPaused && aPaused) {
              // Video is running but audio paused during a transition — kick audio
              // (only if not in a stall hold — stall recovery is handled via armResumeAfterBuffer)
              const inStallHold = state.videoStallAudioPaused || now() < state.stallAudioResumeHoldUntil;
              if (!inStallHold &&
                  !state.bgResumeInFlight &&
                  !shouldBlockNewAudioStart() &&
                  inBgReturnGrace() &&
                  videoReadyForAudioResume(vt)) {
                safeSetAudioTime(vt);
                execProgrammaticAudioPlay({ squelchMs: 450, minGapMs: 0, force: true }).catch(() => false);
              }
            }
          } else {
            if (!vPaused && aPaused) {
              const stallHoldActive = state.videoStallAudioPaused || now() < state.stallAudioResumeHoldUntil;
              if (!state.audioPausedSince) state.audioPausedSince = now();
              if (!stallHoldActive &&
                  !shouldBlockNewAudioStart() &&
                  !state.bgResumeInFlight &&
                  videoReadyForAudioResume(vt)) {
                safeSetAudioTime(vt);
                execProgrammaticAudioPlay({ squelchMs: 450, minGapMs: 0, force: true }).catch(() => false);
              } else {
                enforceAudioPlayback();
              }
            } else if (!vPaused && !aPaused) {
              // backstop: video stalled + audio still playing? kill it if readyState confirms.
              const _syncVNode = getVideoNode();
              const _syncRS = _syncVNode ? Number(_syncVNode.readyState || 0) : 4;
              // all audio kills now go through canKillAudio so grace/kick
              // windows are respected. before, the sync loop would kill audio
              // on videoWaiting + low readyState no matter what, and that
              // caused random cuts during normal playback transitions.
              //
              // also require the stall to have lasted 2s+. a single-tick
              // videoWaiting flip from normal keyframe decoding shouldn't
              // kill audio — only real sustained stalls should. and don't
              // touch audio during seek recovery; the seeked handler owns it.
              const _syncStallDuration = state.videoStallSince ? (now() - state.videoStallSince) : 0;
              if (state.videoWaiting && _syncRS < HAVE_FUTURE_DATA && _syncStallDuration >= 2000 &&
                  !seekRecoveryActive(800) &&
                  canKillAudio({ bypassGrace: true })) {
                if (!state.videoStallAudioPaused) {
                  pauseAudioForConfirmedVideoStall();
                }
              // Throttled backstop: if "waiting" event didn't fire but video is
              // clearly starved, set videoWaiting. Once every 3s max, and we do
              // NOT kill audio here — let the waiting event path handle it via
              // its deferred timer so we don't double-up.
              } else if (!state.videoWaiting && _syncRS < HAVE_FUTURE_DATA &&
                         coupledMode && !aPaused && canKillAudio() &&
                         (!state._lastSyncBackstopAt || (now() - state._lastSyncBackstopAt) > 3000)) {
                state._lastSyncBackstopAt = now();
                state.videoWaiting = true;
                state.videoStallSince = state.videoStallSince || now();
                // Don't call pauseAudioForConfirmedVideoStall here — the video
                // will fire "waiting" shortly if this is real, and the deferred
                // 180ms timer in the waiting handler will kill audio if needed.
              } else if ((state.videoWaiting || state.videoStallAudioPaused) && _syncRS >= HAVE_FUTURE_DATA) {
                // stale flags — video has data, clear everything and resume audio.
                // This is the auto-resume path: buffering ended, video has data,
                // stall flags are stale → clear them and kick audio immediately.
                const _wasStallPaused = state.videoStallAudioPaused;
                state.videoWaiting = false;
                state.videoStallSince = 0;
                if (state.videoStallAudioPaused) {
                  state.videoStallAudioPaused = false;
                  state.stallAudioPausedSince = 0;
                  state.stallAudioResumeHoldUntil = 0;
                }
                clearForegroundBufferAudioHold();
                // Resume audio immediately if it was paused due to the stall.
                // Previously this only cleared flags — audio had to wait for
                // MSAOVDPUURWT's 500ms timer to restart it. Now resume inline.
                if (_wasStallPaused && coupledMode && audio && aPaused &&
                    state.intendedPlaying && !state.seeking && !state.seekBuffering &&
                    !state.endedNaturally && !userPauseLockActive()) {
                  // Anti-repeat: use max(vt, stallPauseAudioPos) so audio never
                  // goes backward. After this resume, clear the stall position.
                  const _resumePos = (() => {
                    const sp = getStallPauseAudioPos();
                    return (sp > 0 && vt < sp - 0.05) ? sp : vt;
                  })();
                  safeSetAudioTime(_resumePos);
                  // Clear stall-pause position now that we've resumed
                  _stallPauseAudioPos = -1;
                  try { audio.volume = targetVolFromVideo(); } catch {}
                  state.audioStartGraceUntil = Math.max(state.audioStartGraceUntil, now() + 300);
                  execProgrammaticAudioPlay({ squelchMs: 200, force: true, minGapMs: 0 }).catch(() => {});
                }
                // Also kick video if it's paused — complete auto-resume
                if (getVideoPaused() && state.intendedPlaying && !state.endedNaturally &&
                    !userPauseLockActive() && !state.isProgrammaticVideoPlay) {
                  DONTMAKEITDOUBLEPLAY.resetAll();
                  execProgrammaticVideoPlay();
                }
              }
              state.audioPausedSince = 0;
              state.videoSyncRetryTs = 0;
            } else if (vPaused && !aPaused) {
              if (!state.videoSyncRetryTs) state.videoSyncRetryTs = now();
              if (!state.seekResumeInFlight && !state.bgResumeInFlight &&
                  !mediaPlayTxnActive() && !chromiumPauseGuardActive() &&
                  tryAcquireVideoPlayLock()) {
                execProgrammaticVideoPlay();
              }
              // If video still hasn't resumed after 3000ms, sync audio to paused
              // state. Do this independently of the lock so we don't leak audio.
              if ((now() - state.videoSyncRetryTs) > 3000) {
                execProgrammaticAudioPause(350);
                state.videoSyncRetryTs = 0;
              }
            } else if (vPaused && aPaused) {
              if (!inMediaTxnWindow() && !userPauseLockActive() && !chromiumPauseGuardActive() &&
                  !state.bgResumeInFlight && !state.seekResumeInFlight &&
                  !state.isProgrammaticVideoPlay && !state.videoPlayInFlight &&
                  !state.endedNaturally) {
                if (isHiddenBackground()) {
                  state.resumeOnVisible = true;
                } else {
                  // Sync audio position to video before resuming both to avoid A/V drift pop
                  if (isFinite(vt) && isFinite(at) && Math.abs(at - vt) > 0.8) {
                    safeSetAudioTime(vt);
                  }
                  state.audioStartGraceUntil = Math.max(state.audioStartGraceUntil, now() + 500);
                  playTogether().catch(() => {});
                }
              }
            } else {
              if (skipDrift) {
                // in seek cooldown
              } else {
                const drift = vt - at;
                const absDrift = Math.abs(drift);
                const activeBigDrift = inBgDrift ? BIG_DRIFT_BACKGROUND : BIG_DRIFT;
                if (absDrift > activeBigDrift) {
                  resetAudioPlaybackRate();
                  // Big drift: video is authoritative in foreground; seek audio to video
                  await quietSeekAudio(vt);
                  resetAudioPlaybackRate();
                  state.driftStableFrames = 0;
                  setFastSync(1600);
                } else if (absDrift > MICRO_DRIFT) {
                  const sameDirection = (drift > 0) === (state.lastDrift > 0);
                  if (sameDirection) state.driftStableFrames = (state.driftStableFrames || 0) + 1;
                  else state.driftStableFrames = 0;
                  state.lastDrift = drift;
                  if (state.driftStableFrames >= DRIFT_PERSIST_CYCLES) {
                    // Drift persists — just enforce base rate sync, no speed changes.
                    // Rate nudge removed — user finds speed changes audible.
                    enforcePlaybackRateSync();
                  }
                } else {
                  if (state.audioRateNudgeActive && now() > state.audioRateNudgeUntil) {
                    resetAudioPlaybackRate();
                  }
                  state.syncConvergenceCount = (state.syncConvergenceCount || 0) + 1;
                  if (state.syncConvergenceCount >= 8) resetAudioPlaybackRate();
                }
              }
            }
          }
        } else if (!state.intendedPlaying && !state.restarting && !state.seeking && !state.syncing) {
          if (!vPaused) execProgrammaticVideoPause();
          if (!aPaused) {
            state.isProgrammaticAudioPause = true;
            if (audio.volume > 0.015) {
              fadeAndPauseAudio(AUDIO_FADE_DURATION_MS, () => {
                setTimeout(() => { state.isProgrammaticAudioPause = false; }, 200);
              });
            } else {
              cancelActiveFade();
              try { audio.pause(); } catch {}
              setTimeout(() => { state.isProgrammaticAudioPause = false; }, 150);
            }
          }
        }
        maybeUpdateMediaSessionPosition(vt);

        // Audio stall detection
        if (!aPaused && state.intendedPlaying) {
          if (Math.abs(at - state.lastAT) > 0.002) {
            state.lastAT = at;
            state.audioLastProgressTs = now();
            state.audioStallSince = 0;
          } else {
            if (!state.audioLastProgressTs) state.audioLastProgressTs = now();
            const canKickAudio =
            !state.seeking && !state.syncing &&
            !seekStabilizeActive() &&
            !mediaActionLocked() && !state.strictBufferHold &&
            !state.videoWaiting && !state.videoStallAudioPaused &&
            now() >= state.stallAudioResumeHoldUntil &&
            now() >= state.audioKickCooldownUntil &&
            !userPauseLockActive() && !shouldBlockNewAudioStart();
            if (canKickAudio && (now() - state.audioLastProgressTs) > 3500) {
              state.audioKickCooldownUntil = now() + 3800;
              kickAudio().catch(() => {});
              state.audioLastProgressTs = now();
            }
          }
        } else {
          state.lastAT = at;
          state.audioLastProgressTs = now();
          state.audioStallSince = 0;
        }

        // Video stall detection - extended to all platforms, not just mobile
        if (state.intendedPlaying && !vPaused) {
          if (Math.abs(vt - state.lastVT) < 0.001) {
            if (state.videoStallSince === 0) state.videoStallSince = now();
            // Was `!state.userPauseLockActive` (wrong - accessing non-existent property), now correct function call
            const shouldRepair =
            (now() - state.lastVTts) > VIDEO_STALL_TIMEOUT_MS &&
            !state.videoRepairing &&
            !seekStabilizeActive() &&
            now() < state.stallRecoveryUntil === false &&
            getVideoReadyState() >= 2 &&
            !state.strictBufferHold &&
            !userPauseLockActive() &&
            document.visibilityState === "visible";
            if (shouldRepair) {
              state.stallRecoveryUntil = now() + STALL_RECOVERY_COOLDOWN_MS;
              kickVideo().catch(() => {});
              state.lastVTts = now();
              state.videoStallSince = 0;
            }
          } else {
            state.lastVT = vt;
            state.lastVTts = now();
            state.videoStallSince = 0;
          }
        } else {
          state.lastVT = vt;
          state.lastVTts = now();
          state.videoStallSince = 0;
        }
        scheduleSync();
  }

  // --- Throttled buffer monitor: enforces audio silence while video is buffering.
  // swapped this off rAF — 60fps was massive overkill for something that
  // only matters at 100ms+ audio buffer granularity. rAF also fought the
  // freeze detector's own rAF and the compositor. 100ms interval is fine.
  //
  // also require stalls to be SUSTAINED before killing audio. a single-tick
  // flag was enough in the old code, which caused random cuts because the
  // "waiting" event sometimes fires during normal keyframe decoding and
  // clears in 1-2 frames.
  let _bufMonTimer = null;
  let _bufMonLastVT = -1;
  let _bufMonStallFrames = 0;        // tick count (100ms per tick) of frozen vt
  let _bufMonConfirmedStallAt = 0;   // timestamp when we confirmed a real stall
  let _bufMonLastKillAt = 0;         // last time we killed audio — cooldown gate
  const BUF_MON_INTERVAL_MS = 300; // was 100→200→250→300 — still catches stalls within ~1.5s (5 ticks)
  const BUF_MON_STALL_TICKS = 5;     // 500ms of frozen time before we trust it (was 300 — too twitchy)
  const BUF_MON_SUSTAINED_STALL_MS = 1200; // stall must persist this long to kill audio (was 600→1200: cuts were still too frequent)
  const BUF_MON_KILL_COOLDOWN_MS = 4000; // min gap between audio kills (was 2500→4000: prevents rapid cut loop)
  function bufferMonitorTick() {
    _bufMonTimer = null;
    if (!coupledMode || !audio) { _bufMonTimer = setTimeout(bufferMonitorTick, BUF_MON_INTERVAL_MS); return; }

    const nowMs = now();
    const vNodeBuf = getVideoNode();
    const vRSBuf = vNodeBuf ? Number(vNodeBuf.readyState || 0) : 0;

    // Detect a sustained video stall by watching currentTime vs readyState.
    // Only set state.videoWaiting once we're confident — no single-tick flips.
    if (state.intendedPlaying && !getVideoPaused() && document.visibilityState !== "hidden") {
      const vt = vNodeBuf ? (Number(vNodeBuf.currentTime) || 0) : 0;
      if (vt > 0 && vt === _bufMonLastVT) {
        _bufMonStallFrames++;
        if (_bufMonStallFrames >= BUF_MON_STALL_TICKS && vRSBuf < HAVE_FUTURE_DATA &&
            !state.seeking && !state.seekBuffering && !state.restarting &&
            state.firstPlayCommitted) {
          if (!state.videoWaiting) {
            state.videoWaiting = true;
            state.videoStallSince = state.videoStallSince || nowMs;
          }
          if (!_bufMonConfirmedStallAt) _bufMonConfirmedStallAt = nowMs;
        }
      } else {
        _bufMonStallFrames = 0;
        _bufMonConfirmedStallAt = 0;
      }
      _bufMonLastVT = vt;
    } else {
      _bufMonStallFrames = 0;
      _bufMonLastVT = -1;
      _bufMonConfirmedStallAt = 0;
    }

    // Kill audio only if video has been CONFIRMED stalled for a sustained
    // duration (BUF_MON_SUSTAINED_STALL_MS). Prevents random cuts from
    // single-frame readyState flicker.
    //
    // All guard checks now go through canKillAudio() for consistency
    // with every other kill site in the codebase.
    //
    // Additionally rate-limit kills to once per BUF_MON_KILL_COOLDOWN_MS.
    // Even when sustained stall is confirmed, repeatedly killing audio
    // every 100ms during a stretch of bad network creates a rapid audible
    // cut-loop. One kill per 2.5s is enough — the watchdog will recover.
    if (!audio.paused && canKillAudio() && (nowMs - _bufMonLastKillAt) >= BUF_MON_KILL_COOLDOWN_MS) {
      const _bufVideoStarved = vRSBuf < HAVE_FUTURE_DATA;
      const _bufStallFlagged = state.videoWaiting || state.videoStallAudioPaused;
      const _stallDurationMs = _bufMonConfirmedStallAt ? (nowMs - _bufMonConfirmedStallAt) : 0;
      const _stallSinceMs = state.videoStallSince ? (nowMs - state.videoStallSince) : 0;
      // BOTH conditions must hold: confirmed buffer-monitor stall duration
      // AND (state.videoStallSince). Relying on EITHER lets a single stale
      // state.videoStallSince flag trigger a kill.
      const _sustainedStall = _bufStallFlagged &&
        _stallDurationMs >= BUF_MON_SUSTAINED_STALL_MS &&
        _stallSinceMs >= BUF_MON_SUSTAINED_STALL_MS;
      // Additional sanity: the video element must STILL be frozen right now,
      // not just have been flagged earlier. If vt advanced in the last tick,
      // the stall is over.
      const _vtStillFrozen = vNodeBuf && _bufMonLastVT >= 0 &&
        Number(vNodeBuf.currentTime || 0) === _bufMonLastVT;
      if (_bufVideoStarved && _sustainedStall && _vtStillFrozen) {
        if (!state.videoStallAudioPaused) {
          _bufMonLastKillAt = nowMs;
          pauseAudioForConfirmedVideoStall();
        }
        // NOTE: removed the "already flagged — kill it again" re-pause branch.
        // That branch was a high-frequency audio killer: if audio somehow
        // resumed for any reason, this re-killed it at 60fps, producing the
        // rapid play-pause spam. The audio gate + canKillAudio guard are
        // sufficient — trust them.
      }
    }
    _bufMonTimer = setTimeout(bufferMonitorTick, BUF_MON_INTERVAL_MS);
  }
  function startBufferMonitor() {
    if (!_bufMonTimer && coupledMode) {
      _bufMonTimer = setTimeout(bufferMonitorTick, BUF_MON_INTERVAL_MS);
    }
  }

  // --- heartbeat-level frozen video backup detector ---
  // The rAF-based freeze detector in MakeVideoNotFreezeAfterPlaybackAfterAltTabHapenns
  // is the primary mechanism. But rAF itself can be throttled by the browser
  // (tab marginally in focus, window minimized, GPU backpressure), and if the
  // rAF loop stops firing, the freeze detector goes silent — which is exactly
  // when we'd want it most. This heartbeat-based backup runs on setTimeout
  // (never throttled to the point of invisibility on visible tabs) and kicks
  // in as a last-resort safety net.
  //
  // Detection: currentTime not advancing for 4+ seconds while visible, focused,
  // intendedPlaying, not paused, not seeking, and readyState says we have data.
  // Recovery: a SAFE micro-seek (+0.01) followed by a play() nudge.
  //
  // Cooldown: 5s between kicks so we don't thrash if the kick itself doesn't
  // immediately unstick the decoder.
  let _hbFreezeLastVt = -1;
  let _hbFreezeStuckSince = 0;
  let _hbFreezeLastKickAt = 0;
  const HB_FREEZE_THRESHOLD_MS = 4000;
  const HB_FREEZE_KICK_COOLDOWN_MS = 5000;

  // --- heartbeat: detects device sleep/wake, persistent stalls, and state inconsistency
  function setupHeartbeat() {
    state.lastHeartbeatAt = now();
    const beat = () => {
      const nowTs = now();
      const elapsed = nowTs - state.lastHeartbeatAt;
      state.lastHeartbeatAt = nowTs;

      // CPU OPTIMIZATION: skip all heartbeat work when fully idle
      if (!state.intendedPlaying && getVideoPaused() &&
          (!coupledMode || !audio || audio.paused) &&
          !state.seeking && !state.seekBuffering) {
        return;
      }

      // audio playing but video stalled? kill audio (unless readyState says otherwise)
      // All guard logic unified through canKillAudio — bypassGrace because the
      // heartbeat only fires every ~500ms and videoWaiting has been set by the
      // browser or a sustained-stall detector, so false positives are rare.
      //
      // Additional guards vs. random audio cuts:
      //   - stall must have survived 700ms (was 450) — matches buffer monitor
      //   - seek-kick window must be fully expired
      //   - not in the first 1s of post-seek recovery
      //   - respect the same kill cooldown as the buffer monitor
      if (coupledMode && audio && !audio.paused && state.videoWaiting && canKillAudio({ bypassGrace: true }) &&
          (nowTs - _bufMonLastKillAt) >= BUF_MON_KILL_COOLDOWN_MS &&
          !seekRecoveryActive(1000)) {
        const _hbVNode = getVideoNode();
        const _hbRS = _hbVNode ? Number(_hbVNode.readyState || 0) : 4;
        // 1500ms minimum stall age (was 700→1500): audio cuts were still happening
        // on transient decoder hiccups. The buffer monitor is the primary detector;
        // heartbeat is purely a safety net for multi-second stalls it missed.
        const _hbStallAge = state.videoStallSince ? (now() - state.videoStallSince) : 0;
        if (_hbRS < HAVE_FUTURE_DATA && _hbStallAge >= 1500 &&
            (shouldPauseAudioImmediatelyForForegroundVideoBuffer() || isConfirmedForegroundVideoStall(1500))) {
          if (!state.videoStallAudioPaused) {
            _bufMonLastKillAt = nowTs;
            pauseAudioForConfirmedVideoStall();
          }
        } else if (_hbRS >= HAVE_FUTURE_DATA) {
          // stale flag, video has data
          state.videoWaiting = false;
          state.videoStallSince = 0;
        }
      }

      // --- stuck-flag safety valves (no audio/video ops, just state cleanup)
      if (coupledMode) {
        const _hbVNode2 = getVideoNode();
        const _hbRS2 = _hbVNode2 ? Number(_hbVNode2.readyState || 0) : 4;
        const _hbInSeek = state.seeking || state.seekBuffering;
        // Stall flags stuck but video has data → clear silently (the existing
        // systems will resume audio — no need to force it here)
        if ((state.videoWaiting || state.videoStallAudioPaused) && _hbRS2 >= HAVE_FUTURE_DATA && !_hbInSeek) {
          state.videoWaiting = false;
          state.videoStallSince = 0;
          if (state.videoStallAudioPaused) {
            state.videoStallAudioPaused = false;
            state.stallAudioPausedSince = 0;
            state.stallAudioResumeHoldUntil = 0;
          }
          clearForegroundBufferAudioHold();
        }
        // seekResumeInFlight stuck for >4s → release so sync loop can recover
        if (state.seekResumeInFlight && state.seekResumeStartedAt &&
            (nowTs - state.seekResumeStartedAt) > 4000) {
          state.seekResumeInFlight = false;
        }
        // strictBufferHold stuck for >10s → release and let playTogether retry
        if (state.strictBufferHold && state.bufferHoldSince &&
            (nowTs - state.bufferHoldSince) > 10000) {
          state.strictBufferHold = false;
          clearBufferHold();
          if (state.intendedPlaying && !state.endedNaturally &&
              !userPauseLockActive() && !mediaSessionForcedPauseActive()) {
            playTogether({ skipBufferGate: true }).catch(() => {});
          }
        }
      }

      // --- non-coupled MQM enforcement
      // If user paused in non-coupled mode, ensure video stays paused every heartbeat.
      // This catches any async path that restarted video between heartbeat ticks.
      if (!coupledMode && MediumQualityManager.intentPaused && state.firstPlayCommitted) {
        if (!getVideoPaused()) { execProgrammaticVideoPause(); }
        state.intendedPlaying = false;
      }

      // --- BPM stable-audio tracking
      if (coupledMode && audio && !audio.paused && state.intendedPlaying &&
        !state.videoWaiting && !state.videoStallAudioPaused) {
        BackgroundPlaybackManager.markAudioPlayingStable();
        } else {
          BackgroundPlaybackManager.markAudioNotPlaying();
        }

        // Detect device wakeup from sleep (large heartbeat gap means the JS was frozen)
        if (elapsed > WAKE_DETECT_THRESHOLD_MS) {
          state.lastBgReturnAt = nowTs;
          VisibilityGuard.onTabShow(); // VG: device wake = tab return, extend grace window
          if (platform.chromiumOnlyBrowser) {
            setChromiumBgPauseBlock(CHROMIUM_BG_PAUSE_BLOCK_MS);
            setChromiumPauseEventSuppress(BG_RETURN_GRACE_MS);
            setChromiumAutoPauseBlock(BG_RETURN_GRACE_MS);
            state.chromiumBgSettlingUntil = Math.max(state.chromiumBgSettlingUntil, nowTs + 2000);
          }
          state.pauseEventCount = 0;
          state.pauseEventResetAt = nowTs;
          if (state.intendedPlaying) {
            state.resumeOnVisible = true;
            executeSeamlessWakeup();
          }
        }

        // Consistency check: if intendedPlaying but both paused for a suspiciously long time
        // and we're in a stable visible+focused context → force resume.
        //
        // Gated against recent seek activity — the seeked-handler retry chain
        // owns the first ~1.5s after a seek. Stepping on it causes double-play.
        if (
          state.intendedPlaying &&
          !state.seeking && !state.syncing && !state.restarting &&
          !state.strictBufferHold && !state.videoWaiting &&
          !seekRecoveryActive(1200) &&
          !userPauseLockActive() && !mediaSessionForcedPauseActive() &&
          !inMediaTxnWindow() && !inBgReturnGrace() &&
          !isVisibilityTransitionActive() && !isAltTabTransitionActive() &&
          document.visibilityState === "visible" && isWindowFocused() &&
          isVisibilityStable() && isFocusStable() &&
          now() >= state.tabVisibilityChangeUntil &&
          (nowTs - state.lastConsistencyCheckAt) > CONSISTENCY_CHECK_MIN_INTERVAL_MS
        ) {
          state.lastConsistencyCheckAt = nowTs;
          const vPaused = getVideoPaused();
          const aPaused = coupledMode ? (audio ? !!audio.paused : true) : false;
          const bothPaused = vPaused && (coupledMode ? aPaused : true);

          if (bothPaused && (nowTs - state.lastUserActionTime) > 3000 &&
            !MediumQualityManager.shouldBlockAutoResume() &&
            !MediumQualityManager.intentPaused &&
            !state.userGesturePauseIntent) {
            state.consistencyCheckPendingPlayUntil = nowTs + 2000;
          playTogether().catch(() => {});
            }
        }

        // Enhanced background sync with aggressive retry
        if (state.intendedPlaying && isHiddenBackground() && !state.seeking && !state.seekBuffering && !state.strictBufferHold) {
          const aPausedBg = audio ? !!audio.paused : true;
          const vPausedBg = getVideoPaused();
          if (!aPausedBg && vPausedBg && !state.bgSilentTimeSyncing) {
            const atBg = Number(audio.currentTime);
            if (isFinite(atBg) && atBg > 0.1) bgSilentSyncVideoTime(atBg);
            if (!state.isProgrammaticVideoPlay && !state.bgResumeInFlight) {
              try { const vn = getVideoNode(); if (vn) vn.play().catch(() => {}); } catch {}
            }
          } else if (aPausedBg && vPausedBg && !state.bgResumeInFlight &&
            BackgroundPlaybackManagerManager.shouldAttemptBgResume() &&
            now() >= state.bgCatchUpCooldownUntil &&
            !userPauseLockActive() && !mediaSessionForcedPauseActive()) {
            seamlessBgCatchUp().catch(() => {});
            } else if (!aPausedBg && !vPausedBg) {
              const atSync = Number(audio.currentTime);
              const vtSync = Number(video.currentTime());
              if (isFinite(atSync) && isFinite(vtSync) && Math.abs(atSync - vtSync) > 3.0 &&
                !state.bgSilentTimeSyncing) {
                bgSilentSyncVideoTime(atSync);
                }
            }
        }
        if (!coupledMode && state.intendedPlaying && isHiddenBackground() &&
          getVideoPaused() && !state.seeking && !state.seekBuffering && !state.strictBufferHold && !state.bgResumeInFlight &&
          !userPauseLockActive() && !mediaSessionForcedPauseActive() &&
          !MediumQualityManager.shouldBlockAutoResume() &&
          !MediumQualityManager.intentPaused) {
          try {
            VisibilityGuard.onPlayCalled();
            const vn = getVideoNode();
            if (vn) vn.play().catch(() => {});
          } catch {}
          }

          // Stuck buffer hold recovery: if strictBufferHold has been active for too long
          // but video actually reports it's ready, force-clear it and attempt resume.
          // This fixes "buffered in bar but won't play" when audio buffering is slower than video.
          if (state.strictBufferHold && state.intendedPlaying && !state.seeking && !state.restarting &&
            document.visibilityState === "visible" && state.bufferHoldSince > 0) {
            const holdDuration = nowTs - state.bufferHoldSince;
          const videoNode = getVideoNode();
          const videoActuallyReady = Number(videoNode.readyState || 0) >= HAVE_FUTURE_DATA;
          // Force-clear after BUFFER_HOLD_MAX_MS regardless, or after 6s if video is ready
          if (holdDuration > BUFFER_HOLD_MAX_MS || (holdDuration > 6000 && videoActuallyReady)) {
            clearBufferHold();
            state.videoStallAudioPaused = false;
            state.stallAudioPausedSince = 0;
            state.stallAudioResumeHoldUntil = 0;
            clearResumeAfterBufferTimer();
            if (!inMediaTxnWindow() && !userPauseLockActive()) {
              playTogether().catch(() => {});
            }
          }
            }

            // Urgent post-seek rescue: if video resumed but audio is still paused,
            // force audio start aggressively for a short window.
            if (coupledMode && audio && state.intendedPlaying &&
              state.seekAudioMustStartUntil > nowTs &&
              !state.seeking && !state.seekBuffering && !state.syncing && !state.restarting &&
              !getVideoPaused() && audio.paused && !userPauseLockActive() &&
              !mediaSessionForcedPauseActive() &&
              document.visibilityState === "visible" && isWindowFocused()) {
              const vtForce = Number(video.currentTime()) || 0;
              clearAudioPauseLocks();
              state.videoWaiting = false;
              state.videoStallAudioPaused = false;
              state.stallAudioPausedSince = 0;
              state.stallAudioResumeHoldUntil = 0;
              state.audioPauseUntil = 0;
              state.audioEventsSquelchedUntil = 0;
              state.audioStartGraceUntil = Math.max(state.audioStartGraceUntil, now() + 500);
              safeSetAudioTime(vtForce);
              execProgrammaticAudioPlay({ squelchMs: 140, force: true, minGapMs: 0 }).catch(() => {});
            } else if (state.seekAudioMustStartUntil > 0 && nowTs >= state.seekAudioMustStartUntil) {
              state.seekAudioMustStartUntil = 0;
            }

            // stall watchdog: unstick audio if video is fine but audio is still held paused
            if (coupledMode && state.videoStallAudioPaused && state.intendedPlaying &&
              !state.seeking && !state.syncing && !state.restarting &&
              state.stallAudioPausedSince > 0 &&
              (nowTs - state.lastStallWatchdogAt) > 1000) {
              state.lastStallWatchdogAt = nowTs;
            const stallDuration = nowTs - state.stallAudioPausedSince;
            const vNodeWd = getVideoNode();
            const vRSWd = Number(vNodeWd.readyState || 0);
            const videoPlayingFine =
              !getVideoPaused() &&
              vRSWd >= MIN_STALL_VIDEO_RS &&
              videoReadyForAudioResume(Number(video.currentTime()) || 0);
            // video playing fine? 800ms is enough. otherwise wait the full 5s.
            if (stallDuration > STALL_WATCHDOG_MS || (stallDuration > 800 && videoPlayingFine)) {
              state.videoStallAudioPaused = false;
              state.stallAudioPausedSince = 0;
              state.stallAudioResumeHoldUntil = 0;
              state.videoWaiting = false;
              state.videoStallSince = 0;
              if (document.visibilityState === "visible" && isWindowFocused() &&
                state.intendedPlaying && !userPauseLockActive()) {
                const vtWd = Number(video.currentTime()) || 0;
              safeSetAudioTime(vtWd);
              try { audio.volume = targetVolFromVideo(); } catch {}
              state.audioStartGraceUntil = Math.max(state.audioStartGraceUntil, now() + 600);
              execProgrammaticAudioPlay({ squelchMs: 250, force: true, minGapMs: 0 })
              .catch(() => {});
                }
            }
              }

              // Orphaned A/V enforcement: if in foreground and one track is playing without the other,
              // and it's not a deliberate state (seeking, syncing, stall, etc.), resolve it.
              //
              // Gate it against recent seek activity: the seeked handler's retry chain
              // (60/250/600ms) owns audio restart for the first ~1s after a seek.
              // Letting this path kick in during that window causes competing play
              // attempts and the visible play-pause-play spam.
              if (coupledMode && state.intendedPlaying && !state.seeking && !state.syncing && !state.restarting &&
                !state.strictBufferHold && !state.videoWaiting && !state.videoStallAudioPaused &&
                now() >= state.stallAudioResumeHoldUntil && !inBgReturnGrace() &&
                !seekRecoveryActive(800) &&
                document.visibilityState === "visible" && isWindowFocused() &&
                isVisibilityStable() && !isVisibilityTransitionActive() && !isAltTabTransitionActive()) {
              const vPausedHb = getVideoPaused();
              const aPausedHb = audio ? !!audio.paused : true;
              if (!vPausedHb && aPausedHb && !state.seeking && !state.restarting && !state.syncing) {
                // Video playing but audio stuck — use enforceAudioPlayback (has stuck-timer bypass)
                const _hbSeekRecovery =
                  seekRecoveryActive(220) ||
                  (state.seekAudioKickAt > 0 && (now() - state.seekAudioKickAt) < 2200);
                enforceAudioPlayback(_hbSeekRecovery);
              } else if (!vPausedHb && aPausedHb && !shouldBlockNewAudioStart()) {
                // Video playing without audio — check readyState before restarting audio
                const vNodeHb = getVideoNode();
                if (Number(vNodeHb.readyState || 0) >= MIN_STALL_VIDEO_RS) {
                  const vtHb = Number(video.currentTime()) || 0;
                  safeSetAudioTime(vtHb);
                  execProgrammaticAudioPlay({ squelchMs: 250, force: true, minGapMs: 0 }).catch(() => {});
                }
              } else if (vPausedHb && !aPausedHb && !state.isProgrammaticAudioPlay) {
                // Audio playing without video — restart video (through unified lock).
                if (!mediaPlayTxnActive() && !chromiumPauseGuardActive() &&
                    tryAcquireVideoPlayLock()) {
                  execProgrammaticVideoPlay();
                }
              }
                }

                // --- PlaybackStabilityManager check
                // Runs every heartbeat to detect and correct state mismatches between
                // intended play state and actual video play state. Rate-limited internally.
                if (state.firstPlayCommitted && !state.startupPhase &&
                  !MediumQualityManager.shouldBlockAutoResume() &&
                  !MediumQualityManager.intentPaused) {
                  PlaybackStabilityManager.check(
                    state,
                    getVideoPaused,
                    execProgrammaticVideoPlay,
                    execProgrammaticVideoPause
                  );
                  }

                  // --- UltraStabilizer heartbeat tick
                  // Runs all 14 stabilization subsystems (buffer health, drift supervisor,
                  // stall recovery, silence guard, readyState watcher, rate guard, etc.)
                  try { UltraStabilizer.tick(); } catch {}

                  // --- Stuck seek/buffer safety valve ---
                  // If seeking or seekBuffering has been stuck for >12s, force-clear it.
                  // This prevents the player from permanently locking up after a botched seek.
                  if ((state.seeking || state.seekBuffering) && state._seekStartedAt > 0) {
                    const seekAge = performance.now() - state._seekStartedAt;
                    if (seekAge > 12000) {
                      state.seeking = false;
                      state.seekBuffering = false;
                      state.seekResumeInFlight = false;
                      state.seekCompleted = true;
                      state._seekStartedAt = 0;
                      state.pendingSeekTarget = null;
                      state.seekTargetTime = 0;
                      clearSeekSyncFinalizeTimer();
                      clearSeekWatchdog();
                      if (state.intendedPlaying && !userPauseLockActive() &&
                          document.visibilityState === "visible") {
                        playTogether().catch(() => {});
                      }
                    }
                  }

                  // --- Stuck bgResumeInFlight safety valve ---
                  // bgResumeInFlight blocks seamlessBgCatchUp. Clear if stuck >8s.
                  if (state.bgResumeInFlight && state.lastBgReturnAt > 0 &&
                      (nowTs - state.lastBgReturnAt) > 8000) {
                    state.bgResumeInFlight = false;
                  }

                  // --- heartbeat-level frozen video backup detector ---
                  // Last-resort backup for the rAF-based freeze detector. The rAF
                  // loop is the primary mechanism, but if the browser stops firing
                  // rAF (minimized, throttled, GPU backpressure), we need a timer-
                  // based safety net. Runs every HEARTBEAT_INTERVAL_MS (1500ms).
                  //
                  // Conditions for "video is frozen":
                  //   - intendedPlaying
                  //   - visible + focused + stable
                  //   - not paused, not seeking, not buffering, not restarting
                  //   - readyState >= HAVE_FUTURE_DATA (we have data to advance)
                  //   - currentTime has not changed by > 0.01s since last check
                  //   - no recent seek activity
                  //   - not in bg-return grace / visibility transition
                  //
                  // Recovery: safe +0.01 micro-seek + play() kick, marked with
                  // _isMicroSeek so seeking/seeked handlers don't cascade it into
                  // the seek machinery.
                  if (
                    state.intendedPlaying && !state.endedNaturally && !state.restarting &&
                    !state.seeking && !state.seekBuffering && !state.seekResumeInFlight &&
                    !state.strictBufferHold && !state.videoWaiting &&
                    !state.videoStallAudioPaused &&
                    !seekRecoveryActive(1500) &&
                    !userPauseLockActive() && !mediaSessionForcedPauseActive() &&
                    !inMediaTxnWindow() && !inBgReturnGrace() &&
                    !isVisibilityTransitionActive() && !isAltTabTransitionActive() &&
                    document.visibilityState === "visible" && isWindowFocused() &&
                    isVisibilityStable() && isFocusStable()
                  ) {
                    const _frzVNode = getVideoNode();
                    if (_frzVNode && !_frzVNode.paused) {
                      const _frzVt = Number(_frzVNode.currentTime) || 0;
                      const _frzRS = Number(_frzVNode.readyState || 0);
                      const _frzDur = Number(_frzVNode.duration) || 0;
                      // Only consider the video "frozen" if it has data and isn't at EOF.
                      const _frzHasData = _frzRS >= HAVE_FUTURE_DATA;
                      const _frzNotAtEnd = _frzDur <= 0 || _frzVt < _frzDur - 0.5;
                      if (_frzHasData && _frzNotAtEnd) {
                        if (_hbFreezeLastVt >= 0 && Math.abs(_frzVt - _hbFreezeLastVt) < 0.01) {
                          if (!_hbFreezeStuckSince) _hbFreezeStuckSince = nowTs;
                          const _stuckFor = nowTs - _hbFreezeStuckSince;
                          if (_stuckFor >= HB_FREEZE_THRESHOLD_MS &&
                              (nowTs - _hbFreezeLastKickAt) >= HB_FREEZE_KICK_COOLDOWN_MS) {
                            _hbFreezeLastKickAt = nowTs;
                            _hbFreezeStuckSince = 0;
                            // Safe micro-seek: +0.001s forward, never backward,
                            // never past EOF. Marked as _isMicroSeek so it
                            // doesn't cascade into the seek retry chain.
                            // Forward seeks stay in the current GOP — no keyframe flash.
                            const _kickTarget = _frzVt + 0.001;
                            if (_frzVt > 0.01 && (_frzDur <= 0 || _kickTarget < _frzDur - 0.5) && canDoCompositorFlush()) {
                              recordMicroSeek();
                              state._isMicroSeek = true;
                              try { _frzVNode.currentTime = _kickTarget; } catch {}
                              setTimeout(() => { state._isMicroSeek = false; }, 200);
                              // Nudge play() — through the unified lock so we
                              // don't race other kick paths.
                              if (_frzVNode.paused && tryAcquireVideoPlayLock()) {
                                DONTMAKEITDOUBLEPLAY.resetAll();
                                const _p = execProgrammaticVideoPlay();
                                if (_p && typeof _p.catch === "function") _p.catch(() => {});
                              }
                              // Also nudge audio if we're in coupled mode and
                              // audio is paused — but only if we're not in a
                              // delicate post-seek window.
                              if (coupledMode && audio && audio.paused &&
                                  !state.seeking && !state.seekBuffering &&
                                  canResumeAudio && canResumeAudio()) {
                                try {
                                  state._allowAudioTimeWrite = true;
                                  safeSetAudioTime(_kickTarget);
                                  state._allowAudioTimeWrite = false;
                                } catch {}
                                execProgrammaticAudioPlay({ squelchMs: 160, force: true, minGapMs: 0 })
                                  .catch(() => {});
                              }
                            }
                          }
                        } else {
                          _hbFreezeStuckSince = 0;
                        }
                        _hbFreezeLastVt = _frzVt;
                      } else {
                        _hbFreezeLastVt = -1;
                        _hbFreezeStuckSince = 0;
                      }
                    } else {
                      _hbFreezeLastVt = -1;
                      _hbFreezeStuckSince = 0;
                    }
                  } else {
                    _hbFreezeLastVt = -1;
                    _hbFreezeStuckSince = 0;
                  }

                  state.heartbeatTimer = setTimeout(beat, HEARTBEAT_INTERVAL_MS);
    };
    state.heartbeatTimer = setTimeout(beat, HEARTBEAT_INTERVAL_MS);
  }

  // --- iOS AudioContext unlock (must be called from a user gesture)
  function tryUnlockAudioContext() {
    if (state.audioContextUnlocked) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();
      if (ctx.state === "running") {
        state.audioContextUnlocked = true;
        ctx.close().catch(() => {});
        return;
      }
      const buf = ctx.createBuffer(1, 1, 22050);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.start(0);
      ctx.resume().then(() => {
        state.audioContextUnlocked = true;
        ctx.close().catch(() => {});
      }).catch(() => {
        try { ctx.close(); } catch {}
      });
    } catch {}
  }

  // --- media error recovery
  // =========================================================================
  // error overlay — icon on left, text on right, horizontal layout
  // =========================================================================
  const PlayerErrorOverlay = (() => {
    let _el = null;
    let _stackPopup = null;
    let _visible = false;

    // inject all styles inline — no external CSS needed
    function _injectStyles() {
      if (document.getElementById("pe-overlay-css")) return;
      const s = document.createElement("style");
      s.id = "pe-overlay-css";
      s.textContent = `@keyframes pe-fadein{from{opacity:0;transform:scale(.96) translateY(4px)}to{opacity:1;transform:scale(1) translateY(0)}}.pe-overlay{position:absolute;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:linear-gradient(145deg,#0d0d0d 0%,#171717 50%,#1c1c1c 100%);color:#fff;border-radius:16px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,Helvetica,sans-serif;opacity:0;pointer-events:none;transition:opacity .3s ease}.pe-overlay.pe-visible{opacity:1;pointer-events:auto}.pe-overlay.pe-visible .pe-overlay-inner{animation:pe-fadein .35s cubic-bezier(.16,1,.3,1)}.pe-overlay-inner{display:flex;align-items:center;gap:28px;max-width:560px;padding:0 40px}.pe-overlay-icon{width:100px;height:100px;flex-shrink:0;fill:#3a3a3a;opacity:.9}.pe-overlay-text{display:flex;flex-direction:column;gap:8px;min-width:0}.pe-overlay-title{font-size:17px;font-weight:600;color:#f0f0f0;line-height:1.5;letter-spacing:-.015em}.pe-overlay-title a{color:#3ea6ff;text-decoration:none;cursor:pointer;transition:color .15s}.pe-overlay-title a:hover{text-decoration:underline;color:#7fc4ff}.pe-overlay-msg{font-size:13px;color:#8a8a8a;line-height:1.6}.pe-overlay-code{font-size:11px;color:#555;margin-top:2px;font-family:"SF Mono","Roboto Mono","Consolas","Courier New",monospace;letter-spacing:.03em;opacity:.9}.pe-overlay-actions{display:flex;gap:10px;margin-top:16px;flex-wrap:wrap}.pe-overlay-btn,.pe-overlay-btn-outline,.pe-overlay-stack-link,.pe-stack-popup-close,.pe-stack-popup-copy{transform:none !important;filter:none !important}.pe-overlay-btn:hover,.pe-overlay-btn:focus,.pe-overlay-btn:active,.pe-overlay-btn-outline:hover,.pe-overlay-btn-outline:focus,.pe-overlay-btn-outline:active,.pe-overlay-stack-link:hover,.pe-overlay-stack-link:focus,.pe-overlay-stack-link:active,.pe-stack-popup-close:hover,.pe-stack-popup-close:focus,.pe-stack-popup-close:active,.pe-stack-popup-copy:hover,.pe-stack-popup-copy:focus,.pe-stack-popup-copy:active{transform:none !important;filter:none !important}.pe-overlay-btn{padding:10px 24px;width:fit-content;background-color:#fff !important;color:#0f0f0f !important;border:none !important;border-radius:22px;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit;transition:background-color .15s,box-shadow .2s;line-height:1;outline:none;-webkit-appearance:none;appearance:none;text-decoration:none !important;display:inline-flex;align-items:center;box-shadow:0 2px 12px rgba(0,0,0,.35)}.pe-overlay-btn:hover{background-color:#e8e8e8 !important;box-shadow:0 4px 16px rgba(0,0,0,.45) !important}.pe-overlay-btn:active{background-color:#d4d4d4 !important;box-shadow:0 1px 4px rgba(0,0,0,.3) !important}.pe-overlay-btn-outline{padding:10px 24px;width:fit-content;background-color:transparent !important;color:#aaa !important;border:1px solid rgba(255,255,255,.12) !important;border-radius:22px;font-size:14px;font-weight:500;cursor:pointer;font-family:inherit;transition:all .15s;line-height:1;outline:none;-webkit-appearance:none;appearance:none;text-decoration:none !important;display:inline-flex;align-items:center}.pe-overlay-btn-outline:hover{background-color:rgba(255,255,255,.06) !important;border-color:rgba(255,255,255,.22) !important;color:#fff !important}.pe-overlay-btn-outline:active{background-color:rgba(255,255,255,.1) !important}.pe-overlay-stack-link{font-size:12px;color:#3ea6ff;cursor:pointer;margin-top:12px;display:none;background:none;border:none;padding:0;font-family:inherit;text-decoration:none;text-align:left;opacity:.75;transition:opacity .15s,color .15s}.pe-overlay-stack-link:hover{opacity:1;color:#7fc4ff}.pe-stack-popup-backdrop{position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.8);display:flex;align-items:center;justify-content:center;opacity:0;pointer-events:none;transition:opacity .25s ease;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}.pe-stack-popup-backdrop.pe-stack-popup-open{opacity:1;pointer-events:auto}.pe-stack-popup{background:#1a1a1a;border-radius:16px;padding:0;width:90vw;max-width:640px;max-height:70vh;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.9),0 0 0 1px rgba(255,255,255,.05);position:relative;display:flex;flex-direction:column}.pe-stack-popup-title{font-size:12px;font-weight:600;color:#ccc;padding:16px 22px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,.06);flex-shrink:0;letter-spacing:.06em;text-transform:uppercase}.pe-stack-popup-close{background:none;border:none;color:#666;font-size:20px;cursor:pointer;padding:4px 8px;line-height:1;font-family:inherit;border-radius:8px;transition:all .15s}.pe-stack-popup-close:hover{color:#fff;background:rgba(255,255,255,.08)}.pe-stack-popup-copy{background:none;border:1px solid rgba(255,255,255,.1);color:#888;font-size:11px;cursor:pointer;padding:5px 14px;border-radius:12px;font-family:inherit;margin-right:8px;transition:all .15s;letter-spacing:.02em}.pe-stack-popup-copy:hover{color:#fff;border-color:rgba(255,255,255,.22);background:rgba(255,255,255,.05)}.pe-overlay-stack{font-size:12px;color:#b0b0b0;white-space:pre-wrap;word-break:break-all;font-family:"SF Mono","Roboto Mono","Consolas","Courier New",monospace;margin:0;padding:20px 24px;line-height:1.8;user-select:text;-webkit-user-select:text;overflow-y:auto;flex:1;background:#141414}`;
      document.head.appendChild(s);
    }

    function _create() {
      if (_el) return _el;
      _injectStyles();
      _el = document.createElement("div");
      _el.className = "pe-overlay";
      _el.innerHTML = `
        <div class="pe-overlay-inner">
          <svg class="pe-overlay-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
          </svg>
          <div class="pe-overlay-text">
            <div class="pe-overlay-title"></div>
            <div class="pe-overlay-msg"></div>
            <div class="pe-overlay-code"></div>
            <button class="pe-overlay-stack-link">Show stack trace</button>
            <div class="pe-overlay-actions">
              <button class="pe-overlay-btn" style="display:none">Reload</button>
              <a class="pe-overlay-btn-outline" style="display:none" target="_blank" rel="noopener noreferrer">Report Issue</a>
            </div>
          </div>
        </div>
      `;
      // insert into the video.js container so it sits on top of the video
      const container = video.el ? video.el() : videoEl.parentElement;
      if (container) {
        container.style.position = container.style.position || "relative";
        container.appendChild(_el);
      }
      _el.querySelector(".pe-overlay-btn").addEventListener("click", () => {
        // Don't hide the overlay — keep it visible during reload so the user
        // doesn't see a flash of broken player before the page refreshes.
        window.location.reload();
      });
      // Stack trace popup — lives on document.body, centered on screen
      _stackPopup = document.createElement("div");
      _stackPopup.className = "pe-stack-popup-backdrop";
      _stackPopup.innerHTML = `
        <div class="pe-stack-popup">
          <div class="pe-stack-popup-title">
            <span>Stack Trace</span>
            <span style="display:flex;align-items:center;gap:4px">
              <button class="pe-stack-popup-copy">Copy</button>
              <button class="pe-stack-popup-close">&times;</button>
            </span>
          </div>
          <pre class="pe-overlay-stack"></pre>
        </div>
      `;
      document.body.appendChild(_stackPopup);
      // close button
      _stackPopup.querySelector(".pe-stack-popup-close").addEventListener("click", () => {
        _stackPopup.classList.remove("pe-stack-popup-open");
      });
      // click backdrop to close
      _stackPopup.addEventListener("click", (e) => {
        if (e.target === _stackPopup) _stackPopup.classList.remove("pe-stack-popup-open");
      });
      // copy button
      _stackPopup.querySelector(".pe-stack-popup-copy").addEventListener("click", (e) => {
        const text = _stackPopup.querySelector(".pe-overlay-stack").textContent || "";
        const btn = e.currentTarget;
        try {
          navigator.clipboard.writeText(text).then(() => {
            btn.textContent = "Copied";
            setTimeout(() => { btn.textContent = "Copy"; }, 1500);
          }).catch(() => {});
        } catch {}
      });
      // "Show stack trace" link opens the popup
      const stackLink = _el.querySelector(".pe-overlay-stack-link");
      stackLink.addEventListener("click", () => {
        _stackPopup.classList.add("pe-stack-popup-open");
      });
      return _el;
    }

    function show({ title, message, code, canRetry, reportUrl, stackTrace }) {
      const el = _create();
      const titleEl = el.querySelector(".pe-overlay-title");
      // Always use textContent (never innerHTML) to prevent HTML injection.
      // All error titles are plain text constants defined in scopeTitles.
      titleEl.textContent = title || "An error occurred";
      el.querySelector(".pe-overlay-msg").textContent = message || "";
      el.querySelector(".pe-overlay-code").textContent = code ? `Error code: ${code}` : "";
      const btn = el.querySelector(".pe-overlay-btn");
      btn.style.display = canRetry ? "" : "none";
      const reportBtn = el.querySelector(".pe-overlay-btn-outline");
      // Validate report URL — only http(s) and mailto: are allowed. Refuses
      // javascript:, data:, vbscript:, and anything else that could run code
      // when the user clicks "Report issue".
      let _safeReportUrl = null;
      if (reportUrl) {
        try {
          const _parsed = new URL(String(reportUrl), window.location.href);
          const _proto = String(_parsed.protocol || "").toLowerCase();
          if (_proto === "http:" || _proto === "https:" || _proto === "mailto:") {
            _safeReportUrl = _parsed.href;
          }
        } catch {}
      }
      if (_safeReportUrl) {
        reportBtn.style.display = "";
        reportBtn.href = _safeReportUrl;
      } else {
        reportBtn.style.display = "none";
        reportBtn.removeAttribute("href");
      }
      // stack trace — show the link if we have trace data; popup is separate
      const stackLink = el.querySelector(".pe-overlay-stack-link");
      if (stackTrace && _stackPopup) {
        _stackPopup.querySelector(".pe-overlay-stack").textContent = stackTrace;
        stackLink.style.display = "";
        stackLink.textContent = "Show stack trace";
        _stackPopup.classList.remove("pe-stack-popup-open");
      } else {
        stackLink.style.display = "none";
        if (_stackPopup) {
          _stackPopup.classList.remove("pe-stack-popup-open");
          _stackPopup.querySelector(".pe-overlay-stack").textContent = "";
        }
      }
      el.classList.add("pe-visible");
      _visible = true;
    }

    function hide() {
      if (_el) _el.classList.remove("pe-visible");
      if (_stackPopup) _stackPopup.classList.remove("pe-stack-popup-open");
      _visible = false;
    }

    function isVisible() { return _visible; }

    return { show, hide, isVisible };
  })();

  // =========================================================================
  // handleFatalMediaError — shows overlay for video, audio, or both errors
  // =========================================================================
  let _videoErrorObj = null;
  let _audioErrorObj = null;
  let _errorOverlayShown = false;

  // unique error IDs — 10 per source (video, audio, player)
  const ERROR_IDS = {
    // video errors (1-10)
    "video-1":  "MEDIA_ERR_ABORTED",
    "video-2":  "MEDIA_ERR_NETWORK",
    "video-3":  "MEDIA_ERR_DECODE",
    "video-4":  "MEDIA_ERR_SRC_NOT_SUPPORTED",
    "video-5":  "MEDIA_ERR_ENCRYPTED",
    "video-6":  "MEDIA_ERR_STALL_TIMEOUT",
    "video-7":  "MEDIA_ERR_BUFFER_FULL",
    "video-8":  "MEDIA_ERR_RENDERER_FAILED",
    "video-9":  "MEDIA_ERR_CODEC_UNSUPPORTED",
    "video-10": "MEDIA_ERR_UNKNOWN",
    // audio errors (1-10)
    "audio-1":  "AUDIO_ERR_ABORTED",
    "audio-2":  "AUDIO_ERR_NETWORK",
    "audio-3":  "AUDIO_ERR_DECODE",
    "audio-4":  "AUDIO_ERR_SRC_NOT_SUPPORTED",
    "audio-5":  "AUDIO_ERR_ENCRYPTED",
    "audio-6":  "AUDIO_ERR_STALL_TIMEOUT",
    "audio-7":  "AUDIO_ERR_BUFFER_FULL",
    "audio-8":  "AUDIO_ERR_SYNC_LOST",
    "audio-9":  "AUDIO_ERR_CODEC_UNSUPPORTED",
    "audio-10": "AUDIO_ERR_UNKNOWN",
    // player errors (both, 1-10)
    "player-1":  "PLAYER_ERR_ABORTED",
    "player-2":  "PLAYER_ERR_NETWORK",
    "player-3":  "PLAYER_ERR_DECODE",
    "player-4":  "PLAYER_ERR_SRC_NOT_SUPPORTED",
    "player-5":  "PLAYER_ERR_ENCRYPTED",
    "player-6":  "PLAYER_ERR_STALL_TIMEOUT",
    "player-7":  "PLAYER_ERR_BUFFER_FULL",
    "player-8":  "PLAYER_ERR_STATE_CORRUPT",
    "player-9":  "PLAYER_ERR_CODEC_UNSUPPORTED",
    "player-10": "PLAYER_ERR_UNKNOWN"
  };

  function handleFatalMediaError(source, errorObj) {
    const code = errorObj ? (errorObj.code || 0) : 0;
    const msg = errorObj ? (errorObj.message || "") : "";

    if (source === "video") _videoErrorObj = errorObj;
    if (source === "audio") _audioErrorObj = errorObj;

    // determine error scope: "video", "audio", or "player" (both)
    const bothErrored = _videoErrorObj && _audioErrorObj;
    const scope = bothErrored ? "player" : source;

    // show overlay immediately for any source error
    // if already shown, update it to reflect the new scope (e.g. video→player)
    const vCode = _videoErrorObj ? (_videoErrorObj.code || 0) : 0;
    const aCode = _audioErrorObj ? (_audioErrorObj.code || 0) : 0;
    const worstCode = Math.max(vCode, aCode, code);

    const scopeTitles = {
      video: {
        1:  "Video playback aborted",
        2:  "Video network error",
        3:  "Video decode error",
        4:  "Video player configuration error",
        5:  "Video encryption error",
        6:  "Video stall timeout",
        7:  "Video buffer overflow",
        8:  "Video renderer failed",
        9:  "Video codec unsupported",
        10: "Video error"
      },
      audio: {
        1:  "Audio playback aborted",
        2:  "Audio network error",
        3:  "Audio decode error",
        4:  "Audio source not supported",
        5:  "Audio encryption error",
        6:  "Audio stall timeout",
        7:  "Audio buffer overflow",
        8:  "Audio sync lost",
        9:  "Audio codec unsupported",
        10: "Audio error"
      },
      player: {
        1:  "Playback aborted",
        2:  "Network error",
        3:  "Decode error",
        4:  "Player configuration error",
        5:  "Encryption error",
        6:  "Stall timeout",
        7:  "Buffer overflow",
        8:  "Player state error",
        9:  "Codec unsupported",
        10: "Player error"
      }
    };

    const scopeMessages = {
      video: {
        1:  "The video playback was aborted.",
        2:  "A network error caused the video to fail. Check your connection and try again.",
        3:  "The video could not be decoded. The file may be corrupt or unsupported.",
        4:  "The video format or source is not supported by your browser.",
        5:  "The video is encrypted and the key could not be retrieved.",
        6:  "The video stalled and could not recover. Try reloading.",
        7:  "The video buffer is full and playback cannot continue.",
        8:  "The video renderer encountered a fatal error.",
        9:  "The video codec is not supported by your browser.",
        10: "An unexpected video error occurred."
      },
      audio: {
        1:  "The audio playback was aborted.",
        2:  "A network error caused the audio to fail. Check your connection and try again.",
        3:  "The audio could not be decoded. The file may be corrupt or unsupported.",
        4:  "The audio format or source is not supported by your browser.",
        5:  "The audio is encrypted and the key could not be retrieved.",
        6:  "The audio stalled and could not recover. Try reloading.",
        7:  "The audio buffer is full and playback cannot continue.",
        8:  "Audio and video sync was lost and could not be restored.",
        9:  "The audio codec is not supported by your browser.",
        10: "An unexpected audio error occurred."
      },
      player: {
        1:  "Both video and audio playback were aborted.",
        2:  "A network error caused playback to fail. Check your connection and try again.",
        3:  "The media could not be decoded. The files may be corrupt or unsupported.",
        4:  "The media format or source is not supported by your browser.",
        5:  "The media is encrypted and the key could not be retrieved.",
        6:  "Playback stalled and could not recover. Try reloading.",
        7:  "The media buffer is full and playback cannot continue.",
        8:  "The player encountered an internal state error.",
        9:  "The media codec is not supported by your browser.",
        10: "An unexpected playback error occurred."
      }
    };

    const titles = scopeTitles[scope] || scopeTitles.player;
    const messages = scopeMessages[scope] || scopeMessages.player;
    const errorId = ERROR_IDS[scope + "-" + worstCode] || ("ERR_UNKNOWN_" + worstCode);
    // for unknown/unrecognized codes, use "you found a bug!"
    const isBug = !titles[worstCode];

    // pause everything
    state.intendedPlaying = false;
    state.bufferHoldIntendedPlaying = false;
    try { pauseHard(); } catch {}
    _errorOverlayShown = true;

    const _reportBase = "https://codeberg.org/ashleyirispuppy/poke/issues/new?template=issue_template%2fplayer-bug.yml";

    // Easter egg splash messages — like Minecraft crash logs
    const _splashMessages = [
      "Have you tried reinstalling the universe?",
      "This is fine. Everything is fine.",
      "The codec took the day off.",
      "The audio was simply too powerful.",
      "Error 404: Good vibes not found.",
      "It's not a bug, it's a surprise feature.",
      "The bits are revolting!",
      "Something went wrong. Probably.",
      "Works on my machine ¯\\_(ツ)_/¯",
      "This wouldn't happen in Minecraft.",
      "Have you tried turning it off and on again?",
      "The video element chose violence today.",
      "Skill issue (from the browser).",
      "The codec said 'no thank you' and left.",
      "I'm in your walls (and your error logs).",
      "Bazinga! Just kidding, this is real.",
      "Achievement unlocked: Break the player!",
      "POV: you found a rare error.",
      "The video was not the imposter. It was ejected anyway.",
      "Don't worry, the error is more scared of you than you are of it.",
      "The player tripped over its own feet.",
      "The media pipeline left the chat.",
      "L + ratio + no playback.",
      "Bro really said 'MEDIA_ERR' unironically.",
      "Certified bruh moment.",
      "The sync loop did a little too much looping.",
      "Told the audio to play. It chose emotional damage instead.",
      "This is why we can't have nice things.",
      "Someone call an ambulance... but not for me!",
      "It's giving... error.",
      "The browser ran out of vibes.",
      "Plot twist: the real error was the friends we made along the way.",
      "No thoughts, just errors.",
      "We do a little crashing.",
      "The media pipeline went on a coffee break.",
      "The video said: 'I'm tired, boss.'",
      "Looks like the decoder had a bad day at work.",
      "Unexpected token: disappointment.",
      "The electrons got confused.",
      "Error: success was not an option."
    ];
    const _splashMsg = _splashMessages[Math.floor(Math.random() * _splashMessages.length)];

    // build stack trace from the error objects
    let _stack = "";
    try {
      const parts = [];
      parts.push("// " + _splashMsg);
      parts.push("");
      parts.push("Error scope: " + scope);
      parts.push("Error code: " + worstCode + " (" + errorId + ")");
      parts.push("User agent: " + navigator.userAgent);
      parts.push("Time: " + new Date().toISOString());
      if (_videoErrorObj) {
        parts.push("\n--- Video Error ---");
        parts.push("code: " + (_videoErrorObj.code || "?"));
        parts.push("message: " + (_videoErrorObj.message || "(none)"));
        try { parts.push("video.src: " + (videoEl.currentSrc || videoEl.src || "?")); } catch {}
        try { parts.push("video.readyState: " + videoEl.readyState); } catch {}
        try { parts.push("video.networkState: " + videoEl.networkState); } catch {}
      }
      if (_audioErrorObj) {
        parts.push("\n--- Audio Error ---");
        parts.push("code: " + (_audioErrorObj.code || "?"));
        parts.push("message: " + (_audioErrorObj.message || "(none)"));
        try { parts.push("audio.src: " + (audio.currentSrc || audio.src || "?")); } catch {}
        try { parts.push("audio.readyState: " + audio.readyState); } catch {}
        try { parts.push("audio.networkState: " + audio.networkState); } catch {}
      }
      parts.push("\n--- Player State ---");
      parts.push("firstPlayCommitted: " + state.firstPlayCommitted);
      parts.push("intendedPlaying: " + state.intendedPlaying);
      parts.push("startupPhase: " + state.startupPhase);
      parts.push("coupledMode: " + coupledMode);
      _stack = parts.join("\n");
    } catch { _stack = "Failed to collect error details"; }

    PlayerErrorOverlay.show({
      title: isBug ? "You found a bug! (ಥ﹏ಥ)" : (titles[worstCode] || "Playback error"),
      message: isBug
        ? "Well this is embarrassing. The player just did something illegal. Try reloading, or snitch on it below."
        : (messages[worstCode] || (msg || "An unexpected error occurred.")),
      code: errorId,
      canRetry: true,
      reportUrl: _reportBase,
      // Stack trace only for uncaught/unknown errors — regular media errors
      // (codec, network, decode) don't need a stack trace since the error
      // code itself tells the user everything they need.
      stackTrace: isBug ? _stack : undefined
    });
  }

  function setupMediaErrorHandlers() {
    const onVideoError = (e) => {
      const errObj = videoEl.error || (e && e.target && e.target.error);
      if (errObj && errObj.code >= 1) {
        handleFatalMediaError("video", errObj);
        // if the overlay is now shown, stop trying to recover
        if (_errorOverlayShown) return;
      }
      if (!state.intendedPlaying || state.restarting) return;
      if (now() < state.mediaErrorCooldownUntil) return;
      state.mediaErrorCount++;
      state.mediaErrorCooldownUntil = now() + 4000;
      if (state.mediaErrorCount <= 3) {
        armResumeAfterBuffer(8000);
      }
    };
    const onAudioError = (e) => {
      if (!coupledMode || !audio) return;
      const errObj = audio.error || (e && e.target && e.target.error);
      if (errObj && errObj.code >= 1) {
        handleFatalMediaError("audio", errObj);
        if (_errorOverlayShown) return;
      }
      if (!state.intendedPlaying || state.restarting) return;
      if (now() < state.mediaErrorCooldownUntil) return;
      state.mediaErrorCount++;
      state.mediaErrorCooldownUntil = now() + 4000;
      if (state.mediaErrorCount <= 3) {
        setTimeout(() => {
          if (state.intendedPlaying && !state.restarting) kickAudio().catch(() => {});
        }, 500);
      }
    };
    try { videoEl.addEventListener("error", onVideoError, { passive: true }); } catch {}
    if (audio) {
      try { audio.addEventListener("error", onAudioError, { passive: true }); } catch {}
    }
    // Video.js-level error handler — catches "All candidate resources failed to load"
    // and other Video.js errors that don't fire on the native <video> element.
    // Without this, source failures silently break playback with no error overlay.
    try {
      video.on("error", () => {
        const vjsErr = video.error();
        if (vjsErr && !_errorOverlayShown) {
          const code = vjsErr.code || 4;
          const msg = vjsErr.message || "All candidate resources failed to load.";
          handleFatalMediaError("video", { code, message: msg });
        }
      });
    } catch {}
    // browser ran out of data and stalled the decode.
    // this fires a LOT on slow networks for micro-stalls that clear in
    // ~100ms. killing audio on every one was causing audible cuts. now
    // we just flag it; the waiting-event deferred timer and the sync
    // loop decide when to actually pause audio.
    const onVideoStalled = () => {
      if (!state.intendedPlaying) return;
      if (state.firstPlayCommitted) {
        state.videoWaiting = true;
        state.videoStallSince = state.videoStallSince || now();
        // Just arm the hold — do NOT pause audio directly. The waiting handler's
        // 180ms deferred timer will catch real sustained stalls. This eliminates
        // double-kills between stalled and waiting events racing each other.
        armForegroundBufferAudioHold(Math.max(MIN_STALL_AUDIO_RESUME_MS, 300));
      }
      scheduleSync(200);
    };
    const onAudioStalled = () => {
      try { UltraStabilizer.onAudioStall(); } catch {}
      if (!coupledMode || !state.intendedPlaying) return;
      scheduleSync(200);
    };
    // Audio waiting: audio ran out of data and needs to buffer.
    // Mirror of video waiting — pause video so they stay in sync.
    const onAudioWaiting = () => {
      if (!coupledMode || !state.intendedPlaying || state.restarting) return;
      if (state.seeking || state.seekResumeInFlight || state.seekBuffering) return;
      if (now() < state.seekCooldownUntil) return; // Don't stall-pause right after a seek
      if (state.tabReturnImmuneUntil > now() || NotMakePlayBackFixingNoticable.isActive()) return;
      if (!state.startupPrimed || (state.startupPhase && !state.firstPlayCommitted)) return;
      state.audioWaiting = true;
      state.audioStallSince = state.audioStallSince || now();
      if (state._stallVideoPauseTimer) { clearTimeout(state._stallVideoPauseTimer); state._stallVideoPauseTimer = null; }
      state._stallVideoPauseTimer = setTimeout(() => {
        state._stallVideoPauseTimer = null;
        if (!state.audioWaiting || !state.intendedPlaying || state.restarting) return;
        if (state.seeking || state.seekResumeInFlight || state.seekBuffering) return;
        if (now() < state.seekCooldownUntil) return;
        if (state.tabReturnImmuneUntil > now() || NotMakePlayBackFixingNoticable.isActive()) return;
        if (getVideoPaused()) return;
        if (state.startupPhase || !state.firstPlayCommitted) return;
        // Only pause video if audio is genuinely stalled (readyState < 2)
        if ((Number(audio.readyState) || 0) >= 2) return;
        state.audioStallVideoPaused = true;
        execProgrammaticVideoPause();
      }, 300);
      scheduleSync(200);
    };
    try { videoEl.addEventListener("stalled", onVideoStalled, { passive: true }); } catch {}
    if (audio) {
      try { audio.addEventListener("stalled", onAudioStalled, { passive: true }); } catch {}
      try { audio.addEventListener("waiting", onAudioWaiting, { passive: true }); } catch {}
    }
    // CORS / HTTP error detection (502, 403, etc.) — catch network errors that
    // don't fire the <video>/<audio> error event. Monitor both elements' networkState
    // periodically and also intercept fetch failures for media URLs.
    const _corsCheckInterval = setInterval(() => {
      if (_errorOverlayShown) { clearInterval(_corsCheckInterval); return; }
      // networkState 3 = NETWORK_NO_SOURCE (failed to load)
      const vNS = videoEl ? Number(videoEl.networkState || 0) : 0;
      const aNS = audio ? Number(audio.networkState || 0) : 0;
      if (vNS === 3) {
        clearInterval(_corsCheckInterval);
        handleFatalMediaError("video", { code: 2, message: "Network error — video source failed to load" });
        return;
      }
      if (aNS === 3 && coupledMode) {
        clearInterval(_corsCheckInterval);
        handleFatalMediaError("audio", { code: 2, message: "Network error (CORS/HTTP failure)" });
        return;
      }
    }, 3000);
    // Intercept HTTP errors on media segment fetches (CORS 502, etc.)
    // Override fetch to detect failed requests to video/audio source domains
    try {
      const _origFetch = window.fetch;
      window.fetch = function(url, opts) {
        return _origFetch.apply(this, arguments).then(resp => {
          if (resp && !resp.ok && resp.status >= 500) {
            const urlStr = String(typeof url === "string" ? url : (url && url.url) || "");
            // Check if this is a media request (googlevideo, videoplayback, etc.)
            if (urlStr.includes("videoplayback") || urlStr.includes("googlevideo") ||
                urlStr.includes(".mp4") || urlStr.includes(".webm") || urlStr.includes(".m4a")) {
              if (!_errorOverlayShown) {
                handleFatalMediaError("player", {
                  code: 2,
                  message: "HTTP " + resp.status + " on media request: " + urlStr.substring(0, 120)
                });
              }
            }
          }
          return resp;
        }).catch(err => {
          const urlStr = String(typeof url === "string" ? url : (url && url.url) || "");
          if (urlStr.includes("videoplayback") || urlStr.includes("googlevideo") ||
              urlStr.includes(".mp4") || urlStr.includes(".webm") || urlStr.includes(".m4a")) {
            if (!_errorOverlayShown && state.firstPlayCommitted) {
              handleFatalMediaError("player", {
                code: 2,
                message: "Network/CORS error: " + (err ? err.message : "fetch failed") + " — " + urlStr.substring(0, 120)
              });
            }
          }
          throw err;
        });
      };
    } catch {}

    // Network online recovery
    window.addEventListener("online", () => {
      state.networkOnline = true;
      state.mediaErrorCount = 0;
      state.mediaErrorCooldownUntil = 0;
      try { UltraStabilizer.onNetworkOnline(); } catch {}
      if (state.intendedPlaying && document.visibilityState === "visible") {
        setTimeout(() => {
          if (state.intendedPlaying && !state.restarting) playTogether().catch(() => {});
        }, 800);
      }
    }, { passive: true });
    window.addEventListener("offline", () => {
      state.networkOnline = false;
      try { UltraStabilizer.onNetworkOffline(); } catch {}
    }, { passive: true });
  }

  function setupUserPauseIntentDetection() {
    const root = video?.el?.() || videoEl || document;
    let pendingTechTogglePausedState = null;
    const getTargetEl = target => {
      try { return target && target.nodeType === 1 ? target : null; } catch {}
      return null;
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
      try {
        const el = getTargetEl(target);
        return !!el?.closest?.(".vjs-play-control, .vjs-big-play-button");
      } catch {}
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
    const isSeekControlTarget = target => {
      try {
        const el = getTargetEl(target);
        if (!el) return false;
        return !!el.closest?.(".vjs-progress-control, .vjs-progress-holder, .vjs-play-progress, .vjs-mouse-display");
      } catch {}
      return false;
    };
    const onPressStart = event => {
      if (!isPrimaryActivation(event)) return;
      tryUnlockAudioContext();
      state.lastUserActionTime = now();

      // Autoplay fallback: if startup autoplay was wanted but hasn't fired yet
      // (Chromium may block autoplay without user gesture), use this interaction
      // as the gesture to kick playback.
      if (wantsStartupAutoplay() && !state.firstPlayCommitted && !state.startupKickInFlight &&
        coupledMode) {
        scheduleStartupAutoplayKick();
        }

        const isPlayCtrl = isPlayControlTarget(event.target);
      const isTechSurface = isTechSurfaceTarget(event.target);
      const isSeekControl = isSeekControlTarget(event.target);
      if (isSeekControl) markUserSeekIntent(3200);
      if (isSeekControl) { state._pauseSavedPosition = -1; state._pauseSavedAt = 0; }

      if (isPlayCtrl || isTechSurface) {
        trackUserClickForSpam();
        trackToggleClick();
        beginUserToggleTxn(getVideoPaused(), USER_TOGGLE_TXN_FAST_MS);
        // Pre-set user intent only for actual toggle surfaces. Setting this on
        // all pointer events (seek/menus/sliders) creates false play/pause intents.
        if (!getVideoPaused()) {
          state.userPauseIntentPresetAt = now();
        } else {
          state.userPlayIntentPresetAt = now();
          // User wants to play — clear ended lock so restart is allowed
          MakeSureUnintentionalLoopDoesntEverHappenAtALLManager.onUserPlay();
          // Reset play dedup so user's play() goes through immediately
          DONTMAKEITDOUBLEPLAY.resetAll();
        }
      }

      // Spam debounce: if user is clicking too fast, debounce the toggle.
      // Only the last click in a rapid burst actually executes. This prevents
      // glitchy play-pause-play loops from button spamming.
      if (isPlayCtrl || isTechSurface) {
        if (isToggleSpamming()) {
          const wantPlay = getVideoPaused();
          beginUserToggleTxn(wantPlay, USER_TOGGLE_TXN_FAST_MS);
          // During spam, prevent video.js from processing the native event
          // by setting our intent flags so the event handlers accept it quietly
          if (wantPlay) {
            state.userPlayIntentPresetAt = now();
          } else {
            state.userPauseIntentPresetAt = now();
          }
          debouncedToggle(wantPlay, false);
          pendingTechTogglePausedState = null;
          return;
        }
      }

      if (isPlayCtrl) {
        pendingTechTogglePausedState = null;
        if (getVideoPaused()) markUserPlayIntent(USER_PLAY_INTENT_FAST_MS, { skipImmediateAudioKick: true });
        else {
          markUserPauseIntent(USER_PAUSE_INTENT_FAST_MS);
          clearPendingPlayResumesForPause();
        }
        return;
      }
      if (isTechSurface) {
        pendingTechTogglePausedState = getVideoPaused();
        beginUserToggleTxn(!!pendingTechTogglePausedState, USER_TOGGLE_TXN_FAST_MS);
        if (!getVideoPaused()) {
          state.userPauseUntil = Math.max(state.userPauseUntil, now() + USER_PAUSE_INTENT_FAST_MS);
        }
        if (!coupledMode) {
          if (getVideoPaused()) {
            state.intendedPlaying = true;
            state.userPlayUntil = now() + 600;
          } else {
            state.intendedPlaying = false;
            state.bufferHoldIntendedPlaying = false;
            MediumQualityManager.markUserPaused();
            state.userGesturePauseIntent = true;
            setTimeout(() => { state.userGesturePauseIntent = false; }, USER_GESTURE_PAUSE_HOLD_MS);
          }
        }
        return;
      }
      pendingTechTogglePausedState = null;
    };
    const onClick = event => {
      if (isPlayControlTarget(event.target)) {
        const clickTs = now();
        const wasPaused = getVideoPaused();
        pendingTechTogglePausedState = null;
        // Fallback for browsers/UI paths where pointerdown doesn't surface to us.
        // Without this, restart-from-ended can be misread as auto-play and get paused.
        if (wasPaused) {
          const haveRecentPlayIntent =
            ((state.userPlayIntentPresetAt > 0) && ((clickTs - state.userPlayIntentPresetAt) < 650)) ||
            userToggleRecently("play", 650) ||
            userToggleExpectingPlay();
          if (!haveRecentPlayIntent) {
            markUserPlayIntent(USER_PLAY_INTENT_FAST_MS, { skipImmediateAudioKick: true });
          }
          requestAnimationFrame(() => {
            if (!getVideoPaused()) return;
            if (!state.intendedPlaying || userPauseLockActive() || mediaSessionForcedPauseActive()) return;
            const _pcVn = getVideoNode();
            if (_pcVn && typeof _pcVn.play === "function" && _pcVn.paused) _pcVn.play().catch(() => {});
            if (coupledMode && audio && audio.paused) {
              execProgrammaticAudioPlay({ squelchMs: 120, force: true, minGapMs: 0 }).catch(() => {});
            }
            scheduleSync(0);
          });
        } else {
          const haveRecentPauseIntent =
            ((state.userPauseIntentPresetAt > 0) && ((clickTs - state.userPauseIntentPresetAt) < 650)) ||
            userToggleRecently("pause", 650) ||
            userToggleExpectingPause();
          if (!haveRecentPauseIntent) {
            markUserPauseIntent(USER_PAUSE_INTENT_FAST_MS);
            clearPendingPlayResumesForPause();
          }
        }
        return;
      }
      if (!isTechSurfaceTarget(event.target)) { pendingTechTogglePausedState = null; return; }
      const wasPaused = pendingTechTogglePausedState;
      pendingTechTogglePausedState = null;
      if (typeof wasPaused !== "boolean") return;
      requestAnimationFrame(() => {
        const paused = getVideoPaused();
        if (wasPaused && !paused) {
          markUserPlayIntent(USER_PLAY_INTENT_FAST_MS);
        } else if (!wasPaused && paused) {
          markUserPauseIntent(USER_PAUSE_INTENT_FAST_MS);
          clearPendingPlayResumesForPause();
        }
      });
    };
    const onKeyDown = event => {
      // Unlock AudioContext on keyboard interaction too
      tryUnlockAudioContext();
      const code = event.code || event.key || "";
      if (
        code === "ArrowLeft" || code === "ArrowRight" ||
        code === "Home" || code === "End" ||
        code === "KeyJ" || code === "KeyL" ||
        code === "MediaSeekBackward" || code === "MediaSeekForward"
      ) {
        markUserSeekIntent(2800);
      }
      if (code === "Space" || code === "KeyK" || code === "MediaPlayPause") {
        if (getVideoPaused()) markUserPlayIntent(USER_PLAY_INTENT_FAST_MS);
        else {
          markUserPauseIntent(USER_PAUSE_INTENT_FAST_MS);
          clearPendingPlayResumesForPause();
        }
      } else if (code === "MediaPause" || code === "MediaStop") {
        markUserPauseIntent(USER_PAUSE_INTENT_FAST_MS);
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
      setMediaSessionForcedPause(4000);
      markUserPauseIntent(1200);
      clearPendingPlayResumesForPause();
      setPauseEventGuard(1200);
      setMediaPauseTxn(900);
      state.intendedPlaying = false;
      state.bufferHoldIntendedPlaying = false;
      clearBufferHold();
      state.startupAudioHoldUntil = 0;
      state.syncing = false;
      state.resumeOnVisible = false;
      clearHiddenPlayPending();
      cancelBackgroundResumeState();
      updateMediaSessionPlaybackState();
      pauseHard();
    };
    try {
      navigator.mediaSession.setActionHandler("play", () => {
        const serial = ++state.mediaSessionActionSerial;
        // User explicitly pressed play from OS media controls — clear ended lock
        MakeSureUnintentionalLoopDoesntEverHappenAtALLManager.onUserPlay();
        clearMediaSessionForcedPause();
        state.mediaSessionInitiatedPlay = true;
        markMediaAction("play");
        markUserPlayIntent(USER_PLAY_INTENT_FAST_MS); // also calls cancelActiveFade + clears isProgrammaticAudioPause
        state.intendedPlaying = true;
        state.bufferHoldIntendedPlaying = true;
        // Backup: cancel fade again in case pauseHard's fade timer is still running
        cancelActiveFade();
        state.isProgrammaticAudioPause = false;
        state.audioEventsSquelchedUntil = 0; // clear squelch so audio can start
        updateMediaSessionPlaybackState();
        setPauseEventGuard(1200);
        setMediaPlayTxn(1000);
        setFastSync(2800);
        state.audioPauseUntil = 0;
        state.audioPlayUntil = 0;
        state.startupAudioHoldUntil = 0;
        const _hiddenPlayRequest = document.visibilityState === "hidden" || !isWindowFocused();
        if (_hiddenPlayRequest) {
          armHiddenPlayPending(45000);
        } else {
          state.hiddenPlayRequestUntil = 0;
          state.foregroundResumeBoostUntil = Math.max(state.foregroundResumeBoostUntil, now() + 2500);
          clearHiddenMediaSessionPlay();
        }
        const resumePos = getBestResumePosition();
        const currentVT = (() => { try { return Number(video.currentTime()); } catch { return 0; } })();
        const currentAT = coupledMode ? (() => { try { return Number(audio.currentTime); } catch { return 0; } })() : resumePos;
        const needsSeek = resumePos > 0.5 && (currentVT < 0.5 || currentAT < 0.5 || Math.abs(resumePos - currentVT) > 1.0);
        if (needsSeek) {
          squelchAudioEvents(800);
          safeSetVideoTime(resumePos, { force: true });
        } else if (coupledMode && isFinite(currentVT) && isFinite(currentAT) && Math.abs(currentAT - currentVT) > 0.5) {
          squelchAudioEvents(600);
          safeSetAudioTime(currentVT);
        }
        resetAudioPlaybackRate();
        let playPromise = null;
        let audioPromise = null;
        try { playPromise = execProgrammaticVideoPlay(); } catch {}
        if (coupledMode) {
          try { audioPromise = execProgrammaticAudioPlay({ squelchMs: 700, minGapMs: 0, force: true }); } catch {}
        }
        Promise.allSettled([playPromise, audioPromise]).finally(() => {
          if (serial !== state.mediaSessionActionSerial) return;
          setTimeout(() => {
            if (serial !== state.mediaSessionActionSerial) return;
            if (!state.intendedPlaying || userPauseLockActive()) return;
            playTogether().catch(() => {});
          }, 0);
        });
      });
      navigator.mediaSession.setActionHandler("pause", handlePauseLike);
      try { navigator.mediaSession.setActionHandler("stop", handlePauseLike); } catch {}
      navigator.mediaSession.setActionHandler("seekforward", d => {
        const inc = Number(d?.seekOffset) || 10;
        const newTime = Math.min((video.currentTime() || 0) + inc, Number(video.duration()) || 0);
        markUserSeekIntent(3000);
        if (newTime < 0.8) authorizeNearZeroSeek(2500);
        state.pendingSeekTarget = newTime;
        state.seekWantedPlaying = state.intendedPlaying;
        if (state.seekWantedPlaying) armSeekResumeIntent(9000);
        state.seekStabilizeUntil = Math.max(state.seekStabilizeUntil, now() + 5000);
        safeSetVideoTime(newTime, { force: true });
      });
      navigator.mediaSession.setActionHandler("seekbackward", d => {
        const dec = Number(d?.seekOffset) || 10;
        const newTime = Math.max((video.currentTime() || 0) - dec, 0);
        markUserSeekIntent(3000);
        if (newTime < 0.8) authorizeNearZeroSeek(2500);
        state.pendingSeekTarget = newTime;
        state.seekWantedPlaying = state.intendedPlaying;
        if (state.seekWantedPlaying) armSeekResumeIntent(9000);
        state.seekStabilizeUntil = Math.max(state.seekStabilizeUntil, now() + 5000);
        safeSetVideoTime(newTime, { force: true });
      });
      navigator.mediaSession.setActionHandler("seekto", d => {
        if (!d || typeof d.seekTime !== "number") return;
        const newTime = Math.max(0, Math.min(Number(video.duration()) || 0, d.seekTime));
        markUserSeekIntent(3000);
        if (newTime < 0.8) authorizeNearZeroSeek(2500);
        state.pendingSeekTarget = newTime;
        state.seekWantedPlaying = state.intendedPlaying;
        if (state.seekWantedPlaying) armSeekResumeIntent(9000);
        state.seekStabilizeUntil = Math.max(state.seekStabilizeUntil, now() + 5000);
        safeSetVideoTime(newTime, { force: true });
      });
    } catch {}
  }

  function bindCommonMediaEvents() {
    video.on("ratechange", () => {
      if (!coupledMode) return;
      try {
        const newRate = Number(video.playbackRate()) || 1;
        audio.playbackRate = newRate;
        state.driftStableFrames = 0;
        state.lastDrift = 0;
        state.audioRateNudgeActive = false;
        state.audioRateNudgeUntil = 0;
      } catch {}
    });
    video.on("play", () => {
      // Error overlay active — kill any play attempts
      if (_errorOverlayShown) {
        execProgrammaticVideoPause();
        if (coupledMode && audio && !audio.paused) { try { audio.pause(); } catch {} }
        return;
      }
      // If seeking, don't silently eat the play — mark intent so seek finalize resumes
      if (state.seeking || state.seekBuffering) {
        state.playRequestedDuringSeek = true;
        state.intendedPlaying = true;
        state.bufferHoldIntendedPlaying = true;
        return;
      }
      // If user just clicked play, strip any stale pause-expecting txn and
      // any stale loop-prevention cooldown that could turn this play into
      // the visible play-pause-play cycle the user reported.
      if (userWantsPlayNow(2400)) {
        if (userToggleExpectingPause()) clearUserToggleTxn();
        state.loopPreventionCooldownUntil = 0;
        state.rapidPlayPauseCount = 0;
      }
      // User just requested pause and browser emitted a stray play: keep paused.
      if (userToggleExpectingPause() && !state.isProgrammaticVideoPlay && !state.isProgrammaticVideoPause) {
        execProgrammaticVideoPause();
        return;
      }
      // User just requested play: lock to play state and ignore transient opposite events.
      if (userToggleExpectingPlay()) {
        state.intendedPlaying = true;
        state.bufferHoldIntendedPlaying = true;
        clearMediaSessionForcedPause();
        clearUserToggleTxn();
        startForegroundUserPlayRetry();
      }
      // Anti-loop: if video ended naturally and something is trying to auto-restart,
      // block it unless the user EXPLICITLY clicked play (userPlayIntentPresetAt).
      // Use explicit play-toggle intent; generic user activity is too loose.
      const _isUserPlayAction = document.visibilityState === "visible" && userWantsPlayNow(2400);
      if (MakeSureUnintentionalLoopDoesntEverHappenAtALLManager.shouldBlockAutoRestart() && !_isUserPlayAction) {
        execProgrammaticVideoPause();
        if (coupledMode && audio && !audio.paused) {
          try { audio.pause(); } catch {}
        }
        return;
      }
      if (_isUserPlayAction) {
        MakeSureUnintentionalLoopDoesntEverHappenAtALLManager.onUserPlay();
      }
      // TAB RETURN + STARTUP IMMUNITY: accept play if we were playing or during startup.
      // Never override an explicit user pause.
      if (state.tabReturnImmuneUntil > now() && (state.intendedPlaying || !state.firstPlayCommitted)) {
        state.intendedPlaying = true;
        state.bufferHoldIntendedPlaying = true;
        if (!coupledMode) MediumQualityManager.markUserPlayed();
        if (!state.firstPlayCommitted) {
          state.firstPlayCommitted = true;
          state.startupKickDone = true;
          clearStartupAutoplayRetryTimer();
          setTimeout(() => { state.startupPhase = false; }, 500);
          // Strip autoplay so Video.js doesn't auto-restart after ended
          setTimeout(stripAutoplayAfterFirstPlay, 2000);
        }
        updateMediaSessionPlaybackState();
        return;
      }

      if (!coupledMode) {
        if (MediumQualityManager.intentPaused && state.firstPlayCommitted) {
          execProgrammaticVideoPause();
          return;
        }
        // User preset play intent (set on pointerdown) → accept
        if (state.userPlayIntentPresetAt > 0 && (now() - state.userPlayIntentPresetAt) < 2000) {
          state.userPlayIntentPresetAt = 0;
          MediumQualityManager.markUserPlayed();
          state.intendedPlaying = true;
          state.bufferHoldIntendedPlaying = true;
          state.playSessionId++;
          if (!state.firstPlayCommitted) {
            state.firstPlayCommitted = true;
            state.startupKickDone = true;
            state.startupPhase = false;
          }
          clearMediaSessionForcedPause();
          markMediaAction("play");
          forceUnmuteForPlaybackIfAllowed();
          updateMediaSessionPlaybackState();
          return;
        }
        // Our own programmatic play (bg resume, stall recovery) → accept silently
        if (state.isProgrammaticVideoPlay) {
          if (!state.intendedPlaying && state.firstPlayCommitted) {
            // Programmatic play but user paused → override it
            execProgrammaticVideoPause();
          }
          return;
        }
        // Startup autoplay (before user has ever interacted) → accept
        if (!state.firstPlayCommitted && wantsStartupAutoplay()) {
          state.intendedPlaying = true;
          state.bufferHoldIntendedPlaying = true;
          state.firstPlayCommitted = true;
          state.startupKickDone = true;
          state.startupPhase = false;
          // Immunity protects against browser re-pausing right after autoplay
          state.tabReturnImmuneUntil = Math.max(state.tabReturnImmuneUntil, now() + 2000);
          markMediaAction("play");
          forceUnmuteForPlaybackIfAllowed();
          updateMediaSessionPlaybackState();
          return;
        }
        // intendedPlaying already true → accept (expected, e.g. bg resume)
        if (state.intendedPlaying) {
          updateMediaSessionPlaybackState();
          return;
        }
        // Unexpected play while user intended pause → reject
        // But don't reject during startup or tab-return immunity
        if (!state.startupPhase && !isTabReturnImmune() && !NotMakePlayBackFixingNoticable.isActive() &&
          !(wantsStartupAutoplay() && !state.firstPlayCommitted)) {
          execProgrammaticVideoPause();
          }
          return;
      }
      // --- coupled mode: user play intent (checked first)
      if (!state.isProgrammaticVideoPlay &&
        document.visibilityState === "visible" &&
        userWantsPlayNow(2400)) {
        state.userPlayIntentPresetAt = 0; // consume
        MediumQualityManager.markUserPlayed(); // MQM: clear any pending pause block
        state.intendedPlaying = true;
      state.bufferHoldIntendedPlaying = true;
      state.playSessionId++;
      state.audioPausedSince = 0;
      clearMediaSessionForcedPause();
      markMediaAction("play");
      startForegroundUserPlayRetry();
      setFastSync(1500);
      forceUnmuteForPlaybackIfAllowed();
      updateAudioGainImmediate();
      updateMediaSessionPlaybackState();
      if (!state.firstPlayCommitted && !state.startupKickInFlight) {
        state.firstPlayCommitted = true; state.startupKickDone = true;
        state.startupPlaySettleUntil = now() + STARTUP_SETTLE_MS;
        clearStartupAutoplayRetryTimer();
        setTimeout(() => { state.startupPhase = false; }, 800);
      }
      if (coupledMode) { playTogether().catch(() => {}); } else { scheduleSync(0); }
      return;
        }
        if (!state.isProgrammaticVideoPlay && !state.isProgrammaticAudioPlay) incrementRapidPlayPause();
        if (detectLoop()) {
          state.intendedPlaying = false;
          pauseHard();
          return;
        }

        const hasExplicitUserPlay = userWantsPlayNow(2400);

        if (hasExplicitUserPlay || wantsStartupAutoplay()) {
          // PAGE-LOAD GATE — skip if startup autoplay is desired
          if (!hasExplicitUserPlay && !pageLoadedForAutoplay() && !wantsStartupAutoplay()) {
            execProgrammaticVideoPause();
            return;
          }

          // --- SD/medium play/pause handling
          if (!coupledMode && MediumQualityManager.shouldBlockAutoResume()) {
            execProgrammaticVideoPause();
            return;
          }
          if (!coupledMode && !state.intendedPlaying && !userPlayIntentActive() &&
            state.firstPlayCommitted) {
            // intendedPlaying=false + no play intent = user paused. Don't override.
            execProgrammaticVideoPause();
          return;
            }
            // After first play committed, wantsStartupAutoplay() alone must not
            // override a user pause. Only allow if there's actual user play intent.
            if (state.firstPlayCommitted && !state.intendedPlaying &&
              !hasExplicitUserPlay) {
              execProgrammaticVideoPause();
            return;
              }

              state.intendedPlaying = true;
              state.bufferHoldIntendedPlaying = true;
              state.playSessionId++;
              state.audioPausedSince = 0;
              clearMediaSessionForcedPause();

              if (!state.firstPlayCommitted && !state.startupKickInFlight) {
                state.firstPlayCommitted = true;
                state.startupKickDone = true;
                state.startupPlaySettleUntil = now() + STARTUP_SETTLE_MS;
                clearStartupAutoplayRetryTimer();
                setTimeout(() => { state.startupPhase = false; }, 800);
              }
              // Immunity protects against Chromium's post-autoplay pause burst
              state.tabReturnImmuneUntil = Math.max(state.tabReturnImmuneUntil, now() + 2000);

              markMediaAction("play");
              setFastSync(1500);
              forceUnmuteForPlaybackIfAllowed();
              updateAudioGainImmediate();
              updateMediaSessionPlaybackState();

              if (coupledMode) {
                if (!state.startupPrimed) {
                  // Force prime — user explicitly clicked play, don't bail out
                  state.startupPrimed = true;
                  maybePrimeStartup();
                  // Don't return — fall through to start audio immediately.
                  // Previously we returned here, requiring the user to click play twice.
                }
                if (state.startupKickInFlight && !state.startupKickDone) {
                  // Don't bail — user clicked play, override the startup kick
                  state.startupKickDone = true;
                  state.startupKickInFlight = false;
                }
                const freshVideoFirst = shouldKeepForegroundReturnVideoFirst();
                const requireVisibleVideoLead = shouldRequireVisibleVideoHealthForForegroundPlay();
                const directVisibleUserPlay =
                  document.visibilityState === "visible" &&
                  isWindowFocused() &&
                  (
                    hasExplicitUserPlay ||
                    directUserToggleActive(2800) ||
                    userToggleExpectingPlay()
                  );
                const canFastKickDirectVisibleAudio =
                  directVisibleUserPlay &&
                  (() => {
                    const _fvVNode = getVideoNode();
                    const _fvVRS = _fvVNode ? Number(_fvVNode.readyState || 0) : 0;
                    return (
                      _fvVRS >= HAVE_CURRENT_DATA &&
                      !state.videoWaiting &&
                      !state.videoStallAudioPaused &&
                      !isForegroundVideoActuallyBuffering() &&
                      !shouldHoldAudioForForegroundStall({ allowRecovery: false })
                    );
                  })();
                if (!audio.paused && state.audioEverStarted) {
                  const vt = Number(video.currentTime());
                  const at = Number(audio.currentTime);
                  // Only hard-resync for large drift (>1.5s). Small drift from
                  // play/pause toggle is normal decoder jitter — rate sync handles
                  // it invisibly. The old 0.25s threshold caused audio pause+seek+play
                  // on every play/pause toggle = audible repeat/glitch.
                  if (isFinite(vt) && isFinite(at) && Math.abs(vt - at) > 1.5) {
                    if (at > vt + 1.5) {
                      execProgrammaticAudioPause(120);
                      safeSetAudioTime(vt);
                    } else {
                      quietSeekAudio(vt).catch(() => {});
                    }
                  }
                  scheduleSync(0);
                  return;
                }
                // Fast path: kick audio immediately so user hears it ASAP.
                // playTogether() has awaits that add 50-150ms of latency.
                // Set audio position and fire play() directly, then let
                // playTogether handle the full sync in the background.
                if (
                  audio &&
                  audio.paused &&
                  !freshVideoFirst &&
                  !requireVisibleVideoLead &&
                  (!directVisibleUserPlay || canFastKickDirectVisibleAudio)
                ) {
                  const _fastVt = Number(video.currentTime()) || 0;
                  if (isFinite(_fastVt) && _fastVt >= 0) {
                    state._allowAudioTimeWrite = true;
                    try { audio.currentTime = _fastVt; } catch {}
                    state._allowAudioTimeWrite = false;
                  }
                  try { audio.volume = targetVolFromVideo(); } catch {}
                  squelchAudioEvents(220);
                  state.audioStartGraceUntil = Math.max(state.audioStartGraceUntil, now() + 450);
                  execProgrammaticAudioPlay({ squelchMs: 80, force: true, minGapMs: 0 }).catch(() => {});
                  state.audioEverStarted = true;
                }
                playTogether().catch(() => {});
              } else {
                scheduleSync(0);
              }
              return;
        }

        if (state.isProgrammaticVideoPlay || state.restarting || state.seeking) return;
        // Tab-return immunity: never pause a play event during the immune window
        if (state.tabReturnImmuneUntil > now()) return;

        if (!coupledMode && state.intendedPlaying) {
          scheduleSync(0);
          return;
        }

        if (!state.intendedPlaying || (!coupledMode && MediumQualityManager.shouldBlockAutoResume())) {
          execProgrammaticVideoPause();
        }
    });

    video.on("pause", () => {
      // don't skip the pause handler when the user explicitly paused. old
      // code bailed early on seeking/seekBuffering unconditionally, so
      // audio kept playing if the user paused during a seek (or if
      // seekBuffering was stale from an earlier op).
      const _userWantsPauseHere = userWantsPauseNow(2400);
      if ((state.seeking || state.seekBuffering) && !_userWantsPauseHere) return;
      // Also check the native element's seeking flag — the "seeking" event handler
      // may not have fired yet, but the element is already seeking
      try { if (getVideoNode()?.seeking && !_userWantsPauseHere) return; } catch {}
      // Disarm PRFV on pause — no compositor check needed when paused
      try { PlayResumeFrameVerifier.disarm(); } catch {}
      // Disarm VCFM too — stale frame checks from the previous play session can
      // otherwise wake back up during pause/resume churn and create fake freezes.
      try { VideoCompositorFlushManager.disarm(); } catch {}
      if (restartFromEndedGuardActive() &&
          !state.isProgrammaticVideoPause &&
          !userWantsPauseNow(2400) &&
          !mediaSessionForcedPauseActive()) {
        state.intendedPlaying = true;
        state.bufferHoldIntendedPlaying = true;
        const _reVn = getVideoNode();
        if (_reVn && typeof _reVn.play === "function" && _reVn.paused) _reVn.play().catch(() => {});
        if (coupledMode && audio && audio.paused && !state.isProgrammaticAudioPause) {
          state.audioStartGraceUntil = Math.max(state.audioStartGraceUntil, now() + 500);
          execProgrammaticAudioPlay({ squelchMs: 80, force: true, minGapMs: 0 }).catch(() => {});
        }
        setFastSync(1400);
        scheduleSync(0);
        return;
      }
      if (userToggleExpectingPlay() &&
          !state.isProgrammaticVideoPause &&
          !userWantsPauseNow(2400) &&
          !mediaSessionForcedPauseActive()) {
        try {
          const _txVN = getVideoNode();
          const _txCt = Number(_txVN?.currentTime || 0);
          const _txDur = Number(_txVN?.duration || 0);
          if (_txDur > 0.5 && _txCt >= _txDur - 0.4) return;
        } catch {}
        state.intendedPlaying = true;
        state.bufferHoldIntendedPlaying = true;
        const _txVn = getVideoNode();
        if (_txVn && typeof _txVn.play === "function") _txVn.play().catch(() => {});
        return;
      }
      if (userToggleExpectingPause()) {
        clearUserToggleTxn();
      }
      // Immunity check: after tab return, reject pause events if we were playing or in startup.
      // never fight an explicit user pause.
      // also have to check currentTime vs duration — browser fires pause
      // BEFORE ended, so endedNaturally isn't set yet. without this,
      // calling play() here would restart the video.
      if (state.tabReturnImmuneUntil > now() &&
        (state.intendedPlaying || !state.firstPlayCommitted) &&
        !state.endedNaturally &&
        !MakeSureUnintentionalLoopDoesntEverHappenAtALLManager.shouldBlockAutoRestart() &&
        !userWantsPauseNow(2400)) {
        // Check if this pause is the natural end-of-video pause
        try {
          const _pauseVN = getVideoNode();
          if (_pauseVN) {
            const _pCT = Number(_pauseVN.currentTime) || 0;
            const _pDur = Number(_pauseVN.duration) || 0;
            if (_pDur > 0.5 && _pCT >= _pDur - 0.5) {
              // Video is at its end — this is the natural end pause, don't fight it
              // The ended event will fire next and handle cleanup
              return;
            }
          }
        } catch {}
        const _vn = getVideoNode();
      // Throttle: if something keeps pausing us during immunity, fighting every
      // pause produces a play/pause oscillation. Attempt resume at most once
      // per 400ms, and route through the lock so the resulting events are
      // flagged as programmatic (no re-entry via this same handler).
      if (_vn && _vn.paused) {
        const _nowImm = now();
        if (_nowImm - (state._lastImmunityPlayKickAt || 0) > 400) {
          state._lastImmunityPlayKickAt = _nowImm;
          if (tryAcquireVideoPlayLock()) execProgrammaticVideoPlay();
        }
      }
      return;
        }

        if (!coupledMode) {
          if (userWantsPauseNow(2400)) {
            state.userPauseIntentPresetAt = 0;
            MediumQualityManager.markUserPaused();
            state.intendedPlaying = false;
            state.bufferHoldIntendedPlaying = false;
            state.playSessionId++;
            state.videoWaiting = false;
            state.userGesturePauseIntent = true;
            setTimeout(() => { state.userGesturePauseIntent = false; }, 1200);
            updateMediaSessionPlaybackState();
            pauseHard();
            // Verify pause took effect after a tick
            setTimeout(() => {
              if (!state.intendedPlaying && !getVideoPaused()) pauseHard();
            }, 50);
              return;
          }
          // 2. Our own programmatic pause → accept silently
          if (state.isProgrammaticVideoPause) return;
          // 3. User gesture pause intent (set on pointerdown) → honour
          if (state.userGesturePauseIntent) {
            state.intendedPlaying = false;
            state.bufferHoldIntendedPlaying = false;
            MediumQualityManager.markUserPaused();
            pauseHard();
            return;
          }
          // 4. User already in paused-intent state → accept (expected)
          if (MediumQualityManager.intentPaused || !state.intendedPlaying) return;
          // 5. intendedPlaying=true but browser paused us → counter-play if suppressed
          if ((inBgReturnGrace() || BringBackToTabManager.isLocked() ||
            VisibilityGuard.shouldSuppress() || isVisibilityTransitionActive() ||
            isAltTabTransitionActive()) && !state.endedNaturally) {
            VisibilityGuard.onPlayCalled();
          const _vn = getVideoNode();
          if (_vn && typeof _vn.play === "function") _vn.play().catch(() => {});
          return;
            }
            // 6. Page hidden → flag for resume on return
            if (document.visibilityState === "hidden") {
              if (platform.useBgControllerRetry) state.resumeOnVisible = true;
              return;
            }
            // 6.5. Recently seeked — browser may fire pause during seek settle
            if (state.seekCooldownUntil > now() && !state.endedNaturally) {
              VisibilityGuard.onPlayCalled();
              const _vn = getVideoNode();
              if (_vn && typeof _vn.play === "function") _vn.play().catch(() => {});
              return;
            }
            // 7. Ongoing user play toggle — our pause→play cycle or programmatic
            //    code may have fired an unflagged pause. Counter-play.
            if (directUserToggleActive(800) && userWantsPlayNow(2000) && !state.endedNaturally) {
              VisibilityGuard.onPlayCalled();
              const _vn = getVideoNode();
              if (_vn && typeof _vn.play === "function") _vn.play().catch(() => {});
              return;
            }
            // 8. Genuine foreground pause we can't explain → honour it
            state.intendedPlaying = false;
            state.bufferHoldIntendedPlaying = false;
            state.playSessionId++;
            updateMediaSessionPlaybackState();
            pauseHard();
            return;
        }
        // --- coupled mode: user pause intent (checked first)
        // If user clicked within 2000ms and video was playing at click time, this
        // is definitively user-initiated pause. Bypass EVERY other guard.
        if (!state.isProgrammaticVideoPause &&
          document.visibilityState === "visible" &&
          userWantsPauseNow(2400)) {
          state.userPauseIntentPresetAt = 0;
        MediumQualityManager.markUserPaused();
        state.intendedPlaying = false;
        state.bufferHoldIntendedPlaying = false;
        state.playSessionId++;
        state.videoWaiting = false;
        updateMediaSessionPlaybackState();
        pauseHard();
        return;
          }

          // --- immediate counter-play helper
          const _shouldCounterPlay = () =>
          state.intendedPlaying &&
          !state.endedNaturally &&
          !state.seeking &&
          !state.seekResumeInFlight &&
          !state.bgResumeInFlight &&
          !mediaSessionForcedPauseActive();

          const _counterPlay = () => {
            // check for end-of-video before play(). pause fires BEFORE
            // ended so endedNaturally isn't set yet, and play() on an
            // ended video auto-seeks to 0 → phantom loop.
            try {
              const _cpVN = getVideoNode();
              if (_cpVN) {
                const _cpCT = Number(_cpVN.currentTime) || 0;
                const _cpDur = Number(_cpVN.duration) || 0;
                if (_cpDur > 0.5 && _cpCT >= _cpDur - 0.5) return; // at the end — don't fight
              }
            } catch {}
            // DEBOUNCE: collapse rapid pause events into at most one counter-play.
            // Context-aware: during BBTM lock (tab return), use 60ms debounce so
            // the counter-play fires almost immediately — 350ms was too slow and
            // caused a visible play/pause cycle on alt-tab. Outside tab return,
            // keep 350ms to collapse Chromium's 2-5 rapid pause events in a ~200ms
            // burst into a single counter-play.
            const _cpNow = now();
            const _cpDebounce = BringBackToTabManager.isLocked() || inBgReturnGrace() ? 60 : 350;
            if ((_cpNow - (state._counterPlayLastAt || 0)) < _cpDebounce) return;
            state._counterPlayLastAt = _cpNow;
            VisibilityGuard.onPlayCalled();
            // Set audio grace so the "playing" handler's audio resume isn't
            // immediately killed by the buffer monitor or waiting handler
            state.audioStartGraceUntil = Math.max(state.audioStartGraceUntil, now() + 500);
            const vn = getVideoNode();
            // Don't call play() if video is already playing — it fires play/playing
            // events that cascade into audio kicks and create visible play-pause-play.
            if (vn && vn.paused && typeof vn.play === 'function') vn.play().catch(() => {});
          };

          // --- suppressed-context detection
          const _isSuppressedContext =
          BringBackToTabManager.isLocked() ||
          VisibilityGuard.shouldSuppress() ||
          inBgReturnGrace() ||
          isVisibilityTransitionActive() ||
          isAltTabTransitionActive() ||
          document.visibilityState !== "visible";

          // Loop detection & rapid-toggle counting only for events we can't explain.
          if (!_isSuppressedContext && !state.isProgrammaticVideoPause && !state.isProgrammaticAudioPause) {
            incrementRapidPlayPause();
          }
          if (!_isSuppressedContext && detectLoop()) {
            state.intendedPlaying = false;
            pauseHard();
            return;
          }

          // --- explicit user pause intent detection
          // Only treat pause as user-authored when we have pause intent,
          // not just any recent user interaction (play clicks are also interactions).
          const hasExplicitUserPause = userWantsPauseNow(2400) ||
            BackgroundPlaybackManager.isUserPauseImmediate();

          if (hasExplicitUserPause) {
            state.intendedPlaying = false;
            state.bufferHoldIntendedPlaying = false;
            state.playSessionId++;
            state.videoWaiting = false;
            updateMediaSessionPlaybackState();
            pauseHard();
            return;
          }

          // --- BBTM lock: definitive spurious-pause zone
          // We are inside the tab-return spurious-pause burst window.
          // IMMEDIATELY counter-play so the video is only paused for microseconds.
          if (BringBackToTabManager.isLocked()) {
            if (BringBackToTabManager.isVideoConfirmed()) {
              BringBackToTabManager.onLateArrivedPause();
            }
            if (_shouldCounterPlay()) _counterPlay();
            return;
          }

          // --- tab-return grace window (8s) - must be before transition block
          if (inBgReturnGrace() && !mediaSessionForcedPauseActive()) {
            if (_shouldCounterPlay()) {
              state.resumeOnVisible = true;
              _counterPlay();
            }
            return;
          }

          // --- actually hidden
          // Page is not visible at all. Video can't render in background, but keep
          // audio alive so there's no gap. Flag video for resume on return.
          if (document.visibilityState === "hidden") {
            if (state.intendedPlaying && platform.useBgControllerRetry) {
              state.resumeOnVisible = true;
              // Keep audio playing in background even though video can't render
              if (coupledMode && audio && audio.paused && !userPauseLockActive() && !mediaSessionForcedPauseActive()) {
                try { audio.play().catch(() => {}); } catch {}
              }
            }
            return;
          }

          // --- visible but mid-transition (alt-tab blur or early visibilitychange)
          if (isVisibilityTransitionActive() || isAltTabTransitionActive()) {
            if (state.intendedPlaying && platform.useBgControllerRetry) state.resumeOnVisible = true;
            if (_shouldCounterPlay()) _counterPlay();
            return;
          }

          // --- wakeup timer active
          // A resume is already scheduled. IMMEDIATELY counter-play in case the wakeup
          // timer's play() call hasn't fired yet — close that gap.
          if (state.wakeupTimer && state.intendedPlaying && !mediaSessionForcedPauseActive()) {
            if (_shouldCounterPlay()) _counterPlay();
            return;
          }

          // --- chromium background pause block
          if (platform.chromiumOnlyBrowser && chromiumBgPauseBlocked()) {
            if (_shouldCounterPlay()) _counterPlay();
            return;
          }

          // --- in-flight operations
          // An existing play/seek/resume/buffer-wait operation owns responsibility for
          // restarting playback. Counter-play would race with it — use scheduleSync instead.
          if (state.isProgrammaticVideoPlay || state.seekResumeInFlight || state.bgResumeInFlight ||
            state.videoWaiting || foregroundRecoveryActive(300) ||
            (platform.chromiumOnlyBrowser && chromiumPauseEventSuppressed())) {
            scheduleSync(200);
          return;
            }

            // --- BPM background/transition gate
            // BackgroundPlaybackManager says we're in a bg/transition phase.
            // IMMEDIATELY counter-play so the video resumes as soon as the gate passes.
            if (BackgroundPlaybackManager.shouldSuppressAutoPause() && !mediaSessionForcedPauseActive()) {
              if (state.intendedPlaying && platform.useBgControllerRetry) state.resumeOnVisible = true;
              if (_shouldCounterPlay()) _counterPlay();
              return;
            }

            // --- startup guard: during page load, video can get paused by buffering.
            // Aggressively restart — don't just schedule a sync in 300ms.
            //
            // Debounced at 180ms: without this, a browser that pauses and emits
            // rapid pause events during initial buffering would produce the
            // visible play-pause-play-pause spam the user sees on video start.
            // 180ms is tight enough for real startup recovery, loose enough to
            // collapse tight pause bursts into a single counter-play.
            if (!state.firstPlayCommitted && state.intendedPlaying && !mediaSessionForcedPauseActive()) {
              const _nowStartup = now();
              if ((_nowStartup - (state._startupCounterPlayAt || 0)) >= 180) {
                state._startupCounterPlayAt = _nowStartup;
                DONTMAKEITDOUBLEPLAY.resetAll();
                execProgrammaticVideoPlay();
                if (coupledMode && audio && audio.paused && !state.endedNaturally) {
                  execProgrammaticAudioPlay({ squelchMs: 200, force: true, minGapMs: 0 }).catch(() => {});
                }
              }
              return;
            }

            // --- programmatic pause guard
            // The caller who issued execProgrammaticVideoPause() will restart playback.
            // Don't counter-play here — use scheduleSync so the caller stays in control.
            if (state.isProgrammaticVideoPause && state.intendedPlaying) {
              scheduleSync(200);
              return;
            }

            // --- VisibilityGuard final catch-all
            if (state.intendedPlaying && VisibilityGuard.shouldSuppress() && !mediaSessionForcedPauseActive()) {
              state.resumeOnVisible = true;
              if (_shouldCounterPlay()) _counterPlay();
              return;
            }

            // --- final unfocused gate
            // Backup check: tab is not focused — this cannot be a user pause.
            // IMMEDIATELY counter-play so we resume the instant focus returns.
            if (state.intendedPlaying && !mediaSessionForcedPauseActive() &&
              (document.visibilityState === "hidden" || !isWindowFocused())) {
              state.resumeOnVisible = true;
            if (_shouldCounterPlay()) _counterPlay();
            return;
              }

              // --- seek settle guard
              // A recent seek can cause the browser to fire a stray pause event
              // after the seek completes. Counter-play instead of honouring it.
              if (state.seekCooldownUntil > now() && state.intendedPlaying) {
                if (_shouldCounterPlay()) _counterPlay();
                return;
              }

              // --- active user play toggle guard
              // Our pause→play freeze fix or programmatic code may emit unflagged
              // pause events during a user's play toggle. Counter-play.
              if (directUserToggleActive(800) && userWantsPlayNow(2000) &&
                  state.intendedPlaying && !state.endedNaturally) {
                if (_shouldCounterPlay()) _counterPlay();
                return;
              }

              // --- real user pause
              // All guards passed. This is a real, unexplained pause on a focused, visible,
              // stable page with no transition or grace window active. Honour it.
              state.intendedPlaying = false;
              state.bufferHoldIntendedPlaying = false;
              state.playSessionId++;
              updateMediaSessionPlaybackState();
              pauseHard();
    });

    video.on("waiting", () => {
      try { UltraStabilizer.onVideoStall(); } catch {}
      // During startup / page load, stalls are expected as data arrives.
      // Don't set videoWaiting — it blocks audio through every gate.
      // Also skip the flag during the STARTUP SETTLE window: the decoder's
      // natural readyState dips during the first 15s of playback trigger
      // "waiting" events that, if they set videoWaiting, cause the audio
      // gate to block audio re-start for the full stall-resume hold. Once
      // firstPlayCommitted AND out of the settle window, real stalls are
      // legit and must set the flag.
      if (state.firstPlayCommitted && !startupSettleActive()) {
        state.videoWaiting = true;
        state.videoStallSince = state.videoStallSince || now();
      }
      if (!state.intendedPlaying || state.restarting) return;
      if (!state.firstPlayCommitted) return;
      // During startup settle, don't arm stall holds or schedule deferred
      // audio kills — the decoder is still warming up and any kill here
      // produces an audible cut in the first 15s.
      if (startupSettleActive()) return;
      if (!state.startupPrimed || state.startupKickInFlight || (state.startupPhase && !state.firstPlayCommitted)) return;

      // CRITICAL FIX for random audio cuts: the "waiting" event can fire during
      // normal keyframe decoding and clear within 50-100ms. Previously we killed
      // audio IMMEDIATELY on waiting, causing visible/audible audio cuts when
      // the browser was just doing normal decode work. Now we defer the kill by
      // 180ms via a timer — if "playing" fires before that, we never kill at all.
      const _waitVNode = getVideoNode();
      const _waitRS = _waitVNode ? Number(_waitVNode.readyState || 0) : 0;
      // Snapshot video position at the moment waiting fires so the deferred
      // timer can detect transient stalls (segment-boundary readyState dips
      // that resolve in <100ms without video actually freezing).
      const _waitVTSnapshot = _waitVNode ? (Number(_waitVNode.currentTime) || 0) : 0;
      if (state._stallAudioPauseTimer) {
        clearTimeout(state._stallAudioPauseTimer);
        state._stallAudioPauseTimer = null;
      }
      if (_waitRS < HAVE_FUTURE_DATA && coupledMode && audio && !audio.paused) {
        // Only arm the hold and defer the kill. The timer re-checks all
        // conditions at fire-time — if video recovered meanwhile, no kill.
        armForegroundBufferAudioHold(Math.max(MIN_STALL_AUDIO_RESUME_MS, 480));
        state._stallAudioPauseTimer = setTimeout(() => {
          state._stallAudioPauseTimer = null;
          if (!coupledMode || !audio || audio.paused) return;
          // Re-verify: is video STILL starved? If "playing" fired, bail.
          const _wvn = getVideoNode();
          const _wrs = _wvn ? Number(_wvn.readyState || 0) : 4;
          if (_wrs >= HAVE_FUTURE_DATA) return;
          if (!state.videoWaiting) return;
          // Progress check: if video has advanced since "waiting" fired, the
          // stall was transient (e.g. segment-boundary readyState dip that
          // lasted < 600ms). Don't kill audio for transient stalls — the old
          // 400ms timer triggered on every keyframe boundary, causing random
          // audio cuts during otherwise-smooth playback.
          const _currentVTCheck = _wvn ? (Number(_wvn.currentTime) || 0) : 0;
          // Must advance by at least 0.08s (not just 0.04) to consider it recovered.
          // Forward micro-seeks (+0.001) advance position slightly, so 0.04 threshold
          // was triggering false "recovered" exits. 0.08 requires real frame decode progress.
          if (Math.abs(_currentVTCheck - _waitVTSnapshot) > 0.12) return;
          // bypassGrace: the deferred kill has confirmed the stall survived
          // the grace window, so we can now legitimately pause audio.
          if (canKillAudio({ bypassGrace: true })) {
            pauseAudioForConfirmedVideoStall(Math.max(MIN_STALL_AUDIO_RESUME_MS, 400));
          }
        }, 2500); // 2500ms: bumped from 1200 — audio was still cutting on
        // longer segment-boundary stalls. By 2.5s, if video's genuinely
        // frozen the user already knows; audio silence adds nothing. Under
        // that, transient decoder hiccups shouldn't kill audio.
      }

      if (platform.useBgControllerRetry && state.intendedPlaying) {
        state.resumeOnVisible = true;
      }
      scheduleSync(0);
    });
    video.on("playing", () => {
      const _prevPlayingAt = state.lastVideoPlayingAt;
      state.lastVideoPlayingAt = now();
      const _freshVideoProgressPending = freshForegroundVideoProgressPending(0.08);
      if (!_freshVideoProgressPending) {
        clearFreshForegroundVideoFirst();
        clearForegroundUserPlayRetryTimers();
      }
      const _playingNow = (() => { try { return Number(video.currentTime()) || 0; } catch { return 0; } })();
      commitStartupFromResolvedPlaybackPosition(_playingNow, {
        fromSeek:
          state.seeking ||
          seekRecoveryActive(1400) ||
          (isFinite(Number(state.seekTargetTime)) && Number(state.seekTargetTime) > 0.35) ||
          (state.pendingSeekTarget != null && Number(state.pendingSeekTarget) > 0.35)
      });
      // The "playing" event means video has recovered and is producing frames.
      // ALWAYS clear stall flags here. If video re-stalls, the "waiting" event
      // will set them again. The old code checked _stallRecoveryStable before
      // clearing flags, which meant stall flags NEVER got cleared if buffer
      // ahead was < 0.12s — creating a permanent play-pause loop.
      if (state.videoWaiting || state.videoStallAudioPaused || foregroundBufferAudioHoldActive()) {
        state.videoWaiting = false;
        state.videoStallSince = 0;
        clearForegroundBufferAudioHold();
      }
      // EARLY AUDIO STARTUP: If video autoplayed before our startup machinery
      // ran (Video.js autoplay fires before window.load), kick audio immediately
      // on the first "playing" event instead of waiting for window.load.
      // This fixes "video autoplays but audio doesn't start until page loads."
      if (coupledMode && audio && audio.paused && !state.firstPlayCommitted &&
          wantsStartupAutoplay() && !state.endedNaturally &&
          !state.seeking && !state.seekBuffering) {
        state.intendedPlaying = true;
        state.bufferHoldIntendedPlaying = true;
        // Sync audio to video position (both should be near 0 at startup)
        const _earlyAudioVt = _playingNow;
        const _earlyAudioAt = Number(audio.currentTime) || 0;
        if (Math.abs(_earlyAudioAt - _earlyAudioVt) > 0.3) {
          state._allowAudioTimeWrite = true;
          try { audio.currentTime = _earlyAudioVt; } catch {}
          state._allowAudioTimeWrite = false;
        }
        try { audio.volume = targetVolFromVideo(); } catch {}
        state.audioStartGraceUntil = Math.max(state.audioStartGraceUntil, now() + 1200);
        // don't flip audioEverStarted until audio actually starts. setting
        // it early blocks every retry path if this first play() fails
        // (audio not loaded, autoplay policy, etc). retry chain below
        // keeps trying until something sticks.
        const _earlyAudioPlaySession = state.playSessionId;
        execProgrammaticAudioPlay({ squelchMs: 400, force: true, minGapMs: 0 })
          .then(ok => {
            if (ok) state.audioEverStarted = true;
          })
          .catch(() => {});
        // Retry chain: if audio.play() fails (element not loaded yet, autoplay
        // policy, etc.), retry at escalating intervals until it works. This is
        // the primary fix for "video autoplays but audio doesn't until page loads."
        const _earlyAudioRetryDelays = [80, 200, 400, 700, 1200, 2000, 3000];
        let _earlyAudioRetryIdx = 0;
        const _earlyAudioRetry = () => {
          if (_earlyAudioRetryIdx >= _earlyAudioRetryDelays.length) return;
          if (state.playSessionId !== _earlyAudioPlaySession) return;
          if (!state.intendedPlaying || state.endedNaturally) return;
          if (state.audioEverStarted && audio && !audio.paused) return;
          if (state.seeking || state.seekBuffering) return;
          const delay = _earlyAudioRetryDelays[_earlyAudioRetryIdx++];
          setTimeout(() => {
            if (state.playSessionId !== _earlyAudioPlaySession) return;
            if (!state.intendedPlaying || state.endedNaturally) return;
            if (!audio.paused) { state.audioEverStarted = true; return; }
            // Re-sync position before retry
            const _retryVt = (() => { try { return Number(video.currentTime()) || 0; } catch { return 0; } })();
            const _retryAt = Number(audio.currentTime) || 0;
            if (isFinite(_retryVt) && Math.abs(_retryAt - _retryVt) > 0.3) {
              state._allowAudioTimeWrite = true;
              try { audio.currentTime = _retryVt; } catch {}
              state._allowAudioTimeWrite = false;
            }
            try { audio.volume = targetVolFromVideo(); } catch {}
            state.audioStartGraceUntil = Math.max(state.audioStartGraceUntil, now() + 800);
            execProgrammaticAudioPlay({ squelchMs: 200, force: true, minGapMs: 0 })
              .then(ok => {
                if (ok) state.audioEverStarted = true;
                else _earlyAudioRetry();
              })
              .catch(() => { _earlyAudioRetry(); });
          }, delay);
        };
        // Start the retry chain immediately — first retry fires after 80ms
        _earlyAudioRetry();
      }
      // STARTUP ZERO ENFORCEMENT: If browser keyframe buffering moved
      // currentTime forward (to 0.5-2s) despite forceZeroBeforeFirstPlay(),
      // seek both tracks back to 0. Only fires once on first play, and only
      // for genuine keyframe skips (>0.5s), not small decode latency.
      // Uses _isMicroSeek so the seeking handler ignores this correction.
      // verification loop: after seeking to 0, the browser can move to a
      // keyframe AGAIN. check and re-zero up to 3 times at 50/150/400ms
      // until it sticks.
      if (!state.firstPlayCommitted && wantsStartupAutoplay() &&
          !startupZeroSuppressed() && _playingNow > 0.5) {
        state._isMicroSeek = true;
        try { videoEl.currentTime = 0; } catch {}
        try { const _zVN = getVideoNode(); if (_zVN && _zVN !== videoEl) _zVN.currentTime = 0; } catch {}
        if (coupledMode && audio) {
          state._allowAudioTimeWrite = true;
          try { audio.currentTime = 0; } catch {}
          state._allowAudioTimeWrite = false;
        }
        setTimeout(() => { state._isMicroSeek = false; }, 300);
        // Verification loop: browser can move currentTime forward again after
        // our zero-set due to keyframe alignment. Check 3 times and re-zero.
        const _zeroVerifyDelays = [50, 150, 400];
        _zeroVerifyDelays.forEach((delay, idx) => {
          setTimeout(() => {
            if (state.firstPlayCommitted || startupZeroSuppressed()) return;
            const _zvVN = getVideoNode() || videoEl;
            const _zvVT = _zvVN ? (Number(_zvVN.currentTime) || 0) : 0;
            if (_zvVT > 0.5) {
              state._isMicroSeek = true;
              try { _zvVN.currentTime = 0; } catch {}
              if (_zvVN !== videoEl) try { videoEl.currentTime = 0; } catch {}
              if (coupledMode && audio) {
                state._allowAudioTimeWrite = true;
                try { audio.currentTime = 0; } catch {}
                state._allowAudioTimeWrite = false;
              }
              setTimeout(() => { state._isMicroSeek = false; }, 200);
            }
            // On last check, also sync audio position to video if there's drift
            if (idx === _zeroVerifyDelays.length - 1 && coupledMode && audio) {
              const _zvFinalVT = Number((_zvVN || videoEl).currentTime) || 0;
              const _zvFinalAT = Number(audio.currentTime) || 0;
              if (Math.abs(_zvFinalAT - _zvFinalVT) > 0.3) {
                state._allowAudioTimeWrite = true;
                try { audio.currentTime = _zvFinalVT; } catch {}
                state._allowAudioTimeWrite = false;
              }
            }
          }, delay);
        });
      }
      // Anti-loop: if video is playing after it ended naturally, kill it
      if (MakeSureUnintentionalLoopDoesntEverHappenAtALLManager.shouldBlockAutoRestart()) {
        const _playingVt = (() => { try { return Number(video.currentTime()) || 0; } catch { return 0; } })();
        if (_playingVt < 5.0) {
          execProgrammaticVideoPause();
          if (coupledMode && audio && !audio.paused) { try { audio.pause(); } catch {} }
          state.intendedPlaying = false;
          state.bufferHoldIntendedPlaying = false;
          return;
        }
      }
      if (document.visibilityState === "visible" && state.intendedPlaying) {
        const _canClearHiddenPlay = !coupledMode || !audio || !audio.paused || !hiddenPlayPendingActive();
        if (_canClearHiddenPlay) clearHiddenPlayPending();
      }
      finalizeForegroundReturnRecovery();
      // Reset proactive stall detection counters
      _bufMonStallFrames = 0;
      _bufMonLastVT = -1;
      try { MakeSureAudioOrVideoDoesntPauseUnlessUserReallyWantsTo.start(); } catch {}
      try { MakeVideoNotFreezeAfterPlaybackAfterAltTabHapens.start(); } catch {}
      try { NuclearFreezeWatchdog.reset(); NuclearFreezeWatchdog.start(); } catch {}
      // Verify compositor is actually rendering frames after play resumes.
      // Catches "video.paused=false but screen frozen" on all browsers.
      // With the stronger micro-seek suppression we can safely arm this for
      // direct visible user resumes too, not just tab-return/long-pause cases.
      {
        const _prfvNow = now();
        const _prfvGapMs = _prevPlayingAt > 0 ? (_prfvNow - _prevPlayingAt) : Infinity;
        const _prfvAfterTabReturn = state.lastBgReturnAt > 0 && (_prfvNow - state.lastBgReturnAt) < 8000;
        const _prfvAfterLongPause = _prfvGapMs > 2000;
        const _prfvDirectUserResume =
          document.visibilityState === "visible" &&
          isWindowFocused() &&
          (
            directUserToggleActive(1800) ||
            userWantsPlayNow(1800) ||
            userToggleExpectingPlay()
          );
        if (_prfvAfterTabReturn || _prfvAfterLongPause || _prfvDirectUserResume) {
          try { PlayResumeFrameVerifier.arm(); } catch {}
        }
        // FAST RVFC COMPOSITOR KICK: If video reports playing but the compositor
        // is stuck on a stale GPU surface (common after alt-tab or long pause),
        // the user sees a frozen frame even though paused=false. Use a direct
        // RVFC check — if no frame renders within 250ms, do a micro-seek to
        // force the decoder to push a fresh frame. This is MUCH faster than
        // waiting for the RAF freeze detector (800ms cooldown + 160ms detect).
        if ((_prfvAfterTabReturn || _prfvAfterLongPause || _prfvDirectUserResume) &&
            typeof HTMLVideoElement !== "undefined" &&
            typeof HTMLVideoElement.prototype.requestVideoFrameCallback === "function") {
          // Use a local generation counter — do NOT increment playSessionId.
          // Incrementing playSessionId here invalidates other session-gated
          // timers (playTogether, drift repair, etc.) causing play instability.
          const _rvfcGen = state.playSessionId;
          let _rvfcGotFrame = false;
          const _rvfcVNode = getVideoNode();
          if (_rvfcVNode && !_rvfcVNode.paused) {
            try {
              _rvfcVNode.requestVideoFrameCallback(() => { _rvfcGotFrame = true; });
            } catch {}
            // tighter timeout (140ms) for direct user play — they see
            // freeze instantly. 200ms is fine for tab return / long pause
            // where a touch of delay is ok.
            const _rvfcTimeout = _prfvDirectUserResume ? 140 : 200;
            setTimeout(() => {
              if (_rvfcGotFrame) return; // compositor healthy
              if (state.playSessionId !== _rvfcGen) return; // stale
              const _kickVN = getVideoNode();
              if (!_kickVN || _kickVN.paused || !state.intendedPlaying) return;
              // Compositor stuck — forward micro-seek to flush. Forward
              // seeks don't cause keyframe flash (stays in current GOP).
              const _kickVT = Number(_kickVN.currentTime) || 0;
              if (_kickVT > 0.02 && canDoCompositorFlush()) {
                recordMicroSeek();
                state._isMicroSeek = true;
                try { _kickVN.currentTime = _kickVT + 0.001; } catch {}
                setTimeout(() => { state._isMicroSeek = false; }, 150);
                // verify the first micro-seek actually worked via a second
                // RVFC check. still stuck? go harder: pause → seek → play.
                // catches the rare case where +0.001 isn't enough to
                // unstick the compositor.
                let _rvfcGotFrame2 = false;
                try {
                  _kickVN.requestVideoFrameCallback(() => { _rvfcGotFrame2 = true; });
                } catch {}
                setTimeout(() => {
                  if (_rvfcGotFrame2) return; // fixed
                  if (state.playSessionId !== _rvfcGen) return;
                  const _kickVN2 = getVideoNode();
                  if (!_kickVN2 || _kickVN2.paused || !state.intendedPlaying) return;
                  if (state.seeking || state.seekBuffering) return;
                  // Stronger fix: pause → forward seek → play
                  const _kickVT2 = Number(_kickVN2.currentTime) || 0;
                  if (_kickVT2 > 0.02) {
                    recordMicroSeek();
                    state._isMicroSeek = true;
                    state.isProgrammaticVideoPause = true;
                    try { _kickVN2.pause(); } catch {}
                    try { _kickVN2.currentTime = _kickVT2 + 0.01; } catch {}
                    requestAnimationFrame(() => {
                      state.isProgrammaticVideoPause = false;
                      if (state.playSessionId !== _rvfcGen || !state.intendedPlaying) {
                        state._isMicroSeek = false; return;
                      }
                      DONTMAKEITDOUBLEPLAY.resetAll();
                      const p = execProgrammaticVideoPlay();
                      if (p && typeof p.catch === "function") p.catch(() => {});
                      state._isMicroSeek = false;
                    });
                    setTimeout(() => { state._isMicroSeek = false; }, 300);
                  }
                }, 300);
              }
            }, _rvfcTimeout);
          }
        }
      }

      if (state._stallAudioPauseTimer) {
        clearTimeout(state._stallAudioPauseTimer);
        state._stallAudioPauseTimer = null;
      }
      // Video is playing — if audio was paused due to stall, resume it now.
      // We already cleared videoWaiting/videoStallSince above.
      if (state.videoStallAudioPaused && state.intendedPlaying && coupledMode && audio) {
        state.videoStallAudioPaused = false;
        state.stallAudioPausedSince = 0;
        state.stallAudioResumeHoldUntil = 0;
        clearAudioPauseLocks();
      }
      // Resume audio if it's paused and we intend to play.
      // Skip during active seek recovery — the seeked handler's retry chain owns audio.
      // Skip during syncing — playTogether is in-flight and will handle audio.
      // Competing kicks cause redundant decoder flushes and audible play-pause-play.
      if (coupledMode && audio && audio.paused && state.intendedPlaying && !state.seeking && !state.seekBuffering &&
          !state.syncing && !(state.seekAudioMustStartUntil > now())) {
        const _resumeVt = (() => { try { return Number(video.currentTime()) || 0; } catch { return 0; } })();
        // Only hard-sync audio position if drift is significant (>0.3s).
        // For small drift, skip the decoder-resetting seek — the rate sync loop
        // converges small drift without the 100-300ms pipeline reset latency.
        // This prevents the audible "cut" on every play/pause toggle.
        const _resumeAt = Number(audio.currentTime) || 0;
        if (Math.abs(_resumeAt - _resumeVt) > 0.3) {
          safeSetAudioTime(_resumeVt);
        }
        try { audio.volume = targetVolFromVideo(); } catch {}
        // 800ms grace protects audio from being killed by the buffer monitor or
        // stall detector when readyState briefly dips during play resume. Covers the
        // worst case of segment-boundary decode + keyframe decode (~600ms on slow HW).
        state.audioStartGraceUntil = Math.max(state.audioStartGraceUntil, now() + 800);
        execProgrammaticAudioPlay({ squelchMs: 250, force: true, minGapMs: 0 }).catch(() => {});
        state.audioEverStarted = true;
      }
      if (state.seeking || state.seekBuffering) {
        state.videoWaiting = false;
        state.videoStallSince = 0;
        return;
      }
      // Tab-return immunity: video is playing — that's exactly what we want. Accept it.
      if (state.tabReturnImmuneUntil > now() && (state.intendedPlaying || !state.firstPlayCommitted)) {
        state.videoWaiting = false;
        state.videoStallSince = 0;
        state.intendedPlaying = true;
        state.bufferHoldIntendedPlaying = true;
        if (!coupledMode) MediumQualityManager.markUserPlayed();
        updateMediaSessionPlaybackState();
        if (!state.firstPlayCommitted) {
          state.firstPlayCommitted = true;
          state.startupKickDone = true;
          state.startupPhase = false;
          clearStartupAutoplayRetryTimer();
        }
        // Video is playing during tab return — also restart audio if coupled.
        // Without this, the early return below skips coupled-mode audio restart,
        // leaving audio paused while video plays (or video frozen waiting for audio).
        if (coupledMode && audio && audio.paused && state.intendedPlaying) {
          const _trVt = (() => { try { return Number(video.currentTime()) || 0; } catch { return 0; } })();
          safeSetAudioTime(_trVt);
          state.audioStartGraceUntil = Math.max(state.audioStartGraceUntil, now() + 500);
          execProgrammaticAudioPlay({ squelchMs: 200, force: true, minGapMs: 0 }).catch(() => {});
        }
        return;
      }
      if (!coupledMode) {
        try { UltraStabilizer.onVideoPlaying(); } catch {}
        if (MediumQualityManager.intentPaused && state.firstPlayCommitted) {
          execProgrammaticVideoPause();
          return;
        }
        if (!state.intendedPlaying && state.firstPlayCommitted && state.lastUserActionTime > 0) {
          execProgrammaticVideoPause();
          return;
        }
        // Commit first play
        if (!state.firstPlayCommitted) {
          if (wantsStartupAutoplay() || pageLoadedForAutoplay() || (state.lastUserActionTime > 0 && (now() - state.lastUserActionTime) < 2000)) {
            state.firstPlayCommitted = true;
            state.startupKickDone = true;
            state.startupPhase = false;
          } else {
            execProgrammaticVideoPause();
            return;
          }
        }
        state.intendedPlaying = true;
        state.videoWaiting = false;
        state.videoStallSince = 0;
        // Only update lastKnownGoodVT in foreground — background "playing" events
        // can have corrupted positions (audio ran ahead, browser reset video to 0)
        if (document.visibilityState === "visible") updateLastKnownGoodVT();
        updateMediaSessionPlaybackState();
        return;
      }
      // --- coupled mode: UltraStabilizer: notify video playing
      try { UltraStabilizer.onVideoPlaying(); } catch {}
      // video is playing, clear all stall flags
      state.videoWaiting = false;
      state.videoStallSince = 0;
      _bufMonStallFrames = 0;
      _bufMonLastVT = -1;
      if (state.videoStallAudioPaused && state.intendedPlaying) {
        state.videoStallAudioPaused = false;
        state.stallAudioPausedSince = 0;
        state.stallAudioResumeHoldUntil = 0;
      }
      state.startupAudioHoldUntil = 0;
      state.videoStallSince = 0;

      // If video is playing during autoplay startup but intendedPlaying isn't set yet,
      // set it now — UNLESS user explicitly paused.
      if (!state.intendedPlaying && (wantsStartupAutoplay() || state.startupPhase) &&
        !userPauseLockActive() && !userPauseIntentActive() &&
        state.userPauseIntentPresetAt === 0 && !state.userGesturePauseIntent &&
        !MediumQualityManager.intentPaused) {
        state.intendedPlaying = true;
      state.bufferHoldIntendedPlaying = true;
        }

        // video is playing, start audio (unless NMPBFN or playTogether is already handling it)
        // During startup (startupPhase=true, firstPlayCommitted=false), always kick
        // audio when video starts — don't let freshVideoProgressPending delay it.
        const _skipAudioKickForFreshProgress = _freshVideoProgressPending && state.firstPlayCommitted && !state.startupPhase;
        if (coupledMode && audio && audio.paused && state.intendedPlaying &&
          !userPauseLockActive() && !mediaSessionForcedPauseActive() &&
          !state.seeking && !state.seekBuffering && !NotMakePlayBackFixingNoticable.isActive() &&
          !state.strictBufferHold && !_skipAudioKickForFreshProgress &&
          !state.syncing) { // syncing = playTogether is in-flight, don't compete
          const _vtNow = (() => { try { return Number(video.currentTime()) || 0; } catch { return 0; } })();
          const _shouldGatePlayingAudioKick =
            state.firstPlayCommitted &&
            document.visibilityState === "visible" &&
            isWindowFocused() &&
            !state.startupPhase &&
            !state.seekResumeInFlight &&
            state.seekAudioMustStartUntil <= now() &&
            // Don't gate during the seek kick window — the seeked handler's
            // retry chain is actively managing audio resume. Re-setting
            // videoWaiting here creates a feedback loop that blocks audio.
            state.seekKickAudioAllowedUntil <= now();
          if (_shouldGatePlayingAudioKick && !videoReadyForAudioResume(_vtNow)) {
            armForegroundBufferAudioHold(Math.max(MIN_STALL_AUDIO_RESUME_MS, 500));
            state.videoWaiting = true;
            state.videoStallSince = state.videoStallSince || now();
            armResumeAfterBuffer(8000);
          } else {
            // clean slate
            state.videoWaiting = false;
            state.videoStallAudioPaused = false;
            state.stallAudioPausedSince = 0;
            state.stallAudioResumeHoldUntil = 0;
            state.videoStallSince = 0;
            clearAudioPauseLocks();
            clearAudioForcePlayTimer();
            safeSetAudioTime(_vtNow);
            try { if (audio.muted && !state.userMutedAudio) audio.muted = false; } catch {}
            const _startupTargetVol = targetVolFromVideo();
            try { audio.volume = _startupTargetVol; } catch {}
            state.audioStartGraceUntil = now() + 800;
            execProgrammaticAudioPlay({ squelchMs: 200, force: true, minGapMs: 0 })
            .then(() => {
              try { if (audio.volume < _startupTargetVol * 0.9) audio.volume = _startupTargetVol; } catch {}
            })
            .catch(() => {});
            state.audioEverStarted = true;
          }
          }

          if (!state.firstPlayCommitted && !state.startupKickInFlight) {
            // Commit the first play — don't pause for page-load gate here.
            // Pausing creates a visible play-pause-play stutter on autoplay.
            // If we somehow got here without page being ready, let it keep playing
            // and let audio catch up naturally via sync loop.
            state.firstPlayCommitted = true;
            state.startupKickDone = true;
            state.startupPlaySettleUntil = now() + STARTUP_SETTLE_MS;
            clearStartupAutoplayRetryTimer();
            setTimeout(() => { state.startupPhase = false; }, 800);
          }

          if ((!state.intendedPlaying || userPauseLockActive() || mediaSessionForcedPauseActive()) && !userPlayIntentActive() && !(state.tabReturnImmuneUntil > now())) {
            // --- never let autoplay override an explicit user pause
            const userExplicitlyPaused =
            userPauseLockActive() ||        // userPauseLockUntil fence still active
            userPauseIntentActive() ||      // userPauseUntil fence still active
            state.userPauseIntentPresetAt > 0 ||  // preset set on pointerdown
            MediumQualityManager.shouldBlockAutoResume() || // MQM tracks user pause for 4s
            // Once startup has completed, intendedPlaying=false means the user (or a
            // system event) explicitly paused. A stale "playing" event must never override this.
            // Before firstPlayCommitted, autoplay is legitimate. After it, paused=user's intent.
            (state.firstPlayCommitted && !state.intendedPlaying) ||
            // MQM guard -- if MQM says user recently paused, always honour it.
            MediumQualityManager.shouldBlockAutoResume() ||
            // In non-coupled mode, intendedPlaying=false is always authoritative
            // after the user has interacted at least once (lastUserActionTime > 0).
            (!coupledMode && !state.intendedPlaying && state.lastUserActionTime > 0);

            if (userExplicitlyPaused) {
              // User pause is authoritative — override autoplay
              execProgrammaticVideoPause();
              return;
            }
            if (wantsStartupAutoplay() || (now() - state.startupPrimeStartedAt) < 2600) {
              clearMediaSessionForcedPause();
              state.intendedPlaying = true;
              state.bufferHoldIntendedPlaying = true;
              markMediaAction("play");
              updateMediaSessionPlaybackState();
            } else {
              execProgrammaticVideoPause();
              return;
            }
          }
          // Only update lastKnownGoodVT in foreground — background seeked events
          // may have positions corrupted by browser resets or background sync
          if (document.visibilityState === "visible") updateLastKnownGoodVT();
          if (platform.chromiumOnlyBrowser) {
            state.chromiumAudioStartLockUntil = 0;
            state.chromiumBgSettlingUntil = Math.max(state.chromiumBgSettlingUntil, now() + 500);
          }
          setFastSync(2000);

          // --- FORCE PRIME + AUDIO KICK: video is confirmed playing. If startup
          // hasn't primed yet, force it now — we KNOW video has data. Then start
          // audio immediately. This is the primary path for coupled autoplay.
          // Prime startup if needed — don't double-kick audio (single kick above handles it)
          if (coupledMode && state.startupPhase && !state.startupPrimed) {
            maybePrimeStartup();
            if (state.startupPrimed) scheduleStartupAutoplayKick();
          }

          // Failsafe: if audio still paused 1.5s from now, one final attempt
          if (coupledMode && audio && audio.paused && state.intendedPlaying) {
            const _failsafeSession = state.playSessionId;
            setTimeout(() => {
              if (state.playSessionId !== _failsafeSession) return;
              if (!state.intendedPlaying || !coupledMode || !audio || !audio.paused) return;
              if (userPauseLockActive() || mediaSessionForcedPauseActive()) return;
              if (NotMakePlayBackFixingNoticable.isActive()) return;
              if (state.strictBufferHold || state.videoWaiting || state.seeking) return;
              const _failsafeVt = (() => { try { return Number(video.currentTime()) || 0; } catch { return 0; } })();
              if (document.visibilityState === "visible" &&
                  isWindowFocused() &&
                  state.firstPlayCommitted &&
                  !videoReadyForAudioResume(_failsafeVt)) {
                armResumeAfterBuffer(8000);
                return;
              }
              clearAudioPauseLocks();
              safeSetAudioTime(_failsafeVt);
              try { if (audio.muted && !state.userMutedAudio) audio.muted = false; } catch {}
              try { audio.volume = 0; } catch {}
              execProgrammaticAudioPlay({ squelchMs: 250, force: true, minGapMs: 0 })
              .then(() => { softUnmuteAudio(150).catch(() => {}); })
              .catch(() => {});
              state.audioEverStarted = true;
            }, 1500);
          }

          // --- stall-recovery audio resume
          if (coupledMode && audio && state.videoStallAudioPaused && state.intendedPlaying &&
            !state.seeking && !state.syncing) {
            const vtNow = Number(video.currentTime()) || 0;
          const vRS = Number(getVideoNode().readyState || 0);
          const holdExpired = now() >= state.stallAudioResumeHoldUntil;
          const stableForResume = videoReadyForAudioResume(vtNow);

          if (holdExpired && vRS >= MIN_STALL_VIDEO_RS && stableForResume && !shouldBlockNewAudioStart()) {
            state.videoStallAudioPaused = false;
            state.stallAudioPausedSince = 0;
            state.stallAudioResumeHoldUntil = 0;
            state.audioPauseUntil = 0;
            state.audioEventsSquelchedUntil = 0;
            clearForegroundBufferAudioHold();
            safeSetAudioTime(vtNow);
            try { audio.volume = 0; } catch {}
            execProgrammaticAudioPlay({ squelchMs: 200, force: true, minGapMs: 0 })
            .then(ok => { if (ok) softUnmuteAudio(100).catch(() => {}); })
            .catch(() => {});
          } else {
            // Video readyState still low or hold active — wait for genuine buffer readiness.
            // armResumeAfterBuffer polls readyState and fires playTogether() when ready.
            armResumeAfterBuffer(8000);
            scheduleSync(0);
            return;
          }
            } else if (coupledMode && audio && audio.paused && state.intendedPlaying &&
              !state.seeking && !state.syncing && !state.strictBufferHold &&
              !state.videoStallAudioPaused && !shouldBlockNewAudioStart()) {
              // Audio paused for a non-stall reason (seek, tab return) — normal resume path
              if ((state.startupKickInFlight && !state.startupKickDone) || state.seekResumeInFlight) {
                scheduleSync(0);
              } else {
                playTogether().catch(() => {});
              }
              } else {
                state.videoStallAudioPaused = false;
                scheduleSync(0);
              }

              // --- audio kill-switch: pause video if audio doesn't start within 700ms
              // Skip this while seek recovery is active; seek flow already has aggressive
              // audio restart retries and pausing video here causes play-pause flicker.
              const _skipAudioKillSwitch =
                seekRecoveryActive(350) ||
                userToggleExpectingPlay() ||
                userWantsPlayNow(2200) ||
                (state.seekAudioKickAt > 0 && (now() - state.seekAudioKickAt) < 2600);
              if (!_skipAudioKillSwitch && coupledMode && audio && state.intendedPlaying && !state.seeking && !state.syncing) {
                const _ksSession = state.playSessionId;
                setTimeout(() => {
                  // Abort if session changed or state is no longer valid
                  if (state.playSessionId !== _ksSession) return;
                  if (seekRecoveryActive(250) || userToggleExpectingPlay() || userWantsPlayNow(2200) || (state.seekAudioKickAt > 0 && (now() - state.seekAudioKickAt) < 2600)) return;
                  if (!state.intendedPlaying || getVideoPaused()) return;
                  if (!audio.paused) return; // audio is playing — all good
                  if (state.seeking || state.syncing || state.restarting) return;
                  if (state.videoWaiting || state.videoStallAudioPaused) return;
                  if (now() < state.stallAudioResumeHoldUntil) return;
                  if (BackgroundPlaybackManager.isBackground()) return; // handled by bg manager
                  // One last try: force-start audio from current video position
                  const _vtNow = Number(video.currentTime()) || 0;
                  safeSetAudioTime(_vtNow);
                  execProgrammaticAudioPlay({ squelchMs: 250, force: true, minGapMs: 0 })
                  .then(started => {
                    if (state.playSessionId !== _ksSession) return;
                    if (started) {
                      softUnmuteAudio(AUDIO_SAFE_FADE_DURATION_MS).catch(() => {});
                      return;
                    }
                    // --- don't pause video during startup
                    if (!state.audioEverStarted) {
                      armResumeAfterBuffer(6000);
                      return;
                    }
                    // Audio truly can't start right now — pause video to keep A/V contract.
                    // armResumeAfterBuffer will restart both once audio is ready.
                    if (!getVideoPaused() && state.intendedPlaying &&
                      state.playSessionId === _ksSession && !state.seeking) {
                      execProgrammaticVideoPause();
                    armResumeAfterBuffer(6000);
                      }
                  })
                  .catch(() => {
                    if (state.playSessionId !== _ksSession) return;
                    // Same guard as .then: don't pause video during startup.
                    if (!state.audioEverStarted) { armResumeAfterBuffer(6000); return; }
                    if (!getVideoPaused() && state.intendedPlaying &&
                      state.playSessionId === _ksSession && !state.seeking) {
                      execProgrammaticVideoPause();
                    armResumeAfterBuffer(6000);
                      }
                  });
                }, 1000);
              }
    });
    if (!coupledMode) return;
    const onAudioPlay = () => {
      if (isTabReturnImmune()) return; // never fight audio during tab return
      if (shouldBlockLeadingAudioForForegroundPlay()) {
        const _leadVt = (() => { try { return Number(video.currentTime()) || 0; } catch { return 0; } })();
        try { squelchAudioEvents(220); } catch {}
        safeSetAudioTime(_leadVt);
        execProgrammaticAudioPause(120);
        startForegroundUserPlayRetry();
        scheduleSync(0);
        return;
      }
      if (userToggleExpectingPlay()) clearUserToggleTxn();
      if (!state.isProgrammaticAudioPlay && !state.isProgrammaticVideoPlay) incrementRapidPlayPause();
      if (detectLoop()) {
        state.intendedPlaying = false;
        pauseHard();
        return;
      }

      if (audioEventsSquelched() || state.restarting || state.isProgrammaticAudioPlay || state.isProgrammaticVideoPlay) return;
      if (now() < state.audioPlayUntil || now() < state.audioPauseUntil) return;
      // During startup or settle window, let audio play — don't re-pause it
      const _inStartupKick = state.startupKickInFlight || (state.startupPhase && !state.firstPlayCommitted) || startupSettleActive();
      const _inSeekRecovery = seekRecoveryActive(180);
      const _blockedByState =
        !state.intendedPlaying ||
        userPauseLockActive() ||
        mediaSessionForcedPauseActive() ||
        (!_inSeekRecovery && shouldBlockNewAudioStart());
      if (_blockedByState && !userPlayIntentActive() && !_inStartupKick && !_inSeekRecovery) {
        try { squelchAudioEvents(400); } catch {}
        try { audio.pause(); } catch {}
        return;
      }
      if (_inSeekRecovery) {
        clearAudioPauseLocks();
        state.videoWaiting = false;
        state.videoStallSince = 0;
        state.audioStartGraceUntil = Math.max(state.audioStartGraceUntil, now() + 500);
      }

      state.audioEverStarted = true;
      state.seekAudioMustStartUntil = 0;
      state.audioStallSince = 0;
      try { MakeSureAudioIsNotCuttingOrWeird.onPlay(); } catch {}
      try { MakeSureAudioOrVideoDoesntPauseUnlessUserReallyWantsTo.start(); } catch {}
      try { MakeVideoNotFreezeAfterPlaybackAfterAltTabHapens.start(); } catch {}
      if (!state.firstPlayCommitted && !state.startupKickInFlight) {
        state.firstPlayCommitted = true;
        state.startupKickDone = true;
        state.startupPlaySettleUntil = now() + STARTUP_SETTLE_MS;
        clearStartupAutoplayRetryTimer();
        setTimeout(() => { state.startupPhase = false; }, 800);
      }

      clearMediaSessionForcedPause();
      state.intendedPlaying = true;
      state.bufferHoldIntendedPlaying = true;
      if (document.visibilityState === "visible") clearHiddenPlayPending();
      markMediaAction("play");
      setFastSync(2000);
      forceUnmuteForPlaybackIfAllowed();
      updateAudioGainImmediate();
      updateMediaSessionPlaybackState();
      if (!state.startupPrimed) {
        maybePrimeStartup();
        scheduleSync(0);
        return;
      }
      if ((state.startupKickInFlight && !state.startupKickDone) || state.seekResumeInFlight) {
        scheduleSync(0);
        return;
      }
      if (!state.syncing && !state.seeking && getVideoPaused()) {
        if (isHiddenBackground() && state.bgPlaybackAllowed) {
          scheduleSync(0);
        } else {
          playTogether().catch(() => {});
        }
      } else {
        scheduleSync(0);
      }
    };
    const onAudioPause = () => {
      try { MakeSureAudioIsNotCuttingOrWeird.onPause(); } catch {}
      if (userToggleExpectingPause()) clearUserToggleTxn();
      if (restartFromEndedGuardActive() &&
          state.intendedPlaying &&
          !state.isProgrammaticAudioPause &&
          !userWantsPauseNow(2400) &&
          !mediaSessionForcedPauseActive()) {
        const _endedRestartVt = (() => { try { return Number(video.currentTime()) || 0; } catch { return 0; } })();
        safeSetAudioTime(_endedRestartVt);
        state.audioStartGraceUntil = Math.max(state.audioStartGraceUntil, now() + 500);
        execProgrammaticAudioPlay({ squelchMs: 80, force: true, minGapMs: 0 }).catch(() => {});
        scheduleSync(0);
        return;
      }
      if (isTabReturnImmune() && state.intendedPlaying && !state.videoWaiting &&
        !(state.userPauseIntentPresetAt > 0 && (now() - state.userPauseIntentPresetAt) < 2000)) {
        try { if (audio && audio.paused) audio.play().catch(() => {}); } catch {}
        return;
        }
        if (!state.isProgrammaticAudioPause && !state.isProgrammaticVideoPause) incrementRapidPlayPause();
        if (detectLoop()) {
          state.intendedPlaying = false;
          pauseHard();
          return;
        }

        if (audioEventsSquelched() || state.restarting || state.isProgrammaticAudioPause || state.isProgrammaticVideoPause) return;
        if (now() < state.audioPauseUntil || now() < state.audioPlayUntil) return;

        // Snapshot grace state now. Use setTimeout(0) instead of rAF — rAF is
        // throttled to 0fps in background tabs, so audio pause events would
        // never be processed. setTimeout(0) fires reliably even when backgrounded.
        const _inGraceAtPauseFire = inBgReturnGrace();

      setTimeout(() => {
        if (state.seeking || state.restarting || state.isProgrammaticAudioPause) return;
        if (audio && !audio.paused) return;
        const _inSeekRecoveryPause = seekRecoveryActive(220);
        if (_inSeekRecoveryPause &&
            state.intendedPlaying &&
            !userPauseLockActive() &&
            !mediaSessionForcedPauseActive()) {
          const _seekPauseVt = (() => { try { return Number(video.currentTime()) || 0; } catch { return 0; } })();
          clearAudioPauseLocks();
          state.videoWaiting = false;
          state.videoStallSince = 0;
          state.audioStartGraceUntil = Math.max(state.audioStartGraceUntil, now() + 500);
          safeSetAudioTime(_seekPauseVt);
          execProgrammaticAudioPlay({ squelchMs: 120, force: true, minGapMs: 0 }).catch(() => {});
          return;
        }

        // --- BringBackToTab hard lock
        // Inside the tab-return window, audio pause events are spurious.
        // The retry loop handles audio simultaneously now (no 150ms delay).
        if (BringBackToTabManager.isLocked()) {
          // Track late arrivals for adaptive lock extension
          if (BringBackToTabManager.isVideoConfirmed()) {
            BringBackToTabManager.onLateArrivedPause();
          }
          return;
        }

        // --- VisibilityGuard: primary gate for audio pause suppression
        if (state.intendedPlaying && VisibilityGuard.shouldSuppress() && !mediaSessionForcedPauseActive()) {
          if (platform.useBgControllerRetry) state.resumeOnVisible = true;
          if (!state.isProgrammaticAudioPause && !state.videoWaiting && !state.seeking) {
            execProgrammaticAudioPlay({ squelchMs: 0, force: true, minGapMs: 0 }).catch(() => {});
          }
          return;
        }

        // check if audio restart makes sense (uses readyState, not stall flags which can go stale)
        const _audioShouldRestart = () => {
          if (!state.intendedPlaying || state.isProgrammaticAudioPause || state.seeking) return false;
          if (mediaSessionForcedPauseActive() || userPauseLockActive()) return false;
          if (shouldHoldAudioForForegroundStall({ allowRecovery: true })) return false;
          const _arVt = (() => { try { return Number(video.currentTime()) || 0; } catch { return 0; } })();
          const _visibleForeground =
            document.visibilityState === "visible" &&
            isWindowFocused();
          // video has data, go ahead
          const _arVNode = getVideoNode();
          const _arRS = _arVNode ? Number(_arVNode.readyState || 0) : 4;
          if (_visibleForeground) {
            if (!videoReadyForAudioResume(_arVt)) return false;
            return !shouldBlockNewAudioStart();
          }
          if (_arRS >= HAVE_FUTURE_DATA) return true;
          // actually starved, hold off
          if (state.videoWaiting || state.videoStallAudioPaused) return false;
          return !shouldBlockNewAudioStart();
        };

        const _restartAudio = () => {
          execProgrammaticAudioPlay({ squelchMs: 0, force: true, minGapMs: 0 }).catch(() => {});
        };

        if (_inGraceAtPauseFire || inBgReturnGrace()) {
          if (state.intendedPlaying && platform.useBgControllerRetry) state.resumeOnVisible = true;
          if (_audioShouldRestart()) _restartAudio();
          return;
        }
        if (isVisibilityTransitionActive() || isAltTabTransitionActive()) {
          if (state.intendedPlaying && platform.useBgControllerRetry) state.resumeOnVisible = true;
          // Tab is visible mid-transition — restart audio immediately
          if (document.visibilityState === "visible" && _audioShouldRestart()) _restartAudio();
          return;
        }
        if (!isVisibilityStable() || !isFocusStable()) {
          if (state.intendedPlaying && platform.useBgControllerRetry) state.resumeOnVisible = true;
          if (document.visibilityState === "visible" && _audioShouldRestart()) _restartAudio();
          return;
        }
        if (now() < state.tabVisibilityChangeUntil) {
          if (state.intendedPlaying && platform.useBgControllerRetry) state.resumeOnVisible = true;
          if (document.visibilityState === "visible" && _audioShouldRestart()) _restartAudio();
          return;
        }
        // Track oscillation: if BPM says suppress but we got here anyway,
        // it means the browser fired a pause that slipped through grace guards.
        if (BackgroundPlaybackManager.shouldSuppressAutoPause() && state.intendedPlaying) {
          BackgroundPlaybackManagerManager.onBrowserForcedPause();
          if (platform.useBgControllerRetry) state.resumeOnVisible = true;
          if (document.visibilityState === "visible" && _audioShouldRestart()) _restartAudio();
          return;
        }

        trackPauseEvent();

        if (document.visibilityState === "visible" && isWindowFocused()) {
          if (!userPauseIntentActive() && !userPauseLockActive() &&
            (state.isProgrammaticVideoPlay || state.seekResumeInFlight || state.bgResumeInFlight ||
            mediaPlayTxnActive() || fastSyncActive() || state.videoWaiting ||
            (platform.chromiumOnlyBrowser && chromiumPauseEventSuppressed()) ||
            BackgroundPlaybackManager.shouldSuppressAutoPause())) {
            if (state.intendedPlaying && platform.useBgControllerRetry) state.resumeOnVisible = true;
            scheduleSync(200);
            return;
            }
            // If video is still playing, this audio pause is spurious — user can't
            // pause just audio. Restart it instead of killing everything.
            if (!getVideoPaused() && state.intendedPlaying) {
              const _apVt = (() => { try { return Number(video.currentTime()) || 0; } catch { return 0; } })();
              if (!videoReadyForAudioResume(_apVt)) {
                armForegroundBufferAudioHold(Math.max(MIN_STALL_AUDIO_RESUME_MS, 500));
                state.videoWaiting = true;
                state.videoStallSince = state.videoStallSince || now();
                armResumeAfterBuffer(8000);
                scheduleSync(0);
                return;
              }
              safeSetAudioTime(_apVt);
              try { audio.volume = targetVolFromVideo(); } catch {}
              state.audioStartGraceUntil = Math.max(state.audioStartGraceUntil, now() + 800);
              execProgrammaticAudioPlay({ squelchMs: 200, force: true, minGapMs: 0 }).catch(() => {});
              return;
            }
            state.intendedPlaying = false;
          state.bufferHoldIntendedPlaying = false;
          state.playSessionId = (state.playSessionId || 0) + 1;
          updateMediaSessionPlaybackState();
          pauseHard();
          return;
        }

        if (shouldTreatVisiblePauseAsUserPause()) {
          state.intendedPlaying = false;
          state.bufferHoldIntendedPlaying = false;
          state.playSessionId = (state.playSessionId || 0) + 1;
          updateMediaSessionPlaybackState();
          pauseHard();
          return;
        }

        if (platform.chromiumOnlyBrowser && chromiumBgPauseBlocked()) return;
        if (startupSettleActive() && document.visibilityState === "visible" && isWindowFocused()) return;

        if (shouldIgnorePauseAsTransient()) {
          if (state.intendedPlaying && platform.useBgControllerRetry) {
            if (!state.startupKickDone && (state.startupKickInFlight || state.startupAutoplayRetryTimer)) {
              // kick in flight
            } else if (!state.startupKickDone && !state.startupKickInFlight) {
              scheduleStartupAutoplayRetry();
            } else {
              state.resumeOnVisible = true;
            }
          }
          return;
        }
        if (startupAutoplayPauseGraceActive()) {
          maybePrimeStartup();
          scheduleStartupAutoplayKick();
          return;
        }
        if (mediaSessionForcedPauseActive()) return;
        if (state.intendedPlaying && platform.useBgControllerRetry) {
          if (state.startupKickInFlight || (!state.startupKickDone && state.startupAutoplayRetryTimer)) {
            return;
          }
          noteBackgroundEntry();
          state.resumeOnVisible = true;
          // In background, try to restart audio directly — audio can play in background tabs.
          // The keepalive interval also handles this, but an immediate restart is faster.
          if (document.visibilityState === "hidden" && _audioShouldRestart()) {
            try { audio.play().catch(() => {}); } catch {}
          }
          return;
        }
        pauseTogether();
      });
    };
    const onReadyish = () => {
      // if startup already committed and audio is playing, nothing to do
      if (state.firstPlayCommitted && state.audioEverStarted && audio && !audio.paused) return;
      if (!state.firstPlayCommitted && !state.intendedPlaying && !wantsStartupAutoplay()) return;
      maybePrimeStartup();
      if (!state.intendedPlaying || state.restarting || state.seeking) return;
      if (mediaSessionForcedPauseActive()) return;
      const t = Number(video.currentTime());
      if (bothPlayableAt(t) || (!state.audioEverStarted && canStartAudioAt(t))) {
        if (!inMediaTxnWindow()) {
          scheduleSync(0);
        }
      }
    };
    audio.addEventListener("play", onAudioPlay, { passive: true });
    audio.addEventListener("playing", () => {
      if (shouldBlockLeadingAudioForForegroundPlay()) {
        const _leadVt = (() => { try { return Number(video.currentTime()) || 0; } catch { return 0; } })();
        try { squelchAudioEvents(220); } catch {}
        safeSetAudioTime(_leadVt);
        execProgrammaticAudioPause(120);
        startForegroundUserPlayRetry();
        scheduleSync(0);
        return;
      }
      try { UltraStabilizer.onAudioPlaying(); } catch {}
      finalizeForegroundReturnRecovery();
      // track when audio first started playing — safeSetAudioTime uses this
      // to avoid seeking during the first 3s of playback
      if (!_audioFirstPlayedAt) _audioFirstPlayedAt = performance.now();
      // GUARD: if video is actually buffering/waiting, don't let audio play.
      // This catches any path that bypassed the audio.play() gate.
      // Skip entirely during startup settle — decoder warm-up produces
      // false-positive "buffering" conditions that would re-pause audio on
      // every "playing" event and manifest as cuts in the first 15s.
      const _mustHoldAudioForVideo =
        !startupSettleActive() && (
          isForegroundVideoActuallyBuffering() ||
          shouldHoldAudioForForegroundStall({ allowRecovery: false }) ||
          isConfirmedForegroundVideoStall(120)
        );
      if (_mustHoldAudioForVideo) {
        const _apVN = getVideoNode();
        const _apRS = _apVN ? Number(_apVN.readyState || 0) : 4;
        if (_apRS < HAVE_FUTURE_DATA) {
          if (!state.videoWaiting) {
            state.videoWaiting = true;
            state.videoStallSince = state.videoStallSince || now();
          }
          pauseAudioForConfirmedVideoStall();
          return; // don't clear stall state since we just re-paused
        }
      }
      // Clear audio stall state — audio has data again
      if (state._stallVideoPauseTimer) { clearTimeout(state._stallVideoPauseTimer); state._stallVideoPauseTimer = null; }
      state.audioWaiting = false;
      state.audioStallSince = 0;
      // Resume video if we paused it due to audio stall
      if (state.audioStallVideoPaused && state.intendedPlaying && !state.seeking && !state.restarting) {
        state.audioStallVideoPaused = false;
        if (getVideoPaused() && !userPauseLockActive() && !mediaSessionForcedPauseActive()) {
          execProgrammaticVideoPlay();
        }
      }
    }, { passive: true });
    audio.addEventListener("pause", onAudioPause, { passive: true });
    // Install capture-phase pause guards on both video and audio.
    // Must be called AFTER listeners are registered so guards fire FIRST (capture phase).
    installImmunityPauseGuards();
    DONTMAKEITDOUBLEPLAY.install();
    audio.addEventListener("seeking", () => {
      // Only react if this is a user-initiated audio seek, not our programmatic sync
      if (state.restarting || !state.seeking) return;
      if (state.seekCompleted || state.seekBuffering) return;
      // Don't pause — the video seeked handler owns the flow
    }, { passive: true });
      audio.addEventListener("seeked", () => {
        if (state.restarting || !state.seeking) return;
        if (state.seekCompleted || state.seekBuffering) return;
        // Don't schedule finalize — video's seeked handler does that
      }, { passive: true });
        audio.addEventListener("ended", () => {
          if (state.restarting) return;
          if (state.seeking || state.seekBuffering) return;
          if (now() < state.suppressEndedUntil) return;
          try {
            const dur = Number(video.duration()) || 0;
            const ct = Number(audio.currentTime) || 0;
            if (dur > 1 && ct < dur - 2) return;
            if (dur > 5 && ct < 1) return;
          } catch {}
          if (isLoopDesired()) { restartLoop().catch(() => {}); return; }
          // Tell the anti-loop manager playback ended naturally
          MakeSureUnintentionalLoopDoesntEverHappenAtALLManager.onEnded();
          stripAutoplayAfterFirstPlay();
          state.tabReturnImmuneUntil = 0;
          state.resumeOnVisible = false;
          state.bgHiddenWasPlaying = false;
          disengagePauseIntercept();
          state.playSessionId++;
          clearSyncLoop();
          updateMediaSessionPlaybackState();
          pauseHard();
        }, { passive: true });
        audio.addEventListener("canplay", onReadyish, { passive: true });
        audio.addEventListener("canplaythrough", onReadyish, { passive: true });
        audio.addEventListener("loadeddata", onReadyish, { passive: true });
        videoEl.addEventListener("canplay", () => {
          const _canplayVt = (() => { try { return Number(video.currentTime()) || 0; } catch { return 0; } })();
          const _canplayReadyForResume =
            !state.firstPlayCommitted ||
            document.visibilityState !== "visible" ||
            !isWindowFocused() ||
            state.seeking ||
            state.seekBuffering ||
            state.seekResumeInFlight ||
            videoReadyForAudioResume(_canplayVt);
          if (_canplayReadyForResume) {
            state.videoWaiting = false;
            state.videoStallSince = 0;
            // Reset proactive stall detection counters
            _bufMonStallFrames = 0;
            _bufMonLastVT = -1;
          } else {
            armForegroundBufferAudioHold(Math.max(MIN_STALL_AUDIO_RESUME_MS, 500));
            state.videoWaiting = true;
            state.videoStallSince = state.videoStallSince || now();
          }
          // Cancel deferred stall audio pause if video recovered quickly
          if (state._stallAudioPauseTimer) {
            clearTimeout(state._stallAudioPauseTimer);
            state._stallAudioPauseTimer = null;
          }
          // video ready, clear stall flags and restart audio
          if (state.videoStallAudioPaused && state.intendedPlaying) {
            if (_canplayReadyForResume) {
              state.videoStallAudioPaused = false;
              state.stallAudioPausedSince = 0;
              state.stallAudioResumeHoldUntil = 0;
            } else {
              armResumeAfterBuffer(8000);
            }
            if (_canplayReadyForResume && coupledMode && audio && audio.paused && !state.seeking && !state.seekBuffering) {
              clearAudioPauseLocks();
              safeSetAudioTime(_canplayVt);
              try { audio.volume = targetVolFromVideo(); } catch {}
              // Short grace — just enough so buffer monitor doesn't re-kill
              // within one frame. Was 600ms which let audio play over frozen
              // video when canplay fired but video immediately re-stalled.
              state.audioStartGraceUntil = Math.max(state.audioStartGraceUntil, now() + 150);
              execProgrammaticAudioPlay({ squelchMs: 250, force: true, minGapMs: 0 }).catch(() => {});
            }
          }
          if (coupledMode && audio && audio.paused && state.intendedPlaying &&
              !state.seeking && !state.seekBuffering &&
              (state.seekResumeInFlight || state.seekAudioMustStartUntil > now())) {
            const _seekCanplayVt = (() => { try { return Number(video.currentTime()) || 0; } catch { return 0; } })();
            clearAudioPauseLocks();
            safeSetAudioTime(_seekCanplayVt);
            try { audio.volume = targetVolFromVideo(); } catch {}
            state.audioStartGraceUntil = Math.max(state.audioStartGraceUntil, now() + 500);
            armSeekAudioReadyKick(state.seekId, 3600);
            execProgrammaticAudioPlay({ squelchMs: 180, force: true, minGapMs: 0 }).catch(() => {});
          }
          onReadyish();
        }, { passive: true });
        videoEl.addEventListener("canplaythrough", onReadyish, { passive: true });
        videoEl.addEventListener("loadeddata", () => { try { UltraStabilizer.notifyVideoLoadeddata(); } catch {} onReadyish(); }, { passive: true });

        videoEl.addEventListener("loadedmetadata", () => {
          if (state.startupPhase && !state.firstPlayCommitted && wantsStartupAutoplay()) {
            forceZeroBeforeFirstPlay();
          }
        }, { once: true, passive: true });

        video.on("seeking", () => {
          try { UltraStabilizer.onSeekStart(); } catch {}
          if (state.restarting) return;
          if (state.bgSilentTimeSyncing) return;
          // Micro-seeks (0.001s nudges from freeze detection / tab return) should
          // not cascade through the full seek machinery. They're renderer flushes,
          // not real seeks.
          // _isMicroSeek gets set by ~10 different recovery paths (VCFM,
          // MVNFAPAAT, NFW, phantom revert, pause restore, tab return,
          // startup zero) with 150-300ms clear timers. a user timeline
          // click or keyboard seek during that window would be silently
          // swallowed — "seek backward does nothing" bug.
          // tell them apart: a micro-seek has delta ≤0.05s and no user
          // intent signal. real seek = bigger delta or explicit intent.
          // if it's real, clear the stale flag and let it through.
          if (state._isMicroSeek) {
            const _msVt = Number(videoEl.currentTime) || 0;
            const _msPrev = Number(state.lastKnownGoodVT) || 0;
            const _msDelta = Math.abs(_msVt - _msPrev);
            const _msHasUserIntent =
              state.pendingSeekTarget != null ||
              (typeof userSeekIntentActive === "function" && userSeekIntentActive()) ||
              ((now() - state.lastUserActionTime) < 1200);
            if (_msDelta < 0.25 && !_msHasUserIntent) return;
            // Real user seek snuck in while a micro-seek flag was live.
            // Clear the stale flag so seeked handler doesn't also drop it.
            state._isMicroSeek = false;
          }

          // During a play/pause transition, ignore ALL browser-initiated seeking
          // events. Chromium adjusts currentTime to the nearest keyframe on play
          // resume — adjustments up to ~2s are normal. The old 0.15s threshold
          // let these through, triggering full seek machinery (audio mute/pause,
          // state.seeking=true, seek finalize chain) which disrupts playback and
          // causes "video starts at wrong position on play/pause/play".
          // Only let real user seeks through (timeline click, keyboard, etc.).
          // was 800ms, bumped to 1200ms. browser keyframe adjustments on
          // play() resume can land 500-1000ms after the play event,
          // especially on slow machines or with big GOPs. 800ms was
          // missing the late ones.
          if (directUserToggleActive(500) || now() < state._playPauseTransitionUntil) {
            if (!userSeekIntentActive()) {
              // Still clear saved position so a dropped seek doesn't cause wrong position on play
              const _dropVt = Number(videoEl.currentTime) || 0;
              if (Math.abs(_dropVt - (state._pauseSavedPosition || 0)) > 0.5 && state._pauseSavedPosition > 0) {
                state._pauseSavedPosition = -1;
                state._pauseSavedAt = 0;
              }
              return;
            }
          }

          // phantom loop detection: if video suddenly jumps to near-0 from well
          // into the track, and nobody asked for it, revert immediately. browsers
          // sometimes fire bogus seeking-to-0 on buffer refill or codec flush.
          // also catches video.loop=true auto-restart when our isLoopDesired()
          // says loop is NOT wanted (e.g. loop attribute set by page but overridden).
          // Also catches post-ended phantom restarts via the manager.
          const _phVt = Number(videoEl.currentTime) || 0;
          const _phPrev = state.lastKnownGoodVT || 0;
          const _phProgrammatic = state.pendingSeekTarget != null || state.seeking || state.restarting ||
            (state.seekStabilizeUntil && now() < state.seekStabilizeUntil) ||
            (state.seekCooldownUntil && now() < state.seekCooldownUntil);
          const _phUserSeek = userSeekIntentActive() || (now() - state.lastUserActionTime) < 1500;
          const _phRequestedNearZero = state.pendingSeekTarget != null && Number(state.pendingSeekTarget) < 0.8;
          const _phNearZeroAuthorized =
            nearZeroSeekAuthorized(_phVt) ||
            _phUserSeek ||
            _phRequestedNearZero;
          // Phantom restart detection — only block if video ended AND no user action.
          // Skip during any user interaction or programmatic seek to prevent false
          // positives that cause video to get stuck in a revert loop.
          // User action window: 5s (was 2s). Seeks can resolve slowly, especially
          // on slow connections. 2s caused reverts on legitimate seeks.
          if (MakeSureUnintentionalLoopDoesntEverHappenAtALLManager.isPhantomRestart(_phVt) &&
              !_phUserSeek && !_phProgrammatic && (now() - state.lastUserActionTime) > 5000) {
            state._isMicroSeek = true;
            try { videoEl.currentTime = _phPrev > 0.5 ? _phPrev : videoEl.duration || _phPrev; } catch {}
            setTimeout(() => { state._isMicroSeek = false; }, 300);
            try { if (!videoEl.paused) videoEl.pause(); } catch {}
            return;
          }
          // Standalone near-zero revert: only fires if isPhantomRestart didn't
          // already catch it. Also subject to the rate limiter — if we've reverted
          // 2+ times in the phantom revert window, let the seek through.
          if (_phVt < 0.5 && _phPrev > 0.9 && state.firstPlayCommitted &&
              !_phNearZeroAuthorized && !_phProgrammatic && !isLoopDesired() &&
              (now() - state.lastUserActionTime) > 5000) {
            // Check rate limiter from isPhantomRestart — reuse the same counter
            if (!MakeSureUnintentionalLoopDoesntEverHappenAtALLManager.isPhantomRestart(_phVt)) {
              // Rate limiter said "enough reverts" — let this seek through
            } else {
              state._isMicroSeek = true;
              try { videoEl.currentTime = _phPrev; } catch {}
              setTimeout(() => { state._isMicroSeek = false; }, 300);
              return;
            }
          }

          // During tab-return immunity, ignore only clearly spurious seeks.
          // Legit user seeks must always go through (fixes "first seek ignored").
          const _seekLikelyUser =
            state.pendingSeekTarget != null ||
            userSeekIntentActive() ||
            ((now() - state.lastUserActionTime) < 3500) ||
            (document.visibilityState === "visible" && isWindowFocused() && !isVisibilityTransitionActive());
          if (isTabReturnImmune() && !state.seeking &&
            (now() - state.lastUserActionTime) > 2000 && !_seekLikelyUser) return;

          // Android Chromium random seek protection:
          if (platform.androidChromium && state.pendingSeekTarget == null) {
            const _curTime = Number(videoEl.currentTime) || 0;
            const _prevTime = state.lastKnownGoodVT || 0;
            const _delta = Math.abs(_curTime - _prevTime);
            const _recentUserAction = (now() - state.lastUserActionTime) < 2000;
            if (_delta < 0.12 && !_recentUserAction && !state.seeking && state.intendedPlaying) {
              return;
            }
          }

          clearSeekBuffering();
          clearSeekAudioReadyKick();
          clearTransitionDriftTimers();
          // Cancel any pending post-seek guarantee timers from the previous seek
          if (state._seekPostTimers.length) {
            state._seekPostTimers.forEach(t => clearTimeout(t));
            state._seekPostTimers = [];
          }
          state.seekId++;
          const currentSeekId = state.seekId;
          clearBufferHold();
          state.seeking = true;
          state._seekStartedAt = performance.now();
          // Save pre-seek audio volume so we can restore it after the seek.
          // Audio is always muted during seeking to prevent old buffer playback.
          if (coupledMode && audio) {
            state._seekPreVolume = audio.paused ? targetVolFromVideo() : audio.volume;
          }
          try { MakeSureAudioIsNotCuttingOrWeird.onSeekStart(); } catch {}
          state.seekWantedPlaying = state.intendedPlaying;
          if (state.seekWantedPlaying) {
            armSeekResumeIntent(5000);
            state.seekStabilizeUntil = Math.max(state.seekStabilizeUntil, now() + 1500);
          } else {
            clearSeekResumeIntent();
            state.seekStabilizeUntil = Math.max(state.seekStabilizeUntil, now() + 500);
          }
          state.playRequestedDuringSeek = state.intendedPlaying;
          state.seekCompleted = false;
          state.seekKickAudioAllowedUntil = 0;
          state.seekAudioKickAt = 0;
          state.seekAudioMustStartUntil = 0;
          state.firstSeekDone = true;
          // Reset rapid-play-pause counter — seek events should never feed loop detection
          state.rapidPlayPauseCount = 0;
          state.rapidPlayPauseResetAt = now();
          state.loopPreventionCooldownUntil = 0;

          clearSeekSyncFinalizeTimer();
          clearSeekWatchdog();
          // Get seek target from multiple sources — video.js currentTime() may
          // not reflect the target yet during 'seeking', so also check the native element.
          const vjsTime = Number(video.currentTime());
          const nativeTime = Number(videoEl.currentTime);
          const innerEl = video?.el?.()?.querySelector?.("video");
          const innerTime = innerEl ? Number(innerEl.currentTime) : NaN;
          // Use pendingSeekTarget if it was set by mediaSession/keyboard handlers,
          // otherwise pick the most likely seek target (they should all agree after seeking fires)
          const seekTime = state.pendingSeekTarget != null ? Number(state.pendingSeekTarget) :
          isFinite(nativeTime) ? nativeTime :
          isFinite(vjsTime) ? vjsTime :
          isFinite(innerTime) ? innerTime : 0;
          const previousGoodVT = state.lastKnownGoodVT || 0;

          // Only commit firstPlay from user-initiated or programmatic seeks.
          // Browser-fired seeks (buffer adjustments, autoplay setup) should NOT
          // commit — doing so prevents the play handler from accepting autoplay
          // via the !firstPlayCommitted && wantsStartupAutoplay() path.
          // If the seek jump is large (>2.0s), it's definitely a user seek, not a browser adjustment.
          const _isUserOrProgrammaticSeek = state.pendingSeekTarget != null ||
          (now() - state.lastUserActionTime) < 2000 ||
          Math.abs(seekTime - previousGoodVT) > 2.0;

          if (!state.firstPlayCommitted && _isUserOrProgrammaticSeek) {
            suppressStartupZero(15000);
          }

          // Clear any saved pause position so that if the user seeks while paused,
          // hitting play afterwards won't jump back to the pre-seek pause point.
          state._pauseSavedPosition = -1;
          state._pauseSavedAt = 0;

          state.seekTargetTime = seekTime;
          if (seekTime > 0.35) {
            commitStartupFromResolvedPlaybackPosition(seekTime, {
              fromSeek: !!(_isUserOrProgrammaticSeek || _seekLikelyUser),
              suppressMs: 20000
            });
          }
          if (seekTime < 0.8 && (_isUserOrProgrammaticSeek || _seekLikelyUser)) {
            authorizeNearZeroSeek(2500);
          }
          const shouldKeepPreviousGoodVT =
            seekTime < 0.8 &&
            state.firstPlayCommitted &&
            previousGoodVT > 0.9 &&
            !nearZeroSeekAuthorized(seekTime);
          if (!shouldKeepPreviousGoodVT) {
            state.lastKnownGoodVT = seekTime;
            state.lastKnownGoodVTts = now();
          }
          state.seekCooldownUntil = now() + 600;

          state.videoWaiting = false;
          state.audioWaiting = false;
          state.audioStallVideoPaused = false;
          if (state._stallVideoPauseTimer) { clearTimeout(state._stallVideoPauseTimer); state._stallVideoPauseTimer = null; }
          if (state._stallAudioPauseTimer) { clearTimeout(state._stallAudioPauseTimer); state._stallAudioPauseTimer = null; }
          clearAudioPauseLocks();
          state.stateChangeCooldownUntil = 0;
          state.audioFadeCompleteUntil = 0;
          state.audioPlayUntil = 0;
          clearBufferHold();

          const watchdogSeekId = state.seekId;
          state.seekWatchdogTimer = setTimeout(() => {
            state.seekWatchdogTimer = null;
            if (state.seeking && state.seekId === watchdogSeekId) {
              scheduleSeekFinalize(0, watchdogSeekId);
            }
          }, SEEK_WATCHDOG_MS);

          // ALWAYS pause audio during seeking — prevents old buffer content from
          // being heard between seek start and audio.currentTime write.
          // Previous approach: only zero volume for buffered seeks, pause for unbuffered.
          // Problem: volume-zeroed audio kept playing old content, and if ANY code
          // restored volume before the currentTime write took effect, old audio leaked.
          // New approach: PAUSE audio for ALL seeks. Seeked handler resumes + restores
          // volume after audio position is synced. This is the only safe approach.
          if (coupledMode && audio) {
            // Zero volume AND pause — belt and suspenders
            try { audio.volume = 0; } catch {}
            if (!audio.paused) {
              squelchAudioEvents(600);
              try {
                cancelActiveFade();
                audio.pause();
              } catch {}
            }
            // Move audio position to seek target — EAGERLY, regardless of buffering.
            // Previously we only did this when the target was in the audio buffer.
            // But for unbuffered seeks (common when scrubbing to new positions),
            // seeking audio here gives the decoder a head-start: it starts
            // requesting the new data immediately rather than waiting for seeked
            // + 60ms kick. On typical connections, this cuts audio latency by
            // 150-400ms — the difference between "audio starts right away" and
            // "audio comes really late after seek".
            const _seekAudioAt = Number(audio.currentTime) || 0;
            const _seekWouldRestart = seekTime < 0.5 && _seekAudioAt > 1.0 && state.firstPlayCommitted && !state.restarting && !isLoopDesired();
            if (!_seekWouldRestart && isFinite(seekTime) && seekTime >= 0) {
              state._allowAudioTimeWrite = true;
              try { audio.currentTime = seekTime; } catch {}
              state._allowAudioTimeWrite = false;
            }
            // Do NOT play audio here — seeked handler owns the resume
          }

          if (!shouldResumeAfterSeek()) {
            clearSeekResumeIntent();
            execProgrammaticVideoPause();
          } else {
            state.intendedPlaying = true;
            state.bufferHoldIntendedPlaying = true;
          }

          state.driftStableFrames = 0;
          state.lastDrift = 0;
          setFastSync(1800);
          scheduleSync(0);
        });
        video.on("seeked", () => {
          if (state.restarting) return;
          // Micro-seeks are renderer flushes, not real seeks — skip entirely.
          // BUT: if our seeking handler already accepted this seek as a real
          // user seek (state.seeking=true means the full seek machinery is
          // active), a stale _isMicroSeek from a concurrent recovery path
          // must not block seeked finalization. This complements the
          // seeking-handler fix that prevents user-seek swallowing.
          if (state._isMicroSeek && !state.seeking) return;
          // During immunity, if this seeked event is from a spurious browser seek
          // (not from our programmatic seek machinery), skip the audio sync.
          if (isTabReturnImmune() && !state.seeking) return;
          // NOTE: Do NOT gate on pendingSeekTarget here. pendingSeekTarget is
          // set in the seeking handler and cleared below at line ~14861. It is
          // ALWAYS non-null when seeked fires, so gating on it would block
          // every single seeked event — preventing audio sync, volume restore,
          // and seek finalization. The seekId check in the post-seek kick chain
          // (line ~14879) already handles the rapid-scrubbing dedup case.
          clearSeekWatchdog();
          clearAudioPauseLocks();
          state.audioWaiting = false;
          state.audioStallVideoPaused = false;
          // DON'T restore audio volume yet — we need to seek audio first.
          // Restoring volume before the audio seek causes the old audio buffer
          // to play at full volume for ~10-50ms (the audible "blip").
          // Get the definitive seek target — video.currentTime() is reliable after seeked
          const newTime = Number(video.currentTime());
          const expectedSeekTime = Number(state.seekTargetTime);
          if (newTime > 0.35) {
            commitStartupFromResolvedPlaybackPosition(newTime, { fromSeek: true, suppressMs: 20000 });
          }
          // phantom loop guard: only revert if video ended AND user hasn't interacted.
          // The old code was too aggressive — it reverted legitimate seeks near the
          // beginning of the video, causing a revert loop.
          const prevBeforeSeeked = state.lastKnownGoodVT || 0;
          if (newTime < 0.5 && state.firstPlayCommitted && !isLoopDesired() &&
              !nearZeroSeekAuthorized(newTime) && !userSeekIntentActive() &&
              (now() - state.lastUserActionTime) > 3500 &&
              state.endedNaturally && !state.restarting) {
            // Video ended and something tried to restart it — revert
            state._isMicroSeek = true;
            if (isFinite(expectedSeekTime) && expectedSeekTime > 0.8) {
              try { video.currentTime(expectedSeekTime); } catch {}
              try { videoEl.currentTime = expectedSeekTime; } catch {}
            } else if (prevBeforeSeeked > 0.9) {
              try { videoEl.currentTime = prevBeforeSeeked; } catch {}
            }
            setTimeout(() => { state._isMicroSeek = false; }, 300);
            if (coupledMode && audio && state._seekPreVolume != null) {
              try { audio.volume = state._seekPreVolume; } catch {}
              state._seekPreVolume = null;
            }
            return;
          }
          state.lastKnownGoodVT = newTime;
          state.lastKnownGoodVTts = now();
          // Clear pendingSeekTarget — the seek is RESOLVED. Leaving it set
          // to newTime causes the NEXT seeking event to use this stale value
          // as the seek target (line ~14331 prioritizes pendingSeekTarget over
          // the native element's actual position). This corrupts seekTargetTime,
          // lastKnownGoodVT, and audio position for subsequent seeks.
          state.pendingSeekTarget = null;
          if (coupledMode && audio && isFinite(newTime) && newTime >= 0) {
            const _curAudioTime = Number(audio.currentTime) || 0;
            // Guard: never seek audio to near-0 when it's well into playback
            const _wouldRestart = newTime < 0.5 && _curAudioTime > 1.0 && state.firstPlayCommitted && !state.restarting && !isLoopDesired();
            // Only sync audio if drift is meaningful (>0.2s). Smaller drift
            // flushes the audio decode buffer and causes audible pops/glitches.
            if (!_wouldRestart && Math.abs(_curAudioTime - newTime) > 0.2) {
              // Debounce: if we just wrote audio.currentTime very recently
              // (rapid scrubbing), skip this write — finalizeSeekSync handles it.
              const _seekedWriteNow = performance.now();
              if ((_seekedWriteNow - _lastSafeSeekAt) > 100) {
                _lastSafeSeekAt = _seekedWriteNow;
                state._allowAudioTimeWrite = true;
                try { audio.currentTime = newTime; } catch {}
                state._allowAudioTimeWrite = false;
              }
            }
            // Restore volume AND kick audio in one shot at 20ms.
            // Previously, volume restore was at 30ms and first kick at 60ms —
            // those ran at different times so audio always started ~60ms late
            // and could briefly play at wrong volume. Unifying them at 20ms
            // means volume is ready exactly when the kick fires.
            const _seekedPreVol = state._seekPreVolume;
            state._seekPreVolume = null;
            // Mark seeked as complete for post-seek kick gating.
            state.seekCompleted = true;
            // Post-seek resume: play video and audio exactly ONCE each.
            // CRITICAL FIX for "audio doesn't play after seek": instead of a
            // SINGLE audio kick at 60ms that races with the buffer monitor,
            // we now do a short retry chain. The audio.play gate may block
            // the first call if readyState briefly dropped; retries ensure
            // at least one gets through.
            if (shouldResumeAfterSeek() && !state.endedNaturally) {
              state.intendedPlaying = true;
              state.bufferHoldIntendedPlaying = true;
              const _kickSeekId = state.seekId;
              const _kickArmedAt = now();
              state.seekAudioKickAt = _kickArmedAt;
              // Widen the kick window so late-arriving audio plays are still
              // allowed through the gate. 3000 was sometimes too short.
              state.seekKickAudioAllowedUntil = _kickArmedAt + 4000;
              state.seekAudioMustStartUntil = _kickArmedAt + 4000;
              state.isProgrammaticAudioPause = false;
              state.audioEventsSquelchedUntil = 0;
              state.audioPauseUntil = 0;
              state.audioPlayUntil = 0;
              state.stateChangeCooldownUntil = 0;
              state.videoStallAudioPaused = false;
              state.videoWaiting = false;
              state.stallAudioResumeHoldUntil = 0;
              state.videoStallSince = 0;
              state.stallAudioPausedSince = 0;
              clearForegroundBufferAudioHold();
              // Long grace so buffer monitor doesn't kill audio during the
              // post-seek settle window.
              state.audioStartGraceUntil = Math.max(state.audioStartGraceUntil, _kickArmedAt + 1200);
              armSeekAudioReadyKick(_kickSeekId, 2500);
              // single video kick through the unified lock
              if (getVideoPaused() && tryAcquireVideoPlayLock()) execProgrammaticVideoPlay();
              // Retry chain at 20ms, 80ms, 250ms, 500ms, 800ms.
              // First kick at 20ms (instead of 60ms) — volume is restored at
              // the same time so audio starts as soon as the decoder flushes.
              // Later retries cover slow decoders still refilling buffers.
              const _kickAudio = (attemptId) => {
                if (state.seekId !== _kickSeekId) return;
                if (!state.intendedPlaying || state.endedNaturally) return;
                // don't kick if video is still buffering — audio would play
                // over a frozen/buffering frame. next retry catches it once
                // the decoder has data.
                // exception: the last two attempts (4 and 5) bypass this —
                // if video still hasn't come back after 400-800ms, waiting
                // longer just makes audio feel broken. let it start.
                const _kickVNode = getVideoNode();
                const _kickVRS = _kickVNode ? Number(_kickVNode.readyState || 0) : 0;
                const _kickBypassRS = attemptId >= 4;
                if (!_kickBypassRS && _kickVRS < HAVE_CURRENT_DATA &&
                    document.visibilityState === "visible") {
                  return;
                }
                // Keep audio pinned to video's current position while decoder
                // settles. DIRECTIONAL: only write when audio is behind video
                // (forward correction). NEVER write when audio is ahead of
                // video — that rewinds the decoder mid-playback, which is the
                // "seek plays the same part twice" bug.
                try {
                  const _kickVt = Number(video.currentTime()) || 0;
                  const _kickAt = Number(audio.currentTime) || 0;
                  // positive → audio is behind video (safe to push forward)
                  // negative → audio is ahead of video (rewinding would cause replay)
                  const _kickForwardDrift = _kickVt - _kickAt;
                  const _kickAbsDrift = Math.abs(_kickForwardDrift);
                  // Write when: audio is paused (position before start, always fine)
                  // OR audio is playing but clearly BEHIND video (> 0.5s, forward write).
                  // Never write when audio is playing and AHEAD — that rewinds.
                  const _shouldPin =
                    audio.paused
                      ? _kickAbsDrift > 0.35
                      : (_kickForwardDrift > 0.5);
                  if (_shouldPin && isFinite(_kickVt) && _kickVt > 0.2) {
                    state._allowAudioTimeWrite = true;
                    try { audio.currentTime = _kickVt; } catch {}
                    state._allowAudioTimeWrite = false;
                  }
                } catch {}
                if (!audio.paused) return; // already playing — don't touch it
                // clear the play dedup so a recent audio.play() from another
                // path (e.g. the "playing" handler) doesn't eat this kick.
                DONTMAKEITDOUBLEPLAY.reset(audio);
                execProgrammaticAudioPlay({ squelchMs: 80, force: true, minGapMs: 0 }).catch(() => {});
              };
              // volume restore: we muted audio on seeking so the stale
              // pre-seek buffer wouldn't play audibly. now put it back.
              //   - audio already at target position → 10ms tick is enough
              //   - otherwise wait for audio's seeked event, but fall back
              //     at 90ms so we don't leave audio silent forever if the
              //     decoder is slow to fire seeked
              if (_seekedPreVol != null) {
                let _volRestored = false;
                const _restoreVol = () => {
                  if (_volRestored) return;
                  _volRestored = true;
                  try { audio.removeEventListener("seeked", _onAudioSeeked); } catch {}
                  if (state.seekId !== _kickSeekId) return;
                  if (state._seekPreVolume != null) return;
                  try { audio.volume = _seekedPreVol; } catch {}
                };
                const _onAudioSeeked = () => _restoreVol();
                let _audioNeedsSeek = true;
                try {
                  const _avCT = Number(audio.currentTime) || 0;
                  const _vvCT = Number(video.currentTime()) || 0;
                  _audioNeedsSeek = !!audio.seeking ||
                    (isFinite(_avCT) && isFinite(_vvCT) && Math.abs(_avCT - _vvCT) > 0.25);
                } catch {}
                if (!_audioNeedsSeek) {
                  setTimeout(_restoreVol, 10);
                } else {
                  try { audio.addEventListener("seeked", _onAudioSeeked, { once: true, passive: true }); } catch {}
                  setTimeout(_restoreVol, 90);
                }
                state._seekPreVolume = null;
              }
              // kick chain: 5 / 40 / 150 / 400 / 800 / 1400 ms.
              // first three try the readyState gate; the last three bypass it
              // so audio eventually starts even if video stays slow to recover.
              const _t1 = setTimeout(() => _kickAudio(1), 5);
              const _t2 = setTimeout(() => _kickAudio(2), 40);
              const _t3 = setTimeout(() => _kickAudio(3), 150);
              const _t4 = setTimeout(() => _kickAudio(4), 400);
              const _t5 = setTimeout(() => _kickAudio(5), 800);
              const _t6 = setTimeout(() => _kickAudio(6), 1400);
              state._seekPostTimers.push(_t1, _t2, _t3, _t4, _t5, _t6);
              // Legacy name retained for the line below that references it
              const _audioKickTimer = _t1;
              // NO 400ms safety retry. The old retry raced with the buffer monitor:
              // buffer monitor killed audio (video briefly starved) → retry restarted
              // it → buffer monitor killed it again → play-pause loop. Instead,
              // finalizeSeekSync is the single backstop for seek recovery.
            }
          } else {
            // No audio seek needed — restore volume immediately
            if (coupledMode && audio && state._seekPreVolume != null) {
              try { audio.volume = state._seekPreVolume; } catch {}
              state._seekPreVolume = null;
            }
          }
          if (shouldResumeAfterSeek() && !state.endedNaturally && getVideoPaused() &&
              tryAcquireVideoPlayLock()) {
            state.intendedPlaying = true;
            state.bufferHoldIntendedPlaying = true;
            execProgrammaticVideoPlay();
          }
          state.driftStableFrames = 0;
          state.lastDrift = 0;
          // kick the sync loop into fast mode right now so drift between
          // audio and video starts getting corrected immediately. waiting
          // for finalizeSeekSync at 500ms meant sync was visibly late —
          // audio ran ahead or behind video for half a second post-seek
          // before rate correction kicked in.
          setFastSync(2000);
          scheduleSync(60);
          scheduleSeekFinalize(SEEK_FINALIZE_DELAY_MS, state.seekId);
        });
        video.on("ended", () => {
          if (state.restarting) return;
          if (state.seeking || state.seekBuffering) return;
          if (now() < state.suppressEndedUntil) return;
          try {
            const dur = Number(video.duration()) || 0;
            const ct = Number(video.currentTime()) || 0;
            if (dur > 1 && ct < dur - 2) return;
            if (dur > 5 && ct < 1) return;
          } catch {}
          if (isLoopDesired()) { restartLoop().catch(() => {}); return; }
          // Tell the anti-loop manager playback ended naturally
          MakeSureUnintentionalLoopDoesntEverHappenAtALLManager.onEnded();
          // Kill autoplay so Video.js/browser doesn't auto-restart
          stripAutoplayAfterFirstPlay();
          state.tabReturnImmuneUntil = 0;
          state.resumeOnVisible = false;
          state.bgHiddenWasPlaying = false;
          disengagePauseIntercept();
          state.playSessionId++;
          // Kill sync loop — nothing should be syncing after ended
          clearSyncLoop();
          updateMediaSessionPlaybackState();
          pauseHard();
          // Patch native element play() to block phantom restarts at the lowest level
          const _endedGen = state.playSessionId;
          try {
            const _nativeVN = getVideoNode();
            if (_nativeVN && !_nativeVN._endedPlayPatched) {
              const _origNativePlay = _nativeVN.play.bind(_nativeVN);
              _nativeVN.play = function() {
                if (state.endedNaturally && !state.restarting && !isLoopDesired()) {
                  // endedNaturally should already be cleared by onUserPlay()
                  // from onPressStart/markUserPlayIntent (capture phase, runs first).
                  // If still true here, this is a programmatic call — block it.
                  return Promise.resolve();
                }
                return _origNativePlay();
              };
              _nativeVN._endedPlayPatched = true;
            }
          } catch {}
          // Watchdog: after ending, monitor for phantom restarts and kill them.
          // Self-clears when endedNaturally is cleared by user play intent.
          // No fixed timeout — stays active until user explicitly plays again.
          const _endedKill = setInterval(() => {
            // If user cleared the ended state (via onUserPlay), stop watching
            if (!state.endedNaturally) {
              clearInterval(_endedKill);
              return;
            }
            const vn = getVideoNode();
            if (vn && !vn.paused && !state.restarting && !isLoopDesired()) {
              const vt = Number(vn.currentTime) || 0;
              if (vt < 3.0) {
                try { vn.pause(); } catch {}
                if (coupledMode && audio && !audio.paused) { try { audio.pause(); } catch {} }
              }
            }
            if (coupledMode && audio && !audio.paused && !state.restarting && !isLoopDesired()) {
              const at2 = Number(audio.currentTime) || 0;
              if (at2 < 3.0) {
                try { audio.pause(); } catch {}
              }
            }
          }, 150);
        });
  }

  async function restartLoop() {
    // Only restart if loop is explicitly desired
    if (!isLoopDesired()) { pauseTogether(); return; }
    if (state.restarting) return;
    state.restarting = true;
    try {
      clearSyncLoop();
      pauseHard();
      const startAt = 0;
      state.suppressEndedUntil = now() + 1000;
      state.lastKnownGoodVT = 0;
      state.lastKnownGoodVTts = now();
      safeSetCT(videoEl, startAt);
      if (coupledMode) safeSetAudioTime(startAt);
      state.intendedPlaying = true;
      state.bufferHoldIntendedPlaying = true;
      markMediaAction("play");
      setFastSync(1600);
      forceUnmuteForPlaybackIfAllowed();
      updateAudioGainImmediate();
      updateMediaSessionPlaybackState();
      await ensureUnmutedIfNotUserMuted();
      await new Promise(r => requestAnimationFrame(r));
      await playTogether();
    } finally {
      state.restarting = false;
    }
  }

  // --- BringBackToTab retry engine
  function startBringBackRetry() {
    if (state.bbtabRetryRafId)    { cancelAnimationFrame(state.bbtabRetryRafId); state.bbtabRetryRafId = null; }
    if (state.bbtabRetryTimer)    { clearTimeout(state.bbtabRetryTimer);         state.bbtabRetryTimer    = null; }
    if (state.bbtabAudioSyncTimer){ clearTimeout(state.bbtabAudioSyncTimer);     state.bbtabAudioSyncTimer = null; }
    clearTrackedWakeupRetryTimers();

    // never restart after ended.
    if (state.endedNaturally) return;
    if (MakeSureUnintentionalLoopDoesntEverHappenAtALLManager.shouldBlockAutoRestart()) return;

    // Only allow if: was playing, OR resume flagged, OR startup hasn't committed yet
    if (!state.intendedPlaying && !state.resumeOnVisible &&
      !(wantsStartupAutoplay() && !state.firstPlayCommitted)) return;
    const bbtGen = state.tabReturnGen;

    BringBackToTabManager.onTabReturn();

    // --- shot 1: immediate rAF
    const _returnNeedsForegroundResume = () => (
      state.resumeOnVisible ||
      state.bgHiddenWasPlaying ||
      hiddenPlayPendingActive() ||
      foregroundResumeBoostActive() ||
      state.mediaSessionInitiatedPlay
    );
    const _isHealthyReturnVideoPlayback = () => {
      if (!state.intendedPlaying) return false;
      if (getVideoPaused()) return false;
      const vrs = getVideoReadyState();
      const progressed = hasPlaybackProgressFromBackground(0.035);
      if (vrs < HAVE_CURRENT_DATA && !progressed) return false;
      if (_returnNeedsForegroundResume() && !progressed && vrs < HAVE_FUTURE_DATA) return false;
      return true;
    };
    const _kickReturnAudio = (hard = false) => {
      if (!coupledMode || !audio || state.tabReturnAudioMuted) return;
      const targetTime = getPreferredPlaybackSyncTarget({ preferAudio: true, allowNearZero: !state.firstPlayCommitted });
      const currentAt = Number(audio.currentTime) || 0;
      const drift = isFinite(targetTime) ? Math.abs(currentAt - targetTime) : 0;
      const wouldRestartNearZero =
        targetTime < 0.5 &&
        currentAt > 0.9 &&
        state.firstPlayCommitted &&
        !nearZeroSeekAuthorized(targetTime) &&
        !state.restarting &&
        !isLoopDesired();

      if (isFinite(targetTime) && !wouldRestartNearZero) {
        const shouldRealignAudio =
          audio.paused ||
          hard ||
          drift > 1.5 ||
          (_returnNeedsForegroundResume() && drift > 1.0);
        if (shouldRealignAudio) safeSetAudioTime(targetTime);
      }

      try { audio.volume = targetVolFromVideo(); } catch {}
      if (audio.paused || hard) {
        cancelActiveFade();
        state.audioStartGraceUntil = Math.max(state.audioStartGraceUntil, now() + (hard ? 600 : 400));
        execProgrammaticAudioPlay({ squelchMs: hard ? 120 : 0, force: true, minGapMs: 0 }).catch(() => {});
      }
    };
    const _kickReturnPlayback = (hard = false) => {
      // If NMPBFN is handling recovery, don't interfere. NMPBFN already called
      // play() once and is waiting for canplay. Additional play() calls from
      // here reset the video decode pipeline, extending the freeze.
      if (NotMakePlayBackFixingNoticable.isRecovering()) return;
      const _krVNode = getVideoNode();
      const _krRS = _krVNode ? Number(_krVNode.readyState || 0) : 0;
      if (_krRS >= HAVE_FUTURE_DATA) {
        state.videoWaiting = false;
        state.videoStallAudioPaused = false;
        state.stallAudioPausedSince = 0;
        state.stallAudioResumeHoldUntil = 0;
        state.videoStallSince = 0;
      }
      state.isProgrammaticVideoPause = false;
      _bufMonStallFrames = 0;
      clearAudioPauseLocks();
      if (_krRS >= HAVE_FUTURE_DATA) clearBufferHold();
      VisibilityGuard.onPlayCalled();
      const vn = getVideoNode();
      // Only call play() if actually paused. Calling play() on a playing element
      // fires play/playing events that cascade into double-play, audio kicks,
      // and visible UI spam. DONTMAKEITDOUBLEPLAY.resetAll() removed — don't
      // reset dedup between shots; let the dedup prevent storm behavior.
      if (vn && vn.paused) {
        DONTMAKEITDOUBLEPLAY.resetAll();
        const _nPlay = HTMLMediaElement.prototype.play;
        try { _nPlay.call(vn).catch(() => {}); } catch {}
      }
      if (coupledMode) {
        _kickReturnAudio(hard);
        if (hard) {
          state.bgCatchUpCooldownUntil = 0;
          seamlessBgCatchUp().catch(() => {});
        }
      }
      setFastSync(hard ? 1800 : 1200);
      scheduleSync(0);
    };

    state.bbtabRetryRafId = requestAnimationFrame(() => {
      state.bbtabRetryRafId = null;
      if (state.tabReturnGen !== bbtGen) return;
      if (state.endedNaturally) return;
      if (MakeSureUnintentionalLoopDoesntEverHappenAtALLManager.shouldBlockAutoRestart()) return;
      if (userPauseLockActive() || mediaSessionForcedPauseActive()) return;
      if (!state.intendedPlaying && !state.firstPlayCommitted && wantsStartupAutoplay()) {
        state.intendedPlaying = true;
        state.bufferHoldIntendedPlaying = true;
      }
      if (!state.intendedPlaying) return;

      _kickReturnPlayback(true);
    });

    // --- shot 1.25: 80ms quick-check
    const _shot80 = trackWakeupRetryTimer(setTimeout(() => {
      untrackWakeupRetryTimer(_shot80);
      if (state.tabReturnGen !== bbtGen) return;
      if (state.endedNaturally || MakeSureUnintentionalLoopDoesntEverHappenAtALLManager.shouldBlockAutoRestart()) return;
      if (!state.intendedPlaying && !state.firstPlayCommitted && wantsStartupAutoplay()) { state.intendedPlaying = true; state.bufferHoldIntendedPlaying = true; }
      if (!state.intendedPlaying || userPauseLockActive() || mediaSessionForcedPauseActive()) return;
      // clear stale stall flags
      state.videoStallAudioPaused = false;
      state.stallAudioResumeHoldUntil = 0;
      state.stallAudioPausedSince = 0;
      if (_isHealthyReturnVideoPlayback()) {
        BringBackToTabManager.onVideoConfirmedPlaying();
        _kickReturnAudio(false);
        return;
      }
      _kickReturnPlayback(false);
    }, 80));

    // --- shot 1.5: 200ms intermediate
    const _shot200 = trackWakeupRetryTimer(setTimeout(() => {
      untrackWakeupRetryTimer(_shot200);
      if (state.tabReturnGen !== bbtGen) return;
      if (state.endedNaturally || MakeSureUnintentionalLoopDoesntEverHappenAtALLManager.shouldBlockAutoRestart()) return;
      if (!state.intendedPlaying && !state.firstPlayCommitted && wantsStartupAutoplay()) { state.intendedPlaying = true; state.bufferHoldIntendedPlaying = true; }
      if (!state.intendedPlaying || userPauseLockActive() || mediaSessionForcedPauseActive()) return;
      // clear stale stall flags
      state.videoStallAudioPaused = false;
      state.stallAudioResumeHoldUntil = 0;
      state.stallAudioPausedSince = 0;
      if (_isHealthyReturnVideoPlayback()) {
        BringBackToTabManager.onVideoConfirmedPlaying();
        _kickReturnAudio(false);
        return;
      }
      _kickReturnPlayback(false);
    }, 200));

    // --- shot 2: early fallback
    const _shot420 = trackWakeupRetryTimer(setTimeout(() => {
      untrackWakeupRetryTimer(_shot420);
      if (state.bbtabRetryTimer === _shot420) state.bbtabRetryTimer = null;
      if (state.tabReturnGen !== bbtGen) return;
      if (state.endedNaturally || MakeSureUnintentionalLoopDoesntEverHappenAtALLManager.shouldBlockAutoRestart()) return;
      if (!state.intendedPlaying && !state.firstPlayCommitted && wantsStartupAutoplay()) { state.intendedPlaying = true; state.bufferHoldIntendedPlaying = true; }
      if (!state.intendedPlaying || userPauseLockActive() || mediaSessionForcedPauseActive()) return;
      // Only clear stall flags if video has data — otherwise they're not stale,
      // video is genuinely buffering and clearing these would let audio leak through.
      const _shot420VNode = getVideoNode();
      const _shot420RS = _shot420VNode ? Number(_shot420VNode.readyState || 0) : 0;
      if (_shot420RS >= HAVE_FUTURE_DATA) {
        state.videoWaiting = false;
        state.videoStallAudioPaused = false;
        state.stallAudioPausedSince = 0;
        state.stallAudioResumeHoldUntil = 0;
        state.videoStallSince = 0;
      }
      clearAudioPauseLocks();
      if (_isHealthyReturnVideoPlayback()) {
        BringBackToTabManager.onVideoConfirmedPlaying();
        try { QuantumReturnOrchestrator.assessContinuity(); } catch {}
        _kickReturnAudio(false);
        try { if (coupledMode && audio && !state.tabReturnAudioMuted) audio.volume = targetVolFromVideo(); } catch {}
        setFastSync(600);
        scheduleSync(0);
        return;
      }
      _kickReturnPlayback(true);
      // If video is still paused after 400ms, just try play() again instead
      // of arming a 12-second buffer hold which freezes everything.
      const _bufferShot = trackWakeupRetryTimer(setTimeout(() => {
        untrackWakeupRetryTimer(_bufferShot);
        if (state.tabReturnGen !== bbtGen) return;
        if (!state.intendedPlaying) return;
        if (getVideoPaused()) {
          _kickReturnPlayback(true);
        }
      }, 240));
    }, 420));
    state.bbtabRetryTimer = _shot420;

    // Late safety shots: catches cases where browsers report "playing" early
    // but decoder/pipeline actually resumes much later after tab return.
    [800, 1300, 1900].forEach((delay, idx) => {
      const _lateShot = trackWakeupRetryTimer(setTimeout(() => {
        untrackWakeupRetryTimer(_lateShot);
        if (state.tabReturnGen !== bbtGen) return;
        if (state.endedNaturally || MakeSureUnintentionalLoopDoesntEverHappenAtALLManager.shouldBlockAutoRestart()) return;
        if (!state.intendedPlaying || userPauseLockActive() || mediaSessionForcedPauseActive()) return;
        if (_isHealthyReturnVideoPlayback()) {
          BringBackToTabManager.onVideoConfirmedPlaying();
          _kickReturnAudio(false);
          return;
        }
        _kickReturnPlayback(true);
        // Don't arm buffer hold on tab return — just keep calling play().
        // 12-second buffer holds cause the "frozen video for 2-3 seconds" bug.
      }, delay));
    });
  }

  // _doBringBackRetry is no longer used but kept as a no-op to avoid errors.
  function _doBringBackRetry() {}

  function executeSeamlessWakeup() {
    if (state.endedNaturally) return;
    if (MakeSureUnintentionalLoopDoesntEverHappenAtALLManager.shouldBlockAutoRestart()) return;
    if (!state.intendedPlaying && !state.resumeOnVisible &&
      !(wantsStartupAutoplay() && !state.firstPlayCommitted)) return;
    // During early NMPBFN recovery (<150ms), let it do its thing alone.
    // After that, fire wakeup too — NMPBFN only does play() calls but
    // wakeup does drift correction and seamlessBgCatchUp which are needed
    // for fast video resume. Without this, video sits frozen waiting for
    // SETTLING phase drift correction.
    // During NMPBFN recovery, let it handle everything. NMPBFN now waits for
    // video canplay before starting audio. Additional play/seek calls from
    // wakeup retry shots reset the decode pipeline and extend the freeze.
    if (NotMakePlayBackFixingNoticable.isRecovering() && state.firstPlayCommitted) return;
    // Cancel and replace any existing wakeup timer (don't silently drop)
    if (state.wakeupTimer) { clearTimeout(state.wakeupTimer); state.wakeupTimer = null; }

    const wakeDelay = 5; // near-instant — don't wait for browser paint cycle
    const myGen = state.tabReturnGen;

    state.wakeupTimer = setTimeout(() => {
      state.wakeupTimer = null;
      if (state.tabReturnGen !== myGen) return; // stale — user alt-tabbed again
      if (!state.intendedPlaying) return;
      if (userPauseLockActive() || mediaSessionForcedPauseActive()) return;

      // Reset BPMM oscillation state before catch-up. If a previous bg session
      // hit the oscillation lock, it would block seamlessBgCatchUp from retrying.
      BackgroundPlaybackManagerManager.onForegroundReturn();

      state.audioPausedSince = 0;
      if (coupledMode) {
        const vPaused = getVideoPaused();
        const aPaused = audio ? !!audio.paused : true;
        if (!vPaused && !aPaused) {
          // Both already playing (background playback succeeded) — just sync drift
          const vtNow = Number(video.currentTime());
          const atNow = Number(audio ? audio.currentTime : vtNow);
          if (isFinite(vtNow) && isFinite(atNow) && Math.abs(vtNow - atNow) < 2.0) {
            setFastSync(1000);
            scheduleSync(0);
            return;
          }
        }
        // One or both paused — perform full catch-up
        seamlessBgCatchUp().catch(() => {});
      } else {
        // Non-coupled: only resume if we were playing or in startup
        if (state.tabReturnImmuneUntil > now() && !state.firstPlayCommitted) MediumQualityManager.markUserPlayed();
        if (getVideoPaused() && state.intendedPlaying && !userPauseLockActive() &&
          !MediumQualityManager.intentPaused) {
          playTogether().catch(() => {});
          } else {
            scheduleSync(0);
          }
      }

      // Cancel any leftover retry timers from a previous wakeup cycle
      if (state._wakeupRetryTimers.length) {
        state._wakeupRetryTimers.forEach(t => clearTimeout(t));
        state._wakeupRetryTimers = [];
      }
      [80, 200, 500, 900].forEach(retryDelay => {
        const tid = setTimeout(() => {
          // Remove self from tracked list
          const idx = state._wakeupRetryTimers.indexOf(tid);
          if (idx !== -1) state._wakeupRetryTimers.splice(idx, 1);
          if (state.tabReturnGen !== myGen) return;
          if (!state.intendedPlaying || userPauseLockActive() || mediaSessionForcedPauseActive()) return;
          if (!getVideoPaused()) {
            if (coupledMode && audio && !state.tabReturnAudioMuted && audio.paused && !state.isProgrammaticAudioPause &&
              !shouldBlockNewAudioStart()) {
              const vtRetry = Number(video.currentTime()) || 0;
              safeSetAudioTime(vtRetry);
              execProgrammaticAudioPlay({ squelchMs: 200, force: true, minGapMs: 0 }).catch(() => {});
              softUnmuteAudio(200).catch(() => {});
            }
            return;
          }
          if (state.bgResumeInFlight || state.seekResumeInFlight) return;
          state.bgCatchUpCooldownUntil = 0;
          if (coupledMode) {
            seamlessBgCatchUp().catch(() => {});
          } else if (!userPauseLockActive()) {
            execProgrammaticVideoPlay();
            setFastSync(1000);
            scheduleSync(0);
          }
          // If video is still paused after trying to play (buffer empty from
          // network change), arm buffer recovery so it auto-plays once data arrives
          const tid2 = setTimeout(() => {
            if (state.tabReturnGen !== myGen) return;
            if (!state.intendedPlaying) return;
            if (getVideoPaused() && !state.strictBufferHold && !state.bgResumeInFlight) {
              armResumeAfterBuffer(12000);
            }
          }, 150);
          state._wakeupRetryTimers.push(tid2);
        }, retryDelay);
        state._wakeupRetryTimers.push(tid);
      });
    }, wakeDelay);
  }

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
        executeSeamlessWakeup();
      }, { passive: true, capture: true });
    } catch {}
    try {
      window.addEventListener("pageshow", e => {
        if (!platform.useBgControllerRetry) return;
        // BFCache restore or normal page show
        if (e && e.persisted) {
          // Back-forward cache restoration — treat as wakeup
          state.lastBgReturnAt = now();
          state.lastVisibleReturnHandledAt = state.lastBgReturnAt;
          VisibilityGuard.onTabShow(); // VG: BFCache restore = tab return
          if (platform.chromiumOnlyBrowser) {
            setChromiumBgPauseBlock(CHROMIUM_BG_PAUSE_BLOCK_MS);
            setChromiumPauseEventSuppress(BG_RETURN_GRACE_MS);
          }
          executeSeamlessWakeup();
        }
        if (state.startupPhase && !state.startupPrimed) {
          maybePrimeStartup();
          scheduleStartupAutoplayKick();
        }
      }, { passive: true, capture: true });
      // iOS pagehide — save state before the page may be frozen
      window.addEventListener("pagehide", e => {
        if (state.intendedPlaying) {
          updateLastKnownGoodVT();
          if (platform.useBgControllerRetry) {
            noteBackgroundEntry();
            state.resumeOnVisible = true;
          }
        }
      }, { passive: true, capture: true });
    } catch {}
    window.addEventListener("visibilitychange", () => {
      const newState = document.visibilityState;
      state.previousVisibilityState = state.lastVisibilityState;
      state.lastVisibilityState = newState;
      state.visibilityTransitionActive = true;
      state.visibilityTransitionUntil = now() + VISIBILITY_TRANSITION_MS;
      state.visibilityStableUntil = now() + VISIBILITY_TRANSITION_MS;
      state.tabVisibilityChangeUntil = now() + TAB_VISIBILITY_STABLE_MS;
      if (newState === "visible") {
        // Don't stop keepalive immediately — keep it running during immunity
        // so it catches any late browser pauses. Stop after immunity expires.
        setTimeout(() => {
          if (!isTabReturnImmune()) stopBgAudioKeepalive();
        }, 3500);
          // Only clear stall flags if video has data. In background, readyState
          // is stale, but on tab return the browser updates it quickly. If video
          // genuinely doesn't have data, these flags are NOT stale — keeping them
          // prevents audio from starting while video buffers.
          const _vcVNode = getVideoNode();
          const _vcRS = _vcVNode ? Number(_vcVNode.readyState || 0) : 0;
          if (_vcRS >= HAVE_FUTURE_DATA) {
            state.videoWaiting = false;
            state.videoStallAudioPaused = false;
            state.stallAudioPausedSince = 0;
            state.stallAudioResumeHoldUntil = 0;
            state.videoStallSince = 0;
            // Also clear foreground buffer hold and programmatic audio pause
            // flags — these can be stale from a pre-hide stall and block audio
            // recovery on tab return even though video now has data.
            clearForegroundBufferAudioHold();
            state.isProgrammaticAudioPause = false;
            state.audioEventsSquelchedUntil = 0;
          }

          // Let the consolidated tab-return manager perform the resume kick.
          // Duplicating native play() calls here and in focus/onTabReturn caused
          // visible play->pause->play on first alt-tab in some browsers.
          DONTMAKEITDOUBLEPLAY.resetAll();

          // Let the tab-return manager handle immunity, intercept, rapid counter
          // resets, alt-tab flag clearing, instant play, and bbtab/wakeup retry.
          SmoothTabWelcomeBackManagement.onTabReturn();
          try {
            MakeVideoNotFreezeAfterPlaybackAfterAltTabHapenns.onTabReturn();
            MakeVideoNotFreezeAfterPlaybackAfterAltTabHapenns.reset();
            MakeVideoNotFreezeAfterPlaybackAfterAltTabHapenns.start();
          } catch {}
          // Arm VCFM on EVERY tab return. The compositor may be showing a
          // stale GPU texture regardless of readyState or playing state.
          // VCFM uses requestVideoFrameCallback to verify a real frame
          // reached the screen and force-flushes if not.
          try { VideoCompositorFlushManager.arm(); } catch {}

          // Don't call QuantumReturnOrchestrator.preemptivePlay() here —
          // it seeks audio and calls play(), competing with onTabReturn's
          // instantPlay(). Multiple seeks cause audio glitches.
          VisibilityGuard.onTabShow();

          state.lastBgReturnAt = now();
          state.lastVisibleReturnHandledAt = state.lastBgReturnAt;
          if (!state.intendedPlaying || getVideoPaused()) {
            armForegroundReturnUserPlay(45000);
          } else {
            clearForegroundReturnUserPlay();
          }
          // reset previous visibility so subsequent focus events (within the
          // same visible session) don't mistake themselves for tab switches
          setTimeout(() => { state.previousVisibilityState = "visible"; }, 200);
          BackgroundPlaybackManager.onBecomeForeground();
          BackgroundPlaybackManagerManager.onForegroundReturn(); // reset oscillation counters
          try { UltraStabilizer.onVisibilityChange(true); } catch {}

          if (!hiddenPlayPendingActive() && !foregroundResumeBoostActive()) {
            clearHiddenMediaSessionPlay();
          }
          state.bgAutoResumeSuppressed = false;
          state.startupAudioHoldUntil = 0;
          state.bgTransitionInProgress = false;
          state.bgPauseSuppressionCount = 0;
          state.bgPauseSuppressionResetAt = now();
          state.pauseEventCount = 0;
          state.pauseEventResetAt = now();
          state.mediaErrorCount = 0;

          if (platform.chromiumOnlyBrowser) {
            state.chromiumBgSettlingUntil = Math.max(state.chromiumBgSettlingUntil, now() + 400);
            state.chromiumAudioStartLockUntil = 0; // Don't block audio on tab return
            state.mediaSessionPauseBlockedUntil = Math.max(state.mediaSessionPauseBlockedUntil, now() + 800);
            setChromiumPauseEventSuppress(800);
            setChromiumBgPauseBlock(800);
            setChromiumAutoPauseBlock(800);
          }

          // Also reset focusStableUntil — on tab return, focus is immediately stable.
          state.focusStableUntil = 0;

          state.startupAutoplayRetryCount = 0;
          state.bgAudioStartQueued = false;

          // Force startup zero only if playback hasn't already gone live.
          // If both tracks are already running, committing startup avoids
          // phantom "jump to 0" and replay-on-return.
          const _retVN = getVideoNode();
          const _retVideoPlaying = !!(_retVN && !_retVN.paused);
          const _retAudioPlaying = !coupledMode || !!(audio && !audio.paused);
          if (!state.firstPlayCommitted && _retVideoPlaying && _retAudioPlaying) {
            commitStartupFromActivePlayback();
          } else if (!state.firstPlayCommitted && wantsStartupAutoplay()) {
            forceZeroBeforeFirstPlay();
          }

          if (state.intendedPlaying) {
            // If both tracks are already playing, clear flags and skip all kicks.
            // This prevents the play-pause-play spam on quick tab switches where
            // Chromium didn't actually pause the media.
            const _vcVPlaying = !getVideoPaused();
            const _vcAPlaying = !coupledMode || (audio && !audio.paused);
            state.resumeOnVisible = false;
            state.bgHiddenWasPlaying = false;

            if (_vcVPlaying && _vcAPlaying) {
              // Already playing — just schedule a gentle sync for drift correction
              setFastSync(600);
              scheduleSync(200);
            } else {
              // onTabReturn() already called instantPlay() with a single play()
              // on both video and audio. Don't add more competing resume logic —
              // multiple play()/seek/volume calls racing cause audio glitches.
              setFastSync(600);
              scheduleSync(100);
            }
          }
          // Startup retry on tab-return: kick the startup kick regardless.
          if (wantsStartupAutoplay()) {
            state.startupAutoplayRetryCount = 0;
            if (!state.startupKickDone && !state.firstPlayCommitted) {
              state.startupKickInFlight = false; // clear stale flag from bg attempt
              scheduleStartupAutoplayKick();
            }
          }
          setTimeout(() => { state.visibilityTransitionActive = false; }, VISIBILITY_TRANSITION_MS);
      } else {
        clearForegroundReturnUserPlay();
        // Cancel any in-flight wakeup retry timers from previous tab return
        if (state._wakeupRetryTimers.length) {
          state._wakeupRetryTimers.forEach(t => clearTimeout(t));
          state._wakeupRetryTimers = [];
        }
        // Let tab-return manager clean up: bumps gen, clears immunity,
        // disengages intercept, cancels audio mute, clears timers, snapshots QRO.
        SmoothTabWelcomeBackManagement.onTabLeave();
        NotMakePlayBackFixingNoticable.onGoBackground();
        try { VideoCompositorFlushManager.disarm(); } catch {} // no point checking frames while hidden
        updateLastKnownGoodVT();
        VisibilityGuard.onTabHide();
        state._syncTabReturnKickDone = false; // reset so next tab return gets one micro-seek
        // Snapshot playback position so we can hard-resync on return
        try { MakeVideoNotFreezeAfterPlaybackAfterAltTabHapenns.onTabHide(); } catch {}
        BackgroundPlaybackManager.onBecomeBackground();
        if (state.intendedPlaying) {
          startBgAudioKeepalive();
          // Engage pause intercept BEFORE the browser fires its auto-pause.
          // On tab switch, visibilitychange→hidden fires first, then Chromium
          // queues auto-pause 50-200ms later. Intercepting here blocks that
          // pause completely so the user never sees play→pause→play on return.
          engagePauseIntercept();
          // Immunity so the capture-phase guard catches the browser's auto-pause
          // that fires right after visibilitychange→hidden, AND keeps catching
          // pauses for quick alt-tab round-trips (user returns within 3s).
          // Without this, there's a silence gap before keepalive or onTabReturn
          // can restart playback.
          state.tabReturnImmuneUntil = now() + 2000;
        }

        // Tab-switch protection: visibilitychange→hidden fires WITHOUT a preceding
        // blur event on tab switches (unlike alt-tab). Set the same transition
        // flags that the blur handler sets, so when the tab returns the pause
        // handler knows we're in a tab-switch transition and can suppress
        // spurious browser pauses.
        if (state.intendedPlaying) {
          state.altTabTransitionActive = true;
          state.altTabTransitionUntil = now() + ALT_TAB_TRANSITION_MS;
          state.focusStableUntil = now() + ALT_TAB_TRANSITION_MS;
          if (platform.chromiumOnlyBrowser) {
            setChromiumAutoPauseBlock(ALT_TAB_TRANSITION_MS + 2000);
            setChromiumBgPauseBlock(CHROMIUM_BG_PAUSE_BLOCK_MS);
            setChromiumPauseEventSuppress(ALT_TAB_TRANSITION_MS);
          }
        }

        state.bgTransitionInProgress = true;
        if (platform.useBgControllerRetry) {
          noteBackgroundEntry();
          state.bgAutoResumeSuppressed = true;
          if (state.intendedPlaying) state.resumeOnVisible = true;
        } else {
          state.bgAutoResumeSuppressed = false;
          if (coupledMode && state.intendedPlaying) {
            noteBackgroundEntry();
            state.resumeOnVisible = true;
            state.bgHiddenWasPlaying = true;
          } else {
            state.resumeOnVisible = false;
            state.bgHiddenWasPlaying = false;
          }
        }
        // If the startup kick was in-flight when we hid, release the lock so a
        if (!state.firstPlayCommitted && state.startupKickInFlight) {
          state.startupKickInFlight = false;
        }
      }
    }, { passive: true, capture: true });
    window.addEventListener("blur", () => {
      // Do NOT call SmoothTabWelcomeBackManagement.onTabLeave() on blur.
      // Blur fires for many non-tab-switch reasons (status panel, devtools,
      // address bar, alt-tab). Calling onTabLeave() here disengages the
      // pause intercept, allowing the browser to pause media during alt-tab.
      // onTabLeave() is called from visibilitychange→hidden instead (actual
      // tab switches). The smart check in onTabReturn() handles spurious
      // blur/focus cycles (returns early if media is still playing).

      if (document.visibilityState === "hidden") {
        VisibilityGuard.onTabHide();
        BackgroundPlaybackManager.onBecomeBackground();
      }
      // Start keepalive on blur too — alt-tab fires blur without always
      // changing visibilityState to "hidden" (e.g., overlay windows).
      NotMakePlayBackFixingNoticable.onGoBackground();
      if (state.intendedPlaying) {
        startBgAudioKeepalive();
        // Immunity so capture guard catches browser's auto-pause on blur/alt-tab
        state.tabReturnImmuneUntil = Math.max(state.tabReturnImmuneUntil, now() + 2000);
        // PROACTIVELY engage pause intercept on blur. Chromium fires
        // auto-pause 50-200ms after blur — if we only engage the intercept
        // on tab RETURN (focus/visibilitychange→visible), the browser's
        // pause already went through and the user sees a visible
        // play→pause→play cycle on every alt-tab. Engaging it HERE blocks
        // the pause BEFORE it happens. The intercept auto-disengages after
        // 2s, and disengagePauseIntercept is called from onTabLeave on
        // real tab switches. For alt-tab, the focus handler's onTabReturn
        // will re-engage/extend as needed.
        engagePauseIntercept();
      }
      if (!platform.chromiumOnlyBrowser) return;
      state.lastFocusLoss = now();
      state.focusLossCount++;
      if ((now() - state.focusLossResetAt) > FOCUS_LOSS_RESET_MS) {
        state.focusLossCount = 1;
        state.focusLossResetAt = now() + FOCUS_LOSS_RESET_MS;
      }
      if (state.focusLossCount >= 1 && state.intendedPlaying) {
        state.altTabTransitionActive = true;
        state.altTabTransitionUntil = now() + ALT_TAB_TRANSITION_MS;
        state.focusStableUntil = now() + ALT_TAB_TRANSITION_MS;
        setChromiumAutoPauseBlock(ALT_TAB_TRANSITION_MS + 2000);
        setChromiumBgPauseBlock(CHROMIUM_BG_PAUSE_BLOCK_MS);
        setChromiumPauseEventSuppress(ALT_TAB_TRANSITION_MS);
      }
    }, { passive: true, capture: true });
    window.addEventListener("focus", () => {
      const _focusTs = now();
      const _isVisible = document.visibilityState === "visible";
      // Clear stale stall flags -- but only if video actually has data.
      // If video is genuinely starved, keep the flags so audio stays paused.
      const _focusVNode = getVideoNode();
      const _focusVRS = _focusVNode ? Number(_focusVNode.readyState || 0) : 4;
      if (_focusVRS >= HAVE_FUTURE_DATA) {
        state.videoStallAudioPaused = false;
        state.stallAudioPausedSince = 0;
        state.stallAudioResumeHoldUntil = 0;
        state.videoWaiting = false;
        state.videoStallSince = 0;
        clearForegroundBufferAudioHold();
        state.isProgrammaticAudioPause = false;
        state.audioEventsSquelchedUntil = 0;
      }

      if (!_isVisible) {
        if (state.intendedPlaying) state.resumeOnVisible = true;
        return;
      }

      const _recentVisibilityReturn = (_focusTs - (state.lastVisibleReturnHandledAt || 0)) < 1600;
      // Let tab-return manager handle immunity, intercept, rapid counter resets,
      // alt-tab flag clearing, instant play, and bbtab/wakeup retry.
      if (!_recentVisibilityReturn) {
        VisibilityGuard.onTabShow();
        BackgroundPlaybackManager.onBecomeForeground();
        BackgroundPlaybackManagerManager.onForegroundReturn();
        const _focusPlaybackHealthy =
          state.intendedPlaying &&
          !getVideoPaused() &&
          (!coupledMode || (audio && !audio.paused));
        if (_focusPlaybackHealthy) {
          try { VideoCompositorFlushManager.arm(); } catch {}
        } else {
          SmoothTabWelcomeBackManagement.onTabReturn();
        }
      }

      state.lastBgReturnAt = Math.max(state.lastBgReturnAt, _focusTs);
      if (!state.intendedPlaying || getVideoPaused()) {
        armForegroundReturnUserPlay(45000);
      } else {
        clearForegroundReturnUserPlay();
      }
      state.focusStableUntil = _focusTs + 300;
      state.pauseEventCount = 0;
      state.pauseEventResetAt = _focusTs;

      if (!_recentVisibilityReturn && platform.chromiumOnlyBrowser) {
        setChromiumPauseEventSuppress(BG_RETURN_GRACE_MS);
        setChromiumAutoPauseBlock(BG_RETURN_GRACE_MS);
        setChromiumBgPauseBlock(CHROMIUM_BG_PAUSE_BLOCK_MS);
      }
    }, { passive: true, capture: true });
    window.addEventListener("beforeunload", () => {
      stopBgAudioKeepalive();
      clearBgResumeRetryTimer();
      clearResumeAfterBufferTimer();
      clearSeekSyncFinalizeTimer();
      clearSeekWatchdog();
      clearStartupAutoplayRetryTimer();
      clearAudioForcePlayTimer();
      clearTimeout(state.wakeupTimer);
      clearTimeout(state.heartbeatTimer);
      clearTimeout(state.bgSilentTimeSyncTimer);
      if (state._stallAudioPauseTimer) { clearTimeout(state._stallAudioPauseTimer); state._stallAudioPauseTimer = null; }
      if (_playLockRafId) { cancelAnimationFrame(_playLockRafId); _playLockRafId = null; }
      if (_playLockTimer) { clearTimeout(_playLockTimer); _playLockTimer = null; }
      if (_ncBufferWaitCleanup) { try { _ncBufferWaitCleanup(); } catch {} _ncBufferWaitCleanup = null; }
      if (state._seekPostTimers.length) { state._seekPostTimers.forEach(t => clearTimeout(t)); state._seekPostTimers = []; }
      if (state._wakeupRetryTimers.length) { state._wakeupRetryTimers.forEach(t => clearTimeout(t)); state._wakeupRetryTimers = []; }
      if (state.bbtabRetryRafId) { cancelAnimationFrame(state.bbtabRetryRafId); state.bbtabRetryRafId = null; }
      if (state.bbtabRetryTimer) { clearTimeout(state.bbtabRetryTimer); state.bbtabRetryTimer = null; }
      if (state.bbtabAudioSyncTimer) { clearTimeout(state.bbtabAudioSyncTimer); state.bbtabAudioSyncTimer = null; }
      clearSyncLoop();
    });
  }

  function forceAudioStartupPlay() {
    if (!coupledMode || !audio) return;
    // bail if audio is already playing — no need to force-start it again
    if (!audio.paused) { state.audioEverStarted = true; return; }
    if (state.audioStartupPlayAttempted && state.audioEverStarted) return;
    if (!state.intendedPlaying && !wantsStartupAutoplay()) return;
    if (state.startupPrimed && state.firstPlayCommitted && state.audioEverStarted) return;
    state.audioStartupPlayAttempted = true;
    const tryPlay = () => {
      if (state.audioStartupPlayRetries >= MAX_AUDIO_STARTUP_RETRIES) return;
      if (!audio || (!state.intendedPlaying && !wantsStartupAutoplay())) return;
      if (state.firstPlayCommitted && state.audioEverStarted) return;
      if (!audio.paused) {
        state.audioEverStarted = true;
        return;
      }
      // In background, don't fight Chrome's throttle — it'll just pause us again and
      // we end up in a play→pause→play→pause loop that's audible as stuttering.
      // Instead, flag for resume when the user actually comes to the tab.
      if (document.visibilityState === "hidden") {
        state.resumeOnVisible = true;
        state.audioStartupPlayRetries++;
        // Retry slowly in bg — just in case Chrome allows it (some versions do)
        state.audioForcePlayTimer = setTimeout(tryPlay, 2000);
        return;
      }
      if (state.startupKickInFlight) {
        state.audioStartupPlayRetries++;
        state.audioForcePlayTimer = setTimeout(tryPlay, AUDIO_STARTUP_PLAY_RETRY_MS * 2);
        return;
      }
      const vrs = getVideoReadyState();
      if (vrs < 2 || state.videoWaiting) {
        state.audioStartupPlayRetries++;
        state.audioForcePlayTimer = setTimeout(tryPlay, AUDIO_STARTUP_PLAY_RETRY_MS);
        return;
      }
      try {
        state.intendedPlaying = true;
        state.bufferHoldIntendedPlaying = true;
        squelchAudioEvents(400);
        // play at target volume immediately — no vol=0 fade dance
        const _startVol = targetVolFromVideo();
        try { audio.volume = _startVol; } catch {}
        state.audioStartGraceUntil = Math.max(state.audioStartGraceUntil, now() + 600);
        const p = audio.play();
        if (p && p.then) {
          p.then(() => {
            state.audioEverStarted = true;
            state.audioStartupPlayRetries = 0;
            try { audio.volume = _startVol; } catch {}
          }).catch(() => {
            state.audioStartupPlayRetries++;
            state.audioForcePlayTimer = setTimeout(tryPlay, AUDIO_STARTUP_PLAY_RETRY_MS);
          });
        }
      } catch {
        state.audioStartupPlayRetries++;
        state.audioForcePlayTimer = setTimeout(tryPlay, AUDIO_STARTUP_PLAY_RETRY_MS);
      }
    };
    state.audioForcePlayTimer = setTimeout(tryPlay, 150);
  }

  function bootstrapStartupAudioNow() {
    if (!coupledMode || !audio) return;
    if (state.restarting || state.seeking || state.seekBuffering) return;
    if (mediaSessionForcedPauseActive() || userPauseLockActive()) return;

    const vNode = getVideoNode();
    const videoPlaying = !!(vNode && !vNode.paused);
    const audioPlaying = !audio.paused;
    const wantsStartupNow =
      wantsStartupAutoplay() ||
      state.intendedPlaying ||
      videoPlaying ||
      audioPlaying;
    if (!wantsStartupNow) return;

    const vrs = vNode ? Number(vNode.readyState || 0) : 0;
    const ars = Number(audio.readyState || 0);
    const vt = (() => { try { return Number(video.currentTime()) || 0; } catch { return 0; } })();

    if (!state.intendedPlaying && (wantsStartupAutoplay() || videoPlaying || audioPlaying)) {
      state.intendedPlaying = true;
      state.bufferHoldIntendedPlaying = true;
    }

    if (!state.startupPrimed && (videoPlaying || vrs >= HAVE_CURRENT_DATA || ars >= HAVE_METADATA || vt > 0)) {
      maybePrimeStartup();
    }

    if (videoPlaying && audio.paused && !state.videoWaiting && !state.videoStallAudioPaused) {
      clearAudioPauseLocks();
      if (isFinite(vt)) safeSetAudioTime(vt);
      try { audio.volume = targetVolFromVideo(); } catch {}
      state.audioStartGraceUntil = Math.max(state.audioStartGraceUntil, now() + 500);
      execProgrammaticAudioPlay({ squelchMs: 250, force: true, minGapMs: 0 }).catch(() => {});
      forceAudioStartupPlay();
    } else if (!audioPlaying && (state.startupPrimed || videoPlaying || vrs >= HAVE_CURRENT_DATA || ars >= HAVE_METADATA)) {
      forceAudioStartupPlay();
    }

    if (state.startupPrimed && !state.firstPlayCommitted && !state.startupKickDone && !state.startupKickInFlight) {
      scheduleStartupAutoplayKick();
    }
  }

  function clearAudioForcePlayTimer() {
    if (state.audioForcePlayTimer) {
      clearTimeout(state.audioForcePlayTimer);
      state.audioForcePlayTimer = null;
    }
  }

  // Force video to zero at startup before any play to prevent mid-video start
  if (wantsStartupAutoplay() && !state.firstPlayCommitted && !startupZeroSuppressed()) {
    try {
      videoEl.currentTime = 0;
      if (audio) audio.currentTime = 0;
    } catch {}

    // Continuously enforce t=0 while loading in background — browsers can buffer/seek
    // to non-zero keyframes before we start playing. Remove once first play committed.
    let _enforceZeroDisabled = false;
    const enforceStartAtZero = () => {
      if (_enforceZeroDisabled) return;
      if (startupZeroSuppressed()) {
        _enforceZeroDisabled = true;
        try { videoEl.removeEventListener("timeupdate", enforceStartAtZero); } catch {}
        return;
      }
      // Only disable AFTER firstPlayCommitted AND video is near 0 (success).
      // Don't disable just because intendedPlaying is true — the play hasn't
      // happened yet, the browser can still move currentTime to a keyframe.
      if (state.firstPlayCommitted && state.audioEverStarted) {
        _enforceZeroDisabled = true;
        try { videoEl.removeEventListener("timeupdate", enforceStartAtZero); } catch {}
        return;
      }
      const vt = Number(videoEl.currentTime) || 0;
      if (vt > 0.5 && !state.firstPlayCommitted) {
        state._isMicroSeek = true;
        try { video.currentTime(0); } catch {}
        try { videoEl.currentTime = 0; } catch {}
        if (audio) try { audio.currentTime = 0; } catch {}
        setTimeout(() => { state._isMicroSeek = false; }, 200);
      }
    };
    try { videoEl.addEventListener("timeupdate", enforceStartAtZero, { passive: true }); } catch {}
    // Disable after 12s regardless — don't run forever
    setTimeout(() => {
      _enforceZeroDisabled = true;
      try { videoEl.removeEventListener("timeupdate", enforceStartAtZero); } catch {}
    }, 12000);
    // Also clean up if user manually seeks before playing
    try {
      videoEl.addEventListener("seeking", () => {
        const vtNow = Number(videoEl.currentTime) || 0;
        const likelyUserSeek =
          state.pendingSeekTarget != null ||
          (now() - state.lastUserActionTime) < 3000 ||
          vtNow > 0.5;
        if (state.firstPlayCommitted || likelyUserSeek || startupZeroSuppressed()) {
          _enforceZeroDisabled = true;
          try { videoEl.removeEventListener("timeupdate", enforceStartAtZero); } catch {}
        }
      }, { passive: true });
    } catch {}
  }

  setupUserPauseIntentDetection();
  // Load saved volume BEFORE binding events — prevents autoplay at default volume
  loadSavedVolume();
  // Sync audio element volume to match video immediately
  if (coupledMode && audio) {
    try {
      const _initTarget = targetVolFromVideo();
      audio.volume = clamp01(_initTarget);
      if (state.userMutedAudio) audio.muted = true;
    } catch {}
  }
  setupMediaSession();
  bindCommonMediaEvents();
  setupVisibilityLifecycle();
  setupMediaErrorHandlers();
  setupHeartbeat();
  startBufferMonitor();

  if (coupledMode) {
    try {
      audio.preload = "auto";
      const audioLoadAlreadyStarted =
        (Number(audio.readyState || 0) > 0) ||
        (Number(audio.networkState || 0) !== 0) ||
        !!audio.currentSrc;
      if (!audioLoadAlreadyStarted) audio.load();
    } catch {}
    const maybeStart = () => maybePrimeStartup();
    const bindStartupOnce = (el, type, extraCb = null) => {
      const fn = () => {
        if (state.startupPrimed) {
          if (typeof extraCb === "function") {
            try { extraCb(); } catch {}
          }
          try { el.removeEventListener(type, fn); } catch {}
          return;
        }
        maybeStart();
        if (typeof extraCb === "function") {
          try { extraCb(); } catch {}
        }
        if (state.startupPrimed) {
          try { el.removeEventListener(type, fn); } catch {}
        } else if (typeof extraCb === "function") {
          try { el.removeEventListener(type, fn); } catch {}
        }
      };
      try { el.addEventListener(type, fn, { passive: true }); } catch {}
    };
    bindStartupOnce(audio, "loadeddata");
    bindStartupOnce(audio, "loadedmetadata");
    bindStartupOnce(audio, "canplay");
    bindStartupOnce(audio, "playing", () => {
      clearAudioForcePlayTimer();
      state.audioStartupPlayRetries = 0;
    });
    bindStartupOnce(videoEl, "loadeddata");
    bindStartupOnce(videoEl, "loadedmetadata");
    bindStartupOnce(videoEl, "canplay");
    [0, 50, 150, 400].forEach(delay => {
      setTimeout(() => {
        if (!coupledMode || !audio) return;
        if (state.firstPlayCommitted && state.audioEverStarted && !audio.paused) return;
        bootstrapStartupAudioNow();
      }, delay);
    });
  }
  video.on("volumechange", () => {
    // during programmatic operations (seeking, stall recovery, startup), don't
    // snap audio volume — it causes pops. the operation will set volume itself.
    if (state.seeking || state.seekBuffering || state.restarting ||
        state.videoStallAudioPaused || NotMakePlayBackFixingNoticable.isActive()) {
      return;
    }
    // During tab return grace, don't snap volume — let NMPBFN handle it
    if (isTabReturnImmune() && state.firstPlayCommitted) return;
    if (state.audioFading) cancelActiveFade();
    updateAudioGainImmediate(true);
    // Only track user-initiated mute: recent user action + no programmatic flags
    const _isUserAction = (now() - state.lastUserActionTime) < 1000;
    const _isProgrammatic = state.isProgrammaticVideoPause || state.isProgrammaticVideoPlay ||
    state.isProgrammaticAudioPause || state.seeking || state.seekBuffering ||
    state.restarting || state.startupPhase || !state.firstPlayCommitted;
    if (_isUserAction && !_isProgrammatic) {
      state.userMutedVideo = !!video.muted();
    }
    saveVolume();
  });
  if (coupledMode) {
    try {
      audio.addEventListener("volumechange", () => {
        // Only track user-initiated mute: recent user action + no programmatic flags
        const _isUser = (now() - state.lastUserActionTime) < 1000;
        const _isProg = state.isProgrammaticAudioPause || state.audioFading ||
        state.videoStallAudioPaused || state.seeking || state.seekBuffering ||
        state.restarting || state.startupPhase || !state.firstPlayCommitted ||
        state.isProgrammaticVideoPause;
        if (_isUser && !_isProg) {
          state.userMutedAudio = !!audio.muted;
        }
        saveVolume();
      }, { passive: true });
    } catch {}
  }

  // --- runtime SD/muxed detection
  if (coupledMode && audio) {
    let audioAlive = false;
    const markAudioAlive = () => { audioAlive = true; };
    // Any of these events means audio has real data
    try { audio.addEventListener("loadeddata", markAudioAlive, { once: true, passive: true }); } catch {}
    try { audio.addEventListener("canplay", markAudioAlive, { once: true, passive: true }); } catch {}
    try { audio.addEventListener("playing", markAudioAlive, { once: true, passive: true }); } catch {}
    try { audio.addEventListener("timeupdate", markAudioAlive, { once: true, passive: true }); } catch {}

    const switchToNonCoupled = (reason) => {
      if (!coupledMode) return; // already switched
      coupledMode = false;
      // Silence and disable the dead audio element
      try { audio.muted = true; audio.volume = 0; } catch {}
      try { audio.preload = "none"; } catch {}
      try { if (!audio.paused) audio.pause(); } catch {}
      // Enable MQM (it checks !coupledMode internally via enabled flag, but since
      // coupledMode was true at construction, we need to re-enable the startup path)
      state.startupPrimed = true;
      // If video was stuck waiting for audio, unblock it
      clearAudioPauseLocks();
      clearBufferHold();
      // If intendedPlaying, kick video to start
      if (state.intendedPlaying || wantsStartupAutoplay()) {
        state.intendedPlaying = true;
        state.bufferHoldIntendedPlaying = true;
        if (!state.firstPlayCommitted) {
          state.firstPlayCommitted = true;
          state.startupKickDone = true;
          state.startupPhase = false;
        }
        execProgrammaticVideoPlay();
      }
      scheduleSync(0);
    };

    // Audio error → immediate switch
    const onAudioError = () => {
      if (audioAlive) return; // had data before error, don't switch
      switchToNonCoupled("audio-error");
    };
    try { audio.addEventListener("error", onAudioError, { once: true, passive: true }); } catch {}
    try {
      const srcEl = audio.querySelector?.("source");
      if (srcEl) srcEl.addEventListener("error", onAudioError, { once: true, passive: true });
    } catch {}

    // Timeout: if audio never produces data within 8s, switch
    setTimeout(() => {
      if (!audioAlive && coupledMode) {
        // Check one more time: maybe it loaded but we missed the event
        try {
          const rs = Number(audio.readyState || 0);
          const dur = Number(audio.duration || 0);
          if (rs >= 2 || (isFinite(dur) && dur > 0)) { audioAlive = true; return; }
        } catch {}
        switchToNonCoupled("audio-timeout");
      }
    }, 8000);

    // Also check at 3s for faster detection of obviously dead audio
    setTimeout(() => {
      if (!audioAlive && coupledMode) {
        try {
          const ns = audio.networkState;
          const rs = Number(audio.readyState || 0);
          // networkState 3 = NETWORK_NO_SOURCE, or readyState stuck at 0
          if (ns === 3 || (rs === 0 && audio.error)) {
            switchToNonCoupled("audio-dead-early");
          }
        } catch {}
      }
    }, 3000);
  }

  state.bgPlaybackAllowed = true;
  state.backgroundAutoplayTriggered = true;
  setTimeout(() => {
    if (commitStartupFromActivePlayback()) {
      scheduleSync(0);
      return;
    }
    if (coupledMode && state.startupPhase && !state.startupPrimed) {
      maybePrimeStartup();
      scheduleStartupAutoplayKick();
      forceAudioStartupPlay();
    }
  }, 100);
  // Always schedule initial sync — don't gate on page load.
  scheduleSync(0);

  // test helpers — survive minification
  window.__test_player_error = (source, code) => {
    handleFatalMediaError(source || "video", { code: code || 4 });
  };
  window.__test_player_error_both = (code) => {
    handleFatalMediaError("video", { code: code || 4 });
    handleFatalMediaError("audio", { code: code || 4 });
  };
  window.__test_player_reset_error = () => {
    _errorOverlayShown = false;
    _videoErrorObj = null;
    _audioErrorObj = null;
    PlayerErrorOverlay.hide();
  };
  window.__test_ended_lock = () => {
    // Simulate the anti-loop manager state for testing
    return { endedNaturally: state.endedNaturally, endedAt: state.endedAt, endedLockUntil: state.endedLockUntil };
  };
  window.__test_clear_ended = () => {
    MakeSureUnintentionalLoopDoesntEverHappenAtALLManager.onUserPlay();
  };

  // =========================================================================
  // global error catcher — catches uncaught JS errors from the player code
  // and shows the "you found a bug!" overlay with a report link.
  // only triggers once to avoid spam. ignores errors from other scripts.
  // =========================================================================
  let _globalErrorCaught = false;
  const _reportBase = "https://codeberg.org/ashleyirispuppy/poke/issues/new?template=issue_template%2fplayer-bug.yml";

  function _handlePlayerCrash(errorMsg, source, stack) {
    if (_globalErrorCaught || _errorOverlayShown) return;
    _globalErrorCaught = true;
    _errorOverlayShown = true;

    // Kill all playback — error overlay blocks all play paths anyway
    state.intendedPlaying = false;
    state.bufferHoldIntendedPlaying = false;
    state.resumeOnVisible = false;
    try { pauseHard(); } catch {}

    // build full stack trace
    const _crashSplashMessages = [
      "The bits conspired against you.",
      "This is fine. Everything is fine.",
      "The audio was simply too powerful.",
      "Works on my machine ¯\\_(ツ)_/¯",
      "Achievement unlocked: Break the player!",
      "The video element chose violence today.",
      "Skill issue (from the browser).",
      "Certified bruh moment.",
      "The sync loop did a little too much looping.",
      "This is why we can't have nice things.",
      "No thoughts, just errors.",
      "We do a little crashing.",
      "The electrons got confused.",
      "Error: success was not an option."
    ];
    const _crashSplash = _crashSplashMessages[Math.floor(Math.random() * _crashSplashMessages.length)];
    let _trace = "";
    try {
      const parts = [];
      parts.push("// " + _crashSplash);
      parts.push("");
      parts.push("Error: " + String(errorMsg || "Unknown error"));
      parts.push("Source: " + String(source || "unknown"));
      parts.push("Time: " + new Date().toISOString());
      parts.push("User agent: " + navigator.userAgent);
      if (stack) {
        parts.push("\n--- Stack Trace ---");
        parts.push(String(stack));
      }
      parts.push("\n--- Player State ---");
      parts.push("firstPlayCommitted: " + state.firstPlayCommitted);
      parts.push("intendedPlaying: " + state.intendedPlaying);
      parts.push("startupPhase: " + state.startupPhase);
      parts.push("coupledMode: " + coupledMode);
      parts.push("seeking: " + state.seeking);
      parts.push("videoWaiting: " + state.videoWaiting);
      try { parts.push("video.readyState: " + getVideoNode().readyState); } catch {}
      try { parts.push("audio.readyState: " + (audio ? audio.readyState : "N/A")); } catch {}
      try { parts.push("video.currentTime: " + video.currentTime()); } catch {}
      try { parts.push("audio.currentTime: " + (audio ? audio.currentTime : "N/A")); } catch {}
      _trace = parts.join("\n");
    } catch { _trace = String(errorMsg || "Unknown error") + "\n" + String(stack || ""); }

    PlayerErrorOverlay.show({
      title: "You found a bug! (ಥ﹏ಥ)",
      message: "The player just crashed into a wall it didn't see coming. Reload to get back on track, or report it so we can move the wall.",
      code: "PLAYER_ERR_UNCAUGHT",
      canRetry: true,
      reportUrl: _reportBase,
      stackTrace: _trace
    });
  }

  window.addEventListener("error", (e) => {
    if (_globalErrorCaught) return;
    // only catch errors from the player script (this file) or inline scripts.
    // ignore errors from unrelated third-party scripts.
    const src = e && e.filename ? String(e.filename) : "";
    const msg = e && e.message ? String(e.message) : "";
    // match player script by filename pattern or if it's an inline script (empty filename)
    const isPlayerScript = !src || src.includes("player") || src.includes("bundle") ||
      src.includes("app.") || src.includes("index.");
    if (!isPlayerScript) return;
    // ignore benign errors that don't affect playback
    if (msg.includes("ResizeObserver") || msg.includes("Script error")) return;
    _handlePlayerCrash(msg, src, e.error ? (e.error.stack || "") : "");
  }, { passive: true });

  window.addEventListener("unhandledrejection", (e) => {
    if (_globalErrorCaught) return;
    const reason = e && e.reason;
    const msg = reason ? (reason.message || reason.stack || String(reason)) : "";
    // ignore AbortError (from aborted play() calls) and NotAllowedError (autoplay policy)
    if (typeof msg === "string" && (msg.includes("AbortError") || msg.includes("NotAllowedError") ||
        msg.includes("play() request was interrupted"))) return;
    _handlePlayerCrash(msg, "promise", reason ? (reason.stack || "") : "");
  }, { passive: true });
});

//////////////// THE PLAYER, END ////////////////////////
 
  
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
  // Capture-phase keydown can fire before activeElement updates, so we cast
  // a wide net: event target, activeElement, AND querySelector(:focus).
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
    ' ':          (p) => { togglePlay(p); return true; },

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
  }, false); 
})();

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
 const customVideoJsUI = document.createElement("style");
customVideoJsUI.innerHTML = `:root{--poke-accent-1:#ff0045;--poke-accent-2:#ff0e55;--poke-accent-3:#ff1d79;--glass-bg:rgba(20, 20, 20, 0.38);--glass-bg-hover:rgba(20, 20, 20, 0.46);--glass-border:rgba(255, 255, 255, 0.22);--glass-border-strong:rgba(255, 255, 255, 0.30);--glass-shadow:0 10px 30px rgba(0,0,0,0.32), inset 0 0 0 1px rgba(255,255,255,0.10);--scene-contrast-wash:rgba(0,0,0,0.10);--ui-text:rgba(255,255,255,0.96);--ui-text-soft:rgba(255,255,255,0.86);--ui-text-shadow:0 1px 2px rgba(0,0,0,0.65);--ui-text-outline:0 0 1px rgba(0,0,0,0.70);--r-outer:16px;--r-pill:999px;--r-bubble:1em;--btn:38px;--btn-mobile:34px;--bar-bottom:12px;--bar-bottom-mobile:10px}.video-js,.video-js .vjs-poster,.video-js .vjs-poster img,.video-js .vjs-tech{border-radius:var(--r-outer) !important}.vjs-title-bar{background:none !important;border-radius:var(--r-outer);overflow:hidden}.vjs-title-bar-title{font-family:"PokeTube Flex", sans-serif !important;font-stretch:ultra-expanded;font-weight:1000;font-size:1.5em;color:var(--ui-text) !important;text-shadow:var(--ui-text-shadow);-webkit-text-stroke:0.35px rgba(0,0,0,0.35)}.vjs-title-bar-description{width:fit-content;border-radius:var(--r-bubble);padding:1em;font-family:"PokeTube Flex", "poketube flex", sans-serif;font-weight:600;font-stretch:semi-expanded;color:var(--ui-text);text-shadow:var(--ui-text-shadow);filter: drop-shadow(0 8px 22px rgba(0,0,0,0.25));background:linear-gradient(180deg, rgba(255,255,255,0.12), rgba(255,255,255,0.06)), linear-gradient(180deg, var(--scene-contrast-wash), var(--scene-contrast-wash)), var(--glass-bg);border:1px solid var(--glass-border);-webkit-backdrop-filter: blur(14px) saturate(170%);backdrop-filter: blur(14px) saturate(170%)}.video-js .vjs-control-bar{bottom:var(--bar-bottom) !important}.vjs-control-bar{background:transparent !important;border:none !important;box-shadow:none !important;display:flex !important;align-items:center !important;gap:2px;padding:6px 10px;border-radius:var(--r-outer);background:linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0.05)), linear-gradient(180deg, var(--scene-contrast-wash), var(--scene-contrast-wash)) !important;-webkit-backdrop-filter: blur(12px) saturate(160%);backdrop-filter: blur(12px) saturate(160%);border:1px solid rgba(255,255,255,0.12) !important;box-shadow:0 12px 34px rgba(0,0,0,0.26) !important}.vjs-control-bar .vjs-button{width:var(--btn);height:var(--btn);min-width:var(--btn);border-radius:50%;background:linear-gradient(180deg, rgba(255,255,255,0.18), rgba(255,255,255,0.08)), linear-gradient(180deg, var(--scene-contrast-wash), var(--scene-contrast-wash)), var(--glass-bg);-webkit-backdrop-filter: blur(12px) saturate(160%);backdrop-filter: blur(12px) saturate(160%);border:1px solid var(--glass-border);box-shadow:var(--glass-shadow);display:inline-flex;align-items:center;justify-content:center;margin:0 6px;transition:transform 0.12s ease, box-shadow 0.2s ease, background 0.2s ease, border-color 0.2s ease;vertical-align:middle}.vjs-control-bar .vjs-button:hover{background:linear-gradient(180deg, rgba(255,255,255,0.24), rgba(255,255,255,0.12)), linear-gradient(180deg, rgba(0,0,0,0.12), rgba(0,0,0,0.12)), var(--glass-bg-hover);border-color:var(--glass-border-strong);box-shadow:0 12px 32px rgba(0,0,0,0.36), inset 0 0 0 1px rgba(255,255,255,0.16);transform:translateY(-1px)}.vjs-control-bar .vjs-button:active{transform:translateY(0)}.vjs-control-bar .vjs-button:focus-visible{outline:none;box-shadow:0 0 0 3px rgba(255,0,90,0.35), inset 0 0 0 1px rgba(255,255,255,0.20), 0 12px 34px rgba(0,0,0,0.32);border-color:rgba(255,255,255,0.30)}.vjs-control-bar .vjs-icon-placeholder:before{font-size:18px;line-height:var(--btn);color:var(--ui-text);text-shadow:var(--ui-text-shadow);filter: drop-shadow(var(--ui-text-outline))}.vjs-current-time,.vjs-duration,.vjs-remaining-time,.vjs-time-divider{background:transparent;padding:0 8px;border-radius:var(--r-pill);box-shadow:none;margin:0;height:var(--btn);line-height:1;display:inline-flex;align-items:center;color:var(--ui-text-soft) !important;text-shadow:var(--ui-text-shadow)}.vjs-fullscreen-control,.vjs-remaining-time{background-color:transparent !important}.vjs-progress-control{flex:1 1 auto;display:flex !important;align-items:center !important;margin:0 6px;padding:0;height:var(--btn)}.vjs-progress-control .vjs-progress-holder{height:8px !important;border-radius:var(--r-pill) !important;background:transparent !important;border:none;box-shadow:none;position:relative;margin:0;width:100%;overflow:hidden}.vjs-progress-control .vjs-progress-holder::before{content:"";position:absolute;inset:0;border-radius:inherit;background:linear-gradient(180deg, rgba(255,255,255,0.18), rgba(255,255,255,0.08)), linear-gradient(180deg, rgba(0,0,0,0.14), rgba(0,0,0,0.14)), rgba(20,20,20,0.34);-webkit-backdrop-filter: blur(12px) saturate(160%);backdrop-filter: blur(12px) saturate(160%);border:1px solid rgba(255,255,255,0.18);box-shadow:0 8px 24px rgba(0,0,0,0.25), inset 0 0 0 1px rgba(255,255,255,0.10);pointer-events:none}.vjs-progress-control .vjs-load-progress,.vjs-progress-control .vjs-play-progress{position:relative;z-index:1;border-radius:inherit !important}.vjs-play-progress,.vjs-progress-control .vjs-play-progress{background-image:linear-gradient(to right, var(--poke-accent-1), var(--poke-accent-2), var(--poke-accent-3)) !important}.vjs-progress-control .vjs-slider-handle{width:14px !important;height:14px !important;border-radius:50% !important;background:rgba(255,255,255,0.95) !important;border:1px solid rgba(255,255,255,0.95);box-shadow:0 8px 20px rgba(0,0,0,0.35), 0 0 0 3px rgba(255,0,90,0.22);top:-4px !important;z-index:2}.vjs-volume-panel{gap:8px;align-items:center !important;padding:0;height:var(--btn)}.vjs-volume-bar{height:6px !important;border-radius:var(--r-pill) !important;background:linear-gradient(180deg, rgba(255,255,255,0.14), rgba(255,255,255,0.06)), linear-gradient(180deg, rgba(0,0,0,0.18), rgba(0,0,0,0.18)), rgba(18,18,18,0.40) !important;border:1px solid rgba(255,255,255,0.16);box-shadow:0 8px 20px rgba(0,0,0,0.20);position:relative;overflow:hidden}.vjs-volume-level{border-radius:inherit !important;background-image:linear-gradient(to right, var(--poke-accent-1), var(--poke-accent-3)) !important}.vjs-volume-bar .vjs-slider-handle{width:12px !important;height:12px !important;border-radius:50% !important;background:rgba(255,255,255,0.95) !important;border:1px solid rgba(255,255,255,0.95);top:-3px !important;box-shadow:0 6px 16px rgba(0,0,0,0.28), 0 0 0 3px rgba(255,0,90,0.20)}@media (max-width: 640px){.video-js .vjs-control-bar{bottom:var(--bar-bottom-mobile) !important}.vjs-control-bar{gap:8px;padding:6px 8px}.vjs-control-bar .vjs-button{width:var(--btn-mobile);height:var(--btn-mobile);min-width:var(--btn-mobile)}.vjs-control-bar .vjs-icon-placeholder:before{font-size:16px;line-height:var(--btn-mobile)}.vjs-current-time,.vjs-duration,.vjs-remaining-time,.vjs-time-divider{height:var(--btn-mobile)}.vjs-progress-control{height:var(--btn-mobile)}.vjs-progress-control .vjs-slider-handle{width:12px !important;height:12px !important;top:-3px !important}}@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))){.vjs-control-bar,.vjs-control-bar .vjs-button,.vjs-progress-control .vjs-progress-holder::before,.vjs-title-bar-description,.vjs-volume-bar{-webkit-backdrop-filter: none !important;backdrop-filter: none !important;background:rgba(18,18,18,0.72) !important;border-color:rgba(255,255,255,0.18) !important}}`;


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
	styles.textContent = `.vjs-control-bar {z-index: 21;}`;
	document.body.append(styles);
}