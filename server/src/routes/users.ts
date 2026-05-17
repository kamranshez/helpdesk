import { Router } from "express";
import { prisma } from "../lib/db.js";
import { Role } from "../../generated/prisma/enums.js";
import { requireAdmin } from "../middleware/auth.js";
import { createUserSchema, updateUserSchema } from "@helpdesk/core";
import { hashPassword } from "better-auth/crypto";
import { randomUUID } from "crypto";

const router = Router();

router.get("/agents", async (_req, res) => {
  const agents = await prisma.user.findMany({
    where: { deletedAt: null, role: Role.agent },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });
  res.json({ agents });
});

router.get("/", requireAdmin, async (_req, res) => {
  const users = await prisma.user.findMany({
    where: { deletedAt: null },
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

router.patch("/:id", requireAdmin, async (req, res) => {
  const { id } = req.params as { id: string };

  const result = updateUserSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: result.error.issues[0].message });
    return;
  }
  const { name, email, password } = result.data;

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) {
    res.status(404).json({ error: "User not found." });
    return;
  }

  if (email !== target.email) {
    const conflict = await prisma.user.findUnique({ where: { email } });
    if (conflict) {
      res.status(409).json({ error: "A user with that email already exists." });
      return;
    }
  }

  const now = new Date();
  const user = await prisma.user.update({
    where: { id },
    data: { name: name.trim(), email, updatedAt: now },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });

  if (password) {
    await prisma.account.updateMany({
      where: { userId: id, providerId: "credential" },
      data: { password: await hashPassword(password), updatedAt: now },
    });
  }

  res.json({ user });
});

router.delete("/:id", requireAdmin, async (req, res) => {
  const { id } = req.params as { id: string };

  const target = await prisma.user.findUnique({ where: { id, deletedAt: null } });
  if (!target) {
    res.status(404).json({ error: "User not found." });
    return;
  }

  if (target.role === Role.admin) {
    res.status(403).json({ error: "Admin users cannot be deleted." });
    return;
  }

  await prisma.user.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  res.status(204).end();
});

export default router;
