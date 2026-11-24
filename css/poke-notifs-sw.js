// @license magnet:?xt=urn:btih:1f739d935676111cfff4b4693e3816e664797050&dn=gpl-3.0.txt GPL-3.0-or-later
/*
    This Source Code Form is subject to the terms of the GNU General Public License:

    Copyright (C) 2021-2026 Poke (https://codeberg.org/ashleyirispuppy/poke)

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program. If not, see https://www.gnu.org/licenses/.
*/

const DB_NAME = 'poke_notifs_db';
const STORE_NAME = 'state';
const DB_VERSION = 1;

let activeCheckPromise = null;
let pendingTestTimer = null;
let pendingTestCancel = null;

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(key) {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

async function idbSet(key, value) {
  try {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {}
}

function decodeXmlEntities(str) {
  if (!str) return '';
  return str
    .replace(/^<!\[CDATA\[([\s\S]*?)\]\]>$/, '$1')
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .trim();
}

function rewriteVideoLink(href, videoId, origin) {
  if (href) {
    if (/^https?:\/\/(www\.|m\.)?youtube\.com\/watch/i.test(href)) {
      return href.replace(/^https?:\/\/(www\.|m\.)?youtube\.com/i, origin);
    }
    const shortsMatch = href.match(/^https?:\/\/(www\.|m\.)?youtube\.com\/shorts\/([^/?&#]+)/i);
    if (shortsMatch) {
      return `${origin}/watch?v=${encodeURIComponent(shortsMatch[2])}`;
    }
    if (/^https?:\/\/(www\.|m\.)?youtube\.com\//i.test(href)) {
      return href.replace(/^https?:\/\/(www\.|m\.)?youtube\.com/i, origin);
    }
  }
  return videoId ? `${origin}/watch?v=${encodeURIComponent(videoId)}` : `${origin}/`;
}

function parseAtomFeed(xmlText, channelId, fallbackName, origin) {
  const feedTitleMatch = xmlText.match(/<feed[\s\S]*?<title[^>]*>([\s\S]*?)<\/title>/i);
  const feedTitle = feedTitleMatch ? decodeXmlEntities(feedTitleMatch[1]) : '';
  const entryMatches = xmlText.match(/<entry\b[\s\S]*?<\/entry>/gi) || [];

  const allEntries = [];
  for (const block of entryMatches) {
    const videoIdMatch = block.match(/<yt:videoId[^>]*>([\s\S]*?)<\/yt:videoId>/i);
    const idMatch = block.match(/<id[^>]*>([\s\S]*?)<\/id>/i);
    const rawId = idMatch ? decodeXmlEntities(idMatch[1]) : '';
    const videoId = (videoIdMatch ? decodeXmlEntities(videoIdMatch[1]) : rawId.replace(/^yt:video:/, '')).trim();
    if (!videoId) continue;

    const titleMatch = block.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? decodeXmlEntities(titleMatch[1]) : 'Untitled Video';

    const authorMatch = block.match(/<author[\s\S]*?<name[^>]*>([\s\S]*?)<\/name>/i);
    const channelName = authorMatch ? decodeXmlEntities(authorMatch[1]) : (fallbackName || feedTitle || 'Unknown Channel');

    const altLinkMatch =
      block.match(/<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/i) ||
      block.match(/<link[^>]*href=["']([^"']+)["'][^>]*rel=["']alternate["']/i) ||
      block.match(/<link[^>]*href=["']([^"']+)["']/i);
    const rawHref = altLinkMatch ? decodeXmlEntities(altLinkMatch[1]) : '';

    const pubMatch = block.match(/<published[^>]*>([\s\S]*?)<\/published>/i) || block.match(/<updated[^>]*>([\s\S]*?)<\/updated>/i);
    const publishedStr = pubMatch ? decodeXmlEntities(pubMatch[1]) : '';
    const publishedMs = publishedStr ? Date.parse(publishedStr) : 0;

    const thumbMatch = block.match(/<media:thumbnail[^>]*url=["']([^"']+)["']/i);
    const thumbnail = thumbMatch ? decodeXmlEntities(thumbMatch[1]) : '';

    allEntries.push({
      videoId,
      channelId,
      channelName,
      title,
      url: rewriteVideoLink(rawHref, videoId, origin),
      publishedStr,
      publishedMs: Number.isNaN(publishedMs) ? 0 : publishedMs,
      thumbnail
    });
  }

  return {
    ok: true,
    allEntries,
    entries: allEntries.slice(0, 5)
  };
}

async function fetchChannelFeedSw(channelId, fallbackName, origin) {
  try {
    const res = await fetch(`${origin}/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`, {
      cache: 'no-store'
    });
    if (!res.ok) return { ok: false, allEntries: [], entries: [] };
    const xmlText = await res.text();
    if (!xmlText || !xmlText.includes('<feed')) return { ok: false, allEntries: [], entries: [] };
    return parseAtomFeed(xmlText, channelId, fallbackName, origin);
  } catch {
    return { ok: false, allEntries: [], entries: [] };
  }
}

async function notifyAllClients(payload) {
  const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  clientList.forEach((client) => {
    try {
      client.postMessage(payload);
    } catch {}
  });
}

async function mergeConfigIntoIdb(incoming) {
  const existing = (await idbGet('config')) || {};
  const sameUser = existing.userId && existing.userId === incoming.userId;

  const readSet = new Set(sameUser && Array.isArray(existing.readVideoIds) ? existing.readVideoIds : []);
  if (Array.isArray(incoming.readVideoIds)) incoming.readVideoIds.forEach((id) => readSet.add(id));

  const alertedSet = new Set(sameUser && Array.isArray(existing.alertedVideoIds) ? existing.alertedVideoIds : []);
  if (Array.isArray(incoming.alertedVideoIds)) incoming.alertedVideoIds.forEach((id) => alertedSet.add(id));

  const subIdSet = new Set((incoming.channels || []).map((c) => c.id));

  const knownSet = new Set(sameUser && Array.isArray(existing.knownChannelIds) ? existing.knownChannelIds : []);
  if (Array.isArray(incoming.knownChannelIds)) incoming.knownChannelIds.forEach((id) => knownSet.add(id));
  const prunedKnown = Array.from(knownSet).filter((id) => subIdSet.has(id));

  const baselines = {};
  if (sameUser && existing.channelBaselineMs && typeof existing.channelBaselineMs === 'object') {
    Object.entries(existing.channelBaselineMs).forEach(([chId, ms]) => {
      if (subIdSet.has(chId) && typeof ms === 'number' && ms > 0) baselines[chId] = ms;
    });
  }
  if (incoming.channelBaselineMs && typeof incoming.channelBaselineMs === 'object') {
    Object.entries(incoming.channelBaselineMs).forEach(([chId, ms]) => {
      if (subIdSet.has(chId) && typeof ms === 'number' && ms > (baselines[chId] || 0)) baselines[chId] = ms;
    });
  }

  const merged = {
    userId: incoming.userId || '',
    origin: incoming.origin || self.location.origin,
    checkIntervalMinutes: incoming.checkIntervalMinutes || 30,
    channels: Array.isArray(incoming.channels) ? incoming.channels : [],
    notifPrefs: incoming.notifPrefs || {},
    readVideoIds: Array.from(readSet).slice(-3000),
    alertedVideoIds: Array.from(alertedSet).slice(-3000),
    dismissedVideoIds: Array.isArray(incoming.dismissedVideoIds) ? incoming.dismissedVideoIds.slice(-3000) : [],
    knownChannelIds: prunedKnown,
    channelBaselineMs: baselines,
    lastCheckMs: Math.max(sameUser ? (existing.lastCheckMs || 0) : 0, incoming.lastCheckMs || 0)
  };

  await idbSet('config', merged);
  return merged;
}

async function runBackgroundFeedCheck(force = false) {
  if (activeCheckPromise) return activeCheckPromise;

  activeCheckPromise = (async () => {
    const config = await idbGet('config');
    if (!config || !Array.isArray(config.channels) || !config.channels.length) return;

    const intervalMs = Math.max(1, Number(config.checkIntervalMinutes) || 30) * 60 * 1000;
    if (!force && config.lastCheckMs && (Date.now() - config.lastCheckMs) < intervalMs) {
      return;
    }

    const enabledChannels = config.channels.filter((c) => config.notifPrefs?.[c.id] !== false);
    if (!enabledChannels.length) return;

    const origin = config.origin || self.location.origin;
    const readSet = new Set(config.readVideoIds || []);
    const alertedSet = new Set(config.alertedVideoIds || []);
    const dismissedSet = new Set(config.dismissedVideoIds || []);
    const knownSet = new Set(config.knownChannelIds || []);
    const baselines = { ...(config.channelBaselineMs || {}) };

    const collected = [];
    const batchSize = 5;
    for (let i = 0; i < enabledChannels.length; i += batchSize) {
      const batch = enabledChannels.slice(i, i + batchSize);
      const results = await Promise.all(
        batch.map(async (ch) => ({
          channelId: ch.id,
          ...(await fetchChannelFeedSw(ch.id, ch.name, origin))
        }))
      );

      results.forEach(({ channelId, ok, allEntries, entries }) => {
        if (!ok) return;
        const isNewChannel = !knownSet.has(channelId);
        const needsBaseline = !baselines[channelId];
        if (isNewChannel || needsBaseline) {
          let maxPubMs = 0;
          allEntries.forEach((item) => {
            alertedSet.add(item.videoId);
            if (isNewChannel) readSet.add(item.videoId);
            if (item.publishedMs > maxPubMs) maxPubMs = item.publishedMs;
          });
          baselines[channelId] = maxPubMs > 0 ? maxPubMs : Date.now();
          knownSet.add(channelId);
        }
        collected.push(...entries);
      });
    }

    const dedup = new Map();
    collected.forEach((item) => {
      if (!dismissedSet.has(item.videoId) && !dedup.has(item.videoId)) {
        dedup.set(item.videoId, item);
      }
    });

    const sorted = Array.from(dedup.values())
      .sort((a, b) => b.publishedMs - a.publishedMs)
      .slice(0, 60);

    const fresh = sorted.filter((item) => {
      if (alertedSet.has(item.videoId)) return false;
      if (readSet.has(item.videoId)) return false;
      if (dismissedSet.has(item.videoId)) return false;
      const base = baselines[item.channelId];
      if (base && item.publishedMs > 0 && item.publishedMs <= base) return false;
      return true;
    });

    fresh.forEach((item) => {
      alertedSet.add(item.videoId);
      if (item.publishedMs > (baselines[item.channelId] || 0)) {
        baselines[item.channelId] = item.publishedMs;
      }
    });

    config.readVideoIds = Array.from(readSet).slice(-3000);
    config.alertedVideoIds = Array.from(alertedSet).slice(-3000);
    config.knownChannelIds = Array.from(knownSet);
    config.channelBaselineMs = baselines;
    config.lastCheckMs = Date.now();

    await idbSet('config', config);

    if (fresh.length > 0 && self.Notification && Notification.permission === 'granted') {
      for (const item of fresh.slice(0, 3)) {
        await self.registration.showNotification(item.channelName, {
          body: item.title,
          icon: item.thumbnail || `${origin}/css/poke-icon-logo.svg?v=6`,
          tag: `poke-video-${item.videoId}`,
          data: { url: item.url, videoId: item.videoId, isTest: false }
        });
      }
    }

    await notifyAllClients({ type: 'SW_STATE_UPDATED' });
  })().finally(() => {
    activeCheckPromise = null;
  });

  return activeCheckPromise;
}

self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'poke-check-feeds') {
    event.waitUntil(runBackgroundFeedCheck(false));
  }
});

self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    event.waitUntil(runBackgroundFeedCheck(false));
  }
});

self.addEventListener('message', (event) => {
  const data = event.data || {};

  if (data.type === 'SYNC_CONFIG' && data.config) {
    event.waitUntil(mergeConfigIntoIdb(data.config));
    return;
  }

  if (data.type === 'CHECK_NOW') {
    event.waitUntil(runBackgroundFeedCheck(true));
    return;
  }

  if (data.type === 'CANCEL_TEST_NOTIF') {
    if (pendingTestTimer) {
      clearTimeout(pendingTestTimer);
      pendingTestTimer = null;
    }
    if (pendingTestCancel) {
      pendingTestCancel();
      pendingTestCancel = null;
    }
    return;
  }

  if (data.type === 'SCHEDULE_TEST_NOTIF' && data.item) {
    if (pendingTestTimer) {
      clearTimeout(pendingTestTimer);
      pendingTestTimer = null;
    }
    if (pendingTestCancel) {
      pendingTestCancel();
      pendingTestCancel = null;
    }

    const delayMs = Math.max(0, Math.min(120000, Number(data.delayMs) || 0));
    const item = data.item;
    const origin = self.location.origin;

    const deliveryTask = new Promise((resolve) => {
      pendingTestCancel = resolve;
      pendingTestTimer = setTimeout(async () => {
        pendingTestTimer = null;
        pendingTestCancel = null;
        try {
          await self.registration.showNotification(item.channelName, {
            body: item.title,
            icon: item.thumbnail || `${origin}/css/poke-icon-logo.svg?v=6`,
            tag: `poke-test-${Date.now()}`,
            data: { url: item.url, videoId: item.videoId, isTest: true }
          });
          await notifyAllClients({ type: 'TEST_NOTIF_DELIVERED', item });
        } catch {}
        resolve();
      }, delayMs);
    });

    event.waitUntil(deliveryTask);
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const targetUrl = data.url || '/';

  event.waitUntil((async () => {
    if (data.videoId && !data.isTest) {
      const config = await idbGet('config');
      if (config) {
        const readSet = new Set(config.readVideoIds || []);
        const alertedSet = new Set(config.alertedVideoIds || []);
        readSet.add(data.videoId);
        alertedSet.add(data.videoId);
        config.readVideoIds = Array.from(readSet).slice(-3000);
        config.alertedVideoIds = Array.from(alertedSet).slice(-3000);
        await idbSet('config', config);
        await notifyAllClients({ type: 'SW_STATE_UPDATED' });
      }
    }
    await self.clients.openWindow(targetUrl);
  })());
});
// @license-end