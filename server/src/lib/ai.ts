import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";

if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY env var is required");

const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });

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
