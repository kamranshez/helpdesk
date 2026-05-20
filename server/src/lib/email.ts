const MAILERSEND_API_KEY = process.env.MAILERSEND_API_KEY;
const MAILERSEND_FROM_EMAIL = process.env.MAILERSEND_FROM_EMAIL;
const MAILERSEND_FROM_NAME = process.env.MAILERSEND_FROM_NAME ?? "Helpdesk Support";

export async function sendReplyEmail({
  toEmail,
  toName,
  subject,
  body,
  agentName,
}: {
  toEmail: string;
  toName?: string | null;
  subject: string;
  body: string;
  agentName: string;
}): Promise<void> {
  if (!MAILERSEND_API_KEY || !MAILERSEND_FROM_EMAIL) {
    console.warn("[email] MAILERSEND_API_KEY or MAILERSEND_FROM_EMAIL not set — skipping");
    return;
  }

  const htmlBody = body.replace(/\n/g, "<br>");

  const res = await fetch("https://api.mailersend.com/v1/email", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${MAILERSEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: { email: MAILERSEND_FROM_EMAIL, name: MAILERSEND_FROM_NAME },
      to: [{ email: toEmail, ...(toName ? { name: toName } : {}) }],
      subject: `Re: ${subject}`,
      text: body,
      html: `<p>${htmlBody}</p><p style="color:#888;font-size:12px;">— ${agentName}</p>`,
    }),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`MailerSend error ${res.status}: ${error}`);
  }
}
