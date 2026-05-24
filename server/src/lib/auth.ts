import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { customSession } from "better-auth/plugins";
import { prisma } from "./db.js";

if (!process.env.BETTER_AUTH_SECRET) throw new Error("BETTER_AUTH_SECRET env var is required");

// Build trusted origins from TRUSTED_ORIGIN env var and/or Railway's auto-injected public domain
const trustedOrigins: string[] = [];
if (process.env.TRUSTED_ORIGIN) {
  trustedOrigins.push(...process.env.TRUSTED_ORIGIN.split(",").map((o) => o.trim()));
}
if (process.env.RAILWAY_PUBLIC_DOMAIN) {
  trustedOrigins.push(`https://${process.env.RAILWAY_PUBLIC_DOMAIN}`);
}
if (trustedOrigins.length === 0) throw new Error("TRUSTED_ORIGIN env var is required");

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  trustedOrigins,
  emailAndPassword: { enabled: true, disableSignUp: true },
  user: {
    additionalFields: {
      role: {
        type: ["admin", "agent"] as const,
        required: true,
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
