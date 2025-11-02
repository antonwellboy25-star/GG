import express from "express";
import cors from "cors";
import { CORS_ORIGIN, PORT } from "./config.js";
import referralsRouter from "./routes/referrals.js";
import { telegramAuthMiddleware } from "./telegram.js";

const app = express();

const allowedOrigins = CORS_ORIGIN.split(",").map((value) => value.trim());
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  }),
);

app.use(express.json());

app.get("/healthz", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/api/referrals", telegramAuthMiddleware, referralsRouter);

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error("[Server]", err);
  res.status(500).json({ error: "Internal server error", detail: err.message });
});

app.listen(PORT, () => {
  console.log(`Referral API listening on port ${PORT}`);
});
