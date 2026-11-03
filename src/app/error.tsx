"use client";
import { ErrorView } from "@/components/ErrorView";
export default function Error(p: { error: Error & { digest?: string }; reset: () => void }) { return <main className="p-4"><ErrorView {...p} /></main>; }
