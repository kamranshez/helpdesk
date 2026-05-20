import { Router } from "express";
import { prisma } from "../lib/db.js";
import { TicketStatus, TicketCategory, Role, ReplySenderType } from "../../generated/prisma/enums.js";
import { updateTicketSchema, createReplySchema, polishReplySchema } from "@helpdesk/core";
import { polishReply, summarizeTicket } from "../lib/ai.js";
import { sendReplyEmail } from "../lib/email.js";

const router = Router();

const SORTABLE_COLUMNS = ["subject", "fromEmail", "status", "category", "createdAt"] as const;
type SortableColumn = (typeof SORTABLE_COLUMNS)[number];

const VALID_STATUSES = Object.values(TicketStatus);
const VALID_CATEGORIES = Object.values(TicketCategory);

router.get("/", async (req, res) => {
  const sortBy: SortableColumn = SORTABLE_COLUMNS.includes(req.query.sortBy as SortableColumn)
    ? (req.query.sortBy as SortableColumn)
    : "createdAt";
  const sortOrder = req.query.sortOrder === "asc" ? "asc" : "desc";

  const statusParam = req.query.status as string | undefined;
  const categoryParam = req.query.category as string | undefined;
  const search = typeof req.query.search === "string" ? req.query.search.trim() : undefined;

  const status = VALID_STATUSES.includes(statusParam as TicketStatus)
    ? (statusParam as TicketStatus)
    : undefined;
  const category = VALID_CATEGORIES.includes(categoryParam as TicketCategory)
    ? (categoryParam as TicketCategory)
    : undefined;

  const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 20, 1), 100);
  const page = Math.max(parseInt(req.query.page as string) || 1, 1);

  const where = {
    NOT: { status: { in: [TicketStatus.new, TicketStatus.processing] } },
    ...(status ? { status } : {}),
    ...(category ? { category } : {}),
    ...(search
      ? {
          OR: [
            { subject: { contains: search, mode: "insensitive" as const } },
            { fromEmail: { contains: search, mode: "insensitive" as const } },
            { fromName: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [tickets, total] = await Promise.all([
    prisma.ticket.findMany({
      where,
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        subject: true,
        fromEmail: true,
        fromName: true,
        status: true,
        category: true,
        createdAt: true,
      },
    }),
    prisma.ticket.count({ where }),
  ]);

  res.json({ tickets, total, page, limit });
});

router.get("/:id", async (req, res) => {
  const ticket = await prisma.ticket.findUnique({
    where: { id: req.params.id },
    select: {
      id: true,
      subject: true,
      bodyText: true,
      bodyHtml: true,
      fromEmail: true,
      fromName: true,
      toEmail: true,
      status: true,
      category: true,
      createdAt: true,
      updatedAt: true,
      assignedTo: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  if (!ticket) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }

  res.json({ ticket });
});

router.patch("/:id", async (req, res) => {
  const result = updateTicketSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: result.error.issues[0].message });
    return;
  }

  const { assignedToId, status, category } = result.data;

  if (assignedToId !== undefined && assignedToId !== null) {
    const agent = await prisma.user.findFirst({
      where: { id: assignedToId, role: Role.agent, deletedAt: null },
    });
    if (!agent) {
      res.status(400).json({ error: "Agent not found." });
      return;
    }
  }

  const existing = await prisma.ticket.findUnique({ where: { id: req.params.id } });
  if (!existing) {
    res.status(404).json({ error: "Ticket not found." });
    return;
  }

  const isResolvingStatus =
    status === TicketStatus.resolved || status === TicketStatus.closed;
  const shouldSetResolvedAt = isResolvingStatus && !existing.resolvedAt;

  const ticket = await prisma.ticket.update({
    where: { id: req.params.id },
    data: {
      ...(assignedToId !== undefined && { assignedToId }),
      ...(status !== undefined && { status: status as TicketStatus }),
      ...(category !== undefined && { category: category as TicketCategory | null }),
      ...(shouldSetResolvedAt && { resolvedAt: new Date() }),
      updatedAt: new Date(),
    },
    select: {
      id: true,
      status: true,
      category: true,
      assignedTo: { select: { id: true, name: true, email: true } },
    },
  });

  res.json({ ticket });
});

router.get("/:id/replies", async (req, res) => {
  const ticket = await prisma.ticket.findUnique({ where: { id: req.params.id } });
  if (!ticket) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }

  const replies = await prisma.reply.findMany({
    where: { ticketId: req.params.id },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      ticketId: true,
      authorId: true,
      author: { select: { id: true, name: true, email: true } },
      senderType: true,
      body: true,
      bodyHtml: true,
      createdAt: true,
    },
  });

  res.json({ replies });
});

router.post("/:id/replies", async (req, res) => {
  const result = createReplySchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: result.error.issues[0].message });
    return;
  }

  const ticket = await prisma.ticket.findUnique({ where: { id: req.params.id } });
  if (!ticket) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }

  const session = res.locals.session as { user: { id: string; role?: string } };
  const senderType =
    session.user.role === "admin" || session.user.role === "agent"
      ? ReplySenderType.agent
      : ReplySenderType.customer;

  const reply = await prisma.reply.create({
    data: {
      ticketId: req.params.id,
      authorId: session.user.id,
      senderType,
      body: result.data.body,
    },
    select: {
      id: true,
      ticketId: true,
      authorId: true,
      author: { select: { id: true, name: true, email: true } },
      senderType: true,
      body: true,
      bodyHtml: true,
      createdAt: true,
    },
  });

  res.status(201).json({ reply });

  if (senderType === ReplySenderType.agent && ticket.fromEmail) {
    sendReplyEmail({
      toEmail: ticket.fromEmail,
      toName: ticket.fromName,
      subject: ticket.subject,
      body: result.data.body,
      agentName: reply.author.name,
    }).catch((err) => console.error("[email] failed to send reply email:", err));
  }
});

router.post("/:id/polish", async (req, res) => {
  const result = polishReplySchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: result.error.issues[0].message });
    return;
  }
  const { body } = result.data;

  const ticket = await prisma.ticket.findUnique({
    where: { id: req.params.id },
    select: { subject: true, bodyText: true, fromName: true },
  });
  if (!ticket) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }

  const session = res.locals.session as { user: { name: string } };
  const polished = await polishReply(body, ticket.subject, session.user.name, ticket.fromName ?? undefined);
  res.json({ polished });
});

router.post("/:id/summarize", async (req, res) => {
  const ticket = await prisma.ticket.findUnique({
    where: { id: req.params.id },
    select: { subject: true, bodyText: true },
  });
  if (!ticket) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }

  const replies = await prisma.reply.findMany({
    where: { ticketId: req.params.id },
    orderBy: { createdAt: "asc" },
    select: {
      senderType: true,
      body: true,
      author: { select: { name: true } },
    },
  });

  const summary = await summarizeTicket(
    ticket.subject,
    ticket.bodyText,
    replies.map((r) => ({ senderType: r.senderType, body: r.body, authorName: r.author.name }))
  );
  res.json({ summary });
});

export default router;
