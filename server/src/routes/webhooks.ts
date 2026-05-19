import { Router } from "express";
import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../lib/db.js";
import boss from "../lib/boss.js";
import { CLASSIFY_QUEUE, type ClassifyJobData } from "../workers/classify.js";
import { AUTO_RESOLVE_QUEUE, type AutoResolveJobData } from "../workers/auto-resolve.js";
import { inboundEmailSchema } from "@helpdesk/core";

const router = Router();

router.post("/email", async (req, res) => {
  const secret = process.env.EMAIL_WEBHOOK_SECRET;
  if (!secret || req.headers["x-webhook-secret"] !== secret) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const result = inboundEmailSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: result.error.issues[0].message });
    return;
  }

  const { from, fromName, to, subject, bodyText, bodyHtml, messageId, category } = result.data;

  try {
    const ticket = await prisma.ticket.create({
      data: { fromEmail: from, fromName, toEmail: to, subject, bodyText, bodyHtml, messageId, category },
    });
    res.status(201).json({ ticket });

    if (!category) {
      boss
        .send(CLASSIFY_QUEUE, {
          ticketId: ticket.id,
          subject: ticket.subject,
          bodyText: ticket.bodyText,
        } satisfies ClassifyJobData)
        .then((id) => {
          if (!id) console.error(`[classify] boss.send returned null for ticket ${ticket.id}`);
        })
        .catch((err) => console.error(`[classify] enqueue ticket ${ticket.id} failed:`, err));
    }

    boss
      .send(AUTO_RESOLVE_QUEUE, {
        ticketId: ticket.id,
        subject: ticket.subject,
        bodyText: ticket.bodyText,
        fromName: ticket.fromName,
      } satisfies AutoResolveJobData)
      .then((id) => {
        if (!id) console.error(`[auto-resolve] boss.send returned null for ticket ${ticket.id}`);
      })
      .catch((err) => console.error(`[auto-resolve] enqueue ticket ${ticket.id} failed:`, err));
  } catch (err: unknown) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      res.status(409).json({ error: "A ticket with this message ID already exists." });
      return;
    }
    throw err;
  }
});

export default router;
