import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/db/client";
import { getSource, listEvidenceForSource } from "@/db/repo";
import { StatusBadge } from "@/lib/badges";

export default async function SourcePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const source = getSource(db, id);
  if (!source) notFound();
  const evidence = listEvidenceForSource(db, id);

  return (
    <>
      <div className="crumbs">
        <Link href="/">Home</Link> / Source
      </div>
      <h1>{source.title}</h1>
      {source.notes?.startsWith("SIMULATED") && <div className="simulated">{source.notes}</div>}
      <table>
        <tbody>
          <tr>
            <th>URL</th>
            <td>
              <a href={source.url}>{source.url}</a>
            </td>
          </tr>
          <tr>
            <th>Source type</th>
            <td>{source.sourceType}</td>
          </tr>
          <tr>
            <th>Publisher</th>
            <td>{source.publisher}</td>
          </tr>
          <tr>
            <th>Academic year (as stated by source)</th>
            <td>{source.academicYear ?? "(not stated on the page)"}</td>
          </tr>
          <tr>
            <th>Published / updated date</th>
            <td>{source.publishedOrUpdatedDate ?? "(not captured)"}</td>
          </tr>
          <tr>
            <th>Retrieved date</th>
            <td>{source.retrievedDate}</td>
          </tr>
          <tr>
            <th>Source status</th>
            <td>
              <StatusBadge status={source.sourceStatus} />
            </td>
          </tr>
          <tr>
            <th>Source status reasoning</th>
            <td>{source.sourceStatusReasoning}</td>
          </tr>
        </tbody>
      </table>

      <h2>Evidence captured from this Source</h2>
      <table>
        <thead>
          <tr>
            <th>Excerpt</th>
            <th>Locator</th>
            <th>Captured</th>
          </tr>
        </thead>
        <tbody>
          {evidence.map((e) => (
            <tr key={e.id}>
              <td>“{e.excerpt}”</td>
              <td>{e.locator}</td>
              <td>{e.capturedDate}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
