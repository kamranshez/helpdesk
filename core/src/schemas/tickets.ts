import { z } from "zod";

export type TicketStatus = "new" | "processing" | "open" | "resolved" | "closed";
export type TicketCategory = "general_question" | "technical_question" | "refund_request";

export type Ticket = {
  id: string;
  subject: string;
  fromEmail: string;
  fromName: string | null;
  status: TicketStatus;
  category: TicketCategory | null;
  createdAt: string;
};

export type TicketDetail = Ticket & {
  bodyText: string;
  bodyHtml: string | null;
  toEmail: string | null;
  updatedAt: string;
  assignedTo: { id: string; name: string; email: string } | null;
};

export const ticketStatusSchema = z.enum(["new", "processing", "open", "resolved", "closed"]);

export const ticketCategorySchema = z.enum([
  "general_question",
  "technical_question",
  "refund_request",
]);

export const updateTicketSchema = z.object({
  assignedToId: z.string().min(1, "Invalid agent ID").nullable().optional(),
  status: ticketStatusSchema.optional(),
  category: ticketCategorySchema.nullable().optional(),
});
export type UpdateTicketInput = z.infer<typeof updateTicketSchema>;

export type ReplySenderType = "agent" | "customer";

export type Reply = {
  id: string;
  ticketId: string;
  authorId: string;
  author: { id: string; name: string; email: string };
  senderType: ReplySenderType;
  body: string;
  bodyHtml: string | null;
  createdAt: string;
};

export const createReplySchema = z.object({
  body: z.string().min(1, "Reply cannot be empty").max(10000, "Reply is too long"),
});
export type CreateReplyInput = z.infer<typeof createReplySchema>;

export const polishReplySchema = z.object({
  body: z.string().min(1, "Reply cannot be empty").max(10000, "Reply is too long"),
});
export type PolishReplyInput = z.infer<typeof polishReplySchema>;

export const inboundEmailSchema = z.object({
  from: z.email("Valid sender email required").max(254),
  fromName: z.string().max(100).optional(),
  to: z.string().max(254).optional(),
  subject: z.string().min(1, "Subject is required").max(998),
  bodyText: z.string().min(1, "Body is required").max(200_000),
  bodyHtml: z.string().max(500_000).optional(),
  messageId: z.string().max(998).optional(),
  category: ticketCategorySchema.optional(),
});

export type InboundEmailInput = z.infer<typeof inboundEmailSchema>;
