import { Router } from "express";
import { prisma } from "../lib/db.js";

const router = Router();

const SORTABLE_COLUMNS = ["subject", "fromEmail", "status", "category", "createdAt"] as const;
type SortableColumn = (typeof SORTABLE_COLUMNS)[number];

router.get("/", async (req, res) => {
  const sortBy: SortableColumn = SORTABLE_COLUMNS.includes(req.query.sortBy as SortableColumn)
    ? (req.query.sortBy as SortableColumn)
    : "createdAt";
  const sortOrder = req.query.sortOrder === "asc" ? "asc" : "desc";

  const tickets = await prisma.ticket.findMany({
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
