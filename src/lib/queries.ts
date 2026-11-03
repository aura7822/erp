import { db } from "@/db";
import { classes, streams } from "@/db/schema";
import type { ClassOpt } from "@/components/StudentForm";

export async function classOptions(): Promise<ClassOpt[]> {
  const [cls, st] = await Promise.all([db.select().from(classes).orderBy(classes.level), db.select().from(streams).orderBy(streams.stream)]);
  return cls.map((c) => ({ id: c.id, name: c.className, streams: st.filter((s) => s.classId === c.id).map((s) => ({ id: s.id, name: s.stream })) }));
}
