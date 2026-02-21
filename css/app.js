// @license magnet:?xt=urn:btih:1f739d935676111cfff4b4693e3816e664797050&dn=gpl-3.0.txt GPL-3.0-or-later  

/*
CryptoJS v3.1.2
code.google.com/p/crypto-js
(c) 2009-2013 by Jeff Mott. All rights reserved.
code.google.com/p/crypto-js/wiki/License
*/
var CryptoJS=CryptoJS||function(h,s){var f={},t=f.lib={},g=function(){},j=t.Base={extend:function(a){g.prototype=this;var c=new g;a&&c.mixIn(a);c.hasOwnProperty("init")||(c.init=function(){c.$super.init.apply(this,arguments)});c.init.prototype=c;c.$super=this;return c},create:function(){var a=this.extend();a.init.apply(a,arguments);return a},init:function(){},mixIn:function(a){for(var c in a)a.hasOwnProperty(c)&&(this[c]=a[c]);a.hasOwnProperty("toString")&&(this.toString=a.toString)},clone:function(){return this.init.prototype.extend(this)}},
q=t.WordArray=j.extend({init:function(a,c){a=this.words=a||[];this.sigBytes=c!=s?c:4*a.length},toString:function(a){return(a||u).stringify(this)},concat:function(a){var c=this.words,d=a.words,b=this.sigBytes;a=a.sigBytes;this.clamp();if(b%4)for(var e=0;e<a;e++)c[b+e>>>2]|=(d[e>>>2]>>>24-8*(e%4)&255)<<24-8*((b+e)%4);else if(65535<d.length)for(e=0;e<a;e+=4)c[b+e>>>2]=d[e>>>2];else c.push.apply(c,d);this.sigBytes+=a;return this},clamp:function(){var a=this.words,c=this.sigBytes;a[c>>>2]&=4294967295<<
32-8*(c%4);a.length=h.ceil(c/4)},clone:function(){var a=j.clone.call(this);a.words=this.words.slice(0);return a},random:function(a){for(var c=[],d=0;d<a;d+=4)c.push(4294967296*h.random()|0);return new q.init(c,a)}}),v=f.enc={},u=v.Hex={stringify:function(a){var c=a.words;a=a.sigBytes;for(var d=[],b=0;b<a;b++){var e=c[b>>>2]>>>24-8*(b%4)&255;d.push((e>>>4).toString(16));d.push((e&15).toString(16))}return d.join("")},parse:function(a){for(var c=a.length,d=[],b=0;b<c;b+=2)d[b>>>3]|=parseInt(a.substr(b,
2),16)<<24-4*(b%8);return new q.init(d,c/2)}},k=v.Latin1={stringify:function(a){var c=a.words;a=a.sigBytes;for(var d=[],b=0;b<a;b++)d.push(String.fromCharCode(c[b>>>2]>>>24-8*(b%4)&255));return d.join("")},parse:function(a){for(var c=a.length,d=[],b=0;b<c;b++)d[b>>>2]|=(a.charCodeAt(b)&255)<<24-8*(b%4);return new q.init(d,c)}},l=v.Utf8={stringify:function(a){try{return decodeURIComponent(escape(k.stringify(a)))}catch(c){throw Error("Malformed UTF-8 data");}},parse:function(a){return k.parse(unescape(encodeURIComponent(a)))}},
x=t.BufferedBlockAlgorithm=j.extend({reset:function(){this._data=new q.init;this._nDataBytes=0},_append:function(a){"string"==typeof a&&(a=l.parse(a));this._data.concat(a);this._nDataBytes+=a.sigBytes},_process:function(a){var c=this._data,d=c.words,b=c.sigBytes,e=this.blockSize,f=b/(4*e),f=a?h.ceil(f):h.max((f|0)-this._minBufferSize,0);a=f*e;b=h.min(4*a,b);if(a){for(var m=0;m<a;m+=e)this._doProcessBlock(d,m);m=d.splice(0,a);c.sigBytes-=b}return new q.init(m,b)},clone:function(){var a=j.clone.call(this);
a._data=this._data.clone();return a},_minBufferSize:0});t.Hasher=x.extend({cfg:j.extend(),init:function(a){this.cfg=this.cfg.extend(a);this.reset()},reset:function(){x.reset.call(this);this._doReset()},update:function(a){this._append(a);this._process();return this},finalize:function(a){a&&this._append(a);return this._doFinalize()},blockSize:16,_createHelper:function(a){return function(c,d){return(new a.init(d)).finalize(c)}},_createHmacHelper:function(a){return function(c,d){return(new w.HMAC.init(a,
d)).finalize(c)}}});var w=f.algo={};return f}(Math);
(function(h){for(var s=CryptoJS,f=s.lib,t=f.WordArray,g=f.Hasher,f=s.algo,j=[],q=[],v=function(a){return 4294967296*(a-(a|0))|0},u=2,k=0;64>k;){var l;a:{l=u;for(var x=h.sqrt(l),w=2;w<=x;w++)if(!(l%w)){l=!1;break a}l=!0}l&&(8>k&&(j[k]=v(h.pow(u,0.5))),q[k]=v(h.pow(u,1/3)),k++);u++}var a=[],f=f.SHA256=g.extend({_doReset:function(){this._hash=new t.init(j.slice(0))},_doProcessBlock:function(c,d){for(var b=this._hash.words,e=b[0],f=b[1],m=b[2],h=b[3],p=b[4],j=b[5],k=b[6],l=b[7],n=0;64>n;n++){if(16>n)a[n]=
c[d+n]|0;else{var r=a[n-15],g=a[n-2];a[n]=((r<<25|r>>>7)^(r<<14|r>>>18)^r>>>3)+a[n-7]+((g<<15|g>>>17)^(g<<13|g>>>19)^g>>>10)+a[n-16]}r=l+((p<<26|p>>>6)^(p<<21|p>>>11)^(p<<7|p>>>25))+(p&j^~p&k)+q[n]+a[n];g=((e<<30|e>>>2)^(e<<19|e>>>13)^(e<<10|e>>>22))+(e&f^e&m^f&m);l=k;k=j;j=p;p=h+r|0;h=m;m=f;f=e;e=r+g|0}b[0]=b[0]+e|0;b[1]=b[1]+f|0;b[2]=b[2]+m|0;b[3]=b[3]+h|0;b[4]=b[4]+p|0;b[5]=b[5]+j|0;b[6]=b[6]+k|0;b[7]=b[7]+l|0},_doFinalize:function(){var a=this._data,d=a.words,b=8*this._nDataBytes,e=8*a.sigBytes;
d[e>>>5]|=128<<24-e%32;d[(e+64>>>9<<4)+14]=h.floor(b/4294967296);d[(e+64>>>9<<4)+15]=b;a.sigBytes=4*d.length;this._process();return this._hash},clone:function(){var a=g.clone.call(this);a._hash=this._hash.clone();return a}});s.SHA256=g._createHelper(f);s.HmacSHA256=g._createHmacHelper(f)})(Math);

