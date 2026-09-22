import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/db/client";
import { getConflict, getFact, getSource } from "@/db/repo";
import { StatusBadge } from "@/lib/badges";
import { submitConflictResolution } from "./actions";

export default async function ConflictPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const conflict = getConflict(db, id);
  if (!conflict) notFound();

  const facts = conflict.affectedFactIds.map((fid) => getFact(db, fid)!);
  const sourceA = getSource(db, conflict.sourceAId)!;
  const sourceB = getSource(db, conflict.sourceBId)!;
  const isOpen = conflict.resolutionStatus === "OPEN" || conflict.resolutionStatus === "HUMAN_REVIEW";

  return (
    <>
      <div className="crumbs">
        <Link href="/">Home</Link> / Conflict
      </div>
      <h1>Conflict</h1>
      {conflict.isSimulated && <div className="simulated">{conflict.simulatedLabel}. This is a test fixture, not a real disagreement among UBC sources.</div>}

      <table>
        <tbody>
          <tr>
            <th>Description</th>
            <td>{conflict.conflictDescription}</td>
          </tr>
          <tr>
            <th>Detected date</th>
            <td>{conflict.detectedDate}</td>
          </tr>
          <tr>
            <th>Resolution status</th>
            <td>{conflict.resolutionStatus}</td>
          </tr>
          <tr>
            <th>Source A</th>
            <td>
              <Link href={`/source/${sourceA.id}`}>{sourceA.title}</Link>
            </td>
          </tr>
          <tr>
            <th>Source B</th>
            <td>
              <Link href={`/source/${sourceB.id}`}>{sourceB.title}</Link>
            </td>
          </tr>
          {conflict.resolvedBy && (
            <>
              <tr>
                <th>Resolved by</th>
                <td>{conflict.resolvedBy}</td>
              </tr>
              <tr>
                <th>Resolution notes</th>
                <td>{conflict.resolutionNotes}</td>
              </tr>
            </>
          )}
        </tbody>
      </table>

      <h2>Affected Facts</h2>
      <table>
        <thead>
          <tr>
            <th>Value</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {facts.map((f) => (
            <tr key={f.id}>
              <td>
                <Link href={`/fact/${f.id}`}>{f.value}</Link>
              </td>
              <td>
                <StatusBadge status={f.verificationStatus} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {isOpen && (
        <form className="review" action={submitConflictResolution}>
          <input type="hidden" name="conflictId" value={conflict.id} />
          <h2 style={{ marginTop: 0 }}>Resolve this Conflict</h2>
          <p>Only a named human may resolve a Conflict. AI created this record but cannot pick a winner.</p>
          <label>
            Your name:&nbsp;
            <input type="text" name="resolvedBy" placeholder="Wango" required />
          </label>
          <div style={{ marginTop: 8 }}>
            <label>
              Winning Fact (only used if resolving to VERIFIED):&nbsp;
              <select name="winningFactId">
                {facts.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.value}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div style={{ marginTop: 8 }}>
            <label>
              <input type="radio" name="resolutionStatus" value="RESOLVED_VERIFIED" defaultChecked /> Resolve: the selected Fact is correct → VERIFIED
              (the other side becomes NOT_VERIFIED)
            </label>
          </div>
          <div>
            <label>
              <input type="radio" name="resolutionStatus" value="RESOLVED_STILL_CONFLICTING" /> Keep both on record — still conflicting
            </label>
          </div>
          <div style={{ marginTop: 8 }}>
            <label>
              Notes:&nbsp;
              <textarea name="resolutionNotes" rows={2} cols={50} required />
            </label>
          </div>
          <button type="submit" style={{ marginTop: 10 }}>
            Submit resolution
          </button>
        </form>
      )}
    </>
  );
}
