import { createHmac, timingSafeEqual } from "node:crypto";
import { db } from "@/db";
import { paymentCallbacks } from "@/db/schema";
import { postPayment } from "@/lib/payments";

/**
 * Generic bank/aggregator webhook. Body: { reference, amount, account, paid_at? }
 * Signed with HMAC-SHA256 of the raw body in the X-Signature header (adapt to your bank's scheme).
 */
export async function POST(req: Request) {
  const secret = process.env.BANK_WEBHOOK_SECRET ?? "";
  const raw = await req.text();
  const sig = req.headers.get("x-signature") ?? "";
  const want = createHmac("sha256", secret).update(raw).digest("hex");
  if (!secret || sig.length !== want.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(want))) {
    return new Response("forbidden", { status: 403 });
  }
  const b = JSON.parse(raw);
  await db.insert(paymentCallbacks).values({ source: "bank", payload: b });

  const amount = Number(b.amount);
  if (!b.reference || !(amount > 0)) return Response.json({ error: "invalid payload" }, { status: 422 });

  await postPayment({
    reference: String(b.reference), amount: amount.toFixed(2), method: "Bank",
    billRef: b.account ? String(b.account) : null, paidAt: b.paid_at ? new Date(b.paid_at) : new Date(),
  });
  return Response.json({ status: "ok" });
}
