(function addStats() {
  const FAIL_KEY = "poke_stats_fail_time";
  const OPTOUT_KEY = "poke_stats_optout"; 

  try {
     if (localStorage.getItem(OPTOUT_KEY) === "1") {
      console.log("[Poke] Stats disabled by user opt-out.");
      return;
    }

     const failTime = localStorage.getItem(FAIL_KEY);
    if (failTime) {
      const hoursSinceFail = (Date.now() - parseInt(failTime, 10)) / (1000 * 60 * 60);
      if (hoursSinceFail < 24) {
        console.log("[Poke] Stats script on cooldown due to previous failure.");
        return;
      } else {
        // Cooldown expired, clear it and try again
        localStorage.removeItem(FAIL_KEY);
      }
    }
  } catch (e) {
    }

   const url = "/static/improving-poke.js?v=4";
  if (document.querySelector(`script[src="${url}"]`)) return;

  const s = document.createElement("script");
  s.src = url;
  s.type = "text/javascript";
  s.async = true;
  s.defer = true;

  s.onload = () => console.log("[Poke] improving-poke.js loaded");
  
  s.onerror = () => {
     console.warn("[Poke] Stats script failed to load (blocked or offline) — backing off for 24h.");
    try {
      localStorage.setItem(FAIL_KEY, Date.now().toString());
    } catch {}
  };

  document.head.appendChild(s);
})();