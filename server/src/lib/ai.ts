import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { join, dirname } from "path";
import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { TicketCategory } from "../../generated/prisma/enums.js";
import type { TicketModel } from "../../generated/prisma/models/Ticket.js";

if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY env var is required");

const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });

const __dirname = dirname(fileURLToPath(import.meta.url));
const knowledgeBase = readFileSync(join(__dirname, "../../knowledge-base.md"), "utf-8");

export async function summarizeTicket(
  subject: string,
  body: string,
  replies: Array<{ senderType: string; body: string; authorName: string }>
): Promise<string> {
  const replyLines = replies
    .map((r) => `[${r.senderType === "agent" ? "Agent" : "Customer"} - ${r.authorName}]: ${r.body}`)
    .join("\n\n");
  const conversationSection =
    replies.length > 0 ? `\n\nConversation:\n${replyLines}` : "";

  const { text } = await generateText({
    model: openai("gpt-4.1-nano"),
    system:
      "You are a helpful support assistant. Summarize the support ticket and conversation concisely. Include: the customer's issue, key points exchanged, and the current status or resolution if apparent. Keep it to 3–5 sentences. Return only the summary text — no headings, no bullet points.",
    prompt: `Subject: ${subject}\n\nOriginal message:\n${body}${conversationSection}`,
  });
  return text;
}

export async function classifyTicket(
  { subject, bodyText }: Pick<TicketModel, "subject" | "bodyText">
): Promise<TicketCategory> {
  const { text } = await generateText({
    model: openai("gpt-4.1-nano"),
    system:
      'Classify the support ticket into exactly one of these categories: "general_question", "technical_question", or "refund_request". Reply with only the category string — nothing else.',
    prompt: `Subject: ${subject}\n\nMessage:\n${bodyText}`,
  });
  const trimmed = text.trim() as TicketCategory;
  const valid: TicketCategory[] = [
    TicketCategory.general_question,
    TicketCategory.technical_question,
    TicketCategory.refund_request,
  ];
  return valid.includes(trimmed) ? trimmed : TicketCategory.general_question;
}

export async function autoResolveTicket(
  subject: string,
  bodyText: string,
  fromName?: string | null
): Promise<{ resolved: boolean; reply: string | null }> {
  const firstName = fromName ? fromName.split(" ")[0] : null;
  const { text } = await generateText({
    model: openai("gpt-4.1-mini"),
    system: `You are a support ticket auto-resolution system. Your goal is to resolve as many tickets as possible using the knowledge base below — do NOT escalate unnecessarily.

STRICT RULE: Answer using ONLY information explicitly stated in the knowledge base. Do NOT use general knowledge, make assumptions, or invent answers.

RESOLVE the ticket ({"resolved": true, "reply": "..."}) ONLY when the knowledge base explicitly contains information that directly answers the customer's question:
- Policy questions (refunds, access, certificates, lifetime access) covered in the KB
- How-to questions with answers explicitly in the KB
- Troubleshooting steps listed in the KB — sharing those steps IS a full resolution

ESCALATE ({"resolved": false, "reply": null}) when ANY of the following apply:
- The answer is not explicitly stated in the knowledge base — even if you could guess an answer, escalate
- The user explicitly threatens legal action
- The user mentions a chargeback or payment dispute
- The user requests a refund clearly outside the 30-day window
- The user reports a security breach or account compromise

Reply format rules (apply when resolved: true):
- ${firstName ? `Open with "Hi ${firstName},"` : 'Open with "Hi there,"'}
- Write in a professional, warm, and customer-friendly tone
- Use clear formatting: short paragraphs or a numbered/bulleted list when providing steps
- Close with a friendly sign-off line (e.g. "Let us know if you need anything else!")
- End with the signature: "VoipOps Support"

Respond with valid JSON only — no markdown wrapping, no explanation outside the JSON.
{"resolved": true, "reply": "<formatted reply>"} or {"resolved": false, "reply": null}

Knowledge base:
${knowledgeBase}`,
    prompt: `Subject: ${subject}\n\nMessage:\n${bodyText}`,
  });

  try {
    const parsed = JSON.parse(text.trim()) as { resolved: boolean; reply: string | null };
    if (parsed.resolved === true && typeof parsed.reply === "string") {
      return { resolved: true, reply: parsed.reply };
    }
    return { resolved: false, reply: null };
  } catch {
    return { resolved: false, reply: null };
  }
}

export async function polishReply(
  draft: string,
  ticketSubject: string,
  agentName: string,
  customerName?: string
): Promise<string> {
  const customerLine = customerName ? `Customer name: ${customerName}\n` : "";
  const { text } = await generateText({
    model: openai("gpt-4.1-nano"),
    system:
      "You are a helpful support agent assistant. Polish the given draft reply to make it clear, professional, and friendly. If a customer name is provided, address them by first name naturally at the start of the reply. End the reply with a warm, context-appropriate closing phrase (e.g. 'Warm regards,' or 'Thank you for your patience,' — choose naturally based on the tone and content). Do not include a name or URL after the closing; that will be added separately. Return only the improved reply text — no commentary, no preamble, no quotes.",
    prompt: `Ticket subject: ${ticketSubject}\n${customerLine}\nDraft reply:\n${draft}`,
  });
  return `${text}\n${agentName}\nhttps://voipops.com`;
}
