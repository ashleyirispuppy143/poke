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
var boostOption = document.getElementById("boostOption");
var normalizeOption = document.getElementById("normalizeOption");
var whisperOption = document.getElementById("whisperOption"); 
var snapshotOption = document.getElementById("snapshotOption");
var loopedIndicator = document.getElementById("loopedIndicator");

loopedIndicator.style.display = "none";

let audioCtx, source, gainNode, compressorNode, analyzer;
let audioState = localStorage.getItem("audioMode") || "none"; 
let normalizerInterval = null;
let dataArray = null;
let freqDataArray = null;
let currentAutoGain = 1.0;

let eqFilters = [];
let eqValues = JSON.parse(localStorage.getItem("eqValues")) || [0, 0, 0, 0, 0, 0, 0];
let isEqOn = localStorage.getItem("isEqOn") === "true";
const freqs = [60, 230, 640, 1500, 3600, 7000, 14000];

const ptdEqStyle = document.createElement('style');
ptdEqStyle.innerHTML = `
    .ptd-eq-modal { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(24,24,24,0.98); color: #fff; padding: 24px; border-radius: 12px; font-family: 'Roboto', Arial, sans-serif; display: none; z-index: 999999; box-shadow: 0 8px 32px rgba(0,0,0,0.8); width: 480px; backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.08); }
    .ptd-eq-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 12px; margin-bottom: 20px; }
    .ptd-eq-title { font-size: 16px; font-weight: 500; margin:0; letter-spacing: 0.5px; }
    .ptd-eq-close { cursor: pointer; font-size: 24px; color: #aaa; background: none; border: none; line-height: 1; padding: 0; transition: color 0.2s; }
    .ptd-eq-close:hover { color: #fff; }
    .ptd-eq-toggle-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; font-size: 14px; font-weight: 500; }
    .ptd-toggle { position: relative; width: 40px; height: 22px; background: rgba(255,255,255,0.2); border-radius: 11px; cursor: pointer; transition: 0.3s; }
    .ptd-toggle.active { background: #3ea6ff; }
    .ptd-toggle::after { content: ''; position: absolute; top: 2px; left: 2px; width: 18px; height: 18px; background: white; border-radius: 50%; transition: 0.3s; box-shadow: 0 2px 4px rgba(0,0,0,0.2); }
    .ptd-toggle.active::after { left: 20px; }
    #ptdEqCanvas { width: 100%; height: 260px; background: #0f0f0f; border-radius: 8px; cursor: pointer; display: block; border: 1px solid rgba(255,255,255,0.05); }
    .ptd-disabled-menu-item { opacity: 0.4; pointer-events: none; }
`;
document.head.appendChild(ptdEqStyle);

var ptdEqOption = document.createElement("div");
ptdEqOption.id = "ptdEqOption";
ptdEqOption.innerHTML = "<i class='fa-light fa-sliders'></i> Audio Equalizer";
ptdEqOption.style.cursor = "pointer";
ptdEqOption.style.padding = "10px";

if (snapshotOption) {
    popupMenu.insertBefore(ptdEqOption, snapshotOption);
} else {
    popupMenu.appendChild(ptdEqOption);
}

const ptdEqModal = document.createElement("div");
ptdEqModal.className = "ptd-eq-modal";
ptdEqModal.innerHTML = `
    <div class="ptd-eq-header">
        <h3 class="ptd-eq-title">Graphic Equalizer</h3>
        <button class="ptd-eq-close">&times;</button>
    </div>
    <div class="ptd-eq-toggle-row">
        <span>Enable EQ</span>
        <div class="ptd-toggle ${isEqOn ? 'active' : ''}" id="ptdEqToggleBtn"></div>
    </div>
    <canvas id="ptdEqCanvas" width="430" height="260"></canvas>
`;
document.body.appendChild(ptdEqModal);

const ptdEqCanvasEl = document.getElementById("ptdEqCanvas");
const ptdEqCtx = ptdEqCanvasEl.getContext("2d");
let isDragging = false;
let activeNode = -1;
let animFrame;

const ptdPadding = { top: 30, bottom: 40, left: 40, right: 20 };
const ptdUsableHeight = ptdEqCanvasEl.height - ptdPadding.top - ptdPadding.bottom;
const ptdUsableWidth = ptdEqCanvasEl.width - ptdPadding.left - ptdPadding.right;
const ptdSpacing = ptdUsableWidth / 6;

function getX(i) {
    return ptdPadding.left + i * ptdSpacing;
}

function getY(val) {
    return ptdPadding.top + ptdUsableHeight / 2 - (val / 15) * (ptdUsableHeight / 2);
}

