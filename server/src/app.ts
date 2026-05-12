import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./lib/auth.js";
import { prisma } from "./lib/db.js";
import { requireAuth } from "./middleware/auth.js";

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL ?? "http://localhost:5173", credentials: true }));

const signInRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many sign-in attempts, please try again later." },
});

// Better Auth must be mounted before express.json()
app.use("/api/auth/sign-in", signInRateLimit);
app.all("/api/auth/{*any}", toNodeHandler(auth));

app.use(express.json({ limit: "1mb" }));

// Unauthenticated routes above this line
app.get("/api/health", async (_req, res) => {
  await prisma.$queryRaw`SELECT 1`;
  res.json({ status: "ok", database: "connected" });
});

// All /api routes below this line require a valid session
app.use("/api", requireAuth);

export default app;
