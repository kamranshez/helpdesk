import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { customSession } from "better-auth/plugins";
import { prisma } from "./db.js";

if (!process.env.TRUSTED_ORIGIN) throw new Error("TRUSTED_ORIGIN env var is required");
if (!process.env.BETTER_AUTH_SECRET) throw new Error("BETTER_AUTH_SECRET env var is required");

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  trustedOrigins: process.env.TRUSTED_ORIGIN.split(",").map((o) => o.trim()),
  emailAndPassword: { enabled: true, disableSignUp: true },
  user: {
    additionalFields: {
      role: {
        type: ["admin", "agent"] as const,
        required: false,
        defaultValue: "agent",
        input: false,
      },
    },
  },
  plugins: [
    customSession(async ({ user, session }) => {
      const rows = await prisma.$queryRaw<[{ role: "admin" | "agent" }]>`SELECT role FROM "user" WHERE id = ${user.id}`;
      return { user: { ...user, role: rows[0]?.role ?? "agent" }, session };
    }),
  ],
});
