import { timingSafeEqual } from "node:crypto";

export function tokenOk(req: Request): boolean {
  const given = new URL(req.url).searchParams.get("token") ?? "";
  const want = process.env.MPESA_CALLBACK_TOKEN ?? "";
  if (!want || given.length !== want.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(want));
}
export const accepted = () => Response.json({ ResultCode: 0, ResultDesc: "Accepted" });
