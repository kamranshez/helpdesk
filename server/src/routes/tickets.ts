import { Router } from "express";
import { prisma } from "../lib/db.js";
import { TicketStatus, TicketCategory } from "../../generated/prisma/enums.js";

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

  const tickets = await prisma.ticket.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(category ? { category } : {}),
      ...(search
        ? {
            OR: [
              { subject: { contains: search, mode: "insensitive" } },
              { fromEmail: { contains: search, mode: "insensitive" } },
              { fromName: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { [sortBy]: sortOrder },
    select: {
      id: true,
      subject: true,
      fromEmail: true,
      fromName: true,
      status: true,
      category: true,
      createdAt: true,
    },
  });
  res.json({ tickets });
});

export default router;
