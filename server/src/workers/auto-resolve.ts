import type { Job } from "pg-boss";
import boss from "../lib/boss.js";
import { prisma } from "../lib/db.js";
import { autoResolveTicket } from "../lib/ai.js";
import { sendReplyEmail } from "../lib/email.js";
import { TicketStatus, ReplySenderType } from "../../generated/prisma/enums.js";

export const AUTO_RESOLVE_QUEUE = "auto-resolve-ticket";

export const AI_SYSTEM_USER_ID = "00000000-0000-0000-0000-000000000001";

export type AutoResolveJobData = {
  ticketId: string;
  subject: string;
  bodyText: string;
  fromName?: string | null;
};

async function ensureAiSystemUser() {
  await prisma.user.upsert({
    where: { id: AI_SYSTEM_USER_ID },
    update: {},
    create: {
      id: AI_SYSTEM_USER_ID,
      name: "VoipOps Support",
      email: "ai@system.internal",
      emailVerified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });
}

export async function registerAutoResolveWorker() {
  await ensureAiSystemUser();
  await boss.createQueue(AUTO_RESOLVE_QUEUE);
  await boss.work(AUTO_RESOLVE_QUEUE, async (jobs: Job<AutoResolveJobData>[]) => {
    const { ticketId, subject, bodyText, fromName } = jobs[0].data;

    await prisma.ticket.update({
      where: { id: ticketId },
      data: { status: TicketStatus.processing },
    });

    const { resolved, reply } = await autoResolveTicket(subject, bodyText, fromName);

    if (resolved && reply) {
      const ticket = await prisma.ticket.findUnique({
        where: { id: ticketId },
        select: { fromEmail: true, fromName: true, subject: true },
      });

      await prisma.$transaction([
        prisma.reply.create({
          data: {
            ticketId,
            authorId: AI_SYSTEM_USER_ID,
            senderType: ReplySenderType.agent,
            body: reply,
          },
        }),
        prisma.ticket.update({
          where: { id: ticketId },
          data: { status: TicketStatus.resolved, resolvedByAI: true, resolvedAt: new Date() },
        }),
      ]);

      if (ticket?.fromEmail) {
        sendReplyEmail({
          toEmail: ticket.fromEmail,
          toName: ticket.fromName,
          subject: ticket.subject,
          body: reply,
          agentName: "VoipOps Support",
        }).catch((err) => console.error("[email] failed to send AI reply email:", err));
      }
    } else {
      await prisma.ticket.update({
        where: { id: ticketId },
        data: { status: TicketStatus.open },
      });
    }
  });
}
