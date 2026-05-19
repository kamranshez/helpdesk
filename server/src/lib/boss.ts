import { PgBoss } from "pg-boss";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL env var is required");

const boss = new PgBoss(process.env.DATABASE_URL);
boss.on("error", (err: Error) => console.error("[pg-boss]", err));

export default boss;
