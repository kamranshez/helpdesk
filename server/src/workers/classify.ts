import type { Job } from "pg-boss";
import boss from "../lib/boss.js";
import { prisma } from "../lib/db.js";
import { classifyTicket } from "../lib/ai.js";

export const CLASSIFY_QUEUE = "classify-ticket";

export type ClassifyJobData = {
  ticketId: string;
  subject: string;
  bodyText: string;
};

export async function registerClassifyWorker() {
  await boss.createQueue(CLASSIFY_QUEUE);
  await boss.work(CLASSIFY_QUEUE, async (jobs: Job<ClassifyJobData>[]) => {
    const { ticketId, subject, bodyText } = jobs[0].data;
    const category = await classifyTicket({ subject, bodyText });
    await prisma.ticket.update({ where: { id: ticketId }, data: { category } });
  });
}
