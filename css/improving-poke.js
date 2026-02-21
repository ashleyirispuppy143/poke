/**
 * uuidv7: A JavaScript implementation of UUID version 7
 * Copyright 2021-2025 LiosK (Apache-2.0)
 * * Wrapped in an IIFE for vanilla JS usage 
 */
const generateUUIDv7 = (function() {
  const DIGITS = "0123456789abcdef";

  class UUID {
      constructor(bytes) {
          this.bytes = bytes;
      }
      static ofInner(bytes) {
          if (bytes.length !== 16) throw new TypeError("not 128-bit length");
          return new UUID(bytes);
      }
      static fromFieldsV7(unixTsMs, randA, randBHi, randBLo) {
          if (!Number.isInteger(unixTsMs) || !Number.isInteger(randA) || !Number.isInteger(randBHi) || !Number.isInteger(randBLo) ||
              unixTsMs < 0 || randA < 0 || randBHi < 0 || randBLo < 0 ||
              unixTsMs > 281474976710655 || randA > 0xfff || randBHi > 1073741823 || randBLo > 4294967295) {
              throw new RangeError("invalid field value");
          }
          const bytes = new Uint8Array(16);
          bytes[0] = unixTsMs / 2 ** 40;
          bytes[1] = unixTsMs / 2 ** 32;
          bytes[2] = unixTsMs / 2 ** 24;
          bytes[3] = unixTsMs / 2 ** 16;
          bytes[4] = unixTsMs / 2 ** 8;
          bytes[5] = unixTsMs;
          bytes[6] = 0x70 | (randA >>> 8);
          bytes[7] = randA;
          bytes[8] = 0x80 | (randBHi >>> 24);
          bytes[9] = randBHi >>> 16;
          bytes[10] = randBHi >>> 8;
          bytes[11] = randBHi;
          bytes[12] = randBLo >>> 24;
          bytes[13] = randBLo >>> 16;
          bytes[14] = randBLo >>> 8;
          bytes[15] = randBLo;
          return new UUID(bytes);
      }
      toString() {
          let text = "";
          for (let i = 0; i < this.bytes.length; i++) {
              text += DIGITS.charAt(this.bytes[i] >>> 4);
              text += DIGITS.charAt(this.bytes[i] & 0xf);
              if (i === 3 || i === 5 || i === 7 || i === 9) text += "-";
          }
          return text;
      }
  }

  class V7Generator {
      constructor(randomNumberGenerator) {
          this.timestamp_biased = 0;
          this.counter = 0;
          this.random = randomNumberGenerator ?? getDefaultRandom();
      }
      generate() {
          return this.generateOrResetCore(Date.now(), 10000);
      }
      generateOrAbortCore(unixTsMs, rollbackAllowance) {
          const MAX_COUNTER = 4398046511103;
          unixTsMs++;
          if (unixTsMs > this.timestamp_biased) {
              this.timestamp_biased = unixTsMs;
              this.resetCounter();
          } else if (unixTsMs + rollbackAllowance >= this.timestamp_biased) {
              this.counter++;
              if (this.counter > MAX_COUNTER) {
                  this.timestamp_biased++;
                  this.resetCounter();
              }
          } else {
              return undefined;
          }
          return UUID.fromFieldsV7(this.timestamp_biased - 1, Math.trunc(this.counter / 2 ** 30), this.counter & (2 ** 30 - 1), this.random.nextUint32());
      }
      generateOrResetCore(unixTsMs, rollbackAllowance) {
          let value = this.generateOrAbortCore(unixTsMs, rollbackAllowance);
          if (value === undefined) {
              this.timestamp_biased = 0;
              value = this.generateOrAbortCore(unixTsMs, rollbackAllowance);
          }
          return value;
      }
      resetCounter() {
          this.counter = this.random.nextUint32() * 0x400 + (this.random.nextUint32() & 0x3ff);
      }
  }

  const getDefaultRandom = () => {
      if (typeof crypto !== "undefined" && typeof crypto.getRandomValues !== "undefined") {
          return new BufferedCryptoRandom();
      } else {
          return {
              nextUint32: () => Math.trunc(Math.random() * 65536) * 65536 + Math.trunc(Math.random() * 65536),
          };
      }
  };

  class BufferedCryptoRandom {
      constructor() {
          this.buffer = new Uint32Array(8);
          this.cursor = 0xffff;
      }
      nextUint32() {
          if (this.cursor >= this.buffer.length) {
              crypto.getRandomValues(this.buffer);
              this.cursor = 0;
          }
          return this.buffer[this.cursor++];
      }
  }

  let defaultGenerator;
  
  // Return the actual generator function
  return () => (defaultGenerator || (defaultGenerator = new V7Generator())).generate().toString();
})();

// --- Your Tracking Logic Below ---

function sendStats(videoId) {
  if (!videoId) return;

  try {
    if (localStorage.getItem("poke_stats_optout") === "1") return;
  } catch (e) {
    return;
  }

  let userId;
  try {
    userId = localStorage.getItem("poke_uid");
    if (!userId) {
      // Uses the standalone UUIDv7 generator above
      userId = "u_" + generateUUIDv7();
      localStorage.setItem("poke_uid", userId);
    }
  } catch (e) {
    return;
  }

  const payload = JSON.stringify({ videoId, userId });

  if (navigator.sendBeacon) {
    const blob = new Blob([payload], { type: "application/json" });
    navigator.sendBeacon("/api/stats", blob);
  } else {
    fetch("/api/stats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true
    }).catch(() => {});
  }
}

sendStats(new URLSearchParams(location.search).get("v"));