function getValFromY(y) {
    let val = (ptdPadding.top + ptdUsableHeight / 2 - y) / (ptdUsableHeight / 2) * 15;
    return Math.max(-15, Math.min(15, val));
}

function drawRoundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.fill();
}

function drawEQ() {
    if (ptdEqModal.style.display === "none") return;
    
    ptdEqCtx.clearRect(0, 0, ptdEqCanvasEl.width, ptdEqCanvasEl.height);
    ptdEqCtx.fillStyle = "#0f0f0f";
    ptdEqCtx.fillRect(0, 0, ptdEqCanvasEl.width, ptdEqCanvasEl.height);

    ptdEqCtx.globalAlpha = isEqOn ? 1.0 : 0.4;
    ptdEqCtx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ptdEqCtx.lineWidth = 1;
    
    [15, 0, -15].forEach(val => {
        let y = getY(val);
        ptdEqCtx.beginPath();
        ptdEqCtx.moveTo(ptdPadding.left - 10, y);
        ptdEqCtx.lineTo(ptdEqCanvasEl.width - ptdPadding.right + 10, y);
        ptdEqCtx.stroke();
        
        ptdEqCtx.fillStyle = "#888";
        ptdEqCtx.font = "11px Arial";
        ptdEqCtx.textAlign = "right";
        ptdEqCtx.textBaseline = "middle";
        ptdEqCtx.fillText(val > 0 ? "+" + val : val, ptdPadding.left - 15, y);
    });

    if (analyzer && freqDataArray && isEqOn) {
        analyzer.getByteFrequencyData(freqDataArray);
        ptdEqCtx.fillStyle = "rgba(255, 255, 255, 0.1)";
        ptdEqCtx.beginPath();
        ptdEqCtx.moveTo(0, ptdEqCanvasEl.height);
        let barWidth = ptdEqCanvasEl.width / freqDataArray.length;
        for (let i = 0; i < freqDataArray.length; i++) {
            let percent = freqDataArray[i] / 255;
            let y = ptdEqCanvasEl.height - (percent * ptdEqCanvasEl.height * 0.9);
            ptdEqCtx.lineTo(i * barWidth, y);
        }
        ptdEqCtx.lineTo(ptdEqCanvasEl.width, ptdEqCanvasEl.height);
        ptdEqCtx.closePath();
        ptdEqCtx.fill();
    }

    for (let i = 0; i < 7; i++) {
        let x = getX(i);
        
        ptdEqCtx.strokeStyle = "#000";
        ptdEqCtx.lineWidth = 6;
        ptdEqCtx.lineCap = "round";
        ptdEqCtx.beginPath();
        ptdEqCtx.moveTo(x, getY(15));
        ptdEqCtx.lineTo(x, getY(-15));
        ptdEqCtx.stroke();

        ptdEqCtx.strokeStyle = "#3ea6ff";
        ptdEqCtx.lineWidth = 2;
        ptdEqCtx.beginPath();
        ptdEqCtx.moveTo(x, getY(0));
        ptdEqCtx.lineTo(x, getY(eqValues[i]));
        ptdEqCtx.stroke();

        let ty = getY(eqValues[i]);
        ptdEqCtx.fillStyle = activeNode === i ? "#fff" : "#ddd";
        drawRoundRect(ptdEqCtx, x - 8, ty - 12, 16, 24, 4);

        ptdEqCtx.fillStyle = "#aaa";
        ptdEqCtx.font = "11px Arial";
        ptdEqCtx.textAlign = "center";
        let label = freqs[i] >= 1000 ? (freqs[i] / 1000) + "K" : freqs[i];
        ptdEqCtx.fillText(label, x, ptdEqCanvasEl.height - 15);
    }

    ptdEqCtx.globalAlpha = 1.0;
    animFrame = requestAnimationFrame(drawEQ);
}

ptdEqCanvasEl.addEventListener("mousedown", (e) => {
    if (!isEqOn) return;
    const rect = ptdEqCanvasEl.getBoundingClientRect();
    const scaleX = ptdEqCanvasEl.width / rect.width;
    const scaleY = ptdEqCanvasEl.height / rect.height;
    
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    
    for (let i = 0; i < 7; i++) {
        let cx = getX(i);
        if (Math.abs(x - cx) < 25) { 
            isDragging = true;
            activeNode = i;
            eqValues[i] = getValFromY(y);
            applyEQSettings();
            break;
        }
    }
});

