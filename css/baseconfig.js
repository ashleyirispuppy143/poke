function isMobileDevice() {
  const ua = navigator.userAgent || '';
  const uaDataMobile = navigator.userAgentData && navigator.userAgentData.mobile === true;
  const uaMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(ua);
  const isIPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1 && !window.MSStream;
  const coarsePointer = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  const noHover = window.matchMedia && window.matchMedia('(hover: none)').matches;
  const hasTouch = navigator.maxTouchPoints > 0 || 'ontouchstart' in window;
  const smallScreen = Math.min(window.screen.width, window.screen.height) <= 900;

  if (uaDataMobile || isIPadOS) return true;
  if (uaMobile && (hasTouch || coarsePointer)) return true;
  if (coarsePointer && noHover && hasTouch && smallScreen) return true;
  return false;
}

function detectOS() {
  const ua = navigator.userAgent || '';
  const platform = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || '';
  let os = 'Unknown';

  if (/Win/i.test(platform) || /Windows/i.test(ua)) {
    os = 'Windows';
  } else if (/Mac/i.test(platform) || /Macintosh|Mac OS X/i.test(ua)) {
    os = 'macOS';
  } else if (/CrOS/i.test(ua)) {
    os = 'ChromeOS';
  } else if (/Android/i.test(ua)) {
    os = 'Android';
  } else if (/iPhone|iPad|iPod/i.test(ua)) {
    os = 'iOS';
  } else if (/Linux|X11/i.test(platform) || /Linux/i.test(ua)) {
    os = 'Linux';
  } else if (/FreeBSD/i.test(ua)) {
    os = 'FreeBSD';
  } else if (/OpenBSD/i.test(ua)) {
    os = 'OpenBSD';
  }

  if (os.toLowerCase() === 'linux') {
    return 'GNU/Linux';
  }
  return os;
}

function getAlabasterVersion() {
  const v = window.AlabasterVersion || localStorage.getItem('AlabasterVersion');
  if (!v || String(v).trim() === '' || String(v).trim().toLowerCase() === 'unknown') {
    return null;
  }
  return String(v).trim();
}