const video = document.getElementById('video'); 

// Replaces the current URL without the 'fx' parameter
const url = new URL(window.location.href);
url.searchParams.delete('fx');
history.replaceState(null, '', url.toString());


// Get the progress bar and container elements
const progressBar = document.querySelector(".progress-bar");
const progressContainer = document.querySelector(".progress-container");

// Set the initial width of the progress bar to 0%
progressBar.style.width = "0%";
progressContainer.style.display = 'block';

// Attach an event listener to the window object to listen for the 'load' event
window.addEventListener("load", () => {
  progressBar.style.width = "100%";
  setTimeout(() => {
    progressContainer.style.display = 'none';
  }, 500);
});

// Lazy load background images
document.addEventListener('DOMContentLoaded', function() {
  const bgs = document.querySelectorAll('[data-bg]');
  let bgCount = bgs.length;

  function loadBg(index) {
    const bg = bgs[index];
    const bgUrl = bg.getAttribute('data-bg');
    bg.style.backgroundImage = `url(${bgUrl})`;
    bg.removeAttribute('data-bg');
    bg.classList.add('loaded');
  }

  function lazyLoadBg() {
    for (let i = 0; i < bgCount; i++) {
      const bg = bgs[i];
      const bgRect = bg.getBoundingClientRect();
      if (bgRect.top < window.innerHeight && bgRect.bottom > 0) {
        loadBg(i);
      }
    }
  }

  lazyLoadBg();

  window.addEventListener('scroll', lazyLoadBg);
  window.addEventListener('resize', lazyLoadBg);
});