ptdEqCanvasEl.addEventListener("mousemove", (e) => {
    if (!isDragging || activeNode === -1 || !isEqOn) return;
    const rect = ptdEqCanvasEl.getBoundingClientRect();
    const scaleY = ptdEqCanvasEl.height / rect.height;
    
    const y = (e.clientY - rect.top) * scaleY;
    eqValues[activeNode] = getValFromY(y);
    applyEQSettings();
});

window.addEventListener("mouseup", () => {
    if (isDragging) {
        localStorage.setItem("eqValues", JSON.stringify(eqValues));
    }
    isDragging = false;
    activeNode = -1;
});

ptdEqModal.querySelector('.ptd-eq-close').addEventListener('click', () => {
    ptdEqModal.style.display = "none";
    cancelAnimationFrame(animFrame);
});

ptdEqModal.querySelector('#ptdEqToggleBtn').addEventListener('click', function() {
    isEqOn = !isEqOn;
    this.classList.toggle('active', isEqOn);
    localStorage.setItem("isEqOn", isEqOn);
    
    if (isEqOn) {
        audioState = "none";
        applyAudioState(true); 
    } else {
        applyEQSettings(); 
    }
    
    updateUIAccessibility();
});

ptdEqOption.addEventListener("click", function() {
    popupMenu.style.display = "none";
    ptdEqModal.style.display = "block";
    drawEQ();
    
    if (isEqOn && !audioCtx) {
        applyAudioState(true);
    }
});

function applyEQSettings() {
    if (!audioCtx || eqFilters.length === 0) return;
    
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    
    eqFilters.forEach((filter, i) => {
        const targetGain = isEqOn ? eqValues[i] : 0;
        filter.gain.value = targetGain; 
    });
}

function updateUIAccessibility() {
    [boostOption, normalizeOption, whisperOption].forEach(opt => {
        if (!opt) return;
        if (isEqOn) {
            opt.classList.add("ptd-disabled-menu-item");
            opt.title = "Disable EQ to use this feature";
        } else {
            opt.classList.remove("ptd-disabled-menu-item");
            opt.title = "";
        }
    });
}

function initAudio() {
    var currentMedia = typeof video !== "undefined" ? video : (document.getElementById("aud") || document.querySelector("audio")); 
    if (audioCtx || !currentMedia) return; 

    try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        source = audioCtx.createMediaElementSource(currentMedia);
        
        analyzer = audioCtx.createAnalyser();
        analyzer.fftSize = 512; 
        dataArray = new Float32Array(analyzer.frequencyBinCount);
        freqDataArray = new Uint8Array(analyzer.frequencyBinCount);

        gainNode = audioCtx.createGain();
        compressorNode = audioCtx.createDynamicsCompressor();

        const types = ['lowshelf', 'peaking', 'peaking', 'peaking', 'peaking', 'peaking', 'highshelf'];
        
        eqFilters = freqs.map((freq, i) => {
            let f = audioCtx.createBiquadFilter();
            f.type = types[i];
            f.frequency.value = freq;
            if (types[i] === 'peaking') {
                f.Q.value = 1.414; 
            }
            f.gain.value = isEqOn ? eqValues[i] : 0;
            return f;
        });

        for (let i = 0; i < eqFilters.length - 1; i++) {
            eqFilters[i].connect(eqFilters[i+1]);
        }

        source.connect(eqFilters[0]);
        eqFilters[eqFilters.length - 1].connect(analyzer);
        analyzer.connect(gainNode);
        gainNode.connect(compressorNode);
        compressorNode.connect(audioCtx.destination);

        compressorNode.knee.value = 0; 
        compressorNode.attack.value = 0.003;
        compressorNode.release.value = 0.25;
    } catch (e) {
        console.error("Audio Routing bypassed:", e);
    }
}

