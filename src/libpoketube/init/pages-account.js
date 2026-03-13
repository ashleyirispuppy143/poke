const { modules } = require("../libpoketube-initsys.js");
const crypto = require("crypto");
const sha384 = modules.hash;
const configJson = require("../../../config.json");

 const SERVER_SECRET = configJson.subSecret;
if (!SERVER_SECRET) {
  throw new Error(
    "[poketube-subs] Missing 'subSecret' in config.json — add it before starting the server."
  );
}

 
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
    if (!ivHex || !tagHex || !encHex) return null; // plaintext/legacy entry
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
 
function isEncrypted(value) {
  return typeof value === "string" && value.split(":").length === 3;
}

/**
 * migrateUser — re-encrypts any plaintext subscription entries for one user.
 * Safe to call repeatedly; already-encrypted entries are skipped.
 * Returns the number of entries migrated.
 */
function migrateUser(db, userId) {
  const raw = db.get(`user.${userId}.subs`);
  if (!raw || typeof raw !== "object") return 0;

  let migrated = 0;
  for (const [channelId, value] of Object.entries(raw)) {
    if (isEncrypted(value)) continue; // already done

    // value is a plaintext object like { channelName, avatar }
    if (value && typeof value === "object") {
      db.set(`user.${userId}.subs.${channelId}`, encrypt(userId, value));
      migrated++;
    }
  }
  return migrated;
}

/**
 * migrateAllUsers — iterates every user in the DB and migrates their subs.
 * Called once at startup.
 */
function migrateAllUsers(db) {
  const all = db.get("user");
  if (!all || typeof all !== "object") return;

  let totalUsers = 0;
  let totalEntries = 0;

  for (const userId of Object.keys(all)) {
    const count = migrateUser(db, userId);
    if (count > 0) {
      totalUsers++;
      totalEntries += count;
    }
  }

  if (totalEntries > 0) {
    console.log(
      `[poketube-subs] Migration complete — encrypted ${totalEntries} sub(s) across ${totalUsers} user(s).`
    );
  } else {
    console.log("[poketube-subs] Migration check done — nothing to migrate.");
  }
}

 
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

 
function validateId(id, res) {
  if (!id || typeof id !== "string" || id.length > 7) {
    res.status(400).json({ error: "IDs can be 7 characters max silly :3" });
    return false;
  }
  return true;
}

 
module.exports = function (app, config, renderTemplate) {
  const db = require("quick.db");

  // Migrate all legacy plaintext subs on startup
  migrateAllUsers(db);

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