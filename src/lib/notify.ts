import { Resend } from "resend";
import { normalizePhone } from "./money";

let resend: Resend | null = null;
const client = () => (resend ??= new Resend(process.env.RESEND_API_KEY));

export async function sendEmail(to: string, subject: string, text: string) {
  if (!process.env.RESEND_API_KEY) return;
  try {
    await client().emails.send({ from: process.env.MAIL_FROM ?? "School <onboarding@resend.dev>", to, subject, text });
  } catch (e) { console.error("email failed", e); }
}

/** Africa's Talking. No-op until AT_KEY is set. */
export async function sendSms(phone: string, message: string) {
  if (!process.env.AT_KEY || !process.env.AT_USERNAME) return;
  try {
    await fetch("https://api.africastalking.com/version1/messaging", {
      method: "POST",
      headers: { apiKey: process.env.AT_KEY, Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ username: process.env.AT_USERNAME, to: "+" + normalizePhone(phone), message }),
    });
  } catch (e) { console.error("sms failed", e); }
}

export async function notifyGuardian(g: { email: string | null; phone: string }, subject: string, text: string) {
  await Promise.all([g.email ? sendEmail(g.email, subject, text) : null, sendSms(g.phone, text)]);
}

/** Resend batch API: up to 100 emails per request (also stays under the free-tier rate limit). */
export async function sendEmailBatch(items: { to: string; subject: string; text: string; html?: string }[]): Promise<number> {
  if (!process.env.RESEND_API_KEY || items.length === 0) return 0;
  let sent = 0;
  for (let i = 0; i < items.length; i += 100) {
    const chunk = items.slice(i, i + 100);
    try {
      await client().batch.send(chunk.map((m) => ({ from: process.env.MAIL_FROM ?? "School <onboarding@resend.dev>", to: [m.to], subject: m.subject, text: m.text, html: m.html })));
      sent += chunk.length;
    } catch (e) { console.error("batch email failed", e); }
  }
  return sent;
}
