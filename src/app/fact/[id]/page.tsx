import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/db/client";
import { getFact, getFactHistory, getEvidence, getSource, getConflict } from "@/db/repo";
import { StatusBadge } from "@/lib/badges";
import { submitFactReview } from "./actions";

export default async function FactPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const fact = getFact(db, id);
  if (!fact) notFound();

  const history = getFactHistory(db, id);
  const isSimulated = fact.academicYear === "SIMULATED TEST CASE";
  const conflict = fact.conflictId ? getConflict(db, fact.conflictId) : null;

  return (
    <>
      <div className="crumbs">
        <Link href="/">Home</Link> / Fact
      </div>
      <h1>{fact.fieldKey}</h1>
      {isSimulated && (
        <div className="simulated">
          SIMULATED — NOT REAL UBC REQUIREMENT. This Fact exists only to exercise the Conflict pipeline (architecture §11/§8). It does not describe an
          actual UBC policy.
        </div>
      )}

      <table>
        <tbody>
          <tr>
            <th>Value</th>
            <td>{fact.value}</td>
          </tr>
          <tr>
            <th>Academic Year</th>
            <td>{fact.academicYear}</td>
          </tr>
          <tr>
            <th>Applicability</th>
            <td>
              <div>Applicant type: {Array.isArray(fact.applicability.applicantType) ? fact.applicability.applicantType.join(", ") : fact.applicability.applicantType}</div>
              <div>Province: {fact.applicability.province ?? "—"}</div>
              <div>Campus: {fact.applicability.campus ?? "—"}</div>
              <div>Intake: {fact.applicability.intake ?? "—"}</div>
            </td>
          </tr>
          <tr>
            <th>Verification Status</th>
            <td>
              <StatusBadge status={fact.verificationStatus} />
            </td>
          </tr>
          <tr>
            <th>Extracted by</th>
            <td>{fact.extractedBy}</td>
          </tr>
          <tr>
            <th>Confirmed by</th>
            <td>{fact.confirmedBy ?? "— (not yet reviewed by a human)"}</td>
          </tr>
          <tr>
            <th>Last verified date</th>
            <td>{fact.lastVerifiedDate ?? "—"}</td>
          </tr>
        </tbody>
      </table>

      {conflict && (
        <div className={conflict.isSimulated ? "simulated" : "gap-note"}>
          {conflict.isSimulated && <strong>{conflict.simulatedLabel}. </strong>}
          This Fact is part of an open Conflict: {conflict.conflictDescription}{" "}
          <Link href={`/conflict/${conflict.id}`}>Review the Conflict →</Link>
        </div>
      )}

      <h2>Evidence backing this Fact</h2>
      <table>
        <thead>
          <tr>
            <th>Excerpt</th>
            <th>Locator</th>
            <th>Source</th>
          </tr>
        </thead>
        <tbody>
          {fact.evidenceIds.length === 0 && (
            <tr>
              <td colSpan={3}>
                <em>No Evidence — this Fact is NOT_VERIFIED by design (No Source, No Fact).</em>
              </td>
            </tr>
          )}
          {fact.evidenceIds.map((eid) => {
            const ev = getEvidence(db, eid)!;
            const src = getSource(db, ev.sourceId)!;
            return (
              <tr key={eid}>
                <td>“{ev.excerpt}”</td>
                <td>{ev.locator}</td>
                <td>
                  <Link href={`/source/${src.id}`}>{src.title}</Link> (<StatusBadge status={src.sourceStatus} />)
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <h2>History (append-only)</h2>
      <table>
        <thead>
          <tr>
            <th>Academic Year</th>
            <th>Value</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {history.map((h) => (
            <tr key={h.id} style={{ fontWeight: h.id === fact.id ? 700 : 400 }}>
              <td>{h.academicYear}</td>
              <td>
                {h.id === fact.id ? h.value : <Link href={`/fact/${h.id}`}>{h.value}</Link>}
              </td>
              <td>
                <StatusBadge status={h.verificationStatus} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {!conflict && (
        <form className="review" action={submitFactReview}>
          <input type="hidden" name="factId" value={fact.id} />
          <h2 style={{ marginTop: 0 }}>Review this Fact</h2>
          <p>
            Only a named human review can set VERIFIED. AI cannot set this status — the system rejects &ldquo;AI&rdquo; (or similar) as a reviewer name.
          </p>
          <label>
            Your name:&nbsp;
            <input type="text" name="reviewedBy" placeholder="Wango" required />
          </label>
          <div style={{ marginTop: 8 }}>
            <label>
              <input type="radio" name="status" value="VERIFIED" defaultChecked /> VERIFY
            </label>
            &nbsp;&nbsp;
            <label>
              <input type="radio" name="status" value="NEEDS_REVIEW" /> Keep NEEDS REVIEW
            </label>
            &nbsp;&nbsp;
            <label>
              <input type="radio" name="status" value="NOT_VERIFIED" /> Mark NOT VERIFIED
            </label>
          </div>
          <button type="submit" style={{ marginTop: 10 }}>
            Submit review
          </button>
        </form>
      )}
      {conflict && conflict.resolutionStatus !== "RESOLVED_VERIFIED" && conflict.resolutionStatus !== "RESOLVED_STILL_CONFLICTING" && (
        <p>
          This Fact is part of an unresolved Conflict — review it from the <Link href={`/conflict/${conflict.id}`}>Conflict page</Link> instead of here,
          so both sides are resolved together.
        </p>
      )}
    </>
  );
}
