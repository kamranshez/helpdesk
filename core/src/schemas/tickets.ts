import { z } from "zod";

export type TicketStatus = "open" | "resolved" | "closed";
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

export const ticketStatusSchema = z.enum(["open", "resolved", "closed"]);

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
  createdAt: string;
};

export const createReplySchema = z.object({
  body: z.string().min(1, "Reply cannot be empty").max(10000, "Reply is too long"),
});
export type CreateReplyInput = z.infer<typeof createReplySchema>;

export const inboundEmailSchema = z.object({
  from: z.email("Valid sender email required"),
  fromName: z.string().optional(),
  to: z.string().optional(),
  subject: z.string().min(1, "Subject is required"),
  bodyText: z.string().min(1, "Body is required"),
  bodyHtml: z.string().optional(),
  messageId: z.string().optional(),
  category: ticketCategorySchema.optional(),
});

export type InboundEmailInput = z.infer<typeof inboundEmailSchema>;
