"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import { resolveConflict } from "@/db/repo";
import type { ConflictResolutionStatus } from "@/db/types";

export async function submitConflictResolution(formData: FormData) {
  const conflictId = String(formData.get("conflictId"));
  const resolutionStatus = String(formData.get("resolutionStatus")) as Extract<
    ConflictResolutionStatus,
    "RESOLVED_VERIFIED" | "RESOLVED_STILL_CONFLICTING"
  >;
  const resolvedBy = String(formData.get("resolvedBy") ?? "").trim();
  const resolutionNotes = String(formData.get("resolutionNotes") ?? "").trim();
  const winningFactId = String(formData.get("winningFactId") ?? "") || undefined;

  if (!resolvedBy) {
    throw new Error("Resolving a Conflict requires a named human — AI may create a Conflict but never resolve one (architecture §11).");
  }

  const db = getDb();
  resolveConflict(db, { conflictId, resolvedBy, resolutionStatus, resolutionNotes, winningFactId });

  revalidatePath(`/conflict/${conflictId}`);
}
