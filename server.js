import express from "express";
import cors from "cors";
import admin from "firebase-admin";

const app = express();
app.use(cors());
app.use(express.json());

// Firebase Admin
const serviceAccount = JSON.parse(
  process.env.FIREBASE_SERVICE_ACCOUNT_JSON
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

app.post("/push/message", async (req, res) => {
  try {
    const { toUserId, chatId, text, senderName } = req.body;

    if (!toUserId || !chatId) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const snap = await db.doc(`users/${toUserId}`).get();
    const token = snap.data()?.expoPushToken;

    if (!token) {
      return res.json({ ok: true, skipped: "no token" });
    }

    const payload = {
      to: token,
      title: senderName || "New message",
      body: (text || "").slice(0, 140),
      data: { chatId },
    };

    const r = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const json = await r.json();
    res.json({ ok: true, expo: json });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Push server running on", PORT));
