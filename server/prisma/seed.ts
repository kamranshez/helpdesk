import "dotenv/config";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { Role } from "../generated/prisma/enums.js";
import { prisma } from "../src/lib/db.js";

const email = process.env.SEED_ADMIN_EMAIL!;
const password = process.env.SEED_ADMIN_PASSWORD!;

if (!email || !password) {
  console.error("SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be set");
  process.exit(1);
}

const existing = await prisma.user.findUnique({ where: { email } });
if (existing) {
  console.log(`Admin user already exists: ${email}`);
  await prisma.$disconnect();
  process.exit(0);
}

// Sign-up enabled only for seeding
const seedAuth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: { enabled: true },
});

const result = await seedAuth.api.signUpEmail({
  body: { email, password, name: "Admin" },
});

await prisma.user.update({
  where: { id: result.user.id },
  data: { role: Role.admin },
});

console.log(`Admin user created: ${email}`);
await prisma.$disconnect();
