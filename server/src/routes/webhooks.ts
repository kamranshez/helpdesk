import { Router } from "express";
import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../lib/db.js";
import boss from "../lib/boss.js";
import { CLASSIFY_QUEUE, type ClassifyJobData } from "../workers/classify.js";
import { AUTO_RESOLVE_QUEUE, type AutoResolveJobData } from "../workers/auto-resolve.js";
import { inboundEmailSchema } from "@helpdesk/core";

const router = Router();

function parseFromHeader(header: string): { email: string; name?: string } {
  const match = header.match(/^(.+?)\s*<([^>]+)>$/);
  if (match) {
    return { name: match[1].trim().replace(/^"|"$/g, ""), email: match[2].trim() };
  }
  return { email: header.trim() };
}

async function createTicketAndEnqueueJobs(data: {
  from: string;
  fromName?: string;
  to?: string;
  subject: string;
  bodyText: string;
  bodyHtml?: string;
  messageId?: string;
}) {
  const ticket = await prisma.ticket.create({
    data: {
      fromEmail: data.from,
      fromName: data.fromName,
      toEmail: data.to,
      subject: data.subject,
      bodyText: data.bodyText,
      bodyHtml: data.bodyHtml,
      messageId: data.messageId,
    },
  });

  if (!ticket.category) {
    boss
      .send(CLASSIFY_QUEUE, { ticketId: ticket.id, subject: ticket.subject, bodyText: ticket.bodyText } satisfies ClassifyJobData)
      .catch((err) => console.error(`[classify] enqueue ticket ${ticket.id} failed:`, err));
  }

  boss
    .send(AUTO_RESOLVE_QUEUE, { ticketId: ticket.id, subject: ticket.subject, bodyText: ticket.bodyText, fromName: ticket.fromName } satisfies AutoResolveJobData)
    .catch((err) => console.error(`[auto-resolve] enqueue ticket ${ticket.id} failed:`, err));

  return ticket;
}

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
        .send(CLASSIFY_QUEUE, { ticketId: ticket.id, subject: ticket.subject, bodyText: ticket.bodyText } satisfies ClassifyJobData)
        .catch((err) => console.error(`[classify] enqueue ticket ${ticket.id} failed:`, err));
    }

    boss
      .send(AUTO_RESOLVE_QUEUE, { ticketId: ticket.id, subject: ticket.subject, bodyText: ticket.bodyText, fromName: ticket.fromName } satisfies AutoResolveJobData)
      .catch((err) => console.error(`[auto-resolve] enqueue ticket ${ticket.id} failed:`, err));
  } catch (err: unknown) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      res.status(409).json({ error: "A ticket with this message ID already exists." });
      return;
    }
    throw err;
  }
});

router.post("/cloudmailin", async (req, res) => {
  console.log("[cloudmailin] webhook hit", req.method, req.path);
  const secret = process.env.CLOUDMAILIN_WEBHOOK_SECRET;
  if (secret && req.query.secret !== secret) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { headers, envelope, plain, html } = req.body ?? {};

  const fromHeader: string = headers?.from ?? envelope?.from ?? "";
  const { email: fromEmail, name: fromName } = parseFromHeader(fromHeader);

  const subject: string = headers?.subject ?? "";
  const bodyText: string = plain ?? "";

  if (!fromEmail || !subject || !bodyText) {
    res.status(400).json({ error: "Missing required fields: from, subject, or plain body" });
    return;
  }

  try {
    const ticket = await createTicketAndEnqueueJobs({
      from: fromEmail,
      fromName,
      to: envelope?.to ?? headers?.to,
      subject,
      bodyText,
      bodyHtml: html,
      messageId: headers?.message_id,
    });

    res.status(201).json({ ticket });
  } catch (err: unknown) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      res.status(409).json({ error: "A ticket with this message ID already exists." });
      return;
    }
    throw err;
  }
});

export default router;