function applyAudioState(isUserInteraction = false) {
    let audioStatusDisplay = document.getElementById("audioStatusDisplay");

    if (audioState === "normalize") {
        normalizeOption.innerHTML = "<i class='fa-light fa-check'></i> Normalization On";
        boostOption.innerHTML = "<i class='fa-light fa-volume-high'></i> Audio Boost";
        if (whisperOption) whisperOption.innerHTML = "<i class='fa-light fa-volume-low'></i> Whisper Mode";
        if (audioStatusDisplay) audioStatusDisplay.innerHTML = "&nbsp; &bull; &nbsp;<i class='fa-light fa-wave-square'></i> Audio Normalized";
    } else if (audioState === "boost") {
        normalizeOption.innerHTML = "<i class='fa-light fa-wave-square'></i> Audio Normalization";
        boostOption.innerHTML = "<i class='fa-light fa-check'></i> Boost On";
        if (whisperOption) whisperOption.innerHTML = "<i class='fa-light fa-volume-low'></i> Whisper Mode";
        if (audioStatusDisplay) audioStatusDisplay.innerHTML = "&nbsp; &bull; &nbsp;<i class='fa-light fa-bolt'></i> Audio Boosted";
    } else if (audioState === "whisper") {
        normalizeOption.innerHTML = "<i class='fa-light fa-wave-square'></i> Audio Normalization";
        boostOption.innerHTML = "<i class='fa-light fa-volume-high'></i> Audio Boost";
        if (whisperOption) whisperOption.innerHTML = "<i class='fa-light fa-check'></i> Whisper On";
        if (audioStatusDisplay) audioStatusDisplay.innerHTML = "&nbsp; &bull; &nbsp;<i class='fa-light fa-ear-listen'></i> Whisper Mode On";
    } else {
        normalizeOption.innerHTML = "<i class='fa-light fa-wave-square'></i> Audio Normalization";
        boostOption.innerHTML = "<i class='fa-light fa-volume-high'></i> Audio Boost";
        if (whisperOption) whisperOption.innerHTML = "<i class='fa-light fa-volume-low'></i> Whisper Mode";
        if (audioStatusDisplay) {
            audioStatusDisplay.innerHTML = isEqOn ? "&nbsp; &bull; &nbsp;<i class='fa-light fa-sliders'></i> EQ Active" : "";
        }
    }

    localStorage.setItem("audioMode", audioState);

    if (normalizerInterval) {
        clearInterval(normalizerInterval);
        normalizerInterval = null;
    }

    if (audioState === "none" && !audioCtx) return;
    if (!isUserInteraction) return;

    initAudio();
    if (!audioCtx) return;

    const now = audioCtx.currentTime;
    const smoothTime = 0.05; 

    if (audioState === "normalize") {
        compressorNode.threshold.setTargetAtTime(-3, now, smoothTime);
        compressorNode.ratio.setTargetAtTime(20, now, smoothTime);

        normalizerInterval = setInterval(() => {
            var currentAud = typeof video !== "undefined" ? video : (document.getElementById("aud") || document.querySelector("video"));
            if (!currentAud || currentAud.paused || audioCtx.state !== 'running') return;

            analyzer.getFloatTimeDomainData(dataArray);
            
            let sumSquares = 0.0;
            for (let i = 0; i < dataArray.length; i++) {
                sumSquares += dataArray[i] * dataArray[i];
            }
            let rms = Math.sqrt(sumSquares / dataArray.length);

            let targetGain = 1.0;

            if (rms > 0.005) {
                targetGain = 0.08 / rms;
                targetGain = Math.max(0.3, Math.min(targetGain, 1.8));
            } 

            currentAutoGain = (currentAutoGain * 0.9) + (targetGain * 0.1);
            gainNode.gain.setTargetAtTime(currentAutoGain, audioCtx.currentTime, 0.4);

        }, 300); 

    } else if (audioState === "boost") {
        gainNode.gain.setTargetAtTime(2.5, now, smoothTime); 
        compressorNode.threshold.setTargetAtTime(-2, now, smoothTime); 
        compressorNode.ratio.setTargetAtTime(20, now, smoothTime);
    } else if (audioState === "whisper") {
        gainNode.gain.setTargetAtTime(0.025, now, smoothTime); 
        compressorNode.threshold.setTargetAtTime(-40, now, smoothTime); 
        compressorNode.ratio.setTargetAtTime(20, now, smoothTime);
    } else {
        gainNode.gain.setTargetAtTime(1.0, now, smoothTime); 
        compressorNode.threshold.setTargetAtTime(0, now, smoothTime);
        compressorNode.ratio.setTargetAtTime(1, now, smoothTime); 
    }

    if (audioCtx.state === 'suspended') audioCtx.resume();
}
 
 function unlockAudioContext() {
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    // If the user has an audio effect active but it hasn't started, start it now.
    if ((audioState !== "none" || isEqOn) && !audioCtx) {
        applyAudioState(true);
    }
    
    // Remove listeners once unlocked
    document.removeEventListener('click', unlockAudioContext);
    document.removeEventListener('touchstart', unlockAudioContext);
    document.removeEventListener('keydown', unlockAudioContext);
}

// Listen for first genuine user interaction to bypass autoplay restrictions safely
document.addEventListener('click', unlockAudioContext);
document.addEventListener('touchstart', unlockAudioContext);
document.addEventListener('keydown', unlockAudioContext);
 
