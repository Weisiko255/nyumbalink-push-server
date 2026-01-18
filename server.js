import express from "express";
import cors from "cors";
import admin from "firebase-admin";
import fetch from "node-fetch";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

// ✅ Health check route (before listen)
app.get("/", (req, res) => res.status(200).send("OK"));

// Firebase Admin
const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
if (!raw) {
  console.error("Missing env: FIREBASE_SERVICE_ACCOUNT_JSON");
  process.exit(1);
}

const serviceAccount = JSON.parse(raw);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

function isExpoToken(t) {
  return typeof t === "string" && t.startsWith("ExponentPushToken[");
}

app.post("/push/message", async (req, res) => {
  try {
    const { toUserId, chatId, text, senderName } = req.body || {};

    if (!toUserId || !chatId) {
      return res.status(400).json({ ok: false, error: "Missing toUserId or chatId" });
    }

    const snap = await db.doc(`users/${toUserId}`).get();
    const token = snap.exists ? snap.data()?.expoPushToken : null;

    if (!token) return res.json({ ok: true, skipped: "no token" });
    if (!isExpoToken(token)) return res.json({ ok: true, skipped: "invalid token" });

    const payload = {
      to: token,
      title: senderName || "New message",
      body: String(text || "New message").slice(0, 140),
      data: { chatId, toUserId },
      sound: "default",
    };

    const r = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const json = await r.json().catch(() => ({}));
    return res.json({ ok: true, expoStatus: r.status, expo: json });
  } catch (e) {
    console.error("PUSH ERROR:", e);
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, () => console.log("Push server running on", PORT));
