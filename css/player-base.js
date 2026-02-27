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
  const vidKey = qs.get("v");

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

  function isVideoPaused() {
    try {
      if (typeof video.paused === "function") return !!video.paused();
    } catch {}
    try {
      const v = getPlayableVideoEl();
      if (v) return !!v.paused;
    } catch {}
    try {
      return !!videoEl.paused;
    } catch {}
    return true;
  }

  function getVideoReadyState() {
    try {
      const v = getPlayableVideoEl();
      if (v && typeof v.readyState === "number") return v.readyState;
    } catch {}
    try {
      return Number(videoEl.readyState || 0);
    } catch {}
    return 0;
  }

  function getMobilePlatform() {
    try {
      const ua = navigator.userAgent || "";
      const uaData = navigator.userAgentData;
      const mobileHint = !!uaData?.mobile;

      const isiOS =
        /iPhone|iPad|iPod/i.test(ua) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

      const isAndroid = /Android/i.test(ua);
      const isMobileUA = /Mobi|Mobile|iPhone|iPad|iPod|Android/i.test(ua);
      const mobile = mobileHint || isMobileUA || isiOS || isAndroid;

      return { mobile: !!mobile, ios: !!isiOS, android: !!isAndroid };
    } catch {
      return { mobile: false, ios: false, android: false };
    }
  }

  function isAndroidChromium() {
    try {
      const { android } = getMobilePlatform();
      if (!android) return false;
      const ua = navigator.userAgent || "";
      const isChromium = /Chrome|Chromium|CriOS/i.test(ua);
      const excluded = /EdgA|Firefox|FxiOS|SamsungBrowser|OPR|Opera/i.test(ua);
      return isChromium && !excluded;
    } catch {
      return false;
    }
  }

  function isIOSWebKitLike() {
    try {
      const { ios } = getMobilePlatform();
      if (!ios) return false;
      const ua = navigator.userAgent || "";
      return /Safari|CriOS|FxiOS|EdgiOS/i.test(ua);
    } catch {
      return false;
    }
  }

  function isProblemMobileBrowser() {
    return isAndroidChromium() || isIOSWebKitLike();
  }

  function isDesktopChromiumLike() {
    try {
      const { mobile } = getMobilePlatform();
      if (mobile) return false;
      const ua = navigator.userAgent || "";
      return /Chrome|Chromium|Edg|OPR/i.test(ua) && !/Firefox/i.test(ua);
    } catch {
      return false;
    }
  }

  function isChromiumOnlyBrowser() {
    return isAndroidChromium() || isDesktopChromiumLike();
  }

  function shouldUseBgControllerRetry() {
    return isProblemMobileBrowser() || isDesktopChromiumLike();
  }

  video.ready(() => {
    const metaTitle = document.querySelector('meta[name="title"]')?.content || "";
    const metaDesc = document.querySelector('meta[name="twitter:description"]')?.content || "";

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

    const handleFullscreen = () => {
      const fs = document.fullscreenElement || document.webkitFullscreenElement;
      if (fs) createTitleBar();
      else removeTitleBar();
    };

    document.addEventListener("fullscreenchange", handleFullscreen, { passive: true });
    document.addEventListener("webkitfullscreenchange", handleFullscreen, { passive: true });
    handleFullscreen();
  });

  let syncing = false;
  let restarting = false;
  let firstSeekDone = false;

  function isLoopDesired() {
    return !!videoEl.loop || videoEl.hasAttribute("loop") || qs.get("loop") === "1" || qs.get("loop") === "true" || window.forceLoop === true;
  }

  let suppressEndedUntil = 0;
  let intendedPlaying = false;
  let pauseGuard = 0;

  let isProgrammaticPause = false;
  let isProgrammaticPlay = false;
  let isProgrammaticAudioPause = false;
  let isProgrammaticAudioPlay = false;
  let audioPlayAttemptUntil = 0;
  let audioKickCooldownUntil = 0;

  let androidMediaSessionResumeGuardUntil = 0;
  let androidResumeRepairTimer = null;
  let ignorePauseEventsUntil = 0;

  let mediaActionLockUntil = 0;
  let mediaPlayTxnUntil = 0;
  let mediaPauseTxnUntil = 0;

  let bgResumeRetryTimer = null;

  let strictBufferHold = false;
  let strictBufferHoldReason = "";

  let mediaSessionActionSerial = 0;
  let mediaSessionForcedPauseUntil = 0;

  let lastMediaAction = "";
  let lastMediaActionTs = 0;

  let bgControllerPlayGuardUntil = 0;

  let audioPlayInFlightPromise = null;
  let audioPlayInFlightUntil = 0;
  let audioPauseInFlightUntil = 0;
  let startupAudioHoldUntil = 0;

  let resumeOnVisible = false;
  let bgAutoResumeSuppressed = false;

  let seekSyncToken = 0;
  let seekSyncWantedPlaying = false;
  let seekSyncVideoSeeked = false;
  let seekSyncAudioSeeked = false;
  let seekSyncTargetTime = 0;
  let seekSyncFinishing = false;
  let seekSyncFinishTimer = null;

  let seekSyncRetryUntil = 0;
  let seekSyncRetryTimer = null;

  let strictBufferMissCount = 0;
  let strictBufferHoldMinUntil = 0;
  let strictBufferCoolDownUntil = 0;

  let explicitPlayUntil = 0;
  let bgResumeRetryCooldownUntil = 0;
  let resumeWarmUntil = 0;

  let smoothNoHoldUntil = 0;
  let postSeekSmoothUntil = 0;

  let resumeAfterBufferToken = 0;
  let resumeAfterBufferTimer = null;

  let userPauseIntentUntil = 0;
  let userPlayIntentUntil = 0;
  let userPauseLockUntil = 0;

  let hardPauseLatchUntil = 0;
  let hardPauseVerifySerial = 0;

  let jointStartGraceUntil = 0;
  let jointMismatchSince = 0;
  let jointMismatchCooldownUntil = 0;
  let jointMismatchReason = "";

  function setJointStartGrace(ms = 1200) {
    jointStartGraceUntil = Math.max(jointStartGraceUntil, performance.now() + Math.max(0, Number(ms) || 0));
  }

  function jointStartGraceActive() {
    return performance.now() < jointStartGraceUntil;
  }

  function noteJointMismatch(reason = "") {
    const now = performance.now();
    if (!jointMismatchSince) {
      jointMismatchSince = now;
      jointMismatchReason = String(reason || "");
    }
  }

  function clearJointMismatch() {
    jointMismatchSince = 0;
    jointMismatchReason = "";
  }

  function coupledMismatchTooLong(ms = 420) {
    if (!jointMismatchSince) return false;
    return (performance.now() - jointMismatchSince) > Math.max(0, Number(ms) || 0);
  }

  function holdCoupledPlayback(reason = "coupled-hold") {
    try {
      if (!hasExternalAudio || qua === "medium") return;
      if (!intendedPlaying || restarting || seekingActive || syncing) return;
      if (mediaSessionForcedPauseActive()) return;

      if (startupAutoplayAudioCatchupActive() && /^audio-/.test(String(reason || ""))) {
        setStartupAudioHold(700);
        queuePlayRetryBurst();
        if (isChromiumOnlyBrowser()) queueChromiumToggleAudioRepair("startup-audio-catchup");
        return;
      }

      const now = performance.now();
      if (now < jointMismatchCooldownUntil) return;
      jointMismatchCooldownUntil = now + 900;

      strictBufferHold = true;
      strictBufferHoldReason = String(reason || "coupled-hold");
      strictBufferMissCount = Math.max(strictBufferMissCount, 2);
      strictBufferHoldMinUntil = Math.max(strictBufferHoldMinUntil, now + 520);
      strictBufferCoolDownUntil = Math.max(strictBufferCoolDownUntil, now + 650);

      const vt = Number(video.currentTime());
      if (isFinite(vt)) safeSetCT(audio, vt);

      execProgrammaticVideoPause();
      execProgrammaticAudioPause(520);

      armResumeAfterBuffer(8000);
    } catch {}
  }

  function hardPauseLatchActive() {
    return performance.now() < hardPauseLatchUntil;
  }

  function armHardPauseLatch(ms = 2400) {
    hardPauseLatchUntil = Math.max(hardPauseLatchUntil, performance.now() + Math.max(0, Number(ms) || 0));
    userPauseIntentUntil = Math.max(userPauseIntentUntil, hardPauseLatchUntil);
    userPauseLockUntil = Math.max(userPauseLockUntil, hardPauseLatchUntil + 280);
    userPlayIntentUntil = 0;
    intendedPlaying = false;
    updateMediaSessionPlaybackState();
  }

  function clearHardPauseLatch() {
    hardPauseLatchUntil = 0;
  }

  function clearPlayStartFriction() {
    audioPauseInFlightUntil = 0;
    audioPlayAttemptUntil = 0;
    startupAudioHoldUntil = 0;
    strictBufferHold = false;
    strictBufferHoldReason = "";
    strictBufferMissCount = 0;
    strictBufferHoldMinUntil = 0;
    strictBufferCoolDownUntil = 0;

    if (isChromiumOnlyBrowser()) {
      chromiumPauseToggleGuardUntil = 0;
      chromiumBgSettlingUntil = 0;
      chromiumAudioStartLockUntil = Math.min(chromiumAudioStartLockUntil, performance.now() + 120);
    }
  }

  function clearPendingPlayResumesForPause() {
    cancelChromiumToggleAudioRepair();
    cancelHiddenTransientResume();
    clearHiddenMediaSessionPlay();
    clearAndroidResumeRepairTimer();
    clearBgResumeRetryTimer();
    clearResumeAfterBufferTimer();
    clearSeekRecoveryTimers();
    clearSeekSyncFinishTimer();
    clearSeekSyncRetryTimer();
    clearResumeSyncRestartTimer();
    cancelBackgroundResumeState();
    strictBufferHold = false;
    strictBufferHoldReason = "";
    strictBufferMissCount = 0;
    strictBufferHoldMinUntil = 0;
    startupAudioHoldUntil = 0;
    resumeOnVisible = false;
    audioPlayAttemptUntil = Math.max(audioPlayAttemptUntil, performance.now() + 220);
    setPauseEventGuard(1200);
    setMediaPauseTxn(1200);

    if (isChromiumOnlyBrowser()) {
      setChromiumPauseToggleGuard(1650);
      setChromiumAudioStartLock(1850);
      setChromiumBgSettling(1200);
    }
  }

  function queueHardPauseVerification(msList = [0, 90, 220, 420, 760]) {
    if (startupAutoplayPauseGraceActive()) return;

    const serial = ++hardPauseVerifySerial;

    for (const delay of msList) {
      setTimeout(() => {
        if (serial !== hardPauseVerifySerial) return;
        if (intendedPlaying || userPlayIntentActive()) return;

        try {
          if (!isVideoPaused()) execProgrammaticVideoPause();
        } catch {}

        try {
          if (audio && !audio.paused) execProgrammaticAudioPause(220);
        } catch {}

        try { clearSyncLoop(); } catch {}
      }, delay);
    }
  }

  function lockPauseIntent(ms = 2400) {
    armHardPauseLatch(ms);
    clearPendingPlayResumesForPause();
  }

  let chromiumAudioStartLockUntil = 0;
  let chromiumPauseToggleGuardUntil = 0;
  let chromiumBgSettlingUntil = 0;
  let chromiumToggleAudioRepairSerial = 0;
  let hiddenMediaSessionPlayUntil = 0;
  let hiddenTransitionAt = 0;
  let hiddenTransientResumeSerial = 0;

  function markExplicitPlay(ms = 15000) {
    explicitPlayUntil = Math.max(explicitPlayUntil, performance.now() + ms);
  }

  function explicitPlayActive() {
    return performance.now() < explicitPlayUntil;
  }

  function setResumeWarm(ms = 1200) {
    resumeWarmUntil = Math.max(resumeWarmUntil, performance.now() + ms);
  }

  function resumeWarmActive() {
    return performance.now() < resumeWarmUntil;
  }

  function setSmoothNoHold(ms = 1100) {
    smoothNoHoldUntil = Math.max(smoothNoHoldUntil, performance.now() + ms);
  }

  function smoothNoHoldActive() {
    return performance.now() < smoothNoHoldUntil;
  }

  function setPostSeekSmooth(ms = 900) {
    postSeekSmoothUntil = Math.max(postSeekSmoothUntil, performance.now() + ms);
  }

  function postSeekSmoothActive() {
    return performance.now() < postSeekSmoothUntil;
  }

  function setChromiumAudioStartLock(ms = 0) {
    if (!isChromiumOnlyBrowser()) return;
    chromiumAudioStartLockUntil = Math.max(chromiumAudioStartLockUntil, performance.now() + Math.max(0, Number(ms) || 0));
  }

  function chromiumAudioStartLocked() {
    return isChromiumOnlyBrowser() && performance.now() < chromiumAudioStartLockUntil;
  }

  function setChromiumPauseToggleGuard(ms = 0) {
    if (!isChromiumOnlyBrowser()) return;
    chromiumPauseToggleGuardUntil = Math.max(chromiumPauseToggleGuardUntil, performance.now() + Math.max(0, Number(ms) || 0));
  }

  function chromiumPauseToggleGuardActive() {
    return isChromiumOnlyBrowser() && performance.now() < chromiumPauseToggleGuardUntil;
  }

  function setChromiumBgSettling(ms = 0) {
    if (!isChromiumOnlyBrowser()) return;
    chromiumBgSettlingUntil = Math.max(chromiumBgSettlingUntil, performance.now() + Math.max(0, Number(ms) || 0));
  }

  function chromiumBgSettlingActive() {
    return isChromiumOnlyBrowser() && performance.now() < chromiumBgSettlingUntil;
  }

  function armHiddenMediaSessionPlay(ms = 5000) {
    if (!isChromiumOnlyBrowser()) return;
    hiddenMediaSessionPlayUntil = Math.max(hiddenMediaSessionPlayUntil, performance.now() + Math.max(0, Number(ms) || 0));
  }

  function hiddenMediaSessionPlayActive() {
    return isChromiumOnlyBrowser() && performance.now() < hiddenMediaSessionPlayUntil;
  }

  function clearHiddenMediaSessionPlay() {
    hiddenMediaSessionPlayUntil = 0;
  }

  function hiddenRecently(ms = 1000) {
    return document.visibilityState === "hidden" && (performance.now() - hiddenTransitionAt) < Math.max(0, Number(ms) || 0);
  }

  function cancelHiddenTransientResume() {
    hiddenTransientResumeSerial += 1;
  }

  function queueHiddenTransientResume(reason = "") {
    if (!shouldUseBgControllerRetry()) return;
    if (!hasExternalAudio || qua === "medium") return;
    if (document.visibilityState !== "hidden") return;
    if (!intendedPlaying || restarting || seekingActive || syncing) return;
    if (mediaSessionForcedPauseActive() || userPauseLockActive() || hardPauseLatchActive()) return;

    const serial = ++hiddenTransientResumeSerial;

    armHiddenMediaSessionPlay(2400);
    setPauseEventGuard(900);
    setMediaPlayTxn(1200);
    setBgControllerPlayGuard(2400);
    setResumeWarm(1400);
    setSmoothNoHold(900);
    if (isChromiumOnlyBrowser()) setChromiumAudioStartLock(120);

    const delays = [0, 90, 220];

    for (const delay of delays) {
      setTimeout(() => {
        if (serial !== hiddenTransientResumeSerial) return;
        if (document.visibilityState !== "hidden") return;
        if (!intendedPlaying || restarting || seekingActive || syncing) return;
        if (mediaSessionForcedPauseActive() || userPauseLockActive() || hardPauseLatchActive()) return;

        try {
          const vt = Number(video.currentTime());
          const at = Number(audio.currentTime);
          if (isFinite(vt) && isFinite(at) && Math.abs(at - vt) > 0.22) {
            squelchAudioEvents(220);
            safeSetCT(audio, vt);
          }
        } catch {}

        try { execProgrammaticVideoPlay(); } catch {}

        if (!shouldBlockNewAudioStart()) {
          execProgrammaticAudioPlay({
            squelchMs: 220,
            minGapMs: 0,
            force: true
          }).catch(() => false);
          updateAudioGainImmediate();
        }
      }, delay);
    }
  }

  function cancelChromiumToggleAudioRepair() {
    chromiumToggleAudioRepairSerial += 1;
  }

  function queueChromiumToggleAudioRepair(reason = "") {
    if (!hasExternalAudio || qua === "medium") return;
    if (!isChromiumOnlyBrowser()) return;
    if (document.visibilityState !== "visible" && !hiddenMediaSessionPlayActive()) return;
    if (mediaSessionForcedPauseActive()) return;

    const serial = ++chromiumToggleAudioRepairSerial;
    const delays = [0, 90, 180, 320, 520];

    for (const delay of delays) {
      setTimeout(async () => {
        if (serial !== chromiumToggleAudioRepairSerial) return;
        if (!intendedPlaying || restarting || seekingActive || syncing) return;
        if (document.visibilityState !== "visible" && !hiddenMediaSessionPlayActive()) return;
        if (mediaSessionForcedPauseActive() || userPauseLockActive() || hardPauseLatchActive()) return;
        if (strictBufferHold) return;
        if (!hiddenMediaSessionPlayActive() && isVideoPaused()) return;
        if (!audio.paused) return;

        try {
          audioPauseInFlightUntil = 0;
          audioPlayAttemptUntil = 0;
          startupAudioHoldUntil = 0;
        } catch {}

        const vt = Number(video.currentTime());
        const at = Number(audio.currentTime);
        if (isFinite(vt) && (!isFinite(at) || Math.abs(at - vt) > 0.18)) {
          squelchAudioEvents(260);
          safeSetCT(audio, vt);
        }

        forceUnmuteForPlaybackIfAllowed();
        updateAudioGainImmediate();

        const started = await execProgrammaticAudioPlay({
          squelchMs: 280,
          minGapMs: 0,
          force: true
        }).catch(() => false);

        if (started && !audio.paused) {
          audioEverStarted = true;
          updateAudioGainImmediate();
        }
      }, delay);
    }
  }

  function shouldBlockNewAudioStart() {
    if (!hasExternalAudio || qua === "medium") return false;
    if (!intendedPlaying || userPauseLockActive() || hardPauseLatchActive() || mediaSessionForcedPauseActive()) return true;
    if (!isChromiumOnlyBrowser()) return false;

    const allowHiddenBootstrap =
      document.visibilityState === "hidden" &&
      hiddenMediaSessionPlayActive();

    if (document.visibilityState === "hidden" && !allowHiddenBootstrap) return true;
    if (chromiumPauseToggleGuardActive() && !allowHiddenBootstrap) return true;
    if (chromiumAudioStartLocked() && !allowHiddenBootstrap) return true;
    if (chromiumBgSettlingActive() && isVideoPaused() && !allowHiddenBootstrap) return true;

    if (!allowHiddenBootstrap) {
      if (isVideoPaused()) return true;

      const rs = getVideoReadyState();
      const warm = jointStartGraceActive() || resumeWarmActive() || explicitPlayActive();
      if (!warm && rs < 2) return true;

      try {
        if (video.hasClass("vjs-waiting")) return true;
      } catch {}

      return false;
    }

    const t = Number(video.currentTime());
    if (!canStartAudioAt(t)) return true;
    return false;
  }

  function markUserPauseIntent(ms = 1600) {
    const until = performance.now() + Math.max(0, Number(ms) || 0);
    userPauseIntentUntil = Math.max(userPauseIntentUntil, until);
    userPauseLockUntil = Math.max(userPauseLockUntil, until + 280);
    userPlayIntentUntil = 0;
    hardPauseLatchUntil = Math.max(hardPauseLatchUntil, until);
    intendedPlaying = false;
    updateMediaSessionPlaybackState();

    if (isChromiumOnlyBrowser()) {
      cancelChromiumToggleAudioRepair();
      cancelHiddenTransientResume();
      cancelBackgroundResumeState();
      setMediaPauseTxn(900);
      setPauseEventGuard(900);
      setChromiumPauseToggleGuard(ms + 250);
      setChromiumAudioStartLock(ms + 450);
    }
  }

  function markUserPlayIntent(ms = 1600) {
    const until = performance.now() + Math.max(0, Number(ms) || 0);
    userPlayIntentUntil = Math.max(userPlayIntentUntil, until);
    userPauseIntentUntil = 0;
    userPauseLockUntil = 0;
    clearHardPauseLatch();
    clearPlayStartFriction();
    cancelHiddenTransientResume();

    clearMediaSessionForcedPause();
    intendedPlaying = true;
    markMediaAction("play");
    markExplicitPlay(15000);
    setResumeWarm(2000);
    setSmoothNoHold(1100);
    setJointStartGrace(1200);
    updateMediaSessionPlaybackState();

    if (isChromiumOnlyBrowser()) {
      setChromiumPauseToggleGuard(0);
      setChromiumBgSettling(0);
      setChromiumAudioStartLock(120);
      audioPauseInFlightUntil = 0;
      audioPlayAttemptUntil = 0;
      startupAudioHoldUntil = 0;
    }
  }

  function clearUserIntents() {
    userPauseIntentUntil = 0;
    userPlayIntentUntil = 0;
    userPauseLockUntil = 0;
    clearHardPauseLatch();
  }

  function userPauseIntentActive() {
    return performance.now() < userPauseIntentUntil;
  }

  function userPauseLockActive() {
    return performance.now() < userPauseLockUntil;
  }

  function userPlayIntentActive() {
    return performance.now() < userPlayIntentUntil;
  }

  function clearResumeAfterBufferTimer() {
    if (resumeAfterBufferTimer) {
      clearTimeout(resumeAfterBufferTimer);
      resumeAfterBufferTimer = null;
    }
  }

  function armResumeAfterBuffer(timeoutMs = 7000) {
    if (!hasExternalAudio || qua === "medium") return;
    if (!intendedPlaying || restarting || seekingActive || syncing) return;
    if (mediaSessionForcedPauseActive()) return;

    const token = ++resumeAfterBufferToken;
    clearResumeAfterBufferTimer();

    const v = getPlayableVideoEl() || videoEl;
    let removed = false;

    const cleanup = () => {
      if (removed) return;
      removed = true;
      try { v.removeEventListener("canplay", onEvt); } catch {}
      try { v.removeEventListener("playing", onEvt); } catch {}
      try { v.removeEventListener("progress", onEvt); } catch {}
      try { audio.removeEventListener("canplay", onEvt); } catch {}
      try { audio.removeEventListener("playing", onEvt); } catch {}
      try { audio.removeEventListener("progress", onEvt); } catch {}
    };

    const tryKick = () => {
      if (token !== resumeAfterBufferToken) return cleanup();
      if (!intendedPlaying || restarting || seekingActive || syncing) return;
      if (mediaSessionForcedPauseActive()) return;
      if (userPauseLockActive() || hardPauseLatchActive()) return cleanup();

      let vOk = false;
      let aOk = false;

      try { vOk = Number(v.readyState || 0) >= 3; } catch {}
      try { aOk = Number(audio.readyState || 0) >= 3; } catch {}

      if (!(vOk && aOk)) return;

      try {
        strictBufferHold = false;
        strictBufferHoldReason = "";
        strictBufferMissCount = 0;
        strictBufferHoldMinUntil = 0;
        strictBufferCoolDownUntil = Math.max(strictBufferCoolDownUntil, performance.now() + 300);
      } catch {}

      setSmoothNoHold(900);

      if (!inMediaTxnWindow()) {
        playTogether().catch(() => {});
      } else {
        setTimeout(() => {
          if (token !== resumeAfterBufferToken) return;
          if (!intendedPlaying || restarting || seekingActive || syncing) return;
          if (mediaSessionForcedPauseActive()) return;
          if (userPauseLockActive()) return;
          playTogether().catch(() => {});
        }, 220);
      }

      cleanup();
    };

    const onEvt = () => {
      requestAnimationFrame(() => tryKick());
    };

    try { v.addEventListener("canplay", onEvt, { passive: true }); } catch {}
    try { v.addEventListener("playing", onEvt, { passive: true }); } catch {}
    try { v.addEventListener("progress", onEvt, { passive: true }); } catch {}
    try { audio.addEventListener("canplay", onEvt, { passive: true }); } catch {}
    try { audio.addEventListener("playing", onEvt, { passive: true }); } catch {}
    try { audio.addEventListener("progress", onEvt, { passive: true }); } catch {}

    resumeAfterBufferTimer = setTimeout(() => {
      if (token !== resumeAfterBufferToken) return;
      cleanup();
    }, Math.max(1200, Number(timeoutMs) || 0));
  }

  function getVideoMutedState() {
    try {
      if (typeof video.muted === "function") return !!video.muted();
    } catch {}
    try {
      const v = getPlayableVideoEl();
      if (v) return !!v.muted;
    } catch {}
    try {
      return !!videoEl.muted;
    } catch {}
    return false;
  }

  function setVideoMutedState(val) {
    try {
      if (typeof video.muted === "function") video.muted(!!val);
    } catch {}
    try {
      const v = getPlayableVideoEl();
      if (v) v.muted = !!val;
    } catch {}
    try {
      videoEl.muted = !!val;
    } catch {}
  }

  function forceUnmuteForPlaybackIfAllowed() {
    if (!intendedPlaying) return;

    try {
      if (!userMutedVideo && getVideoMutedState()) {
        setVideoMutedState(false);
      }
    } catch {}

    try {
      if (!userMutedAudio && audio && audio.muted) {
        audio.muted = false;
      }
    } catch {}
  }

  function setBgControllerPlayGuard(ms = 2400) {
    bgControllerPlayGuardUntil = Math.max(bgControllerPlayGuardUntil, performance.now() + ms);
  }

  function bgControllerPlayGuardActive() {
    return performance.now() < bgControllerPlayGuardUntil;
  }

  function setMediaSessionForcedPause(ms = 2600) {
    mediaSessionForcedPauseUntil = Math.max(mediaSessionForcedPauseUntil, performance.now() + ms);
  }

  function clearMediaSessionForcedPause() {
    mediaSessionForcedPauseUntil = 0;
  }

  function mediaSessionForcedPauseActive() {
    return performance.now() < mediaSessionForcedPauseUntil;
  }

  function nextMediaSessionActionSerial() {
    mediaSessionActionSerial += 1;
    return mediaSessionActionSerial;
  }

  function mediaSessionActionIsCurrent(serial) {
    return serial === mediaSessionActionSerial;
  }

  function setStartupAudioHold(ms = 450) {
    startupAudioHoldUntil = Math.max(startupAudioHoldUntil, performance.now() + ms);
  }

  function startupAudioHoldActive() {
    return performance.now() < startupAudioHoldUntil;
  }

  function queuePlayRetryBurst() {
    if (!shouldUseBgControllerRetry()) return;
    const delays = [120, 320, 650, 1100, 1700];
    for (const delay of delays) {
      setTimeout(() => {
        if (!intendedPlaying || restarting || seekingActive || syncing || mediaSessionForcedPauseActive()) return;
        if (userPauseLockActive() || hardPauseLatchActive()) return;
        if (document.visibilityState === "hidden" && bgAutoResumeSuppressed && !explicitPlayActive() && !bgControllerPlayGuardActive() && !mediaActionRecently("play", 900)) return;
        playTogether().catch(() => {});
      }, delay);
    }
  }

  function markMediaAction(type) {
    lastMediaAction = type;
    lastMediaActionTs = performance.now();
  }

  function mediaActionRecently(type, ms = 1600) {
    return lastMediaAction === type && (performance.now() - lastMediaActionTs) < ms;
  }

  function inMediaTxnWindow() {
    return mediaActionLocked() || mediaPlayTxnActive() || mediaPauseTxnActive();
  }

  function shouldTreatVisiblePauseAsUserPause() {
    return document.visibilityState === "visible" && (userPauseIntentActive() || hardPauseLatchActive());
  }

  function shouldIgnorePauseAsTransient() {
    if (hardPauseLatchActive()) return false;
    if (mediaSessionForcedPauseActive()) return false;
    if (shouldTreatVisiblePauseAsUserPause()) return false;

    const now = performance.now();
    const isHidden = document.visibilityState === "hidden";

    if (!isHidden) {
      if (resumeWarmActive()) return true;
      if (now < audioPlayInFlightUntil) return true;
      if (isProgrammaticPlay) return true;
      if (mediaActionRecently("play", 260)) return true;
      return false;
    }

    if (inMediaTxnWindow()) return true;
    if (bgControllerPlayGuardActive()) return true;
    if (resumeWarmActive()) return true;
    if (now < audioPlayInFlightUntil) return true;
    if (mediaActionRecently("play", 2400)) return true;
    if (hiddenRecently(1400)) return true;
    if (shouldIgnorePauseEvents() && androidResumeGuardActive()) return true;
    return false;
  }

  function setAndroidResumeGuard(ms = 1800) {
    if (!isAndroidChromium()) return;
    androidMediaSessionResumeGuardUntil = performance.now() + ms;
  }

  function androidResumeGuardActive() {
    return isAndroidChromium() && performance.now() < androidMediaSessionResumeGuardUntil;
  }

  function setPauseEventGuard(ms = 1000) {
    ignorePauseEventsUntil = Math.max(ignorePauseEventsUntil, performance.now() + ms);
  }

  function shouldIgnorePauseEvents() {
    return performance.now() < ignorePauseEventsUntil;
  }

  function setMediaActionLock(ms = 900) {
    mediaActionLockUntil = Math.max(mediaActionLockUntil, performance.now() + ms);
  }

  function mediaActionLocked() {
    return performance.now() < mediaActionLockUntil;
  }

  function setMediaPlayTxn(ms = 1600) {
    mediaPlayTxnUntil = Math.max(mediaPlayTxnUntil, performance.now() + ms);
    setMediaActionLock(Math.min(ms, 1200));
  }

  function mediaPlayTxnActive() {
    return performance.now() < mediaPlayTxnUntil;
  }

  function setMediaPauseTxn(ms = 1000) {
    mediaPauseTxnUntil = Math.max(mediaPauseTxnUntil, performance.now() + ms);
    setMediaActionLock(Math.min(ms, 900));
  }

  function mediaPauseTxnActive() {
    return performance.now() < mediaPauseTxnUntil;
  }

  function clearAndroidResumeRepairTimer() {
    if (androidResumeRepairTimer) {
      clearTimeout(androidResumeRepairTimer);
      androidResumeRepairTimer = null;
    }
  }

  function clearBgResumeRetryTimer() {
    if (bgResumeRetryTimer) {
      clearTimeout(bgResumeRetryTimer);
      bgResumeRetryTimer = null;
    }
  }

  function scheduleBgResumeRetry(delay = 450) {
    if (!shouldUseBgControllerRetry()) return;
    if (mediaSessionForcedPauseActive()) return;
    if (document.visibilityState === "hidden") return;
    if (userPauseLockActive() || hardPauseLatchActive()) return;

    const now = performance.now();
    if (now < bgResumeRetryCooldownUntil) return;
    bgResumeRetryCooldownUntil = now + 650;

    clearBgResumeRetryTimer();
    bgResumeRetryTimer = setTimeout(() => {
      if (!intendedPlaying || restarting || seekingActive || syncing || mediaSessionForcedPauseActive()) return;
      if (document.visibilityState !== "visible") return;
      if (userPauseLockActive() || hardPauseLatchActive()) return;
      playTogether().catch(() => {});
    }, delay);
  }

  function execProgrammaticVideoPause() {
    isProgrammaticPause = true;
    try { video.pause(); } catch {}
    try {
      const v = getPlayableVideoEl();
      if (v && v !== videoEl && !v.paused) v.pause();
    } catch {}
    setTimeout(() => { isProgrammaticPause = false; }, 420);
  }

  function execProgrammaticVideoPlay() {
    isProgrammaticPlay = true;
    try {
      let p = null;

      try {
        p = video.play();
      } catch {}

      if (!p) {
        try {
          const v = getPlayableVideoEl();
          if (v) p = v.play();
        } catch {}
      }

      if (p && p.finally) {
        p.finally(() => { setTimeout(() => { isProgrammaticPlay = false; }, 420); });
      } else {
        setTimeout(() => { isProgrammaticPlay = false; }, 420);
      }

      return p;
    } catch (e) {
      isProgrammaticPlay = false;
      throw e;
    }
  }

  function execProgrammaticAudioPause(ms = 220) {
    const now = performance.now();
    audioPauseInFlightUntil = Math.max(audioPauseInFlightUntil, now + Math.max(180, Number(ms) || 0));
    audioPlayAttemptUntil = Math.max(audioPlayAttemptUntil, now + 120);

    isProgrammaticAudioPause = true;
    try { squelchAudioEvents(ms); } catch {}
    try {
      if (!audio.paused) audio.pause();
    } catch {}
    setTimeout(() => { isProgrammaticAudioPause = false; }, 420);
  }

  async function execProgrammaticAudioPlay(opts = {}) {
    const {
      squelchMs = 320,
      minGapMs = 140,
      force = false
    } = opts || {};

    if (!audio || typeof audio.play !== "function") return false;
    if (!force && !audio.paused) return true;
    if (shouldBlockNewAudioStart()) return false;

    const now = performance.now();
    if (!force && now < audioPauseInFlightUntil) return !audio.paused;
    if (!force && now < audioPlayAttemptUntil) return !audio.paused;
    if (audioPlayInFlightPromise) {
      try { await audioPlayInFlightPromise; } catch {}
      return !audio.paused;
    }

    audioPlayAttemptUntil = now + Math.max(0, Number(minGapMs) || 0);
    audioPauseInFlightUntil = 0;

    isProgrammaticAudioPlay = true;
    try {
      squelchAudioEvents(squelchMs);
      const p = audio.play();
      audioPlayInFlightUntil = performance.now() + Math.max(260, Number(squelchMs) || 0);
      audioPlayInFlightPromise = Promise.resolve(p);
      await audioPlayInFlightPromise;

      if (shouldBlockNewAudioStart()) {
        try { squelchAudioEvents(260); } catch {}
        try { audio.pause(); } catch {}
        return false;
      }

      if (!audio.paused) audioEverStarted = true;
      return !audio.paused;
    } finally {
      audioPlayInFlightPromise = null;
      setTimeout(() => { isProgrammaticAudioPlay = false; }, 420);
    }
  }

  async function settlePlaybackKick(promiseLike, timeoutMs = 160) {
    if (!promiseLike || typeof promiseLike.then !== "function") return;
    await Promise.race([
      Promise.resolve(promiseLike).catch(() => {}),
      new Promise(resolve => setTimeout(resolve, Math.max(0, Number(timeoutMs) || 0)))
    ]);
  }

  let userMutedVideo = false;
  let userMutedAudio = false;

  let lastPlayKickTs = 0;
  const STARTUP_GRACE_MS = 2200;
  const STARTUP_AUTOPLAY_PAUSE_GRACE_MS = 3600;

  let seekingActive = false;
  let squelchMuteEvents = 0;
  let suppressMirrorUntil = 0;
  const MUTE_SQUELCH_MS = 500;

  let seekRecoveryToken = 0;
  const seekRecoveryTimers = new Set();

  let startupPhase = true;
  let firstPlayCommitted = false;
  let startupAutoplayKickDone = false;
  let startupAutoplayKickInFlight = false;
  let audioEverStarted = false;
  const startupPrimeStartedAt = performance.now();

  try { videoEl.loop = false; videoEl.removeAttribute?.("loop"); } catch {}
  try { audio.loop = false; audio.removeAttribute?.("loop"); } catch {}

  const clamp01 = v => Math.max(0, Math.min(1, Number(v)));
  const EPS = 1.0;
  const HAVE_FUTURE_DATA = 3;
  const HAVE_ENOUGH_DATA = 4;
  const STRICT_BUFFER_AHEAD_SEC = 0.18;
  const STARTUP_BUFFER_AHEAD_SEC = 0.9;
  const MICRO_DRIFT = 0.08;
  const BIG_DRIFT = 1.5;
  const SYNC_INTERVAL_MS = 300;

  const pickAudioSrc = () => {
    const s = audio?.getAttribute?.("src");
    if (s) return s;
    const child = audio?.querySelector?.("source");
    if (child?.getAttribute?.("src")) return child.getAttribute("src");
    if (audio?.currentSrc) return audio.currentSrc;
    return null;
  };

  const hasExternalAudio = !!audio && audio.tagName === "AUDIO" && !!pickAudioSrc();
  let startupBufferPrimed = !hasExternalAudio;

  let syncInterval = null;
  let lastAT = 0, lastATts = 0;
  let audioLastProgressTs = 0;
  let aligning = false;

  let squelchAudioEventsUntil = 0;
  const AUDIO_EVENT_SQUELCH_MS = 450;

  function squelchAudioEvents(ms = AUDIO_EVENT_SQUELCH_MS) {
    squelchAudioEventsUntil = performance.now() + ms;
  }

  function audioEventsSquelched() {
    return performance.now() < squelchAudioEventsUntil;
  }

  function clearSeekRecoveryTimers() {
    for (const t of seekRecoveryTimers) clearTimeout(t);
    seekRecoveryTimers.clear();
  }

  function queuePostSeekRecovery() {
    if (!hasExternalAudio) return;

    if (postSeekSmoothActive()) {
      if (!restarting && !seekingActive && !syncing && intendedPlaying && !mediaSessionForcedPauseActive()) {
        if (!isVideoPaused() && audio.paused && !strictBufferHold && !shouldBlockNewAudioStart()) {
          execProgrammaticAudioPlay({ squelchMs: 260, minGapMs: 60, force: true }).catch(() => false);
        }
      }
      return;
    }

    const token = ++seekRecoveryToken;
    clearSeekRecoveryTimers();

    const steps = [0, 80, 180, 360, 650, 950];

    for (const delay of steps) {
      const tid = setTimeout(async () => {
        seekRecoveryTimers.delete(tid);

        if (token !== seekRecoveryToken) return;
        if (restarting || seekingActive || syncing || !intendedPlaying) return;

        const vt = Number(video.currentTime());
        const at = Number(audio.currentTime);
        if (!isFinite(vt)) return;

        const holdAudio =
          (androidResumeGuardActive() && isVideoPaused()) ||
          (document.visibilityState === "hidden" && shouldUseBgControllerRetry() && isVideoPaused()) ||
          shouldBlockNewAudioStart();

        if (!isFinite(at) || Math.abs(at - vt) > 0.18) {
          squelchAudioEvents(220);
          safeSetCT(audio, vt);
        }

        if (!holdAudio && audio.paused) {
          try {
            await execProgrammaticAudioPlay({ squelchMs: 260, minGapMs: 80 });
          } catch {}
        }

        const vt2 = Number(video.currentTime());
        const at2 = Number(audio.currentTime);
        if (isFinite(vt2) && (!isFinite(at2) || Math.abs(at2 - vt2) > 0.18)) {
          squelchAudioEvents(220);
          safeSetCT(audio, vt2);
        }

        if (!syncing && !seekingActive) {
          playTogether().catch(() => {});
        }
      }, delay);

      seekRecoveryTimers.add(tid);
    }
  }

  function queueSeekResumeBurst() {
    if (postSeekSmoothActive()) {
      if (!restarting && !seekingActive && !syncing && intendedPlaying && !mediaSessionForcedPauseActive()) {
        if (!isVideoPaused() && audio.paused && !strictBufferHold && !shouldBlockNewAudioStart()) {
          execProgrammaticAudioPlay({ squelchMs: 260, minGapMs: 60, force: true }).catch(() => false);
        }
      }
      return;
    }

    const steps = [0, 70, 160, 320, 520, 820];
    const token = ++seekRecoveryToken;

    for (const delay of steps) {
      const tid = setTimeout(async () => {
        seekRecoveryTimers.delete(tid);

        if (token !== seekRecoveryToken) return;
        if (restarting || syncing || seekingActive || !intendedPlaying) return;

        const isHidden = document.visibilityState === "hidden";
        const vPaused = isVideoPaused();
        const holdAudio =
          (androidResumeGuardActive() && vPaused) ||
          (isHidden && shouldUseBgControllerRetry() && vPaused) ||
          shouldBlockNewAudioStart();

        const vt = Number(video.currentTime());
        if (isFinite(vt) && Math.abs(Number(audio.currentTime) - vt) > 0.18) safeSetCT(audio, vt);

        if (!holdAudio) {
          await execProgrammaticAudioPlay({ squelchMs: 360, minGapMs: 60 }).catch(() => false);
          updateAudioGainImmediate();
        }

        if (!syncing) playTogether().catch(() => {});
      }, delay);

      seekRecoveryTimers.add(tid);
    }
  }

  let volAnim = null;

  function setImmediateVolume(val) {
    try { audio.volume = clamp01(val); } catch {}
  }

  function targetVolFromVideo() {
    const vVol = clamp01(typeof video.volume === "function" ? video.volume() : (videoEl.volume ?? 1));
    const vMuted = !!(typeof video.muted === "function" ? video.muted() : videoEl.muted);
    const hardMuted = vMuted || userMutedVideo;
    return hardMuted ? 0 : vVol;
  }

  function rampVolumeTo(target, ms = 60) {
    target = clamp01(target);
    const from = clamp01(audio.volume);

    if (!isFinite(from) || ms <= 0 || Math.abs(target - from) < 0.001 || document.visibilityState === "hidden") {
      setImmediateVolume(target);
      return Promise.resolve();
    }

    if (volAnim && volAnim.cancel) volAnim.cancel(true);
    let cancelFlag = false;
    volAnim = { cancel: (v) => { cancelFlag = !!v; } };

    const start = performance.now();
    return new Promise(resolve => {
      const step = () => {
        if (cancelFlag) return resolve();
        const t = Math.min(1, (performance.now() - start) / ms);
        const val = from + (target - from) * t;
        setImmediateVolume(val);
        if (t < 1) requestAnimationFrame(step);
        else resolve();
      };
      requestAnimationFrame(step);
    });
  }

  async function softUnmuteAudio(ms = 60) { await rampVolumeTo(targetVolFromVideo(), ms); }
  function updateAudioGainImmediate() { setImmediateVolume(targetVolFromVideo()); }

  async function softAlignAudioTo(t) {
    if (aligning) return;
    aligning = true;
    try {
      safeSetCT(audio, t);
      if (intendedPlaying) updateAudioGainImmediate();
    } finally {
      aligning = false;
    }
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
      if (!isFinite(t)) return false;
      const rs = Number(media.readyState || 0);
      const ahead = bufferedAhead(media, t);

      if (rs >= HAVE_ENOUGH_DATA) return true;
      if (rs >= HAVE_FUTURE_DATA && ahead >= Math.min(0.08, minAhead)) return true;
      if (t < 0.5 && rs >= 2 && ahead >= Math.min(0.08, minAhead)) return true;

      return ahead >= minAhead;
    } catch {
      return false;
    }
  }

  function canPlayAt(media, t) {
    try {
      const rs = Number(media.readyState || 0);
      if (!isFinite(t)) return false;
      if (rs >= 3) return true;
      if (t < 0.5 && rs >= 2) return true;
      return timeInBuffered(media, t);
    } catch {
      return false;
    }
  }

  function canStartAudioAt(t) {
    try {
      if (!hasExternalAudio) return false;
      const rs = Number(audio.readyState || 0);
      if (rs >= 2) return true;
      return canPlayAt(audio, t);
    } catch {
      return false;
    }
  }

  function bothPlayableAt(t) {
    const v = getPlayableVideoEl() || videoEl;
    return canPlaySmoothAt(v, t, STRICT_BUFFER_AHEAD_SEC) && canPlaySmoothAt(audio, t, STRICT_BUFFER_AHEAD_SEC);
  }

  function bothStartupBufferedAt(t) {
    const v = getPlayableVideoEl() || videoEl;
    return canPlaySmoothAt(v, t, STARTUP_BUFFER_AHEAD_SEC) && canPlaySmoothAt(audio, t, STARTUP_BUFFER_AHEAD_SEC);
  }

  function safeSetCT(media, t) {
    try {
      if (isFinite(t) && t >= 0) media.currentTime = t;
    } catch {}
  }

  let bgHiddenSince = 0;
  let bgHiddenBaseVT = 0;
  let bgHiddenBaseAT = 0;
  let bgHiddenBaseRate = 1;
  let bgHiddenWasPlaying = false;
  let bgHiddenReason = "";
  let bgCatchUpToken = 0;
  let bgCatchUpInFlight = false;
  let bgCatchUpCooldownUntil = 0;

  let bgAudioMasterMode = false;
  let bgAudioMasterEnteredAt = 0;

  let bgHiddenStoppedSyncLoop = false;

  let bgCatchUpExpectedTime = NaN;
  let bgRateBoostUntil = 0;
  let bgRateBoostBaseRate = 1;
  let bgRateBoostFactor = 1;

  let resumeSyncRestartTimer = null;

  function clearResumeSyncRestartTimer() {
    if (resumeSyncRestartTimer) {
      clearTimeout(resumeSyncRestartTimer);
      resumeSyncRestartTimer = null;
    }
  }

  function scheduleResumeSyncRestart(delay = 180) {
    clearResumeSyncRestartTimer();
    resumeSyncRestartTimer = setTimeout(() => {
      resumeSyncRestartTimer = null;
      if (!intendedPlaying) return;
      if (userPauseLockActive() || hardPauseLatchActive()) return;
      if (document.visibilityState !== "visible") return;
      if (restarting || seekingActive) return;
      if (!syncInterval) startSyncLoop();
    }, Math.max(0, Number(delay) || 0));
  }

  function waitForSeekSettle(media, timeoutMs = 180) {
    return new Promise(resolve => {
      let done = false;
      let to = null;

      const finish = () => {
        if (done) return;
        done = true;
        try { if (to) clearTimeout(to); } catch {}
        try { media.removeEventListener("seeked", onEvt); } catch {}
        try { media.removeEventListener("canplay", onEvt); } catch {}
        try { media.removeEventListener("loadeddata", onEvt); } catch {}
        resolve();
      };

      const onEvt = () => finish();

      try {
        if (!media || !media.seeking) return resolve();
      } catch {
        return resolve();
      }

      try { media.addEventListener("seeked", onEvt, { once: true, passive: true }); } catch {}
      try { media.addEventListener("canplay", onEvt, { once: true, passive: true }); } catch {}
      try { media.addEventListener("loadeddata", onEvt, { once: true, passive: true }); } catch {}

      to = setTimeout(finish, timeoutMs);
    });
  }

  function getBufferedEnd(media) {
    try {
      const br = media?.buffered;
      if (!br || br.length === 0) return NaN;
      return Number(br.end(br.length - 1));
    } catch {}
    return NaN;
  }

  function safeSetVideoTime(t) {
    try { if (isFinite(t) && t >= 0) video.currentTime(t); } catch {}
    try { safeSetCT(videoEl, t); } catch {}
    try {
      const v = getPlayableVideoEl();
      if (v && v !== videoEl) safeSetCT(v, t);
    } catch {}
  }

  function safeFastSeek(media, t) {
    try {
      if (!media) return false;
      if (!isFinite(t) || t < 0) return false;
      if (typeof media.fastSeek === "function") {
        media.fastSeek(t);
        return true;
      }
    } catch {}
    return false;
  }

  function resetBgRateBoost() {
    bgCatchUpExpectedTime = NaN;
    bgRateBoostUntil = 0;
    try {
      video.playbackRate(bgRateBoostBaseRate || 1);
    } catch {}
  }

  function cancelBackgroundResumeState() {
    resumeOnVisible = false;
    bgAutoResumeSuppressed = false;
    bgHiddenWasPlaying = false;
    bgHiddenSince = 0;
    bgHiddenReason = "";
    bgAudioMasterMode = false;
    bgHiddenStoppedSyncLoop = false;
    pauseGuard = 0;
    mediaPlayTxnUntil = 0;
    bgControllerPlayGuardUntil = 0;
    resumeWarmUntil = 0;
    smoothNoHoldUntil = 0;
    explicitPlayUntil = 0;
    chromiumBgSettlingUntil = 0;
    hiddenTransitionAt = 0;
    cancelHiddenTransientResume();
    clearBgResumeRetryTimer();
    clearResumeSyncRestartTimer();
    resetBgRateBoost();
  }

  function commitUserPause() {
    markMediaAction("pause");
    markUserPauseIntent(2600);
    setMediaSessionForcedPause(3200);
    clearPendingPlayResumesForPause();
    syncing = false;
    strictBufferHold = false;
    strictBufferHoldReason = "";
    strictBufferMissCount = 0;
    strictBufferHoldMinUntil = 0;
    intendedPlaying = false;
    updateMediaSessionPlaybackState();
    pauseHard(220);
    queueHardPauseVerification();
  }

  function noteBackgroundEntry(reason = "hidden") {
    try {
      if (!hasExternalAudio || qua === "medium") return;
      if (!shouldUseBgControllerRetry()) return;
      if (!intendedPlaying) {
        bgHiddenWasPlaying = false;
        bgHiddenSince = performance.now();
        bgHiddenReason = String(reason || "");
        bgAudioMasterMode = false;
        return;
      }
      bgHiddenSince = performance.now();
      bgHiddenReason = String(reason || "");
      bgHiddenWasPlaying = true;

      try { bgHiddenBaseVT = Number(video.currentTime()) || 0; } catch { bgHiddenBaseVT = 0; }
      try { bgHiddenBaseAT = Number(audio.currentTime) || bgHiddenBaseVT; } catch { bgHiddenBaseAT = bgHiddenBaseVT; }
      try { bgHiddenBaseRate = Number(video.playbackRate()) || 1; } catch { bgHiddenBaseRate = 1; }

      try {
        const at = Number(audio.currentTime);
        if (isFinite(at) && at > bgHiddenBaseVT) bgHiddenBaseVT = at;
      } catch {}

      try { bgAudioMasterMode = !audio.paused; } catch { bgAudioMasterMode = false; }
      bgAudioMasterEnteredAt = performance.now();
    } catch {}
  }

  function estimateExpectedTimeFromBg(now = performance.now()) {
    try {
      if (!bgHiddenSince) return NaN;
      const base = isFinite(bgHiddenBaseVT) ? bgHiddenBaseVT : 0;
      const rate = (isFinite(bgHiddenBaseRate) && bgHiddenBaseRate > 0) ? bgHiddenBaseRate : 1;
      const elapsed = Math.max(0, (Number(now) - Number(bgHiddenSince)) / 1000);
      return base + elapsed * rate;
    } catch {
      return NaN;
    }
  }

  function armBgRateBoost(expected) {
    try {
      const base = Number(video.playbackRate()) || 1;
      bgRateBoostBaseRate = base;

      const vt = Number(video.currentTime());
      const delta = isFinite(vt) && isFinite(expected) ? Math.max(0, expected - vt) : 0;

      let factor = 1;
      if (delta > 0.45) factor = 1.08;
      if (delta > 1.20) factor = 1.11;
      if (delta > 2.40) factor = 1.14;
      factor = Math.max(1, Math.min(1.16, factor));

      bgRateBoostFactor = factor;
      bgCatchUpExpectedTime = expected;
      bgRateBoostUntil = performance.now() + Math.min(4800, Math.max(1200, delta * 1000));
    } catch {}
  }

  function applyBgRateBoostIfNeeded() {
    try {
      if (!isFinite(bgCatchUpExpectedTime)) return;
      if (performance.now() > bgRateBoostUntil) {
        resetBgRateBoost();
        return;
      }

      const vt = Number(video.currentTime());
      const remaining = isFinite(vt) ? (bgCatchUpExpectedTime - vt) : 0;

      if (remaining <= 0.20) {
        resetBgRateBoost();
        return;
      }

      if (document.visibilityState !== "visible") return;
      if (!intendedPlaying) return;
      if (userPauseLockActive()) return;

      const targetRate = bgRateBoostBaseRate * bgRateBoostFactor;
      try {
        const cur = Number(video.playbackRate()) || 1;
        if (Math.abs(cur - targetRate) > 0.001) video.playbackRate(targetRate);
      } catch {}
    } catch {}
  }

  async function softResumeAfterBgSeek(target, token) {
    const v = getPlayableVideoEl() || videoEl;

    try {
      if (isChromiumOnlyBrowser()) {
        setChromiumBgSettling(900);
        setChromiumAudioStartLock(520);
      }

      squelchAudioEvents(900);

      safeFastSeek(videoEl, target);
      try {
        if (v && v !== videoEl) safeFastSeek(v, target);
      } catch {}
      safeFastSeek(audio, target);

      safeSetVideoTime(target);
      safeSetCT(audio, target);

      await Promise.allSettled([
        waitForSeekSettle(v, 180),
        waitForSeekSettle(audio, 180)
      ]);

      if (typeof token === "number" && token !== bgCatchUpToken) return false;
      if (userPauseLockActive()) return false;

      const vReady = canPlayAt(v, target) || Number(v.readyState || 0) >= 2;
      const aReady = canStartAudioAt(target) || Number(audio.readyState || 0) >= 2;

      if (!(vReady && aReady)) {
        strictBufferHold = true;
        strictBufferHoldReason = "bg-resume-buffer";
        strictBufferHoldMinUntil = Math.max(strictBufferHoldMinUntil, performance.now() + 380);
        armResumeAfterBuffer(8000);
        return false;
      }

      let vp = null;
      let ap = null;

      try {
        if (isVideoPaused()) vp = execProgrammaticVideoPlay();
      } catch {}

      try {
        if (audio.paused && !shouldBlockNewAudioStart()) {
          ap = execProgrammaticAudioPlay({
            squelchMs: 320,
            minGapMs: 0,
            force: true
          });
        }
      } catch {}

      try {
        await Promise.allSettled([vp, ap]);
      } catch {}

      if (userPauseLockActive()) {
        commitUserPause();
        return false;
      }

      forceUnmuteForPlaybackIfAllowed();
      updateAudioGainImmediate();
      scheduleResumeSyncRestart(120);

      return !isVideoPaused();
    } catch {
      return false;
    }
  }

  async function seamlessBgCatchUp(reason = "resume") {
    try {
      if (!hasExternalAudio || qua === "medium") return;
      if (!shouldUseBgControllerRetry()) return;
      if (!bgHiddenWasPlaying && !resumeOnVisible) return;
      if (!intendedPlaying) return;
      if (restarting || seekingActive || syncing) return;
      if (mediaSessionForcedPauseActive()) return;
      if (userPauseLockActive()) return;

      if (isChromiumOnlyBrowser()) {
        setChromiumBgSettling(700);
        setChromiumAudioStartLock(220);
      }

      const now = performance.now();
      if (now < bgCatchUpCooldownUntil) return;
      bgCatchUpCooldownUntil = now + 180;

      const token = ++bgCatchUpToken;
      bgCatchUpInFlight = true;

      let vtNow = NaN, atNow = NaN;
      let vPausedNow = true, aPausedNow = true;
      try { vtNow = Number(video.currentTime()); } catch {}
      try { atNow = Number(audio.currentTime); } catch {}
      try { vPausedNow = isVideoPaused(); } catch { vPausedNow = true; }
      try { aPausedNow = !!audio.paused; } catch { aPausedNow = true; }

      const driftNow = (isFinite(vtNow) && isFinite(atNow)) ? Math.abs(atNow - vtNow) : 0;

      if (!aPausedNow && isFinite(atNow)) {
        const dur = Number(video.duration()) || 0;
        let target = atNow;
        if (dur > 0) target = Math.min(target, Math.max(0, dur - 0.25));

        if (!isFinite(vtNow) || Math.abs(target - vtNow) > 0.16 || vPausedNow) {
          safeFastSeek(videoEl, target);
          safeSetVideoTime(target);
        }

        markExplicitPlay(15000);
        setResumeWarm(2000);
        setSmoothNoHold(1600);
        setPauseEventGuard(1200);
        setMediaPlayTxn(1800);
        setBgControllerPlayGuard(2200);
        setAndroidResumeGuard(1800);
        clearPlayStartFriction();

        strictBufferHold = false;
        strictBufferHoldReason = "";
        strictBufferMissCount = 0;
        strictBufferHoldMinUntil = 0;

        forceUnmuteForPlaybackIfAllowed();
        updateAudioGainImmediate();

        if (vPausedNow && !inMediaTxnWindow()) {
          try { await settlePlaybackKick(execProgrammaticVideoPlay(), 120); } catch {}
        }

        armBgRateBoost(target);
        scheduleResumeSyncRestart(100);

        bgHiddenWasPlaying = false;
        bgHiddenSince = 0;
        resumeOnVisible = false;
        bgAudioMasterMode = false;
        bgHiddenStoppedSyncLoop = false;
        return;
      }

      let expected = estimateExpectedTimeFromBg(now);
      if (!isFinite(expected) || expected < 0) expected = isFinite(vtNow) ? vtNow : 0;

      const dur2 = Number(video.duration()) || 0;
      if (dur2 > 0) expected = Math.min(expected, Math.max(0, dur2 - 0.25));

      const needsIntervention = vPausedNow || aPausedNow || driftNow > 0.24 || resumeOnVisible || bgHiddenWasPlaying;
      if (!needsIntervention) {
        bgHiddenWasPlaying = false;
        bgHiddenSince = 0;
        resumeOnVisible = false;
        bgAudioMasterMode = false;
        bgHiddenStoppedSyncLoop = false;
        scheduleResumeSyncRestart(100);
        return;
      }

      const volTarget = clamp01(targetVolFromVideo());
      const doFadeIn = (document.visibilityState === "visible") && volTarget > 0.001 && !userMutedAudio;

      if (doFadeIn) {
        try { await rampVolumeTo(0, 18); } catch {}
      }

      markExplicitPlay(15000);
      setResumeWarm(2000);
      setSmoothNoHold(1500);
      setPauseEventGuard(1600);
      setMediaPlayTxn(2200);
      setBgControllerPlayGuard(2400);
      setAndroidResumeGuard(1800);
      clearPlayStartFriction();

      strictBufferHold = false;
      strictBufferHoldReason = "";
      strictBufferMissCount = 0;
      strictBufferHoldMinUntil = 0;

      clearMediaSessionForcedPause();
      forceUnmuteForPlaybackIfAllowed();
      updateAudioGainImmediate();

      await softResumeAfterBgSeek(expected, token);

      if (userPauseLockActive()) return;

      armBgRateBoost(expected);

      if (doFadeIn) {
        setTimeout(() => {
          if (token !== bgCatchUpToken) return;
          if (!intendedPlaying) return;
          if (userPauseLockActive()) return;
          rampVolumeTo(volTarget, 70).catch(() => {});
        }, 8);
      } else {
        updateAudioGainImmediate();
      }

      bgHiddenWasPlaying = false;
      bgHiddenSince = 0;
      resumeOnVisible = false;
      bgAudioMasterMode = false;
      bgHiddenStoppedSyncLoop = false;
    } catch {
    } finally {
      bgCatchUpInFlight = false;
    }
  }

  function waitForReadyStateOrCanPlay(media, minRS = 3, timeoutMs = 3200) {
    return new Promise(resolve => {
      let done = false;
      let to = null;

      const finish = (ok) => {
        if (done) return;
        done = true;
        try {
          if (to) clearTimeout(to);
        } catch {}
        try { media.removeEventListener("canplay", onEvt); } catch {}
        try { media.removeEventListener("canplaythrough", onEvt); } catch {}
        try { media.removeEventListener("loadeddata", onEvt); } catch {}
        try { media.removeEventListener("seeked", onEvt); } catch {}
        resolve(!!ok);
      };

      const onEvt = () => {
        try {
          if (Number(media.readyState || 0) >= minRS) {
            finish(true);
            return;
          }
        } catch {}
        requestAnimationFrame(() => {
          try {
            if (Number(media.readyState || 0) >= minRS) {
              finish(true);
            }
          } catch {}
        });
      };

      try {
        if (Number(media.readyState || 0) >= minRS) return resolve(true);
      } catch {}

      try { media.addEventListener("canplay", onEvt, { once: true, passive: true }); } catch {}
      try { media.addEventListener("canplaythrough", onEvt, { once: true, passive: true }); } catch {}
      try { media.addEventListener("loadeddata", onEvt, { once: true, passive: true }); } catch {}
      try { media.addEventListener("seeked", onEvt, { once: true, passive: true }); } catch {}

      to = setTimeout(() => finish(false), timeoutMs);
    });
  }

  function clearSeekSyncFinishTimer() {
    if (seekSyncFinishTimer) {
      clearTimeout(seekSyncFinishTimer);
      seekSyncFinishTimer = null;
    }
  }

  function clearSeekSyncRetryTimer() {
    if (seekSyncRetryTimer) {
      clearTimeout(seekSyncRetryTimer);
      seekSyncRetryTimer = null;
    }
  }

  function scheduleSeekSyncRetry(delay = 60) {
    clearSeekSyncRetryTimer();
    seekSyncRetryTimer = setTimeout(() => {
      seekSyncRetryTimer = null;
      finalizeSeekSync().catch(() => {});
    }, Math.max(0, Number(delay) || 0));
  }

  function scheduleSeekSyncFinalize(delay = 0) {
    clearSeekSyncFinishTimer();
    seekSyncFinishTimer = setTimeout(() => {
      seekSyncFinishTimer = null;
      finalizeSeekSync().catch(() => {});
    }, delay);
  }

  async function finalizeSeekSync() {
    if (seekSyncFinishing) return;
    if (restarting) return;
    if (!seekingActive) return;

    const token = seekSyncToken;
    if (!seekSyncVideoSeeked) return;

    const now0 = performance.now();
    if (!seekSyncRetryUntil) seekSyncRetryUntil = now0 + 2600;

    try {
      if (!seekSyncAudioSeeked) {
        let vt0 = NaN;
        let at0 = NaN;
        let aSeeking = false;

        try { vt0 = Number(video.currentTime()); } catch {}
        try { at0 = Number(audio.currentTime); } catch {}
        try { aSeeking = !!audio.seeking; } catch {}

        if (isFinite(vt0)) {
          try {
            if (!isFinite(at0) || Math.abs(at0 - vt0) > 0.03) {
              squelchAudioEvents(520);
              safeSetCT(audio, vt0);
            }
          } catch {}
        }

        if (performance.now() < seekSyncRetryUntil) {
          if (aSeeking || !isFinite(vt0) || !isFinite(at0) || Math.abs(at0 - vt0) > 0.06) {
            scheduleSeekSyncRetry(60);
            return;
          }
        }

        try {
          const vt1 = Number(video.currentTime());
          const at1 = Number(audio.currentTime);
          const aSeeking2 = !!audio.seeking;

          if (!aSeeking2 && isFinite(vt1) && isFinite(at1) && Math.abs(at1 - vt1) < 0.25) {
            seekSyncAudioSeeked = true;
          } else if (performance.now() >= seekSyncRetryUntil) {
            seekSyncAudioSeeked = true;
          } else {
            scheduleSeekSyncRetry(60);
            return;
          }
        } catch {
          if (performance.now() >= seekSyncRetryUntil) {
            seekSyncAudioSeeked = true;
          } else {
            scheduleSeekSyncRetry(60);
            return;
          }
        }
      }
    } catch {}

    if (!seekSyncAudioSeeked) return;

    seekSyncFinishing = true;
    try {
      const v = getPlayableVideoEl() || videoEl;
      const vt = Number(video.currentTime());
      if (isFinite(vt)) safeSetCT(audio, vt);

      if (!isVideoPaused()) execProgrammaticVideoPause();
      if (!audio.paused) execProgrammaticAudioPause(300);

      const vReady = await waitForReadyStateOrCanPlay(v, 3, 3200);
      const aReady = await waitForReadyStateOrCanPlay(audio, 3, 3200);

      if (token !== seekSyncToken) return;

      strictBufferCoolDownUntil = Math.max(strictBufferCoolDownUntil, performance.now() + 900);
      strictBufferMissCount = 0;

      try {
        audioPlayAttemptUntil = 0;
        audioPauseInFlightUntil = 0;
      } catch {}

      seekingActive = false;
      firstSeekDone = true;

      seekSyncRetryUntil = 0;
      clearSeekSyncRetryTimer();

      const shouldHoldAfterSeek =
        (androidResumeGuardActive() && isVideoPaused()) ||
        (document.visibilityState === "hidden" && shouldUseBgControllerRetry() && isVideoPaused());

      if (!seekSyncWantedPlaying || !intendedPlaying || mediaSessionForcedPauseActive()) {
        execProgrammaticVideoPause();
        execProgrammaticAudioPause(300);
        return;
      }

      if (!(vReady && aReady)) {
        strictBufferHold = true;
        strictBufferHoldReason = "seek-buffer";
        strictBufferHoldMinUntil = Math.max(strictBufferHoldMinUntil, performance.now() + 450);
        armResumeAfterBuffer(8000);
        return;
      }

      strictBufferHold = false;
      strictBufferHoldReason = "";

      setPostSeekSmooth(1100);
      setSmoothNoHold(1100);

      squelchAudioEvents(520);
      await ensureUnmutedIfNotUserMuted().catch(() => {});
      const vt2 = Number(video.currentTime());
      if (isFinite(vt2)) safeSetCT(audio, vt2);

      if (!shouldHoldAfterSeek) {
        playTogether().catch(() => {});
        queuePostSeekRecovery();
      } else {
        resumeOnVisible = true;
      }
    } finally {
      seekSyncFinishing = false;
    }
  }

  function enforceStrictBufferSync(reason = "") {
    if (!hasExternalAudio || qua === "medium") return;
    if (restarting || seekingActive || syncing) return;
    if (document.visibilityState === "hidden" && bgAudioMasterMode) return;

    const now = performance.now();
    if (now < strictBufferCoolDownUntil && !strictBufferHold) return;
    if (smoothNoHoldActive() && !strictBufferHold) return;

    if (!intendedPlaying) {
      strictBufferHold = false;
      strictBufferHoldReason = "";
      strictBufferMissCount = 0;
      strictBufferHoldMinUntil = 0;
      return;
    }
    if (mediaSessionForcedPauseActive()) return;

    if (!audioEverStarted && startupPhase) {
      strictBufferHold = false;
      strictBufferHoldReason = "";
      strictBufferMissCount = 0;
      strictBufferHoldMinUntil = 0;
      return;
    }

    const vt = Number(video.currentTime());
    if (!isFinite(vt)) return;

    const v = getPlayableVideoEl() || videoEl;

    let videoWaitingHint = false;
    try {
      videoWaitingHint = !!video.hasClass("vjs-waiting");
    } catch {}

    const videoNeedsBuffer = videoWaitingHint || !canPlaySmoothAt(v, vt, STRICT_BUFFER_AHEAD_SEC);
    const audioNeedsBuffer = !canPlaySmoothAt(audio, vt, STRICT_BUFFER_AHEAD_SEC);

    if (videoNeedsBuffer || audioNeedsBuffer) {
      strictBufferMissCount = Math.min(6, strictBufferMissCount + 1);

      const enterHold = strictBufferHold || videoWaitingHint || strictBufferMissCount >= 2;
      if (!enterHold) return;

      strictBufferHold = true;
      strictBufferHoldReason = reason || (videoNeedsBuffer ? "video" : "audio");
      strictBufferHoldMinUntil = Math.max(strictBufferHoldMinUntil, now + 520);

      if (!isVideoPaused()) execProgrammaticVideoPause();
      if (!audio.paused) execProgrammaticAudioPause(300);

      safeSetCT(audio, vt);

      armResumeAfterBuffer(8000);
      return;
    }

    strictBufferMissCount = 0;

    if (strictBufferHold) {
      if (now < strictBufferHoldMinUntil) return;

      strictBufferHold = false;
      strictBufferHoldReason = "";
      strictBufferHoldMinUntil = 0;
      strictBufferCoolDownUntil = Math.max(strictBufferCoolDownUntil, now + 450);

      setSmoothNoHold(850);

      if (!inMediaTxnWindow()) {
        playTogether().catch(() => {});
      }
    }
  }

  let rvfcHandle = null;
  const useRVFC = !!videoEl.requestVideoFrameCallback;

  function clearSyncLoop() {
    if (syncInterval) {
      clearInterval(syncInterval);
      syncInterval = null;
    }
    try { audio.playbackRate = Number(video.playbackRate()) || 1; } catch {}
    if (rvfcHandle != null) {
      try { videoEl.cancelVideoFrameCallback(rvfcHandle); } catch {}
      rvfcHandle = null;
    }
  }

  async function ensureUnmutedIfNotUserMuted() {
    if (startupPhase) {
      if (intendedPlaying) {
        forceUnmuteForPlaybackIfAllowed();
      }
      updateAudioGainImmediate();
      return;
    }
    await softUnmuteAudio(80);
  }

  let lastVT = 0;
  let lastVTts = 0;
  let videoRepairing = false;
  let videoRepairCooldownUntil = 0;

  async function kickVideo() {
    if (videoRepairing) return;
    if (performance.now() < videoRepairCooldownUntil) return;

    videoRepairing = true;
    videoRepairCooldownUntil = performance.now() + 3000;

    try {
      const v = getPlayableVideoEl();
      const t = Number(video.currentTime()) || 0;

      try {
        execProgrammaticAudioPause(700);
      } catch {}

      try { execProgrammaticVideoPause(); } catch {}

      const nudge = Math.max(0, t + 0.001);
      try {
        safeSetCT(videoEl, nudge);
        if (v && v !== videoEl) safeSetCT(v, nudge);
      } catch {}

      await new Promise(r => setTimeout(r, 80));

      try { await Promise.resolve(execProgrammaticVideoPlay()); } catch {}

      if (!isVideoPaused()) {
        try {
          const vt = Number(video.currentTime()) || t;
          safeSetCT(audio, vt);
          if (!shouldBlockNewAudioStart()) {
            await execProgrammaticAudioPlay({ squelchMs: 700, force: true, minGapMs: 0 }).catch(() => false);
          }
          updateAudioGainImmediate();
        } catch {}
      }
    } finally {
      videoRepairing = false;
    }
  }

  function startFrameSyncLoop() {
    if (!useRVFC) return;

    const step = () => {
      if (!intendedPlaying) {
        rvfcHandle = videoEl.requestVideoFrameCallback(step);
        return;
      }

      const vt = Number(video.currentTime());
      const at = Number(audio.currentTime);

      if (isFinite(vt) && isFinite(at)) {
        const delta = vt - at;
        const baseRate = Number(video.playbackRate()) || 1;

        if (postSeekSmoothActive() || smoothNoHoldActive()) {
          try {
            if (Math.abs(audio.playbackRate - baseRate) > 0.01) audio.playbackRate = baseRate;
          } catch {}
        } else {
          if (Math.abs(delta) > BIG_DRIFT) {
            softAlignAudioTo(vt);
          } else if (Math.abs(delta) > MICRO_DRIFT) {
            const targetRate = baseRate + (delta * 0.08);
            try { audio.playbackRate = Math.max(baseRate * 0.97, Math.min(baseRate * 1.03, targetRate)); } catch {}
          } else {
            try {
              if (Math.abs(audio.playbackRate - baseRate) > 0.01) audio.playbackRate = baseRate;
            } catch {}
          }
        }
      }

      rvfcHandle = videoEl.requestVideoFrameCallback(step);
    };

    rvfcHandle = videoEl.requestVideoFrameCallback(step);
  }

  function startSyncLoop() {
    clearSyncLoop();

    audioLastProgressTs = performance.now();
    syncInterval = setInterval(() => {
      if (!hasExternalAudio) return;

      const vt = Number(video.currentTime());
      const at = Number(audio.currentTime);
      if (!isFinite(vt) || !isFinite(at)) return;

      const isHidden = document.visibilityState === "hidden";
      const bgRetryBrowser = shouldUseBgControllerRetry();

      if (isHidden && bgRetryBrowser && intendedPlaying && !mediaSessionForcedPauseActive()) {
        resumeOnVisible = true;
        if (!bgHiddenSince) {
          try { noteBackgroundEntry("sync-hidden"); } catch {}
        }

        if (!audio.paused && isVideoPaused()) {
          bgAudioMasterMode = true;
        }

        return;
      }

      if (!isHidden) {
        applyBgRateBoostIfNeeded();
      }

      if (intendedPlaying && !restarting && !seekingActive && !syncing) {
        enforceStrictBufferSync("sync-loop");
      }

      const vPaused = isVideoPaused();
      const aPaused = audio.paused;
      const vWaiting = getVideoReadyState() < 3 || video.hasClass("vjs-waiting");
      if (intendedPlaying && hasExternalAudio && qua !== "medium") {
        if (vPaused === aPaused) {
          clearJointMismatch();
        } else {
          noteJointMismatch(vPaused ? "video-paused" : "audio-paused");
        }
      } else {
        clearJointMismatch();
      }

      if (intendedPlaying && !restarting && !seekingActive && !syncing) {
        if (strictBufferHold) {
          if (!vPaused) execProgrammaticVideoPause();
          if (!aPaused) {
            execProgrammaticAudioPause();
            safeSetCT(audio, vt);
          }
        } else if (vWaiting && (audioEverStarted || !canStartAudioAt(vt))) {
          if (!smoothNoHoldActive() && !aPaused) {
            execProgrammaticAudioPause();
            safeSetCT(audio, vt);
          }
        } else if (!vPaused && aPaused) {
          const now = performance.now();
          const mustHoldAudio =
            (androidResumeGuardActive() && isVideoPaused()) ||
            (bgRetryBrowser && isHidden && isVideoPaused()) ||
            strictBufferHold ||
            shouldBlockNewAudioStart();

          const canKickFirstAudio = !audioEverStarted && canStartAudioAt(vt);
          const warm =
            jointStartGraceActive() ||
            resumeWarmActive() ||
            explicitPlayActive() ||
            (now - lastPlayKickTs) < 520;

          if (mustHoldAudio) {
            if (!warm && coupledMismatchTooLong(420)) {
              holdCoupledPlayback("audio-not-starting");
            }
          } else if (now >= audioPauseInFlightUntil) {
            if (canKickFirstAudio || !startupAudioHoldActive()) {
              execProgrammaticAudioPlay({
                squelchMs: canKickFirstAudio ? 260 : 320,
                minGapMs: canKickFirstAudio ? 0 : 140,
                force: !!canKickFirstAudio
              }).catch(() => false);
              updateAudioGainImmediate();
              if (Math.abs(at - vt) > 0.8) safeSetCT(audio, vt);
            } else if (!warm && coupledMismatchTooLong(520)) {
              holdCoupledPlayback("audio-delayed");
            }
          } else if (!warm && coupledMismatchTooLong(520)) {
            holdCoupledPlayback("audio-inflight");
          }
        } else if (vPaused && !aPaused) {
          execProgrammaticAudioPause();
          if (Math.abs(at - vt) > 0.8) safeSetCT(audio, vt);

          if (intendedPlaying && !vWaiting && !strictBufferHold) {
            if (!(bgRetryBrowser && isHidden)) {
              if (!inMediaTxnWindow() && !userPauseLockActive() && !chromiumPauseToggleGuardActive()) playTogether().catch(() => {});
            } else {
              queueHiddenTransientResume("sync-loop-video-paused-hidden");
            }
          }
        } else if (vPaused && aPaused) {
          if (!vWaiting && !strictBufferHold && !userPauseLockActive() && !chromiumPauseToggleGuardActive()) {
            if (!(bgRetryBrowser && isHidden)) {
              if (!inMediaTxnWindow()) playTogether().catch(() => {});
            } else {
              queueHiddenTransientResume("sync-loop-both-paused-hidden");
            }
          }
        } else {
          if (Math.abs(at - vt) > 1.2) safeSetCT(audio, vt);
        }
      } else if (!intendedPlaying && !restarting && !seekingActive && !syncing) {
        if (!vPaused) execProgrammaticVideoPause();
        if (!aPaused) {
          execProgrammaticAudioPause();
        }
      }

      try {
        if ("mediaSession" in navigator && navigator.mediaSession.setPositionState) {
          navigator.mediaSession.setPositionState({
            duration: Number(video.duration()) || 0,
            playbackRate: Number(video.playbackRate()) || 1,
            position: vt
          });
        }
      } catch {}

      const now = performance.now();

      if (!audio.paused && intendedPlaying) {
        if (Math.abs(at - lastAT) > 0.002) {
          lastAT = at;
          lastATts = now;
          audioLastProgressTs = now;
        } else {
          if (!audioLastProgressTs) audioLastProgressTs = now;
          const canKickAudio =
            !vWaiting &&
            !isHidden &&
            !seekingActive &&
            !syncing &&
            !mediaActionLocked() &&
            !androidResumeGuardActive() &&
            !strictBufferHold &&
            now >= audioKickCooldownUntil &&
            !postSeekSmoothActive() &&
            !smoothNoHoldActive() &&
            !userPauseLockActive() &&
            !shouldBlockNewAudioStart();

          if (canKickAudio && (now - audioLastProgressTs) > 2200) {
            audioKickCooldownUntil = now + 2500;
            kickAudio().catch(() => {});
            audioLastProgressTs = now;
            lastATts = now;
          }
        }
      } else {
        lastAT = at;
        lastATts = now;
        audioLastProgressTs = now;
      }

      if (intendedPlaying && !vPaused) {
        if (Math.abs(vt - lastVT) < 0.001) {
          const shouldRepair = now - lastVTts > 2200 && !videoRepairing && !vWaiting && getVideoReadyState() >= 2 && !strictBufferHold && !userPauseLockActive();
          if (shouldRepair && isProblemMobileBrowser() && document.visibilityState === "visible") {
            kickVideo().catch(() => {});
            lastVTts = now;
          }
        } else {
          lastVT = vt;
          lastVTts = now;
        }
      } else {
        lastVT = vt;
        lastVTts = now;
      }

      if (intendedPlaying && !audio.paused && !userMutedVideo && !userMutedAudio) {
        if (audio.muted) {
          try { audio.muted = false; } catch {}
        }
        if (audio.volume <= 0.001 && (performance.now() - suppressMirrorUntil) > 400) {
          softUnmuteAudio(140);
        }
      }
    }, SYNC_INTERVAL_MS);

    if (useRVFC) startFrameSyncLoop();
  }

  async function kickAudio() {
    try {
      const vt = Number(video.currentTime());
      const at = Number(audio.currentTime);
      const target = isFinite(vt) ? vt : (isFinite(at) ? at : 0);

      execProgrammaticAudioPause(300);
      safeSetCT(audio, target);

      await new Promise(r => setTimeout(r, 30));

      if (intendedPlaying && !isVideoPaused() && !userPauseLockActive() && !shouldBlockNewAudioStart()) {
        await execProgrammaticAudioPlay({ squelchMs: 320, force: true, minGapMs: 0 }).catch(() => false);
        updateAudioGainImmediate();
      }
    } catch {}
  }

  function updateMediaSessionPlaybackState() {
    if (!("mediaSession" in navigator)) return;
    try {
      navigator.mediaSession.playbackState = intendedPlaying ? "playing" : "paused";
    } catch {}
  }

  function wantsStartupAutoplay() {
    try {
      const q = (qs.get("autoplay") || "").toLowerCase();
      if (q === "1" || q === "true" || q === "yes") return true;
    } catch {}

    try {
      if (window.forceAutoplay === true) return true;
    } catch {}

    try {
      if (videoEl?.autoplay || videoEl?.hasAttribute?.("autoplay")) return true;
    } catch {}

    try {
      if (typeof video.autoplay === "function") {
        const a = video.autoplay();
        if (a === true || a === "play" || a === "muted" || a === "any") return true;
      }
    } catch {}

    return false;
  }

  function startupAutoplayPauseGraceActive() {
    return wantsStartupAutoplay() && !firstPlayCommitted && (performance.now() - startupPrimeStartedAt) < STARTUP_AUTOPLAY_PAUSE_GRACE_MS;
  }

  function startupAutoplayAudioCatchupActive() {
    return startupAutoplayPauseGraceActive() && !audioEverStarted;
  }

  function scheduleStartupAutoplayKick() {
    if (!hasExternalAudio || qua === "medium") return;
    if (startupAutoplayKickDone || startupAutoplayKickInFlight) return;
    if (!startupBufferPrimed) return;
    if (!wantsStartupAutoplay() && !intendedPlaying) return;
    if (mediaSessionForcedPauseActive()) return;

    startupAutoplayKickInFlight = true;
    hardPauseVerifySerial += 1;

    setTimeout(async () => {
      try {
        if (!startupBufferPrimed || mediaSessionForcedPauseActive()) return;

        clearMediaSessionForcedPause();
        intendedPlaying = true;
        clearPlayStartFriction();
        updateMediaSessionPlaybackState();

        setPauseEventGuard(1400);
        setMediaPlayTxn(2200);
        setBgControllerPlayGuard(1600);
        markExplicitPlay(15000);
        setResumeWarm(1600);
        setSmoothNoHold(1100);
        setJointStartGrace(1200);
        if (isChromiumOnlyBrowser()) setChromiumAudioStartLock(120);

        const vt = Number(video.currentTime()) || 0;
        safeSetCT(audio, vt);

        try {
          const vp = execProgrammaticVideoPlay();
          if (vp && vp.then) await settlePlaybackKick(vp, 160);
        } catch {}

        if (isVideoPaused()) return;

        queuePlayRetryBurst();
        await playTogether().catch(() => {});

        if (!isVideoPaused()) {
          startupAutoplayKickDone = true;
        }
      } finally {
        startupAutoplayKickInFlight = false;
      }
    }, 0);
  }

  async function playTogether() {
    if (syncing || restarting) return;
    if (mediaSessionForcedPauseActive()) return;
    if (userPauseLockActive() || hardPauseLatchActive()) return;

    syncing = true;
    lastPlayKickTs = performance.now();

    try {
      if (!intendedPlaying) return;
      if (userPauseLockActive()) return;

      if (mediaActionRecently("play", 1200) || userPlayIntentActive() || hiddenMediaSessionPlayActive()) {
        clearPlayStartFriction();
      }

      if (hasExternalAudio && startupPhase && !startupBufferPrimed) {
        const t0 = Number(video.currentTime()) || 0;
        strictBufferHold = false;
        strictBufferHoldReason = "";
        safeSetCT(audio, t0);
      }

      if (intendedPlaying && (resumeWarmActive() || (startupPhase && !audioEverStarted) || explicitPlayActive())) {
        forceUnmuteForPlaybackIfAllowed();
        updateAudioGainImmediate();
      }

      if (hasExternalAudio && (startupBufferPrimed || audioEverStarted)) {
        const tStrict = Number(video.currentTime()) || 0;

        const vTech = getPlayableVideoEl() || videoEl;
        const warmGate = resumeWarmActive() || (document.visibilityState === "hidden" && explicitPlayActive());
        const gateOk = warmGate
          ? (canPlayAt(vTech, tStrict) && canStartAudioAt(tStrict))
          : bothPlayableAt(tStrict);

        if (!gateOk) {
          strictBufferHold = true;
          strictBufferHoldReason = "strict-play-gate";
          strictBufferHoldMinUntil = Math.max(strictBufferHoldMinUntil, performance.now() + 520);
          if (!isVideoPaused()) execProgrammaticVideoPause();
          if (!audio.paused) execProgrammaticAudioPause(300);
          safeSetCT(audio, tStrict);
          armResumeAfterBuffer(8000);
          return;
        }
        strictBufferHold = false;
        strictBufferHoldReason = "";
      } else {
        strictBufferHold = false;
        strictBufferHoldReason = "";
      }

      const vt = Number(video.currentTime());
      const at = Number(audio.currentTime);
      const isHidden = document.visibilityState === "hidden";
      const bgRetryBrowser = shouldUseBgControllerRetry();
      const vWaiting = getVideoReadyState() < 3 || video.hasClass("vjs-waiting");

      if (isFinite(vt) && isFinite(at) && Math.abs(at - vt) > 0.5) {
        if (!(isHidden && !audio.paused && at > vt)) safeSetCT(audio, vt);
      }

      if (!intendedPlaying) return;
      if (userPauseLockActive() || hardPauseLatchActive()) return;

      let audioStartedFirst = false;

      if (hasExternalAudio && qua !== "medium" && intendedPlaying) {
        const t0 = Number(video.currentTime()) || 0;

        try {
          if (audio.paused && !shouldBlockNewAudioStart()) {
            squelchAudioEvents(260);
            safeSetCT(audio, t0);

            const p = execProgrammaticAudioPlay({
              squelchMs: 260,
              minGapMs: 0,
              force: true
            });

            await Promise.race([
              Promise.resolve(p).catch(() => false),
              new Promise(r => setTimeout(() => r(false), 180))
            ]);

            audioStartedFirst = !audio.paused;

            if (audioStartedFirst) {
              audioEverStarted = true;
              updateAudioGainImmediate();
            }
          }
        } catch {}

        if (!audioStartedFirst && audio.paused && !strictBufferHold && !audioEverStarted) {
          holdCoupledPlayback("audio-not-starting");
          return;
        }
      }

      let vOk = true;
      let aOk = true;

      if (isVideoPaused()) {
        try {
          const p = execProgrammaticVideoPlay();
          if (p && p.then) await settlePlaybackKick(p, isHidden ? 90 : 180);
          vOk = !isVideoPaused() || (isHidden && hiddenMediaSessionPlayActive());
        } catch (err) {
          if (err.name !== "AbortError") vOk = false;
        }
      } else {
        vOk = true;
      }

      if (vOk && intendedPlaying) {
        setSmoothNoHold(900);
        if (isChromiumOnlyBrowser()) setChromiumAudioStartLock(120);
        if (isChromiumOnlyBrowser() && audio.paused) queueChromiumToggleAudioRepair("play-together-video-ok");
      }

      if (!intendedPlaying) return;
      if (userPauseLockActive() || hardPauseLatchActive()) return;

      if (audio.paused) {
        try {
          const shouldHoldAudio =
            (androidResumeGuardActive() && isVideoPaused()) ||
            (bgRetryBrowser && isHidden && isVideoPaused() && !hiddenMediaSessionPlayActive()) ||
            strictBufferHold ||
            (document.visibilityState === "visible" && vWaiting && startupPhase && !audioEverStarted) ||
            shouldBlockNewAudioStart();

          const canKickFirstAudio = !audioEverStarted && canStartAudioAt(Number(video.currentTime()));

          const deferStartupAudio =
            !canKickFirstAudio &&
            startupPhase &&
            vOk &&
            (vWaiting || (performance.now() - lastPlayKickTs) < 260);

          if (shouldHoldAudio) {
            aOk = true;
            if (intendedPlaying && vWaiting) armResumeAfterBuffer(8000);
          } else if (deferStartupAudio) {
            setStartupAudioHold(520);
            aOk = true;
            if (intendedPlaying && vWaiting) armResumeAfterBuffer(8000);
          } else {
            aOk = await execProgrammaticAudioPlay({
              squelchMs: canKickFirstAudio ? 220 : 260,
              minGapMs: 0,
              force: true
            });
          }
        } catch (err) {
          if (err.name === "AbortError") aOk = true;
          else aOk = false;
        }
      }

      if (!aOk && vOk && intendedPlaying && !isVideoPaused() && !strictBufferHold) {
        try {
          if (!shouldBlockNewAudioStart() && canStartAudioAt(Number(video.currentTime())) && !vWaiting) {
            safeSetCT(audio, Number(video.currentTime()));
            aOk = await execProgrammaticAudioPlay({ squelchMs: 260, force: true, minGapMs: 0 });
          } else if (vWaiting) {
            armResumeAfterBuffer(8000);
          }
        } catch {}
      }

      if (!intendedPlaying) return;
      if (userPauseLockActive() || hardPauseLatchActive()) return;

      if (!vOk && !aOk) {
        if (!isHidden || !bgRetryBrowser) {
          if (isHidden && bgRetryBrowser) {
            queueHiddenTransientResume("play-together-both-not-ok-hidden");
          } else {
            intendedPlaying = false;
            pauseHard();
            updateMediaSessionPlaybackState();
            return;
          }
        } else {
          queueHiddenTransientResume("play-together-both-not-ok-hidden");
        }
      } else if (!vOk && aOk) {
        if (!isHidden) {
          execProgrammaticAudioPause(220);
          aOk = false;
        }
      }

      if (hasExternalAudio && qua !== "medium" && intendedPlaying) {
        const vPausedNow2 = isVideoPaused();
        const aPausedNow2 = !!audio.paused;
        const warm =
          jointStartGraceActive() ||
          resumeWarmActive() ||
          explicitPlayActive() ||
          (performance.now() - lastPlayKickTs) < 520;

        if (!vPausedNow2 && aPausedNow2 && !warm && !strictBufferHold) {
          holdCoupledPlayback("audio-not-playing");
          return;
        }

        if (vPausedNow2 && !aPausedNow2) {
          execProgrammaticAudioPause(300);
        }
      }

      updateAudioGainImmediate();

      if (!syncInterval) startSyncLoop();

      if (!firstPlayCommitted) {
        firstPlayCommitted = true;
        setTimeout(() => { startupPhase = false; }, 800);
      }

      if (intendedPlaying && !isVideoPaused() && !audio.paused) {
        setSmoothNoHold(1300);
      }

      updateMediaSessionPlaybackState();
    } finally {
      syncing = false;
      const isHidden = document.visibilityState === "hidden";

      if (!intendedPlaying && !isVideoPaused()) {
        pauseHard();
      } else if (intendedPlaying && !isVideoPaused() && audio.paused) {
        const canKickFirstAudio = !audioEverStarted && canStartAudioAt(Number(video.currentTime()));
        if (!userPauseLockActive() && !hardPauseLatchActive() && !strictBufferHold && !mediaSessionForcedPauseActive() && !(androidResumeGuardActive() && isVideoPaused()) && performance.now() >= audioPauseInFlightUntil && !shouldBlockNewAudioStart()) {
          if (canKickFirstAudio || !startupAudioHoldActive()) {
            execProgrammaticAudioPlay({
              squelchMs: canKickFirstAudio ? 220 : 260,
              minGapMs: 0,
              force: true
            }).catch(() => false);
          }
        }
        if (isChromiumOnlyBrowser()) queueChromiumToggleAudioRepair("play-together-finally");
      } else if (intendedPlaying && isVideoPaused() && !audio.paused) {
        if (isHidden && shouldUseBgControllerRetry()) {
          resumeOnVisible = true;
          queueHiddenTransientResume("play-together-finally-hidden");
        } else if (!userPauseLockActive() && !hardPauseLatchActive()) {
          execProgrammaticAudioPause(220);

          if (!isHidden && isProblemMobileBrowser() && !videoRepairing) {
            kickVideo().catch(() => {});
          } else if (!isHidden && !chromiumPauseToggleGuardActive()) {
            playTogether().catch(() => {});
          }
        }
      }
    }
  }

  function pauseHard(audioPauseMs = 700) {
    cancelChromiumToggleAudioRepair();
    cancelHiddenTransientResume();
    clearHiddenMediaSessionPlay();
    strictBufferHold = false;
    strictBufferHoldReason = "";
    strictBufferMissCount = 0;
    strictBufferHoldMinUntil = 0;
    clearAndroidResumeRepairTimer();
    clearBgResumeRetryTimer();
    clearSeekRecoveryTimers();
    clearSeekSyncFinishTimer();
    clearSeekSyncRetryTimer();
    clearResumeAfterBufferTimer();
    clearResumeSyncRestartTimer();
    execProgrammaticVideoPause();
    try {
      execProgrammaticAudioPause(audioPauseMs);
    } catch {}
    clearSyncLoop();
    if (!intendedPlaying && !startupAutoplayPauseGraceActive()) queueHardPauseVerification();
  }

  function pauseTogether() {
    cancelChromiumToggleAudioRepair();
    cancelHiddenTransientResume();
    clearHiddenMediaSessionPlay();
    intendedPlaying = false;
    strictBufferHold = false;
    strictBufferHoldReason = "";
    strictBufferMissCount = 0;
    strictBufferHoldMinUntil = 0;
    updateMediaSessionPlaybackState();
    const audioPauseMs = (userPauseIntentActive() || hardPauseLatchActive()) ? 220 : 700;
    if (!syncing && !seekingActive) pauseHard(audioPauseMs);
    else queueHardPauseVerification();
  }

  const showError = () => {};
  const hideError = () => {};

  function setupUserPauseIntentDetection() {
    const root = video?.el?.() || videoEl || document;
    let pendingTechTogglePausedState = null;

    const getTargetEl = (target) => {
      try {
        return target && target.nodeType === 1 ? target : null;
      } catch {}
      return null;
    };

    const isPrimaryActivation = (event) => {
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

    const isPlayControlTarget = (target) => {
      try {
        const el = getTargetEl(target);
        return !!el?.closest?.(".vjs-play-control, .vjs-big-play-button");
      } catch {}
      return false;
    };

    const isTechSurfaceTarget = (target) => {
      try {
        const el = getTargetEl(target);
        if (!el) return false;
        if (el.closest?.(".vjs-control-bar, .vjs-menu, .vjs-menu-content, .vjs-slider, .vjs-control")) return false;
        return !!el.closest?.(".vjs-tech, video");
      } catch {}
      return false;
    };

    const onPressStart = (event) => {
      if (document.visibilityState !== "visible") return;
      if (!isPrimaryActivation(event)) return;

      if (isPlayControlTarget(event.target)) {
        pendingTechTogglePausedState = null;
        if (isVideoPaused()) {
          markUserPlayIntent();
        } else {
          markUserPauseIntent();
          lockPauseIntent(2200);
        }
        return;
      }

      if (isTechSurfaceTarget(event.target)) {
        pendingTechTogglePausedState = isVideoPaused();
        return;
      }

      pendingTechTogglePausedState = null;
    };

    const onClick = (event) => {
      if (document.visibilityState !== "visible") return;

      if (isPlayControlTarget(event.target)) {
        pendingTechTogglePausedState = null;
        return;
      }

      if (!isTechSurfaceTarget(event.target)) {
        pendingTechTogglePausedState = null;
        return;
      }

      const wasPaused = pendingTechTogglePausedState;
      pendingTechTogglePausedState = null;

      if (typeof wasPaused !== "boolean") return;

      requestAnimationFrame(() => {
        const nowPaused = isVideoPaused();
        if (wasPaused && !nowPaused) {
          markUserPlayIntent(900);
        } else if (!wasPaused && nowPaused) {
          markUserPauseIntent(900);
          lockPauseIntent(2200);
        }
      });
    };

    const onKeyDown = (event) => {
      if (document.visibilityState !== "visible") return;
      const code = event.code || event.key || "";
      if (code === "Space" || code === "KeyK" || code === "MediaPlayPause") {
        if (isVideoPaused()) {
          markUserPlayIntent();
        } else {
          markUserPauseIntent();
          lockPauseIntent(2200);
        }
        return;
      }
      if (code === "MediaPause" || code === "MediaStop") {
        markUserPauseIntent();
        lockPauseIntent(2200);
      }
    };

    const clearPendingTechToggle = () => {
      pendingTechTogglePausedState = null;
    };

    try {
      if ("PointerEvent" in window) {
        root.addEventListener("pointerdown", onPressStart, true);
      } else {
        root.addEventListener("mousedown", onPressStart, true);
        root.addEventListener("touchstart", onPressStart, true);
      }
    } catch {}

    try { root.addEventListener("click", onClick, true); } catch {}
    try { root.addEventListener("pointercancel", clearPendingTechToggle, true); } catch {}
    try { root.addEventListener("touchcancel", clearPendingTechToggle, true); } catch {}
    try { root.addEventListener("dragstart", clearPendingTechToggle, true); } catch {}
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

    try {
      const handleMediaSessionPauseLike = () => {
        markMediaAction("pause");
        nextMediaSessionActionSerial();
        setMediaSessionForcedPause(3200);
        markUserPauseIntent(2800);
        lockPauseIntent(2800);

        clearAndroidResumeRepairTimer();
        clearBgResumeRetryTimer();
        clearResumeSyncRestartTimer();
        cancelHiddenTransientResume();

        setPauseEventGuard(2200);
        setMediaPauseTxn(2200);

        intendedPlaying = false;
        strictBufferHold = false;
        strictBufferHoldReason = "";
        strictBufferMissCount = 0;
        strictBufferHoldMinUntil = 0;
        startupAudioHoldUntil = 0;
        syncing = false;
        resumeOnVisible = false;
        clearHiddenMediaSessionPlay();
        cancelBackgroundResumeState();

        updateMediaSessionPlaybackState();
        pauseHard(220);
      };

      navigator.mediaSession.setActionHandler("play", () => {
        const actionSerial = nextMediaSessionActionSerial();
        clearMediaSessionForcedPause();
        clearPlayStartFriction();
        cancelHiddenTransientResume();

        if (document.visibilityState === "hidden") {
          armHiddenMediaSessionPlay(5000);
        } else {
          clearHiddenMediaSessionPlay();
        }

        markMediaAction("play");
        markUserPlayIntent(1400);
        intendedPlaying = true;
        updateMediaSessionPlaybackState();

        markExplicitPlay(20000);
        setResumeWarm(1800);
        setSmoothNoHold(1100);

        clearAndroidResumeRepairTimer();
        clearBgResumeRetryTimer();
        clearResumeSyncRestartTimer();

        setAndroidResumeGuard(1800);
        setPauseEventGuard(2400);
        setMediaPlayTxn(2600);
        setBgControllerPlayGuard(document.visibilityState === "hidden" ? 20000 : 2800);
        setStartupAudioHold(0);
        if (isChromiumOnlyBrowser()) setChromiumAudioStartLock(120);

        queuePlayRetryBurst();

        forceUnmuteForPlaybackIfAllowed();
        updateAudioGainImmediate();

        let playPromise = null;
        let audioBootstrapPromise = null;

        try {
          playPromise = execProgrammaticVideoPlay();
        } catch {}

        try {
          if (hiddenMediaSessionPlayActive() && hasExternalAudio && qua !== "medium") {
            const vt = Number(video.currentTime()) || 0;
            safeSetCT(audio, vt);
            audioBootstrapPromise = execProgrammaticAudioPlay({
              squelchMs: 260,
              minGapMs: 0,
              force: true
            });
          }
        } catch {}

        if (document.visibilityState === "hidden") {
          queueHiddenTransientResume("media-session-play");
        }

        if (isChromiumOnlyBrowser()) queueChromiumToggleAudioRepair("media-session-play");

        (async () => {
          await Promise.allSettled([
            settlePlaybackKick(playPromise, document.visibilityState === "hidden" ? 90 : 180),
            settlePlaybackKick(audioBootstrapPromise, 120)
          ]);

          if (!mediaSessionActionIsCurrent(actionSerial)) return;
          if (!intendedPlaying) return;
          if (userPauseLockActive()) return;

          await ensureUnmutedIfNotUserMuted().catch(() => {});
          await playTogether().catch(() => {});

          if (isChromiumOnlyBrowser()) queueChromiumToggleAudioRepair("media-session-play-confirmed");
          if (!mediaSessionActionIsCurrent(actionSerial)) return;

          queuePlayRetryBurst();

          if (isAndroidChromium()) {
            clearAndroidResumeRepairTimer();
            androidResumeRepairTimer = setTimeout(async () => {
              if (!mediaSessionActionIsCurrent(actionSerial)) return;
              if (!intendedPlaying) return;
              if (userPauseLockActive()) return;

              if (isVideoPaused()) {
                try {
                  execProgrammaticAudioPause(300);
                } catch {}

                try { await settlePlaybackKick(execProgrammaticVideoPlay(), 120); } catch {}

                await playTogether().catch(() => {});
              }

              if (intendedPlaying && isVideoPaused() && !audio.paused) {
                execProgrammaticAudioPause(300);
                safeSetCT(audio, Number(video.currentTime()) || 0);
              }
            }, 220);
          } else if (shouldUseBgControllerRetry()) {
            if (!mediaSessionActionIsCurrent(actionSerial)) return;

            if (document.visibilityState === "hidden") {
              queueHiddenTransientResume("media-session-play-hidden-followup");
              return;
            }

            if (document.visibilityState === "visible" && !userPauseLockActive()) {
              if (intendedPlaying && isVideoPaused() && !audio.paused) {
                safeSetCT(audio, Number(video.currentTime()) || 0);
                scheduleBgResumeRetry(100);
              } else if (intendedPlaying && (isVideoPaused() || audio.paused)) {
                scheduleBgResumeRetry(100);
              }
            }
          }
        })();
      });

      navigator.mediaSession.setActionHandler("pause", handleMediaSessionPauseLike);
      try { navigator.mediaSession.setActionHandler("stop", handleMediaSessionPauseLike); } catch {}

      navigator.mediaSession.setActionHandler("seekforward", (d) => {
        const inc = Number(d?.seekOffset) || 10;
        video.currentTime(Math.min((video.currentTime() || 0) + inc, Number(video.duration()) || 0));
      });

      navigator.mediaSession.setActionHandler("seekbackward", (d) => {
        const dec = Number(d?.seekOffset) || 10;
        video.currentTime(Math.max((video.currentTime() || 0) - dec, 0));
      });

      navigator.mediaSession.setActionHandler("seekto", (d) => {
        if (!d || typeof d.seekTime !== "number") return;
        video.currentTime(Math.max(0, Math.min(Number(video.duration()) || 0, d.seekTime)));
      });
    } catch {}
  }

  function restoreProgress() {
    firstSeekDone = true;
  }

  function saveProgressThrottled() {}

  function wireResilience(el, label) {
    const pauseIfRealStall = () => {
      if (restarting || !intendedPlaying || seekingActive) return;
      if (!startupBufferPrimed || (startupPhase && !firstPlayCommitted)) return;
      if ((performance.now() - lastPlayKickTs) < 700) return;
      if (smoothNoHoldActive() || postSeekSmoothActive()) return;

      if (document.visibilityState === "hidden" && shouldUseBgControllerRetry()) {
        resumeOnVisible = true;
        queueHiddenTransientResume(`${label.toLowerCase()}-stall-hidden`);
        return;
      }

      strictBufferHold = true;
      strictBufferHoldReason = `${label.toLowerCase()}-buffering`;
      strictBufferMissCount = Math.max(strictBufferMissCount, 2);
      strictBufferHoldMinUntil = Math.max(strictBufferHoldMinUntil, performance.now() + 700);
      strictBufferCoolDownUntil = Math.max(strictBufferCoolDownUntil, performance.now() + 600);

      const vt = Number(video.currentTime());
      if (isFinite(vt)) safeSetCT(audio, vt);

      execProgrammaticVideoPause();
      execProgrammaticAudioPause(300);

      armResumeAfterBuffer(8000);
    };

    const tryResume = async () => {
      if (!intendedPlaying || restarting || seekingActive) return;
      if (mediaSessionForcedPauseActive()) return;
      if (!startupBufferPrimed) return;
      if (isChromiumOnlyBrowser() && shouldBlockNewAudioStart()) return;

      enforceStrictBufferSync(`${label.toLowerCase()}-resume`);
      if (strictBufferHold) {
        armResumeAfterBuffer(8000);
        return;
      }

      const t = Number(video.currentTime());
      if (bothPlayableAt(t) || (!audioEverStarted && canStartAudioAt(t))) {
        await ensureUnmutedIfNotUserMuted();
        if (!(shouldUseBgControllerRetry() && document.visibilityState === "hidden")) {
          if (!inMediaTxnWindow()) playTogether().catch(() => {});
        } else if (document.visibilityState === "visible") {
          scheduleBgResumeRetry(100);
        }
      }
    };

    el.addEventListener("waiting", pauseIfRealStall);
    el.addEventListener("stalled", pauseIfRealStall);
    el.addEventListener("playing", () => {
      if (label === "Video" && video.hasClass("vjs-waiting")) video.removeClass("vjs-waiting");
      tryResume().catch(() => {});
    });
    el.addEventListener("loadeddata", () => { tryResume().catch(() => {}); });
    el.addEventListener("progress", () => { tryResume().catch(() => {}); });
    el.addEventListener("canplay", () => { tryResume().catch(() => {}); });
    el.addEventListener("canplaythrough", () => { tryResume().catch(() => {}); });
  }

  setupUserPauseIntentDetection();

  if (qua !== "medium" && hasExternalAudio) {
    setupMediaSession();

    let audioReady = false;
    let videoReady = false;
    let startupReadyPollTimer = null;

    try {
      audio.preload = "auto";
      audio.load();
    } catch {}

    const queueStartupReadyPoll = () => {
      if (startupBufferPrimed || startupReadyPollTimer) return;
      startupReadyPollTimer = setTimeout(() => {
        startupReadyPollTimer = null;
        maybeStart();
      }, 90);
    };

    const oneShotReady = (elm, markReady) => {
      let done = false;
      const onLoaded = () => {
        if (done) return;
        done = true;
        markReady();
        maybeStart();
      };
      elm.addEventListener("loadeddata", onLoaded, { once: true });
      elm.addEventListener("loadedmetadata", onLoaded, { once: true });
      elm.addEventListener("canplay", onLoaded, { once: true });
    };

    const maybeStart = () => {
      if (!audioReady || !videoReady || restarting) return;
      if (startupBufferPrimed) return;

      const t0 = Number(video.currentTime()) || 0;
      const primeWait = performance.now() - startupPrimeStartedAt;

      if (!bothStartupBufferedAt(t0)) {
        const looseReady =
          canPlayAt(getPlayableVideoEl() || videoEl, t0) &&
          canStartAudioAt(t0);

        if (!(looseReady && primeWait > 1400)) {
          strictBufferHold = true;
          strictBufferHoldReason = "startup-buffer";
          strictBufferHoldMinUntil = Math.max(strictBufferHoldMinUntil, performance.now() + 520);
          queueStartupReadyPoll();
          return;
        }
      }

      startupBufferPrimed = true;
      strictBufferHold = false;
      strictBufferHoldReason = "";

      restoreProgress();

      const t = Number(video.currentTime());
      if (isFinite(t) && isFinite(Number(audio.currentTime)) && Math.abs(Number(audio.currentTime) - t) > 0.1) {
        safeSetCT(audio, t);
      }

      setupMediaSession();
      updateAudioGainImmediate();
      scheduleStartupAutoplayKick();
      setTimeout(() => { if (!firstPlayCommitted) startupPhase = false; }, 2500);
    };

    oneShotReady(audio, () => { audioReady = true; });
    oneShotReady(videoEl, () => { videoReady = true; });

    const nudgeStartupReady = () => {
      if (!startupBufferPrimed) maybeStart();
    };

    audio.addEventListener("progress", nudgeStartupReady);
    audio.addEventListener("canplaythrough", nudgeStartupReady);
    audio.addEventListener("canplay", nudgeStartupReady);
    audio.addEventListener("loadeddata", nudgeStartupReady);

    videoEl.addEventListener("progress", nudgeStartupReady);
    videoEl.addEventListener("canplaythrough", nudgeStartupReady);
    videoEl.addEventListener("canplay", nudgeStartupReady);
    videoEl.addEventListener("loadeddata", nudgeStartupReady);

    video.on("volumechange", () => {
      if (squelchMuteEvents) return;
      if (performance.now() < suppressMirrorUntil || seekingActive || restarting) {
        rampVolumeTo(targetVolFromVideo(), 80);
        return;
      }
      rampVolumeTo(targetVolFromVideo(), 120);
      userMutedVideo = !!video.muted();
    });

    videoEl.addEventListener("volumechange", () => {
      if (squelchMuteEvents) return;
      userMutedVideo = !!video.muted();
      rampVolumeTo(targetVolFromVideo(), 120);
    });

    audio.addEventListener("volumechange", () => {
      if (squelchMuteEvents) return;
      userMutedAudio = !!audio.muted;
    });

    audio.addEventListener("seeking", () => {
      if (restarting) return;
      if (!seekingActive) return;
      execProgrammaticVideoPause();
      execProgrammaticAudioPause(300);
    });

    audio.addEventListener("seeked", () => {
      if (restarting) return;
      if (!seekingActive) return;
      seekSyncAudioSeeked = true;
      scheduleSeekSyncFinalize(0);
    });

    audio.addEventListener("play", () => {
      if (audioEventsSquelched() || restarting || isProgrammaticAudioPlay || isProgrammaticPlay) return;
      if (performance.now() < audioPlayInFlightUntil || performance.now() < audioPauseInFlightUntil) return;

      if ((!intendedPlaying || userPauseLockActive() || hardPauseLatchActive() || mediaSessionForcedPauseActive() || shouldBlockNewAudioStart()) && !userPlayIntentActive()) {
        try { squelchAudioEvents(220); } catch {}
        try { audio.pause(); } catch {}
        return;
      }

      audioEverStarted = true;
      clearMediaSessionForcedPause();
      if (userPlayIntentActive()) clearUserIntents();
      intendedPlaying = true;
      markMediaAction("play");
      markExplicitPlay(15000);
      setResumeWarm(1600);
      setSmoothNoHold(1100);
      clearPlayStartFriction();
      forceUnmuteForPlaybackIfAllowed();
      updateAudioGainImmediate();
      updateMediaSessionPlaybackState();
      if (!startupBufferPrimed) {
        queueStartupReadyPoll();
        return;
      }
      if (!syncing && !seekingActive && isVideoPaused()) {
        if (isChromiumOnlyBrowser()) {
          execProgrammaticAudioPause(220);
        }
        playTogether().catch(() => {});
      }
    });

    audio.addEventListener("pause", () => {
      if (audioEventsSquelched() || restarting || isProgrammaticAudioPause || isProgrammaticPause) return;
      if (performance.now() < audioPauseInFlightUntil || performance.now() < audioPlayInFlightUntil) return;

      if (seekingActive || seekSyncFinishing) return;

      if (hardPauseLatchActive()) {
        commitUserPause();
        return;
      }

      if (shouldTreatVisiblePauseAsUserPause()) {
        commitUserPause();
        return;
      }

      if (shouldIgnorePauseAsTransient()) {
        if (intendedPlaying && document.visibilityState === "hidden" && shouldUseBgControllerRetry()) {
          resumeOnVisible = true;
          queueHiddenTransientResume("ignore-audio-pause-hidden");
        }
        return;
      }

      if (!startupBufferPrimed && startupAutoplayKickInFlight) return;
      if (startupAutoplayPauseGraceActive()) {
        queueStartupReadyPoll();
        scheduleStartupAutoplayKick();
        return;
      }
      if (mediaSessionForcedPauseActive()) return;

      if (document.visibilityState === "hidden" && intendedPlaying && shouldUseBgControllerRetry()) {
        try { noteBackgroundEntry("hidden-audio-pause"); } catch {}
        resumeOnVisible = true;
        queueHiddenTransientResume("hidden-audio-pause");
        return;
      }

      pauseTogether();
    });

    videoEl.addEventListener("playing", () => {
      if ((!intendedPlaying || userPauseLockActive() || hardPauseLatchActive() || mediaSessionForcedPauseActive()) && !userPlayIntentActive()) {
        if (wantsStartupAutoplay() || (performance.now() - startupPrimeStartedAt) < STARTUP_GRACE_MS) {
          clearMediaSessionForcedPause();
          intendedPlaying = true;
          markMediaAction("play");
          markExplicitPlay(15000);
          setResumeWarm(1600);
          setSmoothNoHold(1100);
          setJointStartGrace(1200);
          clearPlayStartFriction();
          updateMediaSessionPlaybackState();
        } else {
          execProgrammaticVideoPause();
          return;
        }
      }

      startupAudioHoldUntil = 0;
      if (video.hasClass("vjs-waiting")) video.removeClass("vjs-waiting");
      if (isChromiumOnlyBrowser()) {
        chromiumAudioStartLockUntil = 0;
        setChromiumBgSettling(220);
        queueChromiumToggleAudioRepair("native-video-playing");
      }
    });

    video.on("ratechange", () => {
      try { audio.playbackRate = video.playbackRate(); } catch {}
    });

    video.on("play", () => {
      if (restarting || isProgrammaticPlay) return;

      if ((!intendedPlaying || userPauseLockActive() || hardPauseLatchActive() || mediaSessionForcedPauseActive()) && !userPlayIntentActive() && !startupAutoplayKickInFlight && !wantsStartupAutoplay()) {
        execProgrammaticVideoPause();
        return;
      }

      clearMediaSessionForcedPause();
      if (userPlayIntentActive()) clearUserIntents();
      intendedPlaying = true;
      markMediaAction("play");
      markExplicitPlay(15000);
      setResumeWarm(1600);
      setSmoothNoHold(1100);
      setJointStartGrace(1200);
      clearPlayStartFriction();
      if (isChromiumOnlyBrowser()) setChromiumAudioStartLock(120);
      forceUnmuteForPlaybackIfAllowed();
      updateAudioGainImmediate();
      ensureUnmutedIfNotUserMuted().catch(() => {});
      if (isChromiumOnlyBrowser()) queueChromiumToggleAudioRepair("video-play");
      updateMediaSessionPlaybackState();
      if (!startupBufferPrimed) {
        queueStartupReadyPoll();
        return;
      }
      if (!syncing && !seekingActive) playTogether().catch(() => {});
    });

    video.on("pause", () => {
      if (restarting || isProgrammaticPause) return;

      if (seekingActive || seekSyncFinishing) return;

      if (hardPauseLatchActive()) {
        commitUserPause();
        return;
      }

      if (shouldTreatVisiblePauseAsUserPause()) {
        commitUserPause();
        return;
      }

      if (shouldIgnorePauseAsTransient()) {
        if (intendedPlaying && document.visibilityState === "hidden" && shouldUseBgControllerRetry()) {
          resumeOnVisible = true;
          queueHiddenTransientResume("ignore-video-pause-hidden");
        }
        return;
      }

      if (!startupBufferPrimed && startupAutoplayKickInFlight) return;
      if (startupAutoplayPauseGraceActive()) {
        queueStartupReadyPoll();
        scheduleStartupAutoplayKick();
        return;
      }
      if (mediaSessionForcedPauseActive()) return;

      if (document.visibilityState === "hidden" && intendedPlaying && shouldUseBgControllerRetry()) {
        try { noteBackgroundEntry("hidden-video-pause"); } catch {}
        resumeOnVisible = true;
        queueHiddenTransientResume("hidden-video-pause");
        return;
      }

      if (performance.now() < pauseGuard && intendedPlaying && !shouldTreatVisiblePauseAsUserPause()) {
        execProgrammaticVideoPlay();
        return;
      }

      pauseTogether();
    });

    video.on("waiting", () => {
      if (intendedPlaying && !restarting) {
        if (!startupBufferPrimed || startupAutoplayKickInFlight || (startupPhase && !firstPlayCommitted)) return;
        if ((performance.now() - lastPlayKickTs) < 700) return;
        if (smoothNoHoldActive() || postSeekSmoothActive()) {
          armResumeAfterBuffer(8000);
          return;
        }

        if (document.visibilityState === "hidden" && shouldUseBgControllerRetry()) {
          resumeOnVisible = true;
          queueHiddenTransientResume("video-waiting-hidden");
          return;
        }

        strictBufferHold = true;
        strictBufferHoldReason = "video-waiting";
        strictBufferMissCount = Math.max(strictBufferMissCount, 2);
        strictBufferHoldMinUntil = Math.max(strictBufferHoldMinUntil, performance.now() + 700);
        strictBufferCoolDownUntil = Math.max(strictBufferCoolDownUntil, performance.now() + 600);
        execProgrammaticVideoPause();
        execProgrammaticAudioPause(300);
        armResumeAfterBuffer(8000);
      }
    });

    video.on("playing", () => {
      if ((!intendedPlaying || userPauseLockActive() || hardPauseLatchActive() || mediaSessionForcedPauseActive()) && !userPlayIntentActive()) {
        if (wantsStartupAutoplay() || jointStartGraceActive() || (performance.now() - startupPrimeStartedAt) < STARTUP_GRACE_MS) {
          clearMediaSessionForcedPause();
          intendedPlaying = true;
          markMediaAction("play");
          markExplicitPlay(15000);
          setResumeWarm(1600);
          setSmoothNoHold(1100);
          setJointStartGrace(1200);
          clearPlayStartFriction();
          updateMediaSessionPlaybackState();
        } else {
          execProgrammaticVideoPause();
          return;
        }
      }

      startupAudioHoldUntil = 0;
      if (video.hasClass("vjs-waiting")) video.removeClass("vjs-waiting");
      if (isChromiumOnlyBrowser()) {
        chromiumAudioStartLockUntil = 0;
        setChromiumBgSettling(220);
        queueChromiumToggleAudioRepair("videojs-playing");
      }
      if (intendedPlaying && !restarting && audio.paused && !seekingActive && !syncing && !strictBufferHold && !shouldBlockNewAudioStart()) {
        setSmoothNoHold(900);
        playTogether().catch(() => {});
      }
    });

    let seekStartTime = 0;

    video.on("seeking", () => {
      if (restarting) return;
      strictBufferHold = false;
      strictBufferHoldReason = "";
      strictBufferMissCount = 0;
      seekingActive = true;

      seekSyncRetryUntil = performance.now() + 2600;
      clearSeekSyncRetryTimer();

      seekSyncToken++;
      seekSyncWantedPlaying = intendedPlaying;
      seekSyncVideoSeeked = false;
      seekSyncAudioSeeked = false;

      seekStartTime = Number(video.currentTime());
      seekSyncTargetTime = seekStartTime;
      suppressMirrorUntil = performance.now() + MUTE_SQUELCH_MS;

      clearSeekSyncFinishTimer();
      seekRecoveryToken++;
      clearSeekRecoveryTimers();

      strictBufferCoolDownUntil = Math.max(strictBufferCoolDownUntil, performance.now() + 900);

      execProgrammaticVideoPause();
      execProgrammaticAudioPause(300);

      const at0 = Number(audio.currentTime);
      if (isFinite(seekStartTime)) {
        squelchAudioEvents(520);
        if (!isFinite(at0) || Math.abs(at0 - seekStartTime) > 0.03) safeSetCT(audio, seekStartTime);
      }
    });

    video.on("seeked", () => {
      if (restarting) return;

      const newTime = Number(video.currentTime());
      seekSyncVideoSeeked = true;

      squelchAudioEvents(520);
      safeSetCT(audio, newTime);

      scheduleSeekSyncFinalize(0);
    });

    wireResilience(videoEl, "Video");
    wireResilience(audio, "Audio");

    async function restartLoop() {
      if (restarting) return;
      restarting = true;

      try {
        clearSyncLoop();
        pauseHard();
        const startAt = 0;
        suppressEndedUntil = performance.now() + 1000;

        safeSetCT(videoEl, startAt);
        await softAlignAudioTo(startAt);

        intendedPlaying = true;
        markMediaAction("play");
        markExplicitPlay(15000);
        setResumeWarm(1600);
        setSmoothNoHold(1100);
        clearPlayStartFriction();
        if (isChromiumOnlyBrowser()) setChromiumAudioStartLock(120);
        forceUnmuteForPlaybackIfAllowed();
        updateAudioGainImmediate();
        updateMediaSessionPlaybackState();
        await ensureUnmutedIfNotUserMuted();

        await new Promise(r => requestAnimationFrame(r));
        await playTogether();
      } finally {
        restarting = false;
      }
    }

    video.on("ended", () => {
      if (restarting) return;
      if (performance.now() < suppressEndedUntil) return;
      if (isLoopDesired()) restartLoop();
      else pauseTogether();
    });

    audio.addEventListener("ended", () => {
      if (restarting) return;
      if (performance.now() < suppressEndedUntil) return;
      if (isLoopDesired()) restartLoop();
      else pauseTogether();
    });

    const tryAutoResume = async () => {
      if (!intendedPlaying) return;
      if (mediaSessionForcedPauseActive()) return;
      if (!startupBufferPrimed) return;
      if (seekingActive) return;
      if (isChromiumOnlyBrowser() && shouldBlockNewAudioStart()) return;

      enforceStrictBufferSync("auto-resume");
      if (strictBufferHold) {
        armResumeAfterBuffer(8000);
        return;
      }

      const t = Number(video.currentTime());
      if (bothPlayableAt(t) || (!audioEverStarted && canStartAudioAt(t))) {
        await ensureUnmutedIfNotUserMuted();
        if (!(shouldUseBgControllerRetry() && document.visibilityState === "hidden")) {
          if (!inMediaTxnWindow()) playTogether().catch(() => {});
        } else if (document.visibilityState === "visible") {
          scheduleBgResumeRetry(100);
        }
      }
    };

    videoEl.addEventListener("canplay", tryAutoResume);
    audio.addEventListener("canplay", tryAutoResume);

    try {
      try {
        document.addEventListener("freeze", () => {
          if (!shouldUseBgControllerRetry()) return;
          if (intendedPlaying) {
            try { noteBackgroundEntry("freeze"); } catch {}
            resumeOnVisible = true;
            try { clearSyncLoop(); } catch {}
            bgHiddenStoppedSyncLoop = true;
          }
        }, { passive: true, capture: true });

        document.addEventListener("resume", () => {
          if (!shouldUseBgControllerRetry()) return;
          if (document.visibilityState === "visible" && intendedPlaying) {
            seamlessBgCatchUp("resume")
              .catch(() => {})
              .finally(() => {
                scheduleResumeSyncRestart(120);
              });
          }
        }, { passive: true, capture: true });
      } catch {}

      try {
        window.addEventListener("pageshow", (e) => {
          if (!shouldUseBgControllerRetry()) return;
          if (e && e.persisted && intendedPlaying) {
            seamlessBgCatchUp("pageshow-bfcache")
              .catch(() => {})
              .finally(() => {
                scheduleResumeSyncRestart(120);
              });
          }
        }, { passive: true, capture: true });
      } catch {}

      window.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
          hiddenTransitionAt = 0;
          cancelHiddenTransientResume();
          clearHiddenMediaSessionPlay();
          bgAutoResumeSuppressed = false;

          strictBufferCoolDownUntil = Math.max(strictBufferCoolDownUntil, performance.now() + 900);
          setResumeWarm(1800);
          setSmoothNoHold(1100);

          startupAudioHoldUntil = 0;
          pauseGuard = isChromiumOnlyBrowser() ? 0 : performance.now() + 800;
          if (isChromiumOnlyBrowser()) {
            setChromiumBgSettling(700);
            setChromiumAudioStartLock(180);
          }
          setPauseEventGuard(900);
          setMediaActionLock(320);
          clearBgResumeRetryTimer();

          if (intendedPlaying) {
            syncing = false;

            if (shouldUseBgControllerRetry()) {
              const vt1 = Number(video.currentTime());
              const at1 = Number(audio.currentTime);
              const needCatch =
                resumeOnVisible ||
                bgHiddenWasPlaying ||
                isVideoPaused() ||
                !!audio.paused ||
                (isFinite(vt1) && isFinite(at1) && Math.abs(at1 - vt1) > 0.22);

              if (needCatch) {
                clearResumeSyncRestartTimer();
                seamlessBgCatchUp("visibility-visible")
                  .catch(() => {})
                  .finally(() => {
                    scheduleResumeSyncRestart(100);
                  });
              } else {
                if (!syncInterval) startSyncLoop();
              }
            } else {
              resumeOnVisible = false;
              bgHiddenWasPlaying = false;
              bgHiddenSince = 0;
              bgAudioMasterMode = false;
              bgHiddenStoppedSyncLoop = false;
              resetBgRateBoost();
              if (!syncInterval) startSyncLoop();
            }
          }

          if (resumeOnVisible && !shouldUseBgControllerRetry()) resumeOnVisible = false;
          if (!shouldUseBgControllerRetry()) {
            bgAudioMasterMode = false;
            bgHiddenStoppedSyncLoop = false;
          }
        } else {
          hiddenTransitionAt = performance.now();

          if (shouldUseBgControllerRetry()) {
            try { noteBackgroundEntry("visibility-hidden"); } catch {}

            bgAutoResumeSuppressed = true;
            if (explicitPlayActive() || mediaActionRecently("play", 2500)) bgAutoResumeSuppressed = false;

            if (intendedPlaying) resumeOnVisible = true;

            if (intendedPlaying) {
              clearResumeSyncRestartTimer();
              bgHiddenStoppedSyncLoop = false;
              armHiddenMediaSessionPlay(explicitPlayActive() ? 5000 : 2400);
              queueHiddenTransientResume("visibility-hidden");
            }

            setMediaActionLock(220);
            if (intendedPlaying && !mediaSessionForcedPauseActive()) {
              setPauseEventGuard(1200);
              setBgControllerPlayGuard(explicitPlayActive() ? 20000 : 2200);
            }
          } else {
            bgAutoResumeSuppressed = false;
            resumeOnVisible = false;
            bgHiddenWasPlaying = false;
            bgHiddenSince = 0;
            bgAudioMasterMode = false;
            bgHiddenStoppedSyncLoop = false;
          }
        }
      }, { passive: true, capture: true });

      window.addEventListener("beforeunload", () => {
        if (startupReadyPollTimer) clearTimeout(startupReadyPollTimer);
        cancelHiddenTransientResume();
        clearBgResumeRetryTimer();
        clearSeekRecoveryTimers();
        clearSeekSyncFinishTimer();
        clearSeekSyncRetryTimer();
        clearResumeAfterBufferTimer();
        clearResumeSyncRestartTimer();
      });
    } catch {}

    if (!syncInterval) startSyncLoop();
  } else {
    try {
      video.on("timeupdate", () => {});
      if ("mediaSession" in navigator) {
        video.on("play", () => {
          if ((!intendedPlaying || userPauseLockActive() || hardPauseLatchActive() || mediaSessionForcedPauseActive()) && !userPlayIntentActive() && !wantsStartupAutoplay()) {
            execProgrammaticVideoPause();
            return;
          }
          if (userPlayIntentActive()) clearUserIntents();
          intendedPlaying = true;
          updateMediaSessionPlaybackState();
        });
        video.on("pause", () => {
          if (startupAutoplayPauseGraceActive()) return;
          if (hardPauseLatchActive() || shouldTreatVisiblePauseAsUserPause()) {
            commitUserPause();
            return;
          }
          intendedPlaying = false;
          updateMediaSessionPlaybackState();
          queueHardPauseVerification();
        });
      }
    } catch {}
    setupMediaSession();
  }
});

