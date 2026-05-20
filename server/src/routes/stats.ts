import { Router } from "express";
import { prisma } from "../lib/db.js";

const router = Router();

router.get("/tickets-per-day", async (_req, res) => {
  const rows = await prisma.$queryRaw<{ date: string; count: bigint }[]>`
    SELECT * FROM get_tickets_per_day(30)
  `;
  const data = rows.map((r) => ({ date: r.date, count: Number(r.count) }));
  res.json({ data });
});

router.get("/", async (_req, res) => {
  const [row] = await prisma.$queryRaw<
    {
      totalTickets: bigint;
      openTickets: bigint;
      aiResolved: bigint;
      totalResolved: bigint;
      avgResolutionTimeMs: number | null;
    }[]
  >`SELECT * FROM get_ticket_stats()`;

  const totalResolved = Number(row.totalResolved);
  const aiResolved = Number(row.aiResolved);

  res.json({
    totalTickets: Number(row.totalTickets),
    openTickets: Number(row.openTickets),
    aiResolved,
    aiResolutionRate: totalResolved > 0 ? (aiResolved / totalResolved) * 100 : 0,
    avgResolutionTimeMs: row.avgResolutionTimeMs,
  });
});

export default router;
