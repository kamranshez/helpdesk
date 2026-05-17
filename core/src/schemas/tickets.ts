import { z } from "zod";

export const ticketCategorySchema = z.enum([
  "general_question",
  "technical_question",
  "refund_request",
]);

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