function initSettingsApp() {
  const KEYBINDS_STORAGE_KEY = 'AlabasterCustomKeybinds';

  const DEFAULT_KEYBINDS = {
    playPause: 'k',
    playPauseAlt: ' ',
    fullscreen: 'f',
    mute: 'm',
    seekForward: 'arrowright',
    seekBackward: 'arrowleft',
    seekForwardAlt: 'l',
    seekBackwardAlt: 'j',
    seekForwardBig: 'L',
    seekBackwardBig: 'J',
    volumeUp: 'arrowup',
    volumeDown: 'arrowdown',
    seekStart: 'home',
    seekEnd: 'end'
  };

  const keybindItems = [
    { action: 'playPause', title: 'Play / Pause', subtitle: 'Toggle video playback', icon: '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>' },
    { action: 'playPauseAlt', title: 'Play / Pause (alternate)', subtitle: 'Secondary shortcut to toggle playback', icon: '<svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>' },
    { action: 'fullscreen', title: 'Fullscreen', subtitle: 'Enter or exit fullscreen mode', icon: '<svg viewBox="0 0 24 24"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>' },
    { action: 'mute', title: 'Mute / Unmute', subtitle: 'Toggle audio mute', icon: '<svg viewBox="0 0 24 24"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>' },
    { action: 'seekForward', title: 'Seek forward (10s)', subtitle: 'Jump forward 10 seconds', icon: '<svg viewBox="0 0 24 24"><path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/></svg>' },
    { action: 'seekBackward', title: 'Seek backward (10s)', subtitle: 'Jump backward 10 seconds', icon: '<svg viewBox="0 0 24 24"><path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z"/></svg>' },
    { action: 'seekForwardAlt', title: 'Seek forward (10s, alternate)', subtitle: 'Secondary shortcut to jump forward 10 seconds', icon: '<svg viewBox="0 0 24 24"><path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/></svg>' },
    { action: 'seekBackwardAlt', title: 'Seek backward (10s, alternate)', subtitle: 'Secondary shortcut to jump backward 10 seconds', icon: '<svg viewBox="0 0 24 24"><path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z"/></svg>' },
    { action: 'seekForwardBig', title: 'Seek forward (30s)', subtitle: 'Jump forward 30 seconds (supports Shift + key)', icon: '<svg viewBox="0 0 24 24"><path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/></svg>' },
    { action: 'seekBackwardBig', title: 'Seek backward (30s)', subtitle: 'Jump backward 30 seconds (supports Shift + key)', icon: '<svg viewBox="0 0 24 24"><path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z"/></svg>' },
    { action: 'volumeUp', title: 'Volume up', subtitle: 'Increase volume by 10%', icon: '<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>' },
    { action: 'volumeDown', title: 'Volume down', subtitle: 'Decrease volume by 10%', icon: '<svg viewBox="0 0 24 24"><path d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z"/></svg>' },
    { action: 'seekStart', title: 'Jump to start', subtitle: 'Seek to the beginning of the video', icon: '<svg viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>' },
    { action: 'seekEnd', title: 'Jump to end', subtitle: 'Seek to the end of the video', icon: '<svg viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>' }
  ];

  const mainSections = [
    {
      id: 'sec-fullscreen',
      title: 'Fullscreen & Interface',
      description: 'Customise how the video player overlays, descriptions, shortcuts, and playback gestures behave',
      items: [
        {
          key: 'ambientState',
          title: 'Ambient mode',
          subtitle: 'Ambient light mode uses a very cool ahh effect to make watching videos more immersive by casting gentle colors from the video into your screen’s background! and it looks amazing :3 owo',
          icon: '<svg viewBox="0 0 24 24"><path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58a.996.996 0 0 0-1.41 0 .996.996 0 0 0 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37a.996.996 0 0 0-1.41 0 .996.996 0 0 0 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0a.996.996 0 0 0 0-1.41l-1.06-1.06zm1.06-10.96a.996.996 0 0 0 0-1.41.996.996 0 0 0-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06zM7.05 18.36a.996.996 0 0 0 0-1.41.996.996 0 0 0-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06z"/></svg>',
          defaultValue: true
        },
        {
          key: 'theaterMode',
          title: 'Theater mode',
          subtitle: 'Expand the video player across the full width of the page',
          icon: '<svg viewBox="0 0 24 24"><path d="M19 6H5c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 10H5V8h14v8z"/></svg>'
        },
        {
          key: 'DontUseAlabasterStyleDescriptionOpeningFS',
          title: 'Use Description button instead of title',
          subtitle: 'YouTube doesn\'t have a description button, so for parity reasons this defaults to clicking the title. Enable this to use a dedicated Description button instead.',
          icon: '<svg viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>',
          parity: true
        },
        {
          key: 'CloseFullScreenDiscover',
          title: 'Remove Discover in fullscreen',
          subtitle: 'Hide the recommended videos drawer when watching in fullscreen mode',
          icon: '<svg viewBox="0 0 24 24"><path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46A11.804 11.804 0 0 0 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78 3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"/></svg>'
        },
        {
          key: 'ShowDislikesOnFullScreenDesc',
          title: 'Show dislike count in fullscreen description',
          subtitle: 'Display the video dislike count instead of the upload date in the fullscreen overlay',
          icon: '<svg viewBox="0 0 24 24"><path d="M15 3H6c-.83 0-1.54.5-1.84 1.22l-3.02 7.05c-.09.23-.14.47-.14.73v2c0 1.1.9 2 2 2h6.31l-.95 4.57-.03.32c0 .41.17.79.44 1.06L9.83 23l6.59-6.59c.36-.36.58-.86.58-1.41V5c0-1.1-.9-2-2-2zm4 0v12h4V3h-4z"/></svg>',
          parity: true
        },
        {
          key: 'DontShowVerifiedBadgeOnPopUpDescription',
          title: 'Hide channel verification badge in popup description',
          subtitle: 'Omit the verified checkmark next to channel names in the fullscreen description popup',
          icon: '<svg viewBox="0 0 24 24"><path d="M23 12l-2.44-2.79.34-3.69-3.61-.82-1.89-3.2L12 2.96 8.6 1.5 6.71 4.69 3.1 5.5l.34 3.7L1 12l2.44 2.79-.34 3.7 3.61.82L8.6 22.5l3.4-1.47 3.4 1.46 1.89-3.19 3.61-.82-.34-3.69L23 12zm-12.91 4.72-3.8-3.81 1.48-1.48 2.32 2.33 5.85-5.87 1.48 1.48-7.33 7.35z"/></svg>',
          parity: true
        },
        {
          key: 'AlabasterDontUseYoutubeStyleRecommendationsShortcut',
          title: 'Disable "V" shortcut for recommendations',
          subtitle: 'Prevent pressing the V key from opening recommended videos while in fullscreen',
          icon: '<svg viewBox="0 0 24 24"><path d="M20 5H4c-1.1 0-1.99.9-1.99 2L2 17c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm-9 3h2v2h-2V8zm0 3h2v2h-2v-2zM8 8h2v2H8V8zm0 3h2v2H8v-2zm-1 2H5v-2h2v2zm0-3H5V8h2v2zm9 7H8v-2h8v2zm0-4h-2v-2h2v2zm0-3h-2V8h2v2zm3 3h-2v-2h2v2zm0-3h-2V8h2v2z"/></svg>',
          disabledWhen: {
            key: 'CloseFullScreenDiscover',
            value: true,
            reason: 'Unavailable while "Remove Discover in fullscreen" is enabled'
          }
        },
        {
          key: 'AlabasterDisableAttentionSpanFixer',
          title: 'Disable hold-to-2x playback speed',
          subtitle: 'Prevent holding right-click or the Space key from temporarily speeding up playback to 2x',
          icon: '<svg viewBox="0 0 24 24"><path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/></svg>'
        },
        {
          key: 'AlabasterDisableNumberKeySeeking',
          title: 'Disable seeking on the number keys',
          subtitle: 'Prevent pressing number keys (0–9) from jumping to percentage timestamps in the video',
          icon: '<svg viewBox="0 0 24 24"><path d="M12 19c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zM6 1c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm12-8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm-6 8c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm6 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0-6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm-6 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0-6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>'
        }
      ]
    },
    {
      id: 'sec-captions',
      title: 'Captions & Subtitles',
      description: 'Manage caption styling and subtitle persistence across videos',
      items: [
        {
          key: 'DontUseYoutubeStyleCapitions',
          title: 'Use default browser captions menu',
          subtitle: 'Replace the custom YouTube-style caption overlay with the native player menu',
          icon: '<svg viewBox="0 0 24 24"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zM4 12h4v2H4v-2zm10 6H4v-2h10v2zm6 0h-4v-2h4v2zm0-4H10v-2h10v2z"/></svg>',
          parity: true
        },
        {
          key: 'DontSaveSubtitleState',
          title: 'Don\'t save subtitle state across videos',
          subtitle: 'Reset subtitle visibility and language selection whenever a new video loads',
          icon: '<svg viewBox="0 0 24 24"><path d="M12.87 15.07l-2.54-2.51.03-.03A17.52 17.52 0 0 0 14.07 6H17V4h-7V2H8v2H1v2h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7 1.62-4.33L19.12 17h-3.24z"/></svg>',
          disabledWhen: {
            key: 'DontUseYoutubeStyleCapitions',
            value: true,
            reason: 'Requires "Use default browser captions menu" to be off'
          }
        },
        {
          key: 'AlabasterSubtitleDefaultUseSystemLanguge',
          title: 'Default to device display language for subtitles',
          subtitle: 'Try to select your device\'s display language first instead of the first available subtitle track, falling back to the first track if unavailable',
          icon: '<svg viewBox="0 0 24 24"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zm6.93 6h-2.95c-.32-1.25-.78-2.45-1.38-3.56 1.84.63 3.37 1.91 4.33 3.56zM12 4.04c.83 1.2 1.48 2.53 1.91 3.96h-3.82c.43-1.43 1.08-2.76 1.91-3.96zM4.26 14C4.1 13.36 4 12.69 4 12s.1-1.36.26-2h3.38c-.08.66-.14 1.32-.14 2 0 .68.06 1.34.14 2H4.26zm.82 2h2.95c.32 1.25.78 2.45 1.38 3.56-1.84-.63-3.37-1.91-4.33-3.56zm2.95-8H5.08c.96-1.66 2.49-2.93 4.33-3.56C8.81 5.55 8.35 6.75 8.03 8zM12 19.96c-.83-1.2-1.48-2.53-1.91-3.96h3.82c-.43 1.43-1.08 2.76-1.91 3.96zM14.34 14H9.66c-.09-.66-.16-1.32-.16-2 0-.68.07-1.35.16-2h4.68c.09.65.16 1.32.16 2 0 .68-.07 1.34-.16 2zm.25 5.56c.6-1.11 1.06-2.31 1.38-3.56h2.95c-.96 1.65-2.49 2.93-4.33 3.56zM16.36 14c.08-.66.14-1.32.14-2 0-.68-.06-1.34-.14-2h3.38c.16.64.26 1.31.26 2s-.1 1.36-.26 2h-3.38z"/></svg>',
          disabledWhen: {
            key: 'DontUseYoutubeStyleCapitions',
            value: true,
            reason: 'Requires "Use default browser captions menu" to be off'
          }
        }
      ]
    }
  ];

  const experimentsSection = {
    id: 'sec-experiments',
    title: 'Experiments',
    description: 'Experimental player features that may change or be removed in future updates',
    items: [
      {
        key: 'AlabasterEnableAutoSubtitle',
        title: 'Auto-enable subtitles in device language',
        subtitle: 'Automatically turn on subtitles when a track matches your device language; does nothing if no matching track exists',
        icon: '<svg viewBox="0 0 24 24"><path d="M19 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-8 7H9.5v-.5h-2v3h2V13H11v1c0 .55-.45 1-1 1H7c-.55 0-1-.45-1-1v-4c0-.55.45-1 1-1h3c.55 0 1 .45 1 1v1zm7 0h-1.5v-.5h-2v3h2V13H18v1c0 .55-.45 1-1 1h-3c-.55 0-1-.45-1-1v-4c0-.55.45-1 1-1h3c.55 0 1 .45 1 1v1z"/></svg>',
        disabledWhen: {
          key: 'DontUseYoutubeStyleCapitions',
          value: true,
          reason: 'Requires "Use default browser captions menu" to be off'
        }
      }
    ]
  };

  const allItems = [
    ...mainSections.flatMap(section => section.items),
    ...experimentsSection.items
  ];

  const paritySection = {
    id: 'sec-parity',
    title: 'YouTube Parity',
    description: 'Adjust player features that differ from or match the standard YouTube experience',
    items: allItems.filter(item => item.parity)
  };

  const parityPill = document.querySelector('.nav-pill[data-view="parity"]');
  if (parityPill && !document.querySelector('.nav-pill[data-view="experiments"]')) {
    const expPill = document.createElement('button');
    expPill.className = 'nav-pill';
    expPill.dataset.view = 'experiments';
    expPill.innerHTML =
      '<svg viewBox="0 0 24 24"><path d="M7 2v2h1v6.29L3.3 17.6A2.5 2.5 0 0 0 5.42 21h13.16a2.5 2.5 0 0 0 2.12-3.4L16 10.29V4h1V2H7zm3 2h4v6.84l3.82 6.01A.5.5 0 0 1 17.4 18H6.6a.5.5 0 0 1-.42-.77L10 10.84V4z"/></svg>' +
      '<span>Experiments</span>';
    parityPill.insertAdjacentElement('afterend', expPill);
  }

  const loader = document.getElementById('loader');
  const mainView = document.getElementById('main-view');
  const keybindsView = document.getElementById('keybinds-view');
  const parityView = document.getElementById('parity-view');
  const aboutView = document.getElementById('about-view');

  let experimentsView = document.getElementById('experiments-view');
  if (!experimentsView && parityView) {
    experimentsView = document.createElement('div');
    experimentsView.id = 'experiments-view';
    experimentsView.className = 'view-hidden';
    parityView.insertAdjacentElement('afterend', experimentsView);
  }

  const comingSoon = document.getElementById('coming-soon');
  const navPills = document.querySelectorAll('.nav-pill');
  const exportBtn = document.getElementById('export-settings-btn');
  const importBtn = document.getElementById('import-settings-btn');
  const importInput = document.getElementById('import-settings-input');
  const toastEl = document.getElementById('toast');

  let recordingAction = null;
  let toastTimer = null;

  function getSettingBool(item) {
    const val = localStorage.getItem(item.key);
    if (item.defaultValue === true) {
      return val !== 'false';
    }
    return val === 'true';
  }

  function showToast(message) {
    toastEl.textContent = message;
    toastEl.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastEl.classList.remove('is-visible');
    }, 3000);
  }

  function getSavedKeybinds() {
    try {
      const parsed = JSON.parse(localStorage.getItem(KEYBINDS_STORAGE_KEY) || '{}');
      return { ...DEFAULT_KEYBINDS, ...parsed };
    } catch {
      return { ...DEFAULT_KEYBINDS };
    }
  }

  function saveKeybinds(binds) {
    localStorage.setItem(KEYBINDS_STORAGE_KEY, JSON.stringify(binds));
    syncKeybindsUI();
    updateAboutConfig();
  }

  function formatKeyLabel(key) {
    const labels = {
      ' ': 'Space',
      'arrowright': '→',
      'arrowleft': '←',
      'arrowup': '↑',
      'arrowdown': '↓',
      'home': 'Home',
      'end': 'End',
      'enter': 'Enter',
      'tab': 'Tab',
      'backspace': 'Backspace',
      'delete': 'Del'
    };
    if (labels[key]) return labels[key];
    if (key.length === 1 && key >= 'A' && key <= 'Z') return `Shift + ${key}`;
    return key.length === 1 ? key.toUpperCase() : key;
  }

  function syncKeybindsUI() {
    const binds = getSavedKeybinds();
    document.querySelectorAll('.keybind-btn').forEach(btn => {
      const action = btn.dataset.action;
      if (recordingAction === action) {
        btn.textContent = 'Press a key...';
        btn.classList.add('is-recording');
      } else {
        btn.textContent = formatKeyLabel(binds[action]);
        btn.classList.remove('is-recording');
      }
    });
  }

  function getConfigSnapshot() {
    const settings = {};
    allItems.forEach(item => {
      settings[item.key] = getSettingBool(item);
    });
    return {
      settings,
      keybinds: getSavedKeybinds()
    };
  }

  function updateAboutConfig() {
    const pre = document.getElementById('about-config-pre');
    if (pre) {
      pre.textContent = JSON.stringify(getConfigSnapshot(), null, 2);
    }
  }

  exportBtn.addEventListener('click', () => {
    const payload = {
      hostname: window.location.hostname,
      'exported at': new Date().toISOString(),
      ...getConfigSnapshot()
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'poke-player-settings.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  importBtn.addEventListener('click', () => {
    importInput.value = '';
    importInput.click();
  });

  importInput.addEventListener('change', () => {
    const file = importInput.files && importInput.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!parsed || typeof parsed !== 'object') {
          throw new Error('Invalid settings file');
        }

        const currentHost = window.location.hostname;
        if (!parsed.hostname || parsed.hostname !== currentHost) {
          showToast(`Cannot import from another site. This only works on ${currentHost} instance.`);
          return;
        }

        const validKeys = new Set(allItems.map(item => item.key));
        const importedSettings = parsed.settings && typeof parsed.settings === 'object'
          ? parsed.settings
          : parsed;

        Object.entries(importedSettings).forEach(([key, value]) => {
          if (validKeys.has(key)) {
            localStorage.setItem(key, String(Boolean(value === true || value === 'true')));
          }
        });

        if (parsed.keybinds && typeof parsed.keybinds === 'object') {
          const cleanedBinds = { ...DEFAULT_KEYBINDS };
          Object.keys(DEFAULT_KEYBINDS).forEach(action => {
            if (typeof parsed.keybinds[action] === 'string' && parsed.keybinds[action].length > 0) {
              cleanedBinds[action] = parsed.keybinds[action];
            }
          });
          localStorage.setItem(KEYBINDS_STORAGE_KEY, JSON.stringify(cleanedBinds));
        }

        syncSettings();
        showToast('Imported settings!');
      } catch {
        showToast('Could not import settings: invalid JSON file.');
      }
    };
    reader.readAsText(file);
  });

  document.addEventListener('keydown', (e) => {
    if (!recordingAction) return;
    if (['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return;

    e.preventDefault();
    e.stopPropagation();

    if (e.key === 'Escape') {
      recordingAction = null;
      syncKeybindsUI();
      return;
    }

    const raw = e.key;
    const normalized = raw.length === 1
      ? (e.shiftKey ? raw : raw.toLowerCase())
      : raw.toLowerCase();

    const binds = getSavedKeybinds();
    const conflictAction = Object.keys(binds).find(
      action => action !== recordingAction && binds[action] === normalized
    );

    if (conflictAction) {
      const conflictItem = keybindItems.find(item => item.action === conflictAction);
      const conflictName = conflictItem ? conflictItem.title : conflictAction;
      showToast(`"${formatKeyLabel(normalized)}" is already bound to ${conflictName}.`);
      recordingAction = null;
      syncKeybindsUI();
      return;
    }

    binds[recordingAction] = normalized;
    recordingAction = null;
    saveKeybinds(binds);
  }, true);

  navPills.forEach(pill => {
    pill.addEventListener('click', () => {
      navPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');

      if (recordingAction) {
        recordingAction = null;
        syncKeybindsUI();
      }

      const view = pill.dataset.view;
      mainView.classList.toggle('view-hidden', view !== 'main');
      keybindsView.classList.toggle('view-hidden', view !== 'keybinds');
      parityView.classList.toggle('view-hidden', view !== 'parity');
      if (experimentsView) {
        experimentsView.classList.toggle('view-hidden', view !== 'experiments');
      }
      aboutView.classList.toggle('view-hidden', view !== 'about');
      comingSoon.classList.toggle('view-hidden', view === 'keybinds' || view === 'about' || view === 'experiments');

      if (view === 'about') {
        updateAboutConfig();
      }

      if (view === 'main') {
        const target = document.getElementById(pill.dataset.target);
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  });

  function updateDependencies() {
    allItems.forEach(({ key, disabledWhen }) => {
      if (!disabledWhen) return;
      const parentItem = allItems.find(i => i.key === disabledWhen.key);
      const parentVal = parentItem
        ? getSettingBool(parentItem)
        : localStorage.getItem(disabledWhen.key) === 'true';
      const shouldDisable = parentVal === disabledWhen.value;

      document.querySelectorAll(`input[data-key="${key}"]`).forEach(toggle => {
        toggle.disabled = shouldDisable;
        const card = toggle.closest('.setting-card');
        if (card) {
          card.classList.toggle('is-disabled', shouldDisable);
        }
      });
    });
  }

  function syncSettings() {
    allItems.forEach(item => {
      const isChecked = getSettingBool(item);
      document.querySelectorAll(`input[data-key="${item.key}"]`).forEach(toggle => {
        if (toggle.checked !== isChecked) {
          toggle.checked = isChecked;
        }
      });
    });
    updateDependencies();
    syncKeybindsUI();
    updateAboutConfig();
  }

  function createToggleCard(item) {
    const { key, title, subtitle, icon, disabledWhen, defaultValue } = item;
    const card = document.createElement('div');
    card.className = 'setting-card';

    const cardLeft = document.createElement('div');
    cardLeft.className = 'card-left';

    const iconWrap = document.createElement('div');
    iconWrap.className = 'card-icon';
    iconWrap.innerHTML = icon;

    const info = document.createElement('div');
    info.className = 'setting-info';

    const titleSpan = document.createElement('span');
    titleSpan.className = 'setting-title';
    titleSpan.textContent = title;

    const subSpan = document.createElement('span');
    subSpan.className = 'setting-subtitle';
    subSpan.textContent = subtitle;

    info.appendChild(titleSpan);
    info.appendChild(subSpan);

    if (disabledWhen) {
      const noteSpan = document.createElement('span');
      noteSpan.className = 'dependency-note';
      noteSpan.textContent = disabledWhen.reason;
      info.appendChild(noteSpan);
    }

    cardLeft.appendChild(iconWrap);
    cardLeft.appendChild(info);

    const switchLabel = document.createElement('label');
    switchLabel.className = 'switch';

    const toggle = document.createElement('input');
    toggle.type = 'checkbox';
    toggle.dataset.key = key;

    const slider = document.createElement('span');
    slider.className = 'slider';

    switchLabel.appendChild(toggle);
    switchLabel.appendChild(slider);

    card.appendChild(cardLeft);
    card.appendChild(switchLabel);

    if (localStorage.getItem(key) === null) {
      localStorage.setItem(key, defaultValue === true ? 'true' : 'false');
    }

    toggle.checked = getSettingBool(item);

    toggle.addEventListener('change', () => {
      localStorage.setItem(key, String(toggle.checked));
      syncSettings();
    });

    return card;
  }

  function buildSection(section) {
    const secEl = document.createElement('section');
    secEl.className = 'section';
    secEl.id = section.id;

    const header = document.createElement('div');
    header.className = 'section-header';

    const headerText = document.createElement('div');
    const h2 = document.createElement('h2');
    h2.className = 'section-title';
    h2.textContent = section.title;

    const desc = document.createElement('p');
    desc.className = 'section-desc';
    desc.textContent = section.description;

    headerText.appendChild(h2);
    headerText.appendChild(desc);
    header.appendChild(headerText);

    const cardGroup = document.createElement('div');
    cardGroup.className = 'card-group';

    section.items.forEach(item => {
      cardGroup.appendChild(createToggleCard(item));
    });

    secEl.appendChild(header);
    secEl.appendChild(cardGroup);
    return secEl;
  }

  function buildKeybindsSection() {
    const secEl = document.createElement('section');
    secEl.className = 'section';
    secEl.id = 'sec-keybinds';

    const header = document.createElement('div');
    header.className = 'section-header';

    const headerText = document.createElement('div');
    const h2 = document.createElement('h2');
    h2.className = 'section-title';
    h2.textContent = 'Keybinds';

    const desc = document.createElement('p');
    desc.className = 'section-desc';
    desc.textContent = 'Click any shortcut and press a new key to rebind it (Esc to cancel)';

    headerText.appendChild(h2);
    headerText.appendChild(desc);

    const resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.className = 'reset-btn';
    resetBtn.textContent = 'Reset to defaults';
    resetBtn.addEventListener('click', () => {
      recordingAction = null;
      localStorage.removeItem(KEYBINDS_STORAGE_KEY);
      syncKeybindsUI();
      updateAboutConfig();
    });

    header.appendChild(headerText);
    header.appendChild(resetBtn);

    const togglesGroup = document.createElement('div');
    togglesGroup.className = 'card-group';

    [
      'AlabasterDontUseYoutubeStyleRecommendationsShortcut',
      'AlabasterDisableAttentionSpanFixer',
      'AlabasterDisableNumberKeySeeking'
    ].forEach(key => {
      const item = allItems.find(i => i.key === key);
      if (item) {
        togglesGroup.appendChild(createToggleCard(item));
      }
    });

    const keybindsGroup = document.createElement('div');
    keybindsGroup.className = 'card-group';

    keybindItems.forEach(({ action, title, subtitle, icon }) => {
      const card = document.createElement('div');
      card.className = 'setting-card';

      const cardLeft = document.createElement('div');
      cardLeft.className = 'card-left';

      const iconWrap = document.createElement('div');
      iconWrap.className = 'card-icon';
      iconWrap.innerHTML = icon;

      const info = document.createElement('div');
      info.className = 'setting-info';

      const titleSpan = document.createElement('span');
      titleSpan.className = 'setting-title';
      titleSpan.textContent = title;

      const subSpan = document.createElement('span');
      subSpan.className = 'setting-subtitle';
      subSpan.textContent = subtitle;

      info.appendChild(titleSpan);
      info.appendChild(subSpan);

      cardLeft.appendChild(iconWrap);
      cardLeft.appendChild(info);

      const keyBtn = document.createElement('button');
      keyBtn.type = 'button';
      keyBtn.className = 'keybind-btn';
      keyBtn.dataset.action = action;
      keyBtn.addEventListener('click', () => {
        recordingAction = recordingAction === action ? null : action;
        syncKeybindsUI();
      });

      card.appendChild(cardLeft);
      card.appendChild(keyBtn);
      keybindsGroup.appendChild(card);
    });

    secEl.appendChild(header);
    secEl.appendChild(togglesGroup);
    secEl.appendChild(keybindsGroup);
    return secEl;
  }

  function buildAboutSection() {
    const secEl = document.createElement('section');
    secEl.className = 'section';
    secEl.id = 'sec-about';

    const header = document.createElement('div');
    header.className = 'section-header';

    const h2 = document.createElement('h2');
    h2.className = 'section-title';
    h2.textContent = 'About PokePlayer';

    header.appendChild(h2);

    const version = getAlabasterVersion() || 'Unknown';
    const userId = localStorage.getItem('UserID');

    const infoRows = [
      { label: 'AlabasterVersion', value: version },
      { label: 'Video.js Version', value: '8.23.4' },
      { label: 'YouTube Player ID', value: 'Loading...', id: 'about-yt-player-id' },
      { label: 'Hostname', value: window.location.hostname || 'localhost' },
      { label: 'OS', value: detectOS() },
      { label: 'User Agent', value: navigator.userAgent || 'Unknown' }
    ];

    if (userId) {
      infoRows.splice(4, 0, { label: 'User ID', value: userId });
    }

    const infoGroup = document.createElement('div');
    infoGroup.className = 'card-group';

    infoRows.forEach(({ label, value, id }) => {
      const card = document.createElement('div');
      card.className = 'setting-card';

      const titleSpan = document.createElement('span');
      titleSpan.className = 'setting-title';
      titleSpan.textContent = label;

      const valSpan = document.createElement('span');
      valSpan.className = 'about-value';
      if (id) valSpan.id = id;
      valSpan.textContent = value;

      card.appendChild(titleSpan);
      card.appendChild(valSpan);
      infoGroup.appendChild(card);
    });

    fetch('/api/latestplayer')
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch player ID');
        return res.json();
      })
      .then(data => {
        const valEl = document.getElementById('about-yt-player-id');
        if (!valEl) return;
        const playerID = data && data.playerID ? String(data.playerID).trim() : '';
        if (!playerID) {
          valEl.textContent = 'Unknown';
          return;
        }
        const link = document.createElement('a');
        link.href = `/s/player/${encodeURIComponent(playerID)}/player_ias.vflset/en_US/base.js`;
        link.target = '_blank';
        link.rel = 'noopener';
        link.textContent = playerID;
        link.style.color = 'var(--accent)';
        link.style.textDecoration = 'none';
        link.addEventListener('mouseenter', () => { link.style.textDecoration = 'underline'; });
        link.addEventListener('mouseleave', () => { link.style.textDecoration = 'none'; });
        valEl.textContent = '';
        valEl.appendChild(link);
      })
      .catch(() => {
        const valEl = document.getElementById('about-yt-player-id');
        if (valEl) valEl.textContent = 'Unknown';
      });

    const configGroup = document.createElement('div');
    configGroup.className = 'card-group';

    const configCard = document.createElement('div');
    configCard.className = 'setting-card about-card-column';

    const configTitle = document.createElement('span');
    configTitle.className = 'setting-title';
    configTitle.textContent = 'Config Settings';

    const configPre = document.createElement('pre');
    configPre.id = 'about-config-pre';
    configPre.className = 'about-config-pre';
    configPre.textContent = JSON.stringify(getConfigSnapshot(), null, 2);

    configCard.appendChild(configTitle);
    configCard.appendChild(configPre);
    configGroup.appendChild(configCard);

    const currentYear = new Date().getFullYear();
    const legalBox = document.createElement('div');
    legalBox.className = 'about-legal';
    legalBox.innerHTML =
      `<img src="/css/logo-poke.svg?v=5" alt="Poke" class="about-legal-logo">` +
      `<p>Copyleft 2024-${currentYear} Poke Project, proudly not vibecoded!!!! :3 Licensed under GPL 3-or-later!  <a href="https://codeberg.org/ashleyirispuppy/poke/src/branch/main/css/base-player.js" target="_blank" rel="noopener">View PokePlayer source code</a>.</p>` +
      `<p>Uses <a href="https://videojs.com/" target="_blank" rel="noopener">Video.js</a> (licensed under Apache 2.0; <a href="/static/vjs.min.js" target="_blank" rel="noopener">view hosted file here :D</a>) and <a href="https://codeberg.org/ashleyirispuppy/poke-companion-public" target="_blank" rel="noopener">Invidious Companion</a> for video playback!!</p>` +
      `<p>Poke YouTube front-end is not affiliated with Google LLC. YouTube and YouTube Music are trademarks of Google LLC. Poke is a front-end for YouTube.</p>`;

    secEl.appendChild(header);
    secEl.appendChild(infoGroup);
    secEl.appendChild(configGroup);
    secEl.appendChild(legalBox);
    return secEl;
  }

  setTimeout(() => {
    loader.style.display = 'none';

    mainSections.forEach(section => {
      mainView.appendChild(buildSection(section));
    });

    keybindsView.appendChild(buildKeybindsSection());
    parityView.appendChild(buildSection(paritySection));
    if (experimentsView) {
      experimentsView.appendChild(buildSection(experimentsSection));
    }
    aboutView.appendChild(buildAboutSection());

    updateDependencies();
    syncKeybindsUI();

    window.addEventListener('storage', syncSettings);
    window.addEventListener('focus', syncSettings);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) syncSettings();
    });
    setInterval(syncSettings, 2000);
  }, 400);
}

if (isMobileDevice()) {
  document.body.classList.add('is-mobile');
} else if (!getAlabasterVersion()) {
  const layoutEl = document.querySelector('.layout');
  if (layoutEl) layoutEl.style.display = 'none';

  const lockNotice = document.createElement('div');
  lockNotice.setAttribute('role', 'status');
  Object.assign(lockNotice.style, {
    display: 'flex',
    flex: '1',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    padding: '32px 24px',
    color: 'var(--text-secondary)',
    fontSize: '16px',
    lineHeight: '1.5'
  });
  lockNotice.textContent = 'you must watch a video before configuring the player';
  document.body.appendChild(lockNotice);

  let versionCheckInterval = 0;
  const checkVersionUnlock = () => {
    if (getAlabasterVersion()) {
      clearInterval(versionCheckInterval);
      window.removeEventListener('storage', checkVersionUnlock);
      lockNotice.remove();
      if (layoutEl) layoutEl.style.display = '';
      initSettingsApp();
    }
  };

  window.addEventListener('storage', checkVersionUnlock);
  versionCheckInterval = setInterval(checkVersionUnlock, 10000);
} else {
  initSettingsApp();
}