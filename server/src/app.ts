import express from "express";
import cors from "cors";
import { prisma } from "./lib/db.js";

const app = express();

app.use(cors({ origin: process.env.CLIENT_URL ?? "http://localhost:5173", credentials: true }));

app.use(express.json());

app.get("/api/health", async (_req, res) => {
  const result = await prisma.$queryRaw<[{ version: string }]>`SELECT version()`;
  res.json({
    status: "ok",
    database: "connected",
    postgres: result[0].version,
  });
});

export default app;