updateUIAccessibility();
applyAudioState(false);
 
document.addEventListener('play', function(event) {
    if (event.target.id === 'aud' || event.target.tagName === 'VIDEO' || event.target.tagName === 'AUDIO') {
        // Just attempt to resume gracefully if the context is already running
        if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume().catch(e => console.warn("Audio resume blocked by autoplay policy.", e));
        }
        // Notice: We NO LONGER force applyAudioState(true) here!
        // The unlockAudioContext listener handles initialization safely instead.
    }
}, true);

boostOption.addEventListener("click", function() {
    if (isEqOn) return;
    audioState = (audioState === "boost") ? "none" : "boost";
    applyAudioState(true); 
    popupMenu.style.display = "none"; 
});

normalizeOption.addEventListener("click", function() {
    if (isEqOn) return;
    audioState = (audioState === "normalize") ? "none" : "normalize";
    applyAudioState(true); 
    popupMenu.style.display = "none";
});

if (whisperOption) {
    whisperOption.addEventListener("click", function() {
        if (isEqOn) return;
        audioState = (audioState === "whisper") ? "none" : "whisper";
        applyAudioState(true); 
        popupMenu.style.display = "none";
    });
}

 if (snapshotOption) {
    snapshotOption.addEventListener("click", function() {
        if (video.videoWidth > 0 && video.videoHeight > 0) {
            var snapCanvas = document.createElement("canvas");
            snapCanvas.width = video.videoWidth;
            snapCanvas.height = video.videoHeight;
            
            var snapCtx = snapCanvas.getContext("2d");
            snapCtx.drawImage(video, 0, 0, snapCanvas.width, snapCanvas.height);
            
            var dataURL = snapCanvas.toDataURL("image/png");
            
            var videoName = "snapshot";
            var src = video.currentSrc || video.src || "";
            
            if (src && !src.startsWith("blob:")) {
                var fileNameWithExt = src.split('/').pop().split('?')[0].split('#')[0];
                var lastDot = fileNameWithExt.lastIndexOf('.');
                var baseName = lastDot !== -1 ? fileNameWithExt.substring(0, lastDot) : fileNameWithExt;
                
                try {
                    videoName = decodeURIComponent(baseName) || "snapshot"; 
                } catch(e) {
                    videoName = baseName || "snapshot";
                }
            } else {
                 videoName = document.title ? document.title.replace(/[^a-zA-Z0-9 -]/g, "").trim() : "snapshot";
            }

            var time = video.currentTime;
            var hrs = Math.floor(time / 3600);
            var mins = Math.floor((time % 3600) / 60);
            var secs = Math.floor(time % 60);
            var timeStr = (hrs > 0 ? hrs + "h" : "") + mins + "m" + secs + "s";
            
            var a = document.createElement("a");
            a.href = dataURL;
            a.download = videoName + " at " + timeStr + ".png"; 
            document.body.appendChild(a);
            a.click(); 
            document.body.removeChild(a); 
        }
        
        popupMenu.style.display = "none"; 
    });
}
 
video.addEventListener("contextmenu", function(event) {
    if (!document.fullscreenElement && !document.webkitFullscreenElement && !document.mozFullScreenElement && !document.msFullscreenElement) {
        event.preventDefault();
        popupMenu.style.display = "block";
        popupMenu.style.left = event.pageX + "px";
        popupMenu.style.top = event.pageY + "px";
    }
});

window.addEventListener("click", function(event) {
    if (event.target !== video && !ptdEqModal.contains(event.target)) {
        popupMenu.style.display = "none";
    }
});

loopOption.addEventListener("click", function() {
    const quaindt = new URLSearchParams(window.location.search).get("quality") || "";
    var looped = video.loop;
    video.loop = !looped;
    var currentAud = document.getElementById("aud") || document.querySelector("audio");

    if (quaindt !== "medium") {
        if (currentAud) {
            currentAud.loop = !looped;
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

    setTimeout(function() {
        loopedIndicator.style.display = "none";
    }, 2000);
    
    popupMenu.style.display = "none"; 
});

speedOption.addEventListener("click", function() {
    var currentSpeed = video.playbackRate;
    var newSpeed = getNextSpeed(currentSpeed);
    var currentAud = document.getElementById("aud") || document.querySelector("audio");

    video.playbackRate = newSpeed;
    if (currentAud) currentAud.playbackRate = newSpeed;
    
    speedOption.innerHTML = "<i class='fa-light fa-gauge'></i> Speed: " + newSpeed.toFixed(2) + "x";
    popupMenu.style.display = "none"; 
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