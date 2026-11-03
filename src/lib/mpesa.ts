import { normalizePhone } from "./money";

const base = () => (process.env.MPESA_ENV === "live" ? "https://api.safaricom.co.ke" : "https://sandbox.safaricom.co.ke");
let cached: { token: string; exp: number } | null = null;

async function token(): Promise<string> {
  if (cached && cached.exp > Date.now()) return cached.token;
  const basic = Buffer.from(`${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`).toString("base64");
  const res = await fetch(`${base()}/oauth/v1/generate?grant_type=client_credentials`, { headers: { Authorization: `Basic ${basic}` }, cache: "no-store" });
  if (!res.ok) throw new Error(`Daraja auth failed: ${res.status}`);
  const j = await res.json();
  cached = { token: j.access_token, exp: Date.now() + 50 * 60 * 1000 };
  return cached.token;
}

const nairobiStamp = () => new Date(Date.now() + 3 * 3600 * 1000).toISOString().replace(/\D/g, "").slice(0, 14);

export async function stkPush(opts: { phone: string; amount: number; accountRef: string; desc?: string }) {
  const shortcode = process.env.MPESA_SHORTCODE!;
  const ts = nairobiStamp();
  const phone = normalizePhone(opts.phone);
  const res = await fetch(`${base()}/mpesa/stkpush/v1/processrequest`, {
    method: "POST",
    headers: { Authorization: `Bearer ${await token()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      BusinessShortCode: shortcode,
      Password: Buffer.from(shortcode + process.env.MPESA_PASSKEY + ts).toString("base64"),
      Timestamp: ts,
      TransactionType: "CustomerPayBillOnline",
      Amount: Math.ceil(opts.amount), // Daraja takes whole shillings
      PartyA: phone, PartyB: shortcode, PhoneNumber: phone,
      CallBackURL: `${process.env.APP_URL}/api/mpesa/stk-callback?token=${process.env.MPESA_CALLBACK_TOKEN}`,
      AccountReference: opts.accountRef,
      TransactionDesc: opts.desc ?? "School fees",
    }),
    cache: "no-store",
  });
  const j = await res.json();
  if (!res.ok || j.ResponseCode !== "0") throw new Error(j.errorMessage ?? j.ResponseDescription ?? "STK push failed");
  return j as { MerchantRequestID: string; CheckoutRequestID: string };
}

/** Run once per environment (see README). */
export async function registerC2bUrls() {
  const t = process.env.MPESA_CALLBACK_TOKEN;
  const res = await fetch(`${base()}/mpesa/c2b/v1/registerurl`, {
    method: "POST",
    headers: { Authorization: `Bearer ${await token()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      ShortCode: process.env.MPESA_SHORTCODE, ResponseType: "Completed",
      ConfirmationURL: `${process.env.APP_URL}/api/mpesa/c2b/confirm?token=${t}`,
      ValidationURL: `${process.env.APP_URL}/api/mpesa/c2b/validate?token=${t}`,
    }),
  });
  return res.json();
}

/** "20260115103045" (Nairobi time) -> Date */
export function parseDarajaTime(s: string): Date {
  const m = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(s);
  return m ? new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}+03:00`) : new Date();
}
