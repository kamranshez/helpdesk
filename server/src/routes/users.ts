import { Router } from "express";
import { prisma } from "../lib/db.js";
import { Role } from "../../generated/prisma/enums.js";
import { requireAdmin } from "../middleware/auth.js";
import { createUserSchema } from "@helpdesk/core";
import { hashPassword } from "better-auth/crypto";
import { randomUUID } from "crypto";

const router = Router();

router.get("/", requireAdmin, async (_req, res) => {
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  res.json({ users });
});

router.post("/", requireAdmin, async (req, res) => {
  const result = createUserSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: result.error.issues[0].message });
    return;
  }
  const { name, email, password } = result.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    res.status(409).json({ error: "A user with that email already exists." });
    return;
  }

  const hashedPassword = await hashPassword(password);
  const now = new Date();
  const userId = randomUUID();

  const user = await prisma.user.create({
    data: {
      id: userId,
      name: name.trim(),
      email,
      emailVerified: false,
      role: Role.agent,
      createdAt: now,
      updatedAt: now,
      accounts: {
        create: {
          id: randomUUID(),
          accountId: userId,
          providerId: "credential",
          password: hashedPassword,
          createdAt: now,
          updatedAt: now,
        },
      },
    },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });

  res.status(201).json({ user });
});

export default router;
