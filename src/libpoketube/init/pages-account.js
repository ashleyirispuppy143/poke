const { modules } = require("../libpoketube-initsys.js");
const crypto = require("crypto");
const sha384 = modules.hash;
const configJson = require("../config.json");

// ─── Config ───────────────────────────────────────────────────────────────────

const SERVER_SECRET = configJson.subSecret;
if (!SERVER_SECRET) {
  throw new Error(
    "[poketube-subs] Missing 'subSecret' in config.json — add it before starting the server."
  );
}

// ─── E2EE helpers ────────────────────────────────────────────────────────────

function deriveKey(userId) {
  return Buffer.from(sha384(userId + SERVER_SECRET), "hex").slice(0, 32);
}

function encrypt(userId, obj) {
  const key = deriveKey(userId);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(obj), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [iv.toString("hex"), tag.toString("hex"), encrypted.toString("hex")].join(":");
}

function decrypt(userId, stored) {
  try {
    const [ivHex, tagHex, encHex] = stored.split(":");
    if (!ivHex || !tagHex || !encHex) return null;
    const key = deriveKey(userId);
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(ivHex, "hex")
    );
    decipher.setAuthTag(Buffer.from(tagHex, "hex"));
    const out = Buffer.concat([
      decipher.update(Buffer.from(encHex, "hex")),
      decipher.final(),
    ]);
    return JSON.parse(out.toString("utf8"));
  } catch {
    return null;
  }
}

// ─── Migration ────────────────────────────────────────────────────────────────

const MIGRATION_FLAG = "meta.subsE2eeMigrated";

function isEncrypted(value) {
  return typeof value === "string" && value.split(":").length === 3;
}

/**
 * Migrates one user's plaintext subs in place.
 * Yields control back to the event loop between users via setImmediate
 * so startup / request handling is never blocked.
 */
function migrateUserAsync(db, userId) {
  return new Promise((resolve) => {
    setImmediate(() => {
      try {
        const raw = db.get(`user.${userId}.subs`);
        if (!raw || typeof raw !== "object") return resolve(0);

        let migrated = 0;
        for (const [channelId, value] of Object.entries(raw)) {
          if (isEncrypted(value)) continue;
          if (value && typeof value === "object") {
            db.set(`user.${userId}.subs.${channelId}`, encrypt(userId, value));
            migrated++;
          }
        }
        resolve(migrated);
      } catch {
        resolve(0);
      }
    });
  });
}

/**
 * Runs the full migration once, in the background, after the server is up.
 * Skips entirely if the flag is already set in the DB.
 */
async function runMigrationIfNeeded(db) {
  if (db.get(MIGRATION_FLAG)) {
    console.log("[poketube-subs] E2EE migration already done, skipping.");
    return;
  }

  const all = db.get("user");
  if (!all || typeof all !== "object") {
    db.set(MIGRATION_FLAG, true);
    return;
  }

  const userIds = Object.keys(all);
  if (userIds.length === 0) {
    db.set(MIGRATION_FLAG, true);
    return;
  }

  console.log(`[poketube-subs] Checking DB — migrating ${userIds.length} user(s) to E2EE in background...`);

  let totalEntries = 0;
  let totalUsers   = 0;

  for (const userId of userIds) {
    const count = await migrateUserAsync(db, userId);
    if (count > 0) {
      totalUsers++;
      totalEntries += count;
    }
  }

  // Mark migration as done so it never runs again
  db.set(MIGRATION_FLAG, true);

  if (totalEntries > 0) {
    console.log(`[poketube-subs] Migration done — encrypted ${totalEntries} sub(s) across ${totalUsers} user(s).`);
  } else {
    console.log("[poketube-subs] Migration done — everything was already encrypted.");
  }
}

// ─── DB helpers ──────────────────────────────────────────────────────────────

function getSubsDecrypted(db, userId) {
  const raw = db.get(`user.${userId}.subs`);
  if (!raw) return null;

  const result = {};
  for (const [channelId, encValue] of Object.entries(raw)) {
    const plain = decrypt(userId, encValue);
    if (plain) result[channelId] = plain;
  }
  return result;
}

function setSubEncrypted(db, userId, channelId, channelData) {
  db.set(`user.${userId}.subs.${channelId}`, encrypt(userId, channelData));
}

// ─── Route validation ─────────────────────────────────────────────────────────

function validateId(id, res) {
  if (!id || typeof id !== "string" || id.length > 7) {
    res.status(400).json({ error: "IDs can be 7 characters max silly :3" });
    return false;
  }
  return true;
}

// ─── Module export ────────────────────────────────────────────────────────────

module.exports = function (app, config, renderTemplate) {
  const db = require("quick.db");

  // Fire migration in background — doesn't block server startup at all
  setImmediate(() => runMigrationIfNeeded(db).catch(console.error));

  app.get("/api/get-channel-subs", async function (req, res) {
    const userId = req.query.ID;
    if (!validateId(userId, res)) return;
    if (!db.get(`user.${userId}`)) return res.json("no user found");
    res.json(getSubsDecrypted(db, userId) ?? {});
  });

  app.get("/api/remove-channel-sub", async function (req, res) {
    const userId = req.query.ID;
    const channelToRemove = req.query.channelID;
    if (!validateId(userId, res)) return;

    if (db.get(`user.${userId}.subs.${channelToRemove}`)) {
      db.delete(`user.${userId}.subs.${channelToRemove}`);
      res.json("Subscription removed");
    } else {
      res.json("Subscription not found");
    }
  });

  app.get("/api/set-channel-subs", async function (req, res) {
    const userId      = req.query.ID;
    const channelId   = req.query.channelID;
    const channelName = req.query.channelName;
    const avatar      = req.query.avatar;
    if (!validateId(userId, res)) return;

    const channelData = { channelName, avatar };

    if (!db.get(`user.${userId}.subs.${channelId}`)) {
      setSubEncrypted(db, userId, channelId, channelData);
      return res.redirect("/account-create");
    }

    res.json("ur already subscribed");
  });

  app.get("/account-create", async function (req, res) {
    renderTemplate(res, req, "account-create.ejs", { db });
  });

  app.get("/api/get-all-subs", async function (req, res) {
    const userId = req.query.ID;
    if (!validateId(userId, res)) return;
    res.json(getSubsDecrypted(db, userId) ?? {});
  });

  app.get("/my-acc", async function (req, res) {
    const userId = req.query.ID;
    if (!validateId(userId, res)) return;
    renderTemplate(res, req, "account-me.ejs", {
      userid: userId,
      userSubs: getSubsDecrypted(db, userId),
    });
  });
};