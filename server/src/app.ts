import * as Sentry from "@sentry/node";
import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./lib/auth.js";
import { prisma } from "./lib/db.js";
import { requireAuth } from "./middleware/auth.js";
import usersRouter from "./routes/users.js";
import ticketsRouter from "./routes/tickets.js";
import statsRouter from "./routes/stats.js";
import webhooksRouter from "./routes/webhooks.js";
import path from "path";
import { fileURLToPath } from "url";

const app = express();

app.use(helmet());
const corsOrigins = [process.env.CLIENT_URL ?? "http://localhost:5173"];
if (process.env.RAILWAY_PUBLIC_DOMAIN) {
  corsOrigins.push(`https://${process.env.RAILWAY_PUBLIC_DOMAIN}`);
}
app.use(cors({ origin: corsOrigins, credentials: true }));

// Better Auth must be mounted before express.json()
if (process.env.NODE_ENV === "production") {
  const signInRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many sign-in attempts, please try again later." },
  });
  app.use("/api/auth/sign-in", signInRateLimit);
}
app.all("/api/auth/{*any}", toNodeHandler(auth));

app.use(express.json({ limit: "1mb" }));

// Unauthenticated routes above this line
app.get("/api/health", async (_req, res) => {
  await prisma.$queryRaw`SELECT 1`;
  res.json({ status: "ok", database: "connected" });
});



// Unauthenticated webhook routes — must be before requireAuth
app.use("/api/webhooks", webhooksRouter);

// All /api routes below this line require a valid session
app.use("/api", requireAuth);

app.use("/api/users", usersRouter);
app.use("/api/tickets", ticketsRouter);
app.use("/api/stats", statsRouter);

Sentry.setupExpressErrorHandler(app);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("[error]", err);
  res.status(500).json({ error: "Internal server error" });
});

// In production, serve the Vite client build and fall back to index.html for SPA routing
if (process.env.NODE_ENV === "production") {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const clientDist = path.resolve(__dirname, "../../client/dist");
  app.use(express.static(clientDist));
  app.get("/{*any}", (_req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

export default app;