(function () {
  var isIE = !!document.documentMode || /MSIE \d|Trident.*rv:/.test(navigator.userAgent);
  if (!isIE) return;

  var html = '<!DOCTYPE html><html><head>' +
    '<meta charset="utf-8">' +
    '<title>Browser Not Supported</title>' +
    '<style>' +
    'body{margin:0;font-family:Arial,Helvetica,sans-serif;background:#fefefe;color:#222;text-align:center;padding:3em;}' +
    'h1{font-size:2em;margin-bottom:0.5em;color:#d33;}' +
    'p{font-size:1em;line-height:1.5em;margin:1em auto;max-width:30em;}' +
    'b{color:#000;}' +
    'a{color:#0645ad;text-decoration:none;}' +
    'a:hover{text-decoration:underline;}' +
    '</style></head><body>' +
    '<h1>Heyo :3</h1>' +
    '<p>hoi — poke does and <b>will not work</b> on Internet Explorer.<br>' +
    'If u wanna use poke, try <a href="https://www.mozilla.org/firefox/new/">Firefox</a> or <a href="https://www.google.com/chrome/">Chromium</a> instead.<br>' +
    'love u :3</p>' +
    '</body></html>';

  try {
    document.open('text/html','replace');
    document.write(html);
    document.close();
  } catch (e) {
    document.documentElement.innerHTML = html;
  }
})();

// Fade in elements on scroll or fullscreen change
function fadeInElements() {
  const elements = document.querySelectorAll('.fade-in');
  const viewportHeight = window.innerHeight;
  elements.forEach(element => {
    const elementTop = element.getBoundingClientRect().top;
    const elementBottom = element.getBoundingClientRect().bottom;
    const isVisible = (elementTop < viewportHeight && elementBottom > 0);
    if (isVisible || document.fullscreenElement) {
      element.classList.add('fade-in-active');
    }
  });
}

function jumpToTime(e) {
  e.preventDefault();
  
  const link = e.target;
  const video = document.getElementById('video');
  const time = link.dataset.jumpTime;

  const qualityforaudiostuff = new URLSearchParams(window.location.search).get("quality") || "";
  
  if (qualityforaudiostuff !== "medium") {
  var audiojumptotime = document.getElementById('aud');
  audiojumptotime.currentTime = time;
  }
  
  video.currentTime = time;

  window.location.hash = 'top'; // Add #top to the URL

  setTimeout(() => {
    history.replaceState(null, null, ' '); // Remove #top after 250MS
  }, 250);
}


// Handle click events for time-based links
const timeLinks = document.querySelectorAll('a[data-onclick="jump_to_time"]');
timeLinks.forEach(link => {
  const href = link.getAttribute('href');
  if (link.dataset.jumpTime && href && href.includes('&t=')) {
    const params = new URLSearchParams(href.split('?')[1]);
    const time = params.get('t');
    if (time) {
      link.dataset.jumpTime = time;
      link.addEventListener('click', jumpToTime);
      link.removeAttribute('href');
    }
  }
});

const videoPlayer = document.getElementById('video');

function time(seconds) {
  videoPlayer.currentTime = seconds;

  window.location.hash = 'top'; 

  setTimeout(() => {   
    history.replaceState(null, null, ' '); 
  }, 250);  
}


 document.addEventListener('click', function(event) {
  const clickedElement = event.target; 

   if (clickedElement.classList.contains('comment')) {
    const commentText = clickedElement.textContent.trim();

     const timestampMatch = commentText.match(/(\d{1,2}:\d{2})/);

    if (timestampMatch) {
      const timestamp = timestampMatch[0];  
      let parts = timestamp.split(':');
      let seconds = (+parts[0]) * 60 + (+parts[1]); 

       time(seconds);
    }
  }
});

const videoElement = document.getElementById("video");
videoElement.addEventListener("fullscreenchange", () => {
  videoElement.style.borderRadius = document.fullscreenElement === videoElement ? "0em !important" : "16px";
});

