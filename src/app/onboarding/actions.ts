"use server";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { staff } from "@/db/schema";
import { type ActionState, UserError, run, str } from "@/lib/action";
import { getSession } from "@/lib/auth";
import { type StaffRoleV, parseStaff, persistStaff } from "@/lib/staff";

/** Self-registration: creates a PENDING staff record. No access is granted until an admin approves it. */
export async function submitStaffRegistration(_: ActionState, fd: FormData) {
  return run(async () => {
    const s = await getSession();
    if (!s) throw new UserError("Please sign in again.");
    if (!s.email) throw new UserError("Verify your email address first, then try again.");
    const [existing] = await db.select().from(staff).where(eq(staff.email, s.email));
    if (existing) throw new UserError("A staff record already exists for your email.");
    const requested = str(fd, "role");
    if (requested !== "teacher" && requested !== "bursar") throw new UserError("Choose Teacher or Bursar.");
    const role = requested as StaffRoleV;
    const p = parseStaff(fd, { kind: role === "teacher" ? "teaching" : "non_teaching", role });
    if (!p.phone) throw new UserError("Phone number is required.");
    if (!p.nationalId) throw new UserError("National ID number is required.");
    await persistStaff({ ...p, id: null, email: s.email, status: "pending", requestedRole: role, clerkUserId: s.id });
    revalidatePath("/onboarding");
    revalidatePath("/admin/staff");
    return "Request sent. An administrator will review it.";
  });
}
