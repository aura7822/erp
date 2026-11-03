import { auth, currentUser } from "@clerk/nextjs/server";
import { eq, or } from "drizzle-orm";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/db";
import { staff } from "@/db/schema";

export type Role = "admin" | "principal" | "bursar" | "teacher" | "parent" | "student";
export const ROLES: Role[] = ["admin", "principal", "bursar", "teacher", "parent", "student"];

export type Session = { id: string; email: string; name: string; role: Role; staffId: number | null; staffStatus: "pending" | "active" | "revoked" | null };

/**
 * Staff roles live in the `staff` table (admins manage them on the Staff page), so granting or revoking a
 * role takes effect immediately. Email matching is only trusted when Clerk says the address is verified.
 */
const profileCache = new Map<string, { exp: number; email: string; name: string }>();

export const getSession = cache(async (): Promise<Session | null> => {
  const { userId } = await auth(); // local JWT check: fast
  if (!userId) return null;

  let prof = profileCache.get(userId);
  if (!prof || prof.exp < Date.now()) {
    const u = await currentUser(); // Clerk API call: cached for 5 minutes
    if (!u) return null;
    const ea = u.primaryEmailAddress;
    prof = {
      exp: Date.now() + 5 * 60_000,
      email: ea?.verification?.status === "verified" ? ea.emailAddress.toLowerCase() : "",
      name: [u.firstName, u.lastName].filter(Boolean).join(" ") || ea?.emailAddress || "User",
    };
    if (profileCache.size > 500) profileCache.clear();
    profileCache.set(userId, prof);
  }
  const { email, name } = prof;

  const [st] = await db.select().from(staff).where(or(eq(staff.clerkUserId, userId), email ? eq(staff.email, email) : undefined)).limit(1);
  if (st && !st.clerkUserId) await db.update(staff).set({ clerkUserId: userId }).where(eq(staff.id, st.id));

  const admins = (process.env.ADMIN_EMAILS ?? "").toLowerCase().split(",").map((s) => s.trim()).filter(Boolean);
  let role: Role = "parent";
  if (st?.status === "active" && st.role !== "support") role = st.role; // support staff have no system login
  if (email && admins.includes(email)) role = "admin"; // bootstrap admins can never be locked out

  return { id: userId, email, name, role, staffId: st?.id ?? null, staffStatus: st?.status ?? null };
});

/** Server-side guard for pages AND server actions. Redirects instead of throwing. */
export async function requireRole(allowed: Role[]): Promise<Session> {
  const s = await getSession();
  if (!s) redirect("/sign-in");
  if (!allowed.includes(s.role)) redirect("/");
  return s;
}

export const STAFF_VIEW: Role[] = ["admin", "principal", "bursar"];
export const CAN = {
  manageSchool: ["admin"] as Role[],
  manageFinance: ["admin", "bursar"] as Role[],
  teach: ["admin", "teacher"] as Role[],
};

export function homeFor(role: Role) {
  if (STAFF_VIEW.includes(role)) return "/admin";
  if (role === "teacher") return "/teacher/marks";
  return "/portal";
}