function fetchUrls(urls) {
  let fetchedCount = 0;

  urls.forEach(link => {
    const url = new URL(link.href);
    if (url.host !== 'www.youtube.com' && url.host !== 'youtube.com' && url.host !== "redirect.poketube.fun") {
      console.log(`Fetching ${url.origin}`);
      fetch(url.href)
        .then(response => {
          if (response.status === 500) {
            // do nothing
          }
          console.log(`Fetched ${url.origin}`);
          fetchedCount++;
          console.clear();
          if (fetchedCount === urls.length) {
            document.body.classList.remove('blur');
          }
        })
        .catch(error => {
          console.clear();
          if (!(error instanceof TypeError && error.message.includes('Failed to fetch'))) {
            console.error(`Error fetching ${url.origin}: ${error}`);
          }
        });
    }
  });
}

  function anondocumenttitle(message, times) {
    var hash = CryptoJS.SHA256(message);

    return hash.toString(CryptoJS.enc.Hex);
  }
  
  if(navigator.globalPrivacyControl) {
  var gpcValue = navigator?.globalPrivacyControl 
  } else {
  var gpcValue = false
  }

  if (location.hostname === "poketube.fun") {  
    if (typeof Ashley === "undefined") {
      var Ashley = {};
    }
    Ashley.dntEnabled = function (dnt, ua) {
      "use strict";
      var dntStatus =
        dnt ||
        navigator.doNotTrack ||
        window.doNotTrack ||
        navigator.msDoNotTrack;
      var userAgent = ua || navigator.userAgent;
      var anomalousWinVersions = [
        "Windows NT 6.1",
        "Windows NT 6.2",
        "Windows NT 6.3",
      ];
      var fxMatch = userAgent.match(/Firefox\/(\d+)/);
      var ieRegEx = /MSIE|Trident/i;
      var isIE = ieRegEx.test(userAgent);
      var platform = userAgent.match(/Windows.+?(?=;)/g);
      if (isIE && typeof Array.prototype.indexOf !== "function") {
        return false;
      } else if (fxMatch && parseInt(fxMatch[1], 10) < 32) {
        dntStatus = "Unspecified";
      } else if (
        isIE &&
        platform &&
        anomalousWinVersions.indexOf(platform.toString()) !== -1
      ) {
        dntStatus = "Unspecified";
      } else {
        dntStatus = { 0: "Disabled", 1: "Enabled" }[dntStatus] || "Unspecified";
      }
      return dntStatus === "Enabled" ? true : false;
    };
    // only load if DNT is not enabled
    if(!gpcValue) {
  
  }
  }
var popupMenu = document.getElementById("popupMenu");
var loopOption = document.getElementById("loopOption");
var speedOption = document.getElementById("speedOption");
// New DOM elements for Audio
var boostOption = document.getElementById("boostOption");
var normalizeOption = document.getElementById("normalizeOption");
var loopedIndicator = document.getElementById("loopedIndicator");
var aud = document.getElementById("aud");

loopedIndicator.style.display = "none";

 let audioCtx, source, gainNode, compressorNode;
let audioInitialized = false;

 let audioState = localStorage.getItem("audioMode") || "none"; // can be "none", "boost", or "normalize"

function initAudio() {
    if (audioInitialized) return;
    if (!aud) return;

    // Standard cross-browser audio context
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    
     source = audioCtx.createMediaElementSource(aud);
    gainNode = audioCtx.createGain();
    compressorNode = audioCtx.createDynamicsCompressor();

     compressorNode.threshold.value = -24; // dB
    compressorNode.knee.value = 30;
    compressorNode.ratio.value = 12;
    compressorNode.attack.value = 0.003;
    compressorNode.release.value = 0.25;

    audioInitialized = true;
}

