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
    // ==========================================
    // Core Initialization & Element References
    // ==========================================
    const video = videojs('video', {
        controls: true,
        autoplay: false,
        preload: 'auto',
        errorDisplay: false,
        html5: {
            vhs: {
                enableLowInitialPlaylist: true,
                smoothQualityChange: true,
                overrideNative: true
            },
            nativeAudioTracks: false,
            nativeVideoTracks: false
        }
    });

    const qs = new URLSearchParams(window.location.search);
    const qua = qs.get("quality") || "";
    const vidKey = qs.get('v');
    const PROGRESS_KEY = `progress-${vidKey}`;

    try {
        if (!localStorage.getItem(PROGRESS_KEY)) {
            localStorage.setItem(PROGRESS_KEY, 0);
        }
    } catch {}

    const videoEl = document.getElementById('video');
    const audio = document.getElementById('aud');

    try {
        videoEl.setAttribute('playsinline', '');
        videoEl.setAttribute('webkit-playsinline', '');
        videoEl.setAttribute('x5-playsinline', '');
        videoEl.setAttribute('x5-video-player-type', 'h5');
        videoEl.setAttribute('x5-video-player-fullscreen', 'true');
    } catch {}

    // Ensure loop flags are managed exclusively by our state engine
    try {
        videoEl.loop = false;
        videoEl.removeAttribute?.('loop');
        if (audio) {
            audio.loop = false;
            audio.removeAttribute?.('loop');
        }
    } catch {}

    // ==========================================
    // TitleBar Fullscreen Logic
    // ==========================================
    video.ready(() => {
        const metaTitle = document.querySelector('meta[name="title"]')?.content || document.title || "";
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
            const fs = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement;
            if (fs) createTitleBar();
            else removeTitleBar();
        };

        document.addEventListener("fullscreenchange", handleFullscreen, { passive: true });
        document.addEventListener("webkitfullscreenchange", handleFullscreen, { passive: true });
        document.addEventListener("mozfullscreenchange", handleFullscreen, { passive: true });
        document.addEventListener("MSFullscreenChange", handleFullscreen, { passive: true });
        
        handleFullscreen();
    });

    // ==========================================
    // Strict State Management
    // ==========================================
    class PlaybackState {
        constructor() {
            this.intendedPlaying = false;
            this.syncing = false;
            this.restarting = false;
            this.firstSeekDone = false;
            this.startupPhase = true;
            this.userMutedVideo = false;
            this.userMutedAudio = false;
            this.seekingActive = false;
            this.internalPlayRequest = 0;
            this.squelchAudioEventsUntil = 0;
            this.suppressMirrorUntil = 0;
            this.suppressEndedUntil = 0;
            this.firstPlayCommitted = false;
            this.lastPlayKickTs = 0;
            this.isStalled = false;
        }

        isLoopDesired() {
            return !!videoEl.loop || videoEl.hasAttribute('loop') || qs.get("loop") === "1" || qs.get("loop") === "true" || window.forceLoop === true;
        }

        squelchAudioEvents(ms = 400) {
            this.squelchAudioEventsUntil = performance.now() + ms;
        }

        audioEventsSquelched() {
            return performance.now() < this.squelchAudioEventsUntil;
        }
    }

    const state = new PlaybackState();

    // ==========================================
    // Utility Functions
    // ==========================================
    const clamp01 = v => Math.max(0, Math.min(1, Number(v) || 0));
    const isValFinite = (v) => typeof v === 'number' && isFinite(v) && !isNaN(v);

    const pickAudioSrc = () => {
        if (!audio) return null;
        const s = audio.getAttribute?.('src');
        if (s) return s;
        const child = audio.querySelector?.('source');
        if (child?.getAttribute?.('src')) return child.getAttribute('src');
        if (audio.currentSrc) return audio.currentSrc;
        return null;
    };

    const srcObj = video.src();
    const videoSrc = Array.isArray(srcObj) ? (srcObj[0] && srcObj[0].src) : srcObj;
    const hasExternalAudio = !!audio && audio.tagName === 'AUDIO' && !!pickAudioSrc();

    const safeSetCT = (media, t) => {
        if (!media) return;
        try {
            if (isValFinite(t) && t >= 0) {
                const dur = media.duration || 0;
                media.currentTime = isValFinite(dur) && dur > 0 ? Math.min(t, dur) : t;
            }
        } catch {}
    };

    const errorBox = document.getElementById('loopedIndicator');
    const showError = (msg) => {
        if (!errorBox) return;
        errorBox.textContent = msg;
        errorBox.style.display = 'block';
        errorBox.style.width = 'fit-content';
    };
    const hideError = () => {
        if (errorBox) errorBox.style.display = 'none';
    };

    // ==========================================
    // Robust Volume Controller (Zero-Drop Logic)
    // ==========================================
    class AudioFader {
        constructor(audioEl, videoPlayer) {
            this.audio = audioEl;
            this.video = videoPlayer;
            this.animFrame = null;
            this.targetVol = 1;
            this.currentAnimTarget = null;
        }

        setImmediate(val) {
            try {
                this.cancel();
                val = clamp01(val);
                this.audio.volume = val;
                this.targetVol = val;
                this.currentAnimTarget = val;
            } catch {}
        }

        getTargetFromVideo() {
            const vVol = clamp01(typeof this.video.volume === 'function' ? this.video.volume() : (videoEl.volume ?? 1));
            const vMuted = !!(typeof this.video.muted === 'function' ? this.video.muted() : videoEl.muted);
            const hardMuted = vMuted || state.userMutedVideo;
            return hardMuted ? 0 : vVol;
        }

        cancel() {
            if (this.animFrame) {
                cancelAnimationFrame(this.animFrame);
                this.animFrame = null;
            }
        }

        rampTo(target, ms = 60) {
            return new Promise((resolve) => {
                target = clamp01(target);
                this.currentAnimTarget = target;
                
                const from = clamp01(this.audio.volume);
                if (!isValFinite(from) || ms <= 0 || Math.abs(target - from) < 0.005) {
                    this.setImmediate(target);
                    return resolve();
                }

                this.cancel();
                const start = performance.now();

                const step = () => {
                    if (this.currentAnimTarget !== target) return resolve(); // Interrupted by newer ramp
                    
                    const now = performance.now();
                    const t = clamp01((now - start) / ms);
                    const val = from + (target - from) * t;
                    
                    try { this.audio.volume = clamp01(val); } catch {}

                    if (t < 1) {
                        this.animFrame = requestAnimationFrame(step);
                    } else {
                        try { this.audio.volume = target; } catch {}
                        resolve();
                    }
                };
                
                this.animFrame = requestAnimationFrame(step);
            });
        }

        async softMute(ms = 40) {
            await this.rampTo(0, ms);
        }

        async softUnmute(ms = 60) {
            await this.rampTo(this.getTargetFromVideo(), ms);
        }

        updateImmediate() {
            this.setImmediate(this.getTargetFromVideo());
        }
    }

    const fader = new AudioFader(audio, video);

    async function ensureUnmutedIfNotUserMuted() {
        if (state.startupPhase) {
            fader.updateImmediate();
            return;
        }
        await fader.softUnmute(80);
    }

    // ==========================================
    // Playback Coordination & Sync Controller
    // ==========================================
    class SyncEngine {
        constructor() {
            this.syncInterval = null;
            this.rvfcHandle = null;
            this.useRVFC = !!videoEl.requestVideoFrameCallback;
            this.aligning = false;
            
            this.DRIFT_MICRO = 0.04;
            this.DRIFT_MACRO = 0.25;
            this.DRIFT_CRITICAL = 2.0;
            this.SYNC_RATE_MS = 250;
            this.HEARTBEAT_RATE = 1000;
            
            this.heartbeatInterval = null;
            this.lastVideoTime = -1;
            this.stagnantFrames = 0;
            
            // Allow smooth pitch adjustment to maintain high audio quality during micro-drifts
            try { if ('preservesPitch' in audio) audio.preservesPitch = true; } catch {}
            try { if ('mozPreservesPitch' in audio) audio.mozPreservesPitch = true; } catch {}
            try { if ('webkitPreservesPitch' in audio) audio.webkitPreservesPitch = true; } catch {}
        }

        start() {
            this.stop();
            if (this.useRVFC) this.startRVFC();
            this.startFallbackInterval();
            this.startHeartbeatMonitor();
        }

        stop() {
            if (this.syncInterval) { clearInterval(this.syncInterval); this.syncInterval = null; }
            if (this.heartbeatInterval) { clearInterval(this.heartbeatInterval); this.heartbeatInterval = null; }
            if (this.rvfcHandle != null) {
                try { videoEl.cancelVideoFrameCallback(this.rvfcHandle); } catch {}
                this.rvfcHandle = null;
            }
            try { audio.playbackRate = 1; } catch {}
        }

        async alignAudioStrictly(t, fadeDown = 30, fadeUp = 60) {
            if (this.aligning) return;
            this.aligning = true;
            try {
                await fader.softMute(fadeDown);
                safeSetCT(audio, t);
                if (state.intendedPlaying && !state.seekingActive) {
                    await fader.softUnmute(fadeUp);
                }
            } finally {
                this.aligning = false;
            }
        }

        processSync() {
            if (!state.intendedPlaying || state.seekingActive || state.restarting || state.isStalled) return;
            
            const vt = Number(video.currentTime());
            const at = Number(audio.currentTime);
            
            if (!isValFinite(vt) || !isValFinite(at)) return;

            const delta = vt - at;
            const absDelta = Math.abs(delta);

            if (absDelta > this.DRIFT_CRITICAL) {
                const dur = Number(video.duration()) || 0;
                if (dur > 2 && at > dur - 2 && vt < 2) {
                    safeSetCT(audio, vt);
                    return;
                }
                if (!state.restarting) {
                    playManager.pauseHard();
                    setTimeout(() => { if (state.intendedPlaying) playManager.playTogether(); }, 100);
                }
                return;
            }

            if (absDelta > this.DRIFT_MACRO) {
                this.alignAudioStrictly(vt, 15, 30);
                try { audio.playbackRate = 1; } catch {}
            } else if (absDelta > this.DRIFT_MICRO) {
                // PID Proportional adjustment: smooth catchup without noticeable audio warping
                const targetRate = 1 + (delta * 0.4); 
                try { audio.playbackRate = Math.max(0.85, Math.min(1.15, targetRate)); } catch {}
            } else {
                try {
                    if (audio.playbackRate !== 1) audio.playbackRate = 1; 
                } catch {}
            }
        }

        startRVFC() {
            const step = () => {
                this.processSync();
                this.rvfcHandle = videoEl.requestVideoFrameCallback(step);
            };
            this.rvfcHandle = videoEl.requestVideoFrameCallback(step);
        }

        startFallbackInterval() {
            this.syncInterval = setInterval(() => {
                if (!this.useRVFC) this.processSync();

                const vt = Number(video.currentTime());
                if (isValFinite(vt)) {
                    try {
                        if ('mediaSession' in navigator && navigator.mediaSession.setPositionState) {
                            navigator.mediaSession.setPositionState({
                                duration: Number(video.duration()) || 0,
                                playbackRate: Number(video.playbackRate()) || 1,
                                position: vt
                            });
                        }
                    } catch {}
                }
            }, this.SYNC_RATE_MS);
        }

        startHeartbeatMonitor() {
            // Anti-Stall / Anti-Random-Pause Watchdog (Crucial for Chromium background throttling)
            this.heartbeatInterval = setInterval(() => {
                if (state.restarting || state.seekingActive || state.isStalled) return;
                
                const vPaused = videoEl.paused;
                const aPaused = audio.paused;

                if (state.intendedPlaying) {
                    // Check if browser randomly paused elements
                    if (vPaused || aPaused) {
                        playManager.playTogether({ force: true });
                    }
                    
                    // Detect frozen video pipeline
                    const vt = Number(video.currentTime());
                    if (vt === this.lastVideoTime && !vPaused) {
                        this.stagnantFrames++;
                        if (this.stagnantFrames > 3 && bufferManager.bothPlayableAt(vt)) {
                            // Video is supposed to play but time isn't advancing. Force a micro-kick.
                            playManager.kickstartPipeline();
                        }
                    } else {
                        this.stagnantFrames = 0;
                    }
                    this.lastVideoTime = vt;

                    // Ensure volume didn't drop out
                    if (!aPaused && !audio.muted && !state.userMutedVideo && !state.userMutedAudio) {
                        if (audio.volume <= 0.005 && (performance.now() - state.suppressMirrorUntil) > 500) {
                            fader.softUnmute(100);
                        }
                    }
                } else {
                    if (!vPaused) try { video.pause(); } catch {}
                    if (!aPaused) {
                        state.squelchAudioEvents();
                        try { audio.pause(); } catch {}
                    }
                }
            }, this.HEARTBEAT_RATE);
        }
    }

    const syncer = new SyncEngine();

    // ==========================================
    // Master Playback & Recovery Manager
    // ==========================================
    class PlaybackManager {
        async playTogether({ allowMutedRetry = true, force = false } = {}) {
            if (state.syncing || state.restarting) return;
            if (!state.intendedPlaying && !force) return;
            
            state.intendedPlaying = true;
            state.syncing = true;
            state.lastPlayKickTs = performance.now();
            updateMediaSessionPlaybackState();

            const cancelled = () => !state.intendedPlaying || state.isStalled;

            try {
                if (cancelled()) return;

                const vt = Number(video.currentTime());
                const at = Number(audio.currentTime);
                
                if (isValFinite(vt) && Math.abs(at - vt) > 0.1) {
                    await syncer.alignAudioStrictly(vt, 10, 50);
                    if (cancelled()) return;
                }

                fader.setImmediate(0);

                let vOk = true, aOk = true;

                try {
                    state.internalPlayRequest++;
                    const p = video.play();
                    if (p && p.then) await p;
                } catch { vOk = false; }
                finally { state.internalPlayRequest = Math.max(0, state.internalPlayRequest - 1); }

                if (cancelled()) return;

                try {
                    state.squelchAudioEvents();
                    const pa = audio.play();
                    if (pa && pa.then) await pa;
                } catch { aOk = false; }

                if (cancelled()) return;

                if (!vOk && !aOk) return;

                await fader.softUnmute(150);
                
                if (cancelled()) return;

                syncer.start();

                if (!state.firstPlayCommitted) {
                    state.firstPlayCommitted = true;
                    setTimeout(() => { state.startupPhase = false; }, 1000);
                }

                updateMediaSessionPlaybackState();
                hideError();
                
            } finally {
                state.syncing = false;
            }
        }

        pauseHard() {
            try { video.pause(); } catch {}
            try {
                state.squelchAudioEvents();
                audio.pause();
            } catch {}
            syncer.stop();
        }

        pauseTogether() {
            state.intendedPlaying = false;
            updateMediaSessionPlaybackState();
            this.pauseHard();
        }

        async kickstartPipeline() {
            try {
                const t = Number(audio.currentTime) || 0;
                await fader.softMute(20);
                state.squelchAudioEvents();
                audio.pause();
                safeSetCT(audio, t + 0.001);
                state.squelchAudioEvents();
                await audio.play().catch(() => {});
                await fader.softUnmute(80);
            } catch {}
        }

        async restartLoop() {
            if (state.restarting) return;
            state.restarting = true;
            try {
                syncer.stop();
                this.pauseHard();
                
                const startAt = 0;
                state.suppressEndedUntil = performance.now() + 1500;
                
                safeSetCT(videoEl, startAt);
                await syncer.alignAudioStrictly(startAt, 10, 40);
                
                state.intendedPlaying = true;
                updateMediaSessionPlaybackState();
                await ensureUnmutedIfNotUserMuted();
                
                await new Promise(r => requestAnimationFrame(r));
                await this.playTogether();
            } finally {
                state.restarting = false;
            }
        }
    }

    const playManager = new PlaybackManager();

    // ==========================================
    // Advanced Buffer & Stall Management
    // ==========================================
    class BufferManager {
        constructor() {
            this.stallTimers = { Video: null, Audio: null };
            this.STALL_GRACE_MS = 600;
        }

        timeInBuffered(media, t) {
            try {
                const br = media.buffered;
                if (!br || br.length === 0 || !isValFinite(t)) return false;
                for (let i = 0; i < br.length; i++) {
                    const s = br.start(i) - 0.2;
                    const e = br.end(i) + 0.2;
                    if (t >= s && t <= e) return true;
                }
            } catch {}
            return false;
        }

        canPlayAt(media, t) {
            try {
                const rs = Number(media.readyState || 0);
                if (!isValFinite(t)) return false;
                if (rs >= 3) return true;
                if (t < 0.5 && rs >= 2) return true; 
                return this.timeInBuffered(media, t);
            } catch { return false; }
        }

        bothPlayableAt(t) {
            return this.canPlayAt(videoEl, t) && this.canPlayAt(audio, t);
        }

        checkAndRecover() {
            if (!state.intendedPlaying || state.restarting || state.seekingActive) return;
            const t = Number(video.currentTime());
            
            if (this.bothPlayableAt(t)) {
                this.clearAllStalls();
                state.isStalled = false;
                hideError();
                ensureUnmutedIfNotUserMuted().then(() => playManager.playTogether());
            }
        }

        wireResilience(el, label) {
            const pauseIfRealStall = () => {
                if (state.startupPhase || state.restarting || !state.intendedPlaying || state.seekingActive) return;
                if (performance.now() - state.lastPlayKickTs < 2200) return;

                if (!this.stallTimers[label]) {
                    this.stallTimers[label] = setTimeout(() => {
                        if (!state.intendedPlaying || state.restarting || state.seekingActive) {
                            this.stallTimers[label] = null; return;
                        }
                        
                        const t = Number(video.currentTime());
                        if (this.bothPlayableAt(t)) {
                            this.stallTimers[label] = null; 
                            this.checkAndRecover();
                            return; 
                        }
                        
                        state.isStalled = true;
                        showError(`${label} buffering…`);
                        playManager.pauseHard();
                        this.stallTimers[label] = null;
                    }, this.STALL_GRACE_MS); 
                }
            };

            const clearStall = () => {
                if (this.stallTimers[label]) {
                    clearTimeout(this.stallTimers[label]);
                    this.stallTimers[label] = null;
                }
                state.isStalled = false;
                hideError();
            };

            el.addEventListener('waiting', pauseIfRealStall);
            el.addEventListener('stalled', pauseIfRealStall);
            
            const tryResume = async () => {
                clearStall();
                this.checkAndRecover();
            };

            el.addEventListener('playing', clearStall);
            el.addEventListener('canplay', tryResume);
            el.addEventListener('canplaythrough', tryResume);
        }

        clearAllStalls() {
            if (this.stallTimers.Video) clearTimeout(this.stallTimers.Video);
            if (this.stallTimers.Audio) clearTimeout(this.stallTimers.Audio);
            this.stallTimers.Video = null;
            this.stallTimers.Audio = null;
        }
    }

    const bufferManager = new BufferManager();

    // ==========================================
    // Media Session Integration
    // ==========================================
    function updateMediaSessionPlaybackState() {
        if (!('mediaSession' in navigator)) return;
        try {
            navigator.mediaSession.playbackState = state.intendedPlaying ? 'playing' : 'paused';
        } catch {}
    }

    function setupMediaSession() {
        if (!('mediaSession' in navigator)) return;
        try {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: document.title || 'Video',
                artist: typeof authorchannelname !== "undefined" ? authorchannelname : "",
                artwork: vidKey ? [{ src: `https://i.ytimg.com/vi/${vidKey}/maxresdefault.jpg`, sizes: "1280x720", type: "image/jpeg" }] : []
            });
        } catch {}
        
        updateMediaSessionPlaybackState();
        
        try {
            navigator.mediaSession.setActionHandler('play', () => {
                state.intendedPlaying = true;
                updateMediaSessionPlaybackState();
                ensureUnmutedIfNotUserMuted().then(() => playManager.playTogether());
            });
            navigator.mediaSession.setActionHandler('pause', () => {
                playManager.pauseTogether();
            });
            navigator.mediaSession.setActionHandler('seekforward', (d) => {
                const inc = Number(d?.seekOffset) || 10;
                video.currentTime(Math.min((video.currentTime() || 0) + inc, Number(video.duration()) || 0));
            });
            navigator.mediaSession.setActionHandler('seekbackward', (d) => {
                const dec = Number(d?.seekOffset) || 10;
                video.currentTime(Math.max((video.currentTime() || 0) - dec, 0));
            });
            navigator.mediaSession.setActionHandler('seekto', (d) => {
                if (!d || typeof d.seekTime !== 'number') return;
                video.currentTime(Math.max(0, Math.min(Number(video.duration()) || 0, d.seekTime)));
            });
        } catch {}
    }

    // ==========================================
    // Progress Persistence
    // ==========================================
    function restoreProgress() {
        try {
            const saved = Number(localStorage.getItem(PROGRESS_KEY));
            const dur = Number(video.duration()) || 0;
            if (isValFinite(saved) && saved > 3 && dur && saved < (dur - 10)) {
                video.currentTime(saved);
                safeSetCT(audio, saved);
                state.firstSeekDone = true;
                fader.updateImmediate();
            }
        } catch {}
    }

    function saveProgressThrottled() {
        try {
            const t = Math.floor(Number(video.currentTime()) || 0);
            if ((t & 1) === 0) localStorage.setItem(PROGRESS_KEY, String(t));
        } catch {}
    }

    // ==========================================
    // Main Wiring & Event Listeners
    // ==========================================
    if (qua !== "medium" && hasExternalAudio) {
        let audioReady = false, videoReady = false;

        const oneShotReady = (elm, markReady) => {
            let done = false;
            const onLoaded = () => {
                if (done) return; 
                done = true; 
                markReady(); 
                maybeStart(); 
            };
            elm.addEventListener('loadeddata', onLoaded, { once: true });
            elm.addEventListener('loadedmetadata', onLoaded, { once: true });
            elm.addEventListener('canplay', onLoaded, { once: true });
        };

        const maybeStart = () => {
            if (!audioReady || !videoReady || state.restarting) return;
            restoreProgress();
            
            const t = Number(video.currentTime());
            if (isValFinite(t) && Math.abs(Number(audio.currentTime) - t) > 0.1) {
                safeSetCT(audio, t);
            }
            
            setupMediaSession();
            fader.updateImmediate();
            
            setTimeout(() => { if (!state.firstPlayCommitted) state.startupPhase = false; }, 2500);
        };

        oneShotReady(audio, () => { audioReady = true; });
        oneShotReady(videoEl, () => { videoReady = true; });

        // Volume Synchronization
        const handleVolumeChange = () => {
            if (state.seekingActive || state.restarting) {
                fader.rampTo(fader.getTargetFromVideo(), 80);
                return;
            }
            if (performance.now() < state.suppressMirrorUntil) return;
            
            state.userMutedVideo = !!(typeof video.muted === 'function' ? video.muted() : videoEl.muted);
            fader.rampTo(fader.getTargetFromVideo(), 120);
        };

        video.on('volumechange', handleVolumeChange);
        videoEl.addEventListener('volumechange', handleVolumeChange);

        audio.addEventListener('volumechange', () => {
            state.userMutedAudio = !!audio.muted;
        });

        // External Audio Event Bridges
        audio.addEventListener('play', () => {
            if (state.audioEventsSquelched() || state.restarting || !hasExternalAudio) return;
            state.intendedPlaying = true;
            updateMediaSessionPlaybackState();
            if (video.paused()) {
                playManager.playTogether();
            }
        });

        audio.addEventListener('pause', () => {
            if (state.audioEventsSquelched() || state.restarting) return;
            playManager.pauseTogether();
        });

        videoEl.addEventListener('playing', hideError);
        audio.addEventListener('playing', hideError);

        video.on('ratechange', () => { 
            try { audio.playbackRate = video.playbackRate(); } catch {} 
        });

        // Video Event Source of Truth
        video.on('play', () => {
            if (state.internalPlayRequest > 0) return;
            hideError();
            state.intendedPlaying = true;
            updateMediaSessionPlaybackState();
            ensureUnmutedIfNotUserMuted();
            playManager.playTogether();
        });

        video.on('pause', () => {
            if (!state.restarting) playManager.pauseTogether();
        });

        // Seeking Engine
        let wasPlayingBeforeSeek = false;
        let seekStartTime = 0;

        video.on('seeking', () => {
            if (state.restarting) return;
            state.seekingActive = true;
            wasPlayingBeforeSeek = state.intendedPlaying && !video.paused();
            seekStartTime = Number(video.currentTime());
            state.suppressMirrorUntil = performance.now() + 600;
            
            fader.cancel();
            safeSetCT(audio, seekStartTime);
        });

        video.on('seeked', async () => {
            if (state.restarting) return;
            const newTime = Number(video.currentTime());
            const diff = Math.abs(newTime - seekStartTime);
            const dur = Number(video.duration()) || 0;

            // Native loop detector fallback
            if (dur > 2 && seekStartTime > dur - 2 && newTime < 2) {
                safeSetCT(audio, newTime);
                state.seekingActive = false;
                state.firstSeekDone = true;
                return;
            }

            if (diff > 0.1) await syncer.alignAudioStrictly(newTime, 20, 50);
            else safeSetCT(audio, newTime);

            if (!state.firstSeekDone) { 
                state.firstSeekDone = true; 
                state.seekingActive = false; 
                return; 
            }

            await ensureUnmutedIfNotUserMuted();

            if (wasPlayingBeforeSeek) {
                state.intendedPlaying = true;
                updateMediaSessionPlaybackState();
                
                if (bufferManager.bothPlayableAt(newTime)) {
                    playManager.playTogether();
                } else {
                    // Wait for buffer manager to catch up
                    const checkInterval = setInterval(() => {
                        if (bufferManager.bothPlayableAt(Number(video.currentTime()))) {
                            clearInterval(checkInterval);
                            playManager.playTogether();
                        }
                    }, 100);
                    // Timeout fallback
                    setTimeout(() => clearInterval(checkInterval), 2000);
                }
            } else {
                playManager.pauseTogether();
            }
            
            state.seekingActive = false;
        });

        try { video.on('timeupdate', saveProgressThrottled); } catch {}

        bufferManager.wireResilience(videoEl, 'Video');
        bufferManager.wireResilience(audio, 'Audio');

        video.on('ended', () => {
            if (state.restarting || performance.now() < state.suppressEndedUntil) return;
            if (state.isLoopDesired()) playManager.restartLoop();
            else playManager.pauseTogether();
        });

        audio.addEventListener('ended', () => {
            if (state.restarting || performance.now() < state.suppressEndedUntil) return;
            if (state.isLoopDesired()) playManager.restartLoop();
            else playManager.pauseTogether();
        });

        // Visibility and Page Lifecycle Resilience
        try {
            window.addEventListener('pagehide', () => { syncer.stop(); }, { passive: true });
            window.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'hidden') {
                    syncer.stop(); // Conserve resources, browser throttle kicks in anyway
                } else if (state.intendedPlaying) {
                    syncer.start();
                    bufferManager.checkAndRecover();
                }
            }, { passive: true });
            window.addEventListener('beforeunload', () => {
                try {
                    localStorage.setItem(PROGRESS_KEY, String(Math.floor(Number(video.currentTime()) || 0)));
                } catch {}
            });
        } catch {}

    } else {
        // Fallback for single-element scenarios (medium quality)
        try {
            video.on('timeupdate', () => {
                try {
                    localStorage.setItem(`progress-${vidKey}`, String(Math.floor(Number(video.currentTime()) || 0)));
                } catch {}
            });

            if ('mediaSession' in navigator) {
                video.on('play', () => {
                    state.intendedPlaying = true;
                    updateMediaSessionPlaybackState();
                });
                video.on('pause', () => {
                    state.intendedPlaying = false;
                    updateMediaSessionPlaybackState();
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


 // https://codeberg.org/ashley/poke/src/branch/main/src/libpoketube/libpoketube-youtubei-objects.json


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
const youtubeobjects = "https://codeberg.org/ashley/poke/raw/branch/main/src/libpoketube/libpoketube-youtubei-objects.json"
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
  youtubeobjects: "https://codeberg.org/ashley/poke/raw/branch/main/src/libpoketube/libpoketube-youtubei-objects.json",
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
 const customVideoJsUI = document.createElement('style');
customVideoJsUI.innerHTML = `

.vjs-title-bar-description {
  background: #0007;
  width: fit-content;
  border-radius: 1em;
  padding: 1em;
  font-family: "poketube flex";
  font-weight: 600;
  font-stretch: semi-expanded;
}

.vjs-title-bar {
  background: none !important;
  border-radius: 16px;
  overflow: hidden;
}
.vjs-title-bar-title {
  font-family: "PokeTube Flex", sans-serif !important;
  font-stretch: ultra-expanded;
  font-weight: 1000;
  font-size: 1.5em;
}
.vjs-play-progress{background-image:linear-gradient(to right,#ff0045,#ff0e55,#ff1d79)}.video-js .vjs-control-bar{bottom:12px!important}.vjs-poster{border-radius:16px}.vjs-poster img{border-radius:16px}.vjs-control-bar{background:transparent!important;border:none!important;box-shadow:none!important;display:flex!important;align-items:center!important;gap:2px;padding:6px 10px;border-radius:16px}.vjs-fullscreen-control,.vjs-remaining-time{background-color:transparent!important}.vjs-control-bar .vjs-button{width:38px;height:38px;min-width:38px;border-radius:50%;background:linear-gradient(180deg,rgba(255,255,255,.18),rgba(255,255,255,.08));-webkit-backdrop-filter:blur(12px) saturate(160%);backdrop-filter:blur(12px) saturate(160%);border:1px solid rgba(255,255,255,.18);box-shadow:0 8px 24px rgba(0,0,0,.35),inset 0 0 0 1px rgba(255,255,255,.10);display:inline-flex;align-items:center;justify-content:center;margin:0 6px;transition:transform 0.12s ease,box-shadow 0.2s ease,background 0.2s ease;vertical-align:middle}.vjs-control-bar .vjs-button:hover{background:linear-gradient(180deg,rgba(255,255,255,.24),rgba(255,255,255,.12));box-shadow:0 10px 28px rgba(0,0,0,.4),inset 0 0 0 1px rgba(255,255,255,.16);transform:translateY(-1px)}.vjs-control-bar .vjs-button:active{transform:translateY(0)}.vjs-control-bar .vjs-button:focus-visible{outline:none;box-shadow:0 0 0 3px rgba(255,0,90,.35),inset 0 0 0 1px rgba(255,255,255,.2)}.vjs-control-bar .vjs-icon-placeholder:before{font-size:18px;line-height:38px}.vjs-current-time,.vjs-duration,.vjs-remaining-time,.vjs-time-divider{background:transparent;padding:0 8px;border-radius:999px;box-shadow:none;margin:0;height:38px;line-height:1;display:inline-flex;align-items:center}.vjs-progress-control{flex:1 1 auto;display:flex!important;align-items:center!important;margin:0 6px;padding:0;height:38px}.vjs-progress-control .vjs-progress-holder{height:8px!important;border-radius:999px!important;background:transparent!important;border:none;box-shadow:none;position:relative;margin:0;width:100%}.vjs-progress-control .vjs-progress-holder::before{position:absolute;inset:0;border-radius:inherit;background:linear-gradient(180deg,rgba(255,255,255,.18),rgba(255,255,255,.08));-webkit-backdrop-filter:blur(12px) saturate(160%);backdrop-filter:blur(12px) saturate(160%);border:1px solid rgba(255,255,255,.18);box-shadow:0 8px 24px rgba(0,0,0,.35),inset 0 0 0 1px rgba(255,255,255,.10);pointer-events:none}.vjs-progress-control .vjs-load-progress,.vjs-progress-control .vjs-play-progress{position:relative;z-index:1;border-radius:inherit!important}.vjs-progress-control .vjs-play-progress{background-image:linear-gradient(to right,#ff0045,#ff0e55,#ff1d79)!important}.vjs-progress-control .vjs-slider-handle{width:14px!important;height:14px!important;border-radius:50%!important;background:#fff!important;border:1px solid rgba(255,255,255,.9);box-shadow:0 6px 18px rgba(0,0,0,.35),0 0 0 3px rgba(255,0,90,.20);top:-4px!important;z-index:2}.vjs-volume-panel{gap:8px;align-items:center!important;padding:0;height:38px}.vjs-volume-bar{height:6px!important;border-radius:999px!important;background:#2c2c2c!important;border:none;box-shadow:none;position:relative}.vjs-volume-level{border-radius:inherit!important;background-image:linear-gradient(to right,#ff0045,#ff1d79)!important}.vjs-volume-bar .vjs-slider-handle{width:12px!important;height:12px!important;border-radius:50%!important;background:#fff!important;border:1px solid rgba(255,255,255,.9);top:-3px!important;box-shadow:0 4px 14px rgba(0,0,0,.3),0 0 0 3px rgba(255,0,90,.18)}@media (max-width:640px){.video-js .vjs-control-bar{bottom:10px!important}.vjs-control-bar{gap:8px;padding:6px 8px}.vjs-control-bar .vjs-button{width:34px;height:34px;min-width:34px}.vjs-control-bar .vjs-icon-placeholder:before{font-size:16px;line-height:34px}.vjs-current-time,.vjs-duration,.vjs-remaining-time,.vjs-time-divider{height:34px}.vjs-progress-control{height:34px}.vjs-progress-control .vjs-slider-handle{width:12px!important;height:12px!important;top:-3px!important}}
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