document.addEventListener('keydown', function(event) {
    // Ignore key presses if typing in an input or textarea
    if (event.target.tagName.toLowerCase() === 'input' || event.target.tagName.toLowerCase() === 'textarea') {
        return;
    }

     const videoElement = document.querySelector('.video-js');
    if (!videoElement) return;
    const player = videojs(videoElement);

    // Handle the shortcuts
    switch (event.key.toLowerCase()) {
        case 'f': // Fullscreen
            if (!player.isFullscreen()) {
                player.requestFullscreen();
            } else {
                player.exitFullscreen();
            }
            break;

        case ' ': // Spacebar
        case 'k': 
            event.preventDefault(); // Stops the page from scrolling down
            if (player.paused()) {
                player.play();
            } else {
                player.pause();
            }
            break;

        case 'm': // Mute toggle
            player.muted(!player.muted());
            break;

        case 'arrowright':
        case 'l': 
            player.currentTime(player.currentTime() + 10); // Skip forward 10s
            break;

        case 'arrowleft':
        case 'j': 
            player.currentTime(player.currentTime() - 10); // Skip back 10s
            break;

        case 'arrowup': 
            event.preventDefault(); // Stops the page from scrolling up
            // Increase volume by 0.1 (max 1.0)
            player.volume(Math.min(1, player.volume() + 0.1)); 
            break;

        case 'arrowdown': 
            event.preventDefault(); // Stops the page from scrolling down
            // Decrease volume by 0.1 (min 0)
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
/* ---------------------------------------------
   PokeTube Video.js UI — improved for bright/white scenes
   - Uses adaptive “glass” surfaces that stay readable on light frames
   - Adds subtle borders + shadows + text outlines
   - Keeps your gradient brand progress color
---------------------------------------------- */

:root{
  /* Brand */
  --poke-accent-1: #ff0045;
  --poke-accent-2: #ff0e55;
  --poke-accent-3: #ff1d79;

  /* Adaptive glass (works on bright scenes too) */
  --glass-bg: rgba(20, 20, 20, 0.38);
  --glass-bg-hover: rgba(20, 20, 20, 0.46);
  --glass-border: rgba(255, 255, 255, 0.22);
  --glass-border-strong: rgba(255, 255, 255, 0.30);
  --glass-shadow: 0 10px 30px rgba(0,0,0,0.32), inset 0 0 0 1px rgba(255,255,255,0.10);

  /* “Light scene rescue” layer (a tiny dark wash that helps on whites) */
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