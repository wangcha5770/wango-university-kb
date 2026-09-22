"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import { verifyFact } from "@/db/repo";
import type { VerificationStatus } from "@/db/types";

export async function submitFactReview(formData: FormData) {
  const factId = String(formData.get("factId"));
  const status = String(formData.get("status")) as Extract<VerificationStatus, "VERIFIED" | "NEEDS_REVIEW" | "NOT_VERIFIED">;
  const reviewedBy = String(formData.get("reviewedBy") ?? "").trim();

  if (!reviewedBy) {
    throw new Error("A reviewer name is required — a Fact can only be verified by a named human (architecture §9).");
  }

  const db = getDb();
  verifyFact(db, { factId, status, reviewedBy });

  revalidatePath(`/fact/${factId}`);
}
