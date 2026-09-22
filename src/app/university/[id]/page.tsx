import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/db/client";
import { getUniversity, listAdmissionCategoriesForUniversity, listFactsForEntity } from "@/db/repo";
import { StatusBadge } from "@/lib/badges";

export default async function UniversityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const university = getUniversity(db, id);
  if (!university) notFound();

  const categories = listAdmissionCategoriesForUniversity(db, id);
  const universityFacts = listFactsForEntity(db, "UNIVERSITY", id);

  return (
    <>
      <div className="crumbs">
        <Link href="/">Universities</Link> / {university.name}
      </div>
      <h1>{university.name} ({university.shortName})</h1>
      <p>Province: {university.province} · Official admissions: <a href={university.officialAdmissionsUrl ?? "#"}>{university.officialAdmissionsUrl}</a></p>

      <h2>Admission Categories</h2>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
          </tr>
        </thead>
        <tbody>
          {categories.map((c) => (
            <tr key={c.id}>
              <td>
                <Link href={`/admission-category/${c.id}`}>{c.name}</Link>
              </td>
              <td>{c.categoryType}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>University-level Facts</h2>
      <table>
        <thead>
          <tr>
            <th>Field</th>
            <th>Status</th>
            <th>Academic Year</th>
          </tr>
        </thead>
        <tbody>
          {universityFacts.map((f) => (
            <tr key={f.id}>
              <td>
                <Link href={`/fact/${f.id}`}>{f.fieldKey}</Link>
              </td>
              <td>
                <StatusBadge status={f.verificationStatus} />
              </td>
              <td>{f.academicYear}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