function applyAudioState() {
    if (!audioInitialized) initAudio();
    if (!audioCtx) return;

     source.disconnect();
    compressorNode.disconnect();
    gainNode.disconnect();

    if (audioState === "normalize") {
         source.connect(compressorNode);
        compressorNode.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        gainNode.gain.value = 1.0;
        
        normalizeOption.innerHTML = "<i class='fa-light fa-check'></i> Normalization On";
        boostOption.innerHTML = "Audio Boost";
    } else if (audioState === "boost") {
        // Route: Source -> Gain(at 2.5x) -> Destination
        source.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        gainNode.gain.value = 2.5; // Adjust this number to increase/decrease boost level

        normalizeOption.innerHTML = "Audio Normalization";
        boostOption.innerHTML = "<i class='fa-light fa-check'></i> Boost On";
    } else {
        // Route: Source -> Gain(at 1x) -> Destination (Normal behavior)
        source.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        gainNode.gain.value = 1.0;

        normalizeOption.innerHTML = "Audio Normalization";
        boostOption.innerHTML = "Audio Boost";
    }

    // Save to LocalStorage
    localStorage.setItem("audioMode", audioState);
}

// Browsers require a user interaction before AudioContext can start.
// We initialize it the first time the audio plays.
if (aud) {
    aud.addEventListener('play', () => {
        if (!audioInitialized) {
            initAudio();
            applyAudioState();
        }
    });
}

// --- EVENT LISTENERS ---

boostOption.addEventListener("click", function() {
    // Toggle logic
    audioState = (audioState === "boost") ? "none" : "boost";
    applyAudioState();
    
    // Resume context if browser suspended it
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    
    // Close the popup menu
    popupMenu.style.display = "none"; 
});

normalizeOption.addEventListener("click", function() {
    // Toggle logic
    audioState = (audioState === "normalize") ? "none" : "normalize";
    applyAudioState();
    
    // Resume context if browser suspended it
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    
    // Close the popup menu
    popupMenu.style.display = "none";
});

video.addEventListener("contextmenu", function(event) {
    // Check if the video is in fullscreen mode
    if (!document.fullscreenElement && !document.webkitFullscreenElement && !document.mozFullScreenElement && !document.msFullscreenElement) {
        event.preventDefault();

        // Ensure the UI matches the current state before showing
        if (audioInitialized) applyAudioState();

        popupMenu.style.display = "block";
        popupMenu.style.left = event.pageX + "px";
        popupMenu.style.top = event.pageY + "px";
    }
});

// Hide the popup menu when clicking outside of it
window.addEventListener("click", function(event) {
    if (event.target !== video) {
        popupMenu.style.display = "none";
    }
});

loopOption.addEventListener("click", function() {
    const quaindt = new URLSearchParams(window.location.search).get("quality") || "";
    var looped = video.loop;
    video.loop = !looped;

    if (quaindt !== "medium") {
        if (aud) {
            aud.loop = !looped;
        }
    }

    var displaySpecialText = Math.random() < 0.5;

    if (displaySpecialText) {
        var specialText = looped ? "Unlooped >.<" : "Looped~ :3 >~<";
        loopedIndicator.textContent = specialText;
    } else {
        loopedIndicator.textContent = looped ? "Unlooped!" : "Looped!";
    }
    
    loopedIndicator.style.display = "block";

    // Hide the indicator after 2 seconds
    setTimeout(function() {
        loopedIndicator.style.display = "none";
    }, 2000);
    
    popupMenu.style.display = "none"; // Closes menu optionally on loop click
});

speedOption.addEventListener("click", function() {
    var currentSpeed = video.playbackRate;
    var newSpeed = getNextSpeed(currentSpeed);

    video.playbackRate = newSpeed;
    if (aud) aud.playbackRate = newSpeed;
    
    speedOption.innerHTML = "<i class='fa-light fa-gauge'></i> Speed: " + newSpeed.toFixed(2) + "x";
    popupMenu.style.display = "none"; // Closes menu optionally on speed click
});

function getNextSpeed(currentSpeed) {
    var maxSpeed = (navigator.hardwareConcurrency < 3) ? 1 : 2; 

    if (currentSpeed === maxSpeed) {
        return 0.25;
    } else if (currentSpeed === 0.25) {
        return 0.5;
    } else if (currentSpeed === 0.5) {
        return 0.75;
    } else if (currentSpeed === 0.75) {
        return 1;
    } else {
        return maxSpeed;
    }
}

const GoogleTranslateEndpoint = "https://translate.google.com/_/TranslateWebserverUi/data/batchexecute?rpcids=MkEWBc&rt=c"
// @license